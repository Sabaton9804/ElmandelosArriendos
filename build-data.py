import json
import re
import random
import urllib.request
from pathlib import Path
from html import unescape

url = "https://elmandelosarriendos.com/products.json?limit=250"
with urllib.request.urlopen(url) as r:
    data = json.loads(r.read().decode("utf-8"))

places = {
    "soacha": ("bogota", 4.587, -74.217),
    "hogares": ("bogota", 4.595, -74.198),
    "modelia": ("bogota", 4.689, -74.119),
    "ricaurte": ("bogota", 4.612, -74.094),
    "calle 13": ("bogota", 4.622, -74.092),
    "tintal": ("bogota", 4.643, -74.155),
    "suba": ("bogota", 4.741, -74.083),
    "monarcas": ("bogota", 4.748, -74.078),
    "calera": ("bogota", 4.723, -74.026),
    "centro": ("bogota", 4.598, -74.076),
    "ciudad bol": ("bogota", 4.545, -74.148),
    "prado veraniego": ("bogota", 4.730, -74.065),
    "colina": ("bogota", 4.732, -74.061),
    "chia": ("bogota", 4.862, -74.033),
    "chía": ("bogota", 4.862, -74.033),
    "feder": ("bogota", 4.710, -74.036),
    "carrera s": ("bogota", 4.650, -74.062),
    "cartagena": ("cartagena", 10.3997, -75.5144),
    "cota": ("bogota", 4.810, -74.105),
    "calatrava": ("bogota", 4.725, -74.050),
    "lagartos": ("bogota", 4.705, -74.045),
    "casa blanca": ("bogota", 4.700, -74.030),
    "modelo": ("bogota", 4.630, -74.090),
    "calleja": ("bogota", 4.680, -74.045),
    "pasadena": ("bogota", 4.690, -74.055),
    "cedritos": ("bogota", 4.725, -74.035),
    "bosa": ("bogota", 4.625, -74.185),
    "doradal": ("medellin", 5.890, -74.730),
    "poblado": ("medellin", 6.208, -75.567),
    "170": ("bogota", 4.755, -74.045),
    "chapinero": ("bogota", 4.648, -74.063),
    "laureles": ("medellin", 6.245, -75.597),
    "miravalle": ("medellin", 6.242, -75.590),
    "maipor": ("bogota", 4.580, -74.210),
    "envigado": ("medellin", 6.170, -75.585),
    "medell": ("medellin", 6.244, -75.581),
    "bogot": ("bogota", 4.650, -74.080),
    "cairo": ("bogota", 4.870, -74.040),
    "nicol": ("bogota", 4.710, -74.036),
}


def find_place(title):
    t = title.lower()
    for k, v in places.items():
        if k in t:
            return v
    return ("bogota", 4.650, -74.080)


def detect_op(title, ptype):
    t = f"{title} {ptype or ''}".lower()
    if any(x in t for x in ["airbnb", "noche", "rentas cortas"]):
        return "renta"
    if any(x in t for x in ["vendo", "venta"]):
        return "venta"
    return "arriendo"


def detect_tipo(title, ptype):
    t = f"{title} {ptype or ''}".lower()
    if any(x in t for x in ["local", "bodega", "lote"]):
        return "local"
    if any(x in t for x in ["casa", "finca", "hotel"]):
        return "casa"
    if any(x in t for x in ["apartaestudio", "estudio"]):
        return "apartaestudio"
    return "apto"


def clean_title(title):
    t = re.sub(r"[^\w\s\|,.\-+/()°ºª%áéíóúÁÉÍÓÚñÑüÜ]", " ", title, flags=re.UNICODE)
    return re.sub(r"\s+", " ", t).strip(" |")


def strip_html(html):
    if not html:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def fmt_price(n):
    return "$" + f"{float(n):,.0f}".replace(",", ".")


def has_any(text, words):
    return any(w in text for w in words)


def extract_features(title, tags, body):
    blob = f"{title} {' '.join(tags or [])} {body}".lower()
    features = {
        "parqueadero": has_any(blob, ["parqueadero", "garage", "garaje", "parking"]),
        "amoblado": has_any(blob, ["amoblado", "amoblada", "dotado", "dotada", "amueblado"]),
        "balcon": has_any(blob, ["balcon", "balcón"]),
        "terraza": has_any(blob, ["terraza"]),
        "ascensor": has_any(blob, ["ascensor", "elevador"]),
        "deposito": has_any(blob, ["deposito", "depósito", "bodega"]),
        "piscina": has_any(blob, ["piscina"]),
        "gimnasio": has_any(blob, ["gimnasio", "gimnasio", "gym"]),
        "domotica": has_any(blob, ["domot", "inteligente"]),
        "mascotas": has_any(blob, ["mascota", "pet friendly"]),
        "vigilancia": has_any(blob, ["vigilancia", "porteria", "portería", "seguridad"]),
        "aire": has_any(blob, ["aire acondicionado", "a/c"]),
        "chimenea": has_any(blob, ["chimenea"]),
        "jardin": has_any(blob, ["jardin", "jardín"]),
        "bbq": has_any(blob, ["bbq", "asador"]),
        "conjunto": has_any(blob, ["conjunto", "cerrado"]),
    }

    m2 = None
    m = re.search(r"(\d{2,4})\s*(?:m2|m²|mts|metros)", blob)
    if m:
        m2 = int(m.group(1))

    habs = 0
    if "apartaestudio" in blob or "estudio" in blob:
        habs = 1
    hm = re.search(r"(\d+)\s*(?:hab(?:itacion(?:es)?)?|alcoba(?:s)?)", blob)
    if hm:
        habs = int(hm.group(1))

    banos = 0
    bm = re.search(r"(\d+)\s*(?:baño(?:s)?|banos?)", blob)
    if bm:
        banos = int(bm.group(1))
    elif habs:
        banos = 1 if habs == 1 else min(habs, 3)

    estrato = None
    em = re.search(r"estrato\s*([1-6])", blob)
    if em:
        estrato = int(em.group(1))

    return features, m2, habs, banos, estrato


rnd = random.Random(42)
items = []
for i, p in enumerate(data["products"], 1):
    city, lat, lng = find_place(p["title"])
    lat += (rnd.random() - 0.5) * 0.012
    lng += (rnd.random() - 0.5) * 0.012
    images = [img["src"] for img in (p.get("images") or [])][:12]
    img = images[0] if images else ""
    price = float(p["variants"][0]["price"])
    body = strip_html(p.get("body_html") or "")
    features, m2, habs, banos, estrato = extract_features(
        p["title"], p.get("tags") or [], body
    )
    place = {
        "medellin": "Medellín y alrededores",
        "cartagena": "Cartagena",
    }.get(city, "Bogotá y alrededores")
    op = detect_op(p["title"], p.get("product_type"))
    items.append(
        {
            "id": i,
            "handle": p["handle"],
            "title": clean_title(p["title"]),
            "price": fmt_price(price),
            "priceNum": price,
            "op": op,
            "tipo": detect_tipo(p["title"], p.get("product_type")),
            "city": city,
            "place": place,
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "img": img,
            "images": images,
            "url": f"https://elmandelosarriendos.com/products/{p['handle']}",
            "available": p["variants"][0].get("available", True),
            "description": body[:900],
            "m2": m2,
            "habs": habs,
            "banos": banos,
            "estrato": estrato,
            "features": features,
            "tags": (p.get("tags") or [])[:12],
        }
    )

out = Path(r"C:\Users\USUARIO\Desktop\elman-portal-mvp\properties-data.js")
payload = (
    "// Auto-generado desde elmandelosarriendos.com/products.json\n"
    "window.ELMAN_PROPERTIES = "
    + json.dumps(items, ensure_ascii=False, indent=2)
    + ";\n"
)
out.write_text(payload, encoding="utf-8")
print(f"Wrote {len(items)} properties")
print("sample features", items[1]["features"])
print("sample habs/m2", items[1]["habs"], items[1]["m2"])
