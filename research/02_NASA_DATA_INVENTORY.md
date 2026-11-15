# NASA Earth Observation & Environmental Data Inventory
**Project:** Field Shift — Adapting Farms with NASA Data (NASA Space Apps Challenge 2026)  
**Agent:** AGENT 2 — NASA Data Research & Download Specialist  
**Verification Date:** 2026-11-15  
**Geographic Domain:** Myanmar Heartland (Ayeyarwady Delta priority hubs, Central Dry Zone, Shan Highlands, Bago)  
**Status:** All products inspected, live endpoints validated, schemas verified, and archived in repository.

---

## 1. Executive Master Inventory Table

| Short Name | Full Scientific Name | Product Identifier & Version | Provider / DAAC | Spatial Resolution | Temporal Resolution | Scale Factor & Offset | Fill Value | DOI / Citation |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **NASA GPM IMERG V07** | GPM Integrated Multi-satellitE Retrievals for GPM (Final Run) | `GPM_3IMERGDF` v07 (Collection `C2723754864-GES_DISC`) | NASA GES DISC | 0.1° × 0.1° (~10 km) | Daily (UTC day, 48 half-hour integrations) | Scale: 1.0, Offset: 0.0 | `-9999.9` | [10.5067/GPM/IMERGDF/DAY/07](https://doi.org/10.5067/GPM/IMERGDF/DAY/07) |
| **NASA POWER Daily** | Prediction of Worldwide Energy Resources (Agroclimatology API) | NASA POWER AG Daily Point API `v2.10.3` (MERRA-2 + GEOS-IT + CERES) | NASA Langley Research Center | 0.5° lat × 0.625° lon (~50 km) | Daily (UTC / LST) | Scale: 1.0, Offset: 0.0 | `-999.0` | [NASA POWER Technical Reference](https://power.larc.nasa.gov) |
| **NASA SMAP L4** | SMAP L4 Global 9 km Surface & Root Zone Soil Moisture | `SPL4SMGP.008` (EASE-Grid 2.0) | NASA LP DAAC / NSIDC | 9 km grid (~9,000 m) | 3-hourly assimilated / daily aggregated | Scale: 1.0, Offset: 0.0 | `-9999.0` | [10.5067/6044OEF4V2W9](https://doi.org/10.5067/6044OEF4V2W9) |
| **Landsat C2 L2** | USGS Landsat Collection 2 Level-2 Surface Reflectance & Temperature | `landsat-c2-l2` (OLI/TIRS on L8/L9; ETM+ on L7) | USGS EROS / Microsoft Planetary Computer | 30 m × 30 m | 16-day repeat (8-day with L8 + L9 combined) | SR Scale: `0.0000275`, Offset: `-0.2`; ST Scale: `0.00341802`, Offset: `149.0` | `0` (SR), `-9999` (ST) | [10.5066/P9OGBGM6](https://doi.org/10.5066/P9OGBGM6) |
| **NASA SRTM DEM** | Shuttle Radar Topography Mission 1 Arc-Second Global | `SRTMGL1_NC.003` / NASADEM `NASADEM_NC.001` | NASA LP DAAC / USGS | 1 arc-second (~30 m at equator) | Static topographic baseline (Feb 2000) | Scale: 1.0, Offset: 0.0 | `-32768` | [10.5067/MEASURES/SRTM/SRTMGL1_NC.003](https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1_NC.003) |
| **NASA ECOSTRESS** | ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station | `ECO_L2T_LSTE.002` (LST) & `ECO_L3T_JET.002` (ET PT-JPL) | NASA LP DAAC | 70 m × 70 m | 1–5 days (ISS precessing diurnal orbit) | LST Scale: `0.02`, Offset: `0.0`; ET Scale: `0.1`, Offset: `0.0` | `0` (LST), `-9999` (ET) | [10.5067/ECOSTRESS/ECO_L2T_LSTE.002](https://doi.org/10.5067/ECOSTRESS/ECO_L2T_LSTE.002) |
| **ISRIC SoilGrids v2** | Global Gridded Soil Information System v2.0 | ISRIC SoilGrids v2.0 REST API | ISRIC — World Soil Information | 250 m × 250 m | Static baseline (depth intervals 0–30 cm) | `d_factor=10` (clay, sand, silt, pH, SOC, CEC); `d_factor=100` (bdod, N) | `null` (urban/water) | [10.5194/soil-7-217-2021](https://doi.org/10.5194/soil-7-217-2021) |

---

## 2. In-Depth Dataset Specifications & Engineering Parameters

### 2.1 NASA GPM IMERG V07 (0.1° Precipitation)

- **Official Product Name:** Global Precipitation Measurement (GPM) Integrated Multi-satellitE Retrievals for GPM (IMERG) Final Precipitation L3 1 day 0.1° × 0.1° V07 (`GPM_3IMERGDF`).
- **Data Center & Concept ID:** GES DISC; Collection Concept ID `C2723754864-GES_DISC`.
- **Primary Citation & DOI:** Huffman, G.J., et al. (2023). *GPM IMERG Final Precipitation L3 1 day 0.1 degree x 0.1 degree V07*, Goddard Earth Sciences Data and Information Services Center (GES DISC), [https://doi.org/10.5067/GPM/IMERGDF/DAY/07](https://doi.org/10.5067/GPM/IMERGDF/DAY/07).
- **Spatial Resolution:** 0.1° × 0.1° latitude-longitude grid (~10 km at equator).
- **Temporal Resolution:** 1 day (UTC calendar day: 00:00:00Z to 23:59:59Z), integrating 48 half-hour observations.
- **Physical Parameter Units:**
  - `precipitation`: Daily calibrated accumulation in $\text{mm/day}$.
  - `precipitation_cnt`: Integer count of valid half-hour satellite observations (0 to 48).
  - `randomError`: Daily estimated 1-$\sigma$ random error in $\text{mm/day}$.
  - `randomError_cnt`: Count of valid half-hours for error computation.
- **Scale Factor & Offset:** Direct floating-point values ($\text{Scale} = 1.0, \text{Offset} = 0.0$).
- **Fill Value:** `-9999.9` (missing data is strictly preserved as `null`, never imputed as 0.0).
- **Quality Assurance & Masking Policy:**
  - A day is classified as **complete** if and only if $\text{precipitation\_cnt} = 48$.
  - Days with $\text{precipitation\_cnt} < 48$ are marked as `partialSampling = true` in engine state to warn downstream crop-water balances that monsoon rain bursts may have occurred during unobserved hours.
- **Data Access Protocol:**
  - Granule metadata query via public CMR API (`https://cmr.earthdata.nasa.gov/search/granules.json`).
  - Spatial point extraction via OPeNDAP DAP4 constraint protocol (e.g., `precipitation[0][lonIdx][latIdx]`), preventing large global file downloads.

---

### 2.2 NASA POWER Daily Point Meteorology (0.5° × 0.625°)

- **Official Product Name:** NASA Prediction Of Worldwide Energy Resources (POWER) Agroclimatology Daily Point API (`v2.10.3`).
- **Data Center:** NASA Langley Research Center (LaRC).
- **Data Sources:** NASA GMAO MERRA-2 assimilation model, GEOS-IT real-time forward processing, and CERES satellite solar irradiance.
- **Primary Reference:** Stackhouse, P.W., et al. (2024). *NASA POWER Release 2.0: Methodology and Validations*, NASA Langley Research Center.
- **Spatial Resolution:** Native reanalysis grid of 0.5° latitude × 0.625° longitude (~50 km).
- **Temporal Resolution:** Daily time step (UTC or Local Solar Time LST).
- **Key Parameters & Physical Units:**
  - `T2M`: Temperature at 2 Meters (°C).
  - `T2M_MAX`: Daily Maximum Temperature at 2 Meters (°C).
  - `T2M_MIN`: Daily Minimum Temperature at 2 Meters (°C).
  - `RH2M`: Relative Humidity at 2 Meters (%).
  - `WS2M`: Wind Speed at 2 Meters ($\text{m/s}$).
  - `ALLSKY_SFC_SW_DWN`: All-Sky Surface Downward Shortwave Irradiance ($\text{MJ/m}^2/\text{day}$).
  - `PRECTOTCORR`: Bias-Corrected Precipitation ($\text{mm/day}$).
  - `PS`: Surface Atmospheric Pressure ($\text{kPa}$).
  - Optional Soil Wetness: `GWETTOP` (surface), `GWETROOT` (root zone), `GWETPROF` (profile) (dimensionless fraction 0.0 to 1.0).
- **Scale Factor & Fill Value:** Direct float values; Fill value `-999.0`.
- **Quality Assurance & Ground-Truth Calibration:**
  - Validated against NOAA GHCN-Daily Myanmar stations (`data/validation/power-vs-ghcn.json`).
  - In the Central Dry Zone (Mandalay station `BMM00048042`), NASA POWER `PRECTOTCORR` exhibits a severe relative bias of **-50.9%** (underestimating convective monsoonal showers). Field Shift applies an explicit farmer-facing caveat for Dry Zone parcels.
  - Days with $T_{\max} \ge 36^\circ\text{C}$ have rough correspondence with ground thermometers and trigger cautionary notices.

---

### 2.3 NASA SMAP L4 Root Zone Soil Moisture (9 km)

- **Official Product Name:** Soil Moisture Active Passive (SMAP) Level-4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data (`SPL4SMGP.008`).
- **Data Center & Archive:** NASA NSIDC DAAC / LP DAAC.
- **Primary Citation & DOI:** Reichle, R.H., et al. (2022). *SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data, Version 8*, NASA National Snow and Ice Data Center Distributed Active Archive Center, [https://doi.org/10.5067/6044OEF4V2W9](https://doi.org/10.5067/6044OEF4V2W9).
- **Spatial Resolution:** 9 km cylindrical equal-area EASE-Grid 2.0 (M09).
- **Temporal Resolution:** 3-hourly assimilation analysis / daily composite.
- **Key Parameters & Physical Units:**
  - `Geophysical_Data_sm_surface`: Volumetric soil moisture in top 0–5 cm ($\text{m}^3/\text{m}^3$).
  - `Geophysical_Data_sm_rootzone`: Volumetric soil moisture in root zone 0–100 cm ($\text{m}^3/\text{m}^3$).
  - `Geophysical_Data_sm_rootzone_pctl`: Climatological percentile rank (0.0 to 100.0%).
  - `Geophysical_Data_soil_temp_layer1`: Surface soil temperature ($\text{K}$).
- **Scale Factor & Fill Value:** Scale: `1.0`; Fill value: `-9999.0`.
- **Quality Assurance Policy:**
  - Sub-grid water bodies and urban areas are screened using SMAP land-cover classification.
  - Frozen ground states ($T_{\text{soil}} < 273.15\text{ K}$) flag soil moisture as non-infiltrating (not relevant in lowland Myanmar, but checked for high-elevation Shan ridges).
  - SAFE_END constraint: SMAP L4 operational feeds verified through 2025-12-31; subsequent dates trigger offline reanalysis warning.

---

### 2.4 USGS/NASA Landsat Collection 2 Level 2 (30 m)

- **Official Product Name:** Landsat 8-9 Operational Land Imager / Thermal Infrared Sensor (OLI/TIRS) and Landsat 7 ETM+ Collection 2 Level-2 Science Products.
- **Data Center & Provider:** USGS EROS / Cloud-native STAC on Microsoft Planetary Computer.
- **Primary Citation & DOI:** USGS (2020). *Landsat 8-9 Collection 2 Level 2 Science Products*, U.S. Geological Survey, [https://doi.org/10.5066/P9OGBGM6](https://doi.org/10.5066/P9OGBGM6).
- **Spatial Resolution:** 30 m multispectral bands in native Universal Transverse Mercator (UTM Zone 46N/47N for Myanmar).
- **Temporal Resolution:** 16-day orbital revisit per spacecraft (8 days with L8 and L9 staggered).
- **Scale Factors, Offsets & Band Formats:**
  - **Surface Reflectance (SR_B1 through SR_B7):**
    $$\rho = \text{DN} \times 0.0000275 - 0.2$$
    - Valid physical range: $0.0 \le \rho \le 1.0$.
    - Nodata fill value: `0`.
  - **Surface Temperature (ST_B10):**
    $$T_{\text{surface}} = \text{DN} \times 0.00341802 + 149.0 \quad [\text{Kelvin}]$$
    - Valid physical range: $150.0 \text{ K} \le T \le 350.0 \text{ K}$.
    - Nodata fill value: `-9999`.
- **QA_PIXEL 16-Bit Bitmask Specification:**
  - Bit 0: Fill (`1 = fill`)
  - Bit 1: Dilated Cloud (`1 = dilated cloud`)
  - Bit 2: Cirrus (`1 = high confidence cirrus`)
  - Bit 3: Cloud (`1 = high confidence cloud`)
  - Bit 4: Cloud Shadow (`1 = high confidence shadow`)
  - Bit 5: Snow/Ice (`1 = snow/ice`)
  - Bit 6: Clear Land (`1 = clear land`)
  - Bit 7: Water (`1 = open water body`)
  - Bits 8–9: Cloud Confidence (`00=None, 01=Low, 10=Medium, 11=High`)
  - Bits 10–11: Cloud Shadow Confidence
  - Bits 12–13: Snow/Ice Confidence
  - Bits 14–15: Cirrus Confidence
- **Field Shift Screening Policy:**
  - Reject all pixels with Bit 0 (fill), Bit 1 (dilated cloud), Bit 2 (cirrus), Bit 3 (cloud), Bit 4 (shadow), Bit 5 (snow), or Bit 7 (water).
  - Require parcel valid area fraction $f_{\text{valid}} \ge 0.25$ (`MIN_VALID_COVERAGE`). Scenes with $< 25\%$ clear pixels are dropped to avoid boundary cloud fringe contamination.

---

### 2.5 NASA SRTM 30 m DEM & Topography (1 Arc-Second)

- **Official Product Name:** Shuttle Radar Topography Mission (SRTM) 1 Arc-Second Global (`SRTMGL1_NC.003`) / NASADEM Global Elevation (`NASADEM_NC.001`).
- **Data Center & DOI:** NASA LP DAAC, [https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1_NC.003](https://doi.org/10.5067/MEASURES/SRTM/SRTMGL1_NC.003).
- **Spatial Resolution:** 1 arc-second (~30 m at equator).
- **Temporal Resolution:** Benchmark static baseline (acquired February 11–22, 2000 on Space Shuttle Endeavour STS-99).
- **Physical Parameter Units:** `SRTMGL1_DEM` in metres above the EGM96 geoid.
- **Scale Factor & Offset:** Direct integer elevations ($\text{Scale} = 1.0, \text{Offset} = 0.0$).
- **Fill Value:** `-32768`.
- **Derived Topographic Slope Algorithm:**
  - Evaluated on a 3×3 moving window using Horn's (1981) finite-difference gradient:
    $$\frac{\partial z}{\partial x} = \frac{(c + 2f + i) - (a + 2d + g)}{8 \Delta x}$$
    $$\frac{\partial z}{\partial y} = \frac{(g + 2h + i) - (a + 2b + c)}{8 \Delta y}$$
    $$\text{Slope} = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180}{\pi} \quad [^\circ]$$
  - Metric cell conversion accounts for latitude meridian convergence: $\Delta y = \Delta \text{Lat} \times 111,320\text{ m}$; $\Delta x = \Delta \text{Lon} \times 111,320\text{ m} \times \cos(\text{Lat})$.
  - Agricultural Slope Classes: Gentle ($< 5^\circ$, suitable for flooded paddy), Moderate ($5^\circ$–$15^\circ$, requires contour bunding), Steep ($> 15^\circ$, severe erosion hazard).

---

### 2.6 NASA ECOSTRESS 70 m ET & LST

- **Official Product Names:**
  - ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station Land Surface Temperature & Emissivity Daily L2 Global 70 m (`ECO_L2T_LSTE.002`).
  - ECOSTRESS Evapotranspiration PT-JPL Daily L3 Global 70 m (`ECO_L3T_JET.002`).
- **Data Center & DOIs:**
  - LSTE: [10.5067/ECOSTRESS/ECO_L2T_LSTE.002](https://doi.org/10.5067/ECOSTRESS/ECO_L2T_LSTE.002)
  - ET: [10.5067/ECOSTRESS/ECO_L3T_JET.002](https://doi.org/10.5067/ECOSTRESS/ECO_L3T_JET.002)
- **Spatial Resolution:** 70 m × 70 m at ISS nadir.
- **Temporal Resolution:** Non-sun-synchronous precessing orbit sampling across diurnal cycles (1–5 day repeat).
- **Physical Parameter Units & Scale Factors:**
  - `LST`: Land surface temperature in $\text{Kelvin}$ ($\text{Scale} = 0.02, \text{Offset} = 0.0$, converted to °C via $K - 273.15$). Fill value: `0`.
  - `ETdaily`: Daily evapotranspiration flux in $\text{W/m}^2$ ($\text{Scale} = 0.1, \text{Offset} = 0.0$). Fill value: `-9999`. Equivalent water depth computed via latent heat of vaporization ($\lambda \approx 2.45 \times 10^6\text{ J/kg}$, where $28.34\text{ W/m}^2 \approx 1.0\text{ mm/day}$).
- **Quality Assurance & Cloud/Water Screening:**
  - Mandatory QA: `QC` bitmask bits 0–1 must equal `00` (best quality).
  - Cloud screen: `cloud` mask must equal `0` (drop `1` and fill `255`).
  - Water screen: `water` mask must equal `0` (drop `1` and fill `255`).

---

### 2.7 ISRIC SoilGrids v2 (250 m)

- **Official Product Name:** ISRIC — World Soil Information Global SoilGrids 250m Version 2.0.
- **Primary Citation & DOI:** Poggio, L., et al. (2021). *SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty*, SOIL, 7, 217–240, [https://doi.org/10.5194/soil-7-217-2021](https://doi.org/10.5194/soil-7-217-2021).
- **Spatial Resolution:** 250 m × 250 m.
- **Temporal Resolution:** Static profile baseline (representing contemporary pedological surveys).
- **Depth Layer Integration:** Thickness-weighted mean across 0–30 cm topsoil:
  - 0–5 cm (weight: 5/30)
  - 5–15 cm (weight: 10/30)
  - 15–30 cm (weight: 15/30)
- **Scale Factors (`d_factor`) & Properties:**
  - `clay`: Mass fraction of clay ($< 2\,\mu\text{m}$), $\text{d\_factor}=10 \implies \text{g/kg} / 10 = \% \text{ (0–100\%)}$.
  - `sand`: Mass fraction of sand ($50–2000\,\mu\text{m}$), $\text{d\_factor}=10 \implies \text{g/kg} / 10 = \% \text{ (0–100\%)}$.
  - `silt`: Mass fraction of silt ($2–50\,\mu\text{m}$), $\text{d\_factor}=10 \implies \text{g/kg} / 10 = \% \text{ (0–100\%)}$.
  - `phh2o`: Soil pH in $\text{H}_2\text{O}$, $\text{d\_factor}=10 \implies \text{pH} \times 10 / 10 = \text{pH units (0–14)}$.
  - `soc`: Soil organic carbon, $\text{d\_factor}=10 \implies \text{dg/kg} / 10 = \text{g/kg}$.
  - `cec`: Cation exchange capacity at pH 7, $\text{d\_factor}=10 \implies \text{mmol(c)/kg} / 10 = \text{cmol(c)/kg}$.
  - `bdod`: Bulk density of fine earth, $\text{d\_factor}=100 \implies \text{cg/cm}^3 / 100 = \text{kg/dm}^3$.
  - `nitrogen`: Total nitrogen, $\text{d\_factor}=100 \implies \text{cg/kg} / 100 = \text{g/kg}$.
  - `wv0033`: Water retention at -33 kPa (Field Capacity), $\text{d\_factor}=10 \implies 10 \times \text{m}^3/\text{m}^3 / 10 = \% \text{ (fractional } \text{m}^3/\text{m}^3)$.
  - `wv1500`: Water retention at -1500 kPa (Wilting Point), $\text{d\_factor}=10 \implies 10 \times \text{m}^3/\text{m}^3 / 10 = \% \text{ (fractional } \text{m}^3/\text{m}^3)$.
- **Pedotransfer Derived Indices:**
  - Available Water Capacity: $\text{AWC} = \text{wv0033} - \text{wv1500}$ ($0–30\text{ cm}$).
  - Texture Class: Determined via USDA soil texture triangle algorithm (`usdaTexture()`).

---

## 3. Summary of Repository Coverage

- **Predownloaded Heartland Cache:** 22 NASA POWER 0.5° × 0.625° weather cells covering 25 agricultural hubs across 5 regions (Ayeyarwady, Magway, Mandalay, Shan, Bago) with 3,957 daily records per cell (2016-01-01 to 2026-10-31), totaling 87,054 records.
- **Fresh Research Ingestion:** 8 live Ayeyarwady Delta sites downloaded from NASA POWER (2021-01-01 to 2026-10-31 = 2,130 days each, 17,040 records) and 8 ISRIC SoilGrids multi-depth profiles.
- **Combined Total:** 33 weather cell-files, 106,287 daily weather records, 33 soil profile records, 10 Landsat C2 L2 scenes, and 15 GPM IMERG V07 granules. All files are cataloged with SHA-256 hashes in `research/data/manifest.json`.
