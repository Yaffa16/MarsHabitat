#!/usr/bin/env python3
"""
content/missions.json from the sheets in missions/ — one PDF a mission.

    python3 tools/missions-json.py            # reads missions/, writes content/missions.json
    python3 tools/missions-json.py --check    # prints what it would write, writes nothing

Each sheet is one page laid out the same way (MARS! / SCIENTIFIC MISSION): the
mission number at the top right, the title under RED DUST CITY, CENTRAL
QUESTION, three columns headed MORNING, AFTERNOON and EVA, then QUESTION FOR
THE COMMUNITY HOUR (English, then German) beside MATERIAL – WHAT DOES THIS
NEED. The words are read by position — the column a word is in, the line it
is on, the gap to the line before — so each part comes out as the sheet's own
lines: a paragraph as one string, a bullet (•) or a pointer (→) as a line of
its own, a wrapped bullet joined up again.

The mission's NUMBER and TITLE are the file's — MARS_Mission_NN_Title_Words.pdf
— which is how the production numbers them: 00 is the first day's, 15 October,
and they follow the days in sequence to 27 October (`days`, day → number). The
number printed on the sheet itself is kept beside it as `sheetNo` where it
differs (a sheet exported under an older numbering), so the mismatch is plain.

A sheet that is byte for byte another sheet's PDF (a copy standing in for a
sheet still to be written) keeps its title from the file name and carries no
words — `placeholder` names the file it is a copy of — rather than another
mission's text under its name.

Needs pdfplumber (pip install pdfplumber). Not part of the station; a tool,
run again whenever a sheet changes or is added.
"""
import hashlib
import json
import os
import re
import sys

try:
    import pdfplumber
except ImportError:
    sys.exit('pdfplumber is needed: pip install pdfplumber')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MISSIONS = os.path.join(ROOT, 'missions')
OUT = os.path.join(ROOT, 'content', 'missions.json')
CHECK = '--check' in sys.argv

NOTE = ('The scientific missions of MARS! / Red Dust City, one a day, as the sheets in the missions/ folder give them '
        '(MARS_Mission_NN_….pdf, one page each) — written by tools/missions-json.py, which reads every sheet in the folder; '
        'run it again when a sheet changes. `days` says which mission the crew are on each day of the run (day → mission '
        'number): as shipped the sheets follow the days in sequence — 00 on day 1, 15 October, to 12 on day 13, 27 October — '
        'and the Science officer changes a day\'s mission from the desk\'s Science tab, which writes this map. `missions` '
        'carries each sheet\'s words: its number and title (the file\'s — the number printed on the sheet is kept as sheetNo '
        'where it is another), the central question, the Morning, Afternoon and EVA parts as lines (a line in capitals is a '
        'heading, one starting with • a bullet, one starting with → a pointer), the question for the community hour in '
        'English and German as the sheet has them, the material it needs, and the sheet\'s file. A sheet that is a copy of '
        'another\'s PDF (standing in until it is written) keeps its title and carries no words — `placeholder` names the '
        'file it copies. The Today\'s Mission panel at the head of the mission dashboard shows the day\'s mission from here '
        'and links to its sheet at /missions/<file>.')

FILE_RE = re.compile(r'^MARS_Mission_(\d+)_(.+)\.pdf$', re.I)


def title_from_file(stem):
    """Setup_Habitat_After_Touchdown → Setup Habitat After Touchdown (the words as the file spells them)."""
    return re.sub(r'[_\s]+', ' ', stem).strip()


def lines_of(words, pitch):
    """Words → lines (grouped by their top, within a third of the line pitch), each a list of words left to right."""
    out = []
    for w in sorted(words, key=lambda w: (round(w['top']), w['x0'])):
        if out and abs(out[-1]['top'] - w['top']) <= pitch / 3:
            out[-1]['words'].append(w)
        else:
            out.append({'top': w['top'], 'bottom': w['bottom'], 'words': [w]})
    for l in out:
        l['words'].sort(key=lambda w: w['x0'])
        l['text'] = ' '.join(w['text'] for w in l['words']).strip()
        l['bottom'] = max(w['bottom'] for w in l['words'])
    return out


BULLET = re.compile(r'^(•|→|[0-9]+[.)])\s')
CAPS = re.compile(r"^[A-ZÄÖÜ0-9&/'’!?.:,;()-]*[A-ZÄÖÜ]{2}[A-ZÄÖÜ0-9&/'’!?.:,;()-]*$")
ENDS = re.compile(r'[.?!:…]["”’)]*$')
# glyphs the sheets' fonts leave unnamed: the ff ligature in "coffee", the Symbol font's bullet
CIDS = {'(cid:431)': 'ff', '\uf0b7': '•'}


def caps_words(text):
    """The words of a line that carry letters, after any numbering (3. TRUST PROTOCOL → TRUST, PROTOCOL)."""
    return [w for w in re.sub(r'^[0-9]+[.)]\s*', '', text).split() if re.search(r'[A-Za-zÄÖÜäöü]', w)]


def heading(text):
    """A line set in capitals — MARS DICTIONARY, 3. TRUST PROTOCOL, THE OTHER POINT OF VIEW – creative writing,
    CLAIMING / REDIRECTING SPACE — is a heading: its first two words are in capitals, or it is one word in them."""
    ws = caps_words(text)
    if not ws or not CAPS.match(ws[0]):
        return False
    return len(ws) == 1 or bool(CAPS.match(ws[1]))


def caps_tail(text):
    """The line ends in a word in capitals (… THE MARKETPLACE AS), so a line in capitals after it carries on."""
    ws = caps_words(text)
    return bool(ws) and bool(CAPS.match(ws[-1]))


def paragraphs(lines, pitch, by_gap_only=False):
    """Lines → the sheet's own lines. A blank line (a gap half again the line pitch) parts paragraphs everywhere;
    otherwise — unless `by_gap_only` (the community hour's question, English then German) — a bullet (•), a pointer
    (→) or a numbered line is a line of its own, taking the wrapped lines that continue it; a heading stands alone,
    its own wrapped words joined back to it; a sentence that ends on a line (. ? ! :) and a capital letter beginning
    the next make a new line; the rest is the lines of one paragraph joined up."""
    steps = [b['top'] - a['top'] for a, b in zip(lines, lines[1:]) if b['top'] - a['top'] > 2]
    line_pitch = min(steps) if steps else pitch
    out = []                                    # [text, is_heading]
    prev = None
    for l in lines:
        text = l['text']
        blank = prev is not None and (l['top'] - prev['top']) > line_pitch * 1.45
        if prev is None or blank:
            out.append([text, heading(text)])
            prev = l
            continue
        last = out[-1]
        first = caps_words(text)[0] if caps_words(text) else text
        if by_gap_only:
            join = True
        elif last[1] and not BULLET.match(text) and first[:1].islower():
            join = True                         # a heading's wrapped words
        elif caps_tail(prev['text']) and heading(text) and not BULLET.match(text):
            join = True                         # a run of capitals carries on (THE MARKETPLACE AS / RESOURCE)
        elif BULLET.match(text) or heading(text) or last[1] or (ENDS.search(prev['text']) and re.match(r'^[A-ZÄÖÜ0-9“"(]', text)):
            join = False
        else:
            join = True
        if join:
            # a word broken at the line's end (meaning- / making) is made whole; a dash standing free is kept
            last[0] = (last[0] + text if re.search(r'\S-$', last[0]) else last[0] + ' ' + text).strip()
        else:
            out.append([text, heading(text)])
        prev = l
    return [re.sub(r'\s+', ' ', p[0]).strip() for p in out if p[0].strip()]


ENGLISH = re.compile(r'\b(you|your|the|we|what|how|are|is|do|would|which|where|when|a|of)\b', re.I)


def german(text):
    return bool(re.search(r'[äöüß]|\b(du|dein|deine|wie|ist|nicht|und|der|die|das|wir|ihr)\b', text, re.I))


def parse(path):
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[0]
        words = page.extract_words(extra_attrs=['fontname', 'size'], keep_blank_chars=False)
    for w in words:
        for cid, glyph in CIDS.items():
            w['text'] = w['text'].replace(cid, glyph)
        if '(cid:' in w['text']:
            print(f'note: {os.path.basename(path)}: an unnamed glyph in "{w["text"]}" — add it to CIDS in tools/missions-json.py', file=sys.stderr)
    body = [w for w in words if w['size'] < 8]                      # the columns' type
    pitch = 1.08 * (max((w['size'] for w in body), default=7))        # the line pitch of the columns' type
    allines = lines_of(words, pitch)
    find = lambda text: next((l for l in allines if l['text'].upper().startswith(text)), None)   # noqa: E731
    word = lambda text, above=None: next((w for w in sorted(words, key=lambda w: w['top'])          # noqa: E731
                                          if w['text'].upper() == text and w['size'] >= 8 and (above is None or w['top'] > above)), None)
    cq = find('CENTRAL QUESTION')
    morning, afternoon, eva = word('MORNING'), word('AFTERNOON'), word('EVA')
    comm = find('QUESTION FOR THE COMMUNITY')
    foot = find('RED DUST SOCIETY')
    if not (cq and morning and afternoon and eva and comm and foot):
        raise ValueError('not laid out as a mission sheet (CENTRAL QUESTION / MORNING / AFTERNOON / EVA / QUESTION FOR THE COMMUNITY HOUR / footer)')
    y_cols = max(morning['bottom'], afternoon['bottom'], eva['bottom'])
    mat = next((w for w in words if w['text'].upper().startswith('MATERIAL') and abs(w['top'] - comm['top']) < pitch), None)
    x_mat = mat['x0'] if mat else page.width * 0.55
    # the number printed on the sheet (large, top right) and the title (large, left, between RED DUST CITY and CENTRAL QUESTION)
    sheet_no = ' '.join(w['text'] for w in words if w['size'] >= 12 and w['x0'] > page.width * 0.8 and w['top'] < cq['top'])
    title_words = [w for w in words if w['size'] >= 12 and w['x0'] < page.width * 0.5 and w['top'] < cq['top']
                   and not w['fontname'].endswith('F3')]
    title = ' '.join(w['text'] for w in sorted(title_words, key=lambda w: (round(w['top']), w['x0'])))
    between = lambda a, b: [w for w in words if a < w['top'] < b]   # noqa: E731
    question = ' '.join(l['text'] for l in lines_of(between(cq['bottom'] - 1, morning['top'] - 1), pitch))
    col_words = between(y_cols - 1, comm['top'] - 1)
    col = lambda lo, hi: paragraphs(lines_of([w for w in col_words if lo <= w['x0'] < hi], pitch), pitch)   # noqa: E731
    parts = col(0, afternoon['x0'] - 4), col(afternoon['x0'] - 4, eva['x0'] - 4), col(eva['x0'] - 4, page.width)
    low_words = between(comm['bottom'] - 1, foot['top'] - 1)
    community = paragraphs(lines_of([w for w in low_words if w['x0'] < x_mat - 4], pitch), pitch, by_gap_only=True)
    materials = ' '.join(paragraphs(lines_of([w for w in low_words if w['x0'] >= x_mat - 4], pitch), pitch, by_gap_only=True))
    # English, then German: parted by a blank line on the sheet; set in one block, parted where a German sentence begins
    en, de = '', ''
    if len(community) >= 2:
        en, de = community[0], ' '.join(community[1:])
    elif community:
        sentences = re.split(r'(?<=[.?!])\s+', community[0])
        cut = next((i for i in range(1, len(sentences)) if german(' '.join(sentences[i:])) and not ENGLISH.search(' '.join(sentences[i:]))), None)
        if cut is not None:
            en, de = ' '.join(sentences[:cut]), ' '.join(sentences[cut:])
        elif german(community[0]) and not ENGLISH.search(community[0]):
            de = community[0]
        else:
            en = community[0]
    return {
        'sheetNo': sheet_no.strip(), 'sheetTitle': title.strip(), 'question': re.sub(r'\s+', ' ', question).strip(),
        'morning': parts[0], 'afternoon': parts[1], 'eva': parts[2],
        'community': {'en': en.strip(), 'de': de.strip()},
        'materials': materials.strip(),
    }


def main():
    files = sorted((f for f in os.listdir(MISSIONS) if FILE_RE.match(f)), key=lambda f: int(FILE_RE.match(f).group(1)))
    if not files:
        sys.exit(f'no MARS_Mission_NN_….pdf in {MISSIONS}')
    digests = {}
    for f in files:
        with open(os.path.join(MISSIONS, f), 'rb') as fh:
            digests[f] = hashlib.sha256(fh.read()).hexdigest()
    # two sheets under one number (a copy left behind under an old name — 9 October: MARS_Mission_00_Energy_Budget.pdf, a
    # copy of the Energy Budget sheet, beside the written MARS_Mission_00_Setup_Habitat_After_Touchdown.pdf): the one that
    # is no copy of another sheet is the mission; the others are left out, with a note to take them out of the folder —
    # read, a copy titled as its original would pass for it, and the original for its copy
    left_out = []
    for n in sorted({int(FILE_RE.match(f).group(1)) for f in files}):
        same_no = [f for f in files if int(FILE_RE.match(f).group(1)) == n]
        if len(same_no) < 2:
            continue
        own = [f for f in same_no if sum(1 for g in files if digests[g] == digests[f]) == 1]
        keep = (own or same_no)[0]
        left_out += [(f, keep) for f in same_no if f != keep]
    files = [f for f in files if f not in {f for f, _ in left_out}]
    # the title printed on each sheet, to tell a copy from its original
    parsed_titles = {}
    for f in files:
        try:
            parsed_titles[f] = parse(os.path.join(MISSIONS, f))['sheetTitle']
        except Exception:                                           # noqa: BLE001
            parsed_titles[f] = None
    missions, problems = [], [f'{f} left out: {keep} is the sheet numbered {FILE_RE.match(f).group(1)} — take {f} out of missions/'
                              for f, keep in left_out]
    for f in files:
        m = FILE_RE.match(f)
        no, title = int(m.group(1)), title_from_file(m.group(2))
        # a copy of another sheet: of the files with the same bytes, the sheet is the one whose file is titled as the
        # sheet itself is (its printed title); the others stand in for sheets still to be written
        twins = [g for g in files if digests[g] == digests[f]]
        original = f
        if len(twins) > 1:
            printed = (parsed_titles.get(f) or '')
            same = lambda a, b: re.sub(r'[^a-z0-9]+', '', a.lower()) == re.sub(r'[^a-z0-9]+', '', b.lower())   # noqa: E731
            original = next((g for g in twins if same(title_from_file(FILE_RE.match(g).group(2)), printed)), twins[0])
        entry = {'no': no, 'title': title, 'file': f}
        if original != f:
            entry['placeholder'] = original
            entry.update({'question': '', 'morning': [], 'afternoon': [], 'eva': [], 'community': {'en': '', 'de': ''}, 'materials': ''})
            problems.append(f'{f} is a copy of {original} — its words are left empty until the sheet is written')
            missions.append(entry)
            continue
        try:
            p = parse(os.path.join(MISSIONS, f))
        except Exception as e:                                      # noqa: BLE001
            problems.append(f'{f}: {e}')
            entry.update({'question': '', 'morning': [], 'afternoon': [], 'eva': [], 'community': {'en': '', 'de': ''}, 'materials': ''})
            missions.append(entry)
            continue
        if p['sheetNo'] and p['sheetNo'] != str(no) and p['sheetNo'] != f'{no:02d}':
            entry['sheetNo'] = p['sheetNo']
        entry.update({k: p[k] for k in ('question', 'morning', 'afternoon', 'eva', 'community', 'materials')})
        missions.append(entry)
    # the days: the sheets in the file's order, 00 on day 1 — thirteen days, as many sheets as there are
    days = {str(i + 1): m['no'] for i, m in enumerate(missions[:13])}
    out = {'_note': NOTE, 'days': days, 'missions': missions}
    text = json.dumps(out, ensure_ascii=False, indent=2) + '\n'
    if CHECK:
        sys.stdout.write(text)
    else:
        with open(OUT, 'w', encoding='utf-8') as fh:
            fh.write(text)
        print(f'{OUT}: {len(missions)} missions from {len(files)} sheets, days 1–{len(days)} mapped')
    for p in problems:
        print('note:', p, file=sys.stderr)


if __name__ == '__main__':
    main()
