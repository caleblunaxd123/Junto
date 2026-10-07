# Synthetic payment voucher for OCR tests: invented name, numbers and code, no logos or app artwork.
# Usage: python3 ops/create-voucher-fixture.py  ->  ops/qa-voucher.png
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
image = Image.new("RGB", (720, 1280), "white")
draw = ImageDraw.Draw(image)
lines = [
    ("¡Yapeaste!", BOLD, 44, "#4A1A6B"),
    ("S/ 25", BOLD, 72, "#4A1A6B"),
    ("Marta Q. Ríos", FONT, 36, "#222222"),
    ("07 oct. 2026 | 08:15 p. m.", FONT, 28, "#555555"),
    ("CÓDIGO DE SEGURIDAD", BOLD, 26, "#222222"),
    ("4 8 2", BOLD, 40, "#222222"),
    ("Datos de la transacción", BOLD, 28, "#222222"),
    ("Nro. de celular *** *** 789", FONT, 28, "#222222"),
    ("Destino Yape", FONT, 28, "#222222"),
    ("Nro. de operación 03416872", FONT, 28, "#222222"),
    ("PRUEBA QA - NO ES UN PAGO REAL", BOLD, 24, "#AA0000"),
]
y = 70
for text, font, size, color in lines:
    face = ImageFont.truetype(font, size)
    width = draw.textlength(text, font=face)
    draw.text(((720 - width) / 2, y), text, font=face, fill=color)
    y += int(size * 1.9)
out = Path(__file__).with_name("qa-voucher.png")
image.save(out, optimize=True)
print(out)
