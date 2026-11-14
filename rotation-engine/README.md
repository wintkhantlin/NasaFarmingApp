# FieldShift — Explainable Rotation Engine (v0.1.0)

**Crop profiles, demonstration inputs, and checked regression outputs for the FieldShift rotation engine.** The implementation is `lib/rotation/engine.ts` and runs through the Next.js `/api/rotation` route.

It evaluates one or two proposed future crops after the farmer's previous crop(s), then compares alternatives using farmer-selected objectives and available environmental/soil information. **It does not hardcode recommendations by Myanmar region**: latitude, longitude and region are metadata to use when the data team retrieves observations.

> **Research prototype, not a farm-ready advisory tool.** The included monthly climate is synthetic; the crop characteristics are species-level ECOCROP descriptors. Output is a conditional comparison with uncertainty, never a precise yield, water balance, nitrogen credit or disease forecast.

## Run locally

From the repository root:

```bash
npm install
npm run dev
npm run test:rotation
```

The examples in `examples/` are synthetic demonstration inputs and checked output fixtures. They are not observations for a real farm.

## Architecture

```text
Farmer location ──> SI/data team's NASA data lookup ──> standardized monthly conditions
Farmer input ─────────────────────────────────────────┐              │
Crop knowledge base (data/crops.json) ────────────────┼──> rotation engine
Prior crop history ────────────────────────────────────┘              │
                                                       feasibility + warnings
                                                                │
                                            candidate crop sequences + explanations
                                                                │
                                        heuristic farmer-priority alignment index
```

## Input contract

Required:
- `planning.start_date`, `planning.end_date` (ISO date; up to 730 days).
- `history`: known previously grown crop IDs, e.g. `["rice"]`.

Useful:
- `location`: optional `{label, lat, lon, region}`. It is **not** used to hardcode crop results.
- `planning.max_future_crops`: `1` (default) or `2`; `planning.crop_duration_days` maps crop ID to locally appropriate variety duration. Without a supplied duration, calendar screening uses ECOCROP's *minimum* cycle only and returns a warning.
- `planning.turnaround_days`: farmer-supplied days between two proposed crops (defaults to zero, and should be provided for serious two-crop planning).
- `planning.include_fallow`: true by default; `fallow` represents an unplanted comparison, not a crop.
- `farm.available_crops`: list of crop IDs accessible to the farmer; defaults to all five prototype crops.
- `farm.soil_ph`: measured field pH; `farm.drainage`: `well`, `moderate`, `poor`, or `unknown`.
- `farm.irrigation`: `none`, `available`, or `unknown` (report only; not proof of adequate water).
- `farm.fallow_management`: `bare`, `vegetated`, `mulched`, or `unknown`.
- `environment.source`: provenance string, e.g. NASA GPM product + date + resolution.
- `environment.basis`: `synthetic`, `historical_normals`, `observed`, or `forecast`.
- `environment.spatial_resolution_km`: resolution of the environmental layer.
- `environment.monthly`: array of `{month: "YYYY-MM", temp_c: number, rain_mm: number, soil_moisture_anomaly?: number}`. Supply a value for **every month that overlaps a proposed crop**. Month values for historical normals should be mapped to the intended future months and labeled as normals, **not forecasts**.
- `farmer.priorities`: nonnegative weights for `crop_diversity`, `legume_inclusion`, `living_cover`, `water_conservation`, `income`. They need not sum to 1; normalized internally.
- `farmer.crop_metrics`: optional *external* crop metrics. For each crop including `fallow`, supply `{additional_crop_water_use_mm, net_margin_per_ha}` when supported. `farmer.metrics_source` is required if the metrics object is present. The engine does **not** invent these quantities or infer water availability from rainfall.

**Important:** Water-use or margin metrics are meaningful only when computed for the *same location, season, management assumptions and sequence*. The current per-crop optional metrics interface is most appropriate for a **single proposed crop** (`max_future_crops=1`); a multi-crop sequence requires a sequence-specific assessment. Do not present per-crop metrics as validated sequence estimates.

## Output contract

`recommend(request)` yields:

- `scenarios`: a list of `{sequence, proposed_crops, status, hard_constraints, cautions, missing_information, stages, observations_used, signals, priority_alignment, priority_coverage, unsupported_priorities, evidence, explanations}`.
- `status`: `infeasible` if a known hard ecological/calendar envelope is violated; `requires_review` if risks or missing information remain; `screened_plausible` only when the implemented checks show no concerns (this is **not a farm suitability guarantee**).
- `priority_alignment`: 0–1 explanatory **heuristic index**, not yield probability, climate resilience percentage, or expected net benefit. Missing objectives count zero and reduce `priority_coverage`.
- `global_warnings`: limitations relevant to every scenario.

The ranking may show a first item, but **do not label it a definite best crop if its status is `requires_review` or important objectives are unsupported**. It is the *first candidate worth investigating* under the limited evidence.

### What science is implemented vs missing?

| Implemented now | Not yet scientifically established |
| --- | --- |
| Calendar feasibility from species cycle range and farmer-supplied cultivar duration | Verified local sowing/harvest windows and variety performance |
| Temperature screening against ECOCROP optimal/absolute range | Daily extremes, heat stress during sensitive growth stages |
| pH envelope screening and preferred drainage warnings | Detailed soil fertility, salinity, flooding and soil mechanics |
| Rotation diversity proxy based on plant family | Species-specific pest-host relationships and pest cycle disruption |
| Flag for legume biological N fixation potential | Quantitative nitrogen balance, grain export and fertilizer credit |
| Opportunity for living soil cover during crop growth | Erosion quantification, residue biomass and soil organic matter change |
| Optional externally sourced crop-water-use and margin values | ET0/Kc stage-wise water balance, yield or profit prediction |
| Preserves data uncertainties and missing values | Local agronomist validation and ground truth |

## Team integration checklist

1. Data team: return location-specific monthly climate (and provenance) in the JSON contract. If observations are historical, don't label them forecasts.
2. Soil/farmer UI: send measured field pH, drainage, irrigation, previous crops and accessible crops. Use `null` for unknown values.
3. Crop rotation module: call `recommend` with the merged inputs; do **not** pass only location names or use `if region == "Magway"` rules.
4. UI: display each alternative's status, reasons, missing evidence, and provenance; do not show the alignment index as an accuracy percentage.
5. Test same inputs in two different locations to confirm that only *environmental/soil/management values*, not the region string, change evaluations.

## Sources

- NASA Space Apps Field Shift challenge: https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/
- FAO ECOCROP database (historical global descriptors): https://www.fao.org/geospatial/data-and-tools/data-portals/ecocrop/en
- Crop data sheets: Rice `1574`, Green gram `2150`, Black gram `2149`, Sesame `1937`, Maize `238663` at https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2150
- USDA National Agronomy Manual, Part 503A (rotation plant-family, residue and water-use mechanisms): https://www.nrcs.usda.gov/sites/default/files/2022-10/National-Agronomy-Manual.pdf
- FAO crop ET: https://www.fao.org/4/X0490E/x0490e0a.htm
- World Bank (2019), Myanmar Rice and Pulses: https://documents1.worldbank.org/curated/en/623701579900727742/pdf/Myanmar-Rice-and-Pulses-Farm-Production-Economics-and-Value-Chain-Dynamics.pdf
- ACIAR, Central Dry Zone legume farming systems: https://www.aciar.gov.au/sites/default/files/project-page-docs/final_report_smcn.2011.047.pdf

See `SCIENCE_NOTES.md` for interpretation and limitations.
