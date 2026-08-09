#!/usr/bin/env python3
"""Build a browser-safe Val-d'Oise snapshot from official open feeds."""

import json
import os
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SYTADIN = "https://www.sytadin.fr/diffusion/xml"
SALES_API = "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/points-de-vente/records"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "DDT95-transport-observatory/1.0"})
    error = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read()
        except Exception as exc:
            error = exc
            if attempt < 3:
                time.sleep(1.5 * (attempt + 1))
    raise error


def fetch_xml(url, attempts=5):
    """Fetch and parse XML, retrying on transport errors AND malformed
    responses (Sytadin occasionally serves a truncated/corrupt payload
    even on a 200 OK, which a plain network retry wouldn't catch)."""
    error = None
    for attempt in range(attempts):
        try:
            return ET.fromstring(fetch(url))
        except ET.ParseError as exc:
            error = exc
            if attempt < attempts - 1:
                time.sleep(2 * (attempt + 1))
    raise error


def text(node, path, default=""):
    child = node.find(path)
    return (child.text or "").strip() if child is not None else default


PREVIOUS_SNAPSHOT = None
_live_path = ROOT / "live95.js"
if _live_path.exists():
    _live_text = _live_path.read_text()
    _prefix = "window.LIVE95="
    if _live_text.startswith(_prefix):
        try:
            PREVIOUS_SNAPSHOT = json.loads(_live_text[len(_prefix):].rstrip("\n;"))
        except json.JSONDecodeError:
            PREVIOUS_SNAPSHOT = None

network = json.loads((ROOT / "traffic-network95.json").read_text())
try:
    segment_xml = fetch_xml(f"{SYTADIN}/segments_dyn.xml")
    event_xml = fetch_xml(f"{SYTADIN}/evenements.xml")
    sytadin_ok = True
except Exception as exc:
    print(f"Avertissement : flux Sytadin indisponible/mal formé ({exc}), conservation des dernières données trafic connues.")
    segment_xml = ET.Element("root")
    event_xml = ET.Element("root")
    sytadin_ok = False

states = {}
for segment in segment_xml.findall(".//SegmentDynamique"):
    states[int(segment.attrib["ID_SEGMENT"])] = {
        "state": text(segment, "EtatTrafic", "Non renseigné").replace("Non renseigne", "Non renseigné"),
        "closure": text(segment, "EtatCapacite/EtatFermeture", "Nominal"),
        "closed_lanes": sum(int(text(segment, f"EtatCapacite/{name}", "0") or 0) for name in (
            "NbVoiesFermeesDroite", "NbVoiesFermeesCentre", "NbVoiesFermeesGauche"
        )),
    }

events = {}
for event in event_xml.findall(".//Evenement"):
    event_type = text(event, ".//QualificationTypeEvenement", "Événement")
    detail = next((text(event, path) for path in (
        ".//NatureTravaux", ".//NatureAccident", ".//NaturePanne", "Commentaire"
    ) if text(event, path)), event_type)
    item = {
        "id": event.attrib.get("ID_EVT"),
        "type": re.sub(r"(?<!^)([A-Z])", r" \1", event_type),
        "detail": detail,
        "start": text(event, "DateDebut"),
        "end": text(event, "DateFinPrevue"),
    }
    for sid in event.findall(".//Segments/Segment"):
        if sid.text and sid.text.isdigit():
            events.setdefault(int(sid.text), []).append(item)

traffic_features = []
for feature in network["features"]:
    props = feature["properties"]
    sid = int(props["id_segment"])
    live = states.get(sid, {"state": "Non renseigné", "closure": "Nominal", "closed_lanes": 0})
    match = re.search(r"SEG/([^-/]+)", props.get("nom_segment", ""))
    feature["properties"] = {
        "id": sid,
        "road": match.group(1) if match else props.get("nom_segment", "Route"),
        "operator": props.get("partenaire", "DIRIF"),
        **live,
        "events": events.get(sid, []),
    }
    if live["state"] != "Non renseigné" or sid in events:
        traffic_features.append(feature)


def sales_page(offset):
    query = urllib.parse.urlencode({
        "where": "startswith(pdvpostcode, '95')",
        "limit": 100,
        "offset": offset,
        "order_by": "pdvtown,pdvname",
    })
    return json.loads(fetch(f"{SALES_API}?{query}"))


sales = []
offset = 0
while True:
    page = sales_page(offset)
    for point in page.get("results", []):
        if point.get("pdvlatitude") is None or point.get("pdvlongitude") is None:
            continue
        address = " ".join(str(value) for value in (
            point.get("pdvhousenumber"), point.get("pdvstreet"), point.get("pdvpostcode"), point.get("pdvtown")
        ) if value)
        sales.append({
            "id": point.get("pdvid"), "name": point.get("pdvname"),
            "type": point.get("pdvtypename"), "service": point.get("servicetype"),
            "hours": point.get("pdvopeninghours"), "address": address,
            "easy": bool(point.get("pdveasyautomate")),
            "lat": point["pdvlatitude"], "lon": point["pdvlongitude"],
        })
    offset += len(page.get("results", []))
    if offset >= page.get("total_count", 0) or not page.get("results"):
        break

if sytadin_ok:
    traffic = {
        "updated": segment_xml.attrib.get("DateDiffusion"), "source": "Sytadin · DIRIF",
        "features": {"type": "FeatureCollection", "features": traffic_features},
    }
elif PREVIOUS_SNAPSHOT and "traffic" in PREVIOUS_SNAPSHOT:
    traffic = PREVIOUS_SNAPSHOT["traffic"]
else:
    traffic = {
        "updated": None, "source": "Sytadin · DIRIF",
        "features": {"type": "FeatureCollection", "features": []},
    }

snapshot = {
    "traffic": traffic,
    "sales": {
        "updated": "2026-06-04", "source": "Île-de-France Mobilités · PRIM", "points": sales,
    },
    "transit": {
        "status": "configured" if os.getenv("IDFM_API_KEY") else "token-required",
        "source": "API Messages Info Trafic IDFM", "disruptions": [],
    },
}
(ROOT / "live95.js").write_text(
    "window.LIVE95=" + json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + ";\n"
)
traffic_count = len(traffic_features) if sytadin_ok else len(traffic["features"]["features"])
traffic_note = "" if sytadin_ok else " (données précédentes conservées)"
print(f"{traffic_count} tronçons Sytadin{traffic_note} · {len(sales)} points de vente")
