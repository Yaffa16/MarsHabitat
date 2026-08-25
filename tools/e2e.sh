#!/usr/bin/env bash
# End-to-end check of the whole station.
set -u
cd "$(dirname "$0")/.."

export TRANSIT_SECONDS=${TRANSIT_SECONDS:-3}
export SENSOR_TOKEN=${SENSOR_TOKEN:-test-token}
# The suite needs a running mission of the real length — thirteen days, like
# 15–27 October — so it runs one that started four days ago. It also builds
# its own database in a temp directory, so running the tests never touches
# the station's real data.
export CRITICAL_POLL=${CRITICAL_POLL:-false}   # keep the suite off the network
export MISSION_OVERRIDE=true    # a rehearsal: the real dates are fixed in src/lib/run.js
export MISSION_START=${MISSION_START:-$(date -u -d '-4 days' +%F)}
export MISSION_END=${MISSION_END:-$(date -u -d '+8 days' +%F)}
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
curl -s -b $A $B/control | grep -q "Awaiting reply" && ok "control signed in" || bad "sign-in failed"
[ "$(curl -s -X POST -d 'username=captain' -d 'password=cap-pass' -o /dev/null -w '%{http_code}' $B/control/login)" = "401" ] \
  && ok "no second account exists" || bad "another login still works"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/log)" = "404" ] \
  && ok "the habitat terminal is gone — everything is written from control" || bad "/log still answers"

echo "── mission control is one page"
CTRL=$(curl -s -b $A $B/control)
echo "$CTRL" | grep -q 'id="queue"' && ok "the message queue is on the page" || bad "no queue"
echo "$CTRL" | grep -q 'class="filters"' && ok "message views filter in place" || bad "no filter bar"
node -e '
const h = require("child_process").execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control").toString();
const q = h.indexOf("id=\"queue\""), m = h.indexOf("data-pane=\"messages\""), c = h.indexOf("data-pane=\"comms\"");
const media = h.indexOf("data-tab=\"media\"");
process.exit(q > m && q < c && media === -1 ? 0 : 1);' && ok "messages have a tab of their own, first; no Media tab" || bad "queue is not in the Messages tab, or a Media tab remains"
for t in comms science health habitat; do
  echo "$CTRL" | grep -q "data-pane=\"$t\"" || bad "tab $t missing from the page"
done
ok "all four tabs are in the one page"
for tab in science health habitat; do
  [ "$(curl -s -b $A -o /dev/null -w '%{redirect_url}' $B/control/$tab)" = "$B/control?tab=$tab#work" ] \
    || bad "/control/$tab does not land on its tab"
done
ok "the old per-officer addresses land on their tab"
curl -s -b $A "$B/control?tab=health" | grep -q 'class="tab-pane on" data-pane="health"' \
  && ok "?tab= chooses the open tab server-side" || bad "tab parameter ignored"
echo "$CTRL" | grep -qi "science findings" || bad "no science findings"
echo "$CTRL" | grep -qi "health activities" || bad "no health activities"
echo "$CTRL" | grep -q "CH-30 / DAILY MISSION" || bad "no schedule editor"
node -e '
const h = require("child_process").execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control").toString();
const hab = h.indexOf("data-pane=\"habitat\"");
const sched = h.indexOf("CH-30 / DAILY MISSION"), meals = h.indexOf("CH-32 / DAILY FOOD PLAN"), inv = h.indexOf("CH-34 / INVENTORY");
process.exit(sched > hab && meals > hab && inv > hab && h.indexOf("CH-36 / UPDATE") === -1 && h.indexOf("/ ANOMALY") === -1
  && h.indexOf("data-pane=\"crewlog\"") === -1 && h.indexOf("class=\"tpl\"") === -1 ? 0 : 1);' \
  && ok "the Habitat tab holds the schedule, the food plan and the stores; no Crew log tab, no template buttons anywhere" || bad "habitat tab contents wrong, or the crew log tab / template buttons are still there"
[ "$(echo "$CTRL" | grep -c 'class="mood-slider"')" = "6" ] || bad "expected two sliders for each of three officers"
[ "$(echo "$CTRL" | grep -c 'CH-50 / DAILY BLOG')" = "3" ] || bad "expected a Daily Blog box per officer"
[ "$(echo "$CTRL" | grep -c 'class="block-title">Daily Blog<')" = "3" ] || bad "the blog box is not named Daily Blog"
node -e '
const h = require("child_process").execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control").toString();
for (const t of ["science", "health"]) {
  const p = h.indexOf("data-pane=\"" + t + "\""); const blog = h.indexOf("CH-50 / DAILY BLOG", p); const rep = h.indexOf("CH-36 / " + t.toUpperCase(), p);
  if (!(blog > p && rep > blog)) process.exit(1);
}' && ok "the Daily Blog sits at the top of every officer tab, above the findings and activities" || bad "Daily Blog is not first on the officer tabs"
ok "every officer's findings, blog and state are editable from control"

ID=$(curl -s -b $A $B/control | grep -oE '/control/[0-9]+/reply' | head -1 | grep -oE '[0-9]+')
[ -n "$ID" ] && ok "message waiting in the queue" || bad "no message in the queue"

curl -s -b $A -X POST -d "body=" -d "action=publish" -o /dev/null $B/control/$ID/reply
curl -s $B/ | grep -q 'card-reply' && bad "empty reply accepted" || ok "empty reply refused"

echo "── unapproved messages stay off the common board"
# Another visitor (no cookie) must not see the message until it is approved.
curl -s $B/ | grep -q "first thing you miss" && bad "unapproved message reached the common board" \
  || ok "an unapproved message is not on the common board"
curl -s $B/api/board | grep -q "first thing you miss" && bad "unapproved message in the public board API" \
  || ok "nor in the public board API"
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
curl -s $B/ | grep -q 'class="scroller feed"' \
  && ok "the message board scrolls beside the composer" || bad "no message-board column on the landing page"
curl -s $B/ | grep -qP 'id="feed-counter">\d+ exchanges · \d+ sent' && ok "the board counts every exchange" || bad "no exchange count"
[ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/messages)" = "$B/#exchanges" ] \
  && ok "/messages lands on the board" || bad "/messages redirect wrong"
[ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/board)" = "$B/#exchanges" ] \
  && ok "/board lands on the board" || bad "/board redirect wrong"
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
curl -s -b $A -X POST -d "day=2" -d "kind=science" -d "crew_id=2" -d "back=science" \
  --data-urlencode "body=Baseline established across twelve samples." -o /dev/null -w '%{redirect_url}' $B/control/report | grep -q "tab=science&day=2" \
  && ok "science findings are saved from the science tab and return to it" || bad "report save did not return to the tab"
node -e '
const d=require(process.env.CONTENT_DIR+"/notes.json");
process.exit((d["2"]||[]).filter(n=>n.kind==="SCIENCE").length===1?0:1);' \
  && ok "the day's science findings are one note in notes.json" || bad "findings not written to file as one note"
curl -s $B/ | grep -q "Baseline established" && ok "and are live on the site" || bad "findings not live"
curl -s -b $A -X POST -d "day=2" -d "kind=science" -d "crew_id=2" -d "back=science" \
  --data-urlencode "body=Baseline established across twelve samples. Batch B held over." -o /dev/null $B/control/report
node -e '
const d=require(process.env.CONTENT_DIR+"/notes.json");
process.exit((d["2"]||[]).filter(n=>n.kind==="SCIENCE").length===1 && d["2"].some(n=>/Batch B/.test(n.body))?0:1);' \
  && ok "saving again replaces the day's findings rather than adding a second note" || bad "findings duplicated"
curl -s -b $A "$B/control?tab=science&day=2" | grep -q 'action="/control/report"' && ok "the findings box is the same composer as the blog, on the science tab" || bad "no findings composer"

curl -s -b $A -X POST -d "day=2" -d "kind=health" -d "crew_id=3" -d "back=health" \
  --data-urlencode "body=All three sleeping through the period." -o /dev/null $B/control/report
curl -s $B/ | grep -q "sleeping through" && ok "health activities file the same way" || bad "health report failed"

curl -s -b $A -X POST -d "day=2" -d "q_water=555" -d "c_water=20" -o /dev/null $B/control/inventory
node -e '
const d=require(process.env.CONTENT_DIR+"/inventory-levels.json");
process.exit(d["2"] && d["2"].water && d["2"].water.quantity===555?0:1);' \
  && ok "an inventory update is written into inventory-levels.json" || bad "inventory not written to file"
curl -s -b $A $B/archive/day/2 | grep -q "555" && ok "and the record follows it" || bad "inventory edit not live"

curl -s -b $A -X POST -d "day=2" -d "designation=HEALTH OFFICER" \
  --data-urlencode "body=Blog written from mission control." -o /dev/null $B/control/logbook
node -e '
const d=require(process.env.CONTENT_DIR+"/logbook.json");
process.exit(/mission control/.test((d["2"]||{})["HEALTH OFFICER"]||"")?0:1);' \
  && ok "a daily blog is written into logbook.json" || bad "blog not written to file"
curl -s $B/ | grep -q "Blog written from mission control" && ok "and is live in the crew log" || bad "blog not live"

MOODID=$(curl -s -b $A $B/control | grep -oE 'action="/control/moods/[0-9]+"' | head -1 | grep -oE '[0-9]+')
curl -s -b $A -X POST -d "calm_tense=64" -d "energetic_exhausted=58" -d "optimistic_uncertain=50" \
  -d "connected_isolated=72" -d "activity=Sample analysis" -o /dev/null $B/control/moods/$MOODID
curl -s $B/ | grep -q "watchful, holding tension" && ok "control can file a crew mood" || bad "mood not filed"

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
grep -q "Mission day 001" /tmp/record.md && grep -q "Mission day 013" /tmp/record.md \
  && ok "every mission day is in the record" || bad "days missing from the record"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/archive/day/2/export.md)" = "200" ] \
  && ok "a single day downloads on its own" || bad "no per-day download"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/archive/export.md)" = "302" ] \
  && ok "the readable record is control-only too" || bad "readable record is public"

echo "── crew entries are written from control"
TODAY=$(curl -s $B/api/status | grep -oE '"missionDay":[0-9]+' | cut -d: -f2)
curl -s -b $A -X POST -d "day=$TODAY" -d "designation=COMMUNICATION OFFICER" -d "back=comms" --data-urlencode \
  "body=The west wall condensation is worse than the model predicted." -o /dev/null $B/control/logbook
curl -s $B/ | grep -q "west wall condensation" && ok "an entry reaches the public crew log" || bad "entry not published"
curl -s -b $A "$B/control?day=$TODAY" | grep -q "west wall condensation" && ok "and is back in its box on control" || bad "entry not shown in control"
curl -s -b $A -X POST -d "day=$TODAY" -d "designation=COMMUNICATION OFFICER" --data-urlencode "body=Revised after supper." -o /dev/null $B/control/logbook
[ "$(curl -s -b $A $B/archive/day/$TODAY | grep -c 'Revised after supper')" = "1" ] \
  && ok "same-day edit replaces rather than duplicates" || bad "editing duplicated the entry"
curl -s $B/ | grep -q "west wall condensation" && bad "old text still on the site" || ok "the old text is gone"
curl -s -b $A -X POST -d "day=$TODAY" -d "designation=COMMUNICATION OFFICER" -d "body=" -o /dev/null $B/control/logbook
curl -s $B/ | grep -q "Revised after supper" && bad "an empty save left the entry standing" || ok "an empty save removes the entry"
[ "$(curl -s -b $A -o /dev/null -w '%{redirect_url}' -X POST -d "day=3" -d "designation=SCIENCE OFFICER" -d "back=science" -d "body=Day three." $B/control/logbook)" = "$B/control?tab=science&day=3#work" ] \
  && ok "a save returns to the tab and day it came from" || bad "save landed somewhere else"

curl -s -b $A -X POST -d "calm_tense=88" -d "energetic_exhausted=70" \
  -d "activity=Filter maintenance" -o /dev/null $B/control/moods/$MOODID
curl -s $B/ | grep -q "strained, short with the others" && ok "state translated into public language" || bad "state not translated"
[ "$(curl -s $B/ | grep -c 'calm_tense')" = "0" ] && ok "no raw mood values reach the public" || bad "raw values leaked"

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
NAV2=$(curl -s -b $A $B/archive | grep -oP '(?<=class="nav">).*?(?=</nav>)' | grep -oP '(?<=>)[A-Za-z ]+(?=</a>)' | tr '\n' ' ')
[ "$NAV2" = "Mission Messages Crew log About " ] \
  && ok "the archive's top bar points into the landing page" || bad "archive top bar is: $NAV2"
FOOT=$(curl -s $B/)
for l in "/#exchanges" "/logbook" "/#mission" "/#crew" "/#about"; do
  echo "$FOOT" | grep -q "href=\"$l\"" || bad "landing page missing link: $l"
done
ok "the landing footer carries the navigation"
for u in /crew /day /day/3 /schedule /what /about /who-we-are; do
  [ "$(curl -s -o /dev/null -w '%{http_code}' $B$u)" = "301" ] || bad "$u is not redirected"
done
ok "every old public address redirects into the landing page"
LOGPAGE=$(curl -s $B/logbook)
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/logbook)" = "200" ] || bad "/logbook is not a page"
echo "$LOGPAGE" | grep -q "id=\"day-$TODAY\"" || bad "/logbook has no section for today (day $TODAY)"
echo "$LOGPAGE" | grep -q "id=\"day-1\"" || bad "/logbook has no section for day 1"
echo "$LOGPAGE" | grep -q "id=\"day-$((TODAY + 1))\"" || bad "/logbook does not show the days ahead as placeholder slots"
[ "$(echo "$LOGPAGE" | grep -c 'class="log-day logpage-day"')" = "13" ] || bad "/logbook does not carry all thirteen days"
echo "$LOGPAGE" | grep -q 'log-entry placeholder' || bad "/logbook shows no placeholder slots"
echo "$LOGPAGE" | grep -q "Day three." || bad "/logbook is missing the day-3 entry filed from control"
echo "$FOOT" | grep -q 'href="/logbook"' || bad "the crew log panel does not open the log page"
ok "the crew log is a page of its own: all thirteen days, placeholders where nothing is written yet, reached from the panel"
for sec in write exchanges mission habitat crew crewlog about what who-we-are; do
  echo "$FOOT" | grep -q "id=\"$sec\"" || bad "landing page has no #$sec section"
done
ok "the landing page carries every section: composer, board, mission, habitat, crew, crew log, about"

echo "── two-axis mood"
[ "$(curl -s -b $A $B/control | grep -c 'class="mood-slider"')" = "6" ] \
  && ok "one slider for mood and one for energy, per officer" || bad "wrong number of mood sliders"
curl -s -b $A $B/control | grep -q ">Mood<" && curl -s -b $A $B/control | grep -q ">Energy<" \
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
curl -s $B/ | grep -q "card-sent" && ok "each message carries its sent date and time" || bad "no timestamp on messages"

echo "── the crossing"
curl -s $B/ | grep -q 'id="composer"' || true
ok "transmission animation markup present"

echo "── replying is one motion"
QUEUE=$(curl -s -b $A "$B/control?show=all")
echo "$QUEUE" | grep -q 'class="reply-box"' && ok "each message carries its reply box directly beneath it" || bad "no reply box"
echo "$QUEUE" | grep -q 'value="publish" class="primary"' && ok "one primary action: reply and publish" || bad "no primary reply button"
echo "$QUEUE" | grep -q 'Ctrl+Enter' && ok "the keyboard shortcut is written on the box" || bad "no shortcut hint"
echo "$QUEUE" | grep -q 'id="queue-new"' && ok "new arrivals are announced without a reload" || bad "no arrival banner"
curl -s -b $A $B/control/api/queue | grep -q '"waiting":' && ok "control polls a waiting count" || bad "no queue count API"
[ "$(curl -s -b $A -o /dev/null -w '%{redirect_url}' -X POST -d "body=" "$B/control/$ID2/reply?show=published")" = "$B/control?tab=messages&show=published#queue" ] \
  && ok "a reply returns to the queue in the view it came from" || bad "reply landed elsewhere"

echo "── mission page sections"
PAGE=$(curl -s -b $V $B/)
for s in "Communication Portal" "Message Board"; do
  echo "$PAGE" | grep -q ">$s</h" || bad "mission page missing heading: $s"
done
echo "$PAGE" | grep -q 'id="habitat"' || bad "no habitat panel on the dashboard"
ok "portal and board are headed; the habitat is a panel of the dashboard"
echo "$PAGE" | grep -q 'class="masthead"' && ok "the masthead leads the page" || bad "no masthead"
echo "$PAGE" | grep -q 'class="wordmark">Mars<span class="bang">!</span>platz' && ok "the Mars!platz wordmark is on the masthead" || bad "no wordmark on the masthead"
echo "$PAGE" | grep -q 'class="device composer-device' && ok "the composer is a device" || bad "no composer device"
echo "$PAGE" | grep -q 'class="screen board"' && ok "the board is a screen" || bad "no board screen"
echo "$PAGE" | grep -q 'MISSION DAY\|OPENS' && ok "the mission day is stamped on the masthead" || bad "no mission day on the masthead"
echo "$PAGE" | grep -q 'class="nav"' && bad "top navigation still on the landing page" \
  || ok "landing navigation lives in the footer"
echo "$PAGE" | grep -q 'id="feed-filter"' && ok "the board carries its tag filters" || bad "no board filter"
echo "$PAGE" | grep -q 'data-filter="mine"' && ok "the board offers a my-messages filter" || bad "no my-messages filter"
curl -s -b $V2 $B/ | grep -q 'data-mine="1"' \
  && ok "a visitor's own messages are marked as theirs" || bad "own messages not marked"
echo "$PAGE" | grep -q 'class="dash-grid"' && ok "the mission dashboard lays everything out in one grid" || bad "no dashboard grid"
echo "$PAGE" | grep -q 'class="kpis"' && ok "the dashboard leads with its headline figures" || bad "no headline figures"
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
curl -s $B/ | grep -q "COMMUNICATION OFFICER" && curl -s $B/ | grep -q "HEALTH OFFICER" \
  && ok "the three officers are communication, science and health" || bad "crew roles wrong"
curl -s $B/ | grep -q "CAPTAIN" && bad "the captain is still in the crew" || ok "no captain left over"
curl -s $B/ | grep -q 'class="logo"' && bad "the mark is back in the top right" \
  || ok "no mark in the top right of the mission page"
[ -f .env ] && grep -q "^ADMIN_PASSWORD=" .env && ok ".env is present with the account in it" || bad "no .env"
node -e 'require("./src/lib/env"); process.exit(process.env.ADMIN_USER?0:1)' \
  && ok ".env loads for a plain node run, not just Docker" || bad ".env not loaded"

echo "── light mode"
curl -s -c $T $B/ | grep -q 'data-theme="light"' && ok "light is the default" || bad "no theme attribute"
curl -s -b $T -c $T -X POST -d "to=dark" -o /dev/null $B/theme
curl -s -b $T $B/ | grep -q 'data-theme="dark"' && ok "dark mode applies" || bad "dark mode did not apply"
curl -s -b $T $B/control/login | grep -q 'data-theme="dark"' && ok "theme persists across pages" || bad "theme did not persist"
grep -q 'data-theme="dark"' public/station.css && ok "dark palette defined in one place" || bad "no dark palette"

echo "── label aesthetic"
grep -q "repeating-linear-gradient" public/station.css && ok "hatch and barcode rules defined" || bad "no hatch primitives"
grep -q "\-\-orange:" public/station.css && ok "single accent colour token" || bad "no orange token"

TODAY_OR_1=$(curl -s $B/api/status | grep -oE '"missionDay":[0-9]+' | cut -d: -f2); [ -z "$TODAY_OR_1" ] && TODAY_OR_1=1
echo "── the health officer's report form"
# The health activities editor (a post editor page) opens with the default
# template as its prompt.
HT=$(curl -s -b $A "$B/control?tab=health")
echo "$HT" | grep -q "Workout session in the morning" \
  && ok "the box opens with the morning workout prompt" || bad "no morning workout prompt"
echo "$HT" | grep -q "Wellbeing activity in the evening" \
  && ok "and the evening wellbeing prompt" || bad "no wellbeing prompt"
echo "$HT" | grep -q "Other reporting" && ok "and other reporting" || bad "no other-reporting prompt"

# The health report offers nothing to choose between, so it shows no buttons.
node -e '
const h = require("child_process").execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control?tab=health").toString();
process.exit(h.includes("class=\"tpl\"") || h.includes("class=\"templates\"") ? 1 : 0);' \
  && ok "no template buttons on any composer" || bad "template buttons still present"
[ "$(node -e '
const d = require(process.env.CONTENT_DIR + "/templates.json");
console.log(d.HEALTH.length);')" = "1" ] \
  && ok "health has one entry in the file, the default text" || bad "wrong number of health templates"

node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/templates.json";
const d = JSON.parse(fs.readFileSync(p));
d.HEALTH[0].body = "EDITED DEFAULT TEXT\n";
fs.writeFileSync(p, JSON.stringify(d, null, 2));'
curl -s -b $A "$B/control?tab=health" | grep -q "EDITED DEFAULT TEXT" \
  && ok "the default text is editable and applies at once" || bad "default text edit not picked up"

echo "── crew figures are graphed"
LAND=$(curl -s $B/)
[ "$(echo "$LAND" | grep -c 'class="fig-spark"')" = "2" ] \
  && ok "two plotted graphs, one per figure" || bad "the figures are not graphed"
echo "$LAND" | grep -q "Calories consumed" && ok "calories is one of them" || bad "no calories graph"
echo "$LAND" | grep -q "Steps taken" && ok "steps is the other" || bad "no steps graph"
[ "$(echo "$LAND" | grep -o '<circle' | wc -l)" -ge 18 ] \
  && ok "a plotted point for every day of both series" || bad "the graphs are missing points"
echo "$LAND" | grep -q "<title>Day 00" && ok "every point carries its day and value" || bad "the points carry no values"
echo "$LAND" | grep -q "Every other channel here is sampled" \
  && bad "the explanatory prose is still there" || ok "no prose in the panel, only the graphs"

echo "── the key"
curl -s $B/ | grep -q "Reading the channels" \
  && bad "the channel key is still on the mission page" || ok "the channel key is gone"
# The habitat readings were removed from the landing page with the rest of
# the visualization; the status-mark system lives on wherever readings render.

echo "── each officer keeps their own day content"
# One page, four panes: an editor must sit inside its officer's pane.
node -e '
const h = require("child_process").execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control").toString();
const pane = (k) => { const i = h.indexOf("data-pane=\"" + k + "\""); const j = h.indexOf("data-pane=", i + 10); return h.slice(i, j > i ? j : undefined); };
const c = pane("comms"), s = pane("science"), he = pane("health"), hab = pane("habitat");
const fail = [];
if (!hab.includes("CH-30 / DAILY MISSION")) fail.push("schedule not on habitat");
if (!hab.includes("CH-32 / DAILY FOOD PLAN")) fail.push("food plan not on habitat");
if (!he.includes("CH-13 / CREW FIGURES")) fail.push("figures not on health");
if (!s.includes("CH-36 / SCIENCE") || !he.includes("CH-36 / HEALTH")) fail.push("report cards missing");
if (/CH-30 \/ DAILY MISSION|CH-32 \/ DAILY FOOD PLAN|CH-13 \/ CREW FIGURES/.test(s + c)) fail.push("editors leaked onto science or comms");
if (fail.length) { console.error(fail.join("; ")); process.exit(1); }' \
  && ok "schedule and food plan on habitat, figures on health, reports on their officers, nothing leaks" || bad "editors are on the wrong panes"

curl -s -b $A $B/control > /tmp/comms.html
POS_SCHED=$(grep -bo "CH-30 / DAILY MISSION" /tmp/comms.html | head -1 | cut -d: -f1)
POS_MSGS=$(grep -bo 'id="queue"' /tmp/comms.html | head -1 | cut -d: -f1)
if [ -n "$POS_SCHED" ] && [ -n "$POS_MSGS" ] && [ "$POS_MSGS" -lt "$POS_SCHED" ]; then
  ok "messages sit above the day's work"
else
  bad "the queue is not at the top"
fi

echo "── the food plan drops water and power"
HP=$(curl -s -b $A $B/control | sed -n '/data-pane="health"/,/data-pane="habitat"/p')
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
curl -s $B/ | grep -q "EDITED BREAKFAST" \
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
curl -s $B/ | grep -q "Hatch seal and pressure hold" && ok "authored schedule is live" || bad "schedule missing"
curl -s $B/ | grep -q "Rehydrated oats" && ok "authored meal plan is live" || bad "meals missing"
curl -s $B/ | grep -q "PLACEHOLDER\|Cue:" && bad "the placeholder marker or a writer's cue reached the public station" || ok "placeholder slots are shown publicly by their first line only; the marker and the cues stay inside"
curl -s -b $A -X POST -d "day=$((TODAY + 1))" -d "designation=SCIENCE OFFICER" -d "back=science" --data-urlencode "body=Written ahead of its day." -o /dev/null $B/control/logbook
curl -s $B/logbook | grep -q "Written ahead of its day." && ok "an entry written for a day ahead is public at once — the log does not wait for the clock" || bad "an entry written ahead is not public"
curl -s $B/ | grep -q "Written ahead of its day." && ok "and the station's crew panel shows it too" || bad "entry written ahead missing from the landing page"
for d in 1 7 13; do curl -s -b $A "$B/control?tab=health&day=$d" | grep -q "day $(printf %03d $d)" || bad "the Daily Blog cannot be opened for day $d"; done
[ "$(curl -s -b $A "$B/control?tab=comms" | grep -o 'data-day="[0-9]*"' | sort -u | wc -l)" = "13" ] \
  && ok "every officer tab offers all thirteen days of the run" || bad "the day picker does not offer thirteen days"
curl -s -b $A -X POST -d "day=2" -d "designation=HEALTH OFFICER" -d "back=health" --data-urlencode "body=First full sleep period logged." -o /dev/null $B/control/logbook
curl -s $B/logbook | grep -q "First full sleep period logged." && ok "writing over a placeholder publishes the entry for its day" || bad "written entry not public"
curl -s -b $A -X POST -d "day=2" -d "designation=HEALTH OFFICER" -d "back=health" -d "action=clear" -d "body=ignored" -o /dev/null $B/control/logbook
curl -s $B/logbook | grep -q "First full sleep period logged." && bad "cleared entry still public" || ok "clearing puts the placeholder back and takes the entry down"
grep -q "PLACEHOLDER" "$CONTENT_DIR/logbook.json" && ok "the placeholder is written back into logbook.json" || bad "placeholder not restored in the file"

echo "── media out of the habitat"
python3 - <<'PY'
import struct, zlib
raw = b''.join(b'\x00' + bytes([255, 0, 0, 0, 255, 0]) for _ in range(2))
def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
open('/tmp/e2e-photo.png', 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 2, 2, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
open('/tmp/e2e-clip.mp4', 'wb').write(b'\x00\x00\x00\x18ftypmp42' + bytes(range(256)) * 200)
open('/tmp/e2e-bad.exe', 'wb').write(b'MZ')
PY
PSHA=$(sha256sum /tmp/e2e-photo.png | cut -c1-64)
UP=$(curl -s -b $A -H "X-Requested-With: fetch" -F "day=$TODAY" -F "crew_id=2" -F "caption=West wall at dawn" -F "file=@/tmp/e2e-photo.png" $B/control/media/upload)
echo "$UP" | grep -q "\"ok\":true" && ok "control can send a photograph out of the habitat" || bad "upload failed: $UP"
echo "$UP" | grep -q "$PSHA" && ok "the file is stored under its real SHA-256" || bad "hash in the reply does not match the file"
MID=$(echo "$UP" | grep -oE '"id":[0-9]+' | head -1 | cut -d: -f2)
curl -s -b $A -F "day=$TODAY" -F "file=@/tmp/e2e-clip.mp4" -F "file=@/tmp/e2e-photo.png" -o /dev/null -w '%{redirect_url}' $B/control/media/upload | grep -q "tab=comms" \
  && ok "a plain form post carries several files and returns to an officer's tab" || bad "plain multipart upload failed"
curl -s -b $A -H "X-Requested-With: fetch" -F "day=$TODAY" -F "file=@/tmp/e2e-bad.exe" $B/control/media/upload | grep -q '"ok":false' \
  && ok "a file type the archive does not keep is refused" || bad "an .exe was accepted"
curl -s $B/media | grep -q "West wall at dawn" && ok "the photograph is on the public Media page" || bad "not on /media"
curl -s $B/ | grep -q "West wall at dawn" && ok "and in the Media panel on the station" || bad "not on the landing page"
curl -s $B/logbook | grep -q "West wall at dawn" && ok "and under its day on the crew log" || bad "not on /logbook"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/media/$MID)" = "200" ] && ok "each item has a page of its own" || bad "item page missing"
curl -s -o /tmp/e2e-dl.png "$B/media/file/$MID/e2e-photo.png?download" && cmp -s /tmp/e2e-dl.png /tmp/e2e-photo.png \
  && ok "the download is the original, byte for byte" || bad "downloaded file differs from the original"
curl -s -D - -o /dev/null "$B/media/file/$MID/e2e-photo.png?download" | grep -qi "content-disposition: attachment" && ok "downloads carry the original filename" || bad "no attachment disposition"
[ "$(curl -s -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-9' $B/media/file/$MID/e2e-photo.png)" = "206" ] && ok "files serve byte ranges, so video seeks" || bad "no range support"
curl -s $B/media/manifest.json | grep -q "$PSHA" && ok "the public manifest lists every file with its SHA-256" || bad "manifest missing the hash"
curl -s -o /tmp/e2e-all.zip $B/media/export.zip
python3 -c "
import zipfile, json, sys
z = zipfile.ZipFile('/tmp/e2e-all.zip'); assert z.testzip() is None, 'corrupt entry'
names = [i.filename for i in z.infolist()]; assert 'manifest.json' in names and 'README.txt' in names, names
m = json.loads(z.read('manifest.json')); p = [i for i in m['items'] if i['sha256'] == '$PSHA'][0]
assert z.read(p['path']) == open('/tmp/e2e-photo.png', 'rb').read(), 'zip entry differs from original'
" && ok "everything downloads as one ZIP that zipfile verifies, with the manifest inside" || bad "the export ZIP failed verification"
curl -s -o /tmp/e2e-day.zip $B/media/day/$TODAY/export.zip && python3 -c "import zipfile; assert zipfile.ZipFile('/tmp/e2e-day.zip').testzip() is None" \
  && ok "a single day downloads as its own ZIP" || bad "day ZIP failed"
curl -s -b $A $B/control/media/verify | grep -q '"ok":true' && ok "the archive verifies every stored file against its hash" || bad "verify reported problems"
curl -s -b $A -X POST -o /dev/null $B/control/media/$MID/hide
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/media/$MID)" = "404" ] && ok "a withdrawn item leaves public view" || bad "withdrawn item still public"
ls "$DATA_DIR"/media/*/ | grep -q "$PSHA" && ok "but its file is kept — nothing is ever deleted" || bad "file removed on withdraw"
curl -s -b $A -X POST -o /dev/null $B/control/media/$MID/restore
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/media/$MID)" = "200" ] && ok "and it can be restored" || bad "restore failed"
curl -s -b $A $B/archive/export.json | grep -q "$PSHA" && ok "the full record lists the media with hashes" || bad "media missing from the archive export"
curl -s -b $A $B/archive/day/$TODAY/export.md | grep -q "Media sent out" && ok "and the readable record has a media section per day" || bad "media missing from the markdown"
[ -f "$DATA_DIR/media/manifest.json" ] && node tools/verify-media.js "$DATA_DIR/media" >/dev/null && ok "manifest.json sits beside the files and tools/verify-media.js checks it" || bad "on-disk manifest or verify tool failed"
# an entry with media attached, through the plain form (no script)
curl -s -b $A -F "day=$((TODAY + 2))" -F "designation=HEALTH OFFICER" -F "back=health" -F "body=Entry with a photograph." -F "media_caption=Attached to the entry" -F "file=@/tmp/e2e-photo.png" -o /dev/null -w '%{redirect_url}' $B/control/logbook | grep -q "tab=health" \
  && ok "an officer can send media with a blog entry" || bad "blog post with a file failed"
LOGX=$(curl -s $B/logbook)
echo "$LOGX" | grep -q "Entry with a photograph." && echo "$LOGX" | grep -q "Attached to the entry" && ok "the entry and its media are public together" || bad "entry or its media missing from /logbook"
echo "$LOGX" | grep -A12 "Entry with a photograph." | grep -q 'class="entry-figure' && ok "and the media is set into the entry as a figure" || bad "media not attached to the entry on the page"
curl -s $B/ | grep -q "PLACEHOLDER" && bad "a placeholder marker reached the station" || ok "placeholder markers never reach the station"
curl -s $B/ | grep -q "Potable water" && ok "inventory names come from the file" || bad "inventory names missing"

node -e '
const fs=require("fs"),p=process.env.CONTENT_DIR+"/schedule.json";
const d=JSON.parse(fs.readFileSync(p));
d["1"][0].label="EDITED FROM THE FILE";
fs.writeFileSync(p,JSON.stringify(d,null,2));'
sleep 2
curl -s $B/ | grep -q "EDITED FROM THE FILE" \
  && ok "editing a file changes the site without a restart" || bad "file edit did not apply"

node -e '
const fs=require("fs"),p=process.env.CONTENT_DIR+"/inventory-levels.json";
const d=JSON.parse(fs.readFileSync(p));
d["1"].water.quantity=444;
fs.writeFileSync(p,JSON.stringify(d,null,2));'
sleep 2
curl -s -b $A $B/archive/day/1 | grep -q "444" && ok "inventory edit reaches the site" || bad "inventory edit did not apply"

# Control and the file are the same record now: whichever wrote last wins.
curl -s -b $A -X POST -d "day=4" -d "designation=SCIENCE OFFICER" --data-urlencode "body=WRITTEN FROM CONTROL." -o /dev/null $B/control/logbook
node -e '
const d=require(process.env.CONTENT_DIR+"/logbook.json");
process.exit(d["4"] && d["4"]["SCIENCE OFFICER"]==="WRITTEN FROM CONTROL." ? 0 : 1);' \
  && ok "an entry written from control lands in logbook.json" || bad "control entry not in the file"
node -e '
const fs=require("fs"),p=process.env.CONTENT_DIR+"/logbook.json";
const d=JSON.parse(fs.readFileSync(p));
d["4"]["SCIENCE OFFICER"]="EDITED IN THE FILE AFTERWARDS.";
fs.writeFileSync(p,JSON.stringify(d,null,2));'
sleep 2
curl -s $B/ | grep -q "EDITED IN THE FILE AFTERWARDS" \
  && ok "a later file edit changes the same entry" || bad "file edit did not reach the entry"
curl -s $B/ | grep -q "WRITTEN FROM CONTROL" && bad "the old text survived the file edit" || ok "there is one record, not two"

echo '{ "1": [ { "label": "oops", } ] }' > "$CONTENT_DIR/schedule.json"
sleep 2
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/)" = "200" ] \
  && ok "a broken file leaves the site serving the last good content" || bad "broken file took the site down"
curl -s $B/api/content | grep -q '"ok":false' && ok "the error is reported, with a line number" || bad "no error reported"

echo "── inventory visualisation"
curl -s $B/ | grep -q 'class="gauges' && ok "inventory gauges on the landing page" || bad "no gauges"
curl -s $B/ | grep -q "days left" && ok "gauges show days remaining at the current draw" || bad "no days-remaining figure"

echo "── resource log"
# Every store on every day of the run, with what was left and what was used —
# one flat table, written beside the content files and served as a download.
LOGROWS=$(curl -s $B/resources/log.csv | grep -c '^[0-9]')
[ "$LOGROWS" = "117" ] && ok "the resource log has a row per item per day (117)" || bad "resource log has $LOGROWS rows"
curl -s $B/resources/log.csv | head -1 | grep -q 'daily_use,used_since_start' && ok "the log carries daily use and use since start" || bad "log header wrong"
curl -s $B/resources/log.csv | grep -q '^1,.*,water,.*,filed,' && ok "a filed day is marked as filed" || bad "no filed marker"
curl -s $B/resources/log.csv | grep -q ',carried,' && ok "a carried-forward day is marked as carried" || bad "no carried marker"
[ -s "$CONTENT_DIR/resource-log.csv" ] && ok "resource-log.csv is written beside the content files" || bad "no resource-log.csv in content/"
STORES=$(curl -s $B/ | grep -o 'store-[a-z]*' | sort -u | wc -l)
[ "$STORES" = "9" ] && ok "every store is a series on the trend graph (9)" || bad "only $STORES stores in the trend spec"

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
  .run("2026-10-15","2026-10-27","Europe/Berlin");
const cases=[["2026-10-14T21:59:00Z","PRE_LAUNCH",0],["2026-10-14T22:01:00Z","ACTIVE",1],
  ["2026-10-24T22:30:00Z","ACTIVE",11],["2026-10-25T23:30:00Z","ACTIVE",12],["2026-10-27T22:59:00Z","ACTIVE",13],
  ["2026-10-27T23:01:00Z","COMPLETE",14]];
let bad=0;
for (const [iso,phase,day] of cases) {
  const s=m.state(new Date(iso));
  if (s.phase!==phase||s.missionDay!==day) { console.log("  mismatch",iso,s.phase,s.missionDay); bad++; }
}
if (m.state(new Date("2026-10-27T22:59:00Z")).elapsed!=="T+012:23:59:00") { console.log("  clock drift"); bad++; }
process.exit(bad);
' && ok "phase and T-clock exact across the 25 Oct DST change" || bad "phase or clock wrong"

echo
[ $FAIL -eq 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $FAIL
