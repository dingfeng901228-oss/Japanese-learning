// Whitelist of pre-loaded batch files available via the one-click
// import button on /admin/import-vocab.
//
// To add a new batch:
//   1. Run scripts/parse-jlpt-vocab-md.mjs on the new MD file → save
//      to data/<slug>.json
//   2. git add -f data/<slug>.json (data/ is otherwise gitignored)
//   3. Append an entry to PRELOADED_BATCHES below
//   4. The admin page will pick up the new button automatically.
//
// The "filename" MUST exist at data/{filename} on disk in the deployed
// build. The whitelist pattern also blocks directory traversal: even if
// a malicious form submission sends "../../etc/passwd" as batch, the
// action layer rejects anything not in this list.

export const PRELOADED_BATCHES = [
  {
    filename: "jlpt-vocab-200.json",
    label: "JLPT N2-N1 第一批 200 词",
    description:
      "工作・职场 / 日常生活 / 人际・社交 / 情感・心理 / 社会・时事 / 抽象・学术 / 自然・环境 / 身体・健康 (N2:149 + N1:51)",
  },
  {
    filename: "jlpt-vocab-200-batch2.json",
    label: "JLPT N2-N1 第二批 200 词",
    description:
      "饮食・烹饪 / 交通・出行 / 经济・金融 / 科技・IT / 教育・学习 / 法律・行政 / 文学・修辞 / 程度・副词 (N2:120 + N1:80)",
  },
  {
    filename: "jlpt-vocab-200-batch3.json",
    label: "JLPT N2-N1 第三批 200 词",
    description:
      "娱乐・休闲 / 体育・运动 / 婚恋・家庭 / 艺术・设计 / 动植物 / 心理学 / 外交・军事 / 宗教・哲学 (N2:124 + N1:76)",
  },
  {
    filename: "jlpt-vocab-200-batch4.json",
    label: "JLPT N2-N1 第四批 200 词",
    description:
      "天文・地理 / 化学・物理 / 建筑・房产 / 政治・体制 / 商业・贸易 / 餐饮・服务业 / 时尚・穿搭 / 育儿・教育进阶 (N2:108 + N1:92)",
  },
  {
    filename: "jlpt-vocab-200-batch5.json",
    label: "JLPT N2-N1 第五批 200 词",
    description:
      "外貌・体态 / 气象・灾害进阶 / 能源・环保 / 影视・传媒 / 动漫・游戏 / 交际・礼仪进阶 / 财税・会计 / 拟声・拟态语 (N2:120 + N1:80)",
  },
  {
    filename: "jlpt-vocab-200-batch6.json",
    label: "JLPT N2-N1 第六批 200 词",
    description:
      "职场敬语实战 / 旅游・出行进阶 / 网络用语 / 四字熟语 / 故事・寓言常用词 / 家电・家居 / 求职・面试专用词 / 保险・风险管理 (N2:107 + N1:93)",
  },
] as const;

export type PreloadedBatchFilename = (typeof PRELOADED_BATCHES)[number]["filename"];

// Set for O(1) lookup at request time. Used by importPreloadedBatchAction
// to reject filenames outside the whitelist.
export const PRELOADED_BATCH_SET: ReadonlySet<PreloadedBatchFilename> =
  new Set(PRELOADED_BATCHES.map((b) => b.filename));