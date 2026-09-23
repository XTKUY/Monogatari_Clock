"""Build the editable dial art and the packed, browser-ready dial texture.

Run with a Python that has Pillow. The supplied PNG remains usable without the
font or this script; the SVG is an editable art source.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
SIZE = 4096
CENTER = SIZE // 2
RING_RADIUS = 2002
RING_WIDTH = 16
INK_SIZE = 300
FONT_WEIGHT = 520

# Centers measured from the supplied 1456 x 1242 reference. The design is
# treated as a near-frontal circle centered at (713, 616) with a 463 px dial
# radius. Paired numerals are vertical, as in the reference.
LABELS = [
    ("拾", -0.443, -0.741), ("壹", -0.443, -0.601),  # eleven
    ("拾", 0.000, -0.886), ("貳", 0.000, -0.743),  # twelve
    ("壹", 0.443, -0.743),
    ("貳", 0.754, -0.426),
    ("參", 0.888, 0.000),
    ("肆", 0.754, 0.434),
    ("伍", 0.425, 0.739),
    ("陸", 0.000, 0.866),
    ("柒", -0.421, 0.739),
    ("捌", -0.734, 0.434),
    ("玖", -0.879, 0.000),
    ("拾", -0.747, -0.426),
]

COLORS = {
    "upper_face": "#000000",
    "lower_face": "#f8f7f6",
    "upper_ink": "#b9bbb7",
    "lower_ink": "#20231f",
    "upper_hairline": "#eef0ea",
    "lower_hairline": "#090b09",
}

FONT_CANDIDATES = [
    Path(os.environ.get("CLOCK_FONT_PATH", "/nonexistent")),
    Path.home() / "Library/Fonts/SourceHanSerifSC-VF.ttf",
    Path("/System/Library/Fonts/Supplemental/Songti.ttc"),
]


def load_font() -> tuple[ImageFont.FreeTypeFont, Path]:
    path = next((p for p in FONT_CANDIDATES if p.is_file()), None)
    if path is None:
        raise FileNotFoundError("Set CLOCK_FONT_PATH to a CJK serif font file")
    font = ImageFont.truetype(str(path), INK_SIZE)
    if "SourceHanSerif" in path.name:
        font.set_variation_by_axes([FONT_WEIGHT])
    return font, path


def color(hex_color: str) -> tuple[int, int, int]:
    return tuple(bytes.fromhex(hex_color.removeprefix("#")))


def split_mask(mask: Image.Image, upper: bool) -> Image.Image:
    result = Image.new("L", (SIZE, SIZE), 0)
    box = (0, 0, SIZE, CENTER) if upper else (0, CENTER, SIZE, SIZE)
    result.paste(mask.crop(box), box)
    return result


def make_png(font: ImageFont.FreeTypeFont) -> None:
    dial = Image.new("RGB", (SIZE, SIZE), color(COLORS["lower_face"]))
    ImageDraw.Draw(dial).rectangle((0, 0, SIZE, CENTER - 1), fill=color(COLORS["upper_face"]))

    ring = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(ring).ellipse(
        (CENTER - RING_RADIUS, CENTER - RING_RADIUS,
         CENTER + RING_RADIUS, CENTER + RING_RADIUS),
        outline=255, width=RING_WIDTH,
    )
    dial.paste(color(COLORS["upper_hairline"]), (0, 0), split_mask(ring, True))
    dial.paste(color(COLORS["lower_hairline"]), (0, 0), split_mask(ring, False))

    glyphs = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(glyphs)
    for glyph, x, y in LABELS:
        px, py = CENTER + x * CENTER, CENTER + y * CENTER
        left, top, right, bottom = draw.textbbox((0, 0), glyph, font=font)
        draw.text((round(px - (left + right) / 2), round(py - (top + bottom) / 2)),
                  glyph, font=font, fill=255)
    dial.paste(color(COLORS["upper_ink"]), (0, 0), split_mask(glyphs, True))
    dial.paste(color(COLORS["lower_ink"]), (0, 0), split_mask(glyphs, False))
    dial.save(ART / "dial-4096.png", optimize=True)


def make_svg() -> None:
    # The PNG is the authoritative texture. The SVG preserves editable text,
    # positions, split masks, and circle for later art direction.
    glyphs = "\n".join(
        f'    <text x="{CENTER + x * CENTER:.1f}" y="{CENTER + y * CENTER:.1f}">{glyph}</text>'
        for glyph, x, y in LABELS
    )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}">
  <title>Monogatari clock dial</title>
  <desc>Financial Chinese numerals on a half-black, half-white dial.</desc>
  <defs>
    <clipPath id="upper"><rect width="{SIZE}" height="{CENTER}"/></clipPath>
    <clipPath id="lower"><rect y="{CENTER}" width="{SIZE}" height="{CENTER}"/></clipPath>
    <g id="type" font-family="Source Han Serif SC, Songti SC, serif" font-size="{INK_SIZE}" font-weight="{FONT_WEIGHT}" text-anchor="middle" dominant-baseline="central">
{glyphs}
    </g>
  </defs>
  <rect width="{SIZE}" height="{SIZE}" fill="{COLORS['lower_face']}"/>
  <rect width="{SIZE}" height="{CENTER}" fill="{COLORS['upper_face']}"/>
  <circle cx="{CENTER}" cy="{CENTER}" r="{RING_RADIUS}" fill="none" stroke="{COLORS['upper_hairline']}" stroke-width="{RING_WIDTH}" clip-path="url(#upper)"/>
  <circle cx="{CENTER}" cy="{CENTER}" r="{RING_RADIUS}" fill="none" stroke="{COLORS['lower_hairline']}" stroke-width="{RING_WIDTH}" clip-path="url(#lower)"/>
  <use href="#type" fill="{COLORS['upper_ink']}" clip-path="url(#upper)"/>
  <use href="#type" fill="{COLORS['lower_ink']}" clip-path="url(#lower)"/>
</svg>
'''
    (ART / "dial.svg").write_text(svg, encoding="utf-8")


def main() -> None:
    ART.mkdir(exist_ok=True)
    font, font_path = load_font()
    make_png(font)
    make_svg()
    (ART / "dial-layout.json").write_text(
        json.dumps({
            "reference_center_px": [713, 616],
            "reference_dial_radius_px": 463,
            "texture_size_px": SIZE,
            "font": font_path.name,
            "font_weight": FONT_WEIGHT,
            "ring_radius_px": RING_RADIUS,
            "ring_width_px": RING_WIDTH,
            "labels": [{"glyph": glyph, "x": x, "y": y} for glyph, x, y in LABELS],
            "colors": COLORS,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    print(f"Wrote dial art to {ART}")


if __name__ == "__main__":
    main()
