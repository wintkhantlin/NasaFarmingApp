# FieldShift — Explainable Rotation Engine (v0.1.0)

**Crop profiles and demonstration inputs for the FieldShift rotation engine.** The implementation is `lib/rotation/engine.ts` and runs through the Next.js `/api/rotation` route. The old `*_output.json` files are historical examples from the earlier heuristic engine and are not current regression fixtures; `test/rotation-integration.test.mjs` is the current contract check.

It evaluates one or two proposed future crops after the farmer's previous crop(s), then compares alternatives using farmer-selected objectives and available environmental/soil information. **It does not hardcode recommendations by Myanmar region**: latitude, longitude and region are metadata to use when the data team retrieves observations.

> **Research prototype, not a farm-ready advisory tool.** The included monthly climate is synthetic; the crop characteristics are species-level ECOCROP descriptors. Output is a conditional comparison with uncertainty, never a precise yield, water balance, nitrogen credit or disease forecast.

## Run locally

From the repository root:

```bash
npm install
npm run dev
npm run test:rotation
```

The `*_demo.json` examples are synthetic demonstration inputs. They are not observations for a real farm.

## Architecture

```text
Farmer location ──> SI/data team's NASA data lookup ──> standardized monthly conditions
Farmer input ─────────────────────────────────────────┐              │
Crop knowledge base (data/crops.json) ────────────────┼──> rotation engine
Prior crop history ────────────────────────────────────┘              │
                                                       feasibility + warnings
                                                                │
                                            candidate crop sequences + explanations
```

## Input contract

Required:
- `planning.start_date`, `planning.end_date` (ISO date; up to 730 days).
- `history`: known previously grown crop IDs, e.g. `["rice"]`.

Useful:
- `location`: optional `{label, lat, lon, region}`. It is **not** used to hardcode crop results.
- `planning.max_future_crops`: `1` (default) or `2`; `planning.crop_duration_days` maps crop ID to locally appropriate variety duration. Without a supplied duration, definite-period checks cover the ECOCROP minimum cycle and possible later hazards are checked through its maximum cycle, including months past the planning deadline. Later hazards remain uncertain until cultivar duration is known; climate beyond the supplied period remains missing.
- `planning.turnaround_days`: farmer-supplied days between two proposed crops (defaults to zero, and should be provided for serious two-crop planning).
- `planning.include_fallow`: true by default; `fallow` represents an unplanted comparison, not a crop.
- `farm.available_crops`: list of crop IDs accessible to the farmer; defaults to all five prototype crops.
- `farm.soil_ph`: measured field pH; `farm.drainage`: `well`, `moderate`, `poor`, or `unknown`.
- `farm.irrigation`: `none`, `available`, or `unknown` (report only; not proof of adequate water).
- `farm.fallow_management`: `bare`, `vegetated`, `mulched`, or `unknown`.
- `environment.source`: provenance string, e.g. NASA GPM product + date + resolution.
- `environment.basis`: `synthetic`, `historical_normals`, `observed`, or `forecast`.
- `environment.observation_period`: actual source or forecast dates; `environment.units`: `temp_c: "C"`, `rain_mm: "mm"`; `environment.spatial_resolution_km`: positive resolution or `null` when unknown. The SI adapter requires these metadata fields.
- `environment.monthly`: array of `{month: "YYYY-MM", temp_c: number, rain_mm: number, soil_moisture_anomaly?: number}`. Supply a value for **every month that overlaps a proposed crop**. Month values for historical normals should be mapped to the intended future months and labeled as normals, **not forecasts**.
- `farmer.priorities`: nonnegative selections for `crop_diversity`, `legume_inclusion`, `living_cover`, `water_conservation`, `income`. They are reported but are not converted to a scientific score.
- `farmer.crop_metrics`: optional *external* crop metrics. For each crop including `fallow`, supply `{additional_crop_water_use_mm, net_margin_per_ha}` when supported. `farmer.metrics_source` is required if the metrics object is present. The engine does **not** invent these quantities or infer water availability from rainfall.

**Important:** Water-use or margin metrics are meaningful only when computed for the *same location, season, management assumptions and sequence*. The current per-crop optional metrics interface is most appropriate for a **single proposed crop** (`max_future_crops=1`); a multi-crop sequence requires a sequence-specific assessment. Do not present per-crop metrics as validated sequence estimates.

## Output contract

`recommend(request)` yields:

- `scenarios`: a list of `{sequence, proposed_crops, status, temperature_screen, hard_constraints, cautions, missing_information, stages, observations_used, signals, sequence_reasoning, priority_alignment, priority_coverage, unsupported_priorities, evidence, explanations}`. `temperature_screen` separates a breach in the certain growing period (`outside_range`), a possible longer-cycle breach or missing data (`uncertain`), and no breach found in supplied monthly data (`within_range`). These are conditional screens, not a temperature forecast.
- `sequence_reasoning`: one entry per previous-to-next crop step with `benefits`, `risks`, `unknowns`, and linked `evidence`. Saved fields pass the previous slot's recorded residue handling; the simple farmer form leaves it unknown. This section does not change feasibility or candidate order.
- `status`: `infeasible` if a known hard ecological/calendar envelope is violated; `requires_review` if risks or missing information remain; `screened_plausible` only when the implemented checks show no concerns (this is **not a farm suitability guarantee**).
- `priority_alignment` is `null` and `priority_coverage` is zero while comparative outcome evidence is absent. `unsupported_priorities` names every selected criterion that remains unevaluated.
- `global_warnings`: limitations relevant to every scenario.

The list groups known broad-envelope exclusions last and sorts names alphabetically within each group. Its first item is not a winner. Botanical-family change and legume presence are descriptive indicators; living cover, nitrogen gain, water saving and income are not inferred from crop identity. Per-crop water and margin figures are accepted for contract compatibility but are not scored because a source label alone cannot establish comparable field- and sequence-level evidence.

### What science is implemented vs missing?

| Implemented now | Not yet scientifically established |
| --- | --- |
| Calendar screening from species cycle range and farmer-supplied cultivar duration | Verified local sowing/harvest windows and variety performance |
| Temperature screening against ECOCROP optimal/absolute range | Daily extremes, heat stress during sensitive growth stages |
| pH envelope screening and preferred drainage warnings | Detailed soil fertility, salinity, flooding and soil mechanics |
| Rotation diversity proxy based on plant family | Species-specific pest-host relationships and pest cycle disruption |
| Flag for legume biological N fixation potential | Quantitative nitrogen balance, grain export and fertilizer credit |
| Planted versus managed fallow cover described without a score | Measured cover, erosion, residue biomass and soil organic matter change |
| Optional crop-water-use and margin inputs are preserved but unscored | Comparable sequence-level water balance, yield or profit evidence |
| Preserves data uncertainties and missing values | Local agronomist validation and ground truth |

### Crop-sequence evidence and limits

| Reasoning shown | Basis | What remains unknown |
| --- | --- | --- |
| A change or repeat in botanical family is described, without claiming pest control. | [USDA NRCS Conservation Crop Rotation Standard](https://www.nrcs.usda.gov/sites/default/files/2022-09/Conservation_Crop_Rotation_328_CPS.pdf) asks for diverse crop types and pest-specific planning. | Local pest species, host range, and effects of this particular sequence. |
| Green gram or black gram may fix nitrogen if nodulation is effective. | [FAO crop-sequence guidance](https://www.fao.org/4/Y5146E/y5146e0a.htm) explains that fixation, biomass and harvest removal determine any residual nitrogen benefit. | Nodulation, grain and residue nitrogen export, and net soil nitrogen; no fertilizer credit is calculated. |
| Retained previous-crop residue may provide soil cover; removed or burned residue cannot be presumed to do so. Bare, vegetated and mulched fallow are distinguished only when management is recorded. | [FAO conservation agriculture technical brief](https://www.fao.org/fileadmin/user_upload/emergencies/docs/FAO_REOSA_Technical_Brief_1__July_2010_.pdf) describes retained residues and cover. | Amount and duration of actual cover, erosion change, and evaporation change. No crop-specific residue mass is assumed. |
| Green gram and black gram are both reported hosts of yellow mosaic viruses in India. | [Akram et al. 2024, original field research](https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2024.1451986/full) sampled legume hosts across Indian agro-climatic zones. | Whether the virus or whitefly vectors are present in a Myanmar field, whether it persists between seasons, and variety resistance. No disease risk score or rotation carryover claim is made. Other crop pairs have no specific pest-host assertion. |
| Previous crops can affect water available to the next crop, but no carryover advantage is assigned. | [FAO crop-sequence guidance](https://www.fao.org/4/Y5146E/y5146e0a.htm) discusses preceding-crop water use; [USDA NRCS Standard](https://www.nrcs.usda.gov/sites/default/files/2022-09/Conservation_Crop_Rotation_328_CPS.pdf) calls for a local water balance. | Root-zone water at harvest and planting, effective rainfall, drainage, evapotranspiration, and irrigation amount. Monthly rainfall alone is insufficient. |

The sources establish general mechanisms or documented hosts. They do not validate yield, nitrogen, pest, soil-cover or water outcomes for a particular FieldShift field.

## Team integration checklist

1. Data team: return location-specific monthly climate (and provenance) in the JSON contract. If observations are historical, don't label them forecasts.
2. Soil/farmer UI: send measured field pH, drainage, irrigation, previous crops and accessible crops. Use `null` for unknown values.
3. Crop rotation module: call `recommend` with the merged inputs; do **not** pass only location names or use `if region == "Magway"` rules.
4. UI: display each alternative's status, reasons, missing evidence, and provenance; do not label list order a recommendation.
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
