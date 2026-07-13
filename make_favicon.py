"""Build a crisp favicon from the logo's orange EL mark."""
from PIL import Image
import numpy as np

base = r"C:\Users\USUARIO\Desktop\elman-portal-mvp"
logo_path = f"{base}\\logo.png"
out_png = f"{base}\\favicon.png"
out_apple = f"{base}\\apple-touch-icon.png"
out_ico = f"{base}\\favicon.ico"

img = Image.open(logo_path).convert("RGBA")
arr = np.array(img)
h, w = arr.shape[:2]
r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

orange = (
    (a > 40)
    & (r > 160)
    & (g < 120)
    & (b < 90)
    & (r > g + 40)
    & (r > b + 40)
)

# Tall + near-top orange columns = vertical "EL"
heights = np.zeros(w, dtype=int)
ymins = np.full(w, h)
for x in range(w):
    ys = np.where(orange[:, x])[0]
    if len(ys):
        ymins[x] = int(ys.min())
        heights[x] = int(ys.max() - ys.min() + 1)

el_cols = (heights > int(h * 0.35)) & (ymins < int(h * 0.35))
xs = np.where(el_cols)[0]
x0, x1 = int(xs.min()), int(xs.max()) + 1

# Vertical gap separates EL from ARRIENDOS under it
left = orange[:, x0:x1]
row_density = left.sum(axis=1)
active = row_density > 8
el_end = h
started = False
for y, on in enumerate(active):
    if on:
        started = True
    elif started:
        nxt = np.where(active[y:])[0]
        gap = int(nxt[0]) if len(nxt) else 0
        if gap > 15:
            el_end = y
            break

ys = np.where(orange[0:el_end, x0:x1])
y0 = int(ys[0].min()) if len(ys[0]) else 0
y1 = el_end

pad = 18
cx0 = max(0, x0 - pad)
cy0 = max(0, y0 - pad)
cx1 = min(w, x1 + pad)
cy1 = min(h, y1 + pad)
crop = np.array(img.crop((cx0, cy0, cx1, cy1)))

cr, cg, cb, ca = crop[:, :, 0], crop[:, :, 1], crop[:, :, 2], crop[:, :, 3]
keep = (ca > 40) & (cr > 150) & (cg < 130) & (cb < 100) & (cr > cg + 30)
out = np.zeros_like(crop)
out[keep, 0] = 230
out[keep, 1] = 55
out[keep, 2] = 18
out[keep, 3] = 255
glyph = Image.fromarray(out, "RGBA")
bb = glyph.getbbox()
glyph = glyph.crop(bb)


def make_square(src: Image.Image, size: int, margin_ratio: float = 0.14) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    max_side = int(size * (1 - 2 * margin_ratio))
    g = src.copy()
    g.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    x = (size - g.width) // 2
    y = (size - g.height) // 2
    canvas.paste(g, (x, y), g)
    return canvas


sizes = {
    16: make_square(glyph, 16, 0.10),
    32: make_square(glyph, 32, 0.12),
    48: make_square(glyph, 48),
    128: make_square(glyph, 128),
    180: make_square(glyph, 180),
    512: make_square(glyph, 512, 0.12),
}

sizes[128].save(out_png, optimize=True)
sizes[180].save(out_apple, optimize=True)
sizes[32].save(
    out_ico,
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
)

# cleanup debug
import os
for name in ("_debug_left.png",):
    p = f"{base}\\{name}"
    if os.path.exists(p):
        os.remove(p)

print("OK el_box", (x0, y0, x1, y1), "glyph", glyph.size)
