// Speaking topic data — migrated from the Real-World Missions section
// on /today (Per Frank #6330). Each topic maps to an initial AI
// system prompt that frames the conversation, so when the user picks
// "🍱 用日语点一份餐" the AI immediately adopts the "you're in a
// restaurant, ordering a meal" role instead of the generic
// "こんにちは！今日はどんな一日でしたか？" opener.
//
// All prompts are in Japanese (the AI's spoken language) with a
// short setup line the user can parse in plain text. The user then
// drives the conversation in any direction they like; the prompt
// just sets the initial framing.

export type SpeakingTopic = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  aiPrompt: string;
};

export const SPEAKING_TOPICS: SpeakingTopic[] = [
  {
    id: "self-intro-1",
    emoji: "🙋",
    title: "用日语做 1 分钟自我介绍",
    description: "用日语做一次 1 分钟自我介绍录音。",
    aiPrompt:
      "こんにちは！今日は練習ですね。まず日本語で1分くらい自己紹介をしてもらえますか？名前、どこから来たか、仕事、趣味、なんでも大丈夫です。",
  },
  {
    id: "self-intro-2",
    emoji: "🙋",
    title: "向朋友介绍自己",
    description: "用日语向朋友介绍自己（姓名、职业、爱好）。",
    aiPrompt:
      "パーティーで初対面の人と会ったと思って、自己紹介をしてください。相手は日本語ネイティブスピーカーで、あなたに興味を持ってくれています。",
  },
  {
    id: "restaurant-1",
    emoji: "🍱",
    title: "用日语点一份餐",
    description: "试着在餐厅用日语点一份餐。",
    aiPrompt:
      "あなたは今、日本の中華料理屋にいます。ウェイターが来ました。何が食べたいか、どうぞ注文してください。",
  },
  {
    id: "restaurant-2",
    emoji: "🍱",
    title: "用日语问推荐",
    description: "用日语问店员推荐什么菜。",
    aiPrompt:
      "居酒屋にいます。店員がメニューを持ってきました。何が美味しいか、おすすめを聞いてください。",
  },
  {
    id: "directions-1",
    emoji: "🗺️",
    title: "用日语问路",
    description: "试着在路上用日语问路。",
    aiPrompt:
      "あなたは東京駅にいますが、目的地の渋谷までの道順が分かりません。近くのおじさんに道を聞いてください。",
  },
  {
    id: "directions-2",
    emoji: "🗺️",
    title: "用日语说方向",
    description: "用日语告诉别人怎么走（'まっすぐ行って、右に曲がって'）。",
    aiPrompt:
      "道を教えてもらったので、今度はあなたが相手に教えます。「まっすぐ行って、右に曲がって」などを使って、日本語で道を案内してください。",
  },
  {
    id: "numbers-time-1",
    emoji: "⏰",
    title: "用日语报时间",
    description: "用日语报出当前时间（'今、何時ですか' + 数字）。",
    aiPrompt:
      "相手に今何時か聞かれたので、日本語で時間を答えてください。",
  },
  {
    id: "numbers-time-2",
    emoji: "⏰",
    title: "用日语报日期",
    description: "用日语报出今天的日期（'今日は何日ですか' + 日期）。",
    aiPrompt:
      "相手に今日何日か聞かれたので、日本語で日付を答えてください。",
  },
  {
    id: "greetings-1",
    emoji: "👋",
    title: "用日语跟朋友打招呼",
    description: "用日语跟朋友打招呼（'おはようございます' / 'こんにちは'）。",
    aiPrompt:
      "友達に久しぶりに会いました。日本語で挨拶をしてください。",
  },
  {
    id: "greetings-2",
    emoji: "👋",
    title: "用日语告别",
    description: "用日语跟朋友告别（'また明日' / 'また会いましょう'）。",
    aiPrompt:
      "友達と別れる場面です。「また明日」「また会いましょう」など、日本語で挨拶をしてください。",
  },
];

// Default opener when the user picks "自由对话" (no topic).
export const DEFAULT_AI_PROMPT =
  "こんにちは！今日はどんな一日でしたか？";

// Look up a topic by id; returns undefined if not found.
export function getSpeakingTopic(
  id: string | null | undefined
): SpeakingTopic | undefined {
  if (!id) return undefined;
  return SPEAKING_TOPICS.find((t) => t.id === id);
}
