"""Resize AI-generated achievement assets and copy to miniprogram/images/achievement/."""

from __future__ import annotations

import os
import shutil

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(
    os.path.expanduser("~"),
    ".cursor",
    "projects",
    "c-Pari-Project-test-Yoga",
    "assets",
)
OUT_DIR = os.path.join(ROOT, "miniprogram", "images", "achievement")
PREVIEW_DIR = os.path.join(ROOT, "assets", "achievement_preview")

BADGE_SIZE = 280
HERO_SIZE = (1500, 600)

BADGES = [
    "first_class",
    "classes_10",
    "classes_30",
    "classes_50",
    "classes_100",
    "classes_200",
    "streak_4",
    "streak_8",
    "streak_12",
    "streak_24",
    "streak_max_12",
]


def resolve_src_dir() -> str:
    if os.path.isdir(SRC_DIR) and os.path.isfile(os.path.join(SRC_DIR, "badge_first_class.png")):
        return SRC_DIR
    alt = os.path.join(ROOT, "assets")
    if os.path.isdir(alt) and os.path.isfile(os.path.join(alt, "badge_first_class.png")):
        return alt
    raise FileNotFoundError("AI badge assets not found in assets folder")


def center_crop_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def remove_square_black_bg(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r < 24 and g < 24 and b < 24:
                px[x, y] = (r, g, b, 0)
    return rgba


def process_badge(src_path: str, out_path: str) -> None:
    img = Image.open(src_path)
    img = remove_square_black_bg(img)
    square = center_crop_square(img)
    resized = square.resize((BADGE_SIZE, BADGE_SIZE), Image.Resampling.LANCZOS)
    resized.save(out_path, "PNG", optimize=True)
    print(f"badge -> {out_path} ({resized.size})")


def process_hero(src_path: str, out_path: str) -> None:
    img = Image.open(src_path).convert("RGB")
    resized = img.resize(HERO_SIZE, Image.Resampling.LANCZOS)
    resized.save(out_path, "PNG", optimize=True)
    print(f"hero -> {out_path} ({resized.size})")


def make_preview(out_dir: str, preview_path: str) -> None:
    from PIL import ImageDraw

    cols = 4
    pad = 30
    label_h = 28
    cell = BADGE_SIZE + label_h + 16
    rows = (len(BADGES) + cols - 1) // cols
    hero_thumb_h = 240
    sheet_w = pad * 2 + cols * cell
    sheet_h = pad + hero_thumb_h + 30 + rows * cell + pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), (247, 245, 240))
    draw = ImageDraw.Draw(sheet)

    hero_path = os.path.join(out_dir, "hero_illustration.png")
    if os.path.isfile(hero_path):
        hero = Image.open(hero_path).convert("RGB")
        thumb = hero.resize((sheet_w - pad * 2, hero_thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (pad, pad))

    y0 = pad + hero_thumb_h + 30
    for idx, badge_id in enumerate(BADGES):
        col = idx % cols
        row = idx // cols
        path = os.path.join(out_dir, f"badge_{badge_id}.png")
        badge = Image.open(path).convert("RGBA")
        x = pad + col * cell + (cell - BADGE_SIZE) // 2
        y = y0 + row * cell
        sheet.paste(badge, (x, y), badge)
        draw.text((x, y + BADGE_SIZE + 4), badge_id, fill=(120, 120, 120))

    sheet.save(preview_path, "PNG", optimize=True)
    print(f"preview -> {preview_path}")


def main() -> None:
    src = resolve_src_dir()
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)

    for badge_id in BADGES:
        src_path = os.path.join(src, f"badge_{badge_id}.png")
        out_path = os.path.join(OUT_DIR, f"badge_{badge_id}.png")
        process_badge(src_path, out_path)
        shutil.copy2(out_path, os.path.join(PREVIEW_DIR, f"badge_{badge_id}.png"))

    hero_src = os.path.join(src, "hero_illustration.png")
    hero_out = os.path.join(OUT_DIR, "hero_illustration.png")
    process_hero(hero_src, hero_out)
    shutil.copy2(hero_out, os.path.join(PREVIEW_DIR, "hero_illustration.png"))

    make_preview(OUT_DIR, os.path.join(PREVIEW_DIR, "preview_sheet_v2.png"))
    print("done")


if __name__ == "__main__":
    main()
