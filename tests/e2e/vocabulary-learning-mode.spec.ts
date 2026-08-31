// E2E smoke tests for vocab learning mode (Frank #7397 / #7445).
//
// Covers the 5 cases from the #7445 checklist:
//   ① PageInput jump (commit 4bfeb27)
//   ② Continue Learning card (commit 5d6568c)
//   ③ Last position resume
//   ④ Detail page UI (commit 32119ff)
//   ⑤ Idempotency (sessionStorage + DB PK)
//
// Auth: tests/e2e/auth.json must exist (see tests/e2e/README.md for the
// one-time `npx playwright codegen --save-storage=...` step). Tests
// that need an authenticated session will skip with a clear reason if
// the storage file is missing rather than failing noisily.
//
// Data assumptions:
//   - User has >20 vocab items for pagination tests (else skip with reason)
//   - User has at least 1 vocab item for detail-page / learn-mode tests
//   - "Continue Learning" tests require a prior learning session to have
//     populated user_learning_state (else skip with reason)
//
// Run locally:  npm run dev (separate terminal) →  npm run test:e2e
// Run on deployed:  BASE_URL=https://<host>  npm run test:e2e

import { test, expect } from "@playwright/test";

test.describe("Vocab learning mode (Frank #7397 smoke test)", () => {
  test.use({ storageState: "tests/e2e/auth.json" });

  // ────────────────────────────────────────────────────────────────────
  // ① PageInput — input page number + Enter navigates (commit 4bfeb27)
  // ────────────────────────────────────────────────────────────────────

  test('① PageInput — input "3" + Enter navigates to page 3', async ({ page }) => {
    await page.goto("/vocabulary");
    const input = page.getByLabel("跳转到指定页");
    test.skip(
      !(await input.isVisible().catch(() => false)),
      "Pagination input not visible — need >20 vocab",
    );
    await input.fill("3");
    await input.press("Enter");
    await expect(page).toHaveURL(/[?&]page=3/);
  });

  test('① PageInput — invalid "abc" + Enter does not navigate', async ({ page }) => {
    await page.goto("/vocabulary?page=2");
    const input = page.getByLabel("跳转到指定页");
    test.skip(
      !(await input.isVisible().catch(() => false)),
      "Pagination input not visible — need >20 vocab",
    );
    await input.fill("abc");
    await input.press("Enter");
    // §一.3: !Number → restore current page (page=2)
    await expect(page).toHaveURL(/[?&]page=2/);
  });

  test('① PageInput — out-of-range "999" + Enter clamps to totalPages', async ({ page }) => {
    await page.goto("/vocabulary?page=1");
    const input = page.getByLabel("跳转到指定页");
    test.skip(
      !(await input.isVisible().catch(() => false)),
      "Pagination input not visible — need >20 vocab",
    );
    await input.fill("999");
    await input.press("Enter");
    // Should NOT have page=999 in URL.
    await expect(page).not.toHaveURL(/[?&]page=999/);
    // Should have clamped to totalPages — read from "/ N 页" text.
    const navText = await page.locator('nav[aria-label="分页"]').innerText();
    const match = navText.match(/\/\s*(\d+)\s*页/);
    expect(match, `expected "/ N 页" in pagination nav, got: ${navText}`).not.toBeNull();
    if (match) {
      const totalPages = match[1];
      await expect(page).toHaveURL(new RegExp(`[?&]page=${totalPages}\\b`));
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // ② Continue Learning card (commit 5d6568c)
  // ────────────────────────────────────────────────────────────────────

  test("② Continue Learning card — visible after prior session", async ({ page }) => {
    await page.goto("/vocabulary");
    const card = page.getByText("继续学习").first();
    test.skip(
      !(await card.isVisible().catch(() => false)),
      "No '继续学习' card — user has not completed a /vocabulary/learn session yet",
    );
    // Per §二十三, the card should display:
    //   - 上次学到: <vocab word>
    //   - <type> · <level> · 上次学习: <relative time>
    await expect(page.getByText(/上次学到/)).toBeVisible();
    // The CTA button
    await expect(
      page.getByRole("link", { name: /继续学习/ }).first(),
    ).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────────
  // ③ Last position resume (Q5-α: ignore current filter, jump to saved)
  //
  // Per Frank #7458 (2026-08-31): opening detail page IS studying. So
  // [继续学习] → /vocabulary/[id] of last vocab (not /vocabulary/learn
  // queue walker, which no longer increments). Detail page mount
  // triggers the +1 via LearningTracker.
  // ────────────────────────────────────────────────────────────────────

  test("③ Resume — clicking 继续学习 opens last vocab's detail page", async ({ page }) => {
    await page.goto("/vocabulary");
    const continueLink = page.getByRole("link", { name: /继续学习/ }).first();
    test.skip(
      !(await continueLink.isVisible().catch(() => false)),
      "No continue card",
    );
    await continueLink.click();
    // Per #7458: lands on /vocabulary/[uuid], NOT /vocabulary/learn.
    await expect(page).toHaveURL(/\/vocabulary\/[a-f0-9-]+/);
    // Detail page renders 学习记录 section (the canonical learning surface).
    await expect(
      page.getByRole("heading", { name: "学习记录" }),
    ).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────────
  // ④ Detail page UI (commit 32119ff + #7458 update)
  //
  // Per Frank #7458: [开始学习] CTA removed (opening page = studying).
  // The detail page now owns the +1 trigger via LearningTracker.
  // ────────────────────────────────────────────────────────────────────

  test("④ Detail page — 学习记录 section (no 开始学习 CTA)", async ({ page }) => {
    await page.goto("/vocabulary");
    // Pick the first vocab card link. UUIDs always contain hyphens, so
    // `[href*="-"]` filters out other /vocabulary/* paths (/new).
    const firstLink = page
      .locator('a[href^="/vocabulary/"][href*="-"]')
      .first();
    test.skip(
      !(await firstLink.isVisible().catch(() => false)),
      "No vocab items",
    );
    await firstLink.click();
    await expect(page).toHaveURL(/\/vocabulary\/[a-f0-9-]+/);

    // 学习记录 section
    await expect(
      page.getByRole("heading", { name: "学习记录" }),
    ).toBeVisible();
    // The four stat rows
    await expect(page.getByText("学习次数")).toBeVisible();
    await expect(page.getByText("复习次数")).toBeVisible();
    await expect(page.getByText("最近学习")).toBeVisible();
    await expect(page.getByText("最近复习")).toBeVisible();
    // Per Frank #7458: [开始学习 →] CTA removed. The page mount itself
    // is the learning event (via LearningTracker client component).
    await expect(
      page.getByRole("link", { name: /开始学习/ }),
    ).toHaveCount(0);
  });

  // ────────────────────────────────────────────────────────────────────
  // ⑤ Idempotency — F5 refresh on /vocabulary/[id] does NOT +1
  //
  // Per Frank #7458 (2026-08-31): detail page mount = studying event.
  // sessionStorage[`vocab_learn_${vocabId}`] = UUID, persists across
  // reload → server RPC PK (user_id, session_token) catches duplicates.
  //
  // (The smoke test previously verified this on /vocabulary/learn.
  // After #7458, the count trigger lives on /vocabulary/[id]. Same
  // idempotency mechanism — sessionStorage + RPC PK — just moved.)
  // ────────────────────────────────────────────────────────────────────

  test("⑤ Idempotency — refresh on /vocabulary/[id] does not double-count", async ({
    page,
  }) => {
    await page.goto("/vocabulary");
    const firstLink = page
      .locator('a[href^="/vocabulary/"][href*="-"]')
      .first();
    test.skip(
      !(await firstLink.isVisible().catch(() => false)),
      "No vocab items",
    );
    await firstLink.click();
    await expect(page).toHaveURL(/\/vocabulary\/[a-f0-9-]+/);

    // LearningTracker mounts → startLearningSession RPC → vocab_items
    // row gets learning_count += 1. The "学习次数 N 次" text appears
    // after the RPC round-trip + revalidation.
    //
    // Note: we read the learning_count from the server-rendered detail
    // page (via the 学习次数 row in 学习记录), not from a separate
    // text in the URL bar like /vocabulary/learn used to show.
    const learningCountRow = page.locator(
      'section:has(h2:text("学习记录")) >> text=/^\\d+ 次$/',
    );
    await learningCountRow.first().waitFor({ state: "visible", timeout: 15_000 });
    const before = Number(
      (await learningCountRow.first().innerText()).match(/\d+/)![0],
    );

    // F5 — same URL, same tab → sessionStorage persists → same token → no +1.
    await page.reload();
    await learningCountRow
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    const afterReload = Number(
      (await learningCountRow.first().innerText()).match(/\d+/)![0],
    );

    expect(afterReload, "F5 should NOT increment learningCount").toBe(before);
  });
});