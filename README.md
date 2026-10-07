# MARS Communication Station

A live communication interface between an Earth-based audience and the crew of the MARS
habitat. ZKM | Hertzlab.

One container. No external database, no build step, no CDN, no third-party scripts. It runs
on a laptop in a gallery with the network unplugged, which is the condition it was built for.

---

## Run it

```bash
docker compose up --build
```

A working **`.env`** is included, so it starts without setup. The account is
`control` / `control123` — change both that and `SENSOR_TOKEN` before the run opens.
`.env` is read by Docker Compose and, through `src/lib/env.js`, by a plain `npm start` too,
so the two behave the same.

The station is at **http://localhost:8080**. Mission control is at **/control**.

To see it with live-looking habitat data before the real sensors exist:

```bash
docker compose --profile demo up --build
```

The station is built for the actual run: **Thursday 15 to Tuesday 27 October 2026,
thirteen days, Europe/Berlin** — fixed in `src/lib/run.js`, not in `.env`, and applied to the
database at every start. Until 15 October it comes up in its pre-launch state. The run
is named plainly under the wordmark on the station ("Thu 15 – Tue 27 Oct 2026 · 13 days in the
habitat"), in the dashboard header, on the About page and in the countdown pill.

### Seeing it full before the sensors exist

```bash
# a rehearsal: a thirteen-day mission that started four days ago
export MISSION_OVERRIDE=true MISSION_START=$(date -d "-4 days" +%F) MISSION_END=$(date -d "+8 days" +%F)
npm run seed
npm run demo      # plausible habitat readings for every mission day so far
npm start         # keep the three variables exported, or the server puts the real dates back
```

`npm run demo` writes synthetic readings into the station's own database — a daily rhythm
and a slow drift, one sample every 30 minutes from day 1 to now — so the habitat tiles and the
trend charts fill in. Only rows stamped as demo are ever touched; `npm run demo -- --clear`
removes them again. The stores and the crew's figures always come from `content/`.

### Without Docker

```bash
npm install
npm run seed
npm start
```

### Check everything works

```bash
OPERATOR_USER=operator OPERATOR_PASSWORD=op-pass npm run seed
SENSOR_TOKEN=test-token npm test
```

Over two hundred checks covering the whole lifecycle — visitor identity, transmission, the transit lock,
arrival, approval, the empty-response guard, publication, sensor ingest, unknown-metric
registration, mood filing and translation, live broadcast, role enforcement in both
directions, concurrent-edit refusal, CSV import and export round-trip, archive export, the PDF
record (that it downloads, has a page per day, is bookmarked, carries the reply, the message,
a filed state, the photograph and its hash, and is control-only), the reset (the typed word, the
lock from 15 October, empty blog slots, cleared messages, states and readings, the inventory
read from the file, the floor on the node's readings), the drift chart, a check that no raw mood value ever reaches a public page, the crew logbook
end to end (sign-in, filing, same-day editing, hold and release, and that mission control has
no way to rewrite crew text), and phase and T-clock exactness across the 25 October DST
change, that the composer precedes the habitat data in the page order, that the day record
and the full export carry every strand, that no admin table can clip on a phone, and the media
archive end to end (upload, refusal of unknown types, public display, byte-identical download,
range requests, the manifest, a ZIP that Python's `zipfile` verifies, withdraw and restore
without deletion, and the on-disk manifest checked by the verify tool).

The suite needs a live mission, so it overrides the October dates with a window around today.

---

## What's in it

**Four public pages, and mission control.** The station's front page is the mission page; the
Write page holds the composer and the message board; the Dashboard page the mission dashboard;
About the reading matter. Mission control is one page. The archive, which is mission control's,
sits behind the same login.

| Page | Route | Holds |
|---|---|---|
| The mission page | `/` | **The header** across the top — the wordmark, the run's badge, the three keys (Write to the crew → `/write#write`, Live Mission Dashboard → `/dashboard`, About) and a running line of the current activity, the next one, the habitat sensor's reading and the daily communication window · **three pages**: the way to the habitat with its sky; the note with the two calls under it (Send a message to the crew — approved messages are beamed into space; Follow what the crew is doing — live); the world's slowest chat (see *The landing page: three pages in the glass dress*) · **the composer's window and the floating Write key**, as on every public page (see *The composer's window*): the note's door and the slowest chat's door open the window here (`#write`); a phone's doors lead to the Write page's dock. Nothing of the board or the dashboard is on this page. The crew log, the media, the whole mission day by day and the reading matter live on their own pages (`/logbook`, `/media`, `/at-a-glance`, `/about`) |
| Write to the crew | `/write` | **The message board, nothing else — under the header alone, no masthead.** The board is **a wall of notes** — the exchanges as flat cards on the page's ground, after the reference handed over: three across on a wide screen, two on a narrower one, one on a phone, every row starting level; the newest first; **never in a box: the wall flows with the page, and as the reader nears its end the page of exchanges before it is fetched and laid on** (`/api/board?before=`), until *The beginning of the correspondence*. A bar over the wall stays under the header all the way down: the board's name with its LIVE mark and the count, and the chips that narrow the wall (ALL, MY MESSAGES, a tag). The composer is **the window every page carries** (see *The composer's window*), opened by the floating **Write to the crew** key; `/write#write` opens the page with it open, and on this page the window folds away by itself once a message has arrived, so the note just sent is in view at the head of the wall. Each note: a disc with the writer's initials in a colour of the callsign's own, the callsign, the reference number; the message as the note's title with its tags right after it (*#question #humour*, keys that narrow the wall, in the message's own colour); the crew's answer as a quoted card of its own (the officer, *Crew answer · Mars habitat*, when), or the message's state; a foot with the distance the message has travelled (ticking) and the moment it was sent. See *The board*. Drawn for a phone first: the notes one under the other, the composer a dock at the foot of the screen, which lowers itself once a message has crossed; the phone's bar of keys leads here with **Write**, and so do the header's key and the sky's notes. `/messages`, `/board` and `/communicate` redirect here (`writePage`, `boardWall`, `noteCard` in `src/views/pages/public.js`; `public/board.js`) |
| About | `/about` | The reading matter, one page: **About** (headed by the project's name, *MARS! – Mobilizing Awareness for Resilient Societies!*, in the words of October's text sheet `ABOUT_WEBSITE_TEXTS_FOR_YASHA`: what MARS! is and how it came to the Marktplatz in four paragraphs — the five prototype workshops and the concept exhibition linked to their pages at zkm.de — then *Why are we doing this?* with its line *Playacting Mars in the middle of the city*, *The Habitat – Red Dust City* and *The Insight*; the distance to Mars in the first of these is the station's own figure for the day the crew go in — `lib/orbital`, some 233 million km — not the sheet's 26 million, which is a close approach's; then the station's own *Messages sent to space* — two paragraphs on how a replied message goes out by radio through SpaceSpeak, after spacespeak.com/Learn/Science: the transmitters, the 2.4–5 GHz band, the directional antenna, the speed of light, then where the signal gets to and that it never stops (*More than Human* and *The readings* stood here until October asked for them to go). Beside the prose the mission's facts: the run, start and end at 17:00, the duration, the crew, eleven scientific missions — the sheet's figures — and no timezone), **What's inside the habitat** (the cutaway picture of the habitat handed over as two SVG files, its thirteen modules lighting up in colour under the hand or a finger, each with its card of what is in it — see *The habitat in section*; the line *AI generated image* under the picture) and **Who we are** (the three officers of the day in the sheet's order — Commanding, Health, Science — each under its brief, *Order & Communications*, *Health & Life Support*, *Research & Systems* (the role lines in `content/crew-and-inventory.json`, on the dashboard's Crew Moods too), with **the portrait of the person on shift that day** over the role once the shift plan names them — `content/shifts.json`: for each mission day, the surname in each role as `crew.json` spells the picture's file, the day's crew shown from 08:00 at the venue until 08:00 the next morning, never the nights; the file ships naming nobody, with `_example` for the shape — then the role and their state as mission control filed it; the crew's thirteen portraits, each with its name as the photograph's file gives it — *Firstname_Lastname.jpg* (an umlaut in a surname is spelled out in the picture's file: Klöck → kloeck.jpg) — in the order of the surnames; and the producer — ZKM | Center for Art and Media Karlsruhe, *Department for Artistic Research & Development, ZKM | Hertzlab* (linked to zkm.de/en/hertzlab) — with the partners' logos — *In cooperation with* the Badisches Staatstheater and the Naturkundemuseum Karlsruhe, *Supporters* E.ON Foundation, LBBW Stiftung and the Innovationsfonds Kunst — small, each on a white tile), one after another under a row of three pills that jump to them (*What this is* — how the station behaves, with the path of a message in six steps — was the second section until October asked for it to go; `/what` and `/#what` land on the page) (`src/views/pages/info.js`; the pictures and `public/crew/crew.json` by `tools/crew-pictures.py`). The reading matter runs the whole width of its section; the mission's facts and the path of a message stand under it in rows. A phone's **About** key opens it; on a desk the header's *About* link does |
| Dashboard | `/dashboard` | **The mission dashboard, nothing else — under the header alone, no masthead**: the head, the live images, the two doors, the strip of sols and the panels behind their index — the keys stacked vertically, on a desk as a rail at the left of the folder, on a phone over it: *Sensors*; *Daily Life* — **Today's Mission** first, then Today's Schedule, Today's Meal, Crew Moods; *Blogs* — the three daily blogs (see *The mission page*). The header's *Live Mission Dashboard* link, the phone's **Dashboard** key, the mission page's *Mission dashboard* door and every door of the habitat's modules lead here; `/crew`, `/day`, `/day/:n`, `/schedule` and `/habitat` redirect to their section of it. A phone leaves the strip of live images out (the newest pictures rise over the habitat on the mission page instead, and fill the Media page) |
| Mission control | `/control` | Five tabs: **Messages** (the reply queue) first, then one per officer, and the habitat — which ends with the plan and the reset. The Science officer's tab opens with the day's **science mission**: one dropdown for the open day with the thirteen sheets, the plan's selected — as shipped in sequence, 00 on 15 October — and Save writes that day's entry of the plan (see *The mission is a folder of files*) |
| At a Glance | `/at-a-glance` | **A booklet: one day per page, turned by scrolling or swiping sideways** — arrows either side, ← → on a keyboard, a day strip to jump, a `#day-n` link opens on that day. Each page: each day's crew log with its photographs, the schedule as run, the meals and their cost, the resources (every store at the close of the day), the power, the habitat's sensors as they last read that day (one tile per channel, the last reading large — no charts, no means or ranges), the crew's condition as sentences and the mission notes. No exchanges with Earth and no Also sent out block. Days ahead show the plan, and each page scrolls on its own like a page being read. Opened from the button under the mission dashboard, and from the navigation |
| Crew log | `/logbook` | All thirteen days in order, each officer's entry where written and its placeholder where not — a day strip to jump by, a chip per voice. Opened from the Crew log panel on the dashboard, and from the nav |
| Media | `/media` | Everything the crew send out — photographs and video — by day, with filters; `/media/:id` one item; `/media/export.zip` everything as one ZIP; `/media/manifest.json` every file with its SHA-256 |
| Archive | `/archive` | **Mission control only.** Day-by-day permanent record — no messages, every reading; `/archive/day/:n`, **`/archive/export.pdf`** (the whole mission as one document), `/archive/export.md`, `/archive/export.json`, **`/archive/readings.zip`** (every reading ever pulled), `/archive/moods.csv` (every state filed for every officer). `/archive/messages` is a separate, unlinked search over the message queue and is not part of the record |
| Screens | `/screens` | **The installation's screens** — open to anyone, unless `.env` sets `SCREENS_USER` and `SCREENS_PASSWORD`, which puts a sign-in of their own on them (`/screens/login`; mission control's session does not open them) — one piece of the station a page, full screen, the whole of it in one glance, nothing to scroll: `/screen/landing`, `/screen/habitat`, `/screen/board`, `/screen/mission`, `/screen/blogs`, `/screen/day`, `/screen/trends`, `/screen/media` (see *The installation's screens*). `/screens` lists them |

Every address the public subpages used to have redirects to where the thing is now: `/messages`,
`/board` and `/communicate` to the Write page, `/crew`, `/day`, `/day/:n`, `/schedule` and
`/habitat` to their section of the Dashboard page (the static files are served without a folder's
trailing-slash redirect, so `/crew` — also the portraits' folder — gets there too), `/who-we-are`
to its section of the About page and `/what` to the page itself (its section is gone), so old
links and printed material still land somewhere; the mission page's own old `#about`, `#what` and `#who-we-are` (when the reading
matter was three pop-ups over it) lead to the About page too, its `#inside` to the habitat's
section there, its `#exchanges` to the Write page, and its `#mission` and the dashboard's panels
(`#habitat`, `#crew`, …) to the Dashboard page. The footer of the mission page is the navigation.

### The installation's screens

**No password on the screens.** `/screens`, every `/screen/<name>` and the writing screen's post
open to anyone, as the station ships. A door is there to be switched on, should the venue want
one: set **both** `SCREENS_USER` and `SCREENS_PASSWORD` in `.env` (`src/lib/screens-auth.js`) and
they open only to a browser that has signed in at `/screens/login` with the two. Nothing else
opens them then: mission control's session does not, so an operator signed in to `/control` is
asked for the screens' password like anyone else; anyone who types a screen's address into a
browser lands on the sign-in page and, signed in, goes on to the screen asked for. The sign-in is a
cookie that holds for a year, so a display stays signed in across its own reloads and the
station's restarts; it stops working the moment the password is changed. Ten wrong tries from one
address in ten minutes are throttled; with the door on, the list carries a *Sign out of the
screens* key. (The archive, `/archive`, needs mission control's session as it always did.)

**The screens.** `/screens` lists them; each is a page of its own that you open full screen
(F11) on the player behind a display. **No screen address ever asks about cookies** (October):
the screens carry no cookie card and set no cookie, a slip of the hand — `/screens/write`,
`/screen` — is sent on to the right address, and a name that is no screen's (`/screen/nope`)
answers with the list and a word, never with the site's 404 page and its cookie question:

- `/screen/landing` — the landing page's first screen — the way to the habitat, with the
  latest exchanges and pictures around the line — with the ticker (its light/language
  switches and its links are not drawn)
- `/screen/habitat` — the Habitat instruments, live
- `/screen/board` — **the ground station's message board**, read-only, live; two columns (one
  upright), each card's line into space on one line, nothing to tap. Every message sent from
  the writing screen stands on it at once, under **BODENSTATION**, whatever its state — in
  transit, awaiting a reply, answered — headed by that name, before everyone's answered
  exchanges: the board is the station's own, as a visitor's board on the site is theirs, never
  the computer's cookie's. The screen polls `/api/board?…&station=1` for the same; the public
  board shows a station message only once it is published, like any other
- `/screen/write` — **the message-sending box, full screen**: the composer alone, for writing
  to the crew at the venue. Its operator is the ground station itself: the composer's head says
  **BODENSTATION** (the ground station, in German; `SCREEN_OPERATOR` in `.env` for another name)
  and every message sent from it goes out under that one name — it is the callsign the message
  carries on the board, in mission control and in the record, never the computer's own. Behind
  the name each message is still a visitor row of its own, with no cookie set, so one person's
  message never locks the screen for the next
- `/screen/mission` — Today's Mission
- `/screen/blogs` — the three blogs one at a time, each post rolling by from top to bottom,
  then the next blog; a blog with nothing written stands its note at the top left, across the
  width, like a post
- `/screen/day` — schedule, meal and moods in one row
- `/screen/trends` — the graph; upright it draws the phone version with the legend
  underneath, which reads far better
- `/screen/media` — every picture in one grid, newest first, stamped with day and time, as
  many as fit (the site's day-grouped gallery would leave the screen mostly empty, so the
  screen uses a flat grid; a new picture slides in live, without a reload)
- `/screen/station` — **the ground station's own screen** (October: "a URL that never asks
  for cookies and always opens the writing screen and the message board with the operator as
  Bodenstation"): the writing screen's composer at the left, operator **BODENSTATION**, and the
  station's message board at the right (one over the other upright) — the two screens above on
  one page, for the PC on the square. Every message is a new visitor's with no cookie, as on
  the writing screen; the board shows it at once; no cookie question, as on every screen

Dark and German by default; `?theme=light`, `?lang=en`, `?lang=fr` switch it (for example
`/screen/board?lang=en&theme=light`). Nothing scrolls: a piece that is too tall is scaled
down (to a third of its size, if a short screen needs that), a small piece is scaled up (never
narrower than its layout stands), and on the board and media screens the row that would be cut
at the foot is hidden so the last row is whole. **Every screen fits a full screen on a monitor
of any size** (October: 1920×1080, 1366×768, 1280×720, 1024×768, 2560×1440, 4K and upright
1080×1920 are all looked at by `scratchpad/scr-audit.js`-style runs; `public/screen.js` fits
the piece once, again after anything under it changes — a card arriving, a graph drawn again —
and looks at the fit every other second, so a drawing that grows after the last fitting is
caught). Two pieces needed more than scaling: the **trends**, whose wide graph is as wide as
its panel at any scale and so could never be scaled to fill the height, are **drawn to the
stage's height** when the screen is landscape (`data-fit-landscape="fill"` in `screens.js`;
`habitat.js` draws the graph to the shape of the room it has) and scaled, with the legend
under the narrow graph, when it is upright; and the **habitat**'s hardware charts stand
**four across** under the instruments on a screen (two upright) and are drawn as short as the
screen needs (`/api/hardware?h=`, a fifth of the screen's height, 130 px at the least), where
two across at the site's height stood the panel twice the screen's height. The gallery sets
its columns by how many pictures there are — two across up to four, three up to eight, four
up to fifteen, five from sixteen (one more at each step on a short screen; one, two and three
upright) — so the screen is full from the first day. The landing screen's Earth reaches the
foot of the screen. Every screen reloads itself every five minutes and at midnight, when the
sol turns (the writing screen waits while someone is writing).

In more detail: nine pages made to be shown on screens in the installation — a laptop or a
player behind each screen, the browser in full-screen mode (F11), nothing to touch but on
the writing screen, which is made to be touched. Each
shows one piece of the station, the whole of it in one glance: **nothing scrolls, nothing
moves but what is live.** `/screens` lists them, with what each shows and the switches in the
address.

| Screen | Address | Shows |
|---|---|---|
| Landing page | `/screen/landing` | The station's first screen — the ticker across the top, then the page's words at the left and the way to the habitat at the right: the Earth, the line, the habitat far above, the latest exchanges and pictures either side of the line (*The landing page: four pages*). The one screen that keeps the ticker; the ticker's switches (light, language) and its links are not drawn |
| Habitat | `/screen/habitat` | The Habitat panel of the dashboard: the readings, the crew's figures, the stores and the power — live. Set to be read from across a room: what each tile measures in 32px type, its scale under it in 18px, the figures 46–54px, and the drawings (the dial, the ruler, the radar, the orbit) smaller for it (`screen.css`, `#habitat`) |
| Message Board | `/screen/board` | The ground station's board: every message sent from the writing screen as it stands — in transit, awaiting a reply, answered — under BODENSTATION, then the latest exchanges, newest first, two across (one upright), as many as fit — live, a new exchange slides in as the board publishes it. Read-only: no composer, nothing to tap — a card's line into space stands on one line (*Diese Nachricht ist jetzt 20,02 Milliarden km von der Erde entfernt! · Gestartet vor 19 Stunden*) and opens no panel. The screen polls `/api/board?lang=<its language>&limit=400&station=1`, so the cards come back in the language the screen is in, all of them, the station's own among them |
| Write to the crew | `/screen/write` | **The message-sending box, full screen** — the composer as the site has it (the crew's question of the day over it, the message box, the tags, the Transmit key), alone in the middle of the screen, for a touch screen in the square. **Every message sent from it is a new visitor's**: a callsign is minted for it alone (`src/lib/callsign.js`, `mint`; `POST /screen/write` in `server.js`), no cookie is set, so the next person at the screen starts afresh — no callsign carried over, no transit lock between them. Once a message is sent the crossing plays as on the site, then holds nine seconds on ARRIVED with the callsign named — *Your message went under the callsign DUST-465 — look for it on the Message Board once the crew have answered* — before the empty box comes back (`public/composer.js`, `data-hold`, `data-refresh`). The checks are the composer's (the channel open, the words within bounds); the hourly limit is the screen's own, per address, since all its messages come from one: `KIOSK_HOURLY_LIMIT`, sixty an hour. What is left half-written is cleared after three minutes with nobody touching the screen, and the page's own reloads wait while someone is writing or a message is crossing (`public/screen-write.js`) |
| Today's Mission | `/screen/mission` | The day's mission from the sheet: its question, Morning, Afternoon, EVA, the question for the community hour — **typed out letter by letter** as if someone were writing it (`public/typed.js`: a cursor after the last letter, a halt at a full stop; typed to the end it stays three minutes, then is typed again; the site's dashboard shows the same panel still) |
| Blogs | `/screen/blogs` | The three blogs **one at a time**, each filling the screen: its head stays, the day's post rolls by underneath from top to bottom at reading pace (`public/screen-blogs.js`, 28 px a second, five seconds' hold at the top and at the end; a post that fits is shown for fourteen), then the next blog takes the screen — the Commander Blog, the Daily Mission Report, the Health Report, round and round. The text is set at the size of the panels' own notes (about 23 px on a 1080p screen). A blog with nothing written yet shows its note and passes the turn on; the latest earlier post is carried forward, as the dashboard does |
| Today | `/screen/day` | Today's Schedule, Today's Meal and the Crew Moods, three in a row (one under the other upright) |
| Trends | `/screen/trends` | The run's trends on one graph — on an upright screen drawn the way a phone draws it, the names of the lines in a legend under it |
| Media | `/screen/media` | Every picture out of the habitat in **one grid, the newest first**, five across (three upright), each stamped with its day and time, as many as fit — live, a new picture slides in as it arrives. (The site's gallery groups them by day; a screen that must be full does not) |
| Ground station | `/screen/station` | **The writing screen and the message board on one page**, for the ground station's own PC on the square (October): the composer at the left as `/screen/write` has it — operator BODENSTATION, every message a new visitor's with no cookie, posting to the writing screen's address, the crossing's read-out naming the callsign — and the station's board at the right as `/screen/board` has it, the station's own messages on it at once, three cards across on a wide screen, two on a 1080p screen, one beside the composer on a small one, cut clean at the foot (one over the other upright). The composer steps down a size on a short screen so it stands whole. No cookie question, as on every screen (`station()` in `screens.js`; `screen.css` under *the ground station's screen*) |

**Dark and German by default.** A screen is drawn in the dark theme and in German unless its
address says otherwise: `?theme=light`, `?lang=en`, `?lang=fr` — for example
`/screen/board?lang=en&theme=light`. The cookie card, the bar of keys, the foot and the
header's links are not drawn; the pages are `noindex`.

**Landscape and upright alike.** The layout turns with the screen: side by side on a landscape
screen, one under the other on an upright one (`public/screen.css`). What does not fit is
made to fit by `public/screen.js`: on most screens the piece is **scaled to the height of the
screen** — up, so a large screen shows it large (to twice its size, and never narrower than
the width its layout stands at: `data-min-width` on the body, per screen in
`src/views/pages/screens.js`), or down, so a long mission or three long blogs are shown whole.
The board and the gallery are not scaled — their cards and tiles are read a little larger on
a large screen, and **the rows that would be cut at the foot are hidden**, so the last row is
whole (`data-fit="clip"`). The trends, landscape, are a third way (`data-fit="fill"`,
chosen from `data-fit-landscape` while the screen is wider than tall): not scaled, but laid out
to the stage's height by the stylesheet, the graph drawn to the shape of its room. The fitting
runs again whenever the content changes (a card or a tile arrives, the instruments draw
themselves, a graph is drawn again — any change under the stage, an attribute as much as a new
child), whenever the screen turns, and every other second if the last fitting was overtaken by
a drawing that grew after it; a fitting that changes nothing touches nothing, so it never sets
itself off again.

**Live, and reloaded.** What the site keeps live stays live on the screen — the board polls,
the pictures poll, the habitat's readings poll, the sky over the dome runs. Everything else
(the day's schedule, the mission, the blogs, the sol in the head) is read when the page loads,
so **every screen reloads itself every five minutes** (a few seconds apart on each screen, so
the station is not asked by all at once) **and at the venue's midnight**, when the sol turns.
The clock in the head is the venue's. Nothing on a screen is ever sent anywhere.

The pages are built from the same pieces as the site — `dashboardPanels()` in
`src/views/pages/public.js` hands the screens the dashboard's panels one by one, the board's
and the gallery's markup come from the same functions the site uses (the gallery's flat grid
from `cloudScreen()` in `media.js`, polled through `/api/cloud?flat=1`) — so a change to the
site is a change to the screens.

### Mission control

**The tally — in the archive.** Under the archive's contents, after *The mission, day by day*,
stands *The tally*, the figures mission control keeps for itself (October: "a counter of the messages sent on the website and
of the visitors — not publicly; messages sent, total and per day, visitors per day and total;
it should be in the archive"): **Messages sent** and **Visitors**, each a total, and under them
a table of the days at the venue, newest first — the messages sent that day and the visitors
first counted that day, with the mission day where the date is one of the run's — the figures
alone, no note under them. A visitor is counted on the day they accept the cookie or first send
a message, since a page view before that names nobody; a message from the writing screen counts
a visitor each (`data.tallyByDay()` and `data.tally()` in `src/lib/data.js`; the panel in
`src/views/pages/archive.js`, `.tally`). The queue's counts and the tally are at
`/control/counts` as well, behind the sign-in; nothing public carries them — `/api/status` says
the day and the phase and counts nothing, the control page carries no figures, and the
mission-complete page names the exchanges published and no more.

Messages come first: the queue is the first tab, because answering Earth is the job that
cannot wait. Each message is a card: who wrote and what they wrote, large, with the state and
the time in the top line and the quiet actions — reject, delete, unpublish — beside them; the
reply beneath, headed *Reply as …*, one box and one orange **Reply** button that sends it to
the board. **Ctrl+Enter** (Cmd+Enter on a Mac) in the box does the same. The queue shows what
is awaiting a reply, what is answered and what was rejected. A message arriving while the
desk is open is announced in a banner rather than discovered on the next reload — the page
polls a count and never rebuilds itself under someone mid-reply.

The other tabs are **the day's work**: a day picker, then the tabs, which switch without a
page load. Everything editable lives here.

| Tab | Holds |
|---|---|
| **Messages** | The reply queue: awaiting reply · published · rejected · everything — the latest message at the top in every view (October) |
| **Commanding officer** | The **Commander Blog** at the top, then the officer's state |
| **Science officer** | The **Daily Mission Report** at the top, then the state |
| **Health officer** | The **Health Report** at the top, then the state |
| **Habitat** | The daily schedule (a task with its name emptied is removed on save), the meals — Breakfast, Lunch, Dinner and **+ Add a meal** — **Steps taken** and **Calories consumed** (one line per officer each, both written to `crew-figures.json`; the crew's total is worked out on save and read on the station, not shown on the desk), the inventory levels, and the day's power figures — the eight metered channels, each row reading its energy meter (with the channel names, editable in place). Every block's key reads **Save** and nothing more; Steps taken, Calories consumed and Power consumed head their blocks without naming the day (the day picker above says which day is open) |

Every composer is the same: paragraphs and pictures in a column, a ＋ between every two, no
template buttons, and two buttons under it — **Publish**, which makes the text live, and
**Save draft**, which keeps it on the desk (`control_draft` in the database, one per composer
and day) without publishing: the composer opens on the draft, its head says *Draft · when*,
what is live stays live until Publish, and Publish drops the draft. The day picker above the
tabs reaches all thirteen days of the run, so any officer's Daily Blog can be written for any
day, at any time.

A save returns you to the tab and day you were on; a reply returns you to the Messages tab in
the view you were looking at. Mission control is deliberately plain — flat white panels, black
on white, one size of type, and orange kept for the button that publishes and the count of
messages waiting — so it reads across a dark room and nothing on it competes with the work. `/control/science`, `/control/health` and `/control/habitat` still
work as addresses — they open the page on that tab. The desk carries no rail across the
top: its own header holds the **Dark** switch (the same switch and cookie as the public
pages; every grey on the desk comes from one palette, `--c-*` in `public/station.css`, so
nothing is left white), Archive, the record, Reset and Sign out. The tab names are bold and
large, the open tab in orange. Every block's head — *Schedule · day 005*, *Daily Blog*,
*Messages from Earth* — folds its block on a click and unfolds it on the next, with an arrow
beside the name; the desk remembers which blocks are folded (in that browser), so a save
brings the page back as it was arranged. In the schedule, a task whose name is emptied is
removed when the day is saved.

**What you have changed is marked, before and after it is saved.** Every field remembers
what it held when the page was drawn (`public/control.js`): a field that now holds something
else is marked in orange — the field itself, its row in the schedule, inventory or power
table, the caption over it, the face chosen on the mood scale, the composer's sheet (*Edited
— not published*) — and beside the form's Publish or Save button a note says how many fields
differ, *2 fields changed — not saved yet*. Put a value back and its mark goes. On the save
the station records which fields changed (`control_edit` in the database, one row per form,
day and field; a schedule row is remembered by what it says), so the mark stays after the
page is drawn afresh — the same orange, without the tint — and beside each button the desk
says when that form was last saved, *Last saved 23 Sept 2026, 12:02 · control*. The reset
empties the record. Inventory levels show the plan's figure as a ghosted placeholder until a
level is filed, so a filed level is plain from a planned one.

**Reviewing and replying are a single interaction.** There is no approve step: a message
arrives, you read it, you write the answer and you send it. Until it is answered the message is
visible only to its sender, on their own board among the rest; the common board carries nothing
that has not been published. Saving without publishing is still there as a secondary action.

**The board is live.** The landing page polls `/api/board` every few seconds and swaps in
changes, so a reply published from control appears on every open phone without a reload. The
LIVE mark beside the board's name says LIVE and nothing else: a poll that fails only takes its
pulse away while the page backs off and tries again — it never says RECONNECTING.

**The day-content tabs write back into `content/`.** A day's science findings or health
activities are one note of that kind in `notes.json`, rewritten on each save; saving an
inventory level writes `inventory-levels.json`; writing a blog writes `logbook.json`. The
findings and the activities are written in the same composer as the blog, beside it on the
officer's tab, and take photographs and video the same way; a picture placed in a
report stays with the report. The interface and the files are edits to the same thing rather than two copies
of it, so you can work whichever way suits the moment and never reconcile anything.


## Starting again for 15 October

**Reset to 15 October** sits at the top of mission control, on every tab. It opens a dialog that
asks *Are you sure you want to reset?* and takes the word `RESET` typed into a box — the button
only wakes up once it has been typed, and the word is checked again on the server, so nothing
can trigger it by accident. Then it starts the station again for the run:

- **every Commander Blog slot is emptied** — `logbook.json` becomes one placeholder per day (commanding officer only),
  for the crew to fill in during the mission;
- **the crew's figures are emptied** — `crew-figures.json` loses its days; the health officer
  files each day's steps and calories, per officer, under Steps taken on the Habitat tab as the run goes;
- **the power figures are emptied** — `power.json` loses its days and keeps its categories;
  each day's kWh by category is filed on the Habitat tab as the run goes;
- **the stores' counts and the mission notes are emptied** — `inventory-levels.json` and
  `notes.json` lose their days and keep their notes; the stores start from what was carried in
  (`crew-and-inventory.json`) and carry forward on the site until a day is counted, and the
  notes, findings and activities are written on the tabs as the run goes;
- **every message, reply and callsign from Earth is cleared** — the correspondence is logged
  from the run on;
- **every crew state is cleared** — the crew begin with nothing filed;
- **the media sent out is cleared** from the record (the files stay on disk under their hashes,
  as everywhere else in the station);
- **every habitat reading is cleared** — the station's own ingest and the readings polled from
  the external node — and **the readings and the trend graph start on 15 October**: nothing
  stamped before the first day of the run is stored or shown from then on (see *Where the
  readings start*, below). Phones that had cached readings drop them on their next poll;
- the sealed daily records, task statuses and live notes are cleared;
- and **the mission is reloaded from the files in `content/` exactly as they are at that
  moment** — schedule, meals, the stores carried in, sensors, crew. Nothing else is copied
  over the files: they are the plan.

From the reset on, **the trend graph carries no plan**: every day ahead is null — an empty
column — and fills in as the crew file the day's figures, levels and entries. (Before the
reset, after a fresh build, the dashed prepared lines still show, which is useful while the
mission is being written.)

Kept: the account and its sessions, and the audit trail (the reset is written to it). Rehearse as
much as you like in the weeks before; one press leaves nothing behind.

**From 15 October the button is locked.** The run is the record, and a stray press could not be
undone; mission control shows it as *Reset to 15 October · locked* and the server refuses it. A
rehearsal against made-up dates (`MISSION_OVERRIDE=true`) is never locked, so the test suite and a
run-through both keep the reset.

`content/plan/` is a **snapshot** of the content files, made from the shipped files the first
time the station starts and re-saved from the foot of the Habitat tab. It is a backup: a content
file that has gone missing is restored from it at start-up. The reset does not read from it.

**On a phone the dashboard and the wall are kept plain** (October: "very readable, not cluttered";
`aura.css`, the phone blocks): the dashboard's head is the title, its line and its two figures and
the two doors — no strip of thirteen sols (the sol is in the figures and the panels' heads), no
LIVE pill under the figures, no cursor after the title; the folder's segmented control alone names
a group of one folder (the Sensors), a group of four shows its four tabs across; **the habitat's
readings stand in one plain column of compact readouts** — each tile its name and its scale at the
left and its figure at the right, the CO₂ dial under its name, the thermometer's ruler, the radar
and the big instruments left to a wider screen, the crew's figures without their doubled "nothing
recorded"; the crew's rows put the condition's badge beside the name and the note under them. On
the wall the bar wraps — the board's name and the count on one line, **the chips in a sideways row
under them, fading at the end to say they go on** (they were squeezed into the bar's right edge
and unreachable before) — and a note carries no reference number on the small screen.

## The trend graph

**Trends** on the landing page — inside the Sensors tab, under the tiles — is the run: **15 to 27 October, every day on the axis**, SOL 01
to SOL 13, today marked; after 27 October it stands as the record, and it is the run before
15 October too once Reset to 15 October has been pressed. Until then, after a fresh build, the
axis starts on the build day and runs thirteen days from there, labelled by date, so what the
node sends is on the graph from today; the plan's lines join when the axis becomes the run.
Days that have happened
are solid; anything prepared for the days ahead — the depletion curves, daily use, the meal plan,
the crew's figures — is drawn dashed and turns solid as each day happens. The day's activity
(tasks done, messages from Earth, exchanges published, crew log entries, media sent out) has no
planned side and appears only as it happens. The sensor node has a point on every day from its
first reading; a day it was silent carries the last value it sent, drawn dashed. Every line is
named at its end in its own colour; hovering a name lifts that line. Each line is on its own
0–100 scale, so a store is drawn against what was carried in and a channel against its
instrument's range.

The stores' daily use is also written as a table: **`content/resource-log.csv`**, one row per
item per day of the run (quantity at close, daily use, used since what was carried in, days
left at that draw, whether the day was filed or carried forward), rewritten on every content
load and downloadable at `/resources/log.csv`.

## The three daily blogs

The **front row of the stack of folders** on the landing page holds three panels, one folder
each (see *The mission page*):

| Panel | What it shows | Written in mission control |
|---|---|---|
| **Daily Mission Report** (`#blog-science`) | the day's science findings — the `SCIENCE` note in `content/notes.json` | **Science officer** → Daily science findings |
| **Health Report** (`#blog-health`) | the day's health activities — the `HEALTH` note in `content/notes.json` | **Health officer** → Daily health activities |
| **Commander Blog** (`#blog-commander`) | the commanding officer's **Daily Blog** — their entry in `content/logbook.json` | **Commanding officer** → Daily Blog |

**The Commander Blog is the commanding officer's blog**, under the name the station gives
it; nothing else about that officer is renamed, and it is still written on their tab.

**Each panel stands under the current day** — the one the schedule and the meal folders are
showing, today's SOL during the run, SOL 01 before it, named in the panel's head (`SOL 005 ·
Mon 19 Oct`) — **and shows the day's post once it is written. Until then it shows the latest
post of an earlier day**: the crew write at night, so through the day the panel would
otherwise be empty; instead the day before's post (or the last day's that has one) stands there
under today's date, with no note, until today's replaces it — a visitor never meets an empty
blog. The placeholder (*No mission report yet for SOL 005*) stands only while no post at all
has been written. Earlier days stay day by day on the crew log (`/logbook`) and in At a Glance.
The same rule as everywhere else decides what is public: a post is on the station the moment it
is saved; a placeholder never is, and a post cleared in mission control leaves its panel at once
(the earlier day's stands in again). Like the schedule and the meal, a panel is drawn when the
page is loaded — a page left open across midnight shows the new day on its next load.

**The post is read where it stands — there is nothing to click into and back out of.** A
panel is as tall as its post, whatever its length: nothing on the dashboard scrolls inside its
own box any more — the whole of every panel is on the page and the page scrolls (a laptop's
window used to show half a panel behind a scroller of its own). A panel's title is not a link, and a
photograph in a post is shown in the post rather than linked to its media page, so nothing in
a panel leads off the landing page. Photographs and video placed in a post are shown in it.
**A post spans the whole of its folder** — its lines run the width of the panel and a
photograph in it is as wide as the panel (no column narrower than the folder, nothing held to
the left); on the blogs screen (`/screen/blogs`) the lines span the panel the same way.

The panel titles and their empty lines are in `src/lib/i18n.js` like every other word (German
*Commander-Blog*, French *Blog du commandement*); the markup is in `dashboard()` in
`src/views/pages/public.js`, the styles under *The three daily blogs* in `public/station.css`.

## Editing the day's values during the run

Everything the run updates daily has one file and one tab, which write into each other; edit
whichever suits the moment and it is live on the station within seconds:

| What | The file | The tab in mission control |
|---|---|---|
| Resources — what is left of each store | `content/inventory-levels.json`: per day, per store, `{ "quantity": 618, "consumption": 46 }`. Only write the stores that changed; on the site the rest carry forward at their daily draw, while the record prints only what was counted | **Habitat** → Inventory levels, with the day picker on the day |
| Calories and steps | `content/crew-figures.json`: per day, one entry per officer under `crew`, keyed by designation, and the crew's totals as the sums — `"5": { "crew": { "COMMUNICATION OFFICER": { "calories": 1720, "steps": 2200 }, "SCIENCE OFFICER": { … }, "HEALTH OFFICER": { … } }, "calories": 5010, "steps": 6420 }`. A day written with the totals alone still shows, as a total. The Habitat panel shows each officer's figure with the crew's total beneath; At a Glance carries the totals and the record each officer's figure with the totals as filed | **Habitat** → Steps taken and Calories consumed, day picker on the day |
| Power consumed, by channel | `content/power.json`: eight categories as shipped — **Crickets, Science 1, Science 2, Living, Table, Food, Water, Hydroponics** — each naming its Home Assistant energy meter as `sensor` (`habitat_power_<channel>_energie`), so a day's figure is the meter's (the day's last reading less the day before's) unless one is filed by hand: `"5": { "food": 1.1, "living": 0.5 }` — kWh per day. The `categories` list above the days is editable too: rename a label, add one without a meter to count by hand, remove one; the key is the stable name in the record | **Habitat** → Power, day picker on the day; the name fields rename the categories everywhere. Every figure is locked behind an **Edit** key, which asks first — *These values are automated, are you sure you would like to edit?* |
| Today's schedule | `content/schedule.json`: per day, `{ "time": "06:45", "label": "…", "detail": "…" }`; task status (done, active, skipped) is marked on the tab as the day runs | **Habitat** → Schedule |
| Meals | `content/meals.json`: per day, slots BREAKFAST / LUNCH / DINNER and the meals added on the desk, EXTRA1, EXTRA2, … (each with the time it is served at, `"served": "16:30"`), with `kcal`, `water`, `prep`, `energy`. The power a meal drew is not this file's: it is the food meter (the Food channel's energy meter) read between the meal's hours, an added meal counting with the named meal of its hour (see *The meals' power*) | **Habitat** → Food plan — Breakfast, Lunch, Dinner and **+ Add a meal** |
| Mission notes | `content/notes.json`: per day, `{ "kind": "LOG" \| "ANOMALY", "body": "…" }` | `POST /control/updates` (the notes composer) |
| Blogs, findings, activities | written over the placeholders in `content/logbook.json` / `notes.json` | each officer's tab |

**NOW — the rehearsal day.** Before the run, mission control opens on **NOW**: mission day 0,
dated today, the first stop of the day picker on every tab (*NOW · 29 Sept*), ahead of 15 Oct —
a day to try everything out on. Everything filed under it —
the schedule, the meals, the Commander Blog and the two reports, the stores' count, the crew's
figures, the power, the media sent with a post — goes into the content files under the key
`"0"` and into the database as mission day 0, and **nothing of it touches the run's days**:
SOL 001 keeps its plan, the stores' chain from day 1 on is not counted from NOW, the resource
log has no NOW row. NOW is dated today (its day row is kept dated), so states filed today, the
readings the sensors send today and the messages that come in before the run are its too. It
is there before the run and all through a rehearsal against made-up dates (`MISSION_OVERRIDE`),
never during the real run (`mission.nowDay`; `mission.workDay` — the day the desk opens on — is
0 before the run and the current sol during one), and the reset takes it with it — every `"0"`
goes from the files. The record shows NOW everywhere, marked *REHEARSAL · NOT THE RECORD*: the
archive's contents page, its own day page and PDF at `/archive/now` (`/archive/today` leads
there before the run, and to the current day during one), the full PDF and the readable copy as a chapter after the days, the data copy
as a `rehearsal` block beside the thirteen days, the readings log as a `daily` record with
`missionDay: 0, rehearsal: true`, the media archive in a `now-rehearsal/` folder (and
`/media/day/0/export.zip` alone), the messages exports with `when: NOW · before the run` /
`rehearsal: true` and a heading of their own in the PDF. On the public station, once a blog is
written under NOW the three blog panels, the blogs screen and the crew log show it headed
**NOW** (until then they keep the opening day's empty slots), and At a Glance opens on it —
before the run only: in a rehearsal against made-up dates the public pages show the sols, and
NOW is the desk's and the record's. (To see the whole station as it will run — schedule,
meals, sol counter and all — rehearse against made-up dates: `MISSION_OVERRIDE=true` with
`MISSION_START` today; NOW is there too, for trying the desk and the record without touching
the sols.)

**Before the run, At a Glance opens on NOW.** Marked `REHEARSAL · NOT THE RECORD` and reached
as **NOW** in the day strip, it is a complete day page filled with what there is today: the
habitat's readings as the sensors are sending them now (tiles and point-by-point charts), and
everything filed under NOW — its schedule, meals, consumption rings and power, its blogs,
exchanges and media — with any states filed today: the real feel of a filled page, weeks
early. It is not part of the record and disappears on 15 October, when SOL 001 takes its
place.

## The mission is a folder of files

Everything the crew do not write live — the schedule, the meal plan, the inventory, the
mission notes and the diary entries they go in with — lives in **`content/`** as plain JSON.

Open a file, change it, save it. The site updates within about two seconds: no restart, no
rebuild, no sign-in. Under Docker the folder is mounted, so editing it on your machine changes
the running station.

| File | What it holds |
|---|---|
| `crew-and-inventory.json` | Crew designations and roles; the tracked resources and their starting amounts |
| `schedule.json` | The daily task schedule — as shipped, the crew's typical day (08:00 Shift Change … 22:00 Shift Change / Lights Out, seventeen tasks) written into every one of the thirteen days; change a day in mission control's **Habitat** → Schedule, or here |
| `meals.json` | Meals per day, with energy, water and power cost — ships empty; filled from the Habitat tab, from the recipe book or by hand |
| `inventory-levels.json` | What is left of each resource at the end of each day |
| `power.json` | Power consumed per day in kWh, by editable category — as shipped the eight metered channels, crickets, science 1 and 2, living, table, food, water, hydroponics, each reading its energy meter (`sensor`) — drawn on the Habitat panel, in At a Glance, in the Trends and throughout the record |
| `logbook.json` | The crew's diary entries, by day and crew member |
| `notes.json` | Mission notes, science findings, health activities and anomalies |
| `sensors.json` | The monitored channels, with units, channel codes and thresholds |
| `templates.json` | The prefilled text of the daily health activities (the `Default` entry under `HEALTH`) |
| `recipes.json` | The recipe book: twelve recipes (two measured, ten samples) with prep time and per-serving kcal, nutrients, CO₂e and water footprint — what the food plan's dropdowns offer (see *The recipe book*) |
| `missions.json` | The scientific missions, one a day, **written by `tools/missions-json.py` from the PDFs in `missions/`** — each sheet's words (number and title from the file name, 00 to 12; central question, Morning / Afternoon / EVA, the question for the community hour in English and German, the material, the sheet's file; `sheetNo` where the sheet prints another number, `placeholder` on a sheet that is a copy of another's PDF for now) and the day → mission map (`days`, as shipped in sequence — 00 on day 1, 15 October — and written from the desk's Science tab, day by day); the sheets themselves are the PDFs in the `missions/` folder beside `content/`, served at `/missions/<file>` (see *Today's Mission* under *The mission page*) |

It ships with the plan and nothing invented: 13 Commander Blog slots (one a day, commanding officer only)
with a cue each for the crew to write into, the typical daily schedule on every day (17 tasks ×
13 days), an empty food plan (`meals.json` — each day's meals are chosen from the recipe book on the Habitat tab), **four tracked resources** — drinking water (October: *Drinking water*, not *Potable water*), food rations, medical kits and fire extinguishers — (the drinking water is carried in at
**180 L** — `"start": 180` in `crew-and-inventory.json` — and the food rations at **35 days** — `"start": 35` — and every
gauge of them is drawn against that; the other two stores' carried-in amounts, and every warning level, ship as 0 —
placeholders to be written into `crew-and-inventory.json` before the run, or the day-1 count filed on the Habitat tab,
which every gauge is then drawn against; until then such a store is shown dimmed with a dash, not as an empty store), and
the sensor channels.
The dailies — the stores' counts (`inventory-levels.json`), the steps and calories
(`crew-figures.json`), the power (`power.json`) and the mission notes, findings and activities
(`notes.json`) — ship empty and are filed on the tabs of mission control as the run goes, so
the record holds only what the crew and mission control put in. Change any of the plan in the
files or on the tabs.

**Inventory carries forward.** You only write the items that changed on a given day; everything
else inherits yesterday's closing figure minus its daily draw. A normal day needs no entry.

**Errors never take the site down.** A stray comma leaves the last good version serving and
reports the file and line number — in the console, on the mission control screen, and at
`/api/content`.

**Every diary slot ships as a placeholder.** `logbook.json` carries one entry per day per
officer, each beginning with `[PLACEHOLDER]`, a first line naming the slot, and a `Cue:` line
for the writer. The public crew log — the panel on the station and the `/logbook` page — shows
all thirteen days from the first day, with each unwritten slot as its greyed first line, so the
shape of the whole log is visible and fills in as the crew write; the cue is shown only in
mission control. Write over it — in the officer's **Daily Blog** on their tab, with the day picker set to the
day, or in the file — and it is live on the crew log for that day the moment it is saved. Save it empty (or press **Clear**) and the placeholder comes back. **Any day can be
written at any time** — before the mission opens, days ahead, days past — and it is public the
moment it is saved; the log does not wait for the clock. **An entry is a post**, and it is
written as one: every blog box in mission control is a composer laid out like a classic
post editor — a toolbar across the top with **Photo / video**, one sheet under it, the word
count in the foot. The sheet is the one form there is (there is no Visual | Text switch: the
plain text the station stores is never shown for editing by hand). The sheet is one
document: the text flows the whole width of the sheet (`.ed-doc p` is freed from the 66ch a
page's paragraph is kept to), Enter starts a new paragraph, and a photograph or a film goes in
where the cursor is (press the toolbar button, or drop a file onto the sheet). It uploads on
the spot with a progress bar, shows its preview in the flow, takes a caption under itself, and
**✕ deletes it** from the entry and from the station — the blog, the Media page, the
downloads — at once (Backspace against it asks the same); the file itself is kept in the
archive volume as *withdrawn*. Underneath, the same plain text the station has always stored —
paragraphs with `[media:12]` lines — is kept in sync in the form's textarea, so the file in
`content/` stays readable, and without JavaScript the box is still a textarea with a file
picker. The files go into the media archive under that officer and day, so they are also in
the gallery, the exports and the ZIP. Full guide in `content/README.md`.

## The recipe book

On mission control's **Habitat** tab, **Breakfast**, **Lunch** and **Dinner** each open with a dropdown over the
recipe book, **`content/recipes.json`**. Choosing a recipe fills the slot's name, kcal, **prep time**, the six
nutrients (protein, fat, carbohydrate, fibre, sugar, sodium), CO₂e and water footprint — all per serving, all still
editable before **Save**. The dropdown's first option, **Empty — fill in the fields below by hand**, clears
the slot to be written on the go: it is saved for that day only and never adds a recipe.

The book ships with twelve recipes: Chili Non Carne and Pfannenbrot with their measured figures, and **ten sample
recipes** marked `"sample": true` — invented names and figures to fill the list until the real ones are in. Every
recipe carries a `prep_minutes`. The book is edited **in the file only**; mission control has no recipe editor.

Beside the three, **+ Add a meal** puts a further card on the day — the same dropdown, the same fields, and the
time it is served at (*Served at*: the clock's time as the card is added, to be changed on the card) — as many as
the day needs; a card's × takes it off again, and the next save is without it. Added meals are saved as `EXTRA1`,
`EXTRA2`, … in their order (renumbered on every save, so taking one away leaves no gap), each with its `served`
time, and shown as **Extra meal**, **Extra meal 2**, … on the dashboard, in At a Glance and in the record
(*Zusätzliche Mahlzeit*, *Repas supplémentaire*). The old free-text **Other** slot is gone; a `RATION` row in an
older file still loads, shown as *Other* and on the desk as an added meal.

### The meals' power

No meal has its power typed in. Each meal's watt hours are the **food meter** — the Food channel's energy meter,
`sensor.habitat_power_food_energie`, the kitchen's appliances — read through Home Assistant and stored like every other hardware reading
(`src/lib/home-assistant.js`, `ha_reading`): the meter's rise between the meal's hours on its day — **breakfast
06:00–09:00, lunch 09:00–14:00, dinner 15:00–22:00** on the habitat's clock (on both sides of 25 October, when the
clocks go back). **An added meal counts with one of the three** — the one whose hours begin last before the time it
is served at (a tea at 16:30 is dinner's; a snack at 14:30 lunch's; one at 05:30 breakfast's; `slotForTime`) — and
shows that meal's hours and figure, marked *with Dinner*; the record's totals count each window once (the named meal
carries it, or the first added meal in a window with no named meal) — the desk sums nothing: each card carries its
own figure and there is no day total under the meals. The figure stands with every meal wherever it is shown — on
the desk's card (*216 Wh · the food meter, 06:00–09:00*), on the dashboard's **Today's Meal** beside the kcal on
the meal's own line, always with its unit and **0 Wh** when the meter has nothing for the hours (*436 kcal · 216 Wh*;
*120 kcal · 373 Wh (with Dinner)* for an added meal; `layout.mealFigs`) — the hours themselves are not named on the
dashboard and there is no line under the meals about the meter; the hours are in At a Glance (a line under each
day's meals) and in the record (Markdown, JSON with `energySource`, `hours`, `servedAt` and `countsWith`, PDF) —
*so far* on the desk and in the booklet while the hours are still running. Where the meter has a figure it replaces
the file's `energy`, which stands in only where it has none. **Before the
run**, Today's Meal shows the first day's plan with **today's** meter readings (NOW, the rehearsal day), so the
figures are there to be looked at during the rehearsals; from the first sol on, each day's meals read their own day.
The meter and the hours live in the `meals` block of `content/home-assistant.json` (`meter`, the entity id without
`sensor.`; `windows`, slot → `"HH:MM-HH:MM"`, `null` for a named meal that should carry no figure), hot-read like the
rest of the file, with these values as the defaults in code — the meter is named by its **entity id**, so its label
in the sensor list or in Home Assistant can change without touching this (`mealsConfig`, `mealPower` in
`src/lib/home-assistant.js`; `data.mealsFor` puts the figure on every meal). Nothing shows until the meter's readings
are in the station's database: `HA_HOST` and `HA_API_TOKEN` set and the hardware polled.

A slot keeps its own copy of the figures in `meals.json` (`recipe`, `nutrients`, `co2e_kg`, `water_footprint_l`),
so changing the book never rewrites a day already planned. In the file, a meal can also be just
`{ "slot": "DINNER", "recipe": "pfannenbrot" }` and takes everything else — prep time included — from the book. The
figures are public: under each meal on the dashboard, in At a Glance, and in the record (Markdown, JSON, PDF).
`water_total_l` is the recipe's water footprint, not the water drunk — the meal's own `water` figure is untouched.

## Three blogs, and only three

The station carries exactly three blogs, everywhere — the dashboard's Blogs row, the crew log
(`/logbook`), At a Glance, the archive and the PDF record:

| Blog | Who writes it | Where it is stored |
|---|---|---|
| **Commander Blog** | the commanding officer, on their tab | `content/logbook.json` (filed under COMMUNICATION OFFICER) |
| **Daily Mission Report** | the science officer, on their tab | `content/notes.json`, kind `SCIENCE` |
| **Health Report** | the health officer, on their tab | `content/notes.json`, kind `HEALTH` |

The science and health officers have no other blog: their old per-officer "Daily Blog" is gone
from mission control, and any entry for them in `logbook.json` (or left in the database) is
dropped on load. The crew log page shows each day's three blogs, filterable by blog.

The foot of every public page links **Privacy policy**, **ZKM** and **Imprint** — the imprint is the
station's own page, `/imprint` (`src/views/pages/imprint.js`), with ZKM's details in German and English.

## Who writes what

Two kinds of content, with a hard line between them.

**The Commanding Officer.** The first officer is shown everywhere — the public pages in all
three languages, mission control, the PDF record and the archive's exports — as the
**Commanding Officer**, the same person in the same role (they relay and answer the messages
from Earth). The station still files them under their old title, `COMMUNICATION OFFICER`: it is
the key their Commander Blog, their daily figures, their mood and their answers are stored
under, in `content/` and in the database, so nothing filed under it can be lost;
`src/lib/officer.js` turns the stored title into the one on the page.

**Preset, and edited in files.** The daily schedule, the meal plan and the inventory live in
`content/` and are prepared in advance for the days of the run. They can also be edited on the
matching tab of mission control, which writes into the same files.

**Written daily, in the crew's voice.** The commanding, science and health officers each
have a daily blog entry and a state (mood and energy, two sliders). Both are filed from their
tab in mission control — there is no separate terminal inside the habitat, and no second
login. Entries go straight to the public crew log on the landing page, and the latest one
appears under each officer in the Crew section. The slider numbers are never published; only
the sentence each one maps to.

**There is exactly one account.** It signs in to mission control at `/control` and opens the
archive; the seed removes any others. Its name and password are `CONTROL_USER` and
`CONTROL_PASSWORD` in `.env` (the older names `ADMIN_USER` / `ADMIN_PASSWORD` still work), and
the account follows the file at every start: it is created when missing, and a password
changed in `.env` is the password after the next start — so on a server, edit `.env` and
redeploy. With no password set at all the account is created once with the placeholder and
otherwise left as it is.

## Media out of the habitat

The crew send photographs and video out from inside their blog entries: in the
officer's **Daily Blog** in mission control, press **Photo / video** on the composer's toolbar. Each file goes up on its own request with a progress bar, and
the browser makes a small preview first — a downscaled JPEG for a photograph, a captured frame
for a video — so the gallery has thumbnails without the server ever touching the original.
Without JavaScript the same form still works as a plain upload.

Everything is public the moment it is saved: the **Media** page (`/media`) shows it all by day
with filters by kind and by officer, every item has a page of its own with the original
playing in it, the station's Media panel carries the newest, and each day on the crew log
shows what was sent that day. ✕ on a picture in an entry withdraws it from view everywhere;
the file is kept.

**Built as an archive first.** The rules that make it safe to keep for a long time:

- **The original is the record.** Nothing is re-encoded, resized or transcoded — there is no
  image library and no ffmpeg in the build. A preview is a convenience made in the browser and
  stored beside the original; it is never a substitute for it.
- **Every file is stored once, under its own SHA-256**, in the `station-data` volume at
  `/data/media/<xx>/<sha256>.<ext>` — the same volume as the database, so one backup carries
  both. The original filename is kept in the record and used for the download.
- **`manifest.json` sits beside the files** and is rewritten on every change. If the database
  were ever lost, the folder still describes itself: day, officer, caption, size, hash.
- **Nothing is ever deleted.** Withdrawing hides; the file and its record stay.
- **Everything is downloadable**, and every download is verifiable: one file
  (`/media/file/:id/<name>?download`), one day (`/media/day/:n/export.zip`), or everything
  (`/media/export.zip`). The ZIP is stored, not compressed — photographs and video already are —
  and streamed as it goes, with Zip64 wherever a run of video passes 4 GB, so the whole mission
  is one download. `manifest.json` and a `README.txt` are inside it. The ZIP writer has no
  dependencies and is checked by the test suite against Python's `zipfile`.
- **Integrity can be checked at any time**, on the live volume or on any copy — a backup, a
  USB stick, an unpacked ZIP: `npm run media:verify` (or `/control/media/verify` while signed
  in) hashes every file and compares it with the manifest. A withdrawn item can be brought
  back with `POST /control/media/:id/restore` while signed in.
- **The record carries the media.** `/archive/export.json` lists every item per day with its
  hash; `/archive/export.md` has a *Media sent out* section per day; the archive's day page
  shows the items.
- Files are served with `Accept-Ranges` so video seeks, and cached as immutable — the address
  never changes what it returns.

Accepted: jpg, png, gif, webp, avif, heic, tif · mp4, m4v, mov, webm, mkv · pdf, txt, md, csv,
json. Sound files are not accepted; anything not listed is refused rather than stored as a
mystery.
`MEDIA_MAX_MB` (default 4096) caps a single file. A format the visitor's browser cannot play in
the page (HEIC, some MOV) is still whole and downloadable — the page says so.

`bash tools/backup.sh` copies the media folder along with the database.

## Photographs from the cloud

Photographs kept on the ZKM cloud (`cloud.zkm.de`, a Nextcloud) are shown as a grid on
**`/media`** — that page is the gallery and nothing else, **day by day**: the pictures grouped by
the day they were taken (read from the file's name, or its own date), the newest day first,
each day under its head — the sol it was during the run in Mars orange, the day written out in
the page's language (*Friday, 25 September 2026*), *Today* marked, how many pictures — and its
pictures in a grid of rounded tiles, two to a row on a phone and as many as fit on a desk, the
time each was taken under it. **A click on a tile opens the picture in place**, in a small
pop-up over the page, blurred behind it — the picture no wider than 760px, its day and time
under it, arrows beside it (and the arrow keys) to the previous and the next, the cross on its
corner, Escape or a click beside it to close (`lightbox()` in `media.js`, `public/cloud.js`); without JavaScript, or with a
modifier key, the tile opens the original in a new tab as it always did. The station server signs in with
the display account over **WebDAV**, checks the folder for new images on a set **frequency**
(`CLOUD_CHECK_SECONDS`, fifteen minutes by default), follows its subfolders, and keeps a copy of every image it shows on the `station-data` volume under `/data/cloud`
(beside a `manifest.json`), together with the preview Nextcloud renders for it. The browser
only ever talks to the station — `/media/cloud/<id>` is the copy, `/media/cloud/<id>/thumb`
the preview — so the grid stands with the cloud slow, the sign-in changed or the venue
network unplugged, and the credentials never leave the server. It is **read-only**: nothing
is ever written to the cloud. A file removed from the folder leaves the grid on the next read.

**Nothing is pulled from the cloud at night.** Between **22:00 and 08:00, venue time, every
day**, the folder is not listed and no picture is copied — not over WebDAV and not from a
mounted folder either. The crew's lights go out at 22:00; what the camera sees after that stays
on the cloud until the morning read, when the grid catches up. The window is a fact of the piece
and is fixed in code (`QUIET` in `src/lib/cloud.js`), in the venue's own zone, so neither a stale
`.env` nor the clocks going back on 25 October can open it; a read still copying at 22:00 stops
where it is and the rest is copied at 08:00. The gallery's head line says so (*not between 22:00
and 08:00*, and at night *next read at 08:00*), and the server log marks the start and the end
of each night. The one way round it is a rehearsal — `MISSION_OVERRIDE=true` together with
`CLOUD_QUIET=off` — which the test suite uses to run its cloud checks at any hour; on the real
run `CLOUD_QUIET` does nothing.

Everything is in **`.env`**: `CLOUD_URL` (default `https://cloud.zkm.de`), `CLOUD_USER` and
`CLOUD_PASSWORD` (the display account), `CLOUD_FOLDER` (a path inside that account —
empty for its root), `CLOUD_TITLE` (the heading, default *Gallery*), **`CLOUD_CHECK_SECONDS`**
(the frequency — how often the folder is checked, and how often an open `/media` asks the
station for the grid; a picture put in the folder is on every open page within about that
long, with no reload, the same way the board updates — tile by tile, a new day sliding in where
it belongs) and `CLOUD_POLL=false` to hold the
bridge off. Without user and password the
bridge is off and the section is not on the page. Files over `CLOUD_MAX_MB` (default 60) are
listed but not copied. The pages carry the **newest `CLOUD_MAX_FILES`** pictures (default 500 —
a week of one every twenty minutes); whatever the folder holds beyond them stays in the folder
and is simply not shown. Every transfer has a time limit, so a cloud that stalls mid-picture
costs one read, not the bridge: the read moves on, and the picture is tried again next time.
Both gallery heads say when the folder was last read — *checked every 15 min · last at 14:15*
— and, when the latest read failed, that the cloud could not be reached and when, so a
bridge that has gone quiet never looks like a folder that has. Mission control's **Habitat**
tab ends with the bridge's state — how many images, when the folder was last read, what went
wrong — and a **Read the folder now** button; `/api/cloud` says the same without credentials.

**On the landing page** the Mission dashboard opens with the six most recently **added** to
the folder as a strip of its own — a glass card under the dashboard's heading, above the At a
Glance and Media doors, carrying the LIVE badge and the pictures and nothing else (when the
folder was last read is the badge's tooltip; a failed read is still said, in orange) — kept
live on the same frequency (`#cloud-latest`, `cloudLatestInner()` in `src/views/pages/media.js`). **A click on a
picture of the strip opens it in place**, never on a new page: a small frame under the strip, no wider than the
picture and no taller than 320px, its time under it and a × on its corner; the same tile again, the × or Escape
closes it, and the open tile is outlined in orange (`.cloud-peek` in `public/cloud.js` and `aura.css`; the frame
stays through the strip's live updates and goes when its picture leaves the strip). Without JavaScript, or with a
modifier key, the tile opens the original as its link says. "Most recently added" means when the file arrived in the folder (Nextcloud
numbers every file as it arrives; in a mounted folder, the file's change time), not the date
the picture itself carries — a phone's photograph taken yesterday and uploaded now is the
newest. The grid on `/media` is in the same order.

**Or from a mounted folder.** On a machine where the cloud folder is already mounted the
way ZKM's IT sets it up (`davfs2`, an fstab line for
`https://cloud.zkm.de/remote.php/dav/files/system_displays/marsplatz`, a `.davfs2/secrets`
entry), set **`CLOUD_DIR`** to that directory instead of user and password, and the station
reads the images from it — same listing, same copies on the volume, same grid; only no
previews, so the grid draws the originals scaled down. Under Docker the mount has to reach
the container: add `- /path/to/your/mountpoint:/cloud:ro` under the station's `volumes:` in
`docker-compose.yml` and set `CLOUD_DIR=/cloud`. The two ways are the same protocol and the
same account; WebDAV from the station itself needs nothing installed and is the simpler one.

## One rhythm: every fifteen minutes

Every source the station pulls from is read **every fifteen minutes** by default: the external
sensor node (`CRITICAL_POLL_MS=900000`), Home Assistant (`HA_POLL_MS=900000`) and the cloud
folder (`CLOUD_CHECK_SECONDS=900`); open pages ask the station for new readings on the same
beat. A value set in `.env` overrides its default. The station reads as often as this; the
sensor node itself still transmits on its own cycle, so its new values arrive as it sends them.

## The habitat sensor

The Habitat panel — the CO₂ dial, the temperature ruler, the humidity level, the air pressure,
volatile-organic-compounds and light sparklines, and the air quality index as a banded level
with the sensor's own classification (*Excellent* … *Extremely polluted*) as its verdict — is
read from **the habitat sensors** — an M5 ENV Pro (a Bosch BME688 running BSEC) inside the
habitat, and a light sensor beside it — through Home Assistant. Eight entities feed eight
channels, mapped in **`content/home-assistant.json`** under `habitat`:

| Channel | Entity | Drawn as |
|---|---|---|
| `co2` | `sensor.m5_env_pro_env_pro_co2_equivalent` | the 24-hour dial, ppm |
| `temp` | `sensor.m5_env_pro_env_pro_temperature` | the ruler, °C |
| `hum` | `sensor.m5_env_pro_env_pro_humidity` | the level, %RH |
| `pres` | `sensor.m5_env_pro_env_pro_pressure` | a sparkline, hPa |
| `light` | `sensor.environment_light_illuminance` | a sparkline, lux — the light sensor beside the ENV Pro |
| `voc` | `sensor.m5_env_pro_env_pro_breath_voc_equivalent` | a sparkline, ppm |
| `iaq` | `sensor.m5_env_pro_env_pro_iaq` | a level from 0 to 500, ticked at the sensor's bands |
| `iaqc` | `sensor.m5_env_pro_env_pro_iaq_classification` | the verdict under the index, in the visitor's language |

The mapping is hot-read: change an entity id in the file and the next poll follows. The
station reads the sensor every **`HABITAT_POLL_MS`** (a minute by default) — the current
state of every entity, and Home Assistant's history since the newest reading the station
holds, so every change between two polls is kept however often the sensor reports. What is
stored is one row per minute at most, each a full snapshot of every channel (a channel that
did not change carries its last value forward; one Home Assistant reports `unavailable`
carries nothing), into the same table the external node wrote — so the ticker, the trend
graph, the booklet, the archive, the PDF record and the readings ZIP all carry the sensor
exactly as they carried the node, with the two new channels beside the old. A reading counts
as current for five minutes (or three polls, whichever is longer); after that the tiles
clear and say so, as they always have.

The source is chosen by **`HABITAT_SOURCE`**: `auto` (the default) reads the sensor whenever
`HA_HOST` and `HA_API_TOKEN` are set in `.env` and the `habitat` block is filled, and the
external node otherwise; `node` forces the node; `home-assistant` forces the sensor. Every
poll of the sensor is a file in the readings log (`habitat/`), and the log's ZIP carries it
flattened as `habitat.csv` (one row per stored reading) and `habitat-polls.csv` (each
entity's state as fetched, every poll). `tools/mock-home-assistant.js` stands in for Home
Assistant on a machine without the venue network — the ENV Pro's entities, the light sensor and
the sixteen power entities, a draw and a meter per channel — so the whole path can be
rehearsed; the test suite does.

## Where the readings start

The external node (critical-sensors.de) hands back its last thirty days on every poll, and
the habitat sensor's history reaches back a day. The
station keeps only what is stamped after its **readings floor**, and serves nothing older, so the
dashboard and the record never carry weeks of history from before anyone was in the habitat.
The floor is set in one of two ways:

- **From today**, by a build: every time the station starts from a newly built Docker image —
  the Dockerfile writes a build stamp into the image, and a station that sees a stamp it has
  not seen before starts its readings again from midnight at the venue on that day. A restart
  of the *same* image leaves the floor where it is, so restarting during the run loses nothing;
  rebuilding during the run would drop everything before that day, so don't. (`docker compose
  up --build` only makes a new image when something changed; `--no-cache` forces one.) Outside
  Docker, `STATION_BUILD=…` in the environment does the same, and the first start of a
  database counts as a build. `READINGS_DAYS_BEFORE` reaches back that many days further
  (default 0). Before the run the trend graph's axis then starts on the build day and runs
  thirteen days from there, labelled by date, so what the node sends is on the graph from today.
- **From 15 October**, by **Reset to 15 October**: the floor goes to midnight at the venue on
  the first day of the run, whatever the date. Nothing from before the run is stored or shown;
  the trend graph's axis is the run, SOL 01–13, from the reset on. This is the state to open in.

`READINGS_FROM=2026-10-15` in `.env` pins the floor to a date instead, whatever is built or
reset.

**The tiles are today, or nothing.** They draw the readings since midnight at the venue, and
only while the newest of them is less than thirty minutes old (the node transmits every
twenty). If no reading has arrived today, or none in the last thirty minutes, the tiles are
cleared — a dash in every figure, *No current reading* — and the panel says which it is and
when the last reading was. An old number is never left standing as if it were live. The
history stays on the trend graph, which is where history belongs.

**After a build, the floor never hides everything the node has.** If the node's newest reading
is older than a from-today floor — the node has gone quiet — the floor moves back so the last
three days the node *did* send are kept for the graph and the record. A from-15-October floor
never moves. The panel also says why when there is nothing at all: waiting for the first read,
the feed carries no readings for this sensor id (check `CRITICAL_SENSOR_ID`), or the feed
could not be reached. Nothing is ever left as a row of dashes without a reason.

## Wiring the habitat sensors

Any device that can make an HTTPS request can feed the station.

```
POST /api/sensors/ingest
Authorization: Bearer <SENSOR_TOKEN>
Content-Type: application/json

{ "deviceId": "hab-01",
  "readings": [ { "metric": "temperature", "value": 21.4, "unit": "°C" },
                { "metric": "humidity",    "value": 38.2, "unit": "%"  } ] }
```

**Unknown metrics are accepted and registered automatically.** Point a new sensor at the
endpoint with `"metric": "oxygen"` and an oxygen channel appears on the habitat page; set its
thresholds afterwards in `content/sensors.json`. No redeploy, no schema change.

A channel with no reading for `SENSOR_STALE_SECONDS` (default 300) shows **SIGNAL LOST**
rather than freezing on its last value. Interruptions will happen during the run; they are
shown as a condition of the habitat, not hidden.

Other endpoints: `/api/sensors/latest`, `/api/sensors/history?metric=temperature&hours=24`,
`/api/orbital`, `/api/status` (the day, the phase and the time elapsed — no counts: how many
messages were sent and how many visitors there were is mission control's alone, at
`/control/counts` behind the sign-in), `/healthz`.

## The habitat's own hardware (Home Assistant)

**On the marsplatz server Home Assistant is behind an SSH tunnel** that listens on the server's
own `localhost:8088` only, which a container on Docker's network cannot reach. There the station
runs with `network_mode: host` — see **`deploy/marsplatz-docker-compose.yml`** — so its
`localhost` is the server's: `HA_HOST=localhost`, `HA_PORT=8088`, and `LISTEN_HOST=127.0.0.1`
keeps the station on the server's localhost:8080 for the reverse proxy, exactly where the old
port mapping put it. Neither the tunnel nor Home Assistant changes.

The real devices inside the habitat — as configured now: the cricket terrarium's temperature
(`m5_temperatur_cricket_temperature`), NO₂, O₂ and CO from the environment sensor, and **the
habitat's power on eight channels** — crickets, science 1, science 2, living, table, food, water,
hydroponics — each a pair of entities, `habitat_power_<channel>_leistung` (the **draw in watts**, a
gauge) and `habitat_power_<channel>_energie` (the **energy used in kWh**, a counter that only
rises) — hang off a Home Assistant instance on the venue network. The station server polls its
REST API and draws them **inside the Sensors tab**, below the node's tiles, the stores and the
power, with no heading of their own (there is no separate Habitat hardware tab): **one day chart
per kind of quantity** — temperature, power, air quality, … — midnight to midnight on the
habitat's clock, the devices of a kind as lines on one axis in one unit (`hwChart` in
`src/views/pages/public.js`). So **the eight draws are one Power chart** (W, the hourly average),
all eight lines over the 24 hours of the day, named *Crickets, Science 1, Science 2, Living, Table,
Food, Water, Hydroponics* in the legend — the shared *· power draw* of their labels is dropped
there, the chart's title saying it (each line's tooltip keeps the whole label) — and **the eight
energy meters are the Power consumed tile**: a row per channel with the energy it has used today
in kWh (*energy used, from the meters*), through `content/power.json`, whose eight categories
name the meters as `sensor`. **Each chart fills its tile**:
it is drawn for the width the tile has — the page measures its tiles and asks `/api/hardware?w=`
for that width (`public/hardware.js`, at once and again when the window is resized; the server
draws for 240 to 1400 px, 720 until asked), so the plot spans the tile and its type keeps its size
on a desk and on a phone alike; two tiles across where the panel is wide enough, one under the
other where it is not, the lines named side by side beneath the plot. **The current reading is
on the chart itself**: the newest reading of the chart's first line stands in a pill above the
line's end (under it where the line runs near the top of the plot, where the clock of the moment
stands), the pill sized from its text so it holds the figure and its unit whole (*12 W*,
*22.4 °C*) and named after its line where the chart has several (*Crickets 31 W*); the legend
beneath names each line in its colour with the day's low and high and carries no reading. The
energy meters' day is on the Power consumed tile (as kWh, a row per channel) rather than drawn
here. The panel refreshes itself on the poll cycle without a reload; without JavaScript the
server-rendered panel stands. In the **Trends** under the charts the hardware appears as one
value per day — a gauge's daily mean, a meter's daily added amount — except a **power draw**
(a gauge in watts, a channel's socket): a draw is not a trend, its day is on its meter's line
as energy; and a meter a Power category reads is that category's line in the Power group
(*Power · Food*), not a second line under Hardware.

Three things will change, and none of them is code:

- **Where Home Assistant is and how to authenticate** — `HA_HOST`, `HA_PORT` and
  `HA_API_TOKEN` in **`.env`**, and only there; the address and the long-lived token never
  enter the repository. Without host and token the bridge is off and the panel is simply
  not on the page.
- **Which sensors are read** — **`content/home-assistant.json`**, one entry per entity:
  the id (without the `sensor.` prefix), the label the station shows, a fallback unit, a
  `kind` (`gauge` reads as it is; `counter` only ever rises, like an energy meter, and its
  tile also says what today has added) and the decimals to print. The file is re-read on
  every poll, so adding a device is an edit and it is on the station within a minute — no
  restart, no redeploy.
- **How often** — `HA_POLL_MS` (default 900000, fifteen minutes); `HA_POLL=false` holds the bridge off
  without removing the credentials.

The browser never talks to Home Assistant: the server polls, stores every state change in
its own database (`ha_reading`), backfills the drawn day from HA's history endpoint after a
restart, and serves the rendered panel at `/api/hardware` — so the history accumulates,
survives restarts, and keeps serving if Home Assistant goes quiet (the panel then says so
rather than standing on stale numbers as if they were live). An entity that is not in the
feed is named on its tile rather than silently blank, and `unavailable`/`unknown` states
are never stored as readings.

The hardware follows the same disciplines as every other reading: nothing stamped before
the **readings floor** is stored or shown, **Reset to 15 October** clears the readings so
the run starts clean, **every poll is written to the readings log** — changed or not,
answered or not, each entity exactly as Home Assistant returned it with its attributes and
both timestamps, and every row the history backfill fetched (`home-assistant/` in the ZIP)
— and from the end of 27 October 2026 Home Assistant is not polled again — the record is
closed, and the panel stands as the run left it. The database keeps one row per state
change, which is what the panel draws; the log keeps every pull.

## Everything pulled is kept

Every reading the station pulls or receives is written to disk the moment it arrives, as
one JSON file per pull, and never rewritten or deleted — not by the reset, not by the
database's own trimming, not by anything. `src/lib/readings-log.js`, on the `station-data`
volume beside the database and the media, under `readings/<source>/<day>/<time>.json`:

| Source | One file per |
|---|---|
| `habitat/` | every poll of the habitat sensor through Home Assistant — each entity's state as fetched, the history call's reach and count, and the rows the poll stored; a failed poll is a file too, with the error |
| `node/` | every poll of the external sensor node — the readings that poll added (the node repeats its whole last thirty days each time; only what the station did not already hold is written), with the counts of what came back, what was a duplicate and what was before the floor; a failed poll is a file too, with the error |
| `home-assistant/` | every poll of the habitat's hardware — every entity as returned, whether or not it changed, plus history rows fetched |
| `ingest/` | every batch posted to `/api/sensors/ingest`, as posted |
| `resources/`, `figures/` | the stores and the crew's figures, each time they change |
| `daily/` | each day's habitat summary as it is sealed |

All of it downloads from mission control: **`/archive/readings.zip`** is the whole log with
`index.json` and a `README.txt`, and inside it `csv/` holds the same log flattened for a
spreadsheet — `habitat.csv` (one row per reading stored from the habitat sensor) and
`habitat-polls.csv` (each entity's state as fetched, every poll), `home-assistant.csv` (one row per entity per poll), `ingest.csv` (one row per
reading posted), `node-polls.csv` (one row per poll of the node) and `node.csv` (one row per
reading the node ever sent, with the poll that brought it in). Each
table is also on its own at **`/archive/readings/<name>.csv`**, and `/archive/readings.json`
lists every file. The tables are built from the JSON files on request and add nothing the
files do not hold.

---

## The landing page: three pages in the glass dress

The landing page — the mission page, `/` — keeps the layout of the design handoff of September
2026, pared down — pages one under the other: **the way to the habitat** — the Earth at the
foot of the screen, the habitat far above it, a dashed line between them, and the latest exchanges
and pictures coming and going around it; **the second page** — the note (what MARS! is, the words
of October's text sheet, with no keys under them any more) and under it **the two calls**
(October; `calls()` in `src/views/pages/landing.js`, drawn into `note()`; `sheet.css` under *the
two calls* and *the second page on a desk*) — **on a desk the note stands at the left and the two
calls one over the other at its right** (`page2`, October's picture: the note a card at the page's left, as tall as the two calls,
its words in the middle of its height; the two calls one over the other right beside it, across the rest of the page's
width — "the 2 buttons on the right of the box" — their words at the left and the drawing small over them; the three
cards one rectangle, and the whole fits a window of 900 px. **The widths are two variables on `.page2` in `sheet.css`**,
to be changed in that one place: `--note-w`, how wide the note's card grows where the page allows — 1000 px, October:
"double the width" — and `--calls-w`, the least the calls' column is — 460 px; the calls take what is left of the
page, and on a narrower page the note gives way first), on a phone the note first and
the two calls under it; each call a card of glass, the whole card the door, in the colours of the
theme chosen: **Send a message to the crew**, with the thing to know set large under its title —
**APPROVED MESSAGES ARE BEAMED INTO SPACE**, in capitals, in a gradient of Mars and light
(`background-clip: text`) with a glow of Mars about the letters and a shimmer of light passing
along them now and then (by day the light in the gradient is a pale peach, by night white;
October: "the entire part should look exciting", then "the previous orange style" — the galaxy
the letters were cut out of for an hour stays drawn, `tools/galaxy.py` and
`public/space/galaxy.jpg`, unused); the sentence that says how (*Mission control reads every message. The ones it
approves are beamed into space by radio.*) and the orange Write key (the count of messages sent
into space is not written any more — `data.counts().sentToSpace` stays for whoever wants it);
its drawing a dish sending at the foot, its waves going out, the dashed way up into space
with WRITTEN and APPROVED standing on it and INTO SPACE under its open end — nothing drawn
there: the Mars disc that stood at the end lost its dome, then went altogether (October, "have
nothing there"), so the way ends in the open and the signal goes off it — a signal going along it again
and again (SMIL `animateMotion`; still, and gone, where less motion is asked for); and **Follow
what the crew is doing — live** in cobalt, with no drawing of its own — a LIVE pill on its line,
the sentence and the Live Mission Dashboard key (no *Thirteen sols* line, no chips, and no line
of what the crew are doing at this minute any more), its words in the middle of the card (a phone
has the station's name at the head of this page, and the note and each door are stops of the
scroll); and *Welcome to the World's Slowest Chat* under a heading of its
own — its name large and bold, a short orange rule — with a line across the page setting it apart
from the note. Nothing stands under the three pages: the composer is the Write page's pop-up, and
every Write door here leads to it (`/write#write`; see *The mission page*). (The handoff's page
numbers and part pills — *P02 / 04 · Note 00*, *Part 1 of 2* — are not written any more, and the
mission's two chapters that stood between the note and the chat are gone: the About page tells the
mission. **The habitat in section** — the cutaway drawing of Red Dust City on the Mars plain, every
module a key that lights up in colour under the hand, opening a card that says what that part of
the habitat is and what is happening in it now — is a section of the About page since October,
before *Who we are*; it is described below, with the pages, because it is drawn in the same dress.) It is drawn in the station's own dress: **a plain
ground — white by day, black by night** — cobalt ink, **frosted glass floating on soft
shadows**, rounded cards and round pills, the orange keys (`src/views/pages/landing.js`,
`inside.js`, `sky.js`; `public/aura.css`, `public/sheet.css`, `public/sky.js`). Dark is the
default. **Every pop-up closes with the same key** — the room pop-ups, the sky's notes, the
media pop-up, the composer's pop-up on a phone: a round key, 34px (40px under a thumb), its
cross two strokes drawn in the markup (an inline SVG, not a typed ×), its sides pinned equal in
one rule at the end of `aura.css` so that neither the station's wide-key styling (spaced
capitals, a lift on hover) nor the 44px touch height (`station.css`) can stretch it or push the
cross off centre; the media pop-up's arrows are drawn the same way.

**On a phone held upright the landing goes a page a swipe**, in the swipe's direction — the
way to the habitat, the name and the note, the chat, then the foot (CSS scroll snapping, each
page a stop the scroll cannot fly past). Each page fills the screen between the header and the
bar of keys (with the browser's own bars folded away, as they are once the page is scrolled); a
page that does not fit as drawn is set a little closer, and one that still does not (a small
phone, a long language, the chat's three steps) stops at each of its parts as well — the note,
the card of steps and each step after the first — so nothing on it is passed
over; two stops closer than a flick of the thumb become one (`public/sky.js` measures and marks
them). A mouse wheel or a touchpad in a window that narrow turns one stop a turn. While a pop-up
is open the page stays where it is. **On a desk the page scrolls freely**, each page about a
window tall with its cards in the middle and air around them, a margin at both sides as before.

- **The way to the habitat — the first page** (`landing.js`, `space`; laid out in `sheet.css`
  under *P00*), after the mock-up. A room of night on the page by night — the room is space —
  with a field of still stars — **by day as by night**: the light theme leaves the room as it is
  (October: "the same image for day and night — the default night image"), the same Earth strip
  at its foot, the same stars and drawing; only the page around the room turns light. (A room of
  daylight — a pale sky, the Earth in daylight, the drawing dark — was drawn for the light theme
  for a while and is gone; the day strip it used, `public/space/earth-day.jpg`, stays on disk,
  unused.) **The Earth at its foot**: a photograph of its
  limb from orbit (`public/space/earth.jpg`, 1414 × 340 — the picture handed over, cut to the
  arc, its haze let fade in where the picture cut it off), the horizon curving away below the
  page, its bright limb the arc's height above the room's foot, and over it **a mesh of dots**
  that begins just over the limb and thins out quickly with height — rings of dots about the
  limb's circle (radius 997, centred at 674 × 1079 in the picture, the apex of the limb 24 %
  down it), every ring the same angular pitch so the dots line up along the radii too, each
  ring fainter than the one under it; one set for a desk (the first ring 8 over the limb, then
  13 apart in the picture, dots 0.6° apart) and a closer set for a phone, where the picture is a
  quarter the size (`halo()` in `landing.js`; `sheet.css` shows one). **The habitat far above,
  at the top**: the line drawing of the geodesic dome handed over (`public/space/habitat.png`,
  1004 × 699 — its lines made white on nothing, so it stands on the night), a Mars light
  behind it, its name **RED DUST CITY** in Mars orange beside its front foot (no call under it
  any more: *Send a message to space* is gone, and the doors to the composer are the note's and
  the bar's); and **between them the way a message goes**: a dashed line straight up from the
  Earth's limb to the habitat's front foot, a white signal climbing it and the crew's answer
  coming down it in Mars orange — the same composition on a desk as on a phone, the Earth in the
  middle of the foot and the habitat above it, the habitat kept small on a desk (a quarter of the
  window's height at most, `--dome-w` under *a wider screen* in `sheet.css`) so the room between
  the two is deep. (An earlier desk layout turned the composition — the Earth in the lower left
  corner, the habitat in the north-east and a trajectory between them, going on past the habitat
  into space; the trajectory's SVG and `public/sky.js`'s `trajectory` remain in the code, off,
  for whoever wants it back.) Around the line, **on either side, the latest exchanges with Earth
  and the newest pictures from the habitat come and go, small** — a desk's pictures 136 wide, its
  lines 300, their type a size down (`SIZE` in `public/sky.js`, `sheet.css`) — the sky, below,
  which keeps to the band between the habitat and the Earth and off the line — and on the Earth
  stands the nudge to scroll on, which the sky keeps clear of too. The picture of the Earth is a
  little wider than the room on a desk and the width of the screen on a phone. **The page's words
  stand at the left of the room on a desk, the room at the right** — two columns, 2 : 3, the words in
  the middle of the room's height (October: "shift the Earth–habitat visual to the right and have
  this on the left") — and **over the room on a phone**, the room under them a screen of its own,
  the width of the screen and its height between the header and the bar of keys, and a stop of
  the scroll (the next swipe brings it whole). The words (`intro` in `landing.js`, drawn once):
  the eyebrow *ZKM | Hertzlab • Durational performance* in Mars, **MARS!platz** large with *Ground
  Station* under it (the page's one heading), the paragraph on what the site is for — *MARS!
  turns the Karlsruhe Marktplatz into MARS!platz. Can we go to Mars to save the Earth? …* — which
  the note below used to carry (the note keeps its lead alone now), then the run (the dates in
  Mars orange, the thirteen sols, and *opens in N days* before the run, *SOL 05 of 13* during
  it). The drawing is decorative and hidden from assistive technology; the exchanges in the
  sky are the board's own. (To change either picture, replace the file under `public/space/`:
  the Earth's must keep its 1414 × 340 box and its limb where it is, or the mesh and the
  line's foot move with `EARTH` in `landing.js` and the `24.1%` in `sheet.css`; the habitat's
  keeps its axis down the middle and its foot near its bottom edge, `HABITAT`.)
- **The habitat in section — a section of the About page** (`/about#inside`, between *What this
  is* and *Who we are*; `src/views/pages/inside.js`, `habitatInside`, placed by `aboutPage` in
  `info.js`; the styles under *P03* in `sheet.css`, the pop-ups' and the round keys' in `aura.css`).
  Under the section's head — *What’s inside the habitat?*, with the hint **Point at a room to know
  what is inside.** on its line (*Tap a room…* on a touch screen) — stands **the habitat in section,
  on the Mars plain**, with the line **AI generated image** under the picture (`in-credit`, small
  capitals, translated):
  the cutaway picture that was handed over as two files in `public/Svg_File/` —
  `mars-habitat-lineart-modules.svg` (1536 × 1024) and `mars-habitat-colored-modules.svg` (3072 ×
  2048), each an Inkscape stack of pictures: the Mars plain with the sky, the geodesic dome, and
  **the thirteen modules** under it, each a layer in its own box — the geodesic dome on the red plain
  and, under it, the modules floor by floor: the hydroponic plants, the communication station under its
  dish, the science station; the airlock, the kitchen, the storage, the relaxing area with its round
  sofa, the crew quarters with their two pods, the health station; the equipment lockers, the water
  recycling system, the cycle that makes the power and the power systems. The page draws **the line-art
  stack composed into one picture** (`public/habitat/scene-lines.webp`, the dome on the plain in its
  white lines, the whole picture in a frame with rounded corners on a desk, `VIEW` in `inside.js`), and
  **every module is a key: under the hand it shows itself in colour** — its cut-out of the coloured
  picture (`public/habitat/modules/<id>.webp`, cut at twice the picture's size for sharpness, 194 KB
  the thirteen together) comes in over its lines, a bright band sweeps across it once, and its name
  comes up on a tag at its floor line (unseen otherwise: the picture carries its own detail, and
  thirteen names would stand in it) — and gone as quickly when the module goes dark again (under *less
  motion* the sweep is left out, and the picture is simply there). The modules' boxes are the line-art
  file's own layers (`rect` in `ROOMS`, in the picture's coordinates), trimmed where two of them
  overlapped, and **their names are October's text sheet's** where it names them, the file's layer
  names otherwise (*More-than-Human* — the hydroponic shelves, the crickets, the dog and the robot —,
  *Communication*, *Science Mission*, *Airlock*, *Kitchen*, *Storage*, *Crew* — the round sofa —,
  *Living Quarters*, *Health Station*, *Equipment Lockers*, *Water Recycling*, *Cycle (Power
  Generation)*, *Electricity*; the EVA key *Going Outside*; translated in `i18n.js`) — to rename one,
  change its `label` in `ROOMS`. **The pop-ups' words are the text sheet's too, the explanation
  first and NOW second**, and NOW says what the sheet asks: the mission by its title and its question
  (no number); the EVA with the day's science mission's title (*Day 01's EVA is at 16:00 – Care as a
  Finite Resource*); the sensors as CO₂, temperature and humidity alone, with when they were read;
  the communication hour (when the next one is, and the day's question for it, the mission's
  community question); the water with the meals' hours on the schedule; the crickets' box
  temperature from the hardware (Home Assistant's *Cricket Temperature*), the food rations when
  there is none; the crew's moods in the Living Quarters, the schedule in the Crew's room; the
  section's head asks *What's inside the habitat?* (`dome.js`, `figures()`). The scene
  and the cut-outs are made from the two files by **`tools/habitat-modules.py`** (Pillow: it composes
  each stack's layers, cuts the coloured scene at the line-art boxes ×2 and writes the WebPs — run it
  again after either file is replaced, then bump the `?v=` in `inside.js`); the files themselves stay
  in `public/Svg_File/` and are not drawn by the page (8.8 MB and 3.5 MB of embedded PNG — the page
  loads 270 KB for the scene and 194 KB for the thirteen cut-outs). **Nothing else is in the
  section**: no card of glass (the picture stands on the page's ground, in its frame with rounded
  corners), no sheet under it (the grey sequencer's sheet stays in the code, `sky.js`,
  `habitatSheet`, unused), no sky of exchanges over it (the sky is on the mission page's first page),
  no frame of corners. **On a desk the drawing stands at the left and a column at its right** (a
  little under a third of the section's width) is where a pop-up opens — as wide as the column,
  level with the middle of the drawing; the hint on the head's line fades out of its way while one
  is open. The picture is drawn whole at its own shape (3 : 2, the whole of the sky over the dome),
  as wide as the section leaves beside the column. On a phone the section is the picture's — the
  head and the hint over it, the picture edge to edge at its own shape (the whole dome the width of
  the screen), the credit under it — and **the pop-up opens under the picture** when there is no
  room for it over the picture under the header, as tall as the screen allows (its body scrolls
  inside), so the module that was tapped stays in view in colour.
- **The dome with its floating keys is not drawn any more**, nor the traced linework of September
  (`public/habitat/inside.svg`, `tools/trace-inside.py`, the plain `ground.jpg` and the five rooms
  in `public/habitat/rooms/` stay in the folder, unused). The code of the dome stays (`dome.js`,
  `habitatDome`, and the earlier cutaway in `cutaway.js` and `public/cutaway.js`), unused, in case
  the run wants either back; `dome.js`'s `figures()` still writes every pop-up's sentences and
  `/api/dome`.
- **The modules are the keys.** Each of the thirteen is a key: its box on the picture (`ROOMS` in
  `inside.js`), its name on a tag at its floor line while it is lit, and — for the twelve that have
  sentences — its pop-up, whose key leads where the module's business is. The sentences are the ones
  the station already had (`dome.js`, `figures()` and `ABOUT`; the earlier drawing's `ROOMS`): the
  *Hydroponic Plants* (the food store and the harvest; to the stores, `#stores`), the *Communication
  Station* (the latest exchange and the commanding officer's condition; to the exchanges), the
  *Science Station* (the day's mission, its number, title and central question, and the sensors'
  newest reading — CO₂, temperature, humidity, pressure, the air quality index — while it is
  current; to **Today's Mission**), the *Airlock* (today's EVA — on now, still to come at its hour, or
  already made, read off the schedule; to the schedule), the *Kitchen* (today's meals and the food
  store; to **Today's Meal**, `#galley`), the *Storage* (the water and the food; to the stores), the
  *Relaxing Area* (each officer's condition and the task on the schedule; to the **Media page**,
  *Open the Media Gallery*), the *Crew Quarters* (the hours of rest on the plan; to the schedule,
  *Open the Daily Schedule*), the *Health Station* (the health officer's condition, the steps and the
  kcal; to **Crew Moods**, `#crew`), the *Water Recycling System* (the water store and the loop; to
  the stores), the *Cycle* (the steps pedalled and today's kWh; to the power, `#power`) and the
  *Power Systems* (today's kWh by category; `#power`); the *Equipment Lockers* light up and are
  named, and open nothing — nothing was ever written about them. A link to something inside the
  Habitat folder opens the folder and lands on it (`public/folder.js`); on a phone every such door
  leads to the dashboard page (`public/tabbar.js`). Lit — under the hand, with its pop-up open, with
  keyboard focus — the module is in colour (every layer of a module carries the module's id, so all
  of them light together). Two keys are
  not modules and stand in front of the habitat on the ground, round keys with line icons as
  the dome drew them, each named on a tag under it (over it on a phone, which hides the tags): **EVA**
  at the right, the crew's daily walk outside (a rover),
  whose pop-up says what an EVA is and, after **Now**, when today's is — on now, still to come at its
  hour, or already made, read off the day's schedule; and **Dashboard** at the left (four panels),
  whose pop-up says what the mission dashboard is — the station's instrument panel — with, after
  **Now**, the sol, today's tasks done and the exchanges published, and the key **Open the Mission
  Dashboard →** (on a phone held upright it leads to the dashboard page, as every such door does);
  a desk draws the two a little larger than the picture's units, a phone much larger, under the
  thumb (`DESK_KEY`, `PHONE_KEY`).
  **On a desk the hand alone opens a module's pop-up**: a moment over a module (or a key, or a tag)
  opens it **in the column at the right of the drawing, never on the
  picture** (`place()`, `column()` in `inside.js`; a screen too short for the column — under
  521 px — opens it beside the part under the hand) —
  without taking the page: no backdrop, the hand can go on to
  the next module, whose pop-up takes the place of the last (over the lockers the last one simply
  goes), or into the pop-up itself to its key —
  and a moment after the hand has left both, it goes (the pop-up is set where a pop-up in the top
  layer would stand and then moved by whatever the card's frosted glass, which contains what is
  fixed inside it, took off; `put()` in `inside.js`). A click, a tap or Enter opens the same pop-up
  for good, over the page, until it is closed with its ✕, Escape or a touch beside it. Every pop-up
  says what that part of the habitat is and, after **Now**, what is happening in it at this minute
  (the task on the schedule, each officer's condition as words, the stores and their days left, the
  latest exchange, today's kWh, the steps pedalled, the hours of rest on the plan), asked for again
  every twenty seconds from **`/api/dome`**. The tags are set in the drawing's units and enlarged
  again where the drawing is drawn small, so a name reads at no less than about 12 px; a phone shows
  the drawing without them — a module is tapped, and its pop-up names it — with the two outside keys
  standing in front of the habitat on the ground, drawn larger under the thumb.
- **The sky — on the first page.** In the room between the Earth and the habitat the newest exchanges with Earth come
  and go one after another, and the **newest pictures from the cloud folder** appear as small
  snapshots. **On the first page each wears a minimal white frame** — a hairline and a bracket
  at each corner: an exchange's line (*QUESTION · callsign · time*) in small white capitals over
  its words, and the crew's answer under them with an orange rule at its left and *ANSWER* in
  orange, so what is Earth's and what is the crew's is plain at a glance; a snapshot in the
  same white frame, in colour, its time in white over it. (The head-up dress described next —
  the plates, the cobalt, the grey — is the sky's own; the first page's night calls for less.)
  **Each is framed as a head-up display
  frames a readout**: a hairline edge with a faint glow, a bracket at each corner, and a data
  plate with a slanted end — cobalt for the pictures and for what comes from Earth, Mars orange
  for the crew's answer. **Each is headed** (October: "the top say Latest Message: and Latest
  Image"): an exchange is a dark translucent panel headed *LATEST MESSAGE:* with a live dot, then
  the plate *QUESTION · callsign · time* under it, the question in white beneath, and the crew's
  answer in a box of its own inside it, framed in orange with a bar at its left and its plate
  *ANSWER · ✧ officer · time*. A snapshot has the plate *LATEST IMAGE* over it, with the live
  dot, and the moment it was taken, as its file name writes it, at the foot of its frame over the
  picture (`greenhouse_trays_2026_09_25-16-41.jpg` → *25.09.2026 · 16:41*, the year left off where
  the snapshot is narrow; the file's own date when the name has none) — the picture in a hairline
  frame with faint scan lines over it (the words come with the page in the visitor's language,
  `data-latest-msg`, `data-latest-pic`; `public/sky.js` puts them on). As one comes in, a bright line
  sweeps down it once (not where a phone asks for less motion). The note a touch brings wears
  the same dress. **A touch on a snapshot or
  on an exchange brings a note beside it saying what it is** — a name and one key, no more
  words: on a snapshot *LIVE FEED — Live feed from the habitat* and a **Media Gallery** key; on
  an exchange *LATEST COMMUNICATION — The latest communication from the habitat* and a
  **Message Board** key that leads to that exchange on the board. What was touched stays while
  its note stands; the note goes with its cross, a touch anywhere else, Escape, or after twelve
  seconds, and nothing is placed over it meanwhile (`skyNotes()` in `sky.js`, `public/sky.js`).
  Each **fades in, stands and fades out — nothing moves** (the fade stays even where a phone
  asks for less motion: it is not a movement) — and **comes somewhere else each time, close to
  the line, on either side of it, in the band between the habitat and the Earth** — never
  beside the habitat, never on the Earth: on a desk a snapshot 184 px wide and an exchange as
  wide as its words need, up to 380 px, each standing at the line's margin or up to 44 px out
  from it; on a phone each as wide as the room beside the line allows (about 178 px — three
  lines of a message, its line without the time, the whole of it on the board). **Two
  exchanges and two snapshots at a time at most**, one of each at least while there are any —
  **clear of the habitat's drawing and its name, the Earth's globe, the nudge and everything
  else in the sky**, every line and snapshot still there, even while it fades (the page marks
  what the sky keeps clear of: `data-sky-round` for the globe, `data-sky-solid` for the rest;
  the lanes keep off the line) — and away from where the last few were. **The sky is never empty while there is anything to show**: each exchange and snapshot
  stands a little longer or shorter than the last, so they never all go at once, and as one is
  about to fade its successor of the same kind is brought in (and again as it fades), so that
  something is always standing; when no place is free the turn passes and the next tries
  again, once a place has come free. **Nothing in the sky is drawn over anything else**, on a
  phone either. Only published exchanges — the board's own — never a message still waiting for
  mission control or one it turned down; a sky with nothing to show stays empty. The sky asks for
  nothing on its own: the board is read again only when the dome's refresh says there is a new
  exchange, and the snapshots follow the Habitat panel's strip of pictures that
  `public/cloud.js` keeps current (`sky.js`, `public/sky.js`).
- **The nudge, on the Earth.** At the foot of the first page, on the Earth, stands **an arrow
  pointing down, in Mars** (October), on its own, bobbing gently, that nudges the visitor on to the pages beneath;
  it is a link to the next page as well, and it is gone once the page has been scrolled and
  back once the page is at the top again (`scrollNudge()` in `landing.js`, `public/sky.js`).
  The habitat's sheet ends at the ground line the dome stands on — its columns, tracks and the
  day's line with it — with nothing under it now. The line that used to turn there every six
  seconds — what the crew are doing now, the signal's time, the last answered exchanges — is kept
  in `landing.js` (`underLine()`) unused, in case the run wants it back.
- **The note**, on a card of glass under *DURATIONAL PERFORMANCE*: *MARS is a durational
  performance in which three crew members are always in the habitat for the thirteen days of the
  run* — and what this website is for, with three pills under it: **Write to the crew →** in
  the orange of the composer's key (the composer, `#write`), **Mission dashboard →** and **Know
  more →** in cobalt (`#mission`, and the About page); on a phone held upright `tabbar.js`
  leads the first two to the Write page and the dashboard page. (Nothing on the station says or implies that the crew cannot leave
  the habitat: they go out on EVAs every day — the EVA key on the dome says so. The wording
  everywhere is that three crew members are always in it.)
  The note's lead stands alone on its card now: the paragraph on what the site is for — *MARS!
  turns the Karlsruhe Marktplatz into MARS!platz…* — moved to the first page, beside the room,
  with the station's name, the eyebrow and the run (October; `intro`), on a phone too, so the
  note no longer opens with the name.
- **The world's slowest chat.** Its heading with the welcome under it — *Every
  day at 19:00 CET, the Habitat opens its communication window…* — and no photograph; then what
  becomes of a message in three steps on one card of glass, each step's sign in a small tinted
  disc of its own colour — Earth's blue, the crossing's violet red, Mars orange — on a dashed
  thread: **01 Uplink** *Send a message* (the visitor's words in a bubble under their own
  callsign, and under the queue a line of its own: *Every message goes two ways: to the crew in
  the Mars habitat — and, by radio, out into space, where it travels on at the speed of light.
  Tap it on the Message Board to see how far it has come.*), **02 Transit** *Signal in transit*, **a dot crossing from Earth to Mars** in the
  time the station takes (`TRANSIT_SECONDS`), the way it has come lit behind it, with today's
  distance and light-time — the page moves it itself, frame by frame, so a phone set to less
  motion (or saving power) still sees the signal on its way — **03 Downlink** *Crew response* —
  the crew answering from **19:00** — the communication hour — every day of the run (`WINDOW_TIME` in `landing.js`),
  written with the venue's zone and nothing more — *19:00 CET*, in every language, all through
  the run: the station never writes the summer-time abbreviation (CEST, MESZ), while the hour
  itself stays the venue's own on either side of 25 October, when the clocks go back
  (`ZONE` and `windowWhen()` in `landing.js`; the running line writes it the same way). The page ends in the orange key **Write to the crew →** (the Write page, `/write#write` —
  the composer open on a phone, in view on a desk).

**On a wider screen** the first screen is the way to the habitat: the band across its top —
**MARS!platz : Ground Station large in the top left corner**, the page's one heading (*Ground
Station* after the name, smaller and lighter), with *ZKM | Hertzlab* and
the run beside it on its baseline (`intro()` in `landing.js`) — then
the room the width of the page — the habitat at its top, the Earth at its foot, the line between
them with the sky's exchanges and pictures either side, and the nudge on the Earth. Then the
note in two columns with its doors and its Know more key; the habitat — the dome on its card
with its keys floating inside it, the pop-up opening in the room over it; the
chat's heading and welcome and the three steps in a row, each page about a window tall. Then the portal — the composer and the board — and the dashboard, as
before — alive, with its instruments among the habitat's tiles and the day's mission typed out (*Visual language*).

## Communication is the point

The station is not a site about a performance with a contact form attached. The first thing
below the headline on the landing page is the composer itself — your callsign, the message
box, the tags, the transmit button — with the orbital plot beside it showing the distance the
message will cross. Habitat readings, crew conditions and the daily schedule sit *below* it,
as context for the message you are about to write rather than as the main event.

Writing and reading both happen on the landing page, so neither has a tab: below the composer
sits the live exchange feed, the most recent published messages with their replies. The old
`/communicate` and `/board` addresses redirect to the anchors on `/`. The navigation opens
with **Mission** and **Archive** and lets the habitat data come after.

## Everything is kept

Nothing on this site is transient. Each mission day is rolled up and **sealed** into a
permanent record shortly after it ends, holding:

- the schedule as it was actually run, with each task's status as it stands
- the meals as entered, with energy, water and preparation cost
- the stores as they were counted that day — the figures written into
  `inventory-levels.json` (by the Habitat tab or by hand), and nothing else
- the power and the crew's steps and calories as they were filed
- every crew entry the crew wrote that day, and every mission note
- every crew state filed by mission control, with the value chosen and the sentence it is shown as
- a summary of every habitat channel — lowest, highest and mean reading, and how many readings
- **every reading of the day**, as stored: the station's channels as one row per instant with a
  value per channel, the external node one row per reading, the hardware one table per device
- **the Habitat tab as it stood when the day ended**: at the seal, a few minutes after
  midnight, the day's schedule, meals, steps and calories, inventory levels and power are
  written to the readings log with the day's summary (`daily/<date>/…json`, `habitatTab`), so
  the record as printed later — from the files as they then are — can be checked against the
  tab as it was

**The messages from Earth and the crew's replies are not part of the record** — not on the day
pages, not in the PDF, the Markdown or the JSON. They live on the station and in mission
control's queue only. Mission control's audit trail is not in the record either; it stays in
the database.

**The record holds only what was entered or measured.** Nothing in it is generated: no chart,
no projection, no total, no figure carried from one day to the next, and no plan for a day that
has not come. A store that was not counted on a day has no figure for that day (the site's
Habitat panel carries yesterday's figure forward at its draw; the record says "no store was
counted"). A day that has not happened has no record — `/archive/day/:n` and its downloads
answer 404 until the day arrives, and the full record lists the days ahead by date only. The
day-of-readings written by the seed on a fresh install (`seed-01`) and by the simulator
(`sim-01`), and the demo rows of the external node, are never rolled into it, and the seed
writes no readings at all once the run has begun or a reset has been made. The mid-scale
state the content loader gives a new officer so the public crew page has something to show is
not a filed state and is left out too.

Raw sensor readings are kept as well; the rollup exists so the record does not depend on
re-scanning a hundred thousand rows, or on those rows surviving a future cleanup. Nothing
that has been publicly visible is ever hard-deleted.

### The record, as one document

**Download full record (PDF)** — at the top of mission control, on the archive contents page,
and at `/archive/export.pdf` — hands over the mission as a single PDF, bookmarked by
section and by day, with a contents page. In order: the mission (crew, the stores tracked
with what was carried in, the monitored channels); **the days** — a table of every day of the
run, then a chapter for each day that has happened, in a fixed order: **the communication
officer** — Daily Blog and crew state; **the science officer** — Daily Blog, Daily science
findings and crew state; **the health officer** — Daily Blog, Daily health activities and crew
state (each blog and report with **every photograph set where it was placed**, and every
video, sound file and document listed with its poster frame, size, duration and hash; each
state with the value chosen and the sentence it is shown as); then **the Habitat tab** of
mission control as it stands at the time of the record — the schedule with every task's
status, the meals, the steps taken and calories consumed, the inventory levels row for row as
the tab shows them (available at the start, used today, left for the future, each figure
marked *counted* when it was filed that day or *carried* when it follows from the day before)
and the power; then **the habitat sensors, named as on the dashboard** — the sensor node (the
Habitat panel: Carbon dioxide, Temperature, Humidity, Light, Pressure, Node battery, Signal),
the station's own channels and the Habitat hardware, first each channel's lowest, highest and
mean reading over the day, then **every reading of the day** — the node one row per reading,
the station's channels one row per instant with a column per channel, the hardware one table
per device, every value as stored, habitat time to the second; then
**the crew log, whole** — every blog entry in full, day by day and officer by officer, held
entries included and marked; and the **media index** with every file's SHA-256, checkable
against the ZIP with `sha256sum`. `/archive/day/:n/export.pdf` does one day. Nothing is drawn
and nothing is derived: the record has no charts, no totals, no projections, no chapter for a
day that has not come, no messages and no audit trail.

**Before the run, NOW shows the shape.** Until 15 October the archive's contents page opens
with a **NOW** row — today, the rehearsal day (mission day 0; see *NOW — the rehearsal day*
under mission control) — and `/archive/now` (with `/archive/now/export.pdf`, `.md` and
`/media/day/0/export.zip`; `/archive/today` leads there before the run) is a day's record built for today: today's readings from
every source with their summary, the states filed today, the exchanges published before the
run, and everything mission control has filed under NOW — its schedule and meals, the blogs
and reports, the counts, figures, power and media. The full PDF and the Markdown carry it as a
chapter after the list of days, the data copy as a `rehearsal` block beside them, the readings
log as its own `daily` record, the media ZIP in a `now-rehearsal/` folder and the messages
exports marked *NOW · before the run*. It is marked *REHEARSAL · NOT THE RECORD* wherever it
appears and disappears on the first day of the run, when day 001 takes its place; from then
on `/archive/today` simply leads to the current day. A station rehearsing against made-up dates
(`MISSION_OVERRIDE`) keeps NOW all through, beside the sols it records.

The PDF is composed by the station itself — `src/lib/pdf.js` is a dependency-free PDF
writer in the spirit of the ZIP writer, with the standard Helvetica and Courier that every
reader has built in, so nothing is embedded and nothing is fetched — and it takes well
under a second for a full run. Photographs go in as the preview the browser made at upload
(a JPEG whatever the original was), so the document stays a few megabytes; the originals,
byte for byte, are in the media ZIP. A PNG with no preview is decoded and stored losslessly.
The one thing it cannot do is show characters outside WinAnsi, so `✧` and `CO₂` become
`·` and `CO2`.

### The record, readable

`/archive/export.md` hands over the record as plain Markdown: every day that has happened,
with its schedule, its meals, the stores counted that day as they were written, the power and
figures as filed, everything the crew wrote, every state filed for them with the value and the
sentence, the mission notes, the habitat summary and every reading of the day as a table per
source. In order, as entered, nothing added, no messages. It opens in any text editor, prints without a stylesheet, and still
makes sense with nothing left to render it — which matters for a record that is part of the
artwork. `/archive/day/:n/export.md` does one day. JSON is still there for machines
(`/archive/export.json`: `storesCounted` holds only what was filed, `crewFigures` and `power`
the figures as filed, `readings` every reading of the day by source, and a day ahead carries
`recorded: false` and nothing else).

**The archive belongs to mission control.** Everything under `/archive`, including the
download, requires the control session; the public station carries no link to it. A visitor
sees the exchange on the mission page and the crew's writing in the logbook. The complete
day-by-day record — crew states, habitat summaries, every reading — is yours.
`/archive` is the contents page, `/archive/day/:n` is one day whole, and
`/archive/export.json` hands over the entire mission as a single file.

## Mobile and desktop

Most of the audience will meet this on a phone, standing in a dark room. The mobile layer is
not an afterthought:

- type gets **larger** on small screens, not smaller
- every table scrolls sideways rather than clipping — there is a test asserting no table
  anywhere escapes its wrapper
- inputs are 16px so iOS does not zoom when a field is focused
- buttons and tag chips meet a 44px touch target and stack rather than crowd
- the status rail drops its optional cells instead of forcing a horizontal scroll
- the mission strip drops its day labels but keeps today's
- mission control gets fatter slider thumbs and taller controls at tablet width, for someone
  standing up in the dark
- there is a print stylesheet, because the archive is the artwork and somebody will
  eventually want it on paper

**Every public page opens with the same header**, which stays at the top of the window: a row
with the wordmark (the way home), the run's badge with its pulsing dot — the countdown before
the run, the sol during it —, **in the middle of the row the station's three ways on** — *Write
to the crew* (the composer, `/#write`), *Live Mission Dashboard* (`/#mission`) and *About*
(`/about`), the one for the page you are on filled —, the round theme key and the language (the
current one filled, the others under it) — no clock; under it the **running line** —
what the crew are doing, what is next, the habitat's latest reading, and *Communication window
daily 19:00 CET* (`ticker()` in `src/views/pages/public.js`). There is no menu: the reading
matter is one page, `/about`. Anything a link brings into view lands under the header
(`scroll-padding-top` on the root). It is a band of frosted glass, its keys round pills — the
three links outlined, the theme key, the language in cobalt — and the page scrolls under it.

**A phone held upright** (up to 760 px across, more than 520 px tall) gets its own chrome on
the public pages, drawn from the same markup — nothing is served twice (the phone blocks of
`public/aura.css` and `public/sheet.css`):

- the header's row keeps to one line — the three links are not drawn; the bar at the foot has
  the same ways — and `public/folder.js` places the dashboard's index under it.
- a **bar of five keys fixed at the foot** — Home, Dashboard, Write, Media, About — with
  Write raised as an orange disc with a paper plane (`tabbar()` in `src/views/layout.js`,
  `public/tabbar.js`). Each key is a page and the lit key, in blue, names the page you are on.
  **About** opens the About page — About, the habitat in section and Who we are, one after another.
- the station page is its three pages, **a swipe from one to the next** — the habitat alone on
  the first screen, with its sky and the nudge under the dome; the station's name and the note
  with its three pills (Write to the crew, Mission dashboard, Know more); the world's slowest chat, ending in the orange key **Write to the
  crew →** — and then the foot (see *The landing page: three pages in the glass dress*). The
  portal and the dashboard are pages of their own. The
  pages keep air between them and around their words: the cards are set in from the edge of the
  glass, the reading text is at the reading size and spacing, and nothing a visitor reads is
  drawn over anything else.
- the dashboard page leaves out the strip of live pictures at its head: they rise over the
  habitat and fill the Media page (the strip stays in the page, unshown, for the sky to follow).
- the **running line runs** whatever the phone does: on a phone the page moves it itself, a
  little every frame, rather than leaving it to the stylesheet's animation — which a phone's
  browser can hold still in more than one way (a tap leaves the line "hovered", the setting for
  less motion, a saver mode) — at a steady pace, gentler where less motion is asked for, and
  resting while the page is out of sight (`ticker()` in `src/views/pages/public.js`).
- **the type is set to be read**: the sizes are five variables at the head of
  `public/aura.css` — the smallest thing written (a ruler's numbers, a stamp), the small capitals
  that name things, a second line, the name of a thing in a list, reading text — a little larger
  on a phone; the charts' figures (the habitat's instruments, the trend graph, the hardware's
  charts, the booklet's day charts) are given back that size on the screen whatever the chart's
  scale, and on a phone the trend graph is drawn at its real width with the names of its lines
  in a legend beneath it (`public/habitat.js`).
- **the habitat** at a phone's width (on the About page, `/about#inside`) is drawn the width
  of the screen at its own shape — the head and the hint over it, the whole dome the width of
  the screen (the drawing's box as it is, `VIEW` in `inside.js`), the line *AI generated image*
  under it — its modules tapped without their names, the two outside keys standing in front of
  the habitat under its ground line, drawn larger — and a module's pop-up opening under the
  picture when there is no room over it; the page's small print never goes under the type floor
  below.
- the **dashboard is a page of its own, `/dashboard`** (`dashboardPage()` in
  `src/views/pages/public.js`, built from the same data as the station page): the bar's
  Dashboard key and the dome's pop-ups all lead there
  (`public/tabbar.js`), a link into a panel — `/dashboard#galley` — opening its folder.
  Its index is **two rows of tabs**: a segmented control of the three tracks (Sensors · Daily
  Life · Blogs) and, beneath it, that track's folders as underlined tabs; both stay under the
  top bar while the open folder scrolls beneath them. No key is more than two taps away.
- the composer's pop-up says the one-way signal small in its head, beside the callsign, so the
  Transmit key is never far below it.
- the portal — the composer and the board — is a **page of its own, the Write page, `/write`**
  (`writePage()` in `src/views/pages/public.js`; `/messages` redirects there): the mission
  page has no composer, and the door at the foot of the sheet, the note's door and the bar's Write
  key lead to the Write page with the pop-up open (`/write#write`, `public/tabbar.js`). On that page, on a phone, the wall of notes is
  the page: its bar — the board's name, the count, the chips in one sideways row — sticks under
  the top bar, the notes flow beneath one under the other, the older ones fetched as the page
  scrolls (`public/board.js`) — and the composer is a **pop-up over the foot of the screen**, above
  the bar of keys: `/write#write` (every Write door) opens the page with it out, the bar's
  Write key shows and hides it, a touch on the page beside it — or Escape — hides it. It is
  plainly a surface of its own: solid paper (no glass) with a rule of Mars along its top edge
  and a shadow upward, the list dimmed a little behind it while it is out (the dimming is
  drawn inside the shell, `.shell::before`, where the pop-up lives — every child of the body
  is a layer of its own, so drawn on the body it would lie over the pop-up as well, in the
  round shape of the body's glow). The page ends with the last message: it carries no foot
  here, so the list scrolls up to just above the pop-up and no further. It holds the title,
  the operator's callsign, a writing box the whole width of the pop-up — seven lines deep to
  begin with, growing with the text to nine; while the keyboard is up, as deep as fits between
  the top bar and the keyboard — beneath it the five tags in one line, every one whole: the
  type is sized to the row (container units, a hair under 10 px on a 390 px phone, 9 px on a
  360 px one, in every language), and only the narrowest phones slide the row sideways — every
  tag the visitor sees, in the composer, the board's filter, a card's small print and the
  archive, is written with a `#` in front, `#QUESTION` — and
  under them **Transmit** in the middle, an orange pill, dim until there is something to send.
  While a message is being written the
  list behind the pop-up is blurred away (the one blur a phone draws, and only then); during
  the crossing it clears again, so the message can be seen arriving at the head of the board.
  **While the phone's keyboard is up** the bar of keys steps
  aside and the pop-up sits on the keyboard's upper edge, so what is typed is in view: a
  phone's keyboard covers the lower part of the page without shrinking it, and only the
  visible part (`window.visualViewport`) says where its edge is — `tabbar.js` reads that, never
  the focus, so that a touch on Transmit while the keyboard is up finds the button where it
  was; the keyboard folded away, the keys return under the pop-up. A press on Transmit brings
  the board's head into view, where the message just sent appears at its head while the
  pop-up shows the crossing — **the dial large in the middle of the box**, as wide as the pop-up
  allows, the countdown big beneath it, the readings centred under that — at the size the pop-up
  had when Transmit was pressed (`tabbar.js` holds the stage at that height, the crossing centred
  in it), so nothing jumps. **Once the message has arrived** — ARRIVED held for a moment, the
  fresh form back in the box — **the pop-up lowers itself**, and what is on the screen is the
  board with the message just sent at its head, marked AWAITING REPLY
  (`tabbar.js` watches the form come back). Nothing rides on the pop-up's top edge: the ✕ at its
  top right, a touch beside it or Escape lowers it by hand. Without JavaScript the pop-up simply
  stands there.
- the page's side margin is 16 px rather than the desk's proportional gutter.
- **the paper dress** (the last phone block of `public/aura.css`): the same design drawn without
  what costs a phone the most. The surfaces are opaque paper instead of blurred glass — a backdrop
  blur is redrawn every frame, and eight of them shared one screen — the film grain is not
  blended over the screen, the habitat's keys carry a stroke instead of an SVG filter, every
  panel has one short shadow instead of three, the running line is clipped instead of masked,
  and the exchange cards and the foot far below the screen are neither laid out nor painted
  until they come near (`content-visibility`). What the page scrolls under — the top bar, the
  chips row, the bar of keys — is opaque paper, so nothing ghosts through it. Same layout,
  type, cobalt and Mars; a wider screen and a phone held sideways keep the glass.

## Visual language

**Glass floating on a plain ground** (`public/aura.css`, with the new layout drawn in the same
dress by `public/sheet.css`, loaded last on every public page): the page is **plain white by
day and plain black by night** — the drafting grid, the stars, the warm and cool lights behind
the sections and the film of grain the dress once had are switched off at the foot of
`sheet.css` (*the ground: plain*; the rules that drew them stay in `aura.css`, in case). What is
read or touched **floats** on it — the panels, the cards, the header, the pop-ups are frosted glass with rounded
corners and soft, deep shadows beneath; the keys are **round pills**, outlined in cobalt, the one
that is on filled; the actions are **orange** keys with a glow under them (*Write to the crew*,
*Transmit*). Cobalt is the ink by day; Mars orange marks codes, stamps and the run;
the habitat's colour is the one great glow of the page. The station is dark until a visitor
chooses light (*Light and dark*). Nothing a visitor reads is drawn under the type floor at the
head of `public/aura.css` — the handoff's smallest labels are set at that floor rather than at
its 7.5–10 px, the bar of keys' names and the language key with them.

The parts are working parts, not decoration:

- **The composer is a device.** An orange light (it pulses while a message crosses), a ribbed
  orange grip at the top edge, a soft knob and a row of vents; then the operator's callsign and
  *UPLINK*; then, over the writing box, the day's question from the habitat as a prompt (see
  *Today's Mission*). The one orange key transmits.
- **The board is a second slab.** A pale raised panel beside the composer, nearly its width, so
  the correspondence gets as much room as the writing: callsigns in orange, the crew's replies
  in orange with a `✧`, an orange scrollbar, the counts and the filter chips in the foot.
- **The crossing is a dial.** Pressing transmit lifts the device and swaps the form for a bezel
  with four screws round a dark gridded face: Earth at the foot, Mars at the head, the message
  travelling the arc between them while `T−mm:ss` counts down beside it.
- **The station's name** is spelled letter by letter down the left margin; the run's thirteen days
  run down the right, today marked. Both fall away below 1420px.
- **Readings** — link state, mission day, distance, one-way time, your callsign, the theme
  switch — are a row of small inset pills under the wordmark.
- **Channel tags** still stamp every panel with the data channel it renders, now as a small
  grey code in the corner.
- **The foot** (`foot()` in `src/views/layout.js`) carries the wordmark, three keys — *Privacy
  policy*, to zkm.de/en/privacy-policy, *ZKM*, to zkm.de, and the *Imprint* — and the house's
  name, nothing else; the pages are reached from the bar of keys and the header's links. It takes
  the theme's colours: **by night a card of deep night blue** lit in the dome's own colours —
  ultramarine rising at its left foot, a violet light at its right — the words in white, the keys
  outlined in white; **by day a pane of light glass**, white going over into a pale sky blue, a
  soft cobalt light at its left foot, the words in ink and the keys drawn in cobalt. Mars orange
  is kept for the wordmark's own mark and nowhere else on the card (the foot's block in
  `public/sheet.css`).
  On a phone held upright it is a low band the width of the page: the wordmark and the house
  at the left, the two keys one above the other at the right.
- **The one-way signal time is read where a message is written** — the Write page's head,
  the composer's crossing, the `/communicate` fallback — and nowhere else: the ticker, the
  foot, the About page and the mission-complete page leave it out (the About text still
  explains the compressed crossing in a sentence).
- **Empty states** are dashed wells rather than crossed boxes.
- **The dashboard is alive.** Signs that it is being updated as it stands, none of them a
  figure (`dashLive()` and `vizTiles()` in `src/views/pages/public.js`, the block *the
  dashboard, alive* at the foot of `public/aura.css`, `public/live.js`, `public/typed.js`): at
  the right of the dashboard's head the LIVE mark with its pulsing dot, alone — the line under
  the title names the mission, the run and its days, no time zone; a cursor blinking after the
  title; the sol and the crew figures rolling up from zero to their value once, when the page
  opens, as a readout settling — the values are the page's own, restored exactly; the sol of
  the day breathing on the strip. **Two instruments without a reading** stand among the
  habitat's tiles, each on a row of its own, never side by side, each named small in its corner
  and hidden from assistive technology: *Astronauts tracked* at the end of the sensors' third
  row, after the light (the air quality, the compounds and the light make room for it) — a
  radar: a sweep going round every four seconds over rings and a rim of ticks, and inside it
  **one dot an astronaut, three for the crew of three** (as many as the crew the head's figure
  counts; `vizTile`, `n`), each wandering about the disc on a slow spring towards a place of its
  own, two never on each other, each lit as the sweep passes over it and dimming until it comes
  round again (`public/live.js`); *Karlsruhe* in the stores' row, between the stores and the
  power — **the city as its fan**, the plan drawn from the Schloss as the mock-up draws it: a disc
  of rings (the kilometres whole, the half-kilometres dashed, nothing written on them and no N)
  and the thirty-two rays, north up, and on it, to scale, the station's three places — the
  Schloss at the centre, a small square; **Red Dust City** at the Marktplatz, 480 m south, a dot
  of Mars with a ring pulsing out of it; the **ground station** at the ZKM, 2 km to the
  south-west, a diamond of cobalt — the dashed link between the two with a signal going along it
  and back, and a sweep of Mars going round once in twenty-four seconds (`cityFan()` in
  `src/views/pages/public.js`, 31 units a kilometre; `aura.css` under *Karlsruhe as its fan*). On
  a phone each is the width of the panel, under the row it belongs to. The folder's open panel is framed with brackets at its four corners
  and has a pulsing dot before each panel's name; a ring pulses out of each crew face and out
  of the CO₂ dial; the task of the hour has a blinking dot before its time. No line sweeps over
  anything. The Today's Mission panel on the dashboard stands as written. **On the
  installation's mission screen** (`/screen/mission`) **the day's mission is typed** instead:
  the panel's words — the title, the central question, the three parts of the day, the question
  for the community hour — appear letter by letter, a third slower than a quick typist, with a
  short halt at a full stop and a cursor after the last letter; typed to the end they stay three
  minutes, then the panel is cleared and typed again (`public/typed.js`). Every word is on the
  page from the start and keeps its place (the ones not yet typed are simply unseen), so nothing
  moves while the typing goes on and a screen reader reads the whole text. All of it is
  decoration laid over the data: nothing in it is a reading, the figures and the panels are
  unchanged, nothing is sent anywhere, and where the visitor asks for less motion all of it
  stands still, the astronauts where they are and the mission's words shown whole.

Status is carried by **symbol** as well as colour — filled centre is nominal, single bar is caution, crossed
ring is out of range, empty ring is no signal — so it survives print and colourblindness.

Type is ZKM Serendipity throughout the station — the wordmark, headings, every code, label
and value, and the reading prose — self-hosted from `public/fonts/` (Regular and Semibold,
WOFF2 with TTF beside it), with system stacks behind it. **Mission control is set in Open
Sans** instead (Regular, Bold and their italics, in the same folder): `body.control`
redefines the three font stacks, so every face on that page follows and nothing else does.
Nothing is fetched from a CDN, so the station looks right with the venue's network
unplugged.

## Monitoring channels

Nine channels, defined in **`content/sensors.json`** so they can be added or retuned without a
redeploy:

| Channel | Metric | Unit | Expected band |
|---|---|---|---|
| CH-01 | Habitat temperature | °C | 18.5 – 24.5 |
| CH-02 | Relative humidity | % | 32 – 48 |
| CH-03 | Carbon dioxide | ppm | 400 – 1200 |
| CH-04 | Air pressure | hPa | 990 – 1025 |
| CH-05 | Air quality index | AQI | 0 – 50 |
| CH-06 | Volatile organic compounds | ppb | 0 – 400 |
| CH-07 | Particulates PM2.5 | µg/m³ | 0 – 15 |
| CH-08 | Radiation dose rate | µSv/h | 0 – 0.5 |
| CH-09 | Cumulative dose | µSv | 0 – 60 |

The radiation warning band sits just above ordinary Earth background (roughly 0.1–0.3 µSv/h),
so any real change is visible rather than lost in the noise. Cumulative dose only rises — the
shape matters more than the value.

Channels are **upserted, never deleted** by a file load: a device that posts an unknown metric
registers itself and appears immediately, and wiping that on the next load would lose a working
sensor because nobody had written it down yet. Add it to `sensors.json` afterwards to give it a
label and limits.

## The whole mission, publicly

The **whole mission** fold of the daily-mission panel shows every day of the run — past days
marked complete, today open, days ahead shown as planned and dimmed — with each day's tasks,
meals and published mission notes. It answers "what is this run", which is a different question
from "what is happening now" and the one a visitor arriving cold actually has.

## The prefilled health form

There are no template buttons anywhere in mission control: every composer opens as a blank
column, or — for the daily health activities only — prefilled with the shape of the day: the
morning workout, the evening wellbeing activity, other reporting. That text is the entry named
**`Default`** under `HEALTH` in **`content/templates.json`**; rewrite it there and the form
starts differently from the next request on. Any other entries in that file are ignored, so it
can be trimmed down to that one.

## Inventory on the landing page

The habitat's resources are drawn as a row of gauges under the exchange feed: a fill bar of
what is left against what was carried in, the figure in its own unit, the percentage remaining,
and — the number that actually decides things inside a closed volume — **days remaining at the
current draw**. Anything under its warning threshold turns orange. A store with no figure at all
yet — nothing carried in written into `crew-and-inventory.json` and no count filed on the
Habitat tab — stands dimmed, a dash in its empty ring and no figure under its name; the dome's
pop-up says *no figure filed yet* (`inventoryGauges()` in `src/views/pages/public.js`). On the
dashboard's Sensors tab the Resources tile is only as wide as its rings — one a store, four stores
four rings — Karlsruhe's fan beside it at its own width and the Power tile taking the rest of the row
(the second row is laid out by its contents on a desk, `aura.css`).

Everything in the habitat was carried in and nothing is resupplied, so over thirteen days the row
visibly empties. That is the point of putting it on the front page rather than on a subpage.

## The crossing

Transmitting is the centre of the page, so it is given the room to be an event. Pressing send
replaces the composer with the crossing: Earth at one end, Mars at the other, a dashed gap
drifting between them, and a packet that actually travels it with a filled trail behind showing
the distance already covered. Mars pulses while it waits; the packet pulses while it moves; on
arrival it lands with a flare and the state stamp turns from orange to black. The orbital plot
beside it runs the same journey at the same time, so the schematic and the animation are one
event rather than two.

The countdown is large enough to read across a room. All of it stops under
`prefers-reduced-motion`, and the arrival still resolves — the animation is decoration on top
of a server-side clock, never the thing keeping time.

## Beamed into space: the relay to SpaceSpeak

Every message the crew answer is also handed to **SpaceSpeak** (spacespeak.com), a service
that encodes a message and beams it out of the atmosphere by radio — so what is written to the
crew on the Marktplatz is really on its way. **Only replied messages go:** a message is handed
over the moment mission control publishes its reply, never before; nothing a visitor sends is
beamed by itself, and what is rejected or deleted is never sent. (The composer still says,
under its key, *Every message is also beamed into space by radio.*) Two things follow from it
on the site.

**The card's line into space.** Every card — on the board of the Write page, the
installation's board screen, a single exchange — carries, under the message: *This message is
currently 7.78 billion km from Earth!* and *Launched 7 hours ago*. The count starts the moment
the message was sent (the card's `data-launched` is `submitted_at`): the distance a radio signal
covers, 299,792 km every second, and `public/board.js` moves it on once a second, so the numbers
race — every digit while it is small (the first half-minute), then in words as it grows —
million, billion, trillion, quadrillion (`fmtBig()` in `src/views/pages/public.js`, the same in
`board.js`; in German Millionen, Milliarden, Billionen, in French millions, milliards, billions —
the English billion is the German Milliarde). Kilometres only, no miles. In German: *Diese
Nachricht ist jetzt 7,78 Milliarden km von der Erde entfernt!*, in French likewise. (The real
broadcast follows once the crew answer — the relay below — but the visitor's count runs from
the send.)

**What it is closest to.** A tap on a card (*Follow its journey ›* at the card's foot says
so, and **under the pointer the note lifts** — an orange edge, a glow, the key brightening, and a
band sliding up over its foot, *Click to see how far it has travelled ›* — so nobody wonders
whether a note is for clicking; `board.js`, `aura.css`) opens two lines: *Your message is 6.1 times farther away than Saturn.* and under
it *Saturn is on average about 1.43 billion km from Earth — the ringed planet; its rings are
mostly water ice…* Nothing on the panel is a link — no Wikipedia key, nothing to tap but ✕. The
object is the last one the message has passed on its way out, from a list of **596 things in
the sky** in `content/celestial.json`. A hundred and twenty of them lie within the first five
light-minutes, so a message just sent passes something new every few seconds: the meteors
burning up overhead, the Kármán line, Gagarin's orbit, the space stations, Hubble and the
satellite constellations, the asteroids that have flown inside the Moon's orbit and the ones to
come (Apophis in 2029), the Van Allen belts, the geostationary ring, the Moon and its landing
sites, Apollo 13's and Artemis I's far points, the Lagrange points and the James Webb telescope,
the comets that came closest, the planets at their nearest. From there the list reaches through
the two light-weeks a message travels during the run — the planets and their moons and the
probes at them, the asteroids and comets, the dwarf planets of the Kuiper belt, Pioneer,
Voyager and New Horizons at their 2026 distances, the two interstellar comets 2I/Borisov and
3I/ATLAS on their way out, the Pale Blue Dot, the Kuiper cliff, the heliopause, the light-hour and
light-day marks (the two-light-week mark is 362.6 billion km), the far worlds Sedna, Farfarout and
the Goblin, the far ends of the long orbits — Eris, comet Ikeya–Seki, 2012 VP113, comet NEOWISE,
Sedna, 2013 SY99, 2017 OF201, the Goblin — the hypothetical Planet Nine, the Sun's gravitational
lens focus, the inner Oort cloud — and on past the stars, the nebulae,
clusters and galaxies to the oldest light there is, with thirty constellations (a constellation
counts as its brightest star). Each row has its distance from Earth in kilometres (`ly` in
light-years, `au` in astronomical units), its name and one line about it in English, German and
French, and `how`, which says what kind of distance it is and picks the second line's sentence:
`avg` *is on average about … km from Earth* (planets, moons, asteroids; a moon carries its
planet's distance a hair short, so the planet is named first), `orbit` *orbits about … km above
Earth* (a satellite still up), `flew` *flew about … km above Earth* (Vostok 1, Skylab, the
Shuttle), `reached` *reached … km from Earth* (Apollo 13, Artemis I), `flyby` *passed about …
km from Earth* (an asteroid or comet that came by), `will` *will pass about … km from Earth*,
`closest` / `farthest` and `mark` *is … km from Earth* (*Venus at its nearest*, *the one-light-hour
mark*), `now` *is now about … km from Earth* (the probes, Halley's Comet, Sedna), `height` *is
about … km above the ground* (a shooting star, the aurora), and the stars' *is … light-years
from Earth*. The sentences are in `src/lib/i18n.js` in the three languages; names are singular
and carry their article (*a GPS satellite*, *der Mond*, *la comète de Halley*), and French
elides *que* to *qu'* before a vowel. `/api/celestial` hands the list over nearest first in the
page's language (`?lang=de|en|fr`), `src/lib/celestial.js` reads the file fresh whenever it
changes — add a row, and the object is in. Within 15 % of an object the line reads *Your
message is just about as far as Voyager 1.*; past the first minute a message is beyond the
Moon, past eight it is as far as the Sun, past a day it is at Voyager 1, and after eleven days
at the inner Oort cloud — the stars come years later. The open panel follows the clock; Escape,
the ✕ or a tap outside closes it. On a phone it floats in the middle of the screen, a card with
room around it, not a sheet at the foot. Nothing on the installation's board screen is tappable:
`board.js` opens no panel there, the card shows no *Follow its journey*, and its two lines —
the distance and the launch time — stand on one.

**The relay.** SpaceSpeak has no API at the price of a text message (their API licence is a
separate, paid product), so the station uses the site the way a person does
(`src/lib/spacespeak.js`): it opens spacespeak.com in a headless browser of its own
(Playwright's Chromium — the Docker image carries it), signs in with the station's account,
opens the Send page, types the message into the box and presses the key. The sign-in is kept
in a browser profile under `/data/spacespeak/`, so most sends need no signing in. A message is
queued when its reply is published (`enqueue()` from `src/routes/control.js`); the relay runs
behind, one message at a time with a pause between sends (`SPACESPEAK_GAP_SECONDS`, 20), and
when the site does not answer it tries again later — after a minute, then four, sixteen, an
hour, four hours — up to `SPACESPEAK_ATTEMPTS` (6). A message unpublished or rejected before its
turn is skipped (and queued again if its reply is published again); a deleted one is gone with
its row. The visitor's text goes as written (`SPACESPEAK_SIGNATURE` adds a line under it, e.g.
*— sent from MARS!platz, Karlsruhe*); a form that asks for a title gets *MARS!platz · CALLSIGN*.

**Setting it up.** Put the account in `.env` and restart:

```
SPACESPEAK_USER=…
SPACESPEAK_PASSWORD=…
```

Without the account the relay is off (and `SPACESPEAK_ENABLED=false` holds it off with the
account set). Mission control carries no block about the relay over its queue either way — only
the mark on each answered message (*Beamed · No. …*, *Queued for space*, *Not beamed*) says how
it stands with SpaceSpeak. Then try it before the run opens:

```
docker compose exec station node tools/spacespeak-probe.js          # a dry run: signs in, opens the Send page, types a test line, presses nothing
docker compose exec station node tools/spacespeak-probe.js --send   # really sends the test line and prints its number on SpaceSpeak
```

The probe prints each step as it goes (*opened the send page · signed in · found the message
box · typed the message*) and, when one fails, the site's own words, with a screenshot and the
page's HTML kept under `/data/spacespeak/` to read. `SPACESPEAK_DRY_RUN=true` in `.env` makes the
running station do the same for every message — every step but the last — during a rehearsal.
Outside Docker, `npx playwright install chromium` once (or point `SPACESPEAK_BROWSER_PATH` at a
Chromium of your own).

**Mission control** (the Messages tab) shows the relay over the queue — on or off, where it
sends, how many sent, queued, failed, the last trouble — and a replied message's own state in
its top line: *Beamed · No. 142920* (a link to it on SpaceSpeak), *Queued for space · try 1
failed*, *Not beamed · why*, *Not beamed · no longer published when its turn came*; a message
still awaiting its reply carries no mark. There is no key to send by hand. Every message's line
also says when it was sent, in full, on the venue's clock — *sent 28 Sept 2026, 16:28:54 CET*
(the UTC stamp is in its tooltip). The rows are the `space_relay` table.

**Two things to know.** SpaceSpeak's own terms are written for a person at a keyboard; a
station sending a public installation's messages through their form, under one account, is
the use they sell their API licence for, and they may throttle or close an account that does
it another way — the relay's spacing and its "failed, and why" on the control page are there
for that. And the replied messages leave the station: see *Data and privacy*. The stand-in site in
`tools/spacespeak-mock.js` (`SPACESPEAK_URL=http://localhost:8090`) is what the test suite sends
to, and a way to watch the relay work without an account.

## Crew states

One scale: **Mood, thrilled ↔ angry**, filed in mission control as a row of five faces —
**thrilled, happy, neutral, upset, angry** (October's five words; the scale read calm, settled,
level, tense, angry until then) — like a waiting-room rating card, each face drawn for its word
(thrilled beams with its eyes closed and an open grin, angry frowns under lowered brows).
Picking a face shows the exact sentence the public will get — *thrilled — on top of the world*,
*happy, in good spirits*, *neutral — neither up nor down*, *upset, not having a good day*,
*angry, needing distance*, in German and French too (`src/lib/mood.js`, `src/lib/i18n.js`,
mirrored in `public/control.js`); the number itself (0–100 behind the faces) is never published.
The database columns are unchanged (`calm_tense` carries the value, 0 thrilled to 100 angry), so
states filed under the older schemes still read correctly.

**Every filing is recorded.** A state is never overwritten: each **Publish** adds a row to
`crew_mood` — the officer, the moment (`effective_at`), the value and who filed it — and the
public sees the newest. Under each officer's **Crew state** block mission control shows the
**Record**: every state filed for that officer, the newest first, with the day and time it was
filed (the venue's clock), the sol, the mood and its sentence, and the desk that filed it (the
twelve latest on the page; the count says how many there are). The whole record goes out as
**CSV from the Archive** (October: there, not under the officer's state) — **The crew's moods**
under *Take a copy*, `/archive/moods.csv`, behind the sign-in like the rest of the record;
`/control/moods.csv` leads there — every officer, oldest first: `officer, date, time, sol, mood,
value, reads, filed_by, filed_at_utc` (`moodsCsv` in `src/lib/record-pdf.js`). The mid-scale
state the content loader gives a new officer (filed by `content`, so the public crew card has
something to show) was filed by nobody and is not part of the record. The same rows are in
the archive's day pages and the PDF record.

## Monitoring

Six channels ship configured in `content/sensors.json`:

| Channel | Metric | Expected band | Limits |
|---|---|---|---|
| CH-01 | Habitat temperature | 18.5–24.5 °C | 14–30 |
| CH-02 | Relative humidity | 32–48 % | 20–70 |
| CH-03 | Carbon dioxide | 400–1200 ppm | 0–2500 |
| CH-04 | Air quality index | 0–150 VOC | 0–400 |
| CH-05 | Radiation dose rate | 0.05–0.45 µSv/h | 0–2.0 |
| CH-06 | Air pressure | 990–1025 hPa | 960–1050 |

Air quality is total volatile organic compounds as an index — it rises with cooking, with
people, and with anything outgassing in a sealed volume. Radiation is ambient dose rate, with
Earth background near 0.10; the habitat's shielding is part of what the mission is testing, so
that channel is watched rather than controlled.

Adding or retuning a channel is an edit to `sensors.json` — no redeploy. A device can still
post any metric at all and it will be accepted and displayed; listing it here is what gives it
a label, a unit, a channel code and thresholds. The channel codes (`CH-01` …) are identifiers
in the data — the CSV and JSON exports and the PDF record carry them — and are no longer
written anywhere on the pages.

## The mission page

The landing page opens on the **MARS!platz** wordmark on the grey ground, one line beneath it,
and the station's readings as a row of pills on the right; there is no photograph and no black
rail. (`public/hero.jpg` is no longer referenced and can be deleted.) About · What's inside the
habitat · Who we are are a page of their own, `/about`, which the header's *About* link leads to. The landing page
carries no top bar; its navigation lives in the dark footer slab. Subpages keep the status rail
and **Mission · Messages · Crew log · About**.

Across the very top runs **the ticker**: the header's row, then a continuously running line — the SOL, **what the crew are currently doing**
(the schedule task whose time it is, with its detail — "14:00 · Maintenance — West panel seal,
third attempt" — switching to the next as its time comes), what is next, the node's current
reading (or *no current reading*). Every five minutes it fetches
the day's schedule again from `/api/ticker`, so an edit made in mission control — or midnight
turning to a new day — reaches every open phone without a reload. It scrolls like a wire
ticker and holds while a mouse rests on it; under reduced motion it stands still on a desk and
drifts more slowly on a phone, and a tap on a phone never holds it.

**The ticker is always now.** Before 15 October it counts down, to the second, to 00:00 at
the venue on the first day. The moment that instant passes — and likewise when **Reset to 15
October** is pressed, or the station's dates change under an open page — the page reloads
itself once and comes back as the run: SOL 01, the day's schedule, the crew's current task. A
phone left open across midnight on 15 October turns into the run by itself; nobody has to
refresh anything. (The page never trusts its own clock for this: at zero it asks the
station, so a phone running fast cannot reload in a loop.)

**The header's three keys** — **Write to the crew**, **Live Mission Dashboard**, **About** — are
plain buttons in the middle of the header's row, each with its sign in the line-icon hand of the
dome's keys (the pen, the four panels, the i) and its name in sentence case, 48px tall in 16px
type, **each in a colour of its own, in both themes — Write to the crew in Mars, the dashboard in
cobalt, About in ink — and the page's own key ringed inside its edge** (October: "bigger, more
prominent, colour-coded to catch the eye"; before that "selected blue, not selected black"); the
row is 76px tall, the name 26px and the sol badge a solid Mars pill (`ticker()` in
`src/views/pages/public.js`, `sheet.css` under *the header: two rows* — the offsets that hang
from the header's height, 113px with the running line, follow it: the pages' heights, the
scroll padding, the board's bar and the dashboard's rail). They lead to the Write page with the composer's window
open (`/write#write`), the Dashboard page (`/dashboard`) and the About page; the door at the foot
of the slowest chat and the *Send a message to the crew* card open the window here (`#write`; a
phone's lead to the Write page's dock), the sky's notes lead to the wall, the *Follow what the
crew is doing — live* card and the habitat's modules to the Dashboard page. **The three pages end with
the chat**: the composer is the window every page carries (see *The composer's window*), with
its floating key at the foot of the window.

**The Write page** (`/write`, `writePage` in `public.js`; `body.landing.inner.messages.write`) is
**the board as a wall of notes** (see *The board*), under the header alone — the inner pages'
masthead (the wordmark, *ZKM | Hertzlab*) is left off it and off the Dashboard page
(`masthead: false` in `layout.page`) — never the dashboard, and the composer's window every page
carries.

**The composer's window** (`writeKit()` in `src/views/layout.js`, which every public page gets
after its body; `portal()` in `public.js`; `public/write.js`; the styles under *the composer's
pop-up* in `aura.css`): **a Write to the crew key floats at the foot of the window at the right
on every public page** — the station's primary key in Mars, with the pen — and opens **the
composer in a window in the middle of the screen, the page blurred and dimmed behind it** (640px
wide, on the notes' surface with a rule of Mars along its top): an eyebrow *Uplink · one-way
signal 14 min · 1.634 au*, the title *Write to the crew* with its cross, **your callsign**, the
crew's question for the day, the writing box — **1000 characters** (`MESSAGE_MAX_CHARS`; the
counter says `0 / 1000`) — the five tags (choose up to 3) and **Transmit** across the whole width;
the device's light, grip, knob and vents are not drawn in it. Every `#write` door opens it (the
note's, the slowest chat's; on the Write page the header's Write key too), `/write#write` opens
the Write page with it open; its cross, Escape or a click on the blur fold it away (what was
written stays), and the floating key is gone while it is open. A message sent from it crosses in
it — the dial, the read-out — **with a Message Board key under them** (`transit-board` in
`communicate.js`): on the Write page it folds the window away and brings the wall into view,
where the note just sent stands at the head; elsewhere it leads to the Write page. **Once the
message has arrived the visitor is taken to the board without a press** (October: "as soon as
the message is transmitted fully, close the pop-up and go to the message board — do not show
the write box again"): the dial holds a moment on ARRIVED (`composer.js` says so to the page,
`mcs:arrived`, with the length of the hold), and a breath before the empty composer would come
back, on the Write page the window closes by itself and the wall comes into view, on any other
page the Write page opens on the wall, and a phone's dock lowers itself — the box is never seen
again (`public/write.js`, `public/tabbar.js`). The window's
head names no operator and no callsign (October: "remove the operator name"); it says the one-way
signal and the distance alone — the callsign a visitor writes under is on the cookie card and on
their notes on the board (the writing screen's composer keeps *OPERATOR · BODENSTATION*). A page opened while a
message is still crossing keeps the window closed (the note stands on the wall, in transit) —
**and the floating key is the crossing itself meanwhile, on whatever page the visitor goes to**:
a ring filling as the message goes, the countdown (*T−00:06*) and the state (*Sending · 51%*,
then *ARRIVED · Delivered · awaiting review*), read off the window's transit display and kept
going by `write.js` from the moment it was sent; a press on it opens the window with the dial.
Once the message has arrived and the fresh composer has come, the key is the Write key again.
What is crossing for the visitor is read by the kit itself; the Write page hands it its own
(a refused post's word and draft with it). A phone has none of this: the composer is the Write
page's dock at the foot of the screen (below, *Mobile and desktop*), its bar's Write key the way
to it, and its doors on the other pages lead there (`tabbar.js`).

**The Dashboard page** (`/dashboard`, `dashboardPage` in `public.js`; `body.landing.inner.dashboard`)
is the mission dashboard alone. **Only its content scrolls** on a desk: the row of the two doors
and the strip of sols stays under the header while the page scrolls — a band the width of the
window — the rail sits under it, and **the open folder's head** (*Sensors · LIVE*, *Today's
Schedule · SOL 005 · 0/17 done*, a blog's band) **stays at the top of the folder's content** as
the content scrolls past it (`aura.css` under *the dashboard page*; a phone keeps its own stops).
Under its heading, small, the headline figures — the sol
(the countdown before the run) and the crew; then the strip of live images from the habitat — the
LIVE badge and the six newest pictures, nothing else; then one row of the two doors (At a Glance
and Media, two small pills side by side) with the run as a strip of thirteen sols beside them;
then the
dashboard's panels behind **one index, a rail of keys at the left of one glass panel** — the
heading *Mission dashboard* over it, then the keys one under the other (vertical tabs), in three
named tracks, the open folder's panel beside the rail across the whole width that is left —
*Sensors*: **one** key, the **Sensors**
panel (the sensor tiles, the crew's figures, the resource rings and the power bars — the type
inside it set larger than the other panels', what each tile measures at 20px and the figures at
36px; the tiles' lines under their figures are short — the temperature's figure stands alone,
the air quality's says *IAQ index* and no more — then the habitat hardware's day charts, without
a heading of their own, then the **Trends** under a head of their own and nothing under it, drawn
smaller than they were as a tab; `/#trends` lands on them there); *Daily Life*: **Today's
Mission** first (the day's scientific mission, below), then **Today's Schedule**, **Today's Meal**
and **Crew Moods**; *Blogs*:
the three blogs. Every key carries a line icon in the hand of the dome's
keys and its name; a long name wraps to a second line rather than being cut. The page opens on
the Sensors. A press on a key opens that folder beside the rail (the key turns cobalt, and the
name of its track with it), the arrow keys walk the keys (up and down as well as left and
right), and a link into a panel — `/#habitat`, `/#crew`, `/#galley`, `/#schedule`, the dome's
keys, the foot — opens its folder and brings the index into view (`folder()` in
`src/views/pages/public.js`, `public/folder.js`, the styles under *the index of folders* in
`public/aura.css`). **The rail stays in view under the header** while a long folder — the
sensors, a blog — scrolls past it (the rail is sticky; the folder clips its rounded corners with
`overflow: clip`, which, unlike `hidden`, lets a sticky child stick). The rail is 236px wide, 208px
on a desk under 1100px, where the schedule goes back to one column. **The open folder is as tall as its panel, whatever that
is, and never shorter than a page** — the Habitat's instruments, the day's whole schedule (in two columns on a screen over
1100px, so the whole day is in view at once), a blog at its own length: nothing in the folder scrolls
inside itself, the page scrolls as one, on a desk and on a phone alike (it used to stop at the
window's height and scroll inside, which on a laptop showed half a panel); on a desk the box is at
the least the window's height less the header (`min-height: calc(100vh - 150px)`), so a short folder
— Crew Moods, a day without a blog — never leaves the rail standing over a stub. A phone held upright
keeps the index as two rows of tabs over the folder (see *Mobile and desktop*) — a rail beside
the folder would leave a phone's width to neither; a window under 521px tall keeps the three
tracks as rows over the folder.

**Today's Mission** is the first folder of the *Daily Life* track (its key carries a flag;
`/dashboard#mission-today` and the habitat's science station open it), set a size larger than the other panels:
the day's scientific mission from `content/missions.json` — *MISSION No. 05 · Waterways* (two-figure numbers, 00 to 12), its central question as the
lead, then the three parts of the day side by side (one under the other on a phone) — **Morning**,
**Afternoon**, **EVA**, each under its name with a dot in its colour (cobalt, violet, Mars) — as
the sheet gives them: a line in capitals is a heading, bullets and numbered lines are lists, a
→ line a pointer; at the foot the **question for the community hour** on a tinted band, in
English and in German as the sheet has it, and beside it the key **Mission Report →**, in the
doors' dress, which opens the Daily Mission Report folder (on a phone, on the dashboard page;
the mission screen does not draw it). **The same question stands over the composer's
writing box as a prompt** — *The crew's question today*, the question in the visitor's language
where the sheet has it (German in the German interface, English otherwise), and *Answer it
below — or ask the crew something of your own* — in the Write page's pop-up, hidden while a
message crosses (`composerPrompt()` in `public.js`). The sheets are the
**thirteen one-page PDFs in the `missions/` folder** beside `content/`, `MARS_Mission_NN_Title.pdf`,
**numbered 00 to 12 as the production counts them — 00 is the first day's, 15 October, and they
follow the days in sequence to 12 on 27 October** — served at `/missions/<file>` (not linked from
the panel) — PDFs only, no listing; under Docker the folder is mounted like `content/`
(`docker-compose.yml`) and copied into the image (`Dockerfile`), so the venue's baked image carries
it. **`content/missions.json` is written from the sheets by `tools/missions-json.py`**
(`python3 tools/missions-json.py`; needs `pdfplumber`): the tool reads every sheet in the folder by
position — the number and title from the file name, the central question, the three columns line
by line (a heading alone, a bullet or a → pointer with its wrapped words joined back, a sentence
that ends on a line as a line of its own, a word broken at a line's end made whole), the question
for the community hour parted into English and German, the material — and writes each sheet's
words (`missions`) and the day → mission map (`days`, the sequence). Where a sheet prints another
number than its file carries (the sheets were exported under an older numbering — *Waterways*
prints 6, its file is 05) the printed one is kept as `sheetNo`, so the mismatch is plain until the
sheet is re-exported; a sheet that is byte for byte another's PDF (as 00 *Setup Habitat After
Touchdown* and 12 *Habitat Teardown* are, copies of 01 *Energy Budget* until they are written)
keeps its title from the file name, carries no words, and names the file it copies as
`placeholder` — the panel then shows the title and *The sheet for this mission is still to come*.
Run the tool again whenever a sheet changes or is added. **The Science officer sets a day's
mission on the desk**: the Science tab opens with the **Science mission** block for the day open
on the desk (the day picker chooses the day) — the day and its date on one line, **one dropdown**
of the thirteen sheets (*Mission No. 05 · Waterways*; a sheet to come marked so; *— none —* for a
day without one), the plan's mission selected, and a Save key, no words over it (`/control/mission`;
`missionBlock` in `src/views/control/index.js`). Save writes that day's entry of `days` in
`missions.json` (none takes it out), which stands wherever the day's mission is shown — the
dashboard, the composer's prompt, the mission screen, the archive, the dome's science station
(`content.missionForDay`, `content.missionPlan`);
the older `chosen` entry beside the plan is gone — the plan itself is what the officer edits. The
change is noted in the audit log and in the station's edit notices like the schedule's. The words
are shown as written, like the schedule's; the labels are in the visitor's language. Before the
run the panel shows day 1's mission, after it the last day's (`missionPanel` in
`src/views/pages/public.js`, `content.missionForDay`).

During pre-launch the readings show the countdown in place of the mission day and the day rail
and strip carry no marker.

## The board

**What it holds.** The viewer's own messages, every one whatever its state — in transit,
awaiting reply, answered, rejected — and the exchanges the crew have answered, **in one sequence,
the newest first, by the moment each was sent** (`boardCards()`): no group of the viewer's own at
the top and no headings — their own stand among the rest in their place, their fold in Mars.
Nothing unanswered by anyone else is ever shown: a visitor sees only their own waiting messages,
so on a station where the crew have not yet replied to anything the board shows just those. The
installation's board screen holds as many exchanges as fit (`BOARD_RECENT` for the sky and the
screens' first poll), the ground station's own among them whatever their state.

**The wall of notes** (the Write page; `boardWall()` and `noteCard()` in `src/views/pages/public.js`,
the styles under *the wall of notes* in `public/aura.css`, `public/board.js`) is the whole
correspondence, after the reference handed over: the exchanges as flat notes on the page's ground —
three across on a wide screen, two under 1100px, one on a phone, every row starting level, each
note as tall as what it holds — **never in a box**. The page draws the newest twenty
(`BOARD_PAGE`, `data.board()` in `src/lib/data.js`) and the viewer's own; **as the reader nears
the end of the wall the twenty before them are fetched and laid on** (`/api/board?before=<id>&at=<sent>`
— the page of published exchanges sent before the oldest on the wall; an `IntersectionObserver`
on the marker at the foot, which says *Loading older exchanges…* with a turning ring, then *The
beginning of the correspondence*), and so on until there is nothing older. The live refresh
(every few seconds, `/api/board?limit=20&wall=1`) lays the fresh set in **by id**: a new exchange
goes in above the first note older than it, a changed one (a reply published) is replaced where it
stands, a note the fresh set has left behind stays as the wall's older part, and the note at the
top of the window stays where it was. Over the wall **a bar stays under the header** all the way
down: *Message Board* with its LIVE mark and the count (*67 exchanges · 72 sent*), the chips that
narrow the wall — **ALL**, **MY MESSAGES** (with the count of your own still waiting), one per tag
— and at the right the orange **Write to the crew** key, which brings the composer back into view
and the hand into its box. A chosen tag puts every other note aside (`display: none !important`
on a hidden note, so the dark theme's own rule for the note cannot keep it standing — until
October it did, and the chips seemed to do nothing) and the wall fetches the older pages until the
tag's notes are on it, or says *No messages match this filter* when the correspondence has none. On a phone the bar sticks under the top bar with the chips in one
sideways row; the Write key is the bar's.

**A note** — warm paper (`#fbf6ee`, the sand at the end of the brand's gradient thinned to a sheet) on the
cool drafting paper by day, a warm graphite (`#2f2b29`) a good step lighter than the night's near-black ground,
so every message box stands apart from the page (October asked for the difference), the crew's answer a white
card on it (`#1a1716` by night). In the top-right corner, where a folded corner was, **the message's round trip**
(October asked for something visual that shows whether a message has been answered or not — and not a tick): a
small orbit between Earth, a cobalt disc at the lower left, and Mars at the upper right. Answered — the loop is
closed in Mars orange and Mars is lit: the signal went out and came back (titled *Answered by the crew*, in German
and French too). Not yet — only the way out is drawn, dashed, with the message as a dot flying along it, over and
over, six seconds a crossing, the way back a ghost and Mars a hollow ring; once the message has arrived the dot
rests inside Mars, which pulses until the crew answer (titled with the state's own words, `IN TRANSIT`, `AWAITING
REPLY`). The waiting mark turns Mars under the pointer; where the reader asks for reduced motion the dot stands
halfway and nothing pulses (`noteCard`; `aura.css`, `.note-mark` — the dot flies on CSS `offset-path`, and is
left out where a browser has none). Your own notes carry a Mars edge at the left instead of the fold. Then a head
with a disc carrying the writer's initials in a colour of the callsign's own
(a hue from its letters, so one writer's notes share it), the callsign (no *Earth* or *Earth · you*
beside it — October asked for the label to go; your own notes are known by their Mars edge), a `NEW`
pill while the answer is under six hours old, and the `Ref` number; the message as the note's title; **CREW ANSWER**
and the crew's reply, or the message's state (`IN TRANSIT` while it crosses, then `AWAITING
REPLY`) where the answer will stand; a foot with the distance the message has travelled — the
orbit sign, *7.06 billion km · 7 hours ago ›*, ticking (`spaceLine` compact; a tap on the note
opens its journey, as before) — and the day and time it was sent; and a band *In #Question ·
#Humour*, each tag in its own colour and a key that narrows the wall to that tag (and brings the
chips into view), *No tag* where none was chosen. On the boards the answer carries no line of who
answered, the habitat and when (the archive's cards keep that line).

The screens' and the archive's cards are the older card (`messageCard()` without `wall`): the
visitor's message in a shaded box, the line of small print over it, the tags under the text, the
reply beneath — the same card serves the last exchanges on the closing page.

There is exactly one composer on the public station — on the mission page alone, and on the Write
page over the board (the same device; the mission page's goes on to the Write page once a message
has crossed). A second composer beside the exchange was one box too many: it invited a reply to a
message you had just read, which is not what this channel is — every message goes to the habitat,
not to another visitor.

## The exchange grid

Published messages render as a sheet of cards — `auto-fill, minmax(280px, 1fr)`, so the column
count follows the viewport rather than a breakpoint guess: four across on a desk, two on a
tablet, one on a phone.

Each card is a label. The callsign is stamped in orange like a lot number, the message is the
content, the reply sits beneath it on an orange wash, and the foot carries the reference data:
the real light-time it crossed, the distance in au, and a `Ref 00042` permalink. (The public
board and the closing page dress the same data as quoted posts instead — see *The board*.) The
same card is used in the archive and in the crew logbook, so one component defines
what an exchange looks like everywhere.

## The logo

Drop a file called `logo.svg`, `logo.png`, `logo.webp` or `logo.jpg` into **`public/`** and it
appears at the top right of the mission page, capped by height so a wide mark and a square one
both sit correctly. Nothing is hard-coded; swapping the file swaps the mark. A placeholder is
in there now — replace it with the real one.

## Three languages

The public station reads in **German, English and French**, switched by the small
**DE · EN · FR** control beside the theme switch — in the masthead on the landing page,
the crew log and the media page, and in the rail on At a Glance. The choice is kept in a
cookie (`mcs_lang`, a year once the cookie question is accepted, otherwise for the visit — like
the theme), resolved on the server, and applied to the
whole page before it is sent: `<html lang="…">`, every label, every sentence of the
reading matter. Nothing is fetched and no third-party script is involved — the
translation is the station's own, so it works with the network unplugged like everything
else here.

**Neither switch moves the visitor.** The theme turns on the page itself — `data-theme` on
`<html>`, the switch's own words with it — and the cookie is posted in the background
(`public/switches.js`; `/theme` answers a fetch with 204), so the page never reloads and never
moves: the dashboard's open folder, the About page's section, the scroll all stay where they
are. The language has to reload (the words are the server's), so its form carries the whole
address the visitor was at, the `#part` included, which a browser's Referer never has, and the
station sends them back to exactly that (`/lang`, `wayBack()` in `src/server.js`); without the
script the Referer is the way back, and the landing page only the last resort. A press takes no
focus either, since a button in the sticky header that gains focus makes some browsers scroll
to where the header would stand unstuck.

**Every word is controlled in one file: `src/lib/i18n.js`.** English is the source: the
views are written in English, and the dictionary `D` in that file carries the German and
French for each string, keyed by the exact English —

```js
'Message Board': ['Nachrichtenboard', 'Tableau des messages'],
```

To change a translation, edit its row. To add one, find the English string as it appears
in the view (punctuation, case and typographic apostrophes included — the lookup is
verbatim) and add a row in the matching section. A string with no row simply stays
English; a missing entry can never blank a page. Strings that are built from parts — a
count and a noun, a number and a unit — are listed as their parts (`day` / `days`,
`of`, `opens in`). The page scripts (the board's counters, the composer's transit
words, the habitat tiles, the ticker) read the same dictionary through a small table the
page carries in its head, `window.MCS_T`, and a one-line `t()`.

What is translated is the station's own interface: the chrome, the ticker, the composer,
the board's stamps and filters, the dashboard, At a Glance, the crew log and media
pages, the About texts, the crew's condition sentences from `src/lib/mood.js`. What is
**not** translated is the work itself: what the crew write, what visitors send and the
replies, captions, and the day content authored in `content/` — task labels, meal names,
resource names, notes, crew designations and roles. Callsigns, channel codes, units, the
wordmark and `ZKM | Hertzlab` stay as they are. **Mission control and the archive are
never translated**, whatever the cookie says: English is the mission's working language
and the record — the pages, the PDF, the Markdown, the exports, the readings log — is
kept as written.

## Light and dark

**The station is dark.** Every visitor first sees it by night — the near-black paper with its
few stars, the glass smoked, the ink light, the habitat's sheet a dark grey under the dome's
colour — whatever their phone or computer is set to. The theme key in the header (*Light*)
turns it to day, and the choice is remembered in a cookie (`mcs_theme`) and resolved on the
server, so there is no flash of the wrong ground; the key (*Dark*) turns it back. A visitor
who declines cookies keeps the dark. Mission control's switch follows the same rule.

## Three phases

The station behaves differently depending on where it is in the run, and it switches by
itself at venue-local midnight.

**Before 15 October — pre-launch.** The site runs in full: the same landing page, live
sensor readings, crew reports, the board and the archive. Only two things differ. Where the
mission-day readout will sit, there is a ticking countdown to habitat occupation. And the
composer carries a line saying the habitat is not occupied yet, so anything written now
waits for the crew — those messages are stamped **day 000** and stay distinguishable in the
archive forever.

If you would rather hold the channel shut until the crew are actually inside, set
`HOLD_CHANNEL_BEFORE_LAUNCH=true`. The rest of the site stays visible either way; only the
composer closes, and the block is enforced server-side so the form cannot be posted around.

**15–27 October — active.** The countdown becomes the mission day.

**After 27 October — complete.** The mission is over, and the day after it is the last day
of the station: **Wednesday 28 October** the channel is still open — the last messages come in
and the crew's last replies go out — and mission control still takes edits. **From 29 October
the station is read-only.** The landing page becomes the closed record and reports what the
station carried: exchanges published, messages sent, callsigns issued. The channel closes:
the composer says so (*CHANNEL CLOSED — the crew left the habitat on 2026-10-27; the channel
closed at the end of 2026-10-28. Nothing sent now would reach anyone.*) and the block is
enforced on the server — `POST /communicate` stores nothing, whatever is sent to it. Mission
control closes too: every save — a schedule, a blog, a reading, a reply, a publish, a reset —
is refused with a note under the header (*Mission control closed at the end of Wed 28 Oct
2026 — the record is read-only now. The archive and every download stay open.*), the page
carries `body.control.closed` and its forms stand greyed and inert (`public/control.js`);
only signing out still works. The board and the archive stay exactly where they are, because
they are the work: every page, export and download keeps serving. The close is the end of
28 October **at the venue** — 23:00 UTC, the clocks having gone back on the 25th — computed in
`src/lib/mission.js` (`open`, `closeDate`, `closeLabel`, `closedAt`); `/api/ticker` and
`/api/board` carry `open`, and a board or a landing page left open across that midnight
reloads itself into the closed state on its next poll. For a rehearsal against made-up dates
the close is the day after the rehearsal's own last day. (The ingest freeze below is a
different instant — the end of 27 October — because the readings are the crew's, and the
crew have left.)

**And nothing is updated by automation again.** The record closes at the end of 27 October
2026 (Berlin time). From that moment: the external sensor node is not polled again
(`src/lib/critical.js`); `/api/sensors/ingest` answers `410` and stores nothing, whatever
token it is sent with; the browser pages stop asking for new readings and the ticker stops
refetching the schedule; a newly built Docker image no longer moves the readings floor, so a
rebuild cannot hide or drop the run's stored readings; stale callsigns are no longer pruned —
the rows stay as the run left them. The one write that still happens after the close is the
sealing of the final day's summary, shortly after midnight — the closing of the book — after
which the rollup timer shuts itself down and logs `automation has ended`. Reading never
stops: every page, export and download keeps serving the record. (For a rehearsal,
`CRITICAL_FREEZE_AT=<ISO datetime>` moves the closing instant.)

To preview a phase without waiting, run with different dates:

```bash
export MISSION_OVERRIDE=true MISSION_START=2026-08-12 MISSION_END=2026-08-24
npm run seed && npm start
```

## The gap during this run

Earth and Mars are **closing** throughout, which the interface shows live:

| | Distance | One-way signal |
|---|---|---|
| Opening night, Thu 15 Oct | 1.559 au · 233 M km | 12 min 58 s |
| Midpoint, Wed 21 Oct | 1.514 au · 226 M km | 12 min 35 s |
| Final day, Tue 27 Oct | 1.467 au · 219 M km | 12 min 12 s |

Round trip on opening night is 25 min 56 s. The gap shrinks about 15 million km across the
thirteen days, and the planets visibly move on the orbital plot. Every message stores the real
light-time it crossed, so the archive records the run getting fractionally faster.

## Two decisions worth knowing about

**The mission day comes from the venue timezone.** Set `MISSION_TZ`. A visitor in Auckland
sees the same mission day as the performers, so the daily content never desynchronises from
what is actually happening in the room.

Both the mission day and the T-clock are anchored to 00:00 *Berlin* on 15 October — that is
22:00 UTC on 14 October, not UTC midnight. **Berlin leaves summer time on 25 October, in the
middle of this run.** The clock absorbs that: the elapsed day count follows the mission day
and the time follows the venue wall clock, so `T+012:23:59` is the last minute of day 13
whichever side of the change it falls on. There is a test pinning this.

**The delay is compressed and the station says so.** The animated crossing runs for
`TRANSIT_SECONDS` (default 12). The real light-time — computed from actual Earth and Mars
positions, currently 3 to 22 minutes depending on the date — is shown in the rail on every
page, next to the transit clock, **always as whole minutes, rounded** (*14 min*, never
*13 min 60 s*; `formatLightTime()` in `src/lib/orbital.js`, the same in the messages PDF —
the exact seconds are in the CSV and JSON), and stored with each message so the archive records what
the crossing really cost on the day it was sent. Admitting the compression makes the real
number land harder than pretending the twelve seconds were true.

Positions come from Keplerian elements computed in `src/lib/orbital.js`, not from an
ephemeris service. Verified against published close approaches (2003-08-27: 0.3730 au
computed, 0.37272 au actual). The station keeps working if the venue loses its connection.

---

## Before opening night

1. The run's dates — Thu 15 to Tue 27 October 2026, thirteen days, Europe/Berlin — are fixed
   in `src/lib/run.js` and are **not** read from `.env`. They are applied to the database at
   every start, so a container seeded for an earlier plan comes right the moment it is
   restarted, and a stale `MISSION_START` line in `.env` is ignored (the log says so). The
   habitat's name — **MARS — RED DUST CITY** — is fixed there too, and `MISSION_NAME` in `.env`
   is read only for a rehearsal (with `MISSION_OVERRIDE`). Content
   written for days beyond the run is left out with a warning rather than refused.
2. Set `CONTROL_PASSWORD`, `SENSOR_TOKEN` and `IP_SALT`.
3. Set `SECURE_COOKIES=true` if serving over HTTPS.
4. Check Who we are on the About page (`/about#who-we-are`): the crew's portraits with their
   names (`public/crew`, made from `public/Astronaut_Pictures` — one `Firstname_Lastname.jpg`
   per person — by `tools/crew-pictures.py`, which also writes `public/crew/crew.json`, the
   people by surname, that the page reads; a new photograph needs only the script run again)
   and the partners' logos under Produced by (`public/partners`, from `public/PartnerLogo`:
   1 and 2 *In cooperation with*, 3 to 5 *Supporters* — `PARTNERS` in
   `src/views/pages/info.js`).
5. Check all thirteen days on the landing page's **whole mission** fold — every day ships written
   in `content/`; change anything there or on the matching tab in mission control.
6. Walk whoever will sit at mission control through `/control` once: the queue, Ctrl+Enter,
   the day picker and the tabs. It should be familiar before opening night, not discovered
   during it.
7. Rehearse the full loop: send a message from a phone, watch it appear at the head of the board,
   reply from control, watch it reach the board on every phone in the room without a reload.
8. Nothing to do at the end. The channel and mission control close by themselves at the end
   of Wednesday 28 October, the day after the crew come out — the last messages and the last
   replies have that day — and from 29 October the station is read-only: no message is taken,
   no edit saves, the archive and every download keep serving (*Three phases*, above).

---

## Data and privacy

Stored: callsign, message text, tags, timestamps, and a truncated one-way hash of the IP
address used only for rate limiting. No analytics, no tracking. The SQLite database and the
media the crew send out live in the `station-data` volume at `/data`. The one external request
made on a visitor's behalf is the relay to space, when it is on (*Beamed into space*): the text
of every message the crew reply to — the text alone, no callsign, no cookie, no address — is
handed to spacespeak.com, a US service, and broadcast; the composer says so under its key before
anyone sends, and the ZKM's privacy notice should say so too.

**Callsigns and cookies.** A visitor is a random token in one cookie (`mcs_id`, HttpOnly)
tied to a callsign — a word from the station's vocabulary and a number, `BASALT-625` — and
nothing else: no account, no name. The same browser gets the same callsign back for as long
as the cookie lasts; a cleared browser, private window or second device is a new visitor.
Unused callsigns are pruned after seven days. The station asks before setting it: on first
contact every public page carries the **cookie question** (`consent()` in
`src/views/layout.js`, `POST /consent`), a card over the page — at its head a strip of night with
the stars drifting and a dashed orbit round *Incoming transmission* — that greets the visitor by the
callsign they will keep (*Welcome OXIDE-569*: the name is picked on arrival and is the one the composer shows and a
first message is sent under) and says why to accept, with **Learn more** (the ZKM privacy policy, in a new
tab, the card stays) and **Agree and close**. Until it is answered a page view sets no cookie at all and the composer
shows *Callsign on sending* in place of the callsign. **Agree and close** stores the answer
(`mcs_consent`, a year) and the next page view mints the callsign for a year; the theme and
language cookies last a year as well. A visitor who never agrees can still read everything and
still send: sending mints a callsign — the message has to carry one — in a cookie without an
expiry, gone when the browser closes, and the device's head takes the callsign up from the
composer fragment (`data-callsign`, `public/composer.js`); the theme and language switches work
the same way, for the visit only. (`POST /consent` still accepts the old `choice=no`.)
Either answer sends the visitor back to the page they were on, through
the same door — `/write#write` stays `/write#write`, the pop-up out (`public/tabbar.js`
fills the form's `back` field with the address, hash included, which only the browser knows).

Back it up with the script, which uses SQLite's own backup API — a plain `cp` of a live
WAL database can produce a corrupt copy:

```bash
bash tools/backup.sh --docker      # or: npm run backup
```

**Download all messages** — a card of its own on the archive contents page, beside the
record's downloads, `/control/messages/export.pdf` — hands over every message that ever reached the
station, in the order it was sent, whatever became of it: published with its reply and who
gave it, rejected with the reason, still waiting, or in transit, each with its callsign,
tags, day, time and the signal delay stored with it. The same set is beside it as a CSV
(`/control/messages/export.csv`, one row per message, opens in a spreadsheet) and as JSON
(`/control/messages/export.json`). The messages are not part of the mission record; this is
mission control's own copy. Worth taking at the end of each performance week and keeping
off the venue machine.

Nothing that has been publicly visible is hard-deleted. The archive is part of the work.

---

## Layout

```
src/
  server.js              routes, context, sensor API, message submission
  db/schema.sql          full schema
  db/seed.js             idempotent seed: mission, crew, days, sensors, admin
  lib/orbital.js         Earth/Mars positions, distance, light time
  lib/mission.js         mission day, T+ clock, venue timezone
  lib/i18n.js            the three languages: every German and French word, keyed by its English
  lib/mood.js            the only place slider values become language
  lib/data.js            queries, sensor evaluation, transit settlement
  lib/callsign.js        visitor identity
  lib/media.js           the media archive: hashed files, manifest, verify
  lib/zip.js             dependency-free streaming ZIP writer (Zip64)
  lib/pdf.js             dependency-free PDF writer: pages, standard fonts, vector, JPEG/PNG, bookmarks
  lib/record-pdf.js      the complete mission record as one PDF, composed from the archive queries
  lib/readings-log.js    every reading ever pulled, one JSON file per pull, kept forever
  lib/critical.js        the habitat's readings: the one table, the readings floor, the external node
  lib/habitat-feed.js    the habitat sensor (M5 ENV Pro) through Home Assistant, into that table
  lib/home-assistant.js  the Home Assistant bridge: the hardware panel, and the habitat mapping
  routes/control.js      all admin write paths
  routes/media.js        the public media pages and downloads
  views/                 server-rendered templates
  lib/officer.js         the first officer's title as shown (Commanding Officer; stored as COMMUNICATION OFFICER)
  views/pages/public.js  the public pages: the mission page (the three pages, no composer), the Write page (the board
                         as a wall of notes — boardWall, noteCard — its bar with the Write key under the header, and
                         the composer's pop-up — portal, public/write.js), the dashboard page (the dashboard alone,
                         Today's Mission a folder of the Daily Life track), the screens' pieces
  views/pages/landing.js the landing page's three pages: the name, the note with its Know more key, the slowest
                         chat, and the scroll nudge under the dome
  views/pages/inside.js  the habitat in section, a section of the About page: the cutaway picture handed over as two
                         SVG stacks, composed to public/habitat/scene-lines.webp (the line art) and a cut-out a module
                         of the coloured picture (public/habitat/modules/), every module a key that lights up in colour
                         under the hand, with its tag and its pop-up (on a desk opened by the hand alone), EVA and the
                         Dashboard as round keys on the ground outside; the line AI generated image under the picture
  views/pages/dome.js    the pop-ups' sentences and /api/dome's figures (figures); the dome filled with its colour with its
                         floating keys (habitatDome), not drawn any more
  views/pages/sky.js     the sky over the dome (the newest exchanges and pictures) and the sequencer sheet under it
                         (public/sky.js places them on the grid and fades them in and out, moves the day's line,
                         hides the nudge under the dome once scrolled, moves the signal in transit and pages a phone's scroll)
  views/pages/info.js    the About page: About, What's inside the habitat, Who we are
public/                  the stylesheets (station.css, aura.css, sheet.css over them), the page scripts (board,
                         composer, habitat, media, sky, entry editor), the habitat's pictures (habitat/: inside.svg, the
                         habitat in section, ground.jpg, the Mars plain it stands on, and rooms/, five of the rooms in
                         colour, shown when lit; the earlier cutaway's two pictures, unused) and the mission's photographs
                         (mission/, unused now)
tools/                   sensor simulator, mock Home Assistant, backup script, media verifier, end-to-end test,
                         habitat-modules.py (the habitat's scene and the modules' cut-outs from the two SVG files handed
                         over; run it again when either file is replaced), missions-json.py (content/missions.json
                         from the sheets in missions/; run it again when a sheet changes), trace-inside.py (the
                         earlier linework, unused)
missions/                the scientific missions' sheets, one PDF a mission, MARS_Mission_NN_Title.pdf, 00 to 12
                         (served at /missions/<file>; each sheet's words and which sheet is which day's — the plan
                         (days), set by the Science officer on the desk — are in content/missions.json, written
                         from the sheets by tools/missions-json.py)
```
