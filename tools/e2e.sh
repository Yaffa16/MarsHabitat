#!/usr/bin/env bash
# End-to-end check of the whole station.
set -u
cd "$(dirname "$0")/.."

export TRANSIT_SECONDS=${TRANSIT_SECONDS:-3}
export SENSOR_TOKEN=${SENSOR_TOKEN:-test-token}
export DEFAULT_LANG=en                          # the site opens in German (i18n.pick); the suite reads it in English
# The suite needs a running mission of the real length — thirteen days, like
# 15–27 October — so it runs one that started four days ago. It also builds
# its own database in a temp directory, so running the tests never touches
# the station's real data.
export CRITICAL_POLL=${CRITICAL_POLL:-false}   # keep the suite off the network
export CLOUD_POLL=false HA_POLL=${HA_POLL:-false}
# the screens' door, for its own checks below: off unless both are set (the station ships without them — no password on the screens)
export SCREENS_USER=${SCREENS_USER:-panolab} SCREENS_PASSWORD=${SCREENS_PASSWORD:-panolab123}
export CLOUD_QUIET=off          # the cloud's night (22:00–08:00, src/lib/cloud.js) is tested with a fake clock below; the other cloud checks run at any hour
export MISSION_OVERRIDE=true    # a rehearsal: the real dates are fixed in src/lib/run.js
export MISSION_START=${MISSION_START:-$(date -u -d '-4 days' +%F)}
export MISSION_END=${MISSION_END:-$(date -u -d '+8 days' +%F)}
export HOURLY_LIMIT=${HOURLY_LIMIT:-60}   # the suite posts many messages from one address; the station's own six an hour would saturate it
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
panel() { curl -s $B/dashboard | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const i = s.indexOf("id=\"" + process.argv[1] + "\""); process.stdout.write(i < 0 ? "" : s.slice(i, s.indexOf("</section>", i))); });' "$1"; }

echo "── visitor identity"
CS=$(curl -s -c $V -b $V $B/ | grep -o 'name="callsign" value="[A-Z]*-[0-9]*"' | head -1 | grep -oE '[A-Z]+-[0-9]+')
[ -n "$CS" ] && ok "a callsign is offered on arrival: $CS" || bad "no callsign"

echo "── writing: the composer is the Write page's pop-up, nowhere else"
for u in / /write /dashboard /about /media /at-a-glance /logbook; do curl -s $B$u | grep -q 'id="composer"' && curl -s $B$u | grep -q '<section class="portal portal-pop" id="write"' && curl -s $B$u | grep -q '<a class="write-float" href="#write" id="write-fab" aria-controls="write" aria-expanded="false">' || bad "the composer's pop-up or the floating Write key is missing on $u"; done
ok "the composer's pop-up and the floating Write key are on every public page — the mission page, the Write page, the dashboard, About, Media, At a Glance, the crew log"
node -e '
const h = require("child_process").execSync("curl -s http://localhost:8080/write").toString();
const w = h.indexOf("<section class=\"wall-sec\""), p = h.indexOf("<section class=\"portal portal-pop\" id=\"write\""), f = h.indexOf("class=\"write-float\""), foot = h.indexOf("<div class=\"foot\"");
process.exit(w > -1 && p > w && f > p && (foot < 0 || foot > f) ? 0 : 1);
' && ok "the pop-up and the floating key stand after the page's own body, before the foot — over the page on the screen" || bad "communication is not the lead element"

echo "── the habitat in section: on the About page, before Who we are, every module a key with its pop-up, two keys on the ground in front — no sheet under it"
DOME=$(curl -s $B/about)
echo "$DOME" | grep -q 'id="habitat-dome"' && [ "$(echo "$DOME" | grep -o '<rect class="in-room" data-hex="[a-z]*"' | wc -l)" = "13" ] && [ "$(echo "$DOME" | grep -o '<g class="dome-hex in-key" data-hex="[a-z]*"' | wc -l)" = "2" ] && [ "$(echo "$DOME" | grep -o '<dialog class="popup dome-popup" id="dome-[a-z]*"' | wc -l)" = "14" ] \
  && ! echo "$DOME" | grep -q 'id="dome-seq"\|class="seq-grid"\|class="seq-ruler"\|class="dome-foot"\|id="habitat-page"\|id="cutaway"\|class="cut-svg"\|class="dome-aura"\|class="dome-mesh"' \
  && echo "$DOME" | grep -q '<image class="in-scene" href="/habitat/scene-lines.webp?v=1"' \
  && ok "the habitat in section on the Mars plain, with its thirteen modules, its two outside keys and their fourteen pop-ups, is on the About page — no sequencer's sheet, no ruler, no grid under it, nothing at its foot; the dome and the earlier cutaway are gone" || bad "the habitat is not drawn on the About page as it should be"
curl -s $B/api/dome | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const f = JSON.parse(s);
  process.exit(["crew", "science", "recycling", "aeroponics", "comms", "power", "generator", "eva", "dashboard", "sensors", "mission"].every((k) => f[k] && typeof f[k].text === "string") && /EVA/.test(f.eva.text) && /tasks done today/.test(f.dashboard.text) && /mission: .+\.$/.test(f.mission.text) && !/Mission No\./.test(f.mission.text) ? 0 : 1);
});' && ok "/api/dome returns every room's figure — the day's EVA from the schedule, the dashboard's sol and tasks, the day's mission by its title (no number), the sensors' reading" || bad "/api/dome incomplete"
curl -s $B/api/dome | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { process.exit(/[0-9]/.test(JSON.parse(s).crew.text) ? 1 : 0); });
' && ok "the crew's condition reaches the dome as words, never as numbers" || bad "a number in the crew callout"

curl -s -b $V -c $V -X POST --data-urlencode \
  "body=What is the first thing you miss about Earth?" -d "tags=QUESTION" -d "callsign=$CS" -o /dev/null $B/communicate
curl -s -b $V $B/write | grep -qi "message in transit" && ok "message in transit, shown in the Write page's pop-up" || bad "no transit view"

curl -s -b $V -X POST --data-urlencode "body=Should be blocked" -o /dev/null $B/communicate
# the counts are mission control's alone (October): /api/status carries the day and the phase and nothing counted,
# /control/counts the queue's counts and the tally, behind the sign-in
curl -s -c $A -X POST -d "username=${CONTROL_USER}" -d "password=${CONTROL_PASSWORD}" -o /dev/null $B/control/login
ST=$(curl -s $B/api/status)
echo "$ST" | grep -q '"missionDay":' && echo "$ST" | grep -q '"phase":"' && ! echo "$ST" | grep -q '"counts"\|"total"\|"visitors"' \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' $B/control/counts)" = "302" ] && curl -s -b $A $B/control/counts | grep -q '"tally":{"messages":1,"messagesDay":1,"visitors":' \
  && ok "/api/status says the day and the phase and counts nothing; the counts are at /control/counts, behind the sign-in" || bad "the counts are public, or /control/counts is not as it should be"
N=$(curl -s -b $A $B/control/counts | grep -oE '"total":[0-9]+' | cut -d: -f2)
[ "$N" = "1" ] && ok "transit lock holds server-side" || bad "transit lock failed (total=$N)"

sleep 4
curl -s -b $A $B/control/counts | grep -q '"pending":1' && ok "arrived and queued for review" || bad "did not settle to pending"

echo "── one login"
curl -s -c $A -X POST -d "username=${CONTROL_USER}" -d "password=${CONTROL_PASSWORD}" -o /dev/null $B/control/login
curl -s -b $A $B/control | grep -q "Awaiting reply" && ok "control signed in" || bad "sign-in failed"
# the tally (October: messages sent, total and per day, and visitors per day and total — in the archive, mission
# control's alone): the two totals and a table of the days at the venue, newest first, with the mission day where the
# date is the run's; not on the control page, not anywhere public
ARCH0=$(curl -s -b $A $B/archive); TALLY_DATE=$(TZ=Europe/Berlin date +%F)
echo "$ARCH0" | grep -q '<div class="tally" id="tally">' && echo "$ARCH0" | grep -q '<span class="tally-k">Messages sent</span><b class="tally-n">1</b><span class="tally-sub">total</span>' \
  && echo "$ARCH0" | grep -q '<span class="tally-k">Visitors</span><b class="tally-n">[1-9][0-9]*</b><span class="tally-sub">total</span>' \
  && echo "$ARCH0" | tr -d '\n' | grep -q '<table class="daylist tally-days">.*<th class="n">Messages sent</th><th class="n">Visitors</th>' \
  && echo "$ARCH0" | tr -d '\n' | sed 's/  */ /g' | grep -qE "<td class=\"n\">0[0-9]{2}</td> <td>$TALLY_DATE</td> <td class=\"n\">1</td> <td class=\"n\">[1-9][0-9]*</td>" \
  && ! echo "$ARCH0" | grep -q 'A visitor counts on the day' && [ "$(echo "$ARCH0" | tr -d '\n' | grep -o 'The mission, day by day.*Messages sent and visitors' | wc -l)" = "1" ] \
  && ! curl -s -b $A $B/control | grep -q 'class="tally"' && ! curl -s $B/ | grep -q 'class="tally"' && ! curl -s $B/write | grep -q 'class="tally"' && ! curl -s $B/dashboard | grep -q 'class="tally"' && ! curl -s $B/about | grep -q 'class="tally"' \
  && ! grep -q "MESSAGES SENT')}</dt>\|CALLSIGNS ISSUED')}</dt>" src/views/pages/public.js \
  && ok "the tally — messages sent and visitors, total and day by day — stands in the archive, under the downloads, and nowhere else (not on the control page, nowhere public)" || bad "the tally is not in the archive as it should be, or is shown elsewhere"
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
echo "$CTRL" | grep -qi "Daily Mission Report" || bad "no Daily Mission Report"
echo "$CTRL" | grep -qi "Health Report" || bad "no Health Report"
echo "$CTRL" | grep -q 'chan">DAILY MISSION<' || bad "no schedule editor"
node -e '
const h = require("child_process").execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control").toString();
const hab = h.indexOf("data-pane=\"habitat\"");
const sched = h.indexOf("chan\">DAILY MISSION<"), meals = h.indexOf("chan\">DAILY FOOD PLAN<"), inv = h.indexOf("chan\">INVENTORY<");
process.exit(sched > hab && meals > hab && inv > hab && h.indexOf("chan\">UPDATE<") === -1 && h.indexOf("/ ANOMALY") === -1
  && h.indexOf("data-pane=\"crewlog\"") === -1 && h.indexOf("class=\"tpl\"") === -1 ? 0 : 1);' \
  && ok "the Habitat tab holds the schedule, the food plan and the stores; no Crew log tab, no template buttons anywhere" || bad "habitat tab contents wrong, or the crew log tab / template buttons are still there"
[ "$(echo "$CTRL" | grep -c 'class="mood-face"')" = "15" ] || bad "expected five faces for each of three officers"
[ "$(echo "$CTRL" | grep -c 'chan">COMMANDER BLOG<')" = "1" ] && ok "one Commander Blog box — the communication officer's" || bad "expected exactly one Commander Blog box"
echo "$CTRL" | grep -q 'chan">DAILY BLOG<' && bad "a per-officer Daily Blog box is still on the desk" || ok "no other officer has a Daily Blog box"
[ "$(echo "$CTRL" | grep -c '</span>Commander Blog</h2>')" = "1" ] || bad "the blog box is not named Commander Blog"
[ "$(echo "$CTRL" | grep -c 'class="block-head"')" -ge 6 ] && ok "every block on the officer tabs opens with the same numbered head" || bad "officer blocks lack the shared head"
echo "$CTRL" | grep -q 'class="block-state ' && ok "each block says whether anything is live yet" || bad "no live/empty state on the officer blocks"
node -e '
const h = require("child_process").execSync("curl -s -b /tmp/admin.jar http://localhost:8080/control").toString();
const c = h.indexOf("data-pane=\"comms\""), s = h.indexOf("data-pane=\"science\""), he = h.indexOf("data-pane=\"health\""), hab = h.indexOf("data-pane=\"habitat\"");
const cb = h.indexOf("chan\">COMMANDER BLOG<");
const sr = h.indexOf("chan\">SCIENCE<", s), hr = h.indexOf("chan\">HEALTH<", he);
process.exit(cb > c && cb < s && sr > s && sr < he && hr > he && hr < hab && h.indexOf("Daily Mission Report", s) > s && h.indexOf("Health Report", he) > he ? 0 : 1);
' && ok "Commander Blog on the communication officer's tab, Daily Mission Report and Health Report on theirs" || bad "the three blogs are not on their tabs"
ok "every officer's findings, blog and state are editable from control"

ID=$(curl -s -b $A $B/control | grep -oE '/control/[0-9]+/reply' | head -1 | grep -oE '[0-9]+')
[ -n "$ID" ] && ok "message waiting in the queue" || bad "no message in the queue"
# the queue's latest at the top (October): the first card is the newest message waiting, the last the oldest
curl -s -b $A "$B/control?show=pending" | grep -oE '/control/[0-9]+/reply' | grep -oE '[0-9]+' | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const ids = s.trim().split(/\s+/).map(Number); const { db } = require("./src/db");
  const at = (id) => db.prepare("SELECT submitted_at FROM message WHERE id = ?").get(id).submitted_at;
  const sorted = ids.slice().sort((a, b) => at(b).localeCompare(at(a)) || b - a);
  process.exit(ids.length >= 1 && ids.join() === sorted.join() ? 0 : 1); });
' && grep -q "ORDER BY m.submitted_at DESC, m.id DESC LIMIT 200" src/routes/control.js \
  && ok "the queue lists the latest message at the top — newest first by the moment sent, in the Awaiting reply view as in the others" || bad "the queue is not newest first"

curl -s -b $A -X POST -d "body=" -d "action=publish" -o /dev/null $B/control/$ID/reply
curl -s $B/write | grep -q 'card-reply' && bad "empty reply accepted" || ok "empty reply refused"

echo "── unapproved messages stay off the common board"
# Another visitor (no cookie) must not see the message until it is approved.
curl -s $B/write | grep -q "first thing you miss" && bad "unapproved message reached the common board" \
  || ok "an unapproved message is not on the common board"
curl -s $B/api/board | grep -q "first thing you miss" && bad "unapproved message in the public board API" \
  || ok "nor in the public board API"
# The sender still sees it, stamped with its state and marked as theirs and pending.
MINE=$(curl -s -b $V $B/write)
echo "$MINE" | grep -q "first thing you miss" && ok "the sender still sees their own message" \
  || bad "sender cannot see their own unapproved message"
echo "$MINE" | grep -q 'data-mine="1" data-pending="1"' && ok "it is marked as theirs and awaiting approval" \
  || bad "own pending message not stamped data-pending"
echo "$MINE" | grep -q 'AWAITING REPLY' && ok "its state is stamped on the card — awaiting reply" || bad "no state on the sender's card"
echo "$MINE" | grep -q 'id="feed-mine-count">1<' && ok "MY MESSAGES counts one waiting" || bad "no waiting count on MY MESSAGES"
echo "$MINE" | grep -q 'id="feed-mine-note"' && bad "the visible-only-to-you note is back" || ok "no note under the board head"

curl -s -b $A -X POST --data-urlencode "body=Rain. Not the idea of it, the sound." \
  -d "action=publish" -o /dev/null $B/control/$ID/reply
ok "review and reply are a single action"
curl -s $B/write | grep -q "Rain. Not the idea of it" && ok "exchange published onto the landing page" || bad "not published"
curl -s $B/write | grep -q "first thing you miss" && ok "once approved, the message is on the common board" \
  || bad "approved message missing from the common board"
curl -s -b $V $B/write | grep -q 'data-pending="1"' && bad "sender's card still stamped pending after approval" \
  || ok "the sender's card is no longer pending"

echo "── the board is live"
curl -s $B/write | grep -q 'id="feed" data-poll="/api/board?limit=20&amp;wall=1"' && ok "the wall is wired to poll /api/board for its own cards, twenty at a time" || bad "no poll address on the board"
curl -s $B/write | grep -q 'data-version="[0-9a-f]\{16\}"' && ok "the page carries the board version it rendered" || bad "no board version on the page"
curl -s $B/write | grep -q 'id="feed-live"' && ok "a LIVE mark sits in the foot" || bad "no live mark"
API=$(curl -s -b $V $B/api/board)
echo "$API" | grep -q '"version":"[0-9a-f]\{16\}"' && ok "/api/board reports a version" || bad "no version from /api/board"
echo "$API" | grep -q 'Rain. Not the idea of it' && ok "/api/board carries the rendered cards" || bad "cards missing from /api/board"
echo "$API" | grep -q '"published":1' && ok "with the published count" || bad "no counts from /api/board"
PV=$(curl -s -b $V $B/write | grep -oE 'data-version="[0-9a-f]+"' | grep -oE '[0-9a-f]{16}')
AV=$(echo "$API" | grep -oE '"version":"[0-9a-f]+"' | grep -oE '[0-9a-f]{16}')
[ -n "$PV" ] && [ "$PV" = "$AV" ] && ok "page and API agree on the version" || bad "version differs between page ($PV) and API ($AV)"
curl -s $B/api/board | grep -q 'data-pending' && bad "another visitor's API view carries pending cards" \
  || ok "the API never hands one visitor another's unpublished message"
curl -s $B/write | grep -q 'class="cards"' && ok "exchanges render as a card grid" || bad "no card grid"
! curl -s $B/write | grep -q 'class="scroller feed"' && curl -s $B/write | grep -q '<section class="wall-sec" id="exchanges"' \
  && ok "the message board is a wall under the composer, in no box of its own" || bad "the board is still a scroller"
curl -s $B/write | grep -q '<span class="wall-count" id="feed-counter">[0-9]* exchanges · [0-9]* sent</span>' && ok "the wall's bar carries the count: exchanges · sent" || bad "the exchange count is not in the wall's bar"
[ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/messages)" = "$B/write" ] \
  && ok "/messages lands on the Write page" || bad "/messages redirect wrong"
[ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/board)" = "$B/write#exchanges" ] \
  && ok "/board lands on the board, on the Write page" || bad "/board redirect wrong"
curl -s -b $A $B/archive/messages | grep -q "$CS" && ok "searchable in the archive under $CS" || bad "missing from archive"
curl -s -b $V $B/write | grep -q 'id="composer"' && ok "composer returns after arrival" || bad "composer still locked"

echo "── control can delete"
curl -s -b $A -X POST -o /dev/null $B/control/$ID/delete
[ "$(curl -s -b $A $B/archive/messages | grep -c 'Rain. Not the idea of it')" = "0" ] \
  && ok "message deleted outright" || bad "delete did not remove the message"

echo "── tabs removed, landing carries both"
NAVBAR=$(curl -s $B/write | grep -oP '(?<=class="nav">).*?(?=</nav>)')
echo "$NAVBAR" | grep -q ">Write<" && bad "Write tab still present" || ok "Write tab removed"
echo "$NAVBAR" | grep -q ">Exchanges<" && bad "Exchanges tab still present" || ok "Exchanges tab removed"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/communicate)" = "301" ] \
  && ok "/communicate redirects to the landing composer" || bad "/communicate not redirected"
curl -s $B/write | grep -q 'id="exchanges"' && ok "exchange feed sits on the landing page" || bad "no exchange feed"

echo "── control writes back into the content files"
curl -s -b $A -X POST -d "day=2" -d "kind=science" -d "crew_id=2" -d "back=science" \
  --data-urlencode "body=Baseline established across twelve samples." -o /dev/null -w '%{redirect_url}' $B/control/report | grep -q "tab=science&day=2" \
  && ok "science findings are saved from the science tab and return to it" || bad "report save did not return to the tab"
node -e '
const d=require(process.env.CONTENT_DIR+"/notes.json");
process.exit((d["2"]||[]).filter(n=>n.kind==="SCIENCE").length===1?0:1);' \
  && ok "the day's science findings are one note in notes.json" || bad "findings not written to file as one note"
curl -s $B/at-a-glance | grep -q "Baseline established" && ok "and are live on their day in At a Glance" || bad "findings not live"
# the landing page's three blog panels carry the current day's post — and until it is written, the latest earlier day's
TODAY=$(curl -s $B/api/status | grep -oE '"missionDay":[0-9]+' | cut -d: -f2)
panel blog-science | grep -q "Baseline established" && ok "with today's findings unwritten, the latest earlier day's stand in the Daily Mission Report" || bad "the earlier day's findings do not carry forward into today's empty panel"
curl -s -b $A -X POST -d "day=$TODAY" -d "kind=science" -d "crew_id=2" -d "back=science" \
  --data-urlencode "body=Culture count up a third since yesterday." -o /dev/null $B/control/report
panel blog-science | grep -q "Culture count up a third" && ok "today's findings are the Daily Mission Report, below the trend graph" || bad "today's findings not in the Daily Mission Report panel"
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
  && ok "today's health activities are the Health Report — another day's are not there" || bad "the Health Report does not show today's activities alone"
panel blog-science | grep -q "Pulse and sleep logged" && bad "the health report leaked into the science panel" || ok "each report stays in its own panel"
# cleared again, so the day is as it was for the checks that follow — and the panels say so at once
curl -s -b $A -X POST -d "day=$TODAY" -d "kind=science" -d "crew_id=2" -d "back=science" -d "action=clear" -d "body=x" -o /dev/null $B/control/report
curl -s -b $A -X POST -d "day=$TODAY" -d "kind=health" -d "crew_id=3" -d "back=health" -d "action=clear" -d "body=x" -o /dev/null $B/control/report
panel blog-science | grep -q "Batch B held over" && panel blog-health | grep -q "sleeping through" && ! panel blog-science | grep -q "Culture count up" && ! panel blog-health | grep -q "Pulse and sleep logged" \
  && ok "a report cleared in mission control leaves its panel at once, and the latest earlier day's stands in again" || bad "a cleared report is still in its panel, or the earlier day's did not come back"

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
curl -s $B/dashboard | grep -q "upset, not having a good day" && ok "control can file a crew mood" || bad "mood not filed"

echo "── the record is readable"
# a second exchange that is not deleted, so the record has one to hold
V2=/tmp/visitor2.jar; rm -f $V2
curl -s -c $V2 -o /dev/null $B/
curl -s -b $V2 -X POST --data-urlencode "body=Do you still dream in colour?" -d "tags=PERSONAL" -o /dev/null $B/communicate
sleep 4
ID2=$(curl -s -b $A $B/control | grep -oE '/control/[0-9]+/reply' | head -1 | grep -oE '[0-9]+')
curl -s -b $A -X POST --data-urlencode "body=In colour, and always outdoors." -d "action=publish" -o /dev/null $B/control/$ID2/reply
# the wall: a note's tags in the band at its foot, each a key; the head the writer's disc and the callsign (no Earth · you); the
# crew's answer alone, without a line of who answered, the habitat and when; no group of the viewer's own at the top
# (the sequence is checked on the station's board, below); the screens' cards keep the tags under the text
BRD=$(curl -s -b $V2 $B/write)
echo "$BRD" | grep -q '<div class="note-tags"><button type="button" class="note-tag tag-personal" data-filter="tag:PERSONAL">#PERSONAL</button></div>' && ! echo "$BRD" | grep -q '<span class="card-meta">' && ! echo "$BRD" | grep -q 'note-band\|note-in\|No tag' \
  && echo "$BRD" | tr -d '\n' | grep -q '<p class="card-body note-title">[^<]*</p>      <div class="note-tags">' \
  && echo "$BRD" | grep -q '<div class="card-reply note-answer">' && echo "$BRD" | grep -q '<span class="note-aav" aria-hidden="true">[A-Z·]*</span>' && echo "$BRD" | grep -q '<span class="note-awho"><span class="cs">[A-Za-z ]*</span><span class="note-role">Crew answer · Mars habitat</span></span>' && echo "$BRD" | grep -q '<time class="note-awhen" datetime="' \
  && grep -q 'body.landing .card.note .note-tag { margin: 0; padding: 4px 9px; border: 0; min-height: 0; border-radius: 7px; background: rgba(var(--cobalt-rgb),.09); font-family: var(--display); font-size: 12.5px; font-weight: 500; line-height: 1.2; letter-spacing: 0; text-transform: lowercase; cursor: pointer; color: var(--ink); box-shadow: none; }' public/aura.css \
  && grep -q 'body.landing .card.note .card-reply.note-answer { margin: 2px 0 0; padding: 10px 12px 11px; background: #fff; border: 1px solid var(--note-edge); border-radius: 12px; }' public/aura.css && ! grep -q 'note-band\|tag-humour\|tag-science' public/aura.css \
  && echo "$BRD" | grep -q '<span class="note-who"><span class="cs">[A-Z]*-[0-9]*</span></span>' && ! echo "$BRD" | grep -q '<span class="note-role">Earth' && echo "$BRD" | grep -q '<span class="note-av" aria-hidden="true" style="--av:[0-9]*">[A-Z0-9·]*</span>' && ! echo "$BRD" | grep -q 'board-group' \
  && curl -s "$B/api/board?lang=en&limit=400" | grep -q '<div class=\\"card-tags\\">#PERSONAL</div>' && curl -s "$B/api/board?lang=en&limit=400" | grep -q '<span class=\\"card-meta\\"><span class=\\"cs\\">' \
  && ok "a note's tags stand right after its message, each a key, in the message's own colour on a faint tint — no band, no In, no No tag; the crew's answer is a quoted card of its own after the reference (the crew's disc, the officer, Crew answer · Mars habitat, the day and time of the answer); the head is the writer's disc and the callsign — no Earth, no Earth · you; no MY MESSAGES group, no heading — the screens' cards keep their tags under the text" || bad "the tags are not right after the message, or the answer is not a quoted card, or the board still groups"
echo "$BRD" | grep -q 'card-reply-meta' && bad "the crew's answer on the board still carries its line of who, where and when" || ok "the crew's answer on the board stands alone — no line of who answered, the habitat and when under it"
curl -s -H "Cookie: mcs_lang=de" $B/write | grep -q 'data-filter="tag:PERSONAL">#PERSÖNLICH</button>' && curl -s -H "Cookie: mcs_lang=de" $B/write | grep -q '<span class="note-role">Antwort der Crew · Mars-Habitat</span>' && curl -s -H "Cookie: mcs_lang=fr" $B/write | grep -q '<span class="note-role">Réponse de l’équipage · Habitat martien</span>' \
  && ok "and the tags and the answer's line are in the visitor's language" || bad "the tags after the text or the answer's line are not translated"
grep -q "body.screen.screen-board .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-content: start; }" public/screen.css \
  && grep -q "body.landing .wall .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: start; padding: 22px 0 0; }" public/aura.css \
  && grep -q "@media (max-width: 1100px) { body.landing .wall .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; } }" public/aura.css \
  && grep -q "  body.landing.messages .wall .cards { grid-template-columns: minmax(0, 1fr); gap: 12px; padding-top: 14px; }" public/aura.css \
  && ok "the board screen stands its cards three across; the wall its notes three across on a wide screen, two under 1100px, one on a phone, every row starting level" || bad "the boards are not three across"
curl -s -b $A $B/archive/export.md -o /tmp/record.md
grep -q "^# " /tmp/record.md && ok "the record downloads as readable Markdown" || bad "no Markdown record"
for section in "### COMMANDING OFFICER" "### SCIENCE OFFICER" "### HEALTH OFFICER" "#### Commander Blog" "#### Daily Mission Report" "#### Health Report" "#### Crew state" "### Habitat" "#### Schedule" "#### Meals" "#### Steps taken and calories consumed" "#### Inventory levels" "#### Power consumed" "### Habitat sensors"; do
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
for needle in "Contents" "The mission" "Day 001" "Day 00$TODAY" "The crew log" "Media" "Commanding officer" "Science officer" "Health officer" "Commander Blog" "Daily Mission Report" "Health Report" "Crew state" "Schedule" "Meals" "Inventory levels" "Steps taken and calories consumed" "Habitat sensors" "Drinking water"; do
  echo "$PDFTXT" | grep -q "$needle" || bad "PDF record missing: $needle"
done
ok "the PDF holds the mission, every day that has happened, the whole crew log and the media"
echo "$PDFTXT" | grep -q "Audit trail" && bad "the PDF still carries the audit trail" || ok "no audit trail in the PDF"
[ "$(curl -s -b $A -o /dev/null -w '%{redirect_url}' $B/archive/today)" = "$B/archive/day/$TODAY" ] && ok "during the run /archive/today is the current day" || bad "/archive/today does not lead to today"
# a rehearsal against made-up dates (MISSION_OVERRIDE, as this suite runs): NOW is at hand on the desk and in the archive all through it, so everything can be tried; the public pages show the sols
RUNCTL=$(curl -s -b $A "$B/control?tab=habitat")
echo "$RUNCTL" | grep -qE 'class="daypick-now" data-day="0"[^>]*>NOW · [0-9]+ [A-Z][a-z]+</a>' && echo "$RUNCTL" | grep -q "day $(printf '%03d' $TODAY) · a rehearsal against made-up dates · NOW" && echo "$RUNCTL" | grep -q 'class="on" data-day="'$TODAY'"' \
  && curl -s -b $A "$B/control?tab=habitat&day=0" | grep -q 'Schedule · NOW' \
  && ok "in a rehearsal against made-up dates the desk keeps NOW in the picker, dated today, and opens on the current sol" || bad "NOW is missing from the desk during the rehearsal run"
curl -s -b $A $B/archive | grep -q '<td class="n">NOW</td>' && [ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/archive/now)" = "200" ] && curl -s -b $A $B/archive/now | grep -q '<h1>NOW — today, the rehearsal day</h1>' \
  && ok "and the archive lists NOW with its record at /archive/now, while /archive/today stays the current day" || bad "no NOW in the archive during the rehearsal run"
node -e '
const m = require("./src/lib/mission").state();
process.exit(m.nowDay === true && m.workDay === m.clampedDay && m.workDay >= 1 ? 0 : 1);
' && ok "mission.nowDay is on for the rehearsal run and the desk still works on the current sol (workDay)" || bad "nowDay/workDay wrong during the rehearsal run"
for made_up in "Trends" "Daily usage" "hour by hour" "Resources over the day" "Day total" "Days left" "planned, ahead" "The distance"; do
  echo "$PDFTXT" | grep -q "$made_up" && bad "the PDF still carries generated matter: $made_up"
done
echo "$PDFTXT" | grep -q "Day 013" && bad "the PDF carries a chapter for a day that has not happened"
ok "no chart, no projection, no total and no day ahead in the PDF"
echo "$PDFTXT" | grep -q "In colour, and always outdoors.\|Do you still dream in colour\|The complete correspondence\|Exchanges published\|Messages from Earth" && bad "the PDF still carries messages" || ok "no message from Earth, no reply and no correspondence in the PDF"
echo "$PDFTXT" | grep -q "upset, not having a good day" && ok "a filed state appears as its sentence" || bad "state missing from the PDF"
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
curl -s $B/dashboard | grep -q "west wall condensation" && bad "old text still on the site" || ok "the old text is gone"
curl -s -b $A -X POST -d "day=$TODAY" -d "designation=COMMUNICATION OFFICER" -d "body=" -o /dev/null $B/control/logbook
curl -s $B/dashboard | grep -q "Revised after supper" && bad "an empty save left the entry standing" || ok "an empty save removes the entry"
CB=$(panel blog-commander)
echo "$CB" | grep -q "to be written at the end of this day" && bad "a placeholder reached the Commander Blog" || ok "placeholders stay out of the Commander Blog"
echo "$CB" | grep -q "Blog written from mission control." && ! echo "$CB" | grep -q "No commander blog yet for SOL" && ok "with today's entry cleared the Commander Blog shows the latest earlier day's post" || bad "the earlier day's post is not in the Commander Blog"
[ "$(curl -s -b $A -o /dev/null -w '%{redirect_url}' -X POST -d "day=3" -d "designation=COMMUNICATION OFFICER" -d "back=comms" -d "body=Day three." $B/control/logbook)" = "$B/control?tab=comms&day=3#work" ] \
  && ok "a save returns to the tab and day it came from" || bad "save landed somewhere else"

curl -s -b $A -X POST -d "calm_tense=100" \
  -d "activity=Filter maintenance" -o /dev/null $B/control/moods/$MOODID
curl -s $B/dashboard | grep -q "angry, needing distance" && ok "state translated into public language" || bad "state not translated"
[ "$(curl -s $B/dashboard | grep -c 'calm_tense')" = "0" ] && ok "no raw mood values reach the public" || bad "raw values leaked"

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
WRITE=$(curl -s $B/write)
DASH=$(curl -s $B/dashboard)
for l in "/write#write" "/dashboard" "/about" "#write"; do
  echo "$FOOT" | grep -q "href=\"$l\"" || bad "landing page missing link: $l"
done
for l in "/at-a-glance" "/media" "/about"; do
  echo "$DASH" | grep -q "href=\"$l\"" || bad "the dashboard page is missing link: $l"
done
ok "the mission page carries the ways on — the Write page, the dashboard page, About — and the dashboard page the doors to At a Glance and Media"
for u in /crew /day /day/3 /schedule /messages; do
  [ "$(curl -s -o /dev/null -w '%{http_code}' $B$u)" = "301" ] || bad "$u is not redirected"
done
[ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/messages)" = "$B/write" ] && [ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/communicate)" = "$B/write#write" ] && [ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/day/3)" = "$B/dashboard#mission" ] && [ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/crew)" = "$B/dashboard#crew" ] && [ "$(curl -s -o /dev/null -w '%{redirect_url}' $B/habitat)" = "$B/dashboard#habitat" ] \
  && ok "the old addresses land where the thing is — /messages and /communicate on the Write page, /day/3, /crew and /habitat on their section of the dashboard page" || bad "an old address does not land on the Write page"
ok "every old public address redirects into the landing page"
[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/what)" = "301 $B/about" ] && [ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/who-we-are)" = "301 $B/about#who-we-are" ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' $B/about)" = "200" ] && ok "/about is a page of its own; /who-we-are lands on its section of it, /what on the page (its section is gone)" || bad "the About page's addresses are wrong"
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
[ "$(echo "$FOOT" | grep -c 'id="write"')" = "1" ] && echo "$FOOT" | grep -q '<section class="portal portal-pop" id="write"' || bad "the mission page's #write is not the pop-up alone"
for sec in write exchanges; do
  echo "$WRITE" | grep -q "id=\"$sec\"" || bad "the Write page has no #$sec section"
done
for sec in mission habitat crew; do
  echo "$DASH" | grep -q "id=\"$sec\"" || bad "the dashboard page has no #$sec section"
done
! echo "$FOOT" | grep -q 'id="exchanges"\|id="mission"\|id="habitat"' || bad "the board or the dashboard is still on the mission page"
! echo "$WRITE" | grep -q 'id="mission"\|id="habitat"\|id="crew"' || bad "the dashboard is still on the Write page"
ok "the mission page carries the pop-up alone; the Write page the pop-up and the board; the dashboard page the mission, the habitat and the crew"
ABOUT=$(curl -s $B/about)
for sec in about-project sol who-we-are; do
  echo "$ABOUT" | grep -q "<section class=\"about-sec\" id=\"$sec\"" || bad "the About page has no #$sec section"
done
echo "$ABOUT" | grep -q 'Why are we doing this?' && echo "$ABOUT" | grep -q 'Produced by' && ! echo "$ABOUT" | grep -q 'id="what"\|What happens when you send something\|What this is\|The path of a message\|You already have a callsign\|You will get a callsign' \
  && ! grep -q 'function whatFold' src/views/pages/info.js \
  && ok "the About page carries About and Who we are (and the habitat between them) — What this is is gone (October)" || bad "the About page is missing a text, or What this is is still on it"
# About in the words of October's text sheet (ABOUT_WEBSITE_TEXTS_FOR_YASHA): the section's line is the project's name;
# MARS! in four paragraphs, the five workshops and the exhibition linked to zkm.de; Why are we doing this? with its line,
# The Habitat – Red Dust City, The Insight; the announcement's and the message-writing paragraphs gone; the station's own
# (More than Human, the readings, messages sent to space) kept; the distance to Mars the station's own figure for the day
# the crew go in; the mission's facts with 17:00 at each end, eleven scientific missions and no timezone; in three languages
echo "$ABOUT" | grep -q '<p class="dash-sub">MARS! – Mobilizing Awareness for Resilient Societies!</p>' && ! echo "$ABOUT" | grep -q 'The project, the distance, the archive' \
  && echo "$ABOUT" | grep -q '<p>In the project MARS! – Mobilizing Awareness for Resilient Societies!, we want to challenge the signifier' && echo "$ABOUT" | grep -q 'What would we do if we could start over?' \
  && echo "$ABOUT" | grep -q '<p>To this end, we invited scientists and citizen scientists' && echo "$ABOUT" | grep -q '<p>During the project that began in January 2026' \
  && echo "$ABOUT" | grep -q 'The five prototype workshops <a href="https://zkm.de/en/2026/01/open-hertzlab-mars-habitat" target="_blank" rel="noopener">Habitat</a>, <a href="https://zkm.de/en/2026/02/open-hertzlab-mars-mental-health" target="_blank" rel="noopener">Mental Health</a>, <a href="https://zkm.de/en/2026/03/open-hertzlab-mars-food" target="_blank" rel="noopener">Food</a>, <a href="https://zkm.de/en/2026/04/open-hertzlab-mars-governance" target="_blank" rel="noopener">Governance</a>, and <a href="https://zkm.de/en/2026/05/open-hertzlab-mars-resource-management" target="_blank" rel="noopener">Resource Management</a> turned into a <a href="https://zkm.de/en/2026/06/mars" target="_blank" rel="noopener">concept exhibition</a> that ran at ZKM from June to September 2026.' \
  && echo "$ABOUT" | grep -q '<h3>Why are we doing this?</h3>' && echo "$ABOUT" | grep -q '<p class="kicker">Playacting Mars in the middle of the city</p>' \
  && echo "$ABOUT" | grep -qE 'the actual planet Mars will be 2[0-9]{2} million kilometres away from Earth' && ! echo "$ABOUT" | grep -q '26 million' \
  && echo "$ABOUT" | grep -q '<p>Because ZKM is so much more than a museum' && echo "$ABOUT" | grep -q '<h3>The Habitat – Red Dust City</h3>' && echo "$ABOUT" | grep -q 'The dome (lent to us by Staatstheater Karlsruhe) has a diameter of just under 10 m' \
  && echo "$ABOUT" | grep -q '<h3>The Insight</h3>' && echo "$ABOUT" | grep -q 'a spaceship called Earth' \
  && ! echo "$ABOUT" | grep -q 'A durational performance on Karlsruhe\|Large space agencies\|Distance as the material\|The archive as the work\|Networked communication is built\|MARS!platz: Red Dust City</h3>' \
  && ! echo "$ABOUT" | grep -q 'id="more-than-human"\|<h3>More than Human</h3>\|<h3>The readings</h3>\|Three live crickets share it with them\|The sensors that produce the readings on this page' \
  && echo "$ABOUT" | grep -qE '<dt>START</dt><dd>[A-Z][a-z]{2} [0-9]{1,2} [A-Z][a-z]{2} 20[0-9]{2} · 17:00</dd>' && echo "$ABOUT" | grep -qE '<dt>END</dt><dd>[A-Z][a-z]{2} [0-9]{1,2} [A-Z][a-z]{2} 20[0-9]{2} · 17:00</dd>' && echo "$ABOUT" | grep -q '<dt>CREW</dt><dd>3</dd>' \
  && echo "$ABOUT" | grep -q '<dt>SCIENTIFIC MISSIONS</dt><dd>11</dd>' && ! echo "$ABOUT" | grep -q '<dt>TIMEZONE</dt>' \
  && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<h3>Warum tun wir das?</h3>' && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<dt>WISSENSCHAFTLICHE MISSIONEN</dt><dd>11</dd>' && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q 'Millionen Kilometer von der Erde entfernt' \
  && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<h3>L’Habitat – Red Dust City</h3>' && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q 'target="_blank" rel="noopener">Santé mentale</a>' \
  && ok "About is in the words of October's text sheet — the project's name as the section's line, MARS! in four paragraphs with the workshops and the exhibition linked, Why are we doing this? with its line, The Habitat – Red Dust City, The Insight — the old paragraphs gone, More than Human and The readings gone too, Messages sent to space kept, the distance to Mars the station's own figure, the facts with 17:00 at each end, eleven scientific missions and no timezone, in three languages" || bad "the About page's texts are not the sheet's"
# by day blue, by night orange (October, 7 October: "for the light theme, replace the orange theme with blue"): public/light.css,
# written by tools/light-theme.js from the stylesheets and up to date, loaded last on every public page and screen (never on
# mission control); every rule in it acts in the light theme only, its twins weigh what their originals weigh (:where), a
# later rule that beat an orange one is laid over again; the tokens turn azure on the public pages' body; the Write keys,
# the floating one, the call's beamed line are blue; the night room keeps its orange — the white signal up from Earth to the
# habitat and the orange answer down, as before — and so does the composer's dial; the warning states are red; the dark
# theme's rules are untouched
LIGHT_PAGE=$(curl -s -H "Cookie: mcs_theme=light" $B/)
node tools/light-theme.js --check > /dev/null \
  && echo "$LIGHT_PAGE" | tr -d '\n' | grep -q '<link rel="stylesheet" href="/sheet.css?v=[^"]*"> *<link rel="stylesheet" href="/light.css?v=[^"]*">' \
  && curl -s $B/about | grep -q 'href="/light.css?v=' && tr -d '\n' < src/views/pages/screens.js | grep -q '<link rel="stylesheet" href="/screen.css?v=${V}"> *<link rel="stylesheet" href="/light.css?v=${V}">' \
  && ! curl -s -b $A $B/control | grep -q '/light.css' \
  && [ "$(grep -vE '^\s*($|/\*|\*|@|\}|:where\(:root\[data-theme="light"\]|:root\[data-theme="light"\])' public/light.css | grep -c '{')" = "0" ] \
  && ! grep -q 'data-theme="dark"' public/light.css && ! grep -q 'space-line\|space-arc\|space-tag\|\.sky-\|xdial-\(trail\|mars\|packet\)' public/light.css \
  && grep -q ':where(:root\[data-theme="light"\] body.landing) { --mars: #0b81ff; --mars-ink: #005ec2; --orange: #0b81ff; --orange-deep: #106dcf; --orange-soft: rgba(11,129,255,.12);' public/light.css \
  && grep -q ':where(:root\[data-theme="light"\]) body.landing .tk-nav a.tk-write { background: linear-gradient(180deg, #2990ff, #0b81ff); color: #020e1a;' public/light.css \
  && grep -q ':where(:root\[data-theme="light"\]) body.landing .write-float { color: #020e1a;' public/light.css \
  && grep -q ':where(:root\[data-theme="light"\]) body.landing .call-beam { background: linear-gradient(100deg, #6bb2ff 0%, #1a88ff 32%, #c2dfff 50%, #1a88ff 68%, #6bb2ff 100%); background-size: 240% 100%; background-position: 100% 0; -webkit-background-clip: text; background-clip: text;' public/light.css \
  && grep -q ':where(:root\[data-theme="light"\]) body.landing .tk-sol i { box-shadow: 0 0 8px 2px rgba(255,255,255,.8); } /\* as it stood \*/' public/light.css \
  && grep -q ':root\[data-theme="light"\] body.landing .space-room, :root\[data-theme="light"\] body.landing .xdial-wrap { --mars: #ff5a1f; --mars-ink: #c23600; --orange: #ff5a1f;' public/light.css \
  && grep -q ':root\[data-theme="light"\] body.landing :is(.sym.bad, .dot.bad, .badge.bad, .bar i.bad, .bar i.warn, .counter.over, .flash.err, .gauge.low, .gauge.round.low, .kpi.warn, .dial.alert, .dcard-note.anomaly, .hbt .hot, .hbt .note.alert, .transit.closed, .cloud-fail, button.danger) { --mars: #d92d20;' public/light.css \
  && grep -q ':root\[data-theme="light"\] body.landing .card.note .note-mark .nm-earth { fill: var(--ink); }' public/light.css && grep -q ':where(:root\[data-theme="light"\]) body.landing #blog-commander .dpanel-head { background: radial-gradient(ellipse 200px 125px at 52% 136%, #4752eb 0' public/light.css \
  && grep -q 'body.landing .space-line::before { bottom: 0; background: #fff; box-shadow: 0 0 10px 2px rgba(120,170,255,.9); animation: space-up 9s linear infinite; }' public/sheet.css && grep -q 'body.landing .space-line::after { top: 0; background: var(--hud-hot); box-shadow: 0 0 10px 2px rgba(var(--hud-hot-rgb),.8); animation: space-down 9s linear infinite; }' public/sheet.css \
  && grep -q "if (aura) styles = styles.filter((s) => s !== '/sheet.css' && s !== '/light.css').concat('/sheet.css', '/light.css');" src/views/layout.js \
  && grep -q "ACCENT = (body.getPropertyValue('--orange') || root.getPropertyValue('--orange') || '#ff6a00').trim() || '#ff6a00';" public/habitat.js && grep -q "attributeFilter: \['data-theme'\]" public/habitat.js \
  && ok "by day blue, by night orange: public/light.css, written by tools/light-theme.js and up to date, laid over every public page and screen in the light theme only — the tokens azure, the Write keys and the beamed line blue, each twin as weighty as its original, later winners laid over again — the night room keeps its white signal up and orange answer down, the dial its orange, the warnings turn red, the dark theme untouched, mission control never loads it" || bad "the light theme is not blue as it should be"
# soft UI (8 October: "redesign the website in neumorphism style with orange, black and blue"): public/neu.css laid over every
# public page last, after the light theme — never on mission control or the screens; one ground (the station's black by night,
# a soft grey by day) with the cards and keys raised out of it and the fields and the chosen pressed in; by night the keys
# that act are Mars orange and glow, the dashboard's key blue; the page's own key keeps its focus ring
SOFT_PAGE=$(curl -s $B/)
echo "$SOFT_PAGE" | tr -d '\n' | grep -q '<link rel="stylesheet" href="/light.css?v=[^"]*"> *<link rel="stylesheet" href="/neu.css?v=[^"]*">' \
  && curl -s $B/about | grep -q 'href="/neu.css?v=' && curl -s $B/write | grep -q 'href="/neu.css?v=' && curl -s $B/dashboard | grep -q 'href="/neu.css?v=' \
  && ! curl -s -b $A $B/control | grep -q '/neu.css' && ! grep -q 'neu.css' src/views/pages/screens.js \
  && grep -q "if (aura) styles = styles.filter((s) => s !== '/neu.css').concat('/neu.css');" src/views/layout.js \
  && grep -q ':root\[data-theme="dark"\] {$' public/neu.css && grep -q '^  --neu: #121214;' public/neu.css && grep -q '^  --neu: #e3e7ef;' public/neu.css \
  && grep -q '^  --neu-on: var(--mars-ink);' public/neu.css && grep -q '^  --neu-on: var(--cobalt);' public/neu.css \
  && grep -q 'background: linear-gradient(180deg, #ff8a3d, #ff5a1f) !important; color: #1a0a02 !important;' public/neu.css \
  && grep -q 'background: linear-gradient(180deg, #4f63ff, #2f45e8) !important; color: #fff !important;' public/neu.css \
  && grep -q 'body.landing .tk-nav a\[aria-current="page"\]:not(:focus-visible) { outline: 0 !important; }' public/neu.css \
  && grep -q 'body.landing .space-room { background: #000 !important;' public/neu.css \
  && ok "soft UI: public/neu.css laid over every public page last — never on mission control or the screens — one ground, black by night and a soft grey by day, cards and keys raised, fields and the chosen pressed in, the keys that act Mars orange and glowing by night, the dashboard's key blue, the night room kept black, focus rings kept" || bad "the soft UI is not laid over the public pages as it should be"
# the dark rules for the phone's write sheet and the composer's close key are written on the root element itself
# (html.js[data-theme="dark"]): written ':root[data-theme="dark"] html.js' they could never match, and a phone by night drew
# the day's pale veil behind the sheet
! grep -q ':root\[data-theme="[a-z]*"\] html' public/*.css && [ "$(grep -c 'html\.js\[data-theme="dark"\]' public/aura.css)" = "5" ] \
  && ok "the dark write sheet's veil and close keys are written on the root itself and match by night" || bad "a dark rule is still written root-then-html and can never match"
# the Trends series date each reading through one kept formatter per zone (src/lib/mission.js) and once per quarter hour
# (src/lib/home-assistant.js): a week of the hardware's readings, some 150 000 rows, took a page 23 s and 2.8 GB before
# (8 October) — twenty thousand dates must now cost well under a second
grep -q 'const FORMATTERS = new Map();' src/lib/mission.js && grep -q 'const q = Math.floor(r.t / 900000);' src/lib/home-assistant.js \
  && [ "$(node -e "const m=require('./src/lib/mission.js');const t=Date.now();for(let i=0;i<20000;i++)m.localDate(new Date(1791400000000+i*60000),'Europe/Berlin');console.log(Date.now()-t<1000?'fast':'slow')" 2>/dev/null | tail -1)" = "fast" ] \
  && ok "the Trends series date the readings fast: one kept formatter per zone, one date per quarter hour" || bad "dating the readings is slow again — the pages will crawl as the readings pile up"
# At a Glance: the booklet's scroll timer no longer hides the page's translator (a 'var t' did, and the rehearsal page threw)
! grep -q "var t; bk.addEventListener" src/views/pages/glance.js && grep -q "var settle; bk.addEventListener('scroll'" src/views/pages/glance.js \
  && ok "At a Glance: the booklet's scroll timer does not hide the translator" || bad "At a Glance's scroll timer hides t() again"
# the theme key names the mode the page is in — Dark by night, Light by day (October: "the light mode should read Dark
# and vice versa"); its title the way out; in German and French Dunkel / Hell, Sombre / Clair; the script relabels the same way
curl -s $B/ | grep -q '<input type="hidden" name="to" value="light">' && curl -s $B/ | grep -q 'title="Switch to light mode" aria-label="Switch to light mode">' && curl -s $B/ | grep -q '<span class="theme-word">Dark</span>' \
  && curl -s -H "Cookie: mcs_theme=light" $B/ | grep -q '<input type="hidden" name="to" value="dark">' && curl -s -H "Cookie: mcs_theme=light" $B/ | grep -q 'title="Switch to dark mode"' && curl -s -H "Cookie: mcs_theme=light" $B/ | grep -q '<span class="theme-word">Light</span>' \
  && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '<span class="theme-word">Dunkel</span>' && curl -s -H "Cookie: mcs_lang=de; mcs_theme=light" $B/ | grep -q '<span class="theme-word">Hell</span>' \
  && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q '<span class="theme-word">Sombre</span>' && curl -s -H "Cookie: mcs_lang=fr; mcs_theme=light" $B/ | grep -q '<span class="theme-word">Clair</span>' \
  && grep -q "if (word) word.textContent = dark ? w.dark : w.light;" public/switches.js && grep -q "de: { light: 'Hell', dark: 'Dunkel'," public/switches.js && grep -q "fr: { light: 'Clair', dark: 'Sombre'," public/switches.js \
  && ok "the theme key reads the mode the page is in — Dark by night, Light by day (Dunkel / Hell, Sombre / Clair) — its title the way out" || bad "the theme key does not name the mode the page is in"
# the site opens dark and in German before a visitor chooses (October): pick falls back to DEFAULT_LANG, German unless the
# environment names another — the suite's station runs in English (DEFAULT_LANG=en, above) and is read without a cookie
[ "$(DEFAULT_LANG= node -e 'const i = require("./src/lib/i18n"); console.log(i.DEFAULT_LANG, i.pick({ cookies: {} }), i.pick({ cookies: { mcs_lang: "xx" } }), i.pick({ cookies: { mcs_lang: "fr" } }))')" = "de de de fr" ] \
  && [ "$(DEFAULT_LANG=fr node -e 'const i = require("./src/lib/i18n"); console.log(i.pick({ cookies: {} }))')" = "fr" ] \
  && grep -q "const DEFAULT_LANG = LANGS.includes(process.env.DEFAULT_LANG) ? process.env.DEFAULT_LANG : 'de';" src/lib/i18n.js && grep -q "const to = i18n.LANGS.includes(req.body.to) ? req.body.to : i18n.DEFAULT_LANG;" src/server.js \
  && grep -q "theme: req.cookies.mcs_theme === 'light' ? 'light' : 'dark'," src/server.js && curl -s $B/ | grep -q '<html lang="en" data-theme="dark">' && curl -s -H "Cookie: mcs_theme=light" $B/ | grep -q '<html lang="en" data-theme="light">' \
  && ok "the site opens dark and in German before a visitor chooses — DEFAULT_LANG names another for a run (the suite's English)" || bad "the site's default is not dark and German"
# the About page in French is October's text (the sheet handed over on 7 October), its paragraphs kept — a translation with
# blank lines in it is set as several <p> (info.js, paras) — the links in the workshops' sentence, the distance the
# station's own, the headings and Who we are = Qui sommes-nous ?
ABOUTFR=$(curl -s -H "Cookie: mcs_lang=fr" $B/about)
echo "$ABOUTFR" | grep -q '<p>Dans le cadre du projet MARS! – Mobilizing Awareness for Resilient Societies!, nous souhaitons remettre en question ce que la planète Mars en est venue à symboliser : une planète refuge réservée aux plus riches d’entre nous. Nous voulons au contraire nous en servir pour aborder des enjeux très concrets et urgents auxquels nous sommes confrontés sur Terre.</p>' \
  && echo "$ABOUTFR" | grep -q '<p>Imaginons un instant que nous, en tant que société mondiale, ayons décidé de faire de l’installation humaine sur Mars un projet démocratique fondé sur les communs.' \
  && echo "$ABOUTFR" | grep -q '<p>Dans cette perspective, nous avons invité des scientifiques et des scientifiques citoyens à se réunir au ZKM | Karlsruhe' && echo "$ABOUTFR" | grep -q '<p>Au cours du projet, qui a débuté en janvier 2026, nous avons constaté' \
  && echo "$ABOUTFR" | grep -q '<p>Les cinq ateliers de prototypage consacrés à l’<a href="https://zkm.de/en/2026/01/open-hertzlab-mars-habitat" target="_blank" rel="noopener">Habitat</a>, à la <a href="https://zkm.de/en/2026/02/open-hertzlab-mars-mental-health" target="_blank" rel="noopener">Santé mentale</a>, à l’<a href="https://zkm.de/en/2026/03/open-hertzlab-mars-food" target="_blank" rel="noopener">Alimentation</a>, à la <a href="https://zkm.de/en/2026/04/open-hertzlab-mars-governance" target="_blank" rel="noopener">Gouvernance</a> et à la <a href="https://zkm.de/en/2026/05/open-hertzlab-mars-resource-management" target="_blank" rel="noopener">Gestion des ressources</a> ont donné naissance à une <a href="https://zkm.de/en/2026/06/mars" target="_blank" rel="noopener">exposition conceptuelle</a>, présentée au ZKM de juin à septembre 2026.</p>' \
  && echo "$ABOUTFR" | grep -q '<p>La performance MARS!platz constitue la troisième partie du projet' && echo "$ABOUTFR" | grep -q '<p>Transformée en MARS!platz pendant deux semaines, la place devient notre lieu de vie' \
  && echo "$ABOUTFR" | grep -q '<h3>Pourquoi faisons-nous cela ?</h3>' && echo "$ABOUTFR" | grep -q '<p class="kicker">Jouer à vivre sur Mars au cœur de la ville</p>' \
  && echo "$ABOUTFR" | grep -qE '<p>Lorsque les trois astronautes-chercheurs artistiques du ZKM emménagent dans leur habitat sur la Marktplatz en octobre 2026, la véritable planète Mars se trouve à [0-9]+ millions de kilomètres de la Terre.' \
  && echo "$ABOUTFR" | grep -q '<p>Ce que nous savons en revanche, c’est que le voyage spatial agit comme un catalyseur' && echo "$ABOUTFR" | grep -q '<p>Parce que le ZKM est bien plus qu’un musée' && echo "$ABOUTFR" | grep -q '<p>Plutôt que d’imiter les agences spatiales' \
  && echo "$ABOUTFR" | grep -q '<h3>L’Habitat – Red Dust City</h3>' && echo "$ABOUTFR" | grep -q '<p>Le dôme, mis à notre disposition par le Staatstheater Karlsruhe' && echo "$ABOUTFR" | grep -q '<p>Répartis en trois fonctions – Commandant, Responsable de la santé et Responsable scientifique – nous simulons' \
  && echo "$ABOUTFR" | grep -q '<p>La population de Karlsruhe est invitée à jouer le rôle de notre centre de contrôle terrestre' && echo "$ABOUTFR" | grep -q '<p>Pendant onze jours, nous abordons quotidiennement une grande question' \
  && echo "$ABOUTFR" | grep -q '<h3>Le changement de perspective</h3>' && echo "$ABOUTFR" | grep -q '<p>À travers ce projet, nous adressons une invitation à la population de Karlsruhe' && echo "$ABOUTFR" | grep -q '<p>Pour rester habitable par une grande diversité d’êtres vivants' && echo "$ABOUTFR" | grep -q '<p>À travers les interactions avec nous – discuter, écrire, envoyer et recevoir des messages – nous espérons' \
  && echo "$ABOUTFR" | grep -q '<h3>Messages envoyés dans l’espace</h3>' && echo "$ABOUTFR" | grep -q '<p>Chaque message auquel répond l’équipage est également envoyé dans l’espace par radio grâce à SpaceSpeak' && echo "$ABOUTFR" | grep -q '<p>Dès que notre réponse est publiée, le centre de contrôle transmet le message à SpaceSpeak.' && echo "$ABOUTFR" | grep -q '<p>Les ondes radio sont une forme de lumière' \
  && echo "$ABOUTFR" | grep -q '<p>À partir de cet instant, le message poursuit définitivement son voyage.' && echo "$ABOUTFR" | grep -q '<p>Le signal s’affaiblit à chaque kilomètre parcouru' && echo "$ABOUTFR" | grep -q '<p>Le tableau des messages indique en permanence la distance parcourue par chaque message depuis son émission. Il suffit de toucher un message pour découvrir l’objet céleste qu’il vient de dépasser.</p>' \
  && echo "$ABOUTFR" | grep -q 'Qui sommes-nous ?' && ! echo "$ABOUTFR" | grep -q 'Qui nous sommes\|L’enseignement\|exposition-concept' \
  && [ "$(echo "$ABOUT" | grep -c '<p>In the project MARS!')" = "1" ] && echo "$ABOUT" | grep -q '<p>The five prototype workshops <a href=' \
  && ok "the About page in French is October's text, set in its paragraphs — the workshops and the exhibition linked in their sentence, the distance the station's own, Pourquoi faisons-nous cela ?, L’Habitat – Red Dust City, Le changement de perspective, Messages envoyés dans l’espace, Qui sommes-nous ? — and the English keeps its paragraphs as they were" || bad "the About page's French is not October's text"
# the About page, pared down: no "At this moment" panel, no "What is kept", no row of message states; the path of a message
# in six steps — Write, Transmit, Reached MARS!platz, Pending approval, Transmitted to space, Replied back; under Who we are
# the crew without a heading or a note over them, the credits without a heading, and no "Reach the production"
! echo "$ABOUT" | grep -q 'At this moment</div>' && ! echo "$ABOUT" | grep -q 'What is kept' && ! echo "$ABOUT" | grep -q 'Message states as shown in the interface' && ! echo "$ABOUT" | grep -q 'class="pipe' \
  && ! echo "$ABOUT" | grep -q 'Inside the habitat' && ! echo "$ABOUT" | grep -q 'addressed by designation' && ! echo "$ABOUT" | grep -q 'Outside the habitat' && ! echo "$ABOUT" | grep -q 'Reach the production' && ! echo "$ABOUT" | grep -q 'Replace these entries' \
  && ok "the About page no longer carries At this moment, What is kept, the row of states, Inside/Outside the habitat, the crew's note or Reach the production" || bad "a removed About panel is still on the page"
# Who we are: no credits any more; the crew's thirteen portraits (public/crew, from public/Astronaut_Pictures — October added
# Franziska Klöck and Finn Milbrandt to the eleven) and, under
# Produced by, the partners' logos (public/partners, from public/PartnerLogo) — 1 and 2 in cooperation with, 3 to 5 supporters
! echo "$ABOUT" | grep -q 'To be credited' && ! echo "$ABOUT" | grep -q 'Technical direction' && ! echo "$ABOUT" | grep -q 'Supported by the Innovationsfonds' \
  && [ "$(echo "$ABOUT" | grep -o '<figure class="crew-pic"><img src="/crew/[a-z-]*\.jpg" alt="" width="800" height="1200" loading="lazy" decoding="async"><figcaption>[^<]*</figcaption></figure>' | wc -l)" = "13" ] \
  && echo "$ABOUT" | grep -q '<img src="/crew/kloeck.jpg"' && echo "$ABOUT" | grep -q '<figcaption>Franziska Klöck</figcaption>' && echo "$ABOUT" | grep -q '<img src="/crew/milbrandt.jpg"' && echo "$ABOUT" | grep -q '<figcaption>Finn Milbrandt</figcaption>' \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' $B/crew/kloeck.jpg)" = "200" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' $B/crew/milbrandt.jpg)" = "200" ] \
  && ok "Who we are carries no credits, and the crew's thirteen portraits, each with a name — Franziska Klöck (kloeck.jpg) and Finn Milbrandt among them" || bad "the credits are still there, or the portraits are not, or they carry no names"
# the three officers of the day (the sheet): Commanding, Health, Science in that order, each with its brief over the role
# — Order & Communications, Health & Life Support, Research & Systems (the role lines in content/crew-and-inventory.json,
# on the dashboard too) — the portrait of the person on shift that day when the shift plan names one (content/shifts.json,
# from 08:00 at the venue), the role's name, their state; and the producer's line names the department and links Hertzlab
node -e '
const h = process.argv[1]; const i = h.indexOf("<div class=\"grid g3 officers-today\">"); const j = h.indexOf("</div></section>", i); const part = h.slice(i, j);
const briefs = [...part.matchAll(/<div class="eyebrow">([^<]*)<\/div>/g)].map((m) => m[1]); const names = [...part.matchAll(/<h3 class="officer-title">([^<]*)<\/h3>/g)].map((m) => m[1]);
process.exit(JSON.stringify(briefs) === JSON.stringify(["Order &amp; Communications", "Health &amp; Life Support", "Research &amp; Systems"]) && JSON.stringify(names) === JSON.stringify(["COMMANDING OFFICER", "HEALTH OFFICER", "SCIENCE OFFICER"]) && !/officer-pic/.test(part) ? 0 : 1);
' "$ABOUT" && echo "$ABOUT" | grep -q 'Department for Artistic Research &amp; Development, <a href="https://zkm.de/en/hertzlab" target="_blank" rel="noopener">ZKM | Hertzlab</a><br>' \
  && curl -s $B/dashboard | grep -q '<span class="officer-role">Order &amp; Communications</span>' && curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q '<span class="officer-role">Ordnung &amp; Kommunikation</span>' \
  && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q 'Abteilung für künstlerische Forschung &amp; Entwicklung, <a href="https://zkm.de/en/hertzlab"' \
  && ok "the three officers stand Commanding, Health, Science, each under its brief — Order & Communications, Health & Life Support, Research & Systems, the dashboard's role lines too — with no portrait while the shift plan names nobody; the producer is the Department for Artistic Research & Development, ZKM | Hertzlab, linked" || bad "the officers' cards or the producer's line are not the sheet's"
# the shift plan: with today's crew named in content/shifts.json the About page carries their portraits over the roles —
# from 08:00 at the venue; before 08:00 the day before's (the suite's station is on its fifth day; the file is read fresh)
SHIFT_DAY=$(curl -s $B/api/status | grep -oE '"missionDay":[0-9]+' | cut -d: -f2); SHIFT_HOUR=$(TZ=Europe/Berlin date +%H); [ "$SHIFT_HOUR" -lt 8 ] && SHIFT_DAY=$((SHIFT_DAY - 1))
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ days: { [process.argv[2]]: { "COMMUNICATION OFFICER": "jain", "HEALTH OFFICER": "Lorenz", "SCIENCE OFFICER": "dipper" }, [String(Number(process.argv[2]) + 1)]: { "COMMUNICATION OFFICER": "wilcox", "HEALTH OFFICER": "schmidt", "SCIENCE OFFICER": "kautz" } } }))' "$CONTENT_DIR/shifts.json" "$SHIFT_DAY"
ABOUT_S=$(curl -s $B/about)
node -e '
const h = process.argv[1]; const i = h.indexOf("<div class=\"grid g3 officers-today\">"); const j = h.indexOf("</div></section>", i); const part = h.slice(i, j);
const pics = [...part.matchAll(/<figure class="officer-pic"><img src="\/crew\/([a-z-]+)\.jpg" alt="([^"]*)" width="800" height="1200" loading="lazy" decoding="async"><figcaption>([^<]*)<\/figcaption><\/figure>/g)].map((m) => [m[1], m[3]]);
process.exit(JSON.stringify(pics) === JSON.stringify([["jain", "Yasha Jain"], ["lorenz", "Tina Lorenz"], ["dipper", "Götz Dipper"]]) ? 0 : 1);
' "$ABOUT_S" && grep -q "const day = Number(mission.clampedDay) - (Number.isFinite(hour) && hour < 8 ? 1 : 0);" src/lib/content.js && grep -q 'if (!mission || mission.phase !== '"'"'ACTIVE'"'"') return {};' src/lib/content.js \
  && grep -q '"_example": {' content/shifts.json && [ "$(node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync("content/shifts.json","utf8")).days).length)')" = "0" ] \
  && ok "with the day's crew named in content/shifts.json (surnames as crew.json spells the files, in any case) their portraits stand over the roles — Jain, Lorenz, Dipper — the day's from 08:00 at the venue, the day before's until then, none before the run; the shipped file names nobody and shows the shape" || bad "the shift plan's portraits are not on the About page as they should be"
# A sol on MARS!platz (October, 7 October): the About page's section under What's inside the habitat — the day's schedule
# on a rail, one row an activity whatever its length (October: "not by hour, by activity"), its times and the colour of its
# kind read off its words, the officer it belongs to with the person on shift (the shift plan above still names Jain, Lorenz
# and Dipper), the one under way marked NOW and the ones behind it done (the venue's clock), today's crew with their
# portraits, the key, the fixed hours read off the schedule — the communication hour and lights out, no shift change
# anywhere (the shipped schedule has none now: sixteen entries, 08:30 to 22:00 Lights Out); the jump link; German, French
echo "$ABOUT_S" | grep -q '<a href="#sol">A sol on MARS!platz</a>' && echo "$ABOUT_S" | grep -q '<section class="about-sec" id="sol" aria-labelledby="sol-title">' && echo "$ABOUT_S" | grep -q '<h2 class="bigsec" id="sol-title">A sol on MARS!platz</h2>' \
  && echo "$ABOUT_S" | grep -q '<p class="dash-sub">The day in the habitat, activity by activity — from breakfast to lights out</p>' \
  && [ "$(echo "$ABOUT_S" | tr -d '\n' | grep -o 'id="inside".*id="sol".*id="who-we-are"' | wc -l)" = "1" ] \
  && [ "$(echo "$ABOUT_S" | grep -c '<li class="sol-item ')" = "16" ] && ! echo "$ABOUT_S" | grep -qi 'shift change\|--dur:\|kind-shift' && echo "$ABOUT_S" | grep -qE '<p class="sol-when">SOL 0[0-9] · [A-Z][a-z]{2} [0-9]{1,2} [A-Z][a-z]{2}</p>' \
  && echo "$ABOUT_S" | tr -d '\n' | grep -q '<li class="sol-item kind-science[^"]*"> *<span class="sol-time"><b>09:30</b><i>–11:00</i></span> *<span class="sol-bar" aria-hidden="true"></span> *<span class="sol-what"> *<b class="sol-label">Science Block 1</b> *<span class="sol-role">Science officer · Götz Dipper</span> *</span> *<span class="sol-kind">Science</span>' \
  && echo "$ABOUT_S" | tr -d '\n' | grep -q '<li class="sol-item kind-meal[^"]*"> *<span class="sol-time"><b>08:30</b><i>–09:30</i></span>' \
  && echo "$ABOUT_S" | grep -q '<span class="sol-role">Health officer · Tina Lorenz</span>' && echo "$ABOUT_S" | grep -q '<span class="sol-role">Commanding officer · Yasha Jain</span>' \
  && echo "$ABOUT_S" | grep -q '<li class="sol-item kind-eva[^"]*">' && echo "$ABOUT_S" | tr -d '\n' | grep -q '<li class="sol-item kind-other[^"]*is-end"> *<span class="sol-time"><b>22:00</b></span> *<span class="sol-bar" aria-hidden="true"></span> *<span class="sol-what"> *<b class="sol-label">Lights Out</b>' \
  && [ "$(echo "$ABOUT_S" | grep -c 'is-now')" -le 1 ] && echo "$ABOUT_S" | grep -q '<div class="eyebrow">Today’s crew</div>' \
  && echo "$ABOUT_S" | tr -d '\n' | grep -q '<li class="sol-officer"> *<img src="/crew/jain.jpg" alt="" width="96" height="144" loading="lazy" decoding="async"> *<span class="sol-officer-who"><b>Commanding officer</b><span>Yasha Jain</span></span>' \
  && echo "$ABOUT_S" | grep -q '<li class="kind-science"><i aria-hidden="true"></i>Science</li>' && ! echo "$ABOUT_S" | grep -q '<li class="kind-shift">' \
  && echo "$ABOUT_S" | tr -d '\n' | grep -q '<dl class="sol-fixed"><div><dt>Communication hour</dt><dd>19:00</dd></div><div><dt>Lights out</dt><dd>22:00</dd></div></dl>' \
  && echo "$ABOUT_S" | grep -q 'Times are habitat-local. Every sol follows the typical schedule; mission control changes a day on the Habitat tab.' \
  && ! curl -s $B/dashboard | grep -qi 'shift change' && ! curl -s $B/ | grep -qi 'shift change' && [ "$(node -e 'const j = require("./content/schedule.json"); console.log(Object.keys(j).filter((k) => /^\d+$/.test(k)).every((k) => j[k].length === 16 && !j[k].some((t) => /shift change/i.test(t.label)) && j[k][0].time === "08:30" && j[k][15].label === "Lights Out"))')" = "true" ] \
  && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<h2 class="bigsec" id="sol-title">Ein Sol auf dem MARS!platz</h2>' && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<div class="eyebrow">Die Crew heute</div>' && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<span class="sol-kind">Wissenschaft</span>' \
  && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<h2 class="bigsec" id="sol-title">Un sol sur la MARS!platz</h2>' && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<dt>Extinction des feux</dt>' \
  && grep -q "sol: () => solFold(ctx, { today: (habitat || {}).today || null, crew: CREW })" src/views/pages/info.js && grep -q 'body.landing.about .sol-item { position: relative; display: grid; grid-template-columns: 64px 12px minmax(0, 1fr) auto;' public/aura.css && ! grep -q -- '--dur\|--sol-min\|kind-shift' public/aura.css \
  && grep -q 'body.landing.about .sol { --k-science: var(--cobalt); --k-eva: var(--mars); --k-comms: var(--mars);' public/aura.css && grep -q ':root\[data-theme="dark"\] body.landing.about .sol { --k-health: #4cc47f; --k-meal: #f0b429; --k-social: #8d8d98; }' public/aura.css \
  && ok "A sol on MARS!platz stands on the About page under What's inside the habitat — the day's sixteen activities on a rail, one row each, in the colour of its kind, the officer's name from the shift plan on the ones that are theirs (Science officer · Götz Dipper), the one under way marked NOW, today's crew with their portraits, the key, the communication hour and lights out — and no shift change anywhere, on the About page, the dashboard or the landing page — in German and French too" || bad "A sol on MARS!platz is not on the About page as it should be"
cp content/shifts.json "$CONTENT_DIR/shifts.json"
node -e '
const h = process.argv[1]; const names = [...h.matchAll(/<figure class="crew-pic">.*?<figcaption>([^<]*)<\/figcaption>/g)].map((m) => m[1]);
const want = ["Till Bechtloff", "Götz Dipper", "Jan Gerigk", "Yasha Jain", "Dominik Kautz", "Franziska Klöck", "Bernd Lintermann", "Tina Lorenz", "Finn Milbrandt", "Laura Schmidt", "Morgan Stricot", "Matthieu Vlaminck-Maurer", "Dan Wilcox"];
process.exit(JSON.stringify(names) === JSON.stringify(want) ? 0 : 1);
' "$ABOUT" && ok "the thirteen names are the files' (Firstname_Lastname), in the order of the surnames — Bechtloff to Wilcox, Klöck and Milbrandt in their places" || bad "the crew's names or their order are not the files'"
for f in bechtloff dipper gerigk jain kautz kloeck lintermann lorenz milbrandt schmidt stricot vlaminck-maurer wilcox; do [ "$(curl -s -o /dev/null -w '%{http_code}' $B/crew/$f.jpg)" = "200" ] || bad "no portrait /crew/$f.jpg"; done; ok "every portrait is served"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/crew/crew.json)" = "200" ] && grep -q "'../../../public/crew/crew.json'" src/views/pages/info.js && ok "the list is public/crew/crew.json, written by tools/crew-pictures.py and read by the page" || bad "the crew's list is not read from crew.json"
node -e '
const h = process.argv[1];
const row = (label) => { const i = h.indexOf("<div class=\"eyebrow\">" + label + "</div>"); if (i < 0) return null; const j = h.indexOf("</div></div>", i); return [...h.slice(i, j).matchAll(/<img src="\/partners\/([a-z-]+)\.png" alt="([^"]*)"/g)].map((m) => m[1]); };
const c = row("In cooperation with"), s = row("Supporters");
process.exit(JSON.stringify(c) === JSON.stringify(["staatstheater-karlsruhe", "naturkundemuseum-karlsruhe"]) && JSON.stringify(s) === JSON.stringify(["eon-foundation", "lbbw-stiftung", "innovationsfonds-kunst"]) ? 0 : 1);
' "$ABOUT" && ok "under Produced by: In cooperation with — the Staatstheater and the Naturkundemuseum; Supporters — E.ON Foundation, LBBW Stiftung, Innovationsfonds Kunst" || bad "the partners' logos are not in their two rows"
for f in staatstheater-karlsruhe naturkundemuseum-karlsruhe eon-foundation lbbw-stiftung innovationsfonds-kunst; do [ "$(curl -s -o /dev/null -w '%{http_code}' $B/partners/$f.png)" = "200" ] || bad "no logo /partners/$f.png"; done; ok "every logo is served"
grep -q '.logos .logo { display: inline-flex; align-items: center; justify-content: center; height: 48px;' public/station.css && grep -q '.crew-wall { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px 10px; }' public/station.css \
  && grep -q '.crew-pic figcaption { margin-top: 8px;' public/station.css && ok "the logos are small, each on a white tile; the portraits six to a row, the name under each" || bad "the logo or portrait rules are missing"
curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<div class="eyebrow">In Kooperation mit</div>' && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<div class="eyebrow">Soutiens</div>' && ok "the partners' rows are named in German and French" || bad "the partners' rows are not translated"
echo "$ABOUT" | grep -q '<h3>Messages sent to space</h3>' && echo "$ABOUT" | grep -q 'through SpaceSpeak — a small network of transmitters around the world' && echo "$ABOUT" | grep -q 'between 2.4 and 5 gigahertz' \
  && echo "$ABOUT" | grep -q 'From then on the message is on its way for good' && echo "$ABOUT" | grep -q 'nearly halfway to Proxima Centauri' \
  && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<h3>Nachrichten ins All</h3>' && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q 'grâce à SpaceSpeak' \
  && ok "About tells how a message goes to space — SpaceSpeak's transmitters, the band, the antenna, the speed of light, then where it gets to and that it never stops — in two paragraphs, in the three languages" || bad "the About page has no Messages sent to space section"
echo "$FOOT" | grep -q '<dialog class="popup" id="what"' && bad "the reading matter is still a pop-up on the landing page" || ok "no pop-ups for the reading matter on the landing page"
echo "$FOOT" | grep -q '<a class="tab tab-more" data-tab="more" href="/about">' && echo "$ABOUT" | grep -q '<a class="tab tab-more is-on" data-tab="more" href="/about">' \
  && ok "a phone's About key opens the page, and is lit there" || bad "the About key does not lead to the page"
echo "$FOOT" | grep -q '<nav class="tk-nav" aria-label="The station, page by page"><a class="tk-write" href="/write#write"><svg class="tk-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M13.5 6.5l3 3"/></svg><span>Write to the crew</span></a><a class="tk-dash" href="/dashboard"><svg class="tk-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/>' \
  && echo "$FOOT" | grep -q '<a class="tk-about" href="/about"><svg class="tk-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.5v.5"/></svg><span>About</span></a></nav>' \
  && echo "$ABOUT" | grep -q '<a class="tk-about" href="/about" aria-current="page">' && echo "$WRITE" | grep -q '<a class="tk-write" href="/write#write" aria-current="page">' && echo "$DASH" | grep -q '<a class="tk-dash" href="/dashboard" aria-current="page">' && ! echo "$FOOT" | grep -q 'tk-menu\|tk-dropdown\|tk-row' \
  && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '<span>Schreib der Crew</span></a>' && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '<span>Missions-Dashboard live</span></a>' && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '<span>Über</span></a></nav>' \
  && grep -q 'body.landing .tk-nav { flex: 1 1 auto; min-width: 0; display: flex; justify-content: center;' public/sheet.css && grep -q '  body.landing .tk-nav { display: none; }' public/sheet.css \
  && grep -q 'body.landing .tk-nav a, :root\[data-theme="dark"\] body.landing .tk-nav a { display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 22px 0 18px; border-radius: 14px; border: 1px solid transparent; background: #0f1116;' public/sheet.css \
  && grep -q 'body.landing .tk-nav a.tk-write, :root\[data-theme="dark"\] body.landing .tk-nav a.tk-write { background: linear-gradient(180deg, #ff8a3d, #ff5a1f); color: #1a0a02;' public/sheet.css && grep -q 'body.landing .tk-nav a.tk-dash, :root\[data-theme="dark"\] body.landing .tk-nav a.tk-dash { background: linear-gradient(180deg, #4f63ff, #2f45e8); color: #fff;' public/sheet.css && grep -q 'body.landing .tk-nav a.tk-about, :root\[data-theme="dark"\] body.landing .tk-nav a.tk-about { background: linear-gradient(180deg, #2a2c36, #0f1116); color: #fff;' public/sheet.css \
  && grep -q 'body.landing .tk-nav a\[aria-current="page"\], :root\[data-theme="dark"\] body.landing .tk-nav a\[aria-current="page"\] { outline: 3px solid var(--paper); outline-offset: -5px; }' public/sheet.css \
  && grep -q 'body.landing .tk-bar { display: flex; align-items: center; gap: 12px; height: 76px;' public/sheet.css && grep -q 'body.landing .tk-brand { display: inline-block; flex: none; font-family: var(--display); font-size: 26px; font-weight: 700;' public/sheet.css && grep -q 'border: 1px solid var(--mars); background: var(--mars); color: #fff;' public/sheet.css \
  && grep -q 'html { scroll-padding-top: 124px; }' public/sheet.css && [ "$(grep -c 'calc(100vh - 113px)' public/sheet.css)" = "3" ] && ! grep -q 'calc(100vh - 101px)' public/sheet.css \
  && grep -q 'body.landing .space .dome-nudge { position: absolute; z-index: 3; left: 50%; bottom: 12px; margin-left: -29px; color: var(--mars);' public/sheet.css \
  && ok "the header carries the three keys in the middle of its row — Write to the crew (with the pen; it opens the Write page's pop-up), Live Mission Dashboard, About — 48px tall in 16px type, each in a colour of its own (Mars, cobalt, ink), the page's own ringed, the name 26px and the sol a solid Mars pill in a 76px row (October: bigger, colour-coded), in the three languages; the arrow down in Mars; no three-lines menu; a phone held upright keeps them off its row" || bad "the header's links are not there, or the menu is"
echo "$FOOT" | grep -q "location.replace('/about?from=home'" && ok "the landing page's old #about, #what and #who-we-are lead there too" || bad "old About addresses lost"
grep -q "if (!onWrite) { window.location.href = '/write#exchanges'; return; }" public/write.js && grep -q "var wall = document.getElementById('exchanges'); if (wall) wall.scrollIntoView({ behavior: 'smooth', block: 'start' });" public/write.js \
  && grep -q "document.addEventListener('mcs:arrived', function (e) {" public/write.js && grep -q "setTimeout(leave, hold - 250);" public/write.js && grep -q "document.dispatchEvent(new CustomEvent('mcs:arrived', { detail: { hold: hold, kiosk:" public/composer.js \
  && grep -q "document.addEventListener('mcs:arrived', function (e) {" public/tabbar.js && grep -q "if (location.hash === '#write') history.replaceState(null, '', '#exchanges');" public/write.js \
  && ok "once a message has arrived — the dial holding on ARRIVED — the visitor is taken to the board before the empty box could come back: the pop-up closes and the wall comes into view on the Write page, any other page goes to the Write page's wall, a phone's dock lowers itself (October)" || bad "the pop-up does not take the visitor to the board once the message has arrived, or the box shows again"
V6=/tmp/visitor6.jar; rm -f $V6; curl -s -c $V6 -b $V6 -o /dev/null $B/
curl -s -b $V6 -c $V6 -X POST --data-urlencode "body=Sent from the window: the crossing carries a key to the board." -o /dev/null $B/communicate
# the Write page (public.js, writePage): the board as a wall of notes (boardWall) under the header alone — no masthead —
# and the composer's pop-up every public page carries (layout.js, writeKit; public/write.js): a window in the middle of
# the screen over the blurred page, opened by the floating Write key, a #write door or /write#write; the crossing plays
# in it with a Message Board key. The dashboard page is a page of its own, without a masthead either.
echo "$WRITE" | grep -q '<body class="landing inner messages write">' && echo "$WRITE" | grep -q '<section class="portal portal-pop" id="write" data-stop role="dialog" aria-modal="false" aria-labelledby="dev-title" aria-label="Write to the crew">' \
  && echo "$WRITE" | grep -q '<section class="wall-sec" id="exchanges" aria-label="Message Board">' && ! echo "$WRITE" | grep -q 'portal-lite\|portal-page\|class="portal-head"\|class="masthead"\|class="wall-write"' \
  && ! echo "$DASH" | grep -q 'class="masthead"' && echo "$ABOUT" | grep -q 'class="masthead"' \
  && ! echo "$WRITE" | grep -q '<section class="dash" id="mission">\|class="dash-grid"\|id="hbt-bento"\|class="feed-col"\|class="write-fab"' \
  && echo "$WRITE" | grep -q '<div class="feed-scroll" id="feed" data-poll="/api/board?limit=20&amp;wall=1" data-open="1"' && echo "$WRITE" | grep -q 'data-more="[01]" data-wall="1">' && echo "$WRITE" | grep -q '<div class="board wall">' \
  && echo "$WRITE" | grep -q '<div class="wall-bar" id="feed-bar">' \
  && echo "$WRITE" | grep -q '<div class="feed-end\( is-done\)\?" id="feed-end" data-loading="Loading older exchanges…" data-done="The beginning of the correspondence"' \
  && echo "$WRITE" | grep -q '<h2 class="dev-title" id="dev-title">Write to the crew</h2>' && echo "$WRITE" | grep -q '<div class="dev-head is-bare">' && ! echo "$WRITE" | grep -q '<span>Your callsign</span>\|<span>Operator</span>\|class="dev-chip' && ! curl -s $B/ | grep -q '<span>Operator</span>\|class="dev-chip' && echo "$WRITE" | grep -q '<span class="dev-signal" title="One-way signal">One-way signal <b>[0-9]* min</b> · [0-9.]* au</span>' \
  && echo "$WRITE" | grep -q 'maxlength="1000"' && echo "$WRITE" | grep -q '>0 / 1000</span>' && echo "$WRITE" | grep -q '<span class="lbl">Tags · choose up to 3</span>' \
  && echo "$WRITE" | grep -q '<title>Write to the crew — MARS!platz – Ground Station</title>' && curl -s $B/ | grep -q '<title>MARS!platz – Ground Station</title>' \
  && echo "$WRITE" | grep -q 'src="/composer.js' && echo "$WRITE" | grep -q 'src="/board.js' && echo "$WRITE" | grep -q 'src="/write.js' && ! echo "$WRITE" | grep -q 'src="/habitat.js\|src="/folder.js\|src="/hardware.js' \
  && echo "$DASH" | grep -q '<body class="landing inner dashboard">' && echo "$DASH" | grep -q '<section class="dash" id="mission">' && ! echo "$DASH" | grep -q 'id="feed"' && echo "$DASH" | grep -q 'src="/write.js' \
  && ! echo "$FOOT" | grep -q 'data-follow\|id="feed-cards"\|class="dash-grid"\|id="hbt-bento"\|class="wall-write"\|src="/board.js\|src="/habitat.js' && echo "$FOOT" | grep -q 'src="/composer.js' \
  && ! grep -q 'data-follow' public/composer.js && ! grep -q 'portal-lite\|wall-write\|write-fab' public/aura.css \
  && grep -q 'body.landing .portal-pop { position: fixed; inset: 0; z-index: 45; display: flex; align-items: center; justify-content: center;' public/aura.css \
  && grep -q 'body.landing .portal-pop::before { content: ""; position: absolute; inset: 0; background: rgba(233,237,240,.55); -webkit-backdrop-filter: blur(14px) saturate(1.1); backdrop-filter: blur(14px) saturate(1.1); }' public/aura.css \
  && grep -q 'body.landing .portal-pop.is-open { visibility: visible; opacity: 1; pointer-events: auto;' public/aura.css && grep -q 'body.landing .portal-pop .portal-grid { position: relative; display: block; width: min(640px, 100%);' public/aura.css \
  && grep -q 'body.landing .write-float { position: fixed; right: var(--gutter); bottom: 24px; z-index: 40;' public/aura.css && grep -q 'body.landing.write-open .write-float { visibility: hidden; }' public/aura.css \
  && grep -q '@media (max-width: 760px) and (min-height: 521px) { body.landing .write-float { display: none; } }' public/aura.css && grep -q '  body.landing:not(.messages) .portal-pop { display: none; }' public/aura.css \
  && grep -q 'body.landing .portal-pop .transit-board { display: flex;' public/aura.css && grep -q 'body.landing .portal-pop .composer-device .dev-stage .transit-block { position: static; overflow: visible; margin: 0; }' public/aura.css \
  && grep -q 'body.landing .portal-pop .dev-led, body.landing .portal-pop .dev-grip, body.landing .portal-pop .dev-knob, body.landing .portal-pop .dev-vents { display: none; }' public/sheet.css \
  && grep -q "if (!phone() && location.hash === '#write') setOpen(true, true);" public/write.js && grep -q "var a = e.target.closest('a\[href=\"#write\"\], a\[href=\"/#write\"\]' + (onWrite ? ', a\[href=\"/write#write\"\]' : ''));" public/write.js \
  && grep -q "var board = e.target.closest('.transit-board');" public/write.js && grep -q "if (e.key === 'Escape' && !phone() && isOpen()) setOpen(false, false);" public/write.js \
  && grep -q "if (crossed && !document.body.classList.contains('crossing') && phone() && isOpen()) setOpen(false, false);" public/tabbar.js && grep -q "if (isOpen()) setOpen(false, false);" public/write.js \
  && grep -q 'body.landing .wall-bar { position: sticky; top: 113px; z-index: 6;' public/aura.css && grep -q '  body.landing.messages .wall-bar { top: 83px; flex-wrap: wrap; margin: 0 -16px; padding: 8px 16px 10px; gap: 8px 12px; }' public/aura.css && grep -q '  body.landing.messages .wall-bar .feed-filter .chip { flex: none; }' public/aura.css \
  && grep -q 'body.landing .wall-wrap .feed-scroll { position: static; display: block; }' public/aura.css \
  && grep -qF "if (/^\\/?#write$/.test(href)) a.setAttribute('href', '/write#write');" public/tabbar.js && grep -qF "else if (/^\\/?#exchanges$/.test(href)) a.setAttribute('href', '/write#exchanges');" public/tabbar.js \
  && grep -q "tab('write', '/write#write', 'Write', current === '/write' ? ' is-on' : '')" src/views/layout.js \
  && grep -q "function writeKit(ctx, { inFlight, error = null, draft = '' } = {}) {" src/views/layout.js && grep -q "hero = require('./pages/public').ticker({ ...ctx, current }) + (withMasthead ? masthead(ctx) : '');" src/views/layout.js \
  && grep -q "const MAX_CHARS = Number(process.env.MESSAGE_MAX_CHARS || 1000);" src/server.js && grep -q "const MAX = Number(process.env.MESSAGE_MAX_CHARS || 1000);" src/views/pages/communicate.js && grep -q "MESSAGE_MAX_CHARS=1000" .env.example \
  && echo "$WRITE" | grep -q '<a class="write-float" href="#write" id="write-fab" aria-controls="write" aria-expanded="false"><span class="wf-idle">' && echo "$WRITE" | grep -q '<span class="wf-cross" aria-live="polite"><svg class="wf-ring" viewBox="0 0 36 36" aria-hidden="true">' \
  && curl -s -b $V6 $B/about | grep -q '<a class="write-float is-crossing" href="#write" id="write-fab"' \
  && grep -q "body.landing .write-float.is-crossing .wf-cross { display: flex; }" public/aura.css && grep -q "if (ring) ring.setAttribute('stroke-dasharray', (p \* 100).toFixed(1) + ' 100');" public/write.js \
  && grep -q "  body.landing.dashboard .dash-links { position: sticky; top: 113px; z-index: 8;" public/aura.css && grep -q "  body.landing.dashboard .frail { top: 190px; }" public/aura.css \
  && grep -q "  body.landing.dashboard .folder-body .dpanel:not(.blogp) > .dpanel-head { position: sticky; top: 178px; z-index: 4;" public/aura.css && grep -q "  body.landing.dashboard .folder-body .dpanel.blogp > .dpanel-head { position: sticky; top: 190px; z-index: 4; }" public/aura.css \
  && ok "the composer is a window in the middle of the screen over the blurred page, on every public page — opened by the floating Write key at the foot of the window, a #write door or /write#write, closed by its cross, Escape or a click on the blur; your callsign and the one-way signal in its head, a thousand characters, up to three tags, a Message Board key once the message is crossing; the floating key is the crossing itself while a message is on its way, on every page; the Write page and the dashboard page carry no masthead; the dashboard's doors and sols and the open folder's head stay put while its content scrolls" || bad "the Write page or the mission page's composer is not as it should be"
# the crossing's Message Board key: in the transit display of the page's composer, not on the installation's writing screen
curl -s -b $V6 $B/about | grep -q '<a class="btn primary transit-board" href="/write#exchanges">Message Board <span aria-hidden="true">→</span></a>' \
  && grep -q "\${kiosk ? '' : \`" src/views/pages/communicate.js \
  && ok "the crossing carries a Message Board key — to the wall (on the Write page the key folds the window away and brings the wall into view); the installation's writing screen has none" || bad "the crossing's Message Board key is missing, or on the writing screen"
# the wall loads the page before as the reader scrolls: /api/board?before=<id>&at=<sent> — the published exchanges sent
# before that one, twenty at a time, the reader's own never among them; `more` says whether a page may follow
OLDEST=$(curl -s "$B/api/board?limit=1&wall=1" | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const j = JSON.parse(s); const m = /id="m(\d+)"[\s\S]*?class="note-when" datetime="([^"]+)"/.exec(j.cards); process.stdout.write(m ? m[1] + " " + m[2] : ""); });')
[ -n "$OLDEST" ] && curl -s "$B/api/board?limit=20&wall=1&before=${OLDEST% *}&at=${OLDEST#* }" | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const j = JSON.parse(s); process.exit(typeof j.more === "boolean" && typeof j.count === "number" && typeof j.cards === "string" && !/data-mine/.test(j.cards) && !/id="m'"${OLDEST% *}"'"/.test(j.cards) ? 0 : 1); });' \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' "$B/api/board?before=x")" = "400" ] \
  && grep -q "fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'before=' + before.id + (before.at ? '&at=' + encodeURIComponent(before.at) : ''), { cache: 'no-store', credentials: 'same-origin' })" public/board.js \
  && grep -q "new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) loadOlder(); }, { rootMargin: '600px 0px' }).observe(end);" public/board.js \
  && grep -q "function merge(html) {" public/board.js && grep -q "if (wall) { merge(data.cards); counts(data); return; }" public/board.js && grep -q "c.setAttribute('data-older', '1');" public/board.js \
  && grep -q "var key = e.target.closest ? e.target.closest('.note-tag\[data-filter\]') : null;" public/board.js \
  && grep -qF "function sentAt(c) { var t = c.querySelector('time.note-when[datetime]') || c.querySelector('time[datetime]'); return t ? t.getAttribute('datetime') : ''; }" public/board.js \
  && ok "the wall fetches the page of exchanges before its oldest as the reader nears the end (never the reader's own, never the one asked after), says 400 to a bad id, lays a live refresh in by id and keeps what was scrolled on to; a tag in a note's band narrows the wall" || bad "the wall does not load or refresh as it should"
# a note has a colour of its own against the ground (October: "a background of a colour to each message, to show the
# difference") — warm paper by day, a warm graphite a good step lighter than the night's ground; no fold token any more
grep -q ':root { --note-bg: #fbf6ee; --note-edge: #e4dac8;' public/aura.css && grep -q ':root\[data-theme="dark"\] { --note-bg: #2f2b29; --note-edge: #4a4440; --note-shadow:' public/aura.css && ! grep -q -- '--note-fold' public/aura.css \
  && ! grep -q -- '--note-bg: #212127\|--note-bg: #f0f1f5\|--note-bg: #ffffff\|--note-bg: #303036' public/aura.css \
  && grep -q 'body.landing .card.note .card-reply.note-answer { margin: 2px 0 0; padding: 10px 12px 11px; background: #fff;' public/aura.css \
  && ok "a note is warm paper (#fbf6ee) on the cool drafting paper by day and a warm graphite (#2f2b29) on the night's near-black ground — set apart from the page in both themes, the answer a white card on it" || bad "the notes' colour is not set apart from the ground"
# the message's round trip in the corner, where the folded corner was (October: "something visual that shows if the
# message has been answered or not" — and not a tick): Earth, cobalt, at the lower left, Mars at the upper right —
# answered, the loop closed in Mars orange and Mars lit; still out, the way out alone, dashed, the message a dot flying
# along it, Mars hollow; arrived, the dot inside Mars, pulsing; the viewer's own notes keep a Mars edge at the left
echo "$BRD" | grep -q '<span class="note-mark is-answered" title="Answered by the crew"><svg viewBox="0 0 32 32" aria-hidden="true"><ellipse class="nm-loop" cx="16" cy="16" rx="12.7" ry="7" transform="rotate(-45 16 16)"/><circle class="nm-earth" cx="7" cy="25" r="3.6"/><circle class="nm-mars" cx="25" cy="7" r="4.2"/></svg></span>' \
  && V9=/tmp/visitor9.jar && rm -f $V9 && curl -s -c $V9 -X POST --data-urlencode "body=Is my signal still out there?" -o /dev/null $B/communicate \
  && curl -s -b $V9 $B/write | grep -q '<span class="note-mark is-waiting" title="IN TRANSIT"><svg viewBox="0 0 32 32" aria-hidden="true"><path class="nm-back" d="M25 7A12.7 7 -45 0 1 7 25"/><path class="nm-out" d="M7 25A12.7 7 -45 0 1 25 7"/><circle class="nm-earth" cx="7" cy="25" r="3.6"/><circle class="nm-mars" cx="25" cy="7" r="4.2"/><circle class="nm-ship" r="2.2"/></svg></span>' \
  && sleep 4 && curl -s -b $V9 $B/write | grep -q '<span class="note-mark is-waiting is-arrived" title="AWAITING REPLY"><svg' \
  && curl -s -H "Cookie: mcs_lang=de" $B/write | grep -q 'class="note-mark is-answered" title="Von der Crew beantwortet"' && curl -s -H "Cookie: mcs_lang=fr" $B/write | grep -q 'title="Répondu par l’équipage"' \
  && ! grep -q 'body.landing .card.note::before\|body.landing .card.note::after\|body.landing .card.note\[data-mine\]::before\|nm-tick\|nm-disc' public/aura.css && ! grep -q 'nm-tick\|nm-arc' src/views/pages/public.js \
  && grep -q 'body.landing .card.note .note-mark { position: absolute; top: 6px; right: 6px; width: 32px; height: 32px; z-index: 2; color: var(--mars); pointer-events: none; }' public/aura.css \
  && grep -q 'body.landing .card.note .note-mark .nm-earth { fill: var(--cobalt); }' public/aura.css && grep -q 'body.landing .card.note .note-mark .nm-loop { stroke: var(--mars); stroke-width: 1.8; }' public/aura.css && grep -q 'body.landing .card.note .note-mark .nm-mars { fill: var(--mars); }' public/aura.css \
  && grep -q 'body.landing .card.note .note-mark.is-waiting .nm-out { stroke: currentColor; stroke-width: 1.8; stroke-dasharray: 2.8 2.6; }' public/aura.css && grep -q 'body.landing .card.note .note-mark.is-waiting .nm-mars { fill: none; stroke: var(--mars); stroke-width: 1.6; }' public/aura.css \
  && grep -q "body.landing .card.note .note-mark.is-waiting .nm-ship { display: block; fill: currentColor; offset-path: path('M7 25A12.7 7 -45 0 1 25 7'); animation: nm-fly 6s linear infinite; }" public/aura.css \
  && grep -q 'body.landing .card.note .note-mark.is-arrived .nm-ship { animation: none; offset-distance: 100%; fill: var(--mars); }' public/aura.css && grep -q 'body.landing .card.note .note-mark.is-arrived .nm-mars { transform-origin: 25px 7px; animation: nm-pulse 2.8s ease-in-out infinite; }' public/aura.css \
  && grep -q '@keyframes nm-fly { from { offset-distance: 0%; } to { offset-distance: 100%; } }' public/aura.css && grep -q 'body.landing .card.note .note-mark.is-waiting .nm-ship { animation: none; offset-distance: 50%; }' public/aura.css \
  && grep -q 'body.landing .board .card.note\[data-mine\] { padding-left: 0; box-shadow: inset 3px 0 0 var(--mars), var(--note-shadow); }' public/aura.css \
  && grep -q 'body.landing .card.note .note-head { display: flex; align-items: center; gap: 10px; padding: 12px 44px 12px 16px;' public/aura.css \
  && ok "in a note's corner the message's round trip stands where the fold was — answered: the Earth–Mars loop closed in orange, Mars lit (Answered by the crew, in German and French too); still out: the way out dashed with the message flying along it, Mars hollow, then the dot inside Mars once it has arrived (the state's words as the title) — no tick, no fold; the viewer's own notes carry a Mars edge at the left" || bad "the signal mark is not in the notes' corner as it should be"
# a note the filter puts aside is gone from the wall in every theme: the rule outweighs the dark theme's rule for the note,
# which had left every note standing under a chosen tag (October: "it's not filtering messages by tag on the /write page")
grep -q 'body.landing .card.note.is-hidden, :root\[data-theme="dark"\] body.landing .card.xc.note.is-hidden, body.landing .card.is-hidden { display: none !important; }' public/aura.css \
  && ! grep -q '^body.landing .card.note.is-hidden { display: none; }' public/aura.css \
  && ok "a note the filter has put aside is display: none whatever the theme — the chips and the notes' tags narrow the wall in the dark theme too, and the wall fetches the older pages until the tag's notes are on it" || bad "a hidden note can still stand on the wall in the dark theme"
V5=/tmp/visitor5.jar; rm -f $V5
curl -s -c $V5 -b $V5 -o /dev/null $B/
[ "$(curl -s -b $V5 -c $V5 -X POST --data-urlencode "body=Sent from the mission page, followed on the Write page." -d "tags=QUESTION" -o /dev/null -w '%{http_code} %{redirect_url}' $B/communicate)" = "302 $B/write#write" ] \
  && curl -s -b $V5 $B/write | grep -q 'class="transit transit-block"' && curl -s -b $V5 $B/write | grep -q 'Sent from the mission page, followed on the Write page.' \
  && ok "a plain post lands on the Write page with the pop-up open, where the message is crossing and stands on the board" || bad "a plain post is not followed on the Write page"
[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -e "$B/write" -X POST -d "body=x" $B/communicate)" = "302 $B/write?err=Write%20something%20before%20transmitting.#write" ] \
  && ok "a refused post from the Write page goes back there with its word" || bad "a refused post from the Write page does not go back there"
echo "$FOOT" | grep -q 'id="crewlog"' && bad "the crew log panel is still on the landing page" || ok "no crew log panel on the landing page — the log lives at /logbook and in At a Glance"
echo "$FOOT" | grep -q 'id="media"' && bad "the media panel is still on the landing page" || ok "no media panel — the media lives at /media and in At a Glance"
echo "$FOOT" | grep -q 'id="whole"' && bad "the whole-mission panel is still on the landing page" || ok "no whole-mission panel — the run day by day lives in At a Glance"
echo "$FOOT" | grep -q 'class="ticker"' && echo "$FOOT" | grep -q 'id="tk-track"' && ! echo "$FOOT" | grep -q 'tk-clock\|HABITAT TIME' && ok "a ticker runs across the top: the current activity on its running line; no clock in the bar any more" || bad "no ticker on the landing page, or the clock is still in it"
echo "$FOOT" | grep -q 'id="tk-now"' && echo "$FOOT" | grep -q 'data-tasks=' && ok "the ticker says what the crew are currently doing and switches to the next task as its time comes" || bad "ticker has no current activity"
echo "$FOOT" | grep -qF "fetch('/api/ticker'" && echo "$FOOT" | grep -qF "5 * 60 * 1000" && ok "and refreshes the schedule from the station every five minutes" || bad "ticker does not refresh on a cycle"
TK=$(curl -s $B/api/ticker)
echo "$TK" | grep -q '"tasks":\[' && echo "$TK" | grep -q '"label"' && echo "$TK" | grep -q '"detail"' && ok "/api/ticker hands the day's activities with their detail" || bad "/api/ticker broken"
echo "$FOOT" | grep -q 'id="tk-hab"' && ok "and the node's current reading, refreshed on its cycle" || bad "ticker has no habitat reading"

echo "── one mood scale, thrilled to angry"
[ "$(curl -s -b $A $B/control | grep -c 'class="mood-face"')" = "15" ] \
  && ok "one scale of five faces per officer, thrilled to angry" || bad "wrong number of mood faces"
curl -s -b $A $B/control | grep -q ">THRILLED<" && curl -s -b $A $B/control | grep -q ">ANGRY<" && ! curl -s -b $A $B/control | grep -q ">CALM<\|>SETTLED<\|>LEVEL<\|>TENSE<" \
  && curl -s -b $A $B/control | grep -q 'title="Thrilled — thrilled — on top of the world"' && curl -s -b $A $B/control | grep -q 'title="Happy — happy, in good spirits"' && curl -s -b $A $B/control | grep -q 'title="Neutral — neutral — neither up nor down"' \
  && curl -s -b $A $B/control | grep -q 'title="Upset — upset, not having a good day"' && curl -s -b $A $B/control | grep -q 'title="Angry — angry, needing distance"' \
  && node -e 'const m = require("./src/lib/mood"); const c = (v) => m.condition({ calm_tense: v }); process.exit(c(0) === "THRILLED" && c(25) === "HAPPY" && c(50) === "NEUTRAL" && c(75) === "UPSET" && c(100) === "ANGRY" && m.FACES.map((f) => f.name).join() === "Thrilled,Happy,Neutral,Upset,Angry" && m.translate({ calm_tense: 10 }).lines[0] === "thrilled — on top of the world" ? 0 : 1);' \
  && node -e 'const i = require("./src/lib/i18n"); const T = i.of("de"), F = i.of("fr"); process.exit(T("THRILLED") === "BEGEISTERT" && T("UPSET") === "BEDRÜCKT" && F("HAPPY") === "HEUREUX" && T("happy, in good spirits") === "glücklich, gut gelaunt" && F("neutral — neither up nor down") === "neutre — ni haut ni bas" && !i.D["CALM"] && !i.D["TENSE"] ? 0 : 1);' \
  && grep -q "var BANDS = \['thrilled \\\\u2014 on top of the world', 'happy, in good spirits'," public/control.js \
  && ok "the scale is thrilled · happy · neutral · upset · angry (October's five words) — the faces named so, the words and sentences in German and French too, the desk's script in step; calm, settled, level and tense are gone" || bad "the moods are not the five words"
curl -s -b $A $B/control | grep -q "What they are doing" && bad "the activity field is still on the state form" || ok "the state is the scale alone — no activity field"

echo "── habitat on the mission page"
# The habitat section is the Sensor-11 dashboard: the server polls the
# external feed into SQLite, the browser draws from /api/habitat/data.
LAND=$(curl -s $B/dashboard)
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
curl -s $B/write | grep -q "card-sent" && ok "each message carries its sent date and time" || bad "no timestamp on messages"

echo "── the crossing"
curl -s $B/write | grep -q 'id="composer"' || true
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
PAGE=$(curl -s -b $V $B/write); DPAGE=$(curl -s -b $V $B/dashboard)
for s in "Message Board"; do
  echo "$PAGE" | grep -q ">$s</h" || bad "mission page missing heading: $s"
done
echo "$DPAGE" | grep -q 'id="habitat"' || bad "no habitat panel on the dashboard"
! echo "$PAGE" | grep -q 'id="habitat"\|class="dash-grid"\|id="hbt-bento"' || bad "the dashboard is still on the Write page"
! echo "$DPAGE" | grep -q 'id="feed"\|class="composer-device' || bad "the board or the composer is on the dashboard page"
ok "the board is headed on the Write page; the habitat is a panel of the dashboard page — and neither page carries the other's"
MISSIONPAGE=$(curl -s -b $V $B/)
echo "$MISSIONPAGE" | grep -q 'class="sheet-intro"' && ok "the sheet's head leads the mission page" || bad "no sheet head"
echo "$MISSIONPAGE" | grep -q 'class="wordmark">MARS<span class="bang">!</span>platz' && ok "the Mars!platz wordmark is on the masthead" || bad "no wordmark on the masthead"
echo "$PAGE" | grep -q 'class="device composer-device' && echo "$MISSIONPAGE" | grep -q 'class="device composer-device' && ok "the composer is a device — in the window every page carries" || bad "no composer device"
echo "$PAGE" | grep -q '<div class="board wall">' && ! echo "$MISSIONPAGE" | grep -q 'class="board' && ok "the board is the Write page's wall of notes, not the mission page's" || bad "no board screen"
echo "$MISSIONPAGE" | grep -q 'class="run-dates"' && ok "the run and its day are stated under the wordmark" || bad "no run dates on the masthead"
echo "$PAGE$MISSIONPAGE" | grep -q 'class="nav"' && bad "top navigation still on the landing page" \
  || ok "landing navigation lives in the footer"
echo "$PAGE" | grep -q 'id="feed-filter"' && ok "the board carries its tag filters" || bad "no board filter"
echo "$PAGE" | grep -q 'data-filter="mine"' && ok "the board offers a my-messages filter" || bad "no my-messages filter"
curl -s -b $V2 $B/write | grep -q 'data-mine="1"' \
  && ok "a visitor's own messages are marked as theirs" || bad "own messages not marked"
echo "$DPAGE" | grep -q 'class="dash-grid"' && ok "the mission dashboard lays everything out in one grid" || bad "no dashboard grid"
echo "$DPAGE" | grep -q 'class="kpis"' && ok "the dashboard leads with its headline figures" || bad "no headline figures"
echo "$DPAGE" | grep -q 'id="hbt-bento"' && ok "the habitat dashboard shell is on the page" || bad "no habitat dashboard"
node -e '
const h = require("child_process").execSync("curl -s http://localhost:8080/dashboard", { maxBuffer: 1 << 26 }).toString();
const at = (id) => h.indexOf("id=\"" + id + "\"");
const t = at("trends"), s = at("blog-science"), e = at("blog-health"), c = at("blog-commander");
process.exit(t > -1 && s > t && e > s && c > e ? 0 : 1);
' && ok "below the trend graph: Daily Mission Report, Health Report, Commander Blog, in that order" || bad "the three blogs are not below the trend graph in order"
echo "$DPAGE" | grep -q "Daily Mission Report" && echo "$DPAGE" | grep -q "Health Report" && echo "$DPAGE" | grep -q "Commander Blog" \
  && ok "the three blog panels are headed" || bad "a blog panel heading is missing"
echo "$DPAGE" | grep -q '/habitat.js' && ! echo "$PAGE" | grep -q '/habitat.js\|/folder.js\|/hardware.js' && ok "the habitat renderer is loaded on the dashboard page, and not on the Write page" || bad "habitat.js not loaded"
echo "$PAGE" | grep -q "Habitat occupation begins" && bad "countdown panel still present" \
  || ok "the countdown panel is gone"
echo "$PAGE" | grep -q 'chan">COMMS<' && bad "communication counts panel still present" \
  || ok "the communication counts panel is gone"
[ "$(echo "$PAGE" | grep -c 'class="composer"')" = "1" ] \
  && ok "one composer on the mission page, at the top" || bad "wrong number of composers"
echo "$DPAGE" | grep -q 'class="gauge ' && ok "inventory gauges on the dashboard page" || bad "no gauges"
echo "$DPAGE" | grep -q 'class="badge' && ok "crew conditions on the dashboard page" || bad "no crew conditions"
echo "$DPAGE" | grep -qE "Hatch seal|Wake and habitat check" && ok "daily schedule on the dashboard page" || bad "no daily schedule"

echo "── crew and env"
curl -s $B/dashboard | grep -q "COMMANDING OFFICER" && curl -s $B/dashboard | grep -q "HEALTH OFFICER" && ! curl -s $B/dashboard | grep -qi "communication officer" \
  && ok "the three officers are the commanding, science and health officers — the first shown by the new title everywhere" || bad "crew roles wrong"
curl -s $B/dashboard | grep -q "CAPTAIN" && bad "the captain is still in the crew" || ok "no captain left over"
curl -s $B/dashboard | grep -q 'class="logo"' && bad "the mark is back in the top right" \
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
DEW=$(curl -s -b $LJ $B/write); DED=$(curl -s -b $LJ $B/dashboard)
DEA=$(curl -s -b $LJ $B/about)
echo "$DE" | grep -q '<html lang="de"' && ok "the page declares German" || bad "html lang is not de"
echo "$DEW" | grep -q "Nachrichtenboard" && ok "the board heading reads in German" || bad "board heading not translated"
echo "$DEW" | grep -q ">Senden<" && ok "the transmit button reads in German" || bad "transmit button not translated"
echo "$DED" | grep -q "Gesundheitsbericht" && echo "$DED" | grep -q "Commander-Blog" && echo "$DEA" | grep -q "<title>More-than-Human</title>" && echo "$DEA" | grep -q "<title>Kommunikation</title>" && echo "$DEA" | grep -q "<title>Wasserrecycling</title>" && echo "$DEA" | grep -q "<title>Wissenschaftsmission</title>" && echo "$DEA" | grep -q "<title>Wohnquartier</title>" \
  && ok "the blog panels and the habitat's modules read in German" || bad "blog panels or room names not translated"
echo "$DE" | grep -q 'value="de" class="on" aria-current="true"' && ok "the switch marks DE as current" || bad "DE not marked current"
echo "$DE" | grep -q 'window.MCS_T=' && echo "$DE" | grep -q '"Message Board":"Nachrichtenboard"' \
  && ok "the page carries the German table for its scripts" || bad "no MCS_T table for the page scripts"
echo "$DE" | grep -q 'class="wordmark">MARS<span class="bang">!</span>platz' && ok "the wordmark is not translated" || bad "wordmark changed"
echo "$DE" | grep -q "ZKM | Hertzlab" && ok "ZKM | Hertzlab stays as written" || bad "ZKM | Hertzlab changed"
curl -s -b $LJ -c $LJ -X POST -d "to=fr" -o /dev/null $B/lang
FR=$(curl -s -b $LJ $B/write)
echo "$FR" | grep -q '<html lang="fr"' && echo "$FR" | grep -q "Tableau des messages" \
  && ok "French: lang attribute and board heading" || bad "French did not apply"
curl -s -b $LJ -c $LJ -X POST -d "to=xx" -o /dev/null $B/lang
curl -s -b $LJ $B/ | grep -q '<html lang="en"' && ok "an unknown language falls back to English" || bad "unknown language did not fall back"
curl -s -b $LJ -c $LJ -X POST -d "to=de" -o /dev/null $B/lang
LOG=$(curl -s -b $LJ $B/logbook)
echo "$LOG" | grep -q '<html lang="de"' && ok "the crew log page is in German" || bad "crew log page not German"
echo "$LOG" | grep -q "to be written at the end of this day" && ok "the crew's placeholder text stays untranslated" || bad "logbook content was translated or lost"
echo "$LOG" | grep -q "Commander-Blog" && echo "$LOG" | grep -q "Gesundheitsbericht" && ok "the three blogs are named in German" || bad "blog titles not translated"
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
LAND=$(curl -s $B/dashboard)
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
curl -s $B/dashboard | grep -q "Reading the channels" \
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
if (!hab.includes("chan\">DAILY MISSION<")) fail.push("schedule not on habitat");
if (!hab.includes("chan\">DAILY FOOD PLAN<")) fail.push("food plan not on habitat");
if (!he.includes("chan\">CREW FIGURES<")) fail.push("figures not on health");
if (!s.includes("chan\">SCIENCE<") || !he.includes("chan\">HEALTH<")) fail.push("report cards missing");
if (/chan">DAILY MISSION<|chan">DAILY FOOD PLAN<|chan">CREW FIGURES</.test(s + c)) fail.push("editors leaked onto science or comms");
if (fail.length) { console.error(fail.join("; ")); process.exit(1); }' \
  && ok "schedule and food plan on habitat, figures on health, reports on their officers, nothing leaks" || bad "editors are on the wrong panes"

curl -s -b $A $B/control > /tmp/comms.html
POS_SCHED=$(grep -bo 'chan">DAILY MISSION<' /tmp/comms.html | head -1 | cut -d: -f1)
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
echo "$HB" | grep -q 'data-slot="RATION"' && bad "the Other card is still on the desk" || ok "no Other card: Breakfast, Lunch and Dinner, each with a recipe dropdown"
echo "$HB" | grep -q '<button type="button" class="ghost meal-add">+ Add a meal</button>' && echo "$HB" | grep -q '<template class="meal-extra-tpl">' && echo "$HB" | grep -q 'name="EXTRA__N___recipe" class="recipe-pick" data-slot="EXTRA__N__"' \
  && echo "$HB" | grep -q 'name="EXTRA__N___at"' && echo "$HB" | grep -q 'class="ghost meal-remove"' \
  && ok "+ Add a meal: a template card with the same recipe dropdown, the time it is served at and a × to take it off" || bad "no + Add a meal template, or it lacks the dropdown, the time or the ×"
echo "$HB" | grep -q 'The recipes are in' && bad "the recipes-are-in sentence is still on the desk" || ok "the food plan's hint no longer names content/recipes.json or says everything is public"
echo "$HB" | grep -q 'Not saved from this desk yet' && bad "Not saved from this desk yet is still on the desk" || ok "a block never saved from the desk says nothing about it — no Not saved from this desk yet anywhere"
echo "$HB" | grep -q 'the food meter, 06:00–09:00' && echo "$HB" | grep -q '(breakfast 06:00–09:00, lunch 09:00–14:00, dinner 15:00–22:00)' && ! echo "$HB" | grep -q 'kitchen meter' \
  && ok "each named card says its hours and that its power is the food meter's between them (the Food channel's energy meter — no kitchen meter anywhere)" || bad "the cards do not name the food meter and the hours"
echo "$HB" | grep -q 'value="__edit"' && bad "the dropdown still offers to edit the book" || ok "no edit entry in the dropdown"
echo "$HB" | grep -q 'chan">RECIPE BOOK<' && bad "the recipe book editor is still on the desk" || ok "no recipe book editor on the desk"
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

echo "── added meals, and the power each meal drew from the food meter"
# + Add a meal: the cards post as EXTRA<n>, in their order, and are saved as EXTRA1, EXTRA2, … (renumbered, so taking
# one away leaves no gap); an added meal carries the time it is served at (served — the card's, else the habitat's clock
# as it is saved); Other (RATION) from an older file is read as one.
curl -s -b $A -X POST -d "day=2" -d "BREAKFAST_name=Oats" -d "BREAKFAST_kcal=400" \
  -d "EXTRA2_name=Late broth" -d "EXTRA2_kcal=90" -d "EXTRA5_name=Afternoon tea" -d "EXTRA5_kcal=180" -d "EXTRA5_at=16:30" \
  -d "EXTRA7_name=No time given" -o /dev/null $B/control/meals
node -e '
const d = require(process.env.CONTENT_DIR + "/meals.json")["2"];
const slots = d.map((m) => m.slot).join(",");
const tea = d.find((m) => m.name === "Afternoon tea"), none = d.find((m) => m.name === "No time given");
process.exit(slots === "BREAKFAST,EXTRA1,EXTRA2,EXTRA3" && tea.slot === "EXTRA2" && tea.served === "16:30" && /^\d\d:\d\d$/.test(none.served) ? 0 : 1);
' && ok "added meals are saved as EXTRA1, EXTRA2, EXTRA3 in the order posted, each with the time it is served at — the card's, or the clock's when the card gave none" || bad "added meals not saved as expected"
sleep 1.5
HB2=$(curl -s -b $A "$B/control?tab=habitat&day=2")
echo "$HB2" | grep -q 'data-slot="EXTRA1"' && echo "$HB2" | grep -q 'data-slot="EXTRA3"' && echo "$HB2" | grep -q 'data-next-extra="4"' \
  && echo "$HB2" | grep -q '<h3 class="slot-name">Extra meal <span class="slot-n">2</span></h3>' && echo "$HB2" | grep -q 'name="EXTRA2_at" value="16:30"' \
  && ok "the desk reopens the day with its three added cards — Extra meal, Extra meal 2 (served at 16:30), Extra meal 3 — and the next one would be the fourth" || bad "the added cards do not reopen as saved"
echo "$HB2" | grep -q 'food plan saved — 4 meals (3 added)' && ok "the save says how many meals, and how many of them added" || bad "the flash does not count the added meals"
curl -s -b $A "$B/archive/day/2" | grep -q 'Extra meal 2 · 16:30' && ok "the record names an added meal by its number and the time it is served at" || bad "the archive's day page does not name the added meal"
curl -s -b $A "$B/archive/day/2/export.md" | grep -q '^\*\*Extra meal 2 (16:30): Afternoon tea\*\*' && ok "and so does the readable copy" || bad "the markdown copy does not name the added meal"
# the Other slot of an older file is read as an added meal and shown as Other
node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/meals.json";
const d = JSON.parse(fs.readFileSync(p, "utf8")); d["2"] = [{ slot: "RATION", name: "Emergency ration", kcal: 300 }, { slot: "EXTRA1", name: "Night snack", kcal: 120, served: "23:00-23:30" }]; fs.writeFileSync(p, JSON.stringify(d, null, 2));'   # an older file's hours: their start is the time
sleep 2
curl -s -b $A "$B/archive/day/2" | grep -q '<div class="eyebrow">Other</div>' && curl -s -b $A "$B/control?tab=habitat&day=2" | grep -q 'value="Emergency ration"' \
  && ok "an Other from an older file still loads — shown as Other, and on the desk as an added meal" || bad "the old RATION slot is refused or lost"
curl -s -b $A -X POST -d "day=2" -d "EXTRA1_name=Night snack" -d "EXTRA1_kcal=120" -d "EXTRA1_at=23:00" -o /dev/null $B/control/meals
node -e 'const d = require(process.env.CONTENT_DIR + "/meals.json")["2"]; process.exit(d.length === 1 && d[0].slot === "EXTRA1" && d[0].served === "23:00" ? 0 : 1);' \
  && ok "a card taken off the desk (not posted) is gone with the save; the one kept keeps its time" || bad "removing an added meal did not take it off the day"
# the power a meal drew: the food meter (sensor.habitat_power_food_energie, the Food channel's, content/home-assistant.json `meals`)
# read between the meal's hours on its day — breakfast 06:00–09:00, lunch 09:00–14:00, dinner 15:00–22:00 — the meter
# only grows, so the hours' consumption is its rise inside them from where it stood before; an added meal counts with the
# named meal whose hours cover the time it is served at (tea at 16:00: dinner's)
curl -s -b $A -X POST -d "day=1" -d "BREAKFAST_name=Porridge" -d "BREAKFAST_kcal=400" -d "LUNCH_name=Soup" -d "LUNCH_kcal=300" -d "EXTRA1_name=Tea" -d "EXTRA1_kcal=50" -d "EXTRA1_at=16:00" -o /dev/null $B/control/meals
node -e '
const { db } = require("./src/db"); const mission = require("./src/lib/mission"); const m = mission.config(), date = mission.dateForDay(1);
const at = (hhmm) => mission.venueTimeUtc(date, hhmm, m.timezone);
const ins = db.prepare("INSERT OR IGNORE INTO ha_reading (entity, t, value, state, unit) VALUES (?, ?, ?, ?, ?)");
for (const [h, v] of [["05:00", 100.0], ["06:30", 100.1], ["08:59", 100.3], ["12:00", 100.3], ["16:20", 100.35], ["16:50", 100.4], ["21:00", 100.9]]) ins.run("habitat_power_food_energie", at(h), v, String(v), "kWh");
const ha = require("./src/lib/home-assistant");
const b = ha.mealPower(1, "BREAKFAST"), l = ha.mealPower(1, "LUNCH"), d = ha.mealPower(1, "DINNER"), n = ha.mealPower(1, "EXTRA1");
// breakfast: 100.0 before the hours, 100.3 at their end → 300 Wh; lunch: one reading, no rise → 0; dinner: from 100.3 (last before 15:00) to 100.9 → 600; an added slot has no hours of its own
const ok = b.wh === 300 && b.window.join("-") === "06:00-09:00" && l.wh === 0 && d.wh === 600 && n.wh === null && n.window === null && !b.running
  && ha.slotForTime("05:30") === "BREAKFAST" && ha.slotForTime("08:59") === "BREAKFAST" && ha.slotForTime("09:00") === "LUNCH" && ha.slotForTime("14:30") === "LUNCH" && ha.slotForTime("16:00") === "DINNER" && ha.slotForTime("23:30") === "DINNER" && ha.slotForTime("") === null
  && ha.parseTime("16:30") === "16:30" && ha.parseTime("7:05") === "07:05" && ha.parseTime("16:00-17:00") === "16:00" && ha.parseTime("x") === null;
if (!ok) console.error(JSON.stringify({ b, l, d, n }));
process.exit(ok ? 0 : 1);
' && ok "mealPower reads the meter's rise inside each named meal's hours — breakfast 300 Wh, lunch 0, dinner 600 — and a time of day counts with the meal whose hours begin last before it (05:30 breakfast, 14:30 lunch, 23:30 dinner)" || bad "mealPower or slotForTime does not read the hours as expected"
sleep 1
HB1=$(curl -s -b $A "$B/control?tab=habitat&day=1")
echo "$HB1" | grep -q '<b>300 Wh</b> · the food meter, 06:00–09:00' && echo "$HB1" | grep -q '<b>600 Wh</b> · the food meter, 15:00–22:00 — counts with Dinner' && echo "$HB1" | grep -q '<b>0 Wh</b> · the food meter, 09:00–14:00' \
  && ok "each card on the desk shows what the meter read for its hours — 300 Wh for breakfast, 0 for lunch — and the tea at 16:00 counts with Dinner, 600 Wh" || bad "the desk's cards do not show the meter's figures"
echo "$HB1" | grep -q 'from the food meter\|Day total' && bad "the desk still adds a day total under the meals" || ok "no day total under the desk's meals — each card carries its own figure and nothing is summed there"
curl -s -b $A "$B/archive/day/1" | grep -q '400 kcal · 0 L water · 0 min · 300 Wh (the food meter, 06:00–09:00)' && curl -s -b $A "$B/archive/day/1/export.md" | grep -q '50 kcal · 0 L water · 0 min · 600 Wh (the food meter, 15:00–22:00)' \
  && ok "the record carries the metered figure with each meal and says where it came from — the tea, alone in dinner's hours, carries them" || bad "the record lacks the meter's figures"
curl -s -b $A "$B/archive/export.json" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const j = JSON.parse(s); const day = (j.days || []).find((d) => d.missionDay === 1); const ms = day ? day.meals : [];
  const b = ms.find((x) => x.slot === "BREAKFAST"), t = ms.find((x) => x.slot === "EXTRA1");
  process.exit(b && b.energyWh === 300 && b.energySource === "meter" && b.hours === "06:00-09:00" && t && t.energyWh === 600 && t.hours === "15:00-22:00" && t.servedAt === "16:00" && t.countsWith === "DINNER" ? 0 : 1); });
' && ok "the data copy says each meal's watt hours, their source (meter), the hours read, and which meal an added one counts with" || bad "the data copy lacks energySource/hours/countsWith"
# an added meal beside a named one of the same hours shows that meal's figure and counts once in the total
curl -s -b $A -X POST -d "day=1" -d "BREAKFAST_name=Porridge" -d "BREAKFAST_kcal=400" -d "DINNER_name=Stew" -d "DINNER_kcal=500" -d "EXTRA1_name=Tea" -d "EXTRA1_kcal=50" -d "EXTRA1_at=16:00" -o /dev/null $B/control/meals
sleep 1
HB1B=$(curl -s -b $A "$B/control?tab=habitat&day=1")
[ "$(echo "$HB1B" | grep -o '<b>600 Wh</b> · the food meter, 15:00–22:00' | wc -l)" = "2" ] && echo "$HB1B" | grep -q '<b>600 Wh</b> · the food meter, 15:00–22:00 — counts with Dinner' \
  && curl -s -b $A "$B/archive/day/1/export.md" | grep -q '50 kcal · 0 L water · 0 min · power with Dinner (15:00–22:00, 600 Wh)' \
  && ok "with a dinner planned, the tea shows dinner's 600 Wh as counting with it, and the record says so" || bad "an added meal beside a named one is not counted with it"
curl -s -b $A -o /tmp/day1.pdf $B/archive/day/1/export.pdf && pdftext /tmp/day1.pdf | grep -q "Wh: the food meter (the Food channel's energy meter), read breakfast 06:00" && ok "the PDF's meals table says the watt hours are the food meter's, and the hours" || bad "the PDF does not explain the watt hours"
# today's meals on the dashboard: each meal's line is its kcal, then its water when the file has it, then the food
# meter's watt hours — the figure with its unit, 0 Wh when the meter has nothing for the hours — and no hours named
# anywhere; an added meal beside the named one of its hours says which meal its figure counts with. No line under the
# meals about the meter. (today has none filed yet in this suite: a lunch, a dinner and a tea at 16:00 are filed for
# the look; the meter has no reading today, so every figure is 0)
curl -s -b $A -X POST -d "day=$TODAY" -d "LUNCH_name=Lentil stew" -d "LUNCH_kcal=420" -d "DINNER_name=Stew" -d "DINNER_kcal=500" -d "EXTRA1_name=Tea" -d "EXTRA1_kcal=50" -d "EXTRA1_at=16:00" -o /dev/null $B/control/meals
sleep 1.5
LANDM=$(curl -s $B/dashboard)
echo "$LANDM" | grep -q '<span class="meal-figs">420 kcal · 0 Wh</span>' && echo "$LANDM" | grep -q '<span class="meal-figs">500 kcal · 0 Wh</span>' && echo "$LANDM" | grep -q '<span class="meal-figs">50 kcal · 0 Wh (with Dinner)</span>' \
  && ok "Today's Meal: kcal, then the watt hours with their unit — 0 Wh when the meter has nothing — and the tea's as counting with Dinner; no hours on the line" || bad "the meal lines are not kcal · Wh as they should be"
node -e '
const L = require("./src/views/layout"); const E = (x) => x;
process.exit(L.mealFigs({ kcal: 420, water_litres: 0.4, power_wh: null }, E) === "420 kcal · 0.4 L · 0 Wh" && L.mealFigs({ kcal: 420, energy_source: "filed", energy_wh: 250 }, E) === "420 kcal · 250 Wh" && L.mealFigs({ kcal: 400, power_wh: 300, power_running: true }, E) === "400 kcal · 300 Wh" ? 0 : 1);
' && ok "a meal with water in the file reads kcal · L · Wh; a figure filed as a total before the meter stands in for a reading; the figure so far carries no mark" || bad "layout.mealFigs is not as it should be"
echo "$LANDM" | grep -q 'class="meal-hours"\|Power: the food meter\|Power: the kitchen' && bad "Today's Meal still carries the line about the meter and its hours" || ok "no line under Today's Meal about the meter or the hours it is read between — the figure stands with the meal"
curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q '50 kcal · 0 Wh (mit Abendessen)' && ! curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q 'class="meal-hours"' && curl -s -H "Cookie: mcs_lang=fr" $B/dashboard | grep -q '50 kcal · 0 Wh (avec Dîner)' \
  && ok "and in German and French — mit Abendessen, avec Dîner — without the meter line" || bad "the meal lines are not translated, or the meter line is back"
# the booklet keeps the line: there the hours matter to a reader of the record
curl -s $B/at-a-glance | grep -q '<p class="note meal-hours">Power: the food meter, read Breakfast' && curl -s $B/at-a-glance | grep -q "$(printf 'Dinner\xc2\xa015:00–22:00')" \
  && curl -s -H "Cookie: mcs_lang=de" $B/at-a-glance | grep -q 'Strom: der Energiezähler Food, gelesen Frühstück' && curl -s -H "Cookie: mcs_lang=fr" $B/at-a-glance | grep -q 'Électricité : le compteur d’énergie Food, lu Petit-déjeuner' \
  && ok "At a Glance still says under each day's meals that the watt hours are the food meter's, and the hours read for each meal — in German and French too" || bad "the booklet lost its line about the meter"
grep -q "const wh = m.power_wh != null ? m.power_wh : m.energy_source === 'filed' && m.energy_wh ? m.energy_wh : 0;" src/views/layout.js && grep -q 'parts.push(`${wh} Wh${m.power_with' src/views/layout.js \
  && ok "layout.mealFigs: the meter's figure, else a figure filed as a total before the meter, else 0 — always with its unit" || bad "layout.mealFigs does not put the watt hours beside the kcal"
node -e '
const i = require("./src/lib/i18n"); const T = i.of("de"), F = i.of("fr"); const L = require("./src/views/layout");
process.exit(L.slotName(T, "EXTRA1") === "Zusätzliche Mahlzeit" && L.slotName(T, "EXTRA2") === "Zusätzliche Mahlzeit 2" && L.slotName(F, "EXTRA3") === "Repas supplémentaire 3" && L.slotName((x) => x, "RATION") === "Other" && L.slotName((x) => x, "BREAKFAST") === "Breakfast" ? 0 : 1);
' && ok "an added meal is Extra meal / Zusätzliche Mahlzeit / Repas supplémentaire, numbered from the second; the old Other stays Other" || bad "slot names wrong"
node -e '
const m = require("./src/lib/mission");
const u = (d, t) => new Date(m.venueTimeUtc(d, t, "Europe/Berlin")).toISOString();
process.exit(u("2026-10-24", "06:00") === "2026-10-24T04:00:00.000Z" && u("2026-10-25", "06:00") === "2026-10-25T05:00:00.000Z" && u("2026-10-25", "22:00") === "2026-10-25T21:00:00.000Z" && u("2026-10-24", "24:00") === "2026-10-24T22:00:00.000Z" ? 0 : 1);
' && ok "the hours are the habitat's clock on both sides of 25 October, when the clocks go back" || bad "venueTimeUtc wrong across the DST change"
node -e '
const ha = require("./src/lib/home-assistant");
process.exit(JSON.stringify(ha.parseWindow("6:00-9:00")) === JSON.stringify(["06:00", "09:00"]) && JSON.stringify(ha.parseWindow("15:00 – 22:00")) === JSON.stringify(["15:00", "22:00"]) && ha.parseWindow("14:00-09:00") === null && ha.parseWindow("") === null && ha.parseWindow("25:00-26:00") === null
  && ha.MEALS_DEFAULT.meter === "habitat_power_food_energie" && ha.MEALS_DEFAULT.windows.BREAKFAST === "06:00-09:00" && ha.MEALS_DEFAULT.windows.LUNCH === "09:00-14:00" && ha.MEALS_DEFAULT.windows.DINNER === "15:00-22:00" && ha.mealsConfig().meter === "habitat_power_food_energie" ? 0 : 1);
' && ok "the meter is sensor.habitat_power_food_energie — the Food channel's — and the hours 06–09, 09–14, 15–22 unless content/home-assistant.json says otherwise (it names the same); hours parse as HH:MM-HH:MM, end after start" || bad "the meals defaults or the hours parser are wrong"
node -e '
const fs = require("fs"), p = process.env.CONTENT_DIR + "/home-assistant.json";
const d = JSON.parse(fs.readFileSync(p, "utf8")); d.meals = { meter: "sensor.other_meter", windows: { BREAKFAST: "07:00-10:00", LUNCH: null } }; fs.writeFileSync(p, JSON.stringify(d, null, 2));
setTimeout(() => { const ha = require("./src/lib/home-assistant"); const c = ha.mealsConfig(); const ok = c.meter === "other_meter" && c.windows.BREAKFAST === "07:00-10:00" && !("LUNCH" in c.windows) && c.windows.DINNER === "15:00-22:00";
  d.meals = { meter: "habitat_power_food_energie", windows: { BREAKFAST: "06:00-09:00", LUNCH: "09:00-14:00", DINNER: "15:00-22:00" } }; fs.writeFileSync(p, JSON.stringify(d, null, 2)); process.exit(ok ? 0 : 1); }, 50);
' && ok "the file may name another meter or other hours (and null for a meal without any); the rest keep the defaults — the meter is named by its entity id, never by its label" || bad "the meals block of content/home-assistant.json is not read"
# the power block: every figure locked behind Edit, which asks "These values are automated, are you sure you would like to edit?"
echo "$HB1" | grep -q "These values are automated, are you sure you would like to edit?" && [ "$(echo "$HB1" | grep -o 'class="[^"]*pw-locked[^"]*"' | wc -l)" -ge 8 ] && ! echo "$HB1" | grep -q 'the meter has nothing yet' \
  && ok "every value in Power consumed is locked behind an Edit key, which asks: These values are automated, are you sure you would like to edit?" || bad "the power block's values are not all locked, or the prompt is wrong"
# the Resources tile: a store with no figure yet carries no word for it
echo "$LANDM" | grep -q '>Placeholder<' && bad "the Resources tile still says Placeholder" || ok "the Resources tile says no Placeholder — a store with no figure yet is an empty ring and a dash"
grep -q '  body.landing .hbt .aux .t-res { flex: 0 0 auto; width: auto; max-width: 100%; }' public/aura.css && grep -q '  body.landing .hbt .aux .gauge.round { flex: 0 0 auto; width: max(86px, calc(8.8 \* var(--u))); }' public/aura.css && grep -q '  body.landing .hbt .bento.aux { display: flex; flex-wrap: wrap; align-items: stretch; }' public/aura.css \
  && ok "on a desk the Resources tile is only as wide as its rings — one a store — the power tile taking the rest of the row" || bad "the Resources tile is not sized by its stores"
# the desk's words: every Save key reads Save and nothing more; no Day total under the meals or the power, no Crew total
# under the steps or the calories; Steps taken, Calories consumed and Power consumed head their blocks without a day
HBW=$(curl -s -b $A "$B/control?tab=habitat&day=1")
[ "$(echo "$HBW" | grep -o '<button class="primary">Save</button>' | wc -l)" = "7" ] && ! echo "$HBW" | grep -q '<button class="primary">Save [a-z]' \
  && ok "every Save key on the desk reads Save — the schedule, the science mission, the meals, the steps, the calories, the inventory, the power — and nothing more" || bad "a Save key still says more than Save"
echo "$HBW" | grep -q 'Day total\|Crew total\|crew total' && bad "a Day total or a Crew total is still on the desk" || ok "no Day total, no Crew total on the desk — the totals are worked out on save and read on the station"
echo "$HBW" | grep -q '<div class="eyebrow">Power consumed</div>' && echo "$HBW" | grep -q '<div class="eyebrow">Calories consumed</div>' && echo "$HBW" | grep -q '<div class="eyebrow">Steps taken</div>' \
  && ! echo "$HBW" | grep -q 'Power consumed · \|Calories consumed · \|Steps taken · ' \
  && ok "Power consumed, Calories consumed and Steps taken head their blocks with no day after them; Meals and Schedule keep theirs" || bad "a figure block still names its day in its head"
HBN=$(curl -s -b $A "$B/control?tab=habitat&day=0")
echo "$HBN" | grep -q '<div class="eyebrow">Power consumed</div>' && echo "$HBN" | grep -q '<div class="eyebrow">Calories consumed</div>' && echo "$HBN" | grep -q '<div class="eyebrow">Steps taken</div>' && echo "$HBN" | grep -q '<div class="eyebrow">Meals · NOW</div>' \
  && ok "and on NOW the three say no NOW either — the meals do" || bad "NOW is back in a figure block's head"

echo "── the day's science mission, set on the desk"
# the Science officer's tab: one dropdown, for the day open on the desk — the sheets in missions/ (content/missions.json),
# the plan's mission for that day selected: as shipped in sequence, 00 on the first day; Save writes that day's entry of
# the map (`days`), which stands wherever the day's mission is shown; no words over it (October)
SC=$(curl -s -b $A "$B/control?tab=science&day=3")
echo "$SC" | grep -q '<div class="eyebrow">Science mission · day 003</div>' && echo "$SC" | grep -q '<form method="post" action="/control/mission" class="mission-plan' \
  && [ "$(echo "$SC" | grep -o '<select name="mission" aria-label="Mission on day 003">' | wc -l)" = "1" ] && ! echo "$SC" | grep -q 'name="m_1"\|class="mission-days"' \
  && echo "$SC" | grep -q '<label class="f mission-day"><span class="mp-day">Day 003</span><span class="mp-date">[A-Z][a-z]* [0-9]* [A-Z][a-z]*</span>' \
  && [ "$(echo "$SC" | grep -o '<option value="[0-9]*"[^>]*>Mission No\. [0-9][0-9] · ' | wc -l)" = "13" ] && echo "$SC" | grep -q '<option value="2" selected>Mission No. 02 · Trust the System</option>' \
  && echo "$SC" | grep -q '<option value="0"[^>]*>Mission No. 00 · Setup Habitat After Touchdown (sheet to come)</option>' && echo "$SC" | grep -q '<option value="12"[^>]*>Mission No. 12 · Habitat Teardown (sheet to come)</option>' \
  && echo "$SC" | grep -q '<option value=""[^>]*>— none —</option>' && ! echo "$SC" | grep -q 'as shipped in sequence\|A sheet marked <i>to come</i>\|block-hint">The sheet' \
  && [ "$(echo "$SC" | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const a = s.indexOf("id=\"tab-science\""), m = s.indexOf("action=\"/control/mission\"", a), r = s.indexOf("Daily Mission Report", a); process.stdout.write(m > -1 && r > m ? "first" : "not first"); });')" = "first" ] \
  && ! curl -s -b $A "$B/control?tab=science&day=0" | grep -q 'action="/control/mission"' \
  && ok "the Science officer's tab opens with the day's science mission: one dropdown for the open day — the thirteen sheets with two-figure numbers, the plan's selected, a sheet still to come marked, none to choose — the day and its date over it, no words, a Save key; on the run's days, not on NOW" || bad "the science mission's block is not on the desk as it should be"
# today's set to 07 Mars Myths: that day's entry of the plan changes, the others stand
curl -s -b $A -X POST -d "day=$TODAY" -d "mission=7" -o /dev/null $B/control/mission
node -e 'const d = require(process.env.CONTENT_DIR + "/missions.json"); process.exit(!d.chosen && d.days[String(process.argv[1])] === 7 && d.days["1"] === 0 && d.days["3"] === 2 && Object.keys(d.days).length === 13 ? 0 : 1);' "$TODAY" \
  && curl -s -b $A "$B/control?tab=science&day=$TODAY" | grep -q '<option value="7" selected>Mission No. 07 · Mars Myths</option>' \
  && curl -s $B/dashboard | grep -q '<span class="mission-no">Mission No. 07</span>' && curl -s $B/dashboard | grep -q 'id="mission-today-title">Mars Myths<' \
  && curl -s $B/api/dome | grep -q 'mission: Mars Myths.' && ! curl -s $B/api/dome | grep -q 'Mission No. 07 · Mars Myths' \
  && ok "another mission set for today is written to the plan (days — no chosen beside it; the other days stand) and shows on the dashboard's Today's Mission, with its two-figure number, and in the habitat's sentences" || bad "the mission set for today is not written or not shown"
# none for today: the day has no mission
curl -s -b $A -X POST -d "day=$TODAY" -d "mission=" -o /dev/null $B/control/mission
node -e 'const d = require(process.env.CONTENT_DIR + "/missions.json"); process.exit(d.days[String(process.argv[1])] === undefined && d.days["2"] === 1 && Object.keys(d.days).length === 12 ? 0 : 1);' "$TODAY" \
  && curl -s $B/dashboard | grep -q 'No mission filed for' \
  && ok "— none — takes the day's mission away: the day is not in the map, and the dashboard says no mission is filed" || bad "a day set to none still has a mission"
# the sequence back, and a mission the file does not have is refused
curl -s -b $A -X POST -d "day=$TODAY" -d "mission=$((TODAY - 1))" -o /dev/null $B/control/mission
curl -s -b $A -X POST -d "day=3" -d "mission=99" -o /dev/null -w '%{redirect_url}' $B/control/mission | grep -q 'tab=science&day=3' && node -e 'const d = require(process.env.CONTENT_DIR + "/missions.json"); process.exit(d.days["3"] === 2 && d.days[String(process.argv[1])] === Number(process.argv[1]) - 1 && Object.keys(d.days).length === 13 ? 0 : 1);' "$TODAY" \
  && ok "the sequence is back, and a mission the file does not have is refused — nothing written" || bad "an unknown mission was written, or the sequence is not back"

echo "── crew figures"
curl -s -b $A -X POST -d "day=3" -d "calories=4999" -d "steps=8123" -o /dev/null $B/control/crew-figures
node -e '
const d = require(process.env.CONTENT_DIR + "/crew-figures.json");
process.exit(d["3"] && d["3"].calories === 4999 && d["3"].steps === 8123 ? 0 : 1);' \
  && ok "calories and steps are written into content/crew-figures.json" || bad "figures not written"
LAND=$(curl -s $B/dashboard)
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
curl -s $B/dashboard | grep -q 'stroke-dasharray="2 3"' \
  && ok "and the graph breaks its line for that day" || bad "the graph shows no gap for the cleared day"

echo "── editable content"
curl -s $B/api/content | grep -q '"ok":true' && ok "content files loaded cleanly" || bad "content failed to load"
curl -s $B/at-a-glance | grep -q "Hatch seal and pressure hold" && ok "authored schedule is live" || bad "schedule missing"
# (content/meals.json is the live food plan — the crew file days into it from the desk — so the suite no longer asks it to be empty)
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
curl -s $B/dashboard | grep -q "PLACEHOLDER\|Cue:" && bad "the placeholder marker or a writer's cue reached the public station" || ok "placeholder slots are shown publicly by their first line only; the marker and the cues stay inside"
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
[ "$(echo "$CTRLPAGE" | grep -o 'data-day="[1-9][0-9]*"' | sort -u | wc -l)" = "13" ] \
  && ok "every officer tab offers all thirteen days of the run (and NOW, the rehearsal day, before them)" || bad "the day picker does not offer thirteen days"
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
curl -s $B/at-a-glance | grep -q "West wall at dawn" && bad "a photograph carried by no blog is on At a Glance — the Also sent out block is back" || ok "a photograph carried by no blog is not on At a Glance (no Also sent out block) — it is on the crew log"
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
curl -s $B/dashboard | grep -q "PLACEHOLDER" && bad "a placeholder marker reached the station" || ok "placeholder markers never reach the station"
curl -s $B/dashboard | grep -q "Drinking water" && ok "inventory names come from the file" || bad "inventory names missing"

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
curl -s $B/dashboard | grep -q "WRITTEN FROM CONTROL" && bad "the old text survived the file edit" || ok "there is one record, not two"

echo '{ "1": [ { "label": "oops", } ] }' > "$CONTENT_DIR/schedule.json"
sleep 2
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/)" = "200" ] \
  && ok "a broken file leaves the site serving the last good content" || bad "broken file took the site down"
curl -s $B/api/content | grep -q '"ok":false' && ok "the error is reported, with a line number" || bad "no error reported"

echo "── inventory visualisation"
curl -s $B/dashboard | grep -q 'class="gauges' && ok "inventory gauges on the landing page" || bad "no gauges"
curl -s $B/dashboard | grep -q "days left" && ok "gauges show days remaining at the current draw" || bad "no days-remaining figure"

echo "── resource log"
# Every store on every day of the run, with what was left and what was used —
# one flat table, written beside the content files and served as a download.
LOGROWS=$(curl -s $B/resources/log.csv | grep -c '^[0-9]')
[ "$LOGROWS" = "52" ] && ok "the resource log has a row per item per day (4 stores × 13 days = 52)" || bad "resource log has $LOGROWS rows"
curl -s $B/resources/log.csv | head -1 | grep -q 'daily_use,used_since_start' && ok "the log carries daily use and use since start" || bad "log header wrong"
curl -s $B/resources/log.csv | grep -q '^1,.*,water,.*,filed,' && ok "a filed day is marked as filed" || bad "no filed marker"
curl -s $B/resources/log.csv | grep -q ',carried,' && ok "a carried-forward day is marked as carried" || bad "no carried marker"
[ -s "$CONTENT_DIR/resource-log.csv" ] && ok "resource-log.csv is written beside the content files" || bad "no resource-log.csv in content/"
STORES=$(curl -s $B/dashboard | grep -o 'store-[a-z]*' | sort -u | wc -l)
[ "$STORES" = "4" ] && ok "every store is a series on the trend graph (4)" || bad "only $STORES stores in the trend spec"
USES=$(curl -s $B/dashboard | grep -o 'use-[a-z]*' | sort -u | wc -l)
[ "$USES" = "4" ] && ok "and the daily use of every store (4)" || bad "only $USES daily-use series"
MISSING=""
for S in meal-kcal meal-water meal-power act-tasks act-messages act-exchanges act-entries act-media calories steps; do
  curl -s $B/dashboard | grep -q "id&quot;:&quot;$S&quot;" || MISSING="$MISSING $S"
done
[ -z "$MISSING" ] && ok "meals, crew figures and the day's activity are all on the graph" || bad "missing from the trend spec:$MISSING"
curl -s $B/dashboard | grep -q 'data-axis-run="1"' && curl -s $B/dashboard | grep -q "data-axis-start=\"$MISSION_START\"" && ok "during the run the trend axis is the run, SOL 01 to 13" || bad "trend axis is not the run"

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
LANDING=$(curl -s $B/dashboard)
echo "$LANDING" | grep -q 'id="ftab-hardware"' && bad "the Habitat hardware tab is still in the folder" || ok "no Habitat hardware tab in the dashboard folder"
# one Sensors tab (public.js, dashboard: trendsInside): the instruments, the hardware's charts without a heading of their
# own, and the trends under the tiles, drawn smaller — no Trends tab; a link to #trends lands in the Sensors tab
! echo "$LANDING" | grep -q 'id="ftab-trends"' && echo "$LANDING" | grep -q '<div class="hbt-trends-in" id="trends">' && echo "$LANDING" | grep -q 'id="hbt-tcharts"' \
  && [ "$(echo "$LANDING" | grep -o 'id="hbt-trends"' | wc -l)" = "1" ] && ! echo "$LANDING" | grep -q '<h3>Habitat hardware</h3>' && ! grep -q "read by the station every" src/views/pages/public.js \
  && grep -q "body.landing .folder-body .hbt-trends-in .tchart-svg { max-height: 300px; }" public/aura.css && grep -q "body.landing .folder-body #habitat .hw-chart svg { max-height: none; }" public/aura.css \
  && ok "one Sensors tab: the trends stand inside it under the tiles, drawn smaller, the hardware's charts carry no heading, and there is no Trends tab" || bad "the Trends tab is still there, or the trends and the hardware are not inside the Sensors tab"
grep -q "body.landing .folder-body #habitat .hbt .tile h3 { font-size: 20px;" public/aura.css && grep -q "body.landing .folder-body #habitat .hbt .lvl .big, body.landing .folder-body #habitat .hbt .spk .big, body.landing .folder-body #habitat .hbt .ruler-num .big { font-size: 36px; }" public/aura.css \
  && grep -q "body.landing .folder-body #mission-today.dpanel { padding: 0; }" public/aura.css && ok "inside the Sensors tab the type is set larger — what each tile measures 20px, the figures 36px — and only there: Today's Mission keeps its type in its own folder" || bad "the Sensors tab's type is not enlarged, or the enlargement reaches past it"
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
for t in "Commander Blog" "Daily Mission Report" "Health Report"; do echo "$LB3" | grep -q "$t" || bad "the crew log is missing $t"; done
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
# the night: NO image is pulled from the cloud between 22:00 and 08:00 at the venue, every day (src/lib/cloud.js, QUIET) —
# a read at 23:30 lists nothing and copies nothing; at 08:05 the folder is read again; a read copying at 22:00 stops.
# The window is fixed in code, in the venue's zone; CLOUD_QUIET=off opens it for a rehearsal (MISSION_OVERRIDE) only.
night_poll() {   # $1 the instant (UTC), $2 CLOUD_QUIET, $3 MISSION_OVERRIDE → prints quiet.now quiet.off gallery-count lastPollAt
  CLOUD_POLL=true CLOUD_DIR=/tmp/e2e-cloud CLOUD_QUIET="$2" MISSION_OVERRIDE="$3" DATA_DIR=$(mktemp -d) node -e '
const RealDate = Date, AT = RealDate.parse(process.argv[1]);
global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [AT])); } static now() { return AT; } };
const c = require("./src/lib/cloud");
c.poll().then(() => { const s = c.snapshot(); console.log(s.quiet.now, s.quiet.off, c.gallery().length, s.lastPollAt === null ? "never" : "read"); });
' "$1" 2>/dev/null | tail -1
}
[ "$(night_poll 2026-10-16T21:30:00Z '' true)" = "true false 0 never" ] && ok "at 23:30 at the venue nothing is read from the cloud: no listing, no copy" || bad "the cloud is read at night: $(night_poll 2026-10-16T21:30:00Z '' true)"
[ "$(night_poll 2026-10-17T05:30:00Z '' true)" = "true false 0 never" ] && ok "nor at 07:30" || bad "the cloud is read before 08:00"
[ "$(night_poll 2026-10-17T06:05:00Z '' true)" = "false false 2 read" ] && ok "at 08:05 the folder is read again and the pictures copied" || bad "the morning read does not happen: $(night_poll 2026-10-17T06:05:00Z '' true)"
[ "$(night_poll 2026-10-16T19:59:00Z '' true)" = "false false 2 read" ] && ok "and at 21:59 it still is" || bad "the night begins too early"
[ "$(night_poll 2026-10-26T21:30:00Z '' true)" = "true false 0 never" ] && [ "$(night_poll 2026-10-27T07:05:00Z '' true)" = "false false 2 read" ] && ok "the window keeps the venue's clock after 25 October (22:30 CET quiet, 08:05 CET read)" || bad "the night window drifts with the clocks going back"
[ "$(night_poll 2026-10-16T21:30:00Z off true)" = "false true 2 read" ] && ok "CLOUD_QUIET=off opens the night for a rehearsal (MISSION_OVERRIDE)" || bad "CLOUD_QUIET=off does not open the night for a rehearsal"
[ "$(night_poll 2026-10-16T21:30:00Z off '')" = "true false 0 never" ] && ok "and does nothing without MISSION_OVERRIDE — the night cannot be opened from .env on the real run" || bad "CLOUD_QUIET=off works without MISSION_OVERRIDE"
grep -q "const QUIET = Object.freeze({ from: '22:00', to: '08:00' });" src/lib/cloud.js && grep -q "if (quiet()) { held = next.length - cached; break; }" src/lib/cloud.js && grep -q "timeZone: RUN.TZ" src/lib/cloud.js \
  && ok "the window is fixed in code — 22:00 to 08:00 in the venue's zone — and a read still copying at 22:00 stops" || bad "the night window is not fixed in code, or a read copying at 22:00 goes on"
node -e '
const M = require("./src/views/pages/media"); const T = (s) => s;
const h = M.cloudGridInner(T, { title: "Gallery", items: [], snapshot: { checkSeconds: 900, lastPollAt: "2026-10-16T19:45:00Z", quiet: { from: "22:00", to: "08:00", now: true, off: false } }, sort: "newest" }, { tz: "Europe/Berlin", lang: "en" });
process.exit(h.includes("not between 22:00 and 08:00 (next read at 08:00)") ? 0 : 1);
' && ok "the gallery's head says so — not between 22:00 and 08:00 — and, at night, when the next read is" || bad "the gallery's head does not name the night"
grep -q 'data-version' src/views/pages/media.js && grep -q "fetch(api, " public/cloud.js && grep -q "getAttribute('data-api') || '/api/cloud'" public/cloud.js && grep -q "CLOUD_CHECK_SECONDS" docker-compose.yml \
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
curl -s $B/dashboard | grep -q 'cloud-latest' && bad "the latest strip shows without the bridge" || ok "no latest strip on the landing page until the bridge is configured"
# a click on a picture of the strip opens it IN PLACE — a small frame under the strip, no wider than the picture and no
# taller than 320px, its time under it and a × on its corner — never a new tab or a pop-up; the same tile again, the ×
# or Escape closes it; a click with a modifier key, or without JavaScript, still opens the original as the link says
grep -q "e.target.closest('#cloud-latest .mtile.kind-image\[href\]')" public/cloud.js && grep -q "if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;" public/cloud.js \
  && grep -q "peek.className = 'cloud-peek'" public/cloud.js && grep -q "if (openId === id) { closePeek(); return; }" public/cloud.js && grep -q "x.className = 'cloud-peek-x popup-close'" public/cloud.js \
  && grep -q "if (e.key === 'Escape' && peek) closePeek();" public/cloud.js && grep -q "latest.appendChild(peek);" public/cloud.js && ! grep -q "window.open" public/cloud.js \
  && ok "cloud.js opens a strip picture in place under the strip (.cloud-peek) — the tile again, the × or Escape close it; no new page" || bad "the strip's in-place viewer is not wired as it should be"
grep -q "body.landing .cloud-peek { flex-basis: 100%; width: 100%; margin-top: 0; padding: 0; display: flex; justify-content: center; }" public/aura.css \
  && grep -q "body.landing .cloud-peek-img { display: block; width: auto; height: auto; max-width: 100%; max-height: min(36vh, 320px); border-radius: 10px; object-fit: contain; }" public/aura.css \
  && grep -q "body.landing .cloud-latest {" public/aura.css && grep -q "flex-wrap: wrap" public/aura.css && grep -q "body.landing .cloud-strip .mtile.is-open { outline: 2px solid var(--mars); outline-offset: 2px; }" public/aura.css \
  && ok "the frame is small — centred under the strip, the picture no taller than 320px — and the open tile is marked" || bad "the in-place frame is not sized as it should be"

echo "── at a glance"
GLA=$(curl -s $B/at-a-glance)
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/at-a-glance)" = "200" ] && ok "At a Glance is a public page" || bad "/at-a-glance broken"
echo "$GLA" | grep -q 'id="day-1"' && echo "$GLA" | grep -q 'id="day-13"' && ok "it carries every day of the run, in day order" || bad "days missing from At a Glance"
for block in "Blogs" "Meals" "Resources" "Habitat" "Schedule"; do
  echo "$GLA" | grep -qi "$block" || bad "At a Glance missing: $block"
done
ok "each day holds the blogs, the schedule, the meals, the resources and the habitat"
echo "$GLA" | grep -q 'class="glance-tile"' && ok "the day's habitat is drawn as dashboard tiles, the day's last reading large" || bad "no habitat tiles in At a Glance"
# the exchanges with Earth are not on the booklet — no block of them, no counts of them in the day's head, and nothing of
# the media not carried by a blog (the Also sent out block is gone)
echo "$GLA" | grep -q "In colour, and always outdoors.\|Exchanges with Earth\|Do you still dream in colour" && bad "an exchange is on At a Glance" || ok "no exchange with Earth on At a Glance — the booklet carries the days, not the messages"
echo "$GLA" | grep -q 'messages from Earth</span>\|</b> exchanges</span>' && bad "the day's head still counts the messages" || ok "the day's head counts the blog posts and the media, not the messages"
echo "$GLA" | grep -q 'Also sent out' && bad "the Also sent out block is still on At a Glance" || ok "no Also sent out block on At a Glance"
echo "$GLA" | grep -q '<div class="eyebrow">Resources</div>' && ! echo "$GLA" | grep -q 'what is left of what was carried in\|<div class="eyebrow">Consumption' \
  && ok "the stores' block is headed Resources — not Consumption · planned · at the close of the day · what is left of what was carried in" || bad "the stores' block is not headed Resources"
curl -s -H "Cookie: mcs_lang=de" $B/at-a-glance | grep -q '<div class="eyebrow">Ressourcen</div>' && ok "Ressourcen in German" || bad "the Resources head is not translated"
echo "$GLA" | grep -q "PLACEHOLDER" && bad "a placeholder cue leaked to At a Glance" || ok "no placeholder cues leak"
echo "$GLA" | grep -q "calm_tense" && bad "raw mood values leaked to At a Glance" || ok "crew condition appears as sentences, never numbers"
U=$(echo "$GLA" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log((s.match(/<table>/g)||[]).length-(s.match(/<div class="tw"><table>/g)||[]).length)})')
[ "$U" = "0" ] && ok "every table on it scrolls instead of clipping" || bad "$U unwrapped tables on At a Glance"
echo "$GLA" | grep -q 'class="booklet"' && echo "$GLA" | grep -q 'class="bk-page" id="day-1"' && ok "it is a booklet: one day per page, turned by scrolling sideways" || bad "no booklet structure"
echo "$GLA" | grep -q 'id="bk-prev"' && echo "$GLA" | grep -q 'id="bk-next"' && echo "$GLA" | grep -q 'id="bk-counter"' && ok "with arrows either side and a page counter" || bad "booklet controls missing"
grep -q "scroll-snap-type: x mandatory" public/station.css && ok "pages snap, so a swipe lands on a whole day" || bad "no scroll snap"
echo "$GLA" | grep -qF 'day-(\d+)' && ok "a #day-n link opens the booklet on that day" || bad "hash landing broken"
curl -s $B/dashboard | grep -q 'class="glance-link" href="/at-a-glance"' && ok "the At a Glance button is on the mission dashboard" || bad "no At a Glance button on the landing page"
curl -s $B/dashboard | grep -q 'class="glance-link media-link" href="/media"' && ok "and the Media button beside it" || bad "no Media button on the mission dashboard"
# today's scientific mission, from content/missions.json and the sheets in missions/, over the index of folders
echo "── today's mission"
MT=$(panel mission-today)
MNO=$(node -e 'const d=require(process.env.CONTENT_DIR+"/missions.json"); const no=d.days[String(process.argv[1])]; const m=d.missions.find((x)=>x.no===no); process.stdout.write(m ? String(no).padStart(2, "0")+"|"+m.title+"|"+m.file : "")' "$TODAY")
echo "$MT" | grep -q "Mission No. ${MNO%%|*}<" && echo "$MT" | grep -q "id=\"mission-today-title\">$(echo "$MNO" | cut -d'|' -f2)<" && [ "${MNO%%|*}" = "$(printf '%02d' $((TODAY - 1)))" ] \
  && ok "the Today's Mission panel shows the day's mission — its two-figure number and title — as missions.json maps it (day $TODAY → mission ${MNO%%|*}, the sheets in sequence from 00)" || bad "the Today's Mission panel does not show the day's mission"
echo "$MT" | grep -q 'class="mission-part is-morning"' && echo "$MT" | grep -q 'class="mission-part is-afternoon"' && echo "$MT" | grep -q 'class="mission-part is-eva"' && echo "$MT" | grep -q 'class="mission-community"' \
  && ok "with its central question, Morning, Afternoon and EVA, and the question for the community hour" || bad "the mission's parts are missing"
curl -s $B/dashboard | node -e 'let s=""; process.stdin.on("data",(c)=>s+=c).on("end",()=>{ const a=s.indexOf("<section class=\"dpanel span-12 mission-today\" id=\"mission-today\""), b=s.indexOf("class=\"folder span-12\""), f=s.indexOf("<div class=\"fpage\" role=\"tabpanel\" id=\"fpage-mission-today\" aria-labelledby=\"ftab-mission-today\" data-folder=\"mission-today\" hidden>"), k=s.indexOf("<button type=\"button\" class=\"ftab\" role=\"tab\" id=\"ftab-mission-today\""), sch=s.indexOf("id=\"ftab-schedule\""), sens=s.indexOf("id=\"ftab-habitat\""); process.exit(a>-1 && b>-1 && b<a && f>-1 && f<a && k>-1 && sens<k && k<sch ? 0 : 1); });' \
  && curl -s $B/dashboard | grep -q '<span class="frow-k" aria-hidden="true">Daily Life</span><button type="button" class="ftab" role="tab" id="ftab-mission-today"' \
  && ok "Today's Mission is a folder of the Daily Life track, the first key after the Sensors — its panel in the folder, behind the index" || bad "the mission panel is out of place"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/missions/$(echo "$MNO" | cut -d'|' -f3)")" = "200" ] && ! echo "$MT" | grep -q 'class="mission-sheet"' \
  && ok "the sheet itself is served from the missions folder, though the panel carries no key to it" || bad "the mission sheet is not served, or a key to it is back on the panel"
MQ=$(node -e 'const d=require(process.env.CONTENT_DIR+"/missions.json"); const m=d.missions.find((x)=>x.no===d.days[String(process.argv[1])]); process.stdout.write(m ? m.community.en : "")' "$TODAY")
curl -s $B/write | grep -q "<p class=\"dev-prompt-q\">$MQ</p>" && curl -s $B/ | grep -q "<p class=\"dev-prompt-q\">$MQ</p>" \
  && curl -s -H "Cookie: mcs_lang=de" $B/write | grep -q 'Die Frage der Crew heute' && curl -s -H "Cookie: mcs_lang=de" $B/write | grep -q 'Was ist eine Sache die zu Hause / in Karlsruhe grade passiert' \
  && ok "the day's question for the community hour stands over the writing box as a prompt — in the window, on every page, in German where the sheet has it" || bad "the composer carries no prompt, or the wrong one"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/missions/")" = "404" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' "$B/missions/nothing.txt")" = "404" ] && ok "and nothing but PDFs is served from it" || bad "the missions folder serves more than its PDFs"
node -e 'const d=require(process.env.CONTENT_DIR+"/missions.json"); const nos=d.missions.map((m)=>m.no); process.exit(nos.length===13 && nos.every((n, i) => n === i) && Object.keys(d.days).length===13 && Object.entries(d.days).every(([k, n]) => n === Number(k) - 1) && d.missions.filter((m) => m.placeholder).map((m) => m.no).join() === "0,12" && d.missions.every((m) => m.placeholder ? !m.question && !m.morning.length : m.morning.length && m.afternoon.length && m.eva.length) && /tools\/missions-json\.py/.test(d._note) ? 0 : 1);' \
  && ok "thirteen sheets, 00 to 12, thirteen days mapped to them in sequence in missions.json — written by tools/missions-json.py from the PDFs; 00 and 12, copies of another sheet for now, carry their titles and no words" || bad "missions.json is inconsistent"
# the words are the sheets' own: tools/missions-json.py reads every PDF in missions/ by position — the three columns as
# lines (a heading alone, a bullet with its wrapped words), the community hour's question parted into English and German
if python3 -c "import pdfplumber" 2>/dev/null; then
python3 tools/missions-json.py --check 2>/dev/null | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const d = JSON.parse(s), by = Object.fromEntries(d.missions.map((m) => [m.no, m]));
  const ok = by[5].title === "Waterways" && by[5].question === "Humans cannot survive without water. How do we take care and notice water?"
    && by[5].eva[0] === "WATERWAYS MAPPING" && by[5].eva[5] === "• places where water can be collected or is lost" && by[5].community.de.startsWith("Wie sparst du Wasser")
    && by[1].afternoon[0] === "THE VALUE OF A KILOWATT-HOUR – decision experiment" && by[1].morning[5] === "→ a pot of coffee, one day of hydroponics, 1× feeding the grasshoppers, 1× eating."
    && by[8].afternoon[2] === "• What can it perceive?" && by[7].afternoon[2] === "• What rituals are central to religious meaning-making?" && by[7].community.en === "What rituals do you follow in your everyday life?" && by[7].community.de === "Welche Rituale hast du in deinem täglichen Leben?"
    && by[6].eva[0] === "Fictitious scenario: THE MARKETPLACE AS RESOURCE" && by[2].sheetNo === "12" && by[0].placeholder === "MARS_Mission_01_Energy_Budget.pdf" && by[11].question === "";
  process.exit(ok ? 0 : 1); });
' && ok "tools/missions-json.py reads the sheets as laid out — the number and title from the file, the question, the columns line by line, bullets and headings kept, a broken word made whole, English and German parted, the printed number kept as sheetNo where it is another, a copied sheet marked" || bad "tools/missions-json.py does not read the sheets as it should"
else ok "(pdfplumber is not installed here — tools/missions-json.py not run; content/missions.json as shipped is checked above)"; fi
curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q 'Heutige Mission' && curl -s -H "Cookie: mcs_lang=fr" $B/dashboard | grep -q 'Mission du jour' && ok "its labels are in German and French too; the sheet's words as written" || bad "the mission panel's labels are not translated"
node -e '
const h = require("child_process").execSync("curl -s http://localhost:8080/dashboard").toString();
process.exit(h.indexOf("glance-link") > -1 && h.indexOf("glance-link") < h.indexOf("id=\"habitat\"") ? 0 : 1);
' && ok "and it sits above the Habitat panel" || bad "At a Glance is not above the Habitat"
# the ticker's running line is in the page twice (that is how it loops); the
# dashboard figures must not add a third
[ "$(curl -s $B/dashboard | grep -o 'One-way signal' | wc -l)" = "2" ] && [ "$(curl -s $B/dashboard | grep -o 'class="dev-signal"' | wc -l)" = "1" ] && ! curl -s $B/dashboard | grep -q 'dash-clock' && ok "the one-way signal is off the dashboard figures — only the window's head names it" || bad "one-way signal still on the dashboard"
curl -s $B/dashboard | grep -q '>At a Glance<' && ok "and the footer navigation carries it" || bad "At a Glance missing from the nav"

echo "── the installation's screens"
# the screens' door (src/lib/screens-auth.js; server.js, requireScreens): /screens, every /screen/<name>, the writing
# screen's composer and its post open only to a browser signed in with the screens' user and password — WHILE .env sets
# SCREENS_USER and SCREENS_PASSWORD (this suite does; without them, below, the screens open to anyone) — mission control's
# session does not open them — anyone else is sent to /screens/login and, signed in, on to the screen asked for; no
# address off the screens is a way on (no open redirect)
[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/screens)" = "302 $B/screens/login?next=%2Fscreens" ] && [ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/screen/board)" = "302 $B/screens/login?next=%2Fscreen%2Fboard" ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' $B/screen/write/composer)" = "302" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' -d 'body=hello' $B/screen/write)" = "302" ] \
  && ok "a browser that has not signed in is sent from the screens, their list and the writing screen's post to /screens/login, with the screen it asked for" || bad "the screens open without a sign-in"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/screens/login)" = "200" ] && curl -s $B/screens/login | grep -q 'action="/screens/login"' && curl -s $B/screens/login | grep -q 'name="next" value="/screens"' \
  && ok "the sign-in page: user, password, the way on" || bad "no sign-in page for the screens"
[ "$(curl -s -o /dev/null -w '%{http_code}' -d 'username=panolab&password=nope' $B/screens/login)" = "401" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' -d 'username=someone&password=panolab123' $B/screens/login)" = "401" ] \
  && ok "the wrong user or password is a 401 and no cookie" || bad "wrong credentials are accepted"
SK=$(mktemp)
[ "$(curl -s -c $SK -o /dev/null -w '%{http_code} %{redirect_url}' -d 'username=panolab&password=panolab123&next=%2Fscreen%2Fboard' $B/screens/login)" = "302 $B/screen/board" ] && grep -q 'mcs_screens' $SK \
  && ok "panolab / panolab123 signs in: a cookie for the screens, and on to the screen asked for" || bad "the screens' credentials do not sign in"
[ "$(curl -s -o /dev/null -w '%{redirect_url}' -d 'username=panolab&password=panolab123&next=https%3A%2F%2Fevil.example%2F' $B/screens/login)" = "$B/screens" ] && [ "$(curl -s -o /dev/null -w '%{redirect_url}' -d 'username=panolab&password=panolab123&next=%2Fcontrol' $B/screens/login)" = "$B/screens" ] \
  && ok "an address off the screens is not a way on after signing in" || bad "the sign-in redirects anywhere it is told"
[ "$(curl -s -b $A -o /dev/null -w '%{http_code} %{redirect_url}' $B/screens)" = "302 $B/screens/login?next=%2Fscreens" ] && [ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/screen/board)" = "302" ] && [ "$(curl -s -b $A -o /dev/null -w '%{http_code}' $B/screens/login)" = "200" ] \
  && ok "mission control's session does not open the screens: an operator signed in to /control is asked for the screens' password like anyone else" || bad "mission control's session opens the screens without their password"
curl -s -b $SK $B/screens | grep -q 'action="/screens/logout"' && SK2=$(mktemp) && cp $SK $SK2 && curl -s -b $SK2 -c $SK2 -o /dev/null -X POST $B/screens/logout && [ "$(curl -s -b $SK2 -o /dev/null -w '%{http_code}' $B/screens)" = "302" ] \
  && ok "the list carries a way out, and after it the screens ask again" || bad "no way out of the screens, or it does not sign out"
grep -q "maxAge: 365 \* 86400000" src/lib/screens-auth.js && grep -q "crypto.timingSafeEqual" src/lib/screens-auth.js && grep -q "const TRIES = 10, WINDOW_MS = 10 \* 60 \* 1000;" src/lib/screens-auth.js \
  && ok "the cookie holds for a year (a display stays signed in across its reloads and the station's restarts), the comparison is constant-time, and ten wrong tries in ten minutes are throttled" || bad "the screens' door is missing a part"
[ "$(curl -s -b $SK -o /dev/null -w '%{http_code}' $B/screens)" = "200" ] && ok "the list of the screens answers at /screens, signed in" || bad "/screens does not answer"
curl -s -b $SK $B/screen/trends | grep -q 'id="trends"' && [ "$(curl -s -b $SK $B/screen/trends | grep -o 'id="hbt-trends"' | wc -l)" = "1" ] && ok "the Trends screen keeps its panel of its own, the trends drawn once on it" || bad "the Trends screen lost its panel, or draws the trends twice"
grep -q "body.screen.screen-habitat #habitat .hbt .tile h3 { font-size: 32px; line-height: 1.1; margin: 0 0 4px; }" public/screen.css && grep -q "body.screen.screen-habitat #habitat .hbt .sub, body.screen.screen-habitat #habitat .hbt .t-pwr .sub { font-size: 18px; line-height: 1.3; }" public/screen.css \
  && grep -q "body.screen.screen-habitat #habitat .hbt .dial-wrap svg { max-width: 220px; }" public/screen.css && grep -q "body.screen.screen-habitat #habitat .hbt .tile.t-viz svg { max-height: 96px; }" public/screen.css \
  && ok "the habitat screen is set to be read across a room — what each tile measures in 32px, its scale in 18px, the drawings smaller — by rules that name the panel (#habitat) and so outrank the dress's" || bad "the habitat screen's type is not enlarged for the room"
SCR_OK=1; for n in landing habitat board write mission blogs day trends media; do
  [ "$(curl -s -b $SK -o /dev/null -w '%{http_code}' $B/screen/$n)" = "200" ] || SCR_OK=0
done
[ $SCR_OK = 1 ] && ok "nine screens answer at /screen/<name>: landing, habitat, board, write, mission, blogs, day, trends, media" || bad "a screen does not answer"
[ "$(curl -s -b $SK -o /dev/null -w '%{http_code}' $B/screen/nothing)" = "404" ] && ok "a name that is not a screen is a 404" || bad "/screen/nothing answers"
TICK_OK=1; for n in habitat board write mission blogs day trends media; do curl -s -b $SK $B/screen/$n | grep -q 'class="ticker"' && TICK_OK=0; done
[ $TICK_OK = 1 ] && curl -s -b $SK $B/screen/landing | grep -q 'class="ticker"' && ok "no ticker on the screens, but on the landing screen, which keeps it" || bad "a ticker is on a screen, or off the landing screen"
SCR=$(curl -s -b $SK $B/screen/board)
echo "$SCR" | grep -q '<html lang="de" data-theme="dark" class="js screen">' && echo "$SCR" | grep -q 'Nachrichtenboard' && ok "a screen is dark and in German unless its address says otherwise" || bad "the screens' default is not dark and German"
curl -s -b $SK "$B/screen/board?lang=en&theme=light" | grep -q '<html lang="en" data-theme="light" class="js screen">' && curl -s -b $SK "$B/screen/board?lang=fr" | grep -q '<html lang="fr" data-theme="dark"' \
  && ok "?lang=en|fr and ?theme=light switch it" || bad "the switches in the address do not work"
echo "$SCR" | grep -q 'class="landing inner screen screen-board" data-screen="board" data-fit="clip"' && curl -s -b $SK $B/screen/habitat | grep -q 'data-fit="scale" data-min-width="960"' \
  && ok "the board is cut clean at the foot (data-fit=clip), the habitat scaled to fit, never narrower than its layout (data-min-width)" || bad "the fit attributes are wrong"
# every screen fits a full screen, whatever the monitor (October): the trends drawn to the stage's height landscape (a
# graph as wide as its panel at any scale cannot be scaled to fit the height), scaled upright; the habitat's hardware
# charts four across under the instruments, drawn as short as a short screen needs; the fitting looked at every other
# second and after any change under the stage, down to a third of the size; the gallery's columns by the number of
# pictures; the landing screen's Earth at the foot of the screen
curl -s -b $SK $B/screen/trends | grep -q 'data-screen="trends" data-fit="scale" data-fit-landscape="fill" data-min-width="520"' \
  && grep -q "var f = (fitLand && window.innerWidth > window.innerHeight) ? fitLand : fitBase;" public/screen.js && grep -q "if (document.body.getAttribute('data-fit') !== fit) {" public/screen.js \
  && grep -q 'body.screen.screen-trends\[data-fit="fill"\] .tchart-svg { flex: 1 1 auto; min-height: 0; width: auto; height: 100%; max-width: 100%; max-height: none; margin: 0 auto; }' public/screen.css \
  && grep -q "if (room.width > 0 && room.height > 0) H = Math.max(H, Math.round(W \* room.height / room.width));" public/habitat.js \
  && grep -q 'body.screen.screen-habitat #habitat .hw-charts { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }' public/screen.css \
  && grep -q "want = Math.max(0.3, Math.min(top, want));" public/screen.js && grep -q "}).observe(fitEl, { childList: true, subtree: true, attributes: true });" public/screen.js && ! grep -q "attributeFilter" public/screen.js \
  && grep -q "if (e.need > e.have + 1 || e.needW > e.haveW + 1 || (e.need < e.have \* 0.92 && curZ < top - 0.02 && !wideBound)) fitNow();" public/screen.js && grep -q "}, 2000);" public/screen.js \
  && grep -q "if (el.classList.contains('is-cut') !== cut) el.classList.toggle('is-cut', cut);" public/screen.js \
  && grep -q 'body.screen.screen-media .mgrid:not(:has(> :nth-child(5))) { grid-template-columns: repeat(2, minmax(0, 1fr)); }' public/screen.css && grep -q 'body.screen.screen-media .mgrid:has(> :nth-child(9)):not(:has(> :nth-child(16))) { grid-template-columns: repeat(4, minmax(0, 1fr)); }' public/screen.css \
  && grep -q 'body.screen.screen-landing .stage { padding: 0 var(--gutter) 0; }' public/screen.css && grep -q 'body.screen.screen-landing .space { padding-bottom: 0; }' public/screen.css \
  && ok "every screen fits a full screen on any monitor: the trends drawn to the height landscape and scaled upright, the habitat's charts four across and as short as the screen needs, the fitting watched and repeated, the gallery's columns by its count, the Earth at the landing screen's foot" || bad "the screens' fitting is not as it should be"
! echo "$SCR" | grep -q 'class="tabbar\|class="foot\|id="consent"' && ok "no bar of keys, no foot, no cookie card on a screen" || bad "the station's chrome is on a screen"
echo "$SCR" | grep -q '/screen.css?v=' && echo "$SCR" | grep -q '/screen.js?v=' && echo "$SCR" | grep -q '/board.js?v=' && ok "each screen loads the screens' stylesheet and script over the site's, and the script that keeps its piece live" || bad "a screen's assets are missing"
for n in landing habitat board write mission blogs day trends media; do curl -s -b $SK $B/screen/$n; done | grep -q 'id="stage-clock"' && ok "the venue's clock in the head" || bad "no clock on the screens"
curl -s -b $SK $B/screen/day | grep -q 'class="screen-three"' && ok "the day is three panels in a row (one under the other upright)" || bad "the day screen is not three panels"
# the ground station's screen (October: "a URL that never asks for cookies and always opens the writing screen and the
# message board with the operator as Bodenstation"): /screen/station — the writing screen's composer, operator
# BODENSTATION, posting to /screen/write, and the station's board beside it, cut clean at the foot; listed at /screens
STN=$(curl -s -b $SK "$B/screen/station?lang=en")
echo "$STN" | grep -q 'class="landing inner screen screen-station" data-screen="station" data-fit="clip"' && echo "$STN" | grep -q '<div class="screen-station">' \
  && echo "$STN" | grep -q '<div class="screen-write station-write"><section class="device composer-device"' && echo "$STN" | grep -q 'class="dev-chip"[^>]*>BODENSTATION</span>' \
  && echo "$STN" | grep -q 'action="/screen/write?lang=en"' && echo "$STN" | grep -q 'data-refresh="/screen/write/composer?lang=en"' \
  && echo "$STN" | grep -q '<div class="station-board"><div class="feed-wrap"><div class="feed-scroll" id="feed" data-poll="/api/board?lang=en&amp;limit=400&amp;station=1"' \
  && ! echo "$STN" | grep -q 'id="consent"\|consent-veil' && echo "$STN" | grep -q '/composer.js?v=' && echo "$STN" | grep -q '/screen-write.js?v=' && echo "$STN" | grep -q '/board.js?v=' \
  && curl -s -b $SK "$B/screens?lang=en" | grep -q '<a href="/screen/station"><b>Ground station</b><span>/screen/station</span></a>' && curl -s -b $SK $B/screens | grep -q '<a href="/screen/station"><b>Bodenstation</b>' \
  && grep -q 'body.screen.screen-station .screen-station { display: grid; grid-template-columns: minmax(0, 560px) minmax(0, 1fr); gap: 22px; height: 100%; min-height: 0; }' public/screen.css \
  && grep -q "req.params.name === 'write' || req.params.name === 'station' ? writeCtx(req) : screenCtx(req)" src/server.js \
  && ok "the ground station's screen, /screen/station: the writing screen's composer with BODENSTATION as its operator, posting to the writing screen's address, and the station's board beside it, cut at the foot — no cookie question, listed among the screens" || bad "the ground station's screen is not as it should be"
# no screen address ever asks about cookies (October): /screen and /screens/<name> are sent on, a name that is no screen's
# answers with the list and a word — never the site's 404 page, which carries the cookie question
[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/screen)" = "302 $B/screens" ] && [ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$B/screens/station?lang=en")" = "302 $B/screen/station?lang=en" ] \
  && [ "$(curl -s -b $SK -o /dev/null -w '%{http_code}' "$B/screen/nope?lang=en")" = "404" ] && curl -s -b $SK "$B/screen/nope?lang=en" | grep -q '<p class="screen-index-missing" role="alert">There is no screen called <code>nope</code>. These are the screens:</p>' \
  && ! curl -s -b $SK "$B/screen/nope" | grep -q 'consent-veil\|id="consent"' && ! curl -s -b $SK $B/screens | grep -q 'consent-veil\|id="consent"' && [ "$(curl -s -b $SK -D - -o /dev/null $B/screens | grep -ci 'set-cookie')" = "0" ] \
  && ok "no screen address asks about cookies: /screen and /screens/<name> are sent on, a name that is no screen's answers with the list and a word (404), never the site's 404 page with its cookie question; the list sets no cookie" || bad "a screen address reaches the cookie question"

BL=$(curl -s -b $SK $B/screen/blogs)
echo "$BL" | grep -q 'class="screen-blogs" id="screen-blogs"' && echo "$BL" | grep -q 'data-fit="none"' && echo "$BL" | grep -q '/screen-blogs.js?v=' \
  && node -e 'const h = process.argv[1]; const a = h.indexOf("id=\"blog-commander\""), b = h.indexOf("id=\"blog-science\""), c = h.indexOf("id=\"blog-health\""); process.exit(a > -1 && a < b && b < c ? 0 : 1);' "$BL" \
  && grep -q "translateY" public/screen-blogs.js && grep -q "requestAnimationFrame" public/screen-blogs.js \
  && ok "the blogs screen shows one blog at a time, the post rolling by — the Commander Blog, then the Daily Mission Report, then the Health Report, round and round" || bad "the blogs screen is not one at a time"
grep -q "font-size: clamp(20px, 1.2vw, 24px)" public/screen.css && ok "its text stands at the size of the panel's own notes, readable across the room" || bad "the blogs screen's text size is not set"
grep -q 'body.screen .screen-blogs .blogp .dpanel-body > .empty { position: absolute; inset: 22px 40px 40px; min-height: 0; display: block; text-align: left;' public/screen.css \
  && ok "a blog with nothing written stands at the top left, across the width, like a post would" || bad "the empty blog note is not left-aligned across the width"
# the board screen: its cards come back from the poll in the screen's own language, all 400 of them; nothing on it is tappable
echo "$SCR" | grep -q 'data-poll="/api/board?lang=de&amp;limit=400&amp;station=1"' && curl -s -b $SK "$B/screen/board?lang=en" | grep -q 'data-poll="/api/board?lang=en&amp;limit=400&amp;station=1"' \
  && ok "the board screen polls /api/board for its own language and its 400 cards, as the ground station" || bad "the board screen polls the visitor's board"
curl -s "$B/api/board?lang=de&limit=400" | grep -q 'Diese Nachricht ist jetzt' && curl -s "$B/api/board?lang=fr" | grep -q 'Ce message est maintenant' && ! curl -s "$B/api/board?lang=de" | grep -q 'This message is currently' \
  && ok "/api/board answers in the language asked for, so the ticking words and the cards' words agree" || bad "/api/board ignores ?lang"
grep -q "if (document.body.classList.contains('screen')) return;" public/board.js && grep -q 'body.screen .card.xc .card-space { flex-direction: row; flex-wrap: wrap;' public/screen.css && grep -q 'body.screen .card.xc .card-space-more { display: contents; }' public/screen.css \
  && ok "on the board screen the distance and the launch time share one line, and a tap opens nothing" || bad "the board screen's space line is not one line, or a tap still opens the panel"
curl -s -b $SK $B/screen/mission | grep -q 'id="mission-today"' && curl -s -b $SK $B/screen/trends | grep -q 'id="trends"' && curl -s -b $SK $B/screen/habitat | grep -q 'id="hbt-bento"' && ok "the mission, the trends and the habitat screens carry the dashboard's own panels" || bad "a screen lacks its panel"
curl -s "$B/api/cloud?flat=1" | node -e 'let s="";process.stdin.on("data",(c)=>s+=c).on("end",()=>{const j=JSON.parse(s); process.exit(!j.configured || (j.html.indexOf("cloud-flat")>-1 && j.html.indexOf("cloud-day-head")<0) ? 0 : 1);});' \
  && ok "/api/cloud?flat=1 answers with the gallery as one grid, no day heads — what the media screen polls (data-api)" || bad "the flat gallery is wrong"
curl -s -b $SK $B/screens | grep -q '/screen/board?lang=en&amp;theme=light' && ok "the list explains the switches" || bad "the list does not explain the switches"
grep -q "location.reload" public/screen.js && grep -q "venueDate() !== day0" public/screen.js && ok "every screen reloads itself every five minutes and at the venue's midnight" || bad "screen.js does not reload"
# the landing screen is the first page as the site has it now: the way to the habitat, with the sky, under the ticker
curl -s -b $SK "$B/screen/landing?lang=en" | grep -q '<div class="space-room" id="space-room">' && curl -s -b $SK "$B/screen/landing?lang=en" | grep -q 'id="dome-sky-data"' && ! curl -s -b $SK "$B/screen/landing" | grep -q 'id="habitat-dome"' \
  && ok "the landing screen shows the way to the habitat — the Earth, the line, the sky around it — under the ticker" || bad "the landing screen is not the first page"
# the writing screen: the composer full screen, every message a new visitor's
WR=$(curl -s -b $SK "$B/screen/write?lang=en")
echo "$WR" | grep -q 'class="landing inner screen screen-write" data-screen="write" data-fit="scale" data-min-width="640"' && echo "$WR" | grep -q '<div class="screen-write"><section class="device composer-device"' \
  && echo "$WR" | grep -q 'action="/screen/write?lang=en" id="composer" class="composer" data-callsign="BODENSTATION" data-kiosk="1"' && echo "$WR" | grep -q '<div class="dev-body" id="dev-body" data-kiosk="1" data-refresh="/screen/write/composer?lang=en">' \
  && echo "$WR" | grep -q 'class="dev-chip" title="[^"]*">BODENSTATION</span>' && ! echo "$WR" | grep -q 'Callsign on sending' && echo "$WR" | grep -q '/composer.js?v=' && echo "$WR" | grep -q '/screen-write.js?v=' && ! echo "$WR" | grep -q 'transit-block' \
  && curl -s -b $SK "$B/screen/write" | grep -q 'action="/screen/write?lang=de"' && curl -s -b $SK "$B/screen/write" | grep -q 'class="dev-chip" title="[^"]*">BODENSTATION</span>' && ! curl -s -b $SK "$B/screen/write" | grep -q '>Rufzeichen beim Senden<' && curl -s -b $SK "$B/screen/write/composer?lang=de" | grep -q 'data-callsign="BODENSTATION"' \
  && curl -s -b $SK "$B/screens?lang=en" | grep -q '<a href="/screen/write"><b>Write to the crew</b><span>/screen/write</span></a>' && curl -s -b $SK $B/screens | grep -q '<a href="/screen/write"><b>Schreib der Crew</b>' \
  && ok "the writing screen: the composer alone, full screen, its form posting to the screen's own address in the screen's language, its operator BODENSTATION in its head from the start (no Rufzeichen beim Senden); on the list" || bad "the writing screen is not the composer, or its operator is not the ground station"
WK=/tmp/kiosk.jar; rm -f $WK
WR1=$(curl -s -b $SK -c $WK -b $WK -D /tmp/kiosk-h1.txt -H 'X-Requested-With: fetch' -d "body=First from the square" -d "tags=QUESTION" "$B/screen/write?lang=en")
WR2=$(curl -s -b $SK -c $WK -b $WK -D /tmp/kiosk-h2.txt -H 'X-Requested-With: fetch' -d "body=Second from the square" "$B/screen/write?lang=en")
CS1=$(echo "$WR1" | grep -o 'class="transit transit-block" data-callsign="[A-Z0-9-]*"' | head -1); CS2=$(echo "$WR2" | grep -o 'class="transit transit-block" data-callsign="[A-Z0-9-]*"' | head -1)
[ "$CS1" = 'class="transit transit-block" data-callsign="BODENSTATION"' ] && [ "$CS2" = "$CS1" ] && ! grep -qi 'set-cookie: mcs_id' /tmp/kiosk-h1.txt && ! grep -qi 'set-cookie' /tmp/kiosk-h2.txt \
  && echo "$WR1" | grep -q 'data-hold="9000"' && echo "$WR1" | grep -q 'class="kiosk-cs">Your message went under the callsign <b>BODENSTATION</b>' \
  && [ "$(DATA_DIR="$DATA_DIR" node -e 'const db=require("./src/db").db; const r = db.prepare("SELECT COUNT(DISTINCT visitor_id) v, COUNT(DISTINCT callsign) c, MIN(callsign) cs FROM message WHERE body IN (?, ?)").get("First from the square", "Second from the square"); console.log(r.v + " " + r.c + " " + r.cs)')" = "2 1 BODENSTATION" ] \
  && ok "two messages sent from the writing screen one after the other both go out as BODENSTATION — the ground station's one operator name — each still a visitor row of its own (no cookie set, no transit lock between them), each answered with the crossing, held longer" || bad "the writing screen's messages do not carry the ground station's name, or share a visitor"
sleep 4   # the transit (TRANSIT_SECONDS=3): then the screen's messages are in mission control's queue under the operator's name
curl -s -b $A "$B/control?show=pending" | grep -q '<span class="cs">BODENSTATION</span>' \
  && ok "mission control's queue shows the screen's messages under BODENSTATION, not under a callsign of the computer's" || bad "the screen's messages do not reach the queue under the operator name"
# the board screen is the ground station's board: everything sent from the writing screen stands on it at once, whatever
# its state, under the station's name, in the one sequence with everyone's exchanges (no group of its own at the top, no
# headings) — the public board (a cookie's, or nobody's) shows nothing of it until it is published
BD=$(curl -s -b $SK "$B/screen/board?lang=en")
echo "$BD" | grep -q 'data-poll="/api/board?lang=en&amp;limit=400&amp;station=1"' && ! echo "$BD" | grep -q 'board-group' \
  && echo "$BD" | grep -q 'First from the square' && echo "$BD" | grep -q 'Second from the square' && [ "$(echo "$BD" | grep -o '<span class="cs">BODENSTATION</span>' | wc -l)" -ge 2 ] \
  && curl -s "$B/api/board?lang=en&limit=400&station=1" | grep -q 'First from the square' && ! curl -s "$B/api/board?lang=en&limit=400" | grep -q 'First from the square' && ! curl -s $B/write | grep -q 'First from the square' \
  && ok "the board screen shows the writing screen's messages at once, unanswered, as BODENSTATION among the rest — no group of them at the top — and polls as the station; the public board shows them only once published" || bad "the board screen is not the ground station's board"
# one sequence, the newest first, by the moment each was sent: the station's two unanswered messages (the newest) first,
# then everyone's answered exchanges, older — not the station's own as a group over the rest
echo "$BD" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const a = s.indexOf("id=\"feed-cards\""), b = s.indexOf("id=\"feed-empty\"", a);
  const cards = [...s.slice(a, b).matchAll(/<article class="card xc[^"]*" id="m(\d+)"[\s\S]*?<time datetime="([^"]+)"/g)].map((m) => ({ id: Number(m[1]), at: Date.parse(m[2]) }));
  const ok = cards.length >= 3 && cards.every((c, i) => !i || cards[i - 1].at >= c.at) && s.slice(a, b).indexOf("Second from the square") < s.slice(a, b).indexOf("First from the square")
    && cards.some((c) => c.at < cards[0].at);
  if (!ok) console.error(JSON.stringify(cards));
  process.exit(ok ? 0 : 1);
});' && ok "the board screen's cards stand in one sequence by the moment sent, the newest first — the second message from the square before the first, the older exchanges after them" || bad "the board screen's cards are out of sequence"
curl -s -b $SK "$B/screen/write/composer?lang=fr" | grep -q 'action="/screen/write?lang=fr"' && curl -s -b $SK "$B/screen/write/composer?lang=fr" | grep -q 'placeholder="Écrivez à l’équipage."' && ! curl -s -b $SK "$B/screen/write/composer?lang=fr" | grep -q 'transit-block' \
  && [ "$(curl -s -b $SK -o /dev/null -w '%{http_code}' -d "body=Plain from the square" "$B/screen/write?lang=en")" = "200" ] \
  && [ "$(curl -s -b $SK -H 'X-Requested-With: fetch' -d "body=x" "$B/screen/write?lang=en" | grep -c 'Write something before transmitting')" = "1" ] \
  && ok "the fresh composer comes from the screen's own address in its language; a plain post is answered with the screen itself; a word too short is refused as on the site" || bad "the writing screen's fragment or its refusals are wrong"
grep -q "window.MCSScreenBusy = busy;" public/screen-write.js && grep -q "if (busy()) return later(60000);" public/screen.js && grep -q "venueDate() !== day0 && !busy()" public/screen.js && grep -q "var IDLE = 3 \* 60 \* 1000" public/screen-write.js \
  && grep -q "var refreshUrl = (stage && stage.getAttribute('data-refresh')) || '/api/composer';" public/composer.js && grep -q "Number(block.dataset.hold) || 2600" public/composer.js && grep -q "chip.textContent = chip0;" public/composer.js \
  && grep -q "body.screen .screen-write .dev-stage .transit-block { position: static; }" public/screen.css && grep -q "body.screen .screen-write .dev-close { display: none !important; }" public/screen.css \
  && ok "the screen's reloads wait while someone is writing, what is left half-written is cleared after three minutes, and the device's head goes back to Callsign on sending for the next person" || bad "the writing screen's script is not wired"

echo "── mission control: the composer's one form, the record of the crew's states"
! grep -q 'data-mode="text"' public/entry-editor.js && ! grep -q 'ed-bar-tabs' public/entry-editor.js public/station.css && ok "the blog composer has no Visual | Text switch — the sheet is the one form" || bad "the Visual | Text switch is still in the composer"
CREW1=$(curl -s -b $A $B/control | grep -oE '/control/moods/[0-9]+' | head -1 | grep -oE '[0-9]+$')
curl -s -b $A -X POST -d "calm_tense=25" -d "day=$TODAY" -o /dev/null $B/control/moods/$CREW1
curl -s -b $A -X POST -d "calm_tense=75" -d "day=$TODAY" -o /dev/null $B/control/moods/$CREW1
MR=$(curl -s -b $A "$B/control?tab=comms")
echo "$MR" | grep -q 'class="mood-table"' && echo "$MR" | grep -q '<td class="mr-mood"><b>UPSET</b><span>upset, not having a good day</span></td>' && echo "$MR" | grep -q '<td class="mr-mood"><b>HAPPY</b>' \
  && ok "every state filed is a row of the record under the officer's state — the newest first, with the day and time, the sol, the mood and who filed it" || bad "the record under the state is missing a filing"
echo "$MR" | grep -q '<td class="mr-by">control</td>' && echo "$MR" | grep -q "SOL $(printf '%03d' $TODAY)<" && ok "the row names the desk that filed it and the sol" || bad "the row lacks the desk or the sol"
curl -s -b $A $B/archive/moods.csv | python3 -c '
import csv, sys
rows = list(csv.reader(sys.stdin))
rows[0][0] = rows[0][0].lstrip("\ufeff")
ok = rows and rows[0] == ["officer", "date", "time", "sol", "mood", "value", "reads", "filed_by", "filed_at_utc"] and len(rows) >= 3 and rows[-1][4] == "UPSET" and rows[-2][4] == "HAPPY" and rows[-1][7] == "control" and all(r[7] != "content" for r in rows[1:])
sys.exit(0 if ok else 1)
' && ok "and /archive/moods.csv hands the whole record over — every officer, oldest first, the content loader's placeholder state left out" || bad "the CSV of the record is wrong"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/archive/moods.csv)" = "302" ] && [ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b $A $B/control/moods.csv)" = "301 $B/archive/moods.csv" ] \
  && ok "the CSV is behind the sign-in, and the old address under the officer's state leads to the archive's" || bad "the CSV is public, or the old address is dead"
# the CSV is the Archive's, not the desk's (October): a card under Take a copy, no key under the officer's state
curl -s -b $A $B/archive | grep -q "The crew’s moods" && curl -s -b $A $B/archive | grep -q 'href="/archive/moods.csv"' && ! echo "$MR" | grep -q 'mood-record-csv\|CSV · all officers' \
  && ok "the crew's moods are a card of the Archive's Take a copy — CSV, one row per state — and the officer's state on the desk carries no CSV key" || bad "the moods CSV is not in the archive, or still under the officer's state"

echo "── the board: the viewer's own messages, and the last nine the crew have answered"
grep -q "BOARD_RECENT" src/server.js && grep -q "LIMIT 100" src/lib/data.js && grep -q "m.state = 'PUBLISHED' AND m.visitor_id != ?" src/lib/data.js \
  && ok "the board holds the viewer's own messages, whatever their state, and the newest nine answered exchanges (BOARD_RECENT)" || bad "the board's query is not own + nine"
[ "$(curl -s $B/messages | grep -c 'class="card xc')" -le 9 ] && ok "a visitor without messages of their own sees at most nine" || bad "more than nine cards for a stranger"

echo "── beamed into space: the relay to SpaceSpeak (replied messages only), the card's line into space, the journey"
# on the main station the relay is off (no account): a replied message's line counts from the moment its reply was published
MSGS=$(curl -s "$B/api/board?lang=en&limit=400")
echo "$MSGS" | grep -q 'class=\\"card-space\\" data-launched=\\"' && echo "$MSGS" | grep -qE 'This message is currently <b class=\\"sp-km\\">[0-9.,]+ (million|billion)</b> km from Earth!' \
  && echo "$MSGS" | grep -q 'Launched <span class=\\"sp-ago\\">' && ! echo "$MSGS" | grep -q 'Update distance\|miles' \
  && ok "every card on the screens' board carries its line into space — kilometres alone, in words once it is big (million, billion), and when it was launched; no miles, no Update distance key" || bad "the cards have no line into space: $(echo "$MSGS" | grep -o 'This message is currently.\{0,140\}' | head -1)"
echo "$MSGS" | grep -q 'data-au=\\"[0-9.]*\\" data-ls=\\"[0-9]*\\" data-callsign=\\"[A-Z]*-[0-9]*\\"' && echo "$MSGS" | grep -q 'class=\\"card-space-go\\">Follow its journey ›' \
  && ok "each card carries what its journey needs — the launch moment, Mars’s distance and light time that day — and says it can be followed" || bad "the cards lack the journey's data"
# the wall's notes carry the same line, compact: the orbit sign, the figure and km, how long ago it left, the › to its journey
WALLN=$(curl -s $B/write)
echo "$WALLN" | grep -q 'class="card-space card-space-compact" data-launched="' && echo "$WALLN" | grep -qE 'title="This message is currently [0-9.,]+ (million|billion) km from Earth!"' \
  && echo "$WALLN" | grep -q '<svg class="sp-ic" viewBox="0 0 24 24" aria-hidden="true">' && echo "$WALLN" | grep -qE '<span class="card-space-line"><b class="sp-km">[0-9.,]+ (million|billion)</b> km</span>' \
  && echo "$WALLN" | grep -q '<span class="card-space-launched"><span class="sp-ago">' && echo "$WALLN" | grep -q '<span class="card-space-go" title="Follow its journey">›</span>' \
  && echo "$WALLN" | grep -q 'data-au="[0-9.]*" data-ls="[0-9]*" data-callsign="[A-Z]*-[0-9]*"' \
  && ok "a note's foot carries the line into space compact — the orbit sign, the figure and km, how long ago it left, › to its journey — with the journey's data" || bad "the notes' line into space is not as it should be"
# under the pointer a note lifts and lights up — an orange edge and glow, a waiting signal mark orange, the key brightening — and a
# band slides up over its foot: Click to see how far it has travelled › (German and French too); nothing of it on a screen
echo "$WALLN" | grep -q '<span class="note-hint" aria-hidden="true">Click to see how far it has travelled ›</span>' \
  && curl -s -H "Cookie: mcs_lang=de" $B/write | grep -q '<span class="note-hint" aria-hidden="true">Klicken und sehen, wie weit sie schon gereist ist ›</span>' \
  && curl -s -H "Cookie: mcs_lang=fr" $B/write | grep -q 'Cliquez pour voir jusqu’où il a voyagé ›</span>' \
  && grep -q 'body.landing .card.note:has(.card-space\[data-launched\]):hover { transform: translateY(-3px); border-color: var(--mars);' public/aura.css \
  && grep -q 'body.landing .card.note .note-hint { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 9px 16px; background: var(--mars); color: #fff;' public/aura.css \
  && grep -q 'body.landing .card.note:has(.card-space\[data-launched\]):hover .note-hint { transform: none; opacity: 1; }' public/aura.css \
  && grep -q 'body.landing .card.note:has(.card-space\[data-launched\]):hover .note-mark.is-waiting { color: var(--mars); }' public/aura.css \
  && grep -q 'body.landing .card.note:has(.card-space\[data-launched\]):hover .card-space-compact .card-space-go { color: var(--mars); }' public/aura.css \
  && grep -q '@media (hover: none) { body.landing .card.note .note-hint { display: none; }' public/aura.css && grep -q 'body.screen .card.note .note-hint { display: none; }' public/aura.css \
  && grep -q ':root\[data-theme="dark"\] body.landing .card.note:has(.card-space\[data-launched\]):hover { border-color: var(--mars); }' public/aura.css && ! grep -q 'body.landing .card.note:hover { border-color: rgba(var(--cobalt-rgb),.45); }' public/aura.css \
  && ok "under the pointer a note lifts with an orange edge and glow, its waiting signal and key orange, and a band slides up over its foot — Click to see how far it has travelled › — in German and French too; not where there is no pointer, not on a screen" || bad "the notes do not light up under the pointer as they should"
MSGD=$(curl -s -H "Cookie: mcs_lang=de" "$B/api/board?lang=de&limit=400")
echo "$MSGD" | grep -qE 'Diese Nachricht ist jetzt <b class=\\"sp-km\\">[0-9.,]+ (Millionen|Milliarden)</b> km von der Erde entfernt!' \
  && echo "$MSGD" | grep -q 'Gestartet <span class=\\"sp-ago\\">' && echo "$MSGD" | grep -q '>Seine Reise verfolgen ›<' && curl -s -H "Cookie: mcs_lang=de" $B/write | grep -q 'title="Seine Reise verfolgen">›</span>' \
  && ok "in German with German figures and words — Millionen, Milliarden; Gestartet; Seine Reise verfolgen" || bad "the German line is wrong"
grep -q "setInterval(tick, 1000)" public/board.js && grep -q "299792.458" public/board.js && grep -q "'quadrillion'" public/board.js \
  && ok "board.js moves the figure on every second — 299,792 km a second — million, billion, trillion, quadrillion as it grows" || bad "board.js does not run the distance"
grep -q "closest('.card.xc')" public/board.js && grep -q "function closest(" public/board.js && grep -q "/api/celestial" public/board.js && grep -q "jr-one" public/board.js && ! grep -q "jr-stops\|voyagerKm" public/board.js \
  && ok "a tap on a card says in two lines what the message is closest to — the last object it has passed, how many times farther it is, one line about the object — nothing more" || bad "board.js has no closest-object panel, or still lists everything"
! grep -q "RECONNECTING" public/board.js && ! grep -q "'RECONNECTING'" src/lib/i18n.js && grep -q "live.classList.add('stale')" public/board.js \
  && ok "the board's LIVE mark never says RECONNECTING — a failed poll only takes its pulse away and tries again" || bad "the board still says RECONNECTING"
grep -q 'body.landing > .journey, .journey { padding: 24px 16px; align-items: center; }' public/aura.css && grep -q '.jr-panel { width: 100%; max-height: 84vh; max-height: 84dvh; border-radius: 22px;' public/aura.css \
  && ok "on a phone the message's panel floats in the middle of the screen, a card with room around it, not a sheet at the foot" || bad "the phone's panel still sticks to the foot"
grep -q '<span class="jr-what">' public/board.js && ! grep -q 'jr-what" href\|wikipedia\|o\.wiki' public/board.js && ! grep -q 'jr-what:hover\|text-decoration' <(awk '/^\.jr-line/' public/aura.css) \
  && ok "the object's name on the panel is a word, not a link — no Wikipedia key, nothing to tap" || bad "the panel still links to Wikipedia"
grep -q "WHERE = {" public/board.js && grep -q "orbits about {km} km above Earth" public/board.js && grep -q "passed about {km} km from Earth" public/board.js && grep -q "is about {km} km above the ground" public/board.js \
  && ok "the second line follows the object's kind of distance — a satellite orbits, an asteroid passed, a meteor is above the ground, a probe is now, a planet on average" || bad "board.js has one sentence for every kind of distance"
CEL=$(curl -s "$B/api/celestial?lang=de")
echo "$CEL" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const j = JSON.parse(s), o = j.objects;
  const HOW = ["avg", "orbit", "flew", "reached", "flyby", "will", "closest", "farthest", "now", "mark", "height", "ly"];
  const sorted = o.every((x, i) => !i || x.km >= o[i - 1].km), ids = new Set(o.map((x) => x.id));
  const fields = o.every((x) => x.id && x.km > 0 && x.name && x.about && HOW.includes(x.how) && x.wiki === undefined);
  const has = (id) => ids.has(id);
  const near = o.filter((x) => x.km <= 89937738).length, run = o.filter((x) => x.km <= 362628957197).length;
  if (!(near >= 100 && run >= 280)) console.error("    " + near + " within five light-minutes, " + run + " within two light-weeks");
  process.exit(j.lang === "de" && o.length >= 500 && ids.size === o.length && sorted && fields && near >= 100 && run >= 280 && has("iss") && has("moon") && has("saturn") && has("sirius") && has("andromeda") && has("c_orion") && has("voyager1") && has("m14d")
    && o.find((x) => x.id === "saturn").name === "der Saturn" && o.find((x) => x.id === "iss").how === "orbit" && o.find((x) => x.id === "voyager1").how === "now" && o.find((x) => x.id === "sirius").how === "ly" ? 0 : 1);
});' && ok "/api/celestial hands over 500-odd objects — a hundred and more within the first five light-minutes, 280 and more within the two light-weeks a message travels during the run — nearest first, each with its distance, its kind of distance (how), its name and line in the page's language, and no Wikipedia address" || bad "/api/celestial is incomplete"
node -e '
const c = require("./src/lib/celestial"); const all = c.all();
const ok = all.length >= 500 && all.every((o) => ["en", "de", "fr"].every((l) => o.name[l] && o.about[l]))
  && all.find((o) => o.id === "saturn").km > 1.4e9 && all.find((o) => o.id === "saturn").km < 1.5e9
  && all.find((o) => o.id === "sirius").ly === 8.6 && all.find((o) => o.id === "moon").km === 384400 && all.find((o) => o.id === "iss").km === 400
  && all.find((o) => o.id === "m14d").km === 362628957197 && all.find((o) => o.id === "lightday").km > 25.9e9 && all.find((o) => o.id === "lightday").km < 25.95e9
  && all.find((o) => o.id === "io").km < all.find((o) => o.id === "jupiter").km;
process.exit(ok ? 0 : 1);' && ok "content/celestial.json carries every object in the three languages, with the accepted distances — the ISS 400 km, the Moon 384,400 km, Saturn 1.43 billion km, one light-day 25.9 billion km, two light-weeks 362.6 billion km, Sirius 8.6 light-years; a moon a hair inside its planet, so the planet is named first" || bad "celestial.json is wrong"
curl -s "$B/api/celestial?lang=fr" | grep -q '"name":"Saturne"' && curl -s "$B/api/celestial" | grep -q '"name":"Saturn"' && ok "the list comes in French and in English too" || bad "the list is not translated"
# the first fifteen light-days — where a message is all through the run — carry the interstellar comets on their way out, the
# Pale Blue Dot, the Kuiper cliff and the far ends of the long orbits, so the line names a thing and not only a light-day mark
curl -s "$B/api/celestial" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const o = JSON.parse(s).objects, LD = 299792.458 * 86400, AU = 149597870.7, by = Object.fromEntries(o.map((x) => [x.id, x]));
  const closest = (km) => { let p = o[0]; for (const x of o) { if (x.km <= km) p = x; else break; } return p; };
  const want = [["atlas3i", 12, "now"], ["palebluedot", 40.5, "mark"], ["borisov", 48, "now"], ["kuipercliff", 50, "avg"], ["erisfar", 97.6, "farthest"], ["ikeyasekifar", 183, "farthest"],
    ["vp113far", 446, "farthest"], ["neowisefar", 715, "farthest"], ["sy99far", 1400, "farthest"], ["of201far", 1600, "farthest"]];
  const ok = o.length >= 596 && want.every(([id, au, how]) => by[id] && Math.abs(by[id].km - au * AU) < 2 && by[id].how === how && by[id].name && by[id].about)
    && closest(13 * AU).id === "atlas3i" && closest(49 * AU).id === "borisov" && closest(2.6 * LD).id === "vp113far" && closest(4.2 * LD).id === "neowisefar" && closest(8.2 * LD).id === "sy99far" && closest(9.3 * LD).id === "of201far"
    && by.atlas3i.name === "comet 3I/ATLAS" && by.palebluedot.name === "the Pale Blue Dot" && /Voyager 1 turned its camera round in 1990/.test(by.palebluedot.about) && by.of201far.name === "2017 OF201 at its farthest";
  process.exit(ok ? 0 : 1); });
' && curl -s "$B/api/celestial?lang=de" | grep -q '"name":"die Kuiper-Klippe"' && curl -s "$B/api/celestial?lang=fr" | grep -q '"name":"la comète NEOWISE au plus loin"' \
  && ok "ten more things within the first fifteen light-days — comet 3I/ATLAS and 2I/Borisov on their way out, the Pale Blue Dot, the Kuiper cliff, Eris, Ikeya–Seki, 2012 VP113, comet NEOWISE, 2013 SY99 and 2017 OF201 at their farthest — each in the three languages; a message two and a half light-days out is past 2012 VP113's far end, nine days out past 2017 OF201's" || bad "the objects within the first fifteen light-days are missing"
node -e '
const D = require("./src/lib/i18n").D;
const keys = ["Your message is {r} times farther away than {name}.", "Your message is just about as far as {name}.", "{name} is on average about {km} km from Earth", "{name} is {ly} light-years from Earth",
  "{name} orbits about {km} km above Earth", "{name} flew about {km} km above Earth", "{name} reached {km} km from Earth", "{name} passed about {km} km from Earth", "{name} is now about {km} km from Earth", "{name} is {km} km from Earth", "{name} is about {km} km above the ground",
  "millions", "billions", "trillions"];
process.exit(keys.every((k) => D[k] && D[k][0] && D[k][1]) ? 0 : 1);
' && ok "the two lines' words — one sentence for each kind of distance — are in the dictionary in German and French" || bad "the panel's rows are missing from the dictionary"
curl -s $B/ | grep -q 'class="dev-space"' && bad "the composer says every message is beamed while the relay is off" || ok "with the relay off the composer says nothing about space"
CQ=$(curl -s -b $A "$B/control?show=published")
echo "$CQ" | grep -q 'SPACESPEAK_USER\|space-status' && bad "control still carries the relay-off line" || ok "with the relay off mission control says nothing about it — no Off — set SPACESPEAK_USER line"
echo "$CQ" | grep -qE '<b class="msg-sent">sent [0-9]+ [A-Z][a-z]+ 20[0-9]{2}, [0-9]{2}:[0-9]{2}:[0-9]{2} [A-Z+0-9]+</b>' && ! echo "$CQ" | grep -q 'Beam again' \
  && ok "every message on the control page shows the day, time and zone it was sent, on the venue's clock — and there is no Beam again key" || bad "the control page lacks the full timestamp, or still offers Beam again"
# a station with the relay on, sending to a stand-in for spacespeak.com
MOCKP=8095; RELP=8096
MOCK_PORT=$MOCKP node tools/spacespeak-mock.js > /tmp/spacespeak-mock.log 2>&1 &
MOCKPID=$!
DATA4=$(mktemp -d); CONT4=$(mktemp -d); cp content/*.json "$CONT4"/
DATA_DIR="$DATA4" CONTENT_DIR="$CONT4" node src/db/seed.js > /dev/null 2>&1
DATA_DIR="$DATA4" CONTENT_DIR="$CONT4" PORT=$RELP TRANSIT_SECONDS=1 HOURLY_LIMIT=60 SPACESPEAK_URL=http://localhost:$MOCKP \
  SPACESPEAK_USER=station SPACESPEAK_PASSWORD=secret SPACESPEAK_GAP_SECONDS=2 SPACESPEAK_ATTEMPTS=2 \
  node src/server.js > /tmp/srv4.log 2>&1 &
SRV4=$!
sleep 3
B4=http://localhost:$RELP
if DATA_DIR="$DATA4" SPACESPEAK_URL=http://localhost:$MOCKP SPACESPEAK_USER=station SPACESPEAK_PASSWORD=secret node tools/spacespeak-probe.js > /tmp/probe.log 2>&1; then
  grep -q "nothing was pressed" /tmp/probe.log && grep -q "signed in" /tmp/probe.log && [ "$(curl -s http://localhost:$MOCKP/_mock/messages)" = "[]" ] \
    && ok "the probe (tools/spacespeak-probe.js) signs in, opens the send page and types the line — a dry run presses nothing" || bad "the probe's dry run went wrong"
  DATA_DIR="$DATA4" SPACESPEAK_URL=http://localhost:$MOCKP SPACESPEAK_USER=station SPACESPEAK_PASSWORD=secret node tools/spacespeak-probe.js --send --text "Probe line" > /tmp/probe2.log 2>&1 \
    && grep -q "SpaceSpeak No. 142900" /tmp/probe2.log && curl -s http://localhost:$MOCKP/_mock/messages | grep -q '"text":"Probe line"' \
    && ok "with --send it really sends, and prints the message's number on the site" || bad "the probe's send went wrong"
  grep -q "\[spacespeak\] on — sending to http://localhost:$MOCKP" /tmp/srv4.log && ok "with the account in .env the station starts the relay" || bad "the relay did not start"
  curl -s $B4/ | grep -q 'class="dev-space">Every message is also beamed into space by radio.</span>' \
    && ok "and the composer says under its key: Every message is also beamed into space by radio." || bad "the composer does not carry the sentence"
  V4=/tmp/visitor4.jar; rm -f $V4
  curl -s -c $V4 -b $V4 -o /dev/null $B4/
  curl -s -c $V4 -b $V4 -X POST -d "body=Is the sky really butterscotch up there?" -o /dev/null $B4/communicate
  sleep 9
  [ "$(curl -s http://localhost:$MOCKP/_mock/messages | grep -c butterscotch)" = "0" ] && curl -s -b $V4 $B4/messages | grep -q 'class="card-space" data-launched="' \
    && ok "a message just sent is NOT handed to the site — nothing goes out by itself — though its card starts counting the moment it was sent" || bad "a message was sent to the site before any reply, or its card does not count"
  A4=/tmp/admin4.jar; rm -f $A4
  curl -s -c $A4 -X POST -d "username=${CONTROL_USER}" -d "password=${CONTROL_PASSWORD}" -o /dev/null $B4/control/login
  curl -s -b $A4 "$B4/control?show=pending" | grep -q 'Beam again\|Not beamed' && bad "control offers Beam again, or marks an unreplied message" || ok "an unreplied message carries no mark on the control page, and no Beam again key exists"
  newest() { curl -s -b $A4 "$B4/control?show=pending" | grep -oE '/control/[0-9]+/reply' | head -1 | grep -oE '[0-9]+'; }   # the queue's latest at the top
  M1=$(newest)
  # rejected: never sent
  curl -s -c $V4 -b $V4 -X POST -d "body=One to reject" -o /dev/null $B4/communicate
  sleep 2
  curl -s -b $A4 -X POST -o /dev/null $B4/control/$(newest)/reject
  # deleted: never sent
  curl -s -c $V4 -b $V4 -X POST -d "body=One to delete" -o /dev/null $B4/communicate
  sleep 2
  curl -s -b $A4 -X POST -o /dev/null $B4/control/$(newest)/delete
  # replied: sent
  curl -s -b $A4 -X POST -d "body=It is more of a burnt caramel." -d "action=publish" -o /dev/null $B4/control/$M1/reply
  for i in $(seq 1 30); do curl -s http://localhost:$MOCKP/_mock/messages | grep -q "butterscotch" && break; sleep 1; done
  curl -s http://localhost:$MOCKP/_mock/messages | grep -q '"text":"Is the sky really butterscotch up there?"' \
    && ok "the moment its reply is published, the message is on the site — signed in, typed into the box, the key pressed, as written" || bad "the replied message did not reach the site"
  sleep 2
  [ "$(curl -s http://localhost:$MOCKP/_mock/messages | grep -c '"text":"One to')" = "0" ] && ok "the rejected one and the deleted one are never sent" || bad "a rejected or deleted message was sent"
  node -e '
const Database = require("better-sqlite3"); const db = new Database(process.argv[1], { readonly: true });
const r = db.prepare("SELECT s.launched_at, m.submitted_at FROM space_relay s JOIN message m ON m.id = s.message_id WHERE s.state = ? ORDER BY s.id DESC LIMIT 1").get("SENT");
process.exit(r && r.launched_at && r.launched_at > r.submitted_at ? 0 : 1);
' "$DATA4/station.db" && ok "the relay records when SpaceSpeak took it, after the moment it was sent" || bad "no launch moment recorded"
  C4=$(curl -s -b $A4 "$B4/control?show=published")
  ! echo "$C4" | grep -q 'id="space-status"\|A message is handed to' && echo "$C4" | grep -q 'Beamed · No. 1429' && echo "$C4" | grep -q 'href="http://localhost:'$MOCKP'/Messages/1429' \
    && ok "mission control shows the message beamed, with its number and a link to it on the site — and no Beamed into space block over the queue, relay on or off" || bad "control does not show the beamed message, or the relay block is back"
  # the site down: the try fails, is recorded, and the relay tries again by itself a minute later
  curl -s -X POST -d "on=1" -o /dev/null http://localhost:$MOCKP/_mock/fail
  curl -s -c $V4 -b $V4 -X POST -d "body=Sent while the site is down" -o /dev/null $B4/communicate
  sleep 2
  M4=$(newest)
  curl -s -b $A4 -X POST -d "body=Noted." -d "action=publish" -o /dev/null $B4/control/$M4/reply
  for i in $(seq 1 30); do grep -q "not sent (try 1" /tmp/srv4.log && break; sleep 1; done
  grep -q "message $M4 not sent (try 1, again in 1 min): no confirmation after pressing send" /tmp/srv4.log \
    && ok "when the site fails the try is logged with the site's own words, and the relay waits a minute before the next" || bad "a failed send is not handled"
  curl -s -b $A4 "$B4/control?show=published" | grep -q 'Queued for space · try 1 failed' && ok "control shows it queued for another try" || bad "control does not show the queued try"
  ls "$DATA4"/spacespeak/failed-*.png > /dev/null 2>&1 && ok "a screenshot and the page are kept under DATA_DIR/spacespeak/ for reading what went wrong" || bad "no screenshot of the failure"
  # unpublished while waiting: skipped, never sent
  curl -s -b $A4 -X POST -o /dev/null $B4/control/$M4/unpublish
  sleep 7
  curl -s -b $A4 "$B4/control?show=pending" | grep -q 'Not beamed · no longer published when its turn came' && ok "a message unpublished before its turn is skipped, and marked so" || bad "an unpublished message was not skipped"
  curl -s -X POST -d "on=0" -o /dev/null http://localhost:$MOCKP/_mock/fail
  [ "$(curl -s -o /dev/null -w '%{http_code}' -X POST -b $A4 $B4/control/$M4/space)" = "404" ] && ok "there is no beam-again address any more" || bad "/control/:id/space still answers"
else
  if grep -q "Executable doesn't exist\|Playwright is not installed" /tmp/probe.log; then
    echo "  · the relay's browser is not installed here (npx playwright install chromium) — the sending checks were skipped"
  else bad "the probe's dry run failed: $(tail -1 /tmp/probe.log)"; fi
fi
kill $SRV4 2>/dev/null; wait $SRV4 2>/dev/null
kill $MOCKPID 2>/dev/null; wait $MOCKPID 2>/dev/null
rm -rf "$DATA4" "$CONT4"

echo "── everything archived"
curl -s -b $A $B/archive | grep -q "day by day" && ok "archive contents page lists the mission" || bad "no archive contents"
DAYN=$(curl -s -b $A $B/archive | grep -oE "archive/day/[0-9]+" | tail -1 | grep -oE "[0-9]+")
REC=$(curl -s -b $A $B/archive/day/$DAYN)
MISSING=""
for section in "COMMANDING OFFICER" "SCIENCE OFFICER" "HEALTH OFFICER" "Commander Blog" "Daily Mission Report" "Health Report" "Crew state" "SCHEDULE" "MEALS" "INVENTORY LEVELS" "STEPS TAKEN" "POWER" "HABITAT"; do
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

echo "── the landing page: four pages in the glass dress — the way to the habitat, the note, the habitat, the slowest chat — on a phone and on a desk"
LAND=$(curl -s $B/)
echo "$LAND" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const at = (x) => s.indexOf(x);
  const order = ["class=\"sheet-intro\"", "class=\"space-room\"", "id=\"dome-sky-data\"", "id=\"note\"", "id=\"calls\"", "class=\"call call-write\"", "class=\"call call-live\"", "id=\"slowest-chat\"", "</main>", "<section class=\"portal portal-pop\" id=\"write\""].map(at);
  process.exit(order.every((v, i) => v > -1 && (i === 0 || v > order[i - 1])) ? 0 : 1);
});' && ok "the name and the way to the habitat — the Earth, the line, the sky around it — the second page: the note (on a phone the name heads it) with the two calls under it, then the slowest chat — and after the page's body the composer's window, as on every page" || bad "the sheet's pages are out of order"
# the habitat: the cutaway picture handed over (public/Svg_File — the line-art and the coloured stacks of modules), the dome
# on the Mars plain in its lines, every module a key that shows itself in colour, EVA and the Dashboard as round keys on the
# ground in front of the habitat, on a card of glass (inside.js, habitatInside)
ABOUTP=$(curl -s $B/about)
HAB=$(echo "$ABOUTP" | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const a = s.indexOf("<section class=\"about-sec habitat-sec\" id=\"inside\""); process.stdout.write(a < 0 ? "" : s.slice(a, s.indexOf("<section class=\"about-sec\" id=\"sol\"", a))); });')
MODS="hydroponics comms science airlock kitchen storage lounge quarters health lockers recycling cycle power"
[ -n "$HAB" ] && echo "$HAB" | grep -q '<section class="about-sec habitat-sec" id="inside" aria-labelledby="inside-title">' && echo "$HAB" | grep -q '<div class="hab-card">' \
  && echo "$HAB" | grep -q '<h2 class="bigsec" id="inside-title">What’s inside the habitat?</h2>' \
  && echo "$HAB" | grep -q '<p class="dash-sub"><span class="dome-meta dome-hint"><span class="dome-hint-click">Point at a room to know what is inside.</span><span class="dome-hint-tap">Tap a room to know what is inside.</span></span></p>' \
  && echo "$ABOUTP" | grep -q '<nav class="about-jump" aria-label="On this page">' && echo "$ABOUTP" | grep -q '<a href="#about-project">About</a><a href="#inside">What’s inside the habitat?</a><a href="#sol">A sol on MARS!platz</a><a href="#who-we-are">Who we are</a>' \
  && [ "$(echo "$ABOUTP" | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const a = s.indexOf("id=\"about-project\""), b = s.indexOf("id=\"inside\""), c = s.indexOf("id=\"who-we-are\""); process.stdout.write(a > -1 && b > a && c > b ? "ordered" : "out of order"); });')" = "ordered" ] \
  && ! echo "$LAND" | grep -q 'id="habitat-dome"\|class="hab-card"\|sheet-p3' \
  && echo "$HAB" | grep -q '<p class="in-credit">AI generated image</p>' && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<p class="in-credit">KI-generiertes Bild</p>' && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<p class="in-credit">Image générée par IA</p>' \
  && echo "$HAB" | grep -q '<section class="dome-panel is-inside" id="habitat-dome" aria-label="What’s inside the habitat?">' \
  && echo "$HAB" | grep -q '<div class="dome-title"><h2>What’s inside the habitat?</h2></div>' \
  && ! echo "$HAB" | grep -q 'id="dome-seq"\|class="seq-\|class="dome-foot"\|id="dome-sky-data"\|class="sky-msg"\|class="sky-pic"\|RED DUST CITY · R75-2\|class="dome-aura"\|class="dome-mesh"\|class="dome-labels"' \
  && echo "$HAB" | grep -q '<svg class="dome-svg inside-svg" viewBox="0 0 1536 1024" data-view="0 0 1536 1024" data-view-phone="0 0 1536 1024" preserveAspectRatio="xMidYMid meet" role="img" aria-label="The habitat in section: its rooms under the dome, on the Mars plain">' \
  && echo "$HAB" | grep -q '<clipPath id="in-frame-clip"><rect class="in-frame" x="0" y="0" width="1536" height="1024" rx="26"/></clipPath>' \
  && echo "$HAB" | grep -q '<g class="in-picture" clip-path="url(#in-frame-clip)">' && echo "$HAB" | grep -q '<image class="in-scene" href="/habitat/scene-lines.webp?v=1" x="0" y="0" width="1536" height="1024" preserveAspectRatio="none" aria-hidden="true"/>' \
  && ! echo "$HAB" | grep -q 'in-plain\|in-dome\|in-ink\|in-halo\|in-floor\|in-lamp\|inside\.svg\|ground\.jpg\|/habitat/rooms/\|in-glow\|in-lamp-light' \
  && echo "$HAB" | grep -q '<linearGradient id="in-sweep-light"' \
  && [ "$(echo "$HAB" | grep -o '<clipPath id="in-clip-[a-z]*"><rect x="[0-9]*" y="[0-9]*" width="[0-9]*" height="[0-9]*"/></clipPath>' | wc -l)" = "13" ] \
  && [ "$(echo "$HAB" | grep -o '<image class="in-pic" data-hex="[a-z]*" href="/habitat/modules/[a-z]*.webp?v=1" x="[0-9]*" y="[0-9]*" width="[0-9]*" height="[0-9]*" preserveAspectRatio="none"/>' | wc -l)" = "13" ] \
  && echo "$HAB" | grep -q '<image class="in-pic" data-hex="lounge" href="/habitat/modules/lounge.webp?v=1" x="578" y="493" width="335" height="187" preserveAspectRatio="none"/>' \
  && echo "$HAB" | grep -q '<image class="in-pic" data-hex="kitchen" href="/habitat/modules/kitchen.webp?v=1" x="211" y="493" width="278" height="177" preserveAspectRatio="none"/>' \
  && echo "$HAB" | grep -q '<image class="in-pic" data-hex="cycle" href="/habitat/modules/cycle.webp?v=1" x="904" y="680" width="191" height="155" preserveAspectRatio="none"/>' \
  && echo "$HAB" | grep -q '<image class="in-pic" data-hex="hydroponics" href="/habitat/modules/hydroponics.webp?v=1" x="270" y="346" width="325" height="147" preserveAspectRatio="none"/>' \
  && [ "$(echo "$HAB" | tr -d '\n' | grep -o '<image class="in-scene".*<g class="in-pics" aria-hidden="true">.*<g class="in-sweeps" aria-hidden="true">.*</g>          </g>' | wc -l)" = "1" ] \
  && [ "$(echo "$HAB" | grep -o '<g clip-path="url(#in-clip-[a-z]*)"><rect class="in-sweep" data-hex="[a-z]*" x="[-0-9]*" y="[-0-9]*" width="[0-9]*" height="[0-9]*"/></g>' | wc -l)" = "13" ] \
  && [ "$(echo "$HAB" | grep -o '<rect class="in-room" data-hex="[a-z]*" x="[0-9]*" y="[0-9]*" width="[0-9]*" height="[0-9]*" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="dome-[a-z]*"><title>[A-Za-z ()-]*</title></rect>' | wc -l)" = "12" ] \
  && echo "$HAB" | grep -q '<rect class="in-room" data-hex="lockers" x="46" y="666" width="149" height="164" role="button" tabindex="0"><title>Equipment Lockers</title></rect>' \
  && echo "$HAB" | grep -q '<rect class="in-room" data-hex="lounge" x="578" y="493" width="335" height="187" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="dome-lounge"><title>Crew</title></rect>' \
  && [ "$(echo "$HAB" | grep -o '<g class="dome-tag in-tag" data-hex="[a-z]*" data-x="[-0-9]*" data-y="[-0-9]*" aria-hidden="true">' | wc -l)" = "13" ] \
  && echo "$HAB" | grep -q '<g class="dome-tag in-tag" data-hex="lounge" data-x="746" data-y="680" aria-hidden="true">' \
  && [ "$(echo "$HAB" | grep -o '<g class="dome-hex in-key" data-hex="[a-z]*" data-at="[-0-9,]*" data-desk="[-0-9,]*" transform="translate([-0-9. ]*) scale(1.15)" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="dome-[a-z]*">' | wc -l)" = "2" ] \
  && echo "$HAB" | grep -q 'data-hex="dashboard" data-at="626,940" data-desk="626,906" transform="translate(626 906) scale(1.15)"' && echo "$HAB" | grep -q 'data-hex="eva" data-at="912,940" data-desk="912,906"' \
  && [ "$(echo "$HAB" | grep -o '<circle class="dome-pod" r="42"/>' | wc -l)" = "2" ] && [ "$(echo "$HAB" | grep -o '<circle class="dome-pod" r="27"/>' | wc -l)" = "14" ] \
  && ( for n in hydroponics comms science airlock kitchen storage lounge quarters health recycling cycle power dashboard eva; do echo "$HAB" | grep -q "<dialog class=\"popup dome-popup\" id=\"dome-$n\" aria-labelledby=\"dome-$n-title\">" || exit 1; done ) \
  && ! echo "$HAB" | grep -q 'id="dome-lockers"' \
  && ( for f in aeroponics comms mission sensors eva kitchen recycling crew health generator power dashboard; do echo "$HAB" | grep -q "data-field=\"$f-text\"" || exit 1; done ) && ! echo "$HAB" | grep -q 'data-field="nap-text"' \
  && echo "$HAB" | grep -q '<span class="fold-title" id="dome-comms-title">Communication</span>' && echo "$HAB" | grep -q '<span class="fold-title" id="dome-lounge-title">Crew</span>' && echo "$HAB" | grep -q '<span class="fold-title" id="dome-cycle-title">Cycle (Power Generation)</span>' && echo "$HAB" | grep -q '<span class="fold-title" id="dome-recycling-title">Water Recycling</span>' && echo "$HAB" | grep -q '<span class="fold-title" id="dome-hydroponics-title">More-than-Human</span>' \
  && echo "$HAB" | grep -q '<span class="fold-title" id="dome-science-title">Science Mission</span>' && echo "$HAB" | grep -q '<span class="fold-title" id="dome-quarters-title">Living Quarters</span>' && echo "$HAB" | grep -q '<span class="fold-title" id="dome-power-title">Electricity</span>' && echo "$HAB" | grep -q '<span class="fold-title" id="dome-eva-title">Going Outside</span>' && echo "$HAB" | grep -q '<span class="fold-title" id="dome-airlock-title">Airlock</span>' \
  && echo "$HAB" | grep -q 'The crew is reachable by online message through this ground station website, by postcard and by direct communication each day at 19:00. All messages written here are also literally sent into space!' \
  && echo "$HAB" | grep -q 'Each of our days has a specific research mission, centered around one of the five topics MARS! is composed of' && echo "$HAB" | grep -q 'Sensors: everything is tracked inside the Red Dust City Habitat — CO₂, temperature, humidity, food rations, crew happiness.' \
  && echo "$HAB" | grep -q 'The habitat’s other astronauts: live crickets performing as our alternate protein source' && echo "$HAB" | grep -q 'Going outside on Mars requires space suits and passing through an air lock.' \
  && echo "$HAB" | grep -q 'Three astronauts from ZKM — Commander/Comms, Health Officer, and Science Officer — have volunteered' && echo "$HAB" | grep -q 'Each day has a strict schedule the astronauts adhere to and the Habitat is divided into specific zones' \
  && echo "$HAB" | grep -q 'When every liter of water has to be carried up by space rocket' && echo "$HAB" | grep -q 'We measure our energy expenditure: how much comes in, how much goes out' \
  && echo "$HAB" | grep -q 'Everything was carried in and nothing is resupplied' && echo "$HAB" | grep -q 'A bicycle generator: pedalling charges the battery' \
  && ! echo "$HAB" | grep -q 'The uplink: every message written here\|The science bench\|Three shelves of plants grown without soil\|Nothing is thrown away. Used water\|Two sleeping pods, each a bunk\|The round room under the crown\|the bicycle generator charges the one battery\|An environment sensor inside the habitat reads' \
  && [ "$(echo "$HAB" | tr -d '\n' | grep -o '<dialog class="popup dome-popup" id="dome-comms".*' | grep -o '<div class="popup-body">.*' | sed 's/<\/dialog>.*//' | grep -o '<p>The crew is reachable.*<p class="dome-now">' | wc -l)" = "1" ] \
  && echo "$HAB" | grep -q '<a class="btn" href="/dashboard#mission" data-close>Open the Mission Dashboard →</a>' && echo "$HAB" | grep -q '<a class="btn" href="/media" data-close>Open the Media Gallery →</a>' && echo "$HAB" | grep -q '<a class="btn" href="/dashboard#schedule" data-close>Open the Daily Schedule →</a>' \
  && echo "$HAB" | grep -q '<a class="btn" href="/dashboard#mission-today" data-close>' && echo "$HAB" | grep -q '<a class="btn" href="/dashboard#stores" data-close>' && echo "$HAB" | grep -q '<a class="btn" href="/dashboard#power" data-close>' && echo "$HAB" | grep -q '<a class="btn" href="/dashboard#galley" data-close>' && echo "$HAB" | grep -q '<a class="btn" href="/dashboard#crew" data-close>' \
  && echo "$DASH" | grep -q '<div class="hbt" id="sensors">' && echo "$DASH" | grep -q '<section class="tile t-res" id="stores">' && echo "$DASH" | grep -q '<section class="tile t-pwr" id="power">' \
  && grep -q "var DASH = /^\\\\/?#(mission|mission-today|habitat|sensors|stores|power|hardware|trends|schedule|galley|crew|blog-commander|blog-health|blog-science)\$/;" public/tabbar.js && grep -q "var page = el && el.closest ? el.closest('.fpage\[data-folder\]') : null;" public/folder.js \
  && echo "$HAB" | grep -q "var root = document.getElementById('habitat-dome'); if (!root) return;" && echo "$HAB" | grep -q "fetch('/api/dome', { cache: 'no-store' })" && echo "$HAB" | grep -q "setInterval(refresh, 20000);" \
  && echo "$HAB" | grep -q "var hover = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);" && echo "$HAB" | grep -q "d.classList.add('is-hover'); d.setAttribute('open', '');" && echo "$HAB" | grep -q "function put(d, left, top) {" \
  && echo "$HAB" | grep -q "if (!dialogOf(id)) { over = null; clearTimeout(enterT); clearTimeout(leaveT);" && echo "$HAB" | grep -q "else if (h > room) d.style.maxHeight = room + 'px';" \
  && echo "$HAB" | grep -q "var h = Math.max(foot - SKY_MIN, Math.round(BASE\[2\] / ar)); v = \[BASE\[0\], foot - h, BASE\[2\], h\];" && echo "$HAB" | grep -q "var BASE = \[0, 0, 1536, 1024\], SKY_MIN = 120;" \
  && ! echo "$LAND" | grep -q 'id="cutaway"\|class="cut-svg"\|src="/cutaway.js\|cutaway-lines.webp\|class="cut-chips"\|data-at="[-0-9.,]*" transform="translate([-0-9. ]*) scale' \
  && ok "the habitat, a section of the About page before Who we are, under the page's head with the hint for its line, the line AI generated image under the picture: the cutaway picture handed over — the dome on the Mars plain in its lines (public/habitat/scene-lines.webp, the whole picture in a frame with rounded corners), its thirteen modules as keys, each its box from the line-art file's layer and its name the layer's, each with its cut-out of the coloured picture (public/habitat/modules/<id>.webp) and a sweep for when it is lit, a tag at its floor line — twelve with a pop-up (the lockers light up and are named, and open nothing), their sentences the station's and their words the ones the keys carried before — and EVA and the Dashboard as round keys on the ground in front of the habitat; a phone's pop-up under the picture when there is no room over it" || bad "the habitat is not drawn as it should be (inside.js)"
[ "$(curl -s -o /dev/null -w '%{content_type}' $B/habitat/scene-lines.webp)" = "image/webp" ] && [ "$(curl -s -o /dev/null -w '%{size_download}' $B/habitat/scene-lines.webp)" -gt 150000 ] \
  && [ "$(for m in $MODS; do curl -s -o /dev/null -w '%{http_code} %{content_type}\n' $B/habitat/modules/$m.webp; done | sort -u)" = "200 image/webp" ] \
  && python3 -c '
import struct, sys
def size(p):
    d = open(p, "rb").read(40)
    if d[12:16] == b"VP8 ": return struct.unpack("<HH", d[26:30])[0] & 0x3fff, struct.unpack("<HH", d[26:30])[1] & 0x3fff
    if d[12:16] == b"VP8X": return 1 + int.from_bytes(d[24:27], "little"), 1 + int.from_bytes(d[27:30], "little")
    if d[12:16] == b"VP8L": b = int.from_bytes(d[21:25], "little"); return (b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1
    return (0, 0)
ok = size("public/habitat/scene-lines.webp") == (1536, 1024) and size("public/habitat/modules/lounge.webp") == (670, 374) and size("public/habitat/modules/kitchen.webp") == (556, 354) and size("public/habitat/modules/cycle.webp") == (382, 310)
sys.exit(0 if ok else 1)' \
  && ok "the picture is served as WebP — the whole scene at the line-art file's own 1536 × 1024, each module's cut-out at twice its box, for sharpness" || bad "public/habitat/scene-lines.webp or the modules' cut-outs are not as they should be"
curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<h2 class="bigsec" id="inside-title">Was ist im Habitat?</h2>' && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<span class="dome-hint-tap">Tippe auf einen Raum, um zu erfahren, was drinnen ist.</span>' \
  && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<div class="dome-title"><h2>Qu’y a-t-il dans l’habitat ?</h2></div>' && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<span class="dome-hint-click">Pointez une pièce pour savoir ce qu’il y a à l’intérieur.</span>' \
  && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<title>Küche</title>' && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<title>Luftschleuse</title>' && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<title>Fahrrad (Stromerzeugung)</title>' && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q '<title>Wohnquartier</title>' \
  && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<title>Équipage</title>' && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<title>Recyclage de l’eau</title>' && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<span class="fold-title" id="dome-health-title">Station de santé</span>' && curl -s -H "Cookie: mcs_lang=fr" $B/about | grep -q '<title>Sortir dehors</title>' \
  && curl -s -H "Cookie: mcs_lang=de" $B/about | grep -q 'aria-label="Das Habitat im Schnitt: seine Räume unter der Kuppel, auf der Marsebene"' \
  && ok "in German and French as well — the page's name, the hint, the modules' names (the layer names, translated) and the drawing's name" || bad "the habitat's page is not translated"
curl -s $B/api/dome | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const f = JSON.parse(s); process.exit(["kitchen", "nap", "health", "generator", "sensors"].every((k) => f[k] && typeof f[k].text === "string" && f[k].text.length) ? 0 : 1); });' \
  && ok "/api/dome carries the sentences of every module — the kitchen's, the pods', the health station's, the generator's, the sensors' (dome.js figures)" || bad "/api/dome lost a room"
grep -q 'body.landing .hab-card { position: relative; z-index: 2; padding: 0; margin: 0; background: none; border: 0; box-shadow: none; color: var(--ink); }' public/sheet.css && grep -q 'body.landing .hab-card .dome-panel, :root\[data-theme="dark"\] body.landing .hab-card .dome-panel { --room: 18px; flex: none; margin: 0; padding: 0; background: none; }' public/sheet.css \
  && grep -q 'body.landing .hab-card .dome-head { display: none; }' public/sheet.css \
  && grep -q '@media (hover: none) { body.landing .dome-hint-click { display: none; } body.landing .dome-hint-tap { display: inline; } }' public/sheet.css \
  && grep -q 'body.landing .hab-card .dome-screen { padding: 0; display: grid; grid-template-columns: minmax(0, 1fr) clamp(300px, 30%, 400px); column-gap: 28px; align-items: stretch; }' public/sheet.css \
  && grep -q 'body.landing .hab-card .dome-stage { flex: none; width: 100%; max-width: none; height: auto; aspect-ratio: 1536 / 1024; min-height: 0; max-height: none; margin: 0; }' public/sheet.css \
  && ! grep -q 'sheet-p3' public/sheet.css \
  && grep -q 'body.landing .hab-card .dome-caption { display: none; }' public/sheet.css && ! grep -q 'body.landing .hab-card .dome-caption::before' public/sheet.css \
  && grep -q 'body.landing .hab-card .in-credit { margin: 16px 0 0; font-family: var(--display); font-size: var(--fs-label); letter-spacing: .1em; text-transform: uppercase; color: var(--dim); }' public/sheet.css \
  && grep -q "var ar = sr.width / sr.height, foot = BASE\[1\] + BASE\[3\];" src/views/pages/inside.js && grep -q "const DESK_KEY = 1.15, PHONE_KEY = 1.9;" src/views/pages/inside.js \
  && grep -q 'body.landing .is-inside .in-aside { position: relative; align-self: stretch; display: flex; flex-direction: column; justify-content: center;' public/sheet.css && grep -q 'body.landing .is-inside.has-popup .in-aside { opacity: 0; pointer-events: none; }' public/sheet.css \
  && ! grep -q 'in-aside .dome-legend' public/sheet.css \
  && grep -q '  body.landing .is-inside .in-aside { display: none; }' public/sheet.css \
  && [ "$(echo "$HAB" | tr -d '\n' | grep -o '<aside class="in-aside">.*</aside>' | grep -o '<button type="button" class="chip"' | wc -l)" = "0" ] && ! echo "$HAB" | grep -q 'class="dome-legend"' \
  && echo "$HAB" | grep -q '<p class="in-aside-hint"><span class="dome-meta dome-hint"><span class="dome-hint-click">Point at a room to know what is inside.</span>' \
  && grep -q "function column(d) {" src/views/pages/inside.js && grep -q "if (column(d)) return;" src/views/pages/inside.js && grep -q "root.classList.add('has-popup');" src/views/pages/inside.js \
  && grep -q '  body.landing .hab-card .dome-screen { display: block; padding-top: 0; }' public/sheet.css \
  && grep -q 'body.landing .dome-panel.is-inside { --in-lamp: #ffd27a; --in-tag-ink: #0f1540; }' public/sheet.css \
  && grep -q 'body.landing .is-inside .in-scene { pointer-events: none; }' public/sheet.css \
  && ! grep -q '\.in-ink\|\.in-floor\|\.in-lamp\|\.in-halo\|\.in-plain\|\.in-dome\|in-breathe' public/sheet.css \
  && grep -q 'body.landing .is-inside .in-pic { opacity: 0; pointer-events: none; transition: opacity .22s ease-out; }' public/sheet.css && grep -q 'body.landing .is-inside .in-pic.lit { opacity: 1; transition: opacity .12s ease-out; }' public/sheet.css \
  && grep -q 'body.landing .is-inside .in-sweep.lit { animation: in-sweep 1.1s cubic-bezier(.4,.4,.3,1) 1 both; }' public/sheet.css && grep -q '@keyframes in-sweep' public/sheet.css \
  && grep -q 'body.landing .is-inside .in-room { fill: transparent; stroke: none; cursor: pointer; outline: none; pointer-events: all; }' public/sheet.css \
  && grep -q 'body.landing .is-inside .in-part .in-tag { opacity: 0; pointer-events: none; transition: opacity .2s ease-out; }' public/sheet.css && grep -q 'body.landing .is-inside .in-part .in-tag.lit { opacity: 1; pointer-events: all; }' public/sheet.css \
  && grep -q 'body.landing .is-inside dialog.dome-popup.is-hover\[open\] { z-index: 35; animation: in-pop .22s ease-out both; }' public/sheet.css \
  && grep -q '  body.landing .is-inside .dome-screen { display: block; margin: 0; }' public/sheet.css && grep -q 'body.landing .is-inside .dome-stage { width: 100%; height: auto; aspect-ratio: 1536 / 1024; max-height: min(calc(100vh - 160px), 74cqw); }' public/sheet.css && grep -q 'body.landing .is-inside .dome-svg.inside-svg { overflow: hidden; }' public/sheet.css \
  && grep -q '  body.landing .is-inside .in-tag { display: none; }' public/sheet.css \
  && ! grep -q 'cut-card\|cut-svg\|cut-panel' public/sheet.css && ! grep -q 'cut-panel' public/sky.js \
  && ok "the habitat's styles: a section of the About page, the picture at its own shape beside the column, with rounded corners, a module in colour while it is lit — its cut-out coming in over its lines, the band sweeping across it, its name on a tag at its floor line (unseen otherwise) — the hand's pop-up in the column at the right; on a phone the picture edge to edge at its own shape, the names off it" || bad "the habitat's styles are not as they should be (sheet.css)"
# the index of folders: the first track and its first key named Sensors (the panel too), the day's track Daily Life (public.js, dashboard); Today's Mission in larger type (sheet.css)
echo "$DASH" | grep -q '<h3>Sensors</h3>' && echo "$DASH" | grep -q 'class="frow-k" aria-hidden="true">Sensors<' && echo "$DASH" | grep -q 'data-group="0" aria-pressed="true">Sensors<' && echo "$DASH" | grep -q 'data-group="1" aria-pressed="false">Daily Life<' \
  && echo "$DASH" | grep -q '<div class="frail">' && echo "$DASH" | grep -q '<div class="folder-head"><h2 class="folder-title">Mission dashboard</h2></div>' && curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q '<h2 class="folder-title">Missions-Dashboard</h2>' \
  && echo "$DASH" | grep -q 'class="frow-k" aria-hidden="true">Daily Life<' && ! echo "$DASH" | grep -q 'class="frow-k" aria-hidden="true">Today<\|class="frow-k" aria-hidden="true">Habitat<' \
  && curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q 'class="frow-k" aria-hidden="true">Alltag<' && curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q 'class="frow-k" aria-hidden="true">Sensoren<' \
  && grep -q 'body.landing .mission-title { font-size: clamp(32px, 3.1vw, 46px); }' public/sheet.css && grep -q 'body.landing .mission-part p, body.landing .mission-part li { font-size: 18px; line-height: 1.5; }' public/sheet.css \
  && ok "the dashboard's index names the habitat's track and panel Sensors and the day's track Daily Life (Alltag), and Today's Mission is set in larger type" || bad "the index's names or the mission's type are not as they should be"
# the index as a rail on a wider screen (aura.css, the index of folders): the folder a grid of the rail and the panel, the
# tracks one under the other with their keys stacked, the rail sticky under the header, the folder clipping with overflow: clip
# so the rail can stick; a key's name wraps; the schedule's two columns only over 1100px; a phone keeps its rows
PHONESHEETA=$(awk '/^@media \(max-width: 760px\) and \(min-height: 521px\) \{$/,/^}/' public/aura.css)
grep -q 'body.landing .folder { display: grid; grid-template-columns: 236px minmax(0, 1fr); align-items: stretch; overflow: clip; }' public/aura.css \
  && grep -q 'body.landing .folder-tabs { display: block; min-width: 0; padding: 18px 14px 20px; border-bottom: 0; border-right: 1px solid var(--hair); }' public/aura.css \
  && grep -q '  body.landing .frows { display: grid; gap: 10px; }' public/aura.css \
  && grep -q 'body.landing .frow, body.landing .frow.n2, body.landing .frow.n1 { grid-template-columns: minmax(0, 1fr); gap: 2px; padding: 6px; border-radius: 16px; }' public/aura.css \
  && grep -q 'body.landing .ftab .ftab-l { white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.2; }' public/aura.css \
  && grep -q 'body.landing .folder { grid-template-columns: 208px minmax(0, 1fr); }' public/aura.css \
  && [ "$(awk '/^@media \(min-width: 1101px\) \{/,/^}/' public/aura.css | grep -c 'body.landing .folder-body #schedule .rows { columns: 2; column-gap: 56px; }')" = "1" ] \
  && echo "$PHONESHEETA" | grep -q 'body.landing .folder-tabs { position: sticky; top: 83px; z-index: 5; display: block; padding: 8px 8px 0;' && echo "$PHONESHEETA" | grep -q 'body.landing .fgroups { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));' \
  && echo "$PHONESHEETA" | grep -q 'body.landing .frows { display: block; }' && echo "$PHONESHEETA" | grep -q 'body.landing .frow { display: none; }' && echo "$PHONESHEETA" | grep -q 'body.landing .frow.is-cur { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));' \
  && echo "$PHONESHEETA" | grep -q 'body.landing .folder-head { display: none; }' \
  && grep -q '  body.landing .frail { position: sticky; top: 124px; display: grid; gap: 12px; }' public/aura.css && grep -q '  body.landing .folder-title { margin: 0; font-family: var(--display); font-size: 19px;' public/aura.css \
  && grep -q '  body.landing .folder > .folder-body { min-height: calc(100vh - 150px); }' public/aura.css \
  && grep -q "if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;" public/folder.js && ! grep -q "function show()" public/folder.js \
  && ok "the index is a rail of keys at the left of the folder on a wider screen — Mission dashboard over it, the tracks one under the other, sticky under the header, the panel beside it, the box a page tall at the least; the schedule's two columns over 1100px; a phone keeps its segmented control of the three tracks and the row of tabs under it, stuck under the top bar" || bad "the index is not a rail as it should be"
# the key under Today's Mission to the Science Blog (public.js, missionPanel), on the landing page and the dashboard page, not on the mission screen
echo "$DASH" | grep -q '<a class="glance-link mission-blog" href="#blog-science" title="Daily Mission Report">' && echo "$DASH" | grep -q '<span class="glance-link-title">Mission Report</span>' \
  && curl -s $B/dashboard | grep -q '<a class="glance-link mission-blog" href="#blog-science"' && curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q '<span class="glance-link-title">Missionsbericht</span>' \
  && grep -q 'body.screen .mission-blog { display: none; }' public/screen.css && grep -q 'body.landing .mission-blog { flex: none; align-self: flex-end; }' public/aura.css \
  && ok "under Today's Mission a key, Mission Report, leads to the science blog — in the doors' dress, at the foot of the mission, in German too; hidden on the mission screen" || bad "the key to the Science Blog is missing"
# no call on the Earth any more (Send a message to space is gone, landing.js); the line starts at the habitat's front foot
! echo "$LAND" | grep -q 'space-call\|Send a message to space' && ! grep -q 'space-call\|--call-h' public/sheet.css && ! grep -q 'Send a message to space' src/lib/i18n.js \
  && grep -q 'top: calc(var(--dome-top) + var(--dome-w) \* 0.676); bottom: calc(var(--earth-arc) - 6px);' public/sheet.css \
  && ok "no call under the habitat on the first page; the line to the Earth starts at the habitat's front foot" || bad "the call on the Earth is still there, or the line does not start at the habitat's foot"
# the first page's words at the left of the room on a desk and over it on a phone (October: "shift the Earth–habitat visual
# to the right and have this on the left"): the eyebrow ZKM | Hertzlab • Durational performance, MARS!platz with Ground
# Station under it, the paragraph on what the site is for (the note's, moved up; Karlsruhe Marktplatz), the run — drawn
# once (landing.js, intro); the note keeps its lead alone
echo "$LAND" | grep -q '<div class="sheet-intro">' && ! echo "$LAND" | grep -q 'sheet-intro is-desk\|sheet-intro is-phone\|class="tagline"\|class="note-more"\|class="note-aside"' \
  && echo "$LAND" | tr -d '\n' | grep -q '<div class="sheet-intro"> *<p class="intro-eyebrow">ZKM | Hertzlab <span class="intro-dot" aria-hidden="true">•</span> Durational performance</p> *<h1 class="wordmark">MARS<span class="bang">!</span>platz<span class="wm-sep"> : </span><span class="wm-ground">Ground Station</span></h1> *<p class="intro-text">MARS! turns the Karlsruhe Marktplatz into MARS!platz. Can we go to Mars to save the Earth? Three astronauts are finding out, and you can help! Write them a message, have a look on the mission dashboard to find out if their food supply is running low or see what they’re currently researching.</p> *<p class="run-dates"><b>' \
  && [ "$(echo "$LAND" | grep -c 'class="wordmark"')" = "1" ] \
  && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '<span class="wm-ground">Bodenstation</span>' && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q 'Durational performance\|Langzeitperformance</p>' && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '<p class="intro-text">MARS! macht den Karlsruher Marktplatz zum MARS!platz.' \
  && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q '<p class="intro-text">MARS! transforme la Marktplatz de Karlsruhe en MARS!platz.' && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q 'Performance de longue durée</p>' \
  && grep -q '  body.landing .space { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); grid-template-rows: minmax(0, 1fr); column-gap: clamp(32px, 4vw, 72px); align-items: stretch;' public/sheet.css \
  && grep -q '  body.landing .sheet-intro { align-self: center; display: flex; flex-direction: column; align-items: stretch; gap: 0; padding: 12px 0 24px; }' public/sheet.css \
  && grep -q 'body.landing .sheet-intro .intro-eyebrow { margin: 0 0 16px; font-family: var(--display); font-size: var(--fs-label); font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--mars-ink); }' public/sheet.css \
  && grep -q 'body.landing .sheet-intro .wordmark .wm-sep { display: none; }' public/sheet.css && grep -q 'body.landing .sheet-intro .wordmark .wm-ground { display: block; margin-top: 8px; font-size: .5em; line-height: 1.1; font-weight: 500;' public/sheet.css \
  && grep -q 'body.landing .sheet-intro .intro-text { margin: 22px 0 0; max-width: 46ch; font-size: 17px; line-height: 1.55; color: var(--ink); text-wrap: pretty; }' public/sheet.css \
  && grep -q '  body.landing .space { margin: 0 calc(-1 \* var(--gutter)); height: auto; }' public/sheet.css && grep -q '  body.landing .sheet-intro { padding: 22px var(--gutter) 24px; }' public/sheet.css \
  && grep -q '  body.landing .space-room { flex: none; height: max(440px, calc(100vh - 149px)); height: max(440px, calc(100svh - 149px - env(safe-area-inset-bottom, 0px)));' public/sheet.css \
  && grep -q '  body.landing:not(.inner) .space-room { scroll-snap-align: start; scroll-snap-stop: always; }' public/sheet.css && grep -q "var CAND = 'body.landing:not(.inner) :is(\[data-page\], .space-room, .call, .steps, .step, .foot)';" public/sky.js \
  && ! grep -q 'sheet-intro.is-phone\|sheet-intro.is-desk' public/sheet.css \
  && ok "the first page's words stand at the left of the room on a desk and over it on a phone (the room a stop of its own) — ZKM | Hertzlab • Durational performance, MARS!platz, Ground Station, the paragraph on what the site is for (Karlsruhe Marktplatz; in German and French too) and the run — drawn once; the note keeps its lead alone" || bad "the first page's words are not beside the room as they should be"
# the first page on a desk: as on a phone — the Earth in the middle of the foot, the habitat above it (small: a quarter of the
# window's height at most), the dashed line straight between them; the trajectory of the earlier desk layout stays in the
# markup and in sky.js, off (sheet.css shows the line, not the arc, on a desk)
echo "$LAND" | grep -q '<svg class="space-arc" id="space-arc" aria-hidden="true">' && grep -q "function trajectory() {" public/sky.js && grep -q "if (arcShown()) return { top: EDGE, bottom: H - EDGE };" public/sky.js \
  && grep -q 'body.landing .space-arc { display: none; position: absolute; inset: 0; z-index: 2;' public/sheet.css \
  && ! grep -q 'body.landing .space-arc { display: block; }' public/sheet.css && ! grep -q 'body.landing .space-line { display: none; }' public/sheet.css \
  && ! grep -q 'transform: rotate(27deg)' public/sheet.css && ! grep -q 'body.landing .space-dome { left: auto; right: 15%;' public/sheet.css \
  && grep -q '  body.landing .space-room { margin-top: 12px; min-height: 0; --dome-w: clamp(170px, 22vh, 250px); --dome-top: 10px; --earth-w: 118%; --earth-arc: clamp(100px, 14vh, 150px); }' public/sheet.css \
  && ok "on a desk the Earth is in the middle of the foot and the habitat above it, small — the dashed line straight between them, as on a phone; the arc of the earlier layout is off" || bad "the first page's desk layout is not the centred one"
# the first page: the Earth at its foot, the habitat far above, the line between them, and the sky in the room (landing.js, space)
echo "$LAND" | grep -q '<section class="sheet sheet-p0 space" id="top" aria-label="From Earth to the habitat" data-page>' \
  && echo "$LAND" | grep -q '<div class="space-dome" data-sky-solid aria-hidden="true">' && echo "$LAND" | grep -q '<img class="space-dome-img" src="/space/habitat.png" alt="" width="1004" height="699" decoding="async">' \
  && echo "$LAND" | grep -q '<i class="space-line" data-sky-solid aria-hidden="true"></i>' && echo "$LAND" | grep -q '<div class="space-earth" aria-hidden="true">' \
  && echo "$LAND" | grep -q '<img class="space-earth-img" src="/space/earth.jpg" alt="" width="1414" height="340" decoding="async">' \
  && echo "$LAND" | grep -q '<svg class="space-halo is-desk" viewBox="0 0 1414 340" aria-hidden="true"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-dasharray="0 1.2">' \
  && echo "$LAND" | grep -q '<svg class="space-halo is-phone" viewBox="0 0 1414 340" aria-hidden="true"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-dasharray="0 4.4">' \
  && [ "$(echo "$LAND" | grep -o '<circle cx="674" cy="1079" r="[0-9]*" pathLength="720" opacity="0\.[0-9]*"/>' | wc -l)" = "20" ] && echo "$LAND" | grep -q '<circle cx="674" cy="1079" r="1005" pathLength="720"' \
  && echo "$LAND" | grep -q '<i class="space-globe" data-sky-round data-r="0.52" style="left:-22.84%;top:24.12%;width:141.02%"></i>' \
  && echo "$LAND" | grep -q 'class="space-tag space-tag-dome" data-sky-solid>RED DUST CITY<' && ! echo "$LAND" | grep -q 'space-tag-earth' \
  && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q 'aria-label="Von der Erde zum Habitat"' \
  && [ "$(curl -s -o /dev/null -w '%{content_type}' $B/space/earth.jpg)" = "image/jpeg" ] && [ "$(curl -s -o /dev/null -w '%{content_type}' $B/space/habitat.png)" = "image/png" ] \
  && grep -q "body.landing .space-line { position: absolute; z-index: 2; left: 50%; width: 2px;" public/sheet.css && grep -q "@keyframes space-up" public/sheet.css && grep -q "@keyframes space-down" public/sheet.css \
  && grep -q "body.landing .space-earth { position: absolute; z-index: 1; left: 50%; bottom: 0; width: var(--earth-w); aspect-ratio: 1414 / 340;" public/sheet.css \
  && grep -q "transform: translate(-50%, calc(100% - var(--earth-arc) - 24.1%)); }" public/sheet.css && grep -q "bottom: calc(var(--earth-arc) - 6px);" public/sheet.css \
  && grep -q "body.landing .space-halo circle { vector-effect: non-scaling-stroke; stroke-width: 1.8px; }" public/sheet.css && grep -q "body.landing .space-halo.is-phone { display: none; }" public/sheet.css \
  && grep -q "body.landing .space .sky-part.is-crew { margin: 8px 0 0; padding: 0 0 0 10px; border: 0; border-left: 2px solid var(--hud-hot); background: none; max-width: 100%; }" public/sheet.css \
  && grep -q "body.landing .space .sky-pic img { filter: none; }" public/sheet.css \
  && ok "the first page: the habitat far above as its line drawing (public/space/habitat.png); a dashed line down onto the Earth's limb, a signal climbing it and an answer coming down; the Earth's limb from orbit at the foot (public/space/earth.jpg) with a mesh of dots from just over the limb up, a set for a desk and one for a phone; the exchanges in a minimal white frame, the answer under an orange rule, the pictures in white frames, in colour" || bad "the first page is not the way to the habitat"
echo "$LAND" | grep -q 'class="dome-foot"\|id="habitat-page"\|id="dome-seq"\|class="dome-panel has-sky' && bad "the habitat's sheet, sky or foot is on the landing page" || ok "the habitat stands on its card with no sheet under it, no sky over it and nothing at its foot: the landing page goes from the habitat to the slowest chat"
! echo "$LAND" | grep -Eq 'P0[0-9] / 04' && ! echo "$LAND" | grep -q 'Note 00' && ! echo "$LAND" | grep -q 'part-tag' && ! echo "$LAND" | grep -q 'Part 1 of 2\|Part 2 of 2' \
  && ! echo "$LAND" | grep -q 'id="story"' && ! echo "$LAND" | grep -q 'class="chapter' && ! echo "$LAND" | grep -q 'The mission</h2>' \
  && ! echo "$LAND" | grep -q '<div class="sheet-meta is-ruled"><span>Durational performance</span></div>' && ! echo "$LAND" | grep -q 'note-card\|note-lead\|note-project\|Mobilizing Awareness for Resilient Societies! – is a three-part project' \
  && ! grep -q 'note-card\|note-lead\|note-project' public/sheet.css && ! grep -q 'three-part project' src/lib/i18n.js \
  && echo "$LAND" | grep -q '<h2 class="part-title" id="ch-03-title">Welcome to the World’s Slowest Chat (that also zips into space!)</h2>' \
  && ok "no page numbers or part pills anywhere; the mission's chapters are gone, and so is the note's box — MARS! – Mobilizing Awareness…, with its DURATIONAL PERFORMANCE line (October asked for the box to go; the About page tells the project) — and the chat keeps its bold heading" || bad "a page label, a part pill or the mission chapters are still on the page"
[ "$(echo "$LAND" | grep -o ' data-page>' | wc -l)" = "3" ] && ok "the three pages are marked as the pages of a phone's scroll — the way to the habitat, the note with the two calls, the chat (the habitat is on the About page now)" || bad "the phone's pages are not marked"
! echo "$LAND" | grep -q 'masthead-btn' && ok "no Write or Mission doors on the first screen" || bad "the doors are still on the first screen"
echo "$LAND" | grep -q 'class="sheet-cta" href="#write"' && grep -q 'body.landing .p4-cta { display: none; }' public/sheet.css \
  && ok "the door at the foot of the slowest chat opens the composer's window (a phone's leads to the Write page's dock, tabbar.js)" || bad "the slowest chat's door is wrong"
PHONESHEET=$(awk '/^@media \(max-width: 760px\) and \(min-height: 521px\) \{/,/^}/' public/sheet.css)
! echo "$LAND" | grep -q 'section-scroll.js' && echo "$PHONESHEET" | grep -q 'html:has(body.landing:not(.inner)) { scroll-snap-type: y mandatory;' \
  && echo "$PHONESHEET" | grep -q 'body.landing:not(.inner) \[data-page\] { scroll-snap-align: start; scroll-snap-stop: always; }' \
  && [ "$(grep -c 'scroll-snap-type: y' public/sheet.css)" = "1" ] && grep -q "p.classList.add('is-tall')" public/sky.js && grep -q "window.addEventListener('wheel'" public/sky.js \
  && ok "a phone held upright goes a page a swipe (a page taller than the screen stops at its parts; a wheel turns one stop a turn); a desk scrolls freely" || bad "the phone's pages do not snap"
echo "$LAND" | grep -q 'id="dome-sky-data"' && echo "$LAND" | grep -q 'src="/sky.js' && ok "the sky is drawn into the first page's room and set going by public/sky.js" || bad "no sky on the first page"
echo "$LAND" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const r = s.indexOf("<div class=\"space-room\" id=\"space-room\">"), k = s.indexOf("id=\"dome-sky\""), e = s.indexOf("</section>", r);
  process.exit(r > -1 && k > r && e > k ? 0 : 1);
});' && ok "the sky is in the room, over the Earth, the habitat and the line" || bad "the sky is not in the first page's room"
grep -q "function spot(w, h)" public/sky.js && grep -q "function clash(a, b)" public/sky.js && grep -q "function inRound(a, c)" public/sky.js && grep -q "function lanes()" public/sky.js \
  && grep -q "querySelectorAll('\[data-sky-round\]')" public/sky.js && grep -q "querySelectorAll('\[data-sky-solid\]:not(.space-line)')" public/sky.js && ! grep -q "b.fading" public/sky.js \
  && grep -q "function band()" public/sky.js && grep -q "var NEAR = { phone: 6, desk: 44 };" public/sky.js && grep -q "for (y = bd.top; y + h <= bd.bottom; y += STEP)" public/sky.js \
  && grep -q "body.landing .sky-msg, body.landing .sky-pic { opacity: 0; animation: none !important; transition: opacity 1.2s ease-in-out; }" public/sheet.css \
  && ok "each line and snapshot comes somewhere else each time, close to the line on either side, between the habitat and the Earth, clear of one another — fading in and out; nothing is ever laid over anything else" || bad "the sky's items can crowd one another"
PUB=$(curl -s $B/api/board)
curl -s -b $V $B/ | PUB="$PUB" node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const m = s.match(/id="dome-sky-data">([^<]*)</); if (!m) process.exit(1);
  const sky = JSON.parse(m[1]), cards = JSON.parse(process.env.PUB).cards.replace(/\s+/g, " ");
  const q = sky.ex || [], a = q.filter((x) => x.reply);
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\x27/g, "&#39;");
  const onBoard = (t) => cards.includes(esc(t.replace(/…$/, "")).slice(0, 40));
  const off = q.filter((x) => !onBoard(x.text) || (x.reply && !onBoard(x.reply)));
  if (off.length) console.error("    not on the public board:", JSON.stringify(off));
  const named = /data-q="Question" data-a="Answer"/.test(s) && /data-at-once="2"/.test(s) && /data-exchanges="6"/.test(s) && /data-pictures="5"/.test(s);
  process.exit(q.length >= 1 && q.length <= 6 && a.length >= 1 && !off.length && named ? 0 : 1);
});' && ok "the sky carries the newest published exchanges as question-and-answer blocks (six at most, two at a time; five pictures, two at a time) — nothing the public board does not show" || bad "the sky shows something the board does not, or is not named"
! echo "$LAND" | grep -q 'id="hab-line"' && ! echo "$LAND" | grep -q 'Now in the habitat' && ! echo "$LAND" | grep -q 'press a part of the habitat' && ! echo "$LAND" | grep -q 'class="dome-meta-hint"' \
  && ok "nothing turns under the dome any more, and no hint stands under it (the one in the card's head is the page's)" || bad "the line under the dome, or a hint under it, is back"
# the sky's items are headed (October): LATEST MESSAGE: over an exchange, inside its panel over the question's plate;
# LATEST IMAGE is the snapshot's plate, the moment the picture was taken at the foot of its frame — the words come with the
# page in the visitor's language (sky.js), public/sky.js puts them on
echo "$LAND" | grep -q 'data-q="Question" data-a="Answer" data-latest-msg="Latest message:" data-latest-pic="Latest image">' \
  && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q 'data-latest-msg="Neueste Nachricht:" data-latest-pic="Neuestes Bild">' && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q 'data-latest-msg="Dernier message :" data-latest-pic="Dernière image">' \
  && grep -q "var HEAD = { msg: sky.getAttribute('data-latest-msg') || 'Latest message:', pic: sky.getAttribute('data-latest-pic') || 'Latest image' };" public/sky.js \
  && grep -q "var hd = document.createElement('span'); hd.className = 'sky-head'; hd.textContent = HEAD.msg; el.appendChild(hd);" public/sky.js \
  && grep -q "if (st) { var sp = document.createElement('span'); sp.className = 'sky-stamp'; sp.textContent = st; fr.appendChild(sp); }" public/sky.js \
  && grep -q "var s = document.createElement('span'); s.className = 'sky-when'; s.textContent = HEAD.pic; a.appendChild(s);" public/sky.js \
  && grep -q "var ph = Math.round((w - 2 \* PAD) / PIC_RATIO), h = ph + 2 \* PAD + PLATE;" public/sky.js \
  && grep -q 'body.landing .sky-head { display: flex; align-items: center; gap: 6px; margin: 0 0 7px;' public/sheet.css && grep -q 'body.landing .sky-stamp { position: absolute; right: 5px; bottom: 4px; z-index: 1;' public/sheet.css \
  && grep -q 'body.landing .sky-when::before, body.landing .sky-head::before { content: "";' public/sheet.css \
  && ok "the sky's exchanges are headed Latest message: and its snapshots Latest image, the picture's moment at the foot of its frame — in German and French too" || bad "the sky's items are not headed as they should be"
grep -c "fetch(" public/sky.js | grep -qx 1 && grep -q "data-field=\"comms-text\"" public/sky.js && grep -q "cloud-latest" public/sky.js && grep -q "MCS_SKY_NOW" public/sky.js \
  && ok "it asks the board again only when the dome says there is a new exchange, follows the Habitat panel's strip of pictures, and the line passes over what the sky shows" || bad "the sky polls on its own"
echo "$LAND" | grep -q 'For this simulation, the transmission takes <b>3 seconds</b>' && echo "$LAND" | grep -q 'animation-duration:3s' && echo "$LAND" | grep -q 'class="transit" aria-hidden="true" data-seconds="3"' && ok "the slowest chat gives the crossing as the station runs it (TRANSIT_SECONDS)" || bad "the crossing time is not the station's"
grep -q "document.documentElement.classList.add('transit-js')" public/sky.js && grep -q "html.transit-js body.landing .steps .transit-track i { animation: none !important; }" public/sheet.css \
  && ok "the signal's dot is moved by the page itself, so a phone set to less motion still sees it cross" || bad "the signal in transit can stand still on a phone"
echo "$LAND" | grep -Eq 'today it takes <b>[0-9]+ min</b>' && echo "$LAND" | grep -Eq 'class="transit-meta">[0-9]+ M km · [0-9]+ min<' && ! echo "$LAND" | grep -Eq '[0-9]+ min [0-9]{2} s' && ok "and today's distance and one-way light-time, in whole minutes" || bad "no live distance or light-time, or seconds are back"
echo "$LAND" | grep -q 'Also, at <b>19:00 CET</b>, the daily communication window opens where people on MARS!platz can communicate directly with the crew.' && ! echo "$LAND" | grep -q 'Berlin time' && ! echo "$LAND" | grep -q 'CEST' && echo "$LAND" | grep -q 'come to our daily Communication Hour at 19:00 CET to speak to us directly.' \
  && grep -q "const ZONE = 'CET';" src/views/pages/landing.js && grep -q "function zoneName() { return ZONE; }" src/views/pages/landing.js && grep -q "second: '2-digit' }) + ' CET'; }" src/views/control/index.js \
  && ok "the crew answer from 19:00, the venue's zone always named CET — never CEST — on every page and the desk" || bad "the communication window is not 19:00 CET, or CEST is still written somewhere"
echo "$LAND" | grep -q 'Communication window daily <b>19:00 CET</b>' && ok "and the running line says so" || bad "the running line does not name the window"
# the room by day: the night's (October: "the same image for day and night — the default night image"): the same Earth
# strip, the same stars and drawing, no day room in the stylesheet, nothing swapped when the theme turns
echo "$LAND" | grep -q '<img class="space-earth-img" src="/space/earth.jpg" alt="" width="1414" height="340" decoding="async">' && ! echo "$LAND" | grep -q 'earth-day.jpg\|is-night\|is-day\|data-src="/space' \
  && curl -s -H "Cookie: mcs_theme=light" $B/ | grep -q '<img class="space-earth-img" src="/space/earth.jpg" alt=""' && ! curl -s -H "Cookie: mcs_theme=light" $B/ | grep -q 'earth-day.jpg' \
  && ! grep -q 'data-theme="light"\] body.landing .space' public/sheet.css && ! grep -q 'space-earth-img.is-day\|space-earth-img.is-night\|space-earth-img { -webkit-mask-image' public/sheet.css \
  && ! grep -q 'space-earth-img\[data-src\]' public/switches.js && ! grep -q 'EARTH_DAY\|earth-day.jpg"' src/views/pages/landing.js \
  && grep -q "the first page's room, by day as by night" public/sheet.css \
  && ok "the first page's room is the night's by day too — the same Earth strip at its foot, the same stars and drawing, no day room, nothing swapped when the theme turns" || bad "the room by day is not the night's"
# the two calls, right after the room: Send a message to the crew (approved messages are sent into space) and Follow what the crew is doing — live
echo "$LAND" | grep -q '<div class="calls" id="calls">' && ! echo "$LAND" | grep -q 'sheet-calls' \
  && echo "$LAND" | grep -q '<a class="call call-write" href="#write">' && echo "$LAND" | grep -q '<a class="call call-live" href="/dashboard">' \
  && echo "$LAND" | grep -q '<h2 class="call-title">Send a message to the crew</h2>' && echo "$LAND" | grep -q '<p class="call-punch"><strong class="call-beam">Approved messages are beamed into space</strong></p>' && ! echo "$LAND" | grep -q 'call-galaxy' \
  && echo "$LAND" | grep -q '<p class="call-body">Mission control reads every message. The ones it approves are beamed into space by radio.</p>' && ! echo "$LAND" | grep -q 'on their way at the speed of light — and answered from the habitat during the communication window' \
  && echo "$LAND" | grep -q '<h2 class="call-title">Follow what the crew is doing — live</h2>' && ! echo "$LAND" | grep -q 'Thirteen sols, as they happen.' \
  && echo "$LAND" | grep -q '<span class="call-k">01 · Uplink</span>' && echo "$LAND" | grep -q '<span class="call-k">02 · Live feed <span class="call-livepill">' \
  && echo "$LAND" | grep -q '>WRITTEN</text>' && echo "$LAND" | grep -q '>APPROVED</text>' && echo "$LAND" | grep -q '>INTO SPACE</text>' && echo "$LAND" | grep -q '<span class="call-k">02 · Live feed <span class="call-livepill"><i aria-hidden="true"></i>LIVE</span></span>' \
  && echo "$LAND" | grep -q '<path id="call-way-path" d="M88 82 C 170 54, 320 42, 468 40"/>' && echo "$LAND" | grep -q '<circle class="call-sig" r="4"><animateMotion dur="4.2s" repeatCount="indefinite" calcMode="spline" keySplines=".3 0 .4 1" keyTimes="0;1"><mpath href="#call-way-path"/></animateMotion></circle>' \
  && [ "$(echo "$LAND" | grep -o '<svg class="call-art"' | wc -l)" = "1" ] && ! echo "$LAND" | grep -q 'call-officer\|call-ring\|call-trace\|call-mark' && echo "$LAND" | tr -d '\n' | grep -q '<a class="call call-live" href="/dashboard"> *<div class="call-text">' \
  && echo "$LAND" | grep -q '<path d="M57 64 Q 42 122 100 107" class="call-dish-cup"/>' && ! echo "$LAND" | grep -q 'call-hab-dome\|call-hab-ping\|url(#call-mars)' && echo "$LAND" | grep -q '<text x="468" y="60">INTO SPACE</text>' && [ "$(echo "$LAND" | grep -o '<g class="call-waves"><path d="[^"]*"/><path d="[^"]*"/><path d="[^"]*"/></g>' | wc -l)" = "1" ] \
  && ! echo "$LAND" | grep -q 'call-chips\|call-now\|call-fig' \
  && echo "$LAND" | grep -q '<span class="call-key is-write">Write to the crew <span aria-hidden="true">→</span></span>' && echo "$LAND" | grep -q '<span class="call-key is-dash">Live Mission Dashboard <span aria-hidden="true">→</span></span>' \
  && [ "$(echo "$LAND" | tr -d '\n' | grep -o 'id="space-room".*id="note".*id="calls".*id="slowest-chat' | wc -l)" = "1" ] \
  && echo "$LAND" | tr -d '\n' | grep -q 'id="note" aria-label="Write to the crew, or follow them" data-page> *<div class="page2 is-calls"> *<div class="calls" id="calls">' \
  && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q 'aria-label="Schreib der Crew oder folge ihr"' && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q 'aria-label="Écrivez à l’équipage, ou suivez-le"' \
  && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '<h2 class="call-title">Schick der Crew eine Nachricht</h2>' && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '<strong class="call-beam">Freigegebene Nachrichten werden ins All gefunkt</strong>' && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '>GESCHRIEBEN</text>' \
  && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q '<strong class="call-beam">Les messages approuvés sont émis dans l’espace</strong>' && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q '<h2 class="call-title">Suivez ce que fait l’équipage — en direct</h2>' \
  && grep -q "sentToSpace: g(\"SELECT COUNT(DISTINCT message_id) n FROM space_relay WHERE state = 'SENT'\")," src/lib/data.js && ! grep -q 'call-fig\|call-now' src/views/pages/landing.js \
  && grep -q 'body.landing .calls { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; align-items: stretch; margin: 14px 0 0; }' public/sheet.css && grep -q '  body.landing .page2 { max-width: 1120px; margin: 0 auto; }' public/sheet.css && grep -q '  body.landing .calls { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; max-width: none; margin: 0; }' public/sheet.css && ! grep -q '@media (max-width: 1100px) and (min-width: 761px)' public/sheet.css && grep -q '  body.landing .call-beam { font-size: 25px; }' public/sheet.css \
  && grep -q '  body.landing .call-sig { display: none; }' public/sheet.css && grep -q '  body.landing .call-beam { animation: none; }' public/sheet.css && ! grep -q 'call-write { --ink: #f5f5f7\|galaxy.jpg' public/sheet.css \
  && grep -q 'body.landing .call-text { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center; flex: 1 1 auto; }' public/sheet.css \
  && grep -q '  background: linear-gradient(100deg, #ffb27f 0%, #ff6a2e 32%, #ffd9c2 50%, #ff6a2e 68%, #ffb27f 100%); background-size: 240% 100%; background-position: 100% 0;' public/sheet.css && grep -q '@keyframes call-shimmer { 0%, 55% { background-position: 100% 0; } 85%, 100% { background-position: 0% 0; } }' public/sheet.css \
  && grep -q "var PART = 'body.landing:not(.inner) \[data-page\] :is(.call, .steps, .step)';" public/sky.js && grep -q '  body.landing:not(.inner) \[data-page\].is-tall .call { scroll-snap-align: start; }' public/sheet.css \
  && ok "the two calls stand on the second page alone — one under the other on a phone, side by side in the middle of the page on a desk (the note that stood at their left is gone) — in the theme's own colours — Send a message to the crew (APPROVED MESSAGES ARE BEAMED INTO SPACE in the gradient of Mars and light with its shimmer; the dish, its waves, the way with WRITTEN and APPROVED on it and INTO SPACE under its open end — no disc, no ping, nothing drawn there — the signal along it; the Write key) and Follow what the crew is doing — live (no drawing, a LIVE pill on its line; its sentence; no Thirteen sols line, no chips, no line of what the crew are doing, no count of messages sent into space; the dashboard's key) — each card the door, in the visitor's language, the station's name at their head on a phone where each door is a stop of the scroll, still where less motion is asked for" || bad "the two calls are not on the landing page as they should be"
curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q 'Willkommen im langsamsten Chat der Welt' && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q 'Bienvenue dans le chat le plus lent du monde' \
  && ok "in German and French as well" || bad "the slowest chat is not translated"
echo "$LAND" | grep -q '<span class="step-space">At the same time, your message will also travel into space. Click on the Message Board to see how far your message has gone. Keep it family friendly.</span>' \
  && echo "$LAND" | grep -q 'Have you checked your CO₂ sensors lately? They seem to be running dangerously high</div>' && echo "$LAND" | grep -q '<p>Your message from Earth will travel to Mars to reach the crew on MARS!platz, where it will be seen and answered accordingly.' \
  && echo "$LAND" | grep -q '<span class="step-who">Crew answer</span>Yes, CO₂ levels were elevated. We took countermeasures and sensors indicate we are back at normal parameters. Thanks for the heads up!</div>' \
  && echo "$LAND" | grep -q 'Messages will be answered during the day and can be viewed on the <a class="step-link" href="/write#exchanges">message board</a>.' && echo "$LAND" | grep -q '<p class="steps-how">How it works:</p>' \
  && echo "$LAND" | grep -q '<p class="intro-text">MARS! turns the Karlsruhe Marktplatz into MARS!platz. Can we go to Mars to save the Earth? Three astronauts are finding out, and you can help! Write them a message, have a look on the mission dashboard to find out if their food supply is running low or see what they’re currently researching.</p>' && ! echo "$LAND" | grep -q 'turns the Marktplatz into' \
  && ! echo "$LAND" | grep -q 'This website is your portal\|durational performance in which\|What does it smell like in there\|Lentils. Mostly lentils' \
  && curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q 'Gleichzeitig reist deine Nachricht auch ins All.' && curl -s -H "Cookie: mcs_lang=fr" $B/ | grep -q 'En même temps, votre message voyagera aussi dans l’espace.' \
  && grep -q 'body.landing .step-body .step-space { display: block; margin-top: 8px; }' public/sheet.css \
  && ok "October's text sheet on the landing page: the note says what MARS! is (the name a link to its page at ZKM) and what the site is for; the slowest chat welcomes the ground station's personnel (and zips into space), How it works:, the CO₂ example and its answer, the message board linked, the communication hour at 19:00 CET — in the three languages" || bad "the landing page's words are not October's text sheet's"
SKYCSS=$(awk '/the sky of the first page, and the world.s slowest chat/,0' public/aura.css)
grep -q '\.dome-sky, \.dome-seq, \.slow-chat { display: none; }' public/station.css && echo "$SKYCSS" | grep -q 'html.js body.landing .space-room .dome-sky { display: block; position: absolute; inset: 0; z-index: 2; overflow: hidden; pointer-events: none; }' \
  && ! grep -q 'dome-panel.has-sky' public/aura.css && ! grep -q 'dome-panel.has-sky' public/sheet.css \
  && ok "the sky is the whole of the first page's room, on a phone and on a desk alike; without the landing dress it is not drawn" || bad "the sky is not wired to the room"
echo "$LAND" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const f = s.indexOf("class=\"space-earth\""), n = s.indexOf("id=\"dome-nudge\""), e = s.indexOf("</section>", f);
  process.exit(f > -1 && n > f && e > n && /class="dome-nudge" id="dome-nudge" href="#note"/.test(s) && !s.includes("dome-caption\" aria-hidden=\"true\">press") ? 0 : 1);
});' && grep -q 'body.landing .space .dome-nudge { position: absolute; z-index: 3; left: 50%; bottom: 12px;' public/sheet.css \
  && grep -q "getElementById('dome-nudge')" public/sky.js && grep -q 'is-gone' public/sky.js \
  && ok "the nudge to scroll down stands on the Earth at the foot of the first page — a link to the next page, hidden by public/sky.js once the page is scrolled" || bad "the nudge is out of place"
grep -q 'stepHead(.up., .01.' src/views/pages/landing.js && [ "$(echo "$LAND" | grep -o 'class="step-ic"' | wc -l)" = "3" ] \
  && ok "the three steps carry their signs, each in its own colour" || bad "the steps have no signs"
! echo "$LAND" | grep -qi 'sealed\|do not leave\|isolation' && echo "$LAND" | grep -q 'Three astronauts are finding out, and you can help!' \
  && ! echo "$LAND" | grep -q 'a small outpost on a simulated Mars' && ! echo "$LAND" | grep -q 'Communicate with the crew.' \
  && ! echo "$LAND" | grep -q 'class="know-more' && ! curl -s -H "Cookie: mcs_lang=de" $B/ | grep -q '<span>Mehr erfahren</span>' \
  && ok "the note says three astronauts are finding out and you can help (never that they cannot leave), and carries no keys: the two calls under it are the page's doors" || bad "the note's words are wrong, or it still carries keys"
! echo "$LAND" | grep -q '<p class="note-cta note-doors">' && echo "$LAND" | grep -q '<a class="call call-write" href="#write">' && echo "$LAND" | grep -q '<a class="call call-live" href="/dashboard">' \
  && grep -q 'if (/^\\/?#write$/.test(href)) a.setAttribute' public/tabbar.js \
  && ok "no keys under the description: the two calls under the note are the doors — Write to the crew (the composer's window) and the dashboard page" || bad "the note still has its keys, or the calls are not the doors"
! echo "$LAND" | grep -q 'src="/mission/mission-0' && ok "no photographs on the landing page: the mission is told on the About page" || bad "the chapters' photographs are still on the landing page"
grep -q 'body.landing .folder-body .blogp .card .card-body, body.landing .folder-body .blogp .entry-post p { max-width: none; }' public/aura.css && grep -q 'body.landing .folder-body .blogp .entry-figure { width: fit-content; max-width: min(100%, 560px); }' public/aura.css \
  && grep -q 'body.landing .folder-body .blogp .entry-figure img, body.landing .folder-body .blogp .entry-figure video { width: auto; max-width: 100%; max-height: 380px; object-fit: contain; }' public/aura.css \
  && grep -q 'body.screen .screen-blogs .blogp .entry-post p { margin: 0 0 .8em; max-width: none; }' public/screen.css \
  && ok "a blog post on the dashboard spans the whole of its folder with its lines, its pictures no wider than 560px nor taller than 380px — and on the blogs screen the lines run on too" || bad "a blog post is still held to a narrow column, or its pictures run as wide as the folder"
grep -q 'body.landing, :root\[data-theme="light"\] body.landing { background: #fff; }' public/sheet.css && grep -q ':root\[data-theme="dark"\] body.landing { background: #000; }' public/sheet.css \
  && grep -q 'body.landing::before, body.landing::after { display: none; }' public/sheet.css && grep -q 'html:has(body.landing)::after, :root\[data-theme="dark"\]:has(body.landing)::after { display: none; }' public/sheet.css \
  && grep -q ':root\[data-theme="light"\] { --paper: #fff; }' public/sheet.css && grep -q ':root\[data-theme="dark"\] { --paper: #000; }' public/sheet.css \
  && grep -q 'body.landing .sky-text { padding: 0 12px; color: #fff;' public/sheet.css \
  && ok "the ground is plain — white by day, black by night: no grid, no stars, no lights behind the sections, no grain over the window (the last block of sheet.css); the sky's lines of talk in white" || bad "the ground is not plain"

echo "── the dashboard, alive: a LIVE mark beside its head, two instruments without a reading among the habitat's tiles, each on a row of its own, brackets and pulses on its panels; the day's mission typed on the installation's mission screen alone — decoration, the figures untouched"
DH=$(echo "$DASH" | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const a = s.indexOf("<header class=\"dash-head\""); process.stdout.write(a < 0 ? "" : s.slice(a, s.indexOf("</header>", a))); });')
[ -n "$DH" ] && echo "$DH" | grep -q '<div class="dash-live" aria-hidden="true"><span class="dl-live"><i></i>LIVE</span></div>' && ! echo "$DH" | grep -q 'dl-radar\|dl-globe\|dl-city\|dl-bars\|dl-trace\|dl-side' \
  && echo "$DH" | grep -q '<h2 class="bigsec">Mission dashboard</h2>' && echo "$DH" | grep -q '<p class="dash-sub">[^<]* · [0-9]* days</p>' && ! echo "$DH" | grep -q 'Europe/Berlin' \
  && echo "$DH" | grep -q '<span class="dash-fig-k">SOL</span><b>\(T−[0-9]*\|[0-9][0-9]\)<em>' && echo "$DH" | grep -q '<span class="dash-fig-k">Crew</span><b>[0-9]*</b><span class="dash-fig-s">officers</span>' \
  && ok "the dashboard's head: the title, the line under it without the zone (the mission, the run, the days — no Europe/Berlin), the sol and the crew as before, and at the right the LIVE mark alone, hidden from assistive technology — no drawing beside it" || bad "the dashboard's head is not as it should be"
VZ=$(echo "$DASH" | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const a = s.indexOf("<div class=\"bento\" id=\"hbt-bento\""); process.stdout.write(a < 0 ? "" : s.slice(a, s.indexOf("<div id=\"hbt-notes\">", a))); });')
[ -n "$VZ" ] && [ "$(echo "$VZ" | grep -o '<section class="tile t-viz t-viz-[a-z]*" aria-hidden="true"><span class="viz-k">[A-Za-z ]*</span>' | wc -l)" = "2" ] && ! echo "$DASH" | grep -q 't-viz-signal\|dl-signal\|dl-bars\|dl-trace\|viz-k">Signal' \
  && [ "$(echo "$VZ" | tr -d '\n' | grep -o '<div id="hbt-light"></div>        </section>        <section class="tile t-viz t-viz-radar" aria-hidden="true"><span class="viz-k">Astronauts tracked</span>' | wc -l)" = "1" ] \
  && [ "$(echo "$VZ" | tr -d '\n' | grep -o '<section class="tile t-viz t-viz-radar".*<div class="bento aux">' | grep -o 't-viz-' | wc -l)" = "1" ] \
  && [ "$(echo "$VZ" | tr -d '\n' | grep -o '<div class="bento aux">.*' | grep -o '<section class="tile t-res" id="stores">\|<section class="tile t-pwr" id="power">\|<section class="tile t-viz t-viz-city" aria-hidden="true"><span class="viz-k">Karlsruhe</span>' | tr '\n' ' ')" = '<section class="tile t-res" id="stores"> <section class="tile t-viz t-viz-city" aria-hidden="true"><span class="viz-k">Karlsruhe</span> <section class="tile t-pwr" id="power"> ' ] \
  && echo "$VZ" | grep -q '<svg class="dl-radar" viewBox="0 0 120 120">' && [ "$(echo "$VZ" | grep -o '<g class="dl-ticks">\(<line x1="[0-9]*\.[0-9][0-9]" y1="[0-9]*\.[0-9][0-9]" x2="[0-9]*\.[0-9][0-9]" y2="[0-9]*\.[0-9][0-9]"\( class="dl-tick-l"\)\?/>\)*</g>' | grep -o '<line' | wc -l)" = "48" ] \
  && echo "$VZ" | grep -q '<g class="dl-sweep"><path d="M60 60 L60 13 A47 47 0 0 1 93.2 26.8 Z" fill="url(#dl-sweep)"/><line x1="60" y1="60" x2="60" y2="13"/></g>' \
  && [ "$(echo "$VZ" | grep -o '<circle class="dl-astro" cx="[0-9.]*" cy="[0-9.]*" r="2.6"/>' | wc -l)" = "3" ] && ! echo "$VZ" | grep -q 'dl-blip' \
  && echo "$VZ" | grep -q '<svg class="dl-city" viewBox="0 0 160 160" style="--lx:-46.2px;--ly:26.9px">' && [ "$(echo "$VZ" | grep -o '<g class="dl-fan">\(<line[^>]*/>\)*</g>' | grep -o '<line' | wc -l)" = "32" ] \
  && echo "$VZ" | grep -q '<circle class="dl-ring dl-dash" cx="80" cy="80" r="15.5"/><circle class="dl-ring" cx="80" cy="80" r="31.0"/><circle class="dl-ring dl-dash" cx="80" cy="80" r="46.5"/><circle class="dl-ring" cx="80" cy="80" r="62.0"/>' && ! echo "$VZ" | grep -q '1 km\|2 km\|>N<' \
  && echo "$VZ" | grep -q '<g class="dl-fan-sweep"><path d="M80 80 L80 6 A74 74 0 0 1 108.3 11.6 Z" fill="url(#dl-fan-sweep)"/></g>' \
  && echo "$VZ" | grep -q '<line class="dl-link" x1="78.5" y1="94.9" x2="32.3" y2="121.8"/>' && echo "$VZ" | grep -q '<circle class="dl-link-sig" cx="78.5" cy="94.9" r="1.6"/>' \
  && echo "$VZ" | grep -q '<rect class="dl-schloss" x="77.5" y="77.5" width="5" height="5"/>' && echo "$VZ" | grep -q '<text class="dl-city-t dl-dim" x="86" y="82.5">Schloss</text>' \
  && echo "$VZ" | grep -q '<circle class="dl-rdc-ping" cx="78.5" cy="94.9" r="3.4"/>' && echo "$VZ" | grep -q '<circle class="dl-rdc" cx="78.5" cy="94.9" r="3.4"/>' && echo "$VZ" | grep -q '<text class="dl-city-t dl-hot" x="85.5" y="95.9">Red Dust City</text>' && echo "$VZ" | grep -q '<text class="dl-city-t dl-dim" x="85.5" y="104.9">Marktplatz</text>' \
  && echo "$VZ" | grep -q '<rect class="dl-gs" x="29.3" y="118.8" width="6" height="6" transform="rotate(45 32.3 121.8)"/>' && echo "$VZ" | grep -q '<text class="dl-city-t dl-cool" x="39.3" y="122.8">Ground station</text>' && echo "$VZ" | grep -q '<text class="dl-city-t dl-dim" x="39.3" y="131.8">ZKM</text>' \
  && ! echo "$VZ" | grep -q 'dl-globe\|dl-orbit\|dl-sat\|dl-mer' \
  && [ "$(echo "$VZ" | node -e 'let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => { const t = (id) => { const a = s.indexOf("<section class=\"tile t-viz t-viz-" + id); return s.slice(a, s.indexOf("</section>", a)).replace(/<[^>]*>/g, "").replace(/\s+/g, ""); }; process.stdout.write(t("radar") + "+" + t("city")); });')" = "Astronautstracked+KarlsruheSchlossRedDustCityMarktplatzGroundstationZKM" ] \
  && ok "two instruments without a reading among the habitat's tiles, hidden from assistive technology and never side by side — Astronauts tracked after the light tile at the end of the sensors' third row (a radar: 48 ticks, four rings, the sweep's wedge and line, and one dot an astronaut, three for the crew of three), Karlsruhe between the stores and the power (the city as its fan from the Schloss: thirty-two rays, the rings of the half-kilometres dashed and the kilometres whole with nothing written on them and no N, a sweep, the Schloss a square at the centre, Red Dust City a dot of Mars at the Marktplatz with a ring pulsing out of it, the ground station a diamond at the ZKM, the dashed link between them with a signal on it — the globe, its orbit and satellite gone); no Signal, no bars, no trace, no blips; not one figure among them, nothing but their names and the places'" || bad "the two instruments are not among the habitat's tiles as they should be"
curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q '<span class="viz-k">Karlsruhe</span>' && curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q '<span class="viz-k">Astronauten erfasst</span>' && curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q '>Bodenstation</text>' && curl -s -H "Cookie: mcs_lang=fr" $B/dashboard | grep -q '<span class="viz-k">Karlsruhe</span>' && curl -s -H "Cookie: mcs_lang=fr" $B/dashboard | grep -q '>Station au sol</text>' && curl -s -H "Cookie: mcs_lang=fr" $B/dashboard | grep -q '<span class="viz-k">Astronautes suivis</span>' \
  && curl -s $B/dashboard | grep -q '<section class="tile t-viz t-viz-city" aria-hidden="true">' && curl -s $B/dashboard | grep -q '<section class="tile t-viz t-viz-radar" aria-hidden="true">' && curl -s $B/dashboard | grep -q '<div class="dash-live" aria-hidden="true"><span class="dl-live"><i></i>LIVE</span></div>' \
  && echo "$LAND" | grep -q 'src="/live.js' && ! echo "$LAND" | grep -q 'src="/typed.js' && curl -s $B/dashboard | grep -q 'src="/live.js' && ! curl -s $B/dashboard | grep -q 'src="/typed.js' \
  && curl -s -b $SK $B/screen/mission | grep -q 'src="/typed.js' && curl -s -b $SK $B/screen/mission | grep -q '<section class="dpanel span-12 mission-today" id="mission-today"' && ! curl -s -b $SK $B/screen/habitat | grep -q 'src="/typed.js' \
  && curl -s -o /dev/null -w '%{content_type}' $B/live.js | grep -q javascript && curl -s -o /dev/null -w '%{content_type}' $B/typed.js | grep -q javascript \
  && ok "the instruments' names in German and French; the tiles and the LIVE mark on the dashboard page as well; live.js loaded on the landing page and the dashboard page alike; typed.js on the installation's mission screen alone — the dashboard's mission stands as written" || bad "the instruments are not on the dashboard page, or the scripts are not where they should be"
grep -qF "var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;" public/live.js && grep -qF "var TURN = 4000, LIM = 40, C = 60;" public/live.js && grep -qF "radar.querySelectorAll('.dl-astro')" public/live.js \
  && grep -qF "if (dist < 1.5 || d.until <= 0) { d.to = somewhere(d); d.until = 6 + Math.random() * 8; }" public/live.js && grep -qF "if (dd < 9) { var push = (9 - dd) / 9 * 14 * dt;" public/live.js \
  && grep -qF "var bearing = (Math.atan2(d.x, -d.y) / (Math.PI * 2) + 1) % 1, since = (sweep - bearing + 1) % 1;" public/live.js && grep -qF "d.el.style.opacity = (0.4 + 0.6 * (1 - since)).toFixed(3);" public/live.js && ! grep -q "scatter\|dl-blip" public/live.js \
  && grep -qF 'var m = /^(\D*)(\d+)(.*)$/.exec(text.nodeValue); if (!m) return;' public/live.js && grep -qF "if (p < 1) requestAnimationFrame(frame); else text.nodeValue = lead + m[2] + tail;" public/live.js \
  && ! grep -q "fetch(\|XMLHttpRequest\|sendBeacon" public/live.js \
  && ok "live.js walks the astronauts about the radar — each on a slow spring towards a place of its own, two never on each other, each lit as the sweep passes — and rolls the head's figures up once to their own value, exactly restored; all of it still where less motion is asked for; nothing sent anywhere" || bad "live.js is not as it should be"
grep -qF "var body = document.querySelector('#mission-today .mission-body'); if (!body) return;" public/typed.js && grep -qF "if (calm || !window.requestAnimationFrame) return;" public/typed.js \
  && grep -qF "var HOLD = 3 * 60 * 1000;" public/typed.js && grep -qF "var SLOW = 1.3;" public/typed.js && grep -qF "timer = setTimeout(step, wait * SLOW);" public/typed.js && grep -qF "wrap.className = 'tw'; on.className = 'tw-on'; off.className = 'tw-off'; off.textContent = text;" public/typed.js \
  && grep -qF "if (!s) { showAll(); timer = setTimeout(function () { clear(); step(); }, HOLD); return; }" public/typed.js && grep -qF "if (!seen) return;" public/typed.js && grep -qF "new IntersectionObserver(function (es) { es.forEach(function (e) { seen = e.isIntersecting; }); resume(); }, { threshold: 0.15 }).observe(body);" public/typed.js \
  && grep -qF "cursor.className = 'tw-cursor'; cursor.setAttribute('aria-hidden', 'true');" public/typed.js && ! grep -q "fetch(\|XMLHttpRequest\|sendBeacon" public/typed.js \
  && ok "typed.js types the day's mission out letter by letter once the panel is in view, a third slower than it did on the dashboard — every word on the page from the start, the ones not yet typed unseen, a cursor after the last — holds it three minutes typed to the end, then clears it and types again; stands still where less motion is asked for; nothing sent anywhere" || bad "typed.js is not as it should be"
grep -q 'body.landing .dash-head .bigsec::after {' public/aura.css && grep -q 'body.landing .dash-live { display: flex; align-items: flex-start; align-self: flex-start; flex: none; padding-top: 6px; }' public/aura.css \
  && grep -q 'body.landing .hbt .tile.t-viz { position: relative; align-items: center; justify-content: center; min-height: 168px; padding: 36px 16px 14px; overflow: hidden; }' public/aura.css \
  && grep -q 'body.landing .dl-astro { fill: var(--mars); opacity: .85; }' public/aura.css && ! grep -q 'dl-blip' public/aura.css \
  && grep -q 'body.landing .hbt .t-viz-radar { grid-column: 20 / span 5; grid-row: 3; }' public/aura.css && grep -q 'body.landing .hbt .aux .t-viz-city { grid-column: span 5; }' public/aura.css && grep -q '  body.landing .hbt .aux .t-viz-city { flex: 0 0 auto; width: clamp(200px, 23%, 270px); }' public/aura.css \
  && grep -q 'body.landing .hbt .t-iaq { grid-column: 1 / span 8; grid-row: 3; padding: 12px 16px; }' public/aura.css && grep -q 'body.landing .hbt .t-voc { grid-column: 9 / span 6; grid-row: 3; padding: 12px 16px; }' public/aura.css && grep -q 'body.landing .hbt .t-light { grid-column: 15 / span 5; grid-row: 3; padding: 12px 16px; }' public/aura.css \
  && grep -q 'body.landing .hbt .aux .t-res { grid-column: span 11; }' public/aura.css && grep -q 'body.landing .hbt .aux .t-pwr { grid-column: span 8; }' public/aura.css \
  && grep -q 'body.landing .dl-sweep { transform-origin: 60px 60px; animation: dl-turn 4s linear infinite; }' public/aura.css \
  && grep -q 'body.landing .dl-fan-sweep { transform-origin: 80px 80px; animation: dl-turn 24s linear infinite; }' public/aura.css && grep -q 'body.landing .dl-link-sig { fill: var(--cobalt); animation: dl-link 6s ease-in-out infinite; }' public/aura.css \
  && grep -q 'body.landing .dl-city { display: block; width: 100%; max-width: 236px; height: auto; aspect-ratio: 1; overflow: visible; }' public/aura.css && ! grep -q 'dl-meridian\|dl-globe\|dl-sat-turn\|dl-orbit' public/aura.css \
  && grep -q 'background-position: left 10px top 8px, left 10px top 8px, right 10px top 8px, right 10px top 8px, left 10px bottom 8px, left 10px bottom 8px, right 10px bottom 8px, right 10px bottom 8px;' public/aura.css \
  && grep -q 'body.landing .officer-face::after {' public/aura.css && grep -q 'body.landing .hbt .t-co2 .dial-wrap::after {' public/aura.css && grep -q 'body.landing .rows .row.active .t::before {' public/aura.css \
  && grep -q 'body.landing .run-strip .now i { animation: dl-breathe 2.4s ease-in-out infinite; }' public/aura.css && grep -q 'body.landing .folder-body #habitat .dpanel-title h3::before { display: none; }' public/aura.css \
  && grep -q 'body.landing .mission-body .tw-off { color: transparent !important; text-shadow: none; }' public/aura.css && grep -q 'body.landing .mission-body .tw-cursor {' public/aura.css && grep -q 'body.landing .mission-body.is-typing li::marker { color: transparent; }' public/aura.css \
  && ! grep -q 'dl-scan\|dl-read\|dl-sweep-tile\|folder-body::after\|\.trends::after\|mtile:first-child::after\|dl-signal\|dl-bars\|dl-trace\|t-viz-signal\|dl-run\|dl-bar\b' public/aura.css \
  && grep -q '  body.landing .hbt .tile.t-viz, body.landing .hbt .aux .t-viz-city { grid-column: 1 / -1; grid-row: auto; min-height: 150px; padding: 40px 12px 14px; }' public/aura.css \
  && grep -q 'body.landing .dl-sweep, body.landing .dl-fan-sweep, body.landing .dl-link-sig, body.landing .dl-rdc-ping,' public/aura.css && grep -q '  body.landing .dl-fan-sweep { transform: rotate(120deg); }' public/aura.css && grep -q 'body.landing .officer-face::after, body.landing .hbt .t-co2 .dial-wrap::after, body.landing .mission-body .tw-cursor { animation: none; }' public/aura.css \
  && ok "aura.css: the cursor after the title, the LIVE mark alone at the right; the radar at the end of the sensors' third row (the air quality, the compounds and the light making room), Karlsruhe's fan at the end of the stores' row (the stores making room) — never side by side, each the width of the panel on a phone with its name above the drawing; the sweep round in four seconds, the fan's in twenty-four, the signal along the link in six, a ring out of Red Dust City; the folder bracketed at its four corners, rings out of the crew's faces and the CO₂ dial, the sol of the day breathing, the task of the hour blinking; no signal, no line sweeping over anything; the mission's words not yet typed unseen, the cursor after the last; all still where less motion is asked for" || bad "the dashboard's styles are not as they should be"

echo "── the habitat's sheet, the dome, the header, the theme, the foot, the cookie card, the running line"
LAND=$(curl -s $B/)
! echo "$LAND" | grep -q 'id="dome-seq"\|class="seq-n\|class="seq-fig"' && curl -s $B/about | grep -q 'class="in-scene"' && curl -s $B/about | grep -q 'class="in-pics"' && ! echo "$LAND" | grep -q 'class="dome-aura-base"' && ! echo "$LAND" | grep -q 'DISTANCE [0-9.]* M KM' \
  && ok "no sequencer sheet on the landing page — the habitat in section stands on its card without it (sky.js habitatSheet and the coloured dome stay in the code)" || bad "the sheet is still drawn, or the habitat is not"
echo "$LAND" | grep -q '<html lang="en" data-theme="dark">' && ! echo "$LAND" | grep -q 'data-theme-auto' \
  && [ "$(curl -s -H 'Cookie: mcs_theme=light' $B/ | grep -o '<html lang="en" data-theme="light">' | wc -l)" = "1" ] \
  && curl -s -D - -o /dev/null -d "to=light" $B/theme | grep -qi "set-cookie: mcs_theme=light" \
  && ok "the station is dark until a visitor chooses light with the switch, and keeps that choice" || bad "the station is not dark by default"
# the switches keep the place (public/switches.js; server.js, /theme and /lang): the theme turns on the page itself and the
# cookie is posted in the background (a fetch is answered 204, nothing to follow); the language's form carries the whole
# address — the #part too — and the station sends the browser back to it, never to the landing page
[ "$(curl -s -o /dev/null -w '%{http_code}' -H 'X-Requested-With: fetch' -d "to=light" $B/theme)" = "204" ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -d "to=dark&back=%2Fdashboard%23crew" $B/theme)" = "302 $B/dashboard#crew" ] \
  && [ "$(curl -s -o /dev/null -w '%{redirect_url}' -d "to=de&back=%2Fabout%23who-we-are" $B/lang)" = "$B/about#who-we-are" ] \
  && [ "$(curl -s -o /dev/null -w '%{redirect_url}' -e "$B/media" -d "to=en" $B/lang)" = "$B/media" ] \
  && [ "$(curl -s -o /dev/null -w '%{redirect_url}' -d "to=en&back=https%3A%2F%2Fevil.example%2F" $B/lang)" = "$B/" ] && [ "$(curl -s -o /dev/null -w '%{redirect_url}' -d "to=en&back=%2F%2Fevil.example" $B/lang)" = "$B/" ] \
  && echo "$LAND" | grep -q '<script src="/switches.js?v=' && grep -q "root.setAttribute('data-theme', to);" public/switches.js && grep -q "'X-Requested-With': 'fetch'" public/switches.js && grep -q "back.value = here();" public/switches.js \
  && ok "the theme turns without a reload (a fetch, answered 204) and the language comes back to the whole address, #part included — never to the landing page; an address off the station is not a way back" || bad "a switch still sends the visitor to the landing page, or follows an outside address"
! echo "$LAND" | grep -q 'class="orbits"' && echo "$LAND" | grep -q 'class="consent-sky"' && ! echo "$LAND" | grep -q 'consent-astro\|consent-planet' \
  && ok "no orbits behind the page; the cookie card's strip of night has nobody in it and no planet" || bad "the orbits or the cookie card's astronaut are still there"
echo "$LAND" | grep -q '<div class="tk-bar">' && echo "$LAND" | grep -q 'class="tk-sol"' && echo "$LAND" | grep -q 'class="tk-nav"' && ! echo "$LAND" | grep -q 'class="tk-clock"' \
  && ok "the header: the wordmark, the run's badge, the three links, the switches, the running line — no clock" || bad "the header is not as it should be"
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
LAND=$(curl -s $B/dashboard)
echo "$LAND" | grep -q "Power consumed" && echo "$LAND" | grep -q 'class="pwr-row' \
  && ok "the Habitat panel carries the day's power, a bar per category" || bad "no power tile on the landing page"
echo "$LAND" | grep -q 'pwr-total' && ok "the trend spec carries a Power group — each category and the total, daily" || bad "power not in the trends"
# this station has no meters (no Home Assistant) and nothing filed, so the tile says so and draws no rows; the desk's
# form carries every category as power.json labels it (the rows are drawn on the dashboard once a figure is in — below)
curl -s -b $A "$B/control?tab=habitat" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const p = JSON.parse(require("fs").readFileSync(process.env.CONTENT_DIR + "/power.json", "utf8"));
  const missing = p.categories.filter((c) => !s.includes(`name="name_${c.key}" value="${c.label}"`)).map((c) => c.label);
  if (missing.length) console.error("missing: " + missing.join(", "));
  process.exit(missing.length ? 1 : 0); });
' && echo "$LAND" | grep -q 'No reading from the meters yet today, and nothing filed by the crew' \
  && ok "every category stands on the desk as power.json labels it, a row each; the dashboard's tile, with no meter answering and nothing filed, says so instead of drawing zeros" || bad "a power category is missing from the desk, or the tile does not say the meters have nothing"
node -e '
const p = JSON.parse(require("fs").readFileSync(process.env.CONTENT_DIR + "/power.json", "utf8"));
const want = [["crickets", "Crickets"], ["science_1", "Science 1"], ["science_2", "Science 2"], ["living", "Living"], ["table", "Table"], ["food", "Food"], ["water", "Water"], ["hydroponics", "Hydroponics"]];
process.exit(p.categories.length === 8 && want.every(([k, l], i) => p.categories[i].key === k && p.categories[i].label === l && p.categories[i].sensor === `habitat_power_${k}_energie`) ? 0 : 1);
' && ok "the eight categories are the habitat's metered power channels as power.json ships them — Crickets, Science 1, Science 2, Living, Table, Food, Water, Hydroponics — each reading its energy meter, sensor.habitat_power_<channel>_energie (the energy used, under Power consumed)" || bad "power.json does not ship the eight metered channels"
node -e '
const c = require("./src/lib/content"); const d = c.power().categories;
process.exit(d.length === 8 && d[0].key === "crickets" && d[0].sensor === "habitat_power_crickets_energie" && d[7].label === "Hydroponics" ? 0 : 1);
' && ok "content.power reads them (and the code's own defaults are the same eight, for a missing file)" || bad "content.power does not read the eight channels"
echo "$LAND" | grep -q 'energy used, from the meters · kWh</span>' && ! echo "$LAND" | grep -q 'from the meter and the crew' \
  && ok "the tile's line says the figures are the energy used, from the meters — every category is on one" || bad "the tile's line does not say the figures are the meters' energy"
curl -s -H "Cookie: mcs_lang=de" $B/dashboard | grep -q 'verbrauchte Energie, von den Zählern · kWh</span>' && curl -s -H "Cookie: mcs_lang=fr" $B/dashboard | grep -q 'énergie consommée, relevée aux compteurs · kWh</span>' \
  && ok "and in German and French" || bad "the tile's line is not translated"
GLANCE=$(curl -s $B/at-a-glance)
echo "$GLANCE" | grep -q "Power consumed" && ok "each day of the booklet carries its power figures" || bad "no power block in At a Glance"
echo "$GLANCE" | grep -q 'gauges rounds' && echo "$GLANCE" | grep -q 'round-arc' \
  && ok "and the stores as rings — the arc is what is left of what was carried in" || bad "no resource rings in At a Glance"
curl -s -b $A "$B/control?tab=habitat" | grep -q 'name="name_crickets"' && curl -s -b $A "$B/control?tab=habitat" | grep -q 'name="kwh_crickets"' && curl -s -b $A "$B/control?tab=habitat" | grep -q 'name="kwh_hydroponics"' \
  && [ "$(curl -s -b $A "$B/control?tab=habitat" | grep -o 'From the meter <code>sensor.habitat_power_[a-z_0-9]*_energie</code>' | wc -l)" = "8" ] \
  && ok "the Habitat tab has the power form: a name and an amount per channel, each row saying which meter it reads" || bad "no power form in mission control, or its rows do not name their meters"
# file a day and rename a category from mission control; both land in power.json and on the site (a metered row is
# opened with Edit, edited_<key>=1, before a figure typed by hand is kept)
curl -s -b $A -d "day=2" -d "name_crickets=Crickets" -d "kwh_crickets=1.4" -d "edited_crickets=1" -d "name_food=Food" -d "kwh_food=0.6" -d "edited_food=1" \
  -d "name_living=Living" -d "kwh_living=0.3" -d "edited_living=1" -d "name_water=Water" -d "kwh_water=0.5" -d "edited_water=1" \
  -d "name_hydroponics=Greenhouse" -d "kwh_hydroponics=0.2" -d "edited_hydroponics=1" -o /dev/null $B/control/power
node -e '
const o = JSON.parse(require("fs").readFileSync(process.env.CONTENT_DIR + "/power.json", "utf8"));
const d = o.days["2"] || {};
process.exit(d.crickets === 1.4 && d.hydroponics === 0.2 && d.table === undefined && o.categories.some((c) => c.key === "hydroponics" && c.label === "Greenhouse" && c.sensor === "habitat_power_hydroponics_energie") ? 0 : 1);
' && ok "saving writes content/power.json — the day's kWh and the renamed category, which keeps its meter; a row not opened keeps the meter's figure" || bad "the power save did not reach the file"
curl -s $B/at-a-glance | grep -q "Greenhouse" && ok "the rename reaches At a Glance" || bad "renamed category not shown"
curl -s $B/dashboard | grep -q "Greenhouse" && ok "and the landing page" || bad "renamed category not on the landing page"
curl -s -b $A $B/archive/export.pdf -o /tmp/record-pwr.pdf
PWRTXT=$(pdftext /tmp/record-pwr.pdf)
echo "$PWRTXT" | grep -q "Power consumed" && echo "$PWRTXT" | grep -q "Greenhouse" \
  && ok "the full record PDF carries the power figures, per day" || bad "power missing from the PDF record"
curl -s -b $A $B/archive/export.json | grep -q '"label":"Greenhouse","kwh":0.2' && ok "and the JSON export carries each day's kWh by category, as filed" || bad "power missing from export.json"
curl -s -b $A $B/archive/export.md | grep -q "Power consumed" && ok "and the Markdown record" || bad "power missing from export.md"
curl -s -b $A $B/archive/day/2 | grep -q 'chan">POWER<' && ok "and the archive's day page" || bad "power missing from the archive day"

echo "── the whole habitat on every At a Glance day"
grep -q "'pres', 'bat', 'rssi'" src/server.js && grep -q "Node battery" src/views/pages/glance.js && grep -q "Signal.*dBm" src/views/pages/glance.js \
  && ok "every node channel is summarised per day — battery and signal included" || bad "bat/rssi missing from the At a Glance summary"
curl -s -b $A -d "day=2" -d "calories=5010" -d "steps=6420" -o /dev/null $B/control/crew-figures
GLA2=$(curl -s $B/at-a-glance)
echo "$GLA2" | grep -q "Calories consumed" && echo "$GLA2" | grep -q "Steps taken" && echo "$GLA2" | grep -q "crew total · counted that day" \
  && ok "the day's calories and steps stand in the habitat tile bank, beside the sensors" || bad "crew figures missing from the At a Glance habitat"
echo "$GLA2" | grep -q "5,010" && ok "with the figures as filed — day 2 carries 5,010 kcal" || bad "the filed figure is not shown"
# the day's habitat: the last reading of the day per channel — the node's channels, the station's own ingest channels
# and the hardware — a tile each, the reading large in its unit; no chart, no mean, no range, no count
node -e '
const a = require("./src/lib/archive"), db = require("./src/db").db;
const start = Date.parse(a.windowFor(2).start);
const ins = db.prepare("INSERT OR IGNORE INTO external_reading (t, co2, temp, sig) VALUES (?, ?, ?, ?)");
for (let i = 0; i < 24; i++) ins.run(start + i * 3600000, 600 + i * 3, 21 + (i % 5) / 10, "glance-" + i);
'
GLA3=$(curl -s $B/at-a-glance)
echo "$GLA3" | node -e '
let s = ""; process.stdin.on("data", (d) => s += d).on("end", () => {
  const a = s.indexOf("id=\"day-2\""), b = s.indexOf("id=\"day-3\"");
  const page = s.slice(a, b);
  const tile = (label, v, unit) => page.includes(`<span class="gt-label">${label}</span>\n    <span class="gt-value">${v}<em>${unit}</em></span>`);
  process.exit(tile("CO₂", "669", "ppm") && tile("Temperature", "21.3", "°C") && !/glance-chart|gc-dot|gt-range">\d/.test(page) && page.includes("<div class=\"eyebrow\">Habitat</div>") ? 0 : 1);
});' && ok "day 2's habitat tiles carry the last reading of the day — CO₂ 669 ppm, 21.3 °C of 24 readings each — headed Habitat, with no chart, no range and no count" || bad "the day's tiles do not carry the last reading alone"
echo "$GLA3" | node -e '
let s = ""; process.stdin.on("data", (d) => s += d).on("end", () => {
  const a = s.indexOf("id=\"day-" + process.argv[1] + "\""), b = s.indexOf("id=\"day-" + (Number(process.argv[1]) + 1) + "\"");
  const page = b > a ? s.slice(a, b) : s.slice(a);
  process.exit(/<span class="gt-label">OXYGEN<\/span>\n    <span class="gt-value">20\.9<em>%<\/em><\/span>/i.test(page) ? 0 : 1);
});' "$TODAY" && ok "the station's own ingest channels stand in the tiles the same way — today's oxygen, 20.9 %" || bad "the ingest's last reading is not in the tiles"
echo "$GLA3" | grep -q 'glance-chart\|every reading of the day\|Every reading the station pulled' && bad "the booklet still draws the day's readings" || ok "no reading-by-reading charts on At a Glance — the record has them"
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
  const i = s.indexOf("id=\"today\""), j = s.indexOf("id=\"day-1\"");
  process.exit(i > -1 && s.slice(i, j).indexOf("class=\"glance-tile\"") > -1 ? 0 : 1);
});' && ok "and it carries the sensors as they read now, a tile each" || bad "no data on the rehearsal page"
echo "$GLR" | node -e '
let s = ""; process.stdin.on("data", (d) => s += d).on("end", () => {
  const a = s.indexOf("id=\"today\""), b = s.indexOf("id=\"day-1\"");
  if (a < 0 || b < a) process.exit(1);
  const page = s.slice(a, b);
  const need = ["Schedule", "Meals", "Resources", "Power consumed", "gauges rounds", "Habitat"];
  process.exit(need.every((x) => page.includes(x)) ? 0 : 1);
});' && ok "the rehearsal page is a complete day page — schedule, meals, consumption rings, power and habitat, the real feel of SOL 001" || bad "the rehearsal page is missing day blocks"

echo "── NOW — the rehearsal day, mission day 0: filed apart from the run's days, in every export, gone with the reset"
# the schedule file was left broken on purpose earlier (a broken file must not take the site down); NOW files a schedule, so put the plan's back first
cp "$CONTENT_DIR/plan/schedule.json" "$CONTENT_DIR/schedule.json"; sleep 2
NOWCTL=$(curl -s -b $A "$B/control?tab=habitat")
echo "$NOWCTL" | grep -q 'class="daypick-now on"' && echo "$NOWCTL" | grep -qE 'data-day="0"[^>]*>NOW · [0-9]+ [A-Z][a-z]+</a>' && echo "$NOWCTL" | grep -q 'href="/control?tab=habitat&day=0#work"' && echo "$NOWCTL" | grep -q 'Schedule · NOW' && echo "$NOWCTL" | grep -q 'rehearsing as NOW' \
  && ok "before the run the desk opens on NOW — first in the day picker with today's date, ahead of 15 Oct, and every block says so" || bad "the desk does not open on NOW before the run"
DAY1_TASKS=$(node -e 'console.log(require("./src/db").db.prepare("SELECT COUNT(*) n FROM task WHERE mission_day = 1").get().n)')
DAY1_WATER=$(node -e 'console.log(JSON.stringify(require("./src/db").db.prepare("SELECT quantity, consumption FROM inventory_level il JOIN inventory_item i ON i.id = il.item_id WHERE i.key = ? AND il.mission_day = 1").get("water")))')
curl -s -b $A -d day=0 -d n0_time=09:00 -d "n0_label=NOW briefing" -d "n0_detail=everyone in the dome" -o /dev/null $B/control/schedule
curl -s -b $A -d day=0 -d "BREAKFAST_name=NOW porridge" -d BREAKFAST_kcal=400 -o /dev/null $B/control/meals
curl -s -b $A -d day=0 -d "designation=COMMUNICATION OFFICER" -d "body=NOW words for the rehearsal" -d back=comms -o /dev/null $B/control/logbook
curl -s -b $A -d day=0 -d kind=science -d "body=NOW findings for the rehearsal" -d back=science -o /dev/null $B/control/report
curl -s -b $A -d day=0 -d q_water=480 -d c_water=22 -d "why=NOW count" -o /dev/null $B/control/inventory
curl -s -b $A -d day=0 -d kwh_food=1.4 -d edited_food=1 -o /dev/null $B/control/power
curl -s -b $A -d day=0 -d steps_1=4200 -o /dev/null $B/control/crew-figures
sleep 1
node -e '
const fs = require("fs"), d = process.env.CONTENT_DIR, r = (f) => JSON.parse(fs.readFileSync(d + "/" + f, "utf8"));
const ok = r("schedule.json")["0"][0].label === "NOW briefing" && r("meals.json")["0"][0].name === "NOW porridge"
  && r("logbook.json")["0"]["COMMUNICATION OFFICER"] === "NOW words for the rehearsal" && r("notes.json")["0"][0].body === "NOW findings for the rehearsal"
  && r("inventory-levels.json")["0"].water.quantity === 480 && r("power.json").days["0"].food === 1.4 && r("crew-figures.json")["0"].steps === 4200;
process.exit(ok ? 0 : 1);' && ok "everything filed under NOW lands in the content files under \"0\" — schedule, meals, blog, report, count, power, figures" || bad "NOW is not filed under 0 in the content files"
[ "$(node -e 'console.log(require("./src/db").db.prepare("SELECT COUNT(*) n FROM task WHERE mission_day = 1").get().n)')" = "$DAY1_TASKS" ] \
  && [ "$(node -e 'console.log(JSON.stringify(require("./src/db").db.prepare("SELECT quantity, consumption FROM inventory_level il JOIN inventory_item i ON i.id = il.item_id WHERE i.key = ? AND il.mission_day = 1").get("water")))')" = "$DAY1_WATER" ] \
  && ! grep -q "NOW words\|NOW briefing" "$CONTENT_DIR/resource-log.csv" \
  && ok "and nothing of it touches the run's days — SOL 001's schedule and stores are as they were, the resource log holds no NOW row" || bad "NOW leaked into the run's days"
node -e '
const db = require("./src/db").db;
const w = db.prepare("SELECT quantity, consumption FROM inventory_level il JOIN inventory_item i ON i.id = il.item_id WHERE i.key = ? AND il.mission_day = 0").get("water");
const day = db.prepare("SELECT date, status FROM day WHERE mission_day = 0").get();
const m = require("./src/lib/mission");
process.exit(w && w.quantity === 480 && w.consumption === 22 && day && day.date === m.state().today && m.dateForDay(0) === m.state().today && m.state().workDay === 0 && m.state().nowDay ? 0 : 1);
' && ok "NOW is mission day 0 in the database — its own day row dated today, its own stores from what was carried in; mission.workDay is 0 before the run" || bad "day 0 is not set up as NOW"
NOWARC=$(curl -s -b $A $B/archive)
echo "$NOWARC" | grep -q '<td class="n">NOW</td>' && echo "$NOWARC" | grep -q 'Rehearsal · not the record' && echo "$NOWARC" | grep -q 'href="/archive/now/export.pdf"' \
  && ok "the archive lists NOW ahead of the days, marked as the rehearsal, with its own PDF and Markdown" || bad "no NOW row in the archive"
[ "$(curl -s -b $A -o /dev/null -w '%{redirect_url}' $B/archive/today)" = "$B/archive/now" ] && ok "before the run /archive/today leads to /archive/now" || bad "/archive/today does not lead to NOW before the run"
NOWDAY=$(curl -s -b $A $B/archive/now)
echo "$NOWDAY" | grep -q '<h1>NOW — today, before the run</h1>' && echo "$NOWDAY" | grep -q 'NOW words for the rehearsal' && echo "$NOWDAY" | grep -q 'NOW findings for the rehearsal' \
  && echo "$NOWDAY" | grep -q 'NOW briefing' && echo "$NOWDAY" | grep -q 'NOW porridge' && echo "$NOWDAY" | grep -q 'NOW count' && echo "$NOWDAY" | grep -q '4200' \
  && ok "/archive/today is NOW's record — the blog, the report, the schedule, the meal, the count and the figures filed under NOW" || bad "NOW's record is not built from day 0"
curl -s -b $A $B/archive/export.json | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const j = JSON.parse(s), r = j.rehearsal;
  const ok = r && r.missionDay === 0 && r.rehearsal === true && r.recorded === false && /NOW/.test(r.note)
    && r.schedule.some((t) => t.label === "NOW briefing") && r.meals.some((m) => m.name === "NOW porridge")
    && r.officers.some((o) => o.commanderBlog && o.commanderBlog.body === "NOW words for the rehearsal")
    && r.officers.some((o) => o.report && o.report.bodies.includes("NOW findings for the rehearsal"))
    && r.storesCounted.some((v) => v.key === "water" && v.quantity === 480) && r.power && r.crewFigures && r.crewFigures.steps === 4200
    && j.days.length === 13 && j.days.every((d) => d.recorded === false && d.missionDay >= 1);
  process.exit(ok ? 0 : 1);
});' && ok "the data copy carries NOW as its own rehearsal block — marked, beside the thirteen unrecorded days, never among them" || bad "export.json has no NOW block"
NOWMD=$(curl -s -b $A $B/archive/export.md)
echo "$NOWMD" | grep -q '^## NOW — today, before the run — .* — REHEARSAL, NOT THE RECORD' && echo "$NOWMD" | grep -q 'NOW words for the rehearsal' && echo "$NOWMD" | grep -q 'NOW briefing' \
  && ok "the readable copy carries the NOW chapter, marked" || bad "export.md has no NOW chapter"
curl -s -b $A $B/archive/export.pdf -o /tmp/now-record.pdf && NOWPDF=$(pdftext /tmp/now-record.pdf)
echo "$NOWPDF" | grep -q 'NOW ·' && echo "$NOWPDF" | grep -q 'rehearsal, not the record' && echo "$NOWPDF" | grep -q 'NOW words for the rehearsal' && echo "$NOWPDF" | grep -q 'NOW briefing' \
  && ok "the full record's PDF carries the NOW chapter, marked, with what was filed under NOW" || bad "the PDF has no NOW chapter"
curl -s -b $A $B/archive/now/export.pdf -o /tmp/now-day.pdf && pdftext /tmp/now-day.pdf | grep -q 'NOW words for the rehearsal' && ok "and NOW downloads as a PDF of its own" || bad "no NOW PDF"
curl -s -b $A -o /dev/null $B/archive
node -e '
const fs = require("fs"), path = require("path"), dir = path.join(process.env.DATA_DIR, "readings", "daily");
let found = false;
for (const d of fs.existsSync(dir) ? fs.readdirSync(dir) : []) for (const f of fs.readdirSync(path.join(dir, d))) {
  const o = JSON.parse(fs.readFileSync(path.join(dir, d, f), "utf8"));
  if (o.missionDay === 0 && o.rehearsal === true && o.habitatTab && o.habitatTab.schedule.some((t) => t.label === "NOW briefing") && /NOW/.test(o.note)) found = true;
}
process.exit(found ? 0 : 1);' && ok "the readings log holds a daily record for NOW — missionDay 0, marked rehearsal, with the Habitat tab as filed under NOW" || bad "no NOW record in the readings log"
curl -s -b $A $B/archive/readings.zip -o /tmp/now-readings.zip && unzip -p /tmp/now-readings.zip README.txt | grep -q 'NOW' && ok "and the readings ZIP's README says so" || bad "the readings ZIP does not mention NOW"
curl -s -b $A -D /tmp/now-media.h $B/media/day/0/export.zip -o /tmp/now-media.zip && grep -qi 'filename="mars-station-media-now-rehearsal.zip"' /tmp/now-media.h && unzip -p /tmp/now-media.zip README.txt | grep -q 'now-rehearsal' \
  && ok "NOW's media downloads as its own ZIP, its folder named now-rehearsal, the README explaining it" || bad "no media ZIP for NOW"
curl -s -b $V -c $V -X POST --data-urlencode "body=A NOW question from Earth" -d "callsign=$CS" -o /dev/null $B/communicate
sleep $((TRANSIT_SECONDS + 1))
curl -s -b $A $B/control/messages/export.csv | grep -q '0,NOW · before the run,' && curl -s -b $A $B/control/messages/export.json | grep -q '"missionDay":0,"rehearsal":true' \
  && curl -s -b $A "$B/control?show=all" | grep -q '· NOW · <b class="msg-sent">' \
  && ok "a message before the run is NOW's — mission day 0, marked in the CSV, the JSON and on the desk" || bad "messages before the run are not marked NOW"
curl -s -b $A $B/control/messages/export.pdf -o /tmp/now-msgs.pdf && pdftext /tmp/now-msgs.pdf | grep -q 'NOW · before the run · rehearsal, not the record' && ok "and the messages PDF heads them NOW · before the run" || bad "the messages PDF does not head the rehearsal messages"
curl -s $B/logbook | grep -q 'href="#day-0"' && curl -s $B/logbook | grep -q 'NOW words for the rehearsal' && curl -s $B/at-a-glance | grep -q 'NOW words for the rehearsal' \
  && ok "the public crew log heads with NOW once it is written, and the booklet's NOW page is built from it" || bad "NOW is not on the public log or the booklet"
curl -s -b $SK "$B/screen/blogs?lang=en" | grep -q 'NOW words for the rehearsal' && curl -s -b $SK "$B/screen/blogs?lang=en" | grep -q 'NOW · ' && ok "the blogs screen shows NOW's blogs before the run, headed NOW" || bad "the blogs screen does not show NOW"

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
grep -q "(p.t - day0) / DAY" public/habitat.js && grep -q "the scale alone, as the other tiles have it" public/habitat.js && ! grep -q "tr('The ring is the day" public/habitat.js \
  && ok "the CO₂ dial is a 24-hour cycle — each reading at its time-of-day angle, midnight at the top" || bad "the CO₂ dial is not on the 24-hour clock"
curl -s $B/dashboard | grep -q 'data-day-start="[0-9]' && ok "the page carries the venue's midnight, so today is the venue's today on every phone" || bad "no day start on the page"
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
BEFORE=$(curl -s -b $A $B/control/counts | grep -o '"total":[0-9]*' | head -1)
curl -s -b $A -d "confirm=nope" -o /dev/null $B/control/reset
[ "$(curl -s -b $A $B/control/counts | grep -o '"total":[0-9]*' | head -1)" = "$BEFORE" ] && ok "reset without the word RESET does nothing" || bad "reset ran without confirmation"
curl -s -b $A -d "confirm=RESET" -o /dev/null $B/control/reset
curl -s -b $A $B/control/counts | grep -q '"total":0' && ok "reset clears every message from Earth" || bad "messages survived the reset"
curl -s $B/logbook | grep -q "Rehearsal words" && bad "the rehearsal entry survived the reset" || ok "the rehearsal entry is gone from the crew log"
grep -q "Rehearsal words" "$CONTENT_DIR/logbook.json" && bad "the rehearsal entry survived in logbook.json" || ok "logbook.json holds no entry"
node -e '
const fs = require("fs"), d = process.env.CONTENT_DIR, r = (f) => JSON.parse(fs.readFileSync(d + "/" + f, "utf8"));
process.exit(["schedule.json", "meals.json", "logbook.json", "notes.json", "inventory-levels.json"].every((f) => !Object.prototype.hasOwnProperty.call(r(f), "0")) && !(r("power.json").days || {})["0"] && !r("crew-figures.json")["0"] ? 0 : 1);
' && ok "the reset takes NOW with it — no \"0\" left in any content file" || bad "NOW survived the reset"
[ "$(grep -c PLACEHOLDER "$CONTENT_DIR/logbook.json")" -ge 13 ] && ! grep -q "SCIENCE OFFICER\|HEALTH OFFICER" "$CONTENT_DIR/logbook.json" && ok "every Commander Blog slot is empty — 13 placeholders, no other officer's" || bad "placeholders missing after reset"
curl -s -b $A "$B/control?tab=habitat" | grep -q "The station has been reset for 15 October" && ok "mission control reports the reset" || bad "no reset report"
curl -s -b $A "$B/control?tab=habitat" | grep -q "Start again from 15 October" && ok "the reset panel is on the Habitat tab" || bad "no reset panel"
curl -s -b $A -o /dev/null -w '%{http_code}' $B/control | grep -q 200 && ok "the sign-in survives the reset" || bad "signed out by the reset"
curl -s $B/dashboard | grep -q 'class="gauges' && ok "the inventory is rebuilt" || bad "no gauges after reset"
node -e 'const d = require(process.env.CONTENT_DIR + "/inventory-levels.json"); process.exit(Object.keys(d).some((k) => /^\d+$/.test(k)) ? 1 : 0);' \
  && ! curl -s $B/at-a-glance | grep -q ">555 " && ok "and the counted stores are emptied — the edited count is gone, the stores start from what was carried in" || bad "a counted store survived the reset"
[ "$(curl -s $B/api/habitat/data | grep -o '"t":' | wc -l)" = "0" ] && ok "every habitat reading is gone — the node refills the last three days on its next poll" || bad "readings survived the reset"
node -e '
const c = require("./src/lib/critical");
process.exit(c.floorMs() === c.runStartMs() && c.floorMode() === "run" ? 0 : 1);
' && ok "after the reset the readings start on the first day of the run" || bad "reset did not move the readings floor to the run"
curl -s $B/dashboard | grep -q 'data-axis-run="1"' && ok "and the trend graph is the run from the reset on" || bad "trend axis not the run after reset"
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
  && o.categories.some((c) => c.key === "hydroponics" && c.label === "Greenhouse" && c.sensor === "habitat_power_hydroponics_energie") ? 0 : 1);
' && ok "the power days are emptied and the categories kept, with their meters — each day's kWh is filed from the run on" || bad "power.json not reset as it should be"
LAND=$(curl -s $B/dashboard)
echo "$LAND" | grep -q 'planned&quot;:{&quot;' && bad "the trend graph still carries plan points after the reset" || ok "the trend graph carries no plan after the reset — every day ahead is null until it is filed"
echo "$LAND" | grep -q "nothing recorded" && ok "the calories and steps tiles read nothing recorded until the first figures are filed" || bad "figure tiles not empty after reset"
curl -s $B/dashboard | grep -q "angry, needing distance" && bad "an old state is still public" || ok "no old state reaches the station"
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
# the channel and the desk closed at the end of the day after the run (src/lib/mission.js, open)
curl -s $B2/api/ticker | grep -q '"open":false' && curl -s $B2/write | grep -q 'CHANNEL CLOSED' && curl -s $B2/write | grep -q 'the channel closed at the end of' \
  && ok "the station says it is closed: /api/ticker open:false, the composer CHANNEL CLOSED with the day it closed" || bad "the closed station does not say so"
V2=/tmp/visitor2.jar; rm -f $V2
curl -s -c $V2 -b $V2 -o /dev/null $B2/write
curl -s -c $V2 -b $V2 -X POST -d "body=Too late for the crew" -o /dev/null $B2/communicate
[ "$(DATA_DIR="$DATA2" node -e 'console.log(require("./src/db").db.prepare("SELECT COUNT(*) n FROM message").get().n)')" = "0" ] \
  && ok "a message posted after the close is not taken — the form itself is refused on the server" || bad "the closed station still takes messages"
A2=/tmp/admin2.jar; rm -f $A2
curl -s -c $A2 -d "username=$CONTROL_USER" -d "password=$CONTROL_PASSWORD" -o /dev/null $B2/control/login
[ "$(curl -s -b $A2 -d day=13 -d n0_time=09:00 -d "n0_label=Late edit" -o /dev/null -w '%{redirect_url}' $B2/control/schedule)" = "$B2/control" ] \
  && ! grep -q "Late edit" "$CONT2/schedule.json" && curl -s -b $A2 $B2/control | grep -q 'Mission control closed at the end of' && curl -s -b $A2 "$B2/control?tab=habitat" | grep -q 'body class="control closed"' \
  && grep -q "document.body.classList.contains('closed')" public/control.js && grep -q 'body.control.closed form.is-closed { opacity: .55; pointer-events: none; }' public/station.css \
  && ok "mission control takes no edit after the close — every save is refused with a note, and the page stands greyed and read-only" || bad "mission control still takes edits after the close"
[ "$(curl -s -b $A2 -o /dev/null -w '%{http_code}' $B2/archive)" = "200" ] && [ "$(curl -s -b $A2 -o /dev/null -w '%{http_code}' $B2/archive/export.json)" = "200" ] \
  && ok "while the archive and the downloads keep serving" || bad "the archive closed with the desk"
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

echo "── the day after the run: the last day the channel and the desk are open"
# a station whose run ended yesterday: the crew are out, the channel still takes messages for their last replies and
# the desk still takes edits — until the end of today
DATA5=$(mktemp -d); CONT5=$(mktemp -d); cp content/*.json "$CONT5"/
DATA_DIR="$DATA5" CONTENT_DIR="$CONT5" node src/db/seed.js > /dev/null 2>&1
DATA_DIR="$DATA5" CONTENT_DIR="$CONT5" PORT=8097 CRITICAL_POLL=false \
  MISSION_START=$(date -u -d '-13 days' +%F) MISSION_END=$(date -u -d '-1 days' +%F) \
  node src/server.js > /tmp/srv-grace.log 2>&1 &
SRV5=$!
sleep 3
B5=http://localhost:8097
curl -s $B5/api/ticker | grep -q '"phase":"COMPLETE"' && curl -s $B5/api/ticker | grep -q '"open":true' && curl -s $B5/write | grep -q 'id="composer"' && ! curl -s $B5/write | grep -q 'CHANNEL CLOSED' \
  && ok "the day after the run the mission is complete but the station is open: the page keeps its composer" || bad "the day after the run the station is already closed"
V5=/tmp/visitor5.jar; rm -f $V5
curl -s -c $V5 -b $V5 -o /dev/null $B5/
curl -s -c $V5 -b $V5 -X POST -d "body=A last word for the crew" -o /dev/null $B5/communicate
[ "$(DATA_DIR="$DATA5" node -e 'console.log(require("./src/db").db.prepare("SELECT COUNT(*) n FROM message").get().n)')" = "1" ] \
  && ok "a message sent the day after the run is taken" || bad "the day after the run no message is taken"
A5=/tmp/admin5.jar; rm -f $A5
curl -s -c $A5 -d "username=$CONTROL_USER" -d "password=$CONTROL_PASSWORD" -o /dev/null $B5/control/login
curl -s -b $A5 -d day=13 -d n0_time=09:00 -d "n0_label=Last edit" -o /dev/null $B5/control/schedule
grep -q "Last edit" "$CONT5/schedule.json" && ! curl -s -b $A5 $B5/control | grep -q 'body class="control closed"' \
  && ok "and the desk still takes edits that day" || bad "the desk refused an edit the day after the run"
kill $SRV5 2>/dev/null; wait $SRV5 2>/dev/null
rm -rf "$DATA5" "$CONT5"

# the real run's close, from the dates fixed in src/lib/run.js: the end of 28 October 2026 at the venue
UD=$(mktemp -d)
DATA_DIR="$UD" MISSION_OVERRIDE=false node -e '
const m = require("./src/lib/mission"); m.sync();
const s = m.state(new Date("2026-10-28T22:59:00Z")), c = m.state(new Date("2026-10-28T23:00:00Z"));
process.exit(s.open === true && c.open === false && s.closeDate === "2026-10-28" && c.closedAt === "2026-10-28T23:00:00.000Z" ? 0 : 1);
' > /dev/null 2>&1 && ok "for the real run the close is the end of 28 October 2026 at the venue — 23:00 UTC, the clocks having gone back" || bad "the real run's close is wrong"
rm -rf "$UD"

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
  HA_HOST=localhost HA_PORT=8125 HA_API_TOKEN=test-token HA_POLL=false SCREENS_USER= SCREENS_PASSWORD= node src/server.js > /tmp/srv3.log 2>&1 &
SRV3=$!
sleep 6
B3=http://localhost:8083
# this station has no SCREENS_USER / SCREENS_PASSWORD — as the station ships: the screens open without any sign-in
[ "$(curl -s -o /dev/null -w '%{http_code}' $B3/screens)" = "200" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' $B3/screen/board)" = "200" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' "$B3/screen/write/composer?lang=en")" = "200" ] \
  && [ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$B3/screens/login?next=%2Fscreen%2Fboard")" = "302 $B3/screen/board" ] && [ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -d 'username=x&password=y' $B3/screens/login)" = "302 $B3/screens" ] \
  && ! curl -s $B3/screens | grep -q 'action="/screens/logout"' \
  && ok "without SCREENS_USER and SCREENS_PASSWORD in .env there is no door: the screens, their list and the writing screen open to anyone, /screens/login only leads on, and the list has no sign-out" || bad "the screens still ask for a password without the two set"
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
LAND3=$(curl -s $B3/dashboard)
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
# the Sensors tab's words: the temperature tile without the "x–y in view" line, the air quality tile's line the index
# alone (no scale, no "as the sensor classifies it"), the trends headed Trends alone
echo "$LAND3" | grep -q '<span class="sub">IAQ index</span>' && ! echo "$LAND3" | grep -q 'as the sensor classifies it\|Scale 0–500' \
  && ok "the air quality tile says IAQ index under its figure — no scale, no note on the classification" || bad "the air quality tile still carries the scale or the note"
grep -q "\$('tempVerdict').textContent = '';" public/habitat.js && ! grep -q "in view" public/habitat.js \
  && ok "the temperature tile carries no x–y in view line under its figure" || bad "habitat.js still writes the in-view range under the temperature"
echo "$LAND3" | grep -q '<div class="hbt-sec"><h3>Trends</h3></div>' && ! echo "$LAND3" | grep -q 'Every channel, store and count over the run' \
  && ok "the trends are headed Trends alone — no line under the heading" || bad "the trends' heading still carries its line"
# the hardware's day charts, with readings stored for today — the cricket's temperature and two of the eight power
# channels' draws (crickets and food): the newest reading of a chart's first line sits in a pill above the line's end,
# large enough to hold the figure and its unit (26 high, rounded, the text centred in it) — named after its line where
# the chart has more than one (Crickets 12 W); the legend names each line with its low and high, no reading beside it,
# the names without the " · power draw" every line shares (the chart's title says it); a draw (a gauge in watts) is not
# a trend — its day is on its meter's line, as energy — and a meter a Power category reads is not among the Hardware
# trends either (it is that category's line in the Power group)
DATA_DIR="$DATA3" CONTENT_DIR="$CONT3" node -e '
const { db } = require("./src/db"); const mission = require("./src/lib/mission"); const m = mission.config();
const today = mission.localDate(new Date(), m.timezone);
const at = (hhmm) => mission.venueTimeUtc(today, hhmm, m.timezone);
const ins = db.prepare("INSERT OR IGNORE INTO ha_reading (entity, t, value, state, unit) VALUES (?, ?, ?, ?, ?)");
for (const [h, v] of [["00:05", 21.5], ["00:20", 21.9], ["00:40", 22.4]]) ins.run("m5_temperatur_cricket_temperature", at(h), v, String(v), "°C");
for (const [h, v] of [["00:05", 9], ["00:20", 11], ["00:40", 12]]) ins.run("habitat_power_crickets_leistung", at(h), v, String(v), "W");
for (const [h, v] of [["00:05", 80], ["00:20", 86], ["00:40", 91]]) ins.run("habitat_power_food_leistung", at(h), v, String(v), "W");
for (const [h, v] of [["00:05", 100.0], ["00:40", 100.3]]) ins.run("habitat_power_food_energie", at(h), v, String(v), "kWh");
'
LAND3H=$(curl -s $B3/dashboard)
echo "$LAND3H" | grep -q '<figure class="hw-chart hw-power">' && echo "$LAND3H" | grep -q '<g class="hw-tag"><rect x="[0-9.]*" y="[0-9.]*" width="[0-9.]*" height="26" rx="13" fill="[^"]*"/>' \
  && echo "$LAND3H" | grep -q 'text-anchor="middle" dominant-baseline="central">Crickets 12 W</text></g>' && echo "$LAND3H" | grep -q 'dominant-baseline="central">22.4 °C</text></g>' \
  && [ "$(echo "$LAND3H" | grep -o '<figure class="hw-chart hw-power">' | wc -l)" = "1" ] && ! echo "$LAND3H" | grep -q '<figure class="hw-chart hw-energy' \
  && ok "each chart's newest reading stands in a pill above its line's end — Crickets 12 W on the one Power chart (named, the chart having several lines), 22.4 °C on the temperature's — 26 high, the text centred in it; no energy chart" || bad "the chart's pill is not drawn as it should be, or the power is not one chart"
grep -q 'const tagW = 20 + tagText.length \* 8.4, tagH = 26' src/views/pages/public.js && grep -q 'body.landing .hw-tag text { font-family: var(--display); font-size: 13px; font-weight: 600;' public/aura.css \
  && ok "the pill is sized from its text — 8.4 per character and 20 beside, at 13px — so it holds the figure whole" || bad "the pill's size is not set from its text"
echo "$LAND3H" | grep -q '<li><i style="background:[^"]*"></i><span class="hw-name">Crickets</span><span class="hw-range">low [0-9.]* · high [0-9.]*</span></li>' && echo "$LAND3H" | grep -q '<span class="hw-name">Food</span><span class="hw-range">low [0-9.]* · high [0-9.]*</span></li>' \
  && ! echo "$LAND3H" | grep -q 'hw-name">Crickets · power draw' && echo "$LAND3H" | grep -q '<title>Crickets · power draw</title>' && ! echo "$LAND3H" | grep -q 'hw-val' \
  && ok "the legend names each line with its low and high for the day, and no reading beside it — Crickets, Food, the shared · power draw dropped (the line's tooltip keeps it)" || bad "the legend still carries the reading, lost its range, or keeps the shared suffix"
# the charts fill their tiles: drawn for the width the page asks for (?w=, hardware.js measures its tiles — the type
# keeps its size on a desk and on a phone alike), 720 wide until it does; the legend's lines side by side under the plot;
# the folder the whole width of the dashboard at every desk width
HW340=$(curl -s "$B3/api/hardware?w=340")
echo "$HW340" | grep -q '"w":340' && echo "$HW340" | grep -q 'viewBox=\\"0 0 340 240\\"' && curl -s "$B3/api/hardware?w=9000" | grep -q '"w":1400' && curl -s "$B3/api/hardware?w=12" | grep -q '"w":720' && curl -s "$B3/api/hardware" | grep -q '"w":720' \
  && echo "$LAND3H" | grep -q '<div id="hw-live" data-poll="[0-9]*" data-version="[^"]*" data-w="720" data-h="240">' && echo "$LAND3H" | grep -q '<svg viewBox="0 0 720 240"' \
  && curl -s "$B3/api/hardware?w=400&h=150" | grep -q '"h":150' && curl -s "$B3/api/hardware?w=400&h=150" | grep -q 'viewBox=\\"0 0 400 150\\"' && curl -s "$B3/api/hardware?h=20" | grep -q '"h":240' && curl -s "$B3/api/hardware?h=9000" | grep -q '"h":400' \
  && grep -q "fetch('/api/hardware?' + (w ? 'w=' + w + '&' : '') + 'h=' + h, { cache: 'no-store' })" public/hardware.js && grep -q "if (j.html && j.version && (j.version !== version || w2 !== drawnW || h2 !== drawnH)) {" public/hardware.js && grep -q "setTimeout(fitNow, 50);" public/hardware.js \
  && grep -q "function wantH() { return onScreen ? Math.max(130, Math.min(240, Math.round(window.innerHeight \* 0.2))) : 240; }" public/hardware.js \
  && grep -q "return w > 0 ? Math.max(240, Math.min(1400, Math.round(w))) : 0;" public/hardware.js \
  && grep -q 'body.landing .hw-chart svg { max-height: none; }' public/aura.css && ! grep -q 'hw-chart svg { max-height: [0-9]' public/aura.css \
  && grep -q 'body.landing .hw-legend { flex-direction: row; flex-wrap: wrap; gap: 6px 26px; margin-top: 10px; }' public/aura.css && grep -q 'body.landing .hw-legend li { flex: 0 1 auto; display: grid; grid-template-columns: 8px auto;' public/aura.css \
  && grep -q 'body.landing .hw-charts { grid-template-columns: repeat(auto-fit, minmax(max(300px, calc(50% - 8px)), 1fr)); gap: 16px; }' public/aura.css \
  && grep -q 'body.landing .dash-grid > .span-12 { grid-column: 1 / -1; }' public/aura.css \
  && grep -q "tagY = lead.ey - 38 >= padT + 2 ? lead.ey - 38 : lead.ey + 12;" src/views/pages/public.js \
  && ok "a chart is drawn for the width its tile has — /api/hardware?w=340 draws it 340 wide, between 240 and 1400, 720 unasked — and the height the page asks (?h=, 120 to 400, 240 unasked: the screens ask for a fifth of a short screen) — fills the tile (no height cap), names its lines side by side beneath, two across where the panel is wide enough; the pill moves under the line's end where the line runs near the top; the dashboard's folder keeps the whole width on a narrow desk" || bad "the charts are not drawn for their tiles' width and the asked height"
echo "$LAND3H" | node -e '
let s = ""; process.stdin.on("data", (c) => s += c).on("end", () => {
  const i = s.indexOf("data-spec=\""); if (i < 0) process.exit(2);
  const raw = s.slice(i + 11, s.indexOf("\"", i + 11)).replace(/&quot;/g, "\"").replace(/&#39;/g, "\x27").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const names = JSON.parse(raw).series.map((x) => x.name);
  process.exit(names.includes("Cricket Temperature") && !names.some((n) => /power draw/.test(n)) && !names.includes("Food · energy used") && names.includes("Power · Food") ? 0 : 1);
});' && ok "the trends carry the cricket's temperature from the hardware but no power draw — a draw is not a trend — and the food meter once, as Power · Food, not again as hardware" || bad "a power draw or a metered counter is among the hardware trends, or the hardware is missing from them"
# the sixteen power entities in the sensor list, and the mock that stands in for Home Assistant answering for them
node -e '
const d = JSON.parse(require("fs").readFileSync("content/home-assistant.json", "utf8"));
const ch = ["crickets", "science_1", "science_2", "living", "table", "food", "water", "hydroponics"], names = ["Crickets", "Science 1", "Science 2", "Living", "Table", "Food", "Water", "Hydroponics"];
const by = Object.fromEntries(d.sensors.map((s) => [s.id, s]));
const ok = ch.every((c, i) => { const w = by[`habitat_power_${c}_leistung`], e = by[`habitat_power_${c}_energie`];
  return w && w.label === `${names[i]} · power draw` && w.unit === "W" && w.kind === "gauge" && e && e.label === `${names[i]} · energy used` && e.unit === "kWh" && e.kind === "counter"; })
  && !d.sensors.some((s) => /kitchen/.test(s.id)) && d.meals.meter === "habitat_power_food_energie" && d.sensors.length === 20 && /THE POWER CHANNELS/.test(d._note);
process.exit(ok ? 0 : 1);
' && ok "content/home-assistant.json names the eight power channels twice over — habitat_power_<channel>_leistung (W, a gauge: Crickets · power draw, …) and _energie (kWh, a counter: … · energy used) — twenty sensors with the cricket's temperature, NO₂, O₂ and CO; the meals read the food meter; no kitchen entity; the note says how the pairs are shown" || bad "the sensor list does not carry the sixteen power entities as it should"
curl -s -H "Authorization: Bearer x" localhost:8125/api/states/sensor.habitat_power_hydroponics_leistung | grep -q '"unit_of_measurement":"W"' && curl -s -H "Authorization: Bearer x" localhost:8125/api/states/sensor.habitat_power_crickets_energie | grep -q '"unit_of_measurement":"kWh"' \
  && [ "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer x" localhost:8125/api/states/sensor.habitat_power_kitchen_energie)" = "404" ] \
  && ok "the mock Home Assistant answers for all sixteen (a draw in W, a meter in kWh each) and no longer for the kitchen" || bad "tools/mock-home-assistant.js does not serve the sixteen power entities"
kill $SRV3 2>/dev/null; wait $SRV3 2>/dev/null
kill $MOCK 2>/dev/null; wait $MOCK 2>/dev/null
rm -rf "$DATA3" "$CONT3"

echo
[ $FAIL -eq 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $FAIL
