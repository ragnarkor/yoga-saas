"""生成选馆页 Logo 占位图预览方案（仅输出到 assets，供确认后再入库）。"""
from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(
    os.path.expanduser("~"),
    ".cursor",
    "projects",
    "c-Pari-Project-test-Yoga",
    "assets",
)
os.makedirs(OUT_DIR, exist_ok=True)

SIDE = 400
# 与 skin.wxss 一致
SAGE = (111, 174, 150)
SAGE_DARK = (79, 140, 118)
SAGE_LIGHT = (229, 241, 236)
CREAM = (246, 247, 245)


def save(name: str, img: Image.Image) -> str:
    path = os.path.join(OUT_DIR, name)
    img.save(path, format="PNG", optimize=True)
    print(path)
    return path


def opt_a_flat_home() -> Image.Image:
    """A：浅绿底 + 简约房屋线框"""
    img = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = SIDE // 2, SIDE // 2
    r = 168
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*SAGE_LIGHT, 255))
    # 房屋
    bw, bh = 88, 72
    bx, by = cx - bw // 2, cy - 10
    d.polygon(
        [(bx, by + 28), (cx, by - 36), (bx + bw, by + 28)],
        outline=SAGE_DARK,
        width=6,
    )
    d.rounded_rectangle(
        (bx + 8, by + 28, bx + bw - 8, by + bh + 20),
        radius=8,
        outline=SAGE_DARK,
        width=6,
    )
    d.rectangle(
        (cx - 14, by + 48, cx + 14, by + bh + 20),
        fill=SAGE,
    )
    return img


def opt_b_solid_icon() -> Image.Image:
    """B：纯色圆底 + 单线瑜伽垫符号"""
    img = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = SIDE // 2, SIDE // 2
    r = 168
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*SAGE, 255))
    # 简化的垫子上的人：圆头 + 弧线
    d.ellipse((cx - 22, cy - 58, cx + 22, cy - 14), fill=(255, 255, 255, 240))
    d.arc(
        (cx - 56, cy - 20, cx + 56, cy + 70),
        start=200,
        end=340,
        fill=(255, 255, 255, 230),
        width=8,
    )
    d.rounded_rectangle(
        (cx - 72, cy + 36, cx + 72, cy + 52),
        radius=6,
        fill=(255, 255, 255, 200),
    )
    return img


def opt_c_ring_only() -> Image.Image:
    """C：最简 — 浅底 + 主题色细圆环"""
    img = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = SIDE // 2, SIDE // 2
    d.ellipse((24, 24, SIDE - 24, SIDE - 24), fill=(*CREAM, 255))
    d.ellipse((48, 48, SIDE - 48, SIDE - 48), outline=(*SAGE, 255), width=10)
    d.ellipse((cx - 36, cy - 36, cx + 36, cy + 36), fill=(*SAGE_LIGHT, 255))
    return img


if __name__ == "__main__":
    save("tenant_logo_opt_a.png", opt_a_flat_home())
    save("tenant_logo_opt_b.png", opt_b_solid_icon())
    save("tenant_logo_opt_c.png", opt_c_ring_only())
