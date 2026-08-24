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

The station is configured for the actual run: **19–27 October 2026, nine days,
Europe/Berlin**. Until 19 October it comes up in its pre-launch state.

### Seeing it full before the sensors exist

```bash
MISSION_START=$(date -d "-4 days" +%F) MISSION_END=$(date -d "+4 days" +%F) npm run seed
npm run demo      # plausible habitat readings for every mission day so far
npm start
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

120 checks covering the whole lifecycle — visitor identity, transmission, the transit lock,
arrival, approval, the empty-response guard, publication, sensor ingest, unknown-metric
registration, mood filing and translation, live broadcast, role enforcement in both
directions, concurrent-edit refusal, CSV import and export round-trip, archive export, the
drift chart, a check that no raw mood value ever reaches a public page, the crew logbook
end to end (sign-in, filing, same-day editing, hold and release, and that mission control has
no way to rewrite crew text), and phase and T-clock exactness across the 25 October DST
change, that the composer precedes the habitat data in the page order, that the day record
and the full export carry every strand, and that no admin table can clip on a phone.

The suite needs a live mission, so it overrides the October dates with a window around today.

---

## What's in it

**Two pages.** The public station is one page; mission control is one page. The archive,
which is mission control's, sits behind the same login.

| Page | Route | Holds |
|---|---|---|
| The station | `/` | Composer and orbital plot · the live message board · daily mission (plan, meals, resources, figures, **the whole mission**) · habitat dashboard · resources · **crew** · **crew log** · **about** (the project, how the station behaves, who we are) |
| Mission control | `/control` | **The reply queue at the top**, then the day's work in four tabs |
| Archive | `/archive` | **Mission control only.** Day-by-day permanent record; `/archive/day/:n`, `/archive/messages`, `/archive/export.md`, `/archive/export.json` |

Every address the public subpages used to have (`/messages`, `/crew`, `/logbook`, `/day`,
`/schedule`, `/what`, `/about`, `/who-we-are`) redirects to its section on the landing page, so
old links and printed material still land somewhere. The footer of the landing page is the
navigation.

### Mission control

Messages come first: the queue is the top of the page, because answering Earth is the job
that cannot wait. Each message has its reply box directly beneath it and one orange button.
**Ctrl+Enter** (Cmd+Enter on a Mac) in the box sends and publishes. Saving a draft, rejecting
and deleting are on the same row, quieter. A message arriving while the desk is open is
announced in a banner rather than discovered on the next reload — the page polls a count and
never rebuilds itself under someone mid-reply.

Beneath the queue, **the day's work**: a day picker, then four tabs that switch without a page
load. Everything editable lives here.

| Tab | Holds |
|---|---|
| **Communication officer** | The daily mission schedule, the officer's state, their daily blog |
| **Science officer** | Daily science findings, state, blog |
| **Health officer** | Daily health activities, **crew figures** (calories and steps), **the daily food plan**, state, blog |
| **Habitat** | Inventory levels, the general daily update, anomalies and broadcasts |

A save returns you to the tab and day you were on; a reply returns you to the queue in the
view you were looking at. `/control/science`, `/control/health` and `/control/habitat` still
work as addresses — they open the page on that tab.

**Reviewing and replying are a single interaction.** There is no approve step: a message
arrives, you read it, you write the answer and you send it. Until it is answered the message is
visible only to its sender, under **MY MESSAGES** on the board; the common board carries nothing
that has not been published. Saving without publishing is still there as a secondary action.

**The board is live.** The landing page polls `/api/board` every few seconds and swaps in
changes, so a reply published from control appears on every open phone without a reload.

**The day-content tabs write back into `content/`.** Filing a science update appends to
`notes.json`; saving an inventory level writes `inventory-levels.json`; writing a blog writes
`logbook.json`. The interface and the files are edits to the same thing rather than two copies
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
| `templates.json` | Report templates offered in mission control |

It ships with all nine days written: 72 scheduled tasks, 28 meals, nine tracked resources with
a full depletion curve, 27 diary entries in three distinct voices, and the mission notes that
go with them. It is a complete run out of the box — a habitat that develops a condensation
problem on day 3, a water recovery shortfall on day 4 that costs a rationing decision, a hard
day 6, and a first harvest on day 7.

**Inventory carries forward.** You only write the items that changed on a given day; everything
else inherits yesterday's closing figure minus its daily draw. A normal day needs no entry.

**Errors never take the site down.** A stray comma leaves the last good version serving and
reports the file and line number — in the console, on the mission control screen, and at
`/api/content`.

**Draft ahead safely.** Diary entries in `logbook.json` are what the crew go in with. Entries
for days that have not happened yet stay out of public view until the day arrives. The blog
box on each officer's tab in mission control writes into the same file, so whichever was saved
last — the file or the form — is the record. Full guide in `content/README.md`.

## Who writes what

Two kinds of content, with a hard line between them.

**Preset, and edited in files.** The daily schedule, the meal plan and the inventory live in
`content/` and are prepared in advance for all nine days. They can also be edited on the
matching tab of mission control, which writes into the same files.

**Written daily, in the crew's voice.** The communication, science and health officers each
have a daily blog entry and a state (mood and energy, two sliders). Both are filed from their
tab in mission control — there is no separate terminal inside the habitat, and no second
login. Entries go straight to the public crew log on the landing page, and the latest one
appears under each officer in the Crew section. The slider numbers are never published; only
the sentence each one maps to.

**There is exactly one account.** It signs in to mission control at `/control` and opens the
archive; the seed removes any others.

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
- **The board is a screen.** Dark glass beside the composer: callsigns in orange, the crew's
  replies in orange with a `✧`, an orange scrollbar, the counts in the foot. Its filter chips
  sit above it on the ground.
- **The crossing is a dial.** Pressing transmit lifts the device and swaps the form for a bezel
  with four screws round a dark gridded face: Earth at the foot, Mars at the head, the message
  travelling the arc between them while `T−mm:ss` counts down beside it.
- **The station's name** is spelled letter by letter down the left margin; the run's nine days
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

## Report templates

Each reporting box in mission control carries a row of template buttons. Pressing one drops a
skeleton into the field — a sample batch, a daily crew check, an anomaly report — so a report
starts from a shape rather than a blank box at the end of a long day. If the box already has
text in it, it asks before replacing.

Templates live in **`content/templates.json`**, keyed by `SCIENCE`, `HEALTH`, `UPDATE`,
`ANOMALY` and `BLOG`.

A template named **`Default`** is written straight into the empty box and is *not* offered as a
button — it is simply what the form starts as. Any other template appears as a button that
swaps the box's contents. A kind whose only entry is `Default` therefore shows no buttons at
all, which is how the health report is set up: it opens with the morning workout, the evening
wellbeing activity and other reporting, and nothing to choose between. They are read on every request rather than loaded into the database, so
an edit is live the moment the file is saved. Rewrite them to match how the crew actually
work — a template that fights the person using it gets ignored by day three.

## Inventory on the landing page

The habitat's resources are drawn as a row of gauges under the exchange feed: a fill bar of
what is left against what was carried in, the figure in its own unit, the percentage remaining,
and — the number that actually decides things inside a closed volume — **days remaining at the
current draw**. Anything under its warning threshold turns orange.

Everything in the habitat was carried in and nothing is resupplied, so over nine days the row
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

## Report templates

Mission control offers templates above each report field. Pressing one drops a skeleton into an
empty box — *Measurement*, *Sample batch*, *Greenhouse*, *Experiment report* and *System
behaviour* for science; *Morning check*, *Evening check*, *Full crew readings* and *Incident*
for health; *Day summary* and *Twice-daily readings* for the general update; an *Anomaly
report*; and two shapes for the daily blog.

They only fill an empty field, and a press over existing text asks first — nobody should lose
half an entry to a stray tap at the end of a long day. They are prompts rather than schemas:
nothing validates against them, and they live in `content/templates.json` where you can rewrite
them between shows.

## The mission page

The landing page opens on **the console**: a black instrument on the pale ground, with the
orange **Marsplatz** plate down its left. Across the top, the project in three lines and one
sentence, the About · What this is · Who we are buttons (they open their text over the message
box), and the tags as white pills. Beneath, the readings in one line. In the middle, **the
message box**: white and small, your avatar over its top edge, your thread with the crew inside
— what you sent, when, and what they wrote back — and the line you type on across its foot with
the red SEND. Under it, two black cards: the ZKM | Hertzlab mark, and the Earth → Mars scene,
which carries the message across while it is in transit ("Sending message to Mars…") and reads
the one-way time otherwise. Standing in the right edge is **the messages panel**: every
exchange with an avatar, the callsign, when it was sent, the message, the crew's reply nested
beneath, the state at the foot; filters and counts along the bottom.

Below the console the page is the **mission dashboard** on the lighter band: a row of headline
figures, the run as a strip of nine days, then Today's Schedule · Meal · Mood, the Habitat with
its sensor tiles, the resource rings and the trend charts, then the crew log and the whole
mission. Nothing sits behind a tab.

During pre-launch the readings show the countdown in place of the mission day and the day
strip carries no marker.

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

**Before 19 October — pre-launch.** The site runs in full: the same landing page, live
sensor readings, crew reports, the board and the archive. Only two things differ. Where the
mission-day readout will sit, there is a ticking countdown to habitat occupation. And the
composer carries a line saying the habitat is not occupied yet, so anything written now
waits for the crew — those messages are stamped **day 000** and stay distinguishable in the
archive forever.

If you would rather hold the channel shut until the crew are actually inside, set
`HOLD_CHANNEL_BEFORE_LAUNCH=true`. The rest of the site stays visible either way; only the
composer closes, and the block is enforced server-side so the form cannot be posted around.

**19–27 October — active.** The countdown becomes the mission day.

**After 27 October — complete.** The landing page reports what the station carried:
exchanges published, messages sent, callsigns issued. The channel closes. The board and the
archive stay exactly where they are, because they are the work.

To preview a phase without waiting, run with different dates:

```bash
MISSION_START=2026-08-12 MISSION_END=2026-08-20 npm run seed && npm start
```

## The gap during this run

Earth and Mars are **closing** throughout, which the interface shows live:

| | Distance | One-way signal |
|---|---|---|
| Opening night, 19 Oct | 1.531 au · 229 M km | 12 min 44 s |
| Midpoint, 23 Oct | 1.500 au · 224 M km | 12 min 29 s |
| Final day, 27 Oct | 1.469 au · 220 M km | 12 min 13 s |

Round trip on opening night is 25 min 28 s. The gap shrinks about 9.3 million km across the
nine days, and the planets visibly move on the orbital plot. Every message stores the real
light-time it crossed, so the archive records the run getting fractionally faster.

## Two decisions worth knowing about

**The mission day comes from the venue timezone.** Set `MISSION_TZ`. A visitor in Auckland
sees the same mission day as the performers, so the daily content never desynchronises from
what is actually happening in the room.

Both the mission day and the T-clock are anchored to 00:00 *Berlin* on 19 October — that is
22:00 UTC on 18 October, not UTC midnight. **Berlin leaves summer time on 25 October, in the
middle of this run.** The clock absorbs that: the elapsed day count follows the mission day
and the time follows the venue wall clock, so `T+008:23:59` is the last minute of day 9
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

1. Confirm `MISSION_START=2026-10-19`, `MISSION_END=2026-10-27`, `MISSION_TZ=Europe/Berlin`.
2. Change `ADMIN_PASSWORD`, `SENSOR_TOKEN` and `IP_SALT`.
3. Set `SECURE_COOKIES=true` if serving over HTTPS.
4. Replace the placeholder credits in `src/views/pages/info.js` (`CREDITS`, production and
   contact blocks on `/who-we-are`).
5. Check all nine days on the landing page's **whole mission** fold. They ship fully written
   in `content/`; edit the files or the matching tab in mission control.
6. Walk whoever will sit at mission control through `/control` once: the queue, Ctrl+Enter,
   the day picker and the tabs. It should be familiar before opening night, not discovered
   during it.
7. Rehearse the full loop: send a message from a phone, watch it appear under MY MESSAGES,
   reply from control, watch it reach the board on every phone in the room without a reload.

---

## Data and privacy

Stored: callsign, message text, tags, timestamps, and a truncated one-way hash of the IP
address used only for rate limiting. No analytics, no external requests, no tracking. The
SQLite database lives in the `station-data` volume at `/data`.

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
  routes/control.js      all admin write paths
  views/                 server-rendered templates
public/                  stylesheet + two small scripts
tools/                   sensor simulator, backup script, end-to-end test
```
