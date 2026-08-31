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
  // ────────────────────────────────────────────────────────────────────

  test("③ Resume — clicking 继续学习 jumps to saved vocab (no filter)", async ({ page }) => {
    await page.goto("/vocabulary");
    const continueLink = page.getByRole("link", { name: /继续学习/ }).first();
    test.skip(
      !(await continueLink.isVisible().catch(() => false)),
      "No continue card",
    );
    await continueLink.click();
    await expect(page).toHaveURL(/\/vocabulary\/learn/);
    // The learn session should render (not redirect back).
    await expect(page.getByRole("button", { name: /下一个|完成今日/ })).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────────
  // ④ Detail page UI (commit 32119ff)
  // ────────────────────────────────────────────────────────────────────

  test("④ Detail page — 学习记录 section + 开始学习 CTA", async ({ page }) => {
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
    // 开始学习 CTA → /vocabulary/learn?id=<this>
    await expect(
      page.getByRole("link", { name: /开始学习/ }),
    ).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────────
  // ⑤ Idempotency — F5 refresh on /vocabulary/learn does NOT +1
  // (sessionStorage token persists across reload → server RPC PK catches)
  // ────────────────────────────────────────────────────────────────────

  test("⑤ Idempotency — refresh on /vocabulary/learn does not double-count", async ({
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
    const vocabId = page.url().split("/").pop()!;

    await page.goto(`/vocabulary/learn?id=${vocabId}`);

    // LearnSession mounts → startLearningSession RPC → displays "学习次数 N 次".
    // The text takes a moment to appear (RPC round-trip + state set).
    const learningCountText = page.locator("text=/学习次数 \\d+ 次/");
    await learningCountText.waitFor({ state: "visible", timeout: 15_000 });
    const before = Number(
      (await learningCountText.innerText()).match(/\d+/)![0],
    );

    // F5 — same URL, same tab → sessionStorage persists → same token → no +1.
    await page.reload();
    await learningCountText.waitFor({ state: "visible", timeout: 15_000 });
    const afterReload = Number(
      (await learningCountText.innerText()).match(/\d+/)![0],
    );

    expect(afterReload, "F5 should NOT increment learningCount").toBe(before);
  });
});