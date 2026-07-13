from pathlib import Path
from collections import deque
import urllib.request

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call(["python", "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

url = "https://elmandelosarriendos.com/cdn/shop/files/LOGO_EL_MAN_DE_LOS_ARRIENDOS_LOGO_COLOR2_1b929325-d9be-4cdf-95f4-ea9690ab8c6c.png"
base = Path(r"C:\Users\USUARIO\Desktop\elman-portal-mvp")
raw = base / "logo-src-color2.png"
out = base / "logo.png"
favicon = base / "favicon.png"

urllib.request.urlretrieve(url, raw)
img = Image.open(raw).convert("RGBA")
w, h = img.size
px = img.load()


def is_bg(c):
    r, g, b, a = c
    if a < 25:
        return True
    # only very pure black for background
    return r <= 25 and g <= 25 and b <= 25


seen = [[False] * w for _ in range(h)]
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if is_bg(px[x, y]):
            q.append((x, y)); seen[y][x] = True
for y in range(h):
    for x in (0, w - 1):
        if is_bg(px[x, y]) and not seen[y][x]:
            q.append((x, y)); seen[y][x] = True

while q:
    x, y = q.popleft()
    px[x, y] = (0, 0, 0, 0)
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and is_bg(px[nx, ny]):
            seen[ny][nx] = True
            q.append((nx, ny))

# white canvas for header/favicon readability
canvas = Image.new("RGBA", (w, h), (255, 255, 255, 255))
canvas.paste(img, (0, 0), img)
canvas.save(out)

side = 128
fav = Image.new("RGBA", (side, side), (255, 255, 255, 255))
scale = min((side - 6) / w, (side - 6) / h)
nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
resized = canvas.resize((nw, nh), Image.Resampling.LANCZOS)
fav.paste(resized, ((side - nw) // 2, (side - nh) // 2))
fav.save(favicon)
print("OK full COLOR2 logo")
