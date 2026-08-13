"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Difficulty = "N5" | "N4" | "N3";

type Sentence = {
  id: string;
  ja: string;
  zh: string;
};

type Category = {
  id: string;
  label: string;
  emoji: string;
  N5: Sentence[];
  N4: Sentence[];
  N3: Sentence[];
};

// 90 sentences across 5 everyday scenes × 3 JLPT levels (N5/N4/N3).
// Phase 3: N4/N3 levels added. Future: extract to data file + add N2/N1.
const CATEGORIES: Category[] = [
  {
    id: "self-intro",
    label: "自我介绍",
    emoji: "🙋",
    N5: [
      { id: "s1-n5-1", ja: "はじめまして。", zh: "初次见面。" },
      { id: "s1-n5-2", ja: "私はディン・フェンと申します。", zh: "我叫丁锋。" },
      { id: "s1-n5-3", ja: "中国から来ました。", zh: "我来自中国。" },
      { id: "s1-n5-4", ja: "今は東京に住んでいます。", zh: "我现在住在东京。" },
      { id: "s1-n5-5", ja: "ITエンジニアです。", zh: "我是 IT 工程师。" },
      { id: "s1-n5-6", ja: "よろしくお願いします。", zh: "请多多关照。" },
    ],
    N4: [
      { id: "s1-n4-1", ja: "私は〇〇大学を卒業しました。", zh: "我毕业于〇〇大学。" },
      { id: "s1-n4-2", ja: "ソフトウェア開発を五年経験があります。", zh: "有五年软件开发经验。" },
      { id: "s1-n4-3", ja: "今はスタートアップで働いています。", zh: "现在在创业公司工作。" },
      { id: "s1-n4-4", ja: "趣味は読書と写真です。", zh: "兴趣是读书和摄影。" },
      { id: "s1-n4-5", ja: "週末はよくハイキングに行きます。", zh: "周末经常去徒步。" },
      { id: "s1-n4-6", ja: "日本の文化に興味があります。", zh: "对日本文化感兴趣。" },
    ],
    N3: [
      { id: "s1-n3-1", ja: "大学院で人工知能を専攻しました。", zh: "研究生时专攻人工智能。" },
      { id: "s1-n3-2", ja: "去年の後半からこちらに住み始めました。", zh: "从去年下半年开始住在这里。" },
      { id: "s1-n3-3", ja: "将来は自分の会社を立ち上げたいです。", zh: "将来想创办自己的公司。" },
      { id: "s1-n3-4", ja: "最近は製品管理に興味があります。", zh: "最近对产品管理感兴趣。" },
      { id: "s1-n3-5", ja: "休みの日は家でゆっくり過ごします。", zh: "休息日在家慢慢度过。" },
      { id: "s1-n3-6", ja: "写真撮影が趣味で、よく週末に街に出ます。", zh: "兴趣是摄影，周末经常上街。" },
    ],
  },
  {
    id: "restaurant",
    label: "餐厅",
    emoji: "🍱",
    N5: [
      { id: "r1-n5-1", ja: "注文をお願いします。", zh: "我想点餐。" },
      { id: "r1-n5-2", ja: "ラーメンをください。", zh: "我要一份拉面。" },
      { id: "r1-n5-3", ja: "おすすめは何ですか。", zh: "推荐什么？" },
      { id: "r1-n5-4", ja: "辛くしないでください。", zh: "请不要加辣。" },
      { id: "r1-n5-5", ja: "お会計をお願いします。", zh: "请结账。" },
      { id: "r1-n5-6", ja: "現金で払います。", zh: "我付现金。" },
    ],
    N4: [
      { id: "r1-n4-1", ja: "辛さが足りないので、もっと辣椒をください。", zh: "不够辣，请再多加点辣椒。" },
      { id: "r1-n4-2", ja: "同じものをもう一つ頼めますか。", zh: "可以再点一份一样的吗？" },
      { id: "r1-n4-3", ja: "食後にコーヒーをお願いします。", zh: "餐后请来一杯咖啡。" },
      { id: "r1-n4-4", ja: "テイクアウトできますか。", zh: "可以外带吗？" },
      { id: "r1-n4-5", ja: "おすすめの料理は何ですか。", zh: "推荐菜是什么？" },
      { id: "r1-n4-6", ja: "飲み物は別々でお願いします。", zh: "饮料请分开点。" },
    ],
    N3: [
      { id: "r1-n3-1", ja: "ベジタリアンなので、肉料理の代わりに野菜でお願いします。", zh: "我是素食者，肉菜请换成蔬菜。" },
      { id: "r1-n3-2", ja: "少し塩味が薄いように感じます。", zh: "感觉味道有点淡。" },
      { id: "r1-n3-3", ja: "〇〇にアレルギーがあります。", zh: "我对〇〇过敏。" },
      { id: "r1-n3-4", ja: "デザートの種類は何がありますか。", zh: "甜点有哪些种类？" },
      { id: "r1-n3-5", ja: "割り勘にしましょうか、それともおごりますか。", zh: "AA 还是我请？" },
      { id: "r1-n3-6", ja: "このスープは少し油っこいです。", zh: "这汤有点太油腻。" },
    ],
  },
  {
    id: "directions",
    label: "问路",
    emoji: "🗺️",
    N5: [
      { id: "d1-n5-1", ja: "駅はどこですか。", zh: "车站在哪里？" },
      { id: "d1-n5-2", ja: "この道をまっすぐ行ってください。", zh: "请沿这条路直走。" },
      { id: "d1-n5-3", ja: "右に曲がってください。", zh: "请向右转。" },
      { id: "d1-n5-4", ja: "左に曲がってください。", zh: "请向左转。" },
      { id: "d1-n5-5", ja: "どこまで歩けばいいですか。", zh: "需要走多远？" },
      { id: "d1-n5-6", ja: "近くですか。", zh: "近吗？" },
    ],
    N4: [
      { id: "d1-n4-1", ja: "ここから駅まで歩いてどのぐらいですか。", zh: "从这里走到车站要多久？" },
      { id: "d1-n4-2", ja: "終電は何時ですか。", zh: "末班车是几点？" },
      { id: "d1-n4-3", ja: "〇〇行きのバスはどこですか。", zh: "去〇〇的巴士在哪里？" },
      { id: "d1-n4-4", ja: "一番速い道をお願いします。", zh: "请告诉我最快的路。" },
      { id: "d1-n4-5", ja: "近くにコンビニはありますか。", zh: "附近有便利店吗？" },
      { id: "d1-n4-6", ja: "〇〇までタクシーでいくらぐらいですか。", zh: "打车到〇〇大概多少钱？" },
    ],
    N3: [
      { id: "d1-n3-1", ja: "このあたりでWi-Fiが使えますか。", zh: "这附近能用 Wi-Fi 吗？" },
      { id: "d1-n3-2", ja: "〇〇の近くまでどうやって行けばいいですか。", zh: "怎么去〇〇附近？" },
      { id: "d1-n3-3", ja: "電車とバス、どちらが速いですか。", zh: "电车和巴士哪个快？" },
      { id: "d1-n3-4", ja: "途中でトイレに寄れますか。", zh: "路上能上厕所吗？" },
      { id: "d1-n3-5", ja: "道を聞きながら行くので大丈夫です。", zh: "路上问路就行。" },
      { id: "d1-n3-6", ja: "迎えに来てくれますか。", zh: "能来接我吗？" },
    ],
  },
  {
    id: "numbers-time",
    label: "数字时间",
    emoji: "⏰",
    N5: [
      { id: "n1-n5-1", ja: "今、何時ですか。", zh: "现在几点？" },
      { id: "n1-n5-2", ja: "三時です。", zh: "三点。" },
      { id: "n1-n5-3", ja: "今日は何日ですか。", zh: "今天几号？" },
      { id: "n1-n5-4", ja: "九月十五日です。", zh: "九月十五日。" },
      { id: "n1-n5-5", ja: "電話番号を教えてください。", zh: "请告诉我电话号码。" },
      { id: "n1-n5-6", ja: "百円です。", zh: "一百日元。" },
    ],
    N4: [
      { id: "n1-n4-1", ja: "会議は午後三時半から始まります。", zh: "会议从下午三点半开始。" },
      { id: "n1-n4-2", ja: "明日十時に変更できますか。", zh: "能改到明天十点吗？" },
      { id: "n1-n4-3", ja: "ここに三年住んでいます。", zh: "我在这里住了三年了。" },
      { id: "n1-n4-4", ja: "一日二時間勉強しています。", zh: "每天学习两个小时。" },
      { id: "n1-n4-5", ja: "締め切りは来週金曜日です。", zh: "截止日期是下周五。" },
      { id: "n1-n4-6", ja: "三十五歳になります。", zh: "我三十五岁了。" },
    ],
    N3: [
      { id: "n1-n3-1", ja: "次の診察は再来月の予定です。", zh: "下次检查预计在两个月后。" },
      { id: "n1-n3-2", ja: "週に三回ジムに通っています。", zh: "每周去三次健身房。" },
      { id: "n1-n3-3", ja: "このプロジェクトには半年以上かかりそうです。", zh: "这个项目估计要半年以上。" },
      { id: "n1-n3-4", ja: "発売日は来週の予定です。", zh: "发售日期预计是下周。" },
      { id: "n1-n3-5", ja: "一か月滞在しますが、延びる可能性があります。", zh: "计划待一个月，但可能延长。" },
      { id: "n1-n3-6", ja: "月末までに報告書を提出してください。", zh: "月底前请提交报告。" },
    ],
  },
  {
    id: "greetings",
    label: "寒暄",
    emoji: "👋",
    N5: [
      { id: "g1-n5-1", ja: "おはようございます。", zh: "早上好。" },
      { id: "g1-n5-2", ja: "こんにちは。", zh: "你好（白天）。" },
      { id: "g1-n5-3", ja: "こんばんは。", zh: "晚上好。" },
      { id: "g1-n5-4", ja: "お疲れ様です。", zh: "辛苦了。" },
      { id: "g1-n5-5", ja: "また明日。", zh: "明天见。" },
      { id: "g1-n5-6", ja: "また会いましょう。", zh: "下次再见。" },
    ],
    N4: [
      { id: "g1-n4-1", ja: "今日はいい天気ですね。", zh: "今天天气真好。" },
      { id: "g1-n4-2", ja: "お体に気をつけてください。", zh: "请注意身体。" },
      { id: "g1-n4-3", ja: "先日はお世話になりました。", zh: "前几天承蒙关照。" },
      { id: "g1-n4-4", ja: "助けていただき、ありがとうございます。", zh: "谢谢您的帮助。" },
      { id: "g1-n4-5", ja: "ちょっと聞いてもいいですか。", zh: "能打扰一下吗？" },
      { id: "g1-n4-6", ja: "お待たせしました。", zh: "让您久等了。" },
    ],
    N3: [
      { id: "g1-n3-1", ja: "先日はお忙しい中お時間をいただき、ありがとうございます。", zh: "感谢您在百忙之中抽出时间。" },
      { id: "g1-n3-2", ja: "今後ともよろしくお願いいたします。", zh: "今后也请多多指教。" },
      { id: "g1-n3-3", ja: "お陰様で元気です。", zh: "托您的福，我很好。" },
      { id: "g1-n3-4", ja: "改めてお詫び申し上げます。", zh: "再次表示歉意。" },
      { id: "g1-n3-5", ja: "お邪魔いたします。", zh: "打扰了。" },
      { id: "g1-n3-6", ja: "お力添えいただけると大変助かります。", zh: "能得到您的帮助，我将不胜感激。" },
    ],
  },
];

const PROGRESS_KEY = "japanese:listen-progress";
const SHADOW_HISTORY_KEY = "japanese:shadow-history";

type ShadowGrade = {
  accuracy: number;
  fluency: number;
  feedback: string;
  suggestions: string[];
  encouragement: string;
};

type ShadowHistoryEntry = {
  id: string;
  sentenceId: string;
  categoryId: string;
  timestamp: number;
  transcript: string;
  grade: ShadowGrade;
};

function loadProgress(): Record<string, Set<string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const result: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = new Set(v);
    }
    return result;
  } catch {
    return {};
  }
}

function saveProgress(progress: Record<string, Set<string>>) {
  if (typeof window === "undefined") return;
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(progress)) {
    out[k] = Array.from(v);
  }
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(out));
}

function loadShadowHistory(): ShadowHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHADOW_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ShadowHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveShadowHistory(history: ShadowHistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SHADOW_HISTORY_KEY,
    JSON.stringify(history.slice(0, 50))
  );
}

function formatHistoryTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Phase 1 enhancement: split Japanese text into tokens (words) + separators
// (particles, punctuation, whitespace). Used by the word-level diff display.
function tokenizeWithSeparators(
  text: string
): { word: string; isSeparator: boolean }[] {
  return text
    .split(/([、。「」!?\s]+)/)
    .filter((p) => p.length > 0)
    .map((p) => ({
      word: p,
      isSeparator: /^[、。「」!?\s]+$/.test(p),
    }));
}

// Phase 1 enhancement: compare target sentence against transcript at the word level.
// Returns the tokens (for rendering), and the matched/missed sets (for stats).
function computeWordDiff(
  target: string,
  transcript: string
): {
  tokens: { word: string; isSeparator: boolean }[];
  matched: string[];
  missed: string[];
} {
  const tokens = tokenizeWithSeparators(target);
  const transcriptWords = new Set(
    transcript.split(/[、。「」!?\s]+/).filter(Boolean)
  );
  const matched: string[] = [];
  const missed: string[] = [];
  for (const tok of tokens) {
    if (tok.isSeparator) continue;
    if (transcriptWords.has(tok.word) || transcript.includes(tok.word)) {
      matched.push(tok.word);
    } else {
      missed.push(tok.word);
    }
  }
  return { tokens, matched, missed };
}

// Phase 4: chunk Japanese sentence by 読点/句点 (、。); fall back to fixed-length chunks
// when no punctuation is present. Returns at least one chunk for any non-empty input.
function chunkJapanese(ja: string): string[] {
  if (!ja || !ja.trim()) return [];
  const parts = ja.split(/[、。]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  const result: string[] = [];
  for (let i = 0; i < ja.length; i += 6) {
    result.push(ja.slice(i, i + 6));
  }
  return result;
}

// Phase 5: look up a sentence by its id across all (category × difficulty) buckets.
function findSentenceById(sentenceId: string): Sentence | null {
  for (const cat of CATEGORIES) {
    for (const lvl of ["N5", "N4", "N3"] as const) {
      const sent = cat[lvl].find((s) => s.id === sentenceId);
      if (sent) return sent;
    }
  }
  return null;
}

// Phase 5: small stat tile used in the 📊 panel.
function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "blue" | "purple";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-700"
      : tone === "purple"
        ? "text-purple-700"
        : "text-gray-900";
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
      <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

const RATE_OPTIONS = [
  { v: 0.7, label: "0.7x", desc: "慢速" },
  { v: 0.9, label: "0.9x", desc: "常速" },
  { v: 1.0, label: "1.0x", desc: "原速" },
] as const;

type Mode = "listen" | "shadow";
type ShadowPhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "grading"
  | "result";

export default function ListeningPage() {
  const [mode, setMode] = useState<Mode>("listen");

  // Difficulty level (N5/N4/N3)
  const [levelIdx, setLevelIdx] = useState<0 | 1 | 2>(0);

  // Listen state (preserved from Phase 1)
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [rate, setRate] = useState<number>(0.9);
  const [speaking, setSpeaking] = useState(false);
  const [progress, setProgress] = useState<Record<string, Set<string>>>({});
  const [browserSupportsTts, setBrowserSupportsTts] = useState(true);

  // Shadow state
  const [shadowHistory, setShadowHistory] = useState<ShadowHistoryEntry[]>([]);
  const [shadowPhase, setShadowPhase] = useState<ShadowPhase>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [grade, setGrade] = useState<ShadowGrade | null>(null);
  const [shadowError, setShadowError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  // Phase 2: editable transcript (user can fix STT errors before re-grading).
  const [editableTranscript, setEditableTranscript] = useState<string>("");
  const [isTranscriptEdited, setIsTranscriptEdited] = useState(false);
  // Phase 2: re-grade in progress (separate boolean to avoid TypeScript
  // narrowing issues — the result section is already conditional on
  // `shadowPhase === "result"`, so checking `shadowPhase === "grading"` inside
  // would always be false).
  const [isRegrading, setIsRegrading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakCancelRef = useRef(false);

  // Shadow chunked mode (Phase 4): play sentence in chunks with 1.5s delay between.
  const [chunkedMode, setChunkedMode] = useState(false);
  const [currentChunkIdx, setCurrentChunkIdx] = useState(-1);

  const DIFFICULTIES: Difficulty[] = ["N5", "N4", "N3"];
  const category = CATEGORIES[categoryIdx];
  const currentDifficulty = DIFFICULTIES[levelIdx];
  const currentSentences = category[currentDifficulty];
  const sentence = currentSentences[sentenceIdx];
  const totalInCat = currentSentences.length;
  const completedInCat = progress[category.id]?.size || 0;
  const totalCompleted = Object.values(progress).reduce(
    (sum, set) => sum + set.size,
    0
  );
  const allDone = totalCompleted >= 90;
  const shadowHistoryForSentence = shadowHistory.filter(
    (e) => e.sentenceId === sentence.id
  );
  const chunks = (chunkedMode && mode === "shadow")
    ? chunkJapanese(sentence.ja)
    : [];

  // Phase 1 enhancement: word-level diff between target and transcript.
  // Null when not in Shadow result phase (or transcript missing).
  const wordDiff =
    mode === "shadow" && shadowPhase === "result" && transcript
      ? computeWordDiff(sentence.ja, transcript)
      : null;

  // Phase 3 enhancement: previous attempt lookup (for delta display).
  // shadowHistory is already sorted newest first; the [0] entry is the
  // current attempt (just added or just re-graded), so [1] is the previous
  // attempt for this same sentence.
  const sameSentenceEntries =
    mode === "shadow" && shadowPhase === "result" && transcript
      ? shadowHistory.filter((e) => e.sentenceId === sentence.id)
      : [];
  const previousAttempt = sameSentenceEntries[1] ?? null;

  const accuracyDelta =
    grade && previousAttempt
      ? grade.accuracy - previousAttempt.grade.accuracy
      : null;

  const fluencyDelta =
    grade && previousAttempt
      ? grade.fluency - previousAttempt.grade.fluency
      : null;

  // Phase 5: aggregate Shadow stats (trends).
  const shadowStats = (() => {
    const total = shadowHistory.length;
    if (total === 0) {
      return {
        total: 0,
        avgAcc: 0,
        avgFlu: 0,
        best: null as ShadowHistoryEntry | null,
        byLevel: { N5: 0, N4: 0, N3: 0 } as Record<Difficulty, number>,
        byLevelAcc: { N5: 0, N4: 0, N3: 0 } as Record<Difficulty, number>,
      };
    }
    const sumAcc = shadowHistory.reduce((s, e) => s + e.grade.accuracy, 0);
    const sumFlu = shadowHistory.reduce((s, e) => s + e.grade.fluency, 0);
    const best = shadowHistory.reduce(
      (bestE, e) =>
        e.grade.accuracy > (bestE?.grade.accuracy ?? -1) ? e : bestE,
      shadowHistory[0]
    );

    const byLevel: Record<Difficulty, number> = { N5: 0, N4: 0, N3: 0 };
    const byLevelAcc: Record<Difficulty, number> = { N5: 0, N4: 0, N3: 0 };
    for (const e of shadowHistory) {
      const m = e.sentenceId.match(/-n([543])-\d+$/);
      if (m) {
        const lvl = `N${m[1]}` as Difficulty;
        byLevel[lvl] += 1;
        byLevelAcc[lvl] += e.grade.accuracy;
      }
    }
    return {
      total,
      avgAcc: Math.round(sumAcc / total),
      avgFlu: Math.round(sumFlu / total),
      best,
      byLevel,
      byLevelAcc,
    };
  })();

  // Boot: detect browser APIs + load saved state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setBrowserSupportsTts(Boolean(window.speechSynthesis));
    setProgress(loadProgress());
    setShadowHistory(loadShadowHistory());
  }, []);

  // Phase 5 enhancement: read ?c=<categoryId> from URL and pre-select that
  // category. Lets /today's "去练习" link deep-link to the right category.
  // Run once on mount (empty deps) so we don't reset the user's position if
  // they manually switch categories afterwards.
  const searchParams = useSearchParams();
  useEffect(() => {
    const cat = searchParams.get("c");
    if (!cat) return;
    const idx = CATEGORIES.findIndex((c) => c.id === cat);
    if (idx >= 0) {
      setCategoryIdx(idx);
      setSentenceIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore — recorder may already have ended
        }
      }
      setSpeaking(false);
    };
  }, []);

  // Reset Shadow state whenever the active sentence changes.
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setShadowPhase("idle");
    setTranscript(null);
    setGrade(null);
    setShadowError(null);
    setRecordingTime(0);
    setSpeaking(false);
    // intentionally only depending on sentence/category/level idx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIdx, sentenceIdx, levelIdx]);

  function stopSpeech() {
    speakCancelRef.current = true;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setCurrentChunkIdx(-1);
  }

  function switchMode(next: Mode) {
    stopSpeech();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setMode(next);
    setShadowPhase("idle");
    setTranscript(null);
    setGrade(null);
    setShadowError(null);
    setRecordingTime(0);
  }

  function changeCategory(i: number) {
    setCategoryIdx(i);
    setSentenceIdx(0);
    stopSpeech();
  }

  function setRateAndCancel(r: number) {
    if (speaking) stopSpeech();
    setRate(r);
  }

  function speak() {
    if (!browserSupportsTts) {
      alert("当前浏览器不支持语音合成。请用 Chrome 或 Safari。");
      return;
    }
    if (speaking) {
      stopSpeech();
      return;
    }
    speakCancelRef.current = false;
    window.speechSynthesis.cancel();

    const useChunked = chunkedMode && mode === "shadow";
    const pieces = useChunked ? chunkJapanese(sentence.ja) : [sentence.ja];
    let pieceIdx = 0;
    setCurrentChunkIdx(useChunked ? 0 : -1);
    setSpeaking(true);

    const playNext = () => {
      if (speakCancelRef.current || pieceIdx >= pieces.length) {
        setSpeaking(false);
        setCurrentChunkIdx(-1);
        return;
      }
      if (useChunked) setCurrentChunkIdx(pieceIdx);
      const u = new SpeechSynthesisUtterance(pieces[pieceIdx]);
      u.lang = "ja-JP";
      u.rate = rate;
      u.onend = () => {
        setCurrentChunkIdx(-1);
        pieceIdx++;
        if (useChunked && pieceIdx < pieces.length) {
          // 1.5s pause between chunks; bail if cancelled during the pause.
          setTimeout(() => {
            if (speakCancelRef.current) {
              setSpeaking(false);
              setCurrentChunkIdx(-1);
              return;
            }
            playNext();
          }, 1500);
        } else {
          setSpeaking(false);
          setCurrentChunkIdx(-1);
        }
      };
      u.onerror = () => {
        setSpeaking(false);
        setCurrentChunkIdx(-1);
      };
      window.speechSynthesis.speak(u);
    };

    playNext();

    // Mark sentence as listened (Listen mode only).
    if (mode === "listen") {
      const newProgress: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(progress)) {
        newProgress[k] = new Set(v);
      }
      if (!newProgress[category.id]) newProgress[category.id] = new Set();
      newProgress[category.id].add(sentence.id);
      setProgress(newProgress);
      saveProgress(newProgress);
    }
  }

  function next() {
    stopSpeech();
    if (sentenceIdx < totalInCat - 1) {
      setSentenceIdx(sentenceIdx + 1);
    } else if (categoryIdx < CATEGORIES.length - 1) {
      setCategoryIdx(categoryIdx + 1);
      setSentenceIdx(0);
    } else {
      // Last sentence in last category — loop to start of current cat.
      setSentenceIdx(0);
    }
  }

  function prev() {
    stopSpeech();
    if (sentenceIdx > 0) {
      setSentenceIdx(sentenceIdx - 1);
    } else if (categoryIdx > 0) {
      const prevCat = CATEGORIES[categoryIdx - 1];
      setCategoryIdx(categoryIdx - 1);
      setSentenceIdx(prevCat[currentDifficulty].length - 1);
    } else {
      setSentenceIdx(totalInCat - 1);
    }
  }

  async function startShadowRecording() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setShadowError("当前浏览器不支持录音。请用 Chrome / Safari / Edge。");
      return;
    }
    setShadowError(null);
    setTranscript(null);
    setGrade(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
      ];
      let chosenType = "";
      for (const t of supportedTypes) {
        if (
          typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported(t)
        ) {
          chosenType = t;
          break;
        }
      }
      const recorder = chosenType
        ? new MediaRecorder(stream, { mimeType: chosenType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await runShadowPipeline(blob);
      };

      recordingStartRef.current = Date.now();
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        if (recordingStartRef.current) {
          setRecordingTime(
            Math.floor((Date.now() - recordingStartRef.current) / 1000)
          );
        }
      }, 250);

      recorder.start();
      setShadowPhase("recording");
    } catch (e) {
      setShadowError(
        e instanceof Error
          ? `麦克风权限被拒：${e.message}。请在浏览器地址栏旁的麦克风图标里允许。`
          : "麦克风权限被拒。请在浏览器设置里允许。"
      );
      setShadowPhase("idle");
    }
  }

  function stopShadowRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }

  async function runShadowPipeline(blob: Blob) {
    setShadowPhase("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const tRes = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      if (!tRes.ok) {
        const j = (await tRes
          .json()
          .catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Transcribe HTTP ${tRes.status}`);
      }
      const tData = (await tRes.json()) as { text: string };
      setTranscript(tData.text);
      setEditableTranscript(tData.text);
      setIsTranscriptEdited(false);
      setShadowPhase("grading");

      const gRes = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: tData.text,
          target: sentence.ja,
          sentenceId: sentence.id,
          categoryLabel: category.label,
        }),
      });
      if (!gRes.ok) {
        const j = (await gRes
          .json()
          .catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Grade HTTP ${gRes.status}`);
      }
      const gData = (await gRes.json()) as { grade: ShadowGrade };
      setGrade(gData.grade);
      setShadowPhase("result");

      // Save to history (latest first, cap at 50).
      const entry: ShadowHistoryEntry = {
        id: Date.now().toString(),
        sentenceId: sentence.id,
        categoryId: category.id,
        timestamp: Date.now(),
        transcript: tData.text,
        grade: gData.grade,
      };
      const newHistory = [entry, ...shadowHistory].slice(0, 50);
      setShadowHistory(newHistory);
      saveShadowHistory(newHistory);
    } catch (e) {
      setShadowError(e instanceof Error ? e.message : String(e));
      setShadowPhase("idle");
    }
  }

  function resetShadow() {
    setTranscript(null);
    setGrade(null);
    setShadowError(null);
    setShadowPhase("idle");
    setEditableTranscript("");
    setIsTranscriptEdited(false);
  }

  // Phase 2: re-grade with user-edited transcript (without re-recording audio).
  async function reGradeWithEditedTranscript() {
    if (!editableTranscript.trim() || !sentence) return;
    setIsRegrading(true);
    setShadowError(null);
    try {
      const gRes = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: editableTranscript,
          target: sentence.ja,
          sentenceId: sentence.id,
          categoryLabel: category.label,
        }),
      });
      if (!gRes.ok) {
        const j = (await gRes
          .json()
          .catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Grade HTTP ${gRes.status}`);
      }
      const gData = (await gRes.json()) as { grade: ShadowGrade };
      setGrade(gData.grade);
      // Update history entry (if id matches) so the corrected transcript + grade
      // are persisted in the localStorage history.
      setShadowHistory((prev) => {
        const idx = prev.findIndex(
          (e) => e.sentenceId === sentence.id && e.transcript === transcript
        );
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          transcript: editableTranscript,
          grade: gData.grade,
        };
        return next;
      });
    } catch (e) {
      setShadowError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRegrading(false);
    }
  }

  const sentenceHeard = progress[category.id]?.has(sentence.id) ?? false;

  return (
    <main className="min-h-screen flex flex-col px-6 py-8 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/today"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 今日训练
        </Link>
        <Link
          href="/speaking"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          口语训练 →
        </Link>
      </header>

      <h1 className="text-2xl font-bold mb-2">
        {mode === "listen" ? "听力训练" : "跟读训练"}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {mode === "listen"
          ? "听 AI 朗读：5 场景 × 3 难度 × 6 句 = 90 句 N5/N4/N3 起步。点 🔊 听、慢速 / 常速切换、上一句 / 下一句。"
          : "跟 AI 读：先点 ▶ 听 AI 示范 → 点 🎤 跟读 → 录完自动评分 → 显示结果卡。"}
      </p>

      {/* Mode tabs (Listen vs Shadow) */}
      <div
        className="flex gap-2 mb-4"
        role="tablist"
        aria-label="训练模式"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "listen"}
          onClick={() => switchMode("listen")}
          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors ${
            mode === "listen"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          🎧 Listen
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "shadow"}
          onClick={() => switchMode("shadow")}
          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors ${
            mode === "shadow"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          🎤 Shadow 跟读
        </button>
      </div>

      {/* Difficulty tabs (N5 / N4 / N3) */}
      <div
        className="flex gap-2 mb-4"
        role="tablist"
        aria-label="难度"
      >
        {(
          [
            { v: 0, label: "N5 入门", emoji: "🌱" },
            { v: 1, label: "N4 初级", emoji: "🌿" },
            { v: 2, label: "N3 中级", emoji: "🌳" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.v}
            type="button"
            role="tab"
            aria-selected={levelIdx === opt.v}
            onClick={() => {
              setLevelIdx(opt.v);
              setSentenceIdx(0);
              stopSpeech();
            }}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors ${
              levelIdx === opt.v
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span className="mr-1">{opt.emoji}</span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Category tabs (shared by both modes) */}
      <div
        className="flex gap-2 mb-6 overflow-x-auto pb-2"
        role="tablist"
        aria-label="场景分类"
      >
        {CATEGORIES.map((c, i) => {
          const done = progress[c.id]?.size || 0;
          const total = c[currentDifficulty].length;
          const allListened = done === total && total > 0;
          const active = i === categoryIdx;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => changeCategory(i)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : allListened
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span className="mr-1">{c.emoji}</span>
              {c.label}
              {allListened && <span className="ml-1">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Sentence card */}
      <section className="border border-gray-200 rounded-2xl p-6 mb-6 bg-white">
        <div className="text-sm text-gray-500 mb-3 flex items-center justify-between">
          <span>
            {category.label} · 第 {sentenceIdx + 1} / {totalInCat} 句
          </span>
          {mode === "listen" && sentenceHeard && (
            <span className="text-xs text-green-600">✓ 听过了</span>
          )}
        </div>

        <div
          className="text-3xl font-bold mb-4 leading-relaxed text-center py-4 break-words"
          lang="ja"
        >
          {chunkedMode && mode === "shadow" && chunks.length > 0 ? (
            chunks.map((chunk, i) => (
              <span
                key={i}
                className={`inline-block mx-1 transition-colors px-1 rounded ${
                  i === currentChunkIdx
                    ? "bg-yellow-200 text-gray-900"
                    : i < currentChunkIdx
                      ? "text-gray-400"
                      : "text-gray-900"
                }`}
              >
                {chunk}
              </span>
            ))
          ) : (
            sentence.ja
          )}
        </div>

        <div className="text-base text-gray-600 text-center mb-6">
          {sentence.zh}
        </div>

        {mode === "listen" ? (
          /* ─── Listen controls ─── */
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              type="button"
              onClick={speak}
              disabled={!browserSupportsTts}
              className={`px-6 py-3 rounded-lg text-base font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                speaking
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {speaking ? "⏹ 停止" : "🔊 听"}
            </button>

            <div
              className="inline-flex rounded-lg border border-gray-200 overflow-hidden self-center"
              role="group"
              aria-label="语速"
            >
              {RATE_OPTIONS.map((opt, i) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setRateAndCancel(opt.v)}
                  className={`px-3 py-3 text-sm transition-colors ${
                    i > 0 ? "border-l border-gray-200" : ""
                  } ${
                    rate === opt.v
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title={`${opt.desc} ${opt.label}`}
                  aria-pressed={rate === opt.v}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ─── Shadow controls ─── */
          <div>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
              <button
                type="button"
                onClick={speak}
                disabled={
                  !browserSupportsTts || shadowPhase === "recording"
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  speaking
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                title="先听 AI 示范"
              >
                {speaking ? "⏹ 停止" : "▶ 听 AI"}
              </button>

              {shadowPhase !== "recording" ? (
                <button
                  type="button"
                  onClick={startShadowRecording}
                  className="px-6 py-3 rounded-lg text-base font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                >
                  🎤 跟读
                </button>
              ) : (
                <div className="w-full flex flex-col items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-red-700">
                      🎙️ 正在录音
                    </div>
                    <div className="text-base font-bold text-red-700 font-mono">
                      {recordingTime}s
                    </div>
                  </div>
                  {/* Visual waveform indicator (7 staggered bars). 
                     Not real audio level — just visual feedback that recording is alive. */}
                  <div
                    className="flex items-end gap-1 h-8"
                    aria-hidden="true"
                  >
                    {[30, 55, 40, 75, 50, 65, 35].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-red-500 rounded-full animate-pulse"
                        style={{
                          height: `${h}%`,
                          animationDelay: `${i * 0.12}s`,
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={stopShadowRecording}
                    className="px-6 py-3 rounded-lg text-base font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    ⏹ 停止录音
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setChunkedMode(!chunkedMode)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  chunkedMode
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
                title="切 chunk 顺序播放（每段之间 1.5s 停顿）"
              >
                🎵 Chunked {chunkedMode ? "ON" : "OFF"}
              </button>
            </div>

            {shadowPhase === "transcribing" && (
              <div className="text-center text-sm text-gray-500 py-3">
                🎙️ AI 转写中…
              </div>
            )}
            {shadowPhase === "grading" && (
              <div className="text-center text-sm text-gray-500 py-3">
                🎯 AI 评分中…
              </div>
            )}

            {shadowError && (
              <div className="mt-3 text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-lg p-3">
                ⚠️ {shadowError}
              </div>
            )}
          </div>
        )}

        {/* Shadow result card (inline below controls) */}
        {mode === "shadow" && shadowPhase === "result" && grade && (
          <div className="mt-6 border-t border-gray-200 pt-6 space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                你的转写
              </div>
              <div
                className="text-sm bg-gray-50 rounded-xl p-3 border border-gray-100 min-h-[3rem]"
                lang="ja"
              >
                {transcript && transcript.trim() ? (
                  transcript
                ) : (
                  <span className="italic text-gray-400">
                    (空白 — 没听清，请再试一次)
                  </span>
                )}
              </div>
            </div>

            {/* Phase 1 enhancement:逐字对照 (target vs transcript) */}
            {wordDiff && (
              <div>
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                  逐字对照 · 命中 {wordDiff.matched.length} /{" "}
                  {wordDiff.matched.length + wordDiff.missed.length}
                </div>
                <div
                  className="text-base bg-gray-50 rounded-xl p-3 leading-relaxed"
                  lang="ja"
                >
                  {wordDiff.tokens.map((tok, i) => {
                    const cls = tok.isSeparator
                      ? "text-gray-500"
                      : wordDiff.matched.includes(tok.word)
                        ? "text-green-700"
                        : "text-red-600 line-through";
                    return (
                      <span key={i} className={cls}>
                        {tok.word}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Phase 2: editable transcript + re-grade button */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  你的转写{isTranscriptEdited && (
                    <span className="ml-2 text-orange-600 normal-case font-normal">
                      · 已修正
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={reGradeWithEditedTranscript}
                  disabled={
                    isRegrading ||
                    !editableTranscript.trim() ||
                    !isTranscriptEdited
                  }
                  className="text-xs px-3 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isRegrading ? "评分中…" : "✏️ 重新评分"}
                </button>
              </div>
              <textarea
                value={editableTranscript}
                onChange={(e) => {
                  setEditableTranscript(e.target.value);
                  setIsTranscriptEdited(e.target.value !== (transcript ?? ""));
                }}
                rows={3}
                className="w-full text-sm bg-gray-50 rounded-xl p-3 border border-gray-200 focus:border-gray-400 focus:outline-none resize-y"
                lang="ja"
                placeholder="STT 偶尔翻字，修改后点「重新评分」"
              />
            </div>

            {/* Phase 3 enhancement:对比上次 attempt */}
            {previousAttempt &&
              (accuracyDelta !== null || fluencyDelta !== null) && (
                <div className="text-xs text-gray-500 text-center">
                  <span className="text-gray-400">对比上次</span> ·{" "}
                  {previousAttempt.grade.accuracy} /{" "}
                  {previousAttempt.grade.fluency}
                  {accuracyDelta !== null && accuracyDelta !== 0 && (
                    <span
                      className={`ml-2 ${
                        accuracyDelta > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      准{accuracyDelta > 0 ? " ↑" : " ↓"}
                      {Math.abs(accuracyDelta)}
                    </span>
                  )}
                  {fluencyDelta !== null && fluencyDelta !== 0 && (
                    <span
                      className={`ml-2 ${
                        fluencyDelta > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      流{fluencyDelta > 0 ? " ↑" : " ↓"}
                      {Math.abs(fluencyDelta)}
                    </span>
                  )}
                </div>
              )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-700">
                  {grade.accuracy}
                </div>
                <div className="text-xs text-blue-600 mt-1">准确度</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-700">
                  {grade.fluency}
                </div>
                <div className="text-xs text-purple-600 mt-1">流畅度</div>
              </div>
            </div>

            {grade.feedback && (
              <div className="text-sm text-gray-800 bg-gray-50 rounded-xl p-4 leading-relaxed">
                {grade.feedback}
              </div>
            )}

            {grade.suggestions.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  💡 改进建议
                </div>
                <ul className="text-sm space-y-1 list-disc pl-5 text-gray-700">
                  {grade.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {grade.encouragement && (
              <div className="text-sm italic text-gray-600 text-center bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                {grade.encouragement}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={resetShadow}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
              >
                🔁 再来一次
              </button>
              <button
                type="button"
                onClick={next}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm"
              >
                下一句 →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Phase 5: Shadow stats / trends panel */}
      {mode === "shadow" && shadowStats.total > 0 && (
        <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              📊 Shadow 统计 · 共 {shadowStats.total} 条
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatTile label="总录音" value={`${shadowStats.total}`} />
            <StatTile
              label="平均准确度"
              value={`${shadowStats.avgAcc}`}
              tone="blue"
            />
            <StatTile
              label="平均流畅度"
              value={`${shadowStats.avgFlu}`}
              tone="purple"
            />
          </div>
          <div className="space-y-1 text-xs">
            <div className="text-gray-500 mb-1">按难度：</div>
            {(["N5", "N4", "N3"] as Difficulty[]).map((lvl) => {
              const cnt = shadowStats.byLevel[lvl];
              if (cnt === 0) return null;
              const acc = Math.round(shadowStats.byLevelAcc[lvl] / cnt);
              return (
                <div
                  key={lvl}
                  className="flex items-center justify-between text-gray-700"
                >
                  <span>{lvl}</span>
                  <span>
                    {cnt} 条 · 准 {acc}
                  </span>
                </div>
              );
            })}
            {shadowStats.best && (
              <div className="text-gray-500 mt-2 italic">
                最佳：{shadowStats.best.grade.accuracy} 分（{shadowStats.best.sentenceId}）
              </div>
            )}
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={prev}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
        >
          ← 上一句
        </button>

        <div className="flex-1 text-sm text-gray-500 text-center">
          {mode === "listen" ? (
            <>
              本组完成 {completedInCat}/{totalInCat} · 总进度 {totalCompleted}/30
            </>
          ) : (
            <>
              Shadow 历史 {shadowHistory.length}
              {shadowHistory.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">
                  · 最近 50 条
                </span>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={next}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm"
        >
          下一句 →
        </button>
      </div>

      {/* Shadow history for current sentence (Shadow mode only) */}
      {mode === "shadow" && shadowHistoryForSentence.length > 0 && (
        <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              本句 Shadow 记录 · {shadowHistoryForSentence.length} 次
            </h3>
            <button
              type="button"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm(
                    `清空本句 ${shadowHistoryForSentence.length} 条 Shadow 记录？`
                  )
                ) {
                  const newHistory = shadowHistory.filter(
                    (e) => e.sentenceId !== sentence.id
                  );
                  setShadowHistory(newHistory);
                  saveShadowHistory(newHistory);
                }
              }}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              清空
            </button>
          </div>
          <div className="space-y-2">
            {shadowHistoryForSentence.slice(0, 5).map((entry) => {
              const target = findSentenceById(entry.sentenceId);
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-sm bg-gray-50 rounded-xl p-3 gap-3"
                >
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-xs text-gray-500 font-mono">
                      {formatHistoryTime(entry.timestamp)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700 font-bold">
                        {entry.grade.accuracy}
                      </span>
                      <span className="text-gray-300">/</span>
                      <span className="text-purple-700 font-bold">
                        {entry.grade.fluency}
                      </span>
                    </div>
                    {target && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            typeof window === "undefined" ||
                            !window.speechSynthesis
                          )
                            return;
                          window.speechSynthesis.cancel();
                          const u = new SpeechSynthesisUtterance(target.ja);
                          u.lang = "ja-JP";
                          u.rate = rate;
                          window.speechSynthesis.speak(u);
                        }}
                        className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                        title="重听原句 AI 朗读"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                  <div
                    className="text-xs text-gray-500 truncate min-w-0"
                    lang="ja"
                  >
                    {entry.transcript ? (
                      entry.transcript
                    ) : (
                      <span className="italic text-gray-400">(空白)</span>
                    )}
                  </div>
                </div>
              );
            })}
            {shadowHistoryForSentence.length > 5 && (
              <div className="text-xs text-gray-400 text-center pt-2">
                ... 还有 {shadowHistoryForSentence.length - 5} 条
              </div>
            )}
          </div>
        </section>
      )}

      {/* All-done celebration (Listen mode only) */}
      {mode === "listen" && allDone && (
        <div className="border border-green-200 bg-green-50 rounded-2xl p-6 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="text-base font-medium text-green-800 mb-1">
            全部 30 句都听过了
          </div>
          <div className="text-sm text-green-700">
            去 <Link href="/speaking" className="underline">口语训练</Link> 试试自己说，或者回 <Link href="/today" className="underline">今日训练</Link> 看错点
          </div>
        </div>
      )}

      {!browserSupportsTts && (
        <div className="mt-4 border border-red-200 bg-red-50 rounded-2xl p-4 text-sm text-red-700 text-center">
          当前浏览器不支持 Web Speech API。请用 Chrome / Safari 打开本页面。
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400 text-center space-y-1">
        <div>🔊 Listen: Web Speech API（无需联网）</div>
        <div>
          🎤 Shadow: gpt-4o-transcribe + gpt-4o-mini（中文反馈 · 历史进
          localStorage）
        </div>
      </div>
    </main>
  );
}
