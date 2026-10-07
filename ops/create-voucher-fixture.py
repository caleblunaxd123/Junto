# Synthetic payment voucher for OCR tests: invented name, numbers and code, no logos or app artwork.
# Usage: python3 ops/create-voucher-fixture.py                      ->  ops/qa-voucher.png
#        python3 ops/create-voucher-fixture.py --operacion 91383048 --codigo "7 1 6" --salida /tmp/v.png
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument("--operacion", default="03416872")
parser.add_argument("--codigo", default="4 8 2")
parser.add_argument("--hora", default="08:15 p. m.")
parser.add_argument("--salida", default=str(Path(__file__).with_name("qa-voucher.png")))
args = parser.parse_args()

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
image = Image.new("RGB", (720, 1280), "white")
draw = ImageDraw.Draw(image)
lines = [
    ("¡Yapeaste!", BOLD, 44, "#4A1A6B"),
    ("S/ 25", BOLD, 72, "#4A1A6B"),
    ("Marta Q. Ríos", FONT, 36, "#222222"),
    (f"07 oct. 2026 | {args.hora}", FONT, 28, "#555555"),
    ("CÓDIGO DE SEGURIDAD", BOLD, 26, "#222222"),
    (args.codigo, BOLD, 40, "#222222"),
    ("Datos de la transacción", BOLD, 28, "#222222"),
    ("Nro. de celular *** *** 789", FONT, 28, "#222222"),
    ("Destino Yape", FONT, 28, "#222222"),
    (f"Nro. de operación {args.operacion}", FONT, 28, "#222222"),
    ("PRUEBA QA - NO ES UN PAGO REAL", BOLD, 24, "#AA0000"),
]
y = 70
for text, font, size, color in lines:
    face = ImageFont.truetype(font, size)
    width = draw.textlength(text, font=face)
    draw.text(((720 - width) / 2, y), text, font=face, fill=color)
    y += int(size * 1.9)
image.save(args.salida, optimize=True)
print(args.salida)
