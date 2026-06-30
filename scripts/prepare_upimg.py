"""从 default_index_bg 同风格预览图导出「我的」页头图 upimg.jpg。"""
from PIL import Image, ImageEnhance
import io
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSET_DIRS = [
    os.path.join(ROOT, "assets"),
    os.path.join(
        os.path.expanduser("~"),
        ".cursor",
        "projects",
        "c-Pari-Project-test-Yoga",
        "assets",
    ),
]
SRC_NAMES = ["upimg_preview_v3.png"]
OUT = os.path.join(ROOT, "miniprogram", "pages", "default", "skin", "images", "upimg.jpg")
TARGET_W, TARGET_H = 1000, 570
# 略放大后右移裁切，让人物更靠右
CROP_ZOOM = 1.12
CROP_SHIFT_X = 0.14
# 「我的」页头图略提亮（仅 upimg，不影响教练端）
BRIGHTNESS = 1.1
COLOR = 1.05


def brighten(img: Image.Image) -> Image.Image:
    out = ImageEnhance.Brightness(img).enhance(BRIGHTNESS)
    return ImageEnhance.Color(out).enhance(COLOR)


def export_cover(src_path: str, out_path: str) -> None:
    im = Image.open(src_path).convert("RGB")
    sw, sh = im.size
    scale = max(TARGET_W / sw, TARGET_H / sh) * CROP_ZOOM
    nw, nh = int(round(sw * scale)), int(round(sh * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TARGET_W) // 2 + int((nw - TARGET_W) * CROP_SHIFT_X)
    left = max(0, min(left, nw - TARGET_W))
    top = max(0, min((nh - TARGET_H) // 2, nh - TARGET_H))
    cropped = resized.crop((left, top, left + TARGET_W, top + TARGET_H))
    cropped = brighten(cropped)

    if os.path.isfile(out_path):
        shutil.copy2(out_path, out_path + ".bak")
    best = None
    for q in range(92, 64, -4):
        buf = io.BytesIO()
        cropped.save(buf, format="JPEG", quality=q, optimize=True, progressive=True)
        size = buf.tell()
        if best is None or abs(size - 90 * 1024) < abs(best[0] - 90 * 1024):
            best = (size, q, buf.getvalue())
    with open(out_path, "wb") as f:
        f.write(best[2])
    print(f"saved {out_path}: {best[0] // 1024} KB, q={best[1]}, {TARGET_W}x{TARGET_H}")


def resolve_source() -> str:
    for d in ASSET_DIRS:
        for name in SRC_NAMES:
            p = os.path.join(d, name)
            if os.path.isfile(p):
                return p
    raise FileNotFoundError("upimg preview png not found in assets/")


if __name__ == "__main__":
    export_cover(resolve_source(), OUT)
