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
habitat"), in the dashboard header, in the About pop-up and in the countdown pill.

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

**Two pages.** The public station is one page; mission control is one page. The archive,
which is mission control's, sits behind the same login.

| Page | Route | Holds |
|---|---|---|
| The station | `/` | **The ticker** across the top — the habitat's clock and a running line of the current activity, the next one and the habitat sensor's reading · composer and orbital plot · the live message board · the mission dashboard (schedule, meal, mood, habitat, resources, trends, and below the trends **the three daily blogs** — Daily Science Findings, Daily Health Blog, Commander Blog) · **about** (the project, how the station behaves, who we are). The crew log, the media and the whole mission day by day live on their own pages (`/logbook`, `/media`, `/at-a-glance`) |
| Dashboard | `/dashboard` | The mission dashboard on a page of its own — the same section the station page carries on a desk: the head, the live images, the two doors, the strip of sols and the nine panels behind their index. Drawn for a phone first; the phone's bar of keys leads here with **Dashboard**, and on a phone the station page keeps only the habitat and the doors |
| Messages | `/messages` | The portal on a page of its own — the composer and the live message board, the same pieces the station page shows on a desk. Drawn for a phone first: the exchanges flow with the page, the composer is a dock at the foot of the screen; the phone's bar of keys leads here with **Write**, and on a phone the station page keeps only the doors |
| Mission control | `/control` | Five tabs: **Messages** (the reply queue) first, then one per officer, and the habitat — which ends with the plan and the reset |
| At a Glance | `/at-a-glance` | **A booklet: one day per page, turned by scrolling or swiping sideways** — arrows either side, ← → on a keyboard, a day strip to jump, a `#day-n` link opens on that day. Each page: each day's crew log with its photographs, the exchanges published, the schedule as run, the meals and their cost, the consumption of every store, the habitat summary, the crew's condition as sentences, the mission notes and the media. Days ahead show the plan, and each page scrolls on its own like a page being read. Opened from the button under the mission dashboard, and from the navigation |
| Crew log | `/logbook` | All thirteen days in order, each officer's entry where written and its placeholder where not — a day strip to jump by, a chip per voice. Opened from the Crew log panel on the station, and from the nav |
| Media | `/media` | Everything the crew send out — photographs and video — by day, with filters; `/media/:id` one item; `/media/export.zip` everything as one ZIP; `/media/manifest.json` every file with its SHA-256 |
| Archive | `/archive` | **Mission control only.** Day-by-day permanent record — no messages, every reading; `/archive/day/:n`, **`/archive/export.pdf`** (the whole mission as one document), `/archive/export.md`, `/archive/export.json`, **`/archive/readings.zip`** (every reading ever pulled). `/archive/messages` is a separate, unlinked search over the message queue and is not part of the record |

Every address the public subpages used to have (`/messages`, `/crew`, `/day`, `/schedule`,
`/what`, `/about`, `/who-we-are`) redirects to its section on the landing page, so old links
and printed material still land somewhere. The footer of the landing page is the navigation.

### Mission control

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
| **Messages** | The reply queue: awaiting reply · published · rejected · everything |
| **Communication officer** | The **Commander Blog** at the top, then the officer's state |
| **Science officer** | The **Daily Science Findings** at the top, then the state |
| **Health officer** | The **Daily Health Blog** at the top, then the state |
| **Habitat** | The daily schedule (a task with its name emptied is removed on save), the meals — Breakfast, Lunch, Dinner, Other — **Steps taken** and **Calories consumed** (one line per officer each, both written to `crew-figures.json`), the inventory levels, and the day's power figures (with the category names, editable in place) |

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
visible only to its sender, under **MY MESSAGES** on the board; the common board carries nothing
that has not been published. Saving without publishing is still there as a secondary action.

**The board is live.** The landing page polls `/api/board` every few seconds and swaps in
changes, so a reply published from control appears on every open phone without a reload.

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

- **every Commander Blog slot is emptied** — `logbook.json` becomes one placeholder per day (communication officer only),
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

## The trend graph

**Trends** on the landing page is the run: **15 to 27 October, every day on the axis**, SOL 01
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
| **Daily Science Findings** (`#blog-science`) | the day's science findings — the `SCIENCE` note in `content/notes.json` | **Science officer** → Daily science findings |
| **Daily Health Blog** (`#blog-health`) | the day's health activities — the `HEALTH` note in `content/notes.json` | **Health officer** → Daily health activities |
| **Commander Blog** (`#blog-commander`) | the communication officer's **Daily Blog** — their entry in `content/logbook.json` | **Communication officer** → Daily Blog |

**The Commander Blog is the communication officer's blog**, under the name the station gives
it; nothing else about that officer is renamed, and it is still written on their tab.

**Each panel shows the current day's post, and only that.** The day is the one the schedule
and the meal folders are showing — today's SOL during the run, SOL 01 before it — and it is
named in the panel's head (`SOL 005 · Mon 19 Oct`). Yesterday's post is not here: earlier days
are on the crew log (`/logbook`) and in At a Glance. Until the day's post is written the panel
says so (*No science findings yet for SOL 005*). The same rule as everywhere else decides what
is public: a post is on the station the moment it is saved; a placeholder never is, and a post
cleared in mission control leaves its panel at once. Like the schedule and the meal, a panel is
drawn when the page is loaded — a page left open across midnight shows the new day on its next
load.

**The post is read where it stands, by scrolling — there is nothing to click into and back
out of.** A panel is as tall as its post, up to a limit, and from there the post scrolls inside
the panel: the scroller carries the orange bar of the message board, the text fades out at its
foot while there is more below, and once it has the focus the arrow keys, Page Down and End
move it; at its end the page carries on scrolling. A panel's title is not a link, and a
photograph in a post is shown in the post rather than linked to its media page, so nothing in
a panel leads off the landing page. Photographs and video placed in a post are shown in it.

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
| Power consumed, by category | `content/power.json`: `"5": { "heating": 1.1, "food": 0.5, "lighting": 0.35, "electronics": 0.45, "other": 0.1 }` — kWh per day. The `categories` list above the days is editable too: rename a label, add or remove one; the key is the stable name in the record | **Habitat** → Power, day picker on the day; the name fields rename the categories everywhere |
| Today's schedule | `content/schedule.json`: per day, `{ "time": "06:45", "label": "…", "detail": "…" }`; task status (done, active, skipped) is marked on the tab as the day runs | **Habitat** → Schedule |
| Meals | `content/meals.json`: per day, slots BREAKFAST / LUNCH / DINNER / RATION with `kcal`, `water`, `prep`, `energy` | **Habitat** → Food plan |
| Mission notes | `content/notes.json`: per day, `{ "kind": "LOG" \| "ANOMALY", "body": "…" }` | `POST /control/updates` (the notes composer) |
| Blogs, findings, activities | written over the placeholders in `content/logbook.json` / `notes.json` | each officer's tab |

**Before the run, At a Glance opens on a rehearsal page.** Marked `REHEARSAL · NOT THE RECORD`
and reached as **NOW** in the day strip, it is a complete day page filled with what there is
today: the habitat's readings as the sensors are sending them now (tiles and point-by-point
charts), the plan for SOL 001 (schedule, meals, consumption rings, power), whatever the crew
have already written into the opening day (blogs, exchanges, media), and any states filed
today — the real feel of a filled page, weeks early. It is not part of the record and
disappears on 15 October, when SOL 001 takes its place.

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
| `power.json` | Power consumed per day in kWh, split by editable categories (heating, food, lighting, electronics, other as shipped) — drawn on the Habitat panel, in At a Glance, in the Trends and throughout the record |
| `logbook.json` | The crew's diary entries, by day and crew member |
| `notes.json` | Mission notes, science findings, health activities and anomalies |
| `sensors.json` | The monitored channels, with units, channel codes and thresholds |
| `templates.json` | The prefilled text of the daily health activities (the `Default` entry under `HEALTH`) |
| `recipes.json` | The recipe book: twelve recipes (two measured, ten samples) with prep time and per-serving kcal, nutrients, CO₂e and water footprint — what the food plan's dropdowns offer (see *The recipe book*) |

It ships with the plan and nothing invented: 13 Commander Blog slots (one a day, communication officer only)
with a cue each for the crew to write into, the typical daily schedule on every day (17 tasks ×
13 days), an empty food plan (`meals.json` — each day's meals are chosen from the recipe book on the Habitat tab), nine tracked resources (their carried-in amounts and warning levels ship as
0 — placeholders to be written into `crew-and-inventory.json` before the run, or the day-1 count
filed on the Habitat tab, which every gauge is then drawn against), and the sensor channels.
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
post editor — a toolbar across the top with **Photo / video** on the left and
**Visual | Text** on the right, one sheet under it, the word count in the foot. The sheet is
one document: the text flows, Enter starts a new paragraph, and a photograph or a film goes
in where the cursor is (press the toolbar button, or drop a file onto the sheet). It uploads
on the spot with a progress bar, shows its preview in the flow, takes a caption under itself,
and **✕ deletes it** from the entry and from the station — the blog, the Media page, the
downloads — at once (Backspace against it asks the same); the file itself is kept in the
archive volume as *withdrawn*. The **Text** tab shows the same plain text the station stores —
paragraphs with `[media:12]` lines — for editing by hand, so the file in `content/` stays
readable, and without JavaScript the box is still a textarea with a file picker. The files go
into the media archive under that officer and day, so they are also in the gallery, the
exports and the ZIP. Full guide in `content/README.md`.

## The recipe book

On mission control's **Habitat** tab, **Breakfast**, **Lunch** and **Dinner** each open with a dropdown over the
recipe book, **`content/recipes.json`**. Choosing a recipe fills the slot's name, kcal, **prep time**, the six
nutrients (protein, fat, carbohydrate, fibre, sugar, sodium), CO₂e and water footprint — all per serving, all still
editable before **Save food plan**. The dropdown's first option, **Empty — fill in the fields below by hand**, clears
the slot to be written on the go: it is saved for that day only and never adds a recipe.

The book ships with twelve recipes: Chili Non Carne and Pfannenbrot with their measured figures, and **ten sample
recipes** marked `"sample": true` — invented names and figures to fill the list until the real ones are in. Every
recipe carries a `prep_minutes`. The book is edited **in the file only**; mission control has no recipe editor.

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
| **Commander Blog** | the communication officer, on their tab | `content/logbook.json` (COMMUNICATION OFFICER only) |
| **Daily Science Findings** | the science officer, on their tab | `content/notes.json`, kind `SCIENCE` |
| **Daily Health Blog** | the health officer, on their tab | `content/notes.json`, kind `HEALTH` |

The science and health officers have no other blog: their old per-officer "Daily Blog" is gone
from mission control, and any entry for them in `logbook.json` (or left in the database) is
dropped on load. The crew log page shows each day's three blogs, filterable by blog.

The foot of every public page links **Privacy policy**, **ZKM** and **Imprint** — the imprint is the
station's own page, `/imprint` (`src/views/pages/imprint.js`), with ZKM's details in German and English.

## Who writes what

Two kinds of content, with a hard line between them.

**Preset, and edited in files.** The daily schedule, the meal plan and the inventory live in
`content/` and are prepared in advance for the days of the run. They can also be edited on the
matching tab of mission control, which writes into the same files.

**Written daily, in the crew's voice.** The communication, science and health officers each
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
**`/media`** — that page is the gallery and nothing else. The station server signs in with
the display account over **WebDAV**, checks the folder for new images on a set **frequency**
(`CLOUD_CHECK_SECONDS`, fifteen minutes by default), follows its subfolders, and keeps a copy of every image it shows on the `station-data` volume under `/data/cloud`
(beside a `manifest.json`), together with the preview Nextcloud renders for it. The browser
only ever talks to the station — `/media/cloud/<id>` is the copy, `/media/cloud/<id>/thumb`
the preview — so the grid stands with the cloud slow, the sign-in changed or the venue
network unplugged, and the credentials never leave the server. It is **read-only**: nothing
is ever written to the cloud. A file removed from the folder leaves the grid on the next read.

Everything is in **`.env`**: `CLOUD_URL` (default `https://cloud.zkm.de`), `CLOUD_USER` and
`CLOUD_PASSWORD` (the display account), `CLOUD_FOLDER` (a path inside that account —
empty for its root), `CLOUD_TITLE` (the heading, default *Gallery*), **`CLOUD_CHECK_SECONDS`**
(the frequency — how often the folder is checked, and how often an open `/media` asks the
station for the grid; a picture put in the folder is on every open page within about that
long, with no reload, the same way the board updates) and `CLOUD_POLL=false` to hold the
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
live on the same frequency (`#cloud-latest`, `cloudLatestInner()` in `src/views/pages/media.js`). "Most recently added" means when the file arrived in the folder (Nextcloud
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
Assistant on a machine without the venue network, so the whole path can be rehearsed —
the test suite does.

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
`/api/orbital`, `/api/status`, `/healthz`.

## The habitat's own hardware (Home Assistant)

**On the marsplatz server Home Assistant is behind an SSH tunnel** that listens on the server's
own `localhost:8088` only, which a container on Docker's network cannot reach. There the station
runs with `network_mode: host` — see **`deploy/marsplatz-docker-compose.yml`** — so its
`localhost` is the server's: `HA_HOST=localhost`, `HA_PORT=8088`, and `LISTEN_HOST=127.0.0.1`
keeps the station on the server's localhost:8080 for the reverse proxy, exactly where the old
port mapping put it. Neither the tunnel nor Home Assistant changes.

The real devices inside the habitat — as configured now: the cricket terrarium's temperature
(`m5_temperatur_cricket_temperature`), NO₂, O₂ and CO from the environment sensor, and the
Shelly plug's energy meter — hang off a Home Assistant instance on the venue network. The
station server polls its REST API and draws them **inside the Habitat panel**, under a
*Habitat hardware* heading below the node's tiles, the stores and the power (there is no
separate Habitat hardware tab): one tile per device with the current
reading, when it last changed and its last 24 hours as a sparkline, and beneath the tiles
one combined chart with every device on the same day — each line on its own scale, named at
its end in its own colour, exactly as the Trends panel does it. The panel refreshes itself
on the poll cycle without a reload; without JavaScript the server-rendered panel stands.

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

## The habitat, as a picture

Between the About row and the composer sits **the habitat dome** — a screen set into a pale slab,
as the board is, but this screen is a sky: by day a grained sunrise from periwinkle at the top
through lavender and peach to Mars orange at the floor; by night (the dark theme) the night,
black and starred at the top, down through indigo to a band of gold and red at the horizon. The
dome stands on it as translucent white glass — whiter at the apex than at the floor, the sky
showing faintly through, a fine wireframe of facets that carry a whisper of shade, a soft
shadow beneath — with a hexagon set into it for each system
inside — the crew, the science lab, the water recycling loop, the hydroponic shelves
(*Hydroponics*), the communication uplink, the power store, the nap pod and the bicycle
(*Power generator*) — each named on a
leader line beside the dome with its channel code, as every panel of the station is. The
pictograms are traced from the mission's own icon set (`src/views/pages/dome-icons.json`). A
hexagon turns orange under the hand, together with its name; a hexagon under the pointer stands still so it can be pressed, and pressing it (or its name, or on a
phone the chip beneath the picture) opens a pop-up — headed by the hexagon itself — that says what that part of the habitat is
and, in an orange **Now** line, what is happening in it at this minute: the task on the
schedule, each officer's condition as words, the water and food stores and their days left, the
latest exchange, today's kWh by category, the steps pedalled. The sentences are asked for again
every twenty seconds from **`/api/dome`**, so a reply published from mission control or a figure
filed on a tab reaches every open pop-up without a reload.
**The hexagons float about the whole interior.** Each has a destination somewhere inside the
shell — chosen evenly by height, so the top of the dome is visited as often as the wide floor,
and away from where the others are heading — and glides towards it on a slow spring; arriving,
it picks another. Two that would sit on each other on the screen ease apart. Each is projected
with the dome's own camera and comes forward or recedes a little with depth. Its label follows:
the leader is redrawn every frame, the name slides along its column to stay level with the
hexagon, the names on a side keep clear of one another, and when a hexagon crosses to the other
half of the dome its name crosses too, fading out on one side and in on the other. Everything
stands still under `prefers-reduced-motion`, and without JavaScript the hexagons stand where
the server placed them. `src/views/pages/dome.js` holds the
geometry (a frequency-3 icosahedral dome, front faces only, computed once at start), the hexagons and their
positions, the still text of each pop-up (`ABOUT`), and the one function that writes the
live sentences for both the page and the API.

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

**Before the run, a rehearsal page shows the shape.** Until 15 October the archive's contents
page opens with a **NOW** row — today, before the run — and `/archive/today` (with
`/archive/today/export.pdf` and `.md`) is a day's record built for today: today's readings
from every source with their summary, the states filed today, and whatever has been put into
the opening day (SOL 001) so far — its plan, entries, counts, figures and media. The full PDF
and the Markdown carry it as a chapter after the list of days. It is marked *REHEARSAL · NOT
THE RECORD* wherever it appears and disappears on the first day of the run, when day 001
takes its place; from then on `/archive/today` simply leads to the current day.

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

**A phone held upright** (up to 760 px across, more than 520 px tall) gets its own chrome on
the public pages, drawn from the same markup — nothing is served twice, and the desk and a
phone held sideways are untouched (the block at the end of `public/aura.css`):

- the ticker becomes a **top bar that stays**: the wordmark, the sol as a pill with the live
  dot (the countdown before the run), the habitat's clock, the theme and language switches,
  and the running line as a second row beneath them. Its three-lines button is hidden; what
  it opened is reached from the bar at the foot. Anything a link brings into view — the
  portal, the dashboard, a folder, a day of the booklet or of the log — lands under the bar
  (`scroll-padding-top` on the root), and `public/folder.js` places the index under it.
- a **bar of five keys fixed at the foot** — Home, Dashboard, Write, Media, About — with
  Write raised in orange (`tabbar()` in `src/views/layout.js`, `public/tabbar.js`). Each key
  is a page and the lit key names the page you are on. **About** opens
  the ticker's menu as a sheet from the foot — About, What this is, Who we are, each with
  its sign; the reading pop-ups open as sheets too.
- the station page keeps the wordmark, the lead, the **two doors** — Write to the crew and
  Live Mission Dashboard, side by side in one row under the lead, each a pill of two lines
  — the habitat, and then the foot: nothing else. The masthead's rows stand a little closer
  than on a desk (the wordmark 50 px, the lead at 1.45 lines), so that on a 360 × 744 screen
  — a common phone with the browser's own bar showing — the doors and the whole habitat are
  on the first screen above the keys.
- the **dashboard is a page of its own, `/dashboard`** (`dashboardPage()` in
  `src/views/pages/public.js`, built from the same data as the station page): the bar's
  Dashboard key, the second door and the dome's keys all lead there
  (`public/tabbar.js`), a link into a panel — `/dashboard#galley` — opening its folder.
  Its index is **two rows of tabs**: a segmented control of the three tracks (Habitat ·
  Today · Blogs) and, beneath it, that track's three folders as underlined tabs; both stay
  under the top bar while the open folder scrolls beneath them. No key is more than two
  taps away.
- the portal's head puts the one-way signal small at the right of the title, so the
  composer's Transmit key is on the portal's first screen.
- the portal — the composer and the board — is a **page of its own, `/messages`**
  (`messages()` in `src/views/pages/public.js`): the station page drops it and its first
  door and the bar's Write key lead there (`public/tabbar.js`). On that page the board is the page: its filter chips stick
  under the top bar in one sideways row, the exchanges flow beneath — twenty of the current
  view at a time, a **Show more** key beneath them bringing the next twenty
  (`public/board.js`) — and the composer is a **pop-up over the foot of the screen**, above
  the bar of keys: `/messages#write` (every Write door) opens the page with it out, the bar's
  Write key shows and hides it, a touch on the page beside it — or Escape — hides it. It is
  plainly a surface of its own: solid paper (no glass) with a rule of Mars along its top edge
  and a shadow upward, the list dimmed a little behind it while it is out (the dimming is
  drawn inside the shell, `.shell::before`, where the pop-up lives — every child of the body
  is a layer of its own, so drawn on the body it would lie over the pop-up as well, in the
  round shape of the body's glow). The page ends with the last message: it carries no foot
  here, so the list scrolls up to just above the pop-up and no further. It holds the title,
  the operator's callsign, a writing box the whole width of the pop-up — seven lines deep to
  begin with, growing with the text to nine; while the keyboard is up, as deep as fits between
  the top bar and the keyboard — beneath it the five tags whole in one line, small enough to
  fit in every language (a tag longer than its room is cut short rather than the row) — every
  tag the visitor sees, in the composer, the board's filter, a card's small print and the
  archive, is written with a `#` in front, `#QUESTION` — and
  under them **Transmit** in the middle, an orange pill, dim until there is something to send.
  While a message is being written the
  list behind the pop-up is blurred away (the one blur a phone draws, and only then); during
  the crossing it clears again, so the message can be seen arriving under MY MESSAGES.
  **While the phone's keyboard is up** the bar of keys steps
  aside and the pop-up sits on the keyboard's upper edge, so what is typed is in view: a
  phone's keyboard covers the lower part of the page without shrinking it, and only the
  visible part (`window.visualViewport`) says where its edge is — `tabbar.js` reads that, never
  the focus, so that a touch on Transmit while the keyboard is up finds the button where it
  was; the keyboard folded away, the keys return under the pop-up. A press on Transmit brings
  the board's head into view, where the message just sent appears under MY MESSAGES while the
  pop-up shows the crossing on a small dial — at the size the pop-up had when Transmit was
  pressed (`tabbar.js` holds the stage at that height, the crossing centred in it), so nothing
  jumps; the fresh form afterwards has its own size again. Without JavaScript the pop-up
  simply stands there.
- the page's side margin is 16 px rather than the desk's proportional gutter.
- **the paper dress** (the last block of `public/aura.css`): the same design drawn without what
  costs a phone the most. The surfaces are opaque paper instead of blurred glass — a backdrop
  blur is redrawn every frame, and eight of them shared one screen — the film grain is not
  blended over the screen, the habitat's keys carry a stroke instead of an SVG filter, every
  panel has one short shadow instead of three, the running line is clipped instead of masked,
  and the exchange cards and the foot far below the screen are neither laid out nor painted
  until they come near (`content-visibility`). What the page scrolls under — the top bar, the
  chips row, the bar of keys — is opaque paper, so nothing ghosts through it. Same layout,
  type, cobalt and Mars; a wider screen and a phone held sideways keep the glass.

## Visual language

A soft instrument. A pale grey ground lit from above; the things you touch are raised off it as
pale slabs with deep, soft shadows; the things you read are dark glass screens set into them.
One orange, kept for what is live, what is Mars, and what wants pressing.

The parts are working parts, not decoration:

- **The composer is a device.** An orange LED, a ribbed orange grip at the top edge, a knob and
  a row of vents; then the operator's callsign in an inset chip and the channel it writes on
  (`CH-09 · UPLINK`). The writing surface is an inset well; the one orange button transmits.
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
- **The foot** (`foot()` in `src/views/layout.js`) carries the wordmark, two keys — *Privacy
  policy*, to zkm.de/en/privacy-policy, and *ZKM*, to zkm.de — and the house's name,
  nothing else; the pages are reached from the bar of keys, the ticker's menu and the doors.
  On a phone held upright it is a low band the width of the page: the wordmark and the house
  at the left, the two keys one above the other at the right.
- **The one-way signal time is read where a message is written** — the messages page's head,
  the composer's crossing, the `/communicate` fallback — and nowhere else: the ticker, the
  foot, the About panel and the mission-complete page leave it out (the About text still
  explains the compressed crossing in a sentence).
- **Empty states** are dashed wells rather than crossed boxes.

Orange is the only colour. It marks Mars, live state, and anything wanting action. Status is
still carried by **symbol** as well — filled centre is nominal, single bar is caution, crossed
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
current draw**. Anything under its warning threshold turns orange.

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

## Crew states

One scale: **Mood, calm ↔ angry**, filed in mission control as a row of five faces — calm,
settled, level, tense, angry — like a waiting-room rating card. Picking a face shows the exact
sentence the public will get; the number itself (0–100 behind the faces) is never published.
The database columns are unchanged (`calm_tense` carries the value), so states filed under the
older two- and four-axis schemes still read correctly.

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
a label, a unit, a channel code and thresholds.

## The mission page

The landing page opens on the **MARS!platz** wordmark on the grey ground, one line beneath it,
and the station's readings as a row of pills on the right; there is no photograph and no black
rail. (`public/hero.jpg` is no longer referenced and can be deleted.) About · What this is ·
Who we are open from the ticker's menu as reading dialogs on solid paper (nothing of the page
shows through the text; the dome's small pop-ups keep their glass). The landing page
carries no top bar; its navigation lives in the dark footer slab. Subpages keep the status rail
and **Mission · Messages · Crew log · About**.

Across the very top runs **the ticker**: an orange cell with the habitat's clock (venue time,
ticking), then a continuously running line — the SOL, **what the crew are currently doing**
(the schedule task whose time it is, with its detail — "14:00 · Maintenance — West panel seal,
third attempt" — switching to the next as its time comes), what is next, the node's current
reading (or *no current reading*). Every five minutes it fetches
the day's schedule again from `/api/ticker`, so an edit made in mission control — or midnight
turning to a new day — reaches every open phone without a reload. It scrolls like a wire
ticker, holds while hovered, and stands still under reduced motion.

**The ticker is always now.** Before 15 October it counts down, to the second, to 00:00 at
the venue on the first day. The moment that instant passes — and likewise when **Reset to 15
October** is pressed, or the station's dates change under an open page — the page reloads
itself once and comes back as the run: SOL 01, the day's schedule, the crew's current task. A
phone left open across midnight on 15 October turns into the run by itself; nobody has to
refresh anything. (The page never trusts its own clock for this: at zero it asks the
station, so a phone running fast cannot reload in a loop.)

Under the lead stand two buttons: the orange **Write to the crew**, which leads to the
composer (`#write`), and beside it — under it where the column is narrow — a glass **Live
Mission Dashboard** with the live dot, which leads to the dashboard (`#mission`); both land
their section's heading where the wheel does.

Below that the page is two things. **The landing fold**: a heading in the dashboard's dress —
the channel's code `CH-09`, **Send a message to the Crew**, a line beneath, and at the right
the one-way light-time a message is about to cross — then the composer device and the
message-board screen beside it, the three centred in the window. **The mission dashboard**
(`CH-00`): under its heading, small, the headline figures — the sol (the countdown before the
run) and the crew; then the strip of live images from the habitat — the LIVE badge and the
six newest pictures, nothing else; then one row of the two doors (At a Glance and Media, two
small pills side by side) with the run as a strip of thirteen sols beside them; then the
dashboard's nine panels behind **one index** on the head of one glass panel: three tracks of
equal width, each named at its left and holding three keys — *Habitat*: the **Habitat** (the
sensor tiles, the crew's figures, the resource rings and the power bars), the **Habitat
hardware** and the **Trends**; *Today*: **Today's Schedule**, **Today's Meal** and **Crew
Moods**; *Blogs*: the three blogs. Every key carries a line icon in the hand of the dome's
keys, its channel code and its name. The page opens on the Habitat. A press on a key opens
that folder beneath the index (the key turns cobalt, and the name of its track with it), the
arrow keys walk the keys, and a link into a panel — `/#habitat`, `/#crew`, `/#galley`,
`/#schedule`, the dome's keys, the foot — opens its folder and brings the index into view
(`folder()` in `src/views/pages/public.js`, `public/folder.js`, the styles under *the index of
folders* in `public/aura.css`). The open folder is as tall as its panel; on a desk it is never
taller than the window leaves under the index, and a panel that needs more scrolls inside; on
a phone the page scrolls as one, and a phone held upright shows the index as two rows of tabs
(see *Mobile and desktop*).

During pre-launch the readings show the countdown in place of the mission day and the day rail
and strip carry no marker.

## The board

The board beside the composer holds the whole correspondence: every published exchange in one
scrollable field, with tag chips that filter it — press `PERSONAL` and the field shows only
those — and a **MY MESSAGES** chip that shows your own, including the ones still waiting on the
crew. The counts are live.

Each exchange is one card (`messageCard()` in `src/views/pages/public.js`, the styles under
*the exchanges* in `public/aura.css`): the visitor's message in a shaded box, with one line of
small print over it — its tags, the callsign, `Earth`, the day and time it was sent — and the
`Ref` number at the right; beneath the box **CREW ANSWER** and the crew's reply, large, with
the officer, the habitat and the time the reply left Mars in small print under it. A message not
yet answered shows its state (`IN TRANSIT`, `REACHED MARS`) where the answer will stand. The
same card serves the last exchanges on the closing page.

There is exactly one place to write on the public station, at the top of the mission page. A
second composer beside the exchange was one box too many: it invited a reply to a message you
had just read, which is not what this channel is — every message goes to the habitat, not to
another visitor.

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

Light is the default, matching the reference. The toggle is the last pill in the masthead
readings (the last cell of the rail on the inner pages) and is remembered in a cookie, resolved
on the server and applied to `<html>` before first paint — no flash of the wrong ground on
load. Dark turns the ground to charcoal and keeps the same orange, the same raised slabs and
the same soft shadows, deeper.

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

**After 27 October — complete.** The landing page reports what the station carried:
exchanges published, messages sent, callsigns issued. The channel closes. The board and the
archive stay exactly where they are, because they are the work.

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
page, next to the transit clock, and stored with each message so the archive records what
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
   restarted, and a stale `MISSION_START` line in `.env` is ignored (the log says so). Content
   written for days beyond the run is left out with a warning rather than refused.
2. Set `CONTROL_PASSWORD`, `SENSOR_TOKEN` and `IP_SALT`.
3. Set `SECURE_COOKIES=true` if serving over HTTPS.
4. Replace the placeholder credits in `src/views/pages/info.js` (`CREDITS`, production and
   contact blocks on `/who-we-are`).
5. Check all thirteen days on the landing page's **whole mission** fold — every day ships written
   in `content/`; change anything there or on the matching tab in mission control.
6. Walk whoever will sit at mission control through `/control` once: the queue, Ctrl+Enter,
   the day picker and the tabs. It should be familiar before opening night, not discovered
   during it.
7. Rehearse the full loop: send a message from a phone, watch it appear under MY MESSAGES,
   reply from control, watch it reach the board on every phone in the room without a reload.

---

## Data and privacy

Stored: callsign, message text, tags, timestamps, and a truncated one-way hash of the IP
address used only for rate limiting. No analytics, no external requests, no tracking. The
SQLite database and the media the crew send out live in the `station-data` volume at `/data`.

**Callsigns and cookies.** A visitor is a random token in one cookie (`mcs_id`, HttpOnly)
tied to a callsign — a word from the station's vocabulary and a number, `BASALT-625` — and
nothing else: no account, no name. The same browser gets the same callsign back for as long
as the cookie lasts; a cleared browser, private window or second device is a new visitor.
Unused callsigns are pruned after seven days. The station asks before setting it: on first
contact every public page carries the **cookie question** (`consent()` in
`src/views/layout.js`, `POST /consent`), a card at the bottom centre of the page that greets the visitor by the
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
the same door — `/messages#write` stays `/messages#write`, the pop-up out (`public/tabbar.js`
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
  views/pages/dome.js    the habitat dome: geometry, hexagons, callouts, and /api/dome's figures
public/                  stylesheet + the page scripts (board, composer, habitat, media, entry editor)
tools/                   sensor simulator, mock Home Assistant, backup script, media verifier, end-to-end test
```
