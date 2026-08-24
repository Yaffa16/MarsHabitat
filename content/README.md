# Editing the mission

Everything in this folder is live content. Open a file, change it, save it — the site updates
within about two seconds. No restart, no rebuild, no sign-in.

If the station is running in Docker, this folder is mounted into the container, so editing it
on your machine changes the running site.

## The files

| File | What it holds |
|---|---|
| `crew-and-inventory.json` | Crew designations and roles; the resources the habitat tracks, with their starting amounts |
| `schedule.json` | The daily task schedule, one block per mission day |
| `meals.json` | Breakfast, lunch, dinner and rations per day, with their energy, water and power cost |
| `inventory-levels.json` | How much of each resource is left at the end of each day |
| `logbook.json` | The crew's diary entries, by day and by crew member |
| `notes.json` | Mission notes, science findings, health activities, anomalies and broadcasts |
| `sensors.json` | The channels the habitat monitors, with units and thresholds |
| `templates.json` | Report templates offered as buttons in mission control |

Any key starting with an underscore — `_note`, `_why` — is ignored by the station. Use them to
leave yourself reminders.

## Two ways to edit

These files are also what the officer and habitat tabs in mission control write to. Filing a science update in the interface appends to `notes.json`; saving an
inventory level writes `inventory-levels.json`. There is no second copy — the interface and
this folder are edits to the same thing, so use whichever suits the moment.

## The daily routine during the run

Most days you will touch two files:

1. **`inventory-levels.json`** — record what was actually used. You only need to write the
   items that changed; everything else carries forward automatically from the previous day
   minus its daily draw. A normal day needs no entry at all.
2. **`notes.json`** — add anything that happened which was not on the schedule.

The three officers are the **communication officer**, the **science officer** and the **health
officer**. Renaming or replacing one in `crew-and-inventory.json` takes effect immediately —
an officer removed from that file leaves the station along with their states and entries, so a
rename is a real change, not a relabel.

The crew's diary entries are written from each officer's tab in mission control, which saves
into `logbook.json` — the same file you can edit here. Whichever was saved last is the record.
Entries for days that have not happened yet are kept out of public view until the day arrives,
so you can draft ahead here safely.

## If you break something

The station keeps serving the last version that worked and tells you what went wrong — in the
terminal it is running in, on the mission control screen, and at `/api/content`. A missing
comma reports the file and the line.

Nothing is lost. Fix the file, save it again, and it reloads.

## Rules worth knowing

- Day numbers are strings: `"1"`, `"2"`, and so on up to the length of the mission. Days past
  the end of the run are ignored with a warning.
- Meal slots must be `BREAKFAST`, `LUNCH`, `DINNER` or `RATION`.
- Inventory keys in `inventory-levels.json` must match a `key` in `crew-and-inventory.json`.
- Removing an item from `crew-and-inventory.json` removes it from the site.
- Note kinds are `LOG`, `ANOMALY` or `BROADCAST`.
- Use `\n` inside a string for a line break — in diary entries, a blank line between paragraphs
  is `\n\n`.

## Applying changes by hand

The watcher normally does this for you. If you have edited the files while the station was
stopped, or you want to force a reload:

```bash
npm run content
```
