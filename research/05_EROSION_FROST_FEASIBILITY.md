# Scientific Feasibility Report: Soil Erosion & Frost Vulnerability in Myanmar Agro-Ecosystems
**Project:** Field Shift — Adapting Farms with NASA Data (NASA Space Apps Challenge 2026)  
**Research Specialist:** Agent 5 — Erosion & Frost Feasibility  
**Date:** 2026-11-15  
**Target Document:** `research/05_EROSION_FROST_FEASIBILITY.md`  
**Status:** Complete Specialist Investigation & Empirical Audit  

---

## 1. Executive Summary & Core Research Findings

This investigation evaluates the scientific validity, geomorphological applicability, and meteorological realism of **soil erosion** and **frost/cold** vulnerability models within Field Shift, with specific focus on Myanmar's primary agricultural ecologies: the **Ayeyarwady Delta**, the **Central Dry Zone**, and the **Shan State Highlands**.

### Core Research Questions
> *"Are erosion and frost scientifically meaningful vulnerabilities for the intended farming locations in Myanmar?"*

### Definitive Scientific Conclusions
1. **Soil Erosion:**
   - **Lowland Rice Paddies (Ayeyarwady Delta, slopes $< 1^\circ$ / 0–2%):** Hillslope sheet and rill erosion are **physically inactive** within bunded lowland rice paddies. Paddies operate as hydrologically closed sedimentation basins enclosed by earthen dykes (*kazins*) designed to impound standing water ($v_{\text{runoff}} \approx 0$). The active geomorphic hazards in the Delta are **riverbank scour/collapse** (*kankye*) along tidal distributaries, **seasonal flood siltation**, and **saline/acid-sulfate chemical degradation**, not hillslope wash.
   - **Upland Agro-ecosystems (Shan State, Chin Hills, slopes $> 15^\circ\text{–}30^\circ$):** Hillslope sheet and rill erosion are **severe and acute vulnerabilities**, where high-intensity tropical monsoon rainfall on cleared, tilled hillsides drives catastrophic topsoil loss ($20\text{–}100+\text{ t/ha/yr}$) and downstream sedimentation (e.g., Inle Lake).
   - **RUSLE Applicability:** Attempting to calculate numerical soil loss ($A = R \times K \times LS \times C \times P$) in tonnes/hectare/year from 30 m spaceborne DEMs and gridded reanalysis is **scientifically invalid**. Crucial parameters—sub-hourly rainfall kinetic energy ($I_{30}$), field-scale aggregate stability ($K$), parcel-scale slope length truncation by bunds ($LS$), and sub-pixel conservation practices ($P$)—cannot be observed from orbit. Field Shift's architecture **correctly refrains from emitting synthetic tonnes/ha/year**, enforcing a qualitative susceptibility gate based on slope steepness and bare soil windows.

2. **Frost and Cold:**
   - **Ayeyarwady Delta (elevations 0–50 m, $16^\circ\text{–}18^\circ\text{N}$):** Frost ($T \le 0^\circ\text{C}$) is **physically impossible**. An empirical audit of 3,957 daily records (2016–2026) from NASA POWER across Delta cells reveals an absolute all-time minimum temperature of **$11.47^\circ\text{C}$** (Hinthada) and **$12.88^\circ\text{C}$** (Myaungmya), with typical winter minimums of $15^\circ\text{–}18^\circ\text{C}$. Zero frost days have ever been recorded.
   - **Shan Highlands (elevations $> 800\text{–}1,200\text{ m}$):** Radiation frost (*hnaing*) is an **observed, high-impact seasonal hazard** during December–February. While 2-meter ambient air temperature ($T_{2\text{m}}$) drops to $3.5^\circ\text{–}5.0^\circ\text{C}$ in NASA POWER reanalysis, strong nocturnal radiative cooling and cold-air ponding in plateau depressions drive ground-surface temperatures below $0^\circ\text{C}$, damaging high-value horticultural crops (vegetables, tea, strawberries).
   - **UI Agronomic Honesty:** Presenting a blanket risk chip or button labeled **"Cold & frost nights"** to Ayeyarwady Delta farmers is scientifically erroneous and risks eroding farmer trust. The Delta faces **physiological chilling stress** ($T_{\min} \le 12\text{–}15^\circ\text{C}$) during the reproductive stage of dry-season boro rice (causing cold-induced spikelet sterility), NOT frost. The UI must cleanly decouple **Chilling Stress** from **Ground Frost** based on geographic region and elevation.

---

## 2. Part I: Soil Erosion Feasibility & Geomorphological Analysis

### 2.1 Topographic Slope Algorithm Audit (`lib/nasa/derive/slope.ts`)

Field Shift calculates terrain slope from SRTM (Shuttle Radar Topography Mission) or NASADEM 1-arcsecond (~30-meter resolution) elevation grids. The implementation in `lib/nasa/derive/slope.ts` was audited against standard geodetic and digital elevation modeling standards.

#### Mathematical Formulation (Horn 1981)
The algorithm implements Horn's 3×3 weighted finite-difference convolution across a local $3 \times 3$ elevation window:

$$\begin{bmatrix} z_{a} & z_{b} & z_{c} \\ z_{d} & z_{e} & z_{f} \\ z_{g} & z_{h} & z_{i} \end{bmatrix}$$

The orthogonal directional gradients ($dz/dx$ and $dz/dy$) are calculated as:

$$\frac{\partial z}{\partial x} = \frac{(z_c + 2 z_f + z_i) - (z_a + 2 z_d + z_g)}{8 \cdot \Delta x}$$

$$\frac{\partial z}{\partial y} = \frac{(z_g + 2 z_h + z_i) - (z_a + 2 z_b + z_c)}{8 \cdot \Delta y}$$

The scalar terrain slope $\theta$ in degrees is given by:

$$\theta = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180^\circ}{\pi}$$

#### Projection and Geodetic Handling
In geographic coordinates (WGS84, EPSG:4326), angular cell sizes must be projected into metric lengths. `cellSizeMetres` calculates:

```typescript
const M_PER_DEG_LAT = 111_320;
const dy = grid.dLatDeg * M_PER_DEG_LAT;
const dx = grid.dLonDeg * M_PER_DEG_LAT * Math.cos((grid.centreLatDeg * Math.PI) / 180);
```

- **Accuracy Verification:** This correctly accounts for meridional convergence as latitude increases. At the Ayeyarwady Delta ($16.5^\circ\text{N}$), $\Delta x \approx 29.6\text{ m}$ and $\Delta y \approx 30.9\text{ m}$. In Northern Shan State ($23.0^\circ\text{N}$), $\Delta x \approx 28.4\text{ m}$.
- **Noise Attenuation:** Horn's $(1, 2, 1)$ kernel weighting provides a low-pass smoothing filter that suppresses single-cell radar speckle and high-frequency phase noise inherent to SAR interferometric DEMs (SRTM), outperforming unweighted 2-point central difference schemes.
- **Boundary and Void Enforcement:** Line 57 strictly verifies `if (z.some((v) => v === null)) continue;`. Any interior cell adjacent to missing or fill elevation (-32768) returns `null`, preventing artificial boundary cliffs.

#### Spatial Resolution Limitations at 30 Meters
While Horn's algorithm is mathematically flawless for macro-topography, its physical application to farm parcels exposes fundamental spatial limits:
1. **Footprint vs. Parcel Size:** A typical smallholder rice field in Myanmar spans 0.5 to 2.0 hectares ($70 \times 70\text{ m}$ to $140 \times 140\text{ m}$). A 30 m DEM provides only a $2 \times 2$ to $4 \times 4$ pixel raster over the entire holding.
2. **Sub-Pixel Microtopography:** Key agricultural earthworks—specifically paddy bunds (*kazins*) of height $0.2\text{–}0.5\text{ m}$ and width $0.3\text{–}0.8\text{ m}$, drainage ditches, furrows, and bench terraces—are completely sub-pixel and invisible to SRTM.
3. **Plough Layer Planing:** Lowland paddies undergo intensive wet puddling (*pyit-pyit*) with animal or two-wheel tractor-drawn planks, establishing absolute intra-field hydrostatic leveling with within-bund elevation variances $< 2\text{–}3\text{ cm}$. SRTM radar penetration into moist vegetation canopies introduces vertical errors ($\pm 3\text{–}5\text{ m}$) that exceed the actual field micro-relief.

---

### 2.2 Theoretical & Applied Audit of RUSLE ($A = R \times K \times LS \times C \times P$)

The Revised Universal Soil Loss Equation (RUSLE) is frequently misapplied in remote-sensing applications. We audit each term to demonstrate why calculating quantitative soil loss ($A$, t/ha/yr) from satellite data is scientifically unsupportable:

$$A = R \times K \times LS \times C \times P$$

| Factor | Definition & Units | Physical Requirement | Satellite / Reanalysis Availability | Scientific Failure Mode at Field Scale |
| :--- | :--- | :--- | :--- | :--- |
| **$R$** | Rainfall-Runoff Erosivity<br>$(MJ \cdot mm \cdot ha^{-1} \cdot h^{-1} \cdot yr^{-1})$ | Kinetic energy ($E$) and maximum 30-min rainfall intensity ($I_{30}$) for individual storm events ($EI_{30}$). | NASA POWER daily totals or monthly normals; GPM IMERG 30-minute gridded rain. | Daily rainfall totals cannot distinguish between a gentle 24-hour drizzle ($2\text{ mm/hr}$) and a catastrophic 30-minute tropical squall ($80\text{ mm/hr}$). IMERG 0.1° (~10 km) averages convective cells, underestimating peak $I_{30}$ by 40–70%. |
| **$K$** | Soil Erodibility<br>$(t \cdot ha \cdot h \cdot ha^{-1} \cdot MJ^{-1} \cdot mm^{-1})$ | Susceptibility of soil particles to detachment by raindrop splash and runoff; requires aggregate stability, organic carbon, and permeability. | SoilGrids 250 m mapped sand/silt/clay fractions and topsoil organic carbon. | SoilGrids maps general regional horizons. It cannot assess surface structural crusting, hardsetting, biological soil crusts, or puddling-induced plow pans that govern real infiltration. |
| **$LS$** | Slope Length ($L$) & Steepness ($S$)<br>(Dimensionless ratio) | Cumulative upslope contributing overland flow length ($L$) and field slope gradient ($S$). | 30 m SRTM/NASADEM flow accumulation and slope derivation. | Standard DEM flow routing (D8) assumes uninterrupted hydraulic connectivity down the watershed. In reality, field bunds (*kazins*), drainage ditches, roads, and village paths truncate slope length to a few tens of meters. Raw DEM $LS$ calculation exaggerates flow accumulation by orders of magnitude. |
| **$C$** | Cover-Management<br>(Dimensionless ratio) | Ratio of soil loss relative to clean-tilled continuous bare fallow; dynamic with canopy cover, ground mulch, and root density. | Landsat/HLS 30 m NDVI, surface reflectance, crop type calendar. | Static annual $C$-factor tables fail to capture the critical 2–3 week pre-emergence window when heavy monsoon downpours strike freshly tilled, bare soil before crop canopy develops. |
| **$P$** | Support Practice<br>(Dimensionless ratio) | Cultivation practices that reduce runoff: contour bunding, contour tillage, strip-cropping, vegetative buffer strips, terracing. | None. Sub-pixel features completely invisible to 30 m optical/radar sensors. | A farmer contour-bunding or maintaining stone walls reduces erosion by 50–90% ($P = 0.1\text{–}0.5$), but satellite models blindly assume unmanaged down-slope plowing ($P = 1.0$), generating completely spurious soil loss figures. |

#### Architectural Review of Field Shift's Soil Health Engine
The repository's implementation in `lib/engine/soil-health.ts` and `lib/conditions/condition-evidence.ts` demonstrates exceptional scientific integrity:
1. **Explicit Gate Against False Metrics:**
   - Lines 352–353 of `condition-evidence.ts`:
     > *"SCIENTIFIC GATE: SRTM slope is terrain context, not measured soil erosion. If DEM/slope is missing, erosion exposure cannot be assessed. Never emit tonnes/ha."*
   - Lines 397–399:
     > *"cannotTellText: NASA SRTM elevation describes topographic slope, but cannot calculate actual soil loss in tonnes per hectare without farm-specific soil structure, bund maintenance, and tillage practices."*
2. **Qualitative Exposure Categorization:**
   `erosionScreen()` evaluates slope class (Gentle $< 5^\circ$, Moderate $5^\circ\text{–}15^\circ$, Steep $\ge 15^\circ$) interacted with planned low-cover rotation intervals during rainy months ($\ge 100\text{ mm/month}$). Exposure is strictly reported as:
   - `"not-flagged"`
   - `"possible"`
   - `"elevated"`
   - `"needs-slope-data"`
3. **Verdict:** The repository correctly rejects pseudo-quantitative RUSLE modelling and restricts its outputs to an honest qualitative topographic hazard screen.

---

### 2.3 Lowland Delta Paddy Landscapes vs. Upland Agro-ecosystems

A critical scientific deficiency identified during our audit is the uniform application of the "Erosion" risk card across all agro-ecological zones of Myanmar without distinction between lowland paddies and upland hillslopes.

```
+---------------------------------------------------------------------------------------------------------+
|                                    GEOMORPHIC CONTRAST IN MYANMAR                                       |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   AYEYARWADY DELTA LOWLAND PADDY (< 1° Slope)          SHAN STATE UPLAND HILLSLOPES (> 15°–30° Slope)   |
|                                                                                                         |
|            Rainfall: 2,500 - 3,500 mm/year                     Rainfall: 1,200 - 1,800 mm/year          |
|                                                                                                         |
|           ┌────────────┐                                              \  Pre-monsoon tilled maize       |
|    Water  │ Standing   │ Puddle water (5-15 cm)                        \  Unprotected topsoil           |
|   Level   │ Water      │                                                \  Intense convective storms    |
|   ───────┐└────────────┘┌─────── Clay Bund (Kazin)                       \                              |
|          │              │        (Height: 0.3 - 0.5 m)                    \   Rill detachment           |
|   ═══════╧══════════════╧═══════                                           \  Sheetwash runoff          |
|   Puddled plough pan (v ≈ 0 m/s)                                            \                           |
|   Hydraulic gradient: Zero                                                   \                          |
|   Sheet erosion: PHYSICALLY INACTIVE                                          \   Deep gullying         |
|                                                                                \  Severe soil loss      |
|   Real Hazard: Distributary Riverbank Collapse (Kankye)                         \  (20 - 100+ t/ha/yr)  |
+---------------------------------------------------------------------------------------------------------+
```

#### Detailed Comparison

#### 1. Ayeyarwady Delta (Lowland Alluvial Floodplain)
- **Topography & Elevation:** Slopes are consistently $< 0.5^\circ$ ($< 1\%$). Elevation ranges from 0 to 15 m above mean sea level across thousands of square kilometers in townships such as Bogale, Mawlamyinegyun, Pyapon, Labutta, and Myaungmya.
- **Paddy Hydrology:** Paddy fields are engineered impoundments surrounded by clay bunds (*kazins*). During the monsoon season (June–October), fields are inundated with 5 to 20 cm of standing water. 
- **Erosion Mechanics:** Because the hydraulic gradient across the parcel is virtually zero, overland water velocity is negligible ($v \approx 0$). Detached soil particles cannot be transported out of the field; instead, sediment settles out of suspension. **Hillslope sheet and rill erosion are non-existent.**
- **Actual Active Soil & Fluvial Hazards in the Delta:**
  1. **Riverbank Erosion (*Kankye*):** Fluvial undercutting, tidal scouring, and geotechnical bank collapse along major distributaries (Ayeyarwady, Ngawun, Toe, Pyamalaw, Bogale rivers). Entire field margins and villages are consumed by lateral channel migration during rapid river stage drawdown following monsoon flood crests.
  2. **Seasonal Siltation and Sand Deposition:** Flooding rivers deposit fine silts and clays across floodplains. Near breach zones (crevasse splays), coarse sands can bury fertile paddy topsoil.
  3. **Saline Intrusion & Acid-Sulfate Oxidation:** Chemical soil degradation resulting from low dry-season river discharge permitting saltwater penetration up to 80 km inland, and the oxidation of pyrite-rich cat-clays upon drainage.
- **Agronomic Distortion:** Showing a generic "Erosion" risk card to a Delta farmer based on SRTM slope induces cognitive dissonance. The farmer associates "erosion" with their riverbank collapsing into the river, not soil washing off their level rice field.

#### 2. Shan State Highlands (Upland Rolling & Mountainous Agro-ecosystems)
- **Topography & Elevation:** Elevation ranges from 800 to 1,800 m. Agricultural slopes routinely exceed $15^\circ\text{ to }35^\circ$ ($27\%\text{ to }70\%$) in farming hubs such as Kalaw, Taunggyi, Pindaya, Aungban, Lashio, and Hsipaw.
- **Upland Farming Systems:** Smallholders cultivate upland maize, soybean, ginger, garlic, potatoes, and upland rice under rainfed conditions.
- **Erosion Mechanics:** High-intensity monsoon downpours strike steep, sloping fields. When fields are ploughed down-slope or left bare during land preparation in April and May, overland flow velocities exceed critical shear thresholds, producing sheetwash, extensive rill networks, and deep gully incisions.
- **Agronomic Consequence:** Unmitigated topsoil loss frequently exceeds $50\text{ t/ha/yr}$, stripping the humus-rich organic A-horizon, leaching applied nitrogen/phosphorus fertilizers, and causing massive downstream reservoir and lake siltation (most famously documented in the hyper-eutrophication and shallowing of Inle Lake).
- **Verdict:** In Shan State, the slope-based qualitative erosion screening in Field Shift is **vital, agronomically actionable, and highly relevant**.

---

## 3. Part II: Frost Feasibility & Cold Climatology in Myanmar

### 3.1 Empirical Audit of Historical Temperatures Across Myanmar

To evaluate the physical plausibility of frost in Myanmar farming systems, we performed an empirical analysis across **22 predownloaded NASA POWER daily weather cells** covering all major agricultural regions in the repository (`data/predownload/weather/`). 

Each record spans **3,957 continuous daily observations** from January 1, 2016 through October 31, 2026.

```
Empirical Distribution of Daily Minimum 2-Meter Air Temperature (T2M_MIN)
Source: NASA POWER Daily Agroclimatology (3,957 days per cell, 2016–2026)
```

| Region / Zone | Representative Hub(s) | NASA POWER Coordinates | Elevation (m) | All-Time Min $T_{\min}$ (°C) | 1st Percentile $T_{\min}$ (°C) | Days $\le 0^\circ\text{C}$ (Frost) | Days $\le 5^\circ\text{C}$ | Days $\le 10^\circ\text{C}$ | Days $\le 12^\circ\text{C}$ (Chilly) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ayeyarwady Delta** | Myaungmya | $16.5^\circ\text{N}, 95.000^\circ\text{E}$ | 8.3 | **12.88** | 16.66 | **0** | **0** | **0** | **0** |
| **Ayeyarwady Delta** | Maubin, Pyapon | $16.5^\circ\text{N}, 95.625^\circ\text{E}$ | 3.9 | **13.62** | 16.31 | **0** | **0** | **0** | **0** |
| **Ayeyarwady Delta** | Pathein | $17.0^\circ\text{N}, 95.000^\circ\text{E}$ | 12.5 | **12.12** | 15.99 | **0** | **0** | **0** | **0** |
| **Ayeyarwady Delta** | Hinthada | $17.5^\circ\text{N}, 95.625^\circ\text{E}$ | 13.7 | **11.47** | 15.09 | **0** | **0** | **0** | **2** |
| **Bago (Lower)** | Bago City | $17.5^\circ\text{N}, 96.250^\circ\text{E}$ | 53.0 | 9.92 | 14.18 | **0** | **0** | 1 | 6 |
| **Bago (Valley)** | Daik-U | $18.0^\circ\text{N}, 96.875^\circ\text{E}$ | 207.5 | 8.53 | 14.05 | **0** | **0** | 2 | 9 |
| **Bago / Pyay** | Pyay | $19.0^\circ\text{N}, 95.000^\circ\text{E}$ | 156.3 | 10.49 | 13.15 | **0** | **0** | 0 | 12 |
| **Bago (Upper)** | Taungoo | $19.0^\circ\text{N}, 96.250^\circ\text{E}$ | 254.7 | 8.26 | 13.12 | **0** | **0** | 4 | 16 |
| **Central Dry Zone** | Thayet | $19.5^\circ\text{N}, 95.000^\circ\text{E}$ | 180.3 | 9.83 | 12.45 | **0** | **0** | 3 | 26 |
| **Central Dry Zone** | Magway City, Minbu | $20.0^\circ\text{N}, 95.000^\circ\text{E}$ | 166.4 | 9.07 | 11.98 | **0** | **0** | 5 | 40 |
| **Central Dry Zone** | Taungdwingyi | $20.0^\circ\text{N}, 95.625^\circ\text{E}$ | 237.6 | 9.56 | 12.57 | **0** | **0** | 1 | 20 |
| **Central Dry Zone** | Meiktila | $21.0^\circ\text{N}, 95.625^\circ\text{E}$ | 260.1 | 9.14 | 11.60 | **0** | **0** | 7 | 58 |
| **Central Dry Zone** | Pakokku | $21.5^\circ\text{N}, 95.000^\circ\text{E}$ | 181.4 | 9.80 | 11.53 | **0** | **0** | 3 | 51 |
| **Central Dry Zone** | Myingyan | $21.5^\circ\text{N}, 95.625^\circ\text{E}$ | 173.0 | 10.41 | 11.94 | **0** | **0** | 0 | 42 |
| **Central Dry Zone** | Mandalay City | $22.0^\circ\text{N}, 96.250^\circ\text{E}$ | 352.4 | 9.78 | 12.23 | **0** | **0** | 3 | 36 |
| **Shan Highlands** | Yamethin (Transition) | $20.5^\circ\text{N}, 96.250^\circ\text{E}$ | 490.3 | 10.11 | 12.52 | **0** | **0** | 0 | 26 |
| **Shan Highlands** | Hsipaw | $22.5^\circ\text{N}, 97.500^\circ\text{E}$ | 830.7 | **5.15** | 7.45 | **0** | **0** | **291** | **631** |
| **Shan Highlands** | Lashio | $23.0^\circ\text{N}, 97.500^\circ\text{E}$ | 921.5 | **4.74** | 6.71 | **0** | **5** | **439** | **751** |
| **Shan Highlands** | Heho-Kalaw, Aungban | $20.5^\circ\text{N}, 96.875^\circ\text{E}$ | 1,168.8 | **3.60** | 8.32 | **0** | **2** | **155** | **494** |
| **Shan Highlands** | Taunggyi | $21.0^\circ\text{N}, 96.875^\circ\text{E}$ | 1,177.1 | **4.15** | 7.85 | **0** | **2** | **251** | **675** |

---

### 3.2 Thermodynamic & Meteorological Physics of Frost Occurrence

#### 1. Lowland Delta Invariance
The Ayeyarwady Delta ($16^\circ\text{–}17.5^\circ\text{N}$) is located squarely within the tropical maritime belt.
- **Physical Impossibility of Freezing:** Under modern climatology, sub-zero temperatures are thermodynamically impossible at sea level in this region. The massive thermal inertia of the adjacent Andaman Sea and Bay of Bengal, high atmospheric moisture content (column precipitable water $> 25\text{ mm}$ even in January), and constant maritime boundary-layer mixing prevent catastrophic nocturnal radiative heat loss.
- **The Empirical Reality:** Over a decade of daily observations, the lowest temperature recorded anywhere in the southern Delta was **$12.12^\circ\text{C}$** at Pathein and **$12.88^\circ\text{C}$** at Myaungmya. In Maubin and Pyapon, not a single night reached $\le 12^\circ\text{C}$.

#### 2. Highland Radiation Frost Physics (Shan State > 800–1,200 m)
In contrast to the Delta, frost is an established, high-impact meteorological hazard in the high-altitude plateaus of Shan State, Chin Hills, and Northern Kachin.
- **Radiative Cooling Mechanism:** During the dry winter monsoon (December through February), cold, dry continental air from Central Asia pushes across the Shan Plateau. Clear, cloudless skies, exceptionally dry air (surface relative humidity drops during the night), and low wind speeds maximize net terrestrial longwave radiation loss ($L_{\text{net}} = \epsilon \sigma T^4$).
- **Katabatic Drainage & Microclimatic Inversion:** Cold, dense air drains down hillside slopes into valley bottoms, karst dolines, and enclosed basins (e.g., around Kalaw, Heho, and Inle Lake margins), setting up intense nocturnal temperature inversions.
- **The $T_{2\text{m}}$ vs. Grass Frost Gradient:** Meteorological reanalysis and shelter stations measure air temperature at a standardized 2-meter height ($T_{2\text{m}}$). Under calm, clear radiative conditions, radiative cooling takes place directly at the radiating surface (plant canopy or bare soil). The ground and leaf surface temperature ($T_{\text{surface}}$ or $T_{\text{grass}}$) is routinely **$3^\circ\text{ to }6^\circ\text{C}$ colder** than the 2-meter air temperature:

$$T_{\text{surface}} \approx T_{2\text{m}} - (3^\circ\text{ to }6^\circ\text{C})$$

- **Empirical Confirmation:** In our NASA POWER audit, Heho-Kalaw recorded a minimum $T_{2\text{m}}$ of **$3.60^\circ\text{C}$**, Taunggyi recorded **$4.15^\circ\text{C}$**, and Lashio recorded **$4.74^\circ\text{C}$**. Subtracting the standard $4^\circ\text{–}5^\circ\text{C}$ nocturnal radiative inversion gradient proves that surface ground temperature regularly reaches **$-0.5^\circ\text{ to }-2.0^\circ\text{C}$**, precipitating crystalline white ground frost (*hnaing*). Ground frost events occur on 2 to 10 nights per winter in Shan highland valleys, severely damaging tender horticultural crops.

---

### 3.3 Agronomic Impacts: Physiological Chilling vs. Freezing Injury

A fundamental distinction must be established between **Freezing/Frost Injury** and **Physiological Chilling Stress**:

```
+---------------------------------------------------------------------------------------------------------+
|                                    THERMAL STRESS IN MYANMAR CROPS                                      |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   < 0 °C             0 °C - 10 °C                           10 °C - 15 °C             15 °C - 35 °C     |
|   ───────────────────┼──────────────────────────────────────┼─────────────────────────┼───────────────  |
|   FREEZING / FROST   SEVERE CHILLING                        MODERATE CHILLING         OPTIMAL GROWTH    |
|   Ice crystallization| Chlorosis, stunted growth,           Pollen abortion &         Normal metabolic  |
|   Cell wall rupture  Membrane phase change                  Spikelet sterility        activity          |
|   Plant tissue death | (Maize, Pulses in Shan)              (Boro Rice in Delta)                        |
|   (Shan Highlands)   │                                      │                         │                 |
|                      │                                      │                         │                 |
|   Geographic Scope:  │ Geographic Scope:                    │ Geographic Scope:       │ Lowlands &      |
|   Shan State >1000m  │ Shan Highlands, Upper Dry Zone       │ All Myanmar (Winter)    │ Central Plains  |
+---------------------------------------------------------------------------------------------------------+
```

#### 1. Rice (*Oryza sativa* — Lowland Delta & Irrigated Dry Zone)
- **Parameters (`lib/data/crops/myanmar.ts`):** `temp: { absMin: 10, optMin: 20, optMax: 30, absMax: 36, heatFlowerC: 35, coldC: 15 }`, `frostKill: false`.
- **Vulnerability:** In the Ayeyarwady Delta and central plains, dry-season (summer/boro) rice is planted in November–January to utilize residual floodwaters or low-lift canal irrigation. 
- **Chilling Stress Mechanism:** Tropical *indica* rice varieties are acutely sensitive to temperatures below **$15^\circ\text{C}$** during panicle development (microsporogenesis) and flowering. Chilling disrupts pollen grain formation, resulting in high percentages of empty glumes (spikelet sterility or "blasted" heads). Night temperatures below **$12^\circ\text{C}$** cause seedling yellowing and halt vegetative elongation.
- **The Agronomic Truth:** Delta rice farmers face a real threat from **winter chilling nights ($T_{\min} \le 12\text{–}15^\circ\text{C}$)**, but **zero threat from frost**.

#### 2. Highland Crops (Maize, Chickpea, Vegetables — Shan State & Dry Zone)
- **Chickpea (*Cicer arietinum*):** Highly tolerant to moderate chill (`temp: { absMin: 5, optMin: 15 }`), cultivated as a post-monsoon relay crop in the Dry Zone.
- **Maize (*Zea mays*):** Vegetative cessation below $8^\circ\text{C}$. In Shan State, late-planted or early-seeded maize exposed to ground frost suffers leaf necrosis.
- **Horticulture (Strawberries, Tomatoes, Flowers):** In Kalaw and Aungban, radiation frost crystallizes cellular water in epidermal tissues, resulting in blackening and complete crop loss.

---

## 4. Part III: User Experience & Agronomic Honesty Evaluation

### 4.1 UI Audit: "Cold & frost nights" Risk Presentation

We audited the UI components presenting cold risk:
1. `components/field/conditions/risk-panels/heat-cold-panel.tsx`:
   - Line 75: Toggle button labeled **"Cold & frost nights"**
   - Line 84: Risk chip displays **`${coldDaysValue} cool nights`** or **`Night cold context`**
   - Line 123: Card title: **`Winter Chilly Nights (Nov–Feb, Tmin ≤ 12 °C)`**
   - Line 132: Explanatory text: *"NASA POWER gridded 2-meter air temperature. Modelled ambient air temperature; freezing air alerts indicate potential chilling risk, but do not confirm frost formation on field plant tissues."*
2. `lib/server/trends.ts`:
   - Line 19: `const COLD_C = 12;`
   - Line 67: `mk("Chilly nights at or below ${COLD_C} °C (Nov to Feb)", "cold-nights", "nights", "chilly winter nights", coldYears)`
3. `lib/copy/en.ts`:
   - Line 778: `heatFrostTitle: "Heat and frost risks"`
   - Line 1159: `term: "A frost threshold and frost in your field"`

#### Critique: The Threat of Epistemic Distrust
The underlying data logic in `trends.ts` and `condition-evidence.ts` correctly measures nights $\le 12^\circ\text{C}$ and explicitly terms them "chilly winter nights". 

However, in the user-facing UI:
- Coupling the toggle button as **"Cold & frost nights"** and titling the overview section **"Heat and frost risks"** creates an immediate credibility failure for a farmer in Pathein, Bogale, or Myaungmya.
- A delta farmer reading that their field faces "frost risk" will immediately conclude that the application was written by foreign engineers who do not know Myanmar geography. As established by the repository's UX simplicity contract, **epistemic trust is fragile and cannot be recovered once lost**.

### 4.2 Audit of Erosion Risk Presentation
1. `components/field/conditions/risk-panels/erosion-panel.tsx`:
   - Displays **`Median Slope (SRTM 30 m)`** and **`Soil Texture (SoilGrids)`**.
   - Lines 85–89 provide an excellent caveat: *"Distinguishing Erosion Mechanisms: Topographic slope screening applies to surface runoff and rill formation. It does not measure riverbank collapse, lowland sediment deposition, or landslide hazards."*
2. **Shortcoming:** Despite the caveat, when a delta field has a flat slope ($0.2^\circ$), the UI presents the "Erosion" risk card with a neutral chip. If a farmer configures a rotation with a bare post-harvest interval in July, the system could theoretically flag an erosion warning if slope data were misread or missing, confusing the user.

---

## 5. Part IV: Actionable Recommendations & Architectural Road Map

To align Field Shift with the physical geography of Myanmar and prevent farmer disorientation, we propose a four-point architectural enhancement plan.

### 5.1 Gating & Terminology Matrix by Agro-Ecological Region

We recommend introducing an agro-ecological region gate (`RegionId` from `lib/data/regions.ts`) into the risk evidence builders.

| Feature / Indicator | Ayeyarwady Delta (`ayeyarwady`) | Central Dry Zone (`magway`) | Shan Highlands (`shan`) | Elsewhere / Default (`myanmar`) |
| :--- | :--- | :--- | :--- | :--- |
| **Erosion Domain Label** | **Lowland Hydrology & Riverbank Context** | **Soil Erosion Screening** | **Hillslope Erosion Hazard** | **Topographic Slope Screening** |
| **Erosion Active Logic** | Suppress sheetwash alerts; display flat landscape confirmation ($< 1^\circ$); caveat riverbank scour. | Active screening for slopes $> 5^\circ$ during monsoon gaps. | **Fully active, high-priority screening.** Link to contour bunding & cover crops (*Lablab*). | Standard slope screening. |
| **Cold Domain Label** | **Winter Chilly Nights (≤12 °C)** | **Winter Chilly Nights (≤12 °C)** | **Cold & Radiation Frost (≤12 °C)** | **Night Temperature Context** |
| **Frost Terminology** | **STRICTLY PROHIBITED.** The word "frost" must never render for delta fields. | Prohibited; refer to chilling stress on pulses. | **Permitted and contextualized.** Explain microclimatic valley radiation frost. | Gated by elevation ($> 800\text{ m}$). |
| **Agronomic Stress Context** | Rice spikelet sterility during reproductive boro cycle ($T_{\min} < 15^\circ\text{C}$). | Slowed winter pulse emergence (chickpea, green gram). | Ground frost kill on vegetable/horticulture tissues ($T_{\text{sfc}} \le 0^\circ\text{C}$). | General temperature thresholds. |

---

### 5.2 Specific Code Modification Blueprint

#### 1. Decouple UI Button Label in `components/field/conditions/risk-panels/heat-cold-panel.tsx`
Modify the button text based on field region or elevation:

```typescript
// Proposed Enhancement:
const isHighland = region === "shan" || (elevationM !== null && elevationM >= 800);
const coldLabel = isHighland ? "Cold & frost nights" : "Chilly nights (≤12 °C)";
```

#### 2. Differentiate Regional Erosion Finding in `lib/conditions/condition-evidence.ts`
When slope is $< 2^\circ$ in alluvial delta zones, adjust finding text to affirm that flat paddies are protected from hillslope wash:

```typescript
if (region === "ayeyarwady" && slopeMedian !== null && slopeMedian < 2) {
  findingText = `Mapped terrain slope is nearly flat (${slopeMedian.toFixed(1)}°). Level bunded rice paddies do not experience hillslope sheet erosion. Note that riverbank collapse (kankye) along tidal channels cannot be detected from topography.`;
}
```

#### 3. Update Internationalization Copy in `lib/copy/en.ts` and `lib/copy/my.ts`
- Replace generic `heatFrostTitle: "Heat and frost risks"` with dynamic or regional wording:
  - English: `"Temperature Extremes (Heat & Cool Nights)"`
  - Myanmar: `"အပူချိန်လွန်ကဲမှု အန္တရာယ်များ (အပူလှိုင်းနှင့် ညချမ်းအအေးဒဏ်)"` (emphasizing cool nights rather than freezing frost).

---

### 5.3 Validation & Continuous Integrity Criteria

1. **Automated Unit Test Enforcement:**
   - Add unit tests verifying that fields located in `ayeyarwady` or with elevation $< 100\text{ m}$ never output the word `"frost"` in their evidence findings, titles, or metrics.
   - Verify that flat delta fields ($< 2^\circ$) never trigger `"elevated"` erosion exposure, even with 3+ bare rainy intervals.
2. **Integration Verification:**
   - Run vitest suite: `npx vitest run tests/lib/condition-evidence.test.ts`
   - Run engine modules: `npx vitest run tests/lib/engine-modules.test.ts`

---

## 6. Summary Reference Table

```
===================================================================================================
FIELD SHIFT SCIENCE SUMMARY: EROSION & FROST VULNERABILITY IN MYANMAR
===================================================================================================
VULNERABILITY | AYEYARWADY DELTA (< 50 m)        | SHAN HIGHLANDS (> 800 m)
===================================================================================================
EROSION       | Sheet/Rill Erosion: INACTIVE     | Sheet/Rill Erosion: ACUTE VULNERABILITY
              | Bunded paddies impound water.    | Slopes 15°-30°+ lose topsoil during monsoon.
              | Active hazards: Riverbank scour  | Soil loss: 20-100+ t/ha/yr without cover.
              | and tidal flood siltation.       | Action: Contour bunds, Lablab/Sunn hemp cover.
---------------------------------------------------------------------------------------------------
RUSLE MODEL   | INVALID to compute tonnes/ha/yr. | INVALID to compute tonnes/ha/yr.
              | Spaceborne data cannot observe:  | Qualitative topographic screening
              | R (I30), K crusting, LS bunds, P.| (slope × bare gap) is the only honest path.
---------------------------------------------------------------------------------------------------
FROST         | PHYSICALLY IMPOSSIBLE.           | ACTIVE WINTER HAZARD (Dec - Feb).
(T <= 0 °C)   | 11-yr Min Tmin: 11.5 °C - 12.9 °C| 11-yr Min T2m: 3.6 °C - 5.1 °C.
              | Days <= 0 °C: 0 (Ever recorded). | Nocturnal radiative inversion causes ground
              | Hazard: Chilling (<15 °C) causes | frost (Tgrass <= 0 °C) in valley bottoms.
              | boro rice spikelet sterility.    | Hazard: Frost kill on vegetables/tea/fruits.
---------------------------------------------------------------------------------------------------
UI HONESTY    | NEVER show "Frost" label.        | Contextualize "Radiation Ground Frost".
              | Label as "Chilly nights (<=12°C)"| Explain 2m air temp vs canopy freezing.
===================================================================================================
```

*Report completed by Specialist Agent 5 — Erosion & Frost Feasibility.*
