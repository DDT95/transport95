#!/usr/bin/env python3
"""Build the functional Val-d'Oise road network from IGN BD TOPO WFS exports.

The WFS is paged and the raw pages are intentionally kept in ``tmp/``.  The
browser payload retains only attributes useful to cartography and selection.
"""

import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
WFS = "https://data.geopf.fr/wfs/ows"


def raw_pages():
    """Return cached WFS pages, downloading the current IGN data if needed."""
    TMP.mkdir(exist_ok=True)
    start = 0
    while True:
        path = TMP / ("roads95-raw.json" if start == 0 else f"roads95-{start}.json")
        if not path.exists():
            query = urlencode(
                {
                    "SERVICE": "WFS",
                    "VERSION": "2.0.0",
                    "REQUEST": "GetFeature",
                    "TYPENAMES": "BDTOPO_V3:troncon_de_route",
                    "OUTPUTFORMAT": "application/json",
                    "SRSNAME": "CRS:84",
                    "COUNT": 5000,
                    "STARTINDEX": start,
                    "CQL_FILTER": "(insee_commune_gauche LIKE '95%' OR insee_commune_droite LIKE '95%') AND importance IN ('1','2','3')",
                }
            )
            path.write_bytes(urlopen(f"{WFS}?{query}", timeout=120).read())
        payload = json.loads(path.read_text())
        yield payload
        returned = len(payload.get("features", []))
        if returned < 5000:
            break
        start += 5000


def point_segment_distance(point, start, end):
    x, y = point[:2]
    x1, y1 = start[:2]
    x2, y2 = end[:2]
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return (x - x1) ** 2 + (y - y1) ** 2
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    px, py = x1 + t * dx, y1 + t * dy
    return (x - px) ** 2 + (y - py) ** 2


def simplify(points, tolerance=0.000025):
    """Small Douglas-Peucker simplifier; about 2 m at Val-d'Oise latitude."""
    if len(points) <= 2:
        return [p[:2] for p in points]
    maximum, index = 0, 0
    for position in range(1, len(points) - 1):
        distance = point_segment_distance(points[position], points[0], points[-1])
        if distance > maximum:
            maximum, index = distance, position
    if maximum > tolerance * tolerance:
        left = simplify(points[: index + 1], tolerance)
        right = simplify(points[index:], tolerance)
        return left[:-1] + right
    return [points[0][:2], points[-1][:2]]


def first(value, fallback=None):
    if value in (None, ""):
        return fallback
    return str(value).split("/")[0]


features = []
seen = set()
for payload in raw_pages():
    for feature in payload.get("features", []):
        source = feature.get("properties", {})
        identifier = source.get("cleabs")
        if not identifier or identifier in seen:
            continue
        seen.add(identifier)
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "LineString":
            continue
        number = first(source.get("cpx_numero"))
        name = first(
            source.get("cpx_toponyme_route_nommee"),
            source.get("nom_voie_ban_gauche") or source.get("nom_voie_ban_droite"),
        )
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": identifier,
                    "numero": number,
                    "toponyme": name,
                    "importance": int(source.get("importance") or 5),
                    "nature": source.get("nature"),
                    "classement": first(source.get("cpx_classement_administratif")),
                    "gestionnaire": first(source.get("cpx_gestionnaire")),
                    "nombre_de_voies": source.get("nombre_de_voies"),
                    "vitesse_moyenne": source.get("vitesse_moyenne_vl"),
                    "sens": source.get("sens_de_circulation"),
                    "urbain": source.get("urbain"),
                    "date_modification": source.get("date_modification"),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": simplify(geometry.get("coordinates", [])),
                },
            }
        )

output = {"type": "FeatureCollection", "features": features}
(ROOT / "roads95.js").write_text(
    "window.ROADS95=" + json.dumps(output, ensure_ascii=False, separators=(",", ":")) + ";\n"
)
print(f"roads95.js: {len(features)} tronçons BD TOPO d'importance 1 à 3")
