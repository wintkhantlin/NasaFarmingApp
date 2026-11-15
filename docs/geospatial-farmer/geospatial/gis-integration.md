# Township map integration

Date: 15 November 2026. Branch: `feat/geospatial-farmer-experience`.

## Implemented scope

The existing Mapbox/Terra Draw field-location screen now loads township polygons and offers cascading region/state, district, and township selection. Selection fits the camera to the chosen extent and highlights a township. The eight source state groups, including separate Bago and Shan sub-regions, remain separate. Townships display English and Myanmar names where available.

A township selection never creates field geometry. Farmers still draw their field box/outline or enter its corners and confirm through the existing save flow. Administrative context is resolved from the actual field centroid, using the existing point-in-polygon utility, and stored as `Field.administrativeContext` with ST, ST_PCODE, DT, DT_PCODE, TS, TS_PCODE, and TS_MMR. An ambiguous or unmatched point is not assigned a township. A selected township must match the actual field point before saving. This is a context label, not certification that the entire field polygon is contained in that township.

Existing field coordinates, sample points, confirmation rules, scientific region classification, NASA requests, suitability equations, resolution rules, and confidence labels are unchanged. The persisted context is available through the existing field store; environmental requests continue to use actual field coordinates. Existing fields and backups accept the optional context without migration.

## Data preparation and verification

Source: `/Users/shoonlaemoeoo/GIS/field_shift_all_layers.gpkg`, layer `study_area_townships_validated`, EPSG:4326. The other diagnostic layers are excluded.

Use the installed QGIS GDAL tooling through:

```sh
python3 lib/geospatial-farmer/geospatial/prepare-townships.py \
  /Users/shoonlaemoeoo/GIS/field_shift_all_layers.gpkg \
  /private/tmp/field-shift-townships-local.geojson
```

The output must not already exist. The script supports `OGR2OGR`, `GDAL_LIBRARY`, and `PROJ_DATA` overrides for other installations. It selects only the seven application attributes, exports RFC 7946 longitude/latitude GeoJSON, and minifies JSON. It does not simplify, snap, repair, or edit the source. Every exported coordinate and property is retained when minifying. Polygon and MultiPolygon are supported by the application.

Observed local export results:

- 162 features; 162 unique, nonempty TS_PCODE values.
- Eight ST_PCODE groups: Ayeyarwady 26; Bago East 14; Bago West 14; Magway 25; Mandalay 28; Shan East 10; Shan North 24; Shan South 21.
- All 162 exported geometries pass GDAL/GEOS validity checks.
- Coordinates checked for geographic ranges and closed rings; GDAL exports RFC 7946 longitude/latitude order.
- Minified size: 5,083,977 bytes; gzip: 2,034,397 bytes. Full detail is retained to avoid introducing simplification artifacts. This is a first integration, not an optimized vector-tile service.
- SHA-256: `f1f0fdd6812bde91f0cc5ac9fcb4bcc10c123060e504108b67849a23f8c5c5ee`.

A separate unsimplified reference export exists locally at `/private/tmp/field-shift-townships-reference-v1.geojson`; the original GeoPackage remains authoritative. Temporary files are not durable deployment storage. The separate 1 mm snapped overlap result is supplied prior evidence, not an audit rerun here. Complete gap/coverage acceptance remains pending. Individual validity does not prove coverage or absence of overlaps.

## Local startup and deployment boundary

```sh
FIELDSHIFT_TOWNSHIPS_PATH=/private/tmp/field-shift-townships-local.geojson npm run dev -- --port 3002
```

Open `/fields/new`. `GET /api/study-area/boundaries` reads the configured server-side file, validates its structure and identifiers, and supports gzip responses. No GIS geometry or GeoPackage is committed, placed in `public`, or bundled by an import. With no configured file, the endpoint returns 503 and the existing field-location workflow remains usable. Errors do not disclose the server path.

For an authorized deployment, mount the rights-reviewed file outside source control and set `FIELDSHIFT_TOWNSHIPS_PATH` to its absolute server path. This endpoint sends geometry to browsers: keeping a file out of Git does not itself authorize public serving. Do not enable it on a public deployment until redistribution and application-use rights are confirmed.

## Source, attribution and rights blocker

Primary dataset: MIMU, Myanmar Administrative Boundary, PCode v9.4, including GAD lineage. Catalogue metadata describes approximately 1:250,000 digitization. Administrative edges are generalized context, not cadastral or exact agricultural boundaries. The map control credits MIMU/GAD and links to the catalogue.

Sources checked on 15 November 2026:

- https://data.themimu.info/en/dataset/myanmar-administrative-boundary — indexed publisher metadata describes free use with attribution, bilingual names, GAD lineage, and scale. Direct access is restricted by HTTP 403 in this environment.
- https://themimu.info/mimu-terms-conditions — indexed publisher terms prohibit sale/commercial use; direct access returned HTTP 403.

These statements do not establish unrestricted public redistribution of derived geometry for Field Shift. No CC license is assumed. Obtain publisher confirmation covering derived geometry, public GitHub redistribution, and public browser delivery for the intended application, with exact attribution/disclaimer wording. Alternatively, separately assess a permissively licensed source and its hierarchy/coverage; do not silently replace these 162 units or their PCodes.

## Verification and remaining limitations

Focused automated tests cover selection cascading, bilingual labels, Polygon/MultiPolygon lookup, ambiguity, code validation, and persisted context without coordinate substitution. Existing repository and geometry suites are included in the focused run.

Initial lint passed with one existing warning in `tests/components/field-overview.test.tsx`. Type checking is blocked by missing installed `geotiff`, already declared in package.json. The first build also failed fetching Noto Sans Myanmar from Google Fonts. The dependency installation attempt was rejected by automatic approval review because it treated the earlier no-install instruction as active; no dependency declarations or lockfiles were changed.

To resolve the dependency blocker after explicit approval:

```sh
bun install --frozen-lockfile
npm run typecheck
npm run lint
npm run build
```

Build also requires access to the existing Google Fonts resource or a separately approved font-hosting change. No commit or push is permitted until build passes and redistribution is cleared. Scientific algorithms have not been modified.
