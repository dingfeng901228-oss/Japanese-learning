// lib/utils.ts — small shared helpers.
//
// `cn` joins truthy class strings. Used by NavLink.tsx to compose
// Tailwind classes conditionally (e.g. `cn(baseClass, isActive &&
// activeClass)`). No external deps — the rest of the project
// doesn't use clsx / tailwind-merge, so a minimal hand-rolled
// version is enough for our current use case (no class merging
// with conflicts to resolve).

export function cn(
  ...inputs: Array<string | number | false | null | undefined>
): string {
  return inputs.filter(Boolean).join(" ");
}
