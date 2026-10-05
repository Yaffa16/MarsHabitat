#!/usr/bin/env python3
"""The galaxy the landing page's words are cut out of (public/space/galaxy.jpg, 1800 × 300): a spiral galaxy seen at a
tilt — a bright core, two arms broken into clouds, dust lanes, blue knots of young stars and pink ones of hydrogen — on a
field of violet drift and stars. Drawn here, with numpy and Pillow, nothing photographed. Run it again to redraw (the
seeds fix the picture); the stylesheet cuts APPROVED MESSAGES ARE BEAMED INTO SPACE out of it (sheet.css, call-galaxy)."""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageChops

W, H = 1800, 300
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'space', 'galaxy.jpg')


def noise(w, h, octaves=6, persistence=0.55, base=4, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w), dtype=np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        gw, gh = base * 2 ** o, max(1, int(base * 2 ** o * h / w))
        g = r.random((gh + 1, gw + 1)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += amp * (np.asarray(im).astype(np.float32) / 255.0); tot += amp; amp *= persistence
    return out / tot


def lerp(a, b, t):
    return a + (b - a) * t[..., None]


def main():
    rng = np.random.default_rng(11)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W * 0.5, H * 0.5
    ang = -0.3
    dx, dy = xx - cx, (yy - cy) * 2.0                                   # seen at a tilt
    rx = dx * np.cos(ang) - dy * np.sin(ang); ry = dx * np.sin(ang) + dy * np.cos(ang)
    r = np.sqrt(rx ** 2 + ry ** 2) + 1e-3; th = np.arctan2(ry, rx)
    R = W * 0.2
    arms = 1 + 0.9 * np.cos(2 * th - 2.4 * np.log(r / 40 + 1))           # two arms
    disc = np.exp(-r / R) * arms * (0.5 + 1.0 * noise(W, H, 6, 0.55, 6, 3))
    dust = np.clip((noise(W, H, 5, 0.5, 9, 5) - 0.52) * 3, 0, 1) * np.exp(-r / (R * 1.1))
    core = np.exp(-(r / (W * 0.03)) ** 2) * 0.75 + np.exp(-(r / (W * 0.09)) ** 2) * 0.35
    halo = np.exp(-r / (R * 1.7)) * 0.2
    d = np.clip(disc * 0.8 + core + halo - dust * 0.5, 0, 1.3)
    field = noise(W, H, 5, 0.5, 3, 9)
    c0 = np.array([9, 6, 30]); c1 = np.array([40, 24, 104]); c2 = np.array([104, 60, 200]); c3 = np.array([205, 130, 235]); c4 = np.array([255, 243, 230])
    t = np.clip(d, 0, 1)
    col = np.where(t[..., None] < .3, lerp(c0, c1, t / .3), np.where(t[..., None] < .6, lerp(c1, c2, (t - .3) / .3), np.where(t[..., None] < .9, lerp(c2, c3, (t - .6) / .3), lerp(c3, c4, np.clip((t - .9) / .1, 0, 1)))))
    blue = np.clip(arms - 1.2, 0, 1) * np.exp(-r / R) * np.clip(noise(W, H, 4, 0.5, 12, 13) - 0.4, 0, 1) * 2.2
    col = col + blue[..., None] * np.array([40, 120, 255])
    pink = np.clip(noise(W, H, 4, 0.5, 16, 17) - 0.6, 0, 1) * 4 * np.exp(-r / R) * np.clip(arms - 0.9, 0, 1)
    col = col + pink[..., None] * np.array([255, 80, 170])
    col = col + (field[..., None] - 0.5) * np.array([14, 26, 70])
    im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), 'RGB').filter(ImageFilter.GaussianBlur(0.7))
    star = Image.new('RGB', (W, H), (0, 0, 0)); sp = star.load()
    pts = rng.random((1600, 2)) * [W, H]; br = rng.random(1600)
    for (x, y), b in zip(pts, br):
        x, y = int(x), int(y); v = int(120 + 135 * b)
        sp[x, y] = (v, v, min(255, v + 12))
        if b > .9:
            for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= x + ddx < W and 0 <= y + ddy < H: sp[x + ddx, y + ddy] = (v // 2, v // 2, v // 2)
    halo_s = star.filter(ImageFilter.GaussianBlur(2.2))
    im = ImageChops.add(im, star); im = ImageChops.add(im, halo_s.point(lambda p: p // 2))
    im.save(OUT, quality=86, optimize=True)
    print(OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
