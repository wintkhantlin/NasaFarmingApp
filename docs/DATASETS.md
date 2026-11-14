# Comprehensive Dataset Catalog, API Specifications & Data Contracts

> **Status:** Authoritative Data Architecture Reference  
> **Audience:** Data Engineers, Remote Sensing Specialists, Backend Developers, AI Agents  
> **Repository Implementation:** `lib/nasa/*`, `lib/soil/*`, `lib/data/crops/*`, `lib/schemas/*`  
> **Last Verified:** November 2026

---

## Table of Contents
1. [Data Architecture Philosophy & Principles](#1-data-architecture-philosophy--principles)
2. [NASA POWER Agroclimatology API](#2-nasa-power-agroclimatology-api)
3. [NASA GPM IMERG Precipitation (v07)](#3-nasa-gpm-imerg-precipitation-v07)
4. [NASA AppEEARS & Earthdata Products](#4-nasa-appeears--earthdata-products)
   - 4.1 [Harmonized Landsat Sentinel-2 (HLS v2.0)](#41-harmonized-landsat-sentinel-2-hls-v20)
   - 4.2 [MODIS Terra Vegetation Indices (MOD13Q1.061)](#42-modis-terra-vegetation-indices-mod13q1061)
   - 4.3 [SMAP Level-4 Soil Moisture (SPL4SMGP.008)](#43-smap-level-4-soil-moisture-spl4smgp008)
   - 4.4 [ECOSTRESS Thermal & Evapotranspiration (v002)](#44-ecostress-thermal--evapotranspiration-v002)
   - 4.5 [SRTM Global 1 Arc-Second Elevation (SRTMGL1_NC.003)](#45-srtm-global-1-arc-second-elevation-srtmgl1_nc003)
5. [ISRIC SoilGrids v2.0 REST API](#5-isric-soilgrids-v20-rest-api)
6. [Agronomic Crop Characteristics Library](#6-agronomic-crop-characteristics-library)
7. [Local Farm Data & Soil Observation Schemas](#7-local-farm-data--soil-observation-schemas)
8. [Data Provenance & Traceability Contract](#8-data-provenance--traceability-contract)

---

## 1. Data Architecture Philosophy & Principles

1. **Resolution Transparency:** Coarse data ($0.5^\circ$ POWER, $0.1^\circ$ IMERG, $9\text{ km}$ SMAP) are never bi-linearly resampled to imply farm-scale precision. Displayed as regional context ("around your field").
2. **Strict Null & Fill Handling:** Every fill value (`-999` in POWER, `65535` in MODIS, `255` in HLS, `-32768` in SRTM) is converted to `null` at ingress.
3. **No Synthetic Pass:** If data or credentials are missing, dependent features degrade to `unknown`.
4. **Auditable Provenance:** Every metric carries source dataset, product concept ID, DOI, spatial resolution, and time span.

---

## 2. NASA POWER Agroclimatology API

- **Base URL:** `https://power.larc.nasa.gov/api/temporal/daily/point`
- **Resolution:** $0.5^\circ \times 0.625^\circ$. Temporal: 1981 to present (daily).
- **Parameters:** `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `WS2M`, `PS`, `GWETROOT`, `GWETTOP`.
- **Fill Value:** `-999.0`.

**Implementation:** `lib/nasa/power.ts`

---

## 3. NASA GPM IMERG Precipitation (v07)

- **Product:** `GPM_3IMERGDF` (Daily Final Run, Version 07, DOI: `10.5067/GPM/IMERGDF/DAY/07`).
- **Resolution:** $0.1^\circ \times 0.1^\circ$. Temporal: 2000 to present.
- **Access:** CMR Granule Discovery + OPeNDAP DAP4 point slicing with `EARTHDATA_TOKEN`.
- **Variables:** `precipitation` (mm/day), `precipitation_cnt` (valid half-hours, 48 = full day), `randomError`.
- **Fallback:** When unconfigured, falls back cleanly to NASA POWER `PRECTOTCORR` with explicit UI disclosure.

**Implementation:** `lib/nasa/imerg.ts`

---

## 4. NASA AppEEARS & Earthdata Products

- **Base URL:** `https://appeears.earthdatacloud.nasa.gov/api` (Bearer auth via `/api/login`).
- **HLS v2.0 (`HLSL30.020`, `HLSS30.020`):** 30m, 2–3 days. Bands: Red, NIR (B05 on L30, B8A on S30), SWIR1, Fmask.
- **MODIS (`MOD13Q1.061`):** 250m, 16-day composite. NDVI, EVI, 16-bit VI Quality, Pixel Reliability.
- **SMAP (`SPL4SMGP.008`):** 9km daily. `sm_surface`, `sm_rootzone`, `sm_rootzone_wetness`.
- **ECOSTRESS (`ECO_L2T_LSTE.002`, `ECO_L3T_JET.002`):** 70m LST (Kelvin) and ETdaily ($\text{W}\cdot\text{m}^{-2}$).
- **SRTM (`SRTMGL1_NC.003`):** 30m elevation DEM.

**Implementation:** `lib/nasa/appeears/*`, `lib/nasa/qa/*`, `lib/nasa/derive/*`

---

## 5. ISRIC SoilGrids v2.0 REST API

- **Base URL:** `https://rest.isric.org/soilgrids/v2.0/properties/query` (Public REST).
- **Resolution:** 250m. Depths: 0–5cm, 5–15cm, 15–30cm.
- **Properties:** Clay, Sand, Silt, pH, SOC, CEC, Bulk Density, Nitrogen.
- **Scaling:** Divisors of 10 (clay, sand, silt, pH, SOC, CEC) and 100 (bulk density). Depth-weighted $0\text{--}30\text{ cm}$ mean.

**Implementation:** `lib/soil/soilgrids.ts`

---

## 6. Agronomic Crop Characteristics Library

- **Supported Myanmar Crops (`lib/data/crops/myanmar.ts`):** Rice, Black Gram, Green Gram, Sesame, Groundnut, Chickpea, Pigeon Pea, Maize, Soybean, Lablab, Sunn Hemp.
- **Reference Crops (`lib/data/crops/reference.ts`):** Wheat, Corn, US Soybean, Alfalfa.
- **Parameters:** Thermal envelope ($T_{\text{base}}, T_{\text{opt}}, T_{\text{crit}}$), GDD, stages, $K_c$, rooting depth, soil tolerance, BNF ranges, pest rotation rules.

---

## 7. Local Farm Data & Soil Observation Schemas

- **Field Schema:** Polygon boundary, centroid, sample points, soil observations, irrigation, priorities, economics.
- **Soil Observation Schema:** Method rank (Laboratory $\succ$ Field Kit $\succ$ SoilGrids $\succ$ Farmer Estimate), depth range, date.

**Implementation:** `lib/schemas/field.ts`, `lib/types.ts`

---

## 8. Data Provenance & Traceability Contract

Every metric carries an immutable `DerivedIndicator<T>` bundle containing source dataset, product ID, resolution, time span, formula version, and uncertainty scope.
