// Playwright config for FastStudy e2e smoke tests (Frank #7445 / #7446).
//
// Usage:
//   - Local dev:  npm run dev  (separate terminal) →  npm run test:e2e
//   - Deployed:   BASE_URL=https://<host>  npm run test:e2e
//
// Auth state: tests/e2e/auth.json — Frank exports once from a logged-in browser:
//   npx playwright codegen $BASE_URL --save-storage=tests/e2e/auth.json
// (sign in via the codegen browser, save, done.)
//
// Browser install (one-time):
//   npx playwright install chromium
// (only chromium — Frank's primary dev target. Firefox/WebKit can be added
// to the projects[] list when needed.)

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30 * 1000,
  expect: { timeout: 5 * 1000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Frank #7446 only asked for the smoke test, not cross-browser.
    // Add `firefox` + `webkit` here when parity testing matters.
  ],

  // Auto-spawn `npm run dev` if no BASE_URL is set (i.e., local dev).
  // When BASE_URL is provided, assume the server is already running
  // (CI, deployed preview, or Frank's manual start).
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !CI,
        timeout: 120 * 1000,
        stdout: "pipe",
        stderr: "pipe",
      },
});