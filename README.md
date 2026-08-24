# FastStudy — AI 日语口语教练

> **Don'tjust study Japanese. Use Japanese.**

AI 驱动的日语训练系统，核心能力：**长期观察学习者 + 自动调整训练内容**，
把"看得懂的日语"逐渐变成"听得懂、说得出、用得自然的日语"。

---

## ✨ 核心功能

### 📚 词汇管理（`/vocabulary`）

- **收藏新词**：手动输入日语 + 翻译，保存到词库
- **词库列表**：浏览全部已收藏词汇，支持搜索
- **单词详情**（`/vocabulary/[id]`）：
  - 单词卡片左右滑切换（mobile-first）
  - 例句展示 + 重新生成按钮（AI 生成自然日语句子）
  - 收藏 / 取消收藏
- **手动添加**（`/vocabulary/new`）

### 🔁 每日复习 SRS（`/review`）

基于 SM-2 间隔重复算法：
- **今日到期词表**：自动拉取今天需要复习的单词
- **单流程界面**：先看到完整例句（目标词填空）→ 点"显示单词"揭示 →
  评分"再来一次"（忘了）或"记住了"
- **完整读音 + 🔊 重播**：QUIZ 阶段隐藏读音（防"看读音回忆"作弊），
  ANSWER_REVEALED 阶段揭示读音
- **中文翻译常驻**：不用切 tab 查词典
- **范围切换**：1M / 3M / 6M / 1Y 视图，学习足迹折线图
- **自动播放音频**：可关闭
- **回填按钮**：已收藏但没进复习队列的词一键加入
- **会话计时**：累计本 session 学习时长

### 🏠 主页 Dashboard（`/`）

- **学习足迹折线图**：1M / 3M / 6M / 1Y 范围，每日分钟数曲线
  + 数据点 donut 风格（hover 反色高亮）
- **学习日历**：每月打卡视图，补折线图覆盖不到的历史月份
- **连续学习统计**：streak streak + 总学习天数 / 总时长 / 最高单日
- **最近学习**：最近一批学过的词
- **距离今天结束还有**：倒计时模块

### 📊 进度（`/progress`）

- 学习曲线（沿用主页的折线图）
- **弱点档案**（Weakness Profile）：从历史错误聚合
  出最近弱点 + 常见错误 Top 10
- **错误时间线**：完整错误历史

### 🎧 听力 / 口语 / Shadowing

- **听写**（`/listening`）：播放日语音频，AI 反馈 + editable transcript
- **口语**（`/speaking`）：用户说日语，STT 转写 + 评分
- **Shadowing**（`/shadowing`）：跟读模式，repeat-after-me

### ⚙️ 设置（`/settings`）

- **账号**（`/account`）：基础信息
- **浏览器扩展**（`/settings/browser-extension`）：连接 token 配对

### 🔐 登录（`/login`）

- Google OAuth 一键登录

---

## 🧱 技术栈

- **Framework**: Next.js 15（App Router）+ React 19 + TypeScript
- **Styling**: Tailwind CSS
- **AI Provider**: OpenAI（GPT 系列，gpt-image-1 等多模态）
- **Database**: Supabase（auth + Postgres + RLS）
- **Charts**: 自绘 SVG（折线图 + 日历都是自己写，没用 recharts）
- **Speech**: Web Speech API（client 端 TTS）+ STT via API

---

## 🚀 本地开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000

环境变量（`.env.local`，gitignored）：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（服务端）
- `OPENAI_API_KEY`

---

## 📂 项目结构

```
.
├── app/                          # Next.js App Router
│   ├── account/                  # 账号设置
│   ├── listening/                # 听写（RealShadow 客户端组件）
│   ├── login/                    # Google OAuth
│   ├── progress/                 # 进度页（含 WeaknessProfile）
│   ├── review/                   # 复习 SRS
│   │   ├── actions.ts            # Server Actions（recordReviewAction 等）
│   │   ├── page.tsx              # Server Component 拉今日到期词表
│   │   └── review-session.tsx    # Client 组件（single recall flow）
│   ├── settings/
│   │   └── browser-extension/    # 浏览器扩展 token 配对
│   ├── shadowing/                # Shadowing 跟读
│   ├── speaking/                 # 口语 STT 评分
│   ├── vocabulary/               # 词汇管理
│   │   ├── [id]/                 # 单词详情（可滑动 + 编辑）
│   │   ├── new/                  # 新增词
│   │   └── page.tsx              # 词库列表
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # 主页 Dashboard
│
├── components/                   # 共享 UI
│   ├── dashboard/                # 主页用（TodayHeader, LearningActivity,
│   │                             # LearningCalendar, StreakStats,
│   │                             # WeaknessProfile, …）
│   ├── vocabulary/               # 词汇用（SpeakableClick, …）
│   ├── GoogleButton.tsx
│   ├── PageTransition.tsx
│   ├── SpeakButton.tsx
│   └── UserMenu.tsx
│
├── lib/                          # 业务逻辑
│   ├── vocabulary/               # 词汇 + 复习 SM-2 算法
│   ├── grade-types.ts            # 评分类型
│   ├── mistake-storage.ts        # 错误记忆
│   └── today-stats.ts            # 会话计时 + 今日统计
│
├── docs/                         # 设计文档
│   ├── requirements.docx         # 完整产品设计
│   ├── review.docx               # 复习功能规格
│   ├── UI优化.docx               # UI 改造记录（Frank 多次迭代）
│   ├── phase1-enhancement-scope.md
│   └── …
│
├── supabase/                     # DB migrations
│   └── migrations/
│
└── memory/                       # 提交信息 + 验证脚本（gitignored）
```

---

## 🗄 数据库 Schema（关键表）

- `vocabulary`：用户收藏的词（含日语、读音、翻译、例句、例句读音、例句翻译等）
- `vocabulary_reviews`：SRS 状态（next_review_at / interval / ease / mastery，
  SM-2 算法更新）
- `mistake_history`：用户错误历史（STT / 输入错误聚合到弱点档案）
- `auth.users`：Supabase 内置

---

## 🤖 AI 集成点

- **例句生成**（单词详情页"重新生成"）：GPT 生成自然日语例句
  + 读音 + 中文翻译
- **口语 STT 评分**：OpenAI 评估用户发音 + 转写 + 反馈
- **听写反馈**：AI 标注词级 diff + 改进建议
- **弱点聚合**：从 mistake_history 聚合常见错误模式

---

## 📝 License

MIT