#!/usr/bin/env python3
"""
The habitat in section — the linework of public/habitat/inside.svg, traced
from the picture handed over (the cutaway of Red Dust City: white lines on
Mars-brown paper, 1536 x 1024).

    python3 tools/trace-inside.py path/to/cutaway.png public/habitat/inside.svg

Only the lines are kept: every pixel brighter than LINE (the lines are a
warm white, the paper and the hatching inside the rooms are brown), specks
smaller than SPECK pixels dropped, then traced into filled paths with
potrace (pip install potracer). The paths are sorted into one group per
room — by the room's outline in ROOMS, the same outlines the page uses for
its keys (src/views/pages/inside.js) — and one for everything else (the
shell, the struts, the ground), each with an id; the page draws the whole
drawing with <use href="/habitat/inside.svg#ink">. Every path is filled with
currentColor, so the page decides the colour of the lines.
"""
import sys
import numpy as np
from PIL import Image
import cv2
import potrace

LINE = 170     # luminance a pixel must reach to count as a line
SPECK = 12     # the smallest patch of line kept, in pixels

# the rooms, in the picture's own coordinates — keep in step with ROOMS in src/views/pages/inside.js
ROOMS = {
    'aeroponics': [(330, 357), (540, 357), (572, 392), (572, 485), (540, 517), (330, 517), (296, 485), (296, 392)],
    'comms':      [(588, 350), (612, 322), (690, 290), (766, 278), (842, 290), (920, 322), (942, 350), (942, 452), (915, 478), (614, 478), (588, 452)],
    'science':    [(990, 357), (1210, 357), (1255, 392), (1255, 485), (1210, 517), (990, 517), (960, 485), (960, 392)],
    'health':     [(255, 530), (540, 530), (600, 585), (600, 650), (560, 695), (255, 695), (220, 650), (220, 585)],
    'crew':       [(610, 515), (935, 515), (975, 560), (975, 660), (935, 710), (610, 710), (600, 650), (600, 585)],
    'nap':        [(1050, 530), (1270, 530), (1300, 565), (1300, 660), (1270, 695), (1050, 695), (1020, 660), (1020, 565)],
    'recycling':  [(395, 728), (690, 728), (725, 775), (660, 862), (285, 862), (330, 775)],
    'power':      [(870, 728), (1138, 728), (1199, 790), (1199, 862), (860, 862), (830, 775)],
}
MARGIN = 16    # a path counts as a room's when its box lies inside the room's box, this much out


def fmt(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s


def trace(src):
    im = np.array(Image.open(src).convert('RGB')).astype(np.float32)
    lines = (im.mean(2) > LINE).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(lines, 8)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= SPECK
    mask = keep[lab]
    # potracer: False is the foreground
    path = potrace.Bitmap(~mask).trace(turdsize=6, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                                       alphamax=1.0, opticurve=True, opttolerance=0.2)
    # one entry per outer contour, its holes (the inside edge of a thick line, say) carried with it, so a room's
    # outline and the hole it encloses are never sorted into different groups. potrace draws outer contours and
    # holes in opposite directions: the sign of a contour's area says which it is, and a hole belongs to the
    # smallest outer contour whose box holds its box.
    def curve_d(curve):
        sp = curve.start_point
        d = [f'M{fmt(sp.x)} {fmt(sp.y)}']
        pts = [(sp.x, sp.y)]
        for s in curve.segments:
            if s.is_corner:
                d.append(f'L{fmt(s.c.x)} {fmt(s.c.y)}L{fmt(s.end_point.x)} {fmt(s.end_point.y)}')
                pts.append((s.c.x, s.c.y))
            else:
                d.append(f'C{fmt(s.c1.x)} {fmt(s.c1.y)} {fmt(s.c2.x)} {fmt(s.c2.y)} {fmt(s.end_point.x)} {fmt(s.end_point.y)}')
            pts.append((s.end_point.x, s.end_point.y))
        d.append('Z')
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2
        return ''.join(d), (min(xs), min(ys), max(xs), max(ys)), area

    curves = [curve_d(c) for c in path]
    biggest = max(curves, key=lambda c: abs(c[2]))
    outer_sign = 1 if biggest[2] > 0 else -1          # the dome's outline is an outer contour
    outers = [c for c in curves if (c[2] > 0) == (outer_sign > 0)]
    holes = [c for c in curves if (c[2] > 0) != (outer_sign > 0)]

    def inside(a, b):   # box a within box b
        return a[0] >= b[0] and a[1] >= b[1] and a[2] <= b[2] and a[3] <= b[3]

    units = {id(o): [o[0]] for o in outers}
    for h in holes:
        parents = [o for o in outers if inside(h[1], o[1])]
        parent = min(parents, key=lambda o: abs(o[2])) if parents else None
        if parent is None:
            outers.append(h)
            units[id(h)] = [h[0]]
        else:
            units[id(parent)].append(h[0])
    out = [(' '.join(units[id(o)]), o[1]) for o in outers]
    return out, im.shape[1], im.shape[0]


def room_of(box):
    x0, y0, x1, y1 = box
    for rid, poly in ROOMS.items():
        rx0, ry0 = min(p[0] for p in poly) - MARGIN, min(p[1] for p in poly) - MARGIN
        rx1, ry1 = max(p[0] for p in poly) + MARGIN, max(p[1] for p in poly) + MARGIN
        if x0 >= rx0 and y0 >= ry0 and x1 <= rx1 and y1 <= ry1:
            return rid
    return None


def main(src, dst):
    curves, w, h = trace(src)
    groups = {'shell': []}
    for rid in ROOMS:
        groups[rid] = []
    for d, box in curves:
        groups[room_of(box) or 'shell'].append(d)
    parts = [f'<path id="shell" d="{" ".join(groups["shell"])}"/>']
    for rid in ROOMS:
        parts.append(f'<path id="r-{rid}" d="{" ".join(groups[rid])}"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="currentColor">\n'
           f'<title>The habitat in section: its rooms under the dome</title>\n'
           f'<!-- traced by tools/trace-inside.py: the whole drawing is #ink (the page draws it with <use>), inside it one path per room (r-<id>) and one for the shell, the struts and the ground -->\n'
           f'<g id="ink" fill="currentColor">\n' + '\n'.join(parts) + '\n</g>\n</svg>\n')
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f'{dst}: {len(curves)} paths — ' + ', '.join(f'{k} {len(v)}' for k, v in groups.items()) + f' — {len(svg)} bytes')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
