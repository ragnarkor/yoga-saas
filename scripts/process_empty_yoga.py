from PIL import Image
import io
import os

SRC = r"C:\Users\paripeng\.cursor\projects\c-Pari-Project-test-Yoga\assets\empty_yoga_flat_noline.png"
OUT = r"c:\Pari\Project\test\Yoga\miniprogram\images\empty_yoga.png"
TARGET = 10 * 1024


def crop_square(image: Image.Image) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side))


def remove_white(image: Image.Image, threshold: int = 245) -> Image.Image:
    rgba = image.convert("RGBA")
    data = rgba.getdata()
    cleaned = []
    for red, green, blue, alpha in data:
        if red >= threshold and green >= threshold and blue >= threshold:
            cleaned.append((red, green, blue, 0))
        else:
            cleaned.append((red, green, blue, alpha))
    rgba.putdata(cleaned)
    return rgba


def compress(image: Image.Image) -> tuple[int, int, bytes]:
    best = None
    for size in range(320, 140, -10):
        for colors in (128, 96, 64, 48, 32):
            trial = image.resize((size, size), Image.Resampling.LANCZOS)
            quantized = trial.quantize(colors=colors, method=Image.Quantize.FASTOCTREE)
            buffer = io.BytesIO()
            quantized.save(buffer, format="PNG", optimize=True, compress_level=9)
            size_bytes = buffer.tell()
            if best is None or abs(size_bytes - TARGET) < abs(best[0] - TARGET):
                best = (size_bytes, size, buffer.getvalue())
            if 9000 <= size_bytes <= 11000:
                return best
    return best


def main() -> None:
    if not os.path.exists(SRC):
        raise FileNotFoundError(SRC)
    square = crop_square(Image.open(SRC).convert("RGB"))
    transparent = remove_white(square)
    size_bytes, size, payload = compress(transparent)
    with open(OUT, "wb") as handle:
        handle.write(payload)
    print(f"saved {OUT}: {size_bytes} bytes ({size_bytes / 1024:.1f} KB), {size}x{size}px")


if __name__ == "__main__":
    main()
