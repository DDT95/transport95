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


def text(node, path, default=""):
    child = node.find(path)
    return (child.text or "").strip() if child is not None else default


network = json.loads((ROOT / "traffic-network95.json").read_text())
segment_xml = ET.fromstring(fetch(f"{SYTADIN}/segments_dyn.xml"))
event_xml = ET.fromstring(fetch(f"{SYTADIN}/evenements.xml"))

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

snapshot = {
    "traffic": {
        "updated": segment_xml.attrib.get("DateDiffusion"), "source": "Sytadin · DIRIF",
        "features": {"type": "FeatureCollection", "features": traffic_features},
    },
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
print(f"{len(traffic_features)} tronçons Sytadin · {len(sales)} points de vente")
