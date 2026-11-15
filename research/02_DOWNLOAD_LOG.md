# Research Download Operation Log
**Project:** Green Ally Project — Adapting Farms with NASA Data (NASA Space Apps Challenge 2026)  
**Agent:** AGENT 2 — NASA Data Research & Download Specialist  
**Execution Timestamp:** 2026-11-15T12:15:00Z  
**Target Region:** Ayeyarwady Delta, Myanmar (Pathein, Mawlamyinegyun, Hinthada, Myaungmya, Pyapon)  
**Validation Suite:** `scripts/research/validate_downloads.ts` (100% Passed)

---

## 1. Executive Summary

This log records all automated download operations executed to investigate, obtain, inspect, verify, and archive real scientific Earth observation data for the Ayeyarwady Delta and Myanmar Heartland study hubs.

All downloads were executed using bounded timeouts, exponential backoff retries, user-agent identification (`FieldShift-NASA-Researcher/1.0`), and SHA-256 cryptographic verification.

| Metric | Result |
|:---|:---|
| **Total Endpoints Contacted** | 4 distinct external scientific APIs |
| **Total Download Operations** | 18 live requests |
| **HTTP Success Rate** | 100% (18/18 HTTP 200 OK) |
| **Total Data Volume Retrieved** | 2.89 MB (uncompressed JSON/GeoJSON/STAC) |
| **Daily Weather Records Acquired** | 17,040 daily observations (2021-01-01 to 2026-10-31 across 8 sites) |
| **Total Cumulative Records in Repo** | 106,287 daily records across 33 cells (2016–2026) |
| **Soil Physical Profiles Evaluated** | 33 profiles (15 valid agricultural profiles, 18 urban/water null profiles) |
| **Satellite Scenes Cataloged** | 10 Landsat Collection 2 Level 2 scenes + 15 GPM IMERG V07 granules |

---

## 2. Target Sites & Geographic Coordinates

To resolve a critical discovery made during the repository audit—wherein urban center coordinates frequently returned `null` from ISRIC SoilGrids due to built-up land cover classification—both administrative township centers and active agricultural delta fields were sampled:

```
Ayeyarwady Delta Regional Sampling Grid
├── Pathein Western Delta
│   ├── Pathein Agricultural Field: 16.7200°N, 94.7500°E (Lowland alluvial paddy)
│   └── Pathein Township Hub:       16.7800°N, 94.7300°E (Urban port reference)
├── Mawlamyinegyun Central Delta
│   ├── Mawlamyinegyun Ag Field:    16.3500°N, 95.2300°E (Riverine paddy/pulse parcel)
│   └── Mawlamyinegyun Town Hub:    16.3800°N, 95.2700°E (Township centroid)
├── Hinthada Upper Delta Apex
│   ├── Hinthada Ag Field:          17.6000°N, 95.4000°E (Alluvial levee rice/corn/beans)
│   └── Hinthada Urban Hub:         17.6500°N, 95.4500°E (Riverfront town center)
├── Myaungmya Southern Delta Heartland
│   └── Myaungmya Ag Field:         16.6000°N, 94.9200°E (High-yield paddy basin)
└── Pyapon Coastal Delta Plain
    └── Pyapon Ag Field:            16.3000°N, 95.6800°E (Tidal/saline intrusion zone)
```

---

## 3. Comprehensive Operation Log Table

| Operation ID | Target | Endpoint / Service | HTTP Status | Latency | Payload Size | SHA-256 Checksum (First 16 chars) | Destination File |
|:---|:---|:---|:---:|:---:|:---:|:---:|:---|
| **DL-01** | Pathein Field | NASA POWER Daily Point API | 200 OK | 2,849 ms | 286,340 B | `1964713ac2278c73...` | `research/data/power_pathein_field_16.72_94.75.json` |
| **DL-02** | Pathein Town | NASA POWER Daily Point API | 200 OK | 1,965 ms | 286,317 B | `440a99c0c3be685a...` | `research/data/power_pathein_town_16.78_94.73.json` |
| **DL-03** | Mawlamyinegyun Field | NASA POWER Daily Point API | 200 OK | 1,742 ms | 286,366 B | `6bacda1b49fc1ca7...` | `research/data/power_mawlamyinegyun_field_16.35_95.23.json` |
| **DL-04** | Mawlamyinegyun Town | NASA POWER Daily Point API | 200 OK | 1,118 ms | 286,366 B | `7946744f67d26ff0...` | `research/data/power_mawlamyinegyun_town_16.38_95.27.json` |
| **DL-05** | Hinthada Field | NASA POWER Daily Point API | 200 OK | 1,414 ms | 286,329 B | `42a91d928171fc70...` | `research/data/power_hinthada_field_17.60_95.40.json` |
| **DL-06** | Hinthada Town | NASA POWER Daily Point API | 200 OK | 1,989 ms | 286,331 B | `858ac77a6ce2bbda...` | `research/data/power_hinthada_town_17.65_95.45.json` |
| **DL-07** | Myaungmya Field | NASA POWER Daily Point API | 200 OK | 1,771 ms | 286,339 B | `59f7ea333550e588...` | `research/data/power_myaungmya_field_16.60_94.92.json` |
| **DL-08** | Pyapon Field | NASA POWER Daily Point API | 200 OK | 2,204 ms | 286,471 B | `bf4b799a759e66ff...` | `research/data/power_pyapon_field_16.30_95.68.json` |
| **DL-09** | Pathein Field | ISRIC SoilGrids v2 REST API | 200 OK | 13,811 ms | 4,468 B | `c3a5470d507b55db...` | `research/data/soilgrids_pathein_field_16.72_94.75.json` |
| **DL-10** | Pathein Town | ISRIC SoilGrids v2 REST API | 200 OK | 17,944 ms | 4,501 B | `0f7f508da0e8ff38...` | `research/data/soilgrids_pathein_town_16.78_94.73.json` |
| **DL-11** | Mawlamyinegyun Field | ISRIC SoilGrids v2 REST API | 200 OK | 12,361 ms | 4,468 B | `7a24615cd5bc314a...` | `research/data/soilgrids_mawlamyinegyun_field_16.35_95.23.json` |
| **DL-12** | Mawlamyinegyun Town | ISRIC SoilGrids v2 REST API | 200 OK | 14,474 ms | 4,502 B | `8b3310a1f237841c...` | `research/data/soilgrids_mawlamyinegyun_town_16.38_95.27.json` |
| **DL-13** | Hinthada Field | ISRIC SoilGrids v2 REST API | 200 OK | 18,913 ms | 4,467 B | `33b3d747f2e1a384...` | `research/data/soilgrids_hinthada_field_17.60_95.40.json` |
| **DL-14** | Hinthada Town | ISRIC SoilGrids v2 REST API | 200 OK | 13,026 ms | 4,502 B | `4c086554f67dbb69...` | `research/data/soilgrids_hinthada_town_17.65_95.45.json` |
| **DL-15** | Myaungmya Field | ISRIC SoilGrids v2 REST API | 200 OK | 22,933 ms | 4,467 B | `0b2d4af0c7b27137...` | `research/data/soilgrids_myaungmya_field_16.60_94.92.json` |
| **DL-16** | Pyapon Field | ISRIC SoilGrids v2 REST API | 200 OK | 12,043 ms | 4,468 B | `2fb9e631a7ff77f8...` | `research/data/soilgrids_pyapon_field_16.30_95.68.json` |
| **DL-17** | Ayeyarwady Delta BBox | Microsoft Planetary Computer STAC | 200 OK | 4,692 ms | 232,765 B | `4b218805ba260d3b...` | `research/data/stac_landsat_c2_l2_ayeyarwady_2024.json` |
| **DL-18** | Ayeyarwady Delta BBox | NASA CMR Granules API | 200 OK | 1,413 ms | 66,547 B | `9ba33e532f750b33...` | `research/data/cmr_gpm_imerg_v07_ayeyarwady_sample.json` |

---

## 4. API Endpoints, Parameters & Protocols

### 4.1 NASA POWER Daily Point API
- **Base Endpoint:** `https://power.larc.nasa.gov/api/temporal/daily/point`
- **Method:** `GET`
- **Query Parameters:**
  - `parameters`: `T2M,T2M_MAX,T2M_MIN,RH2M,WS2M,ALLSKY_SFC_SW_DWN,PRECTOTCORR,PS`
  - `community`: `AG` (Agroclimatology)
  - `start`: `20210101`
  - `end`: `20261031` (or `20160101` to `20261031` in predownload cache)
  - `format`: `JSON`
  - `time-standard`: `UTC`
- **Rate Limit Policy:** 30 requests/minute. Throttled with 600 ms inter-request sleep.
- **Headers Sent:** `User-Agent: FieldShift-NASA-Researcher/1.0`, `Accept: application/json`

### 4.2 ISRIC SoilGrids v2.0 REST API
- **Base Endpoint:** `https://rest.isric.org/soilgrids/v2.0/properties/query`
- **Method:** `GET`
- **Query Parameters:**
  - `lon`: Decimal longitude (5 decimal places)
  - `lat`: Decimal latitude (5 decimal places)
  - `property`: Repeated for 10 properties (`clay, sand, silt, phh2o, soc, cec, bdod, nitrogen, wv0033, wv1500`)
  - `depth`: Repeated for 3 depths (`0-5cm, 5-15cm, 15-30cm`)
  - `value`: `mean`
- **Observed Behavior:** Up to 15–23 s response time per point due to 30 depth-layer raster queries. Handled with 25,000 ms timeout and automatic retry.

### 4.3 Microsoft Planetary Computer STAC API
- **Base Endpoint:** `https://planetarycomputer.microsoft.com/api/stac/v1/search`
- **Method:** `POST`
- **Payload:**
  ```json
  {
    "collections": ["landsat-c2-l2"],
    "bbox": [94.5, 15.5, 96.0, 18.0],
    "datetime": "2024-01-01T00:00:00Z/2024-12-31T23:59:59Z",
    "limit": 10,
    "query": { "eo:cloud_cover": { "lt": 20 } }
  }
  ```
- **Response Characteristics:** Returns Cloud-Optimized GeoTIFF (COG) URLs, scale factors (0.0000275), offsets (-0.2), and 16-bit `QA_PIXEL` band schemas.

### 4.4 NASA CMR (Common Metadata Repository) API
- **Base Endpoint:** `https://cmr.earthdata.nasa.gov/search/granules.json`
- **Method:** `GET`
- **Query Parameters:**
  - `short_name`: `GPM_3IMERGDF`
  - `version`: `07`
  - `temporal`: `2024-06-01T00:00:00Z,2024-06-15T23:59:59Z`
  - `bounding_box`: `94.5,15.5,96.0,18.0`
  - `page_size`: `15`
  - `page_num`: `1`
- **Response Characteristics:** Returns `producer_granule_id` (e.g., `3B-DAY.MS.MRG.3IMERG.20240601-S000000-E235959.V07B.nc4`), collection concept ID `C2723754864-GES_DISC`, and OPeNDAP DAP4 service URLs.

---

## 5. Verification & Ground-Truth Cross-Check

The downloaded datasets were validated using `scripts/research/validate_downloads.ts`:
- **Physical Bounds:** Checked all 106,287 daily records. No temperatures exceeded [-15°C, 55°C], no relative humidity exceeded [0%, 100%], no negative solar radiation or negative rain occurred.
- **Temperature Consistency:** Verified that for all days, $T_{\min} \le T_{\text{avg}} \le T_{\max}$.
- **Soil Balance:** Verified that across all 15 valid agricultural soil profiles, $\text{Sand}\% + \text{Silt}\% + \text{Clay}\% = 100\% \pm 2\%$.
- **Ground-Truth Calibration:** Re-verified NOAA GHCN-Daily Myanmar station comparisons (`data/validation/power-vs-ghcn.json`). Identified and recorded the critical -50.9% dry zone precipitation underestimation in NASA POWER against ground rain gauges at Mandalay station.

*Artifacts, scripts, and logs are preserved and reproducible via `npx tsx scripts/research/validate_downloads.ts`.*
