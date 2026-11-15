# Myanmar township map integration

The field-location screen can use administrative boundaries as map context without treating them as farm parcels. Farmers can browse by region or state, district, and township; the map fits and highlights the selected township, while the existing pin, box, outline, GPS, search, and coordinate workflows remain authoritative for the field location.

## Production data

The bundled `lib/data/geoboundaries-330-townships.json` contains 330 Myanmar ADM3 boundaries from geoBoundaries gbOpen under CC BY 4.0. Source identifiers are stored with a `GB-MMR-` prefix because the upstream release does not provide official GAD/MIMU PCodes. Myanmar-language names are also unavailable in this release. Full provenance and transformation notes are in `lib/data/GEOBOUNDARIES_TOWNSHIPS_SOURCE.md`.

`GET /api/study-area/boundaries` validates and serves the bundled file. A deployment can set `FIELDSHIFT_TOWNSHIPS_PATH` to an absolute path for a compatible, rights-cleared GeoJSON override. The API caches the validated response in the server process and supports gzip.

## Application behavior

- Township selection changes only the map view and highlight.
- A farmer must still mark and confirm a field independently.
- On save, the app resolves administrative context from the actual field centroid.
- When a township was explicitly selected, the resolved field location must match it.
- Environmental requests, field area, sampling, and recommendations continue to use the farmer's saved geometry.
- Existing saved fields remain valid because `administrativeContext` is optional.
- If boundaries fail to load, search, GPS, drawing, and coordinate entry continue to work.

Administrative boundaries are generalized context, not cadastral boundaries or evidence of farm ownership. A centroid label also does not prove that every part of a large field lies within one township.

## Rebuilding the bundled file

The preparation script expects pinned geoBoundaries ADM1, ADM2, and ADM3 downloads at the temporary paths documented in the script. It spatially joins the hierarchy, rounds display coordinates to five decimal places, validates the expected 330 unique township identifiers, and writes a deterministic minified collection:

```sh
python3 lib/geospatial-farmer/geospatial/prepare-gbopen-townships.py
```

Review upstream metadata and licensing again before replacing the committed dataset.

## Verification

Focused tests cover schema validation, Polygon and MultiPolygon lookup, ambiguity, cascading selection, persistence without coordinate substitution, the committed dataset, and the API response.
