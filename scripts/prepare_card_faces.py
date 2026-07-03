"""会员卡面预设图：横版 5:3，供列表/卡包小卡展示。"""
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
OUT_DIR = os.path.join(ROOT, "miniprogram", "images", "card_faces")
TARGET_W = 1000
TARGET_H = 600

PRESETS = [
    "card_face_sage_wave",
    "card_face_terracotta_arc",
    "card_face_lavender_flow",
    "card_face_ocean_peace",
    "card_face_cream_lotus",
]


def resolve_source(name: str) -> str:
    extra = []
    if name == "card_face_lavender_flow":
        extra = [f"{name}_preview_v2.png"]
    if name == "card_face_ocean_peace":
        extra = [f"{name}_preview_v2.png"]
    if name == "card_face_cream_lotus":
        extra = [f"{name}_preview_v3.png", f"{name}_preview_v2.png"]
    for d in ASSET_DIRS:
        for suffix in extra + [f"{name}_preview.png", f"{name}.png"]:
            p = os.path.join(d, suffix)
            if os.path.isfile(p):
                return p
    raise FileNotFoundError(f"{name} source not found")


def export_cover(src_path: str, out_path: str) -> None:
    im = Image.open(src_path).convert("RGB")
    sw, sh = im.size
    scale = max(TARGET_W / sw, TARGET_H / sh)
    nw, nh = int(round(sw * scale)), int(round(sh * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TARGET_W) // 2
    top = (nh - TARGET_H) // 2
    out = resized.crop((left, top, left + TARGET_W, top + TARGET_H))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=88, optimize=True)
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    print(f"saved {out_path}: {len(buf.getvalue()) // 1024} KB")


if __name__ == "__main__":
    for name in PRESETS:
        export_cover(
            resolve_source(name),
            os.path.join(OUT_DIR, f"{name}.jpg"),
        )
