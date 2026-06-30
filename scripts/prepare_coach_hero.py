"""教练工作台头图：与「我的」页 upimg 同风格源图，按横幅比例 cover 导出。"""
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
SRC_NAMES = ["upimg_preview_v5_coach.png", "upimg_preview_v4.png"]
FALLBACK = os.path.join(
    ROOT, "miniprogram", "pages", "default", "skin", "images", "upimg.jpg"
)
OUT = os.path.join(ROOT, "miniprogram", "pages", "coach", "images", "coach_home_hero.jpg")

# 与 coach_index.wxss .coach-hero 750x340rpx 对齐
TARGET_W = 1500
TARGET_H = 680
CROP_ZOOM = 1.08
CROP_SHIFT_X = 0.12


def resolve_source() -> str:
    for d in ASSET_DIRS:
        for name in SRC_NAMES:
            p = os.path.join(d, name)
            if os.path.isfile(p):
                return p
    if os.path.isfile(FALLBACK):
        return FALLBACK
    raise FileNotFoundError("coach hero source not found")


def export_cover(src_path: str, out_path: str) -> None:
    im = Image.open(src_path).convert("RGB")
    sw, sh = im.size
    scale = max(TARGET_W / sw, TARGET_H / sh) * CROP_ZOOM
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
    print(f"saved {out_path} from {os.path.basename(src_path)}: {out.size[0]}x{out.size[1]}")


if __name__ == "__main__":
    export_cover(resolve_source(), OUT)
