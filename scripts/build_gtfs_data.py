import csv, json, zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZIP = Path('/tmp/idfm-gtfs.zip')
GEO = Path('/tmp/communes95.geojson')

def rings(geometry):
    if geometry['type'] == 'Polygon': return [geometry['coordinates']]
    if geometry['type'] == 'MultiPolygon': return geometry['coordinates']
    return []

def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i, (xi, yi, *_) in enumerate(ring):
        xj, yj = ring[j][:2]
        if ((yi > y) != (yj > y)) and x < (xj-xi)*(y-yi)/(yj-yi or 1e-20)+xi: inside = not inside
        j = i
    return inside

communes = json.load(GEO.open())
polygons = [p for f in communes['features'] for p in rings(f['geometry'])]
def inside95(lon, lat):
    return any(in_ring(lon, lat, p[0]) and not any(in_ring(lon,lat,h) for h in p[1:]) for p in polygons)

with zipfile.ZipFile(ZIP) as z:
    def rows(name): return csv.DictReader((line.decode('utf-8-sig') for line in z.open(name)))
    routes = {r['route_id']:{'id':r['route_id'],'short':r['route_short_name'],'long':r['route_long_name'],'type':r['route_type'],'color':r['route_color'] or '000091','text':r['route_text_color'] or 'FFFFFF'} for r in rows('routes.txt')}
    stops = {}
    for s in rows('stops.txt'):
        try: lat,lon=float(s['stop_lat']),float(s['stop_lon'])
        except: continue
        if inside95(lon,lat): stops[s['stop_id']]={'id':s['stop_id'],'name':s['stop_name'],'lat':lat,'lon':lon,'wheelchair':s.get('wheelchair_boarding','0')}
    trip_route = {t['trip_id']:t['route_id'] for t in rows('trips.txt')}
    stop_routes=defaultdict(set)
    for st in rows('stop_times.txt'):
        sid=st['stop_id']
        if sid in stops:
            rid=trip_route.get(st['trip_id'])
            if rid: stop_routes[sid].add(rid)

used=set()
for sid,s in stops.items():
    s['routes']=sorted(stop_routes[sid]); used.update(s['routes'])
payload={'stops':list(stops.values()),'routes':{rid:routes[rid] for rid in used if rid in routes}}
out='window.MOBILITY95='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\nwindow.COMMUNES95='+json.dumps(communes,ensure_ascii=False,separators=(',',':'))+';\n'
(ROOT/'mobility95.js').write_text(out,encoding='utf-8')
print(f"{len(stops)} arrêts, {len(payload['routes'])} lignes, {len(out)/1024:.0f} Kio")
