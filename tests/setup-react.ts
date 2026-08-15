// tests/setup-react.ts
//
// Vitest setup file — runs once before any test in this environment.
//
// Marks `globalThis.IS_REACT_ACT_ENVIRONMENT = true` so React 18+'s
// `act()` helper doesn't spam stderr with "The current testing
// environment is not configured to support act(...)" warnings. Required
// for any test that mounts a React component via `react-dom/client`.
//
// Why a setup file (rather than setting it inline in every test):
// - One place to maintain
// - Survives future component tests without each author having to
//   remember the incantation
// - Runs in the test environment's global scope (happy-dom) before the
//   user's `import { act } from "react"` is evaluated.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;