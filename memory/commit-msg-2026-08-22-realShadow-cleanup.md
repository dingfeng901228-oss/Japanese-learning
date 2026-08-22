fix(listening): remove nested `<main>` + move realShadow player inline

Frank #6648: 1. 这些有点冗余，都删掉
            2. "真人发音"的播放器模块 移至 "翻译"模块的下面

Both follow-up to #6643 / commit `df39637` which merged
app/shadowing/ → app/listening/ as "真人发音" mode. The merge
wrapped the (formerly `/shadowing`) RealShadowClient in its own
`<main>` + `<header>` + `<h1>` + `<p>` — fine on its own, but
/app/listening/page.tsx already wraps the page in a `<main>` and
provides its own mode-aware header + h1 + p. Net effect: when the
user is in realShadow mode, /listening renders TWO complete
header/h1/p/title rows + TWO nested `<main>` elements (invalid
HTML — `main` must be unique per document). Frank's screenshots
confirmed the duplicate UI.

Implementation:

1. **app/listening/RealShadowClient.tsx** — drop the redundant
   `<main>` wrapper + `<header>` + `<h1>` + `<p>`. The component now
   returns a `<>...</>` Fragment; the parent listening page's
   `<main>` is the single root. h1/p are now provided by the parent
   with mode-aware content (`mode === "listen" ? "听力训练" :
   mode === "shadow" ? "跟读训练" : "真人发音"` + matching p).

2. **app/shadowing/ShadowingClient → realShadow player** — was
   sticky-bottom-of-component (Frank #6459), now moved inline below
   the translation toggle in the article section. Wrapper className
   `border-t border-gray-200 pt-4 mt-4` (matches the shadow controls
   block below it for visual rhythm). User flow now: read ja →
   optionally toggle zh → play reference audio → record attempt →
   see result.

Key design decisions:

- **Fragment, not `<main>`**: `<main>` must be unique per document
  (HTML spec, accessibility). Returning Fragment keeps the listening
  page's existing `<main>` as the only main landmark.

- **h1/p lives on the parent, not the child**: child components
  shouldn't own page-level title/description when the parent
  already does — this also means mode switches (Listen ↔ Shadow ↔
  真人发音) automatically update h1 without any prop wiring.

- **Inline player, not fixed-bottom**: sticky player was a 跟读
  ergonomics choice when /shadowing was standalone; inside /listening
  (with the rest of the recording UI scrolling below), it's more
  useful to have the reference audio right after the text the user
  is reading.

- **Player moved BEFORE shadow controls, not after**: Frank's
  literal request was "below 翻译 module" — translation toggle ends
  right before shadow controls start, so the player goes between
  them. This means the user hears the reference audio before
  recording their attempt.

Tests:

- tsc --noEmit exit 0
- eslint . exit 0 (0 errors; the 4 remaining warnings are pre-
  existing in app/review/review-session.tsx, app/shadowing/ShadowingClient.tsx,
  app/today/page.tsx — unchanged by this commit)
- Manual Vercel: refresh jp.frank2025.com/listening in realShadow
  mode → see single header row, single h1, single description,
  player inline below translation toggle (no sticky)

关联 commit IDs（cross-session 引用）：fixes the UI redundancies
introduced by `df39637`; no other commits depend on the nested
`<main>` structure (it was added in df39637 itself).
关联文件路径：
- `F:\WebSite\Japanese-learning-compare\app\listening\RealShadowClient.tsx`
- `F:\WebSite\Japanese-learning-compare\app\listening\page.tsx`