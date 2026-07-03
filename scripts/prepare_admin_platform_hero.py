"""超管 admin_home 头图：从预览图 cover 导出。"""
from PIL import Image
import io
import os

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
SRC_NAME = "admin_platform_hero_preview.png"
OUT = os.path.join(
    ROOT, "miniprogram", "pages", "admin", "images", "admin_platform_hero.jpg"
)
TARGET_W = 1500
TARGET_H = 560
CROP_SHIFT_X = -0.08


def resolve_source() -> str:
    for d in ASSET_DIRS:
        p = os.path.join(d, SRC_NAME)
        if os.path.isfile(p):
            return p
    raise FileNotFoundError(f"{SRC_NAME} not found")


def export_cover(src_path: str, out_path: str) -> None:
    im = Image.open(src_path).convert("RGB")
    sw, sh = im.size
    scale = max(TARGET_W / sw, TARGET_H / sh)
    nw, nh = int(round(sw * scale)), int(round(sh * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TARGET_W) // 2 + int((nw - TARGET_W) * CROP_SHIFT_X)
    left = max(0, min(left, nw - TARGET_W))
    top = max(0, min((nh - TARGET_H) // 2, nh - TARGET_H))
    out = resized.crop((left, top, left + TARGET_W, top + TARGET_H))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=90, optimize=True)
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    print(f"saved {out_path}: {len(buf.getvalue()) // 1024} KB, {out.size[0]}x{out.size[1]}")


if __name__ == "__main__":
    export_cover(resolve_source(), OUT)
