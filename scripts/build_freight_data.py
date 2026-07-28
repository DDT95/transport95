#!/usr/bin/env python3
"""Construit les couches fret/logistique locales depuis les sources ouvertes."""

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp" / "freight"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


ite_source = load(TMP / "ite3000.geojson")
ites = []
for feature in ite_source["features"]:
    props = feature.get("properties", {})
    if not str(props.get("code_postal", "")).startswith("95"):
        continue
    keep = {
        key: props.get(key)
        for key in (
            "id_ite", "raison_sociale", "commune", "adresse", "utilisation_ite",
            "etat_ite", "type_etablissement", "reception_marchandises",
            "expedie_marchandises", "convention_active", "circulation_recente",
            "produit_transporte", "marchandises_recue", "marchandises_expediees",
            "classe_tonnage", "frequence_trains", "nombre_de_voies",
            "accessibilite", "code_ligne",
        )
    }
    ites.append({"type": "Feature", "properties": keep, "geometry": feature["geometry"]})

areas_path = TMP / "logistics95.geojson"
areas_path.unlink(missing_ok=True)
subprocess.run(
    [
        "ogr2ogr", "-f", "GeoJSON", "-overwrite", str(areas_path),
        str(TMP / "logistics.gpkg"), "contour_aires_logistiques",
        "-clipsrc", "1.55", "48.80", "2.65", "49.30",
    ],
    check=True,
)
areas = load(areas_path)
unique_areas = {}
for feature in areas["features"]:
    key = json.dumps(feature.get("geometry"), sort_keys=True)
    unique_areas[key] = feature
areas["features"] = list(unique_areas.values())

multimodal_source = load(TMP / "multimodal.json")
selected_sites = {
    "Port de Bruyères-sur-Oise",
    "Port de St-Ouen-l'Aumône",
    "Port d'Argenteuil",
    "Goussainville",
    "Argenteuil",
    "Carex",
}
sites_by_key = {}
for record in multimodal_source:
    fields = record.get("fields", {})
    if fields.get("nom_site") not in selected_sites:
        continue
    site = {
            "type": "Feature",
            "properties": {
                "nom": fields.get("nom_site"),
                "mode": fields.get("mode"),
                "source": "Région Île-de-France · SDRIF",
            },
            "geometry": record["geometry"],
        }
    sites_by_key[(fields.get("nom_site"), fields.get("mode"))] = site
sites = list(sites_by_key.values())

payload = {
    "ite": {"type": "FeatureCollection", "features": ites},
    "areas": areas,
    "multimodal": {"type": "FeatureCollection", "features": sites},
    "meta": {
        "ite_source": "Cerema · ITE 3000 · 2026",
        "areas_source": "SDES · Répertoire national des entrepôts et plateformes logistiques",
        "multimodal_source": "Région Île-de-France · SDRIF",
    },
}
(ROOT / "freight95.js").write_text(
    "window.FREIGHT95=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
print(f"{len(ites)} ITE · {len(areas['features'])} aires logistiques · {len(sites)} sites multimodaux")
