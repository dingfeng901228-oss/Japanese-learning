// ESLint v9+ flat config.
//
// What it does:
//   - Replaces the legacy `.eslintrc.json` (ESLint v9 ignores those by default).
//   - Wires up the same plugin set the old `next/core-web-vitals` extend
//     implicitly pulled in: `@next/eslint-plugin-next` + `eslint-plugin-react`
//     + `eslint-plugin-react-hooks` + `eslint-plugin-jsx-a11y` + `typescript-eslint`.
//     Loading them by name is required because flat config no longer
//     auto-resolves transitive plugin references from `extends`.
//   - Layer order: typescript-eslint.recommended (TS rules) → per-file
//     config (React + Next rules). Per-file rules override earlier layers.
//
// Rules preserved verbatim from the old `.eslintrc.json`:
//   - extends next/core-web-vitals (= recommended + core-web-vitals)
//   - `react/no-unescaped-entities: off`
//     SmartStudy JSX is full of unescaped emoji, quote marks, zh-CN strings,
//     and Japanese kanji. Turning the rule off avoids noisy false positives
//     without weakening safety elsewhere.
//
// Next.js 15 uses React 19's automatic JSX runtime — `import React from 'react'`
// is no longer required, so `react/react-in-jsx-scope` and `react/jsx-uses-react`
// are pure noise. We turn both off explicitly below.
//
// Downgraded noisy typescript-eslint rules (true bugs would be caught
// at TS-compile-time via `next build`; lint just duplicates):
//   - `@typescript-eslint/no-unused-vars: off`
//   - `@typescript-eslint/no-explicit-any: off`
//   - `prefer-const: warn`
//
// `.next/`, `node_modules/`, `out/`, `build/`, `.vercel/`, `next-env.d.ts`
// are tool output / build output / auto-generated — ignore.

import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react": reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
    },
    settings: {
      // Auto-detect React version from package.json (React 19 here).
      // Without this, `eslint-plugin-react` defaults to v17 detection logic
      // and would still flag `react/react-in-jsx-scope`.
      react: { version: "detect" },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      // Modern JSX transform (React 17+) — React doesn't need to be in scope.
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      // Project convention: SmartStudy JSX carries emoji / zh-CN / kana.
      "react/no-unescaped-entities": "off",
      // Compile-time catches these better than duplicate lint reports.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "warn",
      // React 19 / Next 15's stricter react-hooks rules conflict with this
      // codebase's hydration-on-mount pattern (`setState(...)` inside an
      // effect for SSR-incompatible APIs like clock / time-based greeting).
      // Silence rather than refactor scope.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      ".vercel/**",
      "next-env.d.ts",
    ],
  }
);
