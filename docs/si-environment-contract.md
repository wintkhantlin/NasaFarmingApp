# SI data connection for Rotation Explorer

The farmer form sends only field and planning choices to `POST /api/rotation/explore`. The server turns those choices into the TypeScript engine's request format. It never asks farmers for monthly measurements. For a real location with coordinates, a configured SI endpoint takes precedence. Otherwise the app uses its existing NASA POWER daily weather loader to derive complete-month historical averages. If that source is unavailable or incomplete, climate checks stay unknown.

## Monthly environmental data

Optionally set the server-only `FIELDSHIFT_ENVIRONMENT_URL` to the SI team's HTTP endpoint. The app sends a `POST` with JSON:

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
  "spatial_resolution_km": null,
  "monthly": [
    { "month": "2026-11", "temp_c": null, "rain_mm": null, "soil_moisture_anomaly": null }
  ]
}
```

`basis` must be `observed`, `historical_normals`, `forecast`, or `synthetic`. Each `monthly` row must name a future planning month. Put `null` where a value is unavailable; never fill it from another location or season. Historical normals must be mapped to the intended future month and labeled as normals, not forecasts. The engine reports missing months and does not calculate a water balance from rainfall alone. The SI service should include precise product and date in `source`. A failing or malformed SI response returns an error to the farmer instead of silently switching to demo climate.

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

Selecting a demonstration farm explicitly loads its bundled synthetic climate. A real farm never receives synthetic values as fallback. NASA POWER derived values are complete-month historical averages, labeled `historical_normals`, and are not a forecast of the planting period. Missing days cause that historical month to be excluded; if no complete historical month exists for a planning month, its temperature and rainfall are `null`. The source line carries the available daily date range, API version, resolution, and retrieval time. Soil pH and drainage remain optional; missing values stay unknown. Equipment notes are accepted by the form but are not scored by the current engine. Income and water conservation are farmer priorities, but the engine does not rank them without comparable, externally sourced metrics. The interface explains that limitation rather than treating the first candidate as a winner.
