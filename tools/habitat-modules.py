#!/usr/bin/env python3
"""The habitat picture for the landing page's third page, from the two files handed over.

public/Svg_File/mars-habitat-lineart-modules.svg (1536 x 1024) and habitat_Final.svg (3072 x 2048 — the coloured
picture as handed over on 13 October, two of its modules set a few pixels right, after mars-habitat-colored-modules.svg,
which it replaces) are Inkscape stacks of pictures: a layer each for the Mars plain with the sky, the geodesic dome, and the thirteen modules
under it, every layer one PNG (embedded, base64) placed in its box. The page draws the line-art stack composed into one
picture (public/habitat/scene-lines.webp) and, for every module, its cut-out of the coloured picture
(public/habitat/modules/<id>.webp) at twice the picture's size — cut at the module's box as src/views/pages/inside.js
has it (ROOMS, `rect`: the line-art file's layer, trimmed where two overlapped), so the cut-out registers with the lines.

Run it again after either file is replaced (python3 tools/habitat-modules.py; needs Pillow): it writes the scene and
the thirteen cut-outs. Then bump the `?v=` on SCENE and the cut-outs in inside.js so browsers fetch the new pictures.
"""
import base64
import io
import os
import re
import sys
import xml.etree.ElementTree as ET

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is needed: pip install Pillow')

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SVG = os.path.join(ROOT, 'public', 'Svg_File')
OUT = os.path.join(ROOT, 'public', 'habitat')
LINES = os.path.join(SVG, 'mars-habitat-lineart-modules.svg')
COLOUR = os.path.join(SVG, 'habitat_Final.svg')        # 13 October: "replace the Habitat svg with the new svg called habitat_Final"
INSIDE = os.path.join(ROOT, 'src', 'views', 'pages', 'inside.js')


SVG_NS, XLINK_NS = 'http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink'


def compose(path):
    """Every layer's picture placed in its box, bottom to top, as one RGB picture the size of the file's canvas. Read as
    XML, so a file however it was written — Inkscape's prefixes (svg:, xlink:) or a script's (ns0:, ns2:) — reads alike."""
    root = ET.parse(path).getroot()
    w, h = int(float(root.get('width'))), int(float(root.get('height')))
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    n = 0
    for img in root.iter(f'{{{SVG_NS}}}image'):
        href = img.get(f'{{{XLINK_NS}}}href') or img.get('href') or ''
        m = re.match(r'data:image/\w+;base64,(.*)', href, re.S)
        if not m:
            continue
        x, y, bw, bh = (int(float(img.get(k))) for k in ('x', 'y', 'width', 'height'))
        im = Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')
        if im.size != (bw, bh):
            im = im.resize((bw, bh), Image.LANCZOS)
        canvas.alpha_composite(im, (x, y))
        n += 1
    print(f'{os.path.basename(path)}: {n} layers, {w} x {h}')
    return canvas.convert('RGB')


def rooms():
    """The modules' ids and boxes, as inside.js has them."""
    s = open(INSIDE, encoding='utf-8').read()
    s = s[s.index('const ROOMS = ['):s.index('];', s.index('const ROOMS = ['))]
    out = []
    for m in re.finditer(r"\{ id: '([a-z]+)'.*?rect: \[(\d+), (\d+), (\d+), (\d+)\]", s, re.S):
        out.append((m.group(1), tuple(int(v) for v in m.groups()[1:])))
    return out


def main():
    lines = compose(LINES)
    colour = compose(COLOUR)
    k = colour.width / lines.width                       # the coloured file is drawn larger (twice, as handed over)
    os.makedirs(os.path.join(OUT, 'modules'), exist_ok=True)
    scene = os.path.join(OUT, 'scene-lines.webp')
    lines.save(scene, 'WEBP', quality=85, method=6)
    print(f'{os.path.relpath(scene, ROOT)}: {lines.width} x {lines.height}, {os.path.getsize(scene) // 1024} KB')
    total = 0
    for rid, (x, y, w, h) in rooms():
        box = (round(x * k), round(y * k), round((x + w) * k), round((y + h) * k))
        tile = colour.crop(box)
        p = os.path.join(OUT, 'modules', f'{rid}.webp')
        tile.save(p, 'WEBP', quality=80, method=6)
        total += os.path.getsize(p)
        print(f'  {rid:12s} {tile.width} x {tile.height}  {os.path.getsize(p) // 1024} KB')
    print(f'the cut-outs together: {total // 1024} KB')


if __name__ == '__main__':
    main()
