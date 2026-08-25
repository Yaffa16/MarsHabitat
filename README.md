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

Two hundred checks covering the whole lifecycle — visitor identity, transmission, the transit lock,
arrival, approval, the empty-response guard, publication, sensor ingest, unknown-metric
registration, mood filing and translation, live broadcast, role enforcement in both
directions, concurrent-edit refusal, CSV import and export round-trip, archive export, the
drift chart, a check that no raw mood value ever reaches a public page, the crew logbook
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
| The station | `/` | Composer and orbital plot · the live message board · daily mission (plan, meals, resources, figures, **the whole mission**) · habitat dashboard · resources · **crew** · **crew log** · **about** (the project, how the station behaves, who we are) |
| Mission control | `/control` | Six tabs: **Messages** (the reply queue) first, then one per officer, the habitat, and the crew log |
| Crew log | `/logbook` | All thirteen days in order, each officer's entry where written and its placeholder where not — a day strip to jump by, a chip per voice. Opened from the Crew log panel on the station, and from the nav |
| Media | `/media` | Everything the crew send out — photographs, video, sound — by day, with filters; `/media/:id` one item; `/media/export.zip` everything as one ZIP; `/media/manifest.json` every file with its SHA-256 |
| Archive | `/archive` | **Mission control only.** Day-by-day permanent record; `/archive/day/:n`, `/archive/messages`, `/archive/export.md`, `/archive/export.json` |

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
| **Habitat** | The daily schedule, the daily food plan, and the inventory levels |

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
| `logbook.json` | The crew's diary entries, by day and crew member |
| `notes.json` | Mission notes, science findings, health activities, anomalies and broadcasts |
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

Type is a heavy grotesque for the wordmark and headings (`Helvetica Neue`, `Helvetica`,
`Inter`) against monospace for every code, label and value, with the same sans for reading
prose. All system stacks: nothing is fetched from a CDN, so the station looks right with the
venue's network unplugged.

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

Two axes, not four: **Mood** (settled ↔ strained) and **Energy** (rested ↔ spent). Four was
more resolution than anyone can honestly report at the end of a working day, and these were
the two that carried the signal. The database columns are unchanged, so states filed under the
older four-axis scheme still read correctly.

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
  lib/mood.js            the only place slider values become language
  lib/data.js            queries, sensor evaluation, transit settlement
  lib/callsign.js        visitor identity
  lib/media.js           the media archive: hashed files, manifest, verify
  lib/zip.js             dependency-free streaming ZIP writer (Zip64)
  routes/control.js      all admin write paths
  routes/media.js        the public media pages and downloads
  views/                 server-rendered templates
public/                  stylesheet + the page scripts (board, composer, habitat, media, entry editor)
tools/                   sensor simulator, backup script, media verifier, end-to-end test
```
