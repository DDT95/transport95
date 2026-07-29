#!/usr/bin/env python3
"""Build Val-d'Oise EV charging and carpooling datasets from national bases."""

import csv
import json
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
TMP.mkdir(exist_ok=True)


def current_resource(dataset_slug, title):
    api = f"https://www.data.gouv.fr/api/1/datasets/{dataset_slug}/"
    dataset = json.load(urlopen(api, timeout=60))
    resource = next(item for item in dataset["resources"] if title(item))
    return resource["url"], resource.get("last_modified") or dataset.get("last_update")


def download(url, filename):
    path = TMP / filename
    path.write_bytes(urlopen(url, timeout=240).read())
    return path


irve_url, irve_date = current_resource(
    "base-nationale-des-irve-infrastructures-de-recharge-pour-vehicules-electriques",
    lambda resource: resource.get("format") == "csv"
    and "dernière version" in resource.get("title", ""),
)
carpool_url, carpool_date = current_resource(
    "base-nationale-des-lieux-de-covoiturage",
    lambda resource: resource.get("title") == "bnlc.csv",
)

stations = {}
with download(irve_url, "irve-national.csv").open(encoding="utf-8-sig", newline="") as source:
    for row in csv.DictReader(source):
        if not (row.get("code_insee_commune") or "").startswith("95"):
            continue
        try:
            lon = float(row["consolidated_longitude"])
            lat = float(row["consolidated_latitude"])
        except (TypeError, ValueError):
            continue
        key = row.get("id_station_itinerance") or row.get("id_station_local") or f"{lon},{lat}"
        station = stations.setdefault(
            key,
            {
                "id": key,
                "name": row.get("nom_station") or row.get("nom_enseigne") or "Station de recharge",
                "brand": row.get("nom_enseigne"),
                "operator": row.get("nom_operateur"),
                "address": row.get("adresse_station"),
                "commune": row.get("consolidated_commune"),
                "lon": lon,
                "lat": lat,
                "implantation": row.get("implantation_station"),
                "hours": row.get("horaires"),
                "access": row.get("condition_acces"),
                "pmr": row.get("accessibilite_pmr"),
                "free": row.get("gratuit") == "true",
                "payment_card": row.get("paiement_cb") == "true",
                "payment_act": row.get("paiement_acte") == "true",
                "reservation": row.get("reservation") == "true",
                "updated": row.get("date_maj"),
                "points": set(),
                "max_power": 0,
                "plugs": set(),
            },
        )
        station["points"].add(row.get("id_pdc_itinerance") or row.get("id_pdc_local") or key)
        try:
            station["max_power"] = max(station["max_power"], float(row.get("puissance_nominale") or 0))
        except ValueError:
            pass
        for field, label in (
            ("prise_type_2", "Type 2"),
            ("prise_type_combo_ccs", "Combo CCS"),
            ("prise_type_chademo", "CHAdeMO"),
            ("prise_type_ef", "E/F"),
            ("prise_type_autre", "Autre"),
        ):
            if row.get(field) == "true":
                station["plugs"].add(label)

charging = []
for station in stations.values():
    station["points"] = len(station["points"])
    station["plugs"] = sorted(station["plugs"])
    charging.append(station)

carpooling = []
with download(carpool_url, "bnlc.csv").open(encoding="utf-8-sig", newline="") as source:
    for row in csv.DictReader(source):
        if not (row.get("insee") or "").startswith("95") or row.get("ouvert") != "true":
            continue
        try:
            lon, lat = float(row["Xlong"]), float(row["Ylat"])
        except (TypeError, ValueError):
            continue
        carpooling.append(
            {
                "id": row.get("id_lieu"),
                "name": row.get("nom_lieu") or "Lieu de covoiturage",
                "address": row.get("ad_lieu"),
                "commune": row.get("com_lieu"),
                "type": row.get("type"),
                "lon": lon,
                "lat": lat,
                "spaces": row.get("nbre_pl"),
                "pmr_spaces": row.get("nbre_pmr"),
                "duration": row.get("duree"),
                "hours": row.get("horaires"),
                "lighting": row.get("lumiere"),
                "owner": row.get("proprio"),
                "updated": row.get("date_maj"),
            }
        )

payload = {
    "charging": charging,
    "carpooling": carpooling,
    "updated": {"charging": irve_date, "carpooling": carpool_date},
}
(ROOT / "shared-mobility95.js").write_text(
    "window.SHARED_MOBILITY95=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
)
print(f"{len(charging)} stations IRVE · {len(carpooling)} lieux de covoiturage")
