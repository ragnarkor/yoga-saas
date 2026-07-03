"""选馆页 Logo 占位：透明底门店图标，圆形容器由页面 CSS 提供。"""
from PIL import Image
import io
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "miniprogram", "images", "tenant_logo_placeholder.png")
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
SRC_NAMES = ["tenant_logo_placeholder_v2_preview.png"]
SIDE = 320
ICON_SCALE = 0.62


def resolve_source() -> str:
    for d in ASSET_DIRS:
        for name in SRC_NAMES:
            p = os.path.join(d, name)
            if os.path.isfile(p):
                return p
    raise FileNotFoundError("tenant_logo_placeholder_v2_preview.png not found")


def export(out_path: str) -> None:
    im = Image.open(resolve_source()).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    scale = (SIDE * ICON_SCALE) / max(w, h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    icon = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
    canvas.paste(icon, ((SIDE - nw) // 2, (SIDE - nh) // 2), icon)

    if os.path.isfile(out_path):
        shutil.copy2(out_path, out_path + ".bak")
    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True, compress_level=9)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    print(f"saved {out_path}: {buf.tell()} bytes, {SIDE}x{SIDE}")


if __name__ == "__main__":
    export(OUT)
