# Field Shift: Comparing Crop Rotations with NASA Earth Observations

**Scientific Methods and System Design — Research Prototype v3.1**
Technical Appendix: equations, mathematical foundations, assumptions, and dataset specifications included in full below.

*Field Shift is a research prototype. It is not a NASA product, NASA does not endorse it, and it has not been validated against observed field data. Section 7 says what that means for how it should be used.*

---

## 1. Summary

A farmer deciding what to plant next on a field has to weigh several things at once: whether the crops suit the season, how much water they need against how much rain usually falls, what they leave in the soil, and what they might earn. NASA and its partners publish free, global records of rainfall, temperature, soil moisture and vegetation that bear on every one of these questions, but they arrive as gridded rasters that a farmer or adviser cannot use directly.

Field Shift is a browser-based tool that lets a farmer mark a field, record the rotation they grow now, and compare it with at least two defined alternatives. For each option it shows how the crops fit the field's seasons, soil and water, how often the weather of the last ten years would have stressed them, what the rotation does for soil cover and nitrogen, and how the options rank against the farmer's own priorities. Every figure carries its source, resolution and date, and anything the data cannot support is shown as *unknown* instead of being filled in.

It is an aid to a conversation between a farmer and a local adviser. It does not forecast the coming season, predict yield or income, or tell a farmer what to do.

**What is built, and what is not.** The comparison engine, the weather and soil sources, and the satellite-vegetation route run today and are covered by 260 automated tests. Rainfall from satellite (GPM IMERG), soil moisture (SMAP) and terrain (SRTM) need NASA Earthdata credentials that the project has not yet used end to end. Surface temperature (ECOSTRESS) and MODIS vegetation are not wired in. No model has been compared with field observations. Section 5 gives the full status, and Section 6 describes a demonstration that has been designed but not yet run.

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
| Water | In each of the last ten seasons, how much did rain fall short of estimated crop demand? Where soil inputs exist, a daily soil water balance |
| Exposure | In how many of those seasons would heat at flowering, a long dry spell or heavy rain have occurred in the crop's sensitive stages? |
| Soil | How much of the cycle has a crop in the field, how many crops fix nitrogen, and what a partial nitrogen budget can and cannot say |
| Terrain | Where slope, low cover and rainy periods coincide, a screening warning for erosion exposure |
| Income | A margin *range* calculated using interval arithmetic from farmer-entered values or verified real-world regional market benchmarks (DOA, Bayintnaung Wholesale, MPBMSMA). Weather does not alter yield or price |
| Ranking | A match to the farmer's stated priorities, with the evidence it could not use listed beside it |

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
| E | NASA ECOSTRESS | Surface temperature, modelled ET | About $70\text{ m}$ | Proposed, optional |
| G | MODIS NDVI | Regional vegetation history | $250\text{ m}$ | Proposed, optional |

Soil texture, pH, carbon and water retention come from **ISRIC SoilGrids**, a $250\text{ m}$ model. It is not a NASA product and is labelled as such. Landsat scenes are read through Microsoft's Planetary Computer.

Three rules keep these data honest. Coarse cells are described as *around your field*, never resampled to look precise. Satellite vegetation uses only cloud-free pixels inside the field outline and is withheld for a date when less than a quarter of the field is clear. A greenness value is never presented as bare soil, crop type or soil health.

---

## 5. What Is Implemented

Statuses: **Implemented** (runs in the application and is tested), **Partially implemented** (code exists but needs credentials, a live check or a missing step), **Proposed** (designed, not used). *Validated* means checked against independent observations, and **nothing here is validated.**

| Capability | Status | Note |
| --- | --- | --- |
| NASA POWER weather | Implemented | Requests 2016 to present; not compared with stations |
| ISRIC SoilGrids | Implemented | Model estimate; used when the farmer has no soil test |
| Landsat vegetation (Planetary Computer) | Implemented | Checked on live scenes for one test polygon; not compared with ground cover |
| Rotation comparison, water, exposure, ranking | Implemented | Needs soil moisture at planting for the root-zone balance, which is not yet collected |
| GPM IMERG rainfall | Partially implemented | Needs `EARTHDATA_TOKEN`; no end-to-end retrieval yet; Final V07 ends September 2025 |
| SMAP soil moisture, SRTM slope, HLS vegetation | Partially implemented | Need an Earthdata login for AppEEARS; not run live |
| MODIS NDVI | Proposed | Code exists but nothing calls it |
| ECOSTRESS | Proposed | Screening helper only |
| Economics | Implemented with real-world market benchmarks | Interval arithmetic on farmer-entered values or loaded regional commodity benchmarks (DOA, Bayintnaung, MPBMSMA 2024–2026); no weather-driven yield response |

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

**Nothing has been validated.** The automated tests show that formulas are transcribed correctly, that water is conserved in the balance to $10^{-9}\text{ mm}$, and that missing inputs stay missing. They do not show that the outputs match what happens in a field. A mathematically consistent simulation is not a validated agronomic prediction. The full table is Section 12 of the appendix. The main points are these.

- **Ten seasons only.** The replay uses $2016\text{–}2025$. Ten seasons are a small sample and carry any climate trend in that period. The comparison of worst-case losses between options (minimax regret) rests on those ten years, and its tail percentile is coarse.
- **Rainfall products differ and are not corrected.** POWER and IMERG disagree, and crop water-stress estimates are sensitive to that. Where IMERG is used, days it lacks come from POWER, so a seasonal total can mix products. IMERG Final V07 stops in September 2025, so the last three months of the baseline use POWER.
- **The paddy model is surface-water only.** It tracks ponded water and has no separate store for water in saturated soil, so it is a screening tool for rice, not a paddy soil-plant water model.
- **Nitrogen and erosion are screens.** The nitrogen budget gives enclosure bounds, not a prediction of soil nitrogen. The erosion indicator flags where slope, low cover and rain coincide and is not a soil-loss model.
- **Scoring anchors are assumptions.** The targets and limits that turn criteria into scores are analyst choices, to be reviewed with local experts. A rank is a match to stated priorities, not a forecast.
- **Greenness is not ground truth.** Landsat NDVI cannot separate bare soil from flooded fields or young crops, and monsoon cloud leaves gaps. Satellite pixels of $30\text{ m}$ are coarse on small fields.
- **Crop rules are partly assumed.** Some thresholds and calendars in the crop library are analyst assumptions, and no cultivar yet has the thermal requirements that would let the app time growth stages from temperature.
- **Income uses entered or benchmark ranges only.** Farmer-entered figures take precedence; real-world benchmarks provide calibrated regional ranges from commodity exchanges (DOA, Bayintnaung, MPBMSMA 2024–2026). Weather does not alter yield or price.

**Proposed validation and measurable outcomes.** None of the following has been started, and thresholds for success should be set with local advisers before any is measured.

| Question | Measure | Evidence needed |
| --- | --- | --- |
| Is satellite and reanalysis rainfall close enough to what falls on the field? | Seasonal bias and error of POWER and IMERG against rain gauges | Gauge records near test fields |
| Does modelled water stress match the soil? | Agreement of modelled stress days with probe-measured depletion | Soil-moisture probe time series |
| Does the vegetation timeline match the ground? | Agreement of cloud-free NDVI dates with dated field photographs | Photographs and field notes |
| Is the ranking stable and honest? | Change in ranking when a source is removed; share of runs where the app correctly declines to rank | Repeated runs on the same fields |
| Is it understood? | Whether farmers and advisers can state, after reading a report, what is unknown and what to check locally | Interviews and usability sessions |
| Does it help a decision? | Advisers' judgement of whether a comparison changed or sharpened a conversation | Structured feedback after use |

---

## 8. Responsible Use and Data Handling

- **Decision support, not decision.** Options are suggestions to discuss with a local adviser. The farmer decides.
- **What stays on the device.** Field records, rotation history, soil tests and priorities are stored in the browser and are not sent to the server.
- **What leaves it.** A field's centroid, or its outline for satellite jobs, is sent to the application's server and on to NASA, ISRIC and Microsoft services; place searches and map tiles go to the map provider. This minimises location disclosure but does not remove it, and a farmer who must not reveal a boundary can use an approximate point.
- **Attribution.** NASA is cited as a data source only. SoilGrids (ISRIC) and Planetary Computer (Microsoft) are not NASA services.

---

## 9. Where to Go Next

The technical appendix holds the equations (reference evapotranspiration, the daily soil water balance and two-zone soil column, the pedotransfer functions, phenology, quality screening, the ranking and regret formulas), the dataset specifications for each source, the provenance contract, and the model limitations table. It also lists what changed in version 3.1. The next steps are, in order: run the demonstration of Section 6 on a real field; obtain Earthdata credentials and retrieve IMERG, SMAP and SRTM end to end; collect soil moisture at planting so the root-zone balance can run; hold interviews with farmers and extension officers; and begin the validation in Section 7.
