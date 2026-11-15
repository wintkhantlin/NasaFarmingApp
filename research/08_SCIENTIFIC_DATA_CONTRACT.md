# Field Shift — Formal Scientific Data Contract
**Document ID:** `research/08_SCIENTIFIC_DATA_CONTRACT.md`  
**Author:** AGENT 8 — Geospatial & Implementation Reviewer  
**Governing Standard:** NASA Space Apps Challenge 2026 / NASA Space Act Agreement Evidence Contract  
**Code Reference:** `lib/evidence/indicator.ts`, `lib/engine/provenance.ts`, `lib/conditions/condition-evidence.ts`  
**Date:** November 15, 2026  
**Status:** Approved Formal Standard  

---

## 1. Purpose, Architecture & Open-Science Principles

The **Field Shift Scientific Data Contract** is the authoritative specification governing every scientific quantity, observation, model calculation, and risk assessment delivered by the application. 

### Core Architectural Contracts
1. **The Truthfulness Contract:** Coarse satellite and reanalysis observations (e.g. 50 km POWER, 9 km SMAP) must **never** be labeled or implied as field-parcel-level measurements. The application strictly distinguishes between `field_observation`, `local_proxy`, and `regional_context`.
2. **The Non-Fabrication Principle:** Missing data is **never** coerced to zero, optimistic averages, or default constants. A missing observation remains `null` with an explicit machine-readable `missing_data_status`.
3. **The Quality Assurance Gate:** Every remotely sensed pixel is screened through calibrated quality bitmasks (USGS Landsat `QA_PIXEL`, HLS `Fmask`, MODIS 16-bit VI Quality, ECOSTRESS QC). Contaminated pixels (clouds, cloud shadows, cirrus, snow, or high aerosols) are discarded before computing vegetation or moisture indices.
4. **The Provenance Lineage:** Every displayed indicator carries full provenance metadata: originating agency, mission, instrument, collection version, spatial support geometry, temporal resolution, aggregation formula, and scientific limitations.

---

## 2. Machine-Readable Indicator Schema

Every indicator in the Field Shift engine implements the following TypeScript interface (compatible with JSON Schema Draft 2020-12):

```typescript
export interface ScientificDataContract {
  /** Unique alphanumeric slug: [domain]_[variable]_[source] */
  indicator_id: string;
  /** Formal physical or agronomic quantity */
  physical_quantity: string;
  /** Standard scientific unit (SI or agronomic convention) */
  unit: string;
  /** Primary Earth observation mission or dataset provider */
  source_dataset: string;
  /** Specific product collection / processing version */
  dataset_version: string;
  /** Canonical baseline or historical observation window */
  observation_period: string;
  /** Sensor native pixel or grid dimension */
  native_spatial_resolution: string;
  /** Physical spatial support of the calculated quantity */
  effective_support_geometry: "parcel_polygon" | "point_sample" | "topographic_neighborhood" | "catchment_grid" | "regional_grid";
  /** Ingestion frequency or interval */
  temporal_resolution: "instantaneous" | "3-hourly" | "daily" | "16-day_composite" | "monthly" | "seasonal" | "static";
  /** Mathematical or statistical operator applied */
  aggregation_method: string;
  /** QA criteria, bitmasks, and screening policies */
  quality_flags: string;
  /** Permitted null states and missing data reason codes */
  missing_data_status: "source_unconfigured" | "source_unavailable" | "insufficient_coverage" | "no_valid_observations" | "not_evaluable";
  /** Algorithmic or physical model formulation */
  model_version: string;
  /** Scientific constraints, boundary conditions, and known limitations */
  uncertainty_or_limitation: string;
  /** Empirical ground-truth verification status in Myanmar */
  validation_status: "ground_truth_validated" | "uncalibrated_proxy" | "reanalysis_modeled" | "farmer_verified";
  /** Decision-making boundary and applicability for the farmer */
  interpretation_scope: string;
}
```

---

## 3. Comprehensive Indicator Registry

### Domain A: Precipitation & Atmospheric Water Supply

#### 1. `precipitation_daily_imerg`
- **physical_quantity:** Daily Liquid-Equivalent Precipitation Accumulation
- **unit:** `mm/day`
- **source_dataset:** NASA Global Precipitation Measurement (GPM) IMERG Final Daily (GPM_3IMERGDF)
- **dataset_version:** Version 07 (V07)
- **observation_period:** 2000-06-01 to Present (latency ~3.5 months for Final Run)
- **native_spatial_resolution:** $0.1^\circ \times 0.1^\circ$ (~11 km $\times$ 11 km)
- **effective_support_geometry:** `catchment_grid` (snapped to 0.1° IMERG grid cell)
- **temporal_resolution:** `daily` (00:00 to 23:59 UTC)
- **aggregation_method:** Sum of 48 half-hourly calibrated microwave/infrared precipitation estimates
- **quality_flags:** Requires `precipitation_cnt == 48` valid half-hour intervals. Days with $<48$ samples flagged partial. Fill value `-9999.9` removed.
- **missing_data_status:** `source_unavailable` or `insufficient_coverage`. Triggers fallback to NASA POWER `PRECTOTCORR` with explicit provenance counter.
- **model_version:** Goddard Profiling Algorithm (GPROF2021) with GPCC monthly gauge calibration
- **uncertainty_or_limitation:** Gauge adjustment stations in Myanmar are sparse (primarily WMO lowland stations). High-intensity convective monsoonal cloudbursts may be smoothed across the 11 km grid cell.
- **validation_status:** `reanalysis_modeled` (partially gauge-adjusted)
- **interpretation_scope:** Regional catchment precipitation context; does not measure micro-topographic rain differences across individual field bunds.

#### 2. `precipitation_daily_power`
- **physical_quantity:** Daily Corrected Total Precipitation
- **unit:** `mm/day`
- **source_dataset:** NASA Prediction of Worldwide Energy Resources (POWER) / MERRA-2
- **dataset_version:** NASA POWER API v2.x (MERRA-2 assimilation)
- **observation_period:** 1981-01-01 to Present (latency ~2 days)
- **native_spatial_resolution:** $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$ (~55 km $\times$ 65 km)
- **effective_support_geometry:** `regional_grid` (snapped via `powerCell` in `lib/geo/cells.ts`)
- **temporal_resolution:** `daily` (UTC standard)
- **aggregation_method:** 24-hour accumulation of atmospheric model land surface precipitation (`PRECTOTCORR`)
- **quality_flags:** Rejects fill value `-999.0`. Requires $\ge 90\%$ valid days per season.
- **missing_data_status:** `source_unavailable` or `insufficient_coverage`.
- **model_version:** GEOS-5 FP-IT / MERRA-2 Atmospheric Data Assimilation System
- **uncertainty_or_limitation:** Grid cell covers approximately $3,500\text{ km}^2$. Underestimates extreme orographic rainfall along the Rakhine Yoma and Shan scarp; overestimates light drizzle in the Central Dry Zone rain shadow.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Long-term climatic baseline and screening tool; never a field-level rain gauge.

#### 3. `monsoon_rainfall_total`
- **physical_quantity:** Cumulative Monsoon Season Precipitation
- **unit:** `mm`
- **source_dataset:** NASA POWER / GPM IMERG Composite
- **dataset_version:** Version 2026.11.1
- **observation_period:** June 1 to October 31 (Historical 10-year to 40-year series)
- **native_spatial_resolution:** $0.1^\circ$ (IMERG) / $0.5^\circ \times 0.625^\circ$ (POWER)
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `seasonal` (5-month accumulation)
- **aggregation_method:** $\sum_{t=\text{Jun 1}}^{\text{Oct 31}} P_t$, requiring $\ge 90\%$ valid daily records
- **quality_flags:** Marked invalid (`null`) if more than 15 days in the monsoon window are missing.
- **missing_data_status:** `insufficient_coverage`
- **model_version:** Climatological seasonal integrator
- **uncertainty_or_limitation:** Does not reflect inter-spell dry intervals (e.g. 2-week mid-monsoon dry spells in Magway).
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Broad seasonal water endowment classification (high monsoon vs dry zone rain shadow).

#### 4. `dry_season_rainfall`
- **physical_quantity:** Cumulative Post-Monsoon / Pre-Monsoon Precipitation
- **unit:** `mm`
- **source_dataset:** NASA POWER / GPM IMERG Composite
- **dataset_version:** Version 2026.11.1
- **observation_period:** November 1 to April 30
- **native_spatial_resolution:** $0.1^\circ$ (IMERG) / $0.5^\circ \times 0.625^\circ$ (POWER)
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `seasonal` (6-month accumulation)
- **aggregation_method:** $\sum_{t=\text{Nov 1}}^{\text{Apr 30}} P_t$
- **quality_flags:** Requires $\ge 90\%$ valid daily records.
- **missing_data_status:** `insufficient_coverage`
- **model_version:** Climatological seasonal integrator
- **uncertainty_or_limitation:** Typically $<100\text{ mm}$ in Central Dry Zone; small absolute model biases represent large percentage errors.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Residual rain availability for second-season cropping; highlights irrigation requirement.

---

### Domain B: Thermal Environment & Temperature Hazards

#### 5. `temperature_2m_mean`
- **physical_quantity:** Daily Mean 2-Meter Ambient Air Temperature
- **unit:** `°C`
- **source_dataset:** NASA POWER (MERRA-2)
- **dataset_version:** API v2.x
- **observation_period:** 1981-01-01 to Present
- **native_spatial_resolution:** $0.5^\circ \times 0.625^\circ$
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `daily`
- **aggregation_method:** Hourly model integration: $\frac{1}{24} \sum_{h=1}^{24} T_{2m, h}$
- **quality_flags:** Rejects fill `-999.0`.
- **missing_data_status:** `source_unavailable`
- **model_version:** GEOS-5 2D atmospheric boundary layer
- **uncertainty_or_limitation:** Coarse elevation averaging. In mountainous terrain (Shan State), narrow valley bottoms may experience inversions $5^\circ\text{C}$ cooler than the grid cell average.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Regional thermal suitability screening.

#### 6. `temperature_2m_max`
- **physical_quantity:** Daily Maximum 2-Meter Air Temperature
- **unit:** `°C`
- **source_dataset:** NASA POWER (MERRA-2)
- **dataset_version:** API v2.x
- **observation_period:** 1981-01-01 to Present
- **native_spatial_resolution:** $0.5^\circ \times 0.625^\circ$
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `daily`
- **aggregation_method:** Daily peak diurnal value: $\max_{h \in [1, 24]} T_{2m, h}$
- **quality_flags:** Rejects fill `-999.0`.
- **missing_data_status:** `source_unavailable`
- **model_version:** GEOS-5 land-atmosphere boundary model
- **uncertainty_or_limitation:** Ambient air temperature measured at 2 m in a well-ventilated shelter. In dry, unshaded fields, plant canopy temperature can exceed $T_{\text{max}}$ by $2–6^\circ\text{C}$; in flooded paddies, evaporative cooling may depress canopy temperature.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Atmospheric heat screening.

#### 7. `temperature_2m_min`
- **physical_quantity:** Daily Minimum 2-Meter Air Temperature
- **unit:** `°C`
- **source_dataset:** NASA POWER (MERRA-2)
- **dataset_version:** API v2.x
- **observation_period:** 1981-01-01 to Present
- **native_spatial_resolution:** $0.5^\circ \times 0.625^\circ$
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `daily`
- **aggregation_method:** Daily minimum diurnal value: $\min_{h \in [1, 24]} T_{2m, h}$
- **quality_flags:** Rejects fill `-999.0`.
- **missing_data_status:** `source_unavailable`
- **model_version:** GEOS-5 nocturnal boundary layer
- **uncertainty_or_limitation:** Radiative frost on ground tissue can occur when shelter air temperature is $+2^\circ\text{C}$ to $+4^\circ\text{C}$ under clear, calm winter skies.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Regional chilling exposure.

#### 8. `premonsoon_heat_days`
- **physical_quantity:** Frequency of Critical Heat Exposure Days ($T_{\text{max}} \ge 35^\circ\text{C}$)
- **unit:** `days`
- **source_dataset:** NASA POWER Daily Series
- **dataset_version:** Version 2026.11.1
- **observation_period:** March 1 to May 31 (Pre-monsoon window)
- **native_spatial_resolution:** $0.5^\circ \times 0.625^\circ$
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `seasonal`
- **aggregation_method:** $\sum_{t=\text{Mar 1}}^{\text{May 31}} \mathbb{I}(T_{\text{max}, t} \ge 35.0^\circ\text{C})$
- **quality_flags:** Requires $\ge 90\%$ valid days in the March–May window.
- **missing_data_status:** `insufficient_coverage`
- **model_version:** Threshold exceedance count
- **uncertainty_or_limitation:** Measures single-day exceedance counts, **not** multi-day consecutive heatwaves (which require specific duration criteria). Does not account for cultivar-specific pollen sterility thresholds.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Risk screening for flowering abortion in pre-monsoon crops (sesame, groundnut).

#### 9. `chilling_frost_nights`
- **physical_quantity:** Frequency of Chilling Nights ($T_{\text{min}} \le 12^\circ\text{C}$)
- **unit:** `nights`
- **source_dataset:** NASA POWER Daily Series
- **dataset_version:** Version 2026.11.1
- **observation_period:** November 1 to February 28
- **native_spatial_resolution:** $0.5^\circ \times 0.625^\circ$
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `seasonal`
- **aggregation_method:** $\sum_{t=\text{Nov 1}}^{\text{Feb 28}} \mathbb{I}(T_{\text{min}, t} \le 12.0^\circ\text{C})$
- **quality_flags:** Requires $\ge 90\%$ valid winter days.
- **missing_data_status:** `insufficient_coverage`
- **model_version:** Threshold exceedance count
- **uncertainty_or_limitation:** Does not confirm physical frost or ice crystals on leaves.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Identification of vegetative slowdown in tropical crops.

---

### Domain C: Atmospheric Evaporative Demand & Crop Water Balance

#### 10. `solar_radiation_allsky`
- **physical_quantity:** Surface All-Sky Downward Shortwave Irradiance
- **unit:** `MJ/m²/day`
- **source_dataset:** NASA POWER (CERES SYN1deg assimilation)
- **dataset_version:** CERES Edition 4.1
- **observation_period:** 1984-01-01 to Present
- **native_spatial_resolution:** $1.0^\circ \times 1.0^\circ$ (~110 km $\times$ 110 km)
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `daily`
- **aggregation_method:** 24-hour radiative flux integration (converted from kWh/m²/day by $\times 3.6$)
- **quality_flags:** Rejects fill `-999.0`.
- **missing_data_status:** `source_unavailable`
- **model_version:** CERES fast-radiation radiative transfer model
- **uncertainty_or_limitation:** Deep convective cloud covers in the monsoon can cause spatial irradiance variations of $\pm 25\%$ across a $1^\circ$ cell.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Energy driver for Penman-Monteith evapotranspiration and photosynthetic potential.

#### 11. `reference_evapotranspiration_et0`
- **physical_quantity:** Daily Reference Crop Evapotranspiration
- **unit:** `mm/day`
- **source_dataset:** Derived from NASA POWER meteorology
- **dataset_version:** FAO-56 Penman-Monteith
- **observation_period:** Daily historical record
- **native_spatial_resolution:** $0.5^\circ \times 0.625^\circ$
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `daily`
- **aggregation_method:**
  $$ET_0 = \frac{0.408 \Delta (R_n - G) + \gamma \frac{900}{T + 273} u_2 (e_s - e_a)}{\Delta + \gamma (1 + 0.34 u_2)}$$
  Fallback to Hargreaves-Samani when solar radiation, wind speed, or humidity is missing:
  $$ET_0 = 0.0023 \cdot R_a \cdot (T_{\text{mean}} + 17.8) \sqrt{T_{\text{max}} - T_{\text{min}}}$$
- **quality_flags:** Primary method requires valid $T_{\text{max}}, T_{\text{min}}, RH_{2m}, WS_{2m}, R_s$. If secondary fallback used, provenance records `method: "hargreaves"`.
- **missing_data_status:** `not_evaluable` (when temperature bounds are missing)
- **model_version:** FAO Irrigation and Drainage Paper No. 56
- **uncertainty_or_limitation:** Represents potential evaporative demand of an idealized, well-watered reference grass (height 0.12 m, surface resistance 70 s/m, albedo 0.23). **Not** actual crop water use.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Climatic evaporative demand baseline.

#### 12. `potential_crop_evapotranspiration_etc`
- **physical_quantity:** Potential Crop Evapotranspiration under Non-Limiting Soil Water
- **unit:** `mm/day`
- **source_dataset:** Derived from $ET_0$ and Crop Phenology Library
- **dataset_version:** FAO-56 Single Crop Coefficient ($K_c$)
- **observation_period:** Crop lifecycle (planting to physiological maturity)
- **native_spatial_resolution:** `parcel_polygon`
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `daily`
- **aggregation_method:** $ET_c = K_c(t) \cdot ET_0$, where $K_c(t)$ is linearly interpolated between initial, mid-season, and end-season stage coefficients.
- **quality_flags:** Requires valid crop planting date, cycle length, and $ET_0$.
- **missing_data_status:** `missing_input` (if crop not selected or planting date omitted).
- **model_version:** FAO-56 Phenological Stage Model
- **uncertainty_or_limitation:** Represents water demand if the crop is fully watered. In rainfed fields with water stress, actual $ET$ ($ET_a$) is lower ($ET_a = K_s \cdot K_c \cdot ET_0$).
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Maximum potential irrigation or water requirement.

#### 13. `climatic_water_deficit`
- **physical_quantity:** Screening Atmospheric Moisture Shortfall ($P - ET_c$)
- **unit:** `mm/month` or `mm/cycle`
- **source_dataset:** Derived from IMERG/POWER rain and $ET_c$
- **dataset_version:** Version 2026.11.1
- **observation_period:** Monthly or seasonal crop cycle
- **native_spatial_resolution:** `regional_grid`
- **effective_support_geometry:** `regional_grid`
- **temporal_resolution:** `monthly`
- **aggregation_method:** $\text{Deficit} = \max(0, ET_c - P)$
- **quality_flags:** Inherits precipitation and $ET_c$ validity flags.
- **missing_data_status:** `not_evaluable`
- **model_version:** Simplified climatic water balance
- **uncertainty_or_limitation:** **Screening gap only.** Does not account for antecedent soil moisture storage, root zone depth, capillary rise, or irrigation canal deliveries.
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Early warning of water requirement windows; not an irrigation engineering schedule.

---

### Domain D: Soil Moisture & Root-Zone Hydrology

#### 14. `soil_moisture_rootzone_smap`
- **physical_quantity:** Model-Assimilated Root-Zone Volumetric Soil Moisture (0–100 cm)
- **unit:** `m³/m³`
- **source_dataset:** NASA SMAP L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture (SPL4SMGP)
- **dataset_version:** Version 008 (AppEEARS SPL4SMGP.008)
- **observation_period:** 2015-03-31 to 2025-12-31 (`SMAP_SAFE_END`)
- **native_spatial_resolution:** 9 km grid posting
- **effective_support_geometry:** `catchment_grid` (EASE-Grid 2.0 9 km cell)
- **temporal_resolution:** `daily` (mean of 3-hourly assimilations)
- **aggregation_method:** Area-weighted or nearest-neighbor catchment cell extraction
- **quality_flags:** Fill `-9999.0` removed. Post-2025 queries halted per NSIDC advisory.
- **missing_data_status:** `source_unavailable`. Enforces negative-finding gate: missing data is **never** assumed to be moist.
- **model_version:** NASA Catchment Land Surface Model (Ensemble Kalman Filter assimilating L-band brightness temperature)
- **uncertainty_or_limitation:** **REGIONAL CONTEXT ONLY.** Reflects regional 9 km catchment saturation state. Does not measure water content inside the farmer's specific parcel, bunded water, or furrow irrigation.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Regional catchment drought and waterlogging trend context.

#### 15. `soil_moisture_surface_smap`
- **physical_quantity:** Surface Soil Moisture (0–5 cm)
- **unit:** `m³/m³`
- **source_dataset:** NASA SMAP L4 (SPL4SMGP)
- **dataset_version:** Version 008
- **observation_period:** 2015-03-31 to 2025-12-31
- **native_spatial_resolution:** 9 km grid posting
- **effective_support_geometry:** `catchment_grid`
- **temporal_resolution:** `daily`
- **aggregation_method:** Daily mean of top 5 cm model assimilation
- **quality_flags:** Fill `-9999.0` removed.
- **missing_data_status:** `source_unavailable`
- **model_version:** Catchment LSM
- **uncertainty_or_limitation:** Extremely sensitive to surface skin wetness from brief showers that evaporate within hours without replenishing seedbeds.
- **validation_status:** `reanalysis_modeled`
- **interpretation_scope:** Regional topsoil wetting indicator.

#### 16. `available_water_capacity_profile`
- **physical_quantity:** Plant Available Water Capacity ($AWC = \theta_{FC} - \theta_{WP}$)
- **unit:** `mm/m`
- **source_dataset:** Derived from SoilGrids 2.0 / Saxton-Rawls Pedotransfer
- **dataset_version:** Version 2026.11.1
- **observation_period:** Static soil profile (0–30 cm default, up to root depth)
- **native_spatial_resolution:** 250 m (SoilGrids) or Parcel (Farmer Soil Observation)
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `static`
- **aggregation_method:** Depth-weighted integration across root zone: $\int_0^{z_r} (\theta_{FC}(z) - \theta_{WP}(z)) \, dz$
- **quality_flags:** Farmer soil texture and lab observations take absolute precedence over digital soil maps.
- **missing_data_status:** `missing_input` (when texture/organic carbon missing)
- **model_version:** Saxton-Rawls (2006) pedotransfer equations
- **uncertainty_or_limitation:** Uncalibrated against tropical smectitic/alluvial Delta clays. Assumes rigid soil matrix (neglects shrinkage cracks in vertic soils).
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Theoretical maximum soil water reservoir depth.

---

### Domain E: Soil Physical, Chemical & Topographic Properties

#### 17. `soil_texture_class`
- **physical_quantity:** USDA 12-Class Soil Texture
- **unit:** `categorical` (e.g., "clay", "sandy loam", "silt loam")
- **source_dataset:** ISRIC SoilGrids 2.0 / Farmer Field Observation
- **dataset_version:** SoilGrids 2.0 (2020 release)
- **observation_period:** Static baseline
- **native_spatial_resolution:** 250 m
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `static`
- **aggregation_method:** Depth-weighted mean (0–5 cm, 5–15 cm, 15–30 cm) of sand, silt, and clay fractions, classified via USDA texture ternary logic (`usdaTexture` in `lib/soil/soilgrids.ts`).
- **quality_flags:** Farmer override (`from: "farmer"`) replaces SoilGrids (`from: "soilgrids"`).
- **missing_data_status:** `source_unavailable`
- **model_version:** Machine learning random forest spatial covariate model (ISRIC)
- **uncertainty_or_limitation:** 250 m pixel averages over local bunds, ditches, and sand lenses. Accuracy in Myanmar is constrained by few legacy training profiles.
- **validation_status:** `uncalibrated_proxy` (unless farmer entered)
- **interpretation_scope:** Baseline soil workability, water holding, and tillage suitability screening.

#### 18. `soil_organic_carbon_stock`
- **physical_quantity:** Soil Organic Carbon Content
- **unit:** `g/kg` (or `%` where indicated)
- **source_dataset:** ISRIC SoilGrids 2.0 / Farmer Lab Test
- **dataset_version:** SoilGrids 2.0
- **observation_period:** Static baseline
- **native_spatial_resolution:** 250 m
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `static`
- **aggregation_method:** Depth-weighted average over 0–30 cm: $\frac{5 \cdot SOC_{0-5} + 10 \cdot SOC_{5-15} + 15 \cdot SOC_{15-30}}{30}$
- **quality_flags:** Rejects fill values; weights only layers with finite numbers.
- **missing_data_status:** `source_unavailable`
- **model_version:** ISRIC Quantile Random Forest
- **uncertainty_or_limitation:** Coarse prediction. Intensive tillage and residue burning in post-monsoon systems rapidly deplete surface SOC below mapped values.
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Soil structural vulnerability and baseline nitrogen mineralization potential.

#### 19. `soil_ph_acidity`
- **physical_quantity:** Soil pH in $H_2O$
- **unit:** `pH units` (0–14 scale)
- **source_dataset:** ISRIC SoilGrids 2.0 / Farmer Soil Test
- **dataset_version:** SoilGrids 2.0
- **observation_period:** Static baseline
- **native_spatial_resolution:** 250 m
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `static`
- **aggregation_method:** Depth-weighted mean over 0–30 cm fine-earth fraction
- **quality_flags:** Unit measure scaled by `d_factor = 10` ($pH \times 10$).
- **missing_data_status:** `source_unavailable`
- **model_version:** ISRIC Random Forest
- **uncertainty_or_limitation:** Seasonal flooding in Delta acid sulphate soils can alter active root-zone pH by up to 1.5 units between anaerobic and aerobic phases.
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Nutrient availability screening (e.g. phosphorus lockup in acid Shan soils, micronutrient limits in alkaline Dry Zone soils).

#### 20. `soil_cation_exchange_capacity`
- **physical_quantity:** Cation Exchange Capacity of the Fine Earth
- **unit:** `cmol(+)/kg`
- **source_dataset:** ISRIC SoilGrids 2.0
- **dataset_version:** SoilGrids 2.0
- **observation_period:** Static baseline
- **native_spatial_resolution:** 250 m
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `static`
- **aggregation_method:** Depth-weighted mean over 0–30 cm
- **quality_flags:** Rejects null values.
- **missing_data_status:** `source_unavailable`
- **model_version:** ISRIC Random Forest
- **uncertainty_or_limitation:** Uncalibrated against local mineralogy.
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Nutrient retention and cation buffering capacity.

#### 21. `terrain_elevation_srtm`
- **physical_quantity:** Ground Surface Elevation Above Mean Sea Level
- **unit:** `m`
- **source_dataset:** NASA Shuttle Radar Topography Mission (SRTMGL1)
- **dataset_version:** Version 003 (Global 1 Arc-Second)
- **observation_period:** 2000-02-11 to 2000-02-21 (Static benchmark)
- **native_spatial_resolution:** 1 arc-second (~30 m at equator)
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `static`
- **aggregation_method:** Bilinear interpolation or zonal median across parcel outline
- **quality_flags:** Rejects fill value `-32768`.
- **missing_data_status:** `source_unavailable`
- **model_version:** C-band InSAR Digital Elevation Model
- **uncertainty_or_limitation:** Radar reflects from canopy top in forested areas; vertical accuracy $\pm 5–10\text{ m}$. Acquired in February 2000; does not reflect modern canal excavations, levees, or road bunds.
- **validation_status:** `ground_truth_validated`
- **interpretation_scope:** Topographic elevation baseline and drainage gradient context.

#### 22. `terrain_slope_gradient_srtm`
- **physical_quantity:** Terrain Surface Slope Angle
- **unit:** `degrees` (and qualitative steepness class: gentle $<5^\circ$, moderate $5–15^\circ$, steep $>15^\circ$)
- **source_dataset:** Derived from SRTMGL1 30 m DEM
- **dataset_version:** Version 2026.11.1
- **observation_period:** February 2000 baseline
- **native_spatial_resolution:** 30 m grid
- **effective_support_geometry:** `topographic_neighborhood` ($3 \times 3$ grid cells = $90\text{ m} \times 90\text{ m}$)
- **temporal_resolution:** `static`
- **aggregation_method:** Horn (1981) $3 \times 3$ finite-difference gradient:
  $$\frac{\partial z}{\partial x} = \frac{(c + 2f + i) - (a + 2d + g)}{8 \Delta x}, \quad \frac{\partial z}{\partial y} = \frac{(g + 2h + i) - (a + 2b + c)}{8 \Delta y}$$
  $$\text{Slope} = \arctan\left(\sqrt{(\partial z / \partial x)^2 + (\partial z / \partial y)^2}\right) \cdot \frac{180}{\pi}$$
  Aggregated across parcel as the **median slope** (`medianDeg`).
- **quality_flags:** **Strict completeness rule:** All 8 neighboring cells and the central cell must be valid non-fill values. Any null neighbor sets slope to `null`.
- **missing_data_status:** `source_unavailable`
- **model_version:** Horn (1981) Algorithm (`lib/nasa/derive/slope.ts`)
- **uncertainty_or_limitation:** **Slope is NOT soil erosion in tonnes/hectare.** A 30 m DEM cannot detect farmer-constructed field terraces, bunds, or contour grass strips that stop erosion.
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Topographic runoff and erosion susceptibility screening.

---

### Domain F: Satellite Reflectance, Vegetation & Inundation

#### 23. `surface_water_extent_landsat`
- **physical_quantity:** Observed Open Standing Surface Water Fraction
- **unit:** `% of parcel` (and integer pixel count)
- **source_dataset:** USGS Landsat Collection 2 Level-2 Surface Reflectance (via Microsoft Planetary Computer) / NASA HLS
- **dataset_version:** Collection 2 Level-2
- **observation_period:** 2021-01-01 to Present (Individual clear-sky acquisitions)
- **native_spatial_resolution:** 30 m
- **effective_support_geometry:** `parcel_polygon` (pixel-center containment)
- **temporal_resolution:** `instantaneous` (16-day repeat per satellite, 8-day combined Landsat 8/9)
- **aggregation_method:** Ratio of valid water pixels to total parcel pixels: $\frac{N_{\text{water}}}{N_{\text{total}}} \times 100$
- **quality_flags:** Evaluated from `QA_PIXEL` Bit 7 (Water). Requires clear sky on parcel (`validLand` or `water` without cloud/shadow). Requires parcel clear fraction $\ge 50\%$.
- **missing_data_status:** `no_valid_observations` (if obscured by monsoon clouds)
- **model_version:** USGS C2 CFMask / Water Algorithm
- **uncertainty_or_limitation:** **Cannot measure water depth, flow velocity, or duration.** Satellite optical sensors cannot distinguish between **deliberately impounded paddy water** and **destructive flood water**. Cloud cover frequently blinds optical sensors during peak monsoon flood disasters.
- **validation_status:** `ground_truth_validated`
- **interpretation_scope:** Historical evidence of standing surface water on specific clear dates; requires farmer confirmation for agricultural meaning.

#### 24. `vegetation_greenness_ndvi_landsat`
- **physical_quantity:** Normalized Difference Vegetation Index (NDVI)
- **unit:** `dimensionless` ($-1.0$ to $+1.0$)
- **source_dataset:** USGS Landsat Collection 2 Level-2 (Bands 4 & 5)
- **dataset_version:** Collection 2 Level-2
- **observation_period:** 2021-01-01 to Present
- **native_spatial_resolution:** 30 m
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `instantaneous`
- **aggregation_method:** Per-pixel calculation: $\text{NDVI} = \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + \rho_{\text{Red}}}$, aggregated as the **median NDVI** of valid land pixels inside the parcel.
- **quality_flags:** Screened via `QA_PIXEL`. Excludes fill, cloud, dilated cloud, shadow, snow, and water pixels. Requires $\ge 50\%$ parcel coverage.
- **missing_data_status:** `no_valid_observations`
- **model_version:** Calibrated surface reflectance scaling: $\rho = DN \cdot 0.0000275 - 0.2$
- **uncertainty_or_limitation:** NDVI saturates at high leaf area index ($LAI > 3$); does not measure crop yield; mixes crop canopy with weed cover.
- **validation_status:** `ground_truth_validated`
- **interpretation_scope:** Field-level photosynthetic greenness timeline and growing season detection.

#### 25. `canopy_moisture_ndmi_landsat`
- **physical_quantity:** Normalized Difference Moisture Index (NDMI)
- **unit:** `dimensionless` ($-1.0$ to $+1.0$)
- **source_dataset:** USGS Landsat Collection 2 Level-2 (Bands 5 & 6)
- **dataset_version:** Collection 2 Level-2
- **observation_period:** 2021-01-01 to Present
- **native_spatial_resolution:** 30 m
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `instantaneous`
- **aggregation_method:** $\text{NDMI} = \frac{\rho_{\text{NIR}} - \rho_{\text{SWIR1}}}{\rho_{\text{NIR}} + \rho_{\text{SWIR1}}}$, aggregated as the median of clear parcel pixels.
- **quality_flags:** Same strict QA_PIXEL mask as NDVI.
- **missing_data_status:** `no_valid_observations`
- **model_version:** Gao (1996) Surface Liquid Water Algorithm
- **uncertainty_or_limitation:** Sensitive to both canopy water content and background soil surface wetness.
- **validation_status:** `ground_truth_validated`
- **interpretation_scope:** Relative canopy hydration and dry-down monitoring.

#### 26. `regional_vegetation_greenness_modis`
- **physical_quantity:** 16-Day Composite NDVI
- **unit:** `dimensionless`
- **source_dataset:** NASA Terra/Aqua MODIS (MOD13Q1 / MYD13Q1)
- **dataset_version:** Collection 061
- **observation_period:** 2016-01-01 to Present
- **native_spatial_resolution:** 250 m
- **effective_support_geometry:** `regional_grid` (250 m Sinusoidal tile)
- **temporal_resolution:** `16-day_composite`
- **aggregation_method:** Maximum value compositing over 16 days
- **quality_flags:** Evaluated via `_250m_16_days_VI_Quality` (MODLAND == 0) and `_250m_16_days_pixel_reliability == 0`. Inland water (classes 3–5) excluded.
- **missing_data_status:** `source_unavailable`
- **model_version:** MOD13Q1 C61
- **uncertainty_or_limitation:** **250 m pixel mixes multiple farms, roads, and village borders.** It does not identify the crop in an individual 0.5 ha field.
- **validation_status:** `ground_truth_validated`
- **interpretation_scope:** Long-term regional phenological rhythm.

#### 27. `land_surface_temperature_ecostress`
- **physical_quantity:** Instantaneous Land Surface Temperature (LST)
- **unit:** `°C` (converted from Kelvin by $- 273.15$)
- **source_dataset:** NASA ECOSTRESS (ECO_L2T_LSTE)
- **dataset_version:** Version 002
- **observation_period:** 2018-05-20 to Present (ISS overpasses)
- **native_spatial_resolution:** 70 m
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `instantaneous` (irregular diurnal overpass times)
- **aggregation_method:** Median of clear parcel pixels
- **quality_flags:** Mandatory QA bits 0–1 == 00 (best quality). Cloud and water masks == 0.
- **missing_data_status:** `source_unavailable`
- **model_version:** Temperature-Emissivity Separation (TES) algorithm
- **uncertainty_or_limitation:** **LST is surface radiative skin temperature, NOT 2 m air temperature.** It reflects surface energy balance at a single pass timestamp.
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Identification of crop thermal stress hotspots and transpiration cooling.

#### 28. `instantaneous_evapotranspiration_ecostress`
- **physical_quantity:** Evaporative Latent Heat Flux ($LE$)
- **unit:** `W/m²`
- **source_dataset:** NASA ECOSTRESS (ECO_L3T_JET)
- **dataset_version:** Version 002
- **observation_period:** 2018-05-20 to Present
- **native_spatial_resolution:** 70 m
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `instantaneous`
- **aggregation_method:** Median of clear parcel pixels
- **quality_flags:** Mandatory QA passed; cloud/water masked.
- **missing_data_status:** `source_unavailable`
- **model_version:** PT-JPL (Priestley-Taylor Jet Propulsion Laboratory) model
- **uncertainty_or_limitation:** Instantaneous flux in energy units ($W/m^2$). **NOT daily crop water use in mm/day.**
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Relative transpiration vigor comparison.

---

### Domain G: Agronomic Paddy Balance & Post-Monsoon Handover

#### 29. `paddy_water_balance_pond_depth`
- **physical_quantity:** Lowland Paddy Standing Water Pond Depth
- **unit:** `mm`
- **source_dataset:** Engine Dynamic Hydrological Model
- **dataset_version:** Version 2026.11.1 (`lib/engine/water.ts`)
- **observation_period:** Rice cropping slot
- **native_spatial_resolution:** `parcel_polygon`
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `daily`
- **aggregation_method:** Daily mass balance:
  $$h_t = \max\left(0, \min(h_{\text{bund}}, h_{t-1} + P_t + I_t - ET_{c, t} - S_t)\right)$$
  where $h_{\text{bund}}$ is bund height (mm), $S_t$ is seepage and percolation loss (mm/day).
- **quality_flags:** Requires farmer input for bund height (default assumed 100 mm) and seepage (default 5 mm/day).
- **missing_data_status:** `missing_input`
- **model_version:** IRRI / ACIAR Lowland Paddy Water Model
- **uncertainty_or_limitation:** Bund integrity varies; rodent holes and breaches cannot be simulated.
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Simulation of standing water sufficiency for semi-aquatic rice cultivation.

#### 30. `post_paddy_residual_soil_moisture`
- **physical_quantity:** Inherited Root-Zone Soil Moisture at Upland Crop Planting
- **unit:** `mm` (or saturation fraction)
- **source_dataset:** Engine Handover Model (`uplandStartAfterPaddy` in `lib/engine/water.ts`)
- **dataset_version:** Version 2026.11.1
- **observation_period:** Transition from rice harvest to post-monsoon pulse planting
- **native_spatial_resolution:** `parcel_polygon`
- **effective_support_geometry:** `parcel_polygon`
- **temporal_resolution:** `step-based`
- **aggregation_method:**
  - If rice ends with standing pond ($h > 0$), profile starts at field saturation: $\theta_0 = \theta_{\text{sat}}$.
  - If pond drained before harvest, plough pan conductance decay model controls drawdown:
    $$k_{\text{pan}} \in [2.5, 6.0]\text{ mm/day}$$
- **quality_flags:** Explicitly declared in UI: *"Soil moisture at planting is taken as saturated profile inherited from previous paddy slot."*
- **missing_data_status:** `not_evaluable` (if previous crop was not paddy)
- **model_version:** ACIAR Post-Paddy Pulse Hydrology Model
- **uncertainty_or_limitation:** Plough pan impedance $k_{\text{pan}}$ is uncalibrated against specific Myanmar Delta clay loams. Rapid surface cracking can dry seedbeds faster than modeled.
- **validation_status:** `uncalibrated_proxy`
- **interpretation_scope:** Assessment of seedbed moisture viability for zero-till or relay legume establishment.

---

## 4. Master Scientific Data Contract Matrix

| Indicator ID | Physical Quantity | Unit | Source Sensor / Dataset | Native Resolution | Support Geometry | Model / QA Standard | Scale Badge | Validation Status |
|:---|:---|:---:|:---|:---:|:---:|:---|:---:|:---:|
| `precipitation_daily_imerg` | Daily precipitation | `mm/day` | GPM IMERG V07 | 0.1° (~10 km) | Catchment grid | 48 half-hour count | Wider area (◌) | Reanalysis / Gauge |
| `precipitation_daily_power` | Daily precipitation | `mm/day` | NASA POWER (MERRA-2) | 0.5° × 0.625° | Regional grid | MERRA-2, fill -999 | Wider area (◌) | Reanalysis modeled |
| `monsoon_rainfall_total` | Seasonal monsoon rain | `mm` | POWER / IMERG | 0.1° – 0.5° | Regional grid | $\ge 90\%$ valid days | Wider area (◌) | Reanalysis modeled |
| `dry_season_rainfall` | Post-monsoon rainfall | `mm` | POWER / IMERG | 0.1° – 0.5° | Regional grid | $\ge 90\%$ valid days | Wider area (◌) | Reanalysis modeled |
| `temperature_2m_mean` | Daily mean 2m air temp | `°C` | NASA POWER (MERRA-2) | 0.5° × 0.625° | Regional grid | 24h integration | Wider area (◌) | Reanalysis modeled |
| `temperature_2m_max` | Daily maximum 2m air temp | `°C` | NASA POWER (MERRA-2) | 0.5° × 0.625° | Regional grid | Diurnal peak | Wider area (◌) | Reanalysis modeled |
| `temperature_2m_min` | Daily minimum 2m air temp | `°C` | NASA POWER (MERRA-2) | 0.5° × 0.625° | Regional grid | Diurnal minimum | Wider area (◌) | Reanalysis modeled |
| `premonsoon_heat_days` | Count of days $\ge 35^\circ\text{C}$ | `days` | NASA POWER Daily | 0.5° × 0.625° | Regional grid | Single-day exceedance | Wider area (◌) | Reanalysis modeled |
| `chilling_frost_nights` | Count of nights $\le 12^\circ\text{C}$ | `nights` | NASA POWER Daily | 0.5° × 0.625° | Regional grid | Single-night exceedance| Wider area (◌) | Reanalysis modeled |
| `solar_radiation_allsky` | Solar shortwave irradiance| `MJ/m²/d`| NASA POWER (CERES) | 1.0° × 1.0° | Regional grid | CERES SYN1deg | Wider area (◌) | Reanalysis modeled |
| `reference_et0` | Reference evapotranspiration| `mm/day` | Derived (POWER) | 0.5° × 0.625° | Regional grid | FAO-56 Penman-Monteith | Wider area (◌) | Reanalysis modeled |
| `potential_crop_etc` | Potential crop demand | `mm/day` | Derived ($K_c \cdot ET_0$) | 0.5° × 0.625° | Parcel polygon | FAO-56 Single $K_c$ | Estimated map (▦)| Uncalibrated proxy |
| `climatic_water_deficit`| Atmospheric water gap | `mm/mo` | Derived ($ET_c - P$) | 0.1° – 0.5° | Regional grid | Screening gap only | Wider area (◌) | Uncalibrated proxy |
| `soil_moisture_rootzone_smap` | Root-zone soil wetness | `m³/m³` | SMAP L4 (SPL4SMGP) | 9 km | Catchment grid | Catchment EnKF, fill -9999 | Wider area (◌) | Reanalysis modeled |
| `soil_moisture_surface_smap` | Surface soil moisture (0-5cm)| `m³/m³` | SMAP L4 (SPL4SMGP) | 9 km | Catchment grid | Top 5 cm assimilation | Wider area (◌) | Reanalysis modeled |
| `available_water_capacity` | Available water capacity | `mm/m` | SoilGrids / Saxton-Rawls | 250 m | Parcel polygon | Depth-integrated AWC | Estimated map (▦)| Uncalibrated proxy |
| `soil_texture_class` | USDA texture classification | `class` | ISRIC SoilGrids 2.0 | 250 m | Parcel polygon | Sand/silt/clay ternary | Estimated map (▦)| Uncalibrated proxy |
| `soil_organic_carbon` | Soil organic carbon content | `g/kg` | ISRIC SoilGrids 2.0 | 250 m | Parcel polygon | 0–30 cm weighted mean | Estimated map (▦)| Uncalibrated proxy |
| `soil_ph_acidity` | Soil pH in $H_2O$ | `pH` | ISRIC SoilGrids 2.0 | 250 m | Parcel polygon | 0–30 cm weighted mean | Estimated map (▦)| Uncalibrated proxy |
| `soil_cec` | Cation exchange capacity | `cmol/kg`| ISRIC SoilGrids 2.0 | 250 m | Parcel polygon | 0–30 cm fine-earth | Estimated map (▦)| Uncalibrated proxy |
| `terrain_elevation_srtm` | Ground elevation | `m` | NASA SRTMGL1 | 30 m | Parcel polygon | C-band InSAR, fill -32768 | Your field (▢) | Ground-truth valid |
| `terrain_slope_srtm` | Surface slope gradient | `degrees`| Derived from SRTMGL1 | 30 m | $3 \times 3$ kernel | Horn (1981) median | Your field (▢) | Uncalibrated proxy |
| `surface_water_landsat` | Open standing water extent | `%` | Landsat 8/9 C2 L2 | 30 m | Parcel polygon | QA_PIXEL bit 7, $\ge 50\%$ clear | Your field (▢) | Ground-truth valid |
| `vegetation_ndvi_landsat`| Normalized Diff Veg Index | `[-1, 1]` | Landsat 8/9 C2 L2 | 30 m | Parcel polygon | (NIR-Red)/(NIR+Red) | Your field (▢) | Ground-truth valid |
| `canopy_moisture_ndmi` | Canopy Moisture Index | `[-1, 1]` | Landsat 8/9 C2 L2 | 30 m | Parcel polygon | (NIR-SWIR)/(NIR+SWIR)| Your field (▢) | Ground-truth valid |
| `regional_ndvi_modis` | 16-day composite greenness | `[-1, 1]` | MODIS MOD13Q1.061 | 250 m | Regional grid | MODLAND=0, Rel=0 | Wider area (◌) | Ground-truth valid |
| `lst_ecostress` | Land surface temperature | `°C` | ECOSTRESS LSTE.002 | 70 m | Parcel polygon | TES, mandatory QA=00 | Your field (▢) | Uncalibrated proxy |
| `et_instant_ecostress` | Latent heat flux | `W/m²` | ECOSTRESS JET.002 | 70 m | Parcel polygon | PT-JPL model | Your field (▢) | Uncalibrated proxy |
| `paddy_water_balance` | Standing pond water depth | `mm` | Engine Hydrology | Parcel | Parcel polygon | Mass balance ($P+I-ET-S$)| Estimated map (▦)| Uncalibrated proxy |
| `post_paddy_moisture` | Saturated handover moisture| `mm` | Engine Handover Model | Parcel | Parcel polygon | $k_{\text{pan}}$ drawdown decay | Estimated map (▦)| Uncalibrated proxy |

---

## 5. Missing Data, Fallback Hierarchy & Graceful Degradation Protocol

To maintain data integrity without breaking the user experience during network outages, unconfigured API keys, or satellite cloud contamination, the application follows a strict fallback hierarchy:

```
[Target: Daily Precipitation]
       │
       ▼
   Is GPM IMERG configured & valid (48/48 half-hours)?
       ├── YES ──> Use GPM IMERG V07 (0.1°) [sourceId: "R"]
       └── NO  ──> Fallback to NASA POWER PRECTOTCORR (0.5°) [sourceId: "P"]
                   (Record fallback count in provenance metadata)

[Target: Daily Reference Evapotranspiration (ET0)]
       │
       ▼
   Are Tmax, Tmin, RH2M, WS2M, and Solar Radiation valid?
       ├── YES ──> Compute FAO-56 Penman-Monteith [method: "penman-monteith"]
       └── NO  ──> Are Tmax and Tmin valid?
                     ├── YES ──> Fallback to Hargreaves-Samani [method: "hargreaves"]
                     └── NO  ──> Emit null with status "not_evaluable"

[Target: Soil Physical & Chemical Properties]
       │
       ▼
   Has the farmer entered on-site observations or lab tests?
       ├── YES ──> Use Farmer Override [from: "farmer", quality: "verified"]
       └── NO  ──> Is ISRIC SoilGrids query valid?
                     ├── YES ──> Use SoilGrids 2.0 (250 m) [from: "soilgrids", quality: "uncalibrated"]
                     └── NO  ──> Prompt farmer with Unknown Question [status: "missing_input"]

[Target: Satellite Vegetation & Surface Water]
       │
       ▼
   Is Microsoft Planetary Computer Landsat C2 L2 available?
       ├── YES ──> Clip 30 m COG window, evaluate QA_PIXEL (>=50% clear)
       └── NO  ──> Is NASA AppEEARS HLS configured?
                     ├── YES ──> Use HLSL30 / Fmask 30 m
                     └── NO  ──> Fallback to MODIS MOD13Q1 (250 m regional proxy)
```

---

## 6. Implementation & Compliance Verification

1. **Automated Unit Verification:** Tested in `tests/lib/condition-evidence.test.ts`, `tests/lib/data-truthfulness.test.ts`, and `tests/lib/field-clip.test.ts`.
2. **Space Act Agreement Compliance:** Every number rendered on screen links directly to an `IndicatorExplainer` or `ProvenaceModal` disclosing instrument name, collection DOI, resolution, and physical limitations.
3. **Continuous Auditing:** Run `npx vitest run tests/lib/data-truthfulness.test.ts` to ensure no regression permits false in-situ claims.
