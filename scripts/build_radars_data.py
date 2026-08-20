#!/usr/bin/env python3
"""Construit la couche des radars fixes du Val-d'Oise depuis data.gouv.fr."""

import csv
import io
import json
import urllib.request
from pathlib import Path

SOURCE_URL = "https://www.data.gouv.fr/api/1/datasets/r/17f7cfd9-a5fe-4b6a-9f5d-3625feaa396e"
ROOT = Path(__file__).resolve().parents[1]
BOUNDARY = ROOT.parent / "val-doise-sol-formes-urbaines" / "data" / "processed" / "departement95.geojson"
OUTPUT = ROOT / "radars95.js"


def inside_ring(lon, lat, ring):
    inside = False
    previous = ring[-1]
    for current in ring:
        x1, y1 = previous[:2]
        x2, y2 = current[:2]
        if (y1 > lat) != (y2 > lat):
            crossing = (x2 - x1) * (lat - y1) / (y2 - y1) + x1
            if lon < crossing:
                inside = not inside
        previous = current
    return inside


def inside_geometry(lon, lat, geometry):
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    return any(inside_ring(lon, lat, polygon[0]) and not any(inside_ring(lon, lat, hole) for hole in polygon[1:]) for polygon in polygons)


boundary = json.loads(BOUNDARY.read_text())["features"][0]["geometry"]
request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "DDT95-Atlas/1.0"})
text = urllib.request.urlopen(request, timeout=30).read().decode("latin-1")
rows = csv.DictReader(io.StringIO(text), delimiter=";")
radars = []
for row in rows:
    try:
        lat = float(row["Latitude"].strip())
        lon = float(row[" Longitude"].strip())
    except (KeyError, TypeError, ValueError):
        continue
    if not inside_geometry(lon, lat, boundary):
        continue
    radars.append({
        "id": row["Numéro de radar"].strip(),
        "type": row["Type de radar"].strip(),
        "commissioned": row["Date de mise en service"].strip(),
        "speed": row["VMA "].strip(),
        "lat": lat,
        "lon": lon,
    })

radars.sort(key=lambda item: item["id"])
payload = {
    "source": "Ministère de l'Intérieur · data.gouv.fr",
    "source_url": "https://www.data.gouv.fr/datasets/liste-des-radars-fixes-en-france",
    "updated": "2025-12-30",
    "items": radars,
}
OUTPUT.write_text("window.RADARS95 = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(f"{len(radars)} radars écrits dans {OUTPUT}")
