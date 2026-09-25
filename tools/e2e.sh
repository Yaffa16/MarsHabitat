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
export CLOUD_POLL=false HA_POLL=${HA_POLL:-false}
export MISSION_OVERRIDE=true    # a rehearsal: the real dates are fixed in src/lib/run.js
export MISSION_START=${MISSION_START:-$(date -u -d '-4 days' +%F)}
export MISSION_END=${MISSION_END:-$(date -u -d '+8 days' +%F)}
export CONTROL_PASSWORD=${CONTROL_PASSWORD:-${ADMIN_PASSWORD:-control123}}
export CONTROL_USER=${CONTROL_USER:-${ADMIN_USER:-control}}
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
# One panel of the landing page's dashboard, by its id — from its opening tag
# to the end of its section — so a check can look inside that panel alone.
panel() { curl -s $B/ | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const i = s.indexOf("id=\"" + process.argv[1] + "\""); process.stdout.write(i < 0 ? "" : s.slice(i, s.indexOf("</section>", i))); });' "$1"; }

echo "── visitor identity"
CS=$(curl -s -c $V -b $V $B/ | grep -o 'name="callsign" value="[A-Z]*-[0-9]*"' | head -1 | grep -oE '[A-Z]+-[0-9]+')
[ -n "$CS" ] && ok "a callsign is offered on arrival: $CS" || bad "no callsign"

echo "── writing from the landing page"
curl -s $B/ | grep -q 'id="composer"' && ok "composer is on the landing page" || bad "no composer on landing"
node -e '
const h = require("child_process").execSync("curl -s http://localhost:8080/").toString();
const c = h.indexOf("id=\"composer\""), s = h.indexOf("CH-01");
process.exit(c > -1 && (s < 0 || c < s) ? 0 : 1);
' && ok "composer precedes the habitat data" || bad "communication is not the lead element"

echo "── the habitat dome"
node -e '
const h = require("child_process").execSync("curl -s http://localhost:8080/").toString();
const a = h.indexOf("class=\"sheet-intro is-desk\""), d = h.indexOf("id=\"habitat-dome\""), w = h.indexOf("id=\"write\"");
process.exit(a > -1 && d > a && w > d ? 0 : 1);
' && ok "the dome sits between the sheet's head and the composer" || bad "dome out of place"
DOME=$(curl -s $B/)
[ "$(echo "$DOME" | grep -o 'class="dome-hex"' | wc -l)" -ge 8 ] && ok "eight hexagons in the dome — crew, lab, recycling, hydroponics, communication, power, nap pod, power generator" || bad "hexagons missing"
for H in crew science recycling aeroponics comms power nappod generator; do echo "$DOME" | grep -q "id=\"dome-$H\"" || bad "no pop-up for $H"; done; ok "every hexagon has its pop-up"
echo "$DOME" | grep -q 'class="dome-label" data-hex="power"' && ok "every hexagon is named on a leader line" || bad "dome labels missing"
echo "$DOME" | grep -q '<text class="dome-name"[^>]*>Hydroponics</text>' && echo "$DOME" | grep -q '<text class="dome-name"[^>]*>Power generator</text>' && ! echo "$DOME" | grep -q '>Aeroponics<\|>Generator<' && ok "the shelves are named Hydroponics and the bicycle Power generator" || bad "dome names: expected Hydroponics and Power generator"
echo "$DOME" | grep -q 'id="dome-comms"' && echo "$DOME" | grep -q 'href="#exchanges" data-close' && ok "the pop-ups link into the dashboard" || bad "dome links missing"
curl -s $B/api/dome | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const f = JSON.parse(s);
  process.exit(["crew", "science", "recycling", "aeroponics", "comms", "power", "nappod", "generator"].every((k) => f[k] && typeof f[k].text === "string") ? 0 : 1);
});' && ok "/api/dome returns every hexagon's figure" || bad "/api/dome incomplete"
curl -s $B/api/dome | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { process.exit(/[0-9]/.test(JSON.parse(s).crew.text) ? 1 : 0); });
' && ok "the crew's condition reaches the dome as words, never as numbers" || bad "a number in the crew callout"

curl -s -b $V -c $V -X POST --data-urlencode \
  "body=What is the first thing you miss about Earth?" -d "tags=QUESTION" -d "callsign=$CS" -o /dev/null $B/communicate
curl -s -b $V $B/ | grep -qi "message in transit" && ok "message in transit, shown on landing" || bad "no transit view"

curl -s -b $V -X POST --data-urlencode "body=Should be blocked" -o /dev/null $B/communicate
N=$(curl -s $B/api/status | grep -oE '"total":[0-9]+' | cut -d: -f2)
[ "$N" = "1" ] && ok "transit lock holds server-side" || bad "transit lock failed (total=$N)"

sleep 4
curl -s $B/api/status | grep -q '"pending":1' && ok "arrived and queued for review" || bad "did not settle to pending"

echo "── one login"
curl -s -c $A -X POST -d "username=${CONTROL_USER}" -d "password=${CONTROL_PASSWORD}" -o /dev/null $B/control/login
curl -s -b $A $B/control | grep -q "Awaiting reply" && ok "control signed in" || bad "sign-in failed"
[ "$(curl -s -X POST -d 'username=captain' -d 'password=cap-pass' -o /dev/null -w '%{http_code}' $B/control/login)" = "401" ] \
  && ok "no second account exists" || bad "another login still works"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/log)" = "404" ] \
  && ok "the habitat terminal is gone — everything is written from control" || bad "/log still answers"

echo "── mission control is one page"
CTRL=$(curl -s -b $A $B/control)
echo "$CTRL" | grep -q 'id="queue"' && ok "the message queue is on the page" || bad "no queue"
echo "$CTRL" | grep -q 'class="filters"' && ok "message views filter in place" || bad "no filter bar"
echo "$CTRL" | grep -q 'crossed ' && bad "the light-time is still on the queue cards" || ok "queue cards carry no light-time"
echo "$CTRL" | grep -q 'Save draft' && bad "Save draft is still offered" || ok "no Save draft button"
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
echo "$CTRL" | grep -qi "Daily Health Blog" || bad "no Daily Health Blog"
echo "$CTRL" | grep -q "CH-30 / DAILY MISSION" || bad "no schedule editor"
node -e '
const h = require("child_process").execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control").toString();
const hab = h.indexOf("data-pane=\"habitat\"");
const sched = h.indexOf("CH-30 / DAILY MISSION"), meals = h.indexOf("CH-32 / DAILY FOOD PLAN"), inv = h.indexOf("CH-34 / INVENTORY");
process.exit(sched > hab && meals > hab && inv > hab && h.indexOf("CH-36 / UPDATE") === -1 && h.indexOf("/ ANOMALY") === -1
  && h.indexOf("data-pane=\"crewlog\"") === -1 && h.indexOf("class=\"tpl\"") === -1 ? 0 : 1);' \
  && ok "the Habitat tab holds the schedule, the food plan and the stores; no Crew log tab, no template buttons anywhere" || bad "habitat tab contents wrong, or the crew log tab / template buttons are still there"
[ "$(echo "$CTRL" | grep -c 'class="mood-face"')" = "15" ] || bad "expected five faces for each of three officers"
[ "$(echo "$CTRL" | grep -c 'CH-53 / COMMANDER BLOG')" = "1" ] && ok "one Commander Blog box — the communication officer's" || bad "expected exactly one Commander Blog box"
echo "$CTRL" | grep -q 'CH-50 / DAILY BLOG' && bad "a per-officer Daily Blog box is still on the desk" || ok "no other officer has a Daily Blog box"
[ "$(echo "$CTRL" | grep -c '</span>Commander Blog</h2>')" = "1" ] || bad "the blog box is not named Commander Blog"
[ "$(echo "$CTRL" | grep -c 'class="block-head"')" -ge 6 ] && ok "every block on the officer tabs opens with the same numbered head" || bad "officer blocks lack the shared head"
echo "$CTRL" | grep -q 'class="block-state ' && ok "each block says whether anything is live yet" || bad "no live/empty state on the officer blocks"
node -e '
const h = require("child_process").execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control").toString();
const c = h.indexOf("data-pane=\"comms\""), s = h.indexOf("data-pane=\"science\""), he = h.indexOf("data-pane=\"health\""), hab = h.indexOf("data-pane=\"habitat\"");
const cb = h.indexOf("CH-53 / COMMANDER BLOG");
const sr = h.indexOf("CH-36 / SCIENCE", s), hr = h.indexOf("CH-36 / HEALTH", he);
process.exit(cb > c && cb < s && sr > s && sr < he && hr > he && hr < hab && h.indexOf("Daily Science Findings", s) > s && h.indexOf("Daily Health Blog", he) > he ? 0 : 1);
' && ok "Commander Blog on the communication officer's tab, Daily Science Findings and Daily Health Blog on theirs" || bad "the three blogs are not on their tabs"
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
echo "$MINE" | grep -q 'id="feed-mine-note"' && bad "the visible-only-to-you note is back" || ok "no note under the board head"

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
curl -s $B/ | grep -q 'id="feed-counter"' && bad "the exchange count is back on the board" || ok "the board carries no exchange count"
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
curl -s $B/at-a-glance | grep -q "Baseline established" && ok "and are live on their day in At a Glance" || bad "findings not live"
# the landing page's three blog panels carry the current day's post, and only that
TODAY=$(curl -s $B/api/status | grep -oE '"missionDay":[0-9]+' | cut -d: -f2)
panel blog-science | grep -q "Baseline established" && bad "another day's findings are on the landing page" || ok "another day's findings stay off the landing page — Daily Science Findings shows the current day only"
curl -s -b $A -X POST -d "day=$TODAY" -d "kind=science" -d "crew_id=2" -d "back=science" \
  --data-urlencode "body=Culture count up a third since yesterday." -o /dev/null $B/control/report
panel blog-science | grep -q "Culture count up a third" && ok "today's findings are the Daily Science Findings, below the trend graph" || bad "today's findings not in the Daily Science Findings panel"
panel blog-science | grep -q "SOL $(printf '%03d' $TODAY)" && ok "and the panel names the day it shows" || bad "the science panel does not name its day"
curl -s -b $A -X POST -d "day=2" -d "kind=science" -d "crew_id=2" -d "back=science" \
  --data-urlencode "body=Baseline established across twelve samples. Batch B held over." -o /dev/null $B/control/report
node -e '
const d=require(process.env.CONTENT_DIR+"/notes.json");
process.exit((d["2"]||[]).filter(n=>n.kind==="SCIENCE").length===1 && d["2"].some(n=>/Batch B/.test(n.body))?0:1);' \
  && ok "saving again replaces the day's findings rather than adding a second note" || bad "findings duplicated"
curl -s -b $A "$B/control?tab=science&day=2" | grep -q 'action="/control/report"' && ok "the findings box is the same composer as the blog, on the science tab" || bad "no findings composer"

curl -s -b $A -X POST -d "day=2" -d "kind=health" -d "crew_id=3" -d "back=health" \
  --data-urlencode "body=All three sleeping through the period." -o /dev/null $B/control/report
curl -s $B/at-a-glance | grep -q "sleeping through" && ok "health activities file the same way" || bad "health report failed"
curl -s -b $A -X POST -d "day=$TODAY" -d "kind=health" -d "crew_id=3" -d "back=health" \
  --data-urlencode "body=Pulse and sleep logged for all three." -o /dev/null $B/control/report
HB=$(panel blog-health)
echo "$HB" | grep -q "Pulse and sleep logged" && ! echo "$HB" | grep -q "sleeping through" \
  && ok "today's health activities are the Daily Health Blog — another day's are not there" || bad "the Daily Health Blog does not show today's activities alone"
panel blog-science | grep -q "Pulse and sleep logged" && bad "the health report leaked into the science panel" || ok "each report stays in its own panel"
# cleared again, so the day is as it was for the checks that follow — and the panels say so at once
curl -s -b $A -X POST -d "day=$TODAY" -d "kind=science" -d "crew_id=2" -d "back=science" -d "action=clear" -d "body=x" -o /dev/null $B/control/report
curl -s -b $A -X POST -d "day=$TODAY" -d "kind=health" -d "crew_id=3" -d "back=health" -d "action=clear" -d "body=x" -o /dev/null $B/control/report
panel blog-science | grep -q "No science findings yet for SOL" && panel blog-health | grep -q "No health blog yet for SOL" \
  && ok "a report cleared in mission control leaves its panel at once, and the panel says nothing is written for the day" || bad "a cleared report is still in its panel"

curl -s -b $A -X POST -d "day=2" -d "q_water=555" -d "c_water=20" -o /dev/null $B/control/inventory
# the inventory row is available · used today · left: filing one of the last two gives the other
curl -s -b $A -X POST -d "day=3" -d "c_water=30" -o /dev/null $B/control/inventory; sleep 2
node -e '
const db = require("./src/db").db;
const r = db.prepare("SELECT il.quantity, il.consumption FROM inventory_level il JOIN inventory_item i ON i.id = il.item_id WHERE i.key = ? AND il.mission_day = 3").get("water");
process.exit(r && Math.abs(r.quantity - (555 - 30)) < 0.01 && r.consumption === 30 ? 0 : 1);
' && ok "filing only the amount used today leaves available − used for the future" || bad "used-today alone does not derive what is left"
curl -s -b $A -X POST -d "day=4" -d "q_water=500" -o /dev/null $B/control/inventory; sleep 2
node -e '
const db = require("./src/db").db;
const r = db.prepare("SELECT il.quantity, il.consumption FROM inventory_level il JOIN inventory_item i ON i.id = il.item_id WHERE i.key = ? AND il.mission_day = 4").get("water");
process.exit(r && r.quantity === 500 && Math.abs(r.consumption - 25) < 0.01 ? 0 : 1);
' && ok "filing only what is left derives the amount used today" || bad "left alone does not derive used today"
curl -s -b $A "$B/control?tab=habitat&day=1" | grep -q "Available amount" && ok "the inventory columns read Available · Used today · Left for future" || bad "inventory columns not relabelled"
curl -s -b $A -X POST -d "day=3" -d "c_water=" -d "q_water=" -o /dev/null $B/control/inventory
curl -s -b $A -X POST -d "day=4" -d "c_water=" -d "q_water=" -o /dev/null $B/control/inventory; sleep 2
node -e '
const d=require(process.env.CONTENT_DIR+"/inventory-levels.json");
process.exit(d["2"] && d["2"].water && d["2"].water.quantity===555?0:1);' \
  && ok "an inventory update is written into inventory-levels.json" || bad "inventory not written to file"
curl -s -b $A $B/archive/day/2 | grep -q "555" && ok "and the record follows it" || bad "inventory edit not live"

curl -s -b $A -X POST -d "day=2" -d "designation=COMMUNICATION OFFICER" \
  --data-urlencode "body=Blog written from mission control." -o /dev/null $B/control/logbook
node -e '
const d=require(process.env.CONTENT_DIR+"/logbook.json");
process.exit(/mission control/.test((d["2"]||{})["COMMUNICATION OFFICER"]||"")?0:1);' \
  && ok "the Commander Blog is written into logbook.json" || bad "blog not written to file"
curl -s -b $A -X POST -d "day=2" -d "designation=HEALTH OFFICER" \
  --data-urlencode "body=A health officer blog that must not exist." -o /dev/null $B/control/logbook
node -e '
const d=require(process.env.CONTENT_DIR+"/logbook.json");
process.exit(Object.values(d).some((v) => v && typeof v === "object" && ("HEALTH OFFICER" in v || "SCIENCE OFFICER" in v)) ? 1 : 0);' \
  && ! curl -s $B/logbook | grep -q "must not exist" \
  && ok "no other officer can file a blog of their own" || bad "a science or health officer blog was accepted"
curl -s $B/logbook | grep -q "Blog written from mission control" && ok "and is live in the crew log" || bad "blog not live"

MOODID=$(curl -s -b $A $B/control | grep -oE 'action="/control/moods/[0-9]+"' | head -1 | grep -oE '[0-9]+')
curl -s -b $A -X POST -d "calm_tense=75" -d "activity=Sample analysis" -o /dev/null $B/control/moods/$MOODID
curl -s $B/ | grep -q "tense, short with the others" && ok "control can file a crew mood" || bad "mood not filed"

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
for section in "### COMMANDING OFFICER" "### SCIENCE OFFICER" "### HEALTH OFFICER" "#### Commander Blog" "#### Daily Science Findings" "#### Daily Health Blog" "#### Crew state" "### Habitat" "#### Schedule" "#### Meals" "#### Steps taken and calories consumed" "#### Inventory levels" "#### Power consumed" "### Habitat sensors"; do
  grep -q "$section" /tmp/record.md || bad "record missing $section"
done
ok "each day of the record has the three officers (the three blogs, crew state), the Habitat tab and the sensors"
grep -q "### Exchanges\|Do you still dream in colour\|In colour, and always outdoors" /tmp/record.md && bad "the readable record still carries messages" || ok "no message from Earth and no reply in the readable record"
grep -q "Mission day 001" /tmp/record.md && grep -q "Mission day 00$TODAY" /tmp/record.md && ! grep -q "Mission day 013" /tmp/record.md \
  && grep -q "have not happened yet" /tmp/record.md \
  && ok "every day that has happened is in the record, and no day that has not" || bad "the record's days are wrong"
for made_up in "Day total" "Days left" "days left" "used since start"; do
  grep -q "$made_up" /tmp/record.md && bad "the readable record carries a derived figure: $made_up"
done
ok "the readable record carries no total, projection or carried-forward figure"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/archive/day/2/export.md)" = "200" ] \
  && ok "a single day downloads on its own" || bad "no per-day download"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/archive/export.md)" = "302" ] \
  && ok "the readable record is control-only too" || bad "readable record is public"

echo "── the record as one PDF"
# pdftext: inflate every content stream and print the text it draws, so the
# suite can check what the PDF says without a PDF library on the machine.
pdftext() { node -e '
const zlib = require("zlib"); const buf = require("fs").readFileSync(process.argv[1]);
let i = 0, out = [];
while ((i = buf.indexOf("stream\n", i)) !== -1) {
  const start = i + 7, end = buf.indexOf("endstream", start); if (end < 0) break;
  try { out.push(zlib.inflateSync(buf.subarray(start, end)).toString("latin1")); } catch (e) { /* not flate: an image */ }
  i = end + 9;
}
// text is written as hex strings in WinAnsi, which is Latin-1 for everything this checks
const text = out.join("\n").replace(/<([0-9a-f]+)> ?Tj/gi, (_, h) => " " + Buffer.from(h, "hex").toString("latin1") + " ");
process.stdout.write(text);
' "$1"; }
curl -s -b $A -D /tmp/pdf.h $B/archive/export.pdf -o /tmp/record.pdf
grep -qi "content-type: application/pdf" /tmp/pdf.h && head -c 5 /tmp/record.pdf | grep -q "%PDF-" && tail -c 8 /tmp/record.pdf | grep -q "%%EOF" \
  && ok "the full record downloads as a PDF" || bad "no PDF record"
[ "$(grep -ac '/Type /Page$\|/Type /Page ' /tmp/record.pdf)" -ge 13 ] && ok "it has a page for every day and more" || bad "PDF has too few pages"
grep -aq "/Outlines" /tmp/record.pdf && ok "and bookmarks by section and day" || bad "PDF has no bookmarks"
PDFTXT=$(pdftext /tmp/record.pdf)
for needle in "Contents" "The mission" "Day 001" "Day 00$TODAY" "The crew log" "Media" "Commanding officer" "Science officer" "Health officer" "Commander Blog" "Daily Science Findings" "Daily Health Blog" "Crew state" "Schedule" "Meals" "Inventory levels" "Steps taken and calories consumed" "Habitat sensors" "Potable water"; do
  echo "$PDFTXT" | grep -q "$needle" || bad "PDF record missing: $needle"
done
ok "the PDF holds the mission, every day that has happened, the whole crew log and the media"
echo "$PDFTXT" | grep -q "Audit trail" && bad "the PDF still carries the audit trail" || ok "no audit trail in the PDF"
[ "$(curl -s -b $A -o /dev/null -w '%{redirect_url}' $B/archive/today)" = "$B/archive/day/$TODAY" ] && ok "during the run /archive/today is the current day" || bad "/archive/today does not lead to today"
for made_up in "Trends" "Daily usage" "hour by hour" "Resources over the day" "Day total" "Days left" "planned, ahead" "The distance"; do
  echo "$PDFTXT" | grep -q "$made_up" && bad "the PDF still carries generated matter: $made_up"
done
echo "$PDFTXT" | grep -q "Day 013" && bad "the PDF carries a chapter for a day that has not happened"
ok "no chart, no projection, no total and no day ahead in the PDF"
echo "$PDFTXT" | grep -q "In colour, and always outdoors.\|Do you still dream in colour\|The complete correspondence\|Exchanges published\|Messages from Earth" && bad "the PDF still carries messages" || ok "no message from Earth, no reply and no correspondence in the PDF"
echo "$PDFTXT" | grep -q "tense, short with the others" && ok "a filed state appears as its sentence" || bad "state missing from the PDF"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/archive/day/2/export.pdf)" = "200" ] \
  && ok "a single day downloads as a PDF too" || bad "no per-day PDF"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/archive/day/99/export.pdf)" = "404" ] \
  && ok "a day outside the run is refused" || bad "day 99 answered"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/archive/export.pdf)" = "302" ] \
  && ok "the PDF is control-only too" || bad "PDF record is public"
curl -s -b $A $B/control | grep -q 'href="/archive/export.pdf"' && ok "mission control carries the download" || bad "no PDF button on control"
echo "── all the messages, as a download of their own"
curl -s -b $A $B/archive | grep -q 'href="/control/messages/export.pdf"' && ok "the archive page carries a Download all messages card" || bad "no all-messages card"
curl -s -b $A "$B/control?show=pending" | grep -q 'href="/control/messages/export.pdf"' && bad "the button is still on the Messages tab" || ok "and the Messages tab does not"
curl -s -b $A -D /tmp/msgs.h $B/control/messages/export.pdf -o /tmp/messages.pdf
grep -qi "content-type: application/pdf" /tmp/msgs.h && head -c 5 /tmp/messages.pdf | grep -q "%PDF-" && ok "all the messages download as a PDF" || bad "no messages PDF"
MSGTXT=$(pdftext /tmp/messages.pdf)
echo "$MSGTXT" | grep -q "Do you still dream in colour" && echo "$MSGTXT" | grep -q "In colour, and always outdoors." && ok "with the message and its reply" || bad "a message or its reply is missing from the messages PDF"
curl -s -b $A $B/control/messages/export.csv | head -1 | grep -q "id,callsign,mission_day" && curl -s -b $A $B/control/messages/export.csv | grep -q "Do you still dream in colour" && ok "and as a CSV, one row per message (with a BOM so Excel reads the accents)" || bad "messages CSV wrong"
curl -s -b $A $B/control/messages/export.json | grep -q '"messages":\[' && ok "and as JSON" || bad "messages JSON wrong"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/control/messages/export.pdf)" = "302" ] && ok "the messages download is control-only" || bad "messages download is public"

echo "── crew entries are written from control"
TODAY=$(curl -s $B/api/status | grep -oE '"missionDay":[0-9]+' | cut -d: -f2)
curl -s -b $A -X POST -d "day=$TODAY" -d "designation=COMMUNICATION OFFICER" -d "back=comms" --data-urlencode \
  "body=The west wall condensation is worse than the model predicted." -o /dev/null $B/control/logbook
curl -s $B/logbook | grep -q "west wall condensation" && ok "an entry reaches the public crew log" || bad "entry not published"
panel blog-commander | grep -q "west wall condensation" && ok "the communication officer's Daily Blog is the Commander Blog on the landing page" || bad "entry not in the Commander Blog panel"
panel blog-commander | grep -q "SOL $(printf '%03d' $TODAY)" && ok "and the panel names the day it shows" || bad "the Commander Blog does not name its day"
curl -s -b $A "$B/control?day=$TODAY" | grep -q "west wall condensation" && ok "and is back in its box on control" || bad "entry not shown in control"
curl -s -b $A -X POST -d "day=$TODAY" -d "designation=COMMUNICATION OFFICER" --data-urlencode "body=Revised after supper." -o /dev/null $B/control/logbook
[ "$(curl -s -b $A $B/archive/day/$TODAY | grep -c 'Revised after supper')" = "1" ] \
  && ok "same-day edit replaces rather than duplicates" || bad "editing duplicated the entry"
curl -s $B/ | grep -q "west wall condensation" && bad "old text still on the site" || ok "the old text is gone"
curl -s -b $A -X POST -d "day=$TODAY" -d "designation=COMMUNICATION OFFICER" -d "body=" -o /dev/null $B/control/logbook
curl -s $B/ | grep -q "Revised after supper" && bad "an empty save left the entry standing" || ok "an empty save removes the entry"
CB=$(panel blog-commander)
echo "$CB" | grep -q "to be written at the end of this day" && bad "a placeholder reached the Commander Blog" || ok "placeholders stay out of the Commander Blog"
echo "$CB" | grep -q "No commander blog yet for SOL" && ok "with today's entry cleared the Commander Blog says nothing is written for the day" || bad "no empty line in the Commander Blog"
[ "$(curl -s -b $A -o /dev/null -w '%{redirect_url}' -X POST -d "day=3" -d "designation=COMMUNICATION OFFICER" -d "back=comms" -d "body=Day three." $B/control/logbook)" = "$B/control?tab=comms&day=3#work" ] \
  && ok "a save returns to the tab and day it came from" || bad "save landed somewhere else"

curl -s -b $A -X POST -d "calm_tense=100" \
  -d "activity=Filter maintenance" -o /dev/null $B/control/moods/$MOODID
curl -s $B/ | grep -q "angry, needing distance" && ok "state translated into public language" || bad "state not translated"
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
[ "$NAV2" = "Mission Messages At a Glance Crew log About " ] \
  && ok "the archive's top bar points into the landing page" || bad "archive top bar is: $NAV2"
FOOT=$(curl -s $B/)
for l in "/#exchanges" "/#mission" "/#crew" "/about" "/at-a-glance" "/media"; do
  echo "$FOOT" | grep -q "href=\"$l\"" || bad "landing page missing link: $l"
done
ok "the landing footer carries the navigation"
for u in /crew /day /day/3 /schedule; do
  [ "$(curl -s -o /dev/null -w '%{http_code}' $B$u)" = "301" ] || bad "$u is not redirected"
done
ok "every old public address redirects into the landing page"
[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/what)" = "301 $B/about#what" ] && [ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/who-we-are)" = "301 $B/about#who-we-are" ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' $B/about)" = "200" ] && ok "/about is a page of its own; /what and /who-we-are land on their section of it" || bad "the About page's addresses are wrong"
LOGPAGE=$(curl -s $B/logbook)
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/logbook)" = "200" ] || bad "/logbook is not a page"
echo "$LOGPAGE" | grep -q "id=\"day-$TODAY\"" || bad "/logbook has no section for today (day $TODAY)"
echo "$LOGPAGE" | grep -q "id=\"day-1\"" || bad "/logbook has no section for day 1"
echo "$LOGPAGE" | grep -q "id=\"day-$((TODAY + 1))\"" || bad "/logbook does not show the days ahead as placeholder slots"
[ "$(echo "$LOGPAGE" | grep -c 'class="log-day logpage-day"')" = "13" ] || bad "/logbook does not carry all thirteen days"
echo "$LOGPAGE" | grep -q 'log-entry placeholder' || bad "/logbook shows no placeholder slots"
echo "$LOGPAGE" | grep -q "Day three." || bad "/logbook is missing the day-3 entry filed from control"
echo "$FOOT" | grep -q 'href="/control"' && bad "the footer still offers mission control to visitors" || ok "no mission-control or crew-log buttons in the footer bar"
ok "the crew log is a page of its own: all thirteen days, placeholders where nothing is written yet, reached from the panel"
for sec in write exchanges mission habitat crew; do
  echo "$FOOT" | grep -q "id=\"$sec\"" || bad "landing page has no #$sec section"
done
ok "the landing page carries every section: composer, board, mission, habitat, crew"
ABOUT=$(curl -s $B/about)
for sec in about-project what who-we-are; do
  echo "$ABOUT" | grep -q "<section class=\"about-sec\" id=\"$sec\"" || bad "the About page has no #$sec section"
done
echo "$ABOUT" | grep -q 'Distance as the material' && echo "$ABOUT" | grep -q 'What happens when you send something' && echo "$ABOUT" | grep -q 'Outside the habitat' \
  && ok "the About page carries all three texts — About, What this is, Who we are" || bad "the About page is missing a text"
echo "$FOOT" | grep -q '<dialog class="popup" id="what"' && bad "the reading matter is still a pop-up on the landing page" || ok "no pop-ups for the reading matter on the landing page"
echo "$FOOT" | grep -q '<a class="tab tab-more" data-tab="more" href="/about">' && echo "$ABOUT" | grep -q '<a class="tab tab-more is-on" data-tab="more" href="/about">' \
  && ok "a phone's About key opens the page, and is lit there" || bad "the About key does not lead to the page"
echo "$FOOT" | grep -q 'class="tk-row" href="/about#what"' && echo "$ABOUT" | grep -q 'class="tk-row" href="/about#who-we-are"' \
  && ok "the ticker's menu rows lead to their section of the page" || bad "the menu rows do not lead to the About page"
echo "$FOOT" | grep -q "location.replace('/about?from=home'" && ok "the landing page's old #about, #what and #who-we-are lead there too" || bad "old About addresses lost"
echo "$FOOT" | grep -q 'id="crewlog"' && bad "the crew log panel is still on the landing page" || ok "no crew log panel on the landing page — the log lives at /logbook and in At a Glance"
echo "$FOOT" | grep -q 'id="media"' && bad "the media panel is still on the landing page" || ok "no media panel — the media lives at /media and in At a Glance"
echo "$FOOT" | grep -q 'id="whole"' && bad "the whole-mission panel is still on the landing page" || ok "no whole-mission panel — the run day by day lives in At a Glance"
echo "$FOOT" | grep -q 'class="ticker"' && echo "$FOOT" | grep -q 'id="tk-clock"' && ok "a ticker runs across the top: the habitat's clock and the current activity" || bad "no ticker on the landing page"
echo "$FOOT" | grep -q 'id="tk-now"' && echo "$FOOT" | grep -q 'data-tasks=' && ok "the ticker says what the crew are currently doing and switches to the next task as its time comes" || bad "ticker has no current activity"
echo "$FOOT" | grep -qF "fetch('/api/ticker'" && echo "$FOOT" | grep -qF "5 * 60 * 1000" && ok "and refreshes the schedule from the station every five minutes" || bad "ticker does not refresh on a cycle"
TK=$(curl -s $B/api/ticker)
echo "$TK" | grep -q '"tasks":\[' && echo "$TK" | grep -q '"label"' && echo "$TK" | grep -q '"detail"' && ok "/api/ticker hands the day's activities with their detail" || bad "/api/ticker broken"
echo "$FOOT" | grep -q 'id="tk-hab"' && ok "and the node's current reading, refreshed on its cycle" || bad "ticker has no habitat reading"

echo "── one mood scale, calm to angry"
[ "$(curl -s -b $A $B/control | grep -c 'class="mood-face"')" = "15" ] \
  && ok "one scale of five faces per officer, calm to angry" || bad "wrong number of mood faces"
curl -s -b $A $B/control | grep -q ">CALM<" && curl -s -b $A $B/control | grep -q ">ANGRY<" \
  && ok "the scale is labelled calm to angry" || bad "scale not labelled"
curl -s -b $A $B/control | grep -q "What they are doing" && bad "the activity field is still on the state form" || ok "the state is the scale alone — no activity field"

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
echo "$PAGE" | grep -q 'class="sheet-intro is-desk"' && ok "the sheet's head leads the page" || bad "no sheet head"
echo "$PAGE" | grep -q 'class="wordmark">MARS<span class="bang">!</span>platz' && ok "the Mars!platz wordmark is on the masthead" || bad "no wordmark on the masthead"
echo "$PAGE" | grep -q 'class="device composer-device' && ok "the composer is a device" || bad "no composer device"
echo "$PAGE" | grep -q 'class="screen board"' && ok "the board is a screen" || bad "no board screen"
echo "$PAGE" | grep -q 'class="run-dates"' && ok "the run and its day are stated under the wordmark" || bad "no run dates on the masthead"
echo "$PAGE" | grep -q 'class="nav"' && bad "top navigation still on the landing page" \
  || ok "landing navigation lives in the footer"
echo "$PAGE" | grep -q 'id="feed-filter"' && ok "the board carries its tag filters" || bad "no board filter"
echo "$PAGE" | grep -q 'data-filter="mine"' && ok "the board offers a my-messages filter" || bad "no my-messages filter"
curl -s -b $V2 $B/ | grep -q 'data-mine="1"' \
  && ok "a visitor's own messages are marked as theirs" || bad "own messages not marked"
echo "$PAGE" | grep -q 'class="dash-grid"' && ok "the mission dashboard lays everything out in one grid" || bad "no dashboard grid"
echo "$PAGE" | grep -q 'class="kpis"' && ok "the dashboard leads with its headline figures" || bad "no headline figures"
echo "$PAGE" | grep -q 'id="hbt-bento"' && ok "the habitat dashboard shell is on the page" || bad "no habitat dashboard"
node -e '
const h = require("child_process").execSync("curl -s http://localhost:8080/", { maxBuffer: 1 << 26 }).toString();
const at = (id) => h.indexOf("id=\"" + id + "\"");
const t = at("trends"), s = at("blog-science"), e = at("blog-health"), c = at("blog-commander");
process.exit(t > -1 && s > t && e > s && c > e ? 0 : 1);
' && ok "below the trend graph: Daily Science Findings, Daily Health Blog, Commander Blog, in that order" || bad "the three blogs are not below the trend graph in order"
echo "$PAGE" | grep -q "Daily Science Findings" && echo "$PAGE" | grep -q "Daily Health Blog" && echo "$PAGE" | grep -q "Commander Blog" \
  && ok "the three blog panels are headed" || bad "a blog panel heading is missing"
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
curl -s $B/ | grep -q "COMMANDING OFFICER" && curl -s $B/ | grep -q "HEALTH OFFICER" && ! curl -s $B/ | grep -qi "communication officer" \
  && ok "the three officers are the commanding, science and health officers — the first shown by the new title everywhere" || bad "crew roles wrong"
curl -s $B/ | grep -q "CAPTAIN" && bad "the captain is still in the crew" || ok "no captain left over"
curl -s $B/ | grep -q 'class="logo"' && bad "the mark is back in the top right" \
  || ok "no mark in the top right of the mission page"
[ -f .env ] && grep -q "^CONTROL_PASSWORD=\|^ADMIN_PASSWORD=" .env && ok ".env is present with the account in it" || bad "no .env"
node -e 'require("./src/lib/env"); process.exit((process.env.CONTROL_USER||process.env.ADMIN_USER)?0:1)' \
  && ok ".env loads for a plain node run, not just Docker" || bad ".env not loaded"

echo "── dark and light"
curl -s -c $T $B/ | grep -q 'data-theme="dark"' && ok "dark is the default" || bad "no theme attribute, or not dark by default"
curl -s -b $T -c $T -X POST -d "to=light" -o /dev/null $B/theme
curl -s -b $T $B/ | grep -q 'data-theme="light"' && ok "light mode applies" || bad "light mode did not apply"
curl -s -b $T $B/control/login | grep -q 'data-theme="light"' && ok "theme persists across pages" || bad "theme did not persist"
curl -s -b $T -c $T -X POST -d "to=dark" -o /dev/null $B/theme
curl -s -b $T $B/ | grep -q 'data-theme="dark"' && ok "and the switch turns it back to dark" || bad "dark mode did not come back"
grep -q 'data-theme="dark"' public/station.css && ok "dark palette defined in one place" || bad "no dark palette"

echo "── three languages"
# The station's own dictionary (src/lib/i18n.js), switched by DE · EN · FR
# beside the theme switch and kept in a cookie: no third-party script, works
# with the network unplugged. What the crew and visitors wrote, and the day
# content in content/, stay as written; mission control and the archive stay
# English whatever the cookie says.
LJ=/tmp/lang.jar; rm -f $LJ
LP=$(curl -s -c $LJ $B/)
echo "$LP" | grep -q '<html lang="en"' && ok "English is the default" || bad "no lang attribute, or not English by default"
[ "$(echo "$LP" | grep -o 'action="/lang"' | wc -l)" -ge 1 ] && echo "$LP" | grep -q 'name="to" value="de"' \
  && echo "$LP" | grep -q 'name="to" value="en"' && echo "$LP" | grep -q 'name="to" value="fr"' \
  && ok "the DE · EN · FR switch is on the landing page" || bad "no three-button language switch"
echo "$LP" | grep -q 'value="en" class="on" aria-current="true"' && ok "the current language is marked" || bad "current language not marked"
curl -s -b $LJ -c $LJ -X POST -d "to=de" -o /dev/null $B/lang
grep -q "mcs_lang.*de" $LJ && ok "POST /lang sets the mcs_lang cookie" || bad "no mcs_lang cookie after POST /lang"
DE=$(curl -s -b $LJ $B/)
echo "$DE" | grep -q '<html lang="de"' && ok "the page declares German" || bad "html lang is not de"
echo "$DE" | grep -q "Nachrichtenboard" && ok "the board heading reads in German" || bad "board heading not translated"
echo "$DE" | grep -q ">Senden<" && ok "the transmit button reads in German" || bad "transmit button not translated"
echo "$DE" | grep -q "Täglicher Gesundheitsblog" && echo "$DE" | grep -q "Commander-Blog" && echo "$DE" | grep -q "Hydroponik" && echo "$DE" | grep -q "Stromgenerator" \
  && ok "the blog panels and the renamed dome parts read in German" || bad "blog panels or dome names not translated"
echo "$DE" | grep -q 'value="de" class="on" aria-current="true"' && ok "the switch marks DE as current" || bad "DE not marked current"
echo "$DE" | grep -q 'window.MCS_T=' && echo "$DE" | grep -q '"Message Board":"Nachrichtenboard"' \
  && ok "the page carries the German table for its scripts" || bad "no MCS_T table for the page scripts"
echo "$DE" | grep -q 'class="wordmark">MARS<span class="bang">!</span>platz' && ok "the wordmark is not translated" || bad "wordmark changed"
echo "$DE" | grep -q "ZKM | Hertzlab" && ok "ZKM | Hertzlab stays as written" || bad "ZKM | Hertzlab changed"
curl -s -b $LJ -c $LJ -X POST -d "to=fr" -o /dev/null $B/lang
FR=$(curl -s -b $LJ $B/)
echo "$FR" | grep -q '<html lang="fr"' && echo "$FR" | grep -q "Tableau des messages" \
  && ok "French: lang attribute and board heading" || bad "French did not apply"
curl -s -b $LJ -c $LJ -X POST -d "to=xx" -o /dev/null $B/lang
curl -s -b $LJ $B/ | grep -q '<html lang="en"' && ok "an unknown language falls back to English" || bad "unknown language did not fall back"
curl -s -b $LJ -c $LJ -X POST -d "to=de" -o /dev/null $B/lang
LOG=$(curl -s -b $LJ $B/logbook)
echo "$LOG" | grep -q '<html lang="de"' && ok "the crew log page is in German" || bad "crew log page not German"
echo "$LOG" | grep -q "to be written at the end of this day" && ok "the crew's placeholder text stays untranslated" || bad "logbook content was translated or lost"
echo "$LOG" | grep -q "Commander-Blog" && echo "$LOG" | grep -q "Täglicher Gesundheitsblog" && ok "the three blogs are named in German" || bad "blog titles not translated"
GL=$(curl -s -b $LJ $B/at-a-glance)
echo "$GL" | grep -q '<html lang="de"' && echo "$GL" | grep -q "Tagesplan" && ok "At a Glance chrome is in German" || bad "At a Glance not German"
echo "$GL" | grep -qE '<span class="dot (ok|warn)"></span> VERBINDUNG (NOMINAL|GESTÖRT)' && ok "the rail's link state reads in German" || bad "rail not translated"
echo "$GL" | grep -qE "Hatch seal and pressure hold|Systems handover" && ok "task labels from content/schedule.json stay untranslated" || bad "schedule content was translated or lost"
CL=$(curl -s -b $LJ $B/control/login)
echo "$CL" | grep -q '<html lang="en"' && ! echo "$CL" | grep -q "Missionskontrolle" && ! echo "$CL" | grep -q 'action="/lang"' \
  && ok "mission control stays English, with no language switch" || bad "mission control was translated"
# the same visitor's German cookie plus the control session: the archive stays English
curl -s -b $A -c $A -X POST -d "to=de" -o /dev/null $B/lang
AR=$(curl -s -b $A $B/archive)
echo "$AR" | grep -q '<html lang="en"' && echo "$AR" | grep -q "Mission control" && ! echo "$AR" | grep -q "Missionskontrolle" \
  && ok "the archive stays English with the German cookie" || bad "the archive was translated"
curl -s -b $A $B/control | grep -q '<html lang="en"' && ! curl -s -b $A $B/control | grep -q "VERBINDUNG" \
  && ok "mission control's rail stays English" || bad "control rail translated"
curl -s -b $A -c $A -X POST -d "to=en" -o /dev/null $B/lang
API=$(curl -s -b $LJ $B/api/board)
echo "$API" | grep -qE "VERÖFFENTLICHT|BEANTWORTET" && ok "/api/board renders the card chrome in the visitor's language" || bad "/api/board cards not German"
echo "$API" | grep -q "Rain. Not the idea of it\|Do you still dream in colour\|In colour, and always outdoors" \
  && ok "what was written stays as written on the board" || bad "board content changed"
for u in / /logbook /at-a-glance /media /control/login /nowhere; do
  curl -s -b $LJ $B$u | grep -qi "gtranslate" && bad "gtranslate still referenced on $u"
done
grep -rqi "gtranslate\|notranslate\|gt-wrap" src public && bad "gtranslate remnants in src/ or public/" || ok "no gtranslate anywhere"
curl -s -b $LJ $B/nowhere | grep -q "Kein solcher Kanal" && ok "the 404 page reads in German" || bad "404 not translated"

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

node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/meals.json";
const d = JSON.parse(fs.readFileSync(p, "utf8")); d["3"] = [{ slot: "BREAKFAST", name: "Oats", kcal: 400, water: 0.35 }]; fs.writeFileSync(p, JSON.stringify(d, null, 2));'
sleep 2
WATER_BEFORE=$(node -e '
const d = require(process.env.CONTENT_DIR + "/meals.json");
const b = (d["3"] || []).find((m) => m.slot === "BREAKFAST");
console.log(b ? b.water : "none");')
curl -s -b $A -X POST -d "day=3" -d "BREAKFAST_name=EDITED BREAKFAST" -d "BREAKFAST_kcal=410" \
  -o /dev/null $B/control/meals
curl -s $B/at-a-glance | grep -q "EDITED BREAKFAST" \
  && ok "the health officer can edit the food plan" || bad "food plan edit did not apply"
[ "$WATER_BEFORE" = "$(node -e '
const d = require(process.env.CONTENT_DIR + "/meals.json");
const b = (d["3"] || []).find((m) => m.slot === "BREAKFAST");
console.log(b ? b.water : "none");')" ] \
  && ok "the water figure it no longer shows is preserved, not zeroed" || bad "saving wiped the water figure"

echo "── the recipe book"
[ -f "$CONTENT_DIR/recipes.json" ] && ok "content/recipes.json ships" || bad "no recipes.json"
HB=$(curl -s -b $A "$B/control?tab=habitat&day=3")
for S in BREAKFAST LUNCH DINNER; do echo "$HB" | grep -q "name=\"${S}_recipe\"" || bad "no recipe dropdown on $S"; done
echo "$HB" | grep -q 'name="RATION_recipe"' && bad "Other has a recipe dropdown" || ok "Breakfast, Lunch and Dinner have a recipe dropdown, Other does not"
echo "$HB" | grep -q 'value="__edit"' && bad "the dropdown still offers to edit the book" || ok "no edit entry in the dropdown"
echo "$HB" | grep -q 'CH-33 / RECIPE BOOK' && bad "the recipe book editor is still on the desk" || ok "no recipe book editor on the desk"
echo "$HB" | grep -q '<option value="" hidden selected>Choose meal</option>' && ok "the dropdown opens on Choose meal" || bad "no Choose meal default in the dropdown"
echo "$HB" | grep -q '<option value="__empty">Empty</option>' && ok "the dropdown carries Empty, to fill in on the go" || bad "no Empty entry in the dropdown"
echo "$HB" | grep -q 'fill in the fields below by hand' && bad "the old empty-slot wording is still in the dropdown" || ok "the old empty-slot wording is gone"
[ "$(node -e 'console.log(require(process.env.CONTENT_DIR + "/recipes.json").recipes.filter((r) => r.sample && r.prep_minutes > 0).length)')" = "10" ] && ok "ten sample recipes ship, each with a prep time" || bad "sample recipes missing"
echo "$HB" | grep -q '"prep_minutes":' && ok "the dropdown fills the prep time too" || bad "prep time not carried to the dropdown"
echo "$HB" | grep -q '<option value="chili-non-carne"' && ok "the dropdown offers the book's recipes" || bad "recipes missing from the dropdown"
echo "$HB" | grep -q 'id="recipe-book"' && ok "the book is carried for the dropdown" || bad "recipe data missing"
curl -s -b $A -X POST -d "day=4" -d "LUNCH_recipe=chili-non-carne" -d "LUNCH_name=Chili Non Carne" -d "LUNCH_kcal=468" \
  -d "LUNCH_protein_g=22.85" -d "LUNCH_fat_g=16.55" -d "LUNCH_carb_g=37.88" -d "LUNCH_fiber_g=20" -d "LUNCH_sugar_g=18.41" -d "LUNCH_sodium_mg=1425.89" \
  -d "LUNCH_co2e=0.5351" -d "LUNCH_wfp=979" -d "BREAKFAST_name=Custom porridge" -d "BREAKFAST_recipe=__empty" -d "BREAKFAST_kcal=400" \
  -o /dev/null $B/control/meals
node -e '
const d = require(process.env.CONTENT_DIR + "/meals.json")["4"];
const l = d.find((m) => m.slot === "LUNCH"), b = d.find((m) => m.slot === "BREAKFAST");
process.exit(l.recipe === "chili-non-carne" && l.nutrients.protein_g === 22.85 && l.co2e_kg === 0.5351 && l.water_footprint_l === 979 && !b.recipe && !b.nutrients ? 0 : 1);
' && ok "a recipe-filled slot saves its recipe, nutrients, CO2e and water footprint; a custom one saves none" || bad "meal recipe figures not saved"
sleep 1.5
GL=$(curl -s $B/at-a-glance); echo "$GL" | grep -q "0.535" && echo "$GL" | grep -q "Protein 22.9 g" && ok "the figures are public in At a Glance" || bad "recipe figures not in At a Glance"
curl -s -b $A "$B/control?tab=habitat&day=4" | grep -q '<option value="chili-non-carne" selected' && ok "the slot reopens on its recipe" || bad "slot does not remember its recipe"
curl -s -b $A -X POST -d "day=7" -d "LUNCH_recipe=millet-root-vegetables" -d "LUNCH_name=Millet with Roasted Root Vegetables" -d "LUNCH_kcal=450" -d "LUNCH_prep=40" \
  -d "LUNCH_protein_g=11.6" -d "LUNCH_fat_g=11.8" -d "LUNCH_carb_g=74.8" -d "LUNCH_fiber_g=9.9" -d "LUNCH_sugar_g=10.2" -d "LUNCH_sodium_mg=410.6" \
  -d "LUNCH_co2e=0.237" -d "LUNCH_wfp=366" -o /dev/null $B/control/meals
MK=$(curl -s -b $A "$B/control?tab=habitat&day=7" | grep -o 'class="f was-edited"><span>[^<]*' | sed 's/.*<span>//' | tr '\n' '|')
[ "$MK" = "kcal|" ] && ok "choosing a recipe is not marked as a change; only the value altered after it is (kcal)" || bad "wrong fields marked after a recipe choice: $MK"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' -X POST -d "count=0" $B/control/recipes)" = "404" ] && ok "the book cannot be edited from the desk" || bad "the recipe editor route still answers"
MB=$(node -e 'console.log(JSON.stringify(require(process.env.CONTENT_DIR + "/recipes.json").recipes.map((r) => r.slug)))')
curl -s -b $A -X POST -d "day=6" -d "DINNER_recipe=__empty" -d "DINNER_name=Improvised stew" -d "DINNER_kcal=500" -d "DINNER_protein_g=20" -o /dev/null $B/control/meals
[ "$(node -e 'console.log(JSON.stringify(require(process.env.CONTENT_DIR + "/recipes.json").recipes.map((r) => r.slug)))')" = "$MB" ] \
  && node -e 'const d = require(process.env.CONTENT_DIR + "/meals.json")["6"].find((m) => m.slot === "DINNER"); process.exit(d.name === "Improvised stew" && d.nutrients.protein_g === 20 && !d.recipe ? 0 : 1);' \
  && ok "a slot filled by hand is saved for its day and adds no recipe" || bad "hand-filled slot wrong, or it touched the book"

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
curl -s $B/at-a-glance | grep -q "Hatch seal and pressure hold" && ok "authored schedule is live" || bad "schedule missing"
node -e 'const d = require("./content/meals.json"); process.exit(Object.keys(d).some((k) => /^\d+$/.test(k)) ? 1 : 0);' \
  && ok "the food plan ships empty" || bad "meals.json ships with days in it"
node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/meals.json";
const d = JSON.parse(fs.readFileSync(p, "utf8")); d["2"] = [{ slot: "DINNER", recipe: "black-bean-soup" }]; fs.writeFileSync(p, JSON.stringify(d, null, 2));'
sleep 2
curl -s $B/at-a-glance | grep -q "Black Bean Soup" && ok "a meal written into the file by recipe is live, named from the book" || bad "meals missing"
node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/meals.json";
const d = JSON.parse(fs.readFileSync(p, "utf8")); delete d["2"]; fs.writeFileSync(p, JSON.stringify(d, null, 2));'
sleep 2
curl -s $B/at-a-glance | grep -q "Black Bean Soup" && bad "a day taken out of meals.json kept its meals" || ok "a day taken out of the file loses its meals"
curl -s $B/ | grep -q "PLACEHOLDER\|Cue:" && bad "the placeholder marker or a writer's cue reached the public station" || ok "placeholder slots are shown publicly by their first line only; the marker and the cues stay inside"
curl -s -b $A -X POST -d "day=$((TODAY + 1))" -d "designation=COMMUNICATION OFFICER" -d "back=comms" --data-urlencode "body=Written ahead of its day." -o /dev/null $B/control/logbook
curl -s $B/logbook | grep -q "Written ahead of its day." && ok "an entry written for a day ahead is public at once — the log does not wait for the clock" || bad "an entry written ahead is not public"
curl -s $B/at-a-glance | grep -q "Written ahead of its day." && ok "and its day in At a Glance shows it too" || bad "entry written ahead missing from At a Glance"
for d in 1 7 13; do curl -s -b $A "$B/control?tab=health&day=$d" | grep -q "day $(printf %03d $d)" || bad "the Daily Blog cannot be opened for day $d"; done
CTRLPAGE=$(curl -s -b $A "$B/control?tab=comms")
echo "$CTRLPAGE" | grep -q 'daypick-dates' && [ "$(echo "$CTRLPAGE" | grep -o 'title="Mission day 0[0-9][0-9]"' | sort -u | wc -l)" = "13" ] \
  && ok "the day picker shows the run's actual dates, 15 to 27 October" || bad "day picker not dated"
echo "$CTRLPAGE" | grep -q 'href="/">Public station' && bad "the Public station button is still on mission control" || ok "no Public station button on mission control"
echo "$CTRLPAGE" | grep -q 'class="officer-stack"' && ok "an officer's blocks stack in one column, the blog first and full width" || bad "officer blocks are still in a grid"
echo "$CTRLPAGE" | grep -q 'class="blog-box"' && grep -q "textarea.blog-box { min-height: 340px" public/station.css && ok "the blog boxes are tall enough to write in" || bad "blog boxes not enlarged"
[ "$(echo "$CTRLPAGE" | grep -o 'data-day="[0-9]*"' | sort -u | wc -l)" = "13" ] \
  && ok "every officer tab offers all thirteen days of the run" || bad "the day picker does not offer thirteen days"
curl -s -b $A -X POST -d "day=2" -d "designation=COMMUNICATION OFFICER" -d "back=comms" --data-urlencode "body=First full sleep period logged." -o /dev/null $B/control/logbook
curl -s $B/logbook | grep -q "First full sleep period logged." && ok "writing over a placeholder publishes the entry for its day" || bad "written entry not public"
curl -s -b $A -X POST -d "day=2" -d "designation=COMMUNICATION OFFICER" -d "back=comms" -d "action=clear" -d "body=ignored" -o /dev/null $B/control/logbook
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
curl -s $B/media | grep -q "West wall at dawn" && bad "the crew's media leak onto /media — that page is the cloud gallery only" || ok "the crew's photograph is not on /media (that page is the cloud gallery only)"
curl -s $B/at-a-glance | grep -q "West wall at dawn" && ok "and on its day in At a Glance" || bad "not in At a Glance"
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
curl -s -b $A $B/archive/export.pdf -o /tmp/record2.pdf
grep -aq "/Subtype /Image" /tmp/record2.pdf && ok "the PDF record carries the photograph itself" || bad "no image in the PDF record"
pdftext /tmp/record2.pdf | grep -q "$PSHA" && ok "and lists it with its full hash" || bad "hash missing from the PDF media index"
[ -f "$DATA_DIR/media/manifest.json" ] && node tools/verify-media.js "$DATA_DIR/media" >/dev/null && ok "manifest.json sits beside the files and tools/verify-media.js checks it" || bad "on-disk manifest or verify tool failed"
# an entry with media attached, through the plain form (no script)
curl -s -b $A -F "day=$((TODAY - 1))" -F "designation=COMMUNICATION OFFICER" -F "back=comms" -F "body=Entry with a photograph." -F "media_caption=Attached to the entry" -F "file=@/tmp/e2e-photo.png" -o /dev/null -w '%{redirect_url}' $B/control/logbook | grep -q "tab=comms" \
  && ok "an officer can send media with a blog entry" || bad "blog post with a file failed"
LOGX=$(curl -s $B/logbook)
echo "$LOGX" | grep -q "Entry with a photograph." && echo "$LOGX" | grep -q "Attached to the entry" && ok "the entry and its media are public together" || bad "entry or its media missing from /logbook"
echo "$LOGX" | grep -A12 "Entry with a photograph." | grep -q 'class="entry-figure' && ok "and the media is set into the entry as a figure" || bad "media not attached to the entry on the page"
# the blogs under the trend graph are read in place: they scroll, and nothing in them is a link
curl -s -b $A -F "day=$((TODAY + 1))" -F "designation=COMMUNICATION OFFICER" -F "back=comms" -F "body=Commander post written for tomorrow." -o /dev/null $B/control/logbook
curl -s -b $A -F "day=$TODAY" -F "designation=COMMUNICATION OFFICER" -F "back=comms" -F "body=Commander post with a photograph." -F "file=@/tmp/e2e-photo.png" -o /dev/null $B/control/logbook
CB=$(panel blog-commander)
echo "$CB" | grep -q "Commander post with a photograph." && echo "$CB" | grep -q '<figure class="entry-figure kind-image"[^>]*><img ' \
  && ok "a photograph stands in today's post in the Commander Blog, shown rather than linked" || bad "photo missing from the Commander Blog, or wrapped in a link"
echo "$CB" | grep -q "Commander post written for tomorrow" && bad "a post for another day is in the Commander Blog" || ok "the Commander Blog shows the current day's post only"
echo "$CB" | grep -q 'class="blog-scroll"' && [ "$(echo "$CB" | grep -o 'class="card log-entry"' | wc -l)" = "1" ] && ok "one post, in a scroller inside the panel" || bad "the Commander Blog is not one post in a scroller"
for P in blog-science blog-health blog-commander; do panel $P | grep -q '<a ' && bad "$P has a link that leads off the page"; done; ok "nothing in the three blog panels is a link — they are read in place, not clicked out of"
curl -s $B/logbook | grep -q "Commander post written for tomorrow" && ok "the other days' posts are on the crew log, where they were" || bad "tomorrow's post missing from the crew log"
curl -s -b $A -X POST -d "day=$TODAY" -d "designation=COMMUNICATION OFFICER" -d "action=clear" -d "body=x" -o /dev/null $B/control/logbook
curl -s -b $A -X POST -d "day=$((TODAY + 1))" -d "designation=COMMUNICATION OFFICER" -d "action=clear" -d "body=x" -o /dev/null $B/control/logbook
curl -s -b $A $B/archive/export.pdf -o /tmp/record3.pdf
[ "$(pdftext /tmp/record3.pdf | grep -c "Entry with a photograph.")" -ge 2 ] && ok "the entry's text is in the PDF twice: in its day and in the whole crew log" || bad "blog text missing from the PDF"
curl -s $B/ | grep -q "PLACEHOLDER" && bad "a placeholder marker reached the station" || ok "placeholder markers never reach the station"
curl -s $B/ | grep -q "Potable water" && ok "inventory names come from the file" || bad "inventory names missing"

node -e '
const fs=require("fs"),p=process.env.CONTENT_DIR+"/schedule.json";
const d=JSON.parse(fs.readFileSync(p));
d["1"][0].label="EDITED FROM THE FILE";
fs.writeFileSync(p,JSON.stringify(d,null,2));'
sleep 2
curl -s $B/at-a-glance | grep -q "EDITED FROM THE FILE" \
  && ok "editing a file changes the site without a restart" || bad "file edit did not apply"

node -e '
const fs=require("fs"),p=process.env.CONTENT_DIR+"/inventory-levels.json";
const d=JSON.parse(fs.readFileSync(p));
d["1"]=Object.assign(d["1"]||{},{water:{quantity:444,consumption:46}});
fs.writeFileSync(p,JSON.stringify(d,null,2));'
sleep 2
curl -s -b $A $B/archive/day/1 | grep -q "444" && ok "a count written into the file reaches the record" || bad "inventory edit did not apply"
curl -s -b $A $B/archive/day/3 | grep -q "left carried" && ok "a day with no count shows the tab's figure marked carried, not as a count" || bad "the record does not mark a carried figure"
curl -s -b $A $B/archive/day/1 | grep -q "left counted" && ok "and a counted figure marked counted" || bad "the record does not mark a counted figure"

# Control and the file are the same record now: whichever wrote last wins.
curl -s -b $A -X POST -d "day=4" -d "designation=COMMUNICATION OFFICER" --data-urlencode "body=WRITTEN FROM CONTROL." -o /dev/null $B/control/logbook
node -e '
const d=require(process.env.CONTENT_DIR+"/logbook.json");
process.exit(d["4"] && d["4"]["COMMUNICATION OFFICER"]==="WRITTEN FROM CONTROL." ? 0 : 1);' \
  && ok "an entry written from control lands in logbook.json" || bad "control entry not in the file"
node -e '
const fs=require("fs"),p=process.env.CONTENT_DIR+"/logbook.json";
const d=JSON.parse(fs.readFileSync(p));
d["4"]["COMMUNICATION OFFICER"]="EDITED IN THE FILE AFTERWARDS.";
fs.writeFileSync(p,JSON.stringify(d,null,2));'
sleep 2
curl -s $B/at-a-glance | grep -q "EDITED IN THE FILE AFTERWARDS" \
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
USES=$(curl -s $B/ | grep -o 'use-[a-z]*' | sort -u | wc -l)
[ "$USES" = "9" ] && ok "and the daily use of every store (9)" || bad "only $USES daily-use series"
MISSING=""
for S in meal-kcal meal-water meal-power act-tasks act-messages act-exchanges act-entries act-media calories steps; do
  curl -s $B/ | grep -q "id&quot;:&quot;$S&quot;" || MISSING="$MISSING $S"
done
[ -z "$MISSING" ] && ok "meals, crew figures and the day's activity are all on the graph" || bad "missing from the trend spec:$MISSING"
curl -s $B/ | grep -q 'data-axis-run="1"' && curl -s $B/ | grep -q "data-axis-start=\"$MISSION_START\"" && ok "during the run the trend axis is the run, SOL 01 to 13" || bad "trend axis is not the run"

echo "── sensors"
curl -s -X POST -H "Authorization: Bearer ${SENSOR_TOKEN:-test-token}" -H "Content-Type: application/json" \
  -d '{"deviceId":"hab-01","readings":[{"metric":"temperature","value":23.7,"unit":"C"},{"metric":"oxygen","value":20.9,"unit":"%"}]}' \
  $B/api/sensors/ingest | grep -q '"stored":2' && ok "ingest accepted 2 readings" || bad "ingest failed"
curl -s $B/api/sensors/latest | grep -q '"metric":"oxygen"' && ok "unknown metric auto-registered" || bad "oxygen not registered"
curl -s -b $A $B/archive/day/$TODAY/export.md | grep -A 400 "Every reading of the day" | grep -q "| 23.7 |\|23.7 |" && ok "every reading is printed in the day's record, value as stored" || bad "the ingested reading is not in the record"
curl -s -b $A $B/archive/day/$TODAY | grep -q "EVERY READING" && ok "and on the archive's day page" || bad "readings missing from the day page"
curl -s -b $A $B/archive/export.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);const day=d.days.find(x=>x.recorded&&x.readings&&x.readings.station.some(r=>r.temperature===23.7));process.exit(day?0:1);});' && ok "and in the JSON export, one entry per instant with a value per channel" || bad "readings missing from export.json"
[ "$(curl -s -X POST -H 'Authorization: Bearer wrong' -d '{}' -o /dev/null -w '%{http_code}' $B/api/sensors/ingest)" = "401" ] \
  && ok "ingest rejects a bad token" || bad "ingest auth failed"

echo "── the readings log"
[ "$(ls "$DATA_DIR"/readings/ingest/*/ 2>/dev/null | grep -c json)" -ge 1 ] && ok "every ingest is written as a JSON file the moment it arrives" || bad "no ingest file in the readings log"
[ "$(ls "$DATA_DIR"/readings/resources/*/ 2>/dev/null | grep -c json)" -ge 1 ] && ok "the stores are snapshotted from the content files" || bad "no resources snapshot"
[ "$(ls "$DATA_DIR"/readings/figures/*/ 2>/dev/null | grep -c json)" -ge 1 ] && ok "and so are the crew's figures" || bad "no figures snapshot"
RS_BEFORE=$(ls "$DATA_DIR"/readings/resources/*/ | grep -c json)
touch "$CONTENT_DIR/schedule.json"; sleep 3
[ "$(ls "$DATA_DIR"/readings/resources/*/ | grep -c json)" = "$RS_BEFORE" ] && ok "an unchanged reload does not write the same snapshot again" || bad "duplicate resources snapshot"
node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/inventory-levels.json";
const o = JSON.parse(fs.readFileSync(p, "utf8")); o["2"] = o["2"] || {}; o["2"].water = { quantity: 601, consumption: 39 }; fs.writeFileSync(p, JSON.stringify(o, null, 2));'
sleep 3
[ "$(ls "$DATA_DIR"/readings/resources/*/ | grep -c json)" -gt "$RS_BEFORE" ] && ok "a change to the stores writes a new snapshot" || bad "changed stores not snapshotted"
grep -l '"quantity_at_close": 601' "$DATA_DIR"/readings/resources/*/*.json >/dev/null && ok "and the snapshot carries the new figure" || bad "snapshot does not carry the change"
node -e '
const log = require("./src/lib/readings-log");
const f = log.list({ source: "ingest" }); const o = JSON.parse(require("fs").readFileSync(f[f.length - 1].path, "utf8"));
process.exit(o.source === "ingest" && o.pulledAt && Array.isArray(o.readings) && o.readings.some((r) => r.metric === "oxygen") ? 0 : 1);
' && ok "an ingest file holds the batch as it was posted, with the time it arrived" || bad "ingest file malformed"
curl -s -b $A -o /tmp/readings.zip -w '%{http_code}' $B/archive/readings.zip | grep -q 200 && python3 -c '
import zipfile, json, sys
z = zipfile.ZipFile("/tmp/readings.zip"); z.testzip()
names = z.namelist(); idx = json.loads(z.read("index.json"))
tables = idx.get("tables", [])
sys.exit(0 if "index.json" in names and "README.txt" in names and any(n.startswith("ingest/") for n in names) and all(t in names for t in tables) and "csv/ingest.csv" in tables and idx["counts"]["total"] == len(names) - 2 - len(tables) else 1)
' && ok "the whole log downloads as one ZIP with an index and its CSV tables, verified by Python" || bad "readings ZIP broken"
curl -s -b $A $B/archive/readings/ingest.csv | python3 -c '
import csv, sys
rows = list(csv.reader(sys.stdin))
sys.exit(0 if rows and rows[0][:3] == ["pulledAt", "deviceId", "metric"] and any(r[2] == "oxygen" and r[3] == "20.9" for r in rows[1:]) else 1)
' && ok "the ingest log downloads as one CSV row per reading posted" || bad "ingest CSV wrong"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/archive/readings/ingest.csv)" = "302" ] && ok "the CSV tables are control-only" || bad "readings CSV is public"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/archive/readings/nonsense.csv)" = "404" ] && ok "an unknown table is a 404" || bad "unknown CSV table not refused"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/archive/readings.zip)" = "302" ] && ok "the log is control-only" || bad "readings log is public"
curl -s -b $A $B/archive/readings.json | grep -q '"bySource"' && ok "and listed at /archive/readings.json" || bad "no readings listing"
curl -s -b $A $B/archive | grep -q 'href="/archive/readings.zip"' && ok "the archive page carries the download" || bad "no readings download on the archive page"
RL_BEFORE=$(find "$DATA_DIR/readings" -name '*.json' | wc -l)

echo "── notes mirror the file"
node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/notes.json";
const d = JSON.parse(fs.readFileSync(p)); d["1"] = [{ kind: "BROADCAST", body: "STALE NOTE FOR DAY ONE" }];
fs.writeFileSync(p, JSON.stringify(d, null, 2));'
sleep 3
curl -s $B/at-a-glance | grep -q "STALE NOTE FOR DAY ONE" && ok "a note added to notes.json is on At a Glance" || bad "note not loaded"
node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/notes.json";
const d = JSON.parse(fs.readFileSync(p)); delete d["1"];
fs.writeFileSync(p, JSON.stringify(d, null, 2));'
sleep 3
curl -s $B/at-a-glance | grep -q "STALE NOTE FOR DAY ONE" && bad "a day taken out of notes.json keeps its old notes on the station" || ok "a day taken out of notes.json loses its notes on the station too — the file is the notes"

echo "── the ticker is now"
curl -s $B/api/ticker | grep -q '"opensAt":"' && ok "/api/ticker says when the run opens, so an open page can count down to it" || bad "no opensAt on /api/ticker"
curl -s $B/ | grep -q 'data-opens="' && curl -s $B/ | grep -q 'data-phase="' && ok "the ticker carries the phase and the opening instant, and turns the page over when they move" || bad "ticker lacks phase/opens"
grep -q "window.location.reload" src/views/pages/public.js && grep -q "d.phase !== phase" src/views/pages/public.js && ok "a page left open into 15 October (or across a reset) reloads itself into the run" || bad "no turn-over on phase change"

echo "── three blogs, the hardware inside the Habitat, the imprint"
LANDING=$(curl -s $B/)
echo "$LANDING" | grep -q 'id="ftab-hardware"' && bad "the Habitat hardware tab is still in the folder" || ok "no Habitat hardware tab in the dashboard folder"
echo "$LANDING" | grep -q 'href="/imprint"' && ok "the foot links the station's own imprint page" || bad "no imprint link in the foot"
IMP=$(curl -s $B/imprint)
echo "$IMP" | grep -q "Lorenzstraße 19" && echo "$IMP" | grep -q "DE 143588970" && echo "$IMP" | grep -q "Kennzeichnung i.S.d. § 5 TMG" && echo "$IMP" | grep -q "Center for Art and Media" \
  && ok "the imprint page carries ZKM's details in German and English" || bad "imprint page incomplete"
# the cookie card greets with a callsign, and agreeing keeps exactly that one
CJ=/tmp/cookie-e2e.jar; rm -f $CJ
CARD=$(curl -s -c $CJ -b $CJ $B/)
OFFER=$(echo "$CARD" | grep -o 'name="callsign" value="[A-Z]*-[0-9]*"' | head -1 | grep -o '[A-Z]*-[0-9]*')
echo "$CARD" | grep -q "consent-cs\">$OFFER<" && ok "the cookie card says Welcome $OFFER" || bad "no callsign on the cookie card"
curl -s -c $CJ -b $CJ -d choice=yes -d "callsign=$OFFER" -d back=/ -o /dev/null $B/consent
curl -s -b $CJ $B/ | grep -q "$OFFER" && ok "agreeing keeps the greeted callsign" || bad "agreeing gave a different callsign"
LB3=$(curl -s $B/logbook)
for t in "Commander Blog" "Daily Science Findings" "Daily Health Blog"; do echo "$LB3" | grep -q "$t" || bad "the crew log is missing $t"; done
echo "$LB3" | grep -q 'class="cs">SCIENCE OFFICER\|class="cs">HEALTH OFFICER' && bad "an officer blog is still on the crew log" || ok "the crew log carries the three blogs and nothing else"

echo "── the hardware readings endpoint"
curl -s "$B/api/hardware/readings" | grep -q '"sensors":\[' && ok "/api/hardware/readings hands out the devices' readings as JSON" || bad "no hardware readings endpoint"
curl -s "$B/api/hardware/readings?hours=48" | grep -q '"since":"' && ok "and reaches back as far as asked" || bad "hours parameter ignored"

echo "── the page scripts"
for f in public/habitat.js public/board.js public/composer.js public/hardware.js public/cloud.js; do node --check $f || bad "$f does not parse"; done
# the translation helper must not share a name with any inner variable: a
# `var t = …` inside a drawing function shadows it and "t is not a function"
# takes the whole Trends panel down
node -e '
const s = require("fs").readFileSync("public/habitat.js", "utf8");
const helper = /var (\w+) = window\.t \|\|/.exec(s); if (!helper) process.exit(0);
const inner = new RegExp("\\bvar " + helper[1] + " = (?!window\\.t)");
process.exit(inner.test(s) ? 1 : 0);
' && ok "habitat.js keeps its translation helper clear of the drawing code (Trends draws)" || bad "habitat.js shadows its translation helper — Trends would be empty"

echo "── the cloud gallery"
curl -s $B/api/cloud | grep -q '"configured":false' && ok "the cloud bridge is off when CLOUD_POLL=false — no credentials, no folder" || bad "cloud bridge on in the suite"
curl -s $B/media | grep -q 'cloud-gallery' && bad "the gallery section shows without the bridge" || ok "no gallery section on /media until the bridge is configured"
curl -s $B/api/cloud | grep -q 'CLOUD_PASSWORD\|system_displays' && bad "the cloud status leaks credentials" || ok "the cloud status carries no credentials"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/media/cloud/0123456789abcdef)" = "404" ] && ok "an unknown cloud image is a 404" || bad "unknown cloud image not refused"
node -e '
const c = require("./src/lib/cloud"); const s = c.snapshot();
process.exit(!s.configured && typeof c.gallery === "function" && c.gallery().length === 0 ? 0 : 1);
' && ok "the bridge module loads and answers empty when off" || bad "cloud module broken"
grep -q "CLOUD_USER" docker-compose.yml && grep -q "CLOUD_PASSWORD" .env.example && ok "the cloud settings reach the container from .env" || bad "compose does not pass the cloud settings through"
mkdir -p /tmp/e2e-cloud/sub && cp /tmp/e2e-photo.png /tmp/e2e-cloud/a.png && cp /tmp/e2e-photo.png /tmp/e2e-cloud/sub/b.png && echo x > /tmp/e2e-cloud/notes.txt
CLOUD_POLL=true CLOUD_DIR=/tmp/e2e-cloud DATA_DIR=$(mktemp -d) node -e '
const c = require("./src/lib/cloud");
c.poll().then(() => { const g = c.gallery(); const s = c.snapshot();
  process.exit(s.mode === "dir" && g.length === 2 && g.every((x) => /^\/media\/cloud\/[0-9a-f]{16}$/.test(x.url)) && require("fs").existsSync(c.filePath(c.get(g[0].id))) ? 0 : 1); });
' && ok "a mounted folder (CLOUD_DIR) is read like the cloud — images copied, subfolders followed, other files skipped" || bad "CLOUD_DIR mode broken"
grep -q "CLOUD_DIR" docker-compose.yml && ok "and CLOUD_DIR reaches the container" || bad "CLOUD_DIR not passed through"
CLOUD_POLL=true CLOUD_DIR=/tmp/e2e-cloud CLOUD_CHECK_SECONDS=7 DATA_DIR=$(mktemp -d) node -e '
const c = require("./src/lib/cloud"); const s = c.snapshot();
process.exit(s.checkSeconds === 7 && typeof s.version === "string" ? 0 : 1);
' && ok "the frequency is one number, CLOUD_CHECK_SECONDS, and the grid carries a version stamp" || bad "frequency setting not honoured"
grep -q 'data-version' src/views/pages/media.js && grep -q "fetch('/api/cloud'" public/cloud.js && grep -q "CLOUD_CHECK_SECONDS" docker-compose.yml \
  && ok "an open /media polls /api/cloud on that beat and swaps the grid in as the folder changes" || bad "live gallery wiring missing"
node -e '
const M = require("./src/views/pages/media");
const T = (s) => s;
const it = (id, date, time) => ({ id, name: `p_${date.replace(/-/g, "_")}-${time.replace(":", "-")}.jpg`, url: "/media/cloud/" + id, thumb: "/media/cloud/" + id + "/thumb", taken: { date, time, iso: date + "T" + time } });
const items = [it("a1", "2026-09-22", "12:15"), it("b2", "2026-09-24", "19:40"), it("c3", "2026-09-24", "11:05")];
const html = M.cloudGridInner(T, { title: "Gallery", items, snapshot: { checkSeconds: 20, version: "v" } },
  { tz: "Europe/Berlin", mission: { start_date: "2026-09-21", totalDays: 13, today: "2026-09-24" }, lang: "en" });
const days = [...html.matchAll(/class="cloud-day" data-day="([^"]+)"/g)].map((m) => m[1]);
const ok = days.join() === "2026-09-24,2026-09-22"
  && /SOL 04<\/span><h3 class="cloud-day-date">Thursday,? 24 September 2026<\/h3><span class="cloud-day-now">Today/.test(html) && /SOL 02</.test(html)
  && /2 photographs/.test(html) && />19:40</.test(html) && !/24\.09\.2026 · 19:40/.test(html);
process.exit(ok ? 0 : 1);
' && ok "the Media page shows the pictures day by day, the newest day first — each under its sol and its date, today marked, the time under each picture" || bad "the gallery is not grouped by day"
grep -q "querySelector('.cloud-days')" public/cloud.js && grep -q "function reconcileGrid(oldGrid, newGrid)" public/cloud.js \
  && ok "and keeps them live day by day, a picture at a time" || bad "the live gallery does not know the days"
grep -q 'id="cloud-latest"' src/views/pages/public.js && grep -q "cloud-latest" public/cloud.js && grep -q "slice(0, 6)" src/server.js && grep -q "Live images from the Habitat" src/views/pages/media.js \
  && ok "the Habitat panel carries Live images from the Habitat — the newest six from the cloud, on the same live beat" || bad "live-images strip missing"
curl -s $B/ | grep -q 'cloud-latest' && bad "the latest strip shows without the bridge" || ok "no latest strip on the landing page until the bridge is configured"

echo "── at a glance"
GLA=$(curl -s $B/at-a-glance)
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/at-a-glance)" = "200" ] && ok "At a Glance is a public page" || bad "/at-a-glance broken"
echo "$GLA" | grep -q 'id="day-1"' && echo "$GLA" | grep -q 'id="day-13"' && ok "it carries every day of the run, in day order" || bad "days missing from At a Glance"
for block in "Blogs" "Exchanges with Earth" "Meals" "Consumption" "Habitat" "Schedule"; do
  echo "$GLA" | grep -qi "$block" || bad "At a Glance missing: $block"
done
ok "each day holds the blogs, the exchanges, the schedule, the meals, the consumption and the habitat"
echo "$GLA" | grep -q 'class="glance-tile"' && ok "the day's habitat is drawn as dashboard tiles, mean large with the day's range" || bad "no habitat tiles in At a Glance"
echo "$GLA" | grep -q "In colour, and always outdoors." && ok "a published exchange is on it" || bad "exchange missing from At a Glance"
echo "$GLA" | grep -q "PLACEHOLDER" && bad "a placeholder cue leaked to At a Glance" || ok "no placeholder cues leak"
echo "$GLA" | grep -q "calm_tense" && bad "raw mood values leaked to At a Glance" || ok "crew condition appears as sentences, never numbers"
U=$(echo "$GLA" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log((s.match(/<table>/g)||[]).length-(s.match(/<div class="tw"><table>/g)||[]).length)})')
[ "$U" = "0" ] && ok "every table on it scrolls instead of clipping" || bad "$U unwrapped tables on At a Glance"
echo "$GLA" | grep -q 'class="booklet"' && echo "$GLA" | grep -q 'class="bk-page" id="day-1"' && ok "it is a booklet: one day per page, turned by scrolling sideways" || bad "no booklet structure"
echo "$GLA" | grep -q 'id="bk-prev"' && echo "$GLA" | grep -q 'id="bk-next"' && echo "$GLA" | grep -q 'id="bk-counter"' && ok "with arrows either side and a page counter" || bad "booklet controls missing"
grep -q "scroll-snap-type: x mandatory" public/station.css && ok "pages snap, so a swipe lands on a whole day" || bad "no scroll snap"
echo "$GLA" | grep -qF 'day-(\d+)' && ok "a #day-n link opens the booklet on that day" || bad "hash landing broken"
curl -s $B/ | grep -q 'class="glance-link" href="/at-a-glance"' && ok "the At a Glance button is on the mission dashboard" || bad "no At a Glance button on the landing page"
curl -s $B/ | grep -q 'class="glance-link media-link" href="/media"' && ok "and the Media button beside it" || bad "no Media button on the mission dashboard"
node -e '
const h = require("child_process").execSync("curl -s http://localhost:8080/").toString();
process.exit(h.indexOf("glance-link") > -1 && h.indexOf("glance-link") < h.indexOf("id=\"habitat\"") ? 0 : 1);
' && ok "and it sits above the Habitat panel" || bad "At a Glance is not above the Habitat"
# the ticker's running line is in the page twice (that is how it loops); the
# dashboard figures must not add a third
[ "$(curl -s $B/ | grep -o 'One-way signal' | wc -l)" = "2" ] && ok "the one-way signal is off the dashboard figures — only the ticker names it" || bad "one-way signal still on the dashboard"
curl -s $B/ | grep -q '>At a Glance<' && ok "and the footer navigation carries it" || bad "At a Glance missing from the nav"

echo "── everything archived"
curl -s -b $A $B/archive | grep -q "day by day" && ok "archive contents page lists the mission" || bad "no archive contents"
DAYN=$(curl -s -b $A $B/archive | grep -oE "archive/day/[0-9]+" | tail -1 | grep -oE "[0-9]+")
REC=$(curl -s -b $A $B/archive/day/$DAYN)
MISSING=""
for section in "COMMANDING OFFICER" "SCIENCE OFFICER" "HEALTH OFFICER" "Commander Blog" "Daily Science Findings" "Daily Health Blog" "Crew state" "SCHEDULE" "MEALS" "INVENTORY LEVELS" "STEPS TAKEN" "POWER" "HABITAT"; do
  echo "$REC" | grep -q "$section" || MISSING="$MISSING $section"
done
[ -z "$MISSING" ] && ok "day record has the three officers, the Habitat tab and the sensors" \
  || bad "day record missing:$MISSING"
echo "$REC" | grep -q "hw-chart" && bad "the day record still draws a chart" || ok "the day record draws no chart"
curl -s -b $A $B/archive/export.json | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  const d=JSON.parse(s);
  const need=["schedule","meals","storesCounted","crewFigures","power","notes","crewEntries","crewStates","habitat","readings"];
  const day=d.days.find(x=>x.recorded&&x.crewEntries.length)||d.days[0];
  const ahead=d.days[d.days.length-1];
  process.exit(need.every(k=>k in day)&&d.crew.length&&ahead.recorded===false&&!("schedule" in ahead)?0:1);
});' && ok "full export carries every strand" || bad "export incomplete"

echo "── mobile"
curl -s $B/ | grep -q "width=device-width, initial-scale=1" && ok "viewport declared" || bad "no viewport meta"
U=$(curl -s -b $A $B/archive/day/$DAYN | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  console.log((s.match(/<table>/g)||[]).length - (s.match(/<div class="tw"><table>/g)||[]).length);
});')
[ "$U" = "0" ] && ok "every table scrolls instead of clipping" || bad "$U unwrapped tables"
grep -q "min-height: 44px" public/station.css && ok "touch targets meet 44px" || bad "touch targets too small"

echo "── the landing page: the design handoff's four pages (P01–P04) in the glass dress, on a phone and on a desk"
LAND=$(curl -s $B/)
echo "$LAND" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const at = (x) => s.indexOf(x);
  const order = ["class=\"sheet-intro is-desk\"", "id=\"habitat-dome\"", "id=\"note\"", "class=\"sheet-intro is-phone\"", "class=\"note-card\"", "id=\"story\"", "id=\"slowest-chat\"", "id=\"write\""].map(at);
  process.exit(order.every((v, i) => v > -1 && (i === 0 || v > order[i - 1])) ? 0 : 1);
});' && ok "P01 the name and the habitat (on a phone the name heads the note), P02 the note, P03 the chapters, P04 the slowest chat — then the portal" || bad "the sheet's pages are out of order"
! echo "$LAND" | grep -q 'P01 / 04' && ! echo "$LAND" | grep -q 'Mission layout' && ! echo "$LAND" | grep -q 'Ref. sheet' && echo "$LAND" | grep -q '<span>P02 / 04 · Note 00</span>' \
  && echo "$LAND" | grep -q '<span class="part-tag"><span>P03 / 04</span><b>Part 1 of 2</b></span>' && echo "$LAND" | grep -q '<span class="part-tag"><span>P04 / 04</span><b>Part 2 of 2</b></span>' \
  && echo "$LAND" | grep -q '<h2 class="part-title" id="part-1-title">The mission</h2>' && echo "$LAND" | grep -q '<h2 class="part-title" id="ch-03-title">Welcome to the World’s Slowest Chat</h2>' \
  && ok "no P01 label over the habitat; the note is P02; the mission and the chat are the two parts, each under a bold heading with its part in an orange pill" || bad "the pages' labels or the two parts' headings are wrong"
[ "$(echo "$LAND" | grep -o ' data-page>' | wc -l)" = "4" ] && ok "the four pages are marked as the pages of a phone's scroll" || bad "the phone's pages are not marked"
! echo "$LAND" | grep -q 'masthead-btn' && ok "no Write or Mission doors on the first screen" || bad "the doors are still on the first screen"
echo "$LAND" | grep -q 'class="sheet-cta" href="/messages#write"' && grep -q 'body.landing .p4-cta { display: none; }' public/sheet.css \
  && ok "the door to the composer closes the sheet on a phone, and a wider screen goes on to the portal instead" || bad "the slowest chat's door is wrong"
PHONESHEET=$(awk '/^@media \(max-width: 760px\) and \(min-height: 521px\) \{/,/^}/' public/sheet.css)
! echo "$LAND" | grep -q 'section-scroll.js' && echo "$PHONESHEET" | grep -q 'html:has(body.landing:not(.inner)) { scroll-snap-type: y mandatory;' \
  && echo "$PHONESHEET" | grep -q 'body.landing:not(.inner) \[data-page\] { scroll-snap-align: start; scroll-snap-stop: always; }' \
  && [ "$(grep -c 'scroll-snap-type: y' public/sheet.css)" = "1" ] && grep -q "p.classList.add('is-tall')" public/sky.js && grep -q "window.addEventListener('wheel'" public/sky.js \
  && ok "a phone held upright goes a page a swipe (a page taller than the screen stops at its parts; a wheel turns one stop a turn); a desk scrolls freely" || bad "the phone's pages do not snap"
echo "$LAND" | grep -q 'id="dome-sky-data"' && echo "$LAND" | grep -q 'src="/sky.js' && ok "the sky is drawn into the habitat's sheet and set going by public/sky.js" || bad "no sky over the dome"
echo "$LAND" | grep -q 'class="dome-panel has-sky has-line"' && ok "with exchanges to show, the dome panel keeps the room above the dome" || bad "no room kept for the sky"
grep -q "function spot(w, h)" public/sky.js && grep -q "function clash(a, b)" public/sky.js && grep -q "function inDome(a, c)" public/sky.js && grep -q "ci \* col + INSET" public/sky.js \
  && grep -q "body.landing .sky-msg, body.landing .sky-pic { opacity: 0; animation: none !important; transition: opacity 1.2s ease-in-out; }" public/sheet.css \
  && ok "each line and snapshot comes somewhere else each time, on a column of the grid, clear of the dome and of one another — fading in and out" || bad "the sky's items can crowd one another"
PUB=$(curl -s $B/api/board)
curl -s -b $V $B/ | PUB="$PUB" node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const m = s.match(/id="dome-sky-data">([^<]*)</); if (!m) process.exit(1);
  const sky = JSON.parse(m[1]), cards = JSON.parse(process.env.PUB).cards.replace(/\s+/g, " ");
  const q = sky.msgs.filter((x) => x.k === "q"), a = sky.msgs.filter((x) => x.k === "a");
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\x27/g, "&#39;");
  const onBoard = (t) => cards.includes(esc(t.replace(/…$/, "")).slice(0, 40));
  const off = sky.msgs.filter((x) => !onBoard(x.text));
  if (off.length) console.error("    not on the public board:", JSON.stringify(off));
  process.exit(q.length >= 1 && q.length <= 4 && a.length >= 1 && !off.length ? 0 : 1);
});' && ok "the sky carries the newest published exchanges and their answers — nothing the public board does not show" || bad "the sky shows something the board does not"
curl -s -b $V $B/ | PUB="$PUB" node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const m = s.match(/id="hab-line-data">([^<]*)</); if (!m) process.exit(1);
  const pool = JSON.parse(m[1]), cards = JSON.parse(process.env.PUB).cards;
  const ids = pool.ex.map((p) => p[0].id).concat(pool.old.map((x) => x.id));
  const published = ids.every((id) => cards.includes("id=\"m" + id + "\"") && !new RegExp("id=\"m" + id + "\"[^>]*data-pending").test(cards));
  const first = s.match(/class="hab-line-item"><span class="hab-line-meta">([^<]*)</);
  process.exit(published && pool.ex.length <= 3 && pool.data.length === 3 && !pool.data.some((d) => /distance/i.test(d.meta)) && pool.now && first && first[1] === "Now in the habitat" ? 0 : 1);
});' && ok "the line under the dome opens with what is happening now and takes turns through the figures, the last answered exchanges and older ones — published only" || bad "the line under the dome is wrong"
grep -c "fetch(" public/sky.js | grep -qx 1 && grep -q "data-field=\"comms-text\"" public/sky.js && grep -q "cloud-latest" public/sky.js && grep -q "MCS_SKY_NOW" public/sky.js \
  && ok "it asks the board again only when the dome says there is a new exchange, follows the Habitat panel's strip of pictures, and the line passes over what the sky shows" || bad "the sky polls on its own"
echo "$LAND" | grep -q 'For this simulation, the transmission takes <b>3 seconds</b>' && echo "$LAND" | grep -q 'animation-duration:3s' && echo "$LAND" | grep -q 'class="transit" aria-hidden="true" data-seconds="3"' && ok "the slowest chat gives the crossing as the station runs it (TRANSIT_SECONDS)" || bad "the crossing time is not the station's"
grep -q "document.documentElement.classList.add('transit-js')" public/sky.js && grep -q "html.transit-js body.landing .steps .transit-track i { animation: none !important; }" public/sheet.css \
  && ok "the signal's dot is moved by the page itself, so a phone set to less motion still sees it cross" || bad "the signal in transit can stand still on a phone"
echo "$LAND" | grep -Eq 'today it takes <b>[0-9]+ min [0-9]{2} s</b>' && echo "$LAND" | grep -Eq 'class="transit-meta">[0-9]+ M km · [0-9]+ min [0-9]{2} s<' && ok "and today's distance and one-way light-time" || bad "no live distance or light-time"
echo "$LAND" | grep -Eq 'At <b>16:00 (CEST|CET)</b>, the communications window opens' && echo "$LAND" | grep -q 'Every day at 16:00, the Habitat opens its communication window' && ok "the crew answer from 16:00, in the venue's zone of the day" || bad "the communication window is not 16:00"
echo "$LAND" | grep -Eq 'Communication window daily <b>16:00</b>' && ok "and the running line says so" || bad "the running line does not name the window"
curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q 'Willkommen im langsamsten Chat der Welt' && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q 'Bienvenue dans le chat le plus lent du monde' \
  && ok "in German and French as well" || bad "the slowest chat is not translated"
SKYCSS=$(awk '/the sky over the habitat, and the world.s slowest chat/,0' public/aura.css)
grep -q '\.dome-sky, \.dome-seq, \.slow-chat { display: none; }' public/station.css && echo "$SKYCSS" | grep -q 'top: calc(12px - var(--room))' && echo "$SKYCSS" | grep -q ':has(dialog.dome-popup\[open\]) .dome-sky { opacity: 0; }' \
  && ok "the sky fills the room the dome keeps above itself on a desk, and steps aside while a pop-up is there; without the landing dress neither is drawn" || bad "the desk's sky is not wired"
echo "$LAND" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const f = s.indexOf("class=\"dome-foot\""), l = s.indexOf("id=\"hab-line\""), c = s.indexOf("class=\"dome-caption\"", f), e = s.indexOf("</section>", f);
  process.exit(f > -1 && l > f && c > l && e > c ? 0 : 1);
});' && grep -q 'body.landing .dome-panel.has-line .dome-seq { bottom: 0; }' public/sheet.css \
  && ok "the line under the dome turns on the floor under the ground line, the hint beside it" || bad "the line under the dome is out of place"
grep -q 'stepHead(.up., .01.' src/views/pages/landing.js && [ "$(echo "$LAND" | grep -o 'class="step-ic"' | wc -l)" = "3" ] \
  && ok "the three steps carry their signs, each in its own colour" || bad "the steps have no signs"
echo "$LAND" | grep -Eq 'On [0-9]+ [A-Z][a-z]+, three astronauts enter the Habitat at MARS!platz: a Commanding Officer, a Science Officer and a Health Officer. Life on Mars becomes the experiment.<' \
  && echo "$LAND" | grep -q 'Inside the Habitat, the crew lives under the conditions of a long-duration mission: isolation, limited space and resources. Each day brings new experiments — from growing food to resource management, EVAs, mental health, governance and understanding how people live together in an unfamiliar environment.' \
  && ! echo "$LAND" | grep -q 'a small outpost on a simulated Mars' && ! echo "$LAND" | grep -q 'Communicate with the crew.' \
  && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q 'und ein Gesundheitsoffizier. Das Leben auf dem Mars wird zum Experiment.' \
  && ok "the chapters say what they were given to say, in German too; no outpost, and nothing under the chat's welcome but the welcome" || bad "the chapters' words are not the ones given"
echo "$LAND" | grep -q 'src="/mission/mission-01.jpg"' && echo "$LAND" | grep -q 'src="/mission/mission-02.jpg"' && ! echo "$LAND" | grep -q 'mission-03' \
  && [ -s public/mission/mission-01.jpg ] && [ -s public/mission/mission-02.jpg ] \
  && ok "the two chapters carry the two new photographs; the chat has none" || bad "the chapters' photographs are wrong"
grep -q ':root\[data-theme="light"\] { --paper: #f6f7f8; --ground-2: #eceef1; }' public/sheet.css && grep -q 'body.landing .dome-panel { --seq-ground: #d7d7d7; }' public/sheet.css \
  && grep -q 'body.landing .sky-text { color: #fff;' public/sheet.css \
  && ok "by day the page is near-white and only the habitat's sheet is grey, the reference's grey, its lines of talk in white" || bad "the light page is not the reference's"

echo "── the habitat's sheet, the dome, the header, the theme, the foot, the cookie card, the running line"
LAND=$(curl -s $B/)
echo "$LAND" | grep -q 'class="dome-seq has-day" id="dome-seq" aria-hidden="true" style="--seq-days:13"' && [ "$(echo "$LAND" | grep -o 'class="seq-n[ "]' | wc -l)" = "13" ] \
  && [ "$(echo "$LAND" | grep -o 'class="seq-n is-now"' | wc -l)" = "1" ] && echo "$LAND" | grep -q 'class="seq-head" style="--day:5"' \
  && ok "the habitat stands on a sheet of the run's thirteen sols — the day of the performance marked, an orange line down its column" || bad "no sheet under the habitat"
! echo "$LAND" | grep -q 'DISTANCE [0-9.]* M KM' && echo "$LAND" | grep -Eq 'class="seq-fig"[^>]*>CH-00 · CREW 3 · SOL 05/13<' \
  && ! echo "$LAND" | grep -Eq 'class="seq-fig"[^>]*>[^<]*One-way' && ok "its one small figure is the crew and the sol — no Earth–Mars distance on the habitat" || bad "the sheet's figures are not the station's"
grep -q "seq.style.setProperty('--orb-r'" public/sky.js && echo "$LAND" | grep -q 'class="dome-aura-base"' && echo "$LAND" | grep -q '<linearGradient id="dome-aura-base" x1="0" y1="0" x2="1" y2="0">' \
  && ok "the colour fills the dome rim to rim — blue to violet to red — and spills softly onto the sheet around it" || bad "the dome is not filled with the colour"
echo "$LAND" | grep -q '<html lang="en" data-theme="dark">' && ! echo "$LAND" | grep -q 'data-theme-auto' \
  && [ "$(curl -s -H 'Cookie: mcs_theme=light' $B/ | grep -o '<html lang="en" data-theme="light">' | wc -l)" = "1" ] \
  && curl -s -D - -o /dev/null -d "to=light" $B/theme | grep -qi "set-cookie: mcs_theme=light" \
  && ok "the station is dark until a visitor chooses light with the switch, and keeps that choice" || bad "the station is not dark by default"
! echo "$LAND" | grep -q 'class="orbits"' && echo "$LAND" | grep -q 'class="consent-sky"' && ! echo "$LAND" | grep -q 'consent-astro\|consent-planet' \
  && ok "no orbits behind the page; the cookie card's strip of night has nobody in it and no planet" || bad "the orbits or the cookie card's astronaut are still there"
echo "$LAND" | grep -q '<div class="tk-bar">' && echo "$LAND" | grep -q 'class="tk-sol"' && echo "$LAND" | grep -q 'id="tk-clock"' \
  && ok "the header: the wordmark, the run's badge, the habitat's clock, the switches, the running line" || bad "the header is not the handoff's"
! grep -q 'border-radius: 0 !important' public/sheet.css && ! grep -q 'backdrop-filter: none !important' public/sheet.css \
  && grep -q 'border: 1px solid var(--glass-edge); box-shadow: var(--glass-shadow); border-radius: var(--r-lg); color: var(--ink);' public/sheet.css \
  && ok "the pages float on glass again — rounded, frosted, softly shadowed" || bad "the flat dress is still on"
grep -q '^body.landing .foot {' public/sheet.css && grep -q ':root\[data-theme="light"\] body.landing .foot {' public/sheet.css \
  && ok "the foot is a dark card with two lights by night and a pane of light glass by day" || bad "the foot is the same by day and by night"
PHONECSS=$(awk '/^@media \(max-width: 760px\), \(max-height: 520px\) \{/,/^}/' public/aura.css)
echo "$PHONECSS" | grep -q 'body.landing .dash > .cloud-latest { display: none; }' && grep -q "getElementById('cloud-latest')" public/sky.js \
  && ok "the dashboard on a phone leaves out the strip of live pictures (kept on the page for the sky)" || bad "the live pictures are still on the phone's dashboard"
grep -q '@media (hover: hover) and (pointer: fine) { .tk-window:hover .tk-track { animation-play-state: paused; } }' public/station.css \
  && grep -q 'body.landing .tk-track { animation: tk-run 64s linear infinite !important; }' public/aura.css \
  && grep -q "var phone = window.matchMedia('(max-width: 760px), (max-height: 520px)');" src/views/pages/public.js && grep -q "translate3d(' + x.toFixed(2)" src/views/pages/public.js \
  && ok "the running line runs on a phone — moved by the page itself, a tap does not hold it, and asking for less motion only slows it" || bad "the running line can stop on a phone"

echo "── power consumed by category, and the stores as rings"
LAND=$(curl -s $B/)
echo "$LAND" | grep -q "Power consumed" && echo "$LAND" | grep -q 'class="pwr-row' \
  && ok "the Habitat panel carries the day's power, a bar per category" || bad "no power tile on the landing page"
echo "$LAND" | grep -q 'pwr-total' && ok "the trend spec carries a Power group — each category and the total, daily" || bad "power not in the trends"
for c in Heating Food Lighting Electronics Other; do echo "$LAND" | grep -q "$c" || bad "power category missing from the landing page: $c"; done
ok "all five shipped categories are drawn: heating, food, lighting, electronics, other"
GLANCE=$(curl -s $B/at-a-glance)
echo "$GLANCE" | grep -q "Power consumed" && ok "each day of the booklet carries its power figures" || bad "no power block in At a Glance"
echo "$GLANCE" | grep -q 'gauges rounds' && echo "$GLANCE" | grep -q 'round-arc' \
  && ok "and the stores as rings — the arc is what is left of what was carried in" || bad "no resource rings in At a Glance"
curl -s -b $A "$B/control?tab=habitat" | grep -q 'name="name_heating"' && curl -s -b $A "$B/control?tab=habitat" | grep -q 'name="kwh_heating"' \
  && ok "the Habitat tab has the power form: a name and an amount per category" || bad "no power form in mission control"
# file a day and rename a category from mission control; both land in power.json and on the site
curl -s -b $A -d "day=2" -d "name_heating=Heating" -d "kwh_heating=1.4" -d "name_food=Food" -d "kwh_food=0.6" \
  -d "name_lighting=Lighting" -d "kwh_lighting=0.3" -d "name_electronics=Electronics" -d "kwh_electronics=0.5" \
  -d "name_other=Greenhouse" -d "kwh_other=0.2" -o /dev/null $B/control/power
node -e '
const o = JSON.parse(require("fs").readFileSync(process.env.CONTENT_DIR + "/power.json", "utf8"));
const d = o.days["2"] || {};
process.exit(d.heating === 1.4 && d.other === 0.2 && o.categories.some((c) => c.key === "other" && c.label === "Greenhouse") ? 0 : 1);
' && ok "saving writes content/power.json — the day's kWh and the renamed category" || bad "the power save did not reach the file"
curl -s $B/at-a-glance | grep -q "Greenhouse" && ok "the rename reaches At a Glance" || bad "renamed category not shown"
curl -s $B/ | grep -q "Greenhouse" && ok "and the landing page" || bad "renamed category not on the landing page"
curl -s -b $A $B/archive/export.pdf -o /tmp/record-pwr.pdf
PWRTXT=$(pdftext /tmp/record-pwr.pdf)
echo "$PWRTXT" | grep -q "Power consumed" && echo "$PWRTXT" | grep -q "Greenhouse" \
  && ok "the full record PDF carries the power figures, per day" || bad "power missing from the PDF record"
curl -s -b $A $B/archive/export.json | grep -q '"label":"Greenhouse","kwh":0.2' && ok "and the JSON export carries each day's kWh by category, as filed" || bad "power missing from export.json"
curl -s -b $A $B/archive/export.md | grep -q "Power consumed" && ok "and the Markdown record" || bad "power missing from export.md"
curl -s -b $A $B/archive/day/2 | grep -q "CH-35 / POWER" && ok "and the archive's day page" || bad "power missing from the archive day"

echo "── the whole habitat on every At a Glance day"
grep -q "'pres', 'bat', 'rssi'" src/server.js && grep -q "Node battery" src/views/pages/glance.js && grep -q "Signal.*dBm" src/views/pages/glance.js \
  && ok "every node channel is summarised per day — battery and signal included" || bad "bat/rssi missing from the At a Glance summary"
curl -s -b $A -d "day=2" -d "calories=5010" -d "steps=6420" -o /dev/null $B/control/crew-figures
GLA2=$(curl -s $B/at-a-glance)
echo "$GLA2" | grep -q "Calories consumed" && echo "$GLA2" | grep -q "Steps taken" && echo "$GLA2" | grep -q "crew total · counted that day" \
  && ok "the day's calories and steps stand in the habitat tile bank, beside the sensors" || bad "crew figures missing from the At a Glance habitat"
echo "$GLA2" | grep -q "5,010" && ok "with the figures as filed — day 2 carries 5,010 kcal" || bad "the filed figure is not shown"
# every reading of the day, as data points across its 24 hours
node -e '
const a = require("./src/lib/archive"), db = require("./src/db").db;
const start = Date.parse(a.windowFor(2).start);
const ins = db.prepare("INSERT OR IGNORE INTO external_reading (t, co2, temp, sig) VALUES (?, ?, ?, ?)");
for (let i = 0; i < 24; i++) ins.run(start + i * 3600000, 600 + i * 3, 21 + (i % 5) / 10, "glance-" + i);
'
GLA3=$(curl -s $B/at-a-glance)
echo "$GLA3" | grep -q 'class="glance-chart"' && echo "$GLA3" | grep -q 'gc-dot' \
  && ok "the day's readings are drawn whole — one chart per channel, each pull a data point" || bad "no per-day reading charts in At a Glance"
echo "$GLA3" | grep -q 'CO₂: every reading of the day' && [ "$(echo "$GLA3" | grep -o 'gc-dot' | wc -l)" -ge 48 ] \
  && ok "day 2 carries all 24 CO₂ and 24 temperature points across its 24 hours" || bad "the day's node readings are not all plotted"
echo "$GLA3" | grep -q 'OXYGEN: every reading of the day' && ok "the station's own ingest is plotted the same way" || bad "ingest readings not plotted"
echo "$GLA3" | grep -q '00:00' && echo "$GLA3" | grep -q '12:00' && ok "the axis is the day, gridded every six hours, habitat time" || bad "no day axis on the charts"
echo "$GLA3" | grep -q 'id="today"' && bad "a rehearsal page is showing during the run" || ok "during the run there is no rehearsal page — the booklet is the record alone"

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

echo "── the rehearsal page, before the run"
GLR=$(curl -s $B/at-a-glance)
echo "$GLR" | grep -q 'id="today"' && ok "before the run the booklet opens on a rehearsal page — today's readings as a preview" || bad "no rehearsal page during pre-launch"
echo "$GLR" | grep -q 'REHEARSAL · NOT THE RECORD' && echo "$GLR" | grep -q 'disappears on 15 October' \
  && ok "and it says plainly it is not the record and goes on 15 October" || bad "the rehearsal page is not marked as a preview"
echo "$GLR" | grep -q 'data-day="0"' && echo "$GLR" | grep -q '>NOW<' && ok "the day strip carries NOW ahead of D01–D13" || bad "no NOW link in the day strip"
echo "$GLR" | node -e '
let s = ""; process.stdin.on("data", (d) => s += d).on("end", () => {
  const i = s.indexOf("id=\"today\"");
  process.exit(i > -1 && s.indexOf("glance-chart", i) > -1 ? 0 : 1);
});' && ok "and it carries today's pulled readings, point by point" || bad "no data on the rehearsal page"
echo "$GLR" | node -e '
let s = ""; process.stdin.on("data", (d) => s += d).on("end", () => {
  const a = s.indexOf("id=\"today\""), b = s.indexOf("id=\"day-1\"");
  if (a < 0 || b < a) process.exit(1);
  const page = s.slice(a, b);
  const need = ["Schedule", "Meals", "Consumption", "Power consumed", "gauges rounds", "Habitat"];
  process.exit(need.every((x) => page.includes(x)) ? 0 : 1);
});' && ok "the rehearsal page is a complete day page — schedule, meals, consumption rings, power and habitat, the real feel of SOL 001" || bad "the rehearsal page is missing day blocks"

echo "── start again for 15 October"
grep -q "copyFileSync" src/lib/content.js && bad "content.js still uses fs.copyFile, which fails with EPERM on a Docker bind mount from Windows" || ok "the plan is copied by read-and-write, so reset works on a mounted content/ folder"
# a content file lost while the plan still has it comes back at start-up
node -e '
const fs = require("fs"), path = require("path");
const dir = process.env.CONTENT_DIR, f = "crew-and-inventory.json";
fs.unlinkSync(path.join(dir, f));
require("./src/lib/content").ensurePlan();
process.exit(fs.existsSync(path.join(dir, f)) ? 0 : 1);
' && ok "a missing content file is restored from the plan at start-up" || bad "missing content file was not restored"
# Last, because it wipes the station. The files in content/ are the plan;
# the reset empties the blog slots, clears everything written live and
# reloads the mission from the files — so a rehearsal leaves nothing behind
# for 15 October. content/plan/ is a snapshot kept as a backup.
[ "$(ls "$CONTENT_DIR/plan" 2>/dev/null | wc -l)" -ge 9 ] && ok "a snapshot of the files was saved at boot" || bad "no content/plan/ after boot"
curl -s -b $A -F "designation=COMMUNICATION OFFICER" -F "day=3" -F "body=Rehearsal words that must not survive" -F "back=comms" -o /dev/null $B/control/logbook
curl -s $B/logbook | grep -q "Rehearsal words" && ok "a rehearsal entry is live before the reset" || bad "rehearsal entry not written"
# the inventory file as edited now is what the reset reloads — not a stale copy
node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/inventory-levels.json", d = process.argv[1];
const o = JSON.parse(fs.readFileSync(p, "utf8")); o[d] = o[d] || {}; o[d].water = { quantity: 555, consumption: 40 }; fs.writeFileSync(p, JSON.stringify(o, null, 2));' "$TODAY"
sleep 2
# readings the node reports from before the run are never stored
node -e '
const c = require("./src/lib/critical");
const r = c.persist([{ t: c.floorMs() - 3600000, co2: 700, temp: 21, hum: 40, light: 1, pres: 1000, bat: 4, rssi: -70 },
                     { t: c.floorMs() + 3600000, co2: 701, temp: 21, hum: 40, light: 1, pres: 1000, bat: 4, rssi: -70 }]);
process.exit(r.before === 1 && r.stored === 1 ? 0 : 1);
' && ok "the external node's readings from before the run are dropped; from the run on they are kept" || bad "readings before the run were stored"
curl -s $B/api/habitat/data | grep -q '"floor":' && ok "the readings API names the instant readings count from" || bad "no floor in the habitat data"
# a node that has gone quiet: everything it has is older than the floor, so the floor moves back and its last days are kept
node -e '
const c = require("./src/lib/critical"), db = require("./src/db").db;
const newest = c.floorMs() - 2 * 86400000;
const rows = []; for (let i = 0; i < 30; i++) rows.push({ t: newest - i * 3600000, co2: 500, temp: 20, hum: 40, light: 1, pres: 1000, bat: 4, rssi: -70 });
rows.sort((a, b) => a.t - b.t);
const r = c.persist(rows);
process.exit(r.stored === 30 && c.floorMs() <= newest - c.DAYS_BEFORE * 86400000 + 1000 && c.rows(365).length >= 30 ? 0 : 1);
' && ok "after a build, a node silent for longer than the floor still shows its last three days — the floor moves back rather than hide everything" || bad "a quiet node's readings were hidden by the floor"
node -e '
const c = require("./src/lib/critical");
c.setFloor("test", "run");
const f = c.floorMs();
c.persist([{ t: f - 86400000, co2: 1, temp: 1, hum: 1, light: 1, pres: 1, bat: 1, rssi: 1 }]);
const kept = c.floorMs() === f && c.rows(365).every((r) => r.t >= f);
c.applyBuild("test-build-C");
process.exit(kept ? 0 : 1);
' && ok "but a floor set to the run never moves back — nothing from before 15 October is kept" || bad "the run floor moved"
curl -s $B/api/habitat/data | grep -q '"nodeNewest":' && ok "the readings API reports the node's newest reading, so the page can say SIGNAL LOST" || bad "no nodeNewest in the habitat data"
node -e '
const c = require("./src/lib/critical");
process.exit(c.anchorMs() === c.floorMs() && c.anchorMs() <= Date.now() ? 0 : 1);
' && ok "the day the readings were started again is kept — after a build, the trend axis starts there before the run" || bad "no readings anchor"
grep -q "data-axis-run" public/habitat.js && grep -q "win.run ? (s.planned" public/habitat.js && ok "before the run the graph carries the node from today on and no plan lines" || bad "pre-run axis not handled in habitat.js"
grep -q "No current reading from the sensor node" public/habitat.js && grep -q "carries no readings for node" public/habitat.js && ok "the habitat panel explains empty tiles instead of showing dashes" || bad "no explanation for empty tiles"
grep -q "function clearTiles" public/habitat.js && grep -q "!isCurrent()" public/habitat.js && grep -q "staleAfterMs: 30 \* 60 \* 1000" public/habitat.js && grep -q "newest >= dayStart()" public/habitat.js \
  && ok "the tiles show today's readings only while the newest is under thirty minutes old — otherwise nothing" || bad "stale or yesterday's readings would be shown as live"
grep -q "midnight at the top" public/habitat.js && grep -q "(p.t - day0) / DAY" public/habitat.js \
  && ok "the CO₂ dial is a 24-hour cycle — each reading at its time-of-day angle, midnight at the top" || bad "the CO₂ dial is not on the 24-hour clock"
curl -s $B/ | grep -q 'data-day-start="[0-9]' && ok "the page carries the venue's midnight, so today is the venue's today on every phone" || bad "no day start on the page"
grep -q "CRITICAL_SENSOR_ID" docker-compose.yml && grep -q "READINGS_DAYS_BEFORE" docker-compose.yml && ok "the feed and readings settings in .env reach the container" || bad "compose does not pass the feed settings through"
# a newly built image starts the readings from today (midnight at the venue); the same image again does not move them
node -e '
const c = require("./src/lib/critical"), db = require("./src/db").db;
const moved = c.applyBuild("test-build-A");
const f1 = c.floorMs(), today = f1 === c.todayStartMs() - c.DAYS_BEFORE * 86400000;
const again = c.applyBuild("test-build-A");
db.prepare("INSERT OR IGNORE INTO external_reading (t, co2, sig) VALUES (?, 1, ?)").run(f1 - 1000, "old");
c.applyBuild("test-build-B");
const dropped = db.prepare("SELECT COUNT(*) n FROM external_reading WHERE t < ?").get(c.floorMs()).n === 0;
process.exit(moved && today && !again && dropped && c.floorMode() === "build" ? 0 : 1);
' && ok "a new build starts the readings from today; the same build again leaves them; older readings go" || bad "build stamp did not move the readings floor as expected"
# the lock: from 15 October the reset is refused, unless this is a rehearsal
node -e '
const c = require("./src/lib/content");
const wasOverride = process.env.MISSION_OVERRIDE; delete process.env.MISSION_OVERRIDE;
const locked = c.resetLocked({ phase: "ACTIVE" }) && c.resetLocked({ phase: "COMPLETE" }) && !c.resetLocked({ phase: "PRE_LAUNCH" });
process.env.MISSION_OVERRIDE = wasOverride;
const rehearsal = !c.resetLocked({ phase: "ACTIVE" });
process.exit(locked && rehearsal ? 0 : 1);
' && ok "the reset is locked from 15 October, and never during a rehearsal" || bad "reset lock wrong"
curl -s -b $A $B/control | grep -q 'id="reset-open"' && curl -s -b $A $B/control | grep -q 'id="reset-dialog"' \
  && ok "the reset button opens a dialog that asks for the word" || bad "no reset dialog"
curl -s -b $A $B/control | grep -q 'name="confirm"' && ! curl -s -b $A $B/control | grep -q 'name="confirm" value="RESET"' \
  && ok "the word is typed, never prefilled" || bad "RESET is prefilled"
BEFORE=$(curl -s $B/api/status | grep -o '"total":[0-9]*' | head -1)
curl -s -b $A -d "confirm=nope" -o /dev/null $B/control/reset
[ "$(curl -s $B/api/status | grep -o '"total":[0-9]*' | head -1)" = "$BEFORE" ] && ok "reset without the word RESET does nothing" || bad "reset ran without confirmation"
curl -s -b $A -d "confirm=RESET" -o /dev/null $B/control/reset
curl -s $B/api/status | grep -q '"total":0' && ok "reset clears every message from Earth" || bad "messages survived the reset"
curl -s $B/logbook | grep -q "Rehearsal words" && bad "the rehearsal entry survived the reset" || ok "the rehearsal entry is gone from the crew log"
grep -q "Rehearsal words" "$CONTENT_DIR/logbook.json" && bad "the rehearsal entry survived in logbook.json" || ok "logbook.json holds no entry"
[ "$(grep -c PLACEHOLDER "$CONTENT_DIR/logbook.json")" -ge 13 ] && ! grep -q "SCIENCE OFFICER\|HEALTH OFFICER" "$CONTENT_DIR/logbook.json" && ok "every Commander Blog slot is empty — 13 placeholders, no other officer's" || bad "placeholders missing after reset"
curl -s -b $A "$B/control?tab=habitat" | grep -q "The station has been reset for 15 October" && ok "mission control reports the reset" || bad "no reset report"
curl -s -b $A "$B/control?tab=habitat" | grep -q "Start again from 15 October" && ok "the reset panel is on the Habitat tab" || bad "no reset panel"
curl -s -b $A -o /dev/null -w '%{http_code}' $B/control | grep -q 200 && ok "the sign-in survives the reset" || bad "signed out by the reset"
curl -s $B/ | grep -q 'class="gauges' && ok "the inventory is rebuilt" || bad "no gauges after reset"
node -e 'const d = require(process.env.CONTENT_DIR + "/inventory-levels.json"); process.exit(Object.keys(d).some((k) => /^\d+$/.test(k)) ? 1 : 0);' \
  && ! curl -s $B/at-a-glance | grep -q ">555 " && ok "and the counted stores are emptied — the edited count is gone, the stores start from what was carried in" || bad "a counted store survived the reset"
[ "$(curl -s $B/api/habitat/data | grep -o '"t":' | wc -l)" = "0" ] && ok "every habitat reading is gone — the node refills the last three days on its next poll" || bad "readings survived the reset"
node -e '
const c = require("./src/lib/critical");
process.exit(c.floorMs() === c.runStartMs() && c.floorMode() === "run" ? 0 : 1);
' && ok "after the reset the readings start on the first day of the run" || bad "reset did not move the readings floor to the run"
curl -s $B/ | grep -q 'data-axis-run="1"' && ok "and the trend graph is the run from the reset on" || bad "trend axis not the run after reset"
curl -s $B/api/habitat/data | grep -q '"epoch":"20' && ok "the readings API carries the reset epoch, so phones drop their cached rows" || bad "no epoch after reset"
node -e '
const db = require("./src/db").db;
process.exit(db.prepare("SELECT COUNT(*) n FROM crew_mood").get().n === 0 ? 0 : 1);
' && ok "every crew state is cleared — the crew begin with nothing filed" || bad "crew states survived the reset"
node -e '
const o = JSON.parse(require("fs").readFileSync(process.env.CONTENT_DIR + "/crew-figures.json", "utf8"));
process.exit(Object.keys(o).some((k) => /^\d+$/.test(k)) ? 1 : 0);
' && ok "the crew figures are emptied — calories and steps are filed daily from the run on" || bad "crew figures survived the reset"
node -e '
const o = JSON.parse(require("fs").readFileSync(process.env.CONTENT_DIR + "/power.json", "utf8"));
process.exit(Object.keys(o.days || {}).length === 0
  && o.categories.some((c) => c.key === "other" && c.label === "Greenhouse") ? 0 : 1);
' && ok "the power days are emptied and the categories kept — each day's kWh is filed from the run on" || bad "power.json not reset as it should be"
LAND=$(curl -s $B/)
echo "$LAND" | grep -q 'planned&quot;:{&quot;' && bad "the trend graph still carries plan points after the reset" || ok "the trend graph carries no plan after the reset — every day ahead is null until it is filed"
echo "$LAND" | grep -q "nothing recorded" && ok "the calories and steps tiles read nothing recorded until the first figures are filed" || bad "figure tiles not empty after reset"
curl -s $B/ | grep -q "angry, needing distance" && bad "an old state is still public" || ok "no old state reaches the station"
[ "$(find "$DATA_DIR/readings" -name '*.json' | wc -l)" -ge "$RL_BEFORE" ] && ok "the readings log survives the reset — nothing in it is ever deleted" || bad "the reset touched the readings log"

echo "── after 27 October nothing is updated by automation"
grep -q "2026-10-27T23:59:59+01:00" src/lib/critical.js \
  && ok "the node is not polled after the end of 27 October 2026 — the run's last day" || bad "critical.js does not close the record on 27 October"
grep -q "freezeDate: '2026-10-27'" public/habitat.js && grep -q "2026-10-27T23:59:59+01:00" public/habitat.js \
  && ok "the habitat page stops asking for readings at the same moment" || bad "habitat.js freeze date is not 27 October"
[ "$(grep -c 'critical.frozen()' src/server.js)" -ge 3 ] \
  && ok "ingest, pruning and the rollup timer all check the closed record" || bad "server.js does not guard its automation on the freeze"
grep -q "automation has ended" src/server.js && ok "the rollup timer shuts itself down once every day is sealed" || bad "the rollup timer never ends"

# A closed record, end to end: a second station whose freeze is already past.
DATA2=$(mktemp -d); CONT2=$(mktemp -d); cp content/*.json "$CONT2"/
DATA_DIR="$DATA2" CONTENT_DIR="$CONT2" node src/db/seed.js > /dev/null 2>&1
DATA_DIR="$DATA2" CONTENT_DIR="$CONT2" PORT=8090 CRITICAL_FREEZE_AT=2001-01-01T00:00:00Z \
  MISSION_START=$(date -u -d '-20 days' +%F) MISSION_END=$(date -u -d '-8 days' +%F) \
  node src/server.js > /tmp/srv-frozen.log 2>&1 &
SRV2=$!
sleep 3
B2=http://localhost:8090
[ "$(curl -s -X POST -H "Authorization: Bearer $SENSOR_TOKEN" -H 'Content-Type: application/json' \
    -d '{"deviceId":"x","readings":[{"metric":"co2","value":500}]}' -o /dev/null -w '%{http_code}' $B2/api/sensors/ingest)" = "410" ] \
  && ok "a reading sent after the close is refused (410), token or not" || bad "ingest still stores after the record closed"
curl -s $B2/api/habitat/data | grep -q '"frozen":true' && ok "the readings API says the record is frozen" || bad "no frozen flag after the close"
curl -s $B2/ | grep -q "Mission complete" && ! curl -s $B2/ | grep -q 'class="ticker"' \
  && ok "after the run the landing page is the closed record — no ticker, nothing fetching" || bad "the landing page still carries the live ticker after the close"
grep -q "data-over" src/views/pages/public.js && grep -q "d.phase === 'COMPLETE'" src/views/pages/public.js \
  && ok "a page left open across the last midnight stops its own timers when the run ends under it" || bad "an open ticker would keep fetching forever after the run"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B2/logbook)" = "200" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' $B2/at-a-glance)" = "200" ] \
  && ok "reading never stops — the pages keep serving the record" || bad "the record stopped serving"
kill $SRV2 2>/dev/null; wait $SRV2 2>/dev/null
DATA_DIR="$DATA2" CONTENT_DIR="$CONT2" CRITICAL_FREEZE_AT=2001-01-01T00:00:00Z node -e '
const c = require("./src/lib/critical"), db = require("./src/db").db;
db.prepare("INSERT OR IGNORE INTO external_reading (t, co2, sig) VALUES (?, 1, ?)").run(Date.parse("2000-06-01"), "run-era");
const before = db.prepare("SELECT COUNT(*) n FROM external_reading").get().n;
const moved = c.applyBuild("post-close-build");
const after = db.prepare("SELECT COUNT(*) n FROM external_reading").get().n;
process.exit(!moved && after === before ? 0 : 1);
' && ok "a Docker image built after the close does not move the floor — the run's readings stay" || bad "a rebuild after the close touched the readings"
rm -rf "$DATA2" "$CONT2"

echo "── the habitat sensor through Home Assistant"
# A third station against a stand-in Home Assistant (tools/mock-home-assistant.js)
# that answers for the M5 ENV Pro's seven entities: the Habitat panel's
# readings come from it — full rows, every channel, the classification as
# text — and every consumer of the table reads them as it read the node's.
DATA3=$(mktemp -d); CONT3=$(mktemp -d); cp content/*.json "$CONT3"/
node tools/mock-home-assistant.js 8125 > /tmp/mockha.log 2>&1 &
MOCK=$!
sleep 1
DATA_DIR="$DATA3" CONTENT_DIR="$CONT3" node src/db/seed.js > /dev/null 2>&1
DATA_DIR="$DATA3" CONTENT_DIR="$CONT3" PORT=8083 CRITICAL_POLL=true HABITAT_SOURCE=auto HABITAT_POLL_MS=15000 \
  HA_HOST=localhost HA_PORT=8125 HA_API_TOKEN=test-token HA_POLL=false node src/server.js > /tmp/srv3.log 2>&1 &
SRV3=$!
sleep 6
B3=http://localhost:8083
HAB=$(curl -s "$B3/api/habitat/data?days=1")
echo "$HAB" | grep -q '"source":"home-assistant"' && ok "with Home Assistant configured and the entities mapped, the habitat is read from the sensor" || bad "source is not home-assistant"
echo "$HAB" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const d = JSON.parse(s); const r = d.rows[d.rows.length - 1] || {};
  const ok = d.rows.length > 10 && ["co2", "temp", "hum", "pres", "light", "voc", "iaq"].every((k) => typeof r[k] === "number") && /polluted|Excellent|Good/.test(String(r.iaqc));
  process.exit(ok ? 0 : 1);
});' && ok "every row carries CO₂, temperature, humidity, pressure, light in lux, VOC, the IAQ index and its classification as text" || bad "the sensor's rows are incomplete"
echo "$HAB" | grep -q '"bat":null' && echo "$HAB" | grep -q '"rssi":null' && ok "the node's own channels (battery, signal) are empty, not invented" || bad "battery or signal not null"
echo "$HAB" | grep -q '"pollMs":15000' && echo "$HAB" | grep -q '"staleMs":300000' && ok "the station tells the page how often it reads and how fresh is fresh" || bad "cadence not served"
echo "$HAB" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const d = JSON.parse(s); const e = d.entities || {};
  process.exit(e.co2 && e.co2.id === "m5_env_pro_env_pro_co2_equivalent" && e.iaqc && e.iaqc.state && !e.iaqc.missing ? 0 : 1);
});' && ok "each channel's entity is reported as Home Assistant last returned it" || bad "entities missing from the feed"
LAND3=$(curl -s $B3/)
echo "$LAND3" | grep -q 'id="hbt-pres"' && echo "$LAND3" | grep -q 'id="hbt-light"' && echo "$LAND3" | grep -q '<em>lx</em>' && ok "air pressure has a tile of its own and the light is back, in lux" || bad "pressure or light tile missing"
echo "$LAND3" | grep -q 'id="hbt-iaq"' && echo "$LAND3" | grep -q 'id="hbt-voc"' && echo "$LAND3" | grep -q 'id="iaqVerdict"' && ok "the air quality and VOC tiles are on the panel, the classification as the verdict" || bad "new tiles missing"
curl -s -c /tmp/a3.jar -b /tmp/a3.jar -o /dev/null -X POST -d "username=control&password=control123" $B3/control/login
GL3=$(curl -s -b /tmp/a3.jar $B3/at-a-glance)
echo "$GL3" | grep -q 'Air quality index' && echo "$GL3" | grep -q 'VOC' && ok "the booklet summarises the new channels with the rest" || bad "booklet lacks the new channels"
DAY3=$(curl -s -b /tmp/a3.jar "$B3/archive/day/$(curl -s $B3/api/status | node -e 'let s="";process.stdin.on("data",(c)=>s+=c).on("end",()=>process.stdout.write(String(JSON.parse(s).missionDay||1)))')")
echo "$DAY3" | grep -q 'Volatile organic compounds' && echo "$DAY3" | grep -q 'Air quality index' && echo "$DAY3" | grep -q 'Air quality class' && ok "the archive's day page carries them with the rest, the classification as text" || bad "the day page lacks the new channels"
curl -s -b /tmp/a3.jar $B3/archive/readings/habitat.csv | python3 -c '
import csv, sys
rows = list(csv.reader(sys.stdin))
sys.exit(0 if rows and rows[0] == ["pulledAt", "at", "t", "co2", "temp", "hum", "pres", "light", "voc", "iaq", "iaqc"] and len(rows) > 10 and any("polluted" in r[10] or r[10] in ("Excellent", "Good") for r in rows[1:]) else 1)
' && ok "the readings log keeps every stored row, with the classification, and hands it over as CSV" || bad "habitat CSV wrong"
[ "$(ls "$DATA3"/readings/habitat/*/ 2>/dev/null | grep -c json)" -ge 1 ] && ok "every poll of the sensor is a JSON file in readings/habitat/" || bad "no habitat poll files"
curl -s -b /tmp/a3.jar -o /tmp/record3.pdf -w '%{http_code}' $B3/archive/export.pdf | grep -q 200 && pdftext /tmp/record3.pdf > /tmp/record3.txt && grep -q "the habitat sensor" /tmp/record3.txt && ok "the PDF record names the habitat sensor as the source" || bad "PDF does not name the sensor"
echo "$LAND3" | grep -q 'id="tk-hab"' && ok "the ticker still carries the habitat's reading" || bad "ticker lost the habitat"
kill $SRV3 2>/dev/null; wait $SRV3 2>/dev/null
kill $MOCK 2>/dev/null; wait $MOCK 2>/dev/null
rm -rf "$DATA3" "$CONT3"

echo
[ $FAIL -eq 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $FAIL
