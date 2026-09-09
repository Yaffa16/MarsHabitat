#!/usr/bin/env python3
"""Print a Home Assistant sensor as plain lines: time + value.

Same options and endpoints as marsSensorData.py, standard library only.
Nothing to do with the station or its container — talks to Home Assistant.

  python3 ha-print.py --env path/to/.env                 current value of every station sensor
  python3 ha-print.py --env path/to/.env --day           every reading of the last 24 h
  python3 ha-print.py --env path/to/.env --hour          the last hour
  python3 ha-print.py --env path/to/.env -s shelly_steckdose_2_energie --day
  HA_HOST=192.168.225.23 HA_API_TOKEN=... python3 ha-print.py --day     (without a .env)
  python3 ha-print.py ... --json                          raw JSON as Home Assistant sends it
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Berlin")

# The station's sensors (content/home-assistant.json) — entity ids without "sensor."
SENSORS = [
    ("sonoff_temperatur_temperature_1", "Cricket Terrarium Temperature"),
    ("shelly_steckdose_2_energie", "Socket energy · Shelly plug"),
]

HA_HOST = os.environ.get("HA_HOST", "")
HA_PORT = os.environ.get("HA_PORT", "80")
HA_API_TOKEN = os.environ.get("HA_API_TOKEN", "")

MODE = "now"       # now | day | hour
SENSOR = None      # one entity, or None for all in SENSORS
RAW = False
ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


def load_env(path):
    """Read HA_HOST / HA_PORT / HA_API_TOKEN from the station's .env (never printed)."""
    global HA_HOST, HA_PORT, HA_API_TOKEN
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                v = v.strip().strip('"').strip("'")
                if k.strip() == "HA_HOST" and not os.environ.get("HA_HOST"):
                    HA_HOST = v
                elif k.strip() == "HA_PORT" and not os.environ.get("HA_PORT"):
                    HA_PORT = v
                elif k.strip() == "HA_API_TOKEN" and not os.environ.get("HA_API_TOKEN"):
                    HA_API_TOKEN = v
        return True
    except OSError:
        return False


args = sys.argv[1:]
i = 0
while i < len(args):
    key = args[i]
    if key in ("--help", "help"):
        print(__doc__)
        sys.exit(0)
    elif key in ("-h", "--host"):
        HA_HOST = args[i + 1]; i += 2
    elif key in ("-p", "--port"):
        HA_PORT = args[i + 1]; i += 2
    elif key in ("-s", "--sensor"):
        SENSOR = args[i + 1].removeprefix("sensor."); i += 2
    elif key in ("-t", "--token"):
        HA_API_TOKEN = args[i + 1]; i += 2
    elif key == "--env":
        ENV_FILE = args[i + 1]; i += 2
    elif key == "--hour":
        MODE = "hour"; i += 1
    elif key in ("-d", "--day"):
        MODE = "day"; i += 1
    elif key in ("-n", "--now"):
        MODE = "now"; i += 1
    elif key == "--json":
        RAW = True; i += 1
    else:
        print(f"ERROR: unknown argument {key}", file=sys.stderr)
        sys.exit(1)

env_loaded = load_env(ENV_FILE)

if not HA_API_TOKEN:
    print("ERROR: no API token — give --env path/to/mars-station/.env, or --token TOKEN, or HA_API_TOKEN=...", file=sys.stderr)
    sys.exit(1)
if not HA_HOST:
    print("ERROR: no host — give --env path/to/mars-station/.env, or --host HOST, or HA_HOST=...", file=sys.stderr)
    sys.exit(1)


def call(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {HA_API_TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode("utf-8", "replace").strip()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace").strip()
    except urllib.error.URLError as e:
        print(f"ERROR: cannot reach {url}\n  {e.reason}\n  This PC must be on the same network as the habitat hardware.", file=sys.stderr)
        sys.exit(1)


def when(iso):
    if not iso:
        return "—"
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(TZ).strftime("%d/%m/%Y %H:%M:%S")


def fetch(sensor):
    base = f"http://{HA_HOST}:{HA_PORT}"
    if MODE == "now":
        return call(f"{base}/api/states/sensor.{sensor}")
    period = ""
    if MODE == "hour":
        period = "/" + (datetime.now(timezone.utc) - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    return call(f"{base}/api/history/period{period}?filter_entity_id=sensor.{sensor}&minimal_response")


print(f"Home Assistant at http://{HA_HOST}:{HA_PORT}  ({'settings from ' + ENV_FILE if env_loaded else 'settings from environment / arguments'})")
print()

targets = [(SENSOR, SENSOR)] if SENSOR else SENSORS
for sensor, label in targets:
    status, body = fetch(sensor)
    if status != 200:
        print(f"{label}  [sensor.{sensor}]\n  HTTP {status}: {body[:200]}\n")
        continue
    data = json.loads(body)
    if RAW:
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print()
        continue

    if MODE == "now":
        unit = (data.get("attributes") or {}).get("unit_of_measurement", "")
        name = (data.get("attributes") or {}).get("friendly_name") or label
        print(f"{name}  [sensor.{sensor}]")
        print(f"  now: {data.get('state')} {unit}  at {when(data.get('last_updated'))}")
    else:
        rows = data[0] if data else []
        # with minimal_response only the first row carries attributes
        unit = ((rows[0].get("attributes") or {}) if rows else {}).get("unit_of_measurement", "")
        name = ((rows[0].get("attributes") or {}) if rows else {}).get("friendly_name") or label
        print(f"{name}  [sensor.{sensor}]  — {'last hour' if MODE == 'hour' else 'last 24 h'}, {len(rows)} readings")
        if not rows:
            print("  (nothing recorded in this window)")
        for r in rows:
            state = r.get("state")
            if state in ("unavailable", "unknown", None):
                continue
            print(f"  {when(r.get('last_changed') or r.get('last_updated'))}   {state} {unit}")
    print()
