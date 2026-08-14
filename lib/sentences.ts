// Shared sentence data + types for /listening and /progress.
// 150 sentences across 5 everyday scenes × 5 JLPT levels (N5/N4/N3/N2/N1).
//
// Phase 6: N2/N1 added + every kanji annotated with furigana via <ruby> tags.
//   - `ja` is plain text — used for TTS, chunked mode, word diff.
//   - `jaHtml` is HTML with <ruby> tags — used for the big display only.

export type Difficulty = "N5" | "N4" | "N3" | "N2" | "N1";

export type Sentence = {
  id: string;
  ja: string;
  jaHtml: string;
  zh: string;
};

export type Category = {
  id: string;
  label: string;
  emoji: string;
  N5: Sentence[];
  N4: Sentence[];
  N3: Sentence[];
  N2: Sentence[];
  N1: Sentence[];
};

export const LEVELS: readonly Difficulty[] = [
  "N5",
  "N4",
  "N3",
  "N2",
  "N1",
] as const;

export const TOTAL_SENTENCES_PER_LEVEL = 30; // 6 sentences × 5 categories

export const CATEGORIES: Category[] = [
  // ─────────────────────────── self-intro ───────────────────────────
  {
    id: "self-intro",
    label: "自我介绍",
    emoji: "🙋",
    N5: [
      { id: "s1-n5-1", ja: "はじめまして。", jaHtml: "はじめまして。", zh: "初次见面。" },
      { id: "s1-n5-2", ja: "私はディン・フェンと申します。", jaHtml: "<ruby>私<rt>わたし</rt></ruby>はディン・フェンと<ruby>申<rt>もう</rt></ruby>します。", zh: "我叫丁锋。" },
      { id: "s1-n5-3", ja: "中国から来ました。", jaHtml: "<ruby>中国<rt>ちゅうごく</rt></ruby>から<ruby>来<rt>き</rt></ruby>ました。", zh: "我来自中国。" },
      { id: "s1-n5-4", ja: "今は東京に住んでいます。", jaHtml: "<ruby>今<rt>いま</rt></ruby>は<ruby>東京<rt>とうきょう</rt></ruby>に<ruby>住<rt>す</rt></ruby>んでいます。", zh: "我现在住在东京。" },
      { id: "s1-n5-5", ja: "ITエンジニアです。", jaHtml: "ITエンジニアです。", zh: "我是 IT 工程师。" },
      { id: "s1-n5-6", ja: "よろしくお願いします。", jaHtml: "よろしくお<ruby>願<rt>ねが</rt></ruby>いします。", zh: "请多多关照。" },
    ],
    N4: [
      { id: "s1-n4-1", ja: "私は〇〇大学を卒業しました。", jaHtml: "<ruby>私<rt>わたし</rt></ruby>は〇〇<ruby>大学<rt>だいがく</rt></ruby>を<ruby>卒業<rt>そつぎょう</rt></ruby>しました。", zh: "我毕业于〇〇大学。" },
      { id: "s1-n4-2", ja: "ソフトウェア開発を五年経験があります。", jaHtml: "ソフトウェア<ruby>開発<rt>かいはつ</rt></ruby>を<ruby>五年<rt>ごねん</rt></ruby><ruby>経験<rt>けいけん</rt></ruby>があります。", zh: "有五年软件开发经验。" },
      { id: "s1-n4-3", ja: "今はスタートアップで働いています。", jaHtml: "<ruby>今<rt>いま</rt></ruby>はスタートアップで<ruby>働<rt>はたら</rt></ruby>いています。", zh: "现在在创业公司工作。" },
      { id: "s1-n4-4", ja: "趣味は読書と写真です。", jaHtml: "<ruby>趣味<rt>しゅみ</rt></ruby>は<ruby>読書<rt>どくしょ</rt></ruby>と<ruby>写真<rt>しゃしん</rt></ruby>です。", zh: "兴趣是读书和摄影。" },
      { id: "s1-n4-5", ja: "週末はよくハイキングに行きます。", jaHtml: "<ruby>週末<rt>しゅうまつ</rt></ruby>はよくハイキングに<ruby>行<rt>い</rt></ruby>きます。", zh: "周末经常去徒步。" },
      { id: "s1-n4-6", ja: "日本の文化に興味があります。", jaHtml: "<ruby>日本<rt>にほん</rt></ruby>の<ruby>文化<rt>ぶんか</rt></ruby>に<ruby>興味<rt>きょうみ</rt></ruby>があります。", zh: "对日本文化感兴趣。" },
    ],
    N3: [
      { id: "s1-n3-1", ja: "大学院で人工知能を専攻しました。", jaHtml: "<ruby>大学院<rt>だいがくいん</rt></ruby>で<ruby>人工知能<rt>じんこうちのう</rt></ruby>を<ruby>専攻<rt>せんこう</rt></ruby>しました。", zh: "研究生时专攻人工智能。" },
      { id: "s1-n3-2", ja: "去年の後半からこちらに住み始めました。", jaHtml: "<ruby>去年<rt>きょねん</rt></ruby>の<ruby>後半<rt>こうはん</rt></ruby>からこちらに<ruby>住<rt>す</rt></ruby>み<ruby>始<rt>はじ</rt></ruby>めました。", zh: "从去年下半年开始住在这里。" },
      { id: "s1-n3-3", ja: "将来は自分の会社を立ち上げたいです。", jaHtml: "<ruby>将来<rt>しょうらい</rt></ruby>は<ruby>自分<rt>じぶん</rt></ruby>の<ruby>会社<rt>かいしゃ</rt></ruby>を<ruby>立<rt>た</rt></ruby>ち<ruby>上<rt>あ</rt></ruby>げたいです。", zh: "将来想创办自己的公司。" },
      { id: "s1-n3-4", ja: "最近は製品管理に興味があります。", jaHtml: "<ruby>最近<rt>さいきん</rt></ruby>は<ruby>製品<rt>せいひん</rt></ruby><ruby>管理<rt>かんり</rt></ruby>に<ruby>興味<rt>きょうみ</rt></ruby>があります。", zh: "最近对产品管理感兴趣。" },
      { id: "s1-n3-5", ja: "休みの日は家でゆっくり過ごします。", jaHtml: "<ruby>休<rt>やす</rt></ruby>みの<ruby>日<rt>ひ</rt></ruby>は<ruby>家<rt>いえ</rt></ruby>でゆっくり<ruby>過<rt>す</rt></ruby>ごします。", zh: "休息日在家慢慢度过。" },
      { id: "s1-n3-6", ja: "写真撮影が趣味で、よく週末に街に出ます。", jaHtml: "<ruby>写真撮影<rt>しゃしんさつえい</rt></ruby>が<ruby>趣味<rt>しゅみ</rt></ruby>で、よく<ruby>週末<rt>しゅうまつ</rt></ruby>に<ruby>街<rt>まち</rt></ruby>に<ruby>出<rt>で</rt></ruby>ます。", zh: "兴趣是摄影，周末经常上街。" },
    ],
    N2: [
      { id: "s1-n2-1", ja: "現在、在住中の地域は都心から電車で三十分ほどの場所にあります。", jaHtml: "<ruby>現在<rt>げんざい</rt></ruby>、<ruby>在住中<rt>ざいじゅうちゅう</rt></ruby>の<ruby>地域<rt>ちいき</rt></ruby>は<ruby>都心<rt>としん</rt></ruby>から<ruby>電車<rt>でんしゃ</rt></ruby>で<ruby>三十分<rt>さんじっぷん</rt></ruby>ほどの<ruby>場所<rt>ばしょ</rt></ruby>にあります。", zh: "目前居住的地区距离市中心电车约三十分钟左右。" },
      { id: "s1-n2-2", ja: "主な業務内容はプロジェクトの進行管理と顧客との交渉です。", jaHtml: "<ruby>主<rt>おも</rt></ruby>な<ruby>業務内容<rt>ぎょうむないよう</rt></ruby>はプロジェクトの<ruby>進行管理<rt>しんこうかんり</rt></ruby>と<ruby>顧客<rt>こきゃく</rt></ruby>との<ruby>交渉<rt>こうしょう</rt></ruby>です。", zh: "主要业务内容是项目的进度管理以及与客户的谈判。" },
      { id: "s1-n2-3", ja: "将来的には技術系の管理職にキャリアアップしたいと考えています。", jaHtml: "<ruby>将来的<rt>しょうらいてき</rt></ruby>には<ruby>技術系<rt>ぎじゅつけい</rt></ruby>の<ruby>管理職<rt>かんりしょく</rt></ruby>にキャリアアップしたいと<ruby>考<rt>かんが</rt></ruby>えています。", zh: "将来希望晋升到技术系的管理岗位。" },
      { id: "s1-n2-4", ja: "前職では中国市場向けの製品開発を担当していました。", jaHtml: "<ruby>前職<rt>ぜんしょく</rt></ruby>では<ruby>中国市場<rt>ちゅうごくしじょう</rt></ruby><ruby>向<rt>む</rt></ruby>けの<ruby>製品開発<rt>せいひんかいはつ</rt></ruby>を<ruby>担当<rt>たんとう</rt></ruby>していました。", zh: "上一份工作负责面向中国市场的产品开发。" },
      { id: "s1-n2-5", ja: "異文化コミュニケーションにも積極的に取り組んでいます。", jaHtml: "<ruby>異文化<rt>いぶんか</rt></ruby>コミュニケーションにも<ruby>積極的<rt>せっきょくてき</rt></ruby>に<ruby>取<rt>と</rt></ruby>り<ruby>組<rt>く</rt></ruby>んでいます。", zh: "也在积极投入跨文化沟通工作。" },
      { id: "s1-n2-6", ja: "休日は地域のボランティア活動に参加しています。", jaHtml: "<ruby>休日<rt>きゅうじつ</rt></ruby>は<ruby>地域<rt>ちいき</rt></ruby>のボランティア<ruby>活動<rt>かつどう</rt></ruby>に<ruby>参加<rt>さんか</rt></ruby>しています。", zh: "休息日会参加社区的志愿者活动。" },
    ],
    N1: [
      { id: "s1-n1-1", ja: "前職では多国籍チームのマネジメント経験を活かし、異文化間での調整業務に従事してまいりました。", jaHtml: "<ruby>前職<rt>ぜんしょく</rt></ruby>では<ruby>多国籍<rt>たこくせき</rt></ruby>チームのマネジメント<ruby>経験<rt>けいけん</rt></ruby>を<ruby>活<rt>い</rt></ruby>かし、<ruby>異文化<rt>いぶんか</rt></ruby><ruby>間<rt>かん</rt></ruby>での<ruby>調整業務<rt>ちょうせいきょうむ</rt></ruby>に<ruby>従事<rt>じゅうじ</rt></ruby>してまいりました。", zh: "上一份工作运用多国籍团队的管理经验，从事跨文化协调业务。" },
      { id: "s1-n1-2", ja: "データ駆動型の意思決定プロセスを推進するため、社内で分析基盤の構築を主導しています。", jaHtml: "データ<ruby>駆動型<rt>くどうがた</rt></ruby>の<ruby>意思決定<rt>いしけってい</rt></ruby>プロセスを<ruby>推進<rt>すいしん</rt></ruby>するため、<ruby>社内<rt>しゃない</rt></ruby>で<ruby>分析基盤<rt>ぶんせききばん</rt></ruby>の<ruby>構築<rt>こうちく</rt></ruby>を<ruby>主導<rt>しゅどう</rt></ruby>しています。", zh: "为推动数据驱动的决策流程，正在公司内部主导搭建分析平台。" },
      { id: "s1-n1-3", ja: "長期的には業界全体のデジタルトランスフォーメーションに貢献できる人材になりたいと願っております。", jaHtml: "<ruby>長期的<rt>ちょうきてき</rt></ruby>には<ruby>業界全体<rt>ぎょうかいぜんたい</rt></ruby>のデジタルトランスフォーメーションに<ruby>貢献<rt>こうけん</rt></ruby>できる<ruby>人材<rt>じんざい</rt></ruby>になりたいと<ruby>願<rt>ねが</rt></ruby>っております。", zh: "长期来看，希望能成为可为整个行业的数字化转型做出贡献的人才。" },
      { id: "s1-n1-4", ja: "専門分野は自然言語処理と機械学習ですが、最近はプロダクトマネジメントの領域にも挑戦しています。", jaHtml: "<ruby>専門分野<rt>せんもんぶんや</rt></ruby>は<ruby>自然言語処理<rt>しぜんげんごしょり</rt></ruby>と<ruby>機械学習<rt>きかいがくしゅう</rt></ruby>ですが、<ruby>最近<rt>さいきん</rt></ruby>はプロダクトマネジメントの<ruby>領域<rt>りょういき</rt></ruby>にも<ruby>挑戦<rt>ちょうせん</rt></ruby>しています。", zh: "专业领域是自然语言处理和机器学习，但最近也在挑战产品管理方向。" },
      { id: "s1-n1-5", ja: "公私ともに成長できる環境を求めて、今の職場に転職を決意いたしました。", jaHtml: "<ruby>公私<rt>こうし</rt></ruby>ともに<ruby>成長<rt>せいちょう</rt></ruby>できる<ruby>環境<rt>かんきょう</rt></ruby>を<ruby>求<rt>もと</rt></ruby>めて、<ruby>今<rt>いま</rt></ruby>の<ruby>職場<rt>しょくば</rt></ruby>に<ruby>転職<rt>てんしょく</rt></ruby>を<ruby>決意<rt>けつい</rt></ruby>いたしました。", zh: "为追求公私都能成长的环境，下定决心跳槽到现在的公司。" },
      { id: "s1-n1-6", ja: "これまでに培ってきた技術力と課題解決能力を、ぜひ御社の発展に寄与させていただければと存じます。", jaHtml: "これまでに<ruby>培<rt>つちか</rt></ruby>ってきた<ruby>技術力<rt>ぎじゅつりょく</rt></ruby>と<ruby>課題解決能力<rt>もんだいかいけつのうりょく</rt></ruby>を、ぜひ<ruby>御社<rt>おんしゃ</rt></ruby>の<ruby>発展<rt>はってん</rt></ruby>に<ruby>寄与<rt>きよ</rt></ruby>させていただければと<ruby>存<rt>ぞん</rt></ruby>じます。", zh: "希望能将至今培养的技术实力与解决问题能力，贡献于贵公司的发展。" },
    ],
  },

  // ─────────────────────────── restaurant ───────────────────────────
  {
    id: "restaurant",
    label: "餐厅",
    emoji: "🍱",
    N5: [
      { id: "r1-n5-1", ja: "注文をお願いします。", jaHtml: "<ruby>注文<rt>ちゅうもん</rt></ruby>をお<ruby>願<rt>ねが</rt></ruby>いします。", zh: "我想点餐。" },
      { id: "r1-n5-2", ja: "ラーメンをください。", jaHtml: "ラーメンをください。", zh: "我要一份拉面。" },
      { id: "r1-n5-3", ja: "おすすめは何ですか。", jaHtml: "おすすめは<ruby>何<rt>なん</rt></ruby>ですか。", zh: "推荐什么？" },
      { id: "r1-n5-4", ja: "辛くしないでください。", jaHtml: "<ruby>辛<rt>から</rt></ruby>くしないでください。", zh: "请不要加辣。" },
      { id: "r1-n5-5", ja: "お会計をお願いします。", jaHtml: "お<ruby>会計<rt>かいけい</rt></ruby>をお<ruby>願<rt>ねが</rt></ruby>いします。", zh: "请结账。" },
      { id: "r1-n5-6", ja: "現金で払います。", jaHtml: "<ruby>現金<rt>げんきん</rt></ruby>で<ruby>払<rt>はら</rt></ruby>います。", zh: "我付现金。" },
    ],
    N4: [
      { id: "r1-n4-1", ja: "辛さが足りないので、もっと辣椒をください。", jaHtml: "<ruby>辛<rt>から</rt></ruby>さが<ruby>足<rt>た</rt></ruby>りないので、もっと<ruby>辣椒<rt>ラージャオ</rt></ruby>をください。", zh: "不够辣，请再多加点辣椒。" },
      { id: "r1-n4-2", ja: "同じものをもう一つ頼めますか。", jaHtml: "<ruby>同<rt>おな</rt></ruby>じものをもう<ruby>一<rt>ひと</rt></ruby>つ<ruby>頼<rt>たの</rt></ruby>めますか。", zh: "可以再点一份一样的吗？" },
      { id: "r1-n4-3", ja: "食後にコーヒーをお願いします。", jaHtml: "<ruby>食後<rt>しょくご</rt></ruby>にコーヒーを<ruby>願<rt>ねが</rt></ruby>いします。", zh: "餐后请来一杯咖啡。" },
      { id: "r1-n4-4", ja: "テイクアウトできますか。", jaHtml: "テイクアウトできますか。", zh: "可以外带吗？" },
      { id: "r1-n4-5", ja: "おすすめの料理は何ですか。", jaHtml: "おすすめの<ruby>料理<rt>りょうり</rt></ruby>は<ruby>何<rt>なん</rt></ruby>ですか。", zh: "推荐菜是什么？" },
      { id: "r1-n4-6", ja: "飲み物は別々でお願いします。", jaHtml: "<ruby>飲<rt>の</rt></ruby>み<ruby>物<rt>もの</rt></ruby>は<ruby>別別<rt>べつべつ</rt></ruby>で<ruby>願<rt>ねが</rt></ruby>いします。", zh: "饮料请分开点。" },
    ],
    N3: [
      { id: "r1-n3-1", ja: "ベジタリアンなので、肉料理の代わりに野菜でお願いします。", jaHtml: "ベジタリアンなので、<ruby>肉料理<rt>にくりょうり</rt></ruby>の<ruby>代<rt>か</rt></ruby>わりに<ruby>野菜<rt>やさい</rt></ruby>で<ruby>願<rt>ねが</rt></ruby>いします。", zh: "我是素食者，肉菜请换成蔬菜。" },
      { id: "r1-n3-2", ja: "少し塩味が薄いように感じます。", jaHtml: "<ruby>少<rt>すこ</rt></ruby>し<ruby>塩味<rt>しおあじ</rt></ruby>が<ruby>薄<rt>うす</rt></ruby>ように<ruby>感<rt>かん</rt></ruby>じます。", zh: "感觉味道有点淡。" },
      { id: "r1-n3-3", ja: "〇〇にアレルギーがあります。", jaHtml: "〇〇にアレルギーがあります。", zh: "我对〇〇过敏。" },
      { id: "r1-n3-4", ja: "デザートの種類は何がありますか。", jaHtml: "デザートの<ruby>種類<rt>しゅるい</rt></ruby>は<ruby>何<rt>なん</rt></ruby>がありますか。", zh: "甜点有哪些种类？" },
      { id: "r1-n3-5", ja: "割り勘にしましょうか、それともおごりますか。", jaHtml: "<ruby>割勘<rt>わりかん</rt></ruby>にしましょうか、それともおごりますか。", zh: "AA 还是我请？" },
      { id: "r1-n3-6", ja: "このスープは少し油っこいです。", jaHtml: "このスープは<ruby>少<rt>すこ</rt></ruby>し<ruby>油<rt>あぶら</rt></ruby>っこいです。", zh: "这汤有点太油腻。" },
    ],
    N2: [
      { id: "r1-n2-1", ja: "本日のおすすめコースは地元の食材をふんだんに使ったものとなっております。", jaHtml: "<ruby>本日<rt>ほんじつ</rt></ruby>のおすすめコースは<ruby>地元<rt>じもと</rt></ruby>の<ruby>食材<rt>しょくざい</rt></ruby>をふんだんに<ruby>使<rt>つか</rt></ruby>ったものとなっております。", zh: "今天的推荐套餐是大量使用当地食材的菜品。" },
      { id: "r1-n2-2", ja: "食事制限がございますので、グルテンフリーのメニューはありますか。", jaHtml: "<ruby>食事制限<rt>しょくじせいげん</rt></ruby>がございますので、グルテンフリーのメニューはありますか。", zh: "我有饮食限制，请问有无麸质菜单吗？" },
      { id: "r1-n2-3", ja: "お酒は日本酒を少しと、赤ワインをグラスでお願いします。", jaHtml: "お<ruby>酒<rt>さけ</rt></ruby>は<ruby>日本酒<rt>にほんしゅ</rt></ruby>を<ruby>少<rt>すこ</rt></ruby>しと、<ruby>赤<rt>あか</rt></ruby>ワインをグラスで<ruby>願<rt>ねが</rt></ruby>いします。", zh: "酒请来一点日本酒和一杯红葡萄酒。" },
      { id: "r1-n2-4", ja: "こちらの料理は伝統的な調理法を再現したものだそうです。", jaHtml: "こちらの<ruby>料理<rt>りょうり</rt></ruby>は<ruby>伝統的<rt>でんとうてき</rt></ruby>な<ruby>調理法<rt>ちょうりほう</rt></ruby>を<ruby>再現<rt>さいげん</rt></ruby>したものだそうです。", zh: "据说这里的菜是再现传统烹调法的。" },
      { id: "r1-n2-5", ja: "店内の雰囲気は落ち着いていて、会食にも適していると思います。", jaHtml: "<ruby>店内<rt>てんない</rt></ruby>の<ruby>雰囲気<rt>ふんいき</rt></ruby>は<ruby>落<rt>お</rt></ruby>ち<ruby>着<rt>つ</rt></ruby>いていて、<ruby>会食<rt>かいしょく</rt></ruby>にも<ruby>適<rt>てき</rt></ruby>していると<ruby>思<rt>おも</rt></ruby>います。", zh: "店内氛围沉稳，我觉得也很适合商务宴请。" },
      { id: "r1-n2-6", ja: "記念日に合わせて特別なデザートを用意していただくことは可能でしょうか。", jaHtml: "<ruby>記念日<rt>きねんび</rt></ruby>に<ruby>合<rt>あ</rt></ruby>わせて<ruby>特別<rt>とくべつ</rt></ruby>なデザートを<ruby>用意<rt>ようい</rt></ruby>していただくことは<ruby>可能<rt>かのう</rt></ruby>でしょうか。", zh: "能否配合纪念日为我们准备一份特别的甜点？" },
    ],
    N1: [
      { id: "r1-n1-1", ja: "食物アレルギーの観点から、原材料の詳細な情報を事前に確認させていただきたく存じます。", jaHtml: "<ruby>食物<rt>しょくもつ</rt></ruby>アレルギーの<ruby>観点<rt>かんてん</rt></ruby>から、<ruby>原材料<rt>げんざいりょう</rt></ruby>の<ruby>詳細<rt>しょうさい</rt></ruby>な<ruby>情報<rt>じょうほう</rt></ruby>を<ruby>事前<rt>じぜん</rt></ruby>に<ruby>確認<rt>かくにん</rt></ruby>させて<ruby>頂<rt>いただ</rt></ruby>きたく<ruby>存<rt>ぞん</rt></ruby>じます。", zh: "出于食物过敏的考虑，希望能事先确认原材料的详细信息。" },
      { id: "r1-n1-2", ja: "当店の料理は地元の旬の食材を厳選し、伝統的な調理法に独自の工夫を加えたものとなっております。", jaHtml: "<ruby>当店<rt>とうてん</rt></ruby>の<ruby>料理<rt>りょうり</rt></ruby>は<ruby>地元<rt>じもと</rt></ruby>の<ruby>旬<rt>しゅん</rt></ruby>の<ruby>食材<rt>しょくざい</rt></ruby>を<ruby>厳選<rt>げんせん</rt></ruby>し、<ruby>伝統的<rt>でんとうてき</rt></ruby>な<ruby>調理法<rt>ちょうりほう</rt></ruby>に<ruby>独自<rt>どくじ</rt></ruby>の<ruby>工夫<rt>くふう</rt></ruby>を<ruby>加<rt>くわ</rt></ruby>えたものとなっております。", zh: "本店的菜品精心挑选当地当季食材，并在传统烹调法上加入独特巧思。" },
      { id: "r1-n1-3", ja: "お子様向けのメニューもご用意しておりますが、アレルギー対応には別途お時間をいただく場合がございます。", jaHtml: "お<ruby>子様<rt>こさま</rt></ruby><ruby>向<rt>む</rt></ruby>けのメニューもご<ruby>用意<rt>ようい</rt></ruby>しておりますが、アレルギー<ruby>対応<rt>たいおう</rt></ruby>には<ruby>別途<rt>べっと</rt></ruby>お<ruby>時間<rt>じかん</rt></ruby>を<ruby>頂<rt>いただ</rt></ruby>く<ruby>場合<rt>ばあい</rt></ruby>が<ruby>御座<rt>ござ</rt></ruby>います。", zh: "本店也提供儿童菜单，但过敏应对可能需要另行准备时间。" },
      { id: "r1-n1-4", ja: "ご宴会コースは三日前までにご予約いただければ、特別なお料理にも対応させていただきます。", jaHtml: "ご<ruby>宴会<rt>えんかい</rt></ruby>コースは<ruby>三日前<rt>みっかまえ</rt></ruby>までに<ruby>ご予約<rt>よやく</rt></ruby>いただければ、<ruby>特別<rt>とくべつ</rt></ruby>なお<ruby>料理<rt>りょうり</rt></ruby>にも<ruby>対応<rt>たいおう</rt></ruby>させていただきます。", zh: "宴会套餐如能提前三天预约，我们也可应对特别料理。" },
      { id: "r1-n1-5", ja: "特別な記念日のお祝いに、心を込めて演出させていただきますので、ぜひご相談くださいませ。", jaHtml: "<ruby>特別<rt>とくべつ</rt></ruby>な<ruby>記念日<rt>きねんび</rt></ruby>のお<ruby>祝<rt>いわ</rt></ruby>いに、<ruby>心<rt>こころ</rt></ruby>を<ruby>込<rt>こ</rt></ruby>めて<ruby>演出<rt>えんしゅつ</rt></ruby>させていただきますので、ぜひご<ruby>相談<rt>そうだん</rt></ruby>くださいませ。", zh: "特别纪念日的庆祝，我们将用心营造氛围，欢迎随时咨询。" },
      { id: "r1-n1-6", ja: "お飲み物のラストオーダーは閉店の三十分前となっておりますので、予めご了承くださいませ。", jaHtml: "お<ruby>飲<rt>の</rt></ruby>み<ruby>物<rt>もの</rt></ruby>のラストオーダーは<ruby>閉店<rt>へいてん</rt></ruby>の<ruby>三十分前<rt>さんじっぷんまえ</rt></ruby>となっておりますので、<ruby>予<rt>あら</rt></ruby>かじめご<ruby>了承<rt>りょうしょう</rt></ruby>くださいませ。", zh: "饮品的最后点单时间为闭店前 30 分钟，敬请知悉。" },
    ],
  },

  // ─────────────────────────── directions ───────────────────────────
  {
    id: "directions",
    label: "问路",
    emoji: "🗺️",
    N5: [
      { id: "d1-n5-1", ja: "駅はどこですか。", jaHtml: "<ruby>駅<rt>えき</rt></ruby>はどこですか。", zh: "车站在哪里？" },
      { id: "d1-n5-2", ja: "この道をまっすぐ行ってください。", jaHtml: "この<ruby>道<rt>みち</rt></ruby>をまっすぐ<ruby>行<rt>い</rt></ruby>ってください。", zh: "请沿这条路直走。" },
      { id: "d1-n5-3", ja: "右に曲がってください。", jaHtml: "<ruby>右<rt>みぎ</rt></ruby>に<ruby>曲<rt>ま</rt></ruby>がってください。", zh: "请向右转。" },
      { id: "d1-n5-4", ja: "左に曲がってください。", jaHtml: "<ruby>左<rt>ひだり</rt></ruby>に<ruby>曲<rt>ま</rt></ruby>がってください。", zh: "请向左转。" },
      { id: "d1-n5-5", ja: "どこまで歩けばいいですか。", jaHtml: "どこまで<ruby>歩<rt>ある</rt></ruby>けばいいですか。", zh: "需要走多远？" },
      { id: "d1-n5-6", ja: "近くですか。", jaHtml: "<ruby>近<rt>ちか</rt></ruby>くですか。", zh: "近吗？" },
    ],
    N4: [
      { id: "d1-n4-1", ja: "ここから駅まで歩いてどのぐらいですか。", jaHtml: "ここから<ruby>駅<rt>えき</rt></ruby>まで<ruby>歩<rt>ある</rt></ruby>いてどのぐらいですか。", zh: "从这里走到车站要多久？" },
      { id: "d1-n4-2", ja: "終電は何時ですか。", jaHtml: "<ruby>終電<rt>しゅうでん</rt></ruby>は<ruby>何時<rt>なんじ</rt></ruby>ですか。", zh: "末班车是几点？" },
      { id: "d1-n4-3", ja: "〇〇行きのバスはどこですか。", jaHtml: "〇〇<ruby>行<rt>ゆ</rt></ruby>きのバスはどこですか。", zh: "去〇〇的巴士在哪里？" },
      { id: "d1-n4-4", ja: "一番速い道をお願いします。", jaHtml: "<ruby>一番<rt>いちばん</rt></ruby><ruby>速<rt>はや</rt></ruby>い<ruby>道<rt>みち</rt></ruby>をお<ruby>願<rt>ねが</rt></ruby>いします。", zh: "请告诉我最快的路。" },
      { id: "d1-n4-5", ja: "近くにコンビニはありますか。", jaHtml: "<ruby>近<rt>ちか</rt></ruby>くにコンビニはありますか。", zh: "附近有便利店吗？" },
      { id: "d1-n4-6", ja: "〇〇までタクシーでいくらぐらいですか。", jaHtml: "〇〇までタクシーでいくらぐらいですか。", zh: "打车到〇〇大概多少钱？" },
    ],
    N3: [
      { id: "d1-n3-1", ja: "このあたりでWi-Fiが使えますか。", jaHtml: "このあたりでWi-Fiが<ruby>使<rt>つか</rt></ruby>えますか。", zh: "这附近能用 Wi-Fi 吗？" },
      { id: "d1-n3-2", ja: "〇〇の近くまでどうやって行けばいいですか。", jaHtml: "〇〇の<ruby>近<rt>ちか</rt></ruby>くまでどうやって<ruby>行<rt>い</rt></ruby>けばいいですか。", zh: "怎么去〇〇附近？" },
      { id: "d1-n3-3", ja: "電車とバス、どちらが速いですか。", jaHtml: "<ruby>電車<rt>でんしゃ</rt></ruby>とバス、どちらが<ruby>速<rt>はや</rt></ruby>いですか。", zh: "电车和巴士哪个快？" },
      { id: "d1-n3-4", ja: "途中でトイレに寄れますか。", jaHtml: "<ruby>途中<rt>とちゅう</rt></ruby>でトイレに<ruby>寄<rt>よ</rt></ruby>れますか。", zh: "路上能上厕所吗？" },
      { id: "d1-n3-5", ja: "道を聞きながら行くので大丈夫です。", jaHtml: "<ruby>道<rt>みち</rt></ruby>を<ruby>聞<rt>き</rt></ruby>きながら<ruby>行<rt>い</rt></ruby>ので<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>です。", zh: "路上问路就行。" },
      { id: "d1-n3-6", ja: "迎えに来てくれますか。", jaHtml: "<ruby>迎<rt>むか</rt></ruby>えに<ruby>来<rt>き</rt></ruby>てくれますか。", zh: "能来接我吗？" },
    ],
    N2: [
      { id: "d1-n2-1", ja: "最寄り駅から会場までは徒歩十五分ですが、バスもご利用いただけます。", jaHtml: "<ruby>最寄<rt>もよお</rt></ruby>り<ruby>駅<rt>えき</rt></ruby>から<ruby>会場<rt>かいじょう</rt></ruby>までは<ruby>徒歩<rt>とほ</rt></ruby><ruby>十五分<rt>じゅうごふん</rt></ruby>ですが、バスも<ruby>利用<rt>りよう</rt></ruby>いただけます。", zh: "从最近车站步行 15 分钟可到会场，也可以乘坐巴士。" },
      { id: "d1-n2-2", ja: "途中にある交差点で右折してから、二つ目の信号を左に曲がってください。", jaHtml: "<ruby>途中<rt>とちゅう</rt></ruby>にある<ruby>交差点<rt>こうさてん</rt></ruby>で<ruby>右折<rt>うせつ</rt></ruby>してから、<ruby>二<rt>ふた</rt></ruby>つ目の<ruby>信号<rt>しんごう</rt></ruby>を<ruby>左<rt>ひだり</rt></ruby>に<ruby>曲<rt>ま</rt></ruby>がってください。", zh: "在途中的路口右转，然后到第二个红绿灯左转。" },
      { id: "d1-n2-3", ja: "周辺の道路は時間帯によって渋滞が発生しやすくなっております。", jaHtml: "<ruby>周辺<rt>しゅうへん</rt></ruby>の<ruby>道路<rt>どうろ</rt></ruby>は<ruby>時間帯<rt>じかんたい</rt></ruby>によって<ruby>渋滞<rt>じゅうたい</rt></ruby>が<ruby>発生<rt>はっせい</rt></ruby>しやすくなっております。", zh: "周边道路在特定时段容易发生拥堵。" },
      { id: "d1-n2-4", ja: "もし道に迷われましたら、お気軽にこちらの電話番号までご連絡ください。", jaHtml: "もし<ruby>道<rt>みち</rt></ruby>に<ruby>迷<rt>まよ</rt></ruby>われましたら、お<ruby>気軽<rt>きがる</rt></ruby>にこちらの<ruby>電話番号<rt>でんわばんごう</rt></ruby>までご<ruby>連絡<rt>れんらく</rt></ruby>ください。", zh: "如迷路请随时拨打这个电话联系我们。" },
      { id: "d1-n2-5", ja: "主要な観光地までは専用のシャトルバスが運行しております。", jaHtml: "<ruby>主要<rt>しゅよう</rt></ruby>な<ruby>観光地<rt>かんこうち</rt></ruby>までは<ruby>専用<rt>せんよう</rt></ruby>のシャトルバスが<ruby>運行<rt>うんこう</rt></ruby>しております。", zh: "到主要观光地有专门的接驳巴士运行。" },
      { id: "d1-n2-6", ja: "現在地から目的地までの所要時間は交通状況により変動いたします。", jaHtml: "<ruby>現在地<rt>げんざいち</rt></ruby>から<ruby>目的地<rt>もくてきち</rt></ruby>までの<ruby>所要時間<rt>しょようじかん</rt></ruby>は<ruby>交通状況<rt>こうつうじょうきょう</rt></ruby>により<ruby>変動<rt>へんどう</rt></ruby>いたします。", zh: "从当前位置到目的地所需时间因交通状况而异。" },
    ],
    N1: [
      { id: "d1-n1-1", ja: "路線変更により迂回運転が発生しているため、所要時間が通常より大幅に延びております。", jaHtml: "<ruby>路線変更<rt>ろせんへんこう</rt></ruby>により<ruby>迂回運転<rt>うかいうんてん</rt></ruby>が<ruby>発生<rt>はっせい</rt></ruby>しているため、<ruby>所要時間<rt>しょようじかん</rt></ruby>が<ruby>通常<rt>つうじょう</rt></ruby>より<ruby>大幅<rt>おおはば</rt></ruby>に<ruby>延<rt>の</rt></ruby>びております。", zh: "由于路线变更发生迂回行驶，所需时间较常态大幅延长。" },
      { id: "d1-n1-2", ja: "主要な駅からは無料の送迎バスが運行しておりますが、定員に達し次第発車いたしますのでご注意ください。", jaHtml: "<ruby>主要<rt>しゅよう</rt></ruby>な<ruby>駅<rt>えき</rt></ruby>からは<ruby>無料<rt>むりょう</rt></ruby>の<ruby>送迎<rt>そうげい</rt></ruby>バスが<ruby>運行<rt>うんこう</rt></ruby>しておりますが、<ruby>定員<rt>ていいん</rt></ruby>に<ruby>達<rt>たっ</rt></ruby>し<ruby>次第<rt>しだい</rt></ruby><ruby>発車<rt>はっしゃ</rt></ruby>いたしますのでご<ruby>注意<rt>ちゅうい</rt></ruby>ください。", zh: "主要车站有免费接驳巴士运行，但满员即发车请注意。" },
      { id: "d1-n1-3", ja: "最寄り駅から会場までは屋根のある連絡通路が整備されており、雨天でも濡れずにお越しいただけます。", jaHtml: "<ruby>最寄<rt>もよお</rt></ruby>り<ruby>駅<rt>えき</rt></ruby>から<ruby>会場<rt>かいじょう</rt></ruby>までは<ruby>屋根<rt>やね</rt></ruby>のある<ruby>連絡通路<rt>れんらくつうろ</rt></ruby>が<ruby>整備<rt>せいび</rt></ruby>されており、<ruby>雨天<rt>うてん</rt></ruby>でも<ruby>濡<rt>ぬ</rt></ruby>れずにお<ruby>越<rt>こ</rt></ruby>しいただけます。", zh: "最近车站到会场有带顶棚的连接通道，雨天也可不淋雨到达。" },
      { id: "d1-n1-4", ja: "周辺のコインパーキングは日曜祝日は比較的空きがございますが、平日は混雑が予想されます。", jaHtml: "<ruby>周辺<rt>しゅうへん</rt></ruby>のコインパーキングは<ruby>日曜<rt>にちよう</rt></ruby><ruby>祝日<rt>しゅくじつ</rt></ruby>は<ruby>比較的<rt>ひかくてき</rt></ruby><ruby>空<rt>あ</rt></ruby>きが<ruby>御座<rt>ござ</rt></ruby>いますが、<ruby>平日<rt>へいじつ</rt></ruby>は<ruby>混雑<rt>こんざつ</rt></ruby>が<ruby>予想<rt>よそう</rt></ruby>されます。", zh: "周边的投币停车场周日和节假日比较空，工作日预计会拥挤。" },
      { id: "d1-n1-5", ja: "アクセスの詳細は公式ホームページにも掲載されておりますので、事前にご確認いただきますようお願い申し上げます。", jaHtml: "アクセスの<ruby>詳細<rt>しょうさい</rt></ruby>は<ruby>公式<rt>こうしき</rt></ruby>ホームページにも<ruby>掲載<rt>けいさい</rt></ruby>されておりますので、<ruby>事前<rt>じぜん</rt></ruby>にご<ruby>確認<rt>かくにん</rt></ruby>いただきますようお<ruby>願<rt>ねが</rt></ruby>い<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "交通详情也刊登在官方网站，烦请提前确认。" },
      { id: "d1-n1-6", ja: "万が一会場にお着きの際に道に迷われた場合は、案内スタッフまでお気軽にお申し付けくださいませ。", jaHtml: "<ruby>万<rt>まん</rt></ruby>が<ruby>一<rt>いち</rt></ruby><ruby>会場<rt>かいじょう</rt></ruby>にお<ruby>着<rt>つ</rt></ruby>きの<ruby>際<rt>さい</rt></ruby>に<ruby>道<rt>みち</rt></ruby>に<ruby>迷<rt>まよ</rt></ruby>われた<ruby>場合<rt>ばあい</rt></ruby>は、<ruby>案内<rt>あんない</rt></ruby>スタッフまでお<ruby>気<rt>き</rt></ruby>にせずお<ruby>申<rt>もう</rt></ruby>し<ruby>付<rt>つ</rt></ruby>けくださいませ。", zh: "万一到达会场时迷路，请随时向引导工作人员咨询。" },
    ],
  },

  // ─────────────────────────── numbers-time ───────────────────────────
  {
    id: "numbers-time",
    label: "数字时间",
    emoji: "⏰",
    N5: [
      { id: "n1-n5-1", ja: "今、何時ですか。", jaHtml: "<ruby>今<rt>いま</rt></ruby>、<ruby>何時<rt>なんじ</rt></ruby>ですか。", zh: "现在几点？" },
      { id: "n1-n5-2", ja: "三時です。", jaHtml: "<ruby>三時<rt>さんじ</rt></ruby>です。", zh: "三点。" },
      { id: "n1-n5-3", ja: "今日は何日ですか。", jaHtml: "<ruby>今日<rt>きょう</rt></ruby>は<ruby>何日<rt>なんにち</rt></ruby>ですか。", zh: "今天几号？" },
      { id: "n1-n5-4", ja: "九月十五日です。", jaHtml: "<ruby>九月十五日<rt>くがつじゅうごにち</rt></ruby>です。", zh: "九月十五日。" },
      { id: "n1-n5-5", ja: "電話番号を教えてください。", jaHtml: "<ruby>電話番号<rt>でんわばんごう</rt></ruby>を<ruby>教<rt>おし</rt></ruby>えてください。", zh: "请告诉我电话号码。" },
      { id: "n1-n5-6", ja: "百円です。", jaHtml: "<ruby>百円<rt>ひゃくえん</rt></ruby>です。", zh: "一百日元。" },
    ],
    N4: [
      { id: "n1-n4-1", ja: "会議は午後三時半から始まります。", jaHtml: "<ruby>会議<rt>かいぎ</rt></ruby>は<ruby>午後<rt>ごご</rt></ruby><ruby>三時半<rt>さんじはん</rt></ruby>から<ruby>始<rt>はじ</rt></ruby>まります。", zh: "会议从下午三点半开始。" },
      { id: "n1-n4-2", ja: "明日十時に変更できますか。", jaHtml: "<ruby>明日<rt>あした</rt></ruby><ruby>十時<rt>じゅうじ</rt></ruby>に<ruby>変更<rt>へんこう</rt></ruby>できますか。", zh: "能改到明天十点吗？" },
      { id: "n1-n4-3", ja: "ここに三年住んでいます。", jaHtml: "ここに<ruby>三年<rt>さんねん</rt></ruby><ruby>住<rt>す</rt></ruby>んでいます。", zh: "我在这里住了三年了。" },
      { id: "n1-n4-4", ja: "一日二時間勉強しています。", jaHtml: "<ruby>一日<rt>いちにち</rt></ruby><ruby>二時間<rt>にじかん</rt></ruby><ruby>勉強<rt>べんきょう</rt></ruby>しています。", zh: "每天学习两个小时。" },
      { id: "n1-n4-5", ja: "締め切りは来週金曜日です。", jaHtml: "<ruby>締<rt>し</rt></ruby>め<ruby>切<rt>き</rt></ruby>りは<ruby>来週<rt>らいしゅう</rt></ruby><ruby>金曜日<rt>きんようび</rt></ruby>です。", zh: "截止日期是下周五。" },
      { id: "n1-n4-6", ja: "三十五歳になります。", jaHtml: "<ruby>三十五歳<rt>さんじゅうごさい</rt></ruby>になります。", zh: "我三十五岁了。" },
    ],
    N3: [
      { id: "n1-n3-1", ja: "次の診察は再来月の予定です。", jaHtml: "<ruby>次<rt>つぎ</rt></ruby>の<ruby>診察<rt>しんさつ</rt></ruby>は<ruby>再来月<rt>さらいげつ</rt></ruby>の<ruby>予定<rt>よてい</rt></ruby>です。", zh: "下次检查预计在两个月后。" },
      { id: "n1-n3-2", ja: "週に三回ジムに通っています。", jaHtml: "<ruby>週<rt>しゅう</rt></ruby>に<ruby>三回<rt>さんかい</rt></ruby>ジムに<ruby>通<rt>かよ</rt></ruby>っています。", zh: "每周去三次健身房。" },
      { id: "n1-n3-3", ja: "このプロジェクトには半年以上かかりそうです。", jaHtml: "このプロジェクトには<ruby>半年以上<rt>はんとしいじょう</rt></ruby>かかりそうです。", zh: "这个项目估计要半年以上。" },
      { id: "n1-n3-4", ja: "発売日は来週の予定です。", jaHtml: "<ruby>発売日<rt>はんばいび</rt></ruby>は<ruby>来週<rt>らいしゅう</rt></ruby>の<ruby>予定<rt>よてい</rt></ruby>です。", zh: "发售日期预计是下周。" },
      { id: "n1-n3-5", ja: "一か月滞在しますが、延びる可能性があります。", jaHtml: "<ruby>一<rt>いっ</rt></ruby>か<ruby>月<rt>げつ</rt></ruby><ruby>滞在<rt>たいざい</rt></ruby>しますが、<ruby>延<rt>の</rt></ruby>びる<ruby>可能性<rt>かのうせい</rt></ruby>があります。", zh: "计划待一个月，但可能延长。" },
      { id: "n1-n3-6", ja: "月末までに報告書を提出してください。", jaHtml: "<ruby>月末<rt>げつまつ</rt></ruby>までに<ruby>報告書<rt>ほうこくしょ</rt></ruby>を<ruby>提出<rt>ていしゅつ</rt></ruby>してください。", zh: "月底前请提交报告。" },
    ],
    N2: [
      { id: "n1-n2-1", ja: "締め切りは今月の末日までとなっておりますので、それまでに提出をお願いいたします。", jaHtml: "<ruby>締<rt>し</rt></ruby>め<ruby>切<rt>き</rt></ruby>りは<ruby>今月<rt>こんげつ</rt></ruby>の<ruby>末日<rt>まつじつ</rt></ruby>までとなっておりますので、それまでに<ruby>提出<rt>ていしゅつ</rt></ruby>をお<ruby>願<rt>ねが</rt></ruby>いいたします。", zh: "截止日期为本月底，烦请在此之前提交。" },
      { id: "n1-n2-2", ja: "会議の開始時刻は当初の予定より三十分ほど遅れる見込みです。", jaHtml: "<ruby>会議<rt>かいぎ</rt></ruby>の<ruby>開始時刻<rt>かいしじこく</rt></ruby>は<ruby>当初<rt>とうしょ</rt></ruby>の<ruby>予定<rt>よてい</rt></ruby>より<ruby>三十分<rt>さんじっぷん</rt></ruby>ほど<ruby>遅<rt>おく</rt></ruby>れる<ruby>見込<rt>みこ</rt></ruby>みです。", zh: "会议开始时间预计比原计划推迟三十分钟左右。" },
      { id: "n1-n2-3", ja: "過去三ヶ月間の売上は前年度同期比で十五パーセント増加しました。", jaHtml: "<ruby>過去<rt>かこ</rt></ruby><ruby>三<rt>さん</rt></ruby>か<ruby>月<rt>げつ</rt></ruby><ruby>間<rt>かん</rt></ruby>の<ruby>売上<rt>うりあげ</rt></ruby>は<ruby>前年度<rt>ぜんねんど</rt></ruby><ruby>同期比<rt>どうきひ</rt></ruby>で<ruby>十五<rt>じゅうご</rt></ruby>パーセント<ruby>増加<rt>ぞうか</rt></ruby>しました。", zh: "过去三个月的销售额较去年同期增长 15%。" },
      { id: "n1-n2-4", ja: "毎週水曜日の午後に社内勉強会を開催しております。", jaHtml: "<ruby>毎週<rt>まいしゅう</rt></ruby><ruby>水曜日<rt>すいようび</rt></ruby>の<ruby>午後<rt>ごご</rt></ruby>に<ruby>社内<rt>しゃない</rt></ruby><ruby>勉強会<rt>べんきょうかい</rt></ruby>を<ruby>開催<rt>かいさい</rt></ruby>しております。", zh: "每周三下午举办公司内部学习会。" },
      { id: "n1-n2-5", ja: "このプロジェクトの総予算はおよそ五百万円程度を想定しています。", jaHtml: "このプロジェクトの<ruby>総予算<rt>そうよさん</rt></ruby>はおよそ<ruby>五百万円<rt>ごひゃくまんえん</rt></ruby><ruby>程度<rt>ていど</rt></ruby>を<ruby>想定<rt>そうてい</rt></ruby>しています。", zh: "本项目的总预算预计大约五百万日元左右。" },
      { id: "n1-n2-6", ja: "次回の打ち合わせは来週早々にお願いしたいのですが、ご都合はいかがでしょうか。", jaHtml: "<ruby>次回<rt>じかい</rt></ruby>の<ruby>打<rt>う</rt></ruby>ち<ruby>合<rt>あ</rt></ruby>わせは<ruby>来週<rt>らいしゅう</rt></ruby><ruby>早々<rt>そうそう</rt></ruby>にお<ruby>願<rt>ねが</rt></ruby>いしたいのですが、ご<ruby>都合<rt>つごう</rt></ruby>はいかがでしょうか。", zh: "希望下次会议安排在下周早些时候，您时间方便吗？" },
    ],
    N1: [
      { id: "n1-n1-1", ja: "本契約の有効期限は締結日より起算して一年間とし、期間満了の六十日前までに更新の意思表示を行うものとする。", jaHtml: "<ruby>本契約<rt>ほんけいやく</rt></ruby>の<ruby>有効期限<rt>ゆうこうきげん</rt></ruby>は<ruby>締結日<rt>ていけつび</rt></ruby>より<ruby>起算<rt>きさん</rt></ruby>して<ruby>一年間<rt>いちねんかん</rt></ruby>とし、<ruby>期間満了<rt>きかんまんりょう</rt></ruby>の<ruby>六十日前<rt>ろくじゅうにちまえ</rt></ruby>までに<ruby>更新<rt>こうしん</rt></ruby>の<ruby>意思表示<rt>いしひょうじ</rt></ruby>を<ruby>行<rt>おこな</rt></ruby>うものとする。", zh: "本合同的有效期自签订日起算为一年，须于期满前 60 天做出更新意向表示。" },
      { id: "n1-n1-2", ja: "直近四半期の業績は前年度と比較しても顕著な成長を遂げており、市場全体の伸び率を大きく上回っております。", jaHtml: "<ruby>直近四半期<rt>ちょっきんしはんき</rt></ruby>の<ruby>業績<rt>ぎょうせき</rt></ruby>は<ruby>前年度<rt>ぜんねんど</rt></ruby>と<ruby>比較<rt>ひかく</rt></ruby>しても<ruby>顕著<rt>けんちょ</rt></ruby>な<ruby>成長<rt>せいちょう</rt></ruby>を<ruby>遂<rt>と</rt></ruby>げており、<ruby>市場全体<rt>しじょうぜんたい</rt></ruby>の<ruby>伸<rt>の</rt></ruby>び<ruby>率<rt>りつ</rt></ruby>を<ruby>大<rt>おお</rt></ruby>きく<ruby>上回<rt>うわまわ</rt></ruby>っております。", zh: "最近一季度的业绩较去年同期也实现了显著增长，大幅超越市场整体增长率。" },
      { id: "n1-n1-3", ja: "繁忙期には通常の二倍から三倍程度の作業量が集中するため、人員配置には十分な配慮が必要と考えております。", jaHtml: "<ruby>繁忙期<rt>はんぼうき</rt></ruby>には<ruby>通常<rt>つうじょう</rt></ruby>の<ruby>二倍<rt>にばい</rt></ruby>から<ruby>三倍<rt>さんばい</rt></ruby><ruby>程度<rt>ていど</rt></ruby>の<ruby>作業量<rt>さぎょうりょう</rt></ruby>が<ruby>集中<rt>しゅうちゅう</rt></ruby>するため、<ruby>人員配置<rt>じんいんはいち</rt></ruby>には<ruby>十分<rt>じゅうぶん</rt></ruby>な<ruby>配慮<rt>はいりょ</rt></ruby>が<ruby>必要<rt>ひつよう</rt></ruby>と<ruby>考<rt>かんが</rt></ruby>えております。", zh: "繁忙期工作量集中为常规的 2 至 3 倍，人力调配上需要充分考虑。" },
      { id: "n1-n1-4", ja: "次期システムのリリースは来年度の上期を予定しておりますが、スケジュールについては適宜見直す可能性がございます。", jaHtml: "<ruby>次期<rt>じき</rt></ruby>システムのリリースは<ruby>来年度<rt>らいねんど</rt></ruby>の<ruby>上期<rt>かみき</rt></ruby>を<ruby>予定<rt>よてい</rt></ruby>しておりますが、スケジュールについては<ruby>適宜<rt>てきぎ</rt></ruby><ruby>見直<rt>みなお</rt></ruby>す<ruby>可能性<rt>かのうせい</rt></ruby>が<ruby>御座<rt>ござ</rt></ruby>います。", zh: "下一期系统的发布预计安排在下年度上半年，但日程可能适时调整。" },
      { id: "n1-n1-5", ja: "過去十年間における業界の動向を踏まえると、テクノロジーの進化が従来のビジネスモデルに大きな変革をもたらしています。", jaHtml: "<ruby>過去十年間<rt>かこじゅうねんかん</rt></ruby>における<ruby>業界<rt>ぎょうかい</rt></ruby>の<ruby>動向<rt>どうこう</rt></ruby>を<ruby>踏<rt>ふ</rt></ruby>まえると、テクノロジーの<ruby>進化<rt>しんか</rt></ruby>が<ruby>従来<rt>じゅうらい</rt></ruby>のビジネスモデルに<ruby>大<rt>おお</rt></ruby>きな<ruby>変革<rt>へんかく</rt></ruby>を<ruby>持<rt>も</rt></ruby>たらしています。", zh: "回顾过去十年的行业动向，技术的进步为传统商业模式带来了巨大的变革。" },
      { id: "n1-n1-6", ja: "統計データに基づきますと、本製品の市場シェアは過去五年間で二倍以上拡大しており、今後もこの傾向は継続する見込みです。", jaHtml: "<ruby>統計<rt>とうけい</rt></ruby>データに<ruby>基<rt>もと</rt></ruby>づきますと、<ruby>本製品<rt>ほんせいひん</rt></ruby>の<ruby>市場<rt>しじょう</rt></ruby>シェアは<ruby>過去五年間<rt>かこごねんかん</rt></ruby>で<ruby>二倍以上<rt>にばいいじょう</rt></ruby><ruby>拡大<rt>かくだい</rt></ruby>しており、<ruby>今後<rt>こんご</rt></ruby>もこの<ruby>傾向<rt>けいこう</rt></ruby>は<ruby>継続<rt>けいぞく</rt></ruby>する<ruby>見込<rt>みこ</rt></ruby>みです。", zh: "根据统计数据，本产品的市场份额在过去五年间扩大了两倍以上，预计今后这一趋势仍将继续。" },
    ],
  },

  // ─────────────────────────── greetings ───────────────────────────
  {
    id: "greetings",
    label: "寒暄",
    emoji: "👋",
    N5: [
      { id: "g1-n5-1", ja: "おはようございます。", jaHtml: "おはようございます。", zh: "早上好。" },
      { id: "g1-n5-2", ja: "こんにちは。", jaHtml: "こんにちは。", zh: "你好（白天）。" },
      { id: "g1-n5-3", ja: "こんばんは。", jaHtml: "こんばんは。", zh: "晚上好。" },
      { id: "g1-n5-4", ja: "お疲れ様です。", jaHtml: "お<ruby>疲<rt>つか</rt></ruby>れ<ruby>様<rt>さま</rt></ruby>です。", zh: "辛苦了。" },
      { id: "g1-n5-5", ja: "また明日。", jaHtml: "また<ruby>明日<rt>あした</rt></ruby>。", zh: "明天见。" },
      { id: "g1-n5-6", ja: "また会いましょう。", jaHtml: "また<ruby>会<rt>あ</rt></ruby>いましょう。", zh: "下次再见。" },
    ],
    N4: [
      { id: "g1-n4-1", ja: "今日はいい天気ですね。", jaHtml: "<ruby>今日<rt>きょう</rt></ruby>はいい<ruby>天気<rt>てんき</rt></ruby>ですね。", zh: "今天天气真好。" },
      { id: "g1-n4-2", ja: "お体に気をつけてください。", jaHtml: "お<ruby>体<rt>からだ</rt></ruby>に<ruby>気<rt>き</rt></ruby>をつけてください。", zh: "请注意身体。" },
      { id: "g1-n4-3", ja: "先日はお世話になりました。", jaHtml: "<ruby>先日<rt>せんじつ</rt></ruby>はお<ruby>世話<rt>せわ</rt></ruby>になりました。", zh: "前几天承蒙关照。" },
      { id: "g1-n4-4", ja: "助けていただき、ありがとうございます。", jaHtml: "<ruby>助<rt>たす</rt></ruby>けていただき、ありがとうございます。", zh: "谢谢您的帮助。" },
      { id: "g1-n4-5", ja: "ちょっと聞いてもいいですか。", jaHtml: "ちょっと<ruby>聞<rt>き</rt></ruby>いてもいいですか。", zh: "能打扰一下吗？" },
      { id: "g1-n4-6", ja: "お待たせしました。", jaHtml: "お<ruby>待<rt>ま</rt></ruby>たせしました。", zh: "让您久等了。" },
    ],
    N3: [
      { id: "g1-n3-1", ja: "先日はお忙しい中お時間をいただき、ありがとうございます。", jaHtml: "<ruby>先日<rt>せんじつ</rt></ruby>はお<ruby>忙<rt>いそが</rt></ruby>しい<ruby>中<rt>なか</rt></ruby>お<ruby>時間<rt>じかん</rt></ruby>をいただき、ありがとうございます。", zh: "感谢您在百忙之中抽出时间。" },
      { id: "g1-n3-2", ja: "今後ともよろしくお願いいたします。", jaHtml: "<ruby>今後<rt>こんご</rt></ruby>ともよろしくお<ruby>願<rt>ねが</rt></ruby>いいたします。", zh: "今后也请多多指教。" },
      { id: "g1-n3-3", ja: "お陰様で元気です。", jaHtml: "お<ruby>陰様<rt>かげさま</rt></ruby>で<ruby>元気<rt>げんき</rt></ruby>です。", zh: "托您的福，我很好。" },
      { id: "g1-n3-4", ja: "改めてお詫び申し上げます。", jaHtml: "<ruby>改<rt>あらた</rt></ruby>めてお<ruby>詫<rt>わ</rt></ruby>び<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "再次表示歉意。" },
      { id: "g1-n3-5", ja: "お邪魔いたします。", jaHtml: "お<ruby>邪魔<rt>じゃま</rt></ruby>いたします。", zh: "打扰了。" },
      { id: "g1-n3-6", ja: "お力添えいただけると大変助かります。", jaHtml: "お<ruby>力添<rt>ちからぞ</rt></ruby>えいただけると<ruby>大変<rt>たいへん</rt></ruby><ruby>助<rt>たす</rt></ruby>かります。", zh: "能得到您的帮助，我将不胜感激。" },
    ],
    N2: [
      { id: "g1-n2-1", ja: "先日はお忙しい中お越しいただきまして、誠にありがとうございました。", jaHtml: "<ruby>先日<rt>せんじつ</rt></ruby>はお<ruby>忙<rt>いそが</rt></ruby>しい<ruby>中<rt>なか</rt></ruby>お<ruby>越<rt>こ</rt></ruby>しいただきまして、<ruby>誠<rt>まこと</rt></ruby>にありがとうございました。", zh: "感谢您前日在百忙之中拨冗前来。" },
      { id: "g1-n2-2", ja: "こちらの不手際によりご迷惑をおかけしましたことを深くお詫び申し上げます。", jaHtml: "こちらの<ruby>不手際<rt>ふてぎわ</rt></ruby>によりご<ruby>迷惑<rt>めいわく</rt></ruby>をおかけしましたことを<ruby>深<rt>ふか</rt></ruby>くお<ruby>詫<rt>わ</rt></ruby>び<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "因我方处理不当给您带来困扰，深表歉意。" },
      { id: "g1-n2-3", ja: "今後とも変わらぬお引き立てを賜りますよう、何卒よろしくお願い申し上げます。", jaHtml: "<ruby>今後<rt>こんご</rt></ruby>とも<ruby>変<rt>か</rt></ruby>わらぬお<ruby>引<rt>ひ</rt></ruby>き<ruby>立<rt>た</rt></ruby>てを<ruby>賜<rt>たまわ</rt></ruby>りますよう、<ruby>何卒<rt>なにとぞ</rt></ruby>よろしくお<ruby>願<rt>ねが</rt></ruby>い<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "今后也请一如既往给予关照，恳请多多指教。" },
      { id: "g1-n2-4", ja: "ご多用中とは存じますが、何卒ご出席賜りますようお願い申し上げます。", jaHtml: "ご<ruby>多用中<rt>たようちゅう</rt></ruby>とは<ruby>存<rt>ぞん</rt></ruby>じますますが、<ruby>何卒<rt>なにとぞ</rt></ruby>ご<ruby>出席<rt>しゅっせき</rt></ruby><ruby>賜<rt>たまわ</rt></ruby>りますようお<ruby>願<rt>ねが</rt></ruby>い<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "知您事务繁忙，仍恳请拨冗出席。" },
      { id: "g1-n2-5", ja: "皆様のご健勝とご多幸を心よりお祈り申し上げます。", jaHtml: "<ruby>皆様<rt>みなさま</rt></ruby>のご<ruby>健勝<rt>けんしょう</rt></ruby>とご<ruby>多幸<rt>たこう</rt></ruby>を<ruby>心<rt>こころ</rt></ruby>よりお<ruby>祈<rt>いの</rt></ruby>り<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "衷心祝愿各位健康幸福。" },
      { id: "g1-n2-6", ja: "取り急ぎお礼まで申し上げますとともに、引き続きどうぞよろしくお願いいたします。", jaHtml: "<ruby>取<rt>と</rt></ruby>り<ruby>急<rt>いそ</rt></ruby>ぎお<ruby>礼<rt>れい</rt></ruby>まで<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げますとともに、<ruby>引<rt>ひ</rt></ruby>き<ruby>続<rt>つづ</rt></ruby>きどうぞよろしくお願いいたします。", zh: "匆忙致谢，并请今后继续多多关照。" },
    ],
    N1: [
      { id: "g1-n1-1", ja: "時下ますますご清栄のこととお慶び申し上げます。平素は格別のご高配を賜り、厚く御礼申し上げます。", jaHtml: "<ruby>時下<rt>じか</rt></ruby>ますますご<ruby>清栄<rt>せいえい</rt></ruby>のことと<ruby>慶<rt>よろこ</rt></ruby>び<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。<ruby>平素<rt>へいそ</rt></ruby>は<ruby>格別<rt>かくべつ</rt></ruby>のご<ruby>高配<rt>こうはい</rt></ruby>を<ruby>賜<rt>たまわ</rt></ruby>り、<ruby>厚<rt>あつ</rt></ruby>くお<ruby>礼<rt>れい</rt></ruby><ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "值此谨祝贵司日益昌盛。素承格外关照，谨致深切谢意。" },
      { id: "g1-n1-2", ja: "先般ご提案差し上げました件につきまして、社内で慎重に検討を重ねた結果、この度正式に参画させていただく運びとなりました。", jaHtml: "<ruby>先般<rt>せんぱん</rt></ruby>ご<ruby>提案<rt>ていあん</rt></ruby><ruby>差<rt>さ</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げました<ruby>件<rt>けん</rt></ruby>につきまして、<ruby>社内<rt>しゃない</rt></ruby>で<ruby>慎重<rt>しんちょう</rt></ruby>に<ruby>検討<rt>けんとう</rt></ruby>を<ruby>重<rt>かさ</rt></ruby>ねた<ruby>結果<rt>けっか</rt></ruby>、この<ruby>度<rt>たび</rt></ruby><ruby>正式<rt>せいしき</rt></ruby>に<ruby>参画<rt>さんかく</rt></ruby>させていただく<ruby>運<rt>はこ</rt></ruby>びとなりました。", zh: "关于先前所提方案，我方经公司内部慎重研讨，决定此次正式参与。" },
      { id: "g1-n1-3", ja: "ご多用中のところ恐縮ではございますが、ぜひとも私たちの活動にご理解とご支援を賜りますようお願い申し上げます。", jaHtml: "ご<ruby>多用中<rt>たようちゅう</rt></ruby>のところ<ruby>恐縮<rt>きょうしゅく</rt></ruby>ではございますが、ぜひとも私たちの<ruby>活動<rt>かつどう</rt></ruby>にご<ruby>理解<rt>りかい</rt></ruby>とご<ruby>支援<rt>しえん</rt></ruby>を<ruby>賜<rt>たまわ</rt></ruby>りますようお<ruby>願<rt>ねが</rt></ruby>い<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "百忙之中多有叨扰，敬请对我们的活动给予理解与支持。" },
      { id: "g1-n1-4", ja: "ご臨席賜りますれば、望外の喜びとするところでございます。何卒万障お繰り合わせの上、ご出席賜りますようお願い申し上げます。", jaHtml: "ご<ruby>臨席<rt>りんせき</rt></ruby><ruby>賜<rt>たまわ</rt></ruby>りますれば、<ruby>望外<rt>ぼうがい</rt></ruby>の<ruby>喜<rt>よろこ</rt></ruby>びとするところでございます。<ruby>何卒<rt>なにとぞ</rt></ruby><ruby>万障<rt>ばんしょう</rt></ruby>お<ruby>繰<rt>く</rt></ruby>り<ruby>合<rt>あ</rt></ruby>わせの<ruby>上<rt>うえ</rt></ruby>、ご<ruby>出席<rt>しゅっせき</rt></ruby><ruby>賜<rt>たまわ</rt></ruby>りますようお<ruby>願<rt>ねが</rt></ruby>い<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "如蒙光临，不胜荣幸之至。恳请百忙之中拨冗出席。" },
      { id: "g1-n1-5", ja: "略儀ながら書中にてお礼申し上げます。皆様方のご協力により、本事業を無事に完遂することができました。", jaHtml: "<ruby>略儀<rt>りゃくぎ</rt></ruby>ながら<ruby>書中<rt>しょちゅう</rt></ruby>にてお<ruby>礼<rt>れい</rt></ruby><ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。<ruby>皆様方<rt>みなさまがた</rt></ruby>のご<ruby>協力<rt>きょうりょく</rt></ruby>により、<ruby>本事業<rt>ほんじぎょう</rt></ruby>を<ruby>無事<rt>ぶじ</rt></ruby>に<ruby>完遂<rt>かんすい</rt></ruby>することができました。", zh: "谨以书函聊表谢意。承蒙各位协助，本项目得以顺利完成。" },
      { id: "g1-n1-6", ja: "ご指導ご鞭撻のほど、何卒よろしくお願い申し上げますとともに、末筆ながら皆様の益々のご発展を心よりお祈り申し上げます。", jaHtml: "ご<ruby>指導<rt>しどう</rt></ruby>ご<ruby>鞭撻<rt>べんたつ</rt></ruby>のほど、<ruby>何卒<rt>なにとぞ</rt></ruby>よろしくお<ruby>願<rt>ねが</rt></ruby>い<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げますとともに、<ruby>末筆<rt>まっぴつ</rt></ruby>ながら<ruby>皆様<rt>みなさま</rt></ruby>の<ruby>益々<rt>ますます</rt></ruby>のご<ruby>発展<rt>はってん</rt></ruby>を<ruby>心<rt>こころ</rt></ruby>よりお<ruby>祈<rt>いの</rt></ruby>り<ruby>申<rt>もう</rt></ruby>し<ruby>上<rt>あ</rt></ruby>げます。", zh: "恳请多多指导鞭策，谨此致谢，并衷心祝愿各位日益发展兴旺。" },
    ],
  },
];

export const CATEGORY_LABELS: Record<string, { emoji: string; label: string }> = {
  "self-intro": { emoji: "🙋", label: "自我介绍" },
  restaurant: { emoji: "🍱", label: "餐厅" },
  directions: { emoji: "🗺️", label: "问路" },
  "numbers-time": { emoji: "⏰", label: "数字时间" },
  greetings: { emoji: "👋", label: "寒暄" },
};

export function difficultyOf(sentenceId: string): Difficulty | null {
  const m = sentenceId.match(/-n([54321])-\d+$/);
  return m ? (`N${m[1]}` as Difficulty) : null;
}