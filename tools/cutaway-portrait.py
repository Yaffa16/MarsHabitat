"""The cutaway drawing of Red Dust City laid out for a phone held upright: the same rooms, cut from the drawing handed over
(1536 x 1024, three floors under a wide dome) and set again under a dome as wide as the picture, on five floors — the
communication station under the crown, the growing shelves and the science bench at ground level inside the dome, and
below the ground, dug in, the kitchen with the sleeping pods, the lounge with the health station, and the water loop with
the power plant. The geodesic shell is drawn afresh over the crown (a triangulated semicircle with a node at every
vertex, as the drawing has it); the ground is the drawing's own regolith. Both drawings — the white line on the tinted
ground and the painted one — are built from the same cuts at the same places, so a part's outline on the one is the
part's outline on the other. The outlines of the parts as placed are written to portrait.json for the page."""
import json, math
from PIL import Image, ImageDraw
import numpy as np

# Run from the project's root: python3 tools/cutaway-portrait.py <lines.png> <colour.png> — the two drawings handed
# over (1536 x 1024, the sky painted or not: the sky is not used); writes public/habitat/cutaway-portrait-lines.webp
# and -colour.webp, and prints the parts' outlines to paste into PORTRAIT in src/views/pages/cutaway.js.
import os, sys
LINES, COLOUR = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ('cutaway-source-lines.png', 'cutaway-source-colour.png')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'habitat', '')

W, H = 1080, 1400
CX, RAD, GROUND = 540, 510, 560          # the dome: its centre on the ground line, its radius; the ground line
SHAFT = (70, 1010)                       # the dug-in floors' walls
GAP = 0                                  # rooms abut

# the rooms as traced on the drawing handed over (src/views/pages/cutaway.js, MODULES)
ROOMS = {
  'hydro':   [(238, 502), (292, 372), (345, 340), (592, 340), (592, 502)],
  'comms':   [(592, 502), (592, 348), (660, 330), (760, 320), (860, 330), (925, 348), (925, 502)],
  'science': [(925, 502), (925, 345), (1205, 345), (1240, 378), (1262, 502)],
  'kitchen': [(172, 505), (585, 505), (585, 672), (95, 672), (112, 560)],
  'lounge':  [(585, 505), (925, 505), (925, 672), (900, 696), (610, 696), (585, 672)],
  'nap':     [(925, 505), (1150, 505), (1150, 672), (925, 672)],
  'health':  [(1150, 505), (1362, 505), (1426, 560), (1446, 672), (1150, 672)],
  'water':   [(195, 678), (600, 678), (600, 836), (195, 836)],
  'power':   [(915, 690), (1215, 690), (1215, 836), (915, 836)],
}
# the floors, top to bottom: the rooms on each, left to right
FLOORS = [
  { 'rooms': ['comms'], 'crown': True },
  { 'rooms': ['hydro', 'science'] },
  { 'rooms': ['kitchen', 'nap'] },
  { 'rooms': ['lounge', 'health'] },
  { 'rooms': ['water', 'power'] },
]
FILL = {   # the dome's shell inside, the dug-in walls, the ground under the picture — sampled from the drawings
  'lines':  { 'dome': (105, 67, 38), 'wall': (97, 57, 32), 'slab': (235, 232, 228) },
  'colour': { 'dome': (108, 88, 72), 'wall': (90, 62, 44), 'slab': (235, 232, 228) },
}

def bbox(poly):
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)

def cut(src, poly):
    """The room alone: its box from the drawing, everything outside its outline made clear."""
    x0, y0, x1, y1 = bbox(poly)
    tile = src.crop((x0, y0, x1, y1)).convert('RGBA')
    mask = Image.new('L', tile.size, 0)
    ImageDraw.Draw(mask).polygon([(x - x0, y - y0) for x, y in poly], fill=255)
    tile.putalpha(mask)
    return tile

def layout():
    """Where every room goes: its scale and its box on the new picture, floor by floor."""
    placed, y = {}, None
    # the crown: the communication station centred under the apex, a fifth larger
    crown = FLOORS[0]['rooms'][0]
    x0, y0, x1, y1 = bbox(ROOMS[crown]); s = 1.2
    w, h = (x1 - x0) * s, (y1 - y0) * s
    top = GROUND - 220 - h                          # floor B (220 tall) under it, on the ground line
    placed[crown] = { 's': s, 'x': CX - w / 2, 'y': top, 'w': w, 'h': h }
    y = GROUND - 220
    # the floors below, each as wide as the shaft: the rooms share the width by their widths on the drawing
    for f in FLOORS[1:]:
        widths = [bbox(ROOMS[r])[2] - bbox(ROOMS[r])[0] for r in f['rooms']]
        heights = [bbox(ROOMS[r])[3] - bbox(ROOMS[r])[1] for r in f['rooms']]
        s = (SHAFT[1] - SHAFT[0]) / sum(widths)
        fh = max(hh * s for hh in heights)
        x = SHAFT[0]
        for r, ww, hh in zip(f['rooms'], widths, heights):
            w, h = ww * s, hh * s
            placed[r] = { 's': s, 'x': x, 'y': y + fh - h, 'w': w, 'h': h }   # on the floor, the shorter room's ceiling lower
            x += w
        f['y'], f['h'] = y, fh
        y += fh
    return placed, y

def shell(draw, kind):
    """The geodesic shell over the crown: rings of vertices, triangulated, a node at each."""
    rings = [(1.0, 12), (0.8, 9), (0.57, 6), (0.32, 3)]
    pts = []
    for fr, n in rings:
        r = RAD * fr
        pts.append([(CX + r * math.cos(math.pi * k / n), GROUND - r * math.sin(math.pi * k / n)) for k in range(n + 1)])
    apex = [(CX, GROUND - RAD * 0.08)]
    pts.append(apex)
    line = (255, 255, 255, 235) if kind == 'lines' else (245, 242, 238, 235)
    wdt = 3
    for ring in pts[:-1]:
        for a, b in zip(ring, ring[1:]): draw.line([a, b], fill=line, width=wdt)
    for outer, inner in zip(pts, pts[1:]):
        for p in inner:                                   # each inner vertex to its two nearest on the ring outside
            near = sorted(outer, key=lambda q: (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2)[:2 if len(inner) > 1 else 3]
            for q in near: draw.line([p, q], fill=line, width=wdt)
    for ring in pts:
        for p in ring:
            draw.ellipse([p[0] - 6, p[1] - 6, p[0] + 6, p[1] + 6], fill=(255, 255, 255, 255), outline=(200, 200, 200, 255))

def ground(src, kind):
    """The regolith under and beside the habitat, from the drawing's own foot (below the shadow the habitat throws),
    tiled down the picture — every strip flipped against the last and crossfaded into it, so no seam shows."""
    strip = src.crop((0, 868, 1080, 1024)).convert('RGBA')
    sh, fade = strip.height, 36
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ramp = Image.new('L', strip.size, 255)
    rd = ImageDraw.Draw(ramp)
    for i in range(fade): rd.line([(0, i), (W, i)], fill=int(255 * i / fade))
    y, flip = GROUND, False
    while y < H:
        st = strip.transpose(Image.FLIP_LEFT_RIGHT) if flip else strip
        if y == GROUND: g.paste(st, (0, y))
        else:
            piece = st.copy(); piece.putalpha(ramp)
            g.alpha_composite(piece, (0, y))
        y += sh - fade; flip = not flip
    return g

def build(kind, srcpath):
    src = Image.open(srcpath).convert('RGBA')
    fill = FILL[kind]
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    placed, bottom = layout()
    # the regolith below the ground line, with the shaft cut out of it
    g = ground(src, kind)
    cutout = Image.new('L', (W, H), 255)
    ImageDraw.Draw(cutout).rectangle([SHAFT[0], GROUND, SHAFT[1], bottom], fill=0)
    ImageDraw.Draw(cutout).rectangle([0, 0, W, GROUND - 1], fill=0)
    g.putalpha(cutout)
    img.alpha_composite(g)
    # the dome's inside, the dug-in walls
    d = ImageDraw.Draw(img)
    d.pieslice([CX - RAD, GROUND - RAD, CX + RAD, GROUND + RAD], 180, 360, fill=fill['dome'] + (255,))
    d.rectangle([SHAFT[0], GROUND, SHAFT[1], bottom], fill=fill['wall'] + (255,))
    # the shell's wireframe (the rooms go over it, as on the drawing)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shell(ImageDraw.Draw(layer), kind)
    img.alpha_composite(layer)
    # the rooms
    polys = {}
    for r, p in placed.items():
        tile = cut(src, ROOMS[r])
        tw, th = max(1, round(p['w'])), max(1, round(p['h']))
        tile = tile.resize((tw, th), Image.LANCZOS)
        img.alpha_composite(tile, (round(p['x']), round(p['y'])))
        x0, y0 = bbox(ROOMS[r])[:2]
        polys[r] = [[round(p['x'] + (x - x0) * p['s']), round(p['y'] + (y - y0) * p['s'])] for x, y in ROOMS[r]]
    # the floors' slabs and the shaft's walls in white line, the ground line across
    d = ImageDraw.Draw(img)
    for f in FLOORS[1:]:
        d.line([(SHAFT[0], f['y']), (SHAFT[1], f['y'])], fill=fill['slab'] + (255,), width=3)
    d.line([(SHAFT[0], bottom), (SHAFT[1], bottom)], fill=fill['slab'] + (255,), width=4)
    d.line([(SHAFT[0], GROUND), (SHAFT[0], bottom)], fill=fill['slab'] + (255,), width=3)
    d.line([(SHAFT[1], GROUND), (SHAFT[1], bottom)], fill=fill['slab'] + (255,), width=3)
    d.line([(0, GROUND), (W, GROUND)], fill=fill['slab'] + (255,), width=3)
    return img, polys

if __name__ == '__main__':
    out = {}
    for kind, path in (('lines', LINES), ('colour', COLOUR)):
        img, polys = build(kind, path)
        img.save(OUT + f'cutaway-portrait-{kind}.webp', 'WEBP', quality=82, method=6)
        out = polys
    print('const PORTRAIT = {')
    for k in ('hydro', 'comms', 'science', 'kitchen', 'lounge', 'nap', 'health', 'water', 'power'):
        print(f"  {k}: [{', '.join('[%d, %d]' % (x, y) for x, y in out[k])}],")
    print('};')
