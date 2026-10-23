"""Erzeugt die App-Icons in icons/. Aufruf: python3 tools/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / 'icons'
CASE, HI, LO, SCREEN = (44, 44, 52), (110, 110, 124), (18, 18, 22), (5, 7, 5)
TEAL = (63, 240, 216)
LEVELS = [5, 7, 8, 6, 7, 4, 5]   # beleuchtete Segmente je Balken
PEAKS = [7, 8, 9, 8, 8, 6, 6]
SEGS = 9
S = 1024  # intern gross zeichnen, dann verkleinern


def draw(inset):
    img = Image.new('RGB', (S, S), CASE)
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = (int(S * inset), int(S * inset), int(S * (1 - inset)), int(S * (1 - inset)))
    f = max(6, S // 80)
    # eingelassenes Display: dunkel oben/links, hell unten/rechts
    d.rectangle([x0 - f, y0 - f, x1 + f, y1 + f], fill=HI)
    d.polygon([(x0 - f, y0 - f), (x1 + f, y0 - f), (x1, y0), (x0, y0), (x0, y1), (x0 - f, y1 + f)], fill=LO)
    d.rectangle([x0, y0, x1, y1], fill=SCREEN)

    lit = Image.new('RGB', (S, S), (0, 0, 0))
    ld = ImageDraw.Draw(lit)
    pad = (x1 - x0) * 0.08
    n = len(LEVELS)
    cw = (x1 - x0 - 2 * pad) / n
    bw = cw * 0.72
    sh = (y1 - y0 - 2 * pad) / SEGS
    sg = sh * 0.62
    for b in range(n):
        bx = x0 + pad + b * cw + (cw - bw) / 2
        for s in range(SEGS):
            sy = y1 - pad - (s + 1) * sh + (sh - sg) / 2
            box = [bx, sy, bx + bw, sy + sg]
            if s < LEVELS[b] or s == PEAKS[b]:
                ld.rectangle(box, fill=TEAL)
            else:
                d.rectangle(box, fill=tuple(int(SCREEN[i] + (TEAL[i] - SCREEN[i]) * 0.09) for i in range(3)))
    glow = lit.filter(ImageFilter.GaussianBlur(S / 60))
    img = Image.composite(lit, img, lit.convert('L'))
    img = ImageChops.add(img, glow.point(lambda v: int(v * 0.8)))
    return img


def save(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)


OUT.mkdir(exist_ok=True)
full = draw(0.16)
save(full, 180, 'apple-touch-icon.png')
save(full, 192, 'icon-192.png')
save(full, 512, 'icon-512.png')
save(draw(0.24), 512, 'icon-maskable-512.png')
