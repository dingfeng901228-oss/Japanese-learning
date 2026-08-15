# Phase 1 Enhancement Scope — STT 长音频 + 反馈细化 + 错误记忆

**Status**: 🟡 Phase 1 base 已 ship（2026-08-12 commit `fc5adb3`）。本文件 scope **Phase 1 增强**。
**Roadmap 11 Phases**: ✅ 0 · ✅ 6 · ✅ 10 · 🟡 1 (base → **增强**) · ⬜ 2 · ⬜ 3 · ⬜ 4 · ⬜ 5 · ⬜ 7 · ⬜ 8 · ⬜ 9
**Order**: 0 → 6 → 10 → 1 (base → 增强) → 7-9
**Deploy**: Vercel (auto on push to `main`) → https://jp.frank2025.com

---

## TL;DR

3 个 enhancement 拆成 **3 个 PR-sized task**（可独立 ship）：

| Task | 目的 | 改的文件 | 估计工时 | 风险 |
|---|---|---|---|---|
| **P1.A — STT 长音频** | 解决 >2 分钟录音的稳定性 | 1 route + 1 client util | 2-3h | 低（纯 additive，default 行为不变） |
| **P1.B — 反馈细化** | 让 /api/grade 输出可用 structured data（不只是 score） | 1 route + 1 client render | 3-4h | 中（contract 变更但 backward compatible） |
| **P1.C — 错误记忆** | 跨 session 跟踪错误模式 + SRS 推荐 | 1 schema + 1 lib + 1 UI panel | 6-8h | 中（新表 + RLS policy + 离线降级到 localStorage） |

每个 task 都可以独立 ship + 独立测。如果时间紧按 A → B → C 顺序做（A 是单点 fix，B 改 UX，C 是新能力）。

---

## 当前状态（Phase 1 base 已 ship）

### 已实现

- `app/api/transcribe/route.ts` — gpt-4o-transcribe, language=ja, response_format=json（无 size check）
- `app/api/grade/route.ts` — gpt-4o-mini, structured JSON output（accuracy/fluency/feedback/suggestions/encouragement）
- `app/api/feedback/route.ts` — 整个 session 的 grammar/vocab feedback（已存在，Phase 2 ship'd）
- `app/listening/page.tsx` — Phase 1 base，Listen + Shadow tabs，MediaRecorder webm/opus
- `app/speaking/page.tsx` — AI 教练对话 + Web Speech API 输入 + feedback language toggle（已 hard-code zh）
- Shadow history: localStorage 最近 50 条
- 错误记忆: ✅ **已 partial 实现** — `speaking/page.tsx` Phase 4 存 `japaneseLearning.mistakeHistory` 到 localStorage（含 grammar/vocabulary 数组），`/today` 显示"最近弱点"

### 已知的限制

| 问题 | 现状 | 影响 |
|---|---|---|
| 长录音 STT 不稳定 | `app/api/transcribe/route.ts` 接收 blob 直传，**没 size check** | MediaRecorder 默认无长度限制，60s+ 可能 fail / OOM |
| 评分输出是 score-only | `app/api/grade/route.ts` 没有 per-word diff / character-level 反馈 | 学员不知道为什么扣分 |
| 错误跨 session 追踪 | localStorage 限单 device, 50 条 cap | 换电脑 / 清缓存 = 错点历史归零 |
| 错误粒度粗 | grammar/vocabulary 是 free-text string array | 没法分类统计"介词错误"vs"助词错误" |

---

## P1.A — STT 长音频支持

### 现状分析

`app/api/transcribe/route.ts` 当前实现：

```ts
const form = await req.formData();
const file = form.get("audio");
// 直接传给 OpenAI SDK, 没 size check
const transcription = await client.audio.transcriptions.create({
  file: file as unknown as File,
  model: "gpt-4o-transcribe",
  language: "ja",
  response_format: "json",
});
```

**真实瓶颈不是 25MB**（gpt-4o-transcribe 上限）：
- MediaRecorder webm/opus 64kbps → 1 分钟约 0.5MB → 25MB ≈ 50 分钟
- **真正的瓶颈**是 Next.js Route Handler 默认 **4.5MB body limit**（`@vercel/node` serverless function）→ 超出 → 502 / "Request body larger than maxBodyLength limit"

加上 **OpenAI API timeout 30s** + **Vercel function timeout 10s (Hobby) / 60s (Pro)**，长录音会从多个角度 fail。

### 目标

学员 Shadow 一个 30s+ 句子（N2/N1 句子平均 4-6s，但是 N3+ 长对话模拟可能 30s+）能稳定出 transcript，不 OOM / 不超时。

### 文件改动

| 文件 | 改动 |
|---|---|
| `app/api/transcribe/route.ts` | 加 size guard + Vercel body limit 提示 |
| `app/listening/page.tsx` | 客户端分段录制（可选） |
| `app/api/transcribe/long-audio/route.ts` | (可选) 长音频专用 endpoint，client-side chunk |

### API contract

**当前**:
```http
POST /api/transcribe
Content-Type: multipart/form-data
Body: audio=<blob>

Response 200: { "text": "..." }
Response 400: { "error": "audio file is required..." }
Response 500: { "error": "..." }
```

**升级后**（additive，backward compat）:
```http
POST /api/transcribe
Content-Type: multipart/form-data
Body: audio=<blob>

Response 200: { "text": "...", "durationSec": 32, "modelUsed": "gpt-4o-transcribe" }
Response 413: { "error": "Audio too large. Max 25MB. Got 32MB.", "maxBytes": 26214400 }
Response 400: { "error": "audio file is required..." }
Response 500: { "error": "..." }
```

### 实现细节

#### Server side (`route.ts`)

```ts
const MAX_BYTES = 25 * 1024 * 1024; // 25MB hard cap (OpenAI limit)
const SOFT_BYTES = 20 * 1024 * 1024; // 20MB soft warn

// 在 formData() 之前先检查 Content-Length
const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
if (contentLength > MAX_BYTES) {
  return NextResponse.json(
    { error: `Audio too large. Max ${MAX_BYTES} bytes.`, maxBytes: MAX_BYTES },
    { status: 413 }
  );
}
```

#### Client side (`listening/page.tsx`)

- 加 **分段录制** 模式: 学员按一个长按钮持续录，每 5s 自动 chunk 提交，server 拼接
- 或 **明确 cap** 录音时长: 30s 后 MediaRecorder 自动 stop
- 默认 30s cap 简单实现：record 时累加 `recordingTime`, 到 30s 触发 stop + 自动走 pipeline

#### Optional: 长音频专用 endpoint

`app/api/transcribe/long-audio/route.ts` — Vercel **Pro plan 60s timeout**，可以走 gpt-4o-transcribe 完整流程；chunk 数 ≤ 5 拼接。

### 工时 / Risk

- **2-3 小时**（基础 size guard + 30s client cap）
- **+ 2 小时**（如果做 client-side chunking）
- **Risk**: 低 — 全 additive；不改 happy path 行为
- **依赖**: 无（OpenAI SDK 已经处理 25MB 内上传）

### PR-size 拆法

- PR #1 (2h): server-side size guard + 413 response + Vercel function body config
- PR #2 (1h): client-side 30s auto-stop + 大于 4MB warning toast

---

## P1.B — 反馈细化 (Structured Output)

### 现状分析

`app/api/grade/route.ts` 返回：

```json
{
  "grade": {
    "accuracy": 85,
    "fluency": 90,
    "feedback": "整体不错",
    "suggestions": ["「が」要发得更短促"],
    "encouragement": "继续加油"
  },
  "sentenceId": "daily-n5-1"
}
```

学员看到的是 score + 自由文本 suggestion。**没有结构化对比**，无法看出"哪个词错了 / 哪个音节不标准 / 助词对不对"。

### 目标

`/api/grade` 返回结构化输出（per-token diff + 错误类型 + native diff），前端用红色 strike-through 渲染 target vs transcript 的逐字对比，hover 弹出错误类型。

### 文件改动

| 文件 | 改动 |
|---|---|
| `app/api/grade/route.ts` | 加 structured output schema: `tokens[]`, `issues[]`, `nativeDiff` |
| `app/listening/page.tsx` | 渲染逐字 diff + issues tooltip |
| `app/api/grade/schema.ts` (new) | shared TypeScript types |

### API contract (新字段 + 保持旧字段 backward compatible)

**Request**:
```json
{
  "transcript": "きょうはいいてんきだ",
  "target": "今日はいい天気だ",
  "sentenceId": "weather-n5-3",
  "categoryLabel": "天气"
}
```

**Response (升级后)**:
```json
{
  "grade": {
    "accuracy": 85,
    "fluency": 90,
    "feedback": "整体不错",
    "suggestions": ["「は」要发成 wa 不是 ha"],
    "encouragement": "..."
  },
  "sentenceId": "weather-n5-3",
  // ↓ 新字段（optional，客户端用 destructure 优雅降级）
  "diff": {
    "tokens": [
      { "text": "今日", "target": "今日", "transcript": "今日", "status": "matched" },
      { "text": "は",   "target": "は",   "transcript": "は",   "status": "matched" },
      { "text": "いい", "target": "いい", "transcript": "いい", "status": "matched" },
      { "text": "天気", "target": "天気", "transcript": "てんき", "status": "mismatched", "transcriptForm": "てんき" },
      { "text": "だ",   "target": "だ",   "transcript": "だ",   "status": "matched" }
    ],
    "matchRate": 0.80
  },
  "issues": [
    {
      "type": "kanji-reading",
      "tokenIndex": 3,
      "expected": "天気",
      "heard": "てんき",
      "severity": "minor",
      "hint": "「天」读 てん, 「気」读 き; 重音是 だいか (平板)"
    }
  ]
}
```

**Issue types**:
- `particle-confusion` (は/が/を/に)
- `kanji-reading` (汉字读音错)
- `pitch-accent` (重音位置错, N3+)
- `verb-conjugation` (活用形错)
- `missing-word` (丢词)
- `extra-word` (多词)
- `word-order` (语序错)

### 实现细节

#### Server side

**Prompt 升级** (SYSTEM_PROMPT):
```
输出 JSON 包含:
1. grade (旧字段, 保持)
2. diff.tokens[] (逐字 diff)
3. issues[] (结构化错误, 每条含 type/severity/hint)
```

**Token 切分**: 用 `kuromoji.js` 或简单 regex（MeCab 是 native binary，Vercel 不能装）。先用 regex split + character-level diff，后期切 kuromoji。

#### Client side (`listening/page.tsx`)

- 已有 `computeWordDiff()` 函数 (Phase 1 enhancement 加的) — 升级到用 server-returned `diff.tokens[]` 优先，fallback 到 client 计算
- 加 `issues` 渲染: 每个 token 下面挂 hover tooltip 显示 hint

### 工时 / Risk

- **3-4 小时**（server schema + 客户端 diff 渲染升级）
- **Risk**: 中 — contract 改了，但旧字段保留，旧客户端代码不会 break
- **依赖**: 无；纯 additive field

### PR-size 拆法

- PR #1 (2h): server-side diff.tokens + issues schema + prompt 升级
- PR #2 (2h): client-side 用 server diff 替换 client fallback，加 issues tooltip

---

## P1.C — 错误记忆 (Spaced Repetition + Pattern Tracking)

### 现状分析

`app/speaking/page.tsx` Phase 4 已经 partial 实现：
- 每次会话结束拿到 feedback，存 `japaneseLearning.mistakeHistory` 到 localStorage
- 字段: `{ id, timestamp, language, grammar[], vocabulary[] }`
- `/today` 显示"最近弱点"

**问题**:
1. **localStorage 限制单 device** — 换电脑 = 0
2. **粒度粗** — grammar/vocabulary 是 free-text, 没法分类
3. **没有 SRS 调度** — 存了但不主动提醒复习
4. **没有 pattern detection** — 学员 "は/が" 错 10 次 vs "助词" 错 5 次 + "动词" 错 5 次，看不出重心

### 目标

跨 device 持久化错误 + 错误类型分类 + SRS 推荐 + 跨 phase（listening/speaking）聚合。

### 文件改动

| 文件 | 改动 |
|---|---|
| `supabase/migrations/0003_mistake_tracking.sql` (new) | 建 `mistake_log` + `vocab_progress` 表 + RLS |
| `lib/mistakeTracker.ts` (new) | shared helper: log + aggregate + recommend |
| `app/api/mistake/log/route.ts` (new) | POST a mistake event |
| `app/api/mistake/recommend/route.ts` (new) | GET top-N due-for-review items |
| `app/today/page.tsx` | 显示 "今日弱点" + "待复习" 卡片 |
| `app/listening/page.tsx` | Shadow 完成后调用 `/api/mistake/log` |
| `app/speaking/page.tsx` | Session 完成后调用 `/api/mistake/log` |

### Schema (Supabase migration)

```sql
-- 0003_mistake_tracking.sql

CREATE TABLE IF NOT EXISTS mistake_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  source TEXT NOT NULL CHECK (source IN ('shadow', 'speaking', 'feedback')),
  mistake_type TEXT NOT NULL,        -- 'particle-confusion', 'kanji-reading', 'pitch-accent', 'verb-conjugation', ...
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  target_text TEXT NOT NULL,         -- 原文
  heard_text TEXT,                   -- 学员说的 / STT 转的
  sentence_id TEXT,                  -- 句库 id (e.g. 'weather-n5-3')
  context JSONB                      -- 完整 issue 详情 (从 P1.B issues[] 来)
);

CREATE INDEX idx_mistake_user_type ON mistake_log(user_id, mistake_type);
CREATE INDEX idx_mistake_created ON mistake_log(user_id, created_at DESC);

-- 聚合视图: 学员每个 mistake_type 的次数 + 最近 7 天活跃度
CREATE OR REPLACE VIEW mistake_summary AS
SELECT
  user_id,
  mistake_type,
  count(*) as total_count,
  count(*) FILTER (WHERE created_at > now() - interval '7 days') as recent_count,
  max(created_at) as last_seen
FROM mistake_log
GROUP BY user_id, mistake_type;

-- RLS: 学员只能看自己的
ALTER TABLE mistake_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mistakes"
ON mistake_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mistakes"
ON mistake_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- vocab_progress: 单词级 SRS state (SM-2 算法简化版)
CREATE TABLE IF NOT EXISTS vocab_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sentence_id TEXT NOT NULL,
  ease_factor REAL DEFAULT 2.5,
  interval_days INT DEFAULT 0,
  repetitions INT DEFAULT 0,
  next_review_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, sentence_id)
);

CREATE INDEX idx_vocab_due ON vocab_progress(user_id, next_review_at);

ALTER TABLE vocab_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vocab progress"
ON vocab_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own vocab progress"
ON vocab_progress FOR ALL
USING (auth.uid() = user_id);
```

### API contracts

**POST /api/mistake/log**
```json
// Request
{
  "source": "shadow",
  "mistake_type": "particle-confusion",
  "severity": "major",
  "target_text": "私は学生です",
  "heard_text": "わたしが学生です",
  "sentence_id": "intro-n5-2",
  "context": { "expected": "は", "heard": "が", "hint": "..." }
}

// Response
{ "ok": true, "id": "uuid..." }
```

**GET /api/mistake/recommend**
```json
// Response
{
  "due": [
    {
      "sentence_id": "weather-n5-3",
      "interval_days": 7,
      "next_review_at": "2026-08-22T...",
      "reason": "spaced-repetition due"
    }
  ],
  "weak_patterns": [
    {
      "type": "particle-confusion",
      "recent_count": 8,
      "total_count": 23,
      "top_sentence_ids": ["intro-n5-2", "weather-n5-7", "..."],
      "advice": "は/が 区分: 主语首次出现用 は, 对比 / 主语限定用 が"
    }
  ]
}
```

### 实现细节

#### Mistake categorization

`lib/mistakeTracker.ts` 用 LLM (gpt-4o-mini, cheap) 给 free-text mistake 分类：

```ts
async function classifyMistake(text: string): Promise<string> {
  // Cache hit: 之前 classify 过 → 直接返回
  // Cache miss: call gpt-4o-mini with one-shot prompt:
  //   "Categorize this Japanese mistake into one of: 
  //    particle-confusion | kanji-reading | pitch-accent | verb-conjugation | 
  //    missing-word | extra-word | word-order | grammar-other | vocab-other.
  //    Input: '<text>'. Output: ONLY the category string."
  // Cache result in memory (LRU 200 entries)
}
```

**Cache 是关键** — 学员说同一句错 5 次，不要调 5 次 LLM。

#### Offline fallback

学员没登录 / Supabase 不可达 → 写到 localStorage（同 P1.B fallback 思路）。Sync 到 cloud 时机：
- 登录后首次访问 `/today`
- 每周 heartbeat
- 手动 "Sync" 按钮

#### SRS 推荐算法

简化版 SM-2：
- ease_factor 初始 2.5，range [1.3, 2.5]
- 每错一次 ease_factor -= 0.2 (cap 1.3)
- 每对一次 ease_factor += 0.1
- `interval_days = prev_interval * ease_factor` (初始 1 day)
- `next_review_at = now() + interval_days`

#### Pattern detection

按 `mistake_type` 聚合，过去 7 天 top-3 类型 → 显示在 `/today` "今日弱点" 卡片。

### 工时 / Risk

- **6-8 小时**（schema + 后端 + 客户端 + 测试 + RLS）
- **Risk**: 中（schema migration + RLS policy 不能错；错的话学员看到别人数据）
- **依赖**: Supabase project 已经 setup（依赖 P0 / 部署指南）

### PR-size 拆法

- PR #1 (2h): Supabase migration 0003 + RLS
- PR #2 (2h): lib/mistakeTracker.ts + 两个 API route
- PR #3 (2h): 客户端调用 + /today 显示
- PR #4 (2h): SRS 推荐算法 + 缓存

---

## 部署后验证 checklist

P1.A:
- [ ] 上传 1MB audio → 200
- [ ] 上传 30MB audio → 413 with clear error
- [ ] Vercel function logs 显示 durationSec + modelUsed

P1.B:
- [ ] Shadow 完成 → response 包含 diff.tokens + issues
- [ ] 客户端渲染红色 strike-through + hover tooltip
- [ ] 旧客户端 (不读新字段) 不 break

P1.C:
- [ ] Shadow 完成 → mistake 写入 Supabase (login 状态)
- [ ] 离线 → 写 localStorage, 登录后 sync
- [ ] RLS: 用另一个 user 的 session 访问 → 403 / 空

---

## 不在 scope (留到 Phase 2-5)

- **多模态评估** — pitch accent audio analysis (Phase 2 可能)
- **多 user 共享错题库** — collaborative learning (Phase 3+)
- **AI 自适应题目生成** — 根据 weak_patterns 自动生成练习 (Phase 4+)
- **教师后台** — instructor dashboard (Phase 5+)
- **Mobile app** — 当前 web only (Phase 6+)

---

## 参考资源

- OpenAI gpt-4o-transcribe API: https://platform.openai.com/docs/api-reference/audio/createTranscription
- OpenAI gpt-4o-mini structured output: https://platform.openai.com/docs/guides/structured-outputs
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- SM-2 SRS 算法: https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
- kuromoji.js (Japanese tokenizer): https://www.npmjs.com/package/kuromoji

---

**Author**: OpenClaw (scope doc) + Frank (prioritization)  
**Date**: 2026-08-15  
**Status**: 🟡 Draft — 待 Frank review 后 freeze
