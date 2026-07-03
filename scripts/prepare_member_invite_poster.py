"""邀请会员海报：整图背景，与弹窗卡片比例一致。"""
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
SRC_NAMES = [
    "member_invite_poster_preview.png",
    "coach_member_hero_preview.png",
    "calendar_index_bg_preview.png",
]
FALLBACK = os.path.join(
    ROOT, "miniprogram", "pages", "coach", "images", "coach_member_hero.jpg"
)
OUT = os.path.join(
    ROOT, "miniprogram", "pages", "coach", "images", "member_invite_poster.jpg"
)
TARGET_W = 1500
TARGET_H = 1920


def resolve_source() -> str:
    for d in ASSET_DIRS:
        for name in SRC_NAMES:
            p = os.path.join(d, name)
            if os.path.isfile(p):
                return p
    if os.path.isfile(FALLBACK):
        return FALLBACK
    raise FileNotFoundError("invite poster source not found")


def export_cover(src_path: str, out_path: str) -> None:
    im = Image.open(src_path).convert("RGB")
    sw, sh = im.size
    scale = max(TARGET_W / sw, TARGET_H / sh)
    nw, nh = int(round(sw * scale)), int(round(sh * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TARGET_W) // 2
    top = max(0, (nh - TARGET_H) // 2 - int(nh * 0.06))
    top = min(top, nh - TARGET_H)
    out = resized.crop((left, top, left + TARGET_W, top + TARGET_H))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=90, optimize=True)
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    print(f"saved {out_path}: {len(buf.getvalue()) // 1024} KB, {out.size[0]}x{out.size[1]}")


if __name__ == "__main__":
    export_cover(resolve_source(), OUT)
