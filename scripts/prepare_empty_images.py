from PIL import Image
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "miniprogram", "images")

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

SOURCES = {
    "empty_yoga_b.png": "empty_preview_universal_b.png",
    "empty_yoga_c.png": "empty_preview_universal_c.png",
}


def remove_white_background(image: Image.Image, threshold: int = 245) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if red >= threshold and green >= threshold and blue >= threshold:
                pixels[x, y] = (red, green, blue, 0)
    return rgba


def trim_to_content(image: Image.Image, padding_ratio: float = 0.1) -> Image.Image:
    """按透明区域外接矩形裁剪，再补成正方形画布，避免宽图被居中裁切。"""
    rgba = image.convert("RGBA")
    bbox = rgba.getbbox()
    if not bbox:
        return rgba

    left, top, right, bottom = bbox
    content_w = right - left
    content_h = bottom - top
    pad = int(max(content_w, content_h) * padding_ratio)

    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(rgba.width, right + pad)
    bottom = min(rgba.height, bottom + pad)

    cropped = rgba.crop((left, top, right, bottom))
    cw, ch = cropped.size
    side = max(cw, ch)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - cw) // 2, (side - ch) // 2))
    return square


def save_optimized(image: Image.Image, output_path: str, target_bytes: int = 12 * 1024) -> None:
    best = None
    for size in range(360, 200, -20):
        resized = image.resize((size, size), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        resized.save(buffer, format="PNG", optimize=True, compress_level=9)
        size_bytes = buffer.tell()
        if best is None or abs(size_bytes - target_bytes) < abs(best[0] - target_bytes):
            best = (size_bytes, size, buffer.getvalue())
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as handle:
        handle.write(best[2])
    print(
        f"saved {output_path}: {best[0]} bytes ({best[0] / 1024:.1f} KB), "
        f"{best[1]}x{best[1]}px"
    )


def resolve_source(src_name: str) -> str:
    for folder in ASSET_DIRS:
        path = os.path.join(folder, src_name)
        if os.path.isfile(path):
            return path
    raise FileNotFoundError(f"missing source: {src_name}")


def main() -> None:
    for out_name, src_name in SOURCES.items():
        src_path = resolve_source(src_name)
        image = Image.open(src_path).convert("RGB")
        transparent = remove_white_background(image)
        trimmed = trim_to_content(transparent, padding_ratio=0.12)
        save_optimized(trimmed, os.path.join(OUT_DIR, out_name))


if __name__ == "__main__":
    main()
