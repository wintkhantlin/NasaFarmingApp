# Field Shift: Comparing Crop Rotations with NASA Earth Observations

**Scientific Methods, Algorithmic Decision Architecture, and Planetary Remote Sensing Specifications — Research Prototype v3.3**

*Field Shift is an experimental agronomic decision-support platform and research prototype. It is not an official NASA product, NASA does not endorse it, and its agronomic predictions have not been validated against long-term multi-location agronomic field trials. Its weather inputs have been audited against 10 years of NOAA GHCN-Daily meteorological ground stations (Section 12).*

---

## Document Overview & Export Notice

This document constitutes the authoritative, standalone **Whitepaper & Technical Specification** for the Field Shift platform. It compiles all system algorithms, planetary Earth observation datasets, operational update cadences, mathematical equations, data provenance contracts, and empirical validation benchmarks into a single self-contained reference.

### Summary of System Contents

```mermaid
flowchart TD
    subgraph Earth_Observations["1. Ingested Planetary Datasets"]
        P1["NASA POWER\n(MERRA-2 & GEOS-FP)\n50 km · Daily · 2-3d lag"]
        P2["NASA GPM IMERG\n(Final V07 & Late Run)\n11 km · Daily · 14h/3.5mo lag"]
        P3["USGS Landsat C2 L2\n(OLI/ETM+ via MPC)\n30 m · 8-16d · 2-3d lag"]
        P4["NASA SMAP L4\n(SPL4SMGP.008)\n9 km · Daily · 2.5-3d lag"]
        P5["MODIS Terra/Aqua\n(MOD13Q1.061)\n250 m · 16d · 2-4d lag"]
        P6["NASA ECOSTRESS\n(LSTE & JET via ISS)\n70 m · 1-5d · 1-2d lag"]
        P7["NASA SRTM DEM\n(SRTMGL1_NC.003)\n30 m · Static Baseline"]
        P8["ISRIC SoilGrids v2.0\n(ML Soil Properties)\n250 m · Static Baseline"]
    end

    subgraph Core_Engines["2. Core Algorithmic Engines"]
        E1["Bioclimatology & ET0 Engine\n(FAO-56 Penman-Monteith &\nHargreaves Empirical Fallback)"]
        E2["Hydrology & Soil Water Balance\n(Conserved 3-Zone Column &\nDynamic Depletion p(ETc))"]
        E3["Historical Season Replay\n(10-Season Loop 2016-2025 &\nAcute Reproductive Hazards)"]
        E4["Phytopathology & Agronomy\n(Species Host Matrix, Wilt\nIntervals & Residue Kinetics)"]
        E5["Radiometry & Geomorphometry\n(QA Bitmasking, Low-Cover Gap\nDetection & Horn's 3x3 Slope)"]
        E6["Candidate Generator\n(Regional Crop Templates &\nCircular Window Tiling)"]
        E7["MCDA & Regret Engine\n(Anchor Utility, Non-Imputation\n& Minimax Regret with P90)"]
    end

    subgraph Outputs["3. Farmer Decision Support"]
        O1["Plain-Language Field Hub & Comparisons"]
        O2["Immutable Evidence & Provenance Trace"]
        O3["Epistemic Honesty: Unknown is Not Zero"]
        O4["Local Extension Advisory Reports"]
    end

    Earth_Observations --> Core_Engines
    Core_Engines --> Outputs
```

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Agricultural Decision Dilemma
A farmer deciding what crop sequence to plant across a multi-year cycle must simultaneously balance biophysical suitability, soil moisture conservation, pest cycles, nutrient dynamics, and economic viability. Traditional smallholder and mid-scale farm planning relies primarily on personal recollection, local oral tradition, and coarse regional calendars. While valuable, these heuristics are inherently constrained to observed weather patterns and cannot anticipate systemic climate shifts or evaluate novel crop candidates under extreme weather exposures.

Conversely, contemporary Earth observations (EO) from spaceborne satellites, land surface models, and atmospheric reanalyses provide multi-decadal, globally contiguous records of precipitation, temperature, surface radiation, soil moisture, and vegetative vigor. However, these data streams remain inaccessible to agricultural decision-makers due to fundamental operational barriers:
1. **The Spatial Mismatch:** Planetary observations arrive as coarse-gridded rasters ($50\text{ km}$ atmospheric cells, $11\text{ km}$ satellite rainfall grids, $9\text{ km}$ microwave soil moisture). When unsophisticated software interpolates these directly to farm boundaries, it creates a dangerous illusion of parcel-scale precision.
2. **The Cognitive Gap:** Space agencies publish raw physical units (Kelvin, $\text{W}\cdot\text{m}^{-2}$, $\text{DN}$ reflectance) and product codes (`MOD13Q1`, `SPL4SMGP`) that require advanced geospatial workflows before offering agronomic insight.
3. **The Non-Imputation Problem:** Commercial farm management tools frequently default missing variables to zero or regional averages, awarding false passes to risky rotations.

### 1.2 The Field Shift Approach
Field Shift is an agronomic comparison engine designed to bridge this divide without compromising epistemic honesty. The application allows a farmer or extension officer to define a parcel boundary, record their current crop sequence, and benchmark it against alternative rotation candidates across identical historical weather sequences.

#### Governing Principles
- **Resolution Transparency:** Coarse gridded products are strictly labeled as regional background context ("around your field") and are never artificially resampled to simulate field-gate measurements.
- **The Non-Imputation Rule:** Missing data never defaults to zero or an average. Incomplete observations propagate strictly as `unknown` states, preventing unearned passes.
- **Historical Scenario Replay:** Rather than relying on uncalibrated seasonal forecasts, proposed sequences are replayed through daily weather from a 10-season historical baseline ($2016\text{–}2025$), tracking exact exposures to heat shock, flowering precipitation, cold sterility, and drought spells.
- **Farmer Data Primacy:** Physical measurements (e.g., laboratory soil tests, confirmed sowing dates, known irrigation depth) strictly supersede remote sensing or pedometric model estimates.
- **Plain-Language Primacy:** Decisions lead with concise agronomic sentences; technical units, formulas, and data provenance badges remain accessible in disclosures.

---

## 2. Master Dataset Update Cadence, Latency & Freshness Matrix

The table below provides a comprehensive operational overview of all Earth observation and environmental datasets integrated into the Field Shift platform.

| Dataset / Product Code | Source Agency & DAAC | Spatial Resolution | Temporal Resolution / Cadence | Production Latency (Freshness Lag) | Historical Archive Span | Operational Ingestion Pipeline & Update Mechanism | Fallback & Degraded State Policy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **NASA POWER Agroclimatology**<br>`MERRA-2` / `GEOS-FP` | NASA Langley Research Center (LaRC) | $0.5^\circ \times 0.625^\circ$<br>($\approx 50 \times 60\text{ km}$) | Daily summaries (aggregated from hourly) | **2 to 3 days** trailing latency | 1981-01-01 to present (app uses 2016–present) | Synchronous HTTPS Point API; cached locally in SQLite; forward processing driven by GEOS-FP | Primary weather source; zero-fill converted strictly to `null`; triggers Hargreaves $ET_0$ fallback if solar/wind missing |
| **NASA GPM IMERG Final Daily**<br>`GPM_3IMERGDF` (V07) | NASA GSFC / GES DISC | $0.1^\circ \times 0.1^\circ$<br>($\approx 11 \times 11\text{ km}$) | Daily total (aggregated from half-hourly) | **~3.5 months** (due to GPCC gauge calibration) | 1998-01-01 to 2025-09-30 (V07 end date) | Earthdata CMR discovery + OPeNDAP DAP4 point slicing with `EARTHDATA_TOKEN` | Used only if $\ge 95\%$ baseline days present; otherwise falls back to POWER `PRECTOTCORR`. Products are never blended |
| **NASA GPM IMERG Late Run**<br>`GPM_3IMERGDL` | NASA GSFC / GES DISC | $0.1^\circ \times 0.1^\circ$<br>($\approx 11 \times 11\text{ km}$) | Daily accumulation | **~14 hours** post-observation | Operational moving window (last 3.5 months) | Bidirectional morphing via Earthdata Cloud; operational near-real-time monitoring | Used for current-season tracking; falls back to NASA POWER if unauthenticated |
| **NASA GPM IMERG Early Run**<br>`GPM_3IMERGIS` | NASA GSFC / GES DISC | $0.1^\circ \times 0.1^\circ$<br>($\approx 11 \times 11\text{ km}$) | Half-hourly / Daily | **~4 hours** post-observation | Operational moving window | Forward-only morphing; flash flood screening | Rapid alert screening only; not used for multi-season baseline replay |
| **USGS Landsat C2 L2**<br>`landsat-c2-l2` (OLI/ETM+) | USGS / NASA LP DAAC | $30\text{ m} \times 30\text{ m}$ | 16-day repeat per satellite (8-day combined 8/9) | **2 to 3 days** post-overpass | 1982-08-22 to present | Microsoft Planetary Computer STAC discovery + SAS token HTTP byte-range window retrieval on COGs | Cloud/shadow screened via `qa_pixel`; requires $f_{\text{valid}} \ge 0.25$; falls back to AppEEARS MODIS |
| **MODIS Terra/Aqua VI**<br>`MOD13Q1.061` / `MYD13Q1` | NASA LP DAAC | $250\text{ m} \times 250\text{ m}$ | 16-day composite (Maximum Value Composite) | **2 to 4 days** post 16-day period | 2000-02-18 to present | Planetary Computer STAC discovery + Azure COG range reads; AppEEARS area job fallback | Used for 25-year regional phenology context; filtered via 16-bit `VI_Quality` bitmask |
| **NASA SMAP Level-4**<br>`SPL4SMGP.008` | NASA NSIDC / LP DAAC | $9\text{ km} \times 9\text{ km}$ EASE-Grid 2.0 | Daily composite (from 3-hourly snapshots) | **~2.5 to 3.0 days** (constrained by GEOS-FP) | 2015-03-31 to present | NASA AppEEARS Point API; asynchronous job polling; Earthdata login required | Regional root-zone wetness percentile only; never presented as field-gate moisture; reports `unknown` if missing |
| **NASA ECOSTRESS L2/L3**<br>`LSTE.002` / `JET.002` | NASA JPL / LP DAAC | $\approx 70\text{ m} \times 70\text{ m}$ (precessing swath) | Non-sun-synchronous (1 to 5 day variable revisit) | **1 to 2 days** post-acquisition | 2018-07-09 to present | NASA AppEEARS Area Subsetting API; filtered by cloud/water and conservative LST-QA | Thermal canopy depression and evapotranspiration context; never substituted for 2m air temperature |
| **NASA SRTM DEM**<br>`SRTMGL1_NC.003` | NASA JPL / LP DAAC | $1\text{ arc-sec} \approx 30\text{ m}$ | Static Topographic Baseline | **Static reference** (flown Feb 2000) | 2000-02-11 to 2000-02-22 | NASA AppEEARS Area Subsetting API | Feeds Horn's $3 \times 3$ slope gradient and atmospheric pressure elevation adjustments; static |
| **Harmonized Landsat-Sentinel**<br>`HLSL30.020` / `HLSS30.020` | NASA LP DAAC | $30\text{ m} \times 30\text{ m}$ | 2 to 3 days combined constellation revisit | **2 to 3 days** post-overpass | 2013-04-11 (L30) / 2015-11-28 (S30) to present | NASA AppEEARS Extraction API; Fmask QA screening | Sub-field gap vegetation screening; Earthdata-gated; degrades to Landsat C2 |
| **ISRIC SoilGrids v2.0**<br>`soilgrids.org` | ISRIC World Soil Information | $250\text{ m} \times 250\text{ m}$ | Static Modern Pedometric Baseline | **Static baseline** (v2.0 model released 2020) | Modern soil profile synthesis (1950–present) | Public REST API (`https://rest.isric.org/soilgrids/v2.0`); depth-weighted $0\text{--}30\text{ cm}$ integration | Tier 2 soil water retention fallback; superseded immediately by farmer lab test or field kit |
| **NOAA GHCN-Daily**<br>`GHCND` | NOAA NCEI | Station-specific coordinates | Daily meteorological observations | **1 to 2 days** (trailing station uploads) | Multi-decadal (100+ years globally) | Offline benchmark validation harness (`lib/validation/`, 2015–2024 records) | Used for ground-truth empirical auditing of satellite reanalysis inputs; not queried at runtime |
| **Myanmar Market Benchmarks**<br>DOA / Bayintnaung / MPBMSMA | DOA / Bayintnaung Wholesale / MPBMSMA | Regional production clusters | Seasonal / Annual market price surveys | **Updated Annually** (2024–2026 calibrated dataset) | 2020 to 2026 economic seasons | Static agronomic dictionary (`lib/data/crops/real-world-economics.ts`) | Feeds interval gross margin and regional income utility anchors ($M_{\text{bench}}$); overridden by farmer entry |

---

## 3. Comprehensive Inventory of System Algorithms

Field Shift executes a deterministic, multi-stage calculation pipeline where physical constraints, soil hydrology, and historical climate exposure filter candidate crop rotations prior to multi-criteria ranking:

```mermaid
flowchart TD
    In["Field Geometry & Soil Input\n(Point/Polygon, Lab Soil, Farm Limits)"] --> Reg["1. Regional Context Resolution\n(Ayeyarwady, Magway, Shan)"]
    Reg --> Cand["2. Candidate Generation & Dynamic Tiling\n(Regional Crop Templates & Sowing Windows)"]
    In --> Weather["3. Multi-Decadal Climate Fetch\n(NASA POWER, GPM IMERG, Planetary Computer)"]
    Cand & Weather --> Sim["4. Historical Season Replay Engine (2016-2025)\n(Per-Day Weather Window Projection)"]
    Sim --> Suit["5. Multi-Tiered Suitability Evaluation\n(Thermal, Sowing Window, Soil pH, Texture, Drainage)"]
    Sim --> Hydro["6. Conserved 3-Zone Soil Water Balance\n(Seedbed, Sub-Seedbed, Buffer & Dynamic Depletion)"]
    Sim --> Haz["7. Acute Climate Hazard Extraction\n(Heat Shock, Cold Sterility, Excess Rain, Dry Spells)"]
    Cand --> Phyto["8. Phytopathological & Agronomic Screen\n(Host Overlap, 3-Yr Wilt Break, Residue N Kinetics)"]
    Hydro & Haz & Phyto --> Score["9. Multi-Criteria Decision Analysis (MCDA)\n(Anchor Utility, Dynamic Renormalization & Minimax Regret)"]
    Score --> Out["10. Sourced Decision Summary & Traceability Report"]
```

---

### Algorithm 1: Astronomical & Extraterrestrial Solar Radiation Physics
Extraterrestrial radiation ($R_a$) drives the planetary energy balance and reference evapotranspiration. It is derived analytically from celestial mechanics (FAO-56, Eq. 21–25).

#### Formulations
The day of the year $J \in [1, 366]$ is calculated from the UTC calendar date:
$$J = \text{dayOfYear}(\text{date})$$

The solar declination $\delta$ (radians):
$$\delta = 0.409 \sin\left(\frac{2\pi}{365} J - 1.39\right)$$

The inverse relative Earth-Sun distance $d_r$:
$$d_r = 1 + 0.033 \cos\left(\frac{2\pi}{365} J\right)$$

The sunset hour angle $\omega_s$ (radians) for geographic latitude $\phi$ (radians):
$$\omega_s = \arccos\Big(\min\big(1, \max\big(-1, -\tan(\phi)\tan(\delta)\big)\big)\Big)$$

*Polar Singularity Protection:* Clamping the argument between $-1$ and $+1$ handles polar night ($\omega_s = 0$) and polar day ($\omega_s = \pi$) without producing `NaN` or runtime floating-point faults.

Extraterrestrial radiation $R_a$ in $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$:
$$R_a = \frac{24 \times 60}{\pi} G_{sc} \, d_r \left( \omega_s \sin(\phi)\sin(\delta) + \cos(\phi)\cos(\delta)\sin(\omega_s) \right)$$
where $G_{sc} = 0.0820 \, \text{MJ}\cdot\text{m}^{-2}\cdot\text{min}^{-1}$ (the solar constant), and $\phi = \frac{\pi}{180} \times \text{latDeg}$.

**Source Implementation:** `lib/engine/et0.ts` (`dayOfYear`, `extraterrestrialRadiation`)

---

### Algorithm 2: FAO-56 Penman-Monteith Reference Evapotranspiration ($ET_0$)
The FAO-56 Penman-Monteith equation defines the rate of evapotranspiration from a hypothetical clipped grass reference surface ($0.12\text{ m}$ height, surface resistance $70\text{ s}\cdot\text{m}^{-1}$, albedo $0.23$) with adequate water supply.

#### Formulation
$$ET_0 = \frac{0.408 \Delta (R_n - G) + \gamma \frac{900}{T_{\text{mean}} + 273} u_2 (e_s - e_a)}{\Delta + \gamma (1 + 0.34 u_2)}$$

#### Parameter Dictionary & Intermediate Terms
- **Daily Mean Temperature ($T_{\text{mean}}$):** $T_{\text{mean}} = \frac{T_{\max} + T_{\min}}{2}$ (${^\circ}\text{C}$).
- **Atmospheric Pressure ($P$):** Calculated from orthometric elevation $z$ ($\text{m}$) via barometric formula:
  $$P = 101.3 \left(\frac{293 - 0.0065 z}{293}\right)^{5.26} \quad (\text{kPa})$$
  *(or extracted directly from NASA POWER surface pressure `PS`)*.
- **Psychrometric Constant ($\gamma$):**
  $$\gamma = 0.000665 \times P \quad (\text{kPa}\cdot{^\circ}\text{C}^{-1})$$
- **Saturation Vapor Pressure ($e_s$):**
  $$e^\circ(T) = 0.6108 \exp\left(\frac{17.27 T}{T + 237.3}\right) \quad (\text{kPa})$$
  $$e_s = \frac{e^\circ(T_{\max}) + e^\circ(T_{\min})}{2} \quad (\text{kPa})$$
- **Actual Vapor Pressure ($e_a$):**
  $$e_a \approx e_s \frac{RH_{\text{mean}}}{100} \quad (\text{kPa})$$
- **Slope of Saturation Vapor Pressure Curve ($\Delta$):**
  $$\Delta = \frac{4098 \cdot e^\circ(T_{\text{mean}})}{(T_{\text{mean}} + 237.3)^2} \quad (\text{kPa}\cdot{^\circ}\text{C}^{-1})$$
- **Clear-Sky Solar Radiation ($R_{so}$):**
  $$R_{so} = (0.75 + 2 \times 10^{-5} z) R_a \quad (\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1})$$
- **Net Shortwave Radiation ($R_{ns}$):**
  $$R_{ns} = (1 - 0.23) R_s = 0.77 R_s \quad (\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1})$$
  *(where $R_s$ is NASA POWER `ALLSKY_SFC_SW_DWN`)*.
- **Net Longwave Radiation ($R_{nl}$):**
  $$R_{nl} = \sigma \left[ \frac{(T_{\max} + 273.16)^4 + (T_{\min} + 273.16)^4}{2} \right] \left( 0.34 - 0.14 \sqrt{\max(e_a, 0)} \right) \left( 1.35 \frac{R_s}{R_{so}} - 0.35 \right)$$
  where $\sigma = 4.903 \times 10^{-9} \, \text{MJ}\cdot\text{K}^{-4}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$, and the cloudiness ratio $\frac{R_s}{R_{so}}$ is strictly clamped to $[0.3, 1.0]$.
- **Net Radiation ($R_n$):** $R_n = R_{ns} - R_{nl}$.
- **Soil Heat Flux Density ($G$):** For daily timesteps, $G \approx 0$.

**Source Implementation:** `lib/engine/et0.ts` (`penmanMonteithEt0`)

---

### Algorithm 3: Hargreaves-Samani Empirical Evapotranspiration Fallback
When daily solar radiation ($R_s$), relative humidity ($RH$), or wind speed ($u_2$) are missing from the primary weather feed, the system falls back to the empirical Hargreaves-Samani (1985) model driven solely by temperature and extraterrestrial radiation.

#### Formulation
$$ET_{0,\text{Hargreaves}} = \max\left(0, \, 0.0023 \cdot (T_{\text{mean}} + 17.8) \cdot \sqrt{\max(T_{\max} - T_{\min}, 0)} \cdot 0.408 R_a\right)$$
where $0.408$ converts $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$ to equivalent water depth in $\text{mm}\cdot\text{day}^{-1}$.

#### Degradation Flag
Whenever this path executes, the returned calculation metadata sets:
```typescript
usedFallbackEt0: true
```
This is surfaced explicitly in the UI provenance drawer to prevent misleading precision claims.

**Source Implementation:** `lib/engine/et0.ts` (`hargreavesEt0`)

---

### Algorithm 4: Crop Evapotranspiration ($ET_c$) & Dynamic Phenological Stages
Crop evapotranspiration under standard conditions is modeled via single-crop coefficients:
$$ET_{c,t} = K_c(t) \cdot ET_{0,t}$$

#### 4-Stage Phenological Segmentation
The complete growing cycle $[t_{\text{sow}}, t_{\text{harvest}}]$ of duration $L$ days is partitioned using calibrated developmental fractions $f_{\text{ini}}, f_{\text{dev}}, f_{\text{mid}}, f_{\text{late}}$ ($\sum f_i = 1.0$):
1. **Initial Stage ($L_{\text{ini}} = f_{\text{ini}} \cdot L$):** Crop coefficient is constant at $K_{c,\text{ini}}$.
2. **Development Stage ($L_{\text{dev}} = f_{\text{dev}} \cdot L$):** Linear interpolation from $K_{c,\text{ini}}$ to $K_{c,\text{mid}}$:
   $$K_c(t) = K_{c,\text{ini}} + \left(\frac{t - L_{\text{ini}}}{L_{\text{dev}}}\right) (K_{c,\text{mid}} - K_{c,\text{ini}})$$
3. **Mid-Season Stage ($L_{\text{mid}} = f_{\text{mid}} \cdot L$):** Crop coefficient is constant at $K_{c,\text{mid}}$.
4. **Late-Season Stage ($L_{\text{late}} = f_{\text{late}} \cdot L$):** Linear decline from $K_{c,\text{mid}}$ to $K_{c,\text{end}}$:
   $$K_c(t) = K_{c,\text{mid}} - \left(\frac{t - (L_{\text{ini}} + L_{\text{dev}} + L_{\text{mid}})}{L_{\text{late}}}\right) (K_{c,\text{mid}} - K_{c,\text{end}})$$

Seasonal potential crop water demand is the sum of daily demand:
$$ET_{c,\text{season}} = \sum_{t=t_{\text{sow}}}^{t_{\text{harvest}}} ET_{c,t}$$

**Source Implementation:** `lib/engine/water.ts` (`waterForCrop`), `lib/engine/season.ts` (`stageWindows`)

---

### Algorithm 5: Conserved Three-Zone Soil Hydrological Balance & Dynamic Depletion

#### Dynamic Soil Depletion Fraction ($p$)
The fraction of Total Available Water ($TAW$) that a crop can extract without water stress varies dynamically with atmospheric evaporative demand:
$$p(ET_c) = \text{clamp}\left(p_{\text{base}} + 0.04 \cdot (5 - ET_c), \, 0.1, \, 0.8\right)$$
where $p_{\text{base}}$ is the crop-specific table value at $ET_c = 5\text{ mm}\cdot\text{day}^{-1}$ (FAO-56, Eq. 84).

#### Three-Zone Column Architecture
To eliminate numerical averaging artifacts that disguise shallow seedling desiccation while roots are small, the soil column is divided into three non-overlapping compartments:
1. **$Z_1$ Seedbed Compartment:** Fixed depth $Z_1 = 0.10\text{ m}$. Governed by direct atmospheric evaporation and precipitation infiltration. Controls germination and early emergence.
2. **$Z_2$ Sub-Seedbed Compartment:** Dynamic depth $Z_2(t) = \max(0, \, Z_r(t) - Z_1)$, where $Z_r(t)$ expands linearly from $Z_{r,\text{ini}}$ to $Z_{r,\max}$. Governed by root water uptake.
3. **$Z_3$ Deep Buffer Compartment:** Depth $Z_3(t) = \max(0, \, Z_{\text{profile}} - Z_r(t))$. Acts as subsoil water reservoir and receives deep percolation.

#### State Transition Equations
For day $t$, with effective rainfall $P_t$, irrigation $I_t$, runoff $RO_t$, evaporation $E_t$, transpiration $T_t$, and deep drainage $DP_t$:

$$D_{r,t} = D_{r,t-1} - (P_t - RO_t) - I_t - CR_t + ET_{c,t} + DP_t$$

Boundary conditions:
- If $D_{r,t} < 0$: Water exceeds Field Capacity ($\theta_{FC}$). Excess drains via deep percolation:
  $$DP_t = -D_{r,t}, \quad D_{r,t} = 0$$
- If $D_{r,t} > TAW$: Soil moisture reaches Permanent Wilting Point ($\theta_{WP}$):
  $$D_{r,t} = TAW$$

#### Stress Day Counting
A hydrological water-stress day is counted when root-zone depletion exceeds readily available water:
$$\text{StressDay}_t = \mathbb{I}(D_{r,t} > p(ET_{c,t}) \cdot TAW)$$

*Conservation Invariant:* Mass balance across all compartments is verified in automated unit testing to conserve water to $\le 10^{-9}\text{ mm}$.

**Source Implementation:** `lib/engine/water.ts` (`rootZoneBalance`, `threeZoneBalance`)

---

### Algorithm 6: Post-Paddy Drainage Window & Soil Trafficability Model
In lowland rice systems (e.g., Ayeyarwady delta), sequential dry-season pulse crops (black gram, green gram) are sown directly into residual moisture following monsoon paddy harvest. Puddled soils develop a compacted plough pan that perches water.

#### Drainage Formulation
Post-paddy drainage is modeled as an exponential relative saturation decay:
$$S_{\text{rel}}(t) = S_{\text{rel},0} \cdot \exp(-k_{\text{drain}} \cdot t)$$
where $S_{\text{rel}} = \frac{\theta - \theta_{WP}}{\theta_{FC} - \theta_{WP}}$, and $k_{\text{drain}}$ is calibrated to local soil texture (clay: $0.03\text{ d}^{-1}$; sandy loam: $0.12\text{ d}^{-1}$).

#### Agronomic Trafficability Thresholds
1. **Waterlogged ($S_{\text{rel}} > 0.85$):** Anoxia blocks root respiration; machinery/bullocks cause severe soil compaction. Unworkable.
2. **Optimum Sowing Window ($0.50 \le S_{\text{rel}} \le 0.85$):** Soil is friable, aerated, and contains sufficient moisture for germination.
3. **Desiccated Seedbed ($S_{\text{rel}} < 0.50$):** Surface soil crusts; pulse seeds fail to emerge without supplemental irrigation.

If soil drainage class or field moisture is unverified, the system returns `field-check-needed` rather than guessing a sowing window.

**Source Implementation:** `lib/engine/water.ts` (`assessPaddyDrainageWindow`)

---

### Algorithm 7: Historical Season Replay & Extreme Hazard Detection
The platform replays candidate sequences across the 10-season historical baseline ($2016\text{–}2025$, 3653 days).

#### Data Completeness Criterion
A historical crop season window $[t_{\text{sow}}, t_{\text{harvest}}]$ is valid for analysis only if valid weather observations span at least $90\%$ of calendar days:
$$\frac{N_{\text{valid}}}{N_{\text{total}}} \ge 0.90$$

#### Stage-Aware Acute Hazards
Extreme weather triggers are evaluated during specific developmental stages:
1. **Flowering Heat Shock:** Extreme temperature during anthesis disrupts pollen viability:
   $$\text{HeatShockDays} = \sum_{t \in \text{flowering}} \mathbb{I}(T_{\max,t} > T_{\text{crit,heat}})$$
   *(e.g., $T_{\text{crit,heat}} = 35.0^\circ\text{C}$ for maize/rice; $38.0^\circ\text{C}$ for sesame)*.
2. **Flowering Cold Sterility:** Cold nights during microspore development induce spikelet sterility:
   $$\text{ColdSterilityDays} = \sum_{t \in \text{flowering}} \mathbb{I}(T_{\min,t} < T_{\text{crit,cold}})$$
   *(e.g., $T_{\text{crit,cold}} = 12.0^\circ\text{C}$ for tropical lowland rice)*.
3. **Excess Flowering Precipitation:** Heavy rain during open pollination washes away pollen:
   $$\text{RainPollinationShockDays} = \sum_{t \in \text{flowering}} \mathbb{I}(P_t \ge 10.0\text{ mm}\cdot\text{day}^{-1})$$
4. **Maximum Consecutive Dry Spell ($MCDS$):**
   $$MCDS = \max_{k} \left\{ \Delta t_k : P_t < 1.0\text{ mm}\cdot\text{day}^{-1} \, \forall t \in [t_k, t_k + \Delta t_k] \right\}$$
5. **Heavy Storm Erosion Hazard:**
   $$\text{HeavyRainDays} = \sum_{t \in \text{season}} \mathbb{I}(P_t \ge 50.0\text{ mm}\cdot\text{day}^{-1})$$

**Source Implementation:** `lib/engine/season.ts`, `lib/engine/exposure.ts`, `lib/engine/rain.ts`

---

### Algorithm 8: Hemispheric Frost Climatology
In temperate or highland zones (e.g., Shan State), frost bounds the vegetative window.

#### Southern Hemisphere Calendar Displacement
To account for winter occurring in June–August in southern latitudes, day-of-year is shifted by half a year:
$$doy_{\text{shifted}} = \left( (doy + 182) \bmod 365 \right) + 1$$

#### Metric Derivations
- **Split Day ($d_{\text{split}} = 200$):** Divides the annual cycle into late-winter/spring thaw and autumn cooldown.
- **Last Spring Frost ($LSF$):** Latest day in the first half of the cycle with $T_{\min} \le 0.0^\circ\text{C}$.
- **First Autumn Frost ($FAF$):** Earliest day in the second half of the cycle with $T_{\min} \le 0.0^\circ\text{C}$.
- **Frost-Free Days ($FFD$):**
  $$FFD = FAF - LSF$$

**Source Implementation:** `lib/engine/exposure.ts` (`frostFreeDays`)

---

### Algorithm 9: Agro-Thermal Growing Degree Days (GDD)
Thermal time accumulation determines phenological progression:
$$GDD_t = \max\left(0, \, \frac{\min(T_{\max,t}, T_{\text{cap}}) + \max(T_{\min,t}, T_{\text{base}})}{2} - T_{\text{base}}\right)$$
$$GDD_{\text{cum}} = \sum_{t=t_{\text{sow}}}^{t_{\text{harvest}}} GDD_t$$
where $T_{\text{base}}$ is crop base temperature (e.g., $10.0^\circ\text{C}$ for maize; $8.0^\circ\text{C}$ for chickpea) and $T_{\text{cap}}$ is upper metabolic plateau (e.g., $30.0^\circ\text{C}$).

**Source Implementation:** `lib/engine/season.ts` (`calculateGdd`)

---

### Algorithm 10: Remote Sensing Radiometry & QA Bitmask Decoding

#### Spectral Vegetation Indices
$$NDVI = \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + \rho_{\text{Red}}}, \quad NDMI = \frac{\rho_{\text{NIR}} - \rho_{\text{SWIR1}}}{\rho_{\text{NIR}} + \rho_{\text{SWIR1}}}$$
Valid only when $(\rho_{\text{NIR}} + \rho_{\text{Red}}) > 0$.

#### USGS Landsat Collection 2 `qa_pixel` Bitmask Decoding
Pixels are filtered using the 16-bit USGS bitmask:
- Bit 0: Fill $\to$ Rejected
- Bit 1: Dilated Cloud $\to$ Rejected
- Bit 2: Cirrus Cloud $\to$ Rejected
- Bit 3: Cloud $\to$ Rejected
- Bit 4: Cloud Shadow $\to$ Rejected
- Bit 5: Snow $\to$ Rejected
- Bit 7: Water $\to$ Flagged as water surface, excluded from vegetative soil analysis

#### Valid Field Extraction Gate
A satellite scene overpass is accepted for field-level vegetation tracking if and only if the fraction of clear-sky, valid land pixels within the parcel polygon satisfies:
$$f_{\text{valid}} = \frac{N_{\text{valid\_pixels}}}{N_{\text{total\_pixels}}} \ge 0.25$$
Scenes with $f_{\text{valid}} < 0.25$ are withheld to prevent spurious cloud-edge noise.

**Source Implementation:** `lib/nasa/derive/*`, `lib/nasa/qa/*`

---

### Algorithm 11: Bare-Field & Low-Cover Detection
Unplanted gaps in rotations leave soil vulnerable to erosion and organic matter oxidation.

#### Detection Logic
1. Extract all cloud-screened satellite scenes (Landsat/HLS/MODIS) falling within the unplanted window $[t_{\text{harvest}, a}, t_{\text{sow}, b}]$.
2. Exclude waterlogged scenes (water pixels $> 30\%$).
3. If valid clear-sky scenes $< 2 \implies$ report `planned-gap-no-clear-imagery`.
4. If $\ge 50\%$ of valid clear-sky scenes exhibit $NDVI < 0.25 \implies$ classify gap as `possible-low-cover`.
5. Otherwise classify as `green-in-past-years` (volunteer weeds, cover crop, or natural regeneration).

**Source Implementation:** `lib/engine/lowcover.ts` (`assessGaps`)

---

### Algorithm 12: Topographic Geomorphometry (Horn's $3 \times 3$ Slope)
Topographic slope is derived from the $30\text{ m}$ SRTM Digital Elevation Model using Horn's (1981) finite-difference operator across a $3 \times 3$ elevation window:

$$\begin{bmatrix} z_{1,1} & z_{1,2} & z_{1,3} \\ z_{2,1} & z_{2,2} & z_{2,3} \\ z_{3,1} & z_{3,2} & z_{3,3} \end{bmatrix}$$

#### East-West and North-South Gradient Derivation
$$\frac{\partial z}{\partial x} = \frac{(z_{1,3} + 2z_{2,3} + z_{3,3}) - (z_{1,1} + 2z_{2,1} + z_{3,1})}{8 \cdot \Delta x}$$
$$\frac{\partial z}{\partial y} = \frac{(z_{3,1} + 2z_{3,2} + z_{3,3}) - (z_{1,1} + 2z_{1,2} + z_{1,3})}{8 \cdot \Delta y}$$

where metric cell dimensions are computed from geographic coordinates:
$$\Delta y = \Delta\phi_{\text{deg}} \times 111{,}320\text{ m}, \quad \Delta x = \Delta\lambda_{\text{deg}} \times 111{,}320\text{ m} \times \cos(\phi_{\text{centre}})$$

#### Slope Gradient in Degrees
$$\text{Slope}_{\text{deg}} = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180}{\pi}$$

#### Erosion Risk Screening
- Moderate Hazard: $\text{Slope}_{\text{deg}} \ge 8.0^\circ$ coinciding with `possible-low-cover` and seasonal rain $> 500\text{ mm}$.
- Severe Hazard: $\text{Slope}_{\text{deg}} \ge 15.0^\circ$ coinciding with bare soil and heavy rain days ($P \ge 50\text{ mm}$).

**Source Implementation:** `lib/nasa/derive/slope.ts`

---

### Algorithm 13: Phytopathological Risk & Disease Breaks
Botanical family alone is insufficient to evaluate disease breaks. Two legumes may share zero common pathogens, while rice (Poaceae) and black gram (Fabaceae) both host *Rhizoctonia solani*. The system executes an organism-specific evaluation:

#### Carryover Modes
1. **Soil-Borne Pathogens:** (*Rhizoctonia solani*, *Macrophomina phaseolina*, *Athelia rolfsii*, root-knot nematodes *Meloidogyne* spp.). Sclerotia and eggs persist in soil for years. A caution flag is raised whenever crop $b$ follows crop $a$ and both are confirmed hosts, regardless of gap duration.
2. **Vector-Borne Pathogens & Mobile Insects:** (Geminiviruses / Yellow Mosaic Virus transmitted by *Bemisia tabaci*, *Helicoverpa armigera*, *Maruca vitrata*, fall armyworm). Flagged as a critical **green bridge alert** if and only if the turnaround gap between host crops is $\le 30\text{ days}$.
3. **Host-Specific Vascular Wilts:** (*Fusarium oxysporum* f. sp. *ciceris* in chickpea, *Fusarium udum* in pigeon pea). Chlamydospores survive multi-year intervals. For a rotation cycle of $n$ years with $k$ host occurrences, the return interval is:
   $$\text{ReturnInterval} = \frac{n}{k} \quad (\text{years})$$
   - If $\frac{n}{k} < 3.0\text{ years} \implies$ Flagged as high risk.
   - If the farmer confirms wilt in the field profile $\implies$ Hard veto against the candidate.

**Source Implementation:** `lib/engine/pest-outlook.ts`, `lib/data/crops/host-organisms.ts`

---

### Algorithm 14: Biogeochemistry, Biological Nitrogen Fixation (BNF) & Residue Kinetics

#### BNF Interval Estimation
Legume atmospheric nitrogen fixation is expressed as an uncertainty interval:
$$N_{\text{fixed,cycle}} = \sum_{s \in \text{legumes}} [N_{\text{fix,min},s}, \, N_{\text{fix,max},s}] \quad (\text{kg N}\cdot\text{ha}^{-1}\cdot\text{yr}^{-1})$$

#### Harvest Nitrogen Removal
$$N_{\text{removed,cycle}} = \sum_{s \in \text{crops}} \left( Y_s \cdot \frac{[N_{\text{grain},s}]}{100} \right) \quad (\text{kg N}\cdot\text{ha}^{-1}\cdot\text{yr}^{-1})$$
*Rule:* Requires farmer-entered harvest yield ($Y_s$). If missing, harvest removal is marked `unknown`; it is never fabricated.

#### Residue Fate Kinetics
1. `retain_incorporate`: Green manure or stover tilled into soil. Mineralization delivers $25\text{--}40\%$ of legume nitrogen to the succeeding crop. If cereal residue with high C:N ratio ($> 60:1$) is incorporated $< 21\text{ days}$ prior to planting, an **N-immobilization penalty** alerts the farmer to add starter nitrogen.
2. `retain_mulch`: Surface cover protects against raindrop impact; slower decomposition.
3. `remove_fodder`: Straw exported for livestock feed; zero residual nitrogen credit.
4. `burn`: Atmospheric volatilization of nitrogen and carbon; zero credit.

**Source Implementation:** `lib/engine/nitrogen.ts`, `lib/engine/soil-health.ts`

---

### Algorithm 15: Soil Data Arbitration & Pedotransfer Functions

#### Arbitration Hierarchy
$$\text{Rank 0: Laboratory Soil Test} \succ \text{Rank 1: Certified Field Kit} \succ \text{Rank 2: ISRIC SoilGrids 2.0} \succ \text{Rank 3: Farmer Estimate}$$
Entries are sorted by rank ascending, then by observation date descending (most recent first). Missing properties remain `null`.

#### Saxton-Rawls (2006) Pedotransfer Equations
When water retention measurements are absent, field capacity ($\theta_{FC}$), wilting point ($\theta_{WP}$), and available water capacity ($AWC$) are derived from sand, clay, and organic matter percentages:
$$\theta_{1500t} = -0.024 S + 0.487 C + 0.006 OM + 0.005 (S \times OM) - 0.013 (C \times OM) + 0.068 (S \times C) + 0.031$$
$$\theta_{WP} = \theta_{1500t} + (0.14 \times \theta_{1500t} - 0.02)$$
$$\theta_{33t} = -0.251 S + 0.195 C + 0.011 OM + 0.006 (S \times OM) - 0.027 (C \times OM) + 0.452 (S \times C) + 0.299$$
$$\theta_{FC} = \theta_{33t} + (1.283 \times \theta_{33t}^2 - 0.374 \times \theta_{33t} - 0.015)$$
$$AWC = 1000 \cdot (\theta_{FC} - \theta_{WP}) \quad (\text{mm}\cdot\text{m}^{-1})$$

**Source Implementation:** `lib/engine/soil-input.ts`, `lib/soil/soilgrids.ts`

---

### Algorithm 16: Multi-Criteria Decision Analysis (MCDA) & Optimization Under Uncertainty

#### Objective Formulation
$$S(R) = \sum_{i \in \mathcal{C}_{\text{active}}} w'_i \cdot s_i(R)$$

#### Evaluation Criteria Set
| Criterion ID | Description | Direction | Units | Associated Farmer Priority |
| :--- | :--- | :--- | :--- | :--- |
| `water-shortfall` | Rain shortfall vs crop potential demand | Lower is better | $\text{mm}/\text{crop}$ | `water` |
| `soil-legume-share` | Share of rotation cycle slots with legumes | Higher is better | Ratio $[0, 1]$ | `soil` |
| `soil-cover` | Share of cycle calendar days with vegetative cover | Higher is better | Ratio $[0, 1]$ | `soil` |
| `income-margin` | Estimated midpoint gross margin | Higher is better | $\text{MMK}\cdot\text{ha}^{-1}\cdot\text{yr}^{-1}$ | `income` |
| `forage-slots` | Crops yielding fodder or forage | Higher is better | $\text{count}/\text{year}$ | `forage` |
| `input-nitrogen` | Total external synthetic N fertilizer requirement | Lower is better | $\text{kg N}\cdot\text{ha}^{-1}\cdot\text{yr}^{-1}$ | `lower-inputs` |

#### Regional Benchmark Income Utility Anchoring
To preserve Independence of Irrelevant Alternatives (IIA) and prevent ranking flips when candidates are added or removed, income is normalized against a fixed regional benchmark:
$$u_{\text{income}} = \text{clip}\left(\frac{M_{\text{mid}}}{M_{\text{bench}}}, \, 0, \, 1\right)$$
where $M_{\text{bench}}$ is the midpoint margin of the region's typical baseline rotation:
- Ayeyarwady Delta: Monsoon Rice $\to$ Black Gram ($M_{\text{bench}} \approx 1{,}150{,}000\text{ MMK/ha}$)
- Central Dry Zone (Magway): Early Sesame $\to$ Green Gram ($M_{\text{bench}} \approx 850{,}000\text{ MMK/ha}$)
- Shan State Highlands: Grain Maize $\to$ Soybean ($M_{\text{bench}} \approx 1{,}450{,}000\text{ MMK/ha}$)

#### Dynamic Weight Renormalization
Active criteria weights are normalized over available evidence:
$$w'_i = \frac{w_i}{\sum_{j \in \mathcal{C}_{\text{active}}} w_j}$$

#### Minimax Regret with $P_{90}$ Tie-Breaking
Regret matrix $R_{i,j}$ for rotation $i$ in season $j$:
$$R_{i,j} = \max_{k}(S_{k,j}) - S_{i,j}$$
Maximum regret: $L_{\max}(i) = \max_j (R_{i,j})$. Ties are broken by 90th-percentile regret $L_{P90}$.

**Source Implementation:** `lib/engine/mcda.ts` (`rankRotations`)

---

### Algorithm 17: Farm Economics, Interval Gross Margin & Water-Stress Yield Discount

#### Closed-Interval Gross Margin
$$\text{GrossMargin} = [Y_{\min} \cdot P_{\min} - C_{\max}, \, Y_{\max} \cdot P_{\max} - C_{\min}]$$
Calculated strictly via interval arithmetic without fabricating probability distributions.

#### Annualization
$$\text{AnnualMargin} = \text{GrossMargin} \times \left(\frac{365}{\text{CycleDays}}\right)$$

#### FAO-33 / FAO-66 Water-Limited Yield Response (Optional)
When seasonal water deficit occurs and species-calibrated yield response factors ($K_y$) exist:
$$\left(1 - \frac{Y_a}{Y_m}\right) = K_y \left(1 - \frac{ET_{c,\text{act}}}{ET_{c,\text{pot}}}\right)$$
*Guard:* Applied only when baseline farmer yield is explicitly marked as non-water-limited.

**Source Implementation:** `lib/engine/economics.ts`, `lib/data/crops/real-world-economics.ts`

---

## 4. Ground-Truth Validation, Model Limitations & Operational Guidelines

### 4.1 Empirical Validation Against NOAA GHCN-Daily Stations (2015–2024)
An empirical audit was executed comparing 10 continuous years of NASA POWER reanalysis against 5 NOAA Global Historical Climatology Network (GHCN-Daily) stations across Myanmar (`docs/validation/WEATHER_VALIDATION.md`).

| Station | Climate Zone | Lat / Lon | Elevation | Rain Relative Bias | Rain Correlation ($r$) | $T_{\max}$ Mean Bias | $T_{\min}$ Mean Bias | Operational Reliability Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mandalay** | Central Dry Zone | $21.98^\circ\text{N}, 96.08^\circ\text{E}$ | $76\text{ m}$ | **$-51.2\%$** | $0.48$ | $+0.4^\circ\text{C}$ | $+0.8^\circ\text{C}$ | **Rain Severely Biased.** Reanalysis rainfall understates ground gauge totals by roughly half. In-app caution banner mandatory. |
| **Sittwe** | Coastal Maritime | $20.13^\circ\text{N}, 92.88^\circ\text{E}$ | $8\text{ m}$ | $-12.4\%$ | $0.78$ | **$-3.1^\circ\text{C}$** | **$+5.0^\circ\text{C}$** | **Temperature Distorted.** $50\text{ km}$ cell blends land and sea surface temperatures. Heat/cold shock checks disabled. |
| **Kawthaung** | Southern Coastal | $10.02^\circ\text{N}, 98.55^\circ\text{E}$ | $15\text{ m}$ | $-8.6\%$ | $0.81$ | **$-2.8^\circ\text{C}$** | **$+4.6^\circ\text{C}$** | **Temperature Distorted.** Maritime dampening compresses diurnal temperature range ($T_{\max} - T_{\min}$). |
| **Yangon** | Deltaic Lowland | $16.77^\circ\text{N}, 96.17^\circ\text{E}$ | $14\text{ m}$ | $-14.1\%$ | $0.74$ | $-0.6^\circ\text{C}$ | $+1.2^\circ\text{C}$ | **Moderately Usable.** Rainfall captures monsoon onset; minor coastal temperature warming. |
| **Meiktila** | Southern Dry Zone | $20.88^\circ\text{N}, 95.87^\circ\text{E}$ | $220\text{ m}$ | **$-44.7\%$** | $0.52$ | $+0.8^\circ\text{C}$ | $+0.6^\circ\text{C}$ | **Rain Severely Biased.** Underestimates localized convective cloudbursts. Water balance requires local rain gauge. |

### 4.2 Known Model Limitations
1. **Paddy Saturated Store:** The water balance model is a surface ponding screen for lowland rice; it does not simulate saturated flow mechanics within a puddled soil matrix.
2. **Coarse Spatial Resolution:** NASA POWER ($50\text{ km}$) and IMERG ($11\text{ km}$) cannot capture microclimatic valley inversions or localized mountain rain shadows.
3. **Greenness vs Ground Truth:** Landsat $NDVI$ cannot differentiate between volunteer weeds, cover crops, or emerging cash crops. Cloud cover during peak monsoon leaves multi-week observation gaps.
4. **SoilGrids Regional Uncertainties:** SoilGrids v2.0 represents an ensemble machine-learning prediction with high uncertainty in tropical soils. Farmers should obtain physical soil tests.

---

## 5. System Version Evolution & Changelogs

### Version 3.3 (November 2026)
- **NOAA GHCN-Daily Ground-Truth Audit:** Embedded empirical validation harness (`lib/validation/weather.ts`) establishing the $-51\%$ Dry Zone precipitation bias and maritime coastal temperature distortions.
- **Source Reliability Banners:** Introduced real-time geospatial alerts warning farmers when parcel coordinates fall into the Dry Zone reanalysis bias boundary.
- **Organism-Specific Pathogen Tracking:** Migrated from generic family-level warnings to explicit host matrices (`lib/data/crops/host-organisms.ts`) capturing soil-borne, vector-borne, and vascular wilt pathogens.
- **Multi-Year Vascular Wilt Return Intervals:** Implemented mathematical checks ($n/k \ge 3\text{ years}$) and hard veto logic for persistent soil wilts (*Fusarium oxysporum* f. sp. *ciceris* and *F. udum*).
- **Weather-Driven Disease Risk Spells:** Replayed daily temperature and wetness sequences to quantify seasonal disease favourability.
- **Benchmark-Anchored Income Utility:** Bound MCDA margin scoring to calibrated regional market baseline rotations (Ayeyarwady, Magway, Shan), enforcing Independence of Irrelevant Alternatives.

### Version 3.2 (October 2026)
- **Conserved Three-Zone Hydrological Column:** Transitioned to a 3-zone non-overlapping soil column ($Z_1$ seedbed, $Z_2$ sub-seedbed, $Z_3$ buffer), eliminating numerical averaging and verifying mass conservation to $\le 10^{-9}\text{ mm}$.
- **Dynamic Depletion Fraction:** Replaced static $p = 0.5$ with dynamic FAO-56 Eq. 84 formulation $p(ET_c) = \text{clamp}(p_{\text{base}} + 0.04(5 - ET_c), 0.1, 0.8)$.
- **Mechanistic Post-Paddy Drainage Window:** Built exponential recession model tracking seedbed relative saturation over puddled plough pan.
- **Stage-Aware Acute Reproductive Hazards:** Added acute heat shock ($>35^\circ\text{C}$), cold sterility, and excess flowering rain counters during anthesis.
- **Residue Nitrogen Kinetics:** Added selectable residue management practices, C:N immobilization alerts, and $25\text{--}40\%$ first-season legume mineralization.

### Version 3.1 (August 2026)
- **Anchor Utility Architecture:** Introduced target/limit anchor scaling to replace unanchored min-max scoring.
- **Non-Imputation Mandate:** Eliminated all zero-defaulting for missing environmental variables.
- **Minimax Regret Optimization:** Integrated worst-case regret evaluation across historical seasons.

---

## 6. References & Scientific Standards

1. **Allen, R.G., Pereira, L.S., Raes, D., & Smith, M. (1998).** *Crop evapotranspiration: Guidelines for computing crop water requirements.* FAO Irrigation and Drainage Paper 56, Food and Agriculture Organization of the United Nations, Rome, Italy.
2. **Hargreaves, G.H., & Samani, Z.A. (1985).** *Reference crop evapotranspiration from temperature.* Applied Engineering in Agriculture, 1(2), 96-99.
3. **Horn, B.K. (1981).** *Hill shading and the reflectance map.* Proceedings of the IEEE, 69(1), 14-47.
4. **ISRIC (2020).** *SoilGrids250m 2.0: Global gridded soil information produced using machine learning.* International Soil Reference and Information Centre, Wageningen, Netherlands.
5. **Huffman, G.J., et al. (2020).** *Integrated Multi-satellitE Retrievals for GPM (IMERG) technical documentation.* NASA Goddard Space Flight Center.
6. **Saxton, K.E., & Rawls, W.J. (2006).** *Soil water characteristic estimates by texture and organic matter for hydrologic solutions.* Soil Science Society of America Journal, 70(5), 1569-1578.
7. **Doorenbos, J., & Kassam, A.H. (1979).** *Yield response to water.* FAO Irrigation and Drainage Paper 33, FAO, Rome.
8. **Steduto, P., Hsiao, T.C., Fereres, E., & Raes, D. (2012).** *Crop yield response to water.* FAO Irrigation and Drainage Paper 66, FAO, Rome.
9. **Menne, M.J., et al. (2012).** *An overview of the Global Historical Climatology Network-Daily database.* Journal of Atmospheric and Oceanic Technology, 29(7), 897-910.
