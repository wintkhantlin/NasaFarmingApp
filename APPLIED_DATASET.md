# Applying the datasets to the rotation planner

Status: data plan, 14 November 2026; source statuses updated to match the code. [DATASET.md](DATASET.md) is the source catalog. This document decides where each source can enter the field → rotation → conditions → comparison → report flow in [APP_UI_UX_FLOW.md](APP_UI_UX_FLOW.md). A formula here is an implementation proposal unless marked **already coded**. Dataset availability is the result of this repository's [data spikes](docs/data-spikes.md), not a promise that every field has coverage.

## Decision rules

1. Compare the farmer's current rotation with at least two **defined** alternatives. Source data can support or challenge an option; it does not generate an agronomic strategy on its own.
2. Keep observed or modelled climate, crop parameters, farmer inputs, and derived metrics separate. Every result carries source, product/version, spatial resolution, date span, valid coverage, method version, and an uncertainty note.
3. Use the farmer's soil test, irrigation access, crop dates, and local notes before gridded estimates for those same facts. Preserve both values and show which one was used.
4. Never turn a 9 km or 0.5° cell into a field measurement by resampling it. Say **around your field**. Do not show unsupported yield, nitrogen, carbon, or erosion predictions.
5. A missing or inaccessible source reduces the claims the app makes. It does not become a zero, an average, or an invented score.

## Which catalog entries enter the product

| Source in `DATASET.md` | Application | Status / gate |
| --- | --- | --- |
| **NASA POWER** | Daily temperature, rainfall, radiation, wind and humidity for climate history, GDD, heat/frost, dry spells, and estimated reference ET; `GWETROOT` as modelled root-zone wetness context. | **Connected.** `/api/field/:id/conditions` serves the daily history (UTC) to Conditions and Compare. Both screens build rainfall with `buildRainSeries` and ET0 with Penman–Monteith (Hargreaves only on days missing its inputs). Its rainfall is labelled NASA POWER `PRECTOTCORR`, not satellite rainfall. [POWER daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) |
| **ISRIC SoilGrids** (project source, although absent from the catalog) | 0–30 cm soil texture, pH, carbon, and related baseline context. | **Connected with null handling.** Served to Conditions, Profile and Compare; a farmer soil test replaces it, and a pin without data uses the nearest cell with its distance stated. It is not NASA and is not a soil test. [SoilGrids units and layers](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html) |
| **SMAP** | Optional regional surface/root-zone moisture history and dry-year context. | **Wired, credentials-gated** (AppEEARS, `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD`); shown as a context indicator only. **Gate:** Earthdata-authenticated access, live validation, QA and enough overlap with the field. The identified L4 product is about 9 km; show it as regional context. [Project spike](docs/data-spikes.md) |
| **GPM IMERG** | Optional satellite rainfall history, heavy-rain and rainfall-reliability cross-check. | **Wired, credentials-gated** (GES DISC OPeNDAP, `EARTHDATA_TOKEN`). Replaces POWER rainfall only at ≥95 % baseline coverage; uncovered days (Final V07 ends September 2025) use POWER and the day counts are shown. Until connected, use POWER rainfall. IMERG products have different latency and run types. [NASA GPM](https://gpm.nasa.gov/data/imerg) |
| **Landsat / MODIS / VIIRS vegetation** | Past-season greenness and cover timing, compared with the field's own season. | **Landsat C2 L2 connected** via Microsoft Planetary Computer (no login), HLS via AppEEARS as fallback; feeds the low-cover check. MODIS and VIIRS are not connected. **Gate:** authenticated access where needed, cloud/quality masks, area coverage, and crop-calendar validation. MOD13Q1 is a 250 m 16-day composite in the project spike; it may not resolve a small plot. NDVI is a greenness index, not a crop identity or yield. [USGS NDVI](https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index) |
| **SRTM** | Static slope and terrain context for a possible erosion-exposure warning. | **Wired, credentials-gated** (AppEEARS); feeds the erosion-exposure screen. Still needs local validation. Slope alone is not soil loss. [USGS SRTM](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-shuttle-radar-topography-mission-srtm-1) |
| **ECOSTRESS** | Optional surface-temperature or actual-ET evidence where a valid overpass intersects the field. | **Later.** Validate coverage, acquisition time, masks and product units. Land-surface temperature is not 2 m air temperature. |
| **NLDAS / GLDAS** | Weather or moisture cross-check and gap study, with regional coverage checked first. | **Later.** Do not splice into the POWER time series without bias and time-boundary checks. |
| **FAO GAEZ** | Independent crop suitability context or a prior for candidate screening. | **Later.** Check crop definitions, management assumptions, baseline climate and spatial scale before comparing to a farmer's field. |
| **Sentinel-2** | Optional finer vegetation-cover history. | **Later.** Requires a repeatable ingestion and cloud-mask pipeline; it is ESA data, not NASA data. |
| **ERA5** | Independent climate sensitivity check where useful. | **Later.** It is ECMWF reanalysis and should remain a separate source, not silently merged with POWER. |
| **USDA Ag Data Commons** | Source of reviewed local crop parameters or validation datasets. | **Research input**, not a single uniform data layer. Every chosen dataset needs its own provenance and licence/coverage review. |
| **WSS and SSURGO / STATSGO2** | U.S. soil cross-check or substitute when mapped properties are available. | **U.S. optional.** Prefer more local soil evidence only after matching depth, units and map-unit limitations. |
| **USDA CDL / CropScape** | U.S. crop-history hypothesis and validation against farmer-entered crops. | **U.S. optional.** Classified crop pixels do not override the farmer's rotation. |
| **PRISM** | U.S. climate sensitivity check or local normal. | **U.S. optional.** Keep its rainfall and temperature series distinct from POWER. |
| **NAIP** | U.S. boundary and visible-cover review. | **U.S. optional.** Imagery is visual evidence, not a direct measurement of crop or soil health. |
| **NLCD** | U.S. landscape context and land-cover checks. | **U.S. optional.** Not a field-scale crop rotation record. |
| **CoCoRaHS** | North American gauge-based rainfall check where nearby observations exist. | **Regional validation**, with station distance and missing days shown. |
| **USGS NWIS** | U.S. watershed or groundwater context, when relevant. | **Regional validation** only. A stream gauge does not measure irrigation available to a field. |
| **USDA NASS QuickStats** | County/state aggregate crop and yield context. | **Regional context** only. Do not infer a field's yield from a county statistic. |
| **OpenET** | Regional actual-ET comparison and validation. | **Regional optional.** Check service area, period, method and field geometry before use. |
| **USDA AMS Market News** | Potential market context outside the first-version comparison. | **Defer.** [PRODUCT.md](PRODUCT.md) excludes prices and markets in version one. |
| **LANDFIRE** | Surrounding vegetation/fuel context. | **Defer.** It does not answer the core rotation comparison. |
| **GEDI** | Forest-structure context near a farm. | **Defer.** Its canopy and biomass metrics are poorly matched to annual crop-rotation decisions. |

## Data pipeline and spatial rules

**Inputs.** Use `Field.geometry`, `Field.samplePoints`, `Field.irrigation`, `Field.soilOverride`, and the farmer's `RotationSlot`s from `lib/types.ts`. Crop requirements (`Crop`) must come from a reviewed, region-aware library with a citation per threshold; values in the type are a schema, not validated agronomic facts.

**Fetch and normalize.** Retrieve raw source data on the server, keep raw payload metadata, convert fill values to `null`, convert units explicitly, and attach product/version and acquisition dates. POWER currently converts `-999` to `null`; SoilGrids divides raw properties by each layer's `d_factor`. Pin the POWER time standard and use the same local crop-season boundary for all annual calculations. POWER's daily API defaults to local solar time, so make the chosen standard explicit and record it. [POWER daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)

**Sample at the source scale.** For a polygon and a sufficiently fine raster, compute a valid-pixel area-weighted mean:

`field_mean = Σ(value_j × overlap_area_j) / Σ(overlap_area_j)`.

Report `coverage = Σ(valid overlap area) / field area`, valid pixel count, and cell size. Set a tested minimum coverage before showing a field summary. For a coarse grid, report the source cell or nearby-cell distribution as **regional context**; five sample points in one cell are not five independent measurements. For a pin, area coverage is unknown. For SoilGrids depth layers, the proposed 0–30 cm mean is `Σ(value_k × thickness_k) / Σ(thickness_k)` over valid layers, matching the current adapter; also report which depths were present.

**Cache and recompute.** Key cached analyses by source/version, source cell or geometry, date range, crop-library version, rotation revision, and formula version. Store `fetchedAt` and observation date separately. A changed field, rotation, farmer override, or formula version invalidates dependent outputs. If offline, show the saved result with its original date and inputs; never silently apply it to a changed field.

## Mathematical features

All sums omit missing values only under an explicit completeness rule. The denominator counts only valid years. A calendar year is complete for a metric when its required daily variables cover a documented share of that metric's dates; a cross-year crop season is evaluated as one season. The current `completeYears` function requires at least 355 rainfall days in a calendar year; extend completeness checks per variable before using temperature or ET statistics.

### 1. Rain and season reliability

From daily POWER `PRECTOTCORR`, use `P_y = Σ_d P_{y,d}` for an eligible crop season, in mm. For a crop's planting-to-harvest window, compute seasonal rain, longest run of days with `P_d < 1 mm`, and the empirical 10th/50th/90th percentiles across eligible historical seasons. Define a dry-spell threshold in the method metadata; the current `dryspells()` uses `< 1 mm/day`. For any named event, display `event years / eligible years`, for example 6 of 10 seasons, rather than an unexplained percentage. Rainfall alone is **not** effective rainfall or available root-zone water.

### 2. Heat, frost and thermal time

For crop-specific base temperature `T_base`, proposed daily thermal time is `GDD_d = max(0, ((T_max,d + T_min,d)/2) − T_base)` in °C·day, summed over the crop's dates. Some crops require upper and lower temperature caps; those must be crop-library parameters and the same convention used to source `toMaturity`. Compare historical seasonal GDD with the reviewed crop requirement. The simple GDD formula and the need for crop-specific cutoffs are described by [Penn State Extension](https://extension.psu.edu/understanding-growing-degree-days).

For heat and frost, count eligible crop seasons with at least one day over a crop-stage heat threshold or below its frost threshold. Show the count, window and stage, not a field-specific forecast from historical data. POWER air temperature is a grid estimate. ECOSTRESS land-surface temperature must not be substituted into that air-temperature test.

### 3. Atmospheric water demand and crop water need

**Already coded:** `lib/engine/et0.ts` computes Hargreaves reference ET from daily `T_max`, `T_min`, latitude and day of year. In the code's units:

`ET0_d = max(0, 0.0023 × (T_mean,d + 17.8) × sqrt(max(T_max,d − T_min,d, 0)) × 0.408 × Ra_d)` mm/day,

where `Ra_d` is extraterrestrial radiation in MJ/m²/day and `0.408` converts that energy to equivalent evaporation depth. The Hargreaves estimate should be checked against station-based FAO Penman–Monteith estimates where possible; FAO notes regional bias can occur. [FAO-56 meteorological data](https://www.fao.org/4/X0490E/x0490e07.htm)

For each crop stage, propose `ETc_d = Kc_stage,d × ET0_d` and `ETc_season = Σ_d ETc_d`. This is **potential crop evapotranspiration under standard conditions**, not observed water use or an irrigation instruction. Stage lengths and `Kc` must be reviewed for the actual crop, planting dates and region. [FAO-56 crop coefficient method](https://www.fao.org/4/X0490E/x0490e0a.htm)

An initial *climate pressure indicator* can be `climatic_gap = max(0, Σ ETc_d − Σ P_d)` over the same crop window, in mm. Label it **rainfall versus estimated crop demand**, not irrigation need: runoff, stored soil water, deep percolation and irrigation are absent. A true root-zone balance needs those terms and an initial water state. FAO expresses daily depletion as `D_r,d = D_r,d−1 − (P_d − RO_d) − I_d − CR_d + ETc_d + DP_d`, constrained by total available water. Implement this only after the required soil hydraulic properties, irrigation amounts and local validation are present. [FAO-56 soil water balance](https://www.fao.org/4/X0490E/x0490e0e.htm)

POWER `GWETROOT` is a modelled wetness fraction, not a volumetric water-content measurement or a substitute for this balance. SMAP's coarse root-zone value, when available, is a separate regional cross-check.

### 4. Soil suitability and rotation structure

Convert SoilGrids properties with their `d_factor`; apply the depth-weighted 0–30 cm mean only over valid layers. Compare pH, texture and drainage evidence with reviewed crop requirements. A transparent pH fit can be categorical: **within preferred range** if `pH ∈ [pH_opt_low, pH_opt_high]`; **within tolerated range** if `pH ∈ [pH_min, pH_max]` but outside preferred; otherwise **outside documented range**. Missing pH means **unknown**, not poor fit. Texture and drainage follow the same evidence-first rule.

Summarize rotation structure with directly checkable measures: `covered_days / cycle_days`, `distinct_crop_families`, `legume_slots / total_crop_slots`, and the longest consecutive run of the same crop family. These are descriptors, **not** predictions of soil organic carbon, nitrogen credits, pest pressure, or yield. A farmer's residue, tillage and soil-test entries can enrich the explanation but cannot justify a numeric soil-health gain without a validated model.

### 5. Satellite vegetation, terrain and rainfall, when connected

For quality-screened red and near-infrared reflectance, `NDVI = (NIR − Red) / (NIR + Red)` when the denominator is valid. For products that supply scaled NDVI directly, use the documented scale factor and quality flags rather than recalculating it. Compare a field's median valid NDVI in the same crop-stage window with that field's historical stage window; report valid pixel and date coverage. NDVI indicates greenness, not a specific crop, yield, or soil health. [USGS Landsat NDVI](https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index)

For IMERG, use a documented **daily accumulation** product or integrate half-hourly precipitation rates using each interval's duration and units. Do not sum rate numbers as if they were daily totals. Keep IMERG Early/Late/Final runs separate, with product latency and version shown. [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg)

For SRTM, derive terrain slope only after converting horizontal distance to metres: `slope_deg = atan(sqrt((∂z/∂x)² + (∂z/∂y)²)) × 180/π`. A slope plus days of bare cover may flag **possible exposure**, but is not an erosion-rate formula. Local soil, management and rain intensity would be needed for a defensible erosion estimate.

## Comparing rotations without a false precision score

Evaluate each rotation against the **same historical eligible seasons**, field inputs and crop-library version. For every candidate crop and its proposed dates, calculate: thermal fit; heat/frost exposure frequency; rainfall distribution and dry-spell frequency; estimated crop demand versus rain; pH/texture fit where known; and direct rotation-structure descriptors. Then aggregate across crop slots by duration or area, stating the weighting. Preserve per-slot results so an apparently strong average cannot hide one failing crop.

For a claim such as **most reliable in dry years**, first define dry years from the same field's eligible seasonal rainfall distribution (for example the lowest quartile, specified in the method). Then compare the fraction of those years in which each rotation meets **predefined, reviewed** crop-stage thresholds: `dry_year_fit = count(years all required crop checks pass) / count(eligible dry years)`. If too few dry years or thresholds exist, suppress the label. This is a historical suitability proxy, not a yield or future-probability forecast.

Show a matrix of **current rotation / alternative A / alternative B** with the measured or derived values, coverage, and unknowns. Avoid one combined score until weight choices are tested with growers and advisers. If any strategy is still a placeholder, the app may display it as an example only, clearly labelled, and must not present it as a validated recommendation.

## Delivery order and checks

1. **Done:** POWER and SoilGrids are connected to Conditions and Compare. Keep checking null handling, units, daily time convention, metric-specific completeness, cached dates and source labels. Build the first comparison only from reviewed crop parameters and farmer-entered rotation data.
2. **Next:** create a versioned crop and strategy library with citations; validate GDD, stage dates, `Kc`, pH and temperature ranges with local agronomy sources and growers. Run the same historical years through all alternatives. Add transparent evidence and unknowns to Compare and Report.
3. **After access is proven:** add SMAP, MODIS/HLS or Landsat, and IMERG one at a time. Verify real retrieval, QA masks, scaling, spatial coverage, temporal alignment and a known example field before their evidence affects an option.
4. **Regional modules:** add U.S. and other regional datasets only behind geographic coverage checks. Use them to cross-check or refine a stated metric; do not silently replace the global baseline.

**Acceptance checks:** a source outage never creates a zero; a tiny field never inherits a false field-resolution reading; a farmer override is traceable; an annual statistic shows its eligible-year count; the same inputs reproduce the same comparison; a report identifies which evidence was unavailable; and every numeric conclusion can be followed back to its formula and source.
