"""
Generate F13 achievement visual assets (plans/f13-checkin-achievement.md §7–8).

Outputs:
  - hero_illustration.png   1500×600 (@2x of 750×300 rpx)
  - badge_<id>.png           280×280 (@2x of 140 rpx)
  - preview_sheet.png       overview for review
"""

from __future__ import annotations

import math
import os
from typing import Callable

from PIL import Image, ImageDraw

THEME = (111, 174, 150)  # #6fae96
THEME_DARK = (94, 148, 127)
THEME_LIGHT = (168, 210, 190)
BG_WARM = (247, 245, 240)  # #F7F5F0
WHITE = (255, 255, 255)
ACCENT_WARM = (232, 196, 160)

BADGE_SIZE = 280
HERO_W, HERO_H = 1500, 600
STROKE = 5

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW_DIR = os.path.join(ROOT, "assets", "achievement_preview")
OUT_DIR = os.path.join(ROOT, "miniprogram", "images", "achievement")

BADGES: list[tuple[str, str]] = [
    ("first_class", "初心者"),
    ("classes_10", "十步之遥"),
    ("classes_30", "月度常客"),
    ("classes_50", "稳定修行"),
    ("classes_100", "百课不倦"),
    ("classes_200", "瑜伽深耕"),
    ("streak_4", "月月不断"),
    ("streak_8", "习惯养成"),
    ("streak_12", "季度达人"),
    ("streak_24", "半年坚守"),
    ("streak_max_12", "最长记录"),
]


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def lerp_rgb(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)


def radial_gradient_circle(size: int, inner: tuple[int, int, int], outer: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cx = cy = size // 2
    max_r = size // 2
    px = img.load()
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist > max_r:
                continue
            t = min(1.0, dist / max_r)
            color = lerp_rgb(inner, outer, t)
            px[x, y] = (*color, 255)
    return img


def draw_stroke_line(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], width: int = STROKE) -> None:
    if len(pts) < 2:
        return
    int_pts = [(int(round(x)), int(round(y))) for x, y in pts]
    draw.line(int_pts, fill=WHITE, width=width)


def draw_stroke_ellipse(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    width: int = STROKE,
) -> None:
    draw.ellipse(box, outline=WHITE, width=width)


def draw_stroke_arc(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    start: float,
    end: float,
    width: int = STROKE,
) -> None:
    draw.arc(box, start=start, end=end, fill=WHITE, width=width)


def icon_first_class(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    stem_top = cy + s * 0.15
    stem_bot = cy + s * 0.42
    draw_stroke_line(draw, [(cx, stem_bot), (cx, stem_top)], width=6)
    leaf_w, leaf_h = s * 0.22, s * 0.14
    draw_stroke_ellipse(draw, (cx - leaf_w - 4, stem_top - leaf_h, cx - 4, stem_top + leaf_h))
    draw_stroke_ellipse(draw, (cx + 4, stem_top - leaf_h * 0.8, cx + leaf_w + 4, stem_top + leaf_h * 0.6))
    draw.ellipse((cx - 6, stem_top - 10, cx + 6, stem_top + 2), fill=WHITE)


def icon_classes_10(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    fw, fh = s * 0.18, s * 0.28
    left = (cx - s * 0.28, cy - fh * 0.2, cx - s * 0.28 + fw, cy - fh * 0.2 + fh)
    right = (cx + s * 0.08, cy + fh * 0.05, cx + s * 0.08 + fw, cy + fh * 0.05 + fh)
    draw_stroke_ellipse(draw, left)
    draw_stroke_ellipse(draw, right)
    for bx in (left[0] + fw * 0.3, left[0] + fw * 0.7, right[0] + fw * 0.35, right[0] + fw * 0.65):
        by = left[1] + fh * 0.55 if bx < cx else right[1] + fh * 0.55
        draw.ellipse((bx - 4, by - 4, bx + 4, by + 4), fill=WHITE)


def icon_classes_30(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    r = s * 0.28
    draw_stroke_arc(draw, (cx - r, cy - r, cx + r, cy + r), 300, 120, width=6)
    for dx, dy in ((-s * 0.32, -s * 0.18), (s * 0.34, -s * 0.08), (s * 0.2, s * 0.28)):
        draw.ellipse((cx + dx - 5, cy + dy - 5, cx + dx + 5, cy + dy + 5), fill=WHITE)


def icon_classes_50(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    base_y = cy + s * 0.25
    for i, spread in enumerate((-0.22, 0, 0.22)):
        x = cx + s * spread
        draw_stroke_arc(draw, (x - s * 0.16, base_y - s * 0.35, x + s * 0.16, base_y + s * 0.05), 200, 340, width=5)
    draw_stroke_line(draw, [(cx - s * 0.3, base_y), (cx + s * 0.3, base_y)], width=4)


def icon_classes_100(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    glow_r = s * 0.34
    draw.ellipse(
        (cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r),
        outline=(255, 255, 255, 120),
        width=3,
    )
    for deg in range(0, 360, 60):
        rad = math.radians(deg - 90)
        x = cx + math.cos(rad) * s * 0.08
        y = cy + math.sin(rad) * s * 0.08
        draw_stroke_arc(
            draw,
            (x - s * 0.2, y - s * 0.28, x + s * 0.2, y + s * 0.12),
            200,
            340,
            width=4,
        )
    draw.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=WHITE)


def icon_classes_200(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    base_y = cy + s * 0.3
    segments = [
        [(cx - s * 0.34, base_y), (cx - s * 0.12, cy - s * 0.22), (cx - s * 0.04, base_y)],
        [(cx - s * 0.14, base_y), (cx + s * 0.02, cy - s * 0.34), (cx + s * 0.1, base_y)],
        [(cx + s * 0.12, base_y), (cx + s * 0.36, cy - s * 0.26), (cx + s * 0.44, base_y)],
    ]
    for seg in segments:
        draw_stroke_line(draw, seg, width=5)
    draw_stroke_line(draw, [(cx - s * 0.38, base_y), (cx + s * 0.48, base_y)], width=4)


def icon_streak_4(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    r = s * 0.24
    for deg in (45, 135, 225, 315):
        rad = math.radians(deg)
        x = cx + math.cos(rad) * r
        y = cy + math.sin(rad) * r
        draw_stroke_ellipse(draw, (x - 18, y - 10, x + 18, y + 10))


def icon_streak_8(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    pts = []
    for t in range(0, 101, 5):
        tt = t / 100
        x = cx - s * 0.28 + tt * s * 0.56
        y = cy + math.sin(tt * math.pi * 2) * s * 0.22
        pts.append((x, y))
    draw_stroke_line(draw, pts, width=5)
    for t in (0.2, 0.45, 0.7, 0.9):
        x = cx - s * 0.28 + t * s * 0.56
        y = cy + math.sin(t * math.pi * 2) * s * 0.22
        draw_stroke_ellipse(draw, (x - 12, y - 8, x + 12, y + 8), width=3)


def icon_streak_12(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    r = s * 0.14
    draw.ellipse((cx - r, cy - r - s * 0.05, cx + r, cy + r - s * 0.05), outline=WHITE, width=6)
    for deg in range(0, 360, 45):
        rad = math.radians(deg)
        x1 = cx + math.cos(rad) * (r + 4)
        y1 = cy - s * 0.05 + math.sin(rad) * (r + 4)
        x2 = cx + math.cos(rad) * (r + 14)
        y2 = cy - s * 0.05 + math.sin(rad) * (r + 14)
        draw_stroke_line(draw, [(x1, y1), (x2, y2)], width=3)
    arc_r = s * 0.3
    draw_stroke_arc(draw, (cx - arc_r, cy - arc_r, cx + arc_r, cy + arc_r), 200, 340, width=5)


def icon_streak_24(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    top_y = cy - s * 0.28
    mid_y = cy + s * 0.02
    bot_y = cy + s * 0.3
    w = s * 0.22
    draw_stroke_line(draw, [(cx - w, top_y), (cx + w, top_y), (cx, mid_y), (cx - w, bot_y), (cx + w, bot_y)], width=5)
    draw_stroke_line(draw, [(cx - w * 0.55, mid_y - s * 0.06), (cx + w * 0.55, mid_y - s * 0.06)], width=4)
    sand_y = mid_y + s * 0.04
    draw.ellipse((cx - 8, sand_y - 4, cx + 8, sand_y + 4), fill=WHITE)
    draw.ellipse((cx - 6, bot_y - s * 0.12, cx + 6, bot_y - s * 0.04), fill=WHITE)


def icon_streak_max_12(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    base_y = cy + s * 0.28
    left_x = cx - s * 0.3
    pts = [
        (left_x, base_y),
        (left_x + s * 0.18, cy + s * 0.08),
        (left_x + s * 0.34, cy + s * 0.14),
        (left_x + s * 0.52, cy - s * 0.18),
        (left_x + s * 0.62, cy - s * 0.24),
    ]
    draw_stroke_line(draw, pts, width=5)
    for px, py in pts[1:]:
        draw.ellipse((px - 6, py - 6, px + 6, py + 6), fill=WHITE)
    draw_stroke_line(draw, [(left_x, base_y), (left_x + s * 0.62, base_y)], width=4)


ICON_DRAWERS: dict[str, Callable[[ImageDraw.ImageDraw, int, int, int], None]] = {
    "first_class": icon_first_class,
    "classes_10": icon_classes_10,
    "classes_30": icon_classes_30,
    "classes_50": icon_classes_50,
    "classes_100": icon_classes_100,
    "classes_200": icon_classes_200,
    "streak_4": icon_streak_4,
    "streak_8": icon_streak_8,
    "streak_12": icon_streak_12,
    "streak_24": icon_streak_24,
    "streak_max_12": icon_streak_max_12,
}


def make_badge(badge_id: str, unlocked: bool = True) -> Image.Image:
    size = BADGE_SIZE
    if unlocked:
        base = radial_gradient_circle(size, THEME, THEME_DARK)
    else:
        base = Image.new("RGBA", (size, size), GRAY_LOCKED + (255,))
        mask = Image.new("L", (size, size), 0)
        md = ImageDraw.Draw(mask)
        md.ellipse((2, 2, size - 2, size - 2), fill=255)
        base.putalpha(mask)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(base)

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx = cy = size // 2
    icon_size = int(size * 0.62)
    ICON_DRAWERS[badge_id](draw, cx, cy, icon_size)
    canvas.alpha_composite(overlay)

    # subtle inner ring
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse((6, 6, size - 6, size - 6), outline=(255, 255, 255, 60), width=2)
    canvas.alpha_composite(ring)
    return canvas


def make_hero() -> Image.Image:
    img = Image.new("RGB", (HERO_W, HERO_H), BG_WARM)
    px = img.load()
    for y in range(HERO_H):
        t = y / (HERO_H - 1)
        top = lerp_rgb(THEME_LIGHT, THEME, min(1.0, t * 1.4))
        bottom = lerp_rgb(top, BG_WARM, max(0.0, (t - 0.45) / 0.55))
        for x in range(HERO_W):
            px[x, y] = bottom

    draw = ImageDraw.Draw(img, "RGBA")

    # distant mountains
    mountain_color = (255, 255, 255, 45)
    peaks = [
        [(0, HERO_H), (180, 280), (420, HERO_H)],
        [(260, HERO_H), (520, 220), (820, HERO_H)],
        [(640, HERO_H), (980, 250), (1300, HERO_H)],
    ]
    for peak in peaks:
        draw.polygon(peak, fill=mountain_color)

    # lotus silhouette left
    lx, ly = 360, 360
    for spread in (-80, -30, 20, 70):
        draw.pieslice((lx + spread - 50, ly - 90, lx + spread + 50, ly + 30), 200, 340, fill=(255, 255, 255, 35))

    # decorative dots
    for dx, dy, r in ((120, 90, 10), (200, 140, 6), (260, 70, 8), (90, 180, 5)):
        draw.ellipse((dx - r, dy - r, dx + r, dy + r), fill=(255, 255, 255, 90))

    # yoga figure right — minimal warrior II silhouette
    fx = 1120
    fy = 430
    draw.rounded_rectangle((fx - 18, fy - 150, fx + 18, fy + 20), radius=18, fill=(255, 255, 255, 200))
    draw.ellipse((fx - 34, fy - 195, fx + 34, fy - 127), fill=(255, 255, 255, 220))
    draw.line([(fx - 90, fy - 70), (fx + 95, fy - 55)], fill=(255, 255, 255, 230), width=10)
    draw.line([(fx, fy - 40), (fx - 55, fy + 35)], fill=(255, 255, 255, 230), width=10)
    draw.line([(fx, fy - 40), (fx + 70, fy + 30)], fill=(255, 255, 255, 230), width=10)
    draw.line([(fx - 10, fy + 20), (fx - 35, fy + 110)], fill=(255, 255, 255, 230), width=10)
    draw.line([(fx + 10, fy + 20), (fx + 55, fy + 105)], fill=(255, 255, 255, 230), width=10)

    # bottom fade to page background
    fade = Image.new("RGBA", (HERO_W, HERO_H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fade)
    for y in range(HERO_H - 120, HERO_H):
        alpha = int(255 * (y - (HERO_H - 120)) / 120)
        fd.line([(0, y), (HERO_W, y)], fill=(*BG_WARM, alpha))
    img = Image.alpha_composite(img.convert("RGBA"), fade).convert("RGB")
    return img


def make_preview_sheet(hero: Image.Image, badges: dict[str, Image.Image]) -> Image.Image:
    cols = 4
    rows = math.ceil(len(BADGES) / cols)
    pad = 40
    label_h = 36
    cell = BADGE_SIZE + label_h + 20
    sheet_w = pad * 2 + cols * cell
    sheet_h = pad + HERO_H // 2 + 40 + pad + rows * cell + pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG_WARM)
    draw = ImageDraw.Draw(sheet)

    hero_thumb = hero.resize((sheet_w - pad * 2, HERO_H // 2), Image.Resampling.LANCZOS)
    sheet.paste(hero_thumb, (pad, pad))
    draw.text((pad, pad + HERO_H // 2 + 8), "hero_illustration.png · 1500×600", fill=(44, 44, 44))

    y0 = pad + HERO_H // 2 + 40
    for idx, (badge_id, label) in enumerate(BADGES):
        col = idx % cols
        row = idx // cols
        x = pad + col * cell + (cell - BADGE_SIZE) // 2
        y = y0 + row * cell
        sheet.paste(badges[badge_id], (x, y), badges[badge_id])
        draw.text((x - 10, y + BADGE_SIZE + 6), label, fill=(136, 136, 136))
        draw.text((x - 10, y + BADGE_SIZE + 22), badge_id, fill=(170, 170, 170))

    return sheet


def save_all(target_dir: str) -> None:
    os.makedirs(target_dir, exist_ok=True)
    hero = make_hero()
    hero_path = os.path.join(target_dir, "hero_illustration.png")
    hero.save(hero_path, "PNG", optimize=True)
    print(f"saved {hero_path} {hero.size}")

    badges: dict[str, Image.Image] = {}
    for badge_id, _ in BADGES:
        badge = make_badge(badge_id, unlocked=True)
        badges[badge_id] = badge
        path = os.path.join(target_dir, f"badge_{badge_id}.png")
        badge.save(path, "PNG", optimize=True)
        print(f"saved {path}")

    preview = make_preview_sheet(hero, badges)
    preview_path = os.path.join(target_dir, "preview_sheet.png")
    preview.save(preview_path, "PNG", optimize=True)
    print(f"saved {preview_path} {preview.size}")


def main() -> None:
    save_all(PREVIEW_DIR)
    save_all(OUT_DIR)
    print(f"\nPreview: {PREVIEW_DIR}")
    print(f"Production: {OUT_DIR}")


if __name__ == "__main__":
    main()
