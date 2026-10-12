#!/usr/bin/env python3
"""The crew's portraits and the partners' logos for the About page (Who we are — src/views/pages/info.js).

The portraits come from public/Astronaut_Pictures — the photographs as they were handed over, 3644 × 5466, one per
person, each named Firstname_Lastname.jpg (a hyphen in a surname stays: Matthieu_Vlaminck-Maurer.jpg) — and go to
public/crew/<lastname>.jpg at 800 × 1200 (the same 2:3, fitted, a little above the middle so a face is never cut),
JPEG at quality 80, 70–90 kB each. A member of the crew with one name only — the habitat's robot dog, Robodog.jpg
(8 October: "add the robot dog in the astronaut pictures") — is named by that one name and stands after the people.
With them public/crew/crew.json: the people in the order of their surnames, then those with one name, each with the
picture's file and the names as the file name gives them — the page reads that list, so a photograph added to the
folder needs only this script run again. A file named any other way is left out and said so.

The round pictures — Current Crew on the About page and over the landing page's two calls (src/views/pages/sol.js) —
are close-ups of their own, public/crew/face/<lastname>.jpg at 400 × 400 (12 October: "when the images are shown as
icons, it scales weirdly"): one square cut of the photograph had put every face elsewhere — high, low, small — since each
photograph frames its person at its own height. Each square is now cut round the face, so that every face is the same
size, its eyes at the same height (40 % from the top), the head and the shoulders in: FACES below, found from the eyes
(the square's side 5.8 times the distance between them; the robot dog's set by hand — its head, its crate, its dish). A
photograph FACES does not name is looked at for its face with OpenCV, if that is installed (pip install
opencv-python-headless), else cut from a guess; either way the script says which, and prints the line to add to FACES.

The logos come from public/PartnerLogo — 1.jpeg to 5.jpg, in the order the folder gives them — and go to
public/partners/<name>.png as RGB or RGBA PNGs at their own size (none is over 100 px tall; the first is a CMYK JPEG,
which a browser would show with its colours off). The page shows 1 and 2 as "In cooperation with" and 3 to 5 as
"Supporters", each on a white tile, small (PARTNERS in info.js).

    python3 tools/crew-pictures.py          # from the repository's root; needs Pillow — all three: portraits, faces, logos
    python3 tools/crew-pictures.py faces    # the round pictures alone
"""
import json, os, re, sys, unicodedata
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICTURES = os.path.join(ROOT, 'public', 'Astronaut_Pictures')
LOGOS = os.path.join(ROOT, 'public', 'PartnerLogo')
CREW = os.path.join(ROOT, 'public', 'crew')
PARTNERS = os.path.join(ROOT, 'public', 'partners')
LOGO_NAMES = {'1.jpeg': 'staatstheater-karlsruhe', '2.png': 'naturkundemuseum-karlsruhe', '3.png': 'eon-foundation', '4.jpg': 'lbbw-stiftung', '5.jpg': 'innovationsfonds-kunst'}
FACE = os.path.join(CREW, 'face')
FACE_SIZE = 400                       # the round pictures are 52–104 px across: 400 is sharp on a screen of three pixels to the point

# Where the round picture is cut from each photograph: the square's middle — across, down — and its side, as fractions of
# the photograph's width, height and width. Found from the eyes (OpenCV's Haar cascades, 12 October): the side 5.8 times
# the distance between the eyes, the eyes 40 % from the square's top, in the middle across. The robot dog by hand.
FACES = {
    'Bernd_Lintermann.jpg': (0.4262, 0.3110, 0.7513),
    'Dan_Wilcox.jpg': (0.4487, 0.3188, 0.7704),
    'Dominik_Kautz.jpg': (0.4056, 0.2933, 0.7608),
    'Finn_Milbrandt.jpg': (0.4643, 0.3219, 0.7115),
    'Franziska_Klöck.jpg': (0.4479, 0.2821, 0.6478),
    'Götz_Dipper.jpg': (0.4616, 0.3124, 0.7258),
    'Jan_Gerigk.jpg': (0.4665, 0.3657, 0.7576),
    'Laura_Schmidt.jpg': (0.5071, 0.2670, 0.6876),
    'Matthieu_Vlaminck-Maurer.jpg': (0.4514, 0.3237, 0.7194),
    'Morgan_Stricot.jpg': (0.4234, 0.2766, 0.7624),
    'Till_Bechtloff.jpg': (0.4742, 0.3433, 0.7306),
    'Tina_Lorenz.jpg': (0.4780, 0.3824, 0.8452),
    'Yasha_Jain.jpg': (0.4619, 0.3142, 0.7672),
    'Robodog.jpg': (0.5200, 0.3400, 0.8000),        # its head, its crate and its dish
}
EYES_SIDE, EYES_AT = 5.8, 0.40         # (how FACES was found, for a photograph it does not name yet)


def person(filename):
    """'Bernd_Lintermann.jpg' -> ('Bernd', 'Lintermann'); 'Matthieu_Vlaminck-Maurer.jpg' -> ('Matthieu', 'Vlaminck-Maurer');
    one name alone — 'Robodog.jpg' — -> ('Robodog', ''); else None."""
    m = re.match(r'^([^_]+)_([^_]+)\.jpe?g$', filename, re.I)
    if m: return (m.group(1), m.group(2))
    m = re.match(r'^([^_.]+)\.jpe?g$', filename, re.I)
    return (m.group(1), '') if m else None


def slug(name):
    """A file name from a surname: ASCII, lower case, hyphens kept — 'Vlaminck-Maurer' -> 'vlaminck-maurer', 'Müller' -> 'mueller'."""
    s = name.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss').replace('Ä', 'Ae').replace('Ö', 'Oe').replace('Ü', 'Ue')
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9-]+', '-', s.lower()).strip('-')


def portraits():
    os.makedirs(CREW, exist_ok=True)
    people = []
    for f in sorted(os.listdir(PICTURES)):
        who = person(f)
        if not who: print('left out (not Firstname_Lastname.jpg):', f); continue
        first, last = who
        im = ImageOps.exif_transpose(Image.open(os.path.join(PICTURES, f))).convert('RGB')
        im = ImageOps.fit(im, (800, 1200), Image.LANCZOS, centering=(0.5, 0.4))
        name = slug(last or first) + '.jpg'
        im.save(os.path.join(CREW, name), 'JPEG', quality=80, optimize=True, progressive=True)
        people.append({'file': name, 'first': first, 'last': last})
        print(os.path.join(CREW, name), os.path.getsize(os.path.join(CREW, name)) // 1024, 'kB')
    people.sort(key=lambda x: (0 if x['last'] else 1, locale_key(x['last'] or x['first']), locale_key(x['first'])))
    with open(os.path.join(CREW, 'crew.json'), 'w', encoding='utf-8') as out:
        json.dump(people, out, ensure_ascii=False, indent=2); out.write('\n')
    print(os.path.join(CREW, 'crew.json'), len(people), 'in all, by surname, those with one name after them')


def faces():
    """The round pictures: each photograph's square round the face (FACES; else found, else guessed), at 400 × 400."""
    os.makedirs(FACE, exist_ok=True)
    for f in sorted(os.listdir(PICTURES)):
        who = person(f)
        if not who: continue
        im = ImageOps.exif_transpose(Image.open(os.path.join(PICTURES, f))).convert('RGB')
        w, h = im.size
        box, how = FACES.get(unicodedata.normalize('NFC', f)), 'from FACES'        # (Klöck: however the disk spells the ö)
        if box is None:
            box, how = find_face(im), 'found from the eyes'
        if box is None:
            box, how = (0.5, 0.32, 0.75), 'GUESSED — look at it, and set it in FACES'
        cx, cy, side = box
        s = min(side * w, w, h)                                      # the square, kept inside the photograph
        x = min(max(cx * w - s / 2, 0), w - s); y = min(max(cy * h - s / 2, 0), h - s)
        sq = im.crop((round(x), round(y), round(x + s), round(y + s))).resize((FACE_SIZE, FACE_SIZE), Image.LANCZOS)
        out = os.path.join(FACE, slug(who[1] or who[0]) + '.jpg')
        sq.save(out, 'JPEG', quality=80, optimize=True, progressive=True)
        print(out, os.path.getsize(out) // 1024, 'kB,', how)
        if unicodedata.normalize('NFC', f) not in FACES: print("    for FACES:  %r: (%.4f, %.4f, %.4f)," % (f, cx, cy, side))


def find_face(im):
    """The square round the face in a photograph FACES does not name, as FACES has them — from the eyes, found with
    OpenCV's cascades (the largest face, then the two eyes in its upper part); None without OpenCV, or with no face."""
    try:
        import cv2, numpy
    except ImportError:
        print('    (OpenCV is not installed: pip install opencv-python-headless — to find the face)')
        return None
    w, h = im.size
    k = 1366 / h
    grey = cv2.cvtColor(numpy.array(im.resize((round(w * k), 1366))), cv2.COLOR_RGB2GRAY)
    face = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
    found = face.detectMultiScale(grey, scaleFactor=1.03, minNeighbors=5, minSize=(round(0.15 * w * k),) * 2)
    if not len(found): return None
    fx, fy, fs, _ = (int(v) / k for v in max(found, key=lambda b: b[2]))     # the face's box, in the photograph's pixels
    # the eyes, looked for in the upper part of the box at the photograph's own sharpness, brought to 600 px across
    upper = cv2.cvtColor(numpy.array(im.crop((round(fx), round(fy), round(fx + fs), round(fy + fs * 0.62)))), cv2.COLOR_RGB2GRAY)
    upper = cv2.resize(upper, (600, round(upper.shape[0] * 600 / fs)))
    eyes = []
    for name in ('haarcascade_eye_tree_eyeglasses.xml', 'haarcascade_eye.xml'):
        eyes += list(cv2.CascadeClassifier(cv2.data.haarcascades + name).detectMultiScale(upper, scaleFactor=1.05, minNeighbors=8, minSize=(50, 50), maxSize=(200, 200)))
    mid = lambda e: (e[0] + e[2] / 2, e[1] + e[3] / 2)
    pairs = [(abs(mid(a)[1] - mid(b)[1]), a, b) for a in eyes for b in eyes
             if mid(a)[0] < 300 <= mid(b)[0] and mid(b)[0] - mid(a)[0] > 150 and abs(mid(a)[1] - mid(b)[1]) < 72]
    if not pairs:                                                # no eyes: from the face's box as it was found
        ex, ey, apart = fx + fs / 2, fy + fs * 0.42, fs * 0.36
    else:
        _, a, b = min(pairs, key=lambda p: p[0])
        ex = fx + (mid(a)[0] + mid(b)[0]) / 2 * fs / 600; ey = fy + (mid(a)[1] + mid(b)[1]) / 2 * fs / 600
        apart = (mid(b)[0] - mid(a)[0]) * fs / 600
    side = EYES_SIDE * apart
    return (ex / w, (ey - EYES_AT * side + side / 2) / h, side / w)


def locale_key(s):
    """Surnames in alphabetical order with their accents folded (Ö beside O), as a German or English list would have them."""
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii').lower()


def logos():
    os.makedirs(PARTNERS, exist_ok=True)
    for f, name in LOGO_NAMES.items():
        src = os.path.join(LOGOS, f)
        if not os.path.exists(src): print('missing', src); continue
        im = Image.open(src)
        im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
        out = os.path.join(PARTNERS, name + '.png')
        im.save(out, 'PNG', optimize=True)
        print(out, im.size, os.path.getsize(out) // 1024, 'kB')


if __name__ == '__main__':
    what = sys.argv[1:] or ['portraits', 'faces', 'logos']
    if 'portraits' in what: portraits()
    if 'faces' in what: faces()
    if 'logos' in what: logos()
