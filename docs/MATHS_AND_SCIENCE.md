# Mathematical & Scientific Foundations of Crop Rotation Planning

> **Status:** Reference Specification & Algorithmic Blueprint  
> **Audience:** AI Agents, Agronomic Modelers, Remote Sensing Engineers, Software Developers  
> **Repository Implementation:** `lib/engine/*`, `lib/nasa/*`, `lib/soil/*`  
> **Last Verified:** November 2026

---

## Table of Contents
1. [Executive Summary & Modeling Philosophy](#1-executive-summary--modeling-philosophy)
2. [Bioclimatology & Evapotranspiration Models](#2-bioclimatology--evapotranspiration-models)
   - 2.1 [Astronomical & Solar Radiation Physics](#21-astronomical--solar-radiation-physics)
   - 2.2 [FAO-56 Penman-Monteith Reference Evapotranspiration ($ET_0$)](#22-fao-56-penman-monteith-reference-evapotranspiration-et_0)
   - 2.3 [Hargreaves-Samani Empirical Fallback ($ET_0$)](#23-hargreaves-samani-empirical-fallback-et_0)
   - 2.4 [Crop Evapotranspiration ($ET_c$) & Crop Coefficients ($K_c$)](#24-crop-evapotranspiration-et_c--crop-coefficients-k_c)
3. [Soil Hydrology & Soil Water Balance](#3-soil-hydrology--soil-water-balance)
   - 3.1 [Hydraulic Properties & Water Retention](#31-hydraulic-properties--water-retention)
   - 3.2 [FAO-56 Daily Root-Zone Soil Water Balance](#32-fao-56-daily-root-zone-soil-water-balance)
   - 3.3 [Atmospheric Shortfall vs. Root-Zone Depletion](#33-atmospheric-shortfall-vs-root-zone-depletion)
4. [Agro-Thermal & Phenological Dynamics](#4-agro-thermal--phenological-dynamics)
   - 4.1 [Growing Degree Days (GDD) & Thermal Time](#41-growing-degree-days-gdd--thermal-time)
   - 4.2 [Extreme Thermal Exposure & Critical Phenological Windows](#42-extreme-thermal-exposure--critical-phenological-windows)
   - 4.3 [Frost Dynamics & Hemispheric Calendar Shifts](#43-frost-dynamics--hemispheric-calendar-shifts)
   - 4.4 [Precipitation Regimes & Dry Spell Statistics](#44-precipitation-regimes--dry-spell-statistics)
   - 4.5 [Wet Growing Season Identification](#45-wet-growing-season-identification)
5. [Remote Sensing Radiometry & Geomorphometry](#5-remote-sensing-radiometry--geomorphometry)
   - 5.1 [Spectral Vegetation Indices ($NDVI$, $NDMI$)](#51-spectral-vegetation-indices-ndvi-ndmi)
   - 5.2 [Quality Assurance (QA) Bitmask Decoding](#52-quality-assurance-qa-bitmask-decoding)
   - 5.3 [Topographic Slope Derivation (Horn's $3 \times 3$ Finite Difference)](#53-topographic-slope-derivation-horns-3-times-3-finite-difference)
   - 5.4 [Thermal Radiometry: Land Surface Temperature ($LST$) vs. Air Temperature ($T_{air}$)](#54-thermal-radiometry-land-surface-temperature-lst-vs-air-temperature-t_air)
6. [Agronomy, Biogeochemistry & Agro-Ecosystem Dynamics](#6-agronomy-biogeochemistry--agro-ecosystem-dynamics)
   - 6.1 [Biological Nitrogen Fixation (BNF) & Harvest Removal](#61-biological-nitrogen-fixation-bnf--harvest-removal)
   - 6.2 [Shared Hosts and Disease Breaks](#62-shared-hosts-and-disease-breaks)
   - 6.3 [Pedotransfer Transformations & SoilGrids Integration](#63-pedotransfer-transformations--soilgrids-integration)
   - 6.4 [Soil Cover & Erosion Exposure](#64-soil-cover--erosion-exposure)
7. [Interval-Based Gross Margin Estimation](#7-interval-based-gross-margin-estimation)
   - 7.1 [Interval Arithmetic for Gross Margin](#71-interval-arithmetic-for-gross-margin)
   - 7.2 [Cycle Annualization & Area Scaling](#72-cycle-annualization--area-scaling)
8. [Scientific References](#8-scientific-references)

---

## 1. Executive Summary & Modeling Philosophy

The core philosophy of this engine is **rigorous scientific honesty**:
1. **Never substitute a coarse grid for a local measurement**: NASA POWER ($0.5^\circ \times 0.625^\circ \approx 50\text{ km}$), IMERG ($0.1^\circ \approx 10\text{ km}$), and SMAP ($9\text{ km}$) represent regional atmospheric and hydrological conditions, not field-gate microclimates. The engine discloses spatial resolutions explicitly and labels gridded data as *"around your field"*.
2. **Missing data is never imputed as zero or an average**: If decisive evidence (e.g., soil pH, planting date, available water capacity) is missing, the engine yields an explicit `unknown` state. It never silently invents optimistic passes.
3. **Historical scenario replay over probabilistic forecasting**: Future weather is uncertain; rather than generating synthetic forecasts with uncalibrated probabilities, the engine replays the candidate rotation against $N$ years of historical daily meteorological observations (typically 1981–2024).
4. **Separation of observation, model proxy, and farmer report**: Measurements from laboratory soil tests always take precedence over gridded maps (e.g., SoilGrids), and remote sensing greenness ($NDVI$) is never conflated with crop yield, crop identity, or soil organic carbon.

---

## 2. Bioclimatology & Evapotranspiration Models

### 2.1 Astronomical & Solar Radiation Physics
Solar radiation drives the surface energy balance. When incoming solar radiation is not measured directly, extraterrestrial radiation ($R_a$) is derived analytically from celestial mechanics (FAO-56, Eq. 21–25).

The day of the year $J \in [1, 366]$ is calculated from the UTC calendar date:
$$J = \text{dayOfYear}(date)$$

The solar declination $\delta$ (radians):
$$\delta = 0.409 \sin\left(\frac{2\pi}{365} J - 1.39\right)$$

The inverse relative Earth-Sun distance $d_r$:
$$d_r = 1 + 0.033 \cos\left(\frac{2\pi}{365} J\right)$$

The sunset hour angle $\omega_s$ (radians) for latitude $\phi$ (radians):
$$\omega_s = \arccos\Big(\min\big(1, \max\big(-1, -\tan(\phi)\tan(\delta)\big)\big)\Big)$$

*Polar handling:* Clamping between $-1$ and $+1$ handles polar night ($\omega_s = 0$) and polar day ($\omega_s = \pi$) without NaN.

Extraterrestrial radiation $R_a$ in $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$:
$$R_a = \frac{24 \times 60}{\pi} G_{sc} \, d_r \left( \omega_s \sin(\phi)\sin(\delta) + \cos(\phi)\cos(\delta)\sin(\omega_s) \right)$$

where $G_{sc} = 0.0820 \, \text{MJ}\cdot\text{m}^{-2}\cdot\text{min}^{-1}$ (solar constant), $\phi = \frac{\pi}{180} \times \text{latDeg}$.

**Code Reference:** `lib/engine/et0.ts` (`dayOfYear`, `extraterrestrialRadiation`)

---

### 2.2 FAO-56 Penman-Monteith Reference Evapotranspiration ($ET_0$)
The FAO-56 Penman-Monteith equation computes the evapotranspiration rate of a hypothetical grass reference crop ($0.12\text{ m}$ height, surface resistance $70\text{ s}\cdot\text{m}^{-1}$, albedo $0.23$).

$$ET_0 = \frac{0.408 \Delta (R_n - G) + \gamma \frac{900}{T_{\text{mean}} + 273} u_2 (e_s - e_a)}{\Delta + \gamma (1 + 0.34 u_2)}$$

| Variable | Definition | Unit | Calculation / Source |
|---|---|---|---|
| $T_{\text{mean}}$ | Daily mean air temperature at $2\text{ m}$ | ${^\circ}\text{C}$ | $\frac{T_{\max} + T_{\min}}{2}$ |
| $P$ | Atmospheric surface pressure | $\text{kPa}$ | $101.3 \left(\frac{293 - 0.0065 z}{293}\right)^{5.26}$ ($z$ = elevation) or POWER `PS` |
| $\gamma$ | Psychrometric constant | $\text{kPa}\cdot{^\circ}\text{C}^{-1}$ | $\gamma = 0.000665 \times P$ |
| $e_s(T)$ | Saturation vapor pressure at temp $T$ | $\text{kPa}$ | $e^\circ(T) = 0.6108 \exp\left(\frac{17.27 T}{T + 237.3}\right)$ |
| $e_s$ | Mean saturation vapor pressure | $\text{kPa}$ | $e_s = \frac{e^\circ(T_{\max}) + e^\circ(T_{\min})}{2}$ |
| $e_a$ | Actual vapor pressure | $\text{kPa}$ | Disclosed approximation: $e_a \approx e_s \frac{RH_{\text{mean}}}{100}$ |
| $\Delta$ | Slope of vapor pressure curve | $\text{kPa}\cdot{^\circ}\text{C}^{-1}$ | $\Delta = \frac{4098 \cdot e^\circ(T_{\text{mean}})}{(T_{\text{mean}} + 237.3)^2}$ |
| $u_2$ | Wind speed at $2\text{ m}$ height | $\text{m}\cdot\text{s}^{-1}$ | NASA POWER `WS2M` |
| $R_s$ | Incoming all-sky solar radiation | $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$ | NASA POWER `ALLSKY_SFC_SW_DWN` |
| $R_{so}$ | Clear-sky solar radiation | $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$ | $R_{so} = (0.75 + 2 \times 10^{-5} z) R_a$ |
| $R_{ns}$ | Net shortwave radiation | $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$ | $R_{ns} = (1 - 0.23) R_s = 0.77 R_s$ |
| $R_{nl}$ | Net longwave radiation | $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$ | Stefan-Boltzmann longwave balance |
| $R_n$ | Net radiation at the crop surface | $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$ | $R_n = R_{ns} - R_{nl}$ |
| $G$ | Soil heat flux density | $\text{MJ}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$ | For daily time steps, $G \approx 0$ |

Net Longwave Radiation ($R_{nl}$):
$$R_{nl} = \sigma \left[ \frac{(T_{\max} + 273.16)^4 + (T_{\min} + 273.16)^4}{2} \right] \left( 0.34 - 0.14 \sqrt{\max(e_a, 0)} \right) \left( 1.35 \frac{R_s}{R_{so}} - 0.35 \right)$$
where $\sigma = 4.903 \times 10^{-9} \, \text{MJ}\cdot\text{K}^{-4}\cdot\text{m}^{-2}\cdot\text{day}^{-1}$. Ratio $\frac{R_s}{R_{so}} \in [0.3, 1.0]$.

**Code Reference:** `lib/engine/et0.ts` (`penmanMonteithEt0`)

---

### 2.3 Hargreaves-Samani Empirical Fallback ($ET_0$)
When radiation, humidity, or wind are missing, the engine falls back to Hargreaves-Samani (1985):

$$ET_{0,\text{Hargreaves}} = \max\left(0, \, 0.0023 \cdot (T_{\text{mean}} + 17.8) \cdot \sqrt{\max(T_{\max} - T_{\min}, 0)} \cdot 0.408 R_a\right)$$

*Note:* Labelled with `usedFallbackEt0: true` in output metadata.

**Code Reference:** `lib/engine/et0.ts` (`hargreavesEt0`)

---

### 2.4 Crop Evapotranspiration ($ET_c$) & Crop Coefficients ($K_c$)
$$ET_{c,t} = K_{c}(t) \cdot ET_{0,t}$$

The growing cycle $[t_{\text{sow}}, t_{\text{harvest}}]$ of $L$ days is partitioned into four stages using fractions $f_{\text{ini}}, f_{\text{dev}}, f_{\text{mid}}, f_{\text{late}}$:
1. **Initial ($L_{\text{ini}}$):** $K_c(t) = K_{c,\text{ini}}$
2. **Development ($L_{\text{dev}}$):** Linear interpolation from $K_{c,\text{ini}}$ to $K_{c,\text{mid}}$
3. **Mid-Season ($L_{\text{mid}}$):** $K_c(t) = K_{c,\text{mid}}$
4. **Late-Season ($L_{\text{late}}$):** Linear decline from $K_{c,\text{mid}}$ to $K_{c,\text{end}}$

Seasonal potential crop water demand:
$$ET_{c,\text{season}} = \sum_{t=t_{\text{sow}}}^{t_{\text{harvest}}} ET_{c,t}$$

**Code Reference:** `lib/engine/water.ts` (`waterForCrop`), `lib/engine/season.ts` (`stageWindows`)

---

## 3. Soil Hydrology & Soil Water Balance

### 3.1 Hydraulic Properties & Water Retention
- **Total Available Water ($TAW$, in $\text{mm}$):**
  $$TAW = AWC \cdot Z_r = 1000 \cdot (\theta_{FC} - \theta_{WP}) \cdot Z_r$$
  where $AWC$ is available water capacity ($\text{mm}/\text{m}$) and $Z_r$ is crop rooting depth ($\text{m}$).
- **Readily Available Water ($RAW$):** $RAW = p \cdot TAW$, where $p \approx 0.5$.

---

### 3.2 FAO-56 Daily Root-Zone Soil Water Balance
$$D_{r,t} = D_{r,t-1} - (P_t - RO_t) - I_t - CR_t + ET_{c,t} + DP_t$$
where $0 \le D_{r,t} \le TAW$.
- $D_{r,t} = 0 \implies$ Field Capacity. Excess drains ($DP_t = -D_{r,t}$, reset $D_{r,t} = 0$).
- $D_{r,t} = TAW \implies$ Wilting Point.
- Stress day counted when $D_{r,t} > 0.5 \cdot TAW$.

**Code Reference:** `lib/engine/water.ts` (`rootZoneBalance`)

---

### 3.3 Atmospheric Shortfall vs. Root-Zone Depletion
- **Atmospheric Rain Shortfall (Screening):**
  $$\text{Shortfall}_{\text{season}} = \max\left(0, \sum_{t} ET_{c,t} - \sum_{t} P_t\right)$$
- **Root-Zone Moisture Stress (Hydrological):**
  Accounts for soil buffer storage, requiring $AWC$, $Z_r$, and initial depletion $D_{r,0}$.

---

## 4. Agro-Thermal & Phenological Dynamics

### 4.1 Growing Degree Days (GDD) & Thermal Time
$$GDD_t = \max\left(0, \, \frac{T_{\max,t} + T_{\min,t}}{2} - T_{\text{base}}\right)$$
$$GDD_{\text{cum}} = \sum_{t=t_{\text{sow}}}^{t_{\text{harvest}}} GDD_t$$

### 4.2 Extreme Thermal Exposure
Stage exceedance counts:
$$\text{HeatDays}_s = \sum_{t \in s} \mathbb{I}(T_{\max,t} > T_{\text{crit,heat},s})$$
$$\text{ColdDays}_s = \sum_{t \in s} \mathbb{I}(T_{\min,t} < T_{\text{crit,cold},s})$$

### 4.3 Frost Dynamics & Hemispheric Shifts
In the southern hemisphere, winter peaks in July; calendar days are shifted by half a year:
$$doy_{\text{shifted}} = \left( (doy + 182) \bmod 365 \right) + 1$$
Split day $d_{\text{split}} = 200$ separates Last Spring Frost ($LSF$) and First Autumn Frost ($FAF$). Frost-free days: $FFD = FAF - LSF$.

### 4.4 Precipitation Regimes & Dry Spells
- **Dry Day:** $P_t < 1.0 \, \text{mm}\cdot\text{day}^{-1}$.
- **Heavy Rain Day:** $P_t \ge 50.0 \, \text{mm}\cdot\text{day}^{-1}$.
- **Completeness:** Window requires $\ge 90\%$ valid days. Calendar year requires $\ge 355$ valid rain days.

### 4.5 Wet Growing Season Identification
Active growing month:
$$T_{\text{mean},m} \ge 8.0{^\circ}\text{C} \quad \text{AND} \quad \frac{P_m}{ET_{0,m}} \ge 0.50$$
Circular annual scanning joins consecutive active months across year boundaries.

---

## 5. Remote Sensing Radiometry & Geomorphometry

### 5.1 Spectral Vegetation Indices
$$\text{NDVI} = \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + \rho_{\text{Red}}}, \quad \text{NDMI} = \frac{\rho_{\text{NIR}} - \rho_{\text{SWIR1}}}{\rho_{\text{NIR}} + \rho_{\text{SWIR1}}}$$
Valid only when $(\text{NIR} + \text{Red}) > 0$.

### 5.2 QA Bitmask Decoding
- **HLS V2 Fmask:** Reject fill ($255$), cloud (bit 1), adjacent cloud/shadow (bit 2), shadow (bit 3), snow (bit 4), high aerosol (bits 6–7 = 11). Water (bit 5) separated from land.
- **MODIS MOD13Q1 VI Quality:** Modland $= 0$ (good), usefulness $\le 1$, no cloud/shadow/snow, land pixel $= 1$.

### 5.3 Topographic Slope (Horn's $3 \times 3$)
$$\Delta y = \Delta\phi_{\text{deg}} \times 111{,}320 \, \text{m}, \quad \Delta x = \Delta\lambda_{\text{deg}} \times 111{,}320 \, \text{m} \times \cos(\phi_{\text{centre}})$$
$$\text{Slope}_{\text{deg}} = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180}{\pi}$$

### 5.4 LST vs. Air Temperature
ECOSTRESS Land Surface Temperature ($LST = K - 273.15$) is skin radiometric temperature. **Never substitute $LST$ into air-temperature crop thresholds.**

---

## 6. Agronomy, Biogeochemistry & Agro-Ecosystems

### 6.1 Biological Nitrogen Fixation & Removal
$$N_{\text{fixed,cycle}} = \sum_{s \in \text{legumes}} [N_{\text{fix,min},s}, \, N_{\text{fix,max},s}]$$
$$N_{\text{removed,cycle}} = \sum_{s \in \text{crops}} \left( Y_s \cdot \frac{[N_{\text{grain},s}]}{100} \right)$$
Requires farmer-entered yield; otherwise removal is marked `unknown`.

### 6.2 Shared Hosts and Disease Breaks
Botanical family alone is a weak proxy: two legumes can share few pathogens, while rice and green gram share *Rhizoctonia solani*. The check therefore uses named organisms (`lib/data/crops/host-organisms.ts`), each with documented host crops, how it carries over, and a reference:

- **Soil-borne** (*Macrophomina phaseolina*, *R. solani*, *Athelia rolfsii*, root-knot nematodes): a caution whenever crop $b$ follows crop $a$ and both host the organism, at any gap.
- **Vector-borne or mobile insects** (yellow mosaic viruses, *Helicoverpa armigera*, *Maruca vitrata*, fall armyworm): information only, and only when the gap $t_{	ext{plant},b} - t_{	ext{harvest},a} \le 30$ days (a green bridge). Rotation within one field does little against them.
- **Host-specific soil wilts** (*Fusarium oxysporum* f. sp. *ciceris*, *F. udum*): a crop grown $k$ times in an $n$-year cycle returns every $n/k$ years. If $n/k$ is less than the suggested minimum (3 years), the option needs review. It becomes a hard veto when the farmer confirms wilt in the field.

Same-family pairs with no named shared organism are still flagged as a caution. A crop missing from a host list has no entry; that does not show it is a non-host. All entries are analyst readings of the literature and need checking against Myanmar plant-protection records.

### 6.3 SoilGrids Pedotransfer Integration
Depth-weighted $0\text{--}30\text{ cm}$:
$$\bar{X}_{0-30} = \frac{X_{0-5} \times 5 + X_{5-15} \times 10 + X_{15-30} \times 15}{30}$$
Values scaled by $d\_factor$ (clay/sand/silt/pH/SOC by $10$, bulk density by $100$).

---

## 7. Interval-Based Gross Margin Estimation

$$\text{GrossMargin} = [Y_{\min} \cdot P_{\min} - C_{\max}, \, Y_{\max} \cdot P_{\max} - C_{\min}]$$
Calculated as closed intervals over farmer/local ranges. This is interval arithmetic, not a probability model: the bounds are the worst and best combinations of the inputs, and no likelihood is attached to any value between them. A stochastic version would need distributions for yield, price and cost and Monte Carlo sampling.

**Ranking utility.** The income criterion is scored against a fixed regional anchor, not against the other options: $u = 	ext{clip}(M_{	ext{mid}} / M_{	ext{bench}}, 0, 1)$, where $M_{	ext{bench}}$ is the midpoint margin of the region's usual rotation (Ayeyarwady rice then black gram, Magway sesame then green gram, Shan maize then soybean) computed from the benchmark price, yield and cost table (`incomeAnchorFor` in `lib/engine/economics.ts`). Adding or removing an option therefore never changes another option's income score. A loss scores 0, and every option above the benchmark scores 1, though their margins are still shown side by side.

---

## 8. Scientific References
1. Allen et al. (1998) FAO Irrigation and Drainage Paper 56.
2. Hargreaves & Samani (1985) Appl. Eng. Agric. 1(2): 96-99.
3. Horn, B.K. (1981) Proc. IEEE 69(1): 14-47.
4. ISRIC SoilGrids 2.0 (2020) Wageningen.
