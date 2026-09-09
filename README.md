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
| The station | `/` | **The ticker** across the top — the habitat's clock and a running line of the current activity, the next one and the node's reading · composer and orbital plot · the live message board · the mission dashboard (schedule, meal, mood, habitat, resources, trends) · **about** (the project, how the station behaves, who we are). The crew log, the media and the whole mission day by day live on their own pages (`/logbook`, `/media`, `/at-a-glance`) |
| Mission control | `/control` | Five tabs: **Messages** (the reply queue) first, then one per officer, and the habitat — which ends with the plan and the reset |
| At a Glance | `/at-a-glance` | **A booklet: one day per page, turned by scrolling or swiping sideways** — arrows either side, ← → on a keyboard, a day strip to jump, a `#day-n` link opens on that day. Each page: each day's crew log with its photographs, the exchanges published, the schedule as run, the meals and their cost, the consumption of every store, the habitat summary, the crew's condition as sentences, the mission notes and the media. Days ahead show the plan, and each page scrolls on its own like a page being read. Opened from the button under the mission dashboard, and from the navigation |
| Crew log | `/logbook` | All thirteen days in order, each officer's entry where written and its placeholder where not — a day strip to jump by, a chip per voice. Opened from the Crew log panel on the station, and from the nav |
| Media | `/media` | Everything the crew send out — photographs, video, sound — by day, with filters; `/media/:id` one item; `/media/export.zip` everything as one ZIP; `/media/manifest.json` every file with its SHA-256 |
| Archive | `/archive` | **Mission control only.** Day-by-day permanent record; `/archive/day/:n`, `/archive/messages`, **`/archive/export.pdf`** (the whole mission as one document), `/archive/export.md`, `/archive/export.json`, **`/archive/readings.zip`** (every reading ever pulled) |

Every address the public subpages used to have (`/messages`, `/crew`, `/day`, `/schedule`,
`/what`, `/about`, `/who-we-are`) redirects to its section on the landing page, so old links
and printed material still land somewhere. The footer of the landing page is the navigation.

### Mission control

Messages come first: the queue is the first tab, because answering Earth is the job that
cannot wait. Each message has its reply box directly beneath it and one orange button.
**Ctrl+Enter** (Cmd+Enter on a Mac) in the box sends and publishes. Saving a draft, rejecting
and deleting are on the same row, quieter. A message arriving while the desk is open is
announced in a banner rather than discovered on the next reload — the page polls a count and
never rebuilds itself under someone mid-reply.

The other tabs are **the day's work**: a day picker, then the tabs, which switch without a
page load. Everything editable lives here.

| Tab | Holds |
|---|---|
| **Messages** | The reply queue: awaiting reply · published · rejected · everything |
| **Communication officer** | The **Daily Blog** at the top, then the officer's state |
| **Science officer** | The **Daily Blog** at the top, then the daily science findings (a post of their own), then the state |
| **Health officer** | The **Daily Blog** at the top, then the daily health activities (a post of their own), **crew figures** (calories and steps), and the state |
| **Habitat** | The daily schedule, the daily food plan, the inventory levels, and the day's power figures (with the category names, editable in place) |

Every composer is the same: paragraphs and pictures in a column, a ＋ between every two, no
template buttons. The day picker above the tabs reaches all thirteen days of the run, so any
officer's Daily Blog can be written for any day, at any time.

A save returns you to the tab and day you were on; a reply returns you to the Messages tab in
the view you were looking at. Mission control is deliberately plain — flat white panels, black
on white, one size of type, and orange kept for the button that publishes and the count of
messages waiting — so it reads across a dark room and nothing on it competes with the work. `/control/science`, `/control/health` and `/control/habitat` still
work as addresses — they open the page on that tab.

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
officer's tab, and take photographs, video and sound the same way; a picture placed in a
report stays with the report. The interface and the files are edits to the same thing rather than two copies
of it, so you can work whichever way suits the moment and never reconcile anything.


## Starting again for 15 October

**Reset to 15 October** sits at the top of mission control, on every tab. It opens a dialog that
asks *Are you sure you want to reset?* and takes the word `RESET` typed into a box — the button
only wakes up once it has been typed, and the word is checked again on the server, so nothing
can trigger it by accident. Then it starts the station again for the run:

- **every blog slot is emptied** — `logbook.json` becomes one placeholder per day and officer,
  for the crew to fill in during the mission;
- **the crew's figures are emptied** — `crew-figures.json` loses its days; the health officer
  files each day's calories and steps on the Health tab as the run goes;
- **the power figures are emptied** — `power.json` loses its days and keeps its categories;
  each day's kWh by category is filed on the Habitat tab as the run goes;
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
  moment** — schedule, meals, inventory levels, notes, sensors, figures, crew. Nothing is copied
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

## Editing the day's values during the run

Everything the run updates daily has one file and one tab, which write into each other; edit
whichever suits the moment and it is live on the station within seconds:

| What | The file | The tab in mission control |
|---|---|---|
| Resources — what is left of each store | `content/inventory-levels.json`: per day, per store, `{ "quantity": 618, "consumption": 46 }`. Only write the stores that changed; the rest carry forward at their daily draw | **Habitat** → Inventory levels, with the day picker on the day |
| Calories and steps | `content/crew-figures.json`: `"5": { "calories": 5010, "steps": 6420 }` | **Health officer** → Crew figures, day picker on the day |
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
| `schedule.json` | The daily task schedule |
| `meals.json` | Meals per day, with energy, water and power cost |
| `inventory-levels.json` | What is left of each resource at the end of each day |
| `power.json` | Power consumed per day in kWh, split by editable categories (heating, food, lighting, electronics, other as shipped) — drawn on the Habitat panel, in At a Glance, in the Trends and throughout the record |
| `logbook.json` | The crew's diary entries, by day and crew member |
| `notes.json` | Mission notes, science findings, health activities and anomalies |
| `sensors.json` | The monitored channels, with units, channel codes and thresholds |
| `templates.json` | The prefilled text of the daily health activities (the `Default` entry under `HEALTH`) |

It ships with the whole thirteen-day run written: 39 diary slots (thirteen days × three
officers) with a cue each for the crew to write into, 105 scheduled tasks, 39 meals, crew figures
for every day, nine tracked resources with a depletion curve, and the mission notes that go with
them. The dramaturgy, day by day: hatch sealed on Thursday 15 (day 1); a condensation problem on
day 3; a water recovery shortfall on Monday 19 (day 5) that costs a rationing decision; dust on
the panel and eleven per cent of the power on day 6; the midpoint on Wednesday 21 (day 7 — six
done, six to go, the hand audit and the longest window); a hard day 8 with CO₂ in the sleep period
and a seal that fails a second time; the membrane replaced and the allowance restored on day 9; the
first harvest on Saturday 24 (day 10), the night the clocks go back; a twenty-five-hour day 11
with the consumables projection; packing on day 12; and the final count, the last window and the
hatch open at 21:00 on Tuesday 27 (day 13). Change any of it in the files or on the tabs in
mission control.

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
written as one: every blog box in mission control is a composer that shows the entry as it
will be read — a column of paragraphs and pictures with a rule between every two carrying
**＋ text · ＋ photo / video · ＋ sound**. Press the one you want where it belongs (or drop a
file onto the entry) and it goes in there, uploads on the spot with a progress bar, shows its
preview in place, and can be captioned or moved up or down without leaving the box. **✕ on a
picture deletes it** from the entry and from the station — the blog, the Media page, the
downloads — at once; the file itself is kept in the archive volume as *withdrawn*. Underneath,
the editor keeps the same plain text the
station stores — paragraphs with `[media:12]` lines — in sync in the form, so the file in
`content/` stays readable and editable by hand, and without JavaScript the box is still a
textarea with a file picker. The files go into the media archive under that officer and day, so
they are also in the gallery, the exports and the ZIP. Full guide in `content/README.md`.

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
archive; the seed removes any others.

## Media out of the habitat

The crew send photographs, video and sound out from inside their blog entries: in the
officer's **Daily Blog** in mission control, press ＋ photo / video or ＋ sound where it belongs
in the entry. Each file goes up on its own request with a progress bar, and
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

Accepted: jpg, png, gif, webp, avif, heic, tif · mp4, m4v, mov, webm, mkv · mp3, m4a, aac, wav,
ogg, flac · pdf, txt, md, csv, json. Anything else is refused rather than stored as a mystery.
`MEDIA_MAX_MB` (default 4096) caps a single file. A format the visitor's browser cannot play in
the page (HEIC, some MOV) is still whole and downloadable — the page says so.

`bash tools/backup.sh` copies the media folder along with the database.

## Where the readings start

The external node (critical-sensors.de) hands back its last thirty days on every poll. The
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

The real devices inside the habitat — a smart plug's energy meter, a temperature sensor,
more as they are installed — hang off a Home Assistant instance on the venue network. The
station server polls its REST API and draws them on the landing page as **Habitat
hardware**, a panel directly below the Habitat panel: one tile per device with the current
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
- **How often** — `HA_POLL_MS` (default 60000); `HA_POLL=false` holds the bridge off
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
| `node/` | every poll of the external sensor node — the readings that poll added (the node repeats its whole last thirty days each time; only what the station did not already hold is written), with the counts of what came back, what was a duplicate and what was before the floor; a failed poll is a file too, with the error |
| `home-assistant/` | every poll of the habitat's hardware — every entity as returned, whether or not it changed, plus history rows fetched |
| `ingest/` | every batch posted to `/api/sensors/ingest`, as posted |
| `resources/`, `figures/` | the stores and the crew's figures, each time they change |
| `daily/` | each day's habitat summary as it is sealed |

All of it downloads from mission control: **`/archive/readings.zip`** is the whole log with
`index.json` and a `README.txt`, and inside it `csv/` holds the same log flattened for a
spreadsheet — `home-assistant.csv` (one row per entity per poll), `ingest.csv` (one row per
reading posted), `node-polls.csv` (one row per poll of the node) and `node.csv` (one row per
reading the node ever sent, with the poll that brought it in). Each
table is also on its own at **`/archive/readings/<name>.csv`**, and `/archive/readings.json`
lists every file. The tables are built from the JSON files on request and add nothing the
files do not hold.

---

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

- the schedule as it was actually run, with each task's final status
- the meal plan, with energy, water and preparation cost
- the inventory at the close of the day
- every crew entry the crew wrote that day
- every crew state filed by mission control, with times
- a summary of every habitat channel — low, high, mean, sample count
- every published exchange, with the real light-time it crossed that day
- how many messages were sent from Earth, and by how many callsigns

Raw sensor readings are kept as well; the rollup exists so the record does not depend on
re-scanning a hundred thousand rows, or on those rows surviving a future cleanup. Nothing
that has been publicly visible is ever hard-deleted.

### The record, as one document

**Download full record (PDF)** — at the top of mission control, on the archive contents page,
and at `/archive/export.pdf` — hands over the whole mission as a single PDF, bookmarked by
section and by day, with a contents page. In order: the mission (crew, what was carried in,
the monitored channels, the distance); **Trends** — every store's level and daily use, the
meals' cost, the crew's calories and steps, every habitat channel with its daily low–high
band, the external sensor node, the crew's mood and energy, and what happened each day, on
one thirteen-day axis, planned days dashed; **Daily usage** — every store on every day,
quantity at close, use, used since start, days left at that draw, filed or carried; then
**each day whole** — the schedule with every task's final status, the meals with their cost
and the day's totals, the inventory at the close, the mission notes, the crew log with
**every photograph set in the entry it was sent with** and every video, sound file and
document listed with its poster frame, size, duration and hash, the science findings and
health activities, every state filed with the sentence it became, every exchange with its
reply and the real light-time it crossed, what was sent out that day and the habitat
summary; then **the crew log, whole** — every blog entry in full, day by day and officer by
officer, held entries included and marked; **the complete correspondence** — every message that ever reached the
station, published, rejected or still waiting, in the order it was sent; the **media index**
with every file's SHA-256, checkable against the ZIP with `sha256sum`; and the **audit
trail**. `/archive/day/:n/export.pdf` does one day.

The PDF is composed by the station itself — `src/lib/pdf.js` is a dependency-free PDF
writer in the spirit of the ZIP writer, with the standard Helvetica and Courier that every
reader has built in, so nothing is embedded and nothing is fetched — and it takes well
under a second for a full run. Photographs go in as the preview the browser made at upload
(a JPEG whatever the original was), so the document stays a few megabytes; the originals,
byte for byte, are in the media ZIP. A PNG with no preview is decoded and stored losslessly.
The one thing it cannot do is show characters outside WinAnsi, so `✧` and `CO₂` become
`·` and `CO2`.

### The record, readable

`/archive/export.md` hands over the whole mission as plain Markdown: every day with its
schedule, its meals and their cost, the inventory table with days-remaining, everything the
crew wrote, every state filed for them with the sentences it produced, every exchange with its
reply and the real time it took to cross, the mission notes and a habitat summary. In order,
nothing summarised away. It opens in any text editor, prints without a stylesheet, and still
makes sense with nothing left to render it — which matters for a record that is part of the
artwork. `/archive/day/:n/export.md` does one day. JSON is still there for machines.

**The archive belongs to mission control.** Everything under `/archive`, including the
download, requires the control session; the public station carries no link to it. A visitor
sees the exchange on the mission page and the crew's writing in the logbook. The complete
day-by-day record — crew states, habitat summaries, rejected traffic, the lot — is yours.
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

The landing page opens on the **Mars!platz** wordmark on the grey ground, one line beneath it,
and the station's readings as a row of pills on the right; there is no photograph and no black
rail. (`public/hero.jpg` is no longer referenced and can be deleted.) Below the wordmark, About ·
What this is · Who we are sit as a row of three folds, closed until asked. The landing page
carries no top bar; its navigation lives in the dark footer slab. Subpages keep the status rail
and **Mission · Messages · Crew log · About**.

Across the very top runs **the ticker**: an orange cell with the habitat's clock (venue time,
ticking), then a continuously running line — the SOL, **what the crew are currently doing**
(the schedule task whose time it is, with its detail — "14:00 · Maintenance — West panel seal,
third attempt" — switching to the next as its time comes), what is next, the node's current
reading (or *no current reading*), and the one-way signal time. Every hour it fetches the
day's schedule again from `/api/ticker`, so an edit made in mission control — or midnight
turning to a new day — reaches every open phone without a reload. It scrolls like a wire
ticker, holds while hovered, and stands still under reduced motion.

Below that the page is two things. **The landing fold**: the composer device and the
message-board screen beside it. **The mission dashboard**: everything else, on the lower band,
in one view — a row of headline figures, the run as a strip of thirteen days, then Today's Schedule ·
Meal · Mood, the Habitat with its sensor tiles, the resource rings and the trend charts, then
the crew log and the whole mission. Nothing sits behind a tab.

During pre-launch the readings show the countdown in place of the mission day and the day rail
and strip carry no marker.

## The board

The board beside the composer holds the whole correspondence: every published exchange in one
scrollable field, with tag chips that filter it — press `PERSONAL` and the field shows only
those — and a **MY MESSAGES** chip that shows your own, including the ones still waiting on the
crew. The counts are live.

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
the real light-time it crossed, the distance in au, and a `Ref 00042` permalink. The same card
is used on the landing page, in the archive and in the crew logbook, so one component defines
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
cookie (`mcs_lang`, a year, like the theme), resolved on the server, and applied to the
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
2. Change `ADMIN_PASSWORD`, `SENSOR_TOKEN` and `IP_SALT`.
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

Back it up with the script, which uses SQLite's own backup API — a plain `cp` of a live
WAL database can produce a corrupt copy:

```bash
bash tools/backup.sh --docker      # or: npm run backup
```

`/control/export/archive.json` downloads every published exchange with its callsign, tags,
timestamps and the real light-time it crossed. Worth taking at the end of each performance
week and keeping off the venue machine.

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
  routes/control.js      all admin write paths
  routes/media.js        the public media pages and downloads
  views/                 server-rendered templates
public/                  stylesheet + the page scripts (board, composer, habitat, media, entry editor)
tools/                   sensor simulator, backup script, media verifier, end-to-end test
```
