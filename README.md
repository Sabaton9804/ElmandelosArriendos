# El Man de los Arriendos — Demo Portal MVP

Demo visual de portal inmobiliario (estilo Fincaraíz/Metro) para **El Man de los Arriendos**.

## Incluye

- Logo oficial + favicon
- Catálogo real desde Shopify (`products.json`)
- Mapa interactivo (Leaflet)
- Filtros avanzados (parqueadero, amoblado, precio, etc.)
- Ficha de inmueble con galería y CTA WhatsApp
- UI de Ingresar / Crear cuenta (mock)

## Cómo verlo

```bash
# Opción rápida
# abre index.html en el navegador

# Recomendado (mapa / assets locales)
python -m http.server 8765
```

Luego: http://127.0.0.1:8765/

## Regenerar inmuebles desde Shopify

```bash
python build-data.py
```

## Nota

Demo comercial. Las ubicaciones del mapa son aproximadas por zona. Auth es solo UI.
