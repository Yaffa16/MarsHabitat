#!/usr/bin/env python3
"""The habitat picture for the landing page's third page, from the two files handed over.

public/Svg_File/mars-habitat-lineart-modules.svg (1536 x 1024) and mars-habitat-colored-modules.svg (3072 x 2048) are
Inkscape stacks of pictures: a layer each for the Mars plain with the sky, the geodesic dome, and the thirteen modules
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

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is needed: pip install Pillow')

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SVG = os.path.join(ROOT, 'public', 'Svg_File')
OUT = os.path.join(ROOT, 'public', 'habitat')
LINES = os.path.join(SVG, 'mars-habitat-lineart-modules.svg')
COLOUR = os.path.join(SVG, 'mars-habitat-colored-modules.svg')
INSIDE = os.path.join(ROOT, 'src', 'views', 'pages', 'inside.js')


def compose(path):
    """Every layer's picture placed in its box, bottom to top, as one RGB picture the size of the file's canvas."""
    s = open(path, encoding='utf-8').read()
    m = re.search(r'<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"', s)
    w, h = int(m.group(1)), int(m.group(2))
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    n = 0
    for lm in re.finditer(r'<g id="([^"]*)"[^>]*>\s*<image ([^>]*?)xlink:href="data:image/\w+;base64,([^"]*)"', s):
        a = dict(re.findall(r'(\w[\w-]*)="([^"]*)"', lm.group(2)))
        x, y, bw, bh = int(float(a['x'])), int(float(a['y'])), int(float(a['width'])), int(float(a['height']))
        im = Image.open(io.BytesIO(base64.b64decode(lm.group(3)))).convert('RGBA')
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
