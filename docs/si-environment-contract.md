# SI data connection for Rotation Explorer

The primary Rotation Explorer is `/plan`. It offers a new location or a saved farm. Both real-location paths use the existing `/api/field/:id/conditions` and `/api/field/:id/remote-sensing` loaders, the shared rotation environmental adapter, and `POST /api/rotation`. A new location is represented by a temporary point field for data loading; it is never written to the saved-farm repository. Saved farms provide recorded crop history and measured field properties. The legacy `POST /api/rotation/explore` remains for demonstration examples and existing API callers; it uses the same TypeScript recommendation engine, but its direct real-location fallback retrieves POWER alone. The farmer form never asks for monthly environmental measurements.

## Monthly environmental data

For the legacy `/api/rotation/explore` endpoint only, optionally set the server-only `FIELDSHIFT_ENVIRONMENT_URL` to the SI team's HTTP endpoint. That route sends a `POST` with JSON:

```json
{
  "location": { "label": "Selected farm", "lat": 20.148, "lon": 94.932 },
  "planning": { "start_date": "2026-11-20", "end_date": "2027-04-15" }
}
```

The endpoint must return the standardized monthly conditions expected by the TypeScript engine:

```json
{
  "source": "Dataset name · version · retrieval or pass date",
  "basis": "historical_normals",
  "observation_period": { "start_date": "2020-01-01", "end_date": "2025-12-31" },
  "units": { "temp_c": "C", "rain_mm": "mm", "soil_moisture_anomaly": "unitless" },
  "spatial_resolution_km": null,
  "monthly": [
    { "month": "2026-11", "temp_c": null, "rain_mm": null, "soil_moisture_anomaly": null }
  ]
}
```

`basis` must be `observed`, `historical_normals`, `historical_analogue`, `forecast`, or `synthetic`. `observation_period` is the actual source-data or forecast period, distinct from the planning dates. `units` must declare Celsius and millimetres; declare `soil_moisture_anomaly: "unitless"` when supplying that value. `spatial_resolution_km` must be positive, or explicitly `null` if unknown. Each `monthly` row must name a planning month, be unique, and supply `temp_c` and `rain_mm` as numbers or `null`. Put `null` where a value is unavailable; never fill it from another location or season. Historical normals must be mapped to the intended future month and labeled as normals, not forecasts. Observed/forecast rows must fall within their stated period. The engine reports missing months and does not calculate a water balance from rainfall alone. The SI service should include precise product and date in `source`; a synthetic source must say so, and cannot be declared observed or forecast. A failing or malformed SI response returns an error to the farmer instead of silently switching to demo climate. The app checks metadata consistency but cannot independently authenticate a dataset name or scientific quality.

## Existing saved-field products

The saved-field comparison uses the team's `/api/field/:id/conditions` payload and AppEEARS remote state. The adapter is `lib/rotation/existing-data.ts`; no separate environmental service is required. NASA POWER daily history supplies complete-month historical temperature and rainfall by default. GPM IMERG Final daily V07 rainfall may replace POWER rainfall only when a whole historical UTC calendar year has one nonnegative value with 48 valid half-hour samples for every day, POWER has complete temperature on those same days, the POWER temperature unit is Celsius, and the IMERG product/resolution metadata matches the pipeline. The latest such complete year is used. Otherwise POWER rainfall remains and a warning explains the IMERG gap. These are historical calendar-month analogues from one complete year, marked `historical_analogue`; they are neither multi-year climate normals nor future forecasts. The output keeps separate product labels and the aligned source dates; the combined grid resolution is reported as unknown because the products have different grids.

SoilGrids pH (0–30 cm, 250 m map estimate) is passed separately from farmer-recorded pH. It can prompt a field-test warning, but cannot cause a hard crop exclusion. The conditions payload does not provide SoilGrids' original retrieval time, so the estimate's retrieval timestamp remains null. SMAP SPL4SMGP.008 daily root-zone observations are passed as historical regional context with dates, valid sample counts, units and missing-value count. The cached remote state does not include numeric grid resolution, so it is labeled unknown. SMAP is not copied into planning-month anomalies or treated as field water availability or water carryover. The engine still does not calculate water adequacy from rainfall alone.

## Location search

Optional: set `FIELDSHIFT_LOCATION_SEARCH_URL` to a location lookup endpoint. The app sends a `GET` with a `q` query parameter and expects:

```json
{
  "locations": [
    { "id": "place-id", "label": "Township, Region, Myanmar", "lat": 20.148, "lon": 94.932 }
  ]
}
```

Without this endpoint, the search uses the app's Mapbox geocoder when `NEXT_PUBLIC_MAPBOX_TOKEN` is set. Otherwise it lists only the two clearly labeled demonstration farms. A farmer may use their phone position or continue with a place name without coordinates. A name without coordinates cannot trigger an environmental data lookup.

## Demonstration and unsupported objectives

Selecting a demonstration farm explicitly loads its bundled synthetic climate. A real farm never receives synthetic values as fallback. NASA POWER derived values are complete-month historical averages, labeled `historical_normals`, and are not a forecast of the planting period. Missing days cause that historical month to be excluded; if no complete historical month exists for a planning month, its temperature and rainfall are `null`. The source line carries the available daily date range, API version, resolution, and retrieval time; exact field-scale resolution is unknown. Soil pH and drainage remain optional; missing values stay unknown. Equipment notes are accepted by the form but are not scored by the current engine. Priorities are recorded but no scientific score is calculated. Candidates are grouped by hard exclusions and otherwise listed alphabetically; water, income and soil benefits remain unevaluated.
