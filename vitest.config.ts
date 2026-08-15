// Vitest config — local test runner for Japanese-learning.
//
// Lives at the project root so `npm test` works without arguments. The
// `path` alias `@` mirrors tsconfig.json's `"@/*": ["./*"]` so tests
// can `@/lib/...` import the same way app code does.
//
// env: happy-dom — lighter than jsdom and sufficient for our pure-logic
// tests (lib/grade-types, lib/mistake-storage). If we later add tests
// that need full DOM APIs (CSSOM, layout, etc.), swap to jsdom per-file
// via `// @vitest-environment jsdom`.
//
// coverage scope: lib/** + app/api/**. The route handlers themselves
// are excluded — they exercise I/O (OpenAI, Supabase) that belongs in
// integration tests, not unit tests.
//
// globals: true — `describe` / `it` / `expect` available without import.
// We still import them in test files (Vitest-style explicit imports)
// because that's what the framework docs use, but globals gives IDE
// tooling a freebie if someone forgets.

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "app/api/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/*.test.ts", "**/route.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});