"""Compose emoji-centered achievement badge PNGs (metallic ring + large emoji)."""

from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW_DIR = os.path.join(ROOT, "assets", "achievement_emoji_preview")
OUT_SIZE = 512
DISPLAY_SIZE = 280

BADGES = [
    ("first_class", "初心者", "🌱"),
    ("classes_10", "十步之遥", "👣"),
]

EMOJI_FONTS = [
    r"C:\Windows\Fonts\seguiemj.ttf",
    r"C:\Windows\Fonts\NotoColorEmoji.ttf",
    "/System/Library/Fonts/Apple Color Emoji.ttc",
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
]


def load_emoji_font(size: int) -> ImageFont.FreeTypeFont:
    for path in EMOJI_FONTS:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size, layout_engine=ImageFont.Layout.RAQM)
            except Exception:
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    continue
    raise FileNotFoundError("No emoji font found")


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def draw_metallic_ring(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cx = cy = size // 2
    px = img.load()
    outer_r = size // 2 - 2
    inner_r = int(size * 0.36)

    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist > outer_r:
                continue
            if dist < inner_r:
                # cream inner
                t = dist / inner_r
                r = lerp(252, 245, t)
                g = lerp(250, 240, t)
                b = lerp(245, 232, t)
                px[x, y] = (r, g, b, 255)
                continue
            # metallic ring band
            band_t = (dist - inner_r) / (outer_r - inner_r)
            angle = math.atan2(dy, dx)
            highlight = (math.sin(angle * 2.2 + 0.6) + 1) / 2
            base = 175 + int(45 * highlight)
            shadow = 1 - band_t * 0.35
            metal = int(base * shadow)
            px[x, y] = (metal, metal - 6, metal - 12, 255)

    # inner soft shadow ring
    draw = ImageDraw.Draw(img)
    draw.ellipse(
        (cx - inner_r + 3, cy - inner_r + 3, cx + inner_r - 3, cy + inner_r - 3),
        outline=(0, 0, 0, 18),
        width=3,
    )
    return img


def draw_emoji_badge(emoji: str, size: int = OUT_SIZE) -> Image.Image:
    base = draw_metallic_ring(size)
    font_size = int(size * 0.34)
    font = load_emoji_font(font_size)

    draw = ImageDraw.Draw(base)
    bbox = draw.textbbox((0, 0), emoji, font=font, embedded_color=True)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) // 2 - bbox[0]
    y = (size - th) // 2 - bbox[1] - int(size * 0.02)
    draw.text((x, y), emoji, font=font, embedded_color=True)
    return base


def main() -> None:
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    sheet_w = DISPLAY_SIZE * len(BADGES) + 80
    sheet_h = DISPLAY_SIZE + 100
    sheet = Image.new("RGB", (sheet_w, sheet_h), (247, 245, 240))
    draw = ImageDraw.Draw(sheet)

    for i, (badge_id, label, emoji) in enumerate(BADGES):
        badge = draw_emoji_badge(emoji)
        display = badge.resize((DISPLAY_SIZE, DISPLAY_SIZE), Image.Resampling.LANCZOS)
        path = os.path.join(PREVIEW_DIR, f"badge_{badge_id}_emoji.png")
        display.save(path, "PNG", optimize=True)
        print(f"saved {path}")
        x = 40 + i * DISPLAY_SIZE
        sheet.paste(display, (x, 30), display)
        draw.text((x, DISPLAY_SIZE + 40), f"{label} ({badge_id})", fill=(100, 100, 100))

    sheet_path = os.path.join(PREVIEW_DIR, "preview_emoji_badges.png")
    sheet.save(sheet_path, "PNG", optimize=True)
    print(f"saved {sheet_path}")


if __name__ == "__main__":
    main()
