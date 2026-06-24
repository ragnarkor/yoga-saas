from PIL import Image
import io
import os

SRC = r"C:\Users\paripeng\.cursor\projects\c-Pari-Project-test-Yoga\assets\empty_yoga_square_v2.png"
PREVIEW = r"C:\Users\paripeng\.cursor\projects\c-Pari-Project-test-Yoga\assets\empty_yoga_preview.png"


def crop_square(image: Image.Image) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side))


def remove_white_background(image: Image.Image, threshold: int = 248) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if red >= threshold and green >= threshold and blue >= threshold:
                pixels[x, y] = (red, green, blue, 0)
    return rgba


def save_near_target(image: Image.Image, output_path: str, target_bytes: int = 10 * 1024) -> None:
    best = None
    for size in range(360, 180, -20):
        for colors in (96, 64, 48, 32):
            resized = image.resize((size, size), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            resized.save(buffer, format="PNG", optimize=True, compress_level=9)
            size_bytes = buffer.tell()
            if best is None or abs(size_bytes - target_bytes) < abs(best[0] - target_bytes):
                best = (size_bytes, size, colors, buffer.getvalue())
    with open(output_path, "wb") as handle:
        handle.write(best[3])
    print(f"saved {output_path}: {best[0]} bytes ({best[0] / 1024:.1f} KB), {best[1]}x{best[1]}px")


def main() -> None:
    source = Image.open(SRC).convert("RGB")
    square = crop_square(source)
    transparent = remove_white_background(square, threshold=245)
    transparent.save(PREVIEW, format="PNG", optimize=True, compress_level=9)
    print(
        f"preview saved: {PREVIEW}, "
        f"{transparent.size[0]}x{transparent.size[1]}px, "
        f"{os.path.getsize(PREVIEW)} bytes"
    )


if __name__ == "__main__":
    main()
