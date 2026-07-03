"""教练端会员卡管理页头图：专用竖幅裁切为横幅。"""
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
SRC_NAMES = ["coach_card_hero_preview.png", "coach_member_hero_preview.png"]
OUT = os.path.join(
    ROOT, "miniprogram", "pages", "coach", "images", "coach_card_hero.jpg"
)
TARGET_W = 1500
TARGET_H = 680
CROP_SHIFT_X = 0.08


def resolve_source() -> str:
    for d in ASSET_DIRS:
        for name in SRC_NAMES:
            p = os.path.join(d, name)
            if os.path.isfile(p):
                return p
    fallback = os.path.join(
        ROOT, "miniprogram", "pages", "coach", "images", "coach_member_hero.jpg"
    )
    if os.path.isfile(fallback):
        return fallback
    raise FileNotFoundError("card hero source not found")


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
    print(
        f"saved {out_path} from {os.path.basename(src_path)}: "
        f"{len(buf.getvalue()) // 1024} KB"
    )


if __name__ == "__main__":
    export_cover(resolve_source(), OUT)
