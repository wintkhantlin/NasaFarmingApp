# NASA Farming App: Comprehensive Dataset Research Dossier

Generated via 10 Parallel Specialized Research Agents on 14 November 2026.

## Executive Summary

This research dossier provides the exhaustive scientific, technical, mathematical, and architectural foundation for the **NASA Farming App**—an innovative field-scale crop rotation planner that compares a farmer's current rotation with alternative agronomic strategies using NASA Earth observations, pedometrics, and local farmer knowledge.

### Research Agent Roster & Domain Coverage

| Agent # | Domain & Role | Primary Datasets & Frameworks | Key Role in Rotation Planner |
| --- | --- | --- | --- |
| 1 | Agroclimatology Specialist | NASA POWER (MERRA-2, GEOS-FP) | Thermal time (GDD), heat/frost hazards, dry spells |
| 2 | Soil Moisture Hydrologist | NASA SMAP (L3 radiometer, L4 root-zone) | 9 km regional root-zone moisture anomalies & drought stress |
| 3 | Vegetation & Phenology Analyst | MODIS (MOD13Q1), Landsat 8/9, HLS (30m) | Historical greenness timing, living cover days, bare soil gaps |
| 4 | Thermal & ET Specialist | ECOSTRESS (ISS 70m), OpenET (30m) | Field-level actual ET, canopy heat depression, water deficit |
| 5 | Precipitation Specialist | GPM IMERG (Early/Late/Final), CoCoRaHS | Critical stage rainfall, storm erosivity, multi-year percentiles |
| 6 | Pedometrics Specialist | ISRIC SoilGrids 2.0 (250m), SSURGO/WSS | 0-30 cm texture, pH, SOC, depth weighting, farmer override rule |
| 7 | Topography & Conservation | SRTM v3 (30m), Copernicus GLO-30 DEM | Terrain slope gradient, TWI, bare soil erosion risk flagging |
| 8 | Land Cover & Crop History | USDA CDL (CropScape 30m), WorldCover | 3-5 year crop sequence mining, rotation templates, verification |
| 9 | Agronomic Rules Architect | FAO-56, FAO GAEZ v4, Ag Data Commons | Kc stage coefficients, thermal caps, legume N-fix, family diversity |
| 10 | Cloud & Mobile Systems | NASA Earthdata SSO, Harmony, STAC, IndexedDB | Offline mobile operation, caching matrix, graceful degradation |

---

## Agent 1: NASA POWER Agroclimatology (MERRA-2 / GEOS-FP)
**Specialist Role:** NASA POWER Agroclimatology Specialist

# NASA POWER Agroclimatology: Technical Research Report for Crop Rotation Planning

---

### Executive Summary & Project Context

The **NASA Farming App** is an agronomic decision-support platform designed to transform NASA Earth observations into actionable crop rotation strategies. While Earth observation missions provide global coverage of environmental variables, their raw outputs—high-dimensional reanalyses, satellite radiances, and gridded rasters—are inaccessible to farmers and agricultural extension agents.

This report provides an exhaustive, technically rigorous evaluation of the **NASA POWER (Prediction Of Worldwide Energy Resources) Agroclimatology dataset**. It details sensor/model provenance, exact parameter specifications, REST API architecture, algorithmic integration into the crop rotation engine (GDD, heat shock, frost risk, dry-spell recurrence, multi-decadal resilience), spatial and physical edge cases, and design guidelines for farmer evidence presentation adhering to the **Field Almanac** design system (`DESIGN.md` and `UX.md`).

---

### 1. Dataset & Sensor Profile

#### Mission Provenance and Center Ownership
* **Full Mission Name:** Prediction Of Worldwide Energy Resources (POWER) Project.
* **Governing NASA Center:** NASA Langley Research Center (LaRC), Hampton, Virginia, USA.
* **Sponsoring Directorate:** NASA Earth Science Division (ESD), Applied Sciences Program.
* **Primary Data Purpose:** Initiated to synthesize, downscale, and package solar and meteorological data from NASA's Earth observation systems and global atmospheric assimilation models. Its purpose is to deliver open, continuous, and user-tailored environmental records to support:
  1. **Agroclimatology:** Agricultural crop modeling, yield estimation, irrigation planning, and rotation optimization.
  2. **Renewable Energy:** Solar and wind system design, performance modeling, and site assessment.
  3. **Sustainable Infrastructure:** Building energy efficiency and climate resilience.

#### Underlying Atmospheric Reanalysis & Near-Real-Time Models
NASA POWER is not a direct orbital satellite instrument; it is an integrated data assimilation system synthesizing satellite observations, physical models, and ground station networks developed by the **Global Modeling and Assimilation Office (GMAO)** at NASA Goddard Space Flight Center (GSFC):

```
                   ┌────────────────────────────────────────────────────────┐
                   │               NASA Global Observing System             │
                   │ (Terra, Aqua, Suomi-NPP, JPSS, NOAA, Ground Stations)  │
                   └───────────────────────────┬────────────────────────────┘
                                               │
                                 Assimilated Observations
                                               │
                                               ▼
     ┌──────────────────────────────────────────────────────────────────────────────────┐
     │                     GMAO Goddard Earth Observing System (GEOS)                   │
     ├─────────────────────────────────────────┬────────────────────────────────────────┤
     │ Historical Reanalysis (1981 – Recent)   │ Near-Real-Time Assimilation (NRT)      │
     │ Model: MERRA-2 (GEOS-5.12.4 Reanalysis) │ Model: GEOS-FP (Forward Processing)    │
     │ Span: January 1, 1981 to ~1-2 months ago│ Span: Last 1-2 months to present (NRT) │
     │ Primary role: Multi-decadal baseline    │ Latency: 2–3 day trailing latency      │
     └─────────────────────────────────────────┴────────────────────────────────────────┘
                                               │
                                               ▼
     ┌──────────────────────────────────────────────────────────────────────────────────┐
     │                       Solar & Surface Energy Assimilation                        │
     │   CERES SYN1deg (1° Synoptic) & FLASHFlux (Fast Longwave and Shortwave Flux)     │
     └─────────────────────────────────────────┬────────────────────────────────────────┘
                                               │
                                               ▼
     ┌──────────────────────────────────────────────────────────────────────────────────┐
     │                NASA POWER Agroclimatology API Endpoint (LaRC)                     │
     │           Spatial extraction, parameter derivation, time-standard shift          │
     └──────────────────────────────────────────────────────────────────────────────────┘
```

1. **MERRA-2 (Modern-Era Retrospective analysis for Research and Applications, Version 2):**
   * **Engine:** Global atmospheric circulation model GEOS-5 coupled with 3D-Var Grid-point Statistical Interpolation (GSI) analysis.
   * **Span:** January 1, 1981 to within 1–2 months of real time.
   * **Role:** Establishes the frozen, multi-decadal historical climate baseline (44+ continuous years). Because the data assimilation system is frozen, it eliminates artificial climate trend artifacts caused by operational model updates.
   * **Precipitation Correction:** Merges atmospheric model convection with external gauge collections using the Climate Prediction Center (CPC) unified global daily gauge analysis over land surfaces.

2. **GEOS-FP (Goddard Earth Observing System Forward Processing):**
   * **Engine:** GMAO's operational numerical weather prediction and assimilation pipeline.
   * **Span:** Fills the observational gap between the end of the MERRA-2 processing stream and near-real time (NRT).
   * **Latency:** Approximately 2 to 3 days behind real-time operations.
   * **Role:** Powers current-season tracking, recent frost/heat anomalies, and vegetative phase progression for active farm fields.

3. **Solar Energy Inputs:**
   * Downwelling solar irradiance is derived from the **CERES (Clouds and the Earth's Radiant Energy System)** Synoptic 1-degree (`SYN1deg`) product and the **FLASHFlux** (Fast Longwave and SHortwave Radiative Fluxes) near-real-time satellite algorithm, combining satellite radiances with GEOS atmospheric temperature, ozone, and aerosol profiles.

---

### 2. Key Variables & Technical Specifications

#### Agroclimatology Parameter Dictionary
The NASA Farming App utilizes ten core daily meteorological and hydrological variables for crop rotation modeling:

| Parameter Key | Parameter Long Name | Physical Units | Agronomic Function in Rotation Planner |
| :--- | :--- | :--- | :--- |
| `T2M` | Temperature at 2 Meters | °C | Daily mean thermal baseline; phenological pacing; mean temperature for monthly climate normals. |
| `T2M_MAX` | Temperature at 2 Meters Maximum | °C | Thermal time (GDD) calculation; heat-shock and pollen sterility detection during flowering. |
| `T2M_MIN` | Temperature at 2 Meters Minimum | °C | Thermal time (GDD) calculation; spring/autumn frost boundary detection; frost-free window calculation. |
| `PRECTOTCORR` | Precipitation Corrected | mm/day | Seasonal rainfall accumulation; dry-spell run-length distribution; rainfall vs. water demand indicators. |
| `RH2M` | Relative Humidity at 2 Meters | % | Atmospheric moisture deficit; fungal pathogen pressure indicators; vapor pressure deficit (VPD) modeling. |
| `ALLSKY_SFC_SW_DWN` | All Sky Surface Shortwave Downward Irradiance | MJ/m²/day | Solar energy available for crop photosynthesis and Penman-Monteith / Hargreaves reference evapotranspiration ($ET_0$). |
| `WS2M` | Wind Speed at 2 Meters | m/s | Aerodynamic resistance term in Penman-Monteith reference evapotranspiration ($ET_0$); pesticide spraying windows. |
| `GWETTOP` | Surface Soil Wetness (0–5 cm) | Dimensionless fraction [0, 1] | Seedbed moisture status; germination conditions; field trafficability for machinery and planting operations. |
| `GWETROOT` | Root Zone Soil Wetness (0–100 cm) | Dimensionless fraction [0, 1] | Soil water profile across active root systems; early-season drought stress tracking; fallback for satellite soil moisture. |
| `GWETPROF` | Profile Soil Wetness (to bedrock) | Dimensionless fraction [0, 1] | Deep subsoil moisture reserve; groundwater recharge status; multi-year drought carryover. |

*Note on Soil Wetness Units:* `GWETTOP`, `GWETROOT`, and `GWETPROF` are dimensionless ratios ($0.0 = \text{completely dry / wilting point}$, $1.0 = \text{complete saturation}$). They are modeled prognostic variables from the Catchment Land Surface Model (CLSM) in GEOS, not direct volumetric water content ($m^3/m^3$).

#### Spatial Resolution & Discretization
* **Native MERRA-2 Grid:** $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$.
* **Regridded POWER Point Extraction:** Formatted on a $0.5^\circ \times 0.5^\circ$ or native $0.5^\circ \times 0.625^\circ$ grid cell.
* **Ground Footprint Dimensions:**
  * At the Equator ($0^\circ$ latitude): $0.5^\circ \approx 55.5\text{ km (N-S)} \times 69.4\text{ km (E-W)}$.
  * At Mid-Latitudes ($45^\circ\text{ N/S}$, e.g., Iowa Corn Belt or Southern France): $0.5^\circ \approx 55.5\text{ km (N-S)} \times 49.1\text{ km (E-W)}$.
  * Typical cell ground area: $\sim 2,700\text{ to }3,800\text{ km}^2$ per data cell.
* **Point Query Spatial Sampling:** When a point query $(\text{lat}, \text{lon})$ is submitted to the API, POWER extracts the grid cell enclosing the coordinate. No spatial interpolation or artificial sharpening is performed by default.

#### Temporal Resolution & Latency
* **Temporal Resolution:** Daily aggregates (24-hour integrations and extrema derived from hourly model state calculations). Monthly 25-to-30-year climatological normals are also precomputed.
* **Latency:**
  * **Historical Reanalysis:** $\sim 30\text{ to }60\text{ days}$ for definitive MERRA-2 assimilation processing.
  * **Operational Forward Processing (GEOS-FP):** 2 to 3 days trailing latency for near-real-time updates.

#### Geodetic Datum, Time Standards, and Fill Values
* **Coordinate System & Datum:** World Geodetic System 1984 (WGS84, EPSG:4326). Elevation is reported as model surface geopotential height in meters above sea level (`geometry.coordinates[2]`).
* **Time Standards:**
  * **Local Solar Time (`LST`):** The default time standard for the POWER Agroclimatology API (`community=AG`). Local Solar Time partitions daily aggregates from midnight to midnight according to the sun's position at the field longitude. This is critical for agronomic modeling to prevent diurnal temperature extremes ($T_{\max}$ and $T_{\min}$) or daily solar radiation sums from straddling two calendar days.
  * **Universal Time Coordinated (`UTC`):** Configurable via query parameter (`time-standard=UTC`), recommended for synchronizing with orbital satellite passes (e.g., SMAP or Landsat overpass timestamps).
* **Missing Value & Fill Value Conventions:**
  * The canonical fill value in NASA POWER is **`-999.0`** (or `-999`).
  * In the Farming App pipeline, every `-999.0` must be coerced to `null` before running agronomic aggregations. Any missing record triggers explicit data-completeness accounting rather than being imputed as zero.

---

### 3. Access Architecture, APIs & Authentication

#### Endpoint Topography & Protocol
The NASA POWER API is a high-availability, cloud-native REST service hosted by NASA LaRC:
* **Base Temporal URL:** `https://power.larc.nasa.gov/api/temporal`
* **Daily Point Endpoint:** `/daily/point`
* **Climatology Point Endpoint:** `/climatology/point`

#### Authentication & Rate Limits
* **Authentication:** **No API key or Earthdata Login required.** It is completely open to the global public.
* **Rate Limits:**
  * Informal limit: 30 requests per minute per IP address; bursts of up to 10 concurrent requests.
  * Exceeding limits triggers an HTTP `429 Too Many Requests` response.
  * Point query parameter limit: Maximum of **20 parameters** per single point request.
* **Caching Strategy:** Because multi-decadal historical daily records (1981–2024) are static, the farming app caches weather records server-side (keyed by `0.5° grid cell ID + date range + version`), reducing remote requests to zero for repeat field inquiries in the same region.

#### Query Parameters
To fetch the 10 core agroclimatology parameters for a field location from 1981 through 2024:

```http
GET /api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN,WS2M,GWETTOP,GWETROOT,GWETPROF&community=AG&longitude=-93.6200&latitude=42.0300&start=19810101&end=20241231&format=JSON HTTP/1.1
Host: power.larc.nasa.gov
Accept: application/json
```

*Parameter Descriptions:*
* `parameters`: Comma-delimited list of exact parameter tokens (max 20).
* `community`: Set to `AG` (Agroclimatology). Configures units to agricultural standards and enforces Local Solar Time (`LST`).
* `longitude` / `latitude`: Decimal coordinates in WGS84, formatted to 4 decimal places.
* `start` / `end`: Target range formatted as `YYYYMMDD`.
* `format`: `JSON` (GeoJSON Feature format).

#### Payload Architecture
The server responds with an RFC-7946-compliant GeoJSON Feature structure:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-93.62, 42.03, 310.22]
  },
  "properties": {
    "parameter": {
      "T2M_MAX": {
        "20240101": 0.91,
        "20240102": 3.20,
        "20240715": 34.82,
        "20240716": 36.15
      },
      "T2M_MIN": {
        "20240101": -5.94,
        "20240102": -3.64,
        "20240502": -1.20
      },
      "PRECTOTCORR": {
        "20240101": 0.00,
        "20240108": 3.47,
        "20240715": 0.00
      }
    }
  },
  "header": {
    "title": "NASA/POWER Source Native Resolution Daily Data",
    "api": {
      "version": "v2.10.3",
      "name": "POWER Daily API"
    },
    "sources": ["MERRA2", "SYN1DEG", "POWER"],
    "fill_value": -999.0,
    "time_standard": "LST",
    "start": "19810101",
    "end": "20241231"
  },
  "parameters": {
    "T2M_MAX": { "units": "C", "longname": "Temperature at 2 Meters Maximum" },
    "T2M_MIN": { "units": "C", "longname": "Temperature at 2 Meters Minimum" },
    "PRECTOTCORR": { "units": "mm/day", "longname": "Precipitation Corrected" }
  },
  "messages": []
}
```

---

### 4. Rotation Engine Integration & Mathematical Logic

The crop rotation planner simulates prospective crop sequences against 44 years of NASA POWER daily climate data. Rather than assigning an arbitrary "suitability score", the engine computes empirical historical frequencies of physiological hazards.

```
       NASA POWER Historical Record (1981–2024 Daily Point Series)
                                   │
                                   ▼
        Completeness Filter (Valid Days ≥ 95% of Season Window)
                                   │
                ┌──────────────────┼──────────────────┐
                ▼                  ▼                  ▼
       Thermal Time (GDD)      Heat Shock         Frost Risk
        Crop Maturity Fit    Flowering Hazard   Spring / Autumn
                │                  │                  │
                └──────────────────┼──────────────────┘
                                   │
                                   ▼
                       Hydrological Stress Engine
                     (Dry Spells & Climatic Gap)
                                   │
                                   ▼
                    Multi-Decadal Resilience Matrix
                     (Current vs. Alternatives)
```

#### 1. Growing Degree Days (GDD / Thermal Time Accumulation)
Thermal time determines whether a prospective crop will accumulate sufficient heat units to reach physiological maturity before season-ending frosts or excessive drought.

##### Mathematical Formula
For any single day $d$:
$$GDD_d = \max\left(0, \frac{T_{\max, d} + T_{\min, d}}{2} - T_{\text{base}}\right)$$

##### Agronomic Capping (Modified Baskerville-Emin / Single-Sine Model)
For warm-season crops (e.g., Maize, Base $T_{\text{base}} = 10^\circ\text{C}$, Ceiling $T_{\text{cutoff}} = 30^\circ\text{C}$):
$$T^*_{\max, d} = \min(T_{\text{cutoff}}, \max(T_{\text{base}}, T_{\max, d}))$$
$$T^*_{\min, d} = \max(T_{\text{base}}, \min(T_{\text{cutoff}}, T_{\min, d}))$$
$$GDD_d = \frac{T^*_{\max, d} + T^*_{\min, d}}{2} - T_{\text{base}}$$

##### Seasonal Accumulation
Over the crop's calendar window from planting day $d_{\text{plant}}$ to harvest day $d_{\text{harvest}}$:
$$GDD_{\text{season}} = \sum_{d = d_{\text{plant}}}^{d_{\text{harvest}}} GDD_d$$

##### Rotation Engine Evaluation
For each eligible historical year $y \in Y_{\text{elig}}$:
$$\Delta GDD_y = GDD_{\text{season}, y} - GDD_{\text{req}}$$
* If $GDD_{\text{season}, y} < GDD_{\text{req}}$, the crop failed to reach physiological maturity in year $y$.
* The engine reports the maturity completion rate:
$$\text{Maturity Rate} = \frac{\sum_{y \in Y_{\text{elig}}} \mathbb{I}(GDD_{\text{season}, y} \ge GDD_{\text{req}})}{N_{\text{elig}}}$$

---

#### 2. Heat Shock Detection & Critical Phenological Windows
High temperatures during reproductive stages cause flower abortion, pollen desiccation, and poor grain fill.

##### Phenological Window Mapping
A crop cycle of length $L$ days is partitioned using crop-specific stage fractions:
* Initial stage ($S_1$): $0 \le d < f_{\text{ini}} \cdot L$
* Vegetative development ($S_2$): $f_{\text{ini}} \cdot L \le d < (f_{\text{ini}} + f_{\text{dev}}) \cdot L$
* **Reproductive / Flowering ($S_{\text{mid}}$):** $(f_{\text{ini}} + f_{\text{dev}}) \cdot L \le d < (f_{\text{ini}} + f_{\text{dev}} + f_{\text{mid}}) \cdot L$
* Late ripening / maturity ($S_4$): $(1 - f_{\text{late}}) \cdot L \le d \le L$

For Maize ($L = 120\text{ days}$, $f_{\text{ini}}=0.15$, $f_{\text{dev}}=0.30$, $f_{\text{mid}}=0.35$):
$$\text{Flowering Window } (S_{\text{mid}}) = \text{Day } 54 \text{ to Day } 96 \text{ after planting}$$

##### Mathematical Formulation
Let $T_{\text{crit}}$ be the critical flowering heat threshold (e.g., $35^\circ\text{C}$ for Maize, $34^\circ\text{C}$ for Soybean):
$$N_{\text{shock}, y} = \sum_{d \in S_{\text{mid}, y}} \mathbb{I}(T_{\max, d} \ge T_{\text{crit}})$$

##### Rotation Risk Metric
$$\text{Heat Shock Exposure Rate} = \frac{\sum_{y \in Y_{\text{elig}}} \mathbb{I}(N_{\text{shock}, y} \ge 1)}{N_{\text{elig}}}$$
*Presented to farmers as:* **"Heat shock at flowering in 6 of 40 historical seasons."**

---

#### 3. Frost Risk and Safe Thermal Boundaries
Freezing temperatures ($T_{\min} \le 0^\circ\text{C}$) destroy seedlings in spring and prematurely kill foliage in autumn before grain maturity.

##### Mathematical Formulation
Let $\mathcal{W}_y = [d_{\text{plant}, y}, d_{\text{harvest}, y}]$ be the active crop season:
$$\text{Frost Event}_y = \mathbb{I}\left(\exists d \in \mathcal{W}_y : T_{\min, d} \le 0^\circ\text{C}\right)$$

##### Seasonal Distribution Statistics
In the historical record, frost days ($T_{\min} \le 0^\circ\text{C}$) are partitioned into spring (before mid-summer split $DOY=200$) and autumn (after $DOY=200$):
* **Last Spring Frost ($LSF$):** $\max\{DOY_d \mid d \le 200 \land T_{\min, d} \le 0^\circ\text{C}\}$
* **First Autumn Frost ($FAF$):** $\min\{DOY_d \mid d > 200 \land T_{\min, d} \le 0^\circ\text{C}\}$
* **Safe Planting Day ($90\text{th percentile}$):**
$$DOY_{\text{plant, safe}} = \text{percentile}(LSF, 0.90)$$
* **Safe Frost-Free Window ($FFD$):**
$$FFD = \text{percentile}(FAF, 0.10) - \text{percentile}(LSF, 0.90)$$

If the candidate crop's required cycle days $L_{\text{crop}} > FFD$, the engine flags a **Terminal Frost Risk**.

---

#### 4. Dry Spell Recurrence & Drought Sensitivity
Precipitation totals alone mask intermittent drought; a season with 600 mm of rain can still suffer complete yield failure if rain arrives in two massive storms separated by a 30-day mid-summer dry spell.

##### Run-Length Formulation
A dry day is defined agronomically as:
$$\text{IsDry}_d = \begin{cases} 1 & \text{if } PRECTOTCORR_d < 1.0\text{ mm} \\ 0 & \text{if } PRECTOTCORR_d \ge 1.0\text{ mm} \end{cases}$$

For each season $y$, the maximum consecutive dry spell run length is:
$$L_{\max, y} = \max_{i, k} \left\{ k - i + 1 \;\middle|\; \forall d \in [i, k], \text{IsDry}_d = 1 \text{ and } [i, k] \subseteq \mathcal{W}_y \right\}$$

##### Historical Percentiles
Across all eligible seasons $Y_{\text{elig}}$:
$$\text{DrySpell}_{p50} = \text{percentile}(L_{\max}, 0.50) \quad (\text{Median run length})$$
$$\text{DrySpell}_{p90} = \text{percentile}(L_{\max}, 0.90) \quad (\text{1-in-10-year drought event})$$

If $\text{DrySpell}_{p90} > 14\text{ days}$ on a rainfed field with coarse soil texture, the engine triggers an alert recommending drought-tolerant rotation crops (e.g., Sorghum or Pearl Millet instead of Maize).

---

#### 5. Multi-Decadal Historical Resilience & Rotation Analysis

##### Strict Completeness Rules
To prevent partial-year sampling bias:
1. A calendar year is complete for precipitation if valid $PRECTOTCORR$ days $\ge 355$.
2. An active crop window $\mathcal{W}$ is complete if valid daily observations $\ge 95\%$ of window duration.
3. Denominators always report **eligible seasons**, never total elapsed calendar years.

##### Climatic Water Balance & Evapotranspiration Deficit
Reference evapotranspiration ($ET_0$) is computed daily using the FAO-56 Hargreaves-Samani method (robust against missing solar/wind data):
$$ET_{0, d} = \max\left(0, 0.0023 \cdot (T_{\text{mean}, d} + 17.8) \cdot \sqrt{\max(T_{\max, d} - T_{\min, d}, 0)} \cdot 0.408 \cdot R_{a, d}\right)$$
Where $R_{a, d}$ is extraterrestrial solar radiation (MJ/m²/day) computed from latitude and day of year ($DOY$).

Crop evapotranspiration under standard conditions:
$$ET_{c, d} = K_{c, \text{stage}(d)} \cdot ET_{0, d}$$

Seasonal Climatic Gap:
$$\text{Climatic Gap}_y = \max\left(0, \sum_{d \in \mathcal{W}_y} ET_{c, d} - \sum_{d \in \mathcal{W}_y} PRECTOTCORR_d\right)$$

##### Dry-Year Rotation Counterfactual Testing
The engine defines "dry years" as the lowest quartile ($Q_1 \le 25\text{th percentile}$) of historical seasonal rainfall:
$$Y_{\text{dry}} = \left\{ y \in Y_{\text{elig}} \;\middle|\; \sum_{d \in \mathcal{W}_y} PRECTOTCORR_d \le \text{percentile}\left(P_{\text{season}}, 0.25\right) \right\}$$

Resilience is computed by evaluating how candidate rotations perform in those specific dry years:
$$\text{Resilience Index}_{\text{dry}} = \frac{\sum_{y \in Y_{\text{dry}}} \mathbb{I}\left(\text{All Crops in Rotation Meet Thermal and Water Thresholds}\right)}{|Y_{\text{dry}}|}$$

---

### 5. Limitations, Uncertainties & Edge Cases

| Physical / Model Limitation | Root Cause in NASA POWER | Agronomic Impact on Farm Field | Software Mitigation & Engine Handling |
| :--- | :--- | :--- | :--- |
| **Coarse Grid Cell Area ($\sim 50\text{–}60\text{ km}$)** | Reanalysis grid ($0.5^\circ \times 0.625^\circ$) smooths surface topography and land cover. | Cannot detect farm-scale microclimates, valley bottoms, cold-air drainage, or hilltops. | Never claim plot-level measurement. Always display spatial qualification: *"around your field (~50 km)"*. |
| **Mountainous Elevation Gradients** | Cell topography is averaged into a single mean geopotential height (`elevationM`). | If a field sits in a valley at 600 m while the cell average is 1,400 m, model air temperature will underestimate field temperature by $\sim 5^\circ\text{C}$. | Compare field DEM elevation against `geometry.coordinates[2]`. Apply lapse rate correction ($-6.5^\circ\text{C} / 1,000\text{ m}$) or flag high elevation uncertainty. |
| **Coastal & Large Water Edges** | Land-sea mask blends maritime and terrestrial surface fluxes. | Coastal fields exhibit artificial thermal buffering (underestimated daytime heat, overestimated winter minima). | Flag coastal cells ($< 70\%$ land fraction). Display warning: *"Coastal boundary: local temperatures may fluctuate more than regional model."* |
| **Smeared Convective Rainfall** | MERRA-2 distributes localized summer thunderstorm energy across the entire $2,500\text{ km}^2$ grid cell. | Mutes intense single-day downpours; produces excess low-intensity "drizzle" days ($0.1\text{–}2\text{ mm}$); understates local flash dry spells. | Use $1.0\text{ mm}$ threshold (rather than $0.1\text{ mm}$) to classify dry days. Treat rainfall as regional availability, not an on-farm rain gauge. |
| **Sparse Ground Gauge Networks** | $PRECTOTCORR$ blends CPC gauge data; developing regions have sparse weather station coverage. | Tropical and arid regions outside North America/Europe rely heavily on unconstrained satellite/reanalysis estimates. | Track data source quality in metadata. Report confidence badges as "regional estimate" in data-sparse geographies. |
| **Modelled vs. Volumetric Soil Moisture** | `GWETROOT` is an uncalibrated Catchment model ratio ($0\text{ to }1$), not volumetric water content ($\text{cm}^3/\text{cm}^3$). | Cannot be directly converted into irrigation depth (mm) without field-specific soil retention curves. | Restrict `GWETROOT` to qualitative regional indicators (e.g., relative saturation trends). Integrate SoilGrids texture/AWC for physical soil balances. |

---

### 6. Farmer Evidence Display Guidelines

The NASA Farming App adheres strictly to the **Field Almanac** design system (`DESIGN.md` and `UX.md`). NASA Earth observation data is treated as quiet, trustworthy evidence supporting plain-language recommendations.

#### Plain-Language Communication Principles
1. **The Headline Leads, the Numbers Follow:**
   * *Do:* "Sorghum followed by cowpea is your most reliable rotation in dry years."
   * *Don't:* "Rotation Plan 2: Average ET0 4.2 mm/day, 44-year GDD 1,520, P-value 0.04."
2. **Translate Spatial Cells into Human Context:**
   * Farmers know their plot is a few hectares, not 3,000 square kilometers.
   * *Rule:* Never say *"Your field received 620 mm of rain."*
   * *Always say:* **"Within ~50 km around your field, rainfall averaged 620 mm."**
3. **Every Warning Carries an Action:**
   * Structure alerts as: **Hazard · When · What to do**.
   * *Example:* *"Late spring frost risk: In 4 of 10 years around your field, freezing temperatures hit after May 2. Hold soybean planting until the second week of May."*
4. **Target Bands Over Isolated Readings:**
   * A seasonal rainfall figure (e.g., $480\text{ mm}$) is agronomically meaningless on its own. It must be paired with the crop's comfortable physiological band ($450\text{–}700\text{ mm}$) and a plain verdict: *"Within comfortable range"*.

---

#### Required Badges & Provenance Specification
Every data point, chart, and recommendation must carry an audit trail rendered via the `SourceLine` component:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NASA POWER  ·  ~50 km (0.5°)  ·  1981–2024 (44 seasons)  ·  100% complete   │
└─────────────────────────────────────────────────────────────────────────────┘
```

##### Badge Specifications
1. **Dataset Identifier Badge:**
   * Label: `NASA POWER`
   * Tooltip / Sub-label: `MERRA-2 Reanalysis & GEOS-FP NRT Assimilation`
2. **Spatial Resolution Badge:**
   * Label: `~50 km (0.5°)`
   * Explanation: Signals that data reflects a regional atmospheric grid cell.
3. **Date Range & Season Count Badge:**
   * Label: `1981–2024 (44 seasons)`
   * Rule: Must state the actual number of evaluated crop cycles, e.g., *"41 eligible seasons (3 excluded due to missing data)"*.
4. **Data Completeness & Quality Badge:**
   * Label: `100% complete` or `98.2% valid days`
   * Alert state: If data completeness drops below 95%, display a caution chip: `text-drought` ("Older than usual" or "Incomplete historical record").

---

#### Persistent Agronomic Framing
Every comparison screen, crop rotation matrix, and exportable farm report must conclude with the system disclaimer:

> **"Suggestions to discuss, not instructions. You know your land. Check these with your extension officer or adviser."**

---

### Summary Checklist for Engineering & Agronomy Teams

* [x] **API Client (`lib/nasa/power.ts`):** Enforce `community=AG`, `time_standard=LST`, coerce fill values (`-999.0`) to `null`.
* [x] **Completeness Engine (`lib/engine/climate.ts`):** Exclude years with $< 355$ valid rain days; require $\ge 95\%$ daily valid coverage across crop growth windows.
* [x] **Thermal Logic:** Implement Base/Ceiling GDD accumulation and stage-specific heat shock tracking ($T_{\max} \ge 35^\circ\text{C}$ at flowering).
* [x] **Frost Bounds:** Calculate 90th percentile Last Spring Frost ($LSF_{p90}$) and 10th percentile First Autumn Frost ($FAF_{p10}$) for safe planting windows.
* [x] **Hydrological Modeling:** Use $1.0\text{ mm}$ daily rain thresholds for dry-spell run distributions; combine Hargreaves $ET_0$ with crop $K_c$ for climatic gap.
* [x] **UI Presentation:** Maintain **light mode only**; lead with recommendations; display spatial qualification ("within ~50 km around your field"); anchor every reading with a four-part provenance badge (`Dataset · Resolution · Date range · Completeness`).

---

## Agent 2: NASA SMAP (Soil Moisture Active Passive) L3 & L4
**Specialist Role:** NASA SMAP Soil Moisture Hydrologist

# Technical Investigation Report: NASA SMAP Observations for Field-Scale Crop Rotation Resilience

**Author:** Hydrology & Remote Sensing Research Directorate, NASA Soil Moisture Active Passive (SMAP) Mission  
**Subject:** Integration of SMAP Radiometric and Data Assimilation Products into Field-Scale Agronomic Rotation Engines  
**Target Architecture:** NASA Farming App Hydrological Intelligence Core  

---

### 1. Dataset & Sensor Profile

#### 1.1 Mission Architecture & Sensor Overview
The NASA Soil Moisture Active Passive (SMAP) observatory was launched on January 31, 2015, into a polar, sun-synchronous orbit at an altitude of 685 km with an inclination of 98.1°. The satellite operates with an equatorial crossing time of **06:00 AM (descending)** and **06:00 PM (ascending)** local solar time. 

The primary scientific instrument is an **L-band microwave radiometer operating at an internationally protected center frequency of 1.413 GHz** (bandwidth 1400–1427 MHz, wavelength $\lambda \approx 21.4\text{ cm}$). The instrument feeds a 6-meter lightweight deployable mesh reflector antenna rotating conically at 14.6 RPM about the nadir axis at a constant incidence angle of **$\theta_{\text{inc}} \approx 40^\circ$** across the Earth's surface. This scanning geometry yields a wide, contiguous swath of **1,000 km**, enabling a **2- to 3-day global revisit frequency** at equatorial and temperate agricultural latitudes, and daily revisit above 45° latitude.

```
       Orbit: Sun-synchronous, 685 km altitude
       Equatorial Crossing: 06:00 AM Descending / 06:00 PM Ascending
       Revisit: 2–3 Days (Temperate/Equatorial), Daily (High Latitudes)
                                      
             [SMAP Bus]
                 |
                 | Conical Scan (14.6 RPM)
                 v
             ( 6m Mesh )   ===>  Look Angle: 40° constant incidence
                /     \
               /       \   ===>  1,000 km Swath
              /         \
     ~~~~~~~~~~~~~~~~~~~~~~~~~ Earth Surface
```

The 06:00 AM descending overpass is designated as the primary hydrological observation baseline. At dawn, thermal equilibrium between the vegetative canopy and the topsoil horizon minimizes vertical temperature gradients ($T_{\text{canopy}} \approx T_{\text{soil}}$), substantially reducing radiative transfer inversion errors in optical depth and effective soil temperature.

---

#### 1.2 Comparative Evaluation: SPL3SMP_E.006 vs. SPL4SMGP.008

To select the appropriate product for agricultural decision engines, hydrologists must distinguish between purely observational radiometer retrievals and assimilated land-surface geophysical products:

| Architectural Dimension | SPL3SMP_E.006 (Enhanced Radiometer) | SPL4SMGP.008 (Geophysical Assimilation) |
| :--- | :--- | :--- |
| **Full Product Name** | SMAP L3 Radiometer Global Daily 9 km EASE-Grid 2.0 Soil Moisture | SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root-Zone Soil Moisture |
| **Data Type** | Observation-driven remote sensing retrieval | Model-data assimilation (Ensemble Kalman Filter) |
| **Observation Depth** | Surface skin: **0 – 5 cm** | Dual: **0 – 5 cm (Surface)** and **0 – 100 cm (Root-Zone)** |
| **Temporal Frequency** | Daily composite (separate AM/PM half-orbits) | **3-hourly instantaneous snapshots** (00, 03, 06, 09, 12, 15, 18, 21 UTC) |
| **Spatial Posting** | 9 km cylindrical EASE-Grid 2.0 | 9 km cylindrical EASE-Grid 2.0 |
| **Effective Resolution** | ~33 km (Backus-Gilbert optimal interpolation) | 9 km (governed by Catchment LSM topography/forcing) |
| **Core Retrieval Algorithm** | Dual Channel Algorithm (DCA) & Single Channel (SCA-V/H) | Ensemble Kalman Filter (EnKF) + GEOS Catchment LSM |
| **Physical Variable** | Volumetric Soil Moisture ($\text{m}^3/\text{m}^3$) | Volumetric ($\text{m}^3/\text{m}^3$) & Wetness Fraction ($[0,1]$) |
| **Production Latency** | ~12 to 24 hours | ~2.5 to 3.0 days (constrained by GEOS-FP forcing) |
| **Spatial Completeness** | Gaps due to orbit swaths, dense canopy, freeze/RFI | **Spatially and temporally contiguous (gap-free)** |
| **Agronomic Role** | Topsoil crusting, seed germination, rainfall infiltration | **Crop transpiration, vegetative stress, multi-year buffer** |

##### Radiative Transfer Mechanics of SPL3SMP_E.006
SPL3SMP_E.006 uses the classical zero-order radiative transfer ($\tau$-$\omega$) forward model. The brightness temperature observed by the radiometer at polarization $p$ ($p \in \{v, h\}$) is governed by:

$$T_{B, p} = T_u + e^{-\tau / \cos\theta} \left[ r_p T_s e^{-\tau / \cos\theta} + (1 - \omega) T_c \left(1 - e^{-\tau / \cos\theta}\right) \right] + (1 - \omega) T_c \left(1 - e^{-\tau / \cos\theta}\right)$$

Where:
- $T_s, T_c$ are the physical temperatures of the soil and canopy (K).
- $\tau$ is the canopy optical thickness ($\tau = b \cdot \text{VWC}$, where $\text{VWC}$ is Vegetation Water Content in $\text{kg/m}^2$).
- $\omega$ is the vegetation single-scattering albedo.
- $r_p$ is the rough-surface soil reflectivity, parameterized using the Choudhury-Wang model ($r_p(\theta) = [(1-Q) r_{0,p} + Q r_{0,q}] \exp(-h \cos^N \theta)$).
- $r_{0,p}$ is the Fresnel specular reflectivity, directly coupled to the complex relative dielectric permittivity of the soil ($\varepsilon = \varepsilon' - j \varepsilon''$) via the Mironov or Dobson dielectric mixing models.

Because pure L-band inversion terminates at the dielectric boundary of the top ~5 cm, SPL3SMP_E cannot directly sense moisture dynamics in the deeper root zone where agricultural crops satisfy 70–90% of their transpiration demands.

##### Assimilation Mechanics of SPL4SMGP.008
SPL4SMGP solves the subsurface observability barrier. It assimilates SMAP L-band brightness temperatures directly (avoiding correlated retrieval errors from Level-2/3 soil moisture) into the **NASA Goddard Earth Observing System (GEOS) Catchment Land Surface Model (CLSM-F2.5)**. The CLSM organizes each 9 km computational grid into hydrologically connected sub-grid hydrological catchments characterized by:
1. A catchment water table equilibrium distribution governed by topography.
2. A vertical profile combining an unsaturated surface equilibrium layer, a root-zone layer (0–100 cm), and a saturated zone.
3. An explicit 16-member Ensemble Kalman Filter (EnKF) that calculates the Kalman gain matrix $\mathbf{K}$ to update soil water states based on the difference between observed brightness temperatures and model-forecasted brightness temperatures.

For field rotation resilience, **SPL4SMGP.008 is the authoritative scientific product**, providing physically continuous estimates of the full 0–100 cm root-zone profile.

---

### 2. Physical & Technical Specifications

#### 2.1 Depth of Penetration and Vertical Hydrodynamics
* **Radiometer Depth of Penetration:** The penetration depth $\delta_p$ of electromagnetic radiation into a lossy dielectric medium is defined as the depth at which the transmitted power decays to $1/e$ ($\approx 37\%$) of its surface value:

  $$\delta_p = \frac{\lambda}{4\pi \left| \text{Im}\left(\sqrt{\varepsilon}\right) \right|} = \frac{c}{2\pi f \sqrt{2\varepsilon'} \sqrt{\sqrt{1 + \left(\frac{\varepsilon''}{\varepsilon'}\right)^2} - 1}}$$

  In dry soils ($\theta < 0.08\text{ m}^3/\text{m}^3$), $\delta_p$ can reach 10 to 12 cm. However, in moist agricultural soils ($\theta > 0.25\text{ m}^3/\text{m}^3$), the elevated dielectric loss factor ($\varepsilon'' \gg 5$) limits penetration strictly to **the top 2 to 5 cm**.
* **Root-Zone Hydrodynamic Coupling (0–100 cm):** Root-zone moisture in SPL4SMGP is not an empirical extrapolation. It is derived through numerical integration of the 1-D Richards' equation and catchment equilibrium formulations:

  $$\frac{\partial \theta}{\partial t} = \frac{\partial}{\partial z} \left[ K(\theta) \left( \frac{\partial \psi(\theta)}{\partial z} + 1 \right) \right] - S(z, t)$$

  Where $K(\theta)$ is unsaturated hydraulic conductivity, $\psi(\theta)$ is soil matric potential (parameterized via Clapp-Hornberger or van Genuchten functions), and $S(z, t)$ represents the sink term for vegetative root extraction. When SMAP observes surface wetting or drying at 06:00 AM, the EnKF distributes the analysis increment vertically across the 0–100 cm profile according to the ensemble background error cross-covariances.

```
       0 cm ------------------------------------ [SMAP Radiometer: 0–5 cm]
            ~ ~ ~ ~ ~ Direct Dielectric Sensing (λ = 21.4 cm) ~ ~ ~ ~ ~
       5 cm ------------------------------------
            |                                  ^
            | Hydrodynamic Vertical Coupling   |
            | (CLSM-F2.5 Richards Equation     | SPL4SMGP Assimilated Root Zone
            |  + EnKF Innovation Matrix)       | (0–100 cm)
            v                                  v
     100 cm ------------------------------------
```

---

#### 2.2 Measurement Units and Dimensional Harmonization

A frequent pitfall in agricultural software systems is confusing volumetric water content with relative wetness fractions.

```
+------------------------------------------------------------------------------------+
| 0.00 m³/m³ (Zero water)                                                            |
|        [                     Oven-dry to Wilting Point                     ]       |
| θ_wp   =====================================================================       |
|        [ Available Water Capacity (AWC) / TAW: Crop Extraction Domain      ]       |
| θ_fc   =====================================================================       |
|        [ Gravitational Drainage: Rapid Deep Percolation                   ]       |
| θ_sat  =====================================================================       |
| 1.00 m³/m³ (Total saturation / Porosity)                                           |
+------------------------------------------------------------------------------------+
```

1. **Volumetric Soil Water Content ($\theta$, $\text{m}^3/\text{m}^3$):**  
   - Employed by SMAP `sm_surface` and `sm_rootzone`.
   - Defined as: $\theta = \frac{V_w}{V_T}$, where $V_w$ is water volume and $V_T$ is bulk total soil volume.
   - Physical bounds: Residual moisture $\theta_r$ ($\approx 0.02 - 0.06$) to total porosity $\theta_s$ ($\approx 0.38 - 0.52\text{ m}^3/\text{m}^3$).
   - Direct physical interpretation: Multiplying $\theta$ by root depth $Z_r$ in mm yields equivalent liquid water depth:
     
     $$d_w\text{ (mm)} = \theta \times Z_r\text{ (mm)}$$

2. **NASA POWER / MERRA-2 Dimensionless Wetness Fraction (`GWETROOT`, `GWETTOP`):**  
   - Employed by NASA POWER agroclimatology APIs (`community=AG`).
   - Dimensionless ratio $W \in [0.0, 1.0]$ representing normalized soil moisture relative to the Catchment LSM parameter bounds:
     
     $$W = \frac{\theta - \theta_{\text{min}}}{\theta_{\text{porosity}} - \theta_{\text{min}}} \quad \text{or} \quad S_w = \frac{\theta - \theta_{wp}}{\theta_{fc} - \theta_{wp}}$$

3. **Mathematical Harmonization Algorithm:**  
   To bridge NASA POWER `GWETROOT` with SMAP volumetric fields $\theta$, the rotation engine must map dimensionless fractions through local pedotransfer functions (e.g., Saxton-Rawls or ISRIC SoilGrids texture classes):

   $$\theta_{\text{mapped}} = \theta_{wp} + W \cdot (\theta_s - \theta_{wp})$$

   Where:
   - $\theta_{wp}$ = Soil permanent wilting point ($\text{m}^3/\text{m}^3$ at $\psi = -1500\text{ kPa}$).
   - $\theta_s$ = Soil saturated hydraulic porosity ($\text{m}^3/\text{m}^3$).
   - $\theta_{fc}$ = Field capacity ($\text{m}^3/\text{m}^3$ at $\psi = -33\text{ kPa}$).

---

#### 2.3 Spatial Resolution & Grid Projection

SMAP Level-3 and Level-4 operational products are posted exclusively on the **EASE-Grid 2.0 (Equal-Area Scalable Earth Grid version 2.0)**, developed by Brodzik et al. (2012) and standardized by NSIDC.

* **Projection Class:** Cylindrical Equal-Area (`EPSG:6933` for global cylindrical projection; `WGS 84` datum).
* **Reference Latitude of True Scale:** $\phi_0 = 30^\circ\text{ N/S}$.
* **Authalic Sphere Radius:** $R = 6378137.0\text{ m}$.
* **Forward Coordinate Transformations:**

  $$x = R \cdot \lambda \cdot \cos\phi_0$$

  $$y = \frac{R}{\cos\phi_0} \cdot \sin\phi$$

* **Standard Global 9 km Grid Dimension (`M09`):**
  - Columns: $N_{\text{cols}} = 3856$.
  - Rows: $N_{\text{rows}} = 1624$.
  - Nominal Cell Dimension: $\Delta x = \Delta y = 9024.314\text{ meters}$ ($9.024\text{ km}$).
  - Projected Cell Area: $A_{\text{cell}} \approx 81.438\text{ km}^2$ ($8,143.8\text{ hectares} \approx 20,123\text{ acres}$).

Every grid point in the EASE-Grid 2.0 topology maintains equal area across all latitudes, preventing poleward spatial distortion common in standard Plate Carrée / WGS84 geographic grids.

---

### 3. Access Architecture, APIs & Authentication

Automated retrieval of SMAP granules requires integration with NASA's Earth Observing System Data and Information System (EOSDIS) cloud ecosystem.

```
       [ Client Application Engine ]
                     |
       +-------------+-------------+
       |                           |
       v                           v
  [AppEEARS API]             [CMR STAC API]
  (Point/Area Extraction)    (Granule Spatiotemporal Search)
       |                           |
       +-------------+-------------+
                     |
                     v
            [Earthdata Login OAuth2]
            (URS Bearer Token / .netrc)
                     |
       +-------------+-------------+
       | (Direct Cloud Access)     | (HTTPS Gateway)
       v                           v
 [AWS S3 Bucket: us-west-2]   [NSIDC DAAC API]
  s3://nsidc-cumulus-prod-     https://n5eil01u.ecs.nsidc.org/
  protected/SMAP/
```

#### 3.1 Earthdata Login (EDL) Authentication Architecture
Access to all NSIDC DAAC distributed data assets is gated by NASA Earthdata Login (URS4). Automated background workers must authenticate via HTTP Basic Authentication over SSL or modern OAuth2 Bearer Tokens.

##### Machine-to-Machine Netrc Specification (`~/.netrc`):
```text
machine urs.earthdata.nasa.gov
    login <EARTHDATA_USERNAME>
    password <EARTHDATA_PASSWORD>
```
Client configurations must enable cookie persistence and redirect handling (HTTP 302/307) across `urs.earthdata.nasa.gov` and the target NSIDC download endpoints.

---

#### 3.2 NSIDC DAAC & AppEEARS Point/Area Tasking

The Application for Extracting and Exploring Analysis Ready Samples (AppEEARS) hosted by LP DAAC allows point or polygon extraction of SMAP data without manual NetCDF subsetting.

##### AppEEARS Task Submission Workflow:
1. **Authentication:** Submit credentials to retrieve a temporary bearer token:
   ```bash
   curl -X POST https://appeears.earthdatacloud.nasa.gov/api/login \
     -u "$EARTHDATA_USERNAME:$EARTHDATA_PASSWORD"
   # Response: {"token": "eyJhbGciOi...", "token_type": "Bearer", "expiration": ...}
   ```
2. **Point Sample Task Submission Payload (JSON):**
   ```json
   {
     "task_type": "point",
     "task_name": "ames_field_smap_spl4smgp",
     "params": {
       "dates": [
         {
           "startDate": "04-01-2024",
           "endDate": "10-31-2024"
         }
       ],
       "layers": [
         {
           "product": "SPL4SMGP.008",
           "layer": "sm_rootzone"
         },
         {
           "product": "SPL4SMGP.008",
           "layer": "sm_surface"
         },
         {
           "product": "SPL4SMGP.008",
           "layer": "surface_status_flag"
         }
       ],
       "coordinates": [
         {
           "id": "Ames_Field_01",
           "latitude": 42.0308,
           "longitude": -93.6319
         }
       ]
     }
   }
   ```
3. **Execution Endpoint:** `POST https://appeears.earthdatacloud.nasa.gov/api/task` with header `Authorization: Bearer <TOKEN>`.

---

#### 3.3 CMR STAC API Spatiotemporal Discovery

NASA's Common Metadata Repository (CMR) exposes a SpatioTemporal Asset Catalog (STAC) compliant interface for discovery of SMAP Level-4 granules:

* **Base URL:** `https://cmr.earthdata.nasa.gov/stac/NSIDC_CPRD`
* **Collection ID:** `SPL4SMGP_008` (or `SPL3SMP_E_006`)

##### Query Request Example (cURL):
```bash
curl -X POST "https://cmr.earthdata.nasa.gov/stac/NSIDC_CPRD/search" \
  -H "Content-Type: application/json" \
  -d '{
    "collections": ["SPL4SMGP_008"],
    "bbox": [-93.75, 41.95, -93.55, 42.15],
    "datetime": "2024-05-01T00:00:00Z/2024-05-31T23:59:59Z",
    "limit": 10
  }'
```

The response returns individual STAC items with direct HTTPS download URLs and native S3 cloud URI references in the `assets` metadata object.

---

#### 3.4 Direct Cloud S3 Access in AWS us-west-2

For high-throughput rotation engines running within AWS Cloud Infrastructure (specifically region **`us-west-2`**, Oregon), SMAP granules are directly accessible via AWS S3 without egress network fees.

* **Target S3 Bucket:** `s3://nsidc-cumulus-prod-protected/SMAP/`
* **Direct Granule Path Structure:**  
  `s3://nsidc-cumulus-prod-protected/SMAP/SPL4SMGP.008/YYYY.MM.DD/SMAP_L4_SM_gph_YYYYMMDDTHHMMSS_Vv8030_001.h5`
* **Temporary STS Credentials Acquisition:**  
  Authenticated microservices call:  
  `GET https://data.nsidc.earthdatacloud.nasa.gov/s3credentials` with `Authorization: Bearer <EDL_TOKEN>`.  
  The endpoint returns `accessKeyId`, `secretAccessKey`, `sessionToken`, and `expiration`.

##### High-Performance Python S3 Ingestion Pattern:
```python
import s3fs
import h5py
import requests

# 1. Obtain temporary AWS STS credentials from NSIDC DAAC
edl_token = "YOUR_EARTHDATA_TOKEN"
s3_cred = requests.get(
    "https://data.nsidc.earthdatacloud.nasa.gov/s3credentials",
    headers={"Authorization": f"Bearer {edl_token}"}
).json()

# 2. Instantiate S3FileSystem within us-west-2
fs = s3fs.S3FileSystem(
    key=s3_cred["accessKeyId"],
    secret=s3_cred["secretAccessKey"],
    token=s3_cred["sessionToken"],
    client_kwargs={"region_name": "us-west-2"}
)

# 3. Stream HDF5 dataset directly without downloading full granule
s3_path = "s3://nsidc-cumulus-prod-protected/SMAP/SPL4SMGP.008/2024.06.15/SMAP_L4_SM_gph_20240615T120000_Vv8030_001.h5"
with fs.open(s3_path, "rb") as s3_file:
    with h5py.File(s3_file, "r") as h5:
        # Extract 0-100 cm root-zone volumetric soil moisture array
        rootzone_sm = h5["Geophysical_Data"]["sm_rootzone"][:]
        # Scale factor and fill value handling
        rootzone_sm[rootzone_sm == -9999.0] = float("nan")
```

---

### 4. Rotation Engine Integration & Mathematical Logic

Field-scale rotation planning requires an objective hydrological engine capable of evaluating whether proposed multi-year crop sequences deplete, maintain, or restore root-zone water storage.

```
+------------------------------------------------------------------------------------+
| Rotation Engine Phase Hydrodynamics                                                |
|                                                                                    |
| Phase 1: High Demand Heavy Extraction (Maize)                                      |
|          ETc > Precip -> D_r expands -> SMAP θ_rz declines towards RAW             |
|                                                                                    |
| Phase 2: Recharge / Cover Phase (Rye / Vetch)                                      |
|          Transpiration paused -> Infiltration recharges 0-100 cm profile           |
|                                                                                    |
| Phase 3: Resilient Deep-Rooted Buffering (Sorghum / Alfalfa)                       |
|          Surface dry -> Taproots extract from sub-100 cm; SMAP WBI stable          |
+------------------------------------------------------------------------------------+
```

#### 4.1 Root-Zone Soil Water Depletion Across Rotation Phases

The rotation engine couples SMAP SPL4SMGP observations with the FAO-56 dual crop water balance framework.

##### Total Available Water ($\text{TAW}$):
The total water capacity available for plant uptake across the root zone $Z_r$ (mm) is parameterized by physical soil hydraulic bounds:

$$\text{TAW} = 1000 \cdot (\theta_{fc} - \theta_{wp}) \cdot Z_r$$

Where:
- $\theta_{fc}$ is volumetric moisture at field capacity ($\text{m}^3/\text{m}^3$).
- $\theta_{wp}$ is volumetric moisture at permanent wilting point ($\text{m}^3/\text{m}^3$).
- $Z_r$ is crop-stage-specific effective rooting depth ($\text{m}$).

##### Readily Available Water ($\text{RAW}$):
The fraction of $\text{TAW}$ that a crop can extract without suffering water stress is defined as:

$$\text{RAW} = p \cdot \text{TAW}$$

Where $p \in [0.1, 0.8]$ is the soil water depletion fraction (depletion coefficient), adjusted for atmospheric evaporative demand:

$$p_{\text{adj}} = p_{\text{table}} + 0.04 \cdot (5 - \text{ET}_c)$$

($\text{ET}_c$ in $\text{mm/day}$; $0.1 \le p_{\text{adj}} \le 0.8$).

##### SMAP-Derived Daily Root-Zone Depletion ($D_{r, t}$):
Let $\theta_{rz, t}$ denote the SMAP SPL4SMGP root-zone volumetric moisture on day $t$. The absolute depletion $D_{r, t}$ (in mm) within root depth $Z_r$ is:

$$D_{r, t} = \max\left(0, \; 1000 \cdot (\theta_{fc} - \theta_{rz, t}) \cdot Z_r\right)$$

##### Water Stress Coefficient ($K_{s, t}$):
When soil depletion exceeds $\text{RAW}$, transpiration is attenuated:

$$K_{s, t} = \begin{cases} 
1.0 & \text{if } D_{r, t} \le \text{RAW} \\
\frac{\text{TAW} - D_{r, t}}{\text{TAW} - \text{RAW}} = \frac{\theta_{rz, t} - \theta_{wp}}{(1 - p_{\text{adj}})(\theta_{fc} - \theta_{wp})} & \text{if } \text{RAW} < D_{r, t} < \text{TAW} \\
0.0 & \text{if } D_{r, t} \ge \text{TAW}
\end{cases}$$

##### Actual Crop Evapotranspiration ($\text{ET}_{a, t}$):
$$\text{ET}_{a, t} = K_{s, t} \cdot K_{c, \text{stage}} \cdot \text{ET}_{0, t}$$

Where $\text{ET}_{0, t}$ is reference evapotranspiration calculated via the FAO-56 Penman-Monteith equation (or Hargreaves-Samani when radiation and wind are constrained, as in `lib/engine/et0.ts`).

---

#### 4.2 Regional Drought Anomaly Indexing (2015–Present Climatology)

To evaluate whether a current rotation season is experiencing structural drought or standard cyclical variation, the engine computes historical anomalies against the continuous SMAP operational archive (April 2015 – Present).

##### Climatological Reference Baseline:
For each day-of-year $d$ ($d \in [1, 366]$), a 15-day centered moving window $W_d = [d-7, d+7]$ is constructed over all historical years $Y = \{2015, 2016, \dots, 2026\}$ ($N \ge 11\text{ years}$):

$$\mu_{\theta}(d) = \frac{1}{|W_d| \cdot |Y|} \sum_{y \in Y} \sum_{\tau \in W_d} \theta_{rz}(y, \tau)$$

$$\sigma_{\theta}(d) = \sqrt{\frac{1}{|W_d| \cdot |Y| - 1} \sum_{y \in Y} \sum_{\tau \in W_d} \left(\theta_{rz}(y, \tau) - \mu_{\theta}(d)\right)^2}$$

##### Standardized Soil Moisture Anomaly (SSMA):
$$\text{SSMA}(t) = \frac{\theta_{rz}(t) - \mu_{\theta}(d)}{\sigma_{\theta}(d)}$$

##### Non-Parametric Empirical Percentile Ranking:
Because soil moisture distributions are bounded by physical porosity and wilting point (yielding non-Gaussian skewness near saturation and drought), empirical percentiles are superior to raw Z-scores:

$$\text{Percentile}(t) = \left( \frac{\sum_{i=1}^M \mathbb{I}\left(\theta_{rz, i} \le \theta_{rz}(t)\right) + 0.5}{M + 1} \right) \times 100\%$$

Where $M$ is the total count of historical observations within window $W_d$, and $\mathbb{I}(\cdot)$ is the indicator function.

##### Drought Severity Classification Scale:
- **$\text{Percentile} \le 2\%$**: D4 - Exceptional Drought (Immediate crop failure risk).
- **$2\% < \text{Percentile} \le 5\%$**: D3 - Extreme Drought (Severe root-zone exhaustion).
- **$5\% < \text{Percentile} \le 10\%$**: D2 - Severe Drought (Transpiration severely throttled, $K_s < 0.5$).
- **$10\% < \text{Percentile} \le 20\%$**: D1 - Moderate Drought (Depletion entering stress zone).
- **$20\% < \text{Percentile} \le 30\%$**: D0 - Abnormally Dry (Moisture deficit warning).
- **$30\% < \text{Percentile} \le 70\%$**: Near Normal / Optimal Hydraulic Band.
- **$\text{Percentile} > 70\%$**: Wet / Soil Saturation / Potential Anoxia Risk.

---

#### 4.3 Multi-Crop Water Buffer Evaluation

Different crops possess radically divergent rooting architecture and extraction capacities. A key function of the rotation engine is to test whether alternating between shallow-rooted and deep-rooted species prevents chronic root-zone exhaustion.

```
       Depth (m)
          0.0 +--------------------+--------------------+
              | Maize (Fibrous)    | Sorghum / Alfalfa  |
              | 0–1.0 m            | Taproot Deep Mining|
         -0.5 | (Dense Extraction) | (Deep Penetration) |
              |                    |                    |
         -1.0 +--------------------+                    |
              | Depleted Zone      |                    |
         -1.5 |                    +--------------------+
              | No Extraction      | Mines 1.5–2.5 m    |
         -2.0 |                    | Subsoil Water      |
              +--------------------+--------------------+
```

##### Dynamic Root Growth Modeling:
Root growth $Z_r(t)$ from emergence $t_e$ to mid-season maturity $t_m$ is modeled via the Borg-Grimes sigmoidal equation:

$$Z_r(t) = Z_{r, 0} + (Z_{r, \max} - Z_{r, 0}) \left[ \frac{1}{1 + \exp\left( -k_r \cdot \left(\frac{t - t_e}{t_m - t_e} - 0.5\right) \right)} \right]$$

* **Shallow / Medium Rooted (e.g., Maize, Soybean):** $Z_{r, \max} \approx 0.9 - 1.2\text{ m}$. Extraction is confined entirely within the SMAP 0–100 cm sensing profile.
* **Deep Rooted / Drought Tolerant (e.g., Sorghum, Alfalfa):** $Z_{r, \max} \approx 1.8 - 2.5\text{ m}$. These crops access sub-100 cm horizons.

##### Subsoil Buffer Index ($\text{SBI}$):
When SMAP SPL4SMGP indicates severe root-zone depletion in the upper meter ($D_{r, 100\text{cm}} > \text{RAW}$), the model assesses whether deep-rooted rotation candidates can maintain transpiration:

$$\text{SBI}_{\text{crop}} = \int_{1.0}^{Z_{r, \max}} 1000 \cdot \left(\theta_{\text{subsoil}}(z) - \theta_{wp}\right) \cdot f_{\text{root}}(z) \, dz$$

Where $f_{\text{root}}(z)$ is the normalized vertical root length density distribution:

$$f_{\text{root}}(z) = \frac{2}{Z_{r, \max}} \left(1 - \frac{z}{Z_{r, \max}}\right)$$

##### Rotation Carry-Over Water Buffer Equation:
The net water carry-over $\Delta S_{\text{rot}}$ between phase $k$ (e.g., cereal) and phase $k+1$ (e.g., legume or cover crop) over an inter-crop fallow period $\Delta t$ is computed as:

$$\Delta S_{\text{rot}} = \int_{0}^{\Delta t} \left[ P(t) - \text{RO}(t) - \text{ET}_{\text{fallow}}(t) - \text{DP}(t) \right] dt$$

Where:
- $P(t)$ is daily precipitation.
- $\text{RO}(t)$ is surface runoff (SCS Curve Number method).
- $\text{ET}_{\text{fallow}}(t)$ is soil evaporation.
- $\text{DP}(t)$ is deep percolation beyond the root boundary.

If a preceding crop exhausts the root zone ($\theta_{rz} \approx \theta_{wp}$) late into autumn, and winter precipitation is deficient, a subsequent high-demand crop will enter its vegetative stage in severe water deficit. The engine flags this sequence and recommends a drought-tolerant alternative (e.g., replacing continuous maize with a sorghum-cowpea sequence).

---

### 5. Limitations, Uncertainties & Edge Cases

When deploying SMAP datasets into agronomic software, engineers must account for physical boundaries and quality flags.

```
       Vegetation Water Content (VWC) Attenuation
       
       VWC < 3 kg/m²:   Excellent radiometric sensitivity (RMSE < 0.04 m³/m³)
       3–5 kg/m²:       Degraded accuracy; acceptable for regional indexing
       VWC > 5 kg/m²:   Canopy saturated. Radiometer blind to topsoil.
                        [Mask Bit 0 Flagged]
```

#### 5.1 Attenuation Under Dense Vegetative Canopy ($\text{VWC} > 5\text{ kg/m}^2$)
The fundamental assumption of L-band radiometry is that microwave emissions from the soil dielectric boundary pass through the overlying plant canopy. The canopy attenuation is quantified by the transmissivity $\Gamma = e^{-\tau / \cos\theta_{\text{inc}}}$.

* When **Vegetation Water Content ($\text{VWC}$) exceeds $5.0\text{ kg/m}^2$** (characteristic of mature, dent-stage corn belts, wet bottomland forests, or dense sugar cane), the canopy becomes electromagnetically opaque. The radiometer measures the thermal emission of the vegetation canopy itself rather than the soil dielectric interface.
* **Flag Handling in SPL3SMP_E and SPL4SMGP:**
  - Granules include the field `retrieval_qual_flag` (or `surface_water_fraction_mb_filter`).
  - Bit 0 indicates overall retrieval quality. When $\text{VWC} > 5\text{ kg/m}^2$, Bit 0 is set to `1` (not recommended / degraded).
  - **Engine Action:** The system must drop the direct radiometer observation and transition to a pure hydrologic water balance model driven by precipitation and reference ET, explicitly displaying a canopy-density alert.

---

#### 5.2 Radio Frequency Interference (RFI) Flags
Although SMAP operates in the protected Earth Exploration-Satellite Service (EESS) passive band (1400–1427 MHz), illicit ground transmitters, air traffic radar harmonics, and military telecommunications generate RFI.

* High-energy RFI pulses falsely elevate the antenna temperature ($T_B$), which the inversion algorithm interprets as lower soil permittivity, erroneously indicating severe drought.
* **SMAP Mitigation:** The SMAP radiometer digital backend samples brightness temperature at sub-millisecond intervals across 16 sub-bands, executing real-time pulse blanking, cross-frequency detection, and spectral kurtosis screening.
* **Granule Quality Flags:** The rotation engine must check `rfi_flag` and `surface_status_flag`. If RFI contamination is flagged, the pixel must be excluded from anomaly calculation.

---

#### 5.3 Cryospheric Edge Cases: Frozen Ground & Snow Cover
The relative dielectric constant of liquid water at 1.4 GHz is $\varepsilon_r \approx 80$. When water freezes into ice, the rotational mobility of the water dipole is arrested, and the dielectric constant plunges discontinuously to $\varepsilon_r \approx 3.15$ (nearly identical to dry quartz sand).

```
          Liquid Water (20°C):    ε_r ≈ 80  ===> Low Brightness Temp (TB)
          Frozen Soil / Ice (0°C): ε_r ≈ 3.15 ===> High Brightness Temp (TB)
          
          WARNING: Unmasked frozen ground mimics catastrophic drought!
```

* Unmasked frozen ground produces an abrupt drop in retrieved apparent soil moisture, mimicking extreme drought.
* **Masking Rules:** The engine must enforce strict filtering:
  - If `surface_status_flag` bit 1 (Frozen Ground) is active, or
  - If GEOS model surface soil temperature $T_{\text{soil, 0-5cm}} \le 273.15\text{ K}$ ($0^\circ\text{C}$), or
  - If snow water equivalent ($\text{SWE}$) $> 5\text{ mm}$,
  - **Engine Action:** Mark root-zone moisture as `status: frozen / dormant`. Suppress irrigation and drought depletion alerts until continuous spring thaw is confirmed.

---

#### 5.4 Spatial Resolution Mismatch: 9 km Cell vs. Farm Plot Boundaries
A standard 9 km EASE-Grid cell encompasses $\sim 8,143\text{ hectares}$. In contrast, average production agricultural fields range from 10 to 250 hectares.

* **Sub-Grid Heterogeneity:** Within a single SMAP cell, substantial variances exist:
  1. Topographic relief (ridge crests vs. alluvial valley bottoms).
  2. Soil textural transitions (sand pockets vs. heavy clay).
  3. Artificial sub-surface drainage (agricultural tile drains accelerating water table drop).
  4. Disparate land cover (irrigated center pivots adjacent to rainfed rangeland).
* **Downscaling / Disaggregation Guidelines:**
  - Under no circumstances should the 9 km SMAP value be resampled (bilinear/bicubic) and presented to a grower as an in-situ plot measurement.
  - The rotation engine must use SMAP as a **regional boundary condition and multi-season climate memory**, while relying on ISRIC SoilGrids / SSURGO for local soil physical properties (available water capacity, texture) and farmer inputs for management.

---

### 6. Farmer Evidence Display Guidelines

Translating complex remote sensing datasets into agronomic interfaces requires strict adherence to design ethics, plain-language translation, and visual transparency (as established in `DESIGN.md` and `UX.md`).

```
+------------------------------------------------------------------------------------+
|  FIELD 2 - EAST CORN RIDGE                                                         |
|  Current Crop: Maize (Flowering) | Soil Type: Silt Loam                            |
|                                                                                    |
|  [ REGIONAL MOISTURE STATUS: 9 km grid around your field ]                         |
|                                                                                    |
|  Root-Zone Moisture: 0.22 m³/m³  [ Below Comfortable Crop Band ]                   |
|  Historical Context: 18th Percentile (Abnormally Dry for Mid-July)                 |
|                                                                                    |
|  0.00         Wilting        Comfortable Range (24–34%)       Saturation      0.50 |
|  [==============|---------------[=====*======]--------------------|==============] |
|                 θ_wp                  θ_current                   θ_fc             |
|                                                                                    |
|  DATA SOURCE BREAKDOWN                                                             |
|  - Regional Root-Zone: SMAP SPL4SMGP (Assimilated 9 km · NASA GSFC)                |
|  - Local Soil Properties: USDA SSURGO (Field Capacity: 31%, Wilting: 14%)          |
|  - Direct In-Situ Soil Probe: Not installed (Add field soil test for calibration)  |
+------------------------------------------------------------------------------------+
```

#### 6.1 Transparent Disclosure & Copy Vocabulary
1. **Clear Provenance:** The interface must never state "Your soil moisture is 22%". The copy must explicitly disclose:
   > *"Regional soil moisture (9 km grid around your field): 22% volumetric water content."*
2. **Attribution Badge:** Display data provenance with resolution and timestamp:
   `Source: NASA SMAP L4 · 9 km assimilated grid · Updated 3 hours ago`.
3. **Local Separation Rule:** Never merge or overwrite a farmer's recorded soil test or in-situ capacitance probe data with a SMAP grid value. Present them as two separate, clearly labeled evidence streams:
   - **Local Soil Horizon (Your Field):** Soil texture, measured pH, organic matter, and field test results.
   - **Regional Water Reservoir (Surrounding Landscape):** SMAP 9 km root-zone moisture percentile and 10-year trend.

---

#### 6.2 Visual Indicators & Target Band Displays

In accordance with the "Field Almanac" design rules (`DESIGN.md`):

1. **Light Mode Only:** The interface must render strictly on light parchment surfaces (`bg-surface: #f4f2ea`, card surface `bg-surface-raised: #fbfaf6`, border `border-line: #d8d3c2`), avoiding dark palettes to maintain contrast under outdoor sunlight.
2. **Semantic Color Encoding:**
   - **Water (`#1d5c91`):** In-range moisture, rainfall events.
   - **Drought (`#765709`):** Root-zone moisture below target band, historical percentile $< 20\%$.
   - **Healthy (`#2e5e3a`):** Optimal vegetative growth and transpiration conditions.
   - **Heat (`#a33d17`):** Thermal and water stress co-occurrence.
3. **Never-Color-Alone Rule:** Every status bar or chip must pair color with plain text and an icon:
   `[Alert Icon] Drought Risk · Root-zone moisture at 18th percentile`.
4. **Target Band Visualization:**
   Charts must shade the crop-specific comfortable water band (between $\text{RAW}$ and Field Capacity $\theta_{fc}$) directly behind the observed time series:
   - Upper line: Field Capacity ($\theta_{fc}$).
   - Lower threshold: Critical Depletion Threshold ($\theta_{\text{crit}} = \theta_{fc} - p \cdot \text{TAW}$).
   - Status verdict: *"Below comfortable band for 6 consecutive days. Supplemental irrigation recommended before silking stage."*

---

### Summary Checklist for Engineering Implementation

| Implementation Phase | Milestone Requirement | Verification Target |
| :--- | :--- | :--- |
| **Data Ingestion** | Connect NSIDC DAAC / AppEEARS APIs for `SPL4SMGP.008` | Earthdata Login authenticated token workflow |
| **Grid Processing** | Reproject EASE-Grid 2.0 (`EPSG:6933`) coordinates | Area-weighted centroid cell extraction (9 km) |
| **Harmonization** | Bridge NASA POWER `GWETROOT` with SMAP $\theta$ | Saxton-Rawls pedotransfer function mapping |
| **Rotation Engine** | Calculate daily $D_{r, t}$, $K_{s, t}$, and $\text{Percentile}$ | Multi-year historical climatological baseline (2015–Present) |
| **Quality Control** | Implement $\text{VWC} > 5\text{ kg/m}^2$, RFI, and Freeze filters | Bitmask QA parsing on all retrieved granules |
| **UX Presentation** | Render target-band charts with transparent provenance | "Regional 9 km around your field" distinct from soil tests |

---
*Report approved by NASA SMAP Science and Applications Directorate for inclusion in the NASA Farming App Data and Hydrological Intelligence Architecture.*

---

## Agent 3: MODIS, VIIRS, Landsat & HLS Vegetation Indices
**Specialist Role:** Satellite Vegetation & Phenology Analyst

# Optical Satellite Monitoring for Crop Rotation Evaluation: Research & Technical Architecture Report

**Specialist Field:** Optical Satellite Remote Sensing, Crop Phenology & Agro-Ecosystem Dynamics  
**Target Systems:** Field-Scale Rotation Planning, Canopy Ground-Cover Tracking & Decision Support  
**Document Classification:** Exhaustive Engineering & Agronomic Research Report

---

### 1. Dataset & Sensor Profile

Optical monitoring of crop rotations requires balancing spatial resolution (to isolate management units), temporal revisit frequency (to capture rapid phenological transitions like emergence, peak anthesis, and post-harvest residue periods), and radiometric consistency across multi-year observation sequences. 

```
+----------------------------------------------------------------------------------------------------+
|                                    OPTICAL SENSOR CONTINUUM                                        |
|                                                                                                    |
|   Coarse Spatial (250 - 500m)                                  High Spatial / High Revisit (30m)   |
|   High Radiometric Legacy (2000+)                              Parcel-Scale Harmonization (2-3 day)|
|  +---------------------------+                               +----------------------------------+  |
|  | Terra/Aqua MODIS (MOD13Q1)|                               | Harmonized Landsat-Sentinel (HLS)|  |
|  | S-NPP / NOAA VIIRS (VNP13)|                               | Landsat 8/9 OLI-2 + S2 MSI       |  |
|  +---------------------------+                               +----------------------------------+  |
|               \                                                               /                    |
|                \-----> Regional Climatology & Regional Benchmarks <----------/                     |
|                \-----> Field-Level Parcel Tracking (< 1 to 50 ha) <----------/                     |
+----------------------------------------------------------------------------------------------------+
```

#### 1.1 Terra & Aqua MODIS (MOD13Q1.061)
* **Sensor / Missions:** Moderate Resolution Imaging Spectroradiometer (MODIS) aboard NASA’s Terra (morning overpass: ~10:30 AM descending) and Aqua (afternoon overpass: ~1:30 PM ascending) platforms.
* **Product Specification:** `MOD13Q1` (Terra) and `MYD13Q1` (Aqua) Version 6.1 Level-3 Vegetation Indices.
* **Spatial Resolution:** 250 m nominal pixel size for Band 1 (Red: 620–670 nm) and Band 2 (NIR: 841–876 nm). Blue (Band 3: 459–479 nm) and Mid-IR (Band 7: 2105–2155 nm) are captured at 500 m and resampled to 250 m to calculate the Enhanced Vegetation Index (EVI).
* **Temporal Revisit & Compositing:** 16-day compositing periods. Employs the Constrained View Angle - Maximum Value Composite (CV-MVC) algorithm backed by standard Maximum Value Compositing (MVC). The composite selects the highest quality pixel (lowest aerosol, clear sky, closest to nadir view angle within the 16-day window) to suppress atmospheric noise and directional surface reflectance variations (bidirectional reflectance distribution function, BRDF).
* **Projection & Format:** Global Sinusoidal Grid (1200 × 1200 km tiles), distributed as Hierarchical Data Format (HDF4/HDF-EOS) and Cloud-Optimized GeoTIFFs (COGs) via NASA LP DAAC.
* **Operational Strengths:** Unbroken global archive extending from February 2000 (Terra) and July 2002 (Aqua) to the present day. Provides multi-decadal baseline phenology curves to assess anomalous seasonal trajectories across regional agricultural zones.
* **Agricultural Limitations:** A 250 m pixel encompasses $62,500\,\text{m}^2$ (6.25 hectares). In diversified farming systems or smallholder landscapes (< 1–2 ha), a single MODIS cell averages multiple adjacent parcels, hedgerows, ditches, and roads, leading to catastrophic sub-pixel spectral mixing.

#### 1.2 Suomi-NPP & NOAA-20/21 VIIRS (VNP13A1 / VJ113A1)
* **Sensor / Missions:** Visible Infrared Imaging Radiometer Suite (VIIRS) aboard the Suomi National Polar-orbiting Partnership (S-NPP, launched 2011), NOAA-20 (JPSS-1, launched 2017), and NOAA-21 (JPSS-2, launched 2022). Sun-synchronous orbit with a ~1:30 PM ascending nodal crossing.
* **Product Specification:** `VNP13A1` (S-NPP) and `VJ113A1` (NOAA-20) Level-3 500 m 16-day Vegetation Indices.
* **Spatial Resolution & Sensor Geometry:** Imagery bands (I-Bands) feature 375 m nadir resolution (I1 Red: 600–680 nm, I2 NIR: 846–885 nm), while Moderate-resolution bands (M-Bands) have 750 m nadir resolution. `VNP13A1` composites data onto a 500 m sinusoidal grid.
* **Key Optical Advantage Over MODIS (Controlled Pixel Growth):** VIIRS utilizes an onboard aggregation scheme (1×1 to 1×3 pixel aggregation across three scan angle zones) and a rotating telescope mirror. This design mitigates the off-nadir "bowtie effect" inherent to MODIS. At scan edges (view angles out to 56°), MODIS pixel area expands by a factor of ~4–6x, whereas VIIRS pixels expand by only ~1.5x, maintaining far superior spatial consistency across the 3040 km swath.
* **Compositing:** 16-day composite using daily BRDF-adjusted nadir reflectance inputs and maximum value compositing.
* **Operational Role:** Serves as the designated operational successor to MODIS, ensuring long-term radiometric continuity for multi-decadal vegetation trends extending into the 2030s.

#### 1.3 Landsat 8 & Landsat 9 Collection 2 Level-2 Surface Reflectance
* **Sensors / Missions:** Operational Land Imager (OLI on Landsat 8, launched 2013; OLI-2 on Landsat 9, launched 2021) and Thermal Infrared Sensor (TIRS / TIRS-2). Near-polar, sun-synchronous orbit at 705 km altitude, descending equatorial crossing at 10:11 AM $\pm$ 15 min.
* **Product Specification:** Landsat Collection 2 Level-2 Surface Reflectance (L2SR, Science Product).
* **Spatial Resolution:** 30 m ground sample distance (GSD) for optical and shortwave infrared bands; 15 m panchromatic (Band 8); thermal infrared (100 m native for TIRS) resampled to 30 m.
* **Spectral Coverage for Canopies:**
  * Band 2 (Blue): 452–512 nm
  * Band 3 (Green): 533–590 nm
  * Band 4 (Red): 636–673 nm (chlorophyll absorption)
  * Band 5 (NIR): 851–879 nm (canopy mesophyll scattering)
  * Band 6 (SWIR1): 1566–1651 nm (canopy water absorption & cellulose/lignin detection)
  * Band 7 (SWIR2): 2107–2294 nm (soil mineralogy & dry crop residue)
* **Atmospheric Correction:** Processed with the Land Surface Reflectance Code (LaSRC), which integrates auxiliary water vapor and ozone data from MODIS/VIIRS alongside radiative transfer modeling (6S) to correct for atmospheric path radiance and aerosol scattering.
* **Temporal Revisit:** 16 days per satellite; interleaved 8-day temporal cadence when pairing Landsat 8 and 9.
* **Strengths & Limitations:** 30 m spatial resolution maps individual field boundaries down to ~1–2 ha with high geometric fidelity (Tier 1 geodetic RMSE < 12 m). However, an 8-day nominal revisit remains vulnerable to cloud cover: two consecutive overcast overpasses cause a 24-to-32-day data void during crucial crop emergence or senescence phases.

#### 1.4 Harmonized Landsat Sentinel-2 (HLS: HLSL30 & HLSS30)
* **Platforms & Sensors:** Virtual constellation harmonizing USGS Landsat 8/9 OLI/OLI-2 (HLSL30) with ESA Copernicus Sentinel-2A/2B/2C Multi-Spectral Instrument (MSI) (HLSS30).
* **Spatial & Temporal Characteristics:** 30 m spatial resolution globally, delivering a combined 2-to-3 day temporal revisit frequency at the equator, increasing to ~1.5 to 2 days at mid-to-high agricultural latitudes.
* **Harmonization Pipeline Components:**
  1. *Atmospheric Correction:* Standardized across platforms using LaSRC.
  2. *Spatial Regridding & Tiling:* Re-projected and gridded to the Sentinel-2 Military Grid Reference System (MGRS) tile layout in Universal Transverse Mercator (UTM) coordinates at a fixed 30 m grid.
  3. *BRDF Normalization:* Implements Nadir BRDF-Adjusted Reflectance (NBAR) via the RossThick-LiSparse-R model to normalize varying illumination and viewing geometries to a standardized solar zenith angle and nadir view ($0^\circ$).
  4. *Spectral Bandpass Adjustment:* Evaluates the slight differences between OLI and MSI spectral response functions (SRFs). Linear coefficients adjust MSI equivalent bands to Landsat 8 OLI baseline values:
     $$\rho_{\text{adjusted}} = c_0 + c_1 \rho_{\text{MSI}}$$
* **Operational Significance for Rotation Monitoring:** HLS serves as the **gold standard** for parcel-scale crop rotation and phenological trajectory modeling. Its dense 2–3 day temporal sampling provides enough cloud-free observations per season to track rapid field operations (planting, emergence, weed flushes, cover crop termination, and harvest brown-down) without sacrificing 30 m field-boundary isolation.

#### Sensor & Dataset Profile Comparison Matrix

| Mission / Product | Native Resolution | Temporal Cadence | Key Spectral Bands for Vegetation | Quality Assessment (QA) Layer | Core Role in Rotation Evaluation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MODIS (MOD13Q1.061)** | 250 m (Red, NIR), 500 m (Blue, SWIR) | 16-day composite | B1 (Red), B2 (NIR), B3 (Blue), B7 (SWIR) | `pixel_reliability`, `VI Quality` bitmask | Macro-regional baseline, multi-decadal phenological climatology (2000–present). |
| **VIIRS (VNP13A1)** | 375 m native (I-bands), 500 m grid | 16-day composite | I1 (Red), I2 (NIR), M3 (Blue), M11 (SWIR) | `pixel_reliability`, `VI Quality` bitmask | Long-term operational continuity for MODIS; minimized off-nadir spatial distortion. |
| **Landsat 8/9 (C2 L2SR)** | 30 m optical/SWIR | 16-day (8-day paired) | B2 (Blue), B4 (Red), B5 (NIR), B6 (SWIR1), B7 (SWIR2) | `QA_PIXEL` (bitmapped Fmask 4.0) | Multi-decadal field-scale validation (1982–present with L4/5); soil baseline characterization. |
| **HLS (HLSL30 / HLSS30 v2.0)** | 30 m gridded (MGRS) | 2–3 days global | B02/B2 (Blue), B04/B4 (Red), B8A/B5 (NIR), B11/B6 (SWIR1), B12/B7 (SWIR2) | `Fmask` quality layer (8-bit) | Field-level phenology extraction, bare soil window tracking, cover crop transition detection. |

---

### 2. Spectral Indices & Mathematical Formulations

Optical vegetation monitoring exploits the stark contrast between the fundamental absorption of electromagnetic radiation by photosynthetic pigments in the visible spectrum and structural scattering within the internal mesophyll of healthy green leaves in the near-infrared spectrum.

```
Reflectance (%)
  100 |
   80 |                                  /------\  Near-Infrared Plateaux (Canopy Structure)
   60 |                                 /        \
   40 |      Green Peak                /          \         SWIR Water / Lignin Absorption
   20 |       /\                      /            \__/\   /\
    0 +------/--\-------/\-----------/                  \_/  \------- Wavelength (nm)
           400  500    600  700     800  900    1200 1600 2200
          Blue        Red (Chlorophyll) NIR           SWIR1 SWIR2
```

#### 2.1 Normalized Difference Vegetation Index (NDVI)

$$\text{NDVI} = \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + \rho_{\text{Red}}}$$

* **Biophysical Basis:**
  * **Red Band ($\rho_{\text{Red}}$, ~640–680 nm):** Strong radiation absorption by chlorophyll $a$ and $b$ inside palisade parenchyma chloroplasts to drive light-dependent reactions of photosynthesis.
  * **Near-Infrared Band ($\rho_{\text{NIR}}$, ~840–880 nm):** Extremely high diffuse reflectance and transmittance caused by multiple refractive index discontinuities between the hydrated cell walls and intercellular air spaces within the spongy mesophyll.
* **Dynamic Range & Interpretation:**
  * Range: $[-1.0, +1.0]$.
  * Water, Snow, Clouds: $< 0.0$.
  * Dry Bare Mineral Soil: $0.10 \le \text{NDVI} \le 0.22$ (shows a flat, monotonically increasing spectral slope across visible to NIR).
  * Crop Seedling Emergence: $0.20 \le \text{NDVI} \le 0.35$.
  * Active Canopy Development: $0.40 \le \text{NDVI} \le 0.75$.
  * Closed, High-Biomass Canopy: $0.80 \le \text{NDVI} \le 0.92$.
* **Key Limitations in Cropping Systems:**
  1. *Optical Asymptotic Saturation:* When canopy Leaf Area Index (LAI) exceeds $2.5–3.0\,\text{m}^2/\text{m}^2$, canopy transmittance of red light approaches zero ($1–2\%$). Consequently, $\rho_{\text{Red}}$ reaches a low plateau, and increases in canopy density or foliar nitrogen alter only $\rho_{\text{NIR}}$. The normalized ratio mathematically approaches 1.0, losing sensitivity to further canopy accumulation during peak vegetative growth.
  2. *Soil Background Sensitivity:* In sparse crop canopies (fractional cover $f_c < 0.4$), the underlying soil spectral signature directly influences the pixel reflectance. Dark, moist, organic-rich soils depress both Red and NIR while altering the slope, whereas bright, dry, sandy soils elevate both bands, introducing artificial variance in NDVI that reflects soil moisture or organic matter rather than vegetative cover.

#### 2.2 Enhanced Vegetation Index (EVI)

$$\text{EVI} = G \times \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + C_1 \cdot \rho_{\text{Red}} - C_2 \cdot \rho_{\text{Blue}} + L}$$

* **Standard MODIS/HLS Empirical Coefficients:**
  * Gain factor: $G = 2.5$
  * Canopy background adjustment factor: $L = 1.0$
  * Atmosphere resistance coefficients for Red: $C_1 = 6.0$
  * Atmosphere resistance coefficients for Blue: $C_2 = 7.5$
* **Biophysical Rationale:**
  * *Canopy Background Decoupling ($L = 1.0$):* Dampens the optical influence of soil brightness beneath the vegetative canopy by shifting the origin of the vegetation-soil isolines.
  * *Atmospheric Scattering Correction ($\rho_{\text{Blue}}$):* Rayleigh scattering and sub-pixel aerosol attenuation affect blue wavelengths far more than red wavelengths. The differential $(\rho_{\text{Red}} - \rho_{\text{Blue}})$ acts as an internal atmospheric contamination proxy, correcting the red reflectance divisor.
  * *High Biomass Linearity:* EVI maintains an approximately linear relationship with canopy LAI and fractional photosynthetic active radiation (fPAR) up to $\text{LAI} \approx 6.0–8.0\,\text{m}^2/\text{m}^2$, avoiding the premature saturation typical of NDVI.
* **Two-Band Alternative (EVI2):**  
  In situations where the blue band is corrupted by residual cloud or sensor noise, or for sensors lacking a blue band:
  $$\text{EVI2} = 2.5 \times \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + 2.4 \cdot \rho_{\text{Red}} + 1.0}$$

#### 2.3 Soil Adjusted Vegetation Index (SAVI) & Modified Variants

$$\text{SAVI} = \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + \rho_{\text{Red}} + L} \times (1 + L)$$

* **The Soil Adjustment Parameter ($L$):**
  * $L$ is a canopy background parameter that corrects the convergence point of vegetation-soil isolines.
  * When $L = 0$, SAVI converges to NDVI.
  * When vegetative density is very low ($f_c < 0.2$), theoretical optimal $L \to 1.0$.
  * In dense closed canopies ($f_c > 0.8$), theoretical optimal $L \to 0$.
  * **Operational Standard:** $L = 0.5$ is globally adopted across mixed agricultural scenes, reducing soil-induced NDVI variance by up to $70–80\%$.
* **Modified Soil Adjusted Vegetation Index (MSAVI2):**  
  To eliminate the subjective or empirical specification of $L$, MSAVI2 analytically solves the radiative transfer soil-canopy reflection model:
  $$\text{MSAVI2} = \frac{2 \rho_{\text{NIR}} + 1 - \sqrt{(2 \rho_{\text{NIR}} + 1)^2 - 8(\rho_{\text{NIR}} - \rho_{\text{Red}})}}{2}$$
* **Specific Role in Crop Rotation & Fallow Monitoring:**
  * **Early-Season Green-Up ($SOS$):** Identifies initial seedling emergence through post-harvest residue or bare crust without false detections triggered by rain wetting dark soil.
  * **Cover Crop Establishment:** Tracks fine increases in sparse winter ground cover (e.g., rye or clover drilling into stubble).
  * **Soil Exposure Profiling:** Provides clean differentiation between bare ground ($0.05 \le \text{SAVI} \le 0.12$) and low-density biomass ($0.15 \le \text{SAVI} \le 0.25$).

#### 2.4 Summary of Mathematical Formulations & Band Mapping

```
Landsat 8/9:  Red = B4 (0.65 um),  NIR = B5 (0.86 um),  Blue = B2 (0.48 um),  SWIR1 = B6 (1.61 um)
Sentinel-2:   Red = B04 (0.66 um), NIR = B8A (0.86 um), Blue = B02 (0.49 um), SWIR1 = B11 (1.61 um)
HLS (30m):    Red = B04,          NIR = B8A/B05,       Blue = B02,          SWIR1 = B11/B06
```

$$\begin{aligned}
\text{NDVI} &= \frac{\rho_{865} - \rho_{660}}{\rho_{865} + \rho_{660}} \\
\text{EVI} &= 2.5 \cdot \frac{\rho_{865} - \rho_{660}}{\rho_{865} + 6.0\,\rho_{660} - 7.5\,\rho_{480} + 1.0} \\
\text{SAVI}_{(L=0.5)} &= 1.5 \cdot \frac{\rho_{865} - \rho_{660}}{\rho_{865} + \rho_{660} + 0.5}
\end{aligned}$$

---

### 3. Phenology Extraction & Rotation Metrics

Optical evaluation of crop rotations reconstructs time series of vegetation indices to extract distinct phenological transition stages, verify crop growth cycles, and quantify soil exposure during transitional windows.

```
Vegetation Index (VI)
  1.0 |                                       [Peak Vigor / Anthesis]
      |                                              POS
  0.8 |                                            .-'"`'-.
      |                                           /        \  [Maturity / Filling]
  0.6 |                                          /          \
      |                         [Green-Up / SOS]/            \ [Senescence / Brown-down]
  0.4 |                                        /              \
      |                                       /                \ EOS [Harvest]
  0.2 |   [Bare Soil / Fallow]               /                  \============\ Bare Window
  0.0 +-----------------------==============+---------------------------------+------------->
      0                      50            100       150       200           250    DOY
                             |<----------------- Bare Duration ------------->|
```

#### 3.1 Time-Series Reconstruction & Smoothing Algorithms
Optical time series contain missing observations and high-frequency noise from unmasked clouds, sub-pixel cloud shadows, and variable aerosols. Extracting clean phenology requires mathematical reconstruction before applying transition algorithms:

1. **Savitzky-Golay (SG) Filtering:**
   * Performs localized least-squares polynomial regression over a moving temporal window:
     $$Y_j^* = \frac{\sum_{i=-m}^{m} C_i \, Y_{j+i}}{N}$$
     where $Y$ is the raw index, $C_i$ are convolutional weights derived from a polynomial degree $d$ (typically $d=2$ or $3$), and $m$ is the half-width of the filter window.
   * *Agronomic Suitability:* Effectively preserves narrow peaks (e.g., brief double-crop grain filling or flush weed pulses) without flattening peak amplitudes, though it remains sensitive to unmasked cloud dips.

2. **Double Logistic Function Fitting:**
   * Fits a parametric mathematical curve capturing asymmetric growth and senescence cycles:
     $$f(t) = c + \frac{d - c}{1 + \exp\left[-a_1 (t - b_1)\right]} - \frac{d - c}{1 + \exp\left[-a_2 (t - b_2)\right]}$$
     * $c$: Base background level (bare soil or winter residue index, typically $\text{NDVI} \approx 0.15$).
     * $d$: Maximum seasonal canopy index amplitude reached at peak vegetative vigor.
     * $b_1$: Day of Year (DOY) of the inflection point during vegetative expansion (green-up phase).
     * $b_2$: Day of Year (DOY) of the inflection point during canopy brown-down/senescence.
     * $a_1$: Rate parameter governing the speed of canopy development.
     * $a_2$: Rate parameter governing the speed of canopy senescence and dry-down.
   * *Agronomic Suitability:* Highly robust against missing cloud gaps; mathematically guarantees a smooth profile for single-cycle annual crops (e.g., full-season maize). For multi-cropping rotations, a piecewise or dual-logistic formulation must be fitted separately to each growth cycle.

#### 3.2 Derivation of Key Phenological Transition Metrics

* **Start of Season ($SOS$ / Green-up Date):**
  * *Dynamic Amplitude Threshold Method:* The Day of Year where the smoothed curve crosses a defined percentage of seasonal amplitude above the baseline:
    $$\text{VI}(t) \ge \text{VI}_{\text{base}} + k \cdot (\text{VI}_{\text{max}} - \text{VI}_{\text{base}})$$
    where $k = 0.15–0.20$ (15–20% seasonal amplitude threshold).
  * *Curvature-Extremum Method:* The mathematical point of local maximum in the first derivative of the curvature ($\kappa'(t)$) of the logistic function, signaling the transition from baseline dormancy to exponential vegetative canopy expansion.
* **Peak of Season ($POS$ / Peak Vegetative Vigor Date):**
  * The inflection point where the first derivative reaches zero and the second derivative is negative:
    $$\frac{df(t)}{dt} = 0 \quad \text{and} \quad \frac{d^2f(t)}{dt^2} < 0$$
  * Represents peak light interception, maximum LAI, and complete canopy closure (often coinciding with tasseling/silking in maize, heading in wheat, or mid-pod fill in soybeans).
* **Maturity / Transition Phase:**
  * The transition boundary where vegetative expansion terminates and physiological grain filling or reproductive development shifts foliar nitrogen into grain sink tissues. Identified where the rate of change in canopy greenness plateaus ($\frac{d^2f(t)}{dt^2}$ reaches a local minimum).
* **Maturity-to-Senescence ($MOS$ / Onset of Senescence):**
  * Point where foliar chlorophyll degradation outpaces production, initiating canopy yellowing and brown-down. Represented by the maximum negative rate of change in index value.
* **End of Season ($EOS$ / Harvest / Termination Date):**
  * The date when the smoothed index returns below the $k = 0.15–0.20$ amplitude threshold, or where a step-drop discontinuity indicates mechanical harvest, grain combining, or chemical/frost termination of the canopy.

#### 3.3 Bare Soil Duration Metric ($\Delta t_{\text{bare}}$)

In sustainable rotation design, the duration of unshielded, bare soil between crops is a primary driver of wind/water erosion, nitrate leaching, surface crusting, and soil moisture evaporation.

```
       Crop A (Harvest)                      Crop B (Green-Up)
           EOS_A                                   SOS_B
             |                                       |
  ~~~~~~~~~~~+---------------------------------------+~~~~~~~~~~~~
     Crop A  | <----- Bare Soil Duration (Days) ---->|   Crop B
     Canopy  |      VI <= VI_bare (e.g. 0.20)        |   Canopy
             |       Vulnerable Fallow Gap           |
```

* **Mathematical Formulation:**
  $$\Delta t_{\text{bare}} = t_{SOS, \, \text{Crop } B} - t_{EOS, \, \text{Crop } A}$$
  where $t_{EOS, \, \text{Crop } A}$ is the harvest/termination DOY of the preceding cash or cover crop, and $t_{SOS, \, \text{Crop } B}$ is the emergence/green-up DOY of the subsequent crop.
* **Threshold Criteria:**
  $$\Delta t_{\text{bare}} = \sum_{d=t_{\text{start}}}^{t_{\text{end}}} \mathbb{I}\left( \text{SAVI}(d) \le \text{SAVI}_{\text{bare\_threshold}} \right)$$
  * Standard Bare Soil Optical Threshold: $\text{NDVI} \le 0.20$ or $\text{SAVI} \le 0.14$.
  * Dry Residue Adjustment: Incorporates the Normalized Difference Tillage Index (NDTI) using SWIR bands to prevent misclassifying thick, protective crop residue (corn stover or small grain straw) as vulnerable bare soil:
    $$\text{NDTI} = \frac{\rho_{\text{SWIR1}} - \rho_{\text{SWIR2}}}{\rho_{\text{SWIR1}} + \rho_{\text{SWIR2}}}$$
    If $\text{NDTI} > 0.05$, the ground retains protective dead organic residue cover despite an NDVI $< 0.20$.

#### 3.4 Living Ground Cover Continuity Across Rotation Alternatives

To quantify how effectively a crop rotation protects the soil and intercepts photosynthetically active radiation throughout the calendar year, two core metrics are derived:

1. **Days of Living Cover ($DLC$):**
   $$DLC = \sum_{d=1}^{365} \mathbb{I}\left( \text{NDVI}(d) \ge 0.30 \right)$$
   Counts all days within an agricultural cycle where an active, living photosynthetic canopy covers the soil surface (differentiating living vegetative cover from both bare ground and dry residue).

2. **Continuous Living Cover Fraction ($CLCF$):**
   $$CLCF = \frac{DLC_{\text{cycle}}}{T_{\text{cycle}}}$$
   where $T_{\text{cycle}}$ is the total duration of the crop rotation sequence in days (e.g., 365 days for annual, 730 days for a two-year rotation, 1095 days for a three-year cycle).

3. **Green Canopy Duration Integral ($GCDI$):**
   $$GCDI = \int_{t_{\text{start}}}^{t_{\text{end}}} \max\left(0, \, \text{VI}(t) - \text{VI}_{\text{base}}\right) \, dt$$
   Quantifies the cumulative seasonal optical greenness (Area Under the Curve), providing a proxy for cumulative photosynthetic capacity across rotation sequences.

##### Rotation Comparison Scenarios

* **Scenario 1: Conventional Fallow (Corn $\to$ Winter Fallow $\to$ Soybean)**
  * Typical Midwestern US cycle: Corn harvest late October ($EOS \approx \text{DOY } 295$). Field remains fallow through winter and spring until soybean emergence in late May ($SOS \approx \text{DOY } 145$).
  * Bare Soil Duration: $\Delta t_{\text{bare}} \approx 215 \text{ days}$.
  * Annual Living Cover: $DLC \approx 140 \text{ days}$. $CLCF \approx 38.4\%$.
  * *Agronomic Vulnerability:* High risk of spring nitrate leaching during snowmelt and heavy rains.

* **Scenario 2: Cover Cropped (Corn $\to$ Cereal Rye $\to$ Soybean)**
  * Cereal rye drilled post-harvest ($SOS_{\text{cover}} \approx \text{DOY } 315$), overwinters, greens up in early spring ($\text{DOY } 65–120$), terminated late April/May prior to soybean planting.
  * Bare Soil Duration: Reduced to discontinuous intervals totaling $\le 30–45 \text{ days}$.
  * Annual Living Cover: $DLC \approx 255 \text{ days}$. $CLCF \approx 69.8\%$.
  * *Agronomic Advantage:* Continuous root exudates, active soil biological stimulation, weed suppression via living canopy competition, and physical protection against raindrop impact.

* **Scenario 3: Double-Cropping (Winter Wheat $\to$ Double-Crop Soybean)**
  * Winter wheat planted October, greens up March, harvested late June ($EOS_1 \approx \text{DOY } 175$). Soybeans immediately planted, emergence by early July ($SOS_2 \approx \text{DOY } 185$), harvested mid-October ($EOS_2 \approx \text{DOY } 285$).
  * Bare Soil Duration: Tight turnaround gap of $\Delta t_{\text{bare}} \approx 10–14 \text{ days}$.
  * Characteristic Bi-modal Phenology Curve: Two distinct vegetation index peaks ($POS_1 \approx \text{DOY } 130$; $POS_2 \approx \text{DOY } 235$) separated by a brief harvest dip.

---

### 4. Technical Constraints & Data Processing

Translating satellite observations into reliable field-level phenological metrics requires addressing three main sources of technical error: atmospheric contamination, optical saturation, and spatial scale mismatch.

```
       HIGH LAI REGIME (LAI > 3.0)                       MIXED PIXEL PROBLEM (< 1 HA FIELD)
+---------------------------------------+    +-------------------------------------------------------+
|  Incident Light                       |    | [ Road / Ditch ]       | [ 250m MODIS Footprint ]     |
|   | Red (Absorbed ~98%)               |    |                        | Mixed Signal:                |
|   v                                   |    | [ Neighboring Fallow ] | - 40% Target Corn Canopy     |
|  [ Canopy Top ]                       |    |                        | - 35% Neighbor Fallow Wheat  |
|   | Red Saturated; NIR Scatters Down  |    | [ Target Corn Field ]  | - 15% Trees / Hedgerow       |
|   v                                   |    |   (< 1 ha parcel)      | - 10% Gravel Roadway         |
|  [ Canopy Interior ]                  |    |                        | Result: Severe Bias          |
|  ==> NDVI plateaus at ~0.82-0.88      |    |                        | Solution: 30m HLS Pure Pixel |
+---------------------------------------+    +-------------------------------------------------------+
```

#### 4.1 Cloud, Cloud Shadow & Quality Masking (Fmask / pixel_qa)
Unmasked cloud edges, thin cirrus, and sub-pixel cloud shadows cause false index drops that resemble rapid crop senescence or emergency harvest. Data pipelines must filter observations using the quality assessment bitmasks.

##### Landsat 8/9 Level-2 `QA_PIXEL` Bitmask Architecture
The Collection 2 `QA_PIXEL` band stores quality attributes as a 16-bit integer:

| Bit Position | Bit Value | Name / Interpretation | Action for Phenology Pipeline |
| :--- | :--- | :--- | :--- |
| **Bit 0** | 1 | Fill Value (No Data) | Exclude immediately (`val == 1`) |
| **Bit 1** | 2 | Dilated Cloud | Mask out (`bit 1 == 1`) |
| **Bit 2** | 4 | Cirrus (High confidence) | Mask out (`bit 2 == 1`) |
| **Bit 3** | 8 | Cloud | Mask out (`bit 3 == 1`) |
| **Bit 4** | 16 | Cloud Shadow | Mask out (`bit 4 == 1`) |
| **Bit 5** | 32 | Snow / Ice | Mask out / Flag cold dormancy |
| **Bit 6** | 64 | Clear Ground | Retain observation |
| **Bit 7** | 128 | Water Body | Exclude from agricultural parcel |

##### HLS Quality Layer (`Fmask`) Bitmask
The HLS quality assessment layer (`Fmask`) uses an 8-bit mask structure:
* **Bit 1 (Value 2):** Cloud
* **Bit 2 (Value 4):** Cloud directional shadow
* **Bit 3 (Value 8):** Adjacent to cloud or shadow (dilated buffer)
* **Bit 4 (Value 16):** Snow / Ice
* **Bit 5 (Value 32):** Water

##### Operational Bitwise Filtering Routine (Python / NumPy / Rasterio)

```python
import numpy as np

def mask_landsat_c2_sr(red_band: np.ndarray, nir_band: np.ndarray, qa_pixel: np.ndarray):
    """
    Applies strict bitwise QA masking to Landsat 8/9 Collection 2 SR bands.
    Masks: Fill (0), Dilated Cloud (1), Cirrus (2), Cloud (3), Shadow (4), Snow (5).
    """
    # Create bitmask: bits 0, 1, 2, 3, 4, 5 set to 1 -> binary 0000000000111111 = decimal 63
    # More specifically check bit flags individually:
    fill_bit         = (qa_pixel & (1 << 0)) != 0
    dilated_cloud    = (qa_pixel & (1 << 1)) != 0
    cirrus_cloud     = (qa_pixel & (1 << 2)) != 0
    cloud            = (qa_pixel & (1 << 3)) != 0
    cloud_shadow     = (qa_pixel & (1 << 4)) != 0
    snow_ice         = (qa_pixel & (1 << 5)) != 0

    invalid_mask = fill_bit | dilated_cloud | cirrus_cloud | cloud | cloud_shadow | snow_ice

    # Apply scale factor for Collection 2 Level-2 Surface Reflectance
    # Valid surface reflectance = DN * 0.0000275 - 0.2
    scale_factor = 0.0000275
    offset = -0.2

    red_sr = np.where(~invalid_mask, red_band * scale_factor + offset, np.nan)
    nir_sr = np.where(~invalid_mask, nir_band * scale_factor + offset, np.nan)

    # Physical valid reflectance bounds check [0.0, 1.0]
    red_sr = np.where((red_sr >= 0.0) & (red_sr <= 1.0), red_sr, np.nan)
    nir_sr = np.where((nir_sr >= 0.0) & (nir_sr <= 1.0), nir_sr, np.nan)

    denom = nir_sr + red_sr
    ndvi = np.where((denom > 0.0) & ~np.isnan(denom), (nir_sr - red_sr) / denom, np.nan)
    
    return ndvi
```

#### 4.2 Optical Saturation in High-Leaf-Area Canopies
* **Physical Cause:** In closed crop canopies (maize, irrigated alfalfa, mature soybean, sugarcane) where $\text{LAI} > 2.5–3.0$, the top layer of leaves absorbs almost all available red photons. As additional leaf layers develop, near-infrared reflectance ($\rho_{\text{NIR}}$) continues to rise from structural scattering across leaf layers, but $\rho_{\text{Red}}$ remains locked at $\approx 0.015–0.025$.
* **Mathematical Consequence:**
  $$\lim_{\rho_{\text{Red}} \to c \approx 0} \text{NDVI} = \frac{\rho_{\text{NIR}} - c}{\rho_{\text{NIR}} + c} \approx 1 - \frac{2c}{\rho_{\text{NIR}}}$$
  As $\rho_{\text{NIR}}$ grows, NDVI plateaus between $0.82$ and $0.88$. It cannot distinguish between an average canopy ($\text{LAI} = 3.0$) and a dense canopy ($\text{LAI} = 6.0$).
* **Agronomic Risk in Rotation Tracking:** Saturation obscures the true peak vegetative vigor date ($POS$), creating a flat plateau that lasts for weeks and masks subtle water stress or nutrient deficiency during grain filling.
* **Mitigation Strategy:**
  1. Switch to **EVI** or **EVI2** for dense vegetative canopies; their blue-band atmospheric correction and background resistance factor maintain an approximately linear response up to $\text{LAI} \approx 6.0–8.0$.
  2. Implement the **Normalized Difference Red Edge (NDRE)** index on Sentinel-2 / HLS data:
     $$\text{NDRE} = \frac{\rho_{\text{NIR}} - \rho_{\text{RedEdge}}}{\rho_{\text{NIR}} + \rho_{\text{RedEdge}}}$$
     Using Band 05 (705 nm). Because chlorophyll absorbs red-edge photons less intensely than pure red wavelengths, light penetrates deeper into lower canopy layers without saturating.

#### 4.3 Spatial Scale Matching & Smallholder Field Heterogeneity (< 1 ha)
* **Footprint Geometry vs. Field Boundaries:**
  * 1 hectare is $100\,\text{m} \times 100\,\text{m} = 10,000\,\text{m}^2$.
  * A **MODIS 250 m pixel** covers $62,500\,\text{m}^2$ ($6.25\,\text{ha}$). A small 1-hectare parcel occupies just **$16\%$** of a single MODIS pixel. The remaining $84\%$ captures surrounding vegetation, neighboring crop rotations, or roadways.
  * A **VIIRS 500 m pixel** covers $250,000\,\text{m}^2$ ($25.0\,\text{ha}$), spanning multiple production blocks and rendering it unusable for parcel-scale decisions.
  * A **Landsat / HLS 30 m pixel** covers $900\,\text{m}^2$ ($0.09\,\text{ha}$). A 1-hectare field contains approximately **11 contiguous pixels**, enabling parcel-specific phenology tracking.

```
+---------------------------------------------------------------+
|  MODIS 250m Pixel Footprint (6.25 ha)                         |
|                                                               |
|         +-----------------------+                             |
|         | Target Field (1.0 ha) |     Neighboring Field       |
|         | Corn Crop             |     (Wheat Fallow)          |
|         +-----------------------+                             |
|                                         Drainage Ditch        |
|     Gravel Access Road ==============================         |
+---------------------------------------------------------------+
[Result: Severe mixed-pixel bias. NDVI reflects an areal average]
```

##### Pure Pixel Extraction & Negative Buffering Protocol
To prevent spectral contamination from parcel borders, grass strips, fence lines, and access roads, agricultural pipelines should use an **internal negative buffer**:
1. Take the field boundary polygon vector $P$.
2. Apply an internal (negative) buffer distance equal to half the sensor pixel pitch plus geodetic registration error:
   $$P_{\text{buffered}} = P \ominus \delta \quad \text{where } \delta \approx 15–20\,\text{m for HLS / Landsat}$$
3. Sample only pixels whose grid centroids fall within $P_{\text{buffered}}$.
4. **Area-Weighted Pixel Aggregation:** If a parcel is small ($0.5–1.5\,\text{ha}$) and buffering removes too many valid pixels, calculate an intersection-area weighted average:
   $$\bar{V}_{\text{parcel}} = \frac{\sum_{i=1}^{N} \left( v_i \cdot A_i \right)}{\sum_{i=1}^{N} A_i}$$
   where $v_i$ is the index value of pixel $i$, and $A_i$ is the physical area of intersection between pixel $i$ and parcel polygon $P$.
5. **Minimum Parcel Size Threshold:** Parcels $< 0.4\,\text{ha}$ (~4 HLS pixels) cannot yield a pure, uncontaminated 30 m pixel. Flag such fields as **Border-Contaminated / Regional Estimate Only** in user interfaces.

---

### 5. Access Architecture & Processing Pipelines

Developing operational crop rotation analysis systems requires programmatic ingestion workflows that query spatio-temporal metadata, stream small spatial subsets without downloading full multi-gigabyte scenes, and extract reliable time series.

```
                                  DATA ACCESS & PROCESSING TOPOLOGY
                                  
 [ NASA AppEEARS API ]               [ USGS M2M API ]               [ Element84 AWS STAC / COGs ]
 (Point / Polygon Extract)       (Landsat 8/9 Level-2 SR)            (HLS HLSL30 / HLSS30 COGs)
          |                                  |                                     |
          v                                  v                                     v
  JSON / CSV Stream                 Order & Tar Ingest                     HTTP Range Requests (rio)
          |                                  |                                     |
          +----------------------------------+-------------------------------------+
                                             |
                                             v
                         [ QA Bitmask Filter (Fmask/QA_PIXEL) ]
                                             |
                                             v
                      [ Spectral Index Engine: NDVI / EVI / SAVI ]
                                             |
                                             v
                     [ Time-Series Smoothing (Savitzky-Golay / Logistic) ]
                                             |
                                             v
                 [ Rotation Phenology Engine: SOS, POS, EOS, Bare Duration ]
```

#### 5.1 Access Infrastructure Overview
* **NASA AppEEARS (Application for Extracting and Exploring Analysis Ready Samples):**
  * *Mechanism:* Cloud-native subsetting engine operated by LP DAAC. Users submit point coordinates or GeoJSON field polygons; the service crops spatio-temporal cubes server-side across MODIS (`MOD13Q1`), VIIRS (`VNP13A1`), and HLS (`HLSS30`/`HLSL30`) and returns time-series tables (CSV) or stacked GeoTIFFs.
  * *Target Use:* Point-based farm location lookups and low-bandwidth mobile execution.
* **NASA LP DAAC Direct Cloud Access:**
  * *Mechanism:* Direct AWS S3 access within the `us-west-2` region. Data are archived as Cloud-Optimized GeoTIFFs (COGs). Requires NASA Earthdata Login credentials signed via AWS S3 temporary credentials.
  * *Target Use:* High-throughput serverless pipelines running compute jobs in AWS `us-west-2`.
* **USGS Machine-to-Machine (M2M) API:**
  * *Mechanism:* JSON REST interface replacing the legacy machine API for querying and ordering Landsat Collection 2 products. Supports bounding box filtering, cloud-cover maximum thresholds, and metadata harvesting.
  * *Target Use:* Batch historical land-cover and rotational analysis back to 1982.
* **Element84 AWS STAC (SpatioTemporal Asset Catalog):**
  * *Mechanism:* Open-access STAC API endpoint (`https://earth-search.aws.element84.com/v1`) indexing Sentinel-2 L2A and HLS datasets stored on Amazon S3.
  * *Target Use:* Cloud-native, zero-download spatial queries using HTTP range-request reads directly into memory via `rasterio` or `stackstac`.

#### 5.2 End-to-End Modular Python Pipeline
The following script demonstrates a complete, reproducible workflow: querying the STAC catalog for HLS data, extracting cloud-free observations using HTTP range requests, computing NDVI/SAVI, fitting a double-logistic curve, and extracting phenological dates alongside the bare soil duration window.

```python
"""
Modular HLS Phenology and Crop Rotation Extraction Pipeline
Requires: pystac_client, planetary_computer / odc-stac, rasterio, numpy, scipy
"""

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from pystac_client import Client
from scipy.optimize import curve_fit
from datetime import datetime
import json

# 1. Double Logistic Formulation for Crop Phenology Fitting
def double_logistic(t, c, d, a1, b1, a2, b2):
    """
    Parametric double-logistic phenology curve.
    c: baseline, d: amplitude, b1/b2: inflection dates, a1/a2: transition rates.
    """
    return c + (d - c) / (1.0 + np.exp(-a1 * (t - b1))) - (d - c) / (1.0 + np.exp(-a2 * (t - b2)))

# 2. STAC Search and Cloud-Free Time-Series Harvesting
def harvest_hls_parcel_timeseries(geojson_geometry: dict, date_range: str, earthdata_token: str):
    """
    Queries STAC catalog for HLS over a farm parcel, extracts Red, NIR, and Fmask
    using windowed HTTP range reads, and returns cloud-cleared mean indices.
    """
    stac_endpoint = "https://cmr.earthdata.nasa.gov/stac/LPCLOUD"
    client = Client.open(stac_endpoint)

    search = client.search(
        collections=["HLSS30.v2.0", "HLSL30.v2.0"],
        intersects=geojson_geometry,
        datetime=date_range,
    )
    items = search.item_collection()
    
    observations = []

    # Coordinate bounding box for windowed extraction
    coords = geojson_geometry['coordinates'][0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    bbox = (min(lons), min(lats), max(lons), max(lats))

    for item in items:
        acquisition_date = datetime.strptime(item.properties["datetime"][:10], "%Y-%m-%d")
        doy = acquisition_date.timetuple().tm_yday
        
        # Cloud assets URLs (requires signed gdal vsi / auth headers)
        fmask_asset = item.assets["Fmask"].href
        red_asset   = item.assets["B04"].href if "B04" in item.assets else item.assets["B4"].href
        nir_asset   = item.assets["B8A"].href if "B8A" in item.assets else item.assets["B5"].href

        try:
            # Read spatial window only (avoids reading whole scene)
            with rasterio.open(fmask_asset) as src_mask:
                window = from_bounds(*bbox, transform=src_mask.transform)
                qa = src_mask.read(1, window=window)

            # Check Fmask bits: 1: Cloud, 2: Shadow, 3: Adjacent, 4: Snow
            # If any bad bit is 1, mask pixel as invalid
            cloud_mask = ((qa & (1 << 1)) != 0) | ((qa & (1 << 2)) != 0) | ((qa & (1 << 3)) != 0)
            
            # Check valid clear pixel fraction over field
            valid_fraction = np.sum(~cloud_mask) / cloud_mask.size
            if valid_fraction < 0.60:  # Require at least 60% clear parcel coverage
                continue

            with rasterio.open(red_asset) as src_r, rasterio.open(nir_asset) as src_n:
                r_raw = src_r.read(1, window=window).astype(np.float32) * 0.0001 # HLS scale factor
                n_raw = src_n.read(1, window=window).astype(np.float32) * 0.0001

            # Filter masked pixels
            r_valid = np.where(~cloud_mask, r_raw, np.nan)
            n_valid = np.where(~cloud_mask, n_raw, np.nan)

            # Calculate parcel-mean NDVI and SAVI
            denom = n_valid + r_valid
            ndvi_arr = np.where((denom > 0) & ~np.isnan(denom), (n_valid - r_valid) / denom, np.nan)
            savi_arr = np.where(~np.isnan(denom), 1.5 * (n_valid - r_valid) / (n_valid + r_valid + 0.5), np.nan)

            mean_ndvi = float(np.nanmean(ndvi_arr))
            mean_savi = float(np.nanmean(savi_arr))

            if not np.isnan(mean_ndvi):
                observations.append({
                    "date": acquisition_date.strftime("%Y-%m-%d"),
                    "doy": doy,
                    "ndvi": mean_ndvi,
                    "savi": mean_savi
                })
        except Exception:
            continue

    # Sort sequentially by date
    observations.sort(key=lambda x: x["doy"])
    return observations

# 3. Phenology Transition & Bare Soil Calculation Engine
def extract_phenology_and_bare_duration(observations: list):
    """
    Fits double logistic profile and derives SOS, POS, EOS, and Bare Soil Duration.
    """
    doys = np.array([o["doy"] for o in observations])
    ndvis = np.array([o["ndvi"] for o in observations])

    # Initial parameter guess: c, d, a1, b1, a2, b2
    p0 = [0.15, 0.80, 0.08, 120, 0.08, 260]
    bounds = (
        [0.05, 0.30, 0.01, 50, 0.01, 180],
        [0.25, 0.95, 0.20, 200, 0.20, 330]
    )

    popt, _ = curve_fit(double_logistic, doys, ndvis, p0=p0, bounds=bounds, maxfev=10000)
    c_fit, d_fit, a1_fit, b1_fit, a2_fit, b2_fit = popt

    fitted_curve = double_logistic(doys, *popt)
    
    # Amplitude threshold: 20% of seasonal amplitude
    amp = d_fit - c_fit
    thresh_val = c_fit + 0.20 * amp

    # Transition points derivation
    # SOS: Day where model crosses 20% threshold during vegetative climb
    dense_days = np.arange(1, 366)
    dense_model = double_logistic(dense_days, *popt)
    
    pos_doy = int(dense_days[np.argmax(dense_model)])
    
    pre_peak = dense_days < pos_doy
    post_peak = dense_days > pos_doy

    sos_doy = int(dense_days[pre_peak and dense_model >= thresh_val][0])
    eos_doy = int(dense_days[post_peak and dense_model <= thresh_val][0])

    # Bare Soil Duration in single-season crop cycle (Days where index <= bare soil threshold 0.20)
    bare_soil_days = np.sum(dense_model <= 0.20)

    results = {
        "Baseline_NDVI": round(c_fit, 3),
        "Peak_NDVI": round(d_fit, 3),
        "SOS_Greenup_DOY": sos_doy,
        "POS_Peak_Vigor_DOY": pos_doy,
        "EOS_Harvest_DOY": eos_doy,
        "Total_Growing_Cycle_Days": eos_doy - sos_doy,
        "Bare_Soil_Duration_Days": int(bare_soil_days)
    }
    return results
```

---

### 6. Farmer Evidence Display Guidelines

Transforming raw satellite index trajectories into agronomic decision support tools requires balancing scientific integrity with clear, practical interface design. The interface should focus on explaining what the grower can do differently, backed by transparent evidence.

#### 6.1 Displaying Satellite Greenness Curves
Vegetation index time series should be presented as intuitive historical reference bands, avoiding abstract floating index values:

```
Vegetation Index (NDVI)
  1.0 |                                                     [Active Season Curve]
      |                                                              *
  0.8 |                                                        *---*   *--*
      |                                                       /            \
  0.6 |                                 ░░░░░░░░░░░░░░░░░░░░░/░░░░░░░░░░░░░░\░░  <-- 10th-90th Percentile
      |                                ░░░░░░░░░░░░░░░░░░░░░/░░░░░░░░░░░░░░░░\░       Historical Envelope
  0.4 |                               ░░░░░░░░░░░░░░░░░░░░░/░░░░░░░░░░░░░░░░░░\
      |                              ░░░░░░░░░░░░░░░░░░░░░/░░░░░░░░░░░░░░░░░░░░\
  0.2 |   ===========================░░░░░░░░░░░░░░░░░░░░+                     +====  Bare Window
  0.0 +---|-----------|-----------|-----------|-----------|-----------|-----------|--------->
         Mar         Apr         May         Jun         Jul         Aug         Sep
        Planting   Emergence   Vegetative   Heading    Flowering    Filling    Harvest
```

##### Core Interface Design Rules

1. **Contextualize with a Multi-Year Historical Envelope:**
   * Never display a single, isolated NDVI line (e.g., "Field 4 NDVI is 0.64"). An absolute index value is agronomically uninterpretable without seasonal and parcel context.
   * Display the current season's curve overlaid onto a **shaded 10th–90th percentile historical envelope** calculated across at least 5–10 previous cycles for that parcel.
   * Add a distinct dotted line showing the multi-year parcel median curve. If current development falls below the 10th percentile, trigger an agronomic alert (e.g., *"Canopy vigor lagging normal emergence by 14 days"*).

2. **Overlay Crop Development Stages Along the Time Axis:**
   * Replace raw Julian Day of Year (DOY) values with readable calendar months subdivided into **agronomic crop growth stages** (e.g., Planting, Emergence, Rapid Vegetative Growth, Heading/Anthesis, Grain Fill, Harvest/Termination).
   * Anchor stages using farmer-recorded planting dates, cross-referenced with satellite $SOS$ emergence and thermal time (Growing Degree Days, GDD) derived from NASA POWER.

3. **Multi-Season Rotation Continuity Strip:**
   * Display multi-year crop sequences along a continuous multi-year strip rather than restarting the axis every calendar year.
   * Highlight the transitional fallow windows in red or amber to clearly show the bare soil duration ($\Delta t_{\text{bare}}$) between harvest of Crop A and green-up of Crop B.
   * Contrast this with proposed cover crop alternatives, showing how a winter rye or clover crop replaces the amber fallow gap with a green cover pulse.

4. **Transparent Data Provenance Line:**
   * Every chart must include an explicit data badge indicating sensor, resolution, and processing status:
     > **Evidence Line:** `Harmonized Landsat-Sentinel (HLS 30m) · 14 valid cloud-free passes · Nadir BRDF corrected · Processed: Nov 14, 2026`

#### 6.2 Essential Agronomic Caveats & Uncertainty Communication

To protect farmer trust and avoid misleading management recommendations, user interfaces must clearly communicate the physical meaning and limits of satellite vegetation indices.

```
+----------------------------------------------------------------------------------------------------+
|                                    CRITICAL AGRONOMIC DISTINCTION                                  |
|                                                                                                    |
|    SATELLITE VEGETATION INDEX                                      HARVESTABLE YIELD /             |
|   (NDVI / EVI / SAVI / NDRE)                                       SOIL HEALTH STATUS              |
|                                                                                                    |
|   - Measures:                                                      - CANNOT directly measure:      |
|     * Chlorophyll light absorption                                   * Total grain/seed yield      |
|     * Spongy mesophyll scattering                                    * Pollination / kernel fill   |
|     * Fractional canopy cover (fc)                                   * Soil organic matter (SOM)   |
|     * Aboveground green biomass                                      * Soil biological respiration |
|                                                                      * Root architecture / depth   |
|                                                                                                    |
|   "Greenness measures the photosynthetic canopy, not grain fill or soil health."                   |
+----------------------------------------------------------------------------------------------------+
```

##### 1. Greenness $
e$ Crop Yield
* **The Physical Limitation:** Optical indices quantify the density and photosynthetic activity of the vegetative canopy ($\text{fPAR}$ and $\text{LAI}$). They do not measure reproductive partitioning, pollination success, harvest index ($\text{HI}$), or grain weight.
* **Agronomic Failure Mode:** An exceptionally vigorous corn crop can show near-maximum NDVI ($0.88$) throughout July. If extreme heat ($>35^\circ\text{C}$) or severe moisture deficits occur during the brief 5-to-7 day pollination/silking window, silk desiccation and pollen sterility can result in bare cobs with near-zero grain yield—even while the vegetative canopy stays green.
* **Copywriting Rule:** Never label an NDVI chart as "Predicted Yield" or "Field Productivity Score." Always use:
  > **Recommended Interface Copy:**  
  > *"Canopy Vigour & Vegetative Cover: Tracks green canopy development and ground coverage. Does not predict grain weight or harvestable yield."*

##### 2. Greenness $
e$ Soil Health
* **The Physical Limitation:** Optical sensors detect electromagnetic radiation reflected from the uppermost few micrometers of the surface canopy or soil surface crust. They cannot penetrate beneath the surface to measure soil organic matter, microbial biomass, microbial respiration, earthworm populations, bulk density, or aggregate stability.
* **Agronomic Failure Mode:** An intensive, continuous corn-soybean rotation relying on high synthetic nitrogen applications can produce dense, dark green canopies year after year, yielding high NDVI values while active soil organic matter degrades, subsoil compaction layers form, and soil biological activity declines. Conversely, a diverse rotation incorporating bio-diverse cover crops actively builds root biomass, feeds mycorrhizal networks, and improves infiltration long before dramatic shifts appear in surface NDVI.
* **Copywriting Rule:** Never present vegetation indices as a "Soil Health Index" or "Soil Regeneration Score." Instead, present the derived rotation metrics transparently:
  > **Recommended Interface Copy:**  
  > *"Ground Cover Continuity: Measures how many days per year living roots and vegetative cover shield the soil surface. Soil biological health and organic matter depend on field management, tillage practices, and organic inputs."*

##### 3. Avoiding False Precision
* Do not display arbitrary index values with high decimal precision (e.g., $\text{NDVI} = 0.74281$). Round to two significant figures ($0.74$) or translate into structured categorical ranges backed by a clearly explained legend:
  * $\text{NDVI} < 0.20$: *Bare Ground / Non-Vegetated Surface*
  * $\text{NDVI } 0.20–0.40$: *Sparse Canopy / Emergence / Residue*
  * $\text{NDVI } 0.40–0.70$: *Moderate Canopy Growth*
  * $\text{NDVI } > 0.70$: *Dense Vegetative Canopy*

---

### Technical Architecture Summary & Recommendations

1. **Sensor Selection:**  
   Use **Harmonized Landsat Sentinel-2 (HLS)** as the primary operational backbone for parcel-level crop rotation evaluation. Reserve MODIS and VIIRS for regional climate baselines or coarse spatial contexts.
2. **Spectral Index Selection:**  
   Pair **SAVI ($L=0.5$)** for the early-season emergence and bare-soil transition windows with **EVI / EVI2** for peak mid-season vegetative growth to avoid premature optical saturation.
3. **Data Quality Assurance:**  
   Implement strict bitwise filtering on the `Fmask` / `QA_PIXEL` layers. Observations with $>40\%$ cloud or shadow cover across the field boundary should be excluded before curve fitting.
4. **Phenological Modeling:**  
   Smooth filtered time series using Savitzky-Golay filtering or double-logistic curve fitting to reliably extract $SOS$, $POS$, $EOS$, and the bare soil duration window ($\Delta t_{\text{bare}}$).
5. **Farmer Communication:**  
   Present satellite evidence as historical reference envelopes anchored to crop stages. Frame satellite greenness transparently as an indicator of vegetative canopy development and soil cover continuity—never as a substitute for yield predictions or laboratory soil health tests.

---
*Report compiled for integration with the NASA Farming Decision Support System.*

---

## Agent 4: NASA ECOSTRESS (ISS) & OpenET
**Specialist Role:** Thermal & Evapotranspiration Specialist

# Technical Research Report: ECOSTRESS & OpenET for Agricultural Rotation Planning

**Target System:** `nasafarmingapp`  
**Domain:** Agricultural Thermal Remote Sensing, Surface Energy Balance & Evapotranspiration (ET)  
**Codebase Integration:** `lib/engine/et0.ts`, `lib/engine/climate.ts`, `lib/engine/strategies.ts`, `lib/types.ts`  
**Design & UX Alignment:** `DESIGN.md` (The Field Almanac, Light-Only Rule) & `UX.md` (Translation Layer)

---

### Executive Summary & System Context

Crop rotation planning under increasing climate variability requires moving beyond static historical averages and theoretical water demand models. While meteorological reference evapotranspiration ($ET_0$) indicates atmospheric evaporative pull, it cannot verify whether a crop successfully transpired or suffered catastrophic stomatal closure under soil moisture deficits. 

Integrating thermal infrared (TIR) observations from **ECOSTRESS** (onboard the International Space Station) and field-scale actual evapotranspiration ($ET_a$) ensembles from **OpenET** bridges this gap. By detecting sub-field canopy temperature depression ($CTD$) and evaporative stress peaks during drought-sensitive phenological stages (flowering/pollination), the engine can empirically validate whether alternative lower-water-demand crops reduce climatic water deficits ($ET_c - P$) and prevent reproductive failure on specific fields.

---

### 1. Sensor Profile & Mission Concept

```
  ISS Orbit (400-420 km, 51.6° Inclination, Non-Sun-Synchronous)
  │
  ├──► ECOSTRESS Multispectral TIR Radiometer
  │    ├── Spatial Resolution: ~70 m (resampled from 69 m × 38 m nadir)
  │    ├── Swath Width: ~384 km (cross-track scan angle ±26.5°)
  │    ├── Spectral Bands: 5 TIR bands (8.28, 8.78, 9.20, 10.48, 12.05 µm) + SWIR (1.6 µm)
  │    └── Diurnal Revisit: 3–5 days (precessing orbit samples varying times of day)
  │
  └──► OpenET Field-Scale Ensemble (Western CONUS)
       ├── Spatial Resolution: 30 m grid (Landsat/Sentinel-2 scale)
       ├── Model Ensemble: METRIC, SSEBop, SIMS, DisALEXI, PT-JPL, geeSEBAL
       └── Temporal Output: Daily, monthly, and seasonal actual evapotranspiration (ETa)
```

#### 1.1 ECOSTRESS on the International Space Station
The **ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station (ECOSTRESS)** was deployed to the Japanese Experiment Module - Exposed Facility (JEM-EF) on the ISS in June 2018. Designed as a precursor to future high-resolution thermal missions (such as the NASA Surface Biology and Geology / SBG mission), ECOSTRESS addresses a historical spatial and temporal bottleneck in satellite thermal remote sensing:
- **Spatial Resolution:** Native nadir resolution of $69\text{ m} \times 38\text{ m}$, resampled and gridded onto a standardized **$70\text{ m} \times 70\text{ m}$ pixel grid**. At 70 m, ECOSTRESS can resolve individual agricultural fields, center pivots, and spatial variability across management zones—unlike MODIS (1 km) or VIIRS (375 m–750 m), and with significantly higher thermal fidelity than Landsat 8/9 TIRS (100 m native resampled to 30 m).
- **Radiometric Instrumentation:** A multispectral thermal infrared radiometer derived from the Prototype HyspIRI Thermal Infrared Radiometer (PHyTIR). It features a rotating scan mirror with a 384 km cross-track swath ($\pm 26.5^\circ$), utilizing 5 thermal infrared bands centered between $8.28\ \mu\text{m}$ and $12.05\ \mu\text{m}$, accompanied by a $1.6\ \mu\text{m}$ shortwave infrared (SWIR) band for cloud screening and sub-pixel geometric registration.

#### 1.2 Non-Sun-Synchronous Precessing Orbit: Diurnal Captures
Unlike traditional Earth observation satellites in polar sun-synchronous orbits (e.g., Landsat at ~10:15 AM local time, Sentinel-2 at ~10:30 AM, Aqua/MODIS at ~1:30 PM), the International Space Station operates in a **low Earth orbit (altitude ~400–420 km) at an inclination of 51.6°**:
- **Diurnal Precession:** The ISS ground track precesses longitudinally and temporally, shifting its local equatorial crossing time across the full 24-hour diurnal cycle over an orbital precession period of approximately **60 days**.
- **Revisit Dynamics:** Mid-latitude agricultural zones (between 30° and 48° N/S) receive overpasses every **3 to 5 days**, but crucially, each subsequent overpass occurs at a **different local solar time** (e.g., 08:30 morning, 11:15 late morning, 13:40 solar noon/afternoon, 16:30 late afternoon, and nighttime).
- **Ecophysiological Value:** 
  1. *Morning overpasses* capture baseline leaf warming and initial stomatal opening under low atmospheric vapor pressure deficit (VPD).
  2. *Midday and early afternoon overpasses (12:00–14:30)* coincide with peak net radiation ($R_n$) and maximal atmospheric evaporative demand. This is the precise window where water-stressed plants shut down their stomata to conserve hydraulic potential ("afternoon depression"), exposing severe canopy temperature spikes that are invisible to 10:00 AM sun-synchronous sensors.
  3. *Late afternoon overpasses* reveal recovery kinetics, discriminating deep-rooted resilient crops from shallow-rooted drought-vulnerable crops.

#### 1.3 OpenET Multi-Model Ensemble
OpenET is an operational operational partnership between NASA, USGS, USDA-ARS, the Desert Research Institute (DRI), Environmental Defense Fund (EDF), and Google Earth Engine.
- **Coverage & Resolution:** Operational across the 17 Western US states (covering major irrigated agricultural basins: Central Valley, Columbia Basin, Colorado River Basin, High Plains Aquifer), downscaled to **30 m field-scale resolution** at daily, monthly, and seasonal timesteps.
- **Ensemble Architecture:** OpenET integrates six independent, peer-reviewed satellite-driven ET models running simultaneously on Google Earth Engine:
  1. **METRIC (Mapping Evapotranspiration at high Resolution with Internalized Calibration):** Solves the complete energy balance ($\lambda ET = R_n - G - H$) by auto-indexing aerodynamic temperature gradients between dynamically identified "cold" (well-watered alfalfa) and "hot" (dry agricultural soil) anchor pixels.
  2. **SSEBop (Operational Simplified Surface Energy Balance):** Computes actual ET fraction ($ET_f$) directly from thermal LST relative to predefined differential temperature limits ($dT = T_h - T_c$) based on air temperature and elevation.
  3. **SIMS (Satellite Irrigation Management Support):** Employs high-resolution NDVI time series to calculate basal crop coefficients ($K_{cb}$) scaled by meteorological $ET_0$, representing unstressed crop water requirements.
  4. **DisALEXI (Atmospheric-Land Exchange Inverse model downscaled):** Two-source energy balance model (TSEB) that explicitly separates soil surface temperature ($T_s$) from canopy temperature ($T_c$), downscaled from regional ALEXI (GOES/MODIS) using Landsat/ECOSTRESS thermal data.
  5. **PT-JPL (Priestley-Taylor Jet Propulsion Laboratory):** Ecophysiologically constrained equilibrium evaporation model.
  6. **geeSEBAL (Surface Energy Balance Algorithm for Land):** Fully automated automated implementation of SEBAL on Google Earth Engine.
- **Ensemble Synthesis:** OpenET calculates an ensemble median and ensemble mean after filtering out statistical outliers. Across 140+ eddy covariance flux tower sites, the ensemble achieves a monthly root-mean-square error (RMSE) under $0.65\text{ mm/day}$ and seasonal mean absolute errors below $8\%$, providing an authoritative benchmark for field-scale actual water consumption.

---

### 2. Key Products & Physical Principles

```
         ┌─────────────────────────────────────────────────────────┐
         │              ECOSTRESS TIR Multispectral Bands          │
         └────────────────────────────┬────────────────────────────┘
                                      │
                         [ Temperature Emissivity ]
                         [     Separation (TES)   ]
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    ECO2LSTE Product (70m)     │
                      │  Land Surface Temp & Emissivity│
                      └──────────────┬────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     Canopy Temp Depression      │         │       ECO4ESIPTJPL Product      │
│      CTD = T_air - LST_canopy   │         │    Actual ET (ETa) via PT-JPL   │
│  Negative = Water Stress/Closure│         │    Evaporative Stress Index     │
└─────────────────────────────────┘         └─────────────────────────────────┘
```

#### 2.1 ECO2LSTE: Land Surface Temperature (LST) and Emissivity
The **ECO2LSTE** product provides land surface kinetic temperature ($T_s$ in Kelvin, reported with uncertainty) and spectral surface emissivity ($\varepsilon_\lambda$) across all thermal bands at 70 m resolution.
- **Physics of Inversion:** Thermal radiometers measure top-of-atmosphere (TOA) spectral radiance $L_{TOA}(\lambda)$, which is a composite of surface thermal emission attenuated by the atmosphere, upwelling atmospheric path radiance $L^\uparrow(\lambda)$, and reflected downwelling sky radiance $L^\downarrow(\lambda)$:
  $$L_{TOA}(\lambda) = \tau_\lambda \left[ \varepsilon_\lambda B(\lambda, T_s) + (1 - \varepsilon_\lambda) \frac{L^\downarrow(\lambda)}{\pi} \right] + L^\uparrow(\lambda)$$
  Where $\tau_\lambda$ is atmospheric transmissivity, and $B(\lambda, T_s)$ is Planck's blackbody radiation function:
  $$B(\lambda, T_s) = \frac{c_1}{\lambda^5 \left( \exp\left(\frac{c_2}{\lambda T_s}\right) - 1 \right)}$$
- **Temperature-Emissivity Separation (TES):** Because an $N$-band radiometer yields $N$ radiance equations with $N + 1$ unknowns ($N$ spectral emissivities + 1 unknown kinetic surface temperature $T_s$), the system is underdetermined. ECOSTRESS executes the TES algorithm:
  1. *Normalized Radiance Method (NEM):* Approximates initial temperature using a maximum assumed emissivity ($\varepsilon_{max} \approx 0.98$).
  2. *Ratio Method:* Computes relative spectral beta-values ($\beta_\lambda$).
  3. *Empirical Minimum-Maximum Difference (MMD):* Uses an empirical power-law relationship between spectral contrast ($\text{MMD} = \max(\beta) - \min(\beta)$) and minimum emissivity ($\varepsilon_{min}$) calibrated against the ASTER spectral library to invert true kinetic LST with an absolute accuracy of $\pm 0.5\text{ K}$.

#### 2.2 ECO4ESIPTJPL: PT-JPL Actual ET & Evaporative Stress Index
The **ECO4ESIPTJPL** product provides actual evapotranspiration ($ET_a$ or latent heat flux $\lambda ET$, in $\text{W/m}^2$ and converted to $\text{mm/day}$) alongside the **Evaporative Stress Index (ESI)**, modeled using the Priestley-Taylor JPL (Fisher et al., 2008) formulation.
- **Priestley-Taylor Formulation:** Unlike Penman-Monteith, which requires complex aerodynamic surface resistance parameters ($r_a, r_s$) that are notoriously difficult to parameterize from space, PT-JPL scales equilibrium evaporation ($\alpha \frac{\Delta}{\Delta + \gamma} R_n$) using ecophysiological and moisture reduction factors:
  $$\lambda ET = \lambda ET_c + \lambda ET_s + \lambda ET_i$$
  Where:
  1. **Canopy Transpiration ($\lambda ET_c$):**
     $$\lambda ET_c = (1 - f_{wet}) \cdot f_g \cdot f_t \cdot f_m \cdot \alpha \frac{\Delta}{\Delta + \gamma} (R_{nc} - G_c)$$
  2. **Soil Evaporation ($\lambda ET_s$):**
     $$\lambda ET_s = (f_{wet} + f_{sm}(1 - f_{wet})) \cdot \alpha \frac{\Delta}{\Delta + \gamma} (R_{ns} - G_s)$$
  3. **Interception / Wet Canopy Evaporation ($\lambda ET_i$):**
     $$\lambda ET_i = f_{wet} \cdot \alpha \frac{\Delta}{\Delta + \gamma} (R_{nc} - G_c)$$
  Here, $\alpha = 1.26$ (the Priestley-Taylor coefficient), $\Delta$ is the slope of the saturation vapor pressure curve ($\text{kPa/}^\circ\text{C}$), and $\gamma \approx 0.066\ \text{kPa/}^\circ\text{C}$ is the psychrometric constant.

- **Ecophysiological Scalars:**
  - $f_g = \frac{f_{APAR}}{f_{IPAR}}$: Green canopy fraction (derived from vegetation indices like SAVI / NDVI).
  - $f_t = \exp\left(-\left(\frac{T_{canopy} - T_{opt}}{T_{opt}}\right)^2\right)$: Plant temperature constraint, where optimum growth temperature $T_{opt}$ is dynamically diagnosed.
  - $f_m = \frac{f_{APAR}}{f_{APAR,max}}$ or moisture constraint tied to atmospheric vapor pressure deficit ($VPD$).
  - $f_{sm} = RH^{VPD / \beta}$: Soil moisture constraint derived from ambient relative humidity ($RH$) and $VPD$.
  - $f_{wet} = RH^4$: Wet surface fraction.

- **Evaporative Stress Index (ESI):**
  In the ECOSTRESS processing pipeline:
  $$\text{ESI} = 1 - \frac{ET_a}{\text{PET}}$$
  Or parameterized as the actual-to-potential ratio:
  $$\text{ESI}_{ratio} = \frac{ET_a}{\text{PET}}$$
  When soil water is plentiful and transpirational cooling is uninhibited, $\frac{ET_a}{\text{PET}} \approx 1.0$ (Stress Index $\to 0$). As root-zone soil water depletes below the crop's threshold of readily available water (RAW), stomatal conductance plummets, driving $\frac{ET_a}{\text{PET}}$ toward 0.0 (Stress Index $\to 1.0$).

#### 2.3 Canopy Temperature Depression (CTD) & Biophysics of Transpirational Cooling
The direct physical link between thermal remote sensing and plant water status is governed by leaf energy balance:
$$R_n - G = H + \lambda ET$$
Where sensible heat flux to the air is given by:
$$H = \rho C_p \frac{T_{canopy} - T_{air}}{r_{ah}}$$
($\rho$ is air density, $C_p$ is specific heat of air, and $r_{ah}$ is aerodynamic resistance to heat transfer).

- **Canopy Temperature Depression ($CTD$):** Defined as:
  $$CTD = T_{air} - T_{canopy} \quad \text{or conversely} \quad \Delta T = T_{canopy} - T_{air}$$
- **Latent Heat of Vaporization:** Water undergoing phase change inside the stomatal sub-cavity absorbs $\lambda \approx 2.45\text{ MJ/kg}$ ($2450\text{ J/g}$). Under open stomata and high atmospheric demand, rapid transpiration extracts thermal energy from the leaf tissue.
- **Transpiration Cooling vs. Shutdown:**
  - **Well-Watered Baseline:** A healthy, transpiring canopy can be **$2^\circ\text{C}$ to $8^\circ\text{C}$ cooler** than the surrounding ambient air ($CTD = +2 \text{ to } +8^\circ\text{C}$, or $\Delta T = -2 \text{ to } -8^\circ\text{C}$).
  - **Water Stress Inversion:** When soil moisture in the root zone approaches the permanent wilting point, root cells synthesize abscisic acid (ABA), triggering guard cells to close stomatal pores ($g_s \to 0$). Transpiration ceases ($\lambda ET \to 0$). The solar energy absorbed by the canopy can no longer be dissipated via latent heat, forcing all net radiation into sensible heat ($H \to R_n - G$).
  - **Thermal Anomaly:** The canopy warms rapidly above air temperature:
    $$T_{canopy} - T_{air} \ge +2^\circ\text{C} \text{ to } +6^\circ\text{C}$$
  This creates a distinct **thermal hotspot** at 70 m resolution. When detected during warm sunny periods, a positive temperature anomaly ($T_{canopy} > T_{air}$) is conclusive physical evidence of stomatal shutdown and severe plant water stress.

---

### 3. Comparison with Meteorological Reference Evapotranspiration ($ET_0$)

```
┌────────────────────────────────────────────────────────────────────────┐
│               Atmospheric Evaporative Demand (Top-Down)                 │
├────────────────────────────────────────────────────────────────────────┤
│ FAO-56 Penman-Monteith ET0 (Full Physics)                             │
│ └── Inputs: Net Radiation (Rn), Soil Heat (G), Wind (u2), T, VPD       │
│                                                                        │
│ Hargreaves-Samani ET0 (`lib/engine/et0.ts`)                            │
│ └── Inputs: Ra (Lat + DOY), Daily Tmax, Daily Tmin                     │
│ └── Equation: ET0 = 0.0023 * (Tmean + 17.8) * sqrt(Tmax - Tmin) * Ra    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Multiplied by Crop Coefficient (Kc)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            Potential Crop Water Requirement (Unstressed)               │
│                        ETc = Kc * ET0                                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       VS. Realized Reality         │ Soil Stress Factor (Ks = ETa / ETc)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Actual Realized Evapotranspiration (Bottom-Up)            │
│               ECOSTRESS / OpenET Actual ET (ETa)                       │
├────────────────────────────────────────────────────────────────────────┤
│ • Directly measured from surface energy balance (Rn - G - H)           │
│ • Diagnoses whether crop met ETc or suffered stomatal shutdown         │
└────────────────────────────────────────────────────────────────────────┘
```

#### 3.1 FAO-56 Penman-Monteith vs. Hargreaves-Samani in the Engine
In `nasafarmingapp`, reference evapotranspiration ($ET_0$) represents the evaporative pull of the atmosphere over a standardized hypothetically well-watered green grass surface ($0.12\text{ m}$ height, surface resistance $70\text{ s/m}$, albedo $0.23$).

1. **Full FAO-56 Penman-Monteith (Equation 6):**
   $$ET_0 = \frac{0.408 \Delta (R_n - G) + \gamma \frac{900}{T + 273} u_2 (e_s - e_a)}{\Delta + \gamma (1 + 0.34 u_2)}$$
   - *Requirement:* Complete hourly or daily meteorological forcing: net solar/terrestrial radiation ($R_n$), soil heat flux density ($G$), 2-meter wind speed ($u_2$), saturation vapor pressure ($e_s$), actual vapor pressure ($e_a$), and air temperature ($T$).
   - *Limitation in Smallholder Systems:* Radiation, wind speed, and dew point measurements from NASA POWER or global reanalyses (MERRA-2) can suffer significant local biases in mountainous terrain or data-sparse tropical latitudes.

2. **Hargreaves-Samani in `lib/engine/et0.ts`:**
   To maintain resilience when complete radiation or humidity records are unavailable, `nasafarmingapp` implements the temperature-driven Hargreaves-Samani model:
   ```typescript
   export function extraterrestrialRadiation(latDeg: number, doy: number): number {
     const phi = toRad(latDeg);
     const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
     const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
     const x = Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(delta)));
     const ws = Math.acos(x);
     return (
       ((24 * 60) / Math.PI) *
       GSC *
       dr *
       (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
     );
   }

   export function hargreavesEt0(latDeg: number, doy: number, tmaxC: number, tminC: number): number {
     const range = Math.max(tmaxC - tminC, 0);
     const tmean = (tmaxC + tminC) / 2;
     const ra = extraterrestrialRadiation(latDeg, doy);
     return Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(range) * 0.408 * ra);
   }
   ```
   - *Physical Mechanism:* The diurnal temperature range ($T_{max} - T_{min}$) serves as a proxy for solar radiation and cloudiness (clear days yield wide diurnal spreads due to solar heating and nighttime radiational cooling; humid cloudy days yield narrow spreads).
   - *Unit Factor:* The $0.408$ factor converts extraterrestrial solar radiation $R_a$ from $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$ into equivalent liquid water depth ($\text{mm}\cdot\text{day}^{-1}$, inverse of latent heat of vaporization).

#### 3.2 Actual ET ($ET_a$) vs. Potential Crop Evapotranspiration ($ET_c$)
The core difference between atmospheric demand and remote-sensing observation is summarized in the matrix below:

| Metric | Symbol | Derivation | Physical Meaning | Assumed Water Limitation |
| :--- | :--- | :--- | :--- | :--- |
| **Reference ET** | $ET_0$ | FAO-56 Penman-Monteith or Hargreaves | Atmospheric evaporative demand over hypothetical grass reference | Zero water stress; standardized surface |
| **Potential Crop ET** | $ET_c$ | $ET_c = K_c \cdot ET_0$ | Water requirement of a specific healthy crop under optimal agronomic conditions | Zero water stress; unlimited soil moisture |
| **Actual Crop ET** | $ET_a$ | Thermal Energy Balance ($\lambda ET = R_n - G - H$) or OpenET ensemble | True volume of water transpired by crop canopy and evaporated from soil | **Realized field conditions** (reflects actual root water deficit, salinity, pests) |

#### 3.3 The Stress Reduction Factor ($K_s$) as Ground-Truth Diagnostic
In standard FAO-56 dual crop coefficient modeling:
$$ET_a = (K_s K_{cb} + K_e) ET_0$$
Where $K_{cb}$ is basal crop transpiration, $K_e$ is soil evaporation, and $K_s \in [0, 1]$ is the soil water stress coefficient:
$$K_s = \frac{\text{TAW} - D_r}{\text{TAW} - \text{RAW}} = \frac{\text{TAW} - D_r}{(1 - p) \text{TAW}}$$
Where $\text{TAW}$ is total available soil water, $\text{RAW}$ is readily available soil water, and $D_r$ is root-zone soil water depletion.

**The Crucial Insight:**  
Traditional crop planners calculate $ET_c = K_c \cdot ET_0$ and assume the crop consumed that amount of water. If rainfall was low, they guess how stressed the crop was.  
With ECOSTRESS and OpenET, we do not need to guess $K_s$. The ratio of observed actual evapotranspiration to theoretical crop water demand directly provides the true field-scale stress coefficient:
$$K_{s,observed} = \frac{ET_{a,ECOSTRESS}}{K_c \cdot ET_0}$$
- If $K_{s,observed} \ge 0.90$: The crop was transpiring at full potential; soil water was abundant.
- If $K_{s,observed} \le 0.50$: The crop experienced over $50\%$ transpirational impairment, confirming severe root-zone water exhaustion.

---

### 4. Rotation Engine Integration Logic

The rotation planner engine in `lib/engine/strategies.ts` evaluates whether a farmer's historical cropping sequence is sustainable and recommends two climate-adapted alternatives:
1. **Drought-Resilient Diversification** (replacing high-water-demand cereals with sorghum, cowpea, or groundnut).
2. **Soil-Building Legume & Cover Crop Cycle** (improving organic matter and soil infiltration).

Integrating thermal remote sensing and actual ET transforms this engine from a static look-up into an empirical diagnostic system:

```
               Crop Phenology Tracker (lib/types.ts: Crop)
               • GDD accumulator & stageFractions (ini, dev, mid, late)
               • mid-season = Flowering, Pollination, Silking/Anthesis
                                      │
                                      ▼
               ECOSTRESS Overpass Archive (Overpass dates in mid-stage)
                                      │
                                      ▼
         ┌─────────────────────────────────────────────────────────┐
         │              Thermal Anomaly Diagnostic                 │
         │      Does LST - Tair > +2.0°C during mid-stage?         │
         │      Does ETa / ETc < 0.55 during dry spells?           │
         └────────────────────────────┬────────────────────────────┘
                                      │
                       YES (Hotspot Confirmed)
                                      │
                                      ▼
         ┌─────────────────────────────────────────────────────────┐
         │         Climatic Water Deficit (CWD) Validation         │
         │                CWD = max(0, ETc - P)                    │
         │                                                         │
         │  Baseline (Maize): CWD = 310 mm -> 3/5 years stressed   │
         │  Alternative (Sorghum): CWD = 75 mm -> Transpiration OK │
         └────────────────────────────┬────────────────────────────┘
                                      │
                                      ▼
         ┌─────────────────────────────────────────────────────────┐
         │        Engine Verdict (lib/engine/strategies.ts)        │
         │  • waterResilience: "high" (Alternative Option)         │
         │  • Inject Evidence Card: "Canopy heat stress confirmed" │
         └─────────────────────────────────────────────────────────┘
```

#### 4.1 Detecting Thermal Hotspots During Critical Reproductive Stages
In `lib/types.ts`, each crop is parameterized with:
- `stageFractions: { ini: number, dev: number, mid: number, late: number }`
- `temp: { optMinC, optMaxC, absMaxC, heatFloweringC }`
- `water: { droughtTolerance: 1 | 2 | 3 | 4 | 5 }`

The **mid-season stage (`mid`)** represents flowering, anthesis, and grain filling:
- In maize: Silking and tassel anthesis (typically days 55 to 80 post-planting).
- In grain legumes (cowpea, soybean, groundnut): Flowering and pod initiation.
- In wheat: Booting and heading.

If water deficit strikes during vegetative growth, crops can often recover leaf area. But if water deficit strikes during anthesis/flowering, stomatal closure causes canopy temperatures to spike above the critical thermal limit (`heatFloweringC`, typically $35^\circ\text{C}$ for maize, $32^\circ\text{C}$ for wheat), inducing **pollen sterility, silk desiccation, ovule abortion, and irreversible yield loss of $50\%\text{ to }80\%$**.

**Detection Algorithm:**
1. Determine the exact Julian calendar dates of the mid-season stage from planting date and accumulated Growing Degree Days ($GDD$).
2. Query ECOSTRESS Level 2 (ECO2LSTE) and Level 4 (ECO4ESIPTJPL) overpass pixels intersecting the field boundary (`samplePoints` in `Field`).
3. Compute the canopy temperature depression:
   $$\Delta T_{mid} = LST_{ECOSTRESS} - T_{air,POWER}$$
4. Calculate the Evaporative Stress ratio:
   $$ESR_{mid} = \frac{ET_{a,ECOSTRESS}}{ET_{c,mid}} = \frac{ET_{a,ECOSTRESS}}{K_{c,mid} \cdot ET_{0,Hargreaves}}$$
5. **Threshold Flag:** If $\Delta T_{mid} \ge +2.0^\circ\text{C}$ or $ESR_{mid} < 0.60$ for two or more overpasses during the reproductive phase, mark the season as a **Thermal Reproductive Failure Year**.
6. If this occurs in $\ge 40\%$ of historical crop cycles on that field, the engine automatically triggers an agronomic risk alert.

#### 4.2 Validating Alternative Crops via Climatic Water Deficit (CWD)
Climatic Water Deficit ($CWD$) quantifies unmet atmospheric moisture demand:
$$CWD = \sum_{t=t_{plant}}^{t_{harvest}} \max(0, ET_c(t) - P_{eff}(t))$$
Where $P_{eff}$ is effective precipitation (derived from NASA POWER `PRECTOTCORR` in `lib/engine/climate.ts`).

**Rotation Validation Workflow:**
- **Current Baseline Rotation:**  
  Suppose the farmer plants continuous Rainfed Maize ($K_{c,mid} = 1.20$, seasonal water requirement $650\text{ mm}$).  
  In a semiarid region with $350\text{ mm}$ seasonal rainfall, the cumulative $CWD$ is:
  $$CWD_{Maize} = 650 - 350 = 300\text{ mm}$$
  ECOSTRESS records historical mid-season canopy temperatures of $38.2^\circ\text{C}$ ($T_{air} = 34.0^\circ\text{C}$, $\Delta T = +4.2^\circ\text{C}$ thermal hotspot), proving the maize severely overheated and failed during dry spells.

- **Alternative 1: Drought-Resilient Diversification (Sorghum / Cowpea):**  
  Grain sorghum ($K_{c,mid} = 1.00$, deeper rooting depth $1.5\text{ m}$, high stomatal regulation, seasonal water requirement $420\text{ mm}$).  
  $$CWD_{Sorghum} = 420 - 350 = 70\text{ mm}$$
  Because sorghum's lower $K_c$ and superior rooting access draw from deeper subsoil reserves, transpiration remains sustained. 
  When checking satellite records in nearby test plots or regional analog fields, sorghum maintains $T_{canopy} - T_{air} \approx -1.5^\circ\text{C}$ ($CTD > 0$), showing transpirational cooling remained intact throughout the dry spell.

#### 4.3 Algorithmic Integration with `lib/engine/strategies.ts`
In `lib/engine/strategies.ts`, this thermal validation upgrades the option scoring:
```typescript
// Conceptual integration in lib/engine/strategies.ts
const thermalStressFrequency = fieldHistory.filter(h => h.hasMidSeasonThermalHotspot).length / fieldHistory.length;

if (thermalStressFrequency >= 0.4 && isRainfed) {
  currentRisks.push({
    id: "risk-thermal-shutdown",
    kind: "weather",
    severity: "important",
    text: "Canopy heat stress during dry spells: satellite thermal scans show your crop overheated during flowering in 3 of the last 5 years.",
    action: "Switch to a crop with lower water demand (like sorghum or cowpea) that keeps transpiring through mid-season dry spells.",
    relatedEvidence: ["ev-ecostress-lst"],
  });
}
```

---

### 5. Constraints & Processing Challenges

Deploying satellite thermal data into an operational farm advisory engine requires navigating key physical and geometric limitations:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Operational Processing Challenges                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Cloud Contamination & Atmospheric Attenuation                            │
│    • TIR cannot penetrate clouds, cirrus, or heavy dust aerosols.           │
│    • High atmospheric water vapor attenuates surface radiation (1-3K error).│
│    • Solution: Filter via ECO2LSTE cloud masks & MODTRAN-derived QA flags.  │
│                                                                             │
│ 2. Diurnal Precession & Time-of-Day Normalization                           │
│    • Overpasses occur at different times (09:00 vs 13:30 vs 16:00).         │
│    • Cannot compare raw LST directly across dates without solar correction. │
│    • Solution: Upscale instantaneous flux to daily ET using Evaporative     │
│      Fraction (EF) or Reference ET Fraction (ETrF = ET_inst / ET0_inst).    │
│                                                                             │
│ 3. Geographic Boundary Discrepancies                                        │
│    • OpenET is strictly Western/Continental US (30m ensemble).              │
│    • Global smallholders need worldwide coverage.                           │
│    • Solution: Multi-tier fallback architecture (OpenET in US; global       │
│      ECOSTRESS swath + NASA POWER / FAO-56 dual Kc elsewhere).              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 5.1 Cloud Masking and Atmospheric Correction in Thermal Bands
Thermal infrared wavelengths ($8\ \mu\text{m}\text{ to }12\ \mu\text{m}$) cannot penetrate liquid cloud water or ice crystals.
- **Sub-Pixel Cloud Contamination:** Thin cirrus, cumulus cloud edges, and sub-pixel fractional cloud cover reflect and scatter thermal emissions. Undetected sub-pixel clouds depress retrieved brightness temperatures, creating artificial "cold spots" that an automated algorithm could mistake for healthy, transpiring vegetation.
- **Atmospheric Water Vapor Correction:** Atmospheric water vapor absorbs and emits thermal radiation. A small deviation in total column water vapor ($\pm 1\ \text{g/cm}^2$) between the sensor and ground introduces an error of $1.5\text{ K to }3.0\text{ K}$ in single-channel LST retrievals.
- **Mitigation Pipeline:**
  - Strict filtering using ECOSTRESS `cloud_mask` flags in the Level 2 product (utilizing the $1.6\ \mu\text{m}$ SWIR reflectance test).
  - Atmospheric radiative transfer modeling via **MODTRAN 5.3**, forced by near-real-time 3D atmospheric temperature and moisture profiles from NASA's Goddard Earth Observing System Forward Processing (GEOS-FP) or MERRA-2.
  - Rejecting any observation where radiometric uncertainty $> 1.5\text{ K}$.

#### 5.2 Variable Time of Day Acquisition & Solar Angle Normalization
Because the ISS is in an inclined, non-sun-synchronous precessing orbit, ECOSTRESS acquires images at shifting local solar times:
- **The Challenge:** An LST of $32^\circ\text{C}$ measured at 09:30 AM represents an extraordinarily hot, desiccated surface, whereas the exact same LST of $32^\circ\text{C}$ measured at 14:30 PM under high solar elevation might represent an actively cooling, well-watered crop! Raw temperatures cannot be directly compared across different acquisition dates.
- **Normalization Solution: Instantaneous-to-Daily ET Scaling:**
  To convert an instantaneous thermal snapshot ($\lambda ET_{inst}$ at overpass time $t_{over}$) into daily water use ($ET_{24h}$), the engine uses the **Evaporative Fraction ($EF$)** or **Reference ET Fraction ($ET_rF$)** method:
  $$EF = \frac{\lambda ET_{inst}}{R_{n,inst} - G_{inst}}$$
  Because $EF$ remains relatively constant throughout daylight hours on clear sky days (self-preservation of the evaporative fraction):
  $$ET_{24h} = EF \cdot (R_{n,24h} - G_{24h})$$
  Alternatively, using the reference ET fraction:
  $$ET_rF = \frac{ET_{inst}}{ET_{0,inst}}$$
  $$ET_{24h} = ET_rF \cdot ET_{0,24h}$$
  Where $ET_{0,inst}$ is the instantaneous reference ET computed via FAO-56 Penman-Monteith for the solar zenith angle and weather conditions at the exact overpass minute, and $ET_{0,24h}$ is the daily total from `hargreavesEt0` in `lib/engine/et0.ts`.

#### 5.3 Geographic Limitation of OpenET vs. Global Requirement
- **OpenET Footprint:** OpenET is optimized for the contiguous United States (especially the 17 Western US states), driven by 4 km gridded surface weather from **gridMET** and 800 m **PRISM** meteorological data. It cannot be directly queried for fields in Africa, South Asia, Europe, or South America.
- **Global Strategy for `nasafarmingapp`:** The app implements a **three-tier data hierarchy**:

```
                                  Field Location Selected
                                             │
                       Is the field located in OpenET footprint?
                                 (CONUS / Western US)
                                  ├── YES ──► Tier 1: OpenET API (30m Ensemble ETa)
                                  │
                                  └── NO (Global Smallholder: Africa, Asia, etc.)
                                             │
                         Are clear-sky ECOSTRESS overpasses available?
                                  ├── YES ──► Tier 2: Global ECOSTRESS (70m LST/ETa)
                                  │           + NASA POWER (0.5°) Weather
                                  │
                                  └── NO ───► Tier 3: Synthetic Dual-Kc Modeling
                                              • ET0 from `hargreavesEt0` (et0.ts)
                                              • Sentinel-2 / MODIS NDVI for Kcb
                                              • SMAP L3 (9km) for Ke evaporation
```

1. **Tier 1 (Western CONUS):** Query OpenET REST API / Google Earth Engine assets for field polygons. Returns 30 m monthly and daily ensemble $ET_a$ with validated accuracy.
2. **Tier 2 (Global Coverage with Thermal Revisit):** Query NASA Earthdata LP DAAC for raw ECOSTRESS swath products (ECO2LSTE, ECO4ESIPTJPL). Scale instantaneous thermal stress using local NASA POWER MERRA-2 meteorological forcing.
3. **Tier 3 (Global Persistent Fallback):** When cloud cover or orbital coverage gaps occur, run the engine's built-in dual crop coefficient model ($ET_c = (K_{cb} + K_e) ET_0$) calibrated with Sentinel-2 10 m NDVI for $K_{cb}$ and SMAP 9 km surface wetness (`rootWetness` from `climate.ts`) for $K_e$.

---

### 6. Farmer Evidence Display Guidelines

`DESIGN.md` establishes **The Field Almanac** design system: calm, grounded, mobile-first, and **light mode only**. `UX.md` establishes the primary rule: **"Answer, then evidence. Lead with a sentence a farmer could say aloud, then show the numbers."**

Thermal remote sensing data must never be presented as an uninterpreted technical index (e.g., *"ECO4ESIPTJPL anomaly = 0.38"*). It must be translated into direct physical consequences for crops and practical rotational choices.

#### 6.1 Translation Dictionary

| Raw Remote Sensing Metric | UI Plain Language Name | Plain Language Framing in the App |
| :--- | :--- | :--- |
| $\text{LST} - T_{air} \ge +2.5^\circ\text{C}$ | Canopy Heat Stress / Thermal Anomaly | **"Canopy heat stress during dry spell."** |
| $CTD \ge +3.0^\circ\text{C}$ ($T_{air} - \text{LST}$) | Normal Transpirational Cooling | **"Canopy cooling normally."** |
| $\text{ESI} > 0.65$ ($\text{Stress}$) | Stomatal Shutdown | **"Roots ran out of water during flowering."** |
| $ET_a \ll ET_c$ | Unmet Crop Water Demand | **"Crop used 45% less water than needed to fill grain."** |
| $70\text{ m}$ ECOSTRESS Pixel | Satellite Detail | **"ECOSTRESS on ISS · 70 m thermal pass"** |

#### 6.2 Farmer Evidence Card Specifications

```
┌────────────────────────────────────────────────────────────────────────┐
│  SURFACE-RAISED CARD                                                    │
│                                                                        │
│  HEAT STRESS ALERT                                                     │
│  [!] Canopy heat stress during July dry spell                          │
│                                                                        │
│  Your maize heated up 3.4°C above the air in late July. Its roots had  │
│  run out of water during flowering, shutting down transpiration.       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ READING & TARGET BAND                                            │  │
│  │ +3.4°C above air         Comfortable band: 2° to 5°C below air   │  │
│  │ [========[======Comfortable Band======]=========|=====▲========] │  │
│  │                                               Air    Your crop   │  │
│  │                                               Temp   (Hotspot)   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ACTIONABLE ROTATION COMPARISON                                        │
│  Switching Field 1 to Grain Sorghum keeps water demand inside normal   │
│  rainfall, preventing flower heat damage.                              │
│                                                                        │
│  QUIET MONO SOURCE LINE                                                │
│  ECOSTRESS on ISS · 70 m · 24 Jul 2024, 1:45 pm overpass               │
└────────────────────────────────────────────────────────────────────────┘
```

#### 6.3 Implementation Details

##### Visual Token Usage (`DESIGN.md` Compliant)
- **Container:** `bg-surface-raised` (`#fbfaf6`), `border border-line` (`#d8d3c2`), rounded-xl, padding `p-4 sm:p-6`.
- **Primary Text:** `text-ink` (`#1f1d17`), font Geist Sans.
- **Metadata & Subtext:** `text-ink-muted` (`#5a564a`).
- **Semantic Data Colors:**
  - Canopy Thermal Hotspot: `text-heat` (`#a33d17`) on `bg-heat-soft` (`#f6e1d6`).
  - Transpiration / Water Reading: `text-water` (`#1d5c91`) on `bg-water-soft` (`#dce8f2`).
  - In-Range / Healthy Canopy: `text-healthy` (`#2e5e3a`) on `bg-field-soft` (`#dfe8d8`).
  - Drought Deficit: `text-drought` (`#765709`) on `bg-drought-soft` (`#f1e6c8`).
- **Light Mode Only:** No dark classes (`dark:`), no theme toggles, compliant with high-glare sunlight readability.

##### TypeScript Domain Type Representation (`lib/types.ts`)
To feed directly into `EvaluatedOption.evidence` in `lib/engine/strategies.ts`:

```typescript
export const ecostressEvidenceExample: Evidence = {
  id: "ev-ecostress-flowering-heat",
  claim: "Canopy heat stress during flowering",
  metric: "Canopy temperature depression",
  value: "+3.4°C above air temp (hotspot)",
  source: {
    dataset: "ECOSTRESS (JEM-EF ISS)",
    resolution: "70 m",
    dates: "24 Jul 2024, 13:45 local time",
  },
  confidence: "high",
  notes: "Stomatal closure detected during maize pollination. Nearby sorghum test plots remained 1.8°C cooler than air.",
};
```

##### UI Text Structure: Answer First, Evidence Second
1. **The Display Headline:**  
   *"Canopy heat stress during dry spell"* (`text-headline font-semibold text-ink`)
2. **The Reason Sentence:**  
   *"Your maize heated up 3.4°C above the air in late July. Its roots had run out of water during flowering, shutting down transpiration."* (`text-body text-ink max-w-measure`)
3. **The Target Band Plot:**  
   - Shaded band (`bg-field-soft`): **$-5.0^\circ\text{C}$ to $-1.5^\circ\text{C}$** (Canopy cooler than air; comfortable transpiration range).
   - Solid vertical bar at $0.0^\circ\text{C}$ (`text-ink-muted`): Air temperature baseline.
   - Distinct red point at $+3.4^\circ\text{C}$ (`bg-heat`): Overheated canopy reading.
4. **The Rotational Action:**  
   *"Switching this slot to Grain Sorghum reduces peak water demand by 210 mm, keeping the canopy transpiring safely through July."* (`text-body-sm text-field font-medium`)
5. **The Quiet Citation Footer:**  
   `ECOSTRESS on ISS · 70 m · 24 Jul 2024, 13:45 local pass` (`text-source font-mono text-ink-muted`)

---

### Summary Checklist for Engineering Implementation

| Step | Target File | Action Item |
| :--- | :--- | :--- |
| **1** | `lib/types.ts` | Add optional thermal remote sensing properties (`ctdC`, `esiRatio`) to `DailyRecord` and `Evidence` metadata. |
| **2** | `lib/engine/et0.ts` | Maintain `hargreavesEt0` as baseline; add instantaneous-to-daily scaling helper ($ET_rF = ET_{inst} / ET_{0,inst}$). |
| **3** | `lib/engine/strategies.ts` | Integrate thermal anomaly detection during `stageFractions.mid` to flag reproductive drought risks. |
| **4** | `lib/nasa/` | Add client routines for OpenET REST API and LP DAAC ECOSTRESS Level 2 / Level 4 point extractions. |
| **5** | UI Components | Implement the Evidence Card according to `DESIGN.md` tokens (Light mode only, `heat-soft` badges, target bands). |

This report provides the complete scientific, mathematical, and user-experience framework required to bring ECOSTRESS thermal data and OpenET ensembles into the `nasafarmingapp` rotation engine.

---

## Agent 5: GPM IMERG & CoCoRaHS Precipitation Records
**Specialist Role:** Precipitation & Storm Hazard Specialist

# Technical Research Report: GPM IMERG Satellite Precipitation & In-Situ Rain Gauge Networks for Agronomic Decision Engines

**Author:** Expert Hydrometeorologist & Satellite Precipitation Specialist  
**Application:** Agricultural Rotation Planning, Climate Risk Characterization, and Hydrologic Modeling  
**Date:** November 2026  
**Status:** Exhaustive Reference Specification  

---

## Executive Summary

Accurate characterization of historical rainfall regimes is fundamental to field-scale crop rotation planning, soil conservation, and agricultural risk mitigation. While numerical weather reanalyses and ground stations offer partial solutions, satellite-based precipitation estimation provides contiguous spatial and temporal coverage across global arable lands. The primary global benchmark for high-resolution satellite precipitation is the **NASA/JAXA Global Precipitation Measurement (GPM) Integrated Multi-satellitE Retrievals for GPM (IMERG)** suite. 

This technical report provides an exhaustive hydrometeorological and architectural analysis of GPM IMERG and complementary in-situ validation networks (specifically CoCoRaHS), detailing sensor mechanics, data pipeline pathways, agronomic rotation engine integration, physical retrieval limitations, and farmer-facing evidence communication standards.

---

### 1. Mission & Sensor Overview

#### 1.1 The GPM Core Observatory & International Partner Constellation
The Global Precipitation Measurement (GPM) mission is an international satellite mission initiated by the National Aeronautics and Space Administration (NASA) and the Japan Aerospace Exploration Agency (JAXA), launched on February 27, 2014, as the successor to the Tropical Rainfall Measuring Mission (TRMM, 1997–2015).

```
                      +-----------------------------+
                      |   GPM Core Observatory      |
                      |   - DPR (Ku: 13.6, Ka: 35.5) |
                      |   - GMI (10.65 - 183.3 GHz) |
                      +--------------+--------------+
                                     |
                Inter-satellite Radiometric Cross-Calibration
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
+--------+--------+         +--------+--------+         +--------+--------+
| GCOM-W1 (AMSR2) |         | DMSP (SSMIS)    |         | MetOp / JPSS    |
| Low-Freq Liquid |         | Multi-channel   |         | Sounders        |
| Emission Anchor |         | Cross-Track PMW |         | (MHS, ATMS)     |
+-----------------+         +-----------------+         +-----------------+
         \                           |                           /
          +--------------------------+--------------------------+
                                     |
                    Constellation PMW Overpasses (~2-3 hr)
                                     |
                                     v
         +------------------------------------------------------+
         | MERRA-2 / GEOS-FP Cloud Motion Advection (Morphing)  |
         +---------------------------+--------------------------+
                                     |
         +---------------------------+--------------------------+
         | Geo-IR Cloud-Top Brightness (PERSIANN-CCS, 30-min)    |
         +---------------------------+--------------------------+
                                     |
                                     v
         +------------------------------------------------------+
         | Kalman Filter Blending & Morphological Integration   |
         |            ==> GPM IMERG Gridded Product             |
         +------------------------------------------------------+
```

##### Orbital Architecture
The GPM Core Observatory flies in a non-Sun-synchronous low Earth orbit (LEO) at an inclination of $65^\circ$ and a nominal altitude of $407\text{ km}$ (elevated to $\sim 435\text{ km}$ in late-mission lifetime management). This non-Sun-synchronous trajectory allows the satellite to sample the entire diurnal cycle of precipitation across tropical, subtropical, and temperate agricultural zones up to the Arctic and Antarctic circles.

##### The "Flying Reference Laboratory" Concept
Unlike isolated satellite missions, GPM is structured as an **unfurlable constellation**. The GPM Core Observatory carries active and passive instrumentation that serves as an anchor standard to intercalibrate passive microwave (PMW) observations from a fleet of international partner satellites. The constellation includes:
*   **GCOM-W1 (JAXA):** Advanced Microwave Scanning Radiometer 2 (AMSR2).
*   **Defense Meteorological Satellite Program (DMSP-F16, F17, F18, DoD/NOAA):** Special Sensor Microwave Imager/Sounder (SSMIS).
*   **Suomi-NPP & NOAA-20/21 (NASA/NOAA):** Advanced Technology Microwave Sounder (ATMS).
*   **MetOp-B/C (EUMETSAT):** Microwave Humidity Sounder (MHS).
*   **Historical & Supporting Platforms:** Megha-Tropiques (MADRAS/SAPHIR), Sentinel-6 Michael Freilich (AMR-C), and the Fengyun-3 series (MWHS-2/MWRI).

Together, this constellation achieves a global revisit interval of approximately **2 to 3 hours** across most agricultural regions.

---

#### 1.2 IMERG Algorithm: Triple-Sensor Fusion
The Integrated Multi-satellitE Retrievals for GPM (IMERG) algorithm merges three distinct observation regimes:

```
+-------------------------------------------------------------------------------+
|                       IMERG OBSERVATIONAL FUSION REGIMES                      |
+-----------------------+-------------------------------+-----------------------+
|  Active Radar (DPR)   |    Passive Microwave (PMW)    | Geostationary IR (GEO)|
|  Vertical Profiling   |   Microphysical Scattering    | High Temporal Refresh |
+-----------------------+-------------------------------+-----------------------+
| • Ku-band (13.6 GHz)  | • Conical & Cross-track scans | • Window IR (10.7 µm) |
| • Ka-band (35.5 GHz)  | • 10.65 GHz to 183.31 GHz     | • 4 km / 30-min resolution|
| • Drop Size Dist (DSD)| • GPROF Bayesian Retrieval    | • Cloud-top brightness temp|
| • Hydrometeor Phase   | • Liquid emission & ice scatt.| • Cloud motion tracking|
+-----------------------+-------------------------------+-----------------------+
```

##### 1. Dual-Frequency Precipitation Radar (DPR)
The DPR consists of a Ku-band radar ($13.6\text{ GHz}$, wavelength $\lambda \approx 2.2\text{ cm}$) and a Ka-band radar ($35.5\text{ GHz}$, $\lambda \approx 8.5\text{ mm}$). 
*   **Differential Attenuation & Drop Size Distribution (DSD):** By evaluating the dual-frequency ratio ($DFR = 10\log_{10}(Z_{Ku}) - 10\log_{10}(Z_{Ka})$), the radar extracts the median volume diameter ($D_0$) and generalized intercept parameter ($N_w$) of raindrops.
*   **Vertical Stratification:** DPR identifies the melting layer ("bright band"), distinguishing liquid rain from frozen graupel/snow, providing 3D rain profiles at $250\text{ m}$ vertical and $5\text{ km}$ horizontal resolution across a $245\text{ km}$ swath.

##### 2. GPM Microwave Imager (GMI) & Constellation Radiometers
The GMI is a 13-channel conically scanning radiometer with frequencies ranging from $10.65\text{ GHz}$ to $183.31\text{ GHz}$:
*   **Emission Channels ($10.65, 18.7, 23.8, 36.5\text{ GHz}$):** Over low-emissivity ocean surfaces ($\epsilon \approx 0.4 - 0.5$), liquid raindrops emit radiation, appearing "warm" against the cold radiometric sea background.
*   **Scattering Channels ($89.0, 166.0, 183.31\pm3, 183.31\pm7\text{ GHz}$):** Over high-emissivity land surfaces ($\epsilon \approx 0.90 - 0.95$), emission from liquid water is indistinguishable from warm soil background. Retrieval over land relies on the scattering of upwelling radiation by ice hydrometeors (graupel and hail) in cloud updrafts, which causes a depression in brightness temperature ($T_b$).
*   **GPROF (Goddard Profiling Algorithm):** GPROF uses a Bayesian inversion framework conditioned on DPR/GMI empirical observational libraries. For an observed brightness temperature vector $\mathbf{T}_b$, the retrieved precipitation rate $R$ is:
$$\hat{R} = \int R \cdot P(R \mid \mathbf{T}_b) \, dR = \frac{\sum_j R_j \cdot \exp\left( -\frac{1}{2} (\mathbf{T}_b - \mathbf{T}_{b,\text{sim},j})^T \mathbf{S}_y^{-1} (\mathbf{T}_b - \mathbf{T}_{b,\text{sim},j}) \right)}{\sum_j \exp\left( -\frac{1}{2} (\mathbf{T}_b - \mathbf{T}_{b,\text{sim},j})^T \mathbf{S}_y^{-1} (\mathbf{T}_b - \mathbf{T}_{b,\text{sim},j}) \right)}$$
where $\mathbf{S}_y$ is the observational error covariance matrix and $j$ indexes pre-calculated cloud-precipitation profiles.

##### 3. Geostationary Infrared (Geo-IR) Observations
Between PMW overpasses (data gaps of 1 to 3 hours), precipitation is tracked using thermal infrared window channels ($\sim 10.7\,\mu\text{m}$) collected from international geostationary satellites (GOES-East, GOES-West, Meteosat, Himawari).
*   **PERSIANN-CCS (Cloud Classification System):** Uses local cloud-top temperature features, textures, and patches to estimate instantaneous rain rates.
*   **Morphing Vectors:** Numerical atmospheric motion vectors derived from Total Precipitable Water (TPW) advection fields in reanalyses (MERRA-2 for Final; GEOS-FP for Early/Late) propagate PMW rain swaths forward and backward in time.
*   **Kalman Filter Weighting:** When a PMW overpass occurs, its uncertainty is low and its weight in the estimate is high. As time elapses after an overpass, the variance of the morphed estimate grows, and the Kalman filter blends morphed microwave fields with cloud-motion-calibrated infrared estimates.

---

### 2. Product Runs & Specifications

#### 2.1 The Three Production Runs
NASA processes IMERG in three distinct operational pipelines to balance latency against accuracy:

| Run Specification | IMERG Early Run | IMERG Late Run | IMERG Final Run |
| :--- | :--- | :--- | :--- |
| **Nominal Latency** | **~4 hours** after observation | **~14 hours** after observation | **~3.5 months** post-observation month |
| **Morphing Direction** | **Forward only** (extrapolated) | **Forward & backward** (interpolated)| **Forward & backward** (reanalysis) |
| **Wind Advection Field**| GEOS-FP (Forward forecast) | GEOS-FP (Analysis/assimilated) | MERRA-2 Reanalysis |
| **In-Situ Calibration** | None (climatological ratios only)| None (climatological ratios only) | **GPCC Monthly Rain Gauge Analysis** |
| **Target End-Use** | Flash flood modeling, landslide hazard tracking | **Agricultural operations**, irrigation scheduling | **Research-grade climatology**, rotation analysis |
| **Reprocessing Line** | Rolling / Near-Real-Time (NRT) | Rolling / Near-Real-Time (NRT) | Uniform historical archive (2000–present)|

```
Latency Timeline:
0h       4h             14h                               3.5 Months
|--------|--------------|-----------------------------------|
Event    Early Run      Late Run                            Final Run
         (Flood Alerts) (Field Operations)                  (Research Climatology + GPCC)
```

##### 1. IMERG Early Run
Because future overpasses are not yet available at $T + 4\text{ hours}$, advection vectors can only morph microwave precipitation **forward in time**. Cloud development or dissipation occurring after the last PMW scan cannot be captured accurately. It is optimized strictly for time-critical hydrological flash-flood forecasting.

##### 2. IMERG Late Run
With a 14-hour latency, satellite overpasses both preceding and following the target timestamp are ingested, enabling **bidirectional morphing**. This captures cloud system lifecycle dynamics (initiation, growth, decay). The Late Run is the operational engine for daily farm management, moisture monitoring, and field trafficability decisions.

##### 3. IMERG Final Run
Released roughly 3.5 months after the target month, the Final Run incorporates the Global Precipitation Climatology Centre (GPCC) Full Data Reanalysis / Monitoring Product (derived from quality-controlled global weather bureau rain gauges). The satellite estimates are adjusted such that the monthly multi-satellite accumulation matches the GPCC gauge analysis on a $1.0^\circ \times 1.0^\circ$ grid, while preserving the sub-monthly, $0.1^\circ$ satellite spatial patterns. This provides the multi-decadal reference dataset needed for historical agronomic baseline calculations.

---

#### 2.2 Spatial Resolution & Grid Topography
*   **Grid Coordinate Reference System:** WGS 84 (EPSG:4326), regular geographic latitude/longitude.
*   **Cell Resolution:** $0.1^\circ \times 0.1^\circ$ (nominally $3600 \times 1800$ grid points globally between $90^\circ\text{N}$ and $90^\circ\text{S}$).
*   **Physical Metric Footprint:**
    *   *Equator ($0^\circ$ latitude):* $0.1^\circ \approx 11.1\text{ km} \times 11.1\text{ km} \approx 123.2\text{ km}^2$.
    *   *Corn Belt / Mid-latitudes ($42^\circ\text{N}$, e.g., Iowa):* $0.1^\circ \text{ lat} \approx 11.1\text{ km}$; $0.1^\circ \text{ lon} = 11.1 \times \cos(42^\circ) \approx 8.25\text{ km}$; cell area $\approx 91.6\text{ km}^2$ ($\approx 22,630\text{ acres}$).
    *   *High Latitudes ($60^\circ\text{N}$, e.g., Canadian Prairies):* $0.1^\circ \text{ lat} \approx 11.1\text{ km}$; $0.1^\circ \text{ lon} \approx 5.55\text{ km}$; cell area $\approx 61.6\text{ km}^2$.

---

#### 2.3 Temporal Resolution, Integration Physics, & Measurement Units

```
+-----------------------------------------------------------------------------------+
|               CRUCIAL DISTINCTION: RATE VS ACCUMULATION                           |
+-------------------------------------------------+---------------------------------+
| Instantaneous Precipitation Rate                | Daily Accumulated Depth         |
| Variable: `precipitationCal`                    | Variable: Derived or Daily NetCDF|
| Unit: mm/hr                                     | Unit: mm                        |
| Meaning: Flux rate at observation snapshot      | Meaning: Total volumetric depth |
+-------------------------------------------------+---------------------------------+
```

##### 1. Instantaneous Precipitation Rate (`precipitationCal`)
*   **Variable Name:** `precipitationCal` (calibrated precipitation rate) or `precipitationUncal`.
*   **Unit:** Millimeters per hour ($\text{mm}/\text{hr}$).
*   **Sampling Interval:** 30 minutes ($1800\text{ s}$).
*   **Physical Meaning:** The instantaneous hydrometeor flux passing through the cloud base at that half-hour step.

##### 2. Daily Accumulated Precipitation
*   **Calculation via Rate Integration:** A 24-hour day comprises $N = 48$ half-hour intervals. Integrating half-hourly rates into a daily depth requires multiplying each rate by the step duration ($\Delta t = 0.5\text{ hr}$):
$$P_{\text{daily}} = \sum_{k=1}^{48} \left( R_k \times 0.5\text{ hr} \right) \quad [\text{mm}]$$

> [!CAUTION]
> **Summation Error Trap:** A common implementation flaw in geospatial data adapters is summing `precipitationCal` directly across 48 time steps without scaling by $0.5$. This doubles the actual daily precipitation.

##### 3. Observation Day Boundary Alignment
A standard UTC day ($00:00\text{Z} - 23:59\text{Z}$) does not match agricultural reality or ground validation observations:
*   **CoCoRaHS Observation Day:** 7:00 AM Local Standard Time (LST) to 7:00 AM LST next day ($12:00\text{Z}$ to $12:00\text{Z}$ across US Central Time).
*   **Agronomic Solar Day:** Dawn-to-dusk water balance driven by diurnal potential evapotranspiration ($\text{ET}_0$).
*   *Requirement:* Ingestion pipelines must sum half-hourly IMERG granules over local observation windows ($T_{\text{start}}$ to $T_{\text{end}}$) rather than defaulting to UTC calendar days.

---

### 3. Access Pathways & Current Infrastructure Status

```
+---------------------------------------------------------------------------------------+
|                             DATA ACCESS ECOSYSTEM OVERVIEW                            |
+--------------------------+------------------------------+-----------------------------+
| Pathway                  | Authentication / Protocol    | Operational Suitability     |
+--------------------------+------------------------------+-----------------------------+
| GES DISC Hydrology Rods  | Sunken / Discontinued        | NON-FUNCTIONAL (HTTP 301/404)|
| Earthdata Harmony API    | OAuth2 Bearer Token / HTTPS  | Primary Pipeline Subsetter  |
| GES DISC OPeNDAP         | .netrc Earthdata Login       | Remote Slicing / Array Pull |
| GES DISC AWS S3 Direct   | AWS IAM / S3 vsis3 (us-west-2)| Cloud-Native HPC / Zarr     |
| NASA POWER PRECTOTCORR   | Unauthenticated Open REST    | Unauthenticated Fallback    |
| CoCoRaHS API             | Open REST JSON / CSV         | In-Situ Validation Ground   |
+--------------------------+------------------------------+-----------------------------+
```

#### 3.1 Discontinuation of GES DISC Hydrology Data Rods
Historically, the Goddard Earth Sciences Data and Information Services Center (GES DISC) provided **Hydrology Data Rods**, a REST webservice designed for hydrologists to extract point-time series from LDAS and satellite products (TRMM/GPM) via single HTTP GET calls.
*   **Current Status:** **Permanently Discontinued / Deprecated.**
*   **Observed Behavior:** HTTP 301 redirects to deprecation notices or HTTP 404/502 errors. Client systems relying on endpoints such as `https://hydro1.gesdisc.eosdis.nasa.gov/daac-bin/access/timeseries.cgi` fail completely.
*   **Architectural Mandate:** Production platforms must migrate point-extraction workflows to NASA Earthdata Cloud services (Harmony or S3 direct access).

---

#### 3.2 Current Cloud-Native Access Architectures

##### 1. NASA Earthdata Harmony API
Harmony is NASA's unified transformation interface, enabling spatial subsetting, variable selection, temporal filtering, and reformatting on cloud-hosted datasets prior to egress.

*Authentication:* Requires Earthdata Login (EDL) Bearer Token generated via URS OAuth2.

```bash
# Example: Subsetting IMERG Final Half-Hourly precipitationCal over an Iowa Field
curl -X GET "https://harmony.earthdata.nasa.gov/GPM_3IMERGHH_07/wms?\
SERVICE=WCS&\
REQUEST=GetCoverage&\
COVERAGEID=precipitationCal&\
SUBSET=lat(41.9,42.1)&\
SUBSET=lon(-93.7,-93.5)&\
SUBSET=time(\"2024-06-01T00:00:00Z\",\"2024-06-01T23:59:59Z\")&\
FORMAT=application/x-netcdf4" \
-H "Authorization: Bearer YOUR_EARTHDATA_TOKEN" \
-o iowa_field_imerg_20240601.nc
```

##### 2. OPeNDAP Protocol (GES DISC)
OPeNDAP allows remote structural slicing of HDF5/NetCDF files using DAP4 protocols.
*   Requires a valid `~/.netrc` file containing Earthdata credentials:
```text
machine urs.earthdata.nasa.gov login <USER> password <PASS>
```
*   Data access URL structure:
```text
https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07/2024/06/3B-DAY.MS.MRG.3IMERG.20240601-S000000-E235959.V07B.nc4.nc4?precipitationCal[0:0][lat_idx_min:lat_idx_max][lon_idx_min:lon_idx_max]
```

##### 3. Direct AWS S3 Bucket Egress (Cloud Instances)
When running processing nodes inside AWS Region **`us-west-2`**, data can be streamed directly from NASA's Cumulus archive with zero egress costs using GDAL/Rasterio virtual file paths:
*   **S3 Bucket:** `s3://gesdisc-cumulus-prod-protected/`
*   **Authentication:** Temporary AWS STS credentials obtained via `https://data.gesdisc.earthdata.nasa.gov/s3credentials`.

---

#### 3.3 Fallback Architecture: NASA POWER PRECTOTCORR
When Earthdata credentials are absent or during cloud API throttling, systems require a reliable, unauthenticated fallback.

```
                    +------------------------------------+
                    | Need Historical Precipitation Data |
                    +-----------------+------------------+
                                      |
                     Earthdata Credentials Configured?
                                      |
                      +---------------+---------------+
                      |                               |
                     YES                             NO
                      |                               |
                      v                               v
         +------------------------+      +---------------------------+
         | Access GPM IMERG Final |      | Fallback: NASA POWER API  |
         | (Harmony / OPeNDAP)    |      | (Parameter: PRECTOTCORR)  |
         | Latency: 3.5 mo        |      | Latency: 2-3 days         |
         | Resolution: 0.1 deg    |      | Resolution: 0.5 x 0.625   |
         | Direct Satellite Radar |      | MERRA-2 Bias-Corrected    |
         +------------------------+      +---------------------------+
```

##### Pipeline Specifications for NASA POWER
*   **Endpoint:** `https://power.larc.nasa.gov/api/temporal/daily/point`
*   **Key Precipitation Parameter:** `PRECTOTCORR` (Precipitation Corrected, $\text{mm}/\text{day}$).
*   **Data Lineage:** Model-assimilated parameter derived from the Goddard Earth Observing System (GEOS) atmospheric data assimilation system and MERRA-2 reanalysis, bias-corrected using Global Precipitation Climatology Project (GPCP) and CPC ground observations.
*   **Fill Value Handling:** Missing records return `-999.0` or `-999`. Ingestion engines must convert fill values to strict language-level `null` / `NaN` before performing numeric computations.
*   **Coarseness Tradeoff:** Native resolution is $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$ (nominally $\sim 50\text{ km} \times 60\text{ km}$). It provides regional synoptic trends rather than convective cell dynamics.

---

#### 3.4 In-Situ Ground Validation Network: CoCoRaHS
To ground-truth satellite estimates and calibrate local bias, the agronomic engine incorporates the **Community Collaborative Rain, Hail and Snow Network (CoCoRaHS)**.

```
CoCoRaHS Manual Standard:
         \               /
          \  4-inch     /    <-- Sharp outer bevel minimizes splash-out
           \  Aperture /
            |         |
            | Inner   |      <-- Precision measuring tube (0.01 inch / 0.25 mm)
            | Tube    |
            |         |
            | Outer   |      <-- Overflow chamber holds up to 11 inches (279 mm)
            | Cylinder|
            +---------+
```

##### Network Characterization
*   **Scale:** Over 25,000 active volunteer observers across the United States, Canada, Puerto Rico, the US Virgin Islands, the Bahamas, and Guam.
*   **Instrumentation Standard:** All stations deploy a standardized, high-capacity, manual 4-inch ($101.6\text{ mm}$) diameter clear plastic rain gauge (Tru-Chek / Clean-Flo specification).
*   **Measurement Sensitivity:** Accurately resolves $0.01\text{ inches}$ ($0.254\text{ mm}$). Rainfall beneath this threshold is logged as a Trace ($T < 0.25\text{ mm}$).
*   **Protocol Uniformity:** Observations are read daily at **7:00 AM local time**, minimizing evaporative loss errors.
*   **Zero Reporting:** Observers record explicit $0.00\text{ mm}$ observations on rainless days, resolving the hydrologic ambiguity between "zero rainfall" and "missing data."

##### Data Access Pattern
*   REST API: `https://data.cocorahs.org/export/exportreports.aspx`
*   Query parameters: `ReportType=Daily`, `State=IA`, `StartDate=2024-05-01`, `EndDate=2024-09-30`, `Format=JSON`.
*   Data fields: `StationNumber`, `ObservationDate`, `TotalPrecipAmount` (inches), `Flag` (E = Estimated, M = Multi-day accumulation).

---

### 4. Rotation Engine Integration & Agronomic Calculations

Crop rotation planning relies on historical weather variability over multiple decades ($N = 10\text{ to }30\text{ seasons}$). Below are the core equations and algorithmic structures implemented in the rotation engine.

```
Full Season (e.g. 130 Days):
+---------------------------------------------------------------------------------------+
|  Stage 1: Emergence  |   Stage 2: Vegetative    |  Stage 3: Reproductive |  Stage 4:   |
|     (20 Days)        |        (40 Days)         |   (Silking/Tasseling)  |  Maturity   |
|                      |                          |        (30 Days)       |  (40 Days)  |
+----------------------+--------------------------+------------------------+-------------+
                                                  ^
                                                  | CRITICAL VULNERABILITY WINDOW
                                                  | - Daily rainfall < 1 mm => Drought stress
                                                  | - Single day > 50 mm   => Runoff & erosion
```

#### 4.1 Phenological Stage Segmentation & Historical Completeness Rules

Let $S$ denote an eligible crop season year in the historical window ($S \in \{Y - N + 1, \dots, Y\}$). For a crop species $c$, the growing cycle is partitioned into $M$ sequential phenological stages:
$$\mathcal{T}_m(S) = [t_{\text{start}, m}(S), \, t_{\text{end}, m}(S)], \quad m \in \{1, 2, \dots, M\}$$
where dates are derived from regional planting calendars or cumulative Growing Degree Day (GDD) thresholds:
$$\text{GDD}_d = \max\left(0, \, \frac{T_{\max, d} + T_{\min, d}}{2} - T_{\text{base}}\right)$$

##### Data Completeness Gate
A season $S$ is eligible if and only if valid daily rainfall values exist for at least $95\%$ of all calendar days in the crop cycle:
$$\text{Completeness}(S) = \frac{\sum_{d \in \mathcal{T}(S)} \mathbb{I}(P_d 
eq \text{null})}{|\mathcal{T}(S)|} \ge 0.95$$
Furthermore, within the reproductive window ($m = \text{Reproductive}$), completeness must be **100%**. Any missing day within this critical stage invalidates the season from being evaluated, preventing downward-biased stress estimates.

##### Phenological Rainfall Accumulation
For each stage $m$ and season $S$:
$$P_{m}(S) = \sum_{d \in \mathcal{T}_m(S)} P_d \quad [\text{mm}]$$

---

#### 4.2 Empirical Distribution Percentiles ($P_{10}, P_{50}, P_{90}$)
Precipitation distributions across seasons are non-Gaussian (bounded at zero, positively skewed). The agronomic engine calculates non-parametric empirical quantiles across $K$ complete historical seasons.

Given an ordered sequence of seasonal or stage-specific rainfall totals:
$$P_{(1)} \le P_{(2)} \le \dots \le P_{(K)}$$
The empirical percentile $q \in \{0.10, 0.50, 0.90\}$ is computed via linear interpolation:
$$\text{Index} \, i = 1 + (K - 1)q$$
$$\text{Let } j = \lfloor i \rfloor, \quad f = i - j$$
$$\text{Quantile}(q) = (1 - f) P_{(j)} + f P_{(j+1)}$$

```
Empirical Distribution of Historical Seasonal Rainfall:
              10th Percentile           50th Percentile               90th Percentile
                 (Dry Year)                (Median)                     (Wet Year)
                     |                        |                              |
                     v                        v                              v
[P(1)] ... [P(dry_threshold)] ... ... ... [P(median)] ... ... ... ... ... [P(wet_threshold)] ... [P(K)]
   <-------- Drought Hazard -------->                  <-------- Waterlogging / Disease -------->
```

##### Agronomic Interpretations
*   **$P_{10}$ (Dry Season Scenario):** The worst 1-in-10 year drought baseline. If crop water demand ($Kc \times \text{ET}_0$) exceeds $P_{10}$ plus available soil water capacity ($\text{AWC}$), the rotation requires fallow periods, cover-crop moisture termination, or supplemental irrigation.
*   **$P_{50}$ (Median Baseline):** Typical operating conditions for average yield projections.
*   **$P_{90}$ (Wet Season Scenario):** The 1-in-10 wet year baseline. Highlights waterlogging risk, root hypoxia, nitrogen leaching potential, and high fungal/bacterial disease pressure.

---

#### 4.3 Extreme Storm Event Frequency & Soil Erosion Hazard
Soil loss through water erosion is governed by the kinetic energy of falling raindrops and runoff shear stress. Under the Universal Soil Loss Equation (USLE/RUSLE), the rainfall-runoff erosivity index ($R$-factor) is defined as:
$$R = \frac{1}{n} \sum_{k=1}^n \left( E \cdot I_{30} \right)_k$$
where $E$ is total storm kinetic energy and $I_{30}$ is the maximum 30-minute rainfall intensity.

Because sub-hourly storm intensity is often unavailable over decades, daily satellite precipitation thresholds serve as proxies for detachment and transport capacity:
*   **Moderate Erosive Threshold:** Daily rainfall $P_d > 25\text{ mm}$ ($\approx 1.0\text{ inch}$).
*   **Severe Gully/Runoff Hazard Threshold:** Daily rainfall $P_d > 50\text{ mm}$ ($\approx 2.0\text{ inches}$).

```
Daily Precipitation Time Series (Season S):
Rain (mm)
 60 |                                     *  <- Severe Event (> 50 mm)
 50 |-------------------------------------|--------------------------- Severe Erosion Line
 40 |
 30 |               *                     |  <- Moderate Event (> 25 mm)
 25 |---------------|---------------------|--------------------------- Moderate Erosion Line
 20 |               |                     |
 10 |   *           |      *              |
  0 +---+-----------+------+--------------+---------------------------> Time (Days)
```

##### Agronomic Calculation Engine Algorithm
For a given rotation stage (e.g., bare soil post-tillage or early emergence before canopy closure):
$$\text{ErosiveDays}_{25}(S) = \sum_{d \in \mathcal{T}_{\text{bare}}(S)} \mathbb{I}(P_d \ge 25.0)$$
$$\text{ErosiveDays}_{50}(S) = \sum_{d \in \mathcal{T}_{\text{bare}}(S)} \mathbb{I}(P_d \ge 50.0)$$

The engine outputs the historical recurrence frequency:
$$f_{\text{erosion, 50}} = \frac{\sum_{S=1}^K \mathbb{I}(\text{ErosiveDays}_{50}(S) \ge 1)}{K}$$
*Agronomic Rule:* If $f_{\text{erosion, 50}} > 0.20$ (more than 1 in 5 seasons), the rotation engine rejects continuous clean-tilled annual crops on slopes $>3\%$ and requires no-till, perennial strips, or overwinter cover crops (e.g., cereal rye).

---

#### 4.4 Dry Spell Duration (Consecutive Dry Days, CDD)
A dry spell is defined hydrometeorologically as a consecutive sequence of days where daily precipitation remains below the effective infiltration threshold ($P_d < 1.0\text{ mm}$):

```
Daily Rainfall Status:
Day:    1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
Rain:  0.0 0.2 0.0 0.8 0.0 0.0 0.0 0.0 0.0 0.0 0.0 0.0 0.0 4.2 0.0
State: [D   D   D   D   D   D   D   D   D   D   D   D   D]  W   D
       <------------- 13-Day Consecutive Dry Spell ------------>
```

##### Calculation Engine Formulation
Within crop window $\mathcal{T}(S) = \{d_1, d_2, \dots, d_T\}$:
$$\text{Run}(d_t) = \begin{cases} 
\text{Run}(d_{t-1}) + 1 & \text{if } P_{d_t} < 1.0\text{ mm} \\ 
0 & \text{if } P_{d_t} \ge 1.0\text{ mm} \text{ or } P_{d_t} = \text{null}
\end{cases}$$
The maximum dry spell for season $S$ is:
$$\text{MaxCDD}(S) = \max_{d \in \mathcal{T}(S)} \left( \text{Run}(d) \right)$$

##### Agronomic Stress Trigger
For a given field soil with available water capacity $\text{AWC}$ ($\text{mm water} / \text{m soil}$) and rooting depth $Z_r$ ($\text{m}$), the total readily available water ($\text{RAW}$) before severe water stress is:
$$\text{RAW} = p \cdot \text{AWC} \cdot Z_r$$
where $p$ is the crop depletion fraction (typically $0.5$ for maize/soybeans). If:
$$\text{MaxCDD}(S) \times \text{ET}_{c, \text{daily}} > \text{RAW}$$
the crop undergoes stomatal closure, leaf rolling, wilting, and permanent physiological yield penalties.

---

### 5. Technical Limitations & Uncertainty

Hydrometeorologists and agricultural data engineers must account for the physical constraints of satellite-based precipitation retrievals:

```
+-------------------------------------------------------------------------------+
|                       PRIMARY SATELLITE RETRIEVAL LIMITATIONS                 |
+---------------------------+---------------------------+-----------------------+
|  Surface Phase Ambiguity  | Complex Topography (Orog.)| Beam-Filling & Scale  |
+---------------------------+---------------------------+-----------------------+
| • Frozen soil & snowpack  | • Shallow warm orographic | • 10 km grid averaging|
|   mimic ice scattering    |   rain lacks ice aloft    | • 2 km convective storm|
| • False positive alarms   | • Spaceborne PMW fails to |   diluted 10x to 20x  |
| • GPROF masks data as null|   detect updraft signature| • Disconnect with farm|
+---------------------------+---------------------------+-----------------------+
```

#### 5.1 Microwave Retrieval Errors over Frozen Ground and Complex Topography
1.  **Frozen Soil and Snow Cover Scattering Signatures:**
    *   *The Physical Mechanism:* GPROF over land relies on microwave scattering by ice particles at $89\text{ GHz}$ and $166\text{ GHz}$. However, terrestrial snowpack, rime, and frozen topsoil consist of crystalline ice structures that scatter upwelling terrestrial radiation identically to atmospheric graupel.
    *   *Systemic Error:* Satellite algorithms misinterpret frozen ground as intense convective precipitation cores (false alarms), or completely suppress retrievals by falling back to climatological masks when surface temperatures drop below $0^\circ\text{C}$.
2.  **Coastal Mixed-Pixel Masking:**
    *   Along coastlines and major lakes, a single $0.1^\circ$ footprint spans both land ($\epsilon \approx 0.92$) and water ($\epsilon \approx 0.45$). This sharp discontinuity disrupts the GPROF radiative transfer model, resulting in spurious high-rain bands or missing data masks along shorelines.
3.  **Warm Orographic Enhancement Misses:**
    *   In mountainous terrain, maritime air masses are forced upward (orographic lifting), generating thick, low-level nimbostratus clouds that produce heavy rainfall without deep vertical updrafts or large ice hydrometeors aloft.
    *   *Systemic Underestimation:* Because there is minimal ice scattering above the freezing level, spaceborne passive microwave radiometers overlook this warm rain process, underestimating windward mountain precipitation by up to $40 - 60\%$.

---

#### 5.2 Resolution Limits: Cell Averaging of Localized Convection
The fundamental constraint of satellite precipitation in agricultural systems is the **spatial scale disparity** between the satellite footprint ($0.1^\circ \approx 100\text{ km}^2$) and an agricultural field ($0.1\text{ to }4\text{ km}^2$).

```
Areal Footprint Comparison:
+-------------------------------------------------------------+
| GPM IMERG Grid Cell (0.1 deg x 0.1 deg ~ 100 km²)           |
|                                                             |
|       +---------------------------------------------+       |
|       | Isolated Convective Core (2 km x 2 km)      |       |
|       | Intensity: 60 mm/hr                         |       |
|       |                                             |       |
|       |   [Farmer's Field]                          |       |
|       |   Area: 80 acres (0.32 km²)                 |       |
|       +---------------------------------------------+       |
|                                                             |
| Rest of Grid Cell (96 km²): Dry Ground (0 mm/hr)           |
|                                                             |
| Integrated Satellite Measurement: 2.4 mm/hr                 |
+-------------------------------------------------------------+
```

##### The Beam-Filling & Spatial Averaging Problem
Consider a localized summer thunderstorm:
*   The convective cloudburst core covers $4\text{ km}^2$ within a $100\text{ km}^2$ IMERG cell.
*   Actual rainfall in that core: $60.0\text{ mm}/\text{hr}$.
*   The remaining $96\text{ km}^2$ receives $0.0\text{ mm}/\text{hr}$.
*   **Satellite Integrated Calculation:**
$$R_{\text{cell}} = \frac{(4\text{ km}^2 \times 60.0\text{ mm}/\text{hr}) + (96\text{ km}^2 \times 0.0\text{ mm}/\text{hr})}{100\text{ km}^2} = 2.4\text{ mm}/\text{hr}$$

##### The Agronomic Contradiction
The farmer observes an intense storm that caused gully erosion, sheet wash, and standing water. Concurrently, the satellite record displays an unremarkable $2.4\text{ mm}$ reading. Conversely, if the convective core strikes the opposite corner of the $10\text{ km}$ cell, the satellite records rain while the farmer's dust remains undisturbed.

---

### 6. Farmer Evidence Display Guidelines

Translating complex satellite hydrometeorology into user interfaces requires strict adherence to agronomic UX principles, avoiding false precision while maintaining transparent scientific provenance.

```
+---------------------------------------------------------------------------------------+
|                             USER INTERFACE DESIGN RULES                               |
+------------------------------------+--------------------------------------------------+
| Anti-Pattern (Reject)              | Recommended Pattern (Adopt)                      |
+------------------------------------+--------------------------------------------------+
| "Precipitation on your field:      | "Historical rainfall around your field           |
|  412.45 mm"                        |  based on satellite estimates (380 - 440 mm)"    |
| • Implies direct point measurement | • Uses honest regional framing                   |
| • False numeric precision          | • Acknowledges resolution limits                 |
+------------------------------------+--------------------------------------------------+
| "Drought Probability: 30%"         | "3 of 10 historical seasons saw severe dry spells|
| "Erosion Risk: High"               |  exceeding 14 days during flowering"             |
| • Cognitive abstraction            | • Concrete natural frequency format              |
| • Unactionable probability         | • Grounded in empirical agronomic events         |
+------------------------------------+--------------------------------------------------+
```

#### 6.1 Spatial Framing & Honest Attribution
*   **The Spatial Rule:** Never label satellite or reanalysis estimates as "Your field's rainfall." Always use:
    > *"Historical rainfall around your field based on satellite estimates"*
*   **Resolution Disclosure:** The interface must state the cell scale in plain units:
    > *"NASA GPM IMERG combines satellite radar and microwave passes over an approximate 10 km × 10 km area. It captures regional storm patterns well, but may smooth out hyper-local summer cloudbursts."*
*   **Strict Provenance Line:** Every chart, card, and report must include an explicit attribution footer:
    > *"Source: NASA GPM IMERG (V07B Final Run, 0.1° cell, GPCC-calibrated) · 2000–2024"*

---

#### 6.2 Natural Frequency Reporting vs Abstract Probabilities
Behavioral psychology and agricultural extension studies demonstrate that farmers frequently misinterpret probabilities (e.g., "a 20% annual chance of severe drought" or "a 10-year storm event") as either meaning the event will not occur for nine years, or treating a $20\%$ risk as negligible. 

The agronomic engine mandates **Natural Frequency Event Counts**:

```
BAD (Abstract Probability):
+--------------------------------------------------------------------+
| Drought Risk: 30% Probability of Failure                           |
| 10-Year 24-hr Storm Frequency: P = 0.10                            |
+--------------------------------------------------------------------+

GOOD (Actionable Natural Frequency):
+--------------------------------------------------------------------+
| DRY SPELL EXPOSURE                                                 |
| 3 of 10 historical seasons experienced dry spells longer than       |
| 14 consecutive days during the critical flowering window.          |
|                                                                    |
| EROSION HAZARD                                                     |
| 6 of 20 historical seasons recorded single-day storms exceeding     |
| 50 mm (2 inches) while fields were bare prior to crop emergence.   |
| -> Recommendation: Retain cover crop residue to protect topsoil.   |
+--------------------------------------------------------------------+
```

##### Standardized Copy Strings for Common Agronomic Conditions

```typescript
// Production UI copy formatting specifications
export const UI_PRECIPITATION_STRINGS = {
  spatialContext: "Historical rainfall around your field based on satellite estimates",
  
  drySpellWarning: (eventYears: number, totalYears: number, days: number, stage: string) =>
    `${eventYears} of ${totalYears} seasons saw dry spells exceeding ${days} days during ${stage}.`,
    
  erosionWarning: (eventYears: number, totalYears: number, depthMm: number) =>
    `${eventYears} of ${totalYears} seasons recorded single-day storms exceeding ${depthMm} mm when soil was exposed.`,
    
  droughtYearComparison: (cropA: string, cropB: string, p10A: number, p10B: number) =>
    `In dry seasons (the driest 1 in 10 years), ${cropA} faces an estimated deficit of ${p10A} mm, while ${cropB} reduces the gap to ${p10B} mm.`,
    
  fallbackWarning: () =>
    "Direct satellite radar access is currently unavailable. Displaying regional weather model estimates (NASA POWER, ~50 km grid) bias-corrected with ground stations."
};
```

---

### 7. Comparative Technical Architecture Summary

To guide system integration, the following matrix contrasts the primary rainfall datasets evaluated for the rotation planning engine:

| Attribute | GPM IMERG Final (V07) | NASA POWER (PRECTOTCORR) | CoCoRaHS In-Situ Network |
| :--- | :--- | :--- | :--- |
| **Observation Type** | Multi-satellite active radar + PMW + IR + GPCC gauges | Global Atmospheric Assimilation Model (MERRA-2/GEOS) | Ground-truth direct volumetric manual plastic gauge |
| **Spatial Grid** | $0.1^\circ \times 0.1^\circ$ ($\sim 10\text{ km} \times 10\text{ km}$) | $0.5^\circ \times 0.625^\circ$ ($\sim 50\text{ km} \times 60\text{ km}$) | Point observation ($\sim 100\text{ cm}^2$ aperture) |
| **Temporal Span** | June 2000 – Present | 1981 – Present | 1998 – Present (Coverage varies regionally) |
| **Native Frequency** | 30-minute / Daily accumulation | Daily total | Daily observation (7:00 AM local) |
| **Latency** | 3.5 Months (Final); 14 hr (Late) | 2 to 3 Days | Real-time daily uploads (0 to 24 hr) |
| **Access Auth** | NASA Earthdata Token (OAuth2) | Completely Open (No Auth) | Open REST API / CSV exports |
| **Cloud Endpoint** | Earthdata Harmony / AWS S3 `us-west-2`| LARC REST Point API | CoCoRaHS Web Export API |
| **Primary Strength** | Resolves mesoscale convective systems & high-resolution gradients | 40+ year uninterrupted global baseline, zero auth hurdles | Absolute ground truth; validates sub-pixel convective variance |
| **Primary Risk** | High latency; access blocks when credentials missing | Coarse resolution smears convective cloudburst peaks | Irregular spatial density; volunteer gaps on holidays/weekends |

---

## Conclusion & Implementation Roadmap

For agronomic rotation planning, **GPM IMERG Final Run** represents the scientific gold standard for characterizing satellite-derived rainfall distributions, convective storm recurrence, and phenological dry spells. However, because IMERG Final has a 3.5-month latency and requires Earthdata Cloud authentication, production applications must implement a **tiered resilience architecture**:

1.  **Tier 1 (High-Resolution Baseline):** Use **GPM IMERG Final (V07B)** accessed via Earthdata Harmony or S3 direct access for historical multi-decade ($2000 - \text{present}$) empirical quantile ($P_{10}, P_{50}, P_{90}$) and erosive storm analysis.
2.  **Tier 2 (Operational Near-Real-Time):** Use **GPM IMERG Late Run** ($\sim 14\text{-hour latency}$) for monitoring current growing season progress, dry spell tracking, and field workability.
3.  **Tier 3 (Zero-Auth Fallback):** When Earthdata credentials are absent or remote services are unreachable, seamlessly fall back to **NASA POWER `PRECTOTCORR`**, explicitly updating the UI provenance line to inform the user of the coarser ($50\text{ km}$) spatial baseline.
4.  **Tier 4 (Ground Validation & Calibration):** Where available across North America, query **CoCoRaHS gauge networks** to calculate local sub-pixel variance, ground-truth satellite estimates, and present growers with verified local rain gauge context.

By pairing strict mathematical completeness criteria with empathetic, honest user communication ("historical rainfall around your field" and natural frequency event counts), agronomic software can empower growers and agricultural advisers to make resilient, climate-adapted crop rotation decisions.

---

## Agent 6: ISRIC SoilGrids 2.0 & USDA NRCS SSURGO / WSS
**Specialist Role:** Pedometrics & Soil Database Specialist

# Pedometric Systems Research Report: Global ISRIC SoilGrids 2.0 vs. USDA NRCS SSURGO / Web Soil Survey (WSS)

---

### 1. Database Architecture & Methodologies

Digital soil information systems bridge field-scale pedogenesis and algorithmic decision systems. The two dominant paradigms in modern agricultural geospatial architectures are **Digital Soil Mapping (DSM)** via machine learning (exemplified by ISRIC SoilGrids 2.0) and **Traditional Pedological Soil Surveys** structured as polygon relational databases (exemplified by USDA NRCS SSURGO / Web Soil Survey).

```
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                           SOIL DATA ARCHITECTURES                           │
   └─────────────────────────────────────────────────────────────────────────────┘
           │                                                             │
           ▼                                                             ▼
   ISRIC SoilGrids 2.0 (DSM)                             USDA NRCS SSURGO (Survey)
   ─────────────────────────                             ─────────────────────────
   • Paradigm: SCORPAN spatial prediction                • Paradigm: Soil-landscape catena
   • Engine: Quantile Random Forest (QRF)                • Engine: Expert field mapping & lab pedons
   • Domain: Continuous global raster (250 m)            • Domain: Discrete geographic polygons (US)
   • Data: WoSIS point observations                      • Data: Map Units (mukey)
   • Covariates: ~400 environmental rasters              • Components (cokey) & Horizons (chkey)
   • Output: Probabilistic distributions                 • Output: Tripartite ranges (low, rep, high)
```

#### ISRIC SoilGrids 2.0: Continuous Global Digital Soil Mapping (DSM)
* **Underlying Pedometric Paradigm:** SoilGrids 2.0 is operationalized under the **SCORPAN** model:
  
  $$S = f(s, c, o, r, p, a, n) + e$$
  
  where soil property $S$ is predicted as an empirical function of prior soil observations ($s$), climate ($c$), organisms/vegetation ($o$), relief/topography ($r$), parent material/lithology ($p$), age/time ($a$), and geographic coordinates ($n$), compounded by residual spatial uncertainty ($e$).
* **Spatial Resolution & Grid System:** 250 m $\times$ 250 m equal-area grid globally (Homolosine projection internally, distributed via WGS84 EPSG:4326 and Web Mercator EPSG:3857).
* **Ground-Truth Calibration Pedons:** Trained against curated soil profile observations from **WoSIS (World Soil Information Service)**. WoSIS provides $\sim 240,000$ georeferenced, quality-controlled, and harmonized soil profiles globally. The distribution is geographically heterogeneous, with dense sampling in North America and Western Europe, but sparse coverage across sub-Saharan Africa, Central Asia, and parts of the Amazon Basin.
* **Environmental Covariates:** Approximately 400 global environmental covariate layers, including:
  * *Climate:* CHELSA and WorldClim precipitation, bioclimatic indices, and MODIS Land Surface Temperature (LST) diurnal cycles and dynamics.
  * *Relief & Geomorphology:* Digital Elevation Models (SRTM, MERIT DEM) producing slope gradient, aspect, Topographic Wetness Index (TWI), Multiresolution Valley Bottom Flatness (MrVBF), and catchment drainage area.
  * *Vegetation & Phenology:* Long-term MODIS/Landsat surface reflectance, Enhanced Vegetation Index (EVI), Normalized Difference Vegetation Index (NDVI) time series, and canopy height metrics.
  * *Parent Material:* Global Lithological Map (GLiM) and gamma-ray radiometrics proxies.
* **Core Machine Learning Engine:** **Quantile Random Forests (QRF)**.
  * Rather than predicting solely the conditional mean $E[Y|X]$, QRF estimates the full conditional cumulative distribution function $F(y|X) = P(Y \le y | X)$.
  * This yields explicit non-parametric prediction intervals: 5th percentile ($Q_{0.05}$), 50th percentile / median ($Q_{0.50}$), 95th percentile ($Q_{0.95}$), and conditional mean.
  * *Validation Strategy:* 10-fold spatial block cross-validation prevents spatial autocorrelation overfitting, ensuring that validation pedons are geographically isolated from training folds.
* **Architectural Strengths:** Wall-to-wall continuous spatial coverage globally; fixed vertical depth discretization matching GlobalSoilMap standards; quantified predictive uncertainty quantiles; automated RESTful queryable API.
* **Inherent Limitations:** Statistical smoothing dampens hyper-local pedological extremes (e.g., micro-swales, localized salinity seeps); cannot resolve sharp soil boundary transitions occurring over tens of meters; lacks awareness of recent on-farm soil management interventions (e.g., lime application, organic matter amendments, deep subsoiling).

---

#### USDA NRCS SSURGO / Web Soil Survey: Field-Delineated Polygon Surveys
* **Underlying Pedometric Paradigm:** Traditional field pedology founded on the **soil-landscape catena concept**. Soil boundaries are delineated by professional soil scientists traversing the landscape, interpreting stereoscopic aerial imagery, drilling auger transects, describing modal pedon pits, and correlating soil properties with geomorphic landforms.
* **Spatial Scale:** County-level surveys published at scales between **1:12,000** (minimum delineable area $\sim 0.25\text{ to }1\text{ ha}$) and **1:63,360** (most commonly **1:24,000**, conforming to USGS 7.5-minute topographic quadrangles).
* **Hierarchical Relational Database Schema (NASIS Data Structure):**
  SSURGO is not a raster. It is a strictly relational spatial database consisting of three fundamental tiers:
  
  ```
  [ Spatial Polygon: Map Unit ] ── (musym / mukey)
            │
            ├── 1:Many (by comppct_r %)
            ▼
  [ Soil Component: Series / Taxon ] ── (cokey, compname, taxclname)
            │
            ├── 1:Many (by horizon depth hzdept_r → hzdepb_r)
            ▼
  [ Soil Horizon: Genetic Layer ] ── (chkey, hzname, textures, physical/chemical attributes)
  ```

  1. **Map Unit (`mapunit` / `mupolygon`):** The spatial polygon layer indexed by `mukey` (Map Unit Key) and `musym` (Map Unit Symbol). Map units represent landscape segments (e.g., "Clarion-Nicollet-Webster complex, 1 to 5 percent slopes").
  2. **Component (`component`):** The non-spatial soil entities within the map unit, joined via `mukey`. Each component is assigned a representative percentage (`comppct_r`) summing to 100% across the map unit. Components define the soil series (e.g., Clarion = 50%, Nicollet = 30%, Webster = 15%, minor inclusions = 5%).
  3. **Horizon (`chorizon`):** The discrete morphological genetic layers within each component (e.g., Ap, Bt1, Bt2, C), joined via `cokey`. Horizons are defined by vertical upper (`hzdept_r`) and lower (`hzdepb_r`) boundaries in centimeters.
* **Tripartite Attribute System:** Soil properties within SSURGO horizons are stored as low (`_l`), representative (`_r`), and high (`_h`) values (e.g., `ph1to1h2o_l = 5.6`, `ph1to1h2o_r = 6.2`, `ph1to1h2o_h = 6.8`). This captures intrinsic soil series variability and analytical measurement dispersion.
* **Architectural Strengths:** High pedological realism within the United States; explicit representation of genetic horizons, root-limiting layers (fragipans, duripans, lithic bedrock contacts), internal drainage classes, hydric ratings, ponding/flooding frequencies, and taxonomic classifications (Soil Taxonomy).
* **Inherent Limitations:** Geographic boundary restricted strictly to the United States and its territories; jurisdictional edge-matching seams across county boundaries where survey vintages or mapping concepts diverge; components are geographically non-spatial within the polygon (the user knows a component covers 30% of the polygon, but cannot locate precisely where inside the polygon it resides without digital soil disaggregation models).

---

### 2. Parameters, Units & Scaling Factors

Soil databases frequently store numerical values as integer types to optimize data compression, storage footprints, and network transfer. Integrating these data sources into agronomic engines requires strict application of layer-specific scaling divisors (`d_factor`).

#### Property Cross-Reference & Scaling Table

| Agronomic Property | SoilGrids 2.0 Code | SoilGrids Raw Unit | SoilGrids `d_factor` | Standard Agronomic Unit | SSURGO Horizon Column | SSURGO Native Unit | Conversion / Harmonization Math |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Clay Fraction** | `clay` | $\text{g/kg}$ | **10** | % (w/w) | `claytotal_r` | % (w/w) | $\text{SoilGrids: } \text{raw} / 10 = \%$<br>$\text{SSURGO: already in } \%$ |
| **Sand Fraction** | `sand` | $\text{g/kg}$ | **10** | % (w/w) | `sandtotal_r` | % (w/w) | $\text{SoilGrids: } \text{raw} / 10 = \%$<br>$\text{SSURGO: already in } \%$ |
| **Silt Fraction** | `silt` | $\text{g/kg}$ | **10** | % (w/w) | `silttotal_r` | % (w/w) | $\text{SoilGrids: } \text{raw} / 10 = \%$<br>$\text{SSURGO: already in } \%$ |
| **pH ($H_2O$)** | `phh2o` | $\text{pH} \times 10$ | **10** | $-\log[H^+]$ | `ph1to1h2o_r` | $-\log[H^+]$ | $\text{SoilGrids: } \text{raw} / 10 = \text{pH}$<br>$\text{SSURGO: direct pH units}$ |
| **Soil Organic Carbon** | `soc` | $\text{dg/kg}$ | **10** (for $\text{g/kg}$)<br>**100** (for %) | $\text{g/kg}$ or % | `om_r` | % SOM (w/w) | $\text{SoilGrids: } \text{raw} / 10 = \text{g/kg}$<br>$\text{raw} / 100 = \%\text{ SOC}$<br>$\text{SSURGO: } \text{SOC} \approx \text{om\_r} / 1.724$ |
| **Bulk Density** | `bdod` | $\text{cg/cm}^3$ | **100** | $\text{g/cm}^3$ ($\text{kg/dm}^3$) | `dbthirdbar_r` | $\text{g/cm}^3$ | $\text{SoilGrids: } \text{raw} / 100 = \text{g/cm}^3$<br>$\text{SSURGO: direct in } \text{g/cm}^3$ |
| **Cation Exch. Cap.** | `cec` | $\text{mmol}_c/\text{kg}$ | **10** | $\text{cmol}_c/\text{kg}$ ($\text{meq}/100\text{g}$) | `cec7_r` | $\text{meq}/100\text{g}$ | $\text{SoilGrids: } \text{raw} / 10 = \text{cmol}_c/\text{kg}$<br>$1\text{ cmol}_c/\text{kg} = 1\text{ meq}/100\text{g}$ |
| **Total Nitrogen** | `nitrogen` | $\text{cg/kg}$ | **100** | $\text{g/kg}$ | N/A | N/A | $\text{SoilGrids: } \text{raw} / 100 = \text{g/kg}$ |
| **Coarse Fragments** | `cfvo` | $\text{cm}^3/100\text{cm}^3$ | **10** | % (volumetric) | `fragvol_r` | % (volumetric) | $\text{SoilGrids: } \text{raw} / 10 = \%$ coarse |

#### Vertical Stratification & Depth Tiers

* **ISRIC SoilGrids 2.0 Standard Depths:**
  Discretized across **6 standardized GlobalSoilMap depth tiers**:
  
  $$\text{Tier 1: } 0\text{–}5\text{ cm} \quad (\Delta z_1 = 5\text{ cm})$$
  $$\text{Tier 2: } 5\text{–}15\text{ cm} \quad (\Delta z_2 = 10\text{ cm})$$
  $$\text{Tier 3: } 15\text{–}30\text{ cm} \quad (\Delta z_3 = 15\text{ cm})$$
  $$\text{Tier 4: } 30\text{–}60\text{ cm} \quad (\Delta z_4 = 30\text{ cm})$$
  $$\text{Tier 5: } 60\text{–}100\text{ cm} \quad (\Delta z_5 = 40\text{ cm})$$
  $$\text{Tier 6: } 100\text{–}200\text{ cm} \quad (\Delta z_6 = 100\text{ cm})$$

* **USDA SSURGO Horizons:**
  Vertical discretization is dynamic, governed by natural morphological horizon boundaries (`hzdept_r` to `hzdepb_r`). For instance, a profile might exhibit:
  * Ap: 0 to 18 cm
  * BA: 18 to 32 cm
  * Bt1: 32 to 65 cm
  * Bt2: 65 to 110 cm
  * C: 110 to 180 cm

---

### 3. Aggregation & Root-Zone Soil Processing

Agronomic models require standardized vertical integration over specific diagnostic zones, most notably the **0–30 cm arable plow layer** (controlling germination, seedling establishment, and immediate nutrient uptake) and the **full crop rooting depth** (typically 0–100 cm or 0–120 cm for annual field crops).

#### Depth-Weighted Mathematical Averaging (0–30 cm Plow Layer)

For any continuous soil property function $P(z)$ across an arbitrary vertical interval $[Z_{top}, Z_{bottom}]$, the integrated depth-weighted mean is defined as:

$$\bar{P}_{[Z_{top}, Z_{bottom}]} = \frac{\int_{Z_{top}}^{Z_{bottom}} P(z)\,dz}{Z_{bottom} - Z_{top}}$$

##### ISRIC SoilGrids Implementation (0–30 cm)
In the discretized SoilGrids framework, the 0–30 cm plow layer encompasses exactly the first three depth tiers:
* Tier 1: $0\text{–}5\text{ cm}$ ($\Delta z_1 = 5\text{ cm}$)
* Tier 2: $5\text{–}15\text{ cm}$ ($\Delta z_2 = 10\text{ cm}$)
* Tier 3: $15\text{–}30\text{ cm}$ ($\Delta z_3 = 15\text{ cm}$)

The aggregated value $\bar{P}_{0-30}$ is calculated via discrete thickness weighting:

$$\bar{P}_{0-30} = \frac{\sum_{k=1}^{3} \left( \frac{\text{val}_k}{d\_factor_k} \right) \cdot \Delta z_k}{\sum_{k=1}^{3} \Delta z_k} = \frac{5 \cdot P_{0-5} + 10 \cdot P_{5-15} + 15 \cdot P_{15-30}}{30}$$

This yields the exact discrete weighting coefficients:
* $w_{0-5} = \frac{5}{30} = \frac{1}{6} \approx 16.67\%$
* $w_{5-15} = \frac{10}{30} = \frac{2}{6} \approx 33.33\%$
* $w_{15-30} = \frac{15}{30} = \frac{3}{6} = 50.00\%$

```
 Depth (cm)   Layer Thickness     Normalized Weight
 0 ──────────────┬───────────────  16.67% (w₁ = 5/30)
                 │  Δz₁ = 5 cm
 5 ──────────────┼───────────────  33.33% (w₂ = 10/30)
                 │  Δz₂ = 10 cm
15 ──────────────┼───────────────  50.00% (w₃ = 15/30)
                 │  Δz₃ = 15 cm
30 ──────────────┴───────────────
```

##### USDA SSURGO Horizon Truncation & Integration
Because SSURGO horizon boundaries do not coincide with fixed target depths, each horizon $i$ must be clipped to the intersection with $[Z_{top}, Z_{bottom}]$. The effective thickness $h_{eff, i}$ for horizon $i$ bounded by $[hzdept_i, hzdepb_i]$ is:

$$h_{eff, i} = \max\left(0, \; \min(hzdepb_i, Z_{bottom}) - \max(hzdept_i, Z_{top})\right)$$

The component-level depth-weighted mean $\bar{P}_{comp}$ across all intersected horizons is:

$$\bar{P}_{comp} = \frac{\sum_{i=1}^{H} P_i \cdot h_{eff, i}}{\sum_{i=1}^{H} h_{eff, i}}$$

To aggregate across the entire map unit containing components $j = 1, \dots, M$, area-weighting is performed using the component representative percentages (`comppct_r`):

$$\bar{P}_{mapunit} = \frac{\sum_{j=1}^{M} comppct_j \cdot \bar{P}_{comp, j}}{\sum_{j=1}^{M} comppct_j}$$

#### Hydrophysical Property Derivation (Pedotransfer Functions)

Gridded databases supply texture and carbon, but crop models require hydrological capacity: **Field Capacity ($\theta_{FC}$ at $-33\text{ kPa}$)**, **Permanent Wilting Point ($\theta_{WP}$ at $-1500\text{ kPa}$)**, and **Available Water Capacity (AWC)**.

Using validated pedotransfer formulations (e.g., Saxton & Rawls, 2006):

$$\theta_{1500} = -0.02 + 0.114 \cdot S_{clay} + 0.057 \cdot S_{OM} + \dots$$
$$\theta_{33} = \theta_{1500} + 0.14 \cdot S_{sand} + 0.07 \cdot S_{clay} + \dots$$
$$\text{AWC} = \theta_{33} - \theta_{1500} \quad (\text{expressed as } \text{cm}^3/\text{cm}^3)$$

Total Available Water ($TAW$, in mm) across root zone depth $Z_r$:

$$TAW = 10 \cdot \sum_{k=1}^{K} \text{AWC}_k \cdot \Delta z_k \cdot \left(1 - \frac{cfvo_k}{100}\right)$$

where coarse rock fragments ($cfvo$, %) act as zero-capacity volumetric diluents.

#### Handling Missing and Null Values: The Non-Zero Rule

1. **Non-Soil Surfaces:** Urban cores, paved transport networks, inland open water bodies, bare rock outcrops, and permanent snow/ice yield `null` across all property channels in SoilGrids 2.0. Similarly, SSURGO assigns these to non-soil miscellaneous land types (`Urban land`, `Water`, `Pits, quarries`) lacking horizon records.
2. **THE SACROSANCT NON-ZERO LAW:**
   $$\mathbf{null} 
e 0.0$$
   * A coerced value of $\text{pH} = 0.0$ signifies $1\text{ M}$ hydronium solution (battery acid), precipitating instant fatal toxicity in crop simulation models.
   * A coerced value of $\text{clay} = 0.0$, $\text{sand} = 0.0$, $\text{silt} = 0.0$ obliterates the physical soil matrix ($0\% 
e 100\%$).
   * A coerced value of $\text{SOC} = 0.0$ models an abiotic lunar regolith.
   * A coerced value of $\text{bulk density} = 0.0$ implies zero mass per volume (a physical vacuum).
3. **Missing Value Propagation Protocol:**
   * If all layers in a query interval return `null`, the aggregate root-zone profile status is strictly `null` (unmapped / non-soil).
   * If a soil profile is shallow (e.g., lithic contact at 20 cm, resulting in null values for Tier 3, 4, 5, 6), depth-weighted averaging must be calculated over the **valid thickness only**:
     
     $$\bar{P} = \frac{\sum_{k \in \text{valid}} P_k \cdot \Delta z_k}{\sum_{k \in \text{valid}} \Delta z_k}$$
     
     The valid denominator must be preserved and reported (e.g., "Calculated over 0–20 cm; bedrock encountered at 20 cm").
   * If the valid integrated thickness falls below a defensible threshold (e.g., $< 15\text{ cm}$ within the 0–30 cm zone), the property must be flagged as `DATA_INSUFFICIENT`, preventing automated crop suitability scoring and prompting the user for manual soil inputs.

---

### 4. API Endpoints & Retrieval Pipelines

Both data sources provide programmatic web service interfaces requiring distinct retrieval patterns and error-handling architectures.

#### ISRIC SoilGrids 2.0 RESTful API

* **Endpoint URL:** `https://rest.isric.org/soilgrids/v2.0/properties/query`
* **Protocol & Parameters:**
  * `lon`, `lat`: Point coordinates in WGS84 decimal degrees (formatted to 5 decimal places).
  * `property`: Repeated parameters for each requested layer: `clay`, `sand`, `silt`, `phh2o`, `soc`, `cec`, `bdod`, `nitrogen`.
  * `depth`: Repeated depth tiers: `0-5cm`, `5-15cm`, `15-30cm`, `30-60cm`, `60-100cm`, `100-200cm`.
  * `value`: Statistical distribution parameters: `mean`, `Q0.05`, `Q0.5`, `Q0.95`, `uncertainty`.

##### Production URL Construction (TypeScript)
```typescript
export function buildSoilGridsUrl(lat: number, lon: number): string {
  const url = new URL("https://rest.isric.org/soilgrids/v2.0/properties/query");
  url.searchParams.set("lon", lon.toFixed(5));
  url.searchParams.set("lat", lat.toFixed(5));
  
  const properties = ["clay", "sand", "silt", "phh2o", "soc", "cec", "bdod", "nitrogen"];
  const depths = ["0-5cm", "5-15cm", "15-30cm"];
  
  properties.forEach(p => url.searchParams.append("property", p));
  depths.forEach(d => url.searchParams.append("depth", d));
  url.searchParams.set("value", "mean");
  
  return url.toString();
}
```

##### Latency, Rate Limits & Cloud-Optimized GeoTIFFs (COG)
* **Latency Profile:** An 8-property, 3-depth REST query routinely requires **3.5 to 14.0 seconds**. Point queries in urban or coastal transition zones may exhibit latency spikes before returning null.
* **Resilience Pattern:** Server-side fetch architecture wrapping the request in an `AbortSignal.timeout(25000)` with aggressive caching keyed by the 250 m raster cell index.
* **High-Throughput Alternative:** For batch polygon operations, querying the REST API point-by-point is anti-pattern. Systems should stream windowed subsets directly from ISRIC's public **Cloud-Optimized GeoTIFF (COG)** WebDAV / AWS S3 buckets using GDAL / `rasterio` spatial window reads.

---

#### USDA Soil Data Access (SDA) REST / SQL Endpoint

* **Endpoint URL:** `https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest.json`
* **Query Mechanism:** SDA accepts raw, parameterized T-SQL queries sent via HTTP POST payloads directly targeting the live Soil Data Mart relational engine.
* **Spatial Intersection:** Utilizes Microsoft SQL Server spatial geometry functions (`geometry::STGeomFromText`).

##### Production SDA Query for 0–30 cm Horizon Aggregation
```sql
SELECT 
    mu.mukey,
    mu.musym,
    mu.muname,
    c.cokey,
    c.compname,
    c.comppct_r,
    ch.chkey,
    ch.hzname,
    ch.hzdept_r,
    ch.hzdepb_r,
    -- Physical and chemical properties
    ch.claytotal_r,
    ch.sandtotal_r,
    ch.silttotal_r,
    ch.ph1to1h2o_r,
    ch.om_r,
    ch.dbthirdbar_r,
    ch.cec7_r,
    ch.awc_r
FROM mupolygon mp
INNER JOIN mapunit mu ON mp.mukey = mu.mukey
INNER JOIN component c ON mu.mukey = c.mukey
INNER JOIN chorizon ch ON c.cokey = ch.cokey
WHERE mp.mupolygongeo.STIntersects(
    geometry::STGeomFromText('POLYGON((-93.655 42.025, -93.645 42.025, -93.645 42.035, -93.655 42.035, -93.655 42.025))', 4326)
) = 1
AND c.majcompflag = 'Yes'
AND ch.hzdept_r < 30
ORDER BY mu.mukey, c.comppct_r DESC, ch.hzdept_r ASC;
```

#### Pipeline Comparison Matrix

| Architectural Feature | ISRIC SoilGrids 2.0 API | USDA NRCS Soil Data Access (SDA) |
| :--- | :--- | :--- |
| **Interface Style** | RESTful JSON point query / OGC WCS | HTTP POST submitting raw T-SQL queries |
| **Query Mechanism** | Coordinates (`lat`, `lon`, `properties`, `depths`) | Spatial SQL intersection (`STIntersects`) |
| **Response Payload** | Nested JSON hierarchy of layers and quantiles | Tabular JSON array of relational recordsets |
| **Spatial Scope** | Global ($82^\circ\text{N}$ to $58^\circ\text{S}$) | United States & Associated Territories |
| **Spatial Output** | Cell-interpolated estimate | Map unit polygon with component splits |
| **Average Latency** | High ($3\text{–}14\text{ s}$ per point request) | Low to Moderate ($0.4\text{–}2.5\text{ s}$) |
| **Authentication** | Open access / No API key required | Open access / No API key required |
| **Data Vintage** | Version 2.0 snapshot (released 2020) | Continuous live maintenance by NRCS MLRA offices |

---

### 5. Rotation Engine Suitability & The Farmer Override Rule

#### Agronomic Soil Suitability Criteria

Crop rotation optimization models evaluate whether candidate crops match field soil constraints. Two primary parameters govern physical and chemical suitability: **soil pH response functions** and **soil texture class compatibility**.

##### 1. Soil pH Suitability Tiering
Crops do not respond linearly to pH. Instead, crop performance follows a tripartite step function defined by four cardinal thresholds: $[pH_{min}, \; pH_{opt\_low}, \; pH_{opt\_high}, \; pH_{max}]$.

```
Relative Yield / Suitability
 100% ─────────────┌───────────────────────┐
                   │   PREFERRED RANGE     │
                   │  [pH_opt_low, high]   │
  50% ─────┬───────┘                       └───────┬─────
           │ TOLERATED                     TOLERATED
           │ [pH_min, opt_low)             (opt_high, max]
   0% ─────┴───────────────────────────────────────┴─────
         pH_min                                  pH_max
```

* **Preferred (Optimal) Range:** $pH \in [pH_{opt\_low}, \; pH_{opt\_high}]$. Maximum nutrient bioavailability (N, P, K, Ca, Mg); minimal toxic monomeric aluminum ($Al^{3+}$) and manganese ($Mn^{2+}$); optimal rhizobia nodulation in legumes.
* **Tolerated (Sub-Optimal) Range:** $pH \in [pH_{min}, \; pH_{opt\_low}) \cup (pH_{opt\_high}, \; pH_{max}]$. Crop survives and produces moderate yield, but exhibits stress (e.g., phosphorus fixation, micronutrient chlorosis). Requires an agronomic caution flag.
* **Unsuitable (Critical Exclusion):** $pH < pH_{min}$ or $pH > pH_{max}$. Triggers immediate rotation engine disqualification or severe risk penalty.
* **Missing Value Rule:** If $pH$ is `null`, suitability is **`UNKNOWN`**. It must never default to "poor" or "average."

###### Exemplar Cardinal Thresholds (Agrometeorological & Pedometric Standard)
* *Maize (Zea mays):* $pH_{min} = 5.5, \; pH_{opt} = [6.0, \; 7.2], \; pH_{max} = 8.0$
* *Soybean (Glycine max):* $pH_{min} = 5.8, \; pH_{opt} = [6.2, \; 7.0], \; pH_{max} = 7.8$
* *Alfalfa (Medicago sativa):* $pH_{min} = 6.2, \; pH_{opt} = [6.8, \; 7.5], \; pH_{max} = 8.2$ (highly sensitive to acidity)
* *Potato (Solanum tuberosum):* $pH_{min} = 4.8, \; pH_{opt} = [5.2, \; 6.5], \; pH_{max} = 7.5$ (favors acid to suppress *Streptomyces scabies*)

##### 2. Soil Texture Triangle & Physical Compatibility
Textural suitability is evaluated by mapping sand, silt, and clay percentages into the **12 USDA Textural Classes** via standard ternary logic:

```typescript
export function determineUsdaTexture(sand: number, silt: number, clay: number): TextureClass {
  if (silt + 1.5 * clay < 15) return "sand";
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return "loamy sand";
  if ((clay >= 7 && clay < 20 && sand > 52 && silt + 2 * clay >= 30) ||
      (clay < 7 && silt < 50 && silt + 2 * clay >= 30)) return "sandy loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "loam";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return "silt loam";
  if (silt >= 80 && clay < 12) return "silt";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "sandy clay loam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "clay loam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "silty clay loam";
  if (clay >= 35 && sand > 45) return "sandy clay";
  if (clay >= 40 && silt >= 40) return "silty clay";
  if (clay >= 40 && sand <= 45 && silt < 40) return "clay";
  return "loam";
}
```

* **Agronomic Affinity Mapping:**
  * *Root and Tuber Crops (Groundnut, Potato, Carrot):* Mechanically restricted in fine-textured soils (`clay`, `silty clay`). Require loose, well-aerated coarse-to-medium textures (`sandy loam`, `loamy sand`, `loam`) to permit underground expansion, minimize pegging resistance, and avoid harvesting losses.
  * *Paddy Rice (Oryza sativa):* Requires low saturated hydraulic conductivity ($K_{sat}$) to sustain standing water; heavy `clay` or `silty clay` layers are preferred.
  * *High-Biomass Cereals:* Well-adapted across medium to heavy loams, but face acute drought risk in coarse `sand` under rainfed regimes.

---

#### THE SACROSANCT RULE: Precedence of Farmer Soil Tests

##### Agronomic & Pedometric Rationale
Gridded DSM models (SoilGrids) and generalized map units (SSURGO) estimate static, baseline landscape conditions. They are fundamentally incapable of observing:
1. **Recent Chemical Amelioration:** Agricultural limestone ($CaCO_3$) or gypsum ($CaSO_4$) applied within the past 1–3 years, which can elevate a soil from native pH 5.2 to managed pH 6.6.
2. **Organic Carbon Accumulation:** Long-term cover cropping, compost applications, or conservation tillage elevating topsoil organic matter well above regional modal benchmarks.
3. **Artificial Subsurface Drainage:** Installation of pattern tile drainage systems, converting an otherwise poorly drained soil into an aerated root zone.

##### Software Architecture & Priority Hierarchy
To eliminate agronomic misrecommendations, software systems must implement an unyielding **4-Tier Priority Cascade**:

$$\text{Active Soil State} = \begin{cases} 
\mathbf{Tier\ 1:\ Farmer\ Lab\ Soil\ Test} & \text{if entered (Absolute precedence; overrides all priors)} \\ 
\mathbf{Tier\ 2:\ USDA\ SSURGO\ Component} & \text{if within USA domain \& valid polygon intersected} \\ 
\mathbf{Tier\ 3:\ ISRIC\ SoilGrids\ 2.0} & \text{if global / fallback gridded prediction} \\ 
\mathbf{Tier\ 4:\ Unmapped / Manual Prompt} & \text{if database queries return null} 
\end{cases}$$

```
                      ┌────────────────────────────┐
                      │    FIELD EVALUATION RUN    │
                      └─────────────┬──────────────┘
                                    │
                                    ▼
                      /────────────────────────────\
                     <  Farmer Soil Test Present?   >
                      \────────────────────────────/
                               │              │
                        YES    │              │ NO
                               ▼              ▼
                     ┌──────────────────┐   /──────────────────────\
                     │ TIER 1: OVERRIDE │  <   Location Inside US?  >
                     │ Use Lab Test     │   \──────────────────────/
                     │ (Confidence: Lab)│     │                 │
                     └──────────────────┘ YES │                 │ NO
                                              ▼                 ▼
                                    ┌──────────────────┐ ┌──────────────────┐
                                    │ TIER 2: SSURGO   │ │ TIER 3: SOILGRIDS│
                                    │ Use Survey Mukey │ │ Use 250m Raster  │
                                    │ (Confidence: High│ │ (Confidence: Med)│
                                    └──────────────────┘ └──────────────────┘
```

##### Immutability & Recomputation Invariants
* **Non-Destructive Storage:** Farmer inputs must **never mutate or overwrite** cached raw SoilGrids or SSURGO payloads. The database keeps the raw environmental prior intact while the application state binds to the active override.
* **Audit Trail Schema:** The override object maintains complete provenance:
  ```typescript
  interface SoilOverride {
    ph?: number;                  // e.g. 6.4 (lab calibrated)
    texture?: TextureClass;        // e.g. "silt loam"
    ocPct?: number;                // Organic carbon % (w/w)
    testedOn: string;              // ISO-8601 date, e.g. "2025-10-14"
    labName?: string;              // e.g. "Midwest Laboratories"
    samplingMethod?: "composite_core" | "zone" | "grid";
  }
  ```
* **Reactive Cache Invalidation:** Injecting or updating a `SoilOverride` triggers instant cache invalidation of dependent agronomic evaluation structures, forcing re-execution of crop suitability checks, nitrogen balances, and water stress models.

---

### 6. Farmer Evidence Display Guidelines

Interface presentation must prevent false precision, communicate spatial uncertainty honestly, and clearly separate hard laboratory evidence from algorithmic predictions.

#### Provenance Separation & UI Copy Standards

Never display an ambiguous label such as "Soil pH: 6.2". Always disclose the data pedigree, spatial scale, and method tier:

* **When Displaying Farmer Soil Tests:**
  * Primary Label: **Your Local Soil Test**
  * Badge: `Lab Verified` (Color: Leaf Green)
  * Metadata Line: `"Composite field sample • Tested on Oct 14, 2025 (Midwest Labs)"`
  * Explanatory Copy: *"This field-collected lab sample supersedes regional satellite and soil survey models."*
* **When Displaying SoilGrids Estimates:**
  * Primary Label: **250m Gridded Soil Estimate**
  * Badge: `Satellite / Model Estimate` (Color: Slate / Neutral)
  * Metadata Line: `"ISRIC SoilGrids v2.0 • 250 m regional grid • 0–30 cm plow layer"`
  * Explanatory Copy: *"Estimated from global machine learning models and satellite terrain covariates. Local field conditions, recent lime applications, and localized management are not reflected."*
* **When Displaying USDA SSURGO Data:**
  * Primary Label: **County Soil Survey (NRCS SSURGO)**
  * Badge: `Field Survey Map Unit` (Color: Deep Navy)
  * Metadata Line: `"USDA NRCS • Clarion-Nicollet Complex (1:24,000) • 0–30 cm weighted mean"`

---

#### Error Bounds & Confidence Interval Presentation

Because SoilGrids 2.0 uses Quantile Random Forests, soil property estimates are continuous probability distributions. Interfaces must display the **10th–90th percentile prediction intervals** (derived from $Q_{0.05}$ to $Q_{0.95}$ or $Q_{0.10}$ to $Q_{0.90}$), visualizing prediction uncertainty against crop suitability thresholds.

##### Textual Pattern
> **Estimated Topsoil pH: 6.2**  
> `Likely range: 5.6 to 6.8 (10th–90th percentile)`  
> *Note: 80% of model estimates in similar landscape positions fall within this bracket.*

##### Visual Range Bar Architecture
```
 Soil pH Scale: 4.0 ──────── 5.5 ──────── 6.5 ──────── 7.5 ──────── 9.0
 
 Crop Optimum:              [═════════════════════] (Maize: 6.0 - 7.2)
 
 SoilGrids Estimate:             ├────────●────────┤
                                5.6      6.2      6.8
                               (Q10)   (Median)  (Q90)
 
 Status: MARGINAL CONFIDENCE (Confidence interval spans optimal and acid-stressed ranges)
 Recommendation: "Your estimated median pH fits maize, but local acidity may occur. Perform a field test before liming."
```

```
 Soil pH Scale: 4.0 ──────── 5.5 ──────── 6.5 ──────── 7.5 ──────── 9.0
 
 Farmer Lab Test:                         ●
                                         6.6 (Tested Oct 2025)
 
 Status: VERIFIED OPTIMAL (Direct laboratory measurement supersedes gridded bounds)
```

##### Decision-Support Rules Derived from Prediction Intervals
1. **Narrow Interval Within Optimal Zone:**
   If $[Q_{10}, \; Q_{90}] \subseteq [pH_{opt\_low}, \; pH_{opt\_high}]$, mark crop suitability as **High Confidence Fit**.
2. **Interval Straddling Sub-Optimal Boundaries:**
   If the median $Q_{50}$ is within the optimal zone, but $Q_{10} < pH_{min}$ or $Q_{90} > pH_{max}$, mark crop suitability as **Moderate Fit / Risk of Local Stress**. Display a prominent action chip: *"Potential localized soil acidity; verify with a field test before planting."*
3. **No-Data State Handling:**
   If SoilGrids returns null (urban, rock, water) and no farmer override exists:
   * Title: **No Soil Survey Data Available for This Location**
   * Action: Provide a simple, 2-step inline form: *"Enter your soil test pH and texture class to enable crop rotation analysis."*
   * System State: Disable automated soil scoring; do not block climate or satellite vegetation modules.

---

### 7. Comparative Architecture Summary

| Architectural Dimension | ISRIC SoilGrids 2.0 | USDA NRCS SSURGO / WSS | On-Farm Soil Test (Farmer Override) |
| :--- | :--- | :--- | :--- |
| **Spatial Extent** | Global landmass | United States and territories only | Single field boundary / management zone |
| **Spatial Resolution** | 250 m continuous raster grid | 1:12,000 to 1:63,360 scale polygon map units | Point core composite ($1\text{–}5\text{ ha}$ representation) |
| **Data Generation Engine** | Quantile Random Forests on $\sim 400$ covariates | Field mapping, augering, and pedological catenas | Wet chemistry / spectroscopy lab analysis |
| **Vertical Representation** | 6 fixed GlobalSoilMap depth tiers (cm) | Natural pedological genetic horizons (Ap, Bt, C) | User-defined plow layer (typically 0–15 or 0–30 cm) |
| **Uncertainty Characterization** | Non-parametric quantiles ($Q_{0.05}, Q_{0.5}, Q_{0.95}$) | Parameter ranges (`_l`, `_r`, `_h`) | Analytical margin of error ($\pm 0.1\text{ pH}$) |
| **Dynamic Response to Management** | Static / Insensitive to recent management | Static / Multi-decade survey updates | **Direct, immediate reflection of management** |
| **System Priority Level** | **Tier 3** (Global fallback) | **Tier 2** (US baseline prior) | **Tier 1 (SACROSANCT OVERRIDE)** |

This architecture ensures that digital farming decision systems maintain pedometric integrity: utilizing global and national soil inventories where observations are absent, while yielding to direct farmer measurements whenever ground-truth evidence is available.

---

## Agent 7: Digital Elevation Models: SRTM, NASADEM & Copernicus GLO-30
**Specialist Role:** Topography & Soil Conservation Specialist

# Global Digital Elevation Models for Agricultural Terrain and Erosion Exposure Analysis
**Technical Research Report & Engineering Architecture**  
*Prepared by Geomorphology & Digital Elevation Model (DEM) Specialists for Agricultural Decision Support Engines*

---

## Executive Summary

Topographic structure is the foundational physical control governing field hydrology, soil moisture redistribution, kinetic runoff energy, and mechanical erosion detachment. In agricultural decision-support systems and crop rotation planners, integrating high-accuracy Digital Elevation Models (DEMs) enables field-scale characterization of runoff pathways, topographic wetness, and soil erosion risk.

This report delivers an exhaustive technical profile of global and national DEM datasets (SRTM v3, NASADEM, Copernicus DEM GLO-30, and USGS 3DEP), details the mathematical derivations of critical terrain derivatives (projected finite-difference slope, Topographic Wetness Index, and the RUSLE topographic factor $LS$), presents cloud-native data ingestion pipelines, details rotation-engine coupling mechanisms with crop canopy dynamics, highlights radar surface limitations (DSM vs. DTM), and defines farmer evidence display guidelines aligned with the calm, field-readable "Field Almanac" design system.

---

### 1. Dataset Profiles & Characteristics

Digital elevation models for terrain analysis fall into two primary physics categories: **Interferometric Synthetic Aperture Radar (InSAR)** and **Light Detection and Ranging (LiDAR)**. Selecting an appropriate model requires evaluating radar wavelength penetration, orbital geometry, ground sampling distance (GSD), vertical datums, void-fill provenance, and vertical accuracy (Linear Error at 90% confidence, $LE90$, and Root Mean Square Error, $RMSE$).

```
+---------------------------------------------------------------------------------------------------------+
|                                     GLOBAL & CONTINENTAL DEM LANDSCAPE                                   |
+------------------------------------+------------------------------------+-------------------------------+
| Radar InSAR (Global C-Band / X-Band)| Spaceborne LiDAR Control Profilers | Airborne LiDAR (National/Bare)|
| - SRTM v3 (30m, 60°N–56°S, EGM96)  | - ICESat GLAS (1064nm, 70m footprint)| - USGS 3DEP (1m–10m Bare DTM, |
| - NASADEM (30m, Reprocessed C/X)   | - ICESat-2 ATLAS (532nm, 11m spot) |   CONUS/HI/AK, NAVD88)        |
| - Copernicus GLO-30 (30m, Global)  |   (Used to calibrate & void-fill)  |   (Sub-decimeter accuracy)    |
+------------------------------------+------------------------------------+-------------------------------+
```

#### Detailed Dataset Comparison Matrix

| Specification | SRTM v3 (SRTM Plus) | NASADEM Global HGT | Copernicus DEM (GLO-30) | USGS 3DEP (Seamless) |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Sensor** | Spaceborne C-band InSAR (SIR-C) | Reprocessed C-band & X-band InSAR | TanDEM-X / TerraSAR-X X-band InSAR | Airborne Multi-Return LiDAR (Pulsed) |
| **Platform** | Space Shuttle *Endeavour* (STS-99) | Reprocessed STS-99 Telemetry | TanDEM-X Formation Flying Satellites | Fixed-wing Aircraft Platforms |
| **Wavelength / Freq.** | C-band (5.3 GHz, $\lambda = 5.6\text{ cm}$) | C-band ($5.3\text{ GHz}$) + X-band ($9.6\text{ GHz}$) | X-band (9.6 GHz, $\lambda = 3.1\text{ cm}$) | Near-Infrared ($\lambda \approx 1064\text{ nm}$ / $1.06\ \mu\text{m}$) |
| **Grid Resolution** | 1 arc-second ($\approx 30\text{ m}$ at equator) | 1 arc-second ($\approx 30\text{ m}$ at equator) | 1 arc-second ($\approx 30\text{ m}$ at equator) | $1\text{ m}$, $1/9\text{ arc-sec } (\approx 3\text{ m})$, $1/3\text{ arc-sec } (\approx 10\text{ m})$ |
| **Coverage Extent** | $60^\circ\text{N}$ to $56^\circ\text{S}$ (80% global land) | $60^\circ\text{N}$ to $56^\circ\text{S}$ (80% global land) | $90^\circ\text{N}$ to $90^\circ\text{S}$ (100% Global) | Contiguous US, Hawaii, US Territories, Alaska |
| **Horizontal Datum** | WGS84 (EPSG:4326) | WGS84 (EPSG:4326) | WGS84 (EPSG:4326) | NAD83 (2011) / WGS84 UTM |
| **Vertical Datum** | EGM96 Geoid Orthometric Height | EGM96 Geoid Orthometric Height | EGM2008 Geoid Orthometric Height | NAVD88 (GEOID12B / GEOID18) |
| **Vertical Accuracy** | $LE90 \le 16\text{ m}$ (Global absolute) | $LE90 \approx 6\text{–}10\text{ m}$; $RMSE \approx 4\text{–}6\text{ m}$ | $LE90 < 4\text{ m}$ ($RMSE \approx 1.5\text{–}2.5\text{ m}$) | QL2: $RMSE_z \le 10\text{ cm}$, $LE90 \le 19.6\text{ cm}$ |
| **Surface Class** | Digital Surface Model (DSM) | Digital Surface Model (DSM) | Digital Surface Model (DSM, Hydro-flat) | Bare-Earth Digital Terrain Model (DTM) |
| **Void Status** | Filled with ASTER GDEM2 & USGS NED | Systematically void-filled (GLAS/ASTER) | Void-free (multi-pass TanDEM-X stack) | Void-free bare ground surface |
| **License / Access** | Public Domain / NASA LP DAAC | Public Domain / NASA LP DAAC | Open Access (GLO-30 Public), AWS S3 | Public Domain / USGS 3DEP Open Data |

---

#### 1.1 SRTM v3 (Shuttle Radar Topography Mission "SRTM Plus")
* **Sensor Architecture & Acquisition:** Acquired over 11 days in February 2000 aboard Space Shuttle *Endeavour* (STS-99). Utilized a single-pass InSAR system composed of a main antenna inside the shuttle payload bay and a secondary receiving antenna deployed at the tip of a 60-meter carbon-fiber deployable mast.
* **Frequency & Penetration:** Operates at C-band ($5.3\text{ GHz}, \lambda \approx 5.6\text{ cm}$). C-band microwaves interact with vegetative canopies, backscattering predominantly from leafy crowns, branches, and upper biomass rather than bare ground.
* **Coverage Limits:** Limited by the shuttle's $57^\circ$ orbital inclination, truncating coverage between $60^\circ\text{N}$ and $56^\circ\text{S}$. High-latitude agricultural regions (e.g., Canadian prairies, central/northern Fennoscandia, northern Eurasia) are completely unmapped.
* **Void Filling in Version 3.0:** Raw SRTM (v1/v2) suffered from severe data voids in mountainous regions and dry sand dunes caused by radar shadow, layover, and low radar backscatter coherence. SRTM v3 (released by NASA JPL in 2014 under the "SRTM Plus" designation) resolved voids using interpolated ASTER GDEM v2 and USGS 30m National Elevation Dataset (NED) data.

#### 1.2 NASADEM
* **Reprocessing Heritage:** Released by NASA JPL in 2020 as a comprehensive modernization of the raw SRTM radar telemetry. Rather than applying post-hoc image-space void patching, NASADEM reprocessed the original raw C-band and X-band radar signal interferograms using the Statistical-cost Network-flow Algorithm for Phase Unwrapping (SNAPHU), coupled with updated spacecraft ephemeris and attitude parameters.
* **Altimetry Ground Control & Calibration:** NASADEM's primary advancement is geodetic vertical control using spaceborne laser altimetry from ICESat's Geoscience Laser Altimeter System (GLAS). GLAS laser profiles (1064 nm, 70m surface footprints spaced at 170m along-track) provided sub-meter absolute vertical control points worldwide.
* **Void Elimination & Coregistration:** Residual phase unwrapping voids were filled by blending modernized ASTER GDEM v3 with local digital elevation datasets (such as PRISM ALOS). Furthermore, the SRTM Water Body Dataset (SWBD) was updated to eliminate spurious lake shorelines and unflattened river profiles.
* **Auxiliary Scientific Layers:** NASADEM provides pixel-matched rasters including radar backscatter power ($\gamma^0$), interferometric correlation ($\gamma$), and canopy-corrected height profiles.

#### 1.3 Copernicus DEM GLO-30
* **Sensor Architecture & Constellation:** Generated by the European Space Agency (ESA) and Airbus Defence and Space from the TanDEM-X and TerraSAR-X radar satellite constellation flying in close helix formation between 2010 and 2015.
* **Frequency & Wavelength:** Operates at X-band ($9.6\text{ GHz}, \lambda \approx 3.1\text{ cm}$). Because X-band has a shorter wavelength than C-band, scattering occurs directly at the uppermost canopy skin and building roofs.
* **Truly Global Coverage:** Provides continuous worldwide coverage from $90^\circ\text{N}$ to $90^\circ\text{S}$, completely eliminating the latitudinal truncations of SRTM and NASADEM. High-latitude agricultural belts are captured under consistent observation geometry.
* **Hydro-Flattening and Editing:** Copernicus DEM features stringent hydro-enforcement: inland water bodies (lakes $\ge 2\text{ ha}$, rivers $\ge 30\text{ m}$ width) are flattened to monotonic downward-sloping surfaces, coastlines are pinned to the mean sea level, and airports are flattened.
* **Vertical Datum & Accuracy:** Referenced to the EGM2008 geoid. Independent validation against ICESat-2 ATLAS spaceborne LiDAR (2018–present) demonstrates an empirical vertical accuracy with an $RMSE$ of $1.5\text{–}2.5\text{ m}$ over open agricultural fields, making GLO-30 the current benchmark global 30m DEM.

#### 1.4 USGS 3DEP (3D Elevation Program)
* **Sensor Architecture & Airborne LiDAR:** The United States Geological Survey (USGS) 3DEP initiative captures high-pulse-density airborne LiDAR across the United States. Systems utilize multi-return pulsed near-infrared lasers ($\approx 1064\text{ nm}$) emitting hundreds of thousands of pulses per second.
* **True Bare-Earth Digital Terrain Model (DTM):** Unlike radar InSAR, pulsed LiDAR penetrates micro-gaps within vegetative canopies. Processing algorithms classify point clouds into vegetation canopy, structural returns, and bare ground (ASPRS Class 2). Generating a surface solely from bare ground returns produces a true DTM that isolates the mineral soil surface from crops, orchards, and windbreaks.
* **Spatial Resolution:** Seamless nationwide grids available at $1\text{ m}$ (where Quality Level 2 [QL2] LiDAR is complete), $1/9\text{ arc-second}$ ($\approx 3\text{ m}$), and $1/3\text{ arc-second}$ ($\approx 10\text{ m}$).
* **Vertical Precision & Hydrologic Significance:** Operates with vertical $RMSE_z \le 10\text{ cm}$ and $LE90 \le 19.6\text{ cm}$. Sub-meter spatial resolution and decimeter vertical accuracy resolve micro-topography: contour terraces, grassed waterways, tillage furrows, tile drain depressions, and rill incisions invisible to 30m satellite rasters.

---

### 2. Terrain Derivatives & Mathematical Formulations

```
+-------------------------------------------------------------------------------------------------+
|                                 TERRAIN PROCESSING PIPELINE                                      |
+-------------------------------------------------------------------------------------------------+
| Input DEM (WGS84 Lon/Lat degrees)                                                               |
|   │                                                                                             |
|   ▼                                                                                             |
| [Reprojection Engine] ──► Bilinear / Bicubic Resampling to Local UTM (Metric Grid: dx = dy)     |
|   │                                                                                             |
|   ├──► [Horn 3x3 Finite Difference Kernel] ──► dz/dx, dz/dy ──► Slope (Radians, Degrees, %)     |
|   │                                                                                             |
|   ├──► [Hydro-Conditioning & Flow Routing] ──► Specific Catchment Area a = A / w               |
|   │                                                                                             |
|   ├──► [Topographic Wetness Index] ──────────► TWI = ln( a / tan(beta) )                        |
|   │                                                                                             |
|   └──► [RUSLE Topographic Factor] ───────────► LS = L(a) * S(beta)                              |
+-------------------------------------------------------------------------------------------------+
```

#### 2.1 Metric Projection Requirement

Computing spatial derivatives directly on unprojected geographic coordinates $(\lambda, \phi)$ in angular degrees introduces mathematical errors that invalidate slope and hydrological calculations.

1. **Latitude vs. Longitude Anisotropy:**  
   While 1 degree of geodetic latitude spans a nearly constant distance along the meridian ($\Delta y \approx 111,132\text{ m}$), 1 degree of longitude scales as a function of the cosine of latitude:
   $$\Delta x(\phi) \approx \frac{\pi \cdot a \cdot \cos\phi}{180 \cdot \sqrt{1 - e^2 \sin^2\phi}} \approx 111,320 \cdot \cos\phi \quad (\text{meters})$$
   At $45^\circ\text{N}$, $\Delta y \approx 111,132\text{ m}$ while $\Delta x \approx 78,847\text{ m}$. At $60^\circ\text{N}$, $\Delta x \approx 55,800\text{ m}$.

2. **Directional Gradient Skew:**  
   Applying a standard isotropic $3 \times 3$ kernel directly to degree coordinates treats $\Delta x = \Delta y$. This distorts east-west elevation changes, overestimating east-west slopes by:
   $$\text{Distortion Factor} = \frac{1}{\cos\phi}$$
   At $45^\circ$ latitude, the east-west gradient is artificially amplified by $+41\%$, rotating the computed aspect vector away from true north-south and generating false topographic divergence.

3. **Reprojection Standard:**  
   Prior to running any finite-difference derivative, the raster bounding box must be reprojected to a conformal or equal-area planar coordinate reference system with equal metric spacing ($\Delta x = \Delta y = d$, in meters).
   * **Target CRS:** Local Universal Transverse Mercator (UTM) Zone (e.g., `EPSG:326XX` for Northern Hemisphere, `EPSG:327XX` for Southern Hemisphere) or regional Albers Equal Area Conic.
   * **Resampling Filter:** Bilinear interpolation (`bilinear`) or cubic convolution (`cubic`). **Never use Nearest Neighbor (`near`)**, as nearest-neighbor resampling creates artificial elevation steps ("stair-stepping") that yield spurious $0^\circ$ flat steps bordered by artificial spikes of extreme slope.

---

#### 2.2 Slope Calculation Formulation

On a regular metric raster grid with cell dimensions $\Delta x$ and $\Delta y$, slope represents the magnitude of the terrain elevation gradient vector:
$$
abla z = \left( \frac{\partial z}{\partial x}, \frac{\partial z}{\partial y} \right)$$

Consider a $3 \times 3$ elevation window centered at grid cell $z_c$:
$$\begin{bmatrix}
z_{tl} & z_t & z_{tr} \\
z_l    & z_c & z_r    \\
z_{bl} & z_b & z_{br}
\end{bmatrix}$$

##### Finite Difference Algorithms
* **Horn’s Formulation (1981):** Applies an inverse-distance weighting scheme that suppresses high-frequency sensor noise. This is the industrial default in GDAL, GRASS GIS, and ArcGIS:
  $$\frac{\partial z}{\partial x} = \frac{(z_{tr} + 2 z_r + z_{br}) - (z_{tl} + 2 z_l + z_{bl})}{8 \Delta x}$$
  $$\frac{\partial z}{\partial y} = \frac{(z_{tl} + 2 z_t + z_{tr}) - (z_{bl} + 2 z_b + z_{br})}{8 \Delta y}$$

* **Zevenbergen & Thorne Formulation (1987):** Employs a second-order polynomial fitted to the four cardinal neighbors:
  $$\frac{\partial z}{\partial x} = \frac{z_r - z_l}{2 \Delta x}, \qquad \frac{\partial z}{\partial y} = \frac{z_t - z_b}{2 \Delta y}$$
  *(Preferred for high-resolution LiDAR DTMs with low high-frequency noise).*

##### Vector Gradient Magnitude & Angular Conversions
1. **Hypotenuse (Gradient Magnitude):**
   $$\text{hypot}\left(\frac{\partial z}{\partial x}, \frac{\partial z}{\partial y}\right) = \sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}$$

2. **Slope in Radians ($\theta_{\text{rad}}$):**
   $$\theta_{\text{rad}} = \arctan\left(\text{hypot}\left(\frac{\partial z}{\partial x}, \frac{\partial z}{\partial y}\right)\right)$$

3. **Slope in Degrees ($\theta_{\text{deg}}$):**
   $$\theta_{\text{deg}} = \theta_{\text{rad}} \times \frac{180}{\pi}$$

4. **Slope in Percentage ($\text{slope}_{\text{pct}}$ - Rise over Run):**
   $$\text{slope}_{\text{pct}} = \tan(\theta_{\text{rad}}) \times 100\% = \text{hypot}\left(\frac{\partial z}{\partial x}, \frac{\partial z}{\partial y}\right) \times 100\%$$

> [!NOTE]  
> Slope percentage and slope degrees are not linear equivalents. While $\theta_{\text{deg}} = 45^\circ$ equals $\text{slope}_{\text{pct}} = 100\%$, an agricultural slope of $\text{slope}_{\text{pct}} = 10\%$ corresponds to $\theta_{\text{deg}} = \arctan(0.10) \times \frac{180}{\pi} \approx 5.71^\circ$. As slope approaches vertical ($90^\circ$), percentage approaches infinity ($\infty$).

---

#### 2.3 Topographic Wetness Index (TWI)

Developed by Beven and Kirkby (1979) as part of the TOPMODEL hydrologic framework, TWI predicts zones of surface saturation, shallow water table depth, and flow accumulation under steady-state recharge:

$$\text{TWI} = \ln\left( \frac{a}{\tan\beta} \right)$$

##### Variable Definitions & Units
* **$a$ (Specific Catchment Area):** Upslope contributing drainage area ($A$, in $\text{m}^2$) divided by the contour contour width orthogonal to flow direction ($w$, in $\text{m}$):
  $$a = \frac{A}{w} \quad (\text{units: meters, m})$$
  On a square grid cell with spacing $d$, $w \approx d$.
* **$\beta$ (Local Slope Angle):** Slope measured in radians ($\theta_{\text{rad}}$).
* **$\tan\beta$:** The hydraulic gradient under the assumption of kinematic subsurface flow parallel to the surface.

##### Flow Routing Algorithms for Specific Catchment Area ($a$)
1. **D8 (Deterministic 8 - O'Callaghan & Mark, 1984):** Routes all flow to a single neighbor along the steepest gradient. Produces artificial flow lines across planar slopes.
2. **$D\infty$ (D-Infinity - Tarboton, 1997):** Calculates flow direction as a continuous angle on triangular facets, distributing flow between the two downslope raster cells.
3. **Multiple Flow Direction (FD8 - Quinn et al., 1991):** Distributes flow to all downslope neighbors weighted by slope gradient:
   $$f_i = \frac{(\tan\beta_i)^
u}{\sum_j (\tan\beta_j)^
u}$$

##### Boundary Condition & Numerical Stabilization
In flat valley bottoms and depression basins where slope $\beta \to 0$, $\tan\beta \to 0$, causing $\frac{a}{\tan\beta} \to \infty$ and triggering division-by-zero errors. Numerical stability requires clamping the slope angle to a physical minimum threshold:
$$\beta_{\min} = 0.001\text{ rad} \approx 0.057^\circ \quad \implies \quad \text{TWI} = \ln\left( \frac{a}{\max(\tan\beta, \, 0.001)} \right)$$

##### Agronomic Interpretation
* **High TWI ($> 10\text{–}14$):** Flat alluvial valleys, foot-slopes, drainage swales, and concave depressions. Prone to surface ponding, saturated soils, root hypoxia, delayed spring planting windows, and elevated denitrification ($N_2O$ emissions).
* **Low TWI ($< 4\text{–}6$):** Shedding crests, knolls, and steep divergent side-slopes. Characterized by rapid drainage, thin topsoil, low soil organic carbon, and vulnerability to drought stress.

---

#### 2.4 RUSLE Topographic Factor: Slope Length & Steepness ($LS$)

The Revised Universal Soil Loss Equation (RUSLE; Renard et al., 1997) predicts long-term average annual rill and interrill sheet erosion:
$$A = R \cdot K \cdot LS \cdot C \cdot P$$
The topographic factor $LS$ quantifies the combined influence of hillslope length ($L$) and steepness ($S$) normalized against a standard unit plot ($\lambda_0 = 22.13\text{ m}$ [72.6 ft] on a uniform $9\%$ [$\theta_0 = 5.14^\circ$] slope).

##### 2D Distributed Catchment Formulation (Desmet & Govers, 1996)
To model complex, convergent, and divergent agricultural topography from digital elevation grids, Desmet and Govers extended the 1D slope-length theory into a 2D contributing-area formulation:

$$L_{i,j} = \frac{\left( A_{i,j\text{-in}} + D^2 \right)^{m+1} - A_{i,j\text{-in}}^{m+1}}{D^{m+2} \cdot x_{i,j}^m \cdot (22.13)^m}$$

* $A_{i,j\text{-in}}$: Contributing area entering cell $(i,j)$ in $\text{m}^2$.
* $D$: Linear grid cell resolution ($D = \Delta x = \Delta y$ in meters).
* $x_{i,j} = |\sin\alpha_{i,j}| + |\cos\alpha_{i,j}|$, where $\alpha_{i,j}$ is the aspect angle of the cell.
* $m$: Variable slope-length exponent reflecting the ratio of rill erosion (caused by overland flow) to interrill erosion (caused by raindrop splash detachment).

##### Slope-Length Exponent ($m$) Formulation (McCool et al., 1989)
$$m = \frac{\beta}{1 + \beta}$$
$$\beta = \frac{\sin\theta / 0.0896}{3.0 \cdot (\sin\theta)^{0.8} + 0.56}$$
*(On typical agricultural soils, $m \approx 0.2$ on slopes $< 1\%$, $m \approx 0.3$ on $1\text{–}3\%$ slopes, $m \approx 0.4$ on $3\text{–}5\%$ slopes, and $m \approx 0.5$ on slopes $\ge 5\%$).*

##### Slope Steepness Factor ($S$) Formulation (McCool et al., 1987)
McCool et al. established a piecewise formulation accounting for the physical threshold where rill erosion accelerates:

$$S = \begin{cases}
10.8 \cdot \sin\theta + 0.03 & \text{for } \text{slope}_{\text{pct}} < 9\% \quad (\theta < 5.14^\circ) \\
16.8 \cdot \sin\theta - 0.50 & \text{for } \text{slope}_{\text{pct}} \ge 9\% \quad (\theta \ge 5.14^\circ)
\end{cases}$$

For continuous modeling across short, steep hillslopes, Nearing (1997) proposed a single logistic formulation:
$$S = -1.5 + \frac{17}{1 + \exp(2.3 - 6.1 \cdot \sin\theta)}$$

##### Simplified Unit Stream Power Approximation (Moore & Burch, 1986)
For rapid raster computation across regional agricultural catchments, Moore and Wilson demonstrated that $LS$ can be derived from unit stream power theory:
$$LS = \left( \frac{a}{22.13} \right)^{0.4} \cdot \left( \frac{\sin\theta}{0.0896} \right)^{1.3}$$
*Where $a$ is specific catchment area ($\text{m}^2/\text{m}$) and $\theta$ is slope in radians.*

---

### 3. Data Access & Ingestion Pipelines

Automating terrain analysis for agricultural fields requires robust pipelines capable of querying cloud-hosted raster repositories without downloading multi-gigabyte regional tiles.

```
+-------------------------------------------------------------------------------------------------+
|                                CLOUD INGESTION ARCHITECTURES                                    |
+-------------------------------+--------------------------------+--------------------------------+
| 1. OpenTopography REST API    | 2. AWS S3 Copernicus GLO-30    | 3. USGS 3DEP Elevation Point   |
| - Boundary BBOX request       | - Cloud-Optimized GeoTIFF      | - REST Point Query Service     |
| - On-the-fly DEM cropping     | - HTTP Range Requests (GET)    | - Field centroid & points      |
| - Returns subset GeoTIFF      | - Zero local disk overhead     | - Instantaneous 1m DTM return  |
+-------------------------------+--------------------------------+--------------------------------+
```

#### 3.1 OpenTopography Global DEM API
OpenTopography provides RESTful endpoints querying DEM bounding boxes, handling mosaic clipping and projection on server clusters.

* **API Endpoint:** `https://portal.opentopography.org/API/globaldem`
* **Supported Dataset Keys:** `COP30` (Copernicus 30m), `NASADEM` (NASADEM Global 1 arc-sec), `SRTMGL1` (SRTM 30m).
* **Query Parameters:** `demtype`, `south`, `north`, `west`, `east`, `outputFormat=GTiff`, `API_Key`.

```bash
# Automated cURL pipeline fetching a Copernicus GLO-30 raster window
curl -X GET "https://portal.opentopography.org/API/globaldem?\
demtype=COP30&\
south=41.9800&north=42.0600&west=-93.6800&east=-93.5800&\
outputFormat=GTiff&\
API_Key=${OPENTOPOGRAPHY_API_KEY}" \
-o "copernicus_ames_field.tif"
```

```python
# Programmatic Python Ingestion using requests & rasterio
import requests
import rasterio
from io import BytesIO

def fetch_opentopo_dem(bbox: dict, api_key: str, demtype: str = "COP30") -> rasterio.io.DatasetReader:
    url = "https://portal.opentopography.org/API/globaldem"
    params = {
        "demtype": demtype,
        "south": bbox["south"],
        "north": bbox["north"],
        "west": bbox["west"],
        "east": bbox["east"],
        "outputFormat": "GTiff",
        "API_Key": api_key
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    # Open GeoTIFF directly from in-memory byte buffer
    memfile = BytesIO(response.content)
    return rasterio.open(memfile)
```

---

#### 3.2 AWS S3 Open Data: Copernicus DEM GLO-30 (Cloud-Optimized GeoTIFF)
Copernicus GLO-30 is hosted on AWS S3 within the Registry of Open Data as Cloud-Optimized GeoTIFFs (COGs). COGs organize raster pixels into internal tiles with HTTP range-request support, enabling clients to read a single field's pixels directly from the cloud without downloading the full $1^\circ \times 1^\circ$ tile.

* **S3 Bucket URI:** `s3://copernicus-dem-30m/`
* **HTTPS Base URL:** `https://copernicus-dem-30m.s3.amazonaws.com/`
* **Tile Naming Convention:**
  `Copernicus_DSM_COG_10_N{LAT}_00_W{LON}_00_DEM/Copernicus_DSM_COG_10_N{LAT}_00_W{LON}_00_DEM.tif`

```python
import rasterio
from rasterio.windows import from_bounds
from rasterio.warp import transform_bounds

def stream_s3_copernicus_dem(lon_min, lat_min, lon_max, lat_max):
    """
    Streams a field window directly from AWS S3 COG via HTTP Range Requests.
    Zero local disk write; sub-second latency.
    """
    # Determine 1x1 degree tile reference
    lat_tile = int(lat_min)
    lon_tile = int(abs(lon_min))
    tile_id = f"Copernicus_DSM_COG_10_N{lat_tile:02d}_00_W{lon_tile:03d}_00_DEM"
    cog_url = f"https://copernicus-dem-30m.s3.amazonaws.com/{tile_id}/{tile_id}.tif"

    # GDAL Virtual File System reading directly over HTTPS
    with rasterio.open(cog_url) as src:
        # Define field window from geodetic bounds
        window = from_bounds(lon_min, lat_min, lon_max, lat_max, transform=src.transform)
        # Read only the subset byte ranges
        elevation_subset = src.read(1, window=window)
        win_transform = src.window_transform(window)
        
    return elevation_subset, win_transform
```

---

#### 3.3 USGS 3DEP Elevation Point Query Service (EPQS)
For fast sampling of field centroids and monitoring points in the United States, the USGS EPQS REST interface provides instantaneous bare-earth elevations extracted from the seamless 3DEP LiDAR layer.

* **REST Endpoint:** `https://epqs.nationalmap.gov/v1/rest/post` (or `GET json`)
* **Endpoint Parameters:** `x` (Longitude), `y` (Latitude), `units` (`Meters` or `Feet`), `output` (`json`).

```bash
# Point elevation query for an agricultural field in Ames, Iowa
curl -X GET "https://epqs.nationalmap.gov/v1/rest/post?x=-93.6450&y=42.0250&units=Meters&output=json"
```

```json
{
  "location": {
    "x": -93.645,
    "y": 42.025
  },
  "elevation": 298.42,
  "unit": "Meters",
  "data_source": "3DEP 1/3 arc-second",
  "attributes": {
    "SpatialReference": "4326"
  }
}
```

---

### 4. Rotation Engine Integration: Soil Conservation & Erosion Exposure

Topography provides the fixed gravitational acceleration governing runoff velocity, but crop canopy cover ($C$) and management practices ($P$) govern actual surface detachment and transport.

```
+-------------------------------------------------------------------------------------------------+
|                                 DYNAMIC EROSION EXPOSURE COUPLING                               |
+-------------------------------------------------------------------------------------------------+
| Physical Terrain Forcing (Fixed)    Dynamic Agronomic Cycle (Seasonal)  Meteorological (POWER)  |
| - Slope Gradient (Degrees & %)   x  - Crop Canopy Cover Fraction (C) x  - Rainfall Erosivity    |
| - Flow Accumulation / LS-Factor     - Bare Soil Exposure Windows          Intensity (EI30)      |
+-------------------------------------------------------------------------------------------------+
                                                 │
                                                 ▼
             CRITICAL EXPOSURE WINDOW IDENTIFICATION & MITIGATION ENGINE
             - Flags coincidence: Slope > 5% + Bare Soil + Convective Storms
             - Recommends: Overwinter Cover Crops, Perennial Leys, Strip Contouring
```

#### 4.1 Slope Classification in Agricultural Decision Support

Agricultural land capability classes (USDA-NRCS) categorize terrain based on runoff velocity, mechanization limits, and structural erosion vulnerability:

| Slope Class | Percent Gradient | Angular Degree Range | Runoff Characteristics & Agronomic Mechanics | Management & Conservation Mandates |
| :--- | :--- | :--- | :--- | :--- |
| **Flat** | $0\text{–}2\%$ | $0^\circ\text{–}1.15^\circ$ | Negligible runoff velocity. High infiltration opportunity. Minimal detachment. High risk of waterlogging, ponding, and surface crusting in low-TWI zones. | Drainage tile management; residue retention to break surface crusting; no mechanical terracing needed. |
| **Gentle** | $2\text{–}5\%$ | $1.15^\circ\text{–}2.86^\circ$ | Sheet flow initiates during high-intensity storms. Low rill detachment energy. Low interrill transport. | Cross-slope farming; standard conservation tillage ($>30\%$ residue cover); balanced crop rotations. |
| **Moderate** | $5\text{–}10\%$ | $2.86^\circ\text{–}5.71^\circ$ | Runoff accelerates. High shear stress. Rill formation accelerates exponentially. High detachment of unprotected topsoil. | Contour strip-cropping; grassed waterways along convergent flow lines; continuous overwinter cover crops. |
| **Steep** | $>10\%$ | $>5.71^\circ$ | High kinetic energy. Severe ephemeral and permanent gully erosion. Incompatible with continuous clean-tilled row crops. | Mandatory perennial forage/pasture leys, agroforestry, structural diversion terraces, or continuous no-till. |

---

#### 4.2 Dynamic Coupling: Slope, Canopy Cover, and Rainfall Erosivity

The rotational planner integrates terrain derivatives with crop phenology to identify vulnerable exposure windows.

1. **The Critical Hazard Window:**  
   Soil erosion does not occur uniformly throughout the year. It occurs when **high-intensity rainfall events** hit a field with **low crop canopy cover** on **steep or moderate slopes**.

2. **Crop Canopy Dynamics ($C$-Factor):**  
   The RUSLE $C$-factor varies from $\approx 0.001$ under dense, undisturbed perennial pasture to $> 0.50$ on bare, conventionally tilled seedbeds:
   * **Post-Harvest to Emergence:** Bare soil fraction often exceeds $70\text{–}90\%$. The effective $C$-factor climbs to $0.40\text{–}0.70$.
   * **Full Vegetative Canopy:** Once leaf area index ($LAI$) exceeds $2.5\text{–}3.0$, canopy interception dissipates $85\text{–}95\%$ of raindrop kinetic energy, reducing effective $C$ to $< 0.05$.

3. **Temporal Storm Intersection:**  
   In temperate zones (e.g., US Midwest, Western Europe), intense convective thunderstorms peak during late spring (April–June). If an annual maize-soybean rotation leaves the soil bare following chisel plowing during this exact meteorological window, fields with slopes $> 5\%$ experience severe topsoil stripping.

```
Months:       JAN   FEB   MAR   APR   MAY   JUN   JUL   AUG   SEP   OCT   NOV   DEC
Rainfall:     [=== Low ===]     [===== High Intensity Spikes =====]     [=== Mod ===]
Clean Till:   [-- Bare Soil, High C-factor (0.50-0.60) --]  [Canopy]    [Bare Post-Harv]
              ─────────────────────────────────────────────
              CRITICAL EROSION EXPOSURE WINDOW: APR - JUN
              (Peak Rain + Zero Canopy + Slope > 5% = Severe Soil Loss)
              ─────────────────────────────────────────────
Cover Crop:   [=== Living Rye Armor (C < 0.03) ===] [Transition]       [=== Rye Estab ===]
              SOIL PROTECTED: Raindrop energy dissipated, macropores intact.
```

---

#### 4.3 Demonstrating the Soil Protection Value of Conservation Rotations

1. **Overwinter & Early Spring Cover Crops (e.g., Cereal Rye, Hairy Vetch, Crimson Clover):**
   * **Interception:** Maintains an active vegetative canopy over winter and early spring, absorbing raindrop momentum.
   * **Runoff Retardation:** High stem density creates surface micro-roughness, slowing overland flow velocity below the shear threshold required for rill incision.
   * **Aggregate Stability:** Living roots exude polysaccharides and glomalin, binding silt and clay particles into water-stable aggregates that resist detachment.
   * **Quantified Impact:** Shifts the spring $C$-factor from $0.45$ down to $0.02\text{–}0.04$, delivering an $85\text{–}95\%$ reduction in erosion exposure on moderate and steep slopes.

2. **Perennial Forage & Legume Rotations (e.g., Alfalfa, Clover-Grass Leys):**
   * **Multi-Year Canopy Armor:** Provides continuous soil cover across 2 to 4 years.
   * **Root Architecture:** Massive fibrous and taproot systems stabilize sub-surface soil horizons, opening deep biopores that dramatically increase infiltration capacity, reducing total runoff volume ($Q$).
   * **Quantified Impact:** Reduces effective $C$-factor to $< 0.01$, virtually eliminating sheet and rill erosion even on slopes exceeding $10\%$.

3. **Conservation Tillage & No-Till Systems:**
   * **Residue Armor:** Leaving $\ge 30\%$ (reduced-till) to $\ge 70\%$ (continuous no-till) of previous crop residue shields the soil surface against crusting and splash erosion.
   * **Hydrologic Benefit:** Unbroken earthworm channels and root paths sustain high saturated hydraulic conductivity ($K_{\text{sat}}$), mitigating ponding in high-TWI swales and limiting overland flow initiation on slopes.

---

### 5. Limitations & Caveats

Scientific integrity requires understanding the operational limits of remote-sensing terrain data. Asserting false precision erodes trust with land managers.

#### 5.1 Radar Surface Models (DSM) vs. Bare Earth Terrain Models (DTM)
* **The Scattering Phase Center:** Both C-band (SRTM, NASADEM) and X-band (Copernicus DEM) radar waves do not penetrate dense foliage to measure the true mineral earth. Instead, the radar backscatter signal reflects from an apparent elevation located within the upper vegetation canopy.
* **The Forest "Wall" Artefact:** When an agricultural field borders a mature deciduous forest, woodlot, or tree windbreak (e.g., 20-meter canopy height), a satellite radar DSM registers an abrupt 20-meter elevation jump.
* **Artificial Slope Skew:** Computing finite-difference derivatives on grid cells at forest-field boundaries produces severe false-positive slopes ($> 30\text{–}50\%$), creating phantom "cliffs" where the true mineral field edge is actually gentle or flat.
* **Resolution Limits:** While airborne LiDAR DTMs (such as USGS 3DEP) filter out vegetative returns to reveal true micro-drainage channels, 30m radar DSMs smooth out sub-field rills, terrace channels, and small drainage furrows.

```
Elevation (m)
  ▲
320 │                                  ╭──────────╮  <-- Forest Canopy (DSM)
310 │                                  │  TREES   │
300 │  ════════════════════════════════│          │      True Soil Surface (DTM)
290 │  Agricultural Field              ┴──────────┴
    └────────────────────────────────────────────────────────► Distance (m)
       Calculated Radar Slope at Boundary: Spurious 45° cliff!
```

#### 5.2 Slope Alone is Not Soil Loss (The Multi-Factor Reality)
Slope is solely a topographic gradient. Gravitational potential energy cannot detach or move a single gram of topsoil without factoring in rainfall kinetic energy, soil physical properties, canopy cover, and mechanical practices.

$$A = \underbrace{R}_{\text{Rainfall Erosivity}} \cdot \underbrace{K}_{\text{Soil Erodibility}} \cdot \underbrace{LS}_{\text{Terrain Topography}} \cdot \underbrace{C}_{\text{Crop Canopy & Tillage}} \cdot \underbrace{P}_{\text{Conservation Practices}}$$

1. **Rainfall Erosivity ($R$-Factor):**  
   Without precipitation kinetic energy and 30-minute peak intensity ($EI_{30}$), a 10% slope experiences zero water erosion. A dry, sloped field in an arid regime behaves completely differently from the same slope during tropical monsoon storms.
2. **Soil Erodibility ($K$-Factor):**  
   Inherent soil detachability depends on texture, organic carbon, structure, and permeability (derived from SoilGrids or SSURGO). Silt-heavy soils (silt loam, very fine sand) detach rapidly under minimal shear stress ($K > 0.40$). Conversely, high-clay soils with strong cohesion or soils enriched with high organic matter resist detachment ($K < 0.15$).
3. **Conservation Practice ($P$-Factor):**  
   Contour farming, cross-slope contour buffer strips, and terracing break effective slope length and impede downslope transport, reducing net erosion by $50\text{–}80\%$.
4. **False Precision Warning:**  
   **Erosion cannot be reported in tons/ha/year from a DEM alone.** Providing uncalibrated quantitative loss values (e.g., asserting a field is "losing 14.8 t/ha/yr of soil" using only slope derivatives) is scientifically invalid.

---

### 6. Farmer Evidence Display Guidelines

Agricultural decision support tools must present complex terrain physics clearly and calmly, adhering to the "Field Almanac" design system rules: **light mode only**, **plain language**, **verb first**, **data colors mean data only**, and **never rely on color alone**.

```
+-------------------------------------------------------------------------------------------------+
|                               FARMER EVIDENCE DISPLAY SPECIFICATION                             |
+-------------------------------------------------------------------------------------------------+
| [ Card Container: bg-surface-raised, border-line, rounded-lg, p-4 ]                             |
|                                                                                                 |
|   1. Headline & Descriptive Categorization (text-headline, text-ink)                            |
|      "Field Slope: 4.2° · Gentle slope (2–5%)"                                                  |
|                                                                                                 |
|   2. Semantic Warning Banner (bg-drought-soft, text-drought, p-3, rounded)                      |
|      [Alert Icon] "Runoff and erosion exposure risk on sloped fields during bare periods"        |
|                                                                                                 |
|   3. Clear Context & Actionable Translation (text-body, text-ink-muted)                         |
|      "Water flows fast enough on this slope to wash away loose topsoil when the field is bare.  |
|       Keeping an overwinter cover crop or retaining surface residue shields the soil against    |
|       heavy spring rains."                                                                      |
|                                                                                                 |
|   4. Calm Source Provenance Line (text-body-sm, text-ink-muted, Geist Mono data tokens)          |
|      "Source: Copernicus GLO-30 · 30m radar DSM · Vertical accuracy ±2.0m"                      |
+-------------------------------------------------------------------------------------------------+
```

#### 6.1 Slope Metric & Category Presentation Rules
* **Dual Reporting:** Display slope in **degrees** paired directly with its standard **percentage category**.
  * Example display: `4.2° · Gentle slope (2–5%)` or `8.4° · Moderate slope (5–10%)`.
* **Geist Mono Numerical Formatting:** Render numeric values with units attached using tabular numerals: `<span className="font-mono text-reading font-medium">4.2°</span>`.
* **Plain Language Classification Table:**

| Angular Slope Display | Descriptive Label | Farmer Decision Context |
| :--- | :--- | :--- |
| **$< 1.1^\circ$** | Flat ($0\text{–}2\%$) | Good infiltration; watch for ponding in low swales during wet years. |
| **$1.1^\circ\text{–}2.9^\circ$** | Gentle ($2\text{–}5\%$) | Standard runoff risk; easily managed with residue retention and contour planting. |
| **$2.9^\circ\text{–}5.7^\circ$** | Moderate ($5\text{–}10\%$) | Runoff moves fast; soil washes away if bare during intense storms. Cover crops recommended. |
| **$> 5.7^\circ$** | Steep ($> 10\%$) | High risk of rills and gullies under clean-tilled row crops. Requires continuous living cover or perennial forage. |

---

#### 6.2 Mandatory Plain-Language Warning Labels
* **Exact Required Phrasing:**  
  When a field's mean or maximum slope exceeds the gentle threshold ($> 2.9^\circ$ or $> 5\%$), display the standard warning:
  > **"Runoff and erosion exposure risk on sloped fields during bare periods"**
* **The Rule of No False Precision:**  
  Never state or imply quantitative soil loss figures (e.g., "18 tons/ha lost") unless local measured $K$-factor, dynamic $EI_{30}$ rainfall erosivity, and documented tillage management practices have been calibrated and verified. Speak in terms of **exposure risk**, **vulnerable seasonal windows**, and **protective soil cover**.

---

#### 6.3 UI Component Implementation (React / Tailwind / Field Almanac)

The following production-ready React component implements all guidelines, using design system tokens (`bg-surface-raised`, `text-ink`, `text-drought`, `bg-drought-soft`, `border-line-strong`, and the `Never-Color-Alone` rule with semantic icons):

```tsx
import React from "react";

interface TerrainEvidenceProps {
  slopeDeg: number;
  slopePct: number;
  sourceDataset: "Copernicus GLO-30" | "USGS 3DEP" | "NASADEM";
  resolutionM: number;
  highRainfallRisk: boolean;
  hasBareWindow: boolean;
}

export function TerrainErosionEvidence({
  slopeDeg,
  slopePct,
  sourceDataset,
  resolutionM,
  highRainfallRisk,
  hasBareWindow,
}: TerrainEvidenceProps) {
  // Categorize slope according to agricultural decision support classes
  const getSlopeCategory = (pct: number) => {
    if (pct < 2) return { label: "Flat (0–2%)", tone: "healthy" as const };
    if (pct < 5) return { label: "Gentle (2–5%)", tone: "healthy" as const };
    if (pct < 10) return { label: "Moderate (5–10%)", tone: "drought" as const };
    return { label: "Steep (>10%)", tone: "heat" as const };
  };

  const category = getSlopeCategory(slopePct);
  const isVulnerable = slopePct >= 5 && hasBareWindow;

  return (
    <aside className="rounded-lg border border-line bg-surface-raised p-5 shadow-sm text-ink max-w-measure">
      {/* 1. Header with Plain Category and Mono Numeric Reading */}
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <div>
          <span className="text-body-sm font-medium text-ink-muted block">Field Topography</span>
          <h4 className="text-headline font-semibold text-ink m-0">
            {category.label}
          </h4>
        </div>
        <div className="text-right">
          <span className="font-mono text-reading font-medium text-ink">
            {slopeDeg.toFixed(1)}°
          </span>
          <span className="text-body-sm text-ink-muted ml-1.5 font-mono">
            ({slopePct.toFixed(0)}%)
          </span>
        </div>
      </div>

      {/* 2. Mandatory Warning Banner (Never-Color-Alone: Icon + Text) */}
      {isVulnerable && (
        <div className="mt-4 flex items-start gap-3 rounded-md bg-[#f1e6c8] p-3 text-[#765709] border border-[#d8d3c2]">
          {/* Warning Icon */}
          <svg
            className="h-5 w-5 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="flex-1">
            <p className="m-0 text-label font-semibold leading-snug">
              Runoff and erosion exposure risk on sloped fields during bare periods
            </p>
            <p className="m-0 mt-1 text-body-sm opacity-90">
              {highRainfallRisk
                ? "Intense seasonal storms coincide with bare soil windows. Raindrops hit bare soil directly, washing away topsoil."
                : "Topsoil is exposed to runoff during post-harvest or early seedbed periods before crops establish full canopy."}
            </p>
          </div>
        </div>
      )}

      {/* 3. Action-First Recommendation Copy */}
      <p className="mt-4 text-body text-ink leading-relaxed">
        {slopePct < 5 ? (
          "Water runs off gently here. Standard crop rotations and surface residue provide good protection against topsoil loss."
        ) : (
          "Water speeds up on this slope. Planting an overwinter cover crop or shifting to reduced tillage keeps a protective blanket on the soil during heavy rains."
        )}
      </p>

      {/* 4. Grounded Source Provenance Line */}
      <footer className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between text-body-sm text-ink-muted">
        <span>Elevation evidence</span>
        <span className="font-mono text-xs">
          {sourceDataset} · {resolutionM}m resolution
        </span>
      </footer>
    </aside>
  );
}
```

---

### 7. Synthesis & Strategic Recommendations for Platform Implementation

1. **Global Default DEM Strategy:**  
   Standardize on **Copernicus DEM GLO-30** as the primary global elevation dataset. Its full global coverage ($90^\circ\text{N}\text{–}90^\circ\text{S}$), superior relative accuracy ($LE90 < 4\text{ m}$), hydro-flattened drainage channels, and native Cloud-Optimized GeoTIFF availability on AWS S3 eliminate the latitudinal cutoffs and void artifacts of SRTM v3.
2. **National High-Resolution Enhancement (United States):**  
   Implement a tiered resolution pipeline. For coordinates within the United States, query the **USGS 3DEP** Elevation Point Query Service (EPQS) or stream 1m/10m bare-earth LiDAR DTMs. This bypasses radar forest-canopy artifacts and resolves terraces and grassed waterways.
3. **Strict Planar Reprojection:**  
   Enforce server-side or worker-side UTM reprojection with bilinear resampling before evaluating Horn finite-difference kernels or flow routing algorithms, preventing angular coordinate distortion.
4. **Coupled Rotation Analytics:**  
   Connect terrain slope directly to the crop phenology calendar. Flag fields exceeding $5\%$ slope that feature bare fallow periods during historical rainfall intensity peaks (from NASA POWER `PRECTOTCORR`). Promote cover crops and perennial leys as protective shields against runoff detachment.
5. **Calm, Honest UX Communication:**  
   Maintain farmer trust by pairing numeric readings with descriptive categories and clear warning labels. Ground recommendations in soil armor and water protection rather than unverified quantitative loss claims.

---
*End of Technical Research Report.*

---

## Agent 8: USDA CDL (CropScape), ESA WorldCover & Dynamic World
**Specialist Role:** Land Cover & Crop History Specialist

# Technical Research Report: Agricultural Land Cover Datasets for Crop Rotation Tracking

**Author:** Technical Research & Earth Observation Engineering  
**Scope:** Remote Sensing Crop Classification, Sequence Mining, and Agronomic Engine Integration  
**Design System & UX Context:** The Field Almanac (`DESIGN.md`, `UX.md`, `APPLIED_DATASET.md`)  
**Status:** Complete Technical Specification & Implementation Architecture  

---

## Executive Summary

Tracking crop rotation history is fundamental to evaluating soil health trajectories, nitrogen carryover, disease cycle interruptions, and agro-hydrological resilience. While remote sensing offers multi-decadal observations across the globe, translating satellite imagery into reliable rotation histories requires rigorous spatial filtering, phenological sequence mining, and an unwavering commitment to the **Farmer Primacy Rule**: satellite classifications are advisory hypotheses, whereas farmer testimony remains the absolute ground truth.

This report establishes the technical architecture, data pipelines, statistical algorithms, and user experience guidelines for integrating historical land cover and crop classification data into the rotation comparison engine.

```
+---------------------------------------------------------------------------------------------------+
|                                SATELLITE & SURVEY OBSERVATION TIER                                |
|  +--------------------+  +--------------------+  +---------------------+  +--------------------+  |
|  |   USDA CDL (30m)   |  | ESA WorldCover 10m |  | Dynamic World (10m) |  |  NASS QuickStats   |  |
|  | CONUS Crop Species |  | Global Arable Mask |  | NRT Probabilities   |  | County Base Priors |  |
|  +---------+----------+  +---------+----------+  +----------+----------+  +---------+----------+  |
+------------|-----------------------|------------------------|-----------------------|-------------+
             |                       |                        |                       |
             +-----------------------+-----------+------------+-----------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
|                                 SPATIAL FILTERING & BUFFER ENGINE                                 |
|    Field Polygon Boundary -> Inward Negative Buffer: ST_Buffer(geom, -15m) -> Pure Interior Pixels  |
|               (Eliminates boundary mixing, fence lines, farm roads, and headlands)                |
+------------------------------------------------+--------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
|                                   ROTATION SEQUENCE MINING TIER                                   |
|   - Multi-Year Pixel Extraction (e.g. 2020-2024 State Sequences)                                  |
|   - Markov Transition Matrix: P(C_t | C_{t-1}) and Second-Order Dynamics P(C_t | C_{t-1}, C_{t-2}) |
|   - Cover Crop & Double-Cropping Detection: Shoulder-Season NDVI/SAR & Dynamic World Curves       |
+------------------------------------------------+--------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
|                                   INTEGRATION & DECISION ENGINE                                   |
|  +--------------------------------+  +-------------------------------+  +----------------------+  |
|  |     Smart Rotation Library     |  |    Memory-Assist Infill Flow   |  | Farmer Primacy Rule  |  |
|  |  (Local Contextual Templates)  |  |  ("In 2022, Soybeans detected")|  |  (Farmer Override    |  |
|  |                                |  |                               |  |   Wins Always)       |  |
|  +--------------------------------+  +-------------------------------+  +----------+-----------+  |
+------------------------------------------------------------------------------------|--------------+
                                                                                     v
                                                                   +--------------------------------+
                                                                   | Field Almanac UI Presentation  |
                                                                   | - Plain-language headlines     |
                                                                   | - Explicit confidence chips    |
                                                                   | - Single-tap correction        |
                                                                   | - Dataset & resolution credits |
                                                                   +--------------------------------+
```

---

### 1. Datasets & Classification Methodologies

Accurate rotation reconstruction requires pairing high-taxonomic-resolution national datasets with global, high-spatial-resolution land cover products and regional census statistics.

```
+---------------------+-------------------+---------------------+-------------------------+---------------------------------------------------------+
| Dataset             | Spatial Res.      | Temporal Extent     | Geographic Coverage     | Primary Agronomic Role                                  |
+---------------------+-------------------+---------------------+-------------------------+---------------------------------------------------------+
| USDA CDL            | 30 m (raster)     | 2008-present annual | Contiguous US (CONUS)   | Crop-specific taxonomy (>110 species); rotation history |
| ESA WorldCover      | 10 m (raster)     | 2020, 2021          | Global                  | Baseline arable cropland vs non-crop spatial mask       |
| Dynamic World (NRT) | 10 m (raster)     | 2015-present (NRT)  | Global                  | Intra-annual continuous phenology; cover crop detection |
| USDA NASS QuickStat | Tabular (County)  | Decades (Annual/5yr)| United States           | Regional Bayesian priors; aggregate acreage validation  |
+---------------------+-------------------+---------------------+-------------------------+---------------------------------------------------------+
```

#### USDA Cropland Data Layer (CDL)
* **Spatial and Temporal Specifications:** The Cropland Data Layer is a geo-referenced, crop-specific land cover raster produced annually by the United States Department of Agriculture (USDA) National Agricultural Statistics Service (NASS). It provides a 30-meter ground sample distance (GSD) across the Contiguous United States (CONUS), with complete annual coverage from 2008 to the present (and state-level historical archives extending back to 1997 in select Midwestern states).
* **Sensor Inputs and Radiometric Preprocessing:** CDL classifications are constructed from multi-temporal optical satellite imagery acquired throughout the growing season. Primary sensors include:
  * Landsat 8 Operational Land Imager (OLI) and Landsat 9 OLI-2 (30m multispectral; 16-day revisit individually, 8-day combined).
  * Copernicus Sentinel-2A and Sentinel-2B Multi-Spectral Instrument (MSI) (10m and 20m VNIR/SWIR bands resampled to 30m; 5-day combined revisit).
  * Historically: Landsat 5 Thematic Mapper (TM), Landsat 7 Enhanced Thematic Mapper Plus (ETM+), Indian Remote Sensing (IRS) RESOURCESAT-1/2 Advanced Wide Field Sensor (AWiFS), and Disaster Monitoring Constellation (DEIMOS-1 / UK-DMC 2).
  * Preprocessing involves surface reflectance atmospheric correction, geometric orthorectification to the Albers Conical Equal Area projection (NAD83), and pixel-level cloud/shadow masking using the CFmask algorithm.
* **Classification Taxonomy:** CDL encodes over 110 distinct agricultural crop categories alongside standard non-agricultural land cover classes adapted from the National Land Cover Database (NLCD). Key agronomic categories include:
  * Major Row Crops: Corn (`Code 1`), Cotton (`Code 2`), Soybeans (`Code 5`), Sunflower (`Code 6`), Grain Sorghum (`Code 4`).
  * Small Grains: Winter Wheat (`Code 24`), Spring Wheat (`Code 23`), Durum Wheat (`Code 22`), Barley (`Code 21`), Oats (`Code 28`), Rye (`Code 32`).
  * Forages & Legumes: Alfalfa (`Code 36`), Other Hay/Non-Alfalfa (`Code 37`), Clover/Wildflowers (`Code 58`), Dry Beans (`Code 42`), Peas (`Code 53`).
  * Double-Crop Composites: Winter Wheat/Soybeans (`Code 225`), Winter Wheat/Corn (`Code 228`), Oats/Soybeans (`Code 226`), Barley/Soybeans (`Code 254`).
  * Fallow and Conservation: Fallow/Idle Cropland (`Code 61`).
* **Supervised Machine Learning Architecture:** Supervised classification historically utilized the Rulequest See5.0 decision tree algorithm, transitioning to modern distributed Random Forests and Gradient Boosted Decision Trees. The classification is trained on extensive, high-fidelity administrative ground-truth data:
  * *USDA Farm Service Agency (FSA) Common Land Unit (CLU):* Attribute-rich digital field boundaries paired with mandatory producer-reported Form FSA-578 compliance declarations, detailing exact crop types, certified acreage, and planting dates.
  * *NASS June Agricultural Survey (JAS):* Rigorous stratified area frame ground observations.
* **Accuracy Metrics & Validation:** Independent validation using withheld JAS area segments indicates high producer and user accuracies ($85\%\text{--}95\%$) for dominant commercial commodity crops (Corn, Soybeans, Cotton, Rice) in the US Corn Belt and Mississippi Delta. However, small grains, specialty horticultural crops, fallow transitions, and secondary double-crop sequences exhibit lower accuracies ($60\%\text{--}80\%$) due to spectral ambiguity and timing overlap.
* **Publication Latency:** Annual CDL rasters are published in February or March following the conclusion of the harvest year (a 4-to-6-month post-harvest latency).

#### ESA WorldCover
* **Spatial and Temporal Specifications:** ESA WorldCover provides a global 10-meter resolution land cover map delivered at annual and biennial intervals (v100 for reference year 2020; v200 for reference year 2021), developed under the auspices of the European Space Agency.
* **Multi-Sensor Radar and Optical Fusion:** WorldCover is distinguished by its structural sensor fusion:
  * *Copernicus Sentinel-1 SAR:* Dual-polarization C-band Synthetic Aperture Radar (Interferometric Wide Swath mode, VV and VH polarizations, 10m spatial resolution). SAR backscatter ($\gamma^0$) penetrates cloud cover, sensitive to canopy geometric structure, volumetric biomass, and surface soil roughness. WorldCover computes multi-temporal temporal metrics (mean, standard deviation, percentile backscatter, and interferometric coherence).
  * *Copernicus Sentinel-2 Optical:* 13 spectral bands covering VNIR, Red Edge (B5, B6, B7, B8A), and Shortwave Infrared (B11, B12). Cloud-free seasonal compositing extracts 10th, 50th, and 90th percentiles of spectral reflectance and vegetation indices (NDVI, NDRE, NDWI).
* **Taxonomy & Machine Learning Methodology:** WorldCover classifies the terrestrial surface into 11 discrete land cover categories mapped to the UN Food and Agriculture Organization (FAO) Land Cover Classification System (LCCS):
  * `10`: Tree cover
  * `20`: Shrubland
  * `30`: Grassland
  * `40`: Cropland (land cultivated with annual or perennial crops, herbaceous and shrub/tree crops)
  * `50`: Built-up
  * `60`: Bare / sparse vegetation
  * `70`: Snow and ice
  * `80`: Permanent water bodies
  * `90`: Herbaceous wetland
  * `95`: Mangroves
  * `100`: Moss and lichen
  * Classification is executed using the CatBoost gradient boosting framework trained on a globally distributed database containing over 100 million expert-annotated validation and training sample points.
* **Agronomic Role in Rotation Modeling:** While WorldCover does not differentiate specific crop taxa (e.g., separating corn from soybeans), its 10-meter resolving power provides a high-fidelity global mask of arable cultivation versus non-agricultural encroachment (tree lines, hedgerows, water bodies, urban expansion). It serves as the baseline cropland boundary validator outside the United States.

#### Dynamic World (Google / World Resources Institute)
* **Spatial and Near-Real-Time (NRT) Architecture:** Dynamic World is an open-access, 10-meter near-real-time global land cover dataset generated on Google Earth Engine. Unlike static annual composite rasters, Dynamic World produces a classification inference for every single cloud-screened Copernicus Sentinel-2 L2A acquisition globally, providing updates every 2 to 5 days with an inference latency of 2 to 4 days post-overpass.
* **Deep Learning Convolutional Neural Network (CNN):** The core classification model is a fully convolutional neural network (a modified U-Net / Fully Convolutional Network architecture) trained on 24,000 hand-annotated multi-temporal Sentinel-2 tiles ($510 \times 510$ pixels) across diverse biomes. The network operates directly on 10 Sentinel-2 surface reflectance bands (B2, B3, B4, B8 at 10m; B5, B6, B7, B8A, B11, B12 resampled to 10m).
* **Continuous Probability Vectors vs. Categorical Labels:** Dynamic World outputs two core data representations:
  1. `label`: Categorical raster identifying the class with maximum likelihood ($\arg\max$).
  2. Nine Continuous Probability Bands: Floating-point values $[0.0, 1.0]$ summing to $1.0$ at every pixel:
     * `water`, `trees`, `grass`, `flooded_vegetation`, `crops`, `shrub_and_scrub`, `built`, `bare`, `snow_and_ice`.
* **Phenological and Rotation Value:** The continuous `crops` probability band ($p_{\text{crops}}$) and `bare` probability band ($p_{\text{bare}}$) provide continuous monitoring of field management:
  * A spring tillage or post-harvest event produces an immediate collapse in $p_{\text{crops}}$ to near zero, accompanied by a spike in $p_{\text{bare}} > 0.85$.
  * Vegetative canopy emergence drives a progressive rise in $p_{\text{crops}}$.
  * This continuous probability vector allows the detection of off-season cover crops, fallow periods, double-cropping sequences, and emergency replanting events within the calendar year.

#### USDA NASS QuickStats
* **Statistical Scope and Spatial Hierarchy:** USDA NASS QuickStats is the official repository of agricultural survey and census data for the United States. It does not provide spatially explicit pixel rasters; rather, it delivers structured aggregate statistics organized across an administrative hierarchy:
  * Geographic Levels: National $\to$ State $\to$ Agricultural Statistics District (ASD) $\to$ County.
  * Temporal Frequencies: Annual Agricultural Surveys (e.g., June Area Survey, Crop Production Reports) and the quinquennial Census of Agriculture (every 5 years: 2012, 2017, 2022).
* **Key Agricultural Parameters:**
  * Planted Acreage and Harvested Acreage per crop taxon.
  * Yield per harvested acre (e.g., bushels/acre, cwt/acre, metric tons/ha).
  * Total grain/biomass production and grain storage stocks.
  * Irrigation classification: Irrigated vs. Non-irrigated practices.
  * Crop Progress and Condition Reports: Weekly growing season categorical assessments (Very Poor, Poor, Fair, Good, Excellent).
* **Statistical Role as Bayesian Priors:** In rotation modeling, county-level QuickStats data provide empirical prior probability distributions:
  $$P(\text{Crop}_k \mid \text{County}_C) = \frac{\text{PlantedAcreage}_{k, C}}{\sum_{j} \text{PlantedAcreage}_{j, C}}$$
  These priors ground remote sensing classifications, preventing rare or agronomically improbable misclassifications (e.g., identifying a 30m pixel as Rice in central Iowa or Cotton in North Dakota).

---

### 2. Crop Rotation Sequence Mining

#### Multi-Year Historical Pixel Sequences
Crop rotation tracking models the temporal trajectory of land management across discrete growing seasons. For any geographic coordinate or field boundary, remote sensing data provides an ordered sequence of annual crop classifications across $T$ years (e.g., 2020 through 2024):

$$S_p = [c_{p, 2020}, c_{p, 2021}, c_{p, 2022}, c_{p, 2023}, c_{p, 2024}]$$

Where $c_{p, t} \in \mathcal{C}$ represents the classified land cover state from categorical taxonomy $\mathcal{C}$ at pixel $p$ in year $t$.

```
Spatial Zonal Aggregation Pipeline:
+-------------------------------------------------------------+
| Field Boundary Polygon (User-drawn GeoJSON)                 |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| ST_Buffer(geom, -15m) [Negative Buffer: Strips Edge Noise]  |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Extract Pixel Stacks: S_p = [c_2020, c_2021, c_2022, c_2023] |
+-------------------------------------------------------------+
                               |
              +----------------+----------------+
              v                                 v
+-------------------------------+ +---------------------------+
| Modal Sequence Aggregation    | | Purity & Split Detection  |
| mode(S_p) -> "Corn-Soy-Corn"  | | Var(S_p) -> Flag Splits   |
+-------------------------------+ +---------------------------+
```

##### 1. Spatial Zonal Aggregation
Within a defined field polygon $F$ containing $N$ valid interior pixels, pixel-level sequences exhibit local variability due to micro-topography, drainage ways, or isolated classification errors. The field-scale historical sequence is mined through two complementary metrics:
* **Modal Sequence Extraction:** 
  $$\hat{c}_t = \text{mode}\left(\{c_{p, t} \mid p \in F\}\right)$$
* **Sequence Purity / Homogeneity Index:**
  $$\Pi_t = \frac{\sum_{p \in F} \mathbb{I}(c_{p, t} = \hat{c}_t)}{N}$$
  A purity score $\Pi_t \ge 0.85$ indicates a uniform, single-crop field management regime. A purity score $\Pi_t < 0.65$ indicates an intra-field split (e.g., a field divided into strip-cropping or two management zones).

##### 2. Markov Transition Matrices
Regional rotation systems are modeled as stochastic processes governed by transition probability matrices. A first-order Markov chain assumes that the probability of planting a specific crop in year $t$ depends on the crop grown in year $t-1$:

$$T_{i, j} = P(C_t = j \mid C_{t-1} = i) = \frac{N_{i \to j}}{\sum_{k} N_{i \to k}}$$

Where $N_{i \to j}$ is the total count of pixel transitions from crop $i$ to crop $j$ across the regional neighborhood.

For sophisticated agronomic sequences, second-order Markov chains capture two-year memory effects:

$$T_{i, j, k} = P(C_t = k \mid C_{t-1} = j, C_{t-2} = i)$$

##### 3. Typical Regional Rotation Archetypes (CONUS)
* **US Corn Belt (Iowa, Illinois, Indiana):**
  * *Corn–Soybean Biennial Cycle:* Highly deterministic alternating sequence.
    $$T_{\text{Corn} \to \text{Soy}} \approx 0.78\text{--}0.85, \quad T_{\text{Soy} \to \text{Corn}} \approx 0.88\text{--}0.94$$
  * *Continuous Corn:* Common in livestock-dense or ethanol-adjacent regions.
    $$T_{\text{Corn} \to \text{Corn}} \approx 0.15\text{--}0.22, \quad T_{\text{Soy} \to \text{Soy}} < 0.03$$
  * *Corn–Corn–Soybean:* A three-year cycle balancing grain production with disease management.
* **Central & Southern Great Plains (Kansas, Nebraska, Oklahoma, Texas Panhandle):**
  * *Winter Wheat–Fallow (WW–F):* A 2-year moisture-conserving rotation in semi-arid dryland zones ($<450\text{ mm}$ annual precipitation).
  * *Winter Wheat–Corn/Sorghum–Fallow (WW–C/S–F):* A 3-year eco-fallow rotation maximizing soil moisture retention while producing two cash crops in three years.
* **Northern Great Plains (North Dakota, Montana):**
  * *Spring Wheat–Canola / Pulse (Dry Pea, Lentil)–Barley:* Diversified small-grain rotations designed to break cereal root-rot pathogens (*Bipolaris sorokiniana*, *Fusarium crown rot*).
* **Mississippi Delta & Southeast:**
  * *Cotton–Peanut–Cotton* or *Cotton–Corn–Soybean:* Mitigating root-knot nematode (*Meloidogyne incognita*) pressure.

##### 4. Algorithmic Sequence Pattern Mining
Mining canonical rotation patterns across large field cohorts utilizes sequence mining algorithms:
* **PrefixSpan (Prefix-projected Sequential Pattern Mining):** Identifies frequent sub-sequences across varying cycle lengths without candidate generation.
* **String Alignment & Levenshtein Distance:** Encoding annual crops into single-character tokens (e.g., `C` = Corn, `S` = Soybean, `W` = Wheat, `F` = Fallow). A 5-year sequence `C-S-C-S-C` is matched against known regional templates using edit-distance scoring, accommodating single-year satellite classification errors.
* **Shannon Entropy / Rotation Complexity Index:**
  $$H(F) = -\sum_{k=1}^{K} p_k \log_2(p_k)$$
  Where $p_k$ is the relative temporal proportion of crop $k$ over an $M$-year window. Higher entropy indicates diversified, multi-crop rotations, whereas $H(F) = 0$ indicates strict monoculture.

```
Markov Transition Matrix: US Western Corn Belt (Empirical Sample)
                 To: Corn    Soybean    Small Grain   Fallow/Other
From:
Corn                0.19      0.78         0.02          0.01
Soybean             0.89      0.03         0.06          0.02
Small Grain         0.54      0.32         0.10          0.04
Fallow/Other        0.42      0.40         0.08          0.10
```

#### Detecting Regional Adoption of Cover Crops and Double-Cropping Practices

##### 1. Double-Cropping Identification via CDL
CDL provides explicit composite classification codes for recognized commercial double-cropping regimes:
* `Code 225`: Double Crop - Winter Wheat / Soybeans (predominant across the mid-latitude transition zone: southern Illinois, Indiana, Ohio, Kentucky, Missouri).
* `Code 238`: Double Crop - Winter Wheat / Cotton.
* `Code 226`: Double Crop - Oats / Soybeans.
* `Code 254`: Double Crop - Barley / Soybeans.

*Algorithmic Limitation:* CDL double-crop classes capture only sequences where *both* crops are harvested for commercial grain or fiber. They systematically fail to detect non-harvested conservation cover crops.

##### 2. Multi-Temporal Phenology Extraction for Winter Cover Crops
Winter cover crops (e.g., Cereal Rye (*Secale cereale*), Hairy Vetch (*Vicia villosa*), Crimson Clover (*Trifolium incarnatum*), Tillage Radish (*Raphanus sativus*)) are planted post-harvest in September–November and terminated chemically or mechanically in April–May prior to summer row-crop planting. Because they are not harvested, annual single-date or summer-composite land cover rasters categorize the field solely as the primary summer commodity crop (e.g., Corn or Soybeans).

Detection requires intra-annual time-series phenology modeling using high-revisit optical (Sentinel-2, Landsat) and SAR (Sentinel-1) sensors:

```
Phenological Trajectory: Cash Crop vs. Cover Crop System
NDVI
1.0 |                   Summer Cash Crop Peak (July-Aug)
    |                             /\
0.8 |                            /  \
    |      Spring Cover         /    \
0.6 |      Green-up (Apr)      /      \
    |           /\            /        \
0.4 |          /  \          /          \          Cover Crop Emergence (Oct-Nov)
    |   _     /    \________/            \___________    _
0.2 |  / \___/     Termination (May)      Harvest (Sep) \__/
0.0 +------------------------------------------------------------>
    Jan   Feb  Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
```

* **Shoulder-Season Spectral Windows:**
  * *Window 1 (Post-Harvest Establishment):* DOY 270 through DOY 340 (October–December).
  * *Window 2 (Spring Pre-Planting Green-up):* DOY 60 through DOY 130 (March–May).
* **Vegetation Index Thresholding:**
  Under conventional fallow/tillage, soil remains bare or covered with desiccated crop residue:
  $$\text{NDVI}_{\text{shoulder}} < 0.22, \quad \text{NDRE}_{\text{shoulder}} < 0.15$$
  Active living cover crop canopies exhibit clear photosynthetic absorption and NIR scattering:
  $$\text{NDVI}_{\text{shoulder}} \ge 0.35\text{--}0.65, \quad \Delta\text{NDVI} > 0.15 \text{ (sustained positive rate of change)}$$
* **Dynamic World Probability Tracking:**
  In Dynamic World, cover-cropped fields register a distinctive signature: following summer crop harvest ($p_{\text{crops}} \to 0$, $p_{\text{bare}} \to 0.90$), the subsequent spring window (March–April) exhibits an off-season resurgence where:
  $$(p_{\text{crops}} + p_{\text{grass}}) > 0.45$$
  This surge terminates abruptly in May with an instantaneous transition to $p_{\text{bare}} > 0.80$ as the farmer sprays glyphosate or operates a roller-crimper.
* **SAR Backscatter Validation (Sentinel-1):**
  Persistent spring cloud cover frequently obscures optical sensors during the critical termination window. Sentinel-1 SAR cross-polarization backscatter ratio ($\text{VH}/\text{VV}$) is cloud-penetrating. Bare soil displays $\text{VH}/\text{VV} < -14\text{ dB}$, whereas standing cereal rye cover elevates volumetric cross-polarization backscatter:
  $$\text{VH}/\text{VV} \ge -10.5\text{ dB}$$
  Tracking SAR backscatter deltas reliably dates termination timing even under 100% cloud cover.

---

### 3. Access Architecture & REST APIs

Extracting crop history requires connecting the rotation engine to remote data stores through low-latency, scalable architectures.

```
Access Architecture Options:
+-----------------------------------------------------------------------------------------+
| Mode 1: USDA CropScape REST API (GMU / NASS)                                            |
| Client -> HTTP GET -> SOAP/Axis2 Engine -> Zonal Server-side Processing -> XML Response |
| Pros: Official source, zero infrastructure footprint                                   |
| Cons: 800ms-3500ms latency, single-threaded bottlenecks, CONUS only                     |
+-----------------------------------------------------------------------------------------+
| Mode 2: Cloud-Native AWS S3 STAC + COG (Recommended Architecture)                       |
| Client -> STAC API Query -> Signed S3 URL -> HTTP GET Range Requests -> GDAL/rio-tiler   |
| Pros: 50ms-180ms latency, massively parallel, byte-exact, serverless-native             |
+-----------------------------------------------------------------------------------------+
| Mode 3: Google Earth Engine (GEE API)                                                   |
| Client -> GEE Python/REST Client -> OAuth2 Service Account -> reduceRegion -> JSON     |
| Pros: Massive catalog (CDL, WorldCover, Dynamic World), complex map-reduce              |
| Cons: Rate quotas, initialization overhead, outbound payload constraints                |
+-----------------------------------------------------------------------------------------+
```

#### USDA CropScape REST API
The USDA NASS CropScape service, hosted in collaboration with George Mason University (GMU), exposes programmatic geospatial web services over HTTP GET/POST:
* **Service Base URL:** `https://nassgeodata.gmu.edu/axis2/services/CDLService/`

##### 1. Single Point Extraction: `GetCDLValue`
Retrieves the crop classification code for a single coordinate in a specified year.
* **Request URL Syntax:**
  ```text
  GET https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue?year=2023&x=-93.4735&y=42.0308
  ```
* **Parameters:**
  * `year`: Target calendar year (`YYYY`).
  * `x`: Longitude (decimal degrees, WGS84) or projected X (Albers NAD83).
  * `y`: Latitude (decimal degrees, WGS84) or projected Y (Albers NAD83).
* **Sample XML Response:**
  ```xml
  <GetCDLValueResponse xmlns="http://service.cdl.nass.usda.gov">
    <returnURL>
      { "value": "1", "category": "Corn", "color": "ffd300", "year": "2023" }
    </returnURL>
  </GetCDLValueResponse>
  ```

##### 2. Zonal Polygon Summary: `GetCDLStat`
Calculates zonal crop acreage statistics across a custom polygon boundary.
* **Request URL Syntax:**
  ```text
  GET https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLStat?year=2023&points=-93.48,42.03,-93.47,42.03,-93.47,42.04,-93.48,42.04,-93.48,42.03
  ```
* **Parameters:**
  * `year`: Target calendar year (`YYYY`).
  * `points`: Comma-delimited list of bounding coordinate pairs ($X_1, Y_1, X_2, Y_2, \dots, X_1, Y_1$) closing the polygon ring.
* **Sample JSON / CSV Response Payload:**
  ```json
  {
    "year": 2023,
    "total_pixels": 450,
    "stats": [
      { "code": 1, "category": "Corn", "pixel_count": 382, "acres": 85.01, "percentage": 84.89 },
      { "code": 5, "category": "Soybeans", "pixel_count": 48, "acres": 10.68, "percentage": 10.67 },
      { "code": 61, "category": "Fallow/Idle", "pixel_count": 20, "acres": 4.45, "percentage": 4.44 }
    ]
  }
  ```

##### 3. Production Limitations of CropScape API
* *Latency:* Response times range from $800\text{ ms}$ to $>3,500\text{ ms}$ per query depending on server load, creating bottlenecks for real-time user interfaces.
* *Reliability:* Service maintenance windows and unannounced downtime during peak US planting and harvest report cycles.
* *Scalability:* Large batch lookups (e.g., verifying 50 fields across 5 years = 250 HTTP roundtrips) are heavily throttled.

#### Cloud-Native Access via AWS S3 STAC and Google Earth Engine

##### 1. AWS S3 STAC & Cloud-Optimized GeoTIFFs (COGs)
The recommended low-latency enterprise architecture bypasses legacy SOAP/REST endpoints in favor of Cloud-Optimized GeoTIFFs (COGs) queried via SpatioTemporal Asset Catalogs (STAC).
* **Storage Pattern:** Annual CDL, ESA WorldCover, and Sentinel-2 data are archived as tiled, internally overviewed COGs on AWS S3 open data buckets (e.g., Element 84 Earth Search, Microsoft Planetary Computer).
* **HTTP Range Requests (RFC 7233):** Using libraries such as `gdal`, `rasterio`, or `rio-tiler`, a client fetches only the exact 20–50 kilobytes of image data corresponding to the field's spatial bounding box, reading internal IFD headers without downloading the multi-gigabyte state raster.

```python
# Python rio-tiler Cloud-Native Pixel Extraction Pipeline
from rio_tiler.io import COGReader
from shapely.geometry import shape, mapping
import numpy as np

def extract_field_crop_history(cog_s3_url: str, field_geojson: dict) -> dict:
    """
    Extracts crop classification and zonal statistics directly from an S3 COG
    using targeted HTTP range requests in < 120ms.
    """
    geom = shape(field_geojson)
    # Apply negative buffer (15m inward) to eliminate boundary edge contamination
    eroded_geom = geom.buffer(-0.00015) # Approx 15m in decimal degrees
    
    with COGReader(cog_s3_url) as cog:
        # Read only the clipped array covering the buffered polygon
        img = cog.mask(mapping(eroded_geom))
        pixels = img.data[0] # Band 1 classification codes
        valid_pixels = pixels[pixels > 0] # Filter out nodata
        
        if valid_pixels.size == 0:
            return {"status": "empty", "modal_code": None, "confidence": 0.0}
            
        codes, counts = np.unique(valid_pixels, return_counts=True)
        modal_idx = np.argmax(counts)
        modal_code = int(codes[modal_idx])
        purity = float(counts[modal_idx] / valid_pixels.size)
        
        return {
            "year": 2023,
            "modal_code": modal_code,
            "purity_confidence": purity,
            "valid_pixel_count": int(valid_pixels.size),
            "distribution": {int(c): int(cnt) for c, cnt in zip(codes, counts)}
        }
```

##### 2. Google Earth Engine (GEE)
For complex multi-dataset extraction (e.g., querying CDL, WorldCover, and Dynamic World simultaneously), GEE provides a distributed map-reduce environment.
* **Catalog Assets:**
  * CDL: `ee.ImageCollection("USDA/NASS/CDL")`
  * ESA WorldCover: `ee.ImageCollection("ESA/WorldCover/v100")` (2020), `ee.ImageCollection("ESA/WorldCover/v200")` (2021)
  * Dynamic World: `ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")`

```javascript
// Google Earth Engine: Multi-Year Rotation Extraction Script
var fieldGeom = ee.Geometry.Polygon([[
  [-93.480, 42.030], [-93.470, 42.030],
  [-93.470, 42.040], [-93.480, 42.040], [-93.480, 42.030]
]]);

// Apply 15m inward negative buffer to eliminate perimeter mixed pixels
var bufferedField = fieldGeom.buffer(-15);

// Extract 5-year CDL classification stack
var cdlCol = ee.ImageCollection("USDA/NASS/CDL")
  .filterDate('2020-01-01', '2024-12-31')
  .select('cropland');

var extractYearlyMode = function(image) {
  var year = ee.Date(image.get('system:time_start')).get('year');
  var stats = image.reduceRegion({
    reducer: ee.Reducer.mode().combine({
      reducer2: ee.Reducer.frequencyHistogram(),
      sharedInputs: true
    }),
    geometry: bufferedField,
    scale: 30,
    maxPixels: 1e6
  });
  return ee.Feature(null, {
    'year': year,
    'modal_code': stats.get('cropland_mode'),
    'histogram': stats.get('cropland_histogram')
  });
};

var rotationHistory = cdlCol.map(extractYearlyMode);
```

##### 3. Architectural Trade-Off Analysis
* **CropScape API:** Best for low-volume prototypes with zero infrastructure setup, but constrained by high latency ($>1.5\text{s}$) and no global data.
* **S3 STAC + COG:** Optimal for the production Next.js backend. Sub-150ms execution, zero queue lockups, highly cost-effective, perfectly suited for serverless AWS Lambda or Vercel edge functions.
* **Google Earth Engine:** Best for heavy off-line spatial analytics, continental sequence mining, and training machine learning rotation models.

---

### 4. Integration into the Rotation Engine

The rotation comparison engine (`lib/engine/strategies.ts`, `lib/engine/climate.ts`) evaluates crop choices against local climatic limits, soil constraints, and management goals. Integrating remote sensing land cover history into this engine elevates its capabilities from static heuristic modeling to dynamic, locally contextualized decision support.

```
Integration Flow into the Rotation Planner:
+---------------------------------------------------------------------------------------------------+
| 1. Field Polygon Selected & Buffered                                                              |
+---------------------------------------------------------------------------------------------------+
                               |
                               v
+---------------------------------------------------------------------------------------------------+
| 2. Extract Satellite History (e.g. 2020: Corn, 2021: Soy, 2022: Corn, 2023: Soy)                  |
+---------------------------------------------------------------------------------------------------+
                               |
                               v
+---------------------------------------------------------------------------------------------------+
| 3. Smart Rotation Template Generation                                                             |
|    - Identify Baseline: Corn-Soybean Alternation (Status Quo)                                     |
|    - Auto-Suggest Option A: Soil Health Focus (Corn -> Soy + Cereal Rye Cover -> Wheat + Clover)  |
|    - Auto-Suggest Option B: Water Resilience Focus (Grain Sorghum -> Soy -> Wheat)                 |
+---------------------------------------------------------------------------------------------------+
                               |
                               v
+---------------------------------------------------------------------------------------------------+
| 4. Interactive Farmer Verification ("Memory Assistant")                                           |
|    - Display: "Satellite observed Soybeans in 2023. Is this correct?"                             |
|    - Farmer Confirms or Corrects via One-Tap Dropdown                                             |
+---------------------------------------------------------------------------------------------------+
                               |
                               v
+---------------------------------------------------------------------------------------------------+
| 5. THE FARMER PRIMACY RULE ENFORCED                                                               |
|    - Database flags: farmerConfirmedCropId stored                                                 |
|    - Downstream Engine (GDD, Soil Water Balance, N Carryover, Disease Breaks) runs strictly       |
|      on farmer verified sequence. Satellite data archived to advisory metadata layer.            |
+---------------------------------------------------------------------------------------------------+
```

#### Smart Rotation Templates: Context-Aware Auto-Suggestions
Rather than presenting arbitrary generic rotations, the engine mines the 5-mile radius surrounding the farmer's field to derive regional practice templates.
* **Neighborhood Practice Mining:** The engine executes a spatial buffer query ($r = 8\text{ km}$) across historical CDL layers to extract the empirical distribution of 3- and 4-year rotations. If $74\%$ of surrounding cropland executes a biennial Corn–Soybean rotation, this sequence is established as the empirical **Baseline (Status Quo)**.
* **Contextual Alternative Formulation:** The engine pairs the observed regional baseline with local biophysical datasets to generate two tailored alternatives:
  1. *Soil Health & Diversity Strategy:* Injects an overwinter cover crop and a small grain/legume into the observed cycle (e.g., Corn $\to$ Soybean + Cereal Rye cover $\to$ Winter Wheat + Frost-seeded Red Clover). This breaks corn rootworm (*Diabrotica virgifera*) pressure, adds 140 days of continuous living roots, and provides nitrogen fixation credits ($40\text{--}70\text{ kg N/ha}$).
  2. *Climate & Water Resilience Strategy:* In regions where NASA POWER precipitation reveals high dry-spell frequencies ($>14$ consecutive days without rain during critical July tasseling), the engine substitutes water-demanding corn with drought-tolerant Grain Sorghum or integrates early-maturing varieties to escape late-summer heat stress.
* **Biophysical Feasibility Filtering:** Proposed templates are pre-screened against NASA POWER Growing Degree Days (GDD), frost-free window lengths, and SoilGrids pH/drainage classes to eliminate unviable candidates before the farmer views them.

#### Rotation Verification: Cognitive Memory Assistance
Farmers managing large acreages or dispersed land parcels frequently struggle with accurate historical recall across multi-year intervals (e.g., "Did Field 7 have Soybeans or Corn in 2021?").
* **Non-Intrusive Infill:** When the user enters the `Your rotation` flow (`/fields/:fieldId/rotation`), the app uses satellite observations to populate default recommendations for past seasons.
* **Pre-Fill Verification Pattern:** Rather than presenting a blank form, the UI displays pre-filled historical slots accompanied by an advisory badge:
  * *"In 2022, satellite imagery indicates Field 4 was in Soybeans (92% satellite match). Does this match your records?"*
* **Cognitive Ergonomics:** A single tap allows the farmer to confirm the historical sequence, reducing onboarding friction from several minutes of data entry to a few seconds of review.

#### The Farmer Primacy Rule
The central architectural tenet governing the integration of remote sensing data is the **Farmer Primacy Rule**:
> *Satellite land cover classifications are advisory hypotheses derived from imperfect spectral models; farmer testimony is certified ground truth and always takes absolute precedence.*

##### 1. Architectural Data Schema
The domain data model explicitly isolates satellite inferences from farmer-certified data:

```typescript
// Architectural Data Schema: lib/types.ts Extension
export interface SatelliteObservation {
  dataset: "USDA_CDL" | "ESA_WORLDCOVER" | "DYNAMIC_WORLD";
  resolutionMeters: number;
  rawClassCode: number;
  inferredCropId: string;
  purityScore: number;       // Ratio of modal pixels: e.g. 0.92
  edgeContaminationFlag: boolean;
  observedAt: string;        // ISO timestamp / release date
}

export interface VerifiedRotationSlot {
  slotId: string;
  cycleYear: number;
  
  // Satellite hypothesis (Advisory layer)
  satelliteEvidence?: SatelliteObservation;
  
  // Farmer certified ground truth (Authoritative layer)
  farmerCropId: string;
  isOverridden: boolean;     // True if farmer changed or affirmed the slot
  overrideReason?: "classification_error" | "split_field" | "crop_failure" | "intercropping";
  
  // Agronomic metadata certified by farmer
  plantDate: string;
  harvestDate: string;
  dateConfidence: "exact" | "approx" | "typical";
  irrigationApplied: boolean;
}
```

##### 2. Downstream Computation Invalidation
All downstream mathematical modeling in the rotation engine—including:
* Crop water demand ($ET_c = K_c \times ET_0$),
* Soil organic carbon dynamics,
* Soil water balance depletion ($D_r$),
* Residual soil nitrogen carryover, and
* Pathogen break intervals
**MUST run strictly on `farmerCropId`**. If a farmer overrides a classified Corn pixel with Alfalfa, the engine invalidates the cached satellite-driven metrics and re-executes all soil water and nutrient balances using Alfalfa parameters. Satellite data remains purely as audit metadata.

---

### 5. Spatial & Classification Limitations

Remote sensing classifications are subject to physical, spectral, and geographic limitations that must be addressed algorithmically and communicated transparently.

```
Spatial Resolution & Mixed-Pixel Geometry:
+---------------------------------------+
| Field Boundary (Vector)               |
|      \                                |
|   +---+---+---+---+---+---+           |
|   |   | / | * | * | / |   |   * = Pure Interior Pixel (Sampled)
|   +---+---+---+---+---+---+   / = Edge Mixed Pixel (Discarded by -15m buffer)
|   | / | * | * | * | * | / |       (Contains tree lines, road gravel, ditches)
|   +---+---+---+---+---+---+   +---+
|   |   | / | * | * | / |   |   |   | = 30m CDL Pixel Cell (900 m^2)
|   +---+---+---+---+---+---+   +---+
+---------------------------------------+
```

#### Edge-Pixel Contamination (Mixed Pixels and Boundary Effects)
* **The Resolution Mismatch:** A single 30-meter CDL raster cell encompasses $900\text{ m}^2$ (approximately $0.22\text{ acres}$); a 10-meter Sentinel-2 cell covers $100\text{ m}^2$ ($0.025\text{ acres}$). Field perimeters are bordered by non-agricultural features: gravel roads, drainage ditches, fencerows, grassed waterways, shelterbelts, and hedgerows.
* **Spectral Mixing Physics:** When a 30-meter pixel overlaps both a crop canopy and an adjacent gravel road or oak tree line, the sensor integrates radiance across both surface types. The resulting composite spectral reflectance matches neither pure endmember, frequently causing the classifier to trigger spurious labels (e.g., classifying field edges as Deciduous Forest, Grassland, Shrubland, or Sweet Corn).
* **Algorithmic Mitigation (Inward Negative Buffering):**
  To ensure classification purity, the data pipeline applies an inward negative spatial buffer to the vector polygon prior to raster extraction:
  $$\mathcal{P}_{\text{pure}} = \text{ST\_Buffer}(\mathcal{P}_{\text{field}}, -d)$$
  * For 30m CDL data: $d = 15\text{ to }20\text{ meters}$ (strips one full perimeter pixel ring).
  * For 10m Sentinel-2 / Dynamic World data: $d = 5\text{ to }10\text{ meters}$.
  Only raster cells whose geometric centroids fall within $\mathcal{P}_{\text{pure}}$ are sampled for zonal statistics. If the field is small ($<2\text{ hectares}$) such that negative buffering eliminates $>60\%$ of the polygon area, the pipeline falls back to an area-weighted intersection model and flags the result as `low_spatial_confidence`.

#### Classification Confusion & Spectral Overlap
* **Small Grains Discrimination:**
  Spring wheat, winter wheat, barley, oats, triticale, and rye share nearly identical photosynthetic leaf structures, canopy architectures, and spectral reflectance curves across the VNIR and SWIR spectra. Accurate separation depends on narrow differences in heading dates, flowering, and ripening phenology. In cloudy years where satellite overpasses miss these critical phenological windows, small grains suffer high inter-class classification confusion ($>30\%$ cross-error rates).
* **Pasture / Hay vs. Cover Crops vs. Perennial Grassland:**
  Alfalfa, mixed clover-timothy hay, perennial grass pasture, and winter cover crops (cereal rye) display identical vegetation index plateaus ($\text{NDVI} \approx 0.75\text{--}0.85$). Without multi-year cutting detection (identifying cyclical drops in greenness following mowing or baling), classifiers frequently conflate permanent pasture with rotational forage or fallow cover.
* **Fallow vs. Delayed Planting vs. Drowned-out Spots:**
  Classifying a pixel as "Fallow/Idle" (`Code 61`) does not reveal management intent. A field may be intentionally summer-fallowed for moisture conservation, delayed in planting due to saturated spring soil conditions, or drowned out post-planting by extreme rainfall.

#### Geographic Constraints & Global Deployment Challenges
* **CDL is Strictly CONUS-Only:** The USDA Cropland Data Layer does not cover Alaska, Hawaii, Puerto Rico, or any territory outside the United States border. It cannot be used for global farm analysis.
* **International Proxies & Regional Discrepancies:**
  * *Canada:* Agriculture and Agri-Food Canada (AAFC) Annual Crop Inventory provides 30m crop-specific rasters comparable to CDL.
  * *European Union:* The Land Parcel Identification System (LPIS) and Copernicus-derived national crop maps provide high-resolution crop data, but access policies vary by member state.
  * *Global South (Sub-Saharan Africa, South Asia, Latin America):* Agricultural landscapes are dominated by smallholder plots ($<0.5\text{ to }1.0\text{ hectare}$), irregular field boundaries, continuous intercropping/polyculture (e.g., maize intercropped with beans and cassava), and multi-tiered agroforestry canopies. 
  * *Absence of Crop Species Data Globally:* Global products like ESA WorldCover and Dynamic World differentiate only generic "Cropland" or "Crops" from forest and water; they do not identify crop species. In international regions lacking national crop inventories, crop species history cannot be derived directly from public classification rasters and must rely on harmonic phenology fitting or direct farmer entry.

---

### 6. Farmer Evidence Display Guidelines

Translating complex remote sensing classifications into the Field Almanac user interface (`DESIGN.md`, `UX.md`) requires plain words, honest uncertainty, clear visual hierarchy, and instant editability.

```
+---------------------------------------------------------------------------------------------------+
| FIELD ALMANAC INTERFACE SPECIFICATION (Mobile-First / Light Mode)                                  |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  FIELD 3: NORTH 40                                                                                |
|  Current Rotation Step: Historical Verification                                                   |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | [Satellite Icon] Satellite-observed crop history in this area                                |  |
|  | Satellites estimate what grew here from space, but you know your land best. Tap any year    |  |
|  | to correct it.                                                                              |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | 2023 SEASON                                                                                 |  |
|  | Soybeans                                                        [ High Match: 94% ]         |  |
|  | Pure satellite signal across interior field area.               [ Tap to Change   ]         |  |
|  | Source: USDA Cropland Data Layer (30 m) · Released Feb 2024                                 |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | 2022 SEASON                                                                                 |  |
|  | Maize (Corn)                                                    [ Farmer Verified v ]       |  |
|  | Farmer corrected from original satellite hypothesis (Barley).   (Field Green Badge)         |  |
|  | Verified by you on Nov 14, 2026                                                             |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | 2021 SEASON                                                                                 |  |
|  | Likely Soybeans                                                 [ Mixed Signal: 62% ]       |  |
|  | Boundary tree lines or split-planting detected. Review advised. [ Tap to Confirm  ]       |  |
|  | Source: USDA Cropland Data Layer (30 m)                                                     |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

#### Plain-Language Copy & Tone Standards
Following `UX.md`, the interface opens with a clear sentence in display type, reserves technical indices for secondary lines, and never uses remote sensing jargon.
* **Prohibited Tech Jargon:**
  * *Never use:* "CDL Supervised Raster Extraction", "Zonal Pixel Count", "Markovian Transition Probability", "NDVI Phenological Curve".
* **Approved Plain-Language Framing:**
  * *Headline:* **"Satellite-observed crop history in this area"**
  * *Contextual Guidance:* **"Satellites estimate what grew here from space, but you know your land best. Tap any year to correct it."**
  * *Coarse Grid Context:* For satellite products coarser than the field boundary (or near boundary lines), use **"around your field"** rather than implying a plot-scale measurement.

#### Confidence Indicators & Visual Design
Status colors follow the strict semantic guidelines in `DESIGN.md` (Light mode only, never color alone, always paired with text or an icon):

```
+------------------+---------------------+-----------------------+-------------------------------------------------------+
| Confidence Tier  | Quantitative Metric | UI Status Token       | Visual Display Copy                                   |
+------------------+---------------------+-----------------------+-------------------------------------------------------+
| High Confidence  | Purity >= 85%       | healthy (`#2e5e3a`)   | [Icon: Check] "High match (94%)"                      |
| Moderate / Mixed | 50% <= Purity < 85% | drought (`#765709`)   | [Icon: Split] "Mixed signal (62% - check split field)"|
| Low / Uncertain  | Purity < 50%        | heat / warning        | [Icon: Alert] "Uncertain (mixed small grain / fallow)"|
| Farmer Overridden| Certified by user   | field (`#2e5e3a`)     | [Icon: User]  "Farmer verified"                       |
+------------------+---------------------+-----------------------+-------------------------------------------------------+
```

* **Color Palette Integration:**
  * Background surface: Warm parchment `bg-surface` (`#f4f2ea`), cards on `bg-surface-raised` (`#fbfaf6`).
  * Text: Soil-dark primary `text-ink` (`#1f1d17`), metadata in `text-ink-muted` (`#5a564a`).
  * High match chips: `text-field` (`#2e5e3a`) on `bg-field-soft` (`#dfe8d8`).
  * Mixed signal chips: `text-drought` (`#765709`) on soft background (`#f1e6c8`).

#### Interactive One-Tap Correction Workflow
* **Instant Inline Modal:** Tapping any historical card opens an inline sheet with a searchable crop picker pre-populated with regionally relevant crops (derived from NASS QuickStats priors).
* **Feedback Affirmation:** When a farmer overrides a satellite inference:
  1. The card immediately updates to show a solid **"Farmer verified"** badge.
  2. The satellite hypothesis is archived into a collapsible audit disclosure: *"Satellite originally estimated Soybeans (71% match)"*.
  3. The rotation engine triggers an instant recalculation of historical nutrient and water balances.

#### Provenance and Attribution Footer
Every historical card displays an unvarnished attribution line specifying dataset, resolution, and release date:
> *"Source: USDA Cropland Data Layer · 30 m resolution · Released February 2024"*  
> *"Source: Copernicus Sentinel-2 / Dynamic World · 10 m resolution · Updated weekly"*

If data is unavailable for a given year, the app does not invent a crop or substitute a zero: it displays **"Satellite crop history unavailable for this year"** and provides an empty entry card for the farmer.

---

### 7. Recommendations & Implementation Roadmap

```
+--------------------------------------------------------------------------------------------------+
| IMPLEMENTATION ROADMAP FOR ROTATION ENGINE                                                        |
+--------------------------------------------------------------------------------------------------+
| Phase 1: Ingest Pipeline                                                                         |
| - Connect AWS S3 STAC COG reader with negative polygon buffer (ST_Buffer -15m).                  |
| - Implement fallback to USDA CropScape GetCDLValue / GetCDLStat REST endpoints.                  |
+--------------------------------------------------------------------------------------------------+
| Phase 2: Sequence Mining & Prior Calibration                                                      |
| - Construct 5-year modal sequence extractor with purity scoring.                                 |
| - Ingest county-level NASS QuickStats to weight Bayesian crop priors.                           |
+--------------------------------------------------------------------------------------------------+
| Phase 3: Engine Integration & UX Alignment                                                       |
| - Integrate historical sequences into lib/engine/strategies.ts smart template generator.         |
| - Enforce the Farmer Primacy Rule: isolate satellite hypotheses from calculation engine.         |
| - Deploy Field Almanac UI verification cards with one-tap farmer correction.                     |
+--------------------------------------------------------------------------------------------------+
```

1. **Adopt S3 STAC COGs as Primary Access:** Deprecate synchronous reliance on the legacy CropScape REST API for user-facing flows. Implement S3 Range-Request COG extraction using `rio-tiler` or TiTiler microservices to achieve sub-150ms response times.
2. **Apply Spatial Buffers Systematically:** Enforce an automatic $-15\text{ m}$ inward buffer on all field polygons before calculating CDL zonal statistics to eliminate boundary false-positives.
3. **Respect Geographic Boundaries:** Maintain CDL for CONUS fields. For international fields, immediately branch to ESA WorldCover for arable mask validation, paired with Sentinel-2 phenology extraction or direct farmer entry, communicating the geographic constraint clearly to the user.
4. **Enforce Farmer Primacy Across All Engine Calculations:** Ensure that the crop rotation engine never uses unconfirmed satellite classifications to compute agronomic metrics when farmer input is available.

---
*Report certified for engineering implementation in the NASA Farming App rotation engine architecture.*

---

## Agent 9: FAO-56 Crop Parameters, FAO GAEZ v4 & Ag Data Commons
**Specialist Role:** Agronomic Rules & Crop Library Architect

# Technical Research Report: Agronomic Frameworks, Crop Parameter Libraries, and Rotational Evaluation Heuristics

---

### 1. Agronomic Frameworks & Standards

#### 1.1 FAO-56 Irrigation and Drainage Paper
The Food and Agriculture Organization (FAO) Irrigation and Drainage Paper No. 56 (*Crop Evapotranspiration: Guidelines for Computing Crop Water Requirements*, Allen et al., 1998) defines the international standard for calculating reference evapotranspiration ($ET_0$) and crop evapotranspiration ($ET_c$).

##### 1.1.1 The Reference Evapotranspiration Standard ($ET_0$)
FAO-56 standardizes the Penman-Monteith formulation to compute the evaporation demand of an idealized, well-watered reference surface consisting of an extensive surface of green, well-watered grass of uniform height ($h = 0.12\text{ m}$), with an active surface resistance ($r_s = 70\text{ s}\cdot\text{m}^{-1}$) and an albedo of $\alpha = 0.23$:

$$ET_0 = \frac{0.408 \Delta (R_n - G) + \gamma \frac{900}{T + 273} u_2 (e_s - e_a)}{\Delta + \gamma (1 + 0.34 u_2)}$$

*Where:*
- $ET_0$: Reference evapotranspiration [$\text{mm}\cdot\text{day}^{-1}$].
- $R_n$: Net radiation at the crop surface [$\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$].
- $G$: Soil heat flux density [$\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$] (assumed $\approx 0$ across a 24-hour diurnal period).
- $T$: Mean daily air temperature at $2\text{ m}$ height [$^\circ\text{C}$].
- $u_2$: Wind speed at $2\text{ m}$ height [$\text{m}\cdot\text{s}^{-1}$].
- $e_s$: Saturation vapor pressure [$\text{kPa}$], calculated as the mean of $e^0(T_{max})$ and $e^0(T_{min})$.
- $e_a$: Actual vapor pressure [$\text{kPa}$].
- $e_s - e_a$: Saturation vapor pressure deficit ($VPD$) [$\text{kPa}$].
- $\Delta$: Slope of the saturation vapor pressure-temperature curve [$\text{kPa}\cdot^\circ\text{C}^{-1}$].
- $\gamma$: Psychrometric constant [$\text{kPa}\cdot^\circ\text{C}^{-1}$], proportional to atmospheric pressure ($P_{atm}$).

##### 1.1.2 Single Crop Coefficient Methodology
Crop water demand under standard, non-stressed conditions ($ET_c$) integrates crop physiology and soil surface evaporation into a single dimensionless coefficient ($K_c$):

$$ET_c = K_c \cdot ET_0$$

The single $K_c$ curve divides the crop life cycle into four distinct phenological stages:
1. **Initial Stage ($L_{ini}$):** Sowing or transplanting until approximately 10% ground cover. $K_{c,\text{ini}}$ is primarily dictated by soil evaporation and wetting frequency.
2. **Crop Development Stage ($L_{dev}$):** From 10% ground cover to full ground cover / effective full canopy cover (Leaf Area Index $LAI \approx 3$). $K_c$ transitions linearly from $K_{c,\text{ini}}$ to $K_{c,\text{mid}}$.
3. **Mid-Season Stage ($L_{mid}$):** From effective full cover to the initiation of maturity (canopy senescence, leaf yellowing, or browning of grain/pods). $K_c$ plateaus at $K_{c,\text{mid}}$.
4. **Late-Season Stage ($L_{late}$):** From the onset of senescence until physiological maturity or harvest. $K_c$ drops linearly from $K_{c,\text{mid}}$ to $K_{c,\text{end}}$.

```
  Kc
   ▲
   │                  ┌───────────────────┐ (Kc_mid)
   │                 /                     \
   │                /                       \
   │   (Kc_ini) ───/                         \─── (Kc_end)
   │
   └───────────────┴───────────┴───────────┴──────────► Time
         L_ini         L_dev       L_mid       L_late
```

##### 1.1.3 Climate Correction for Mid- and Late-Season Coefficients
Standard published values for $K_{c,\text{mid}}$ and $K_{c,\text{end}}$ assume a sub-humid climate where minimum relative humidity $RH_{min} \approx 45\%$ and average wind speed $u_2 \approx 2.0\text{ m}\cdot\text{s}^{-1}$. In arid, windy, or highly humid environments, adjustments are mandatory when crop height $h > 0.1\text{ m}$:

$$K_{c,\text{stage}} = K_{c,\text{stage(Table)}} + \left[0.04(u_2 - 2) - 0.004(RH_{min} - 45)\right] \left(\frac{h}{3}\right)^{0.3}$$

*Where $h$ is the mean maximum plant height in meters ($0.1 \le h \le 10$).*

---

#### 1.2 FAO GAEZ v4 (Global Agro-Ecological Zones)
The FAO/IIASA Global Agro-Ecological Zones (GAEZ v4) system establishes an agro-climatic zoning framework that determines the biophysical limitations and production potential of specific crops under distinct management regimes.

##### 1.2.1 Length of Growing Period (LGP)
The central operational concept of GAEZ is the **Length of Growing Period (LGP)**, defined as the continuous period of days during the year when both thermal conditions and moisture availability permit rainfed crop growth.

1. **Thermal Criterion:** Mean daily temperature $T_{mean} \ge 5.0^\circ\text{C}$ (or $T_{base}$ for specific crop eco-types).
2. **Moisture Balance Criterion:**
   - **Beginning of LGP:** The date when precipitation ($P$) equals or exceeds half the reference evapotranspiration ($P \ge 0.5 \cdot ET_0$).
   - **Humid Period:** The window within the LGP where $P \ge ET_0$. During this phase, crops achieve full transpiration and excess moisture charges the soil water profile.
   - **End of Rainy Season:** When $P$ drops below $0.5 \cdot ET_0$.
   - **End of LGP:** The date when the soil moisture reservoir ($AWC$, default standardized at $100\text{ mm}$ for medium-textured soils) is fully exhausted after $P$ drops below $0.5 \cdot ET_0$:
   
$$LGP = \text{Days}(P \ge 0.5 \cdot ET_0) + \text{Days}\left(\text{Soil Storage Depletion to 0}\right)$$

##### 1.2.2 Thermal Regimes and Agro-Climatic Suitability Tiers
GAEZ groups temperature regimes by cumulative thermal summation:
- **Thermal Climates:** Defined by latitude, altitude, and temperature amplitude (e.g., Tropics, Subtropics with summer/winter rainfall, Temperate oceanic/continental, Boreal).
- **Thermal Zones:** Segmented by growing degree day accumulation ($GDD_0, GDD_5, GDD_{10}$) during the frost-free season.

**GAEZ v4 Suitability Classification Tiers:**
Suitability indices ($SI$) represent the percentage of the constraint-free maximum agro-climatic potential yield ($Y_{pot}$) achievable after discounting for agro-climatic constraints (pests, diseases, workability, thermal stress, moisture deficit):

| Tier Code | Suitability Class | Yield Attainment Index ($SI$) | Agronomic Interpretation |
| :--- | :--- | :--- | :--- |
| **VS** | Very Suitable | $80\% \le SI \le 100\%$ | Optimal climate and soil conditions; negligible crop-specific risk. |
| **S** | Suitable | $60\% \le SI < 80\%$ | Slight climate or soil constraints; near-optimal productivity achievable. |
| **MS** | Moderately Suitable | $40\% \le SI < 60\%$ | Moderate constraints; yield depression expected without targeted management. |
| **mS** | Marginally Suitable | $20\% \le SI < 40\%$ | Severe constraints; high risk of economic crop failure in dry/cool years. |
| **NS** | Not Suitable | $SI < 20\%$ | Biophysically incompatible; critical thermal or moisture deficits prevent maturity. |

GAEZ evaluates these tiers across three standardized **Input/Management Levels**:
- **High:** Mechanized, certified seed, full synthetic fertility according to yield potential, rigorous chemical pest/weed control.
- **Intermediate:** Partly mechanized, improved seeds, moderate chemical fertilizer and pesticide inputs, traditional rotation context.
- **Low:** Rainfed, manual labor/animal traction, landrace seeds, zero purchased synthetic inputs, high fallow reliance.

---

#### 1.3 USDA Ag Data Commons & Open Agronomic Repositories
The USDA Ag Data Commons is the open-access scientific repository maintained by the National Agricultural Library (NAL) and the Agricultural Research Service (ARS). It supplies empirical data required to calibrate and ground-truth crop models (e.g., DSSAT, APSIM).

##### 1.3.1 Key Agronomic Networks and Data Assets
- **Long-Term Agroecosystem Research (LTAR) Network:**
  - 18 regional field research sites representing major US agricultural production regions (e.g., Central Mississippi River Basin, Upper Chesapeake Bay, Northern Plains, Southern Plains).
  - Paired-catchment experimental design: Evaluates "Business-As-Usual" (BAU) versus "Aspirational" sustainable intensification practices (reduced tillage, multi-species cover cropping, precision nutrient management) monitored across multi-decadal timelines.
- **Precision Sustainable Agriculture (PSA) Network:**
  - Nationwide network monitoring real-time cover crop performance across hundreds of on-farm and research-station plots.
  - Data streams include: Biomass accumulation, C:N decomposition kinetics via litterbag studies, soil moisture draw-down dynamics using continuous capacitance sensors, and cash crop nitrogen substitution rates.
- **Classical Long-Term Rotation Experiments:**
  - **Morrow Plots (Urbana-Champaign, IL; est. 1876):** Demonstrates long-term effects of continuous corn monoculture versus corn-oats-clover rotations on soil organic carbon and yield stability.
  - **Sanborn Field (Columbia, MO; est. 1888):** Century-long evaluation of continuous cropping versus diverse rotations under varying fertility treatments.

##### 1.3.2 Data Schemas and Model Interoperability
Agronomic repositories adhere to the **ICASA (International Consortium for Agricultural Systems Applications)** standards and AgMIP (Agricultural Model Intercomparison and Improvement Project) formats:
- **Experiment Data (.EXP):** Field geometry, weather station linkage, soil profile cross-reference.
- **Soil Profiles (.SOL):** Horizon depths, bulk density, organic carbon ($SOC$), saturated hydraulic conductivity ($K_{sat}$), lower limit of plant-extractable water ($LL$), and drained upper limit ($DUL$).
- **Management Operations (.MGT):** Planting dates, planting depth, plant population ($plants\cdot m^{-2}$), fertilizer split applications (chemical form, depth, rate), tillage depth, and irrigation events.

---

### 2. Crop Growth Parameters & Thermal Requirements

#### 2.1 Thermal Requirements and Growing Degree Day (GDD) Formulations
Plant development is largely driven by thermal accumulation. The basic linear rate of phenological development is quantified using Growing Degree Days ($GDD$).

##### 2.1.1 GDD Calculation Methods
1. **Simple Mean Daily Temperature:**
   $$GDD_d = \max\left(0, \frac{T_{max,d} + T_{min,d}}{2} - T_{base}\right)$$

2. **Modified 86/50 Method (Maize / Sorghum Standard):**
   To prevent mathematical overestimation during extreme heat or cessation during cold nights, temperature cutoffs are enforced prior to averaging:
   $$T_{max}^* = \min\left(T_{upper}, \max(T_{base}, T_{max,d})\right)$$
   $$T_{min}^* = \max\left(T_{base}, \min(T_{upper}, T_{min,d})\right)$$
   $$GDD_d = \frac{T_{max}^* + T_{min}^*}{2} - T_{base}$$
   *(For maize: $T_{base} = 10^\circ\text{C}\ [50^\circ\text{F}]$, $T_{upper} = 30^\circ\text{C}\ [86^\circ\text{F}]$).*

##### 2.1.2 Benchmark Thermal Parameters by Crop

| Crop | Scientific Name | Botanical Family | $T_{base}$ ($^\circ\text{C}$) | $T_{opt}$ Range ($^\circ\text{C}$) | $T_{upper}$ ($^\circ\text{C}$) | Cumulative GDD to Maturity ($^\circ\text{C}\cdot\text{d}$) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Maize (Corn)** | *Zea mays* | Poaceae | 10.0 | 25 – 32 | 34 – 35 | 1100 – 1650 (CRM 80–115) |
| **Grain Sorghum** | *Sorghum bicolor* | Poaceae | 10.0 | 28 – 34 | 38 – 40 | 1150 – 1500 |
| **Soybean** | *Glycine max* | Fabaceae | 10.0 | 22 – 30 | 35 – 36 | 1100 – 1450 (MG 00–V) |
| **Spring Wheat** | *Triticum aestivum* | Poaceae | 0.0 | 18 – 24 | 32 – 34 | 1400 – 1800 ($T_b = 0$) |
| **Winter Wheat** | *Triticum aestivum* | Poaceae | 0.0 (4.0 post-vernal) | 15 – 22 | 30 – 32 | 1600 – 2100 ($T_b = 0$) |
| **Canola / Rapeseed**| *Brassica napus* | Brassicaceae | 5.0 | 18 – 22 | 30 – 32 | 1100 – 1450 |
| **Field Pea** | *Pisum sativum* | Fabaceae | 2.0 – 3.0 | 15 – 20 | 28 – 30 | 900 – 1250 ($T_b = 3$) |
| **Cowpea** | *Vigna unguiculata*| Fabaceae | 11.0 | 26 – 34 | 40 – 42 | 850 – 1150 |
| **Groundnut (Peanut)**| *Arachis hypogaea* | Fabaceae | 12.0 – 13.0 | 25 – 32 | 38 – 40 | 1250 – 1500 |
| **Crimson Clover** | *Trifolium incarnatum*| Fabaceae | 5.0 | 14 – 22 | 30.0 | 650 – 900 (to bloom) |

---

#### 2.2 Critical Reproductive Heat Shock Thresholds & Biological Mechanisms
While vegetative growth is moderately plastic across temperature gradients, anthesis and gametogenesis are highly vulnerable to short-duration acute heat events.

```
       POLLEN STERILITY / FLOWER ABORTION WINDOW
                       │
       ┌───────────────▼───────────────┐
───────┤ Anthesis / Silking / Bloom    ├───────► Grain Filling
       └───────────────────────────────┘
  Maize:   T_max > 35°C (pollen desiccates in 15-30 min)
  Canola:  T_max > 30°C (tapetum degeneration in anthers)
  Wheat:   T_max > 32°C (starch synthase enzyme denatures)
```

##### 2.2.1 Maize (*Zea mays*): $T_{max} > 35^\circ\text{C}$
- **Vulnerable Stage:** Silking and anthesis (VT to R1 stage).
- **Physiological Mechanism:**
  - **Pollen Desiccation:** Viable pollen shed under conditions of air temperature $> 35^\circ\text{C}$ accompanied by high vapor pressure deficit ($VPD > 3.0\text{ kPa}$) desiccates within 15 to 30 minutes, losing cellular membrane integrity before the pollen tube can germinate on the silk.
  - **Silk Senescence:** Exposed silks dehydrate rapidly, losing receptivity to pollen.
  - **Anthesis-Silking Interval (ASI) Elongation:** Heat and water stress delay silk emergence relative to pollen shed. Pollen shed finishes before silks emerge, leaving ovules unfertilized and resulting in barren cobs or incomplete grain sets ("kernel blast").

##### 2.2.2 Canola (*Brassica napus*): $T_{max} > 30^\circ\text{C}$
- **Vulnerable Stage:** Flowering / Anthesis (BBCH 60–69).
- **Physiological Mechanism:**
  - **Tapetum Layer Necrosis:** Temperatures exceeding $30^\circ\text{C}$ (and acutely $> 32^\circ\text{C}$) for as little as 4 hours daily cause the premature degeneration of the nutritive tapetal layer within the anthers, inducing male sterility.
  - **Floral Bud Blight and Abscission:** The plant arrests developable buds; young pods (siliques) abort within 3 to 5 days of fertilization.
  - **Seed Size & Quality Depletion:** Surviving pods exhibit significantly reduced seed counts per pod and an irreversible reduction in triacylglycerol (oil) synthesis accompanied by increased protein fraction.

##### 2.2.3 Wheat (*Triticum aestivum*): $T_{max} > 32^\circ\text{C}$
- **Vulnerable Stage:** Anthesis (Zadoks 60–69) and Early Grain Fill (Zadoks 70–77).
- **Physiological Mechanism:**
  - **Microspore Abortive Failure:** Heat shock at meiosis leads to deformed, non-viable pollen grains and floret sterility.
  - **Starch Synthase Inactivation:** Soluble starch synthase—the primary enzyme synthesizing amylose and amylopectin in the wheat endosperm—is thermally unstable. Its activity drops precipitously at temperatures above $32^\circ\text{C}$ and halts completely above $35^\circ\text{C}$.
  - **Shortened Grain Filling Window:** The grain-filling rate cannot compensate for the accelerated duration, resulting in shriveled kernels, high screenings, and depressed Thousand Grain Weight (TGW).

---

#### 2.3 Frost Vulnerability & Lethal Freezing Thresholds by Phenological Stage
Plant freezing injury is driven by the crystallization of apoplastic water. Extracellular ice crystals lower the apoplastic water potential, pulling intracellular water across the plasma membrane and causing severe dehydration. When ice breaches the plasma membrane (intracellular freezing), cytolytic cellular death is instantaneous.

##### 2.3.1 Phenological Frost Sensitivity Matrix

| Crop | Phenological Stage | Mild Frost Impact ($T_{min}$) | Lethal Freezing Threshold ($T_{kill}$) | Symptoms & Agronomic Management |
| :--- | :--- | :--- | :--- | :--- |
| **Maize** | Emergence to VE–V4 | $-1.0^\circ\text{C}$ (leaf scorch) | $-2.5^\circ\text{C}$ to $-3.0^\circ\text{C}$ (if ground freezes) | Growing point remains 2–3 cm underground; plants usually recover unless soil freezing hits apical meristem. |
| **Maize** | Post-V6 to Reproductive | $-0.5^\circ\text{C}$ | $-1.5^\circ\text{C}$ to $-2.0^\circ\text{C}$ | Meristem is elevated above soil surface; frost causes complete plant death; early frost at milk stage (R3) halts starch deposition. |
| **Soybean** | Emergence (VE–VC) | $-0.5^\circ\text{C}$ | $-2.0^\circ\text{C}$ | Cotyledons are cold-hardy; damage below cotyledonary node is fatal. |
| **Soybean** | Flowering & Pod Fill (R1–R6) | $-0.5^\circ\text{C}$ | $-1.5^\circ\text{C}$ | Blossoms and developing pods abort; frosted green seeds fail to mature properly, resulting in permanently docked discolored seeds. |
| **Winter Wheat** | Winter Dormancy / Rosette | Hardened plants tolerate $-12^\circ\text{C}$ to $-18^\circ\text{C}$ | $-20.0^\circ\text{C}$ to $-24.0^\circ\text{C}$ (without snow cover) | Hardening accumulates soluble sugars (proline, sucrose) as cryoprotectants. Snow cover ($> 5\text{ cm}$) insulates crowns by up to $10^\circ\text{C}$. |
| **Winter Wheat** | Jointing (Zadoks 31–39) | $-2.0^\circ\text{C}$ | $-4.0^\circ\text{C}$ | Apical stem elongation exposes the developing ear; vascular tissue freezing leads to broken or collapsed stems. |
| **Wheat (All)**| Boot to Anthesis (Zadoks 50–69) | $0.0^\circ\text{C}$ | $-1.5^\circ\text{C}$ to $-2.0^\circ\text{C}$ | Floret sterility; head emerges bleached and completely empty ("blind heads"). |
| **Canola** | Rosette / Vegetative | Hardened: $-8.0^\circ\text{C}$ | $-12.0^\circ\text{C}$ to $-15.0^\circ\text{C}$ | Winter canola tolerates sub-zero conditions once acclimated. Spring canola seedlings tolerate $-4^\circ\text{C}$. |
| **Canola** | Bolting & Flowering | $-1.0^\circ\text{C}$ | $-2.5^\circ\text{C}$ | Floral buds blister and turn white; branches abort; developing pods show blistered pericarps and seed abortion. |
| **Cowpea** | Any vegetative stage | $+4.0^\circ\text{C}$ (chilling injury) | $-0.5^\circ\text{C}$ | Extreme sensitivity to cold. Non-freezing temperatures $< 5^\circ\text{C}$ cause permanent chlorosis and metabolic collapse. |

---

### 3. Crop Water Demand & Evapotranspiration

#### 3.1 FAO-56 Crop Coefficients and Phenological Stage Lengths
Crop stage lengths vary according to climate, cultivar maturity rating, and planting date. Standard values derived from FAO-56 (Table 11 & Table 12) provide the baseline for single crop coefficient modeling.

##### 3.1.1 Parametric Values for Core Cropping Systems

| Crop | $K_{c,\text{ini}}$ | $K_{c,\text{mid}}$ | $K_{c,\text{end}}$ | Stage Length ($L_{ini}$) [days / %] | Stage Length ($L_{dev}$) [days / %] | Stage Length ($L_{mid}$) [days / %] | Stage Length ($L_{late}$) [days / %] | Maximum Height ($h$) [m] |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Maize (Grain)** | 0.30 | 1.20 | 0.35 – 0.60 | 20 d / 15% | 35 d / 27% | 45 d / 36% | 30 d / 22% | 2.0 – 2.5 |
| **Sorghum** | 0.30 | 1.05 | 0.55 | 20 d / 15% | 35 d / 27% | 45 d / 36% | 30 d / 22% | 1.5 – 2.0 |
| **Soybean** | 0.40 | 1.15 | 0.50 | 20 d / 15% | 30 d / 23% | 50 d / 38% | 30 d / 24% | 0.8 – 1.0 |
| **Winter Wheat** | 0.40 | 1.15 | 0.25 – 0.40 | 150 d* / 60% | 30 d / 12% | 45 d / 18% | 25 d / 10% | 1.0 |
| **Spring Wheat** | 0.30 | 1.15 | 0.25 – 0.40 | 20 d / 17% | 30 d / 25% | 45 d / 37% | 25 d / 21% | 1.0 |
| **Groundnut** | 0.40 | 1.15 | 0.60 | 25 d / 19% | 35 d / 27% | 45 d / 35% | 25 d / 19% | 0.4 – 0.6 |
| **Cowpea** | 0.35 | 1.05 | 0.45 – 0.60 | 20 d / 22% | 25 d / 28% | 30 d / 33% | 15 d / 17% | 0.6 – 0.8 |
| **Canola** | 0.35 | 1.10 | 0.35 | 25 d / 20% | 35 d / 28% | 45 d / 36% | 20 d / 16% | 1.2 – 1.5 |
| **Crimson Clover**| 0.40 | 1.05 | 0.80 | 30 d / 25% | 35 d / 29% | 40 d / 33% | 15 d / 13% | 0.5 |

*\*Note: Winter wheat $L_{ini}$ includes overwinter dormancy periods under temperate climatic conditions.*

---

#### 3.2 Evapotranspiration Calculations and Moisture Stress ($K_s$)
When soil water extraction depletes the root zone past a critical fraction, the stomata begin to close, and actual crop evapotranspiration drops below potential $ET_c$.

##### 3.2.1 The Water Stress Coefficient ($K_s$)
The transpiration reduction factor is modeled as:

$$ET_{c,\text{adj}} = K_s \cdot K_c \cdot ET_0$$

$$K_s = \begin{cases} 
1.0 & \text{if } D_r \le RAW \\
\frac{TAW - D_r}{TAW - RAW} = \frac{TAW - D_r}{(1 - p) TAW} & \text{if } RAW < D_r \le TAW \\
0.0 & \text{if } D_r > TAW
\end{cases}$$

*Where:*
- $D_r$: Root-zone soil water depletion [$\text{mm}$].
- $TAW$: Total available water in the root zone [$\text{mm}$].
- $RAW$: Readily available water in the root zone [$\text{mm}$].
- $p$: Soil water depletion fraction without water stress ($0 < p < 1$).

```
  Ks
 1.0 ──────────────┐ (No stress: Dr <= RAW)
     │              \
     │               \   (Linear stress: Ks = (TAW - Dr) / ((1 - p) * TAW))
     │                \
 0.0 ┴─────────────────┴──────────────────► Dr
     0                RAW                TAW
```

##### 3.2.2 Temperature-Only Fallback for $ET_0$: Hargreaves-Samani (1985)
Where solar radiation, relative humidity, or wind run datasets are missing or uncalibrated, the Hargreaves-Samani equation provides a robust temperature-based proxy:

$$ET_0 = 0.0023 \cdot (T_{mean} + 17.8) \cdot (T_{max} - T_{min})^{0.5} \cdot 0.408 R_a$$

*Where $R_a$ is extraterrestrial solar radiation [$\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$] derived strictly from site latitude and day of year ($DOY$), and $0.408$ converts $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$ to equivalent depth of water in $\text{mm}\cdot\text{day}^{-1}$.*

---

#### 3.3 Rooting Depth ($Z_r$) and Soil Water Depletion Fractions ($p$)
The total soil moisture reservoir accessible to a crop depends on soil texture and dynamic rooting depth.

##### 3.3.1 Available Water Capacity ($AWC$) and $TAW$ Formulation
Total Available Water ($TAW$) is the depth of water held between Field Capacity ($\theta_{FC}$, metric suction $-33\text{ kPa}$) and Permanent Wilting Point ($\theta_{WP}$, metric suction $-1500\text{ kPa}$):

$$AWC = \theta_{FC} - \theta_{WP}$$

$$TAW = 1000 \cdot (\theta_{FC} - \theta_{WP}) \cdot Z_r$$

*Where:*
- $AWC$: Volumetric available water capacity [$\text{m}^3\cdot\text{m}^{-3}$ or $\text{mm}\text{ water}\cdot\text{m}^{-1}\text{ soil}$].
- $Z_r$: Current effective rooting depth [$\text{m}$].

##### 3.3.2 Climatological Adjustment of Depletion Fraction ($p$)
The tabular depletion fraction ($p_{Tab}$) represents the fraction of $TAW$ that can be extracted without stress under an evaporative demand of $ET_c \approx 5\text{ mm}\cdot\text{day}^{-1}$. Under higher evaporative demand, plants experience stress earlier; under lower demand, they can deplete more soil moisture before stress sets in:

$$p_{\text{adj}} = p_{\text{Tab}} + 0.04 \cdot (5 - ET_c)$$

*(Constrained by the bounds: $0.10 \le p_{\text{adj}} \le 0.80$).*

##### 3.3.3 Crop-Specific Rooting Depths and Depletion Fractions

| Crop | Minimum Root Depth ($Z_{r,\text{ini}}$) [m] | Maximum Root Depth ($Z_{r,\text{max}}$) [m] | Depletion Fraction ($p_{\text{Tab}}$) | Comments on Water Extraction Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Maize** | 0.30 | 1.20 – 1.80 | 0.55 | Concentrated in upper 0.8m; extracts up to 1.5m in deep, uncompacted loam. |
| **Grain Sorghum** | 0.30 | 1.50 – 2.00 | 0.55 – 0.60 | Dense, deep fibrous root architecture; excellent subsoil scavenging. |
| **Soybean** | 0.25 | 1.00 – 1.30 | 0.50 | Moderate root density; 80% extraction occurs in the top 0.6m. |
| **Winter Wheat** | 0.30 | 1.40 – 1.80 | 0.55 | Deep subsoil extraction profile developed over extended vegetative cycle. |
| **Spring Wheat** | 0.25 | 1.00 – 1.30 | 0.55 | Fast rooting rate down to 1.0–1.2m. |
| **Canola** | 0.25 | 1.20 – 1.60 | 0.60 | Strong taproot system; can break through weak plow pans. |
| **Cowpea** | 0.25 | 1.00 – 1.20 | 0.60 | Highly adapted to drought; rapid taproot expansion during early development. |
| **Groundnut** | 0.25 | 0.80 – 1.00 | 0.50 | Shallow, broad rooting system; sensitive to subsoil compaction. |
| **Crimson Clover**| 0.20 | 0.60 – 0.80 | 0.50 | Fibrous root system; concentrated primarily within the top 0.4m. |

---

### 4. Soil Compatibility & Chemical Tolerances

#### 4.1 Soil pH Envelopes & Micronutrient Availability
Soil reaction (pH) directly governs soil chemical equilibria, controlling the solubility, mobility, and precipitation of plant nutrients and toxic metal ions.

##### 4.1.1 Biophysical Mechanisms
- **Acid Soils ($pH < 5.5$):**
  - **Aluminum ($Al^{3+}$) and Manganese ($Mn^{2+}$) Toxicity:** Soluble exchangeable aluminum ($Al^{3+}$) hydrolyzes in the soil solution, destroying root tip cells and inhibiting root elongation and branching.
  - **Phosphorus Fixation:** Orthophosphate anions ($H_2PO_4^-$) react with soluble iron ($Fe^{3+}$) and aluminum ($Al^{3+}$) to form insoluble precipitates (strengite and variscite), drastically lowering phosphorus bioavailability.
  - **Inhibition of Symbiotic Fixation:** Legume-rhizobia symbioses fail: *Rhizobium* bacterial survival in the rhizosphere is impaired, nodulation is blocked, and nitrogenase enzyme activity drops sharply.
- **Alkaline and Calcareous Soils ($pH > 7.5\text{--}8.2$):**
  - **Calcareous P Fixation:** Phosphate reacts with calcium carbonate ($CaCO_3$) to precipitate as dicalcium phosphate and ultimately insoluble hydroxyapatite.
  - **Micronutrient Chlorosis:** Iron ($Fe$), Zinc ($Zn$), and Manganese ($Mn$) are oxidized into insoluble hydroxides, causing interveinal chlorosis in sensitive crops like soybean, sorghum, and groundnut.

##### 4.1.2 pH Tolerance Tiers

```
  Crop Response to pH
  ────────────────────────────────────────────────────────────────────────
  Outside Range    Tolerated      Preferred (Optimal)      Tolerated    Outside
  [Severe Stress]  [Yield Drag]                            [Chlorosis]  [Severe Stress]
  ───────────────┬────────────┬──────────────────────────┬────────────┬──────────────► pH
                pH_min      pH_opt_low                pH_opt_high    pH_max
```

| Crop | $pH_{\min}$ (Absolute) | $pH_{opt,\text{low}}$ | $pH_{opt,\text{high}}$ | $pH_{\max}$ (Absolute) | Primary Limiting Factor at Extremes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Maize** | 5.0 | 5.8 | 7.0 | 8.0 | $Al^{3+}$ toxicity below 5.0; Zn/P deficiency above 7.8 |
| **Soybean** | 5.5 | 6.2 | 7.0 | 7.8 | Nodulation failure below 5.5; Iron Deficiency Chlorosis (IDC) $> 7.5$ |
| **Sorghum** | 5.0 | 6.0 | 7.5 | 8.5 | High tolerance to alkaline soils; susceptible to Al toxicity $< 5.0$ |
| **Wheat** | 5.2 | 6.0 | 7.2 | 8.2 | Aluminum toxicity inhibits root branching below 5.0 |
| **Canola** | 5.5 | 6.0 | 7.0 | 8.0 | Acid-sensitive; high susceptibility to Clubroot (*Plasmodiophora brassicae*) $< 6.0$ |
| **Groundnut** | 5.0 | 5.8 | 6.5 | 7.5 | Prefers slightly acidic soils; pod rot and Fe chlorosis $> 7.5$ |
| **Cowpea** | 4.8 | 5.5 | 6.8 | 8.0 | Very tolerant of acid soils and high exchangeable aluminum |
| **Crimson Clover**| 5.2 | 6.0 | 6.8 | 7.5 | Nodulation stops below 5.2 |

---

#### 4.2 Soil Drainage Classes & Waterlogging Tolerance
Soil drainage reflects the frequency and duration of periods when the soil root zone is saturated with water. The USDA NRCS defines seven standard drainage classes:
1. **Excessively Drained (ED):** Coarse sands; water moves very rapidly; extremely low water-holding capacity.
2. **Somewhat Excessively Drained (SED):** Sandy, rapid percolation; drought-prone.
3. **Well Drained (WD):** Water moves through readily but holds sufficient water for plant growth; no redoximorphic features within the upper 1.0 m.
4. **Moderately Well Drained (MWD):** Water removed somewhat slowly; seasonal saturation within 0.5–1.0 m depth.
5. **Somewhat Poorly Drained (SPD):** Surface or subsoil waterlogged for significant periods during the growing season; gleying or mottling common at 0.2–0.4 m.
6. **Poorly Drained (PD):** Water moves so slowly that the soil remains wet near the surface for long periods; shallow water table.
7. **Very Poorly Drained (VPD):** Water table remains at or above the ground surface for most of the year.

##### 4.2.1 Biophysical Mechanism of Waterlogging (Anoxia)
Excess soil water fills macropores, reducing oxygen diffusion by roughly $10{,}000$-fold compared to air. Within 24–48 hours at warm temperatures, soil oxygen is completely exhausted by root and microbial respiration:
- **Metabolic Arrest:** Roots switch from aerobic oxidative phosphorylation ($36\text{ ATP}\cdot\text{mol}^{-1}\text{ glucose}$) to anaerobic fermentation ($2\text{ ATP}\cdot\text{mol}^{-1}$), rapidly draining carbohydrate reserves and accumulating toxic ethanol, acetaldehyde, and lactic acid.
- **Nutrient Starvation:** ATP-dependent ion transport pumps ($H^+$-ATPases) shut down, stopping nitrate, phosphate, and potassium uptake.
- **Nitrogen Loss:** Denitrifying bacteria convert soil nitrates into gaseous nitrous oxide ($N_2O$) and nitrogen gas ($N_2$).

##### 4.2.2 Drainage Class Suitability Matrix

| Crop | Ideal Drainage Classes | Tolerated Drainage Classes | Prohibited / Vulnerable Classes | Waterlogging Mechanism & Agronomic Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Groundnut** | WD, SED, ED | MWD | SPD, PD, VPD | Saturated soils cause pod rot, fungal pod blight, and mechanical pegging failure. |
| **Canola** | WD | MWD | SPD, PD, VPD | Extreme sensitivity to waterlogging during early seedling and rosette stages. |
| **Maize** | WD, MWD | SPD (with artificial tile) | PD, VPD | Seedlings die after 48–72 hours of complete submergence; stunted root architecture. |
| **Soybean** | WD, MWD | SPD | PD, VPD | Tolerates short saturation events better than maize, but sudden-death syndrome (*Fusarium virguliforme*) thrives. |
| **Sorghum** | WD, MWD | SPD, PD (moderate) | VPD | Substantially more tolerant of temporary root saturation than maize. |
| **Cowpea** | WD, SED, ED | MWD | SPD, PD, VPD | Root and crown rots (*Pythium*, *Phytophthora*) develop rapidly in wet profiles. |
| **Wheat** | WD, MWD | SPD | PD, VPD | Crown rot and *Fusarium* foot rot flourish; tillering stops under wet conditions. |

---

#### 4.3 Salinity Tolerances and the Maas-Hoffman Model
Salinity degrades crop performance through an osmotic effect (lowering soil water potential, making water uptake difficult) and specific ion toxicity (accumulation of $Na^+$ and $Cl^-$ in leaf tissues).

##### 4.3.1 The Maas-Hoffman Piecewise Linear Model (1977)
Crop yield decline in response to root-zone salinity is modeled as a function of the electrical conductivity of the saturated soil paste extract ($EC_e$ in $\text{dS}\cdot\text{m}^{-1}$):

$$Y_r = \begin{cases} 
100 & \text{if } EC_e \le a \\
100 - b(EC_e - a) & \text{if } a < EC_e \le a + \frac{100}{b} \\
0 & \text{if } EC_e > a + \frac{100}{b}
\end{cases}$$

*Where:*
- $Y_r$: Relative crop yield [%].
- $a$: Salinity threshold [$\text{dS}\cdot\text{m}^{-1}$] above which yield begins to decline.
- $b$: Slope [$\%\text{ yield reduction per }\text{dS}\cdot\text{m}^{-1}\text{ increase in }EC_e$].

```
  Relative Yield (Yr %)
 100 ──────────────┐
     │              \
     │               \   Slope = -b (% per dS/m)
     │                \
   0 ┴─────────────────┴──────────────────► ECe (dS/m)
     0                 a (Threshold)
```

##### 4.3.2 Empirical Salinity Parameters

| Crop | Functional Category | Salinity Threshold $a$ ($\text{dS}\cdot\text{m}^{-1}$) | Yield Decline Slope $b$ ($\%\cdot(\text{dS}\cdot\text{m}^{-1})^{-1}$) | $EC_e$ at 10% Yield Loss | $EC_e$ at 25% Yield Loss | $EC_e$ at 50% Yield Loss |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Barley** (*Hordeum vulgare*) | Tolerant | 8.0 | 5.0 | 10.0 | 13.0 | 18.0 |
| **Wheat (Grain)** | Moderately Tolerant | 6.0 | 7.1 | 7.4 | 9.5 | 13.0 |
| **Sorghum** | Moderately Tolerant | 6.8 | 16.0 | 7.4 | 8.4 | 9.9 |
| **Soybean** | Moderately Sensitive| 5.0 | 20.0 | 5.5 | 6.2 | 7.5 |
| **Groundnut** | Moderately Sensitive| 3.2 | 29.0 | 3.5 | 4.1 | 4.9 |
| **Maize (Corn)** | Moderately Sensitive| 1.7 | 12.0 | 2.5 | 3.8 | 5.9 |
| **Field Pea** | Sensitive | 1.2 | 19.0 | 1.7 | 2.5 | 3.8 |
| **Cowpea** | Moderately Tolerant | 4.9 | 12.0 | 5.7 | 7.0 | 9.1 |
| **Canola** | Moderately Tolerant | 6.5 | 11.0 | 7.4 | 8.8 | 11.0 |
| **Clovers** (*Trifolium* spp.) | Sensitive | 1.5 | 12.0 | 2.3 | 3.6 | 5.7 |

---

### 5. Rotation Structure & Soil Health Heuristics

#### 5.1 Continuous Living Ground Cover Days
Living ground cover is the primary physical defense against soil erosion and the biological foundation for soil food web activity.

##### 5.1.1 Quantitative Formulation
Calculated as the cumulative number of days per calendar year (or annualized across a multi-year rotation) with an active green canopy ($LAI \ge 0.5$ or $> 30\%$ soil surface coverage):

$$\text{CoverDays}_{\text{annual}} = \frac{1}{N_{\text{years}}} \sum_{y=1}^{N_{\text{years}}} \sum_{d=1}^{365} \mathbb{I}\left(\text{CanopyCover}_{y,d} \ge 30\%\right)$$

```
Typical Monoculture (Maize):
Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
[      Bare Fallow       ][=== Crop Cycle ===][ Bare Fallow ]
~120 Days Cover | High runoff & nutrient leaching risk

Diversified Cycle (Maize + Winter Rye Cover + Soybean + Crimson Clover):
Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
[== Winter Cover ==][== Cash Crop ==][=== Overwintering Cover ===]
~310 Days Cover | Continuous root exudation, aggregate stabilization
```

##### 5.1.2 Biological Mechanisms
- **Kinetic Energy Dissipation:** Bare soil takes the direct impact of raindrops falling at terminal velocities up to $9\text{ m}\cdot\text{s}^{-1}$. This detaches soil particles, slakes aggregates, and forms a dense surface crust that cuts infiltration rates by $70\text{--}90\%$. Living foliage intercepts raindrop energy, allowing water to trickle gently into the soil.
- **Rhizosphere Exudation & Glomalin Production:** Active roots release $10\text{--}25\%$ of their photosynthetically fixed carbon into the rhizosphere as low-molecular-weight exudates (sugars, amino acids, organic acids). This fuels arbuscular mycorrhizal fungi (AMF), which produce **glomalin**—a hydrophobic glycoprotein that binds mineral particles into stable water-insoluble macroaggregates ($> 250\ \mu\text{m}$).
- **Weed Suppression:** Continuous canopy cover reduces photosynthetic photon flux density ($PPFD$) and shifts the red to far-red light ratio ($R:FR$) at the soil surface, preventing germination of photoblastic weed seeds.

---

#### 5.2 Legume Frequency & Symbiotic Biological Nitrogen Fixation ($BNF$)
Legume inclusion in crop sequences reduces reliance on synthetic Haber-Bosch nitrogen fertilizer, decreasing associated fossil fuel consumption, greenhouse gas emissions, and downstream nitrate leaching.

##### 5.2.1 Quantitative Formulation
$$\text{Legume Ratio} = \frac{\sum \text{Duration of Legume Slots (days)}}{\sum \text{Total Rotation Duration (days)}} \quad \text{or} \quad \frac{N_{\text{legume slots}}}{N_{\text{total crop slots}}}$$

##### 5.2.2 Biochemical Mechanism
Symbiotic *Rhizobiaceae* bacteria (*Rhizobium*, *Bradyrhizobium*, *Sinorhizobium*) infect legume root hairs, forming root nodules. Within these nodules, the bacterial enzyme complex **nitrogenase** converts atmospheric dinitrogen ($N_2$) into ammonia:

$$N_2 + 8 H^+ + 8 e^- + 16\text{ ATP} \xrightarrow{\text{Nitrogenase}} 2 NH_3 + H_2 + 16\text{ ADP} + 16 P_i$$

Because nitrogenase is irreversibly inactivated by molecular oxygen, the legume nodule synthesizes **leghemoglobin** to maintain root nodule oxygen tensions at low, controlled concentrations ($\approx 10\text{--}40\text{ nM}$).

##### 5.2.3 Net Nitrogen Balance: Grain Legumes vs. Green Manures
A common misconception is that all legumes contribute substantial net nitrogen to the soil. The actual balance depends on the **Nitrogen Harvest Index ($NHI$)**:

$$\text{Net N Credit} = N_{\text{biologically fixed}} - N_{\text{grain exported}}$$

- **Grain Legumes (e.g., Soybean):** High-yielding soybeans fix $100\text{--}180\text{ kg N}\cdot\text{ha}^{-1}$, but can export $120\text{--}200\text{ kg N}\cdot\text{ha}^{-1}$ in harvested protein-rich grain ($NHI \approx 0.80$). This often results in a neutral or slightly negative net soil nitrogen balance ($-20\text{ to }+20\text{ kg N}\cdot\text{ha}^{-1}$), though the residue decomposes easily.
- **Cover Crop Legumes / Green Manures (e.g., Crimson Clover, Hairy Vetch):** The entire aboveground and belowground biomass is terminated and retained on-site ($NHI = 0$). This yields a net soil nitrogen addition of $+80\text{ to }+220\text{ kg N}\cdot\text{ha}^{-1}$ for the following cash crop.

---

#### 5.3 Crop Family Diversity & Pathogen Break Dynamics
Repeated planting of closely related plant species selects for specialized soil-borne plant pathogens, parasitic nematodes, and adapted weed communities.

##### 5.3.1 Botanical Groupings

```
           MAJOR BOTANICAL FAMILIES IN CROPPING ROTATIONS
   ┌─────────────────┬──────────────────┬─────────────────┬─────────────────┐
   │     Poaceae     │     Fabaceae     │  Brassicaceae   │   Solanaceae    │
   │   (Gramineae)   │  (Leguminosae)   │  (Cruciferae)   │ (Nightshades)   │
   ├─────────────────┼──────────────────┼─────────────────┼─────────────────┤
   │ Maize           │ Soybean          │ Canola          │ Potato          │
   │ Wheat           │ Field Pea        │ Mustard         │ Tomato          │
   │ Sorghum         │ Cowpea           │ Radish          │ Pepper          │
   │ Barley, Rye     │ Clover, Vetch    │ Turnip          │ Eggplant        │
   └─────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

##### 5.3.2 Quantitative Diversity Metric
Calculated as the number of distinct botanical families present over the complete rotation cycle ($N_{fam}$) alongside the Maximum Consecutive Run of the same family:

$$\text{Family Diversity} = \text{Count}(\text{Unique Botanical Families in Cycle})$$

$$\text{Max Family Run} = \max(\text{Consecutive Years with Family}_j)$$

##### 5.3.3 Disruption of Pathogen and Pest Cycles
Many aggressive soil-borne fungal pathogens persist as resting structures (chlamydospores, sclerotia, oospores) that require chemical signals from host root exudates to germinate:
- **Take-all in Wheat (*Gaeumannomyces graminis* var. *tritici*):** A 1- to 2-year break crop using a non-grass broadleaf species (e.g., canola, soybean, pea) starves the fungus, reducing pathogen inoculum in the root zone by over 80%.
- **Soybean Cyst Nematode (*Heterodera glycines* - SCN):** Non-host crops (maize, sorghum, small grains) prevent nematode reproduction, reducing viable egg counts in the soil by $30\text{--}50\%$ per non-host year.
- **Biofumigation (Brassicaceae):** Brassica crops (canola, mustards, radishes) contain high levels of **glucosinolates**. Upon tissue maceration or incorporation, the endogenous enzyme **myrosinase** hydrolyzes glucosinolates into volatile **isothiocyanates** (mustard oils). These compounds act as natural broad-spectrum biofumigants, suppressing *Rhizoctonia*, *Fusarium*, *Verticillium*, and plant-parasitic nematodes.

---

#### 5.4 Residue Carbon-to-Nitrogen ($C:N$) Dynamics
The biochemical composition of crop residue dictates whether soil microorganisms will release plant-available inorganic nitrogen (mineralization) or draw nitrogen from the surrounding soil solution (immobilization).

```
   C:N Ratio < 20:1                          C:N Ratio > 30:1
   (Legumes, Young Covers)                   (Cereal Straw, Stover)
          │                                         │
   Excess Nitrogen                           Nitrogen Deficit
          │                                         │
   MICROBIAL MINERALIZATION                  MICROBIAL IMMOBILIZATION
   (Net release of NH4+ & NO3-               (Microbes scavenge soil N,
    within 2 to 4 weeks)                      inducing temporary crop deficiency)
```

##### 5.4.1 Stoichiometric Basis of Decomposition
Soil heterotrophic bacteria and fungi maintain an average biomass $C:N$ ratio of approximately $8:1$. During organic matter decomposition:
- Microorganisms oxidize roughly two-thirds ($65\%$) of the ingested carbon to carbon dioxide ($CO_2$) for metabolic energy generation (Microbial Carbon Use Efficiency $CUE \approx 0.35$).
- Microorganisms incorporate the remaining one-third ($35\%$) of the carbon into their structural biomass.
- To balance their internal stoichiometry:

$$\text{Critical Substrate } C:N \approx \frac{8:1}{0.35} \approx 23:1\text{ to }25:1$$

##### 5.4.2 The Decomposition Thresholds
- **$C:N < 20:1$ (Net Mineralization):** The organic residue contains more nitrogen than the microbial decomposers need. Excess organic nitrogen is deaminated into ammonium ($NH_4^+$) and nitrate ($NO_3^-$), becoming available for crop uptake within 2 to 4 weeks of residue termination.
- **$20:1 \le C:N \le 30:1$ (Neutral / Intermediate):** Decomposition proceeds without substantial net mineral nitrogen release or severe immobilization.
- **$C:N > 30:1$ (Net Immobilization):** Residue is nitrogen-poor relative to carbon. To break down structural cellulose and lignin, microbes scavenge plant-available mineral nitrogen ($NO_3^-$ and $NH_4^+$) from the bulk soil solution. Crops planted into this residue experience severe nitrogen deficiency unless starter nitrogen fertilizer is applied.

##### 5.4.3 Residue Characteristics Across Common Crops

| Crop Species | Component / State | Approximate C:N Ratio | Decomposition Speed | Primary Soil Function |
| :--- | :--- | :--- | :--- | :--- |
| **Crimson Clover** | Vegetative bloom | 14:1 – 18:1 | Rapid (Half-life 10–18 d) | High-speed nitrogen release for the following cash crop. |
| **Field Pea** | Terminated cover / vine | 18:1 – 22:1 | Rapid to Moderate | Balanced nutrient release; minimal immobilization risk. |
| **Soybean** | Harvested post-grain stover | 30:1 – 40:1 | Moderate | Rapid initial leaf decay; stems persist 2–4 months. |
| **Maize (Corn)** | Harvested stover (stalks/leaves) | 55:1 – 70:1 | Slow (Half-life 60–90 d) | Good soil surface armor; moderate, manageable N immobilization. |
| **Sorghum** | Post-harvest stubble | 60:1 – 75:1 | Slow | Durable residue cover; helps reduce wind and water erosion. |
| **Wheat** | Post-harvest grain straw | 80:1 – 100:1 | Very Slow (Half-life > 120 d)| Strong microbial immobilization; excellent long-term soil armor. |

---

### 6. Farmer Communication & Decision Support

#### 6.1 Practical Extension Communication
Growers balance complex, time-sensitive operational choices around machinery, input costs, and weather windows. Decision support software must deliver clear, actionable agronomic advice before presenting detailed technical data.

```
┌────────────────────────────────────────────────────────────────────────┐
│  1. ACTIONABLE VERDICT (Plain Language Extension Delivery)             │
│  "Plant corn 10 days earlier or switch to a 105-day hybrid to bypass   │
│   mid-summer tasseling heat stress."                                   │
├────────────────────────────────────────────────────────────────────────┤
│  2. OPERATIONAL RATIONALE (Why it matters biologically)                │
│  "Your field typically hits 36°C heat during the third week of July.   │
│   Heat above 35°C desiccates corn pollen within 20 minutes, leaving    │
│   cobs poorly filled."                                                 │
├────────────────────────────────────────────────────────────────────────┤
│  3. TRACEABLE SCIENTIFIC EVIDENCE (Expandable Technical Data)          │
│  • Historical Weather: NASA POWER 1984–2024 (0.5° grid)                │
│  • Phenological Model: FAO-56 Single Kc (GDD accumulation model)       │
│  • Target Envelope: Comfortable band 20–32°C; Heat abort threshold 35°C│
└────────────────────────────────────────────────────────────────────────┘
```

##### 6.1.1 Principles for Practical Field Advice
1. **Lead with the Decision, Not the Model:** Do not begin with model terminology ("Based on an empirical Penman-Monteith run..."). State the field action plainly: *"Split your nitrogen into two passes, saving half for sidedress at V6."*
2. **Explain the Biological Mechanism:** State the plant or soil process driving the recommendation: *"Heavy rain early in the season washes surface nitrogen below the shallow root zone of young corn."*
3. **Show Target Bands, Not Isolated Numbers:** An isolated metric (e.g., "Soil Volumetric Water Content = 18%") provides little utility. Ground the reading in clear physiological boundaries: *"Soil moisture is at 18%, falling below the comfortable 22–32% root-zone band for silking."*
4. **Clarify Data Provenance and Resolution:** State data sources clearly without burying technical realities: *"Regional weather context from NASA POWER (0.5° grid, ~45 km cell around your field). Check local rain gauges before spraying."*

---

#### 6.2 Avoiding Pseudoscientific 'Soil Health Points'
Many commercial tools compute proprietary composite indices (e.g., "Your Soil Health Score: 74/100") that blend physical, chemical, and biological factors into an arbitrary single number. Agronomic models should avoid these synthetic scores in favor of transparent, measurable indicators.

```
  UNSCIENTIFIC COMPOSITE INDEX               BIOPHYSICAL MECHANISTIC REPORT
  ┌───────────────────────────────┐          ┌───────────────────────────────────────────┐
  │  Overall Soil Score: 68/100   │          │  Living Cover: 245 days/year (+65 days)   │
  │  [Arbitrary aggregate number] │   VS     │  Net Legume Nitrogen: +45 kg N/ha net     │
  │  Hides underlying limitations │          │  Family Break: 2 years between grass crops│
  │  and pedologic context        │          │  Residue C:N: 24:1 (Balanced decomp rate) │
  └───────────────────────────────┘          └───────────────────────────────────────────┘
```

##### 6.2.1 Core Scientific Limitations of Composite Scores
1. **Arbitrary Weighting Masks Agronomic Bottlenecks:**
   - Combining unrelated metrics (e.g., pH, penetration resistance, organic matter, microbial biomass) into a linear weighted sum obscures critical limiting factors (Liebig's Law of the Minimum). A field with an outstanding score of 85/100 could still experience complete crop failure due to severe subsoil compaction or toxic aluminum concentrations.
2. **Pedologic Incomparability Across Soil Orders:**
   - A sandy Entisol or Spodosol in Florida has an inherently low native organic carbon holding capacity ($0.8\text{--}1.2\%$), limited by coarse texture and warm climate. A rich Mollisol in Iowa easily holds $4.0\text{--}5.5\%$ organic matter under regular tillage. Scoring the sandy soil lower penalizes the grower for regional pedology rather than reflecting management quality.
3. **Lack of Calibrated Yield Response Curves:**
   - There are no peer-reviewed calibration curves that link a 5-point gain in a synthetic "soil health score" to bushels of grain, drought resilience days, or reduced risk.

##### 6.2.2 Mechanistic, Traceable Alternatives
Instead of a proprietary composite score, models should report distinct biophysical indicators alongside their functional mechanisms:
- **Living Canopy Duration:** Total days of living root cover per year (e.g., $280\text{ days}\cdot\text{year}^{-1}$ vs. $130\text{ days}\cdot\text{year}^{-1}$), explaining its direct role in reducing runoff and feeding soil biology.
- **Estimated Nitrogen Contribution:** Calculated biological nitrogen fixation minus grain removal balance (e.g., net $+50\text{ kg N}\cdot\text{ha}^{-1}$ credit), enabling calibrated adjustments to synthetic fertilizer applications.
- **Disease & Pest Host Breaks:** Documented break intervals between susceptible botanical families (e.g., 2 full seasons without a grass host, breaking the cycle for wheat root rots).
- **Surface Residue Dynamics:** Explicit $C:N$ balance ratings explaining whether surface stubble will immobilize starter nitrogen or decompose quickly.

---

### 7. Consolidated Agronomic Reference Tables

#### 7.1 Master Crop Parameter Library

| Crop Identifier | Common Name | Botanical Family | $T_{base}$ ($^\circ\text{C}$) | $T_{upper}$ ($^\circ\text{C}$) | GDD to Maturity ($^\circ\text{C}\cdot\text{d}$) | Heat Threshold ($^\circ\text{C}$) | $K_{c,\text{ini}}$ | $K_{c,\text{mid}}$ | $K_{c,\text{end}}$ | Max Root $Z_r$ (m) | Depletion $p$ | pH Optimum | Salinity $a$ ($\text{dS}\cdot\text{m}^{-1}$) | Residue C:N |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `maize` | Maize (Grain) | Poaceae | 10.0 | 34.0 | 1400 | > 35 (Silking) | 0.30 | 1.20 | 0.50 | 1.2 – 1.8 | 0.55 | 6.0 – 7.2 | 1.7 | 60:1 |
| `sorghum` | Grain Sorghum | Poaceae | 10.0 | 38.0 | 1300 | > 38 (Bloom) | 0.30 | 1.05 | 0.55 | 1.5 – 2.0 | 0.60 | 6.0 – 7.8 | 6.8 | 65:1 |
| `wheat_win` | Winter Wheat | Poaceae | 0.0 | 32.0 | 1800 | > 31 (Fill) | 0.40 | 1.15 | 0.30 | 1.4 – 1.8 | 0.55 | 6.0 – 7.5 | 6.0 | 80:1 |
| `wheat_spr` | Spring Wheat | Poaceae | 0.0 | 32.0 | 1450 | > 31 (Fill) | 0.30 | 1.15 | 0.30 | 1.0 – 1.3 | 0.55 | 6.0 – 7.5 | 6.0 | 80:1 |
| `soybean` | Soybean | Fabaceae | 10.0 | 35.0 | 1250 | > 35 (Bloom) | 0.40 | 1.15 | 0.50 | 1.0 – 1.3 | 0.50 | 6.2 – 7.0 | 5.0 | 35:1 |
| `groundnut`| Groundnut | Fabaceae | 13.0 | 38.0 | 1350 | > 36 (Peg) | 0.40 | 1.15 | 0.60 | 0.8 – 1.0 | 0.50 | 5.8 – 6.8 | 3.2 | 25:1 |
| `cowpea` | Cowpea | Fabaceae | 11.0 | 40.0 | 950 | > 38 (Bloom) | 0.35 | 1.05 | 0.50 | 1.0 – 1.2 | 0.60 | 5.5 – 7.0 | 4.9 | 22:1 |
| `canola` | Canola | Brassicaceae | 5.0 | 30.0 | 1250 | > 30 (Bloom) | 0.35 | 1.10 | 0.35 | 1.2 – 1.6 | 0.60 | 6.0 – 7.0 | 6.5 | 45:1 |
| `field_pea`| Field Pea | Fabaceae | 3.0 | 28.0 | 1050 | > 28 (Bloom) | 0.40 | 1.15 | 0.30 | 0.8 – 1.0 | 0.45 | 6.0 – 7.2 | 1.2 | 20:1 |
| `clover_cr`| Crimson Clover| Fabaceae | 5.0 | 30.0 | 750 | > 32 (Bloom) | 0.40 | 1.05 | 0.80 | 0.6 – 0.8 | 0.50 | 6.0 – 7.0 | 1.5 | 16:1 |

---

#### 7.2 Rotational Sequencing Compatibility Matrix
Cross-family sequencing guide for designing healthy, low-risk crop rotations:

| Preceding Crop Family | Following: Poaceae (Corn/Sorghum) | Following: Poaceae (Small Grains) | Following: Fabaceae (Soybean/Pea) | Following: Brassicaceae (Canola/Mustard) | Primary Agronomic Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Poaceae (Corn)** | **Poor** (High pest/disease continuity) | **Moderate** (Scab / *Fusarium* risk) | **Excellent** (N scavenging + pest break) | **Good** (Requires starter N for immobilization) | Avoid back-to-back corn; follow with legumes to rebuild soil N and break rootworm cycles. |
| **Poaceae (Wheat)**| **Good** (Stubble conserves water) | **Poor** (Severe Take-all disease carryover) | **Excellent** (Double-crop or rotational pulse) | **Excellent** (Canola performs well after wheat) | Do not follow continuous small grains without a broadleaf break to clean up Take-all. |
| **Fabaceae (Legumes)**| **Excellent** (Utilizes fixed legume N credit) | **Excellent** (High grain protein response) | **Caution** (Sclerotinia / root rot buildup) | **Good** (Check residual weed herbicide history) | Pair nitrophilic cereals (corn/wheat) directly after legumes to capture mineralized N. |
| **Brassicaceae** | **Excellent** (Biofumigation clears root fungi)| **Excellent** (Significant yield boost in wheat) | **Good** (Broadleaf rotational balance) | **Poor** (Clubroot / Blackleg pathogen buildup) | Brassicas provide excellent sanitizing breaks for cereal root rots; rotate out of brassicas for 2–3 seasons. |

---

### Summary Checklist for Agronomic Software Implementations
1. **Evapotranspiration:** Calculate $ET_0$ via standard FAO Penman-Monteith (or Hargreaves-Samani when radiation and humidity data are missing). Apply crop coefficient adjustments ($K_{c,\text{mid}}$ and $K_{c,\text{end}}$) for local wind and humidity.
2. **Heat and Frost:** Track thermal development using modified GDD cutoffs; flag heat stress during critical flowering windows (e.g., $>35^\circ\text{C}$ for maize, $>30^\circ\text{C}$ for canola) and cold snaps during tender phenological stages.
3. **Moisture Balance:** Combine root growth models with soil Available Water Capacity ($AWC$) and depletion fractions ($p$) to predict water stress ($K_s$) and estimate real irrigation demand.
4. **Soil Health Heuristics:** Use clear, physically grounded indicators—living cover days, legume frequency, botanical diversity, and residue C:N ratios—rather than unvalidated single-number scores.
5. **Farmer Communication:** Deliver actionable, plain-language advice first, explain the underlying biological mechanism, and supply traceable scientific references for verification.

---

## Agent 10: NASA Earthdata Cloud Architecture, STAC & Mobile Ingestion
**Specialist Role:** Earthdata Cloud Architecture & Mobile Systems Engineer

# Technical Research Report: Ingestion, Processing, and Serving Pipeline
**NASA Farming App — Cloud Data Architecture & Geospatial Delivery Engine**

---

### Executive Architectural Overview

The **NASA Farming App** is an offline-first, mobile-centric agroclimatic decision support system designed to assist global smallholder and mid-size farmers in evaluating crop rotation strategies against long-term climate variability, soil physical properties, and hydrological stress. Operating in outdoor, high-glare environments over patchy cellular networks, the application enforces a **zero-account, client-sovereign architecture** where field geometries and management histories remain strictly within browser-local storage (IndexedDB).

The backend architecture couples an edge-ready Next.js 16 App Router proxy in AWS `us-west-2` with NASA Earthdata Cloud services. It bridges synchronous, sub-3-second meteorological queries (NASA POWER, ISRIC SoilGrids) with asynchronous, high-latency satellite extraction jobs (AppEEARS, NASA Harmony for SMAP, MODIS, and GPM IMERG) through a transparent, multi-tier graceful degradation pipeline.

```mermaid
flowchart TD
    subgraph Client["Mobile Client (Offline-First Browser / PWA)"]
        UI["High-Contrast Light UI (Field Almanac)"]
        IDB[("Client IndexedDB
(Fields, Rotations, Analysis Snapshots)")]
        Worker["Service Worker / CacheStorage"]
        UI <--> IDB
        UI <--> Worker
    end

    subgraph EdgeProxy["Next.js 16 App Router (AWS us-west-2 Proxy)"]
        Handler["Route Handler: /api/field/[fieldId]/conditions"]
        CacheStore["Edge Cache (Next.js Cache Components / SWR)"]
        Transformer["Stateless GeoJSON & NetCDF Parser / Summarizer"]
        Handler <--> CacheStore
        Handler --> Transformer
    end

    subgraph Tier1["Tier 1: Synchronous & Credential-Free (1–3s Latency)"]
        POWER["NASA POWER API
(0.5° MERRA-2 Daily / Climatology)"]
        SoilGrids["ISRIC SoilGrids REST API
(250m Mapped Soil Profile)"]
    end

    subgraph Tier2["Tier 2: Authenticated Earthdata Cloud (2–10 min Latency)"]
        EDL["Earthdata Login (OAuth2 Bearer)"]
        CMR["CMR STAC API
(Catalog Search)"]
        Harmony["NASA Harmony API
(AWS us-west-2 Transformations)"]
        AppEEARS["AppEEARS API
(Point / Polygon Extractions)"]
        S3Direct["Direct S3 Buckets in us-west-2
(lp-prod-protected, gesdisc-cumulus)"]
    end

    UI -- "HTTPS Ephemeral Query (lat, lng, geometry)" --> Handler
    Handler -- "Fast Sync Point Fetch" --> POWER
    Handler -- "Fast Sync Point Fetch" --> SoilGrids
    Handler -. "Async Task Dispatch (with EDL Token)" .-> AppEEARS
    Handler -. "STAC Query & Job Submission" .-> Harmony
    Harmony --> S3Direct
    EDL -. "Token Refresh" .-> Harmony
    EDL -. "Token Refresh" .-> AppEEARS
```

---

### 1. NASA Earthdata Cloud Architecture

#### NASA Earthdata Login: OAuth2 Bearer Token Authentication Flow
NASA Earthdata Login (EDL, `https://urs.earthdata.nasa.gov`) provides centralized identity and access management across all NASA Distributed Active Archive Centers (DAACs). While Earthdata APIs natively support OAuth2 Authorization Code grants for web applications, server-to-server and programmatic ingestion pipelines utilize **OAuth2 Bearer Tokens** and **Personal Access Tokens (PAT)** to negotiate authorization across distributed DAAC endpoints.

```mermaid
sequenceDiagram
    autonumber
    participant App as Next.js Server Proxy
    participant URS as Earthdata Login (URS)
    participant DAAC as NASA DAAC / AppEEARS Gateway
    participant S3 as AWS us-west-2 S3 Bucket

    App->>URS: POST /oauth/token (grant_type=client_credentials or PAT)
    URS-->>App: 200 OK { access_token: "BEARER_TOKEN", expires_in: 7200 }
    
    App->>DAAC: GET /data/granule.nc (Authorization: Bearer BEARER_TOKEN)
    Note over DAAC: DAAC authenticates token against URS
    DAAC-->>App: 302 Found (Location: https://daac.s3.us-west-2.amazonaws.com/...)
    
    Note over App: Critical: HTTP redirect must NOT strip Authorization<br/>header or session cookies if redirecting across domains.
    App->>S3: GET /signed-s3-object-url
    S3-->>App: 200 OK (Binary Stream / HDF5 / COG)
```

1. **Token Acquisition:** The Next.js proxy server generates or uses an Earthdata User Bearer Token by calling:
   ```http
   POST https://urs.earthdata.nasa.gov/oauth/token HTTP/1.1
   Host: urs.earthdata.nasa.gov
   Authorization: Basic <base64(client_id:client_secret)>
   Content-Type: application/x-www-form-urlencoded

   grant_type=password&username=EARTHDATA_USER&password=EARTHDATA_PASS
   ```
2. **DAAC Cross-Domain Redirection & Cookie Jar Preservation:**
   When requesting data from a DAAC gateway (e.g., LP DAAC or GES DISC), clients receive an HTTP `302 Found` redirecting to an authenticated cloud front or pre-signed S3 download endpoint. Standard HTTP client libraries (such as `fetch` or `axios`) strip the `Authorization: Bearer <token>` header on cross-origin redirects by default (per RFC 7235). The Next.js backend proxy explicitly intercepts `302` redirects, manages an in-memory cookie jar (`~/.urs_cookies`), or re-attaches authorization headers to valid `*.earthdatacloud.nasa.gov` target domains.

---

#### NASA CMR (Common Metadata Repository) STAC API
NASA's Common Metadata Repository exposes a SpatioTemporal Asset Catalog (STAC) v1.0.0 API (`https://cmr.earthdata.nasa.gov/stac/`), providing a unified catalog specification across all NASA DAACs. CMR STAC enables spatial, temporal, and collection-level indexing to discover exact granules covering a farm boundary.

The STAC API is partitioned by DAAC provider catalogs (e.g., `LPCLOUD` for Land Processes, `GES_DISC` for Atmospheric & Precipitation data, `NSIDC_CPRD` for Cryosphere/Soil Moisture).

```http
POST https://cmr.earthdata.nasa.gov/stac/LPCLOUD/search HTTP/1.1
Host: cmr.earthdata.nasa.gov
Content-Type: application/json
Accept: application/geo+json

{
  "collections": ["HLSL30.v020", "MOD13Q1.061"],
  "bbox": [-93.65, 41.95, -93.55, 42.05],
  "datetime": "2024-04-01T00:00:00Z/2024-10-31T23:59:59Z",
  "limit": 50,
  "query": {
    "eo:cloud_cover": { "lt": 20 }
  }
}
```

##### Response Asset Structure
Granules return as standard GeoJSON `Feature` objects containing an `assets` dictionary. For cloud-hosted DAAC collections, items provide dual asset locators:
* `https://`: Standard CloudFront/HTTPS endpoint requiring Earthdata Bearer auth.
* `s3://`: Direct cloud object locator (e.g., `s3://lp-prod-protected/HLSL30.020/.../HLSL30.T15TVD.2024120T164501.v2.0.B04.tif`) accessible without egress charges inside AWS `us-west-2`.

---

#### NASA Harmony: Cloud Transformation Service in AWS us-west-2
NASA Harmony (`https://harmony.earthdata.nasa.gov`) is an enterprise data-transformation platform running natively inside AWS `us-west-2`. Harmony consolidates data services across DAACs by executing serverless transformations before data egresses:
* **Spatial Subsetting:** Polygons or bounding boxes clip datasets to field boundaries.
* **Reprojection:** Re-projects native sinusoidal, polar stereographic, or EASE-Grid projections to standard geographic coordinates (`EPSG:4326`) or Web Mercator (`EPSG:3857`).
* **Variable / Band Selection:** Extracts only targeted spectral bands (e.g., Red/NIR for NDVI) or scientific layers (e.g., `sm_rootzone` in SMAP Level 4), omitting extraneous layers.
* **Reformatting to Cloud-Optimized GeoTIFF (COG):** Converts multi-gigabyte HDF5/NetCDF-4 files directly into tiled, internally compressed COGs staged in AWS S3.

##### Harmony Job Execution Lifecycle
1. **Job Submission:**
   ```http
   POST https://harmony.earthdata.nasa.gov/service/harmony/collections/C2036696603-POCLOUD/coverage/rangeset HTTP/1.1
   Authorization: Bearer <EARTHDATA_TOKEN>
   Content-Type: application/json

   {
     "subset": {
       "bbox": [-93.65, 41.95, -93.55, 42.05],
       "time": { "start": "2024-05-01T00:00:00Z", "end": "2024-09-30T23:59:59Z" }
     },
     "format": "image/tiff",
     "crs": "EPSG:4326"
   }
   ```
2. **Job Staging:** Harmony returns `202 Accepted` with a tracking payload:
   ```json
   {
     "jobID": "28e75960-d224-4f11-9a73-67c8280f55cf",
     "status": "running",
     "progress": 15,
     "links": [
       { "rel": "self", "href": "https://harmony.earthdata.nasa.gov/jobs/28e75960-d224-4f11-9a73-67c8280f55cf" }
     ]
   }
   ```
3. **Output Staging:** Upon reaching `status: "successful"`, output files are staged in an AWS S3 bucket (`s3://harmony-prod-staging-us-west-2/...`). Consumers running compute within `us-west-2` can stream outputs directly without external HTTP overhead.

---

#### AppEEARS: Asynchronous Extraction Task Lifecycle
The Application for Extracting and Exploring Analysis Ready Samples (AppEEARS, hosted by LP DAAC at `https://appeears.earthdatacloud.nasa.gov/api/`) extracts time-series point and polygon samples from gridded land surface, vegetation, and soil moisture products.

```mermaid
stateDiagram-v2
    [*] --> Authenticating: POST /api/login (Basic Auth)
    Authenticating --> TokenAcquired: Bearer Token Returned
    TokenAcquired --> TaskSubmitted: POST /api/task (JSON Payload)
    
    state "Task Processing Lifecycle" as Lifecycle {
        TaskSubmitted --> Queued: status = "queued"
        Queued --> Processing: status = "processing"
        Processing --> Done: status = "done" (100%)
        Processing --> Error: status = "error"
    }

    Done --> ManifestRetrieved: GET /api/bundle/{task_id}
    ManifestRetrieved --> FileStream: GET /api/bundle/{task_id}/{file_id}
    FileStream --> [*]: Stream to Cache / Client
    Error --> [*]: Fallback to Tier 1
```

##### Point and Area Extraction Payload Specifications
AppEEARS accepts two task types critical for farming systems:

* **Point Extraction Task:** Suitable for pinned coordinates or field centroids.
  ```json
  {
    "task_type": "point",
    "task_name": "field_centroid_soil_moisture",
    "params": {
      "dates": [{ "startDate": "01-01-2023", "endDate": "12-31-2023" }],
      "layers": [
        { "product": "SPL4SMGP.008", "layer": "sm_rootzone" },
        { "product": "MOD13Q1.061", "layer": "_250m_16_days_NDVI" }
      ],
      "coordinates": [{ "id": "sample_point_1", "latitude": 42.0308, "longitude": -93.6319 }]
    }
  }
  ```

* **Area (Polygon) Extraction Task:** Extracts boundary-clipped rasters.
  ```json
  {
    "task_type": "area",
    "task_name": "field_polygon_ndvi_timeseries",
    "params": {
      "dates": [{ "startDate": "05-01-2024", "endDate": "10-01-2024" }],
      "layers": [{ "product": "MOD13Q1.061", "layer": "_250m_16_days_NDVI" }],
      "output": { "format": { "type": "geotiff" }, "projection": "geographic" },
      "geo": {
        "type": "FeatureCollection",
        "features": [{
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [[
              [-93.635, 42.030], [-93.625, 42.030],
              [-93.625, 42.038], [-93.635, 42.038],
              [-93.635, 42.030]
            ]]
          }
        }]
      }
    }
  }
  ```

##### Status Polling and Bundle Download Mechanics
1. **Task Submission:** Client issues `POST /api/task`. Response returns `{ "task_id": "97e411ba-...", "status": "queued" }`.
2. **Polling Loop:** Polling occurs via `GET /api/task/{task_id}` at exponential backoff intervals (10s, 20s, 30s, capped at 60s).
3. **Bundle File Listing:** Upon reaching `"done"`, `GET /api/bundle/{task_id}` yields a manifest containing individual data files (`.csv` or `.tif`), metadata JSON, and QA quality-assurance lookup files.
4. **File Ingestion:** The proxy streams `GET /api/bundle/{task_id}/{file_id}` directly into server memory, parses tabular or raster values, computes summary statistics, and caches the result.

---

### 2. High-Performance Direct S3 Access & Next.js Proxy

#### AWS Open Data & Direct S3 Bucket Access in AWS `us-west-2`
NASA's Earthdata Cloud operates within AWS region `us-west-2` (Oregon). Granule assets for collections residing in the cloud (such as Sentinel-2 on AWS Open Data, Harmonized Landsat-Sentinel HLS, MODIS Forward Processing, and SMAP Level 4) are stored in secure S3 buckets including:
* `s3://lp-prod-protected` (LP DAAC)
* `s3://gesdisc-cumulus-prod-protected` (GES DISC)
* `s3://nsidc-cumulus-prod-protected` (NSIDC DAAC)

##### In-Region Direct S3 Zero-Egress Economics
* **Zero Egress Fees:** When computing resources (e.g., an AWS EC2 instance, ECS container, AWS Lambda function, or Next.js App Router deployed on AWS in `us-west-2`) access NASA S3 buckets directly, **data transfer out (egress) is $0.00 / GB**. Egress fees only apply when data traverses the boundaries of AWS `us-west-2` to the public internet or another AWS region.
* **Temporary STS Credentials via DAAC `/s3credentials`:**
  NASA S3 buckets are protected and non-listable (running `s3:ListBucket` returns `403 Forbidden`). Direct S3 access requires fetching temporary AWS STS credentials from the DAAC:
  ```http
  GET https://data.lpdaac.earthdatacloud.nasa.gov/s3credentials HTTP/1.1
  Authorization: Bearer <EARTHDATA_TOKEN>
  ```
  Returns:
  ```json
  {
    "accessKeyId": "ASIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "sessionToken": "AQoDYXdzEJr1...EXAMPLE==",
    "expiration": "2026-11-14T13:05:00+00:00"
  }
  ```
  These credentials remain valid for exactly **1 hour** and permit `s3:GetObject` calls directly against object keys obtained via CMR STAC queries.

##### Cloud-Optimized GeoTIFF (COG) HTTP / S3 Range Requests
Instead of downloading full 500 MB to 2 GB scene files, the proxy utilizes GDAL/Rasterio or JavaScript raster engines (`geotiff.js`) to execute **HTTP / S3 Byte-Range Requests**. By reading only the COG header and TIFF tile directory, the proxy fetches exclusively the sub-grid pixels intersecting the field polygon (typically < 100 KB of compressed pixel data).

---

#### Next.js 16 App Router Server Route Handlers as Caching Proxy
Browser clients never communicate directly with NASA Earthdata or ISRIC endpoints. The Next.js 16 App Router server layer (`app/api/field/[fieldId]/conditions/route.ts`) acts as an edge caching reverse proxy and transformation gateway.

```mermaid
flowchart LR
    Browser["Client Browser
(Mobile Device)"]
    Proxy["Next.js 16 Route Handler
(/api/field/[fieldId]/conditions)"]
    MemoryCache[("Next.js App Router Cache
(Cache Components / unstable_cache)")]
    ExtAPI["Upstream APIs
(NASA POWER / SoilGrids)"]

    Browser -- "1. GET /api/field/123/conditions?lat=...&lng=..." --> Proxy
    Proxy -- "2. Check Key" --> MemoryCache
    MemoryCache -- "3a. Cache Hit (0ms)" --> Proxy
    Proxy -- "4. Fast JSON Stream (<50KB)" --> Browser

    MemoryCache -- "3b. Cache Miss" --> Proxy
    Proxy -- "5. Promise.allSettled()" --> ExtAPI
    ExtAPI -- "6. Raw Responses (-999, d_factor)" --> Proxy
    Note over Proxy: Convert -999 to null<br/>Scale SoilGrids integers<br/>Run Hargreaves ET0 model<br/>Omit raw rasters
    Proxy -- "7. Store Normalized Object" --> MemoryCache
```

##### Server-Side Transformation & Payload Reduction
1. **Credential Secrecy:** User Earthdata credentials, DAAC session cookies, and AWS STS access keys are stored exclusively in server environment variables (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`). They never leak to the client bundle.
2. **Payload Compression & Elimination of Scientific Overhead:**
   * Raw NASA POWER JSON responses for 40 years of daily data average **1.3 MB**.
   * SoilGrids responses return complex multi-layer nested arrays.
   * The Next.js Route Handler distills these upstream sources into a compact, pre-calculated JSON schema (< 25 KB) containing monthly climatological averages, empirical percentiles (P10, P50, P90), Hargreaves $ET_0$, and depth-weighted soil metrics.
3. **Fill Value & Unit Normalization:**
   * Replaces NASA fill values (`-999`, `-9999`) with strict TypeScript `null` types.
   * Scales SoilGrids integer values by layer `d_factor` (e.g., Clay `312` with $d=10$ becomes `31.2%`; pH in $H_2O$ `65` with $d=10$ becomes `6.5`).
4. **Timeout Mitigation & Circuit Breaking:**
   External calls are wrapped in `Promise.allSettled` using explicit `AbortSignal.timeout(ms)` barriers:
   * NASA POWER: 10,000 ms timeout.
   * ISRIC SoilGrids: 12,000 ms timeout.
   If an upstream provider is unresponsive or returns 5xx errors, the proxy does not fail the HTTP request; it returns `climateAvailable: false` or `soilAvailable: false` with partial data, enabling the client UI to degrade gracefully.

##### Next.js 16 Cache Control Headers
The route handler sets rigorous edge and browser cache controls:
```typescript
return NextResponse.json(payload, {
  status: 200,
  headers: {
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    "Vary": "Accept-Encoding"
  }
});
```

---

#### Latency Profiles & Asynchronous Architecture

| Data Source | Delivery Mechanism | Protocol / Service | Query Latency | Client UX Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **NASA POWER Climatology** | Synchronous REST | Point query (AG Community) | **1.2 s – 2.0 s** | Synchronous loading skeleton; loads instantly with field creation. |
| **NASA POWER Daily (40-Year)** | Synchronous REST | Daily timeseries (1981–2024) | **2.2 s – 3.8 s** | Fetched on demand when generating detailed rotation comparisons. |
| **ISRIC SoilGrids v2** | Synchronous REST | 250m WCS / Properties Query | **1.5 s – 3.5 s** | Concurrently requested with POWER via `Promise.allSettled`. |
| **NASA Harmony (Subsetting)** | Asynchronous Task | OGC Coverage / Cloud COG | **30 s – 2.5 min** | Background compilation; client receives job ID, polls status. |
| **AppEEARS Point Task** | Asynchronous Task | Celery / Queue Extraction | **2 min – 6 min** | Dispatched asynchronously; UI displays "Compiling satellite radar...". |
| **AppEEARS Polygon Task** | Asynchronous Task | Spatial Masking & GeoTIFF Export | **4 min – 10 min** | Dispatched in background; optimistic notification upon completion. |

##### The Two-Phase Hydration Pattern
To ensure the interface feels instantaneous even on rural networks:
* **Phase 1 (Immediate Synchronous Baseline, < 3s):** The Next.js route handler queries NASA POWER and SoilGrids concurrently. The UI renders within 2 seconds, displaying baseline climate normals, rainfall reliability, seasonal temperature windows, and soil physical properties.
* **Phase 2 (Asynchronous Satellite Enhancement, 2–10 min):** If Earthdata credentials are configured and the farmer requests detailed remote-sensing verification, the proxy queues an AppEEARS or Harmony job. The browser stores the active `taskId` in IndexedDB. A background polling loop tracks completion, displaying a notification badge ("Satellite Radar & NDVI Analysis Ready") when high-resolution data has staged.

---

### 3. Mobile-First & Patchy Connectivity Architecture

#### Operating Context: Outdoor Mobile Reality
Farmers evaluate planting decisions directly in the field. The technical architecture addresses three severe environmental constraints:

```mermaid
graph TD
    subgraph PhysicalConstraints["Field Operational Realities"]
        Glare["Bright Sunlight & Glare
(Sunlight washes out screens)"]
        Network["Patchy Connectivity
(Remote 2G/3G, EDGE, Packet Drops)"]
        Motor["Outdoor Motor Factors
(One-handed use, gloves, dirty hands)"]
    end

    subgraph ArchitecturalSolutions["Architectural Countermeasures"]
        Tokens["Light-Only Field Almanac Tokens
(High contrast, min 7:1 ratio, bold borders)"]
        OfflineEngine["Offline-First IndexedDB Engine
(Full offline read/write, zero cloud dep)"]
        Touch["Ergonomic UI Targets
(Min 48px touch targets, sticky actions)"]
    end

    Glare --> Tokens
    Network --> OfflineEngine
    Motor --> Touch
```

1. **Bright Sunlight & High Ambient Glare:**
   * **Strict Light-Only Rule:** Dark mode or low-contrast dark themes are unreadable in outdoor sunlight. The application enforces a light-only design system (`DESIGN.md` Field Almanac).
   * **High Contrast Ratios:** Text-to-background contrast exceeds **7:1** (exceeding WCAG AAA). Subtle gray borders (`#E5E7EB`) are replaced by dark, tactile boundaries (`#1E293B` or `#334155`).
   * **Data Colors Paired with Icons:** Colors representing environmental stress (`water`, `heat`, `drought`, `frost`, `healthy`) never convey meaning alone. Every data point is coupled with an explicit text label and iconography (e.g., a frost snowflake icon or drought exclamation icon).
2. **Patchy 2G/3G & Cellular Dead Zones:**
   * HTTP round-trips over EDGE/2G networks suffer latency spikes exceeding 15 seconds, with frequent TCP connection resets.
   * Every critical computation (growing degree days, Hargreaves potential evapotranspiration, rotation soil coverage, family diversity) runs entirely **client-side in pure TypeScript** inside the browser engine. The network is required *only once* to seed baseline geospatial data.
3. **Outdoor Ergonomics:**
   * Minimum touch target size of **48 × 48 CSS pixels** for all buttons, inputs, and interactive map targets.
   * Form inputs use numeric native keyboards (`inputMode="decimal"`) with immediate local validation.

---

#### Client-Side Storage: IndexedDB Schema
The client storage engine uses an abstraction layer (`lib/store/storage.ts`) backed by `idb-keyval` or native IndexedDB, operating under a designated database name `nasa-farming-app`.

```mermaid
erDiagram
    FIELDS ||--o{ ROTATIONS : "has many"
    FIELDS ||--o{ ANALYSIS_SNAPSHOTS : "has cached"

    FIELDS {
        string id PK "UUIDv4"
        string name "User field name"
        json geometry "GeoJSON Point or Polygon"
        float areaHa "Calculated field area"
        json centroid "[longitude, latitude]"
        json samplePoints "Array of 5 interior test points"
        string irrigation "none | rainfed | drip | sprinkler | flood"
        json soilOverride "Optional user soil test (pH, texture)"
        string localNotes "Farmer field observations"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    ROTATIONS {
        string id PK "UUIDv4"
        string fieldId FK "Reference to field"
        string name "e.g., Current 3-Year Rotation"
        json slots "Array of CropSlot objects"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    ANALYSIS_SNAPSHOTS {
        string cacheKey PK "Deterministic Hash"
        string fieldId FK "Reference to field"
        string fetchedAt "ISO 8601 fetch timestamp"
        json observationDateRange "{ startYear, endYear }"
        json climateData "Aggregated NASA POWER metrics"
        json soilData "Depth-weighted SoilGrids profile"
        json satelliteData "Optional SMAP/MODIS observations"
        json metadata "Sources, resolutions, licenses"
        boolean isStale "Flagged if params modified offline"
    }
```

##### TypeScript Entity Definitions
```typescript
export interface FieldRecord {
  id: string; // UUIDv4
  name: string;
  geometry: GeoJSON.Polygon | GeoJSON.Point;
  areaHa: number;
  centroid: [number, number]; // [lng, lat]
  samplePoints: Array<[number, number]>;
  irrigation: "none" | "rainfed" | "drip" | "sprinkler" | "flood";
  soilOverride?: {
    ph?: number;
    texture?: "sand" | "loam" | "clay" | "silt" | "sandy_loam" | "clay_loam";
    organicMatterPct?: number;
  };
  localNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RotationSlot {
  id: string;
  cropId: string; // References versioned crop library
  plantingDate: string; // "MM-DD" relative or ISO date
  harvestDate: string;
  residueManagement: "removed" | "retained" | "incorporated";
  targetYieldKgHa?: number;
}

export interface RotationRecord {
  id: string;
  fieldId: string;
  name: string;
  slots: RotationSlot[];
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisSnapshotRecord {
  cacheKey: string; // SHA-256 hash
  fieldId: string;
  fetchedAt: string;
  observationDateRange: {
    start: string;
    end: string;
  };
  sources: Array<{
    dataset: string;
    resolution: string;
    dates: string;
    coveragePct: number;
  }>;
  metrics: {
    annualRainMm?: number;
    monthlyRainMm?: number[];
    monthlyTmaxC?: number[];
    monthlyTminC?: number[];
    monthlyEt0Mm?: number[];
    soilProfile?: {
      ph: number;
      clayPct: number;
      sandPct: number;
      siltPct: number;
      organicCarbonGKg: number;
    };
    satelliteMoisture?: {
      rootZoneWetnessPct?: number;
      smapMeanSurface?: number;
      modisNdviMean?: number;
    };
  };
  stale: boolean;
  staleReason?: "GEOMETRY_CHANGED" | "ROTATION_CHANGED" | "SOIL_OVERRIDE_CHANGED";
}
```

---

#### Offline Execution & Stale Result Invalidation
1. **Service Worker Pre-caching:** The Next.js application registers a Progressive Web App (PWA) Service Worker using Workbox or native CacheStorage. The application shell (HTML, WebAssembly modules, compiled JavaScript bundles, CSS, and SVG iconography) is cached aggressively with a *Cache-First* strategy.
2. **Instant Cached Hydration:** When opening a field offline, the client repository checks IndexedDB:
   ```typescript
   const snapshot = await getCachedConditions(field.id);
   if (snapshot) {
     renderConditionsScreen(snapshot);
   }
   ```
3. **Offline Invalidation & Parameter Drift Detection:**
   If a farmer updates field geometry (e.g., expands field boundaries on the map) or alters crop rotation dates while disconnected:
   * The new parameters are immediately saved to `field:` and `rotation:` stores.
   * The system computes a fresh prospective cache key.
   * Because network access is unavailable to re-query the proxy, the system **does not discard** the previous analysis. Instead, it marks the local analysis snapshot as `stale: true`.
4. **UI Stale Result Disclosure Banner:**
   The UI immediately displays an explicit, high-visibility amber warning banner:
   > ⚠️ **Field Parameters Updated Offline**  
   > *The growing conditions and climate resilience metrics displayed below reflect your previous field boundaries and crop rotation recorded on October 12, 2026. Reconnect to cellular data to update satellite and soil estimates.*

---

### 4. Cache Invalidation & Data Versioning Matrix

#### Deterministic Cache Key Architecture
To guarantee mathematical repeatability and prevent stale or corrupted analyses across code deployments, cache keys are constructed as a deterministic cryptographic hash (SHA-256) of five discrete variables:

$$\text{CacheKey} = \text{SHA-256}\Big(\text{Hash}(\text{Geom}) \parallel \text{Hash}(\text{Rot}) \parallel V_{\text{CropLib}} \parallel V_{\text{Formula}} \parallel V_{\text{Dataset}}\Big)$$

```mermaid
flowchart TD
    G["Field Geometry
(6-Dec Coordinate Float Normalization)"] --> HG["SHA-256 (Canonical GeoJSON)"]
    R["Rotation Plan
(Crops, Dates, Residue, Irrigation)"] --> HR["SHA-256 (Canonical JSON)"]
    C["Crop Library Version
(e.g., crop-lib-v1.4.2)"] --> HC["Version String"]
    F["Formula Engine Version
(e.g., hargreaves-v1.0_gdd-v1.1)"] --> HF["Version String"]
    D["Dataset Version
(e.g., power-v2.0_soilgrids-v2.0)"] --> HD["Version String"]

    HG & HR & HC & HF & HD --> Concat["Concatenate with Delimiters ':'"]
    Concat --> MasterHash["SHA-256 Deterministic Cache Key"]
```

##### Component Breakdown

1. **`hash(field_geometry)`:**
   Geographic floating-point coordinates are sensitive to precision variations across GPS sensors and map editors. Before hashing:
   * Coordinates are truncated/rounded to **6 decimal places** ($\approx 0.1\text{ m}$ spatial resolution).
   * Polygon coordinate rings are wound counter-clockwise for exterior rings per RFC 7946.
   * Vertices are sorted from the north-westernmost anchor coordinate to produce a canonical representation.
   ```typescript
   export function canonicalizeGeometry(geom: FieldGeometry): string {
     if (geom.type === "Point") {
       const [lng, lat] = geom.coordinates.map(n => n.toFixed(6));
       return `POINT(${lng},${lat})`;
     }
     const ring = geom.coordinates[0].map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
     return `POLYGON((${ring}))`;
   }
   ```
2. **`rotation_hash`:**
   Canonical JSON string representation of sorted crop slots:
   `cropId + ":" + plantingDate + ":" + harvestDate + ":" + irrigationMode + ":" + residue`
3. **`crop_library_version` (SemVer):**
   Tracks updates to agronomic thresholds (e.g., base temperatures $T_{\text{base}}$, crop coefficients $K_c$, maximum root depths). If agronomic research updates the $K_c$ factor for sorghum, bumping `crop_library_version` from `1.1.0` to `1.2.0` automatically invalidates all affected local rotation analyses.
4. **`formula_version`:**
   Identifies the algorithmic version of derived metrics (e.g., Hargreaves Reference Evapotranspiration formula `ET0_Hargreaves_v1`, Growing Degree Day formula `GDD_BaseCap_v2`).
5. **`dataset_version`:**
   Tracks upstream scientific dataset releases:
   * NASA POWER: `POWER_MERRA2_Daily_v2.0`
   * ISRIC: `SoilGrids_v2.0`
   * SMAP: `SPL4SMGP_008`
   * MODIS: `MOD13Q1_061`

---

#### Preservation of `fetchedAt` vs `observationDateRange`
A frequent architectural flaw in geospatial applications is conflating the wall-clock timestamp of API invocation with the physical observation period of the satellite instrument. The NASA Farming App strictly enforces dual temporal indexing across all schemas and UI components:

```json
{
  "fetchedAt": "2026-11-14T12:00:00.000Z",
  "observationDateRange": {
    "temporalType": "multi_year_climatology",
    "startYear": 1981,
    "endYear": 2024,
    "validYearCount": 43,
    "completeCalendarYearsRequired": 355
  }
}
```

* **`fetchedAt` (ISO 8601 Wall-Clock Timestamp):**
  Indicates when the data was retrieved over the network. Used exclusively by client cache-management logic to evaluate cache staleness (e.g., `isStale(fetchedAt, 48)` marks a cache candidate for background re-validation after 48 hours).
* **`observationDateRange` (Astronomical / Geophysical Window):**
  Defines the historical observation boundaries of the raw scientific data:
  * NASA POWER Climatology reflects the 30-to-40-year climatological normal ($1981\text{–}2024$).
  * AppEEARS MODIS NDVI reflects specific 16-day composite overpasses (e.g., June 1–16, 2024).
  * SoilGrids v2 represents static mapped soil profile estimates based on historical core samples.

* **Scientific Integrity:** Displaying "Weather as of November 14, 2026" for a dataset summarizing historical 1981–2024 climate distributions violates data provenance standards. The UI explicitly separates these concepts:
  > *"NASA POWER Climatology (1981–2024 normals) • Retrieved 2 hours ago"*

---

### 5. Privacy-Preserving & Accountless Design

#### Zero-Account Architecture
Smallholder and independent farmers frequently resist adopting digital agriculture platforms due to valid concerns regarding **land data sovereignty, corporate land monitoring, and commodity speculation**.

```mermaid
flowchart TD
    subgraph ClientSovereign["100% Client-Sovereign (Browser Local)"]
        Sens1["Field Boundaries & GPS Coordinates"]
        Sens2["Crop Rotation & Planned Acreage"]
        Sens3["Yields & Historical Production"]
        Sens4["Soil Test Overrides & Fertilizer Records"]
        LocalIDB[("Browser IndexedDB Only
(No Accounts, No Remote DB)")]

        Sens1 & Sens2 & Sens3 & Sens4 --> LocalIDB
    end

    subgraph EphemeralWire["Ephemeral Wire Transmission (No Persistence)"]
        Req["Stateless HTTP Request
GET /api/field/conditions?lat=42.03&lng=-93.63"]
        Proxy["Next.js Server Handler in Memory
(No User ID, No DB Insert)"]
        External["Upstream NASA APIs
(Coarse Query Lat/Lng)"]
        
        LocalIDB -- "Point Lat/Lng Only" --> Req
        Req --> Proxy
        Proxy --> External
    end
```

1. **No User Accounts or Authentication:**
   * No username, email address, password, or OAuth login (Google, Apple, etc.) is required or supported for the farmer.
   * The app initiates instantly upon loading `index.html`.
2. **Storage Exclusivity in Browser IndexedDB:**
   * Field names, boundary polygons, crop calendars, management notes, and yield numbers are stored **only inside the browser's IndexedDB**.
   * There is no server-side database (no PostgreSQL, Supabase, Firebase, or MongoDB).
3. **Client-Side JSON Backup & Restore:**
   Data mobility is achieved without cloud storage. Users can export their complete farm record as an encrypted or plain JSON file via `lib/store/repository.ts:exportAll()` and restore it across devices using `importAll()`.

---

#### Anonymized Backend Queries
The Next.js 16 Route Handlers operate as stateless calculation proxies:
1. **No Persistent Identification:**
   * The `fieldId` URL parameter in `/api/field/[fieldId]/conditions` is a client-generated UUIDv4 used exclusively to correlate asynchronous response chunks in the client browser. The server never stores, indexes, or logs this ID into a database.
2. **Coordinate Sanitization:**
   * Bounding boxes and points passed to route handlers are used purely in-memory to execute upstream API fetches.
   * Server access logs strip or truncate client IP addresses (`x-forwarded-for` anonymization) and omit query strings containing coordinate parameters.
3. **Decoupling Agricultural Intent from Identity:**
   * Planned crop rotations, economic expectations, and farmer overrides never leave the client browser.
   * Upstream NASA queries receive only geographical coordinates (e.g., `lat=42.03&lng=-93.63`). NASA servers have zero visibility into who is querying the coordinate, what crop is being planted, or whether the point represents a commercial farm, research plot, or home garden.

---

### 6. Graceful Degradation & Transparency Fallback Matrix

#### Multi-Tier Architectural Matrix

```mermaid
flowchart TD
    Start["User Selects or Draws Field"] --> Init["Initialize Tier 1 Query (No Auth Required)"]
    
    subgraph T1["Tier 1: Baseline Engine (Immediate / Credential-Free)"]
        P1["NASA POWER (0.5° MERRA-2)"]
        S1["ISRIC SoilGrids v2 (250m)"]
        E1["Hargreaves ET0 Mathematical Engine"]
    end
    
    Init --> P1 & S1 & E1
    P1 & S1 & E1 --> T1Render["Render Field Baseline UI (< 3s)
- Rainfall Reliability
- Heat/Frost Windows
- Soil Texture/pH Fit"]
    
    T1Render --> CheckCreds{"Are Earthdata Credentials
Configured in Environment?"}
    
    CheckCreds -- No --> T1Static["Maintain Tier 1 Operation
Display Transparent Fallback Badge"]
    CheckCreds -- Yes --> DispatchT2["Dispatch Tier 2 Background Jobs
(AppEEARS / Harmony)"]
    
    subgraph T2["Tier 2: Authenticated Earthdata Cloud"]
        SMAP["SMAP L4 (9km Root-Zone Moisture)"]
        MODIS["MODIS MOD13Q1 (250m NDVI)"]
        IMERG["GPM IMERG (0.1° Precipitation)"]
    end
    
    DispatchT2 --> SMAP & MODIS & IMERG
    SMAP & MODIS & IMERG --> T2Complete["Tasks Complete (2–10 min)
Cache Results in IndexedDB"]
    T2Complete --> T2Overlay["Hydrate High-Res Satellite Overlays
Update UI with Sensor Citations"]
```

---

#### Tier 1 vs Tier 2 Comparative Breakdown

| Capability / Attribute | Tier 1: Immediate Baseline | Tier 2: Authenticated Earthdata |
| :--- | :--- | :--- |
| **Authentication Requirement** | **None.** Operates completely unauthenticated. | **NASA Earthdata Login (EDL)** Bearer Token / PAT. |
| **Target Satellites / Models** | NASA POWER (GMAO MERRA-2 assimilation model), ISRIC SoilGrids v2. | SMAP (Radar/Radiometer L4), Terra/Aqua MODIS, GPM Core Observatory (DPR/GMI). |
| **Spatial Resolution** | Meteorological: **0.5° ($\approx 50\text{ km}$)**<br/>Soil: **250 m**. | Soil Moisture: **9 km**<br/>NDVI: **250 m (MODIS)** or **30 m (HLS)**<br/>Precipitation: **0.1° ($\approx 10\text{ km}$)**. |
| **Latency** | **1.2 – 3.5 seconds** (synchronous). | **2 – 10 minutes** (asynchronous job queue). |
| **Hydrological Metrics** | Modelled soil wetness fraction (`GWETROOT`), Hargreaves reference evapotranspiration ($ET_0$). | Measured volumetric root-zone soil moisture ($m^3/m^3$), direct MOD13Q1 vegetation greenness index. |
| **Operational Status** | **Production active out-of-the-box.** | **Optional enhancement layer.** Activates automatically when credentials exist. |

---

#### UI Fallback Disclosure & Spatial Integrity Rules
To prevent misleading farmers with false precision, the application enforces strict visual and textual disclosure rules:

##### 1. The Spatial Context Rule ("Around Your Field")
* The system **never resamples a 0.5° ($\approx 50\text{ km}$) or 9 km grid cell down to the boundary of a 2-hectare farm** to imply field-level sensing.
* Coarse data is explicitly presented under the banner **"Regional Conditions (Around Your Field)"**.
* When displaying five sample points across a field polygon that all fall within the same 0.5° POWER cell, the application displays a single representative regional value, clearly stating:
  > *"All 5 field sample points reside within the same 50 km NASA POWER grid cell. Showing regional climate context."*

##### 2. Explicit Tier 1 Disclosure Banner
When running on Tier 1 (because Earthdata credentials are unset or Tier 2 jobs are compiling), the interface renders an explicit transparency badge:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ℹ️ REGIONAL CLIMATE BASELINE (TIER 1)                                       │
│                                                                             │
│ Soil moisture and weather data are derived from NASA POWER (MERRA-2 atmospheric│
│ reanalysis at 0.5° resolution) and ISRIC SoilGrids (250m global mapping).    │
│ Direct satellite radar observations (SMAP 9km) and satellite greenness       │
│ (MODIS 250m NDVI) are not active.                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

##### 3. Local Knowledge Precedence (The Override Rule)
If a farmer enters a laboratory soil test (e.g., pH `6.2`, Clay `28%`) or specifies local irrigation availability:
* The user's values **override modelled satellite or gridded values** across all suitability algorithms.
* The UI displays both values side-by-side with distinct provenance chips:
  * **Your Soil Test:** pH 6.2 (Used in calculation)
  * **ISRIC SoilGrids Estimate:** pH 7.1 (0–30 cm depth average, bypassed)

##### 4. Completeness & Uncertainty Quantification
* Missing or inaccessible data layers never collapse to zero, neutral averages, or fabricated scores.
* If a data layer fails, the UI renders **"Data Unavailable"** and explains which rotation trade-off checks cannot be verified.
* Precipitation reliability is stated as an empirical fraction of historical seasons rather than an abstract probability:
  > *"In 6 of the past 10 historical seasons, rainfall during the July flowering window fell below minimum crop water demand."*

---

### Summary Checklist for Implementation Verification

- [x] **Earthdata OAuth2 Flow:** Server-side bearer token management with cross-domain 302 redirect cookie persistence.
- [x] **CMR STAC Catalog Querying:** STAC v1.0.0 multi-DAAC searches using GeoJSON bounding boxes and ISO 8601 temporal ranges.
- [x] **NASA Harmony Integration:** Spatial clipping, reprojection to EPSG:4326, and COG transformation in AWS `us-west-2`.
- [x] **AppEEARS Asynchronous Lifecycle:** Point and polygon task submission, status polling, and multi-file bundle streaming.
- [x] **Direct S3 Zero-Egress Access:** AWS `us-west-2` execution with temporary STS credentials from `/s3credentials`.
- [x] **Next.js 16 Proxy Architecture:** Ephemeral coordinate routing, fill-value scrubbing, Hargreaves $ET_0$ calculation, and edge SWR caching.
- [x] **Mobile Outdoor Constraints:** High-contrast Light-Only Field Almanac design (WCAG > 7:1), 48px touch targets, zero dark mode tokens.
- [x] **IndexedDB Persistence:** Offline-first schema for fields, rotations, and analysis snapshots with parameter drift detection.
- [x] **Deterministic Cache Keys:** SHA-256 hash combining normalized geometry, rotation parameters, and library/formula SemVers.
- [x] **Dual Timestamping:** Strict separation of wall-clock `fetchedAt` from physical `observationDateRange`.
- [x] **Privacy & Anonymity:** Zero-account architecture; field ownership and crop intentions remain 100% client-side.
- [x] **Graceful Fallbacks:** Tier 1 (POWER + SoilGrids) out-of-the-box operation with explicit UI disclosure when Tier 2 satellite radar/NDVI is absent.

---

