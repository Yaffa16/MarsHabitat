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

| Area | Route | Notes |
|---|---|---|
| Mission | `/` | Composer, recent exchanges, daily mission, resources, crew, habitat, mission state |
| Messages | `/messages` | Every published exchange, scrollable, filterable by tag |
| Crew | `/crew` | Captain, science officer, communication officer |
| Logbook | `/logbook` | Daily entries written by the crew themselves |
| Daily mission | `/day`, `/day/:n` | Tasks, meals, inventory, notes, that day's crew entries |
| Archive | `/archive` | **Mission control only.** Day-by-day permanent record |
| — day record | `/archive/day/:n` | One day complete: schedule, meals, inventory, crew entries, habitat, exchanges |
| — exchanges | `/archive/messages` | Every published message, filterable |
| — export | `/archive/export.json` | The entire mission as one file |
| Whole mission | `/schedule` | Every day of the run on one page, public |
| What this is | `/what` | How the station behaves, in plain terms |
| About | `/about` | The project, the habitat, the concept |
| Who we are | `/who-we-are` | Crew, company, production credits |

Mission control is organised **by officer**, not by kind of record — whoever is at the desk
moves through three people rather than through five kinds of form.

| Tab | Holds |
|---|---|
| **Communication officer** | **The daily mission schedule**, mood, daily blog — then the message queue at the foot. |
| **Science officer** | Daily science findings, mood, daily blog. |
| **Health officer** | Daily health activities, **crew figures** (calories and steps), **the daily food plan**, mood, daily blog. |
| **Habitat** | Inventory levels, the general daily update, anomalies and broadcasts. |

Messages sit under the communication officer because answering Earth is that officer's job.
Each officer tab has a day picker, so you can work back through the run.

**Reviewing and replying are a single interaction.** There is no approve step: a message
arrives, you read it, you write the answer and you send it. Approving separately only ever
produced a queue of half-finished exchanges nobody came back to. Saving without publishing is
still there as a secondary action for when a reply needs thinking about.

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

**The terminal beats the file.** Diary entries in `logbook.json` are what the crew go in with.
The moment a performer types over one at `/log`, that day belongs to them and no file edit can
reclaim it. So you can draft ahead safely. Full guide in `content/README.md`.

## Who writes what

Two kinds of content, with a hard line between them.

**Preset, and edited in files.** The daily schedule, the meal plan and the inventory live in
`content/` and are prepared in advance for all nine days. Nothing the crew do changes them.

**Written daily, and owned by the crew.** The communication, science and health officers each
file their own diary entry from a terminal inside the habitat at
**`/log`** — one login each, one entry per person per mission day. Entries go straight to the
public logbook, and appear on that day's page and on the crew page.

The terminal is deliberately one screen: the entry box, that day's preset schedule and meals
for context, and everything that crew member has written before. A performer coming off a
task can sit down and write without navigating anything. Sessions last 30 days, because
nobody sealed in a habitat should be signing in twice a day. It warns before losing unsaved
text — an interrupted performer losing a day's writing to a stray tap would be the worst
failure in the system.

Mission control can **hold** an entry back from the public logbook at `/control/logbook` — if
it names a member of the audience, say — and release it again. It cannot rewrite one: there
is no editing surface for crew text anywhere in mission control, and a held entry still shows
to its author, marked as held. The crew's words stay the crew's words.

**There is exactly one account.** It signs in to mission control at `/control` and to the
habitat terminal at `/log`; the seed removes any others. Who is writing at the terminal is
chosen on the screen rather than by signing in as them — three performers sharing one tablet
inside a habitat should not be juggling three passphrases, and switching is one tap.

Because mission control is messages only, the crew now file their own state from the terminal
too: four sliders under the entry box, with the exact public sentence shown beneath each one.
The numbers are still never published.

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
thresholds afterwards in `/control/sensors`. No redeploy, no schema change.

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
- every crew entry written from the habitat terminal
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
- the habitat terminal gives the crew a full-width button and a 220px writing area
- there is a print stylesheet, because the archive is the artwork and somebody will
  eventually want it on paper

## Visual language

Industrial label sheets. Light ground, black hairlines, one safety orange — the whole system
looks stamped, catalogued and referenced, which is what this station actually does to every
message that passes through it.

The devices are working parts, not decoration:

- **Hatch bands** mark the two things you are meant to act on: the composer and the crew's own
  panels. Nothing else gets one.
- **Bracketed codes** (`[ MCS-001 ]`, `[ 24 PUBLISHED ]`) carry live counts in the sheet's own
  register.
- **Channel tags** stamp every panel with the data channel it renders — `CH-09 / UPLINK`,
  `CH-32 / GALLEY`.
- **Crossed boxes** are the empty state, borrowed from the placeholder rectangles on the sheet.
  An empty panel reads as a blank field waiting to be filled rather than as a failure.
- **Registration crosshair** replaces the Sun on the orbital plot — the same mark a print sheet
  uses to align itself.
- Buttons and cards **cast a hard offset shadow** on hover, the way a die-cut label lifts off
  the page.

Orange is the only colour. It marks Mars, live state, and anything wanting action. Status is
still carried by **symbol** as well — filled centre is nominal, single bar is caution, crossed
ring is out of range, empty ring is no signal — so it survives print and colourblindness.

Type is a bold condensed grotesque for headlines (`Archivo Narrow`, `Roboto Condensed`,
`Arial Narrow`) against monospace for every code, label and value, with a plain sans for
reading prose. All system stacks: nothing is fetched from a CDN, so the station looks right
with the venue's network unplugged.

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

`/schedule` shows every day of the run on one page — past days marked complete, today marked,
days ahead shown as planned and dimmed. It answers "what is this run", which is a different
question from "what is happening now" and the one a visitor arriving cold actually has. Linked
from the daily-mission section on the mission page and from the footer.

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

The landing page is the MARS!PLATZ layout. It opens on a full-bleed photograph of the surface —
**`public/hero.jpg`**, swap the file to change the view — with the title, the tagline and the
mission day stamped over it, and the black status rail directly beneath, sticking to the top of
the window once the photograph has scrolled away. The landing page carries no top bar; its
navigation lives in the black footer. Subpages keep **Mission · Messages · Crew log · About**.

Below the masthead:

1. **Communication Portal** — the composer with the orbital plot beside it
2. **Message Board** — every published exchange as a staggered column that scrolls in its own
   field next to the composer, linking through to the Messages tab
3. **Daily mission** — one panel with pill tabs: daily plan, meal plan, resources and
   crew figures
4. **Habitat** — every channel as a dial, with the status key, and the crew with their
   condition beside them
5. **Resources** — the inventory gauges as one strip, carried in and never resupplied

During pre-launch the masthead shows the countdown in place of the mission day. The composer
lost its decorative FROM/TO fields — the callsign line above it already says who you are.

## The messages tab

`/messages` holds the whole correspondence: every published exchange in one scrollable field,
with a tag distribution at the top that doubles as a filter — press `PERSONAL` and the field
shows only those. The counts are live, so it also reads as a summary of what people actually
wanted to know.

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

Light is the default, matching the reference. The toggle sits at the right of the status rail
and is remembered in a cookie, resolved on the server and applied to `<html>` before first
paint — no flash of the wrong ground on load. Dark inverts the stock to near-black and keeps
the same orange, hairline weights and hatch geometry.

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
5. Fill in all nine days at `/control/days`. They ship as **drafts** holding placeholder
   template content, and a draft day shows the public *"day content not yet transmitted"*
   rather than a half-filled schedule — so nothing is visible until you mark each one
   **ready**. Nine days is small enough to do by hand; **Copy tasks + meals to…** handles
   any repeating rhythm.
6. Walk each performer through `/log` once. They will be writing in costume, in character,
   possibly tired — the terminal should be familiar before opening night, not discovered
   during it.
7. Rehearse the full loop with the performers: send a message from a phone, approve it,
   write a reply, publish it, watch it reach the board.

### Filling forty days quickly

`/control/import` takes pasted CSV, which is faster than any form for bulk entry:

```
day,time,label,detail
17,08:00,Habitat inspection,Seals and west wall

day,slot,name,components,kcal,water_litres,prep_minutes,energy_wh
17,BREAKFAST,Rehydrated oats,"Oat base | 80 g\nWater | 0.35 L",420,0.35,8,90
```

Tasks are appended to whatever is already on the day; meals replace the matching slot. Export
the current content from the same page to get a correctly-shaped file to edit in a
spreadsheet and paste back. Malformed rows are skipped and counted rather than aborting the
import. Inside the day editor, **Copy tasks + meals to…** handles a repeating weekly rhythm.

`/control/live` is deliberately the last screen to finalise. Which controls people actually
reach for while standing in a dark room next to a performance is never quite what you would
predict — run a technical rehearsal, then cut what nobody touched.

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
