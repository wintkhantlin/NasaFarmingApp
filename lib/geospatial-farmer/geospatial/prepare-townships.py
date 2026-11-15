"""Local-only GDAL export. No source edits, simplification, snapping, or repairs.
Usage: python3 prepare-townships.py SOURCE.gpkg OUTPUT.geojson
Requires installed ogr2ogr (or OGR2OGR environment variable) and GDAL shared library.
"""
import ctypes
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

source, output = map(Path, sys.argv[1:])
if output.exists():
    raise SystemExit("Output already exists; choose a new path")
qgis = Path('/Applications/QGIS-master-f8bc9f2.app/Contents')
ogr = os.environ.get('OGR2OGR', str(qgis / 'MacOS/ogr2ogr'))
env = dict(os.environ)
env.setdefault('PROJ_DATA', str(qgis / 'Resources/qgis/proj'))
with tempfile.TemporaryDirectory() as work:
    reference = Path(work) / 'reference.geojson'
    subprocess.run([ogr, '-f', 'GeoJSON', str(reference), str(source),
        'study_area_townships_validated', '-select', 'ST,ST_PCODE,DT,DT_PCODE,TS,TS_PCODE,TS_MMR',
        '-t_srs', 'EPSG:4326', '-lco', 'RFC7946=YES', '-lco', 'COORDINATE_PRECISION=15'], env=env, check=True)
    data = json.loads(reference.read_text())
    features = data['features']
    assert len(features) == 162
    codes = [f['properties']['TS_PCODE'] for f in features]
    assert all(codes) and len(set(codes)) == 162
    assert len(set(f['properties']['ST_PCODE'] for f in features)) == 8
    lib = ctypes.CDLL(os.environ.get('GDAL_LIBRARY', str(qgis / 'Frameworks/libgdal.dylib')))
    lib.OGR_G_CreateGeometryFromJson.argtypes = [ctypes.c_char_p]
    lib.OGR_G_CreateGeometryFromJson.restype = ctypes.c_void_p
    lib.OGR_G_IsValid.argtypes = [ctypes.c_void_p]
    lib.OGR_G_DestroyGeometry.argtypes = [ctypes.c_void_p]
    for f in features:
        assert all(f['properties'][k] for k in ['ST','ST_PCODE','DT','DT_PCODE','TS','TS_PCODE'])
        g = f['geometry']
        assert g['type'] in ('Polygon', 'MultiPolygon')
        polygons = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        for rings in polygons:
            for ring in rings:
                assert len(ring) >= 4 and ring[0] == ring[-1]
                assert all(len(p) == 2 and -180 <= p[0] <= 180 and -90 <= p[1] <= 90 for p in ring)
        geometry = lib.OGR_G_CreateGeometryFromJson(json.dumps(g).encode())
        assert geometry and lib.OGR_G_IsValid(geometry), f['properties']['TS_PCODE']
        lib.OGR_G_DestroyGeometry(geometry)
    # Minification only: preserve all reference coordinates and properties exactly.
    display = {'type': 'FeatureCollection', 'features': features}
    payload = json.dumps(display, ensure_ascii=False, separators=(',', ':')).encode()
    assert json.loads(payload)['features'] == features
    output.write_bytes(payload)
    print(json.dumps({'features': len(features), 'stateGroups': 8, 'validGeometries': len(features),
        'bytes': len(payload), 'gzipBytes': len(gzip.compress(payload)),
        'sha256': hashlib.sha256(payload).hexdigest(), 'simplified': False}))
