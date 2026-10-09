#!/usr/bin/env python3
"""Generate static OG image for FastStudy.
Output: public/og.png (1200×630)

Re-run when the headline / accent text changes — the brand assets
live in code, not in someone's Downloads folder.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).parent.parent / "public" / "og.png"
W, H = 1200, 630

# Brand palette — matches globals.css `--color-ink` / page bg gradient.
BG_TOP = (17, 24, 39)      # #111827
BG_BOTTOM = (31, 41, 55)   # #1f2937
INK = (255, 255, 255)
MUTED = (156, 163, 175)    # text-gray-400
SUBTLE = (209, 213, 219)   # text-gray-300

# Three-font setup (PIL has no font fallback):
#   - JP_HEAD = Noto Sans JP for the hero JP text (今日も / 日本語を / 使おう)
#   - SC_BODY = Noto Sans SC for the eyebrow + module labels (中心 / 听力 / 词汇)
#     The JP font has gaps in the Simplified Chinese extension (语 / 学 show
#     as tofu) so we route those strings through the SC font.
#   - EMOJI   = Segoe UI Emoji for the 🎧 / 🎤 / 📚 glyphs (Noto ships
#     monochrome emoji which look out of place next to color text).
JP_HEAD = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
SC_BODY = r"C:\Windows\Fonts\NotoSansSC-VF.ttf"
EMOJI = r"C:\Windows\Fonts\seguiemj.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def main() -> None:
    img = Image.new("RGB", (W, H), BG_TOP)
    # Vertical gradient bg
    for y in range(H):
        t = y / (H - 1)
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        ImageDraw.Draw(img).line([(0, y), (W, y)], fill=(r, g, b))

    draw = ImageDraw.Draw(img)

    # Top eyebrow — SC font covers 中心 cleanly
    draw.text(
        (80, 80),
        "FastStudy  ·  日语学习中心",
        font=font(SC_BODY, 28),
        fill=MUTED,
    )

    # Main headline — JP font for the hero text
    draw.text(
        (80, 145),
        "今日も、日本語を",
        font=font(JP_HEAD, 110),
        fill=INK,
    )
    draw.text(
        (80, 275),
        "使おう。",
        font=font(JP_HEAD, 110),
        fill=INK,
    )

    # Pill row at bottom: emoji glyph + label, measured per-glyph so the
    # · separator spacing doesn't depend on a monospace assumption.
    y0 = 540
    x = 80
    items = [("🎧", "听力"), ("🎤", "口语"), ("📚", "词汇")]
    for i, (glyph, label) in enumerate(items):
        draw.text((x, y0), glyph, font=font(EMOJI, 36), fill=SUBTLE)
        x += int(draw.textlength(glyph, font=font(EMOJI, 36))) + 12
        draw.text((x, y0), label, font=font(SC_BODY, 32), fill=SUBTLE)
        x += int(draw.textlength(label, font=font(SC_BODY, 32))) + 32
        if i < len(items) - 1:
            draw.text((x, y0 + 12), "·", font=font(SC_BODY, 24), fill=MUTED)
            x += int(draw.textlength("·", font=font(SC_BODY, 24))) + 32

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()