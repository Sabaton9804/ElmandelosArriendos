from pathlib import Path
from collections import deque
import urllib.request

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call(["python", "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

candidates = [
    (
        "negro",
        "https://elmandelosarriendos.com/cdn/shop/files/LOGO_NEGRO_ROJO_EL_MAN_DE_LOS_ARRIENDOS_DOS_WEB.png",
    ),
    (
        "color2",
        "https://elmandelosarriendos.com/cdn/shop/files/LOGO_EL_MAN_DE_LOS_ARRIENDOS_LOGO_COLOR2_1b929325-d9be-4cdf-95f4-ea9690ab8c6c.png",
    ),
    (
        "rojo",
        "https://elmandelosarriendos.com/cdn/shop/files/LOGO_EL_MAN_DE_LOS_ARRIENDOS_ROJO.png",
    ),
]

base = Path(r"C:\Users\USUARIO\Desktop\elman-portal-mvp")


def analyze(path: Path):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    white = black = red = other = 0
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            if r > 200 and g > 200 and b > 200:
                white += 1
            elif r < 50 and g < 50 and b < 50:
                black += 1
            elif r > 150 and g < 100 and b < 100:
                red += 1
            else:
                other += 1
    return w, h, white, black, red, other


for name, url in candidates:
    p = base / f"logo-src-{name}.png"
    urllib.request.urlretrieve(url, p)
    print(name, analyze(p), "bytes", p.stat().st_size)
