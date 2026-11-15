# Repository Scientific Audit & Architecture Baseline
**Project:** Green Ally Project — Adapting Farms with NASA Data (NASA Space Apps Challenge 2026)  
**Lead Scientific Research Orchestrator:** Independent Science Review  
**Date:** 2026-11-15  
**Git Branch:** `main`  
**Working Tree Status:** Preserving uncommitted UI & report enhancements in `components/field/`, `lib/conditions/`, `lib/plan/`.

---

## 1. Executive Summary & Audit Purpose

Green Ally Project is designed as a farmer-centered, NASA-data-informed decision support system focused on Myanmar's agricultural systems, notably the Ayeyarwady Delta, Central Dry Zone (Magway/Mandalay), and upland environments.

This baseline audit evaluates the scientific integrity, mathematical correctness, physical plausibility, data lineage, and validation status of the system prior to autonomous specialist investigations and experimental remediation.

---

## 2. End-to-End Pipeline Trace

The scientific data flow is structured across eight architectural stages:

```
[1. NASA & Earth Observation Ingestion]
   ├── NASA POWER API (0.5° × 0.625° daily meteorology: Tmax, Tmin, Tmean, Rain, RH2M, WS2M, Solar Rad)
   ├── NASA GPM IMERG V07 (0.1° satellite-gauge precipitation)
   ├── NASA AppEEARS (SMAP L4 9 km root-zone moisture, SRTM 30 m DEM, ECOSTRESS 70 m ET/LST)
   ├── Microsoft Planetary Computer STAC (Landsat Collection 2 Level-2 30 m surface reflectance & QA)
   ├── ISRIC SoilGrids v2 REST (250 m physical/chemical soil profiles: clay, silt, sand, pH, SOC)
   └── NOAA GHCN-Daily (Myanmar weather stations: Yangon, Mandalay, Sittwe, Myitkyina, Kawthaung)
            │
            ▼
[2. Preprocessing & Quality Assurance Masking]
   ├── Quality bitmask decoding: Landsat QA_PIXEL, HLS Fmask, MODIS VI QA, ECOSTRESS cloud/clear flags
   ├── Gridded reanalysis caching: `data/predownload/` (3,957 days from 2016 to 2026 for 5 hubs)
   └── Missing-data enforcement: Missing values are never imputed as zero or optimistic constants
            │
            ▼
[3. Geospatial & Topographic Analysis]
   ├── Coordinate reference system handling: WGS84 (EPSG:4326) / UTM projection
   ├── Topographic slope: Horn's 3×3 finite difference algorithm on 30 m SRTM DEM
   └── Footprint scale bounding: Distinct envelopes for Field (30 m), Village (10 km), and Wider Region (50 km)
            │
            ▼
[4. Core Bioclimatic & Hydrologic Indicators]
   ├── Astronomical solar radiation physics (extraterrestrial solar declination, sunset hour angle)
   ├── Reference Evapotranspiration (ET0): FAO-56 Penman-Monteith with Hargreaves-Samani empirical fallback
   ├── Potential Crop Evapotranspiration: ETc = Kc × ET0 (FAO-56 single crop coefficients)
   ├── Screening atmospheric water shortfall: max(0, ETc - Precipitation)
   └── Thermal indices: Growing degree days (GDD), pre-monsoon heat days (Tmax ≥ 35 °C), cool nights (Tmin ≤ 12 °C)
            │
            ▼
[5. Environmental Trends & Vulnerability Screening]
   ├── Historical trend detection: Non-parametric Mann-Kendall tau and Sen's slope estimator (1981–2024)
   ├── Four Geospatial Hazards:
   │     1. Water Stress (Atmospheric deficit + SMAP regional root-zone wetness)
   │     2. Flood (Landsat 30 m QA surface open water detection)
   │     3. Erosion (SRTM 30 m topographic slope steepness class)
   │     4. Heat & Cold (Pre-monsoon heat day frequency & dry-season minimum night temperatures)
   └── Scientific Truthfulness Gates: Mandatory caveats preventing false claims of field-level precision
            │
            ▼
[6. Crop Agronomic Suitability & Hard Boundary Checks]
   ├── Multi-factor suitability screening: Optimal & absolute thresholds for Temperature, pH, Texture, Drainage
   ├── Sourced threshold scopes: "ecocrop-reference" (FAO ECOCROP), "fao56", "analyst-assumption"
   └── Boundary constraints: Sowing window overlap, crop cycle duration, botanical family rotation break
            │
            ▼
[7. Multi-Criteria Decision Analysis (MCDA) & Economics]
   ├── Rank-sum multi-criteria scoring over farmer priorities (water conservation, soil health, cover, income)
   ├── Interval arithmetic gross margin: [min, max] yield × [min, max] farmgate price − [min, max] production costs
   └── Rejection of infeasible candidates: Only agronomically sound crop sequences are ranked
            │
            ▼
[8. Farmer-Facing Delivery & Visual Explanation]
   ├── Plain-language decision synthesis (Decision → Action → Reason → Evidence → Method)
   ├── Bilingual delivery: English and Myanmar Unicode
   └── Interactive inspection: Clear separation between measured field parcel and surrounding coarse footprint
```

---

## 3. Implemented vs. Documented-Only Inventory

| Module / Capability | Implementation Status | Code Location | Scientific Caveats & Gaps |
|:---|:---|:---|:---|
| **NASA POWER Client** | Fully Implemented | `lib/nasa/power.ts`, `lib/server/weather.ts` | 0.5° × 0.625° (~50 km) grid. Validated against NOAA GHCN stations; shows temperature bias (-0.8 to +1.4 °C) and daily rain correlation (~0.2). |
| **GPM IMERG V07** | Fully Implemented | `lib/nasa/imerg.ts`, `lib/server/imerg-backfill.ts` | 0.1° (~10 km) resolution. Merged gauge-satellite product; requires backfill caching. |
| **Planetary Computer Landsat** | Fully Implemented | `lib/nasa/planetary-computer.ts` | 30 m resolution cloud-native COGs. Subject to persistent monsoon cloud contamination. |
| **NASA AppEEARS Adapter** | Implemented (Auth-gated) | `lib/nasa/appeears/*` | AppEEARS requires authenticated Earthdata login; falls back to offline predownloaded datasets. |
| **SRTM Slope Derivation** | Fully Implemented | `lib/nasa/derive/slope.ts` | Horn's algorithm derived slope; captures macro-topography, misses small field bunds/terraces. |
| **FAO-56 Penman-Monteith ET0** | Fully Implemented | `lib/engine/et0.ts` | Rigorous physics implementation with thermodynamic vapor pressure and solar geometry. |
| **Hargreaves-Samani ET0** | Fully Implemented | `lib/engine/et0.ts` | Implemented as verified fallback when humidity/wind/solar radiation are missing. |
| **Mann-Kendall Trend Engine** | Fully Implemented | `lib/engine/trend.ts` | Robust non-parametric trend test for historical 1981–2024 climatology. |
| **MCDA Scoring Engine** | Fully Implemented | `lib/engine/mcda.ts` | Multi-criteria rank-sum utility with explicit anchor thresholds and partial-evidence gating. |
| **Interval Gross Margin** | Fully Implemented | `lib/engine/economics.ts` | Range-preserving interval arithmetic avoiding false certainty. |
| **Crop Parameter Library** | Fully Implemented | `lib/data/crops/myanmar.ts` | 13 Myanmar crops with explicit source metadata and analyst assumption flags. |
| **OPERA DSWx Flood Extent** | Documented Only / Stubbed | `lib/conditions/condition-evidence.ts` | Mentioned in documentation; current implementation uses Landsat QA_PIXEL water flags. |
| **Quantitative RUSLE ($A=RKLSCP$)** | Intentionally Restricted | `lib/conditions/condition-evidence.ts` | Emitting soil loss in tonnes/ha is blocked because management factor ($P$) is unmeasured. Topographic slope proxy is shown instead. |
| **Full Root-Zone Soil Water Balance** | Intentionally Restricted | `lib/engine/water.ts` | Full daily depletion modeling blocked when starting soil moisture is unknown; atmospheric deficit ($ET_c - P$) used with explicit screening label. |
| **Canopy Temperature vs Air Temp** | Disclosed Proxy | `lib/conditions/risk-panels/heat-cold-panel.tsx` | 2 m air temperature used as screening proxy; physical difference from canopy microclimate explicitly explained in UI. |

---

## 4. Existing Fixtures, Caches, and Benchmarks

1. **Pre-downloaded Gridded Weather & Soil:**
   - Location: `data/predownload/`
   - Manifest: `data/predownload/manifest.json` (13 KB, generated 2026-11-14)
   - Coverage: 3,957 daily records per cell (2016-01-01 to 2026-10-31)
   - Hubs: Pathein, Hinthada, Myaungmya, Maubin, Pyapon (Ayeyarwady), Magway, Mandalay, Shan, Bago.
2. **Weather Ground-Truth Validation:**
   - Validation Code: `lib/validation/weather.ts`, `lib/validation/ghcn.ts`, `scripts/validation/weather.run.ts`
   - Documentation & Benchmark Results: `docs/validation/WEATHER_VALIDATION.md`, `data/validation/power-vs-ghcn.json`
   - Stations Tested: Yangon International, Mandalay, Sittwe, Myitkyina, Kawthaung.
3. **Myanmar Geospatial Boundaries:**
   - 330 Townships GeoJSON: `lib/data/geoboundaries-330-townships.json` (geoBoundaries open license).
   - National & Regional administrative polygons in `lib/data/`.

---

## 5. Preliminary Scientific Observations & Audit Hypotheses

1. **Spatial Scale Honest Representation:** The codebase already enforces strict terminology distinguishing between field parcels (30 m) and coarse reanalysis footprints (10 km IMERG, 50 km POWER). This design must be verified against actual UI renderings.
2. **Atmospheric Deficit vs. Crop Water Stress:** The metric $ET_c - P$ is an atmospheric deficit indicator, not an actual root-zone soil water depletion or irrigation schedule. The app correctly notes this in code comments, but we must verify whether rotation rankings conflate this screening metric with farmer irrigation feasibility.
3. **Flood Inundation vs. Paddy Flooding:** In the Ayeyarwady Delta, monsoon rice is purposefully flooded. A satellite surface water detection during July–September reflects regular agronomic inundation, not necessarily disastrous flood destruction. The flood module must never classify deliberate paddy standing water as a hazard without temporal and elevation discrimination.
4. **Frost Feasibility in the Delta:** In the Ayeyarwady Delta (latitudes 15.5°–18°N at sea level), frost is physically impossible under current climatology (minimum temperatures rarely drop below 14–16 °C). The "heat_cold" module must strictly limit cold warnings to high-altitude regions (e.g., Shan State) and avoid alarmist frost indicators for delta farmers.
5. **Ablation of NASA Data in Decision Making:** A key concern is whether NASA gridded data actually changes the recommended crop rotation compared to local crop calendar heuristics and market margins. An empirical ablation experiment across diverse climate scenarios is required to prove or disprove NASA data efficacy.

---

## 6. Audit Sign-Off

The repository presents a well-structured agronomic and remote sensing architecture with substantial scientific documentation and principled missing-data gates. 

Wave 1 specialist subagents are authorized to proceed with focused investigations.
