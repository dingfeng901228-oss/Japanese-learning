refactor(listening): merge /shadowing into /listening as 真人发音 mode

Frank #6643: 把"跟读"菜单 改为"真人发音"，然后移动至"听力"模块里。
同样，学习时长也算作 听力 的时长。

Architecture decision: NOT a shared component. Two different audio
stacks forced distinct implementations:
  • /shadowing (was): HTML5 `<audio>` + 预录 mp3（Cloudflare R2）
  • /listening (was): Web Speech API 实时 TTS（无 mp4，无时长）
Even though shadowing UX was the model, the component abstractions
don't compose — shared playback prefs / state shape would be more
complex than the duplication. Kept RealShadowClient as a separate
client component file (40KB, moved from app/shadowing/), embedded as
a 3rd mode in /listening.

Changes:

1. **Menu rename + move** (`app/layout.tsx`)
   - Removed `{ label: "跟读", href: "/shadowing" }` from NAV_ITEMS
   - /shadowing now redirects to /listening?mode=realShadow (keeps
     bookmarks alive)

2. **/listening — 3rd mode** (`app/listening/page.tsx`)
   - `type Mode = "listen" | "shadow" | "realShadow"` (added realShadow)
   - State init accepts `?mode=realShadow` deep-link
   - Imports: RealShadowClient + MOTTO_SENTENCES
   - New 3rd tab "🎧 真人发音" between "Shadow 跟读" and "Difficulty"
   - Sentence card section now conditional: when mode === "realShadow"
     renders <RealShadowClient /> (with its own <main> + sticky
     player + sentence tree + grading result); otherwise renders the
     TTS-based sentence card as before. Wrapping the whole section
     avoids nested `<main>` inside the listening page's `<main>`.

3. **RealShadowClient** (`app/listening/RealShadowClient.tsx`)
   - Copied verbatim from app/shadowing/ShadowingClient.tsx (40KB)
   - Renamed default export: ShadowingClient → RealShadowClient
   - **CRITICAL — time accounting** (Frank's third requirement):
     useSessionTimer("shadowing", nowPlaying) →
     useSessionTimer("listening", nowPlaying). All 真人发音 time now
     rolls up into the 听力 daily total (accumulated.listening) instead
     of the legacy accumulated.shadowing bucket.
   - grade API categoryLabel: "Motto Shadowing" → "真人发音"
     (visible in the LLM feedback string the user sees)

4. **/today training item** (`lib/today-stats.ts`)
   - Renamed label "Shadowing" → "真人发音" + emoji "🔁" → "🎧" +
     href /listening?mode=shadow → /listening?mode=realShadow
   - id stays "shadowing" for localStorage backward compat (existing
     accumulated.shadowing data preserved; new sessions go to
     accumulated.listening per #3)

5. **Old route cleanup**
   - `app/shadowing/ShadowingClient.tsx` deleted (moved to RealShadowClient)
   - `app/shadowing/page.tsx` converted to server-side redirect to
     /listening?mode=realShadow (preserves external links + bookmarks)

Other notes:
- /listening's internal "shadow" mode (TTS-based recording + grading,
  the 2nd tab) is UNCHANGED. Its useSessionTimer still uses
  type="shadowing". Frank's request was specifically about the menu
  跟读 (= /shadowing / 真人发音) — internal TTS shadow stays separate.
- The internal /listening shadow + external /shadowing were always
  two different products (real audio vs TTS). This PR folds the real-
  audio one into /listening as a 3rd mode; the TTS-based one stays as
  the 2nd tab.

Tests:
- tsc --noEmit exit 0
- eslint . exit 0 (0 errors; pre-existing warnings in other files
  unchanged from #6641)
- File sizes:
  - app/listening/page.tsx: 63579 → ~69 KB (+5.4 KB for 3rd tab + wrap)
  - app/listening/RealShadowClient.tsx: NEW 40 KB
  - app/shadowing/ShadowingClient.tsx: deleted
  - app/shadowing/page.tsx: 435 → 421 bytes (redirect)
  - app/layout.tsx: -1 line (removed 跟读)
  - lib/today-stats.ts: +5 lines (rename + comment)

关联 commit IDs（cross-session 引用）：replaces the /shadowing route entirely
关联文件路径：
- `F:\WebSite\Japanese-learning-compare\app\listening\page.tsx`
- `F:\WebSite\Japanese-learning-compare\app\listening\RealShadowClient.tsx`
- `F:\WebSite\Japanese-learning-compare\app\shadowing\page.tsx`
- `F:\WebSite\Japanese-learning-compare\app\layout.tsx`
- `F:\WebSite\Japanese-learning-compare\lib\today-stats.ts`