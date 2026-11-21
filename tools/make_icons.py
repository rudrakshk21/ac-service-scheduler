"""Draws the app icons (three coloured bars on a dark square, as in public/favicon.svg).

Run once, from the project folder:  py tools/make_icons.py
The PNG files it writes into public/icons/ are committed; nothing runs at build time.
Needs Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image, ImageDraw

INK = (20, 35, 43, 255)  # #14232b
BARS = [  # x, y, width, height on a 64 x 64 grid, colour
    (10, 14, 30, 9, (63, 191, 134, 255)),   # green  #3fbf86
    (26, 28, 28, 9, (91, 155, 230, 255)),   # blue   #5b9be6
    (14, 42, 34, 9, (238, 111, 149, 255)),  # rose   #ee6f95
]
SUPER = 4  # draw four times larger, then shrink: smooth edges


def draw(size: int, rounded: bool, content_scale: float) -> Image.Image:
    big = size * SUPER
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 12 // 64, fill=INK)
    else:
        d.rectangle((0, 0, big, big), fill=INK)
    unit = big / 64 * content_scale
    offset = big * (1 - content_scale) / 2
    for x, y, w, h, colour in BARS:
        d.rounded_rectangle(
            (offset + x * unit, offset + y * unit, offset + (x + w) * unit, offset + (y + h) * unit),
            radius=3 * unit,
            fill=colour,
        )
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "public" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    draw(192, rounded=True, content_scale=1.0).save(out / "icon-192.png", optimize=True)
    draw(512, rounded=True, content_scale=1.0).save(out / "icon-512.png", optimize=True)
    # Maskable: the system crops it to a circle or squircle, so keep the bars inside the central 80 %.
    draw(512, rounded=False, content_scale=0.8).save(out / "maskable-512.png", optimize=True)
    # iOS rounds the corners itself.
    draw(180, rounded=False, content_scale=1.0).save(out / "apple-touch-icon.png", optimize=True)
    for f in sorted(out.iterdir()):
        print(f.name, f.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
