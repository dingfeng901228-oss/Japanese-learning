# FastStudy 2.0 — AI 日语口语教练

> "Don't just study Japanese. Use Japanese."

AI 驱动的日语听力与口语训练系统。  
核心能力：**长期观察学习者 + 自动调整训练内容**，把"看得懂的日语"逐渐变成"听得懂、说得出、用得自然的日语"。

📄 [完整产品设计](docs/requirements.docx)

---

## 🛠 开发路线（11 个 Phase）

| Phase | 范围 | 状态 |
|-------|------|------|
| **0** | 项目初始化与骨架 | 🟡 进行中 |
| **1** | AI Conversation MVP（登录 + Dashboard + 对话 + STT + 反馈 + 错误记忆） | ⚪ |
| **2** | Speech-to-Text 增强 | ⚪ |
| **3** | AI Feedback 增强 | ⚪ |
| **4** | Mistake Memory | ⚪ |
| **5** | Retry | ⚪ |
| **6** | Listening + Shadowing | ⚪ |
| **7** | Daily Training Engine | ⚪ |
| **8** | Weakness Profile | ⚪ |
| **9** | Real-World Missions | ⚪ |
| **10** | Progress / Analytics | ⚪ |

---

## 🧱 Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS
- **AI Provider**: 待定（OpenAI / DeepSeek 候选）
- **Database**: 待定（Supabase / SQLite + Drizzle 候选）

## 🚀 本地开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000

---

## 📂 项目结构

```
.
├── docs/
│   └── requirements.docx    # 完整产品设计书
├── app/                     # Next.js App Router（待生成）
│   ├── (auth)/
│   ├── (app)/
│   │   ├── today/
│   │   ├── listening/
│   │   ├── speaking/
│   │   ├── review/
│   │   ├── missions/
│   │   └── progress/
│   └── layout.tsx
├── components/
├── lib/
├── prompts/                 # AI Prompt 模板（system / conversation / feedback / retry / classifier）
└── public/
```

---

## 📝 License

MIT（待定）
