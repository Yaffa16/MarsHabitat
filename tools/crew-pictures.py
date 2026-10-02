#!/usr/bin/env python3
"""The crew's portraits and the partners' logos for the About page (Who we are — src/views/pages/info.js).

The portraits come from public/Astronaut_Pictures — the photographs as they were handed over, 3644 × 5466, one per
person, each named Firstname_Lastname.jpg (a hyphen in a surname stays: Matthieu_Vlaminck-Maurer.jpg) — and go to
public/crew/<lastname>.jpg at 800 × 1200 (the same 2:3, fitted, a little above the middle so a face is never cut),
JPEG at quality 80, 70–90 kB each. With them public/crew/crew.json: the people in the order of their surnames, each with
the picture's file and the two names as the file name gives them — the page reads that list, so a photograph added to
the folder needs only this script run again. A file named any other way is left out and said so.

The logos come from public/PartnerLogo — 1.jpeg to 5.jpg, in the order the folder gives them — and go to
public/partners/<name>.png as RGB or RGBA PNGs at their own size (none is over 100 px tall; the first is a CMYK JPEG,
which a browser would show with its colours off). The page shows 1 and 2 as "In cooperation with" and 3 to 5 as
"Supporters", each on a white tile, small (PARTNERS in info.js).

    python3 tools/crew-pictures.py          # from the repository's root; needs Pillow
"""
import json, os, re, sys, unicodedata
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICTURES = os.path.join(ROOT, 'public', 'Astronaut_Pictures')
LOGOS = os.path.join(ROOT, 'public', 'PartnerLogo')
CREW = os.path.join(ROOT, 'public', 'crew')
PARTNERS = os.path.join(ROOT, 'public', 'partners')
LOGO_NAMES = {'1.jpeg': 'staatstheater-karlsruhe', '2.png': 'naturkundemuseum-karlsruhe', '3.png': 'eon-foundation', '4.jpg': 'lbbw-stiftung', '5.jpg': 'innovationsfonds-kunst'}


def person(filename):
    """'Bernd_Lintermann.jpg' -> ('Bernd', 'Lintermann'); 'Matthieu_Vlaminck-Maurer.jpg' -> ('Matthieu', 'Vlaminck-Maurer'); else None."""
    m = re.match(r'^([^_]+)_([^_]+)\.jpe?g$', filename, re.I)
    return (m.group(1), m.group(2)) if m else None


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
        name = slug(last) + '.jpg'
        im.save(os.path.join(CREW, name), 'JPEG', quality=80, optimize=True, progressive=True)
        people.append({'file': name, 'first': first, 'last': last})
        print(os.path.join(CREW, name), os.path.getsize(os.path.join(CREW, name)) // 1024, 'kB')
    people.sort(key=lambda x: (locale_key(x['last']), locale_key(x['first'])))
    with open(os.path.join(CREW, 'crew.json'), 'w', encoding='utf-8') as out:
        json.dump(people, out, ensure_ascii=False, indent=2); out.write('\n')
    print(os.path.join(CREW, 'crew.json'), len(people), 'people, by surname')


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
    what = sys.argv[1:] or ['portraits', 'logos']
    if 'portraits' in what: portraits()
    if 'logos' in what: logos()
