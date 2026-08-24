#!/usr/bin/env bash
# End-to-end check of the whole station.
set -u
cd "$(dirname "$0")/.."

export TRANSIT_SECONDS=${TRANSIT_SECONDS:-3}
export SENSOR_TOKEN=${SENSOR_TOKEN:-test-token}
# The suite needs a running mission; the real dates are in October. It also
# builds its own database in a temp directory, so running the tests never
# touches the station's real data.
export CRITICAL_POLL=${CRITICAL_POLL:-false}   # keep the suite off the network
export MISSION_START=${MISSION_START:-$(date -u -d '-4 days' +%F)}
export MISSION_END=${MISSION_END:-$(date -u -d '+4 days' +%F)}
export ADMIN_PASSWORD=${ADMIN_PASSWORD:-control123}
export DATA_DIR=$(mktemp -d)
export CONTENT_DIR=$(mktemp -d)
cp content/*.json "$CONTENT_DIR"/
node src/db/seed.js > /dev/null 2>&1

node src/server.js > /tmp/srv.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null; rm -rf "$DATA_DIR" "$CONTENT_DIR"' EXIT
sleep 3

B=http://localhost:8080
V=/tmp/visitor.jar; A=/tmp/admin.jar; T=/tmp/theme.jar
rm -f $V $A $T
FAIL=0
ok()  { printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad() { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=1; }

echo "── visitor identity"
CS=$(curl -s -c $V -b $V $B/ | grep -oE '[A-Z]+-[0-9]{3}' | head -1)
[ -n "$CS" ] && ok "callsign issued on arrival: $CS" || bad "no callsign"

echo "── writing from the landing page"
curl -s $B/ | grep -q 'id="composer"' && ok "composer is on the landing page" || bad "no composer on landing"
node -e '
const h = require("child_process").execSync("curl -s http://localhost:8080/").toString();
const c = h.indexOf("id=\"composer\""), s = h.indexOf("CH-01");
process.exit(c > -1 && (s < 0 || c < s) ? 0 : 1);
' && ok "composer precedes the habitat data" || bad "communication is not the lead element"

curl -s -b $V -c $V -X POST --data-urlencode \
  "body=What is the first thing you miss about Earth?" -d "tags=QUESTION" -o /dev/null $B/communicate
curl -s -b $V $B/ | grep -qi "message in transit" && ok "message in transit, shown on landing" || bad "no transit view"

curl -s -b $V -X POST --data-urlencode "body=Should be blocked" -o /dev/null $B/communicate
N=$(curl -s $B/api/status | grep -oE '"total":[0-9]+' | cut -d: -f2)
[ "$N" = "1" ] && ok "transit lock holds server-side" || bad "transit lock failed (total=$N)"

sleep 4
curl -s $B/api/status | grep -q '"pending":1' && ok "arrived and queued for review" || bad "did not settle to pending"

echo "── one login"
curl -s -c $A -X POST -d "username=control" -d "password=${ADMIN_PASSWORD:-control123}" -o /dev/null $B/control/login
curl -s -b $A $B/control | grep -q "Awaiting review" && ok "control signed in" || bad "sign-in failed"
[ "$(curl -s -X POST -d 'username=captain' -d 'password=cap-pass' -o /dev/null -w '%{http_code}' $B/control/login)" = "401" ] \
  && ok "no second account exists" || bad "another login still works"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/log)" = "200" ] \
  && ok "the same account opens the habitat terminal" || bad "terminal rejects the control session"

echo "── mission control"
curl -s -b $A $B/control | grep -q 'class="filters"' && ok "message views filter in place" || bad "no filter bar"
for tab in science health habitat; do
  [ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/control/$tab)" = "200" ] \
    || bad "control tab /$tab missing"
done
ok "control has a tab per officer, plus the habitat"

COMMS=$(curl -s -b $A $B/control)
echo "$COMMS" | grep -q "CH-09 / MESSAGES" || bad "messages not under the communication officer"
echo "$COMMS" | grep -q "mood-slider" || bad "no mood on the communication officer tab"
echo "$COMMS" | grep -q "DAILY BLOG" || bad "no blog on the communication officer tab"
ok "communication officer has messages, mood and blog"

SCI=$(curl -s -b $A $B/control/science)
echo "$SCI" | grep -qi "science findings" || bad "no science findings on the science tab"
echo "$SCI" | grep -q "mood-slider" || bad "no mood on the science tab"
echo "$SCI" | grep -q "DAILY BLOG" || bad "no blog on the science tab"
ok "science officer has findings, mood and blog"

HEA=$(curl -s -b $A $B/control/health)
echo "$HEA" | grep -qi "health activities" || bad "no health activities on the health tab"
echo "$HEA" | grep -q "mood-slider" || bad "no mood on the health tab"
echo "$HEA" | grep -q "DAILY BLOG" || bad "no blog on the health tab"
ok "health officer has activities, mood and blog"

ID=$(curl -s -b $A $B/control | grep -oE '/control/[0-9]+/reply' | head -1 | grep -oE '[0-9]+')
[ -n "$ID" ] && ok "message waiting in the queue" || bad "no message in the queue"

curl -s -b $A -X POST -d "body=" -d "action=publish" -o /dev/null $B/control/$ID/reply
curl -s $B/ | grep -q 'card-reply' && bad "empty reply accepted" || ok "empty reply refused"

echo "── unapproved messages stay off the common board"
# Another visitor (no cookie) must not see the message until it is approved.
curl -s $B/ | grep -q "first thing you miss" && bad "unapproved message reached the common board" \
  || ok "an unapproved message is not on the common board"
curl -s $B/messages | grep -q "first thing you miss" && bad "unapproved message on the messages tab" \
  || ok "nor on the messages tab"
# The sender still sees it, stamped with its state and marked as theirs and pending.
MINE=$(curl -s -b $V $B/)
echo "$MINE" | grep -q "first thing you miss" && ok "the sender still sees their own message" \
  || bad "sender cannot see their own unapproved message"
echo "$MINE" | grep -q 'data-mine="1" data-pending="1"' && ok "it is marked as theirs and awaiting approval" \
  || bad "own pending message not stamped data-pending"
echo "$MINE" | grep -q 'REACHED MARS' && ok "its state is stamped on the card" || bad "no state on the sender's card"
echo "$MINE" | grep -q 'id="feed-mine-count">1<' && ok "MY MESSAGES counts one waiting" || bad "no waiting count on MY MESSAGES"
echo "$MINE" | grep -q 'id="feed-mine-note"' && ok "the sender is told it is visible only to them" || bad "no visible-only-to-you note"

curl -s -b $A -X POST --data-urlencode "body=Rain. Not the idea of it, the sound." \
  -d "action=publish" -o /dev/null $B/control/$ID/reply
ok "review and reply are a single action"
curl -s $B/ | grep -q "Rain. Not the idea of it" && ok "exchange published onto the landing page" || bad "not published"
curl -s $B/ | grep -q "first thing you miss" && ok "once approved, the message is on the common board" \
  || bad "approved message missing from the common board"
curl -s -b $V $B/ | grep -q 'data-pending="1"' && bad "sender's card still stamped pending after approval" \
  || ok "the sender's card is no longer pending"

echo "── the board is live"
curl -s $B/ | grep -q 'id="feed" data-poll="/api/board"' && ok "the board is wired to poll /api/board" || bad "no poll address on the board"
curl -s $B/ | grep -q 'data-version="[0-9a-f]\{16\}"' && ok "the page carries the board version it rendered" || bad "no board version on the page"
curl -s $B/ | grep -q 'id="feed-live"' && ok "a LIVE mark sits in the foot" || bad "no live mark"
API=$(curl -s -b $V $B/api/board)
echo "$API" | grep -q '"version":"[0-9a-f]\{16\}"' && ok "/api/board reports a version" || bad "no version from /api/board"
echo "$API" | grep -q 'Rain. Not the idea of it' && ok "/api/board carries the rendered cards" || bad "cards missing from /api/board"
echo "$API" | grep -q '"published":1' && ok "with the published count" || bad "no counts from /api/board"
PV=$(curl -s -b $V $B/ | grep -oE 'data-version="[0-9a-f]+"' | grep -oE '[0-9a-f]{16}')
AV=$(echo "$API" | grep -oE '"version":"[0-9a-f]+"' | grep -oE '[0-9a-f]{16}')
[ -n "$PV" ] && [ "$PV" = "$AV" ] && ok "page and API agree on the version" || bad "version differs between page ($PV) and API ($AV)"
curl -s $B/api/board | grep -q 'data-pending' && bad "another visitor's API view carries pending cards" \
  || ok "the API never hands one visitor another's unpublished message"
curl -s $B/ | grep -q 'class="cards"' && ok "exchanges render as a card grid" || bad "no card grid"
curl -s $B/messages | grep -q 'class="scroller tall"' \
  && ok "the messages tab scrolls in its own field" || bad "no scrollable message field"
curl -s $B/ | grep -q 'class="scroller feed"' \
  && ok "the message board scrolls beside the composer" || bad "no message-board column on the landing page"
curl -s $B/messages | grep -q 'class="composer"' \
  && bad "a composer is still on the messages tab" || ok "no composer on the messages tab"
curl -s $B/ | grep -qP 'All \d+ exchanges' && ok "landing links through to every exchange" || bad "no link to the messages tab"
[ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/board)" = "$B/messages" ] \
  && ok "/board redirects to the messages tab" || bad "/board redirect wrong"
curl -s -b $A $B/archive/messages | grep -q "$CS" && ok "searchable in the archive under $CS" || bad "missing from archive"
curl -s -b $V $B/ | grep -q 'id="composer"' && ok "composer returns after arrival" || bad "composer still locked"

echo "── control can delete"
curl -s -b $A -X POST -o /dev/null $B/control/$ID/delete
[ "$(curl -s -b $A $B/archive/messages | grep -c 'Rain. Not the idea of it')" = "0" ] \
  && ok "message deleted outright" || bad "delete did not remove the message"

echo "── tabs removed, landing carries both"
NAVBAR=$(curl -s $B/ | grep -oP '(?<=class="nav">).*?(?=</nav>)')
echo "$NAVBAR" | grep -q ">Write<" && bad "Write tab still present" || ok "Write tab removed"
echo "$NAVBAR" | grep -q ">Exchanges<" && bad "Exchanges tab still present" || ok "Exchanges tab removed"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/communicate)" = "301" ] \
  && ok "/communicate redirects to the landing composer" || bad "/communicate not redirected"
curl -s $B/ | grep -q 'id="exchanges"' && ok "exchange feed sits on the landing page" || bad "no exchange feed"

echo "── control writes back into the content files"
curl -s -b $A -X POST -d "day=2" -d "kind=SCIENCE" \
  --data-urlencode "body=Baseline established across twelve samples." -o /dev/null $B/control/updates
node -e '
const d=require(process.env.CONTENT_DIR+"/notes.json");
process.exit((d["2"]||[]).some(n=>n.kind==="SCIENCE")?0:1);' \
  && ok "a science update is written into notes.json" || bad "update not written to file"
curl -s $B/day/2 | grep -q "Baseline established" && ok "and is live on the site" || bad "update not live"

curl -s -b $A -X POST -d "day=2" -d "kind=HEALTH" \
  --data-urlencode "body=All three sleeping through the period." -o /dev/null $B/control/updates
curl -s $B/day/2 | grep -q "sleeping through" && ok "a health update files the same way" || bad "health update failed"

curl -s -b $A -X POST -d "day=2" -d "q_water=555" -d "c_water=20" -o /dev/null $B/control/inventory
node -e '
const d=require(process.env.CONTENT_DIR+"/inventory-levels.json");
process.exit(d["2"] && d["2"].water && d["2"].water.quantity===555?0:1);' \
  && ok "an inventory update is written into inventory-levels.json" || bad "inventory not written to file"
curl -s $B/day/2 | grep -q "555" && ok "and the gauges follow it" || bad "inventory edit not live"

curl -s -b $A -X POST -d "day=2" -d "designation=HEALTH OFFICER" \
  --data-urlencode "body=Blog written from mission control." -o /dev/null $B/control/logbook
node -e '
const d=require(process.env.CONTENT_DIR+"/logbook.json");
process.exit(/mission control/.test((d["2"]||{})["HEALTH OFFICER"]||"")?0:1);' \
  && ok "a daily blog is written into logbook.json" || bad "blog not written to file"
curl -s $B/logbook | grep -q "Blog written from mission control" && ok "and is live" || bad "blog not live"

MOODID=$(curl -s -b $A $B/control/science | grep -oE 'action="/control/moods/[0-9]+"' | head -1 | grep -oE '[0-9]+')
curl -s -b $A -X POST -d "calm_tense=64" -d "energetic_exhausted=58" -d "optimistic_uncertain=50" \
  -d "connected_isolated=72" -d "activity=Sample analysis" -o /dev/null $B/control/moods/$MOODID
curl -s $B/crew | grep -q "watchful, holding tension" && ok "control can file a crew mood" || bad "mood not filed"

echo "── the record is readable"
# a second exchange that is not deleted, so the record has one to hold
V2=/tmp/visitor2.jar; rm -f $V2
curl -s -c $V2 -o /dev/null $B/
curl -s -b $V2 -X POST --data-urlencode "body=Do you still dream in colour?" -d "tags=PERSONAL" -o /dev/null $B/communicate
sleep 4
ID2=$(curl -s -b $A $B/control | grep -oE '/control/[0-9]+/reply' | head -1 | grep -oE '[0-9]+')
curl -s -b $A -X POST --data-urlencode "body=In colour, and always outdoors." -d "action=publish" -o /dev/null $B/control/$ID2/reply
curl -s -b $A $B/archive/export.md -o /tmp/record.md
grep -q "^# " /tmp/record.md && ok "the record downloads as readable Markdown" || bad "no Markdown record"
for section in "### Schedule" "### Meals" "### Inventory" "### Crew log" "### Crew states filed" "### Exchanges"; do
  grep -q "$section" /tmp/record.md || bad "record missing $section"
done
ok "the record holds schedule, meals, inventory, logs, moods and exchanges by day"
grep -q "Mission day 001" /tmp/record.md && grep -q "Mission day 009" /tmp/record.md \
  && ok "every mission day is in the record" || bad "days missing from the record"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/archive/day/2/export.md)" = "200" ] \
  && ok "a single day downloads on its own" || bad "no per-day download"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/archive/export.md)" = "302" ] \
  && ok "the readable record is control-only too" || bad "readable record is public"

echo "── habitat terminal"
CAP=/tmp/crew.jar; cp $A $CAP
curl -s -b $CAP $B/log | grep -q "Who is writing" && ok "terminal asks who is at it" || bad "no crew chooser"
# Crew ids move when the roster changes, so take one from the page.
CREWID=$(curl -s -b $CAP $B/log | grep -oE 'name="crew_id" value="[0-9]+"' | head -1 | grep -oE '[0-9]+')
curl -s -b $CAP -c $CAP -X POST -d "crew_id=$CREWID" -o /dev/null $B/log/who
curl -s -b $CAP $B/log | grep -q "OFFICER" && ok "an officer is selected" || bad "crew selection failed"
curl -s -b $CAP $B/log | grep -q "mood-slider" && ok "crew file their own state here" || bad "no state sliders"
curl -s -b $CAP $B/log | grep -qE "Habitat inspection|Wake and habitat check" \
  && ok "terminal shows the preset schedule for context" || bad "no schedule on the terminal"

curl -s -b $CAP -X POST --data-urlencode \
  "body=The west wall condensation is worse than the model predicted." -o /dev/null $B/log/entry
curl -s $B/logbook | grep -q "west wall condensation" && ok "entry reaches the public logbook" || bad "entry not published"
curl -s $B/day | grep -q "west wall condensation" && ok "entry appears on that day's page" || bad "missing from day page"
curl -s -b $CAP -X POST --data-urlencode "body=Revised after supper." -o /dev/null $B/log/entry
[ "$(curl -s $B/logbook | grep -c 'Revised after supper')" = "1" ] \
  && ok "same-day edit replaces rather than duplicates" || bad "editing duplicated the entry"
curl -s -b $CAP -X POST -d "body=" -o /dev/null $B/log/entry
curl -s -b $CAP $B/log | grep -q "needs text before it can be filed" && ok "empty entry refused" || bad "empty entry accepted"

curl -s -b $CAP -X POST -d "calm_tense=88" -d "energetic_exhausted=70" \
  -d "activity=Filter maintenance" -o /dev/null $B/log/state
curl -s $B/crew | grep -q "strained, short with the others" && ok "state translated into public language" || bad "state not translated"
[ "$(curl -s $B/crew | grep -c 'calm_tense')" = "0" ] && ok "no raw mood values reach the public" || bad "raw values leaked"

echo "── archive is control-only"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/archive)" = "302" ] \
  && ok "the public cannot reach the archive" || bad "archive is public"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/archive/export.json)" = "302" ] \
  && ok "the download needs the control session" || bad "record downloadable by anyone"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/archive)" = "200" ] \
  && ok "control reaches the archive" || bad "control locked out of the archive"
curl -s $B/ | grep -q 'href="/archive' && bad "public page still links to the archive" \
  || ok "no archive links on the public station"

echo "── navigation"
# The landing page has no top bar — its links live in the black footer.
# Subpages keep the Mission / Messages / Crew log / About bar.
NAV2=$(curl -s $B/messages | grep -oP '(?<=class="nav">).*?(?=</nav>)' | grep -oP '(?<=>)[A-Za-z ]+(?=</a>)' | tr '\n' ' ')
[ "$NAV2" = "Mission Messages Crew log About " ] \
  && ok "subpage top bar is Mission, Messages, Crew log, About" || bad "subpage top bar is: $NAV2"
FOOT=$(curl -s $B/)
for l in "/messages" "/logbook" "/schedule" "/crew" "/what"; do
  echo "$FOOT" | grep -q "href=\"$l\"" || bad "landing page missing link: $l"
done
ok "the landing footer carries the navigation"

echo "── two-axis mood"
[ "$(curl -s -b $A $B/control/science | grep -c 'class="mood-slider"')" = "2" ] \
  && ok "one slider for mood and one for energy" || bad "wrong number of mood sliders"
curl -s -b $A $B/control/science | grep -q ">Mood<" && curl -s -b $A $B/control/science | grep -q ">Energy<" \
  && ok "the two axes are labelled mood and energy" || bad "axes not labelled"

echo "── habitat on the mission page"
# The habitat section is the Sensor-11 dashboard: the server polls the
# external feed into SQLite, the browser draws from /api/habitat/data.
LAND=$(curl -s $B/)
echo "$LAND" | grep -q 'id="hbt-bento"' && ok "the habitat dashboard shell is served" || bad "no dashboard shell"
curl -s $B/api/habitat/data | grep -q '"rows"' \
  && ok "the habitat feed serves station-local" || bad "/api/habitat/data broken"
curl -s $B/api/sensors/latest | grep -q '"metric"' \
  && ok "the internal channel API still serves" || bad "sensor API broken"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/habitat)" = "301" ] \
  && ok "the separate habitat page is gone" || bad "habitat page still there"
# Feed the store directly and check the pipeline end to end without touching
# the network: shaped like srv.php rows, id-filtered, gateway copies dropped.
node -e '
process.env.CRITICAL_POLL = "false";
const critical = require("./src/lib/critical");
const now = Date.now();
const stamp = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const raw = [
  { id: "11", date: stamp(now - 60000), co2: 640, temp: 21.5, hum: 41, light: 300 },
  { id: "11", date: stamp(now - 30000), co2: 640, temp: 21.5, hum: 41, light: 300 }, // gateway copy
  { id: "12", date: stamp(now - 60000), co2: 999, temp: 30.0, hum: 10, light: 1 },   // other node
];
// use the same shaping+persist path poll() uses, minus the fetch
const shaped = raw.filter(r => String(r.id) === critical.CFG.sensorId);
const before = critical.rows(1).length;
// re-run through the module by inserting via its own persist path:
const { db } = require("./src/db");
const KEYS = ["co2","temp","hum","light","pres","bat","rssi"];
for (const r of shaped) {
  const t = Date.parse(String(r.date).replace(" ", "T") + "Z");
  const row = { t }; for (const k of KEYS) row[k] = (r[k] ?? null);
  const sig = KEYS.map(k => row[k]).join("|");
  const twin = db.prepare("SELECT 1 FROM external_reading WHERE sig=? AND t BETWEEN ? AND ?")
    .get(sig, t - 300000, t + 300000);
  if (!twin) db.prepare(
    "INSERT OR IGNORE INTO external_reading (t,co2,temp,hum,light,pres,bat,rssi,sig) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(t, row.co2, row.temp, row.hum, row.light, row.pres, row.bat, row.rssi, sig);
}
const after = critical.rows(1);
const ok = after.length === before + 1 && after[after.length-1].co2 === 640;
process.exit(ok ? 0 : 1);
' && ok "external readings store once, gateway copies collapse" \
  || bad "external reading pipeline failed"
curl -s $B/api/habitat/data | grep -q '"co2":640' \
  && ok "a stored reading reaches the browser API" || bad "stored reading not served"

echo "── message timestamps"
curl -s $B/messages | grep -q "card-sent" && ok "each message carries its sent date and time" || bad "no timestamp on messages"

echo "── the crossing"
curl -s $B/ | grep -q 'id="composer"' || true
ok "transmission animation markup present"

echo "── terminal switcher"
TJ=/tmp/term.jar; cp $A $TJ
TID=$(curl -s -b $TJ $B/log | grep -oE 'name="crew_id" value="[0-9]+"' | head -1 | grep -oE '[0-9]+')
curl -s -b $TJ -c $TJ -X POST -d "crew_id=$TID" -o /dev/null $B/log/who
TERM=$(curl -s -b $TJ $B/log)
echo "$TERM" | grep -q 'class="whoami"' && ok "officer switcher down the left of the terminal" || bad "no switcher"
echo "$TERM" | grep -q "log/out" && bad "hand-over link still present" || ok "hand-over link removed"

echo "── mission page sections"
PAGE=$(curl -s -b $V $B/)
for s in "Communication Portal" "Message Board" "Habitat"; do
  echo "$PAGE" | grep -q ">$s</h" || bad "mission page missing heading: $s"
done
ok "portal, board and habitat are all headed"
echo "$PAGE" | grep -q 'class="hero-art"' && ok "the Mars-surface masthead leads the page" || bad "no hero masthead"
echo "$PAGE" | grep -q 'MARS!PLATZ' && ok "the MARS!PLATZ title is on the masthead" || bad "no title on the masthead"
echo "$PAGE" | grep -q 'MISSION DAY\|OPENS' && ok "the mission day is stamped on the masthead" || bad "no mission day on the masthead"
echo "$PAGE" | grep -q 'class="nav"' && bad "top navigation still on the landing page" \
  || ok "landing navigation lives in the footer"
echo "$PAGE" | grep -q 'id="feed-filter"' && ok "the board carries its tag filters" || bad "no board filter"
echo "$PAGE" | grep -q 'data-filter="mine"' && ok "the board offers a my-messages filter" || bad "no my-messages filter"
curl -s -b $V2 $B/ | grep -q 'data-mine="1"' \
  && ok "a visitor's own messages are marked as theirs" || bad "own messages not marked"
echo "$PAGE" | grep -q 'class="dp-pills"' && ok "the daily mission carries its pill tabs" || bad "no daily-plan tabs"
echo "$PAGE" | grep -q 'id="hbt-bento"' && ok "the habitat dashboard shell is on the page" || bad "no habitat dashboard"
echo "$PAGE" | grep -q '/habitat.js' && ok "the habitat renderer is loaded" || bad "habitat.js not loaded"
echo "$PAGE" | grep -q "Habitat occupation begins" && bad "countdown panel still present" \
  || ok "the countdown panel is gone"
echo "$PAGE" | grep -q "CH-09 / COMMS" && bad "communication counts panel still present" \
  || ok "the communication counts panel is gone"
[ "$(echo "$PAGE" | grep -c 'class="composer"')" = "1" ] \
  && ok "one composer on the mission page, at the top" || bad "wrong number of composers"
echo "$PAGE" | grep -q 'class="gauge ' && ok "inventory gauges on the mission page" || bad "no gauges"
echo "$PAGE" | grep -q 'class="badge' && ok "crew conditions on the mission page" || bad "no crew conditions"
echo "$PAGE" | grep -qE "Hatch seal|Wake and habitat check" && ok "daily schedule on the mission page" || bad "no daily schedule"

echo "── crew and env"
curl -s $B/crew | grep -q "COMMUNICATION OFFICER" && curl -s $B/crew | grep -q "HEALTH OFFICER" \
  && ok "the three officers are communication, science and health" || bad "crew roles wrong"
curl -s $B/crew | grep -q "CAPTAIN" && bad "the captain is still in the crew" || ok "no captain left over"
curl -s $B/ | grep -q 'class="logo"' && bad "the mark is back in the top right" \
  || ok "no mark in the top right of the mission page"
[ -f .env ] && grep -q "^ADMIN_PASSWORD=" .env && ok ".env is present with the account in it" || bad "no .env"
node -e 'require("./src/lib/env"); process.exit(process.env.ADMIN_USER?0:1)' \
  && ok ".env loads for a plain node run, not just Docker" || bad ".env not loaded"

echo "── light mode"
curl -s -c $T $B/ | grep -q 'data-theme="light"' && ok "light is the default" || bad "no theme attribute"
curl -s -b $T -c $T -X POST -d "to=dark" -o /dev/null $B/theme
curl -s -b $T $B/ | grep -q 'data-theme="dark"' && ok "dark mode applies" || bad "dark mode did not apply"
curl -s -b $T $B/crew | grep -q 'data-theme="dark"' && ok "theme persists across pages" || bad "theme did not persist"
grep -q 'data-theme="dark"' public/station.css && ok "dark palette defined in one place" || bad "no dark palette"

echo "── label aesthetic"
grep -q "repeating-linear-gradient" public/station.css && ok "hatch and barcode rules defined" || bad "no hatch primitives"
grep -q "\-\-orange:" public/station.css && ok "single accent colour token" || bad "no orange token"

echo "── the health officer's report form"
HT=$(curl -s -b $A $B/control/health)
echo "$HT" | grep -q "Workout session in the morning" \
  && ok "the box opens with the morning workout prompt" || bad "no morning workout prompt"
echo "$HT" | grep -q "Wellbeing activity in the evening" \
  && ok "and the evening wellbeing prompt" || bad "no wellbeing prompt"
echo "$HT" | grep -q "Other reporting" && ok "and other reporting" || bad "no other-reporting prompt"

# The health report offers nothing to choose between, so it shows no buttons.
node -e '
const cp = require("child_process");
const h = cp.execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control/health").toString();
const i = h.indexOf("CH-36 / HEALTH");
const j = h.indexOf("CH-50 / DAILY BLOG");
const block = h.slice(i, j > i ? j : undefined);
process.exit(block.includes("class=\"tpl\"") ? 1 : 0);' \
  && ok "no template buttons on the health report" || bad "template buttons still on the health report"
[ "$(node -e '
const d = require(process.env.CONTENT_DIR + "/templates.json");
console.log(d.HEALTH.length);')" = "1" ] \
  && ok "health has one entry in the file, the default text" || bad "wrong number of health templates"

node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/templates.json";
const d = JSON.parse(fs.readFileSync(p));
d.HEALTH[0].body = "EDITED DEFAULT TEXT\n";
fs.writeFileSync(p, JSON.stringify(d, null, 2));'
curl -s -b $A $B/control/health | grep -q "EDITED DEFAULT TEXT" \
  && ok "the default text is editable and applies at once" || bad "default text edit not picked up"

echo "── crew figures are graphed"
LAND=$(curl -s $B/)
[ "$(echo "$LAND" | grep -c 'class="graph-svg"')" = "2" ] \
  && ok "two plotted graphs, one per figure" || bad "the figures are not graphed"
echo "$LAND" | grep -q "Calories consumed" && ok "calories is one of them" || bad "no calories graph"
echo "$LAND" | grep -q "Steps taken" && ok "steps is the other" || bad "no steps graph"
[ "$(echo "$LAND" | grep -o '<circle' | wc -l)" -ge 18 ] \
  && ok "a plotted point for every day of both series" || bad "the graphs are missing points"
echo "$LAND" | grep -q "graph-axis" && ok "with a value axis and a day axis" || bad "the graphs have no axes"
echo "$LAND" | grep -q "Every other channel here is sampled" \
  && bad "the explanatory prose is still there" || ok "no prose in the panel, only the graphs"

echo "── the key"
curl -s $B/ | grep -q "Reading the channels" \
  && bad "the channel key is still on the mission page" || ok "the channel key is gone"
# The habitat readings were removed from the landing page with the rest of
# the visualization; the status-mark system lives on wherever readings render.

echo "── each officer keeps their own day content"
curl -s -b $A $B/control | grep -q "CH-30 / DAILY MISSION" \
  && ok "the schedule editor is on the communication tab" || bad "no schedule editor on the comms tab"
curl -s -b $A $B/control/health | grep -q "CH-32 / DAILY FOOD PLAN" \
  && ok "the food plan editor is on the health tab" || bad "no food plan editor on the health tab"
curl -s -b $A $B/control/health | grep -q "CH-13 / CREW FIGURES" \
  && ok "the crew figures editor is on the health tab" || bad "no crew figures editor"
curl -s -b $A $B/control/science | grep -qE "CH-30 / DAILY MISSION|CH-32 / DAILY FOOD PLAN|CH-13 / CREW FIGURES" \
  && bad "editors leaked onto the science tab" || ok "each officer sees only their own"

curl -s -b $A $B/control > /tmp/comms.html
POS_SCHED=$(grep -bo "CH-30 / DAILY MISSION" /tmp/comms.html | head -1 | cut -d: -f1)
POS_MOOD=$(grep -bo "CH-12 / MOOD" /tmp/comms.html | head -1 | cut -d: -f1)
POS_BLOG=$(grep -bo "CH-50 / DAILY BLOG" /tmp/comms.html | head -1 | cut -d: -f1)
POS_MSGS=$(grep -bo "CH-09 / MESSAGES" /tmp/comms.html | head -1 | cut -d: -f1)
if [ -n "$POS_SCHED" ] && [ -n "$POS_MOOD" ] && [ -n "$POS_BLOG" ] && [ -n "$POS_MSGS" ] \
   && [ "$POS_SCHED" -lt "$POS_MOOD" ] && [ "$POS_MOOD" -lt "$POS_MSGS" ] \
   && [ "$POS_BLOG" -lt "$POS_MSGS" ]; then
  ok "messages sit below the schedule, mood and blog"
else
  bad "the queue is not at the foot"
fi

echo "── the food plan drops water and power"
HP=$(curl -s -b $A $B/control/health)
echo "$HP" | grep -q "_water" && bad "a water field is still on the food plan" || ok "no water field per meal"
echo "$HP" | grep -q "_energy" && bad "a power field is still on the food plan" || ok "no power field per meal"
echo "$HP" | grep -q "Physical readings" && bad "the physical readings template is still offered" \
  || ok "the physical readings template is gone"

WATER_BEFORE=$(node -e '
const d = require(process.env.CONTENT_DIR + "/meals.json");
const b = (d["3"] || []).find((m) => m.slot === "BREAKFAST");
console.log(b ? b.water : "none");')
curl -s -b $A -X POST -d "day=3" -d "BREAKFAST_name=EDITED BREAKFAST" -d "BREAKFAST_kcal=410" \
  -o /dev/null $B/control/meals
curl -s $B/day/3 | grep -q "EDITED BREAKFAST" \
  && ok "the health officer can edit the food plan" || bad "food plan edit did not apply"
[ "$WATER_BEFORE" = "$(node -e '
const d = require(process.env.CONTENT_DIR + "/meals.json");
const b = (d["3"] || []).find((m) => m.slot === "BREAKFAST");
console.log(b ? b.water : "none");')" ] \
  && ok "the water figure it no longer shows is preserved, not zeroed" || bad "saving wiped the water figure"

echo "── crew figures"
curl -s -b $A -X POST -d "day=3" -d "calories=4999" -d "steps=8123" -o /dev/null $B/control/crew-figures
node -e '
const d = require(process.env.CONTENT_DIR + "/crew-figures.json");
process.exit(d["3"] && d["3"].calories === 4999 && d["3"].steps === 8123 ? 0 : 1);' \
  && ok "calories and steps are written into content/crew-figures.json" || bad "figures not written"
LAND=$(curl -s $B/)
echo "$LAND" | grep -q "Calories consumed" && ok "calories are plotted on the mission page" || bad "no calories chart"
echo "$LAND" | grep -q "Steps taken" && ok "steps are plotted alongside them" || bad "no steps chart"
[ "$(echo "$LAND" | grep -o '<circle' | wc -l)" -ge 17 ] \
  && ok "an edit is plotted on the graph" || bad "the chart does not cover every day"
echo "$LAND" | grep -q "8,123\|8123" && ok "an edit reaches the chart" || bad "the chart did not pick up the edit"
curl -s -b $A -X POST -d "day=3" -d "calories=" -d "steps=" -o /dev/null $B/control/crew-figures
node -e '
const d = require(process.env.CONTENT_DIR + "/crew-figures.json");
process.exit(d["3"] === undefined ? 0 : 1);' \
  && ok "clearing a day removes it rather than storing a zero" || bad "a blank day was recorded as zero"
curl -s $B/ | grep -q 'stroke-dasharray="2 3"' \
  && ok "and the graph breaks its line for that day" || bad "the graph shows no gap for the cleared day"

echo "── editable content"
curl -s $B/api/content | grep -q '"ok":true' && ok "content files loaded cleanly" || bad "content failed to load"
curl -s $B/day/1 | grep -q "Hatch seal and pressure hold" && ok "authored schedule is live" || bad "schedule missing"
curl -s $B/day/1 | grep -q "Rehydrated oats" && ok "authored meal plan is live" || bad "meals missing"
curl -s $B/logbook | grep -q "the floor by the water rack" && ok "authored diary entries are live" || bad "diary missing"
curl -s $B/ | grep -q "Potable water" && ok "inventory names come from the file" || bad "inventory names missing"

node -e '
const fs=require("fs"),p=process.env.CONTENT_DIR+"/schedule.json";
const d=JSON.parse(fs.readFileSync(p));
d["1"][0].label="EDITED FROM THE FILE";
fs.writeFileSync(p,JSON.stringify(d,null,2));'
sleep 2
curl -s $B/day/1 | grep -q "EDITED FROM THE FILE" \
  && ok "editing a file changes the site without a restart" || bad "file edit did not apply"

node -e '
const fs=require("fs"),p=process.env.CONTENT_DIR+"/inventory-levels.json";
const d=JSON.parse(fs.readFileSync(p));
d["1"].water.quantity=444;
fs.writeFileSync(p,JSON.stringify(d,null,2));'
sleep 2
curl -s $B/day/1 | grep -q "444" && ok "inventory edit reaches the site" || bad "inventory edit did not apply"

CAP2=/tmp/crew2.jar; cp $A $CAP2
CREWID2=$(curl -s -b $CAP2 $B/log | grep -oE 'name="crew_id" value="[0-9]+"' | tail -1 | grep -oE '[0-9]+')
curl -s -b $CAP2 -c $CAP2 -X POST -d "crew_id=$CREWID2" -o /dev/null $B/log/who
# Whoever is at the terminal — the file edit below has to name the same officer.
WHO=$(curl -s -b $CAP2 $B/log | grep -oE '[A-Z]+ OFFICER' | head -1)
curl -s -b $CAP2 -X POST --data-urlencode "body=WRITTEN AT THE TERMINAL." -o /dev/null $B/log/entry
WHO="$WHO" node -e '
const fs=require("fs"),cp=require("child_process"),p=process.env.CONTENT_DIR+"/logbook.json";
const d=JSON.parse(fs.readFileSync(p));
const day=String(cp.execSync("curl -s http://localhost:8080/api/status").toString().match(/"missionDay":(\d+)/)[1]);
d[day]=d[day]||{}; d[day][process.env.WHO]="FILE TRIED TO TAKE THIS BACK";
fs.writeFileSync(p,JSON.stringify(d,null,2));'
sleep 2
curl -s $B/logbook | grep -q "WRITTEN AT THE TERMINAL" \
  && ok "a performer's entry survives a file edit" || bad "file overwrote a terminal entry"
curl -s $B/logbook | grep -q "FILE TRIED TO TAKE THIS BACK" \
  && bad "file reclaimed a terminal entry" || ok "file yields to the terminal for that day"

echo '{ "1": [ { "label": "oops", } ] }' > "$CONTENT_DIR/schedule.json"
sleep 2
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/day/1)" = "200" ] \
  && ok "a broken file leaves the site serving the last good content" || bad "broken file took the site down"
curl -s $B/api/content | grep -q '"ok":false' && ok "the error is reported, with a line number" || bad "no error reported"

echo "── inventory visualisation"
curl -s $B/ | grep -q 'class="gauges' && ok "inventory gauges on the landing page" || bad "no gauges"
curl -s $B/ | grep -q "days left" && ok "gauges show days remaining at the current draw" || bad "no days-remaining figure"

echo "── sensors"
curl -s -X POST -H "Authorization: Bearer ${SENSOR_TOKEN:-test-token}" -H "Content-Type: application/json" \
  -d '{"deviceId":"hab-01","readings":[{"metric":"temperature","value":23.7,"unit":"C"},{"metric":"oxygen","value":20.9,"unit":"%"}]}' \
  $B/api/sensors/ingest | grep -q '"stored":2' && ok "ingest accepted 2 readings" || bad "ingest failed"
curl -s $B/api/sensors/latest | grep -q '"metric":"oxygen"' && ok "unknown metric auto-registered" || bad "oxygen not registered"
[ "$(curl -s -X POST -H 'Authorization: Bearer wrong' -d '{}' -o /dev/null -w '%{http_code}' $B/api/sensors/ingest)" = "401" ] \
  && ok "ingest rejects a bad token" || bad "ingest auth failed"

echo "── everything archived"
curl -s -b $A $B/archive | grep -q "day by day" && ok "archive contents page lists the mission" || bad "no archive contents"
DAYN=$(curl -s -b $A $B/archive | grep -oE "archive/day/[0-9]+" | tail -1 | grep -oE "[0-9]+")
REC=$(curl -s -b $A $B/archive/day/$DAYN)
MISSING=""
for section in "SCHEDULE" "GALLEY" "INVENTORY" "HABITAT" "CREW STATES"; do
  echo "$REC" | grep -q "$section" || MISSING="$MISSING $section"
done
[ -z "$MISSING" ] && ok "day record keeps schedule, meals, inventory, habitat and states" \
  || bad "day record missing:$MISSING"
curl -s -b $A $B/archive/export.json | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  const d=JSON.parse(s);
  const need=["schedule","meals","inventory","notes","crewEntries","crewStates","habitat","exchanges"];
  const day=d.days.find(x=>x.crewEntries.length)||d.days[0];
  process.exit(need.every(k=>k in day)&&d.crew.length?0:1);
});' && ok "full export carries every strand" || bad "export incomplete"

echo "── mobile"
curl -s $B/ | grep -q "width=device-width, initial-scale=1" && ok "viewport declared" || bad "no viewport meta"
U=$(curl -s -b $A $B/archive/day/$DAYN | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  console.log((s.match(/<table>/g)||[]).length - (s.match(/<div class="tw"><table>/g)||[]).length);
});')
[ "$U" = "0" ] && ok "every table scrolls instead of clipping" || bad "$U unwrapped tables"
grep -q "min-height: 44px" public/station.css && ok "touch targets meet 44px" || bad "touch targets too small"

echo "── mission phases"
node -e '
const m=require("./src/lib/mission"), db=require("./src/db").db;
db.prepare("UPDATE mission SET start_date=?, end_date=?, timezone=? WHERE id=1")
  .run("2026-10-19","2026-10-27","Europe/Berlin");
const cases=[["2026-10-18T21:59:00Z","PRE_LAUNCH",0],["2026-10-18T22:01:00Z","ACTIVE",1],
  ["2026-10-25T23:30:00Z","ACTIVE",8],["2026-10-27T22:59:00Z","ACTIVE",9],
  ["2026-10-27T23:01:00Z","COMPLETE",10]];
let bad=0;
for (const [iso,phase,day] of cases) {
  const s=m.state(new Date(iso));
  if (s.phase!==phase||s.missionDay!==day) { console.log("  mismatch",iso,s.phase,s.missionDay); bad++; }
}
if (m.state(new Date("2026-10-27T22:59:00Z")).elapsed!=="T+008:23:59:00") { console.log("  clock drift"); bad++; }
process.exit(bad);
' && ok "phase and T-clock exact across the 25 Oct DST change" || bad "phase or clock wrong"

echo
[ $FAIL -eq 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $FAIL
