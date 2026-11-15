# Field Shift: Comparing Crop Rotations with NASA Earth Observations

**Scientific Methods and System Design — Research Prototype v3.3**
Technical Appendix: equations, mathematical foundations, assumptions, and dataset specifications included in full below.

*Field Shift is a research prototype. It is not a NASA product, NASA does not endorse it, and its agronomic predictions have not been validated against observed field trials. Its weather inputs have been audited against NOAA GHCN-Daily stations (Section 7 and Technical Appendix Section 12.1).*

---

## 1. Summary

A farmer deciding what to plant next on a field has to weigh several things at once: whether the crops suit the season, how much water they need against how much rain usually falls, what they leave in the soil, and what they might earn. NASA and its partners publish free, global records of rainfall, temperature, soil moisture and vegetation that bear on every one of these questions, but they arrive as gridded rasters that a farmer or adviser cannot use directly.

Field Shift is a browser-based tool that lets a farmer mark a field, record the rotation they grow now, and compare it with at least two defined alternatives. For each option it shows how the crops fit the field's seasons, soil and water, how often the weather of the last ten years would have stressed them, what the rotation does for soil cover and nitrogen, and how the options rank against the farmer's own priorities. Every figure carries its source, resolution and date, and anything the data cannot support is shown as *unknown* instead of being filled in.

It is an aid to a conversation between a farmer and a local adviser. It does not forecast the coming season, predict yield or income, or tell a farmer what to do.

**What is built, and what is not.** The comparison engine and all nine listed environmental data routes are implemented and covered by automated tests (plus empirical weather validation against 10 years of NOAA GHCN-Daily Myanmar stations). GPM IMERG, SMAP, SRTM, HLS and ECOSTRESS still require server-side NASA Earthdata credentials and have not been authenticated against the live archive in the project's verification record. MODIS uses the public Planetary Computer route first and AppEEARS as a fallback. No agronomic yield or soil-probe model has been compared with field trials. Section 5 gives the full status, and Section 6 describes a demonstration that has been designed but not yet run.

---

## 2. The Problem

**Rotation choices are made with limited local evidence.** The choice of the next crop on a field depends on rainfall and its timing, heat during flowering, soil, the water the farmer can reach, the crops grown before it, and what the household needs. Most of the information a farmer uses is memory, a neighbour's experience and a seasonal calendar. These are valuable, and they are also limited to the years and fields the person has seen.

**Existing tools answer a different question.** Weather applications forecast the next days. Crop-advice tools generally describe one crop at a time. Neither compares whole rotations, whose advantages come from combinations: a legume ahead of a cereal, a cover crop that uses water but protects soil, a short crop that fits between rains. NASA's data products are the opposite problem: rich, but expressed as rasters with product names rather than as a statement about a field.

**The gap is translation, and honesty about scale.** A $9\text{ km}$ soil-moisture cell is not a measurement of one field. A $50\text{ km}$ reanalysis grid cannot see a valley. A tool that smooths these into a confident-looking farm-gate number does harm. The harder design problem is to say clearly what each source can and cannot tell a farmer about their field.

*These are working assumptions from the project brief. Interviews with farmers and extension officers have not yet been carried out, and the design should be revised after them.*

**Initial setting.** The crop library and regional calendars cover three regions of Myanmar chosen for the project: Ayeyarwady (rice-based systems with black gram and green gram), Magway (dry-zone sesame, groundnut and pulses) and Shan State (maize, soybean and cover crops on slopes). The crops are research candidates, and species and varieties should be chosen with local advisers before any crop-specific advice is given.

---

## 3. The Proposed Solution

### 3.1 The flow

1. **Field.** The farmer marks a point or outline on a map and confirms it is their field.
2. **Rotation.** They enter the crops they grow now, with planting and harvest dates, fallow periods and residue practice.
3. **Conditions.** The app retrieves weather, rainfall, soil, vegetation and terrain for that location and summarises them as "around your field".
4. **Comparison.** The current rotation is compared with at least two alternatives against the same ten years of weather.
5. **Report.** A plain-language report with the evidence, what is unknown, and what a local check would settle.

### 3.2 What a comparison shows

| For each option | Question it answers |
| --- | --- |
| Fit | Do the crops suit the region's sowing windows, soil pH, texture, drainage and salinity? A decisive missing input gives *unknown*, not a pass |
| Water | In each of the last ten seasons, how much did rain fall short of estimated crop demand? A physically conserved three-zone soil column (seedbed, sub-seedbed, buffer) tracks evaporation, transpiration, dynamic FAO depletion, and post-paddy drainage windows |
| Exposure | In how many of those seasons would heat at flowering, cold shock, acute flowering rain or a long dry spell have occurred in the crop's sensitive stages? |
| Pests & Diseases | Tracks species-level pathogen carryover (e.g., *Rhizoctonia*, *Macrophomina*), alerts on vector green bridges (<30d), enforces vascular wilt return intervals ($n/k \ge 3\text{ yr}$), and evaluates historical weather favourability spells |
| Soil | How much of the cycle has a crop in the field, how many crops fix nitrogen, and what a partial nitrogen budget with residue fate kinetics can and cannot say |
| Terrain | Where slope, low cover and rainy periods coincide, a screening warning for erosion exposure |
| Income | A margin *range* calculated using interval arithmetic from farmer-entered values or verified real-world regional market benchmarks (DOA, Bayintnaung Wholesale, MPBMSMA), with optional FAO-33 / FAO-66 water-limited yield response where calibrated |
| Ranking | A match to the farmer's stated priorities anchored to regional benchmark rotations, with the evidence it could not use listed beside it |

### 3.3 Design commitments

- **Evidence on every claim.** Product, version, resolution, dates, valid-data share and processing version accompany each number.
- **Unknown is not zero.** A missing observation is never replaced by an average or a zero. If the farmer's first priority cannot be evaluated, no winner is named.
- **The farmer's data wins.** A soil test, an irrigation amount or a planting date the farmer enters overrides a gridded estimate, and is shown as theirs.
- **Plain words first.** Answers lead with a sentence; units and indices follow.
- **No forecasts.** The weather of past years is replayed against each option. That describes what happened to each rotation in those years, not what the next season will bring.

---

## 4. The Role of NASA Observations

Each source answers a specific part of the comparison, and its scale decides what the app is allowed to say.

| Key | Source | What it contributes | Scale | How it is used |
| --- | --- | --- | --- | --- |
| P | NASA POWER (MERRA-2, CERES) | Daily temperature, rainfall, humidity, wind and solar radiation | About $50\text{ km}$ | Reference evapotranspiration, growing degree days, heat and frost exposure, dry spells |
| R | NASA GPM IMERG Final | Satellite-based daily rainfall | $0.1^\circ$ ($\approx 11\text{ km}$) | Primary rainfall where it covers the baseline; otherwise POWER, and the two are never blended |
| M | NASA SMAP L4 | Modelled surface and root-zone soil moisture | $9\text{ km}$ | Regional wetness context only; never shown as the field's soil water |
| V | Landsat Collection 2 (and HLS) | Surface reflectance, hence greenness (NDVI) and moisture index | $30\text{ m}$ | Cloud-screened vegetation timeline for the field; flags possible low-cover periods |
| T | NASA SRTM | Elevation, hence slope | About $30\text{ m}$ | Terrain screen for erosion exposure |
| E | NASA ECOSTRESS | Surface temperature, modelled ET | About $70\text{ m}$ | Implemented; Earthdata-gated |
| G | MODIS NDVI | Regional vegetation history | $250\text{ m}$ | Implemented; public primary route |

Soil texture, pH, carbon and water retention come from **ISRIC SoilGrids**, a $250\text{ m}$ model. It is not a NASA product and is labelled as such. Landsat scenes are read through Microsoft's Planetary Computer.

Three rules keep these data honest. Coarse cells are described as *around your field*, never resampled to look precise. Satellite vegetation uses only cloud-free pixels inside the field outline and is withheld for a date when less than a quarter of the field is clear. A greenness value is never presented as bare soil, crop type or soil health.

---

## 5. What Is Implemented

Statuses: **Implemented** (runs in the application and is tested), **Partially implemented** (code exists but needs credentials, a live check or a missing step), **Proposed** (designed, not used). *Validated* means checked against independent observations, and **nothing here is validated.**

| Capability | Status | Note |
| --- | --- | --- |
| NASA POWER weather | Implemented & Audited | Requests 2016 to present; audited against NOAA GHCN-Daily stations (51% Dry Zone rain bias flagged with in-app banner) |
| ISRIC SoilGrids | Implemented | Model estimate; used when the farmer has no soil test |
| Landsat vegetation (Planetary Computer) | Implemented | Checked on live scenes for one test polygon; not compared with ground cover |
| Rotation comparison, water, exposure, ranking | Implemented | 3-zone soil column, dynamic FAO depletion fraction, post-paddy drainage window, species-level pathogen carryover, wilt return intervals, and regional benchmark income anchoring |
| GPM IMERG rainfall | Implemented; connection-gated | CMR discovery, bounded per-cell backfill, completeness checks and POWER fallback are wired and tested; needs `EARTHDATA_TOKEN`; Final V07 ends September 2025 |
| SMAP soil moisture, SRTM slope, HLS vegetation | Implemented; connection-gated | AppEEARS jobs, polling, parsing, QA and provenance are wired and tested; need an Earthdata login |
| MODIS NDVI | Implemented | Public Planetary Computer extraction with AppEEARS fallback; 250 m QA-screened regional history |
| ECOSTRESS | Implemented; connection-gated | Separate LST and ET AppEEARS jobs, cloud/water and conservative LST-QA screening, native-unit summaries and provenance; needs an Earthdata login |
| Economics & Water Response | Implemented with real-world market benchmarks | Interval arithmetic on farmer-entered values or loaded regional commodity benchmarks (DOA, Bayintnaung, MPBMSMA 2024–2026); optional water-stress yield discount via FAO-33 / FAO-66 with strict uncalibrated guards |

When a source is not connected, the app falls back (for rainfall, to POWER) or reports *unknown*, and says so in the report. The appendix (Implementation Status) gives the detail.

---

## 6. A Demonstration, Designed but Not Yet Run

A method that is described but never shown to change a decision is not persuasive. The following demonstration is designed to connect NASA data to a farming decision with real outputs. **It has not been run, and this document contains no demonstration results.** Numbers will be recorded from the application's actual output and will not be illustrative.

**Field.** A real field whose location, crop history and planting dates are known to the person entering them, ideally with a soil test. The farmer's confirmation of the location is recorded.

**Options.** The farmer's current rotation and two defined alternatives (for example from the Ayeyarwady, Magway or Shan templates).

| Step | What is compared | What is recorded |
| --- | --- | --- |
| 1. Baseline | What the crop calendar and the farmer's constraints alone say about each option, before weather data are loaded | Which options fit their sowing windows, soil and constraints |
| 2. NASA data enabled | The same options with POWER (and IMERG, SMAP, Landsat where available) | Change in rainfall shortfall, heat and dry-spell exposure, soil cover; any change in ranking and which input caused it |
| 3. Driest year | The driest of the replayed seasons at this field | Each option's modelled rainfall shortfall in that season against its median |
| 4. Data gaps | A run with a source switched off or missing (for example no Earthdata token) | What becomes *unknown*, which sources the ranking can no longer use, and whether the app declines to name a winner |

For every run the app version, the retrieval date, the product versions and the rainfall source mix (IMERG days, POWER fallback days, missing days) are written down.

| Step | Observed output | Notes |
| --- | --- | --- |
| 1. Baseline | *Not yet recorded* | |
| 2. NASA data enabled | *Not yet recorded* | |
| 3. Driest year | *Not yet recorded* | |
| 4. Data gaps | *Not yet recorded* | |

The demonstration shows what changes in a comparison when evidence is added or removed. It does not show that the recommendation is correct. That requires the validation in Section 7.

---

## 7. Limitations and Validation

**Agronomic yield and soil predictions have not been validated against field trials; input weather data have undergone ground-truth benchmarking.** The automated tests (543 tests across 61 test files) show that formulas are transcribed correctly, that water is conserved in the 2-zone and 3-zone balances to $10^{-9}\text{ mm}$, and that missing inputs stay missing. A dedicated validation harness audited NASA POWER reanalysis against 10 years of NOAA GHCN-Daily records (2015–2024) across 5 Myanmar stations (`docs/validation/WEATHER_VALIDATION.md`). The full table is Section 12 of the appendix. The main points are these.

- **Ten seasons only.** The replay uses $2016\text{–}2025$. Ten seasons are a small sample and carry any climate trend in that period. The comparison of worst-case losses between options (minimax regret) rests on those ten years, and its tail percentile is coarse.
- **Empirical rainfall bias in the Central Dry Zone.** Validation against the Mandalay station reveals NASA POWER `PRECTOTCORR` monthly rainfall is **51% lower** than station observations ($r = 0.48$). Water-balance models will substantially overstate drought stress for rainfed Dry Zone crops. An explicit in-app warning alerts the farmer when viewing fields in this zone.
- **Coastal temperature distortion.** In coastal stations (Sittwe, Kawthaung), $50\text{ km}$ reanalysis cells blend land and marine temperatures, understating daytime highs by up to $3.1^\circ\text{C}$ and overstating nighttime lows by up to $5.0^\circ\text{C}$. Extreme heat and cold shock checks are unreliable in coastal fringes.
- **Rainfall products differ and are not corrected.** POWER and IMERG disagree, and crop water-stress estimates are sensitive to that. Where IMERG is used, days it lacks come from POWER, so a seasonal total can mix products. IMERG Final V07 stops in September 2025, so the last three months of the baseline use POWER.
- **The paddy model is surface-water only.** It tracks ponded water and has no separate store for water in saturated soil, so it is a screening tool for rice, not a paddy soil-plant water model.
- **Nitrogen and erosion are screens.** The nitrogen budget gives enclosure bounds, not a prediction of soil nitrogen. The erosion indicator flags where slope, low cover and rain coincide and is not a soil-loss model.
- **Scoring anchors are grounded assumptions.** Criteria targets and limits are anchored to physical limits or regional typical rotations (e.g. income anchor based on regional benchmark commodity margins, guaranteeing independence of irrelevant alternatives).
- **Greenness is not ground truth.** Landsat NDVI cannot separate bare soil from flooded fields or young crops, and monsoon cloud leaves gaps. Satellite pixels of $30\text{ m}$ are coarse on small fields.
- **Crop rules are partly assumed.** Some thresholds and calendars in the crop library are analyst assumptions, and no cultivar yet has the thermal requirements that would let the app time growth stages from temperature.
- **Income uses entered or benchmark ranges only.** Farmer-entered figures take precedence; real-world benchmarks provide calibrated regional ranges from commodity exchanges (DOA, Bayintnaung, MPBMSMA 2024–2026). Water-stress yield adjustments are applied only when species-calibrated FAO $K_y$ factors exist and baseline yield is not already water-constrained.

**Validation status & roadmap.**
- **Completed:** Empirical audit of NASA POWER vs. NOAA GHCN-Daily Myanmar stations (2015–2024).
- **Proposed next steps:**
  1. **Rainfall:** compare POWER and IMERG seasonal totals with gauge records at sites that have them, and report the difference with each analysis.
  2. **Water stress:** for fields with soil-moisture probes, compare modelled stress days with observed depletion.
  3. **Vegetation:** compare the satellite timeline with dated field photographs on a small set of fields.
  4. **Decisions:** record real rotation comparisons for real fields, with the actual outputs (the demonstration protocol in the whitepaper), and review them with local advisers.
  5. **Use:** test with farmers and extension officers whether the plain-language explanations lead to correct reading of the uncertainty.

---

## 8. Responsible Use and Data Handling

- **Decision support, not decision.** Options are suggestions to discuss with a local adviser. The farmer decides.
- **What stays on the device.** Field records, rotation history, soil tests and priorities are stored in the browser and are not sent to the server.
- **What leaves it.** A field's centroid, or its outline for satellite jobs, is sent to the application's server and on to NASA, ISRIC and Microsoft services; place searches and map tiles go to the map provider. This minimises location disclosure but does not remove it, and a farmer who must not reveal a boundary can use an approximate point.
- **Attribution.** NASA is cited as a data source only. SoilGrids (ISRIC) and Planetary Computer (Microsoft) are not NASA services.

---

## 9. Where to Go Next

The technical appendix holds the equations (reference evapotranspiration, the daily soil water balance and three-zone soil column, the pedotransfer functions, phenology, quality screening, the ranking and regret formulas), the dataset specifications for each source, the provenance contract, and the model limitations table. It also lists what changed in version 3.3. The next steps are, in order: run the demonstration of Section 6 on a real field; obtain Earthdata credentials and retrieve IMERG, SMAP and SRTM end to end; collect soil moisture at planting so the root-zone balance can run; hold interviews with farmers and extension officers; and begin the validation in Section 7.
