"""
Generate the dark-theme CSS layer.

Audit 2026-11-16 P1-15: "深色模式". The site paints every surface with
plain Tailwind utilities (bg-white, text-gray-900, border-gray-200) in
a few hundred places, so adding `dark:` variants to every component is
a huge, error-prone diff.

Instead this script SCANS the source for the colour utilities that are
actually used and emits a remap layer: in dark mode, `bg-white`
becomes the dark surface, `text-gray-900` becomes the light text, and
so on. Every variant that the source uses (hover:, focus:, active:,
disabled:hover:, ...) is emitted too, because the same remap has to
apply when the state is active.

Run: python gen-dark-theme.py [--check]
Then: the output is appended to app/globals.css
"""

import re
import sys
from pathlib import Path

REPO = Path("F:/WebSite/Japanese-learning")
OUT = REPO / "app/globals.css"

# --- the dark palette -------------------------------------------------
# A single inverted ramp cannot serve both text and backgrounds: the
# text ramp goes light as the number goes up, the background ramp goes
# DARKER as the number goes up (bg-gray-900 is the darkest surface in
# light mode and must stay dark in dark mode). So there are three
# tables, one per property.
#
# Grays, for TEXT (light mode: dark on light -> dark mode: light on dark)
TEXT_GRAY = {
    "gray-50": "#4b5563",
    "gray-100": "#6b7280",
    "gray-200": "#9ca3af",
    "gray-300": "#9ca3af",
    "gray-400": "#d1d5db",
    "gray-500": "#d1d5db",
    "gray-600": "#e5e7eb",
    "gray-700": "#f3f4f6",
    "gray-800": "#f9fafb",
    "gray-900": "#f9fafb",
}

# Grays, for BACKGROUNDS (the ramp keeps its direction, just darker)
BG_GRAY = {
    "gray-50": "#111827",
    "gray-100": "#1f2937",
    "gray-200": "#273449",
    "gray-300": "#374151",
    "gray-400": "#4b5563",
    "gray-500": "#4b5563",
    "gray-600": "#374151",
    "gray-700": "#374151",
    "gray-800": "#1f2937",
    "gray-900": "#0b1220",
}

# Grays, for BORDERS
BORDER_GRAY = {
    "gray-50": "#273449",
    "gray-100": "#273449",
    "gray-200": "#374151",
    "gray-300": "#4b5563",
    "gray-400": "#6b7280",
    "gray-500": "#6b7280",
    "gray-600": "#4b5563",
    "gray-700": "#4b5563",
    "gray-900": "#374151",
}

# The design tokens from tailwind.config.ts
TOKEN_TEXT = {
    "ink": "#f9fafb",
    "ink-700": "#d1d5db",
    "ink-500": "#9ca3af",
}
TOKEN_BG = {
    "ink": "#0b1220",
    "soft": "#111827",
    "line": "#1f2937",
}
TOKEN_BORDER = {
    "line": "#374151",
    "ink": "#374151",
}

# Accent colours: the light background becomes a deep tint, the dark
# text becomes a light tint.
ACCENT_TEXT = {
    "blue": {600: "#93c5fd", 700: "#bfdbfe", 500: "#60a5fa"},
    "emerald": {600: "#6ee7b7", 700: "#a7f3d0", 500: "#34d399"},
    "amber": {600: "#fcd34d", 700: "#fde68a", 500: "#fbbf24"},
    "red": {600: "#fca5a5", 700: "#fecaca", 500: "#f87171"},
    "pink": {600: "#f9a8d4", 700: "#fbcfe8"},
    "purple": {600: "#c4b5fd", 700: "#ddd6fe"},
    "yellow": {600: "#fde047", 700: "#fef08a"},
}
ACCENT_BG = {
    "blue": {50: "#172554", 100: "#1e3a8a", 200: "#1e40af", 500: "#1d4ed8", 600: "#1e40af"},
    "emerald": {50: "#052e16", 100: "#064e3b", 200: "#065f46", 500: "#047857"},
    "amber": {50: "#451a03", 100: "#78350f", 200: "#92400e", 500: "#b45309"},
    "red": {50: "#450a0a", 100: "#7f1d1d", 200: "#991b1b", 500: "#b91c1c"},
    "pink": {50: "#500724", 100: "#831843", 600: "#831843"},
    "purple": {50: "#2e1065", 100: "#4c1d95"},
    "yellow": {50: "#422006", 100: "#713f12"},
}
ACCENT_BORDER = {
    "blue": {200: "#1e40af", 300: "#60a5fa"},
    "emerald": {200: "#065f46", 300: "#34d399"},
    "amber": {200: "#92400e", 300: "#fbbf24"},
    "red": {200: "#991b1b", 300: "#f87171"},
    "gray": {200: "#374151", 300: "#4b5563"},
}

# Flat colours (no shade)
FLAT = {
    "white": "#111827",
    "black": "#f9fafb",
    "accent": "#60a5fa",
    "success": "#4ade80",
    "streak": "#f9a8d4",
    "transparent": "transparent",
}


def palette_for(prop: str, colour: str) -> str | None:
    """The dark-mode colour for a utility, or None if it is not a colour."""
    if colour in FLAT:
        return FLAT[colour]
    if "-" in colour:
        name, _, shade = colour.partition("-")
        shade_i = int(shade) if shade.isdigit() else None
        if prop == "text":
            if name == "gray":
                return TEXT_GRAY.get(colour)
            if name == "ink":
                return TOKEN_TEXT.get(colour)
            table = ACCENT_TEXT.get(name)
            if table and shade_i is not None:
                return table.get(shade_i)
        elif prop == "bg":
            if name == "gray":
                return BG_GRAY.get(colour)
            if name in TOKEN_BG:
                return TOKEN_BG[name]
            table = ACCENT_BG.get(name)
            if table and shade_i is not None:
                return table.get(shade_i)
        elif prop == "border":
            if name == "gray":
                return BORDER_GRAY.get(colour)
            if name == "line" or name == "ink":
                return TOKEN_BORDER.get(name)
            table = ACCENT_BORDER.get(name)
            if table and shade_i is not None:
                return table.get(shade_i)
        elif prop in ("fill", "stroke"):
            table = ACCENT_TEXT.get(name)
            if table and shade_i is not None:
                return table.get(shade_i)
    return None


# which CSS property each colour utility drives
PROP = {
    "bg": "background-color",
    "text": "color",
    "border": "border-color",
    "ring": "--tw-ring-color",
    "fill": "fill",
    "stroke": "stroke",
    "from": "--tw-gradient-from",
    "to": "--tw-gradient-to",
    "via": "--tw-gradient-via",
    "divide": "border-color",
    "decoration": "text-decoration-color",
    "shadow": "--tw-shadow-color",
    "outline": "outline-color",
    "accent": "accent-color",
    "caret": "caret-color",
}

TOKEN_RE = re.compile(
    r"(?<![\w-])((?:[a-z-]+:)*)(bg|text|border|ring|fill|stroke|from|to|via|divide|decoration|shadow|outline|accent|caret)-"
    r"([a-z]+(?:-[0-9]+)?)(?![\w-])"
)


def collect_tokens() -> set:
    tokens = set()
    for path in list(REPO.glob("app/**/*.tsx")) + list(
        REPO.glob("components/**/*.tsx")
    ):
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            continue
        for m in TOKEN_RE.finditer(text):
            variants, prop, colour = m.group(1), m.group(2), m.group(3)
            if palette_for(prop, colour) is None:
                continue
            # Only variants that can be expressed as a CSS pseudo-class
            # on the element itself. Responsive prefixes (sm:, md:) are
            # media queries and group-/peer- variants need the parent
            # state — both are skipped.
            allowed = {
                "hover", "focus", "focus-visible", "focus-within",
                "active", "visited", "disabled",
            }
            parts = [v for v in variants.rstrip(":").split(":") if v]
            if any(v not in allowed for v in parts):
                continue
            tokens.add((variants, prop, colour))
    return tokens


def css_for(variants: str, prop: str, colour: str) -> str:
    """Build one CSS rule for a utility, honouring its variants."""
    value = palette_for(prop, colour)
    if value is None:
        return ""
    prop_name = PROP[prop]

    # The escaped class selector: "hover:bg-gray-50" becomes
    # ".hover\\:bg-gray-50" (Tailwind escapes the colon).
    escaped = f"{prop}-{colour}"
    if variants:
        parts = variants.rstrip(":").split(":")
        escaped = ":".join(parts) + ":" + escaped
    rule = ".dark ." + escaped.replace(":", "\\:")

    # The state part of the selector.
    if variants:
        for v in variants.rstrip(":").split(":"):
            if v in ("hover", "focus", "focus-visible", "focus-within", "active", "visited"):
                rule += f":{v}"
            elif v == "disabled":
                rule += ":disabled"
    return f"  {rule} {{ {prop_name}: {value}; }}"


def main() -> int:
    tokens = collect_tokens()
    print(f"{len(tokens)} colour utilities in use")

    lines = [
        "",
        "/* ============================================================",
        "   Dark mode (audit 2026-11-16 P1-15)",
        "",
        "   The site paints its surfaces with plain Tailwind colour",
        "   utilities in a few hundred places. Rather than adding a",
        "   `dark:` variant to every one of them, this layer remaps the",
        "   palette: with .dark on <html>, `bg-white` becomes the dark",
        "   surface and `text-gray-900` becomes the light text.",
        "",
        "   Generated by scripts/gen-dark-theme.py from the classes the",
        "   source actually uses - do not hand-edit; re-run it after",
        "   adding new colour utilities.",
        "   ============================================================ */",
        "",
    ]

    by_variant: dict = {}
    for variants, prop, colour in sorted(tokens):
        by_variant.setdefault((variants, prop), []).append(colour)

    for (variants, prop), colours in sorted(by_variant.items()):
        for colour in colours:
            rule = css_for(variants, prop, colour)
            if rule:
                lines.append(rule)

    lines.append("")
    block = "\n".join(lines)

    existing = OUT.read_text(encoding="utf-8")
    marker = "   Dark mode (audit 2026-11-16 P1-15)"
    if marker in existing:
        start = existing.index("/* ============================================================\n   Dark mode")
        # cut the old block (up to the end of the file's dark section)
        existing = existing[:start].rstrip() + "\n"
        print("replacing the old dark block")

    if "--check" in sys.argv:
        print(block[:4000])
        print(f"\n... total {len(block)} chars")
        return 0

    OUT.write_text(existing + block, encoding="utf-8", newline="\n")
    print(f"appended {len(block)} chars to app/globals.css")
    return 0


if __name__ == "__main__":
    sys.exit(main())
