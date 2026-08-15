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
//
// esbuild.jsx: "automatic" — matches Next.js's React 17+ JSX transform
// so client components (e.g. components/ui/tooltip.tsx) can use `<X />`
// without an explicit `import React from "react"`. Without this, Vitest
// throws `ReferenceError: React is not defined` the moment a test mounts
// a component.
//
// setupFiles: tests/setup-react.ts — sets `IS_REACT_ACT_ENVIRONMENT = true`
// so React 18+'s `act()` helper stops warning about the missing global
// (otherwise every `act(() => root.render(...))` in a component test
// spams stderr with "The current testing environment is not configured
// to support act(...)").

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup-react.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "app/api/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/*.test.ts", "**/route.ts"],
    },
  },
  esbuild: {
    // JSX transform for component tests (e.g. components/ui/tooltip.tsx).
    // Vitest uses esbuild internally; `automatic` matches Next.js's
    // React 17+ transform so client components can use `<X />` without
    // an explicit `import React from "react"`.
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});