"""Compress achievement hero illustration for miniprogram bundle size."""

from __future__ import annotations

import io
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PNG = os.path.join(ROOT, "miniprogram", "images", "achievement", "hero_illustration.png")
OUT_JPG = os.path.join(ROOT, "miniprogram", "images", "achievement", "hero_illustration.jpg")
TARGET_KB = 80


def save_jpg_near_target(img: Image.Image, path: str, target_bytes: int) -> tuple[int, int]:
    best: tuple[int, int] | None = None
    best_data: bytes | None = None
    for quality in range(92, 58, -2):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
        size = buf.tell()
        if best is None or abs(size - target_bytes) < abs(best[0] - target_bytes):
            best = (size, quality)
            best_data = buf.getvalue()
    assert best_data is not None and best is not None
    with open(path, "wb") as f:
        f.write(best_data)
    return best


def main() -> None:
    img = Image.open(SRC_PNG).convert("RGB")
    size, quality = save_jpg_near_target(img, OUT_JPG, TARGET_KB * 1024)
    png_kb = os.path.getsize(SRC_PNG) / 1024
    print(f"png {png_kb:.1f} KB -> jpg {size/1024:.1f} KB (q={quality})")
    print(f"saved {OUT_JPG}")


if __name__ == "__main__":
    main()
