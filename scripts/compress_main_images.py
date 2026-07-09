"""压缩主包内较大的 JPEG/PNG，降低小程序主包体积。"""
import io
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [
    ("miniprogram/images/card_faces", 640, 384, 72),
    ("miniprogram/pages/default/skin/images", 1200, None, 78),
    ("miniprogram/images", 1200, None, 78),
    ("projects/A00/skin/images", 1200, None, 78),
]

SKIP_NAMES = {"empty_yoga.png", "empty_yoga_b.png", "empty_yoga_c.png", "tenant_logo_placeholder.png"}


def compress_file(path, max_w, max_h, quality):
    ext = os.path.splitext(path)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        return
    name = os.path.basename(path)
    if name in SKIP_NAMES:
        return

    old = os.path.getsize(path)
    im = Image.open(path)
    if ext in (".jpg", ".jpeg"):
        im = im.convert("RGB")
    elif im.mode in ("RGBA", "P"):
        im = im.convert("RGBA")

    w, h = im.size
    if max_h:
        scale = min(max_w / w, max_h / h, 1.0)
    else:
        scale = min(max_w / w, 1.0)
    if scale < 1.0:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    if ext in (".jpg", ".jpeg"):
        im.save(buf, format="JPEG", quality=quality, optimize=True)
    else:
        im.save(buf, format="PNG", optimize=True)

    data = buf.getvalue()
    if len(data) >= old * 0.98:
        return
    with open(path, "wb") as f:
        f.write(data)
    rel = os.path.relpath(path, ROOT)
    print(f"{rel}: {old // 1024}KB -> {len(data) // 1024}KB")


def main():
    for rel_dir, max_w, max_h, quality in TARGETS:
        base = os.path.join(ROOT, rel_dir)
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            compress_file(os.path.join(base, name), max_w, max_h, quality)


if __name__ == "__main__":
    main()
