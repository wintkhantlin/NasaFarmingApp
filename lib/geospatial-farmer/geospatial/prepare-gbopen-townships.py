"""Prepare openly licensed geoBoundaries gbOpen ADM3 Myanmar Townships.
Source: geoBoundaries gbOpen (William & Mary geoLab / USAID Burma, Myanmar Analytics Project)
License: Creative Commons Attribution 4.0 International (CC BY 4.0)
API: https://www.geoboundaries.org/api/current/gbOpen/MMR/ADM3/
"""
import json
import gzip
from pathlib import Path

def get_bbox(coords, gtype):
    polys = [coords] if gtype == 'Polygon' else coords
    minx, miny, maxx, maxy = float('inf'), float('inf'), float('-inf'), float('-inf')
    for poly in polys:
        for ring in poly:
            for x, y in ring:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    return (minx, miny, maxx, maxy)

def point_in_bbox(x, y, bbox):
    return bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3]

def point_in_poly(x, y, poly):
    ring = poly[0]
    n = len(ring)
    inside = False
    p1x, p1y = ring[0]
    for i in range(n + 1):
        p2x, p2y = ring[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def geom_contains(geom, bbox, x, y):
    if not point_in_bbox(x, y, bbox):
        return False
    gtype = geom['type']
    coords = geom['coordinates']
    if gtype == 'Polygon':
        return point_in_poly(x, y, coords)
    elif gtype == 'MultiPolygon':
        return any(point_in_poly(x, y, poly) for poly in coords)
    return False

def get_all_pts(geom):
    coords = geom['coordinates']
    polys = [coords] if geom['type'] == 'Polygon' else coords
    pts = []
    for poly in polys:
        for ring in poly:
            for pt in ring:
                pts.append(pt)
    return pts

def round_coords(obj, precision=5):
    if isinstance(obj, (int, float)):
        return round(obj, precision)
    elif isinstance(obj, list):
        return [round_coords(item, precision) for item in obj]
    return obj

def main():
    with open('/private/tmp/gb-adm1.json') as f:
        adm1 = json.load(f)
    with open('/private/tmp/gb-adm2.json') as f:
        adm2 = json.load(f)
    with open('/private/tmp/gb-adm3.json') as f:
        adm3 = json.load(f)

    # Compute bboxes for adm1 and adm2
    for r in adm1['features']:
        r['bbox'] = get_bbox(r['geometry']['coordinates'], r['geometry']['type'])
    for d in adm2['features']:
        d['bbox'] = get_bbox(d['geometry']['coordinates'], d['geometry']['type'])

    # 1. Map each ADM2 district to its unique parent ADM1 state
    district_to_state = {}
    for d in adm2['features']:
        pts = get_all_pts(d['geometry'])
        sample = pts[::max(1, len(pts) // 30)]
        votes = {}
        for pt in sample:
            for r in adm1['features']:
                if geom_contains(r['geometry'], r['bbox'], pt[0], pt[1]):
                    sname = r['properties']['shapeName']
                    votes[sname] = votes.get(sname, 0) + 1
        assert votes, f"No parent state found for district {d['properties']['shapeName']}"
        best_state = max(votes.items(), key=lambda x: x[1])[0]
        st_obj = next(r for r in adm1['features'] if r['properties']['shapeName'] == best_state)
        district_to_state[d['properties']['shapeID']] = {
            'ST': best_state,
            'ST_ID': st_obj['properties']['shapeID']
        }

    # 2. Map each ADM3 township to its ADM2 district
    features = []
    seen_pcodes = set()

    for f in adm3['features']:
        pts = get_all_pts(f['geometry'])
        sample = pts[::max(1, len(pts) // 20)]
        d_votes = {}
        for pt in sample:
            for d in adm2['features']:
                if geom_contains(d['geometry'], d['bbox'], pt[0], pt[1]):
                    did = d['properties']['shapeID']
                    d_votes[did] = d_votes.get(did, 0) + 1

        if not d_votes:
            # Fallback for coastal archipelago points
            for pt in pts:
                for d in adm2['features']:
                    if geom_contains(d['geometry'], d['bbox'], pt[0], pt[1]):
                        did = d['properties']['shapeID']
                        d_votes[did] = d_votes.get(did, 0) + 1
                        break
                if d_votes:
                    break

        assert d_votes, f"No district found for township {f['properties']['shapeName']}"
        best_dist_id = max(d_votes.items(), key=lambda x: x[1])[0]
        dist_obj = next(d for d in adm2['features'] if d['properties']['shapeID'] == best_dist_id)

        dt = dist_obj['properties']['shapeName']
        dt_id = dist_obj['properties']['shapeID']
        st_info = district_to_state[dt_id]
        st = st_info['ST']
        st_id = st_info['ST_ID']

        ts = f['properties']['shapeName']
        ts_id = f['properties']['shapeID']

        ts_pcode = f"GB-MMR-{ts_id}"
        assert ts_pcode not in seen_pcodes, f"Duplicate code: {ts_pcode}"
        seen_pcodes.add(ts_pcode)

        gtype = f['geometry']['type']
        assert gtype in ('Polygon', 'MultiPolygon')
        coords = round_coords(f['geometry']['coordinates'], 5)

        props = {
            'ST': st,
            'ST_PCODE': f"GB-MMR-{st_id}",
            'DT': dt,
            'DT_PCODE': f"GB-MMR-{dt_id}",
            'TS': ts,
            'TS_PCODE': ts_pcode,
            'TS_MMR': '',
        }

        features.append({
            'type': 'Feature',
            'properties': props,
            'geometry': {
                'type': gtype,
                'coordinates': coords
            }
        })

    assert len(features) == 330, f"Expected 330 features, got {len(features)}"

    # Sort features deterministically by ST, DT, TS
    features.sort(key=lambda x: (x['properties']['ST'], x['properties']['DT'], x['properties']['TS']))

    collection = {
        'type': 'FeatureCollection',
        'metadata': {
            'source': 'geoBoundaries gbOpen (William & Mary geoLab / USAID Burma, Myanmar Analytics Project)',
            'license': 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
            'boundaryID': 'MMR-ADM3-66882298',
            'admUnitCount': len(features),
            'pcodeMapping': 'unavailable',
            'boundaryYear': '2019',
            'buildDate': 'Dec 12, 2023',
            'upstreamURL': 'https://www.geoboundaries.org/api/current/gbOpen/MMR/ADM3/'
        },
        'features': features
    }

    out_path = Path('lib/data/geoboundaries-330-townships.json')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    raw_payload = json.dumps(collection, separators=(',', ':')).encode('utf-8')
    out_path.write_bytes(raw_payload)

    print(f"Wrote {len(features)} townships to {out_path} ({len(raw_payload)} bytes, {len(gzip.compress(raw_payload))} bytes gzipped)")

if __name__ == '__main__':
    main()
