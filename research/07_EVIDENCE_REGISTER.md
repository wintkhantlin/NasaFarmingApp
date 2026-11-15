# Evidence Register: Ground-Truth Datasets, Benchmarks & Validation Repositories
**Project:** Field Shift — Adapting Farms with NASA Data (NASA Space Apps Challenge 2026)  
**Lead Author:** Agent 7 — Real-World Validation Specialist & Reproducibility Auditor  
**Date:** 2026-11-15  
**Audit Standard:** Independent Empirical Verification & Anti-Leakage Protocol  

---

## 1. Climatological & Surface Weather Ground Truth

### 1.1 NOAA Global Historical Climatology Network - Daily (GHCN-Daily)
- **Data Custodian:** National Oceanic and Atmospheric Administration (NOAA) / National Centers for Environmental Information (NCEI)
- **Access Protocol:** Public FTP / HTTPS ingestion (`https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/`)
- **Spatial Coverage:** 5 synoptic meteorological stations across the Union of Myanmar representing distinct agro-climatic zones:
  1. **Yangon International Airport (`BMM00048097`):** Lat 16.907°N, Lon 96.133°E, Elevation 33.2 m. Agro-ecological zone: Lower Ayeyarwady Delta transition / maritime-coastal edge.
  2. **Mandalay International / Annisaton (`BMM00048042`):** Lat 21.983°N, Lon 96.100°E, Elevation 76.0 m. Agro-ecological zone: Central Dry Zone core (semi-arid lowland).
  3. **Sittwe (`BMM00048062`):** Lat 20.133°N, Lon 92.873°E, Elevation 8.2 m. Agro-ecological zone: Rakhine Coastal maritime corridor (high-monsoon coastal belt).
  4. **Myitkyina (`BMM00048008`):** Lat 25.367°N, Lon 97.400°E, Elevation 147.0 m. Agro-ecological zone: Northern Kachin river valley / montane transition.
  5. **Kawthaung / Victoria Point (`BMM00048112`):** Lat 9.967°N, Lon 98.583°E, Elevation 47.0 m. Agro-ecological zone: Southern Tanintharyi equatorial coastal peninsula.
- **Temporal Window:** 2015-01-01 to 2024-12-31 (10 complete calendar years, 3,652 nominal days per station).
- **Variables Evaluated:**
  - `TMAX`: Maximum daily air temperature at 2 meters (°C, converted from tenths of °C).
  - `TMIN`: Minimum daily air temperature at 2 meters (°C, converted from tenths of °C).
  - `PRCP`: Daily precipitation total (mm, converted from tenths of mm; trace flagged as 0.0 mm).
- **Quality Assurance Protocol:** NCEI automated quality flag filter enforced (`passesQc()`). Measurements flagged for failed consistency, climatological outlier bounds, or internal duplication (`qcRejected`) were discarded prior to pairwise alignment.
- **Primary Repository Reference:** Cached evaluation fixture at `data/validation/power-vs-ghcn.json` and reporting engine at `docs/validation/WEATHER_VALIDATION.md`.

### 1.2 Myanmar Department of Meteorology and Hydrology (DMH) Historical Climatology
- **Data Custodian:** Ministry of Transport and Communications (MOTC), Naypyitaw, Myanmar.
- **Publications & Reference Bulletins:**
  - DMH Annual Monsoon Summaries (2015–2024).
  - Agro-meteorological Bulletins for Ayeyarwady, Bago, and Mandalay Divisions.
  - Climatological Normals of Myanmar (1981–2010 and 1991–2020 baselines).
- **Utility:** Cross-verification of onset/cessation dates of the Southwest Monsoon, pre-monsoon maximum temperature extremes (March–May), and tropical depression tracks.

---

## 2. Hydrological Disasters & Historical Flood Ground Truth

### 2.1 MIMU (Myanmar Information Management Unit) Disaster Archives
- **Data Custodian:** United Nations Country Team (UNCT) Myanmar / OCHA.
- **Reference Repositories:**
  - MIMU Flood Inundation Polygon Archive (2008 Cyclone Nargis, 2015 Cyclone Komen, 2019 Mon State Floods, 2024 Typhoon Yagi / Monsoon Inundations).
  - Township-level Affected Population and Crop Damage Geospatial Databases (`http://themimu.info/`).
- **Benchmark Events:**
  1. **Cyclone Komen & 2015 Southwest Monsoon Floods (July–August 2015):** 
     - Affected: 12 states and regions; >1.4 million hectares inundated; >350,000 hectares of monsoon paddy damaged or destroyed.
     - Focal Townships Audited: Hinthada, Ingapu, Zalun, Kyonpyaw (Ayeyarwady); Kalay (Sagaing); Minbu (Magway).
  2. **Typhoon Yagi Remnants & Flash Floods (September 2024):**
     - Affected: Southern Mandalay (Yamethin, Pyawbwe, Meiktila), Naypyitaw, Bago, and Southern Shan State; >600,000 acres of farmland inundated; catastrophic flash flooding along Samon and Sittaung river basins.

### 2.2 UNOSAT / UNITAR Satellite Disaster Assessments
- **Sensor Base:** Synthetic Aperture Radar (Sentinel-1A/1B C-SAR, ALOS-2 PALSAR-2, TerraSAR-X).
- **Ground-Truth Purpose:** Independent, cloud-penetrating water extent delineations used to audit optical Landsat/HLS `QA_PIXEL` water bitmask reliability during persistent monsoon overcast.

---

## 3. Real-World Myanmar Crop Production, Economics & Agronomy

### 3.1 Department of Agriculture (DOA), MOALI
- **Data Custodian:** Ministry of Agriculture, Livestock and Irrigation, Naypyitaw, Myanmar.
- **Divisions Consulted:**
  - Planning Division: Annual Agricultural Statistics (2020–2024).
  - Land Use Division (LUD): Soil series maps, fertilizer recommendation guidelines.
  - Extension Division: Township crop calendars, recommended sowing windows, varietal durations for Ayeyarwady, Bago, Magway, and Shan State.
- **Verified Agronomic Metrics:**
  - Monsoon Paddy (Swarna-Sub1, Sin Thu Kha, Manawthukha, Ayeyarmin): Sowing June–July, harvest October–December, typical yield 60–90 baskets/acre (3,100–4,700 kg/ha).
  - Black Gram / Matpe (Vigna mungo - Yezin varieties): Sowing October–November (relay into rice stubble), harvest January–March, typical yield 12–18 baskets/acre (950–1,430 kg/ha).
  - Green Gram / Pedisein (Vigna radiata - Khayan Shwe Wah): Sowing October–November or pre-monsoon February–March, yield 12–16 baskets/acre (950–1,270 kg/ha).
  - Samone Black Sesame (Sesamum indicum): Sowing May–June (monsoon) or September (late monsoon), yield 7–12 baskets/acre (420–725 kg/ha).

### 3.2 Bayintnaung Wholesale Commodity Exchange & War Tan Depot (Yangon)
- **Data Custodian:** Bayintnaung Agricultural Products Wholesale Market Committee & Commodity Exchange Centre.
- **Frequency:** Daily/weekly spot price bulletins (2024–2026).
- **Commodity Price Conversions:**
  - Rough Paddy: 2.0M–2.7M MMK / 100 baskets (2,086 kg) = 958–1,294 MMK/kg.
  - Black Gram (FAQ/SQ): 3.5M–3.85M MMK / MT export = 3,500–3,850 MMK/kg.
  - Green Gram (Shwe Wah): 5,500–7,500 MMK / viss (~1.63 kg) = 3,370–4,590 MMK/kg.
  - Samone Black Sesame: 9,500–11,500 MMK / viss = 5,820–7,040 MMK/kg.
  - Groundnut (kernel): 4,500–6,000 MMK / kg; in-shell pod: 3,800–5,500 MMK / viss = 2,330–3,370 MMK/kg.

### 3.3 IFPRI MAPSA (Myanmar Agriculture Policy Support Activity)
- **Data Custodian:** International Food Policy Research Institute (IFPRI) & Michigan State University (MSU).
- **Working Papers & Policy Notes Utilized:**
  - MAPSA Working Paper 45: *Monitoring the Agri-food System in Myanmar: Agricultural Inputs, Mechanization, and Credit* (2023).
  - MAPSA Working Paper 52: *Paddy and Pulses Production Costs and Farm Margins in the Ayeyarwady Delta* (2024).
  - MAPSA Research Note 60: *Post-Conflict Input Price Inflation, Fuel Volatility, and Farm Enterprise Profitability in the Central Dry Zone* (2024).
- **Validation Value:** Rigorous, empirical household survey data providing independent ground truth for post-2022 fertilizer cost inflation, mechanization rental rates (tractor/combine harvester), and labor wages across 1,200+ farming households in Ayeyarwady and the Dry Zone.

### 3.4 World Bank Myanmar Economic Monitor
- **Publications:** Reports from June 2023, December 2023, June 2024, and November 2024.
- **Benchmark Data:** Foreign exchange divergence (official vs parallel market rates), consumer price inflation (food basket CPI), and trade policy restrictions on pulse exports to India.

---

## 4. Pedological Ground Truth & Soil Classification

### 4.1 Land Use Division (LUD) Soil Classification System (Rozanov 1957; LUD 2004)
- **Data Custodian:** Department of Agriculture, Myanmar.
- **Reference Monographs:**
  - *The Soils of Burma* (Rozanov, 1957).
  - *Soil Classification of Myanmar* (Land Use Division, 2004).
- **Key Reference Soil Series & Local Classifications:**
  1. **Meadow & Meadow Alluvial Soils (Fluvisols / Gleysols):** Lower Ayeyarwady Delta (Pathein, Myaungmya, Maubin, Pyapon). Deep, poorly drained, heavy clay (>40–60% clay), pH 5.0–6.5.
  2. **Coastal Saline & Acid Sulfate Soils (Sulfaquepts / Thionic Fluvisols):** Coastal Ayeyarwady and Rakhine estuaries (Pyapon, Bogale, Labutta). Marine alluvial deposition, potential acidity with jarosite/pyrite oxidation dropping pH to 3.8–4.8 during dry-season aeration; dry-season electrical conductivity $EC_e > 4.0\text{--}12.0\text{ dS/m}$.
  3. **Black Soils / Meadow Alluvial Black (Vertisols):** Lowland Central Dry Zone (Mandalay, Meiktila, Yamethin, Minbu, Monywa). Heavy smectitic clay (>45–65% clay), high shrink-swell potential, deep vertical cracking during drought, alkaline pH 7.5–8.5, free calcium carbonate concretions ($CaCO_3$).
  4. **Red-Brown Savanna & Yellow-Brown Dry Forest Soils (Luvisols / Arenosols):** Undulating uplands of Magway, Pakokku, Myingyan. Coarse sandy loams and loamy sands (>60–80% sand, <15% clay), weakly structured, bulk density $>1.50\text{ g/cm}^3$, neutral to slightly acidic pH 6.0–6.8, low cation exchange capacity ($CEC < 10\text{ cmol/kg}$), highly susceptible to rainstorm water erosion.
  5. **Red Earths & Yellow Earths (Ferralsols / Acrisols / Nitisols):** Shan Plateau (Taunggyi, Kalaw, Aungban, Heho). Formed on weathered limestone and upland sedimentary formations. Deep kaolinitic clays, strongly acidic pH 4.5–5.5, high aluminum saturation, acute available phosphorus deficiency ($P$-fixation).

### 4.2 ACIAR Project Reports on Soil Health in Myanmar
- **Reference Bulletins:**
  - ACIAR Project SMCN/2014/044: *Improving the Productivity and Profitability of Pulse Production in the Central Dry Zone and Ayeyarwady Delta of Myanmar* (Bell, Johnston, et al., 2018).
  - ACIAR Project LWR/2014/075: *Groundwater Resource Assessment in the Central Dry Zone* (2019).
- **Soil Survey Data:** Direct laboratory analyses of 350+ core samples measuring mechanical texture, SOC, pH, and nutrient profiles across Ayeyarwady Delta polders and Dry Zone pulse farms.

---

## 5. Physical & Agronomic Modeling Standards

### 5.1 FAO Irrigation and Drainage Paper 56 (FAO-56)
- **Standard:** Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998). *Crop evapotranspiration - Guidelines for computing crop water requirements*. FAO, Rome.
- **Reference Equations:**
  - Penman-Monteith equation (Eq. 6).
  - Hargreaves-Samani temperature-based fallback (Eq. 52).
  - Single crop coefficients ($K_c$) for 13 field crops across establishment, vegetative, mid-season flowering, and late-season ripening stages (Tables 11 and 12).
  - Base depletion fraction ($p_{base}$) and dynamic water stress adjustment (Eq. 84, Table 22).

### 5.2 FAO ECOCROP Database
- **Custodian:** Food and Agriculture Organization of the United Nations.
- **Reference Sheets:** Ecocrop Datasheets 1891 (Oryza sativa), 2145 (Vigna radiata), 2146 (Vigna mungo), 1968 (Sesamum indicum), 353 (Arachis hypogaea), 488 (Cicer arietinum), 464 (Cajanus cajan), 2212 (Zea mays), 1146 (Glycine max), 1334 (Lablab purpureus), 8234 (Crotalaria juncea).
- **Parameters:** Absolute and optimal temperature thresholds ($T_{absMin}, T_{optMin}, T_{optMax}, T_{absMax}$), soil pH envelopes ($pH_{absMin}, pH_{optMin}, pH_{optMax}, pH_{absMax}$), and annual rainfall limits.

---

## 6. Audit Sign-Off

The evidence registered above constitutes the sole independent basis against which all scientific claims, satellite datasets, reanalysis engines, and economic models within Field Shift are evaluated. No synthetic data, unverified model outputs, or self-referential satellite products are admitted as ground truth.
