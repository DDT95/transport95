import csv, json, zipfile
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; ZIP=Path('/tmp/idfm-gtfs.zip'); GEO=Path('/tmp/communes95.geojson'); DAY='20260727'
def rings(g): return [g['coordinates']] if g['type']=='Polygon' else g['coordinates'] if g['type']=='MultiPolygon' else []
def in_ring(x,y,r):
    inside=False;j=len(r)-1
    for i,p in enumerate(r):
        xi,yi=p[:2];xj,yj=r[j][:2]
        if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi or 1e-20)+xi: inside=not inside
        j=i
    return inside
communes=json.load(GEO.open()); polys=[]
for f in communes['features']:
    for p in rings(f['geometry']):
        xs=[v[0] for v in p[0]];ys=[v[1] for v in p[0]];polys.append((min(xs),min(ys),max(xs),max(ys),p))
def inside95(x,y): return any(a<=x<=c and b<=y<=d and in_ring(x,y,p[0]) and not any(in_ring(x,y,h) for h in p[1:]) for a,b,c,d,p in polys)
with zipfile.ZipFile(ZIP) as z:
    def rows(n): return csv.DictReader((x.decode('utf-8-sig') for x in z.open(n)))
    route_raw={r['route_id']:r for r in rows('routes.txt')}
    stops={}; all_stop_names={}
    for s in rows('stops.txt'):
        all_stop_names[s['stop_id']]=s['stop_name']
        try: lat,lon=float(s['stop_lat']),float(s['stop_lon'])
        except: continue
        if inside95(lon,lat): stops[s['stop_id']]={'id':s['stop_id'],'name':s['stop_name'],'lat':lat,'lon':lon,'parent':s.get('parent_station') or '', 'location':s.get('location_type') or '0','wheelchair':s.get('wheelchair_boarding','0'),'platform':s.get('platform_code') or ''}
    trips={t['trip_id']:{'route':t['route_id'],'service':t['service_id'],'headsign':t['trip_headsign'],'direction':t['direction_id'],'shape':t['shape_id']} for t in rows('trips.txt')}
    active=set()
    if 'calendar.txt' in z.namelist():
        for c in rows('calendar.txt'):
            if c['start_date']<=DAY<=c['end_date'] and c['monday']=='1': active.add(c['service_id'])
    for e in rows('calendar_dates.txt'):
        if e['date']==DAY:
            (active.add if e['exception_type']=='1' else active.discard)(e['service_id'])
    stop_routes=defaultdict(set); used_trips=set(); route_times=defaultdict(list); trip_sequences=defaultdict(list)
    for st in rows('stop_times.txt'):
        sid=st['stop_id'];t=trips.get(st['trip_id'])
        if sid not in stops or not t: continue
        rid=t['route'];stop_routes[sid].add(rid);used_trips.add(st['trip_id'])
        if t['service'] in active and st['departure_time']: route_times[(sid,rid)].append(st['departure_time'][:5])
        trip_sequences[st['trip_id']].append((int(st['stop_sequence']),sid))
trip_terminals={}; direction_times=defaultdict(list)
with zipfile.ZipFile(ZIP) as z:
    def rows3(n): return csv.DictReader((x.decode('utf-8-sig') for x in z.open(n)))
    trip_ends={}; trip_local=defaultdict(list)
    for st in rows3('stop_times.txt'):
        if st['trip_id'] in used_trips:
            tid=st['trip_id'];order=int(st['stop_sequence']);sid=st['stop_id'];state=trip_ends.setdefault(tid,[order,sid,order,sid])
            if order<state[0]: state[0:2]=[order,sid]
            if order>state[2]: state[2:4]=[order,sid]
            if sid in stops and st['departure_time'] and trips[tid]['service'] in active: trip_local[tid].append((sid,st['departure_time'][:5]))
for tid,state in trip_ends.items():
    destination=all_stop_names.get(state[3],state[3]);trip_terminals[tid]=destination
    rid=trips[tid]['route']
    for sid,time in trip_local.get(tid,[]): direction_times[(sid,rid,destination)].append(time)
direction_index=defaultdict(dict)
for (sid,rid,destination),times in direction_times.items(): direction_index[(sid,rid)][destination]=sorted(set(times))
used_routes={trips[t]['route'] for t in used_trips}; route_trips=defaultdict(list)
for tid in used_trips: route_trips[trips[tid]['route']].append(tid)
routes={}
for rid in used_routes:
    r=route_raw.get(rid,{});tids=route_trips[rid];heads=sorted({trip_terminals[t] for t in tids if trip_terminals.get(t)});sample=max(tids,key=lambda t:len(trip_sequences[t]))
    seq=[{'id':s,'name':stops[s]['name']} for _,s in sorted(trip_sequences[sample]) if s in stops]
    routes[rid]={'id':rid,'short':r.get('route_short_name',''),'long':r.get('route_long_name',''),'type':r.get('route_type','3'),'color':r.get('route_color') or '000091','text':r.get('route_text_color') or 'FFFFFF','destinations':heads[:8],'stops':seq,'shape':trips[sample]['shape']}
shape_ids={r['shape'] for r in routes.values() if r['shape']};shape_points=defaultdict(list)
with zipfile.ZipFile(ZIP) as z:
    def rows2(n): return csv.DictReader((x.decode('utf-8-sig') for x in z.open(n)))
    for p in rows2('shapes.txt'):
        if p['shape_id'] in shape_ids: shape_points[p['shape_id']].append((int(p['shape_pt_sequence']),round(float(p['shape_pt_lat']),6),round(float(p['shape_pt_lon']),6)))
for r in routes.values():
    pts=sorted(shape_points.get(r['shape'],[])); step=max(1,len(pts)//180);r['geometry']=[[lat,lon] for _,lat,lon in pts[::step]];r.pop('shape',None)
for sid,s in stops.items():
    s['routes']=sorted(stop_routes[sid]);s['times']={rid:sorted(set(route_times[(sid,rid)])) for rid in s['routes'] if route_times[(sid,rid)]};s['directions']={rid:direction_index[(sid,rid)] for rid in s['routes'] if direction_index[(sid,rid)]}
hubs={}
for s in stops.values():
    key=s['parent'] or s['id'];h=hubs.setdefault(key,{'id':key,'name':s['name'],'lat':0,'lon':0,'n':0,'routes':set(),'stops':[]});h['lat']+=s['lat'];h['lon']+=s['lon'];h['n']+=1;h['routes'].update(s['routes']);h['stops'].append(s['id'])
for h in hubs.values(): h['lat']=round(h['lat']/h['n'],6);h['lon']=round(h['lon']/h['n'],6);h['routes']=sorted(h['routes'])
payload={'date':DAY,'stops':list(stops.values()),'hubs':list(hubs.values()),'routes':routes}
out='window.MOBILITY95='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\nwindow.COMMUNES95='+json.dumps(communes,ensure_ascii=False,separators=(',',':'))+';\n';(ROOT/'mobility95.js').write_text(out,encoding='utf-8');print(len(stops),len(hubs),len(routes),round(len(out)/1024),'Kio')
