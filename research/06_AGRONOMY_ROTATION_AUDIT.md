# Scientific Agronomy & Rotation Audit: Myanmar Cropping Systems, Calendars, and Constraints
**Project:** Green Ally Project — Adapting Farms with NASA Data (NASA Space Apps Challenge 2026)  
**Research Specialist:** Agent 6 — Agronomy & Rotation Researcher  
**Date:** 2026-11-15  
**Target Document:** `research/06_AGRONOMY_ROTATION_AUDIT.md`  
**Status:** Complete Agronomical & Systemic Codebase Audit  

---

## 1. Executive Summary & Audit Scope

This report provides a comprehensive agronomic audit of cropping systems, crop calendar realism, rotation dynamics, and feasibility constraints across Myanmar's primary agro-ecological zones: the **Ayeyarwady Delta (Lower Myanmar)**, the **Central Dry Zone (Magway/Mandalay/Sagaing)**, and the **Shan Highlands**.

Green Ally Project is designed to assist smallholders and agricultural extension agents in transitioning from vulnerable monocultures (or climate-sensitive sequences) to diversified, resilient crop rotations. Because multi-criteria decision analysis (MCDA) and economic models depend strictly on the validity of underlying agronomic rules, any flaw in sowing dates, crop cycles, biological nitrogen fixation (BNF) accounting, or stress thresholds propagates into flawed decision advice.

### Key Audit Findings
1. **Calendar Realism & Variety Duration Gap:** The codebase represents crop growth cycles predominantly at the species level using global FAO ECOCROP ranges (e.g., maize listed as 65–365 days; sesame as 40–180 days; black gram as 60–130 days). In Myanmar practice, farmers cultivate specific cultivars with tightly adapted photoperiod and thermal requirements (e.g., *Yezin-3* black gram: 80–85 days; *Sin Shwe Pyaung* sorghum: 110–120 days). Without variety-specific duration overrides, multi-crop sequence planning cannot guarantee field turnaround feasibility.
2. **Missing Essential Commercial Crop:** **Sunflower (*Helianthus annuus* / Pan-hnan)** is cited in `lib/engine/economics.ts` (FAO-33 $K_y = 0.95$) and pest rules, but is **entirely missing** from the primary Myanmar crop library (`lib/data/crops/myanmar.ts`). Sunflower is a vital winter/spring cash oilseed in both the Central Dry Zone and Delta post-rice systems.
3. **Paddy-to-Upland Transition Physics:** The relay broadcasting (*Phaung-tin*) of pulses (black gram, green gram) into ripening paddy or immediately following drainage represents over 75% of Delta pulse production. The current codebase flags overlapping dates as an unverified model (`overlapUnverified` gate in `lib/engine/compare.ts`), correctly barring uncalibrated dual-crop evapotranspiration but inadvertently flagging standard Myanmar relay establishment.
4. **Waterlogging Intolerance Asymmetry:** While paddy rice requires inundation ($5/5$ tolerance), early monsoon sesame (*Sesamum indicum*) exhibits extreme susceptibility to root asphyxiation ($1/5$ tolerance). A single 24–48 hour ponding event during the vegetative stage causes irreversible root cortex death and up to 100% crop loss. Groundnut pegging and pod development are similarly devastated by waterlogging.
5. **Biological Nitrogen Fixation (BNF) Net Balance:** In `lib/data/crops/myanmar.ts`, legumes are credited with 20–120 kg N/ha biological fixation. However, when grain legumes (black gram, chickpea, pigeon pea) are harvested for grain, approximately 70–80% of total plant nitrogen is translocated to the seed ($3.2\%\text{–}4.0\%$ N) and exported off the farm. Net soil nitrogen addition from grain legumes is modest (+5 to +25 kg N/ha) unless vegetative stover is fully retained, whereas dedicated green manures (*Crotalaria juncea* / Sunn hemp) supply +80 to +180 kg N/ha net.

---

## 2. In-Depth Audit of Myanmar Cropping Systems & Crop Calendars

Myanmar spans tropical coastal lowlands, arid central plains, and temperate highland plateaus. Below is the systematic evaluation of the 10 major crops and their rotational interactions.

```
       TYPICAL MYANMAR CROPPING CALENDARS ACROSS AGRO-ECOLOGICAL ZONES
Month:  JAN   FEB   MAR   APR   MAY   JUN   JUL   AUG   SEP   OCT   NOV   DEC
       ───   ───   ───   ───   ───   ───   ───   ───   ───   ───   ───   ───
DELTA (Ayeyarwady / Bago):
Monsoon Rice:                       [===== Sowing/Transplant =====][Harvest]
Post-Monsoon Pulse (Black/Green Gram):                              [==== Sowing ====][Harvest]
Summer Rice (Irrigated Only): [==== Sowing/Transplant ====][Harvest]

CENTRAL DRY ZONE (Magway / Mandalay):
Early Sesame (Hnan-yin):           [== Sowing ==][Harvest]
Late Sesame (Hnan-gyi):                                  [== Sowing ==][Harvest]
Monsoon Groundnut:                 [=== Sowing ===][Harvest]
Post-Monsoon Chickpea (Vertisols):                                  [== Sowing ==][Harvest]
Pigeon Pea (Long Duration):        [======== Sowing ========]......................[Harvest]

SHAN HIGHLANDS:
Highland Maize:                    [==== Sowing ====][Harvest]
Soybean:                           [==== Sowing ====][Harvest]
Cover (Lablab / Sunn Hemp):                                   [==== Sowing ====][Incorp]
```

---

### 2.1 Monsoon Paddy Rice (*Oryza sativa* — မိုးစပါး)
- **Scientific Profile:** Poaceae family, $C_3$ wetland cereal.
- **Current Codebase Implementation (`lib/data/crops/myanmar.ts`):**
  - Cycle: $[100, 135, 160]$ days (Typical: 135 days). GDD: Base $10^\circ\text{C}$, 2,000 to maturity.
  - Temperature: Absolute $[10, 36]^\circ\text{C}$, Optimal $[20, 30]^\circ\text{C}$, Flowering heat limit: $35^\circ\text{C}$, Cold limit: $15^\circ\text{C}$.
  - Water: Seasonal requirement $[700, 1100, 1800]\text{ mm}$. Drought tolerance: $1/5$, Waterlogging tolerance: $5/5$.
  - Crop coefficients ($K_c$): Initial $1.05$, Mid $1.20$, Late $0.75$ (FAO-56 Table 12).
  - Regional Calendars:
    - Ayeyarwady: Sowing `06-01` to `07-31`, duration 120–160 days.
    - Magway: Sowing `06-15` to `08-15`, duration 110–150 days.
- **Agronomic Ground-Truth Audit:**
  - *Delta Realities:* Wet direct-seeded rice (DSR) or transplanted paddy (*kauk-gyi* / *paw-san*) is sown in June–July with the arrival of the Southwest Monsoon and harvested in late October to late November. Standing water ($100\text{–}300\text{ mm}$) is impounded by earthen field bunds (*kazins*).
  - *Varietal Variation:* Photoperiod-sensitive traditional varieties (*Paw San Hmwe*) require 145–160 days and flower strictly under short autumn days regardless of planting date. Modern high-yielding varieties (HYVs such as *Manawhari*, *Sin Thwel Lat*, *Thee Htet Yin*) mature in 115–130 days.
  - *Thermal & Water Risks:* Flood submergence during the seedling establishment stage ($> 7\text{ days}$ under muddy water) causes total mortality unless sub1-tolerant cultivars are used. High temperature ($> 35^\circ\text{C}$) during anthesis causes pollen desiccation and spikelet sterility.

---

### 2.2 Summer / Dry-Season Rice (*Oryza sativa* — နွေစပါး)
- **Scientific Profile:** Irrigated lowland paddy grown during the arid, cloud-free pre-monsoon season.
- **Current Codebase Implementation:**
  - Implemented in `candidates.ts` via template `ay-rice-irrigated-rice`, overriding the calendar:
    - Sowing: `01-15` to `02-28`, duration 105–125 days.
    - Flagged with `requiresIrrigation: true`.
- **Agronomic Ground-Truth Audit:**
  - *Hard Irrigation Dependency:* Summer rice coincides with peak evaporative demand ($ET_0$ reaches $6.0\text{–}7.5\text{ mm/day}$ in March–April). Ambient rainfall during this window is $< 50\text{ mm}$. The crop requires $1,100\text{–}1,400\text{ mm}$ of delivered irrigation water.
  - *Failure Mode:* If a smallholder without access to governmental canal systems, river pumping projects, or deep tubewells attempts dry-season rice, the failure rate is $100\%$. The hard feasibility gate in `lib/engine/farmer-decision.ts` correctly blocks this candidate when `availableWater === "rainfed"`.
  - *Chilling vs Heat Stress:* Seedlings germinating in late January frequently face cool nights ($T_{\min} < 15^\circ\text{C}$), which causes yellowing and stunted tillering, while flowering in late April faces extreme heat ($T_{\max} > 38^\circ\text{C}$).

---

### 2.3 Black Gram (*Vigna mungo* — မတ်ပဲ / Matpe)
- **Scientific Profile:** Fabaceae family, erect/sub-erect annual grain legume.
- **Current Codebase Implementation (`lib/data/crops/myanmar.ts`):**
  - Cycle: $[60, 90, 130]$ days. Optimal temperature $[22, 35]^\circ\text{C}$, Absolute $[8, 40]^\circ\text{C}$, Heat limit flowering: $38^\circ\text{C}$.
  - Sowing window: Ayeyarwady `10-20` to `12-20` (duration 60–100 days); Magway `08-15` to `10-15` (duration 65–100 days).
  - Water: Seasonal requirement $[250, 350, 600]\text{ mm}$. Drought tolerance $3/5$, Waterlogging tolerance $2/5$. Depletion fraction $p = 0.45$.
  - Biological Nitrogen Fixation: $[20, 60]\text{ kg N/ha}$, $N$ demand: $30\text{ kg N/ha}$, Residue $2.0\text{ t/ha}$ (C:N 25).
- **Agronomic Ground-Truth Audit:**
  - *Post-Paddy Residual Moisture Niche:* Black gram is the foundational cash legume of the Ayeyarwady Delta, grown on over 1 million hectares. It is predominantly sown without prior tillage directly into moist soil or broadcast into standing rice 3–7 days prior to harvest.
  - *Rooting & Moisture Profile:* Its deep taproot ($0.7\text{–}1.0\text{ m}$) extracts receding capillary water from the saturated heavy delta clay. It receives zero irrigation and minimal dry-season rain ($20\text{–}60\text{ mm}$).
  - *Vulnerability Gate:* Black gram is acutely sensitive to waterlogging at emergence. Heavy unseasonal late monsoon showers (November cyclonic depressions from the Bay of Bengal delivering $> 50\text{ mm}$) submerge the clay seedbed, causing seedling rot and damping-off. Conversely, if sowing is delayed past December 20, soil surface moisture dries out, nodulation fails, and the crop suffers severe terminal moisture stress.

---

### 2.4 Green Gram / Mung Bean (*Vigna radiata* — ပဲတီစိမ်း / Pedisein)
- **Scientific Profile:** Fabaceae family, fast-maturing grain legume.
- **Current Codebase Implementation (`lib/data/crops/myanmar.ts`):**
  - Cycle: $[50, 75, 120]$ days. Optimal temperature $[21, 36]^\circ\text{C}$, Absolute $[8, 40]^\circ\text{C}$.
  - Sowing window: Ayeyarwady `10-20` to `01-15` (duration 55–90 days); Magway `08-15` to `10-31` (duration 55–90 days).
  - Water: Seasonal requirement $[250, 350, 550]\text{ mm}$. Drought tolerance $3/5$, Waterlogging tolerance $2/5$.
  - Biological Nitrogen Fixation: $[30, 70]\text{ kg N/ha}$, $N$ demand: $30\text{ kg N/ha}$, Residue $1.8\text{ t/ha}$ (C:N 24).
- **Agronomic Ground-Truth Audit:**
  - *Shorter Cycle Advantage:* Maturing in 65–75 days (*Yezin-14*, *Shwe Wah* varieties), green gram requires 15–20 fewer days than black gram, allowing it to escape terminal drought when planted late in the post-monsoon window.
  - *Multiple Pickings:* Pods mature sequentially; farmers often harvest two to three pickings, requiring intensive manual labour during January–February.
  - *Economics:* Quality export-grade green gram (special clean grade for European or East Asian noodle/sprout markets) commands wholesale prices up to 4,500 MMK/kg, generating higher net unit margins than black gram.

---

### 2.5 Sesame (*Sesamum indicum* — နှမ်း / Hnan)
- **Scientific Profile:** Pedaliaceae family, ancient drought-adapted oilseed.
- **Current Codebase Implementation (`lib/data/crops/myanmar.ts`):**
  - Cycle: $[80, 100, 130]$ days. Optimal temperature $[24, 32]^\circ\text{C}$, Absolute $[10, 40]^\circ\text{C}$.
  - Sowing window: Magway `05-01` to `08-15` (duration 80–120 days). No Ayeyarwady calendar.
  - Water: Seasonal $[300, 450, 700]\text{ mm}$. Drought tolerance $4/5$, Waterlogging tolerance $1/5$.
  - Depletion fraction $p = 0.60$. Preferred textures: Loam and sandy loams. Drainage: "good", "excessive".
- **Agronomic Ground-Truth Audit:**
  - *Dry Zone Primacy:* The Central Dry Zone (Magway, Mandalay, Sagaing) produces $> 85\%$ of Myanmar's sesame. Two distinct seasons exist:
    - Early Sesame (*Hnan-yin*): Sown in May with early convective pre-monsoon showers; harvested in July–August.
    - Late Sesame (*Hnan-gyi*): Sown in August–September; harvested in November–December.
  - *The Waterlogging Red Line:* Sesame has no aerenchyma tissue in its root system. Soil saturation for $> 24\text{ hours}$ leads to immediate hypoxic root rot, leaf epinasty, and plant collapse. It must never be planted on poorly drained alluvial clay flats or low-lying paddy basins.
  - *Phytophthora & Macrophomina:* Heavy rains followed by intense heat trigger devastating stem rot (*Phytophthora nicotianae*) and charcoal rot (*Macrophomina phaseolina*).

---

### 2.6 Groundnut / Peanut (*Arachis hypogaea* — မြေပဲ)
- **Scientific Profile:** Fabaceae family, geocarpic oilseed and food legume.
- **Current Codebase Implementation (`lib/data/crops/myanmar.ts`):**
  - Cycle: $[90, 115, 140]$ days. Optimal temperature $[22, 32]^\circ\text{C}$, Absolute $[10, 38]^\circ\text{C}$.
  - Sowing window: Magway `05-15` to `07-15` (duration 100–130 days); Shan `05-15` to `07-15`.
  - Water: Seasonal $[350, 500, 700]\text{ mm}$. Drought tolerance $4/5$, Waterlogging tolerance $1/5$.
  - Biological Nitrogen Fixation: $[40, 120]\text{ kg N/ha}$, $N$ demand: $40\text{ kg N/ha}$, Residue $2.8\text{ t/ha}$ (C:N 25).
- **Agronomic Ground-Truth Audit:**
  - *Soil Texture Constraints:* Groundnut pegs must penetrate the upper 5–8 cm of soil to form subterranean pods. Heavy clay soils cause mechanical resistance to peg entry and pod loss at harvest. Sandy loam, loamy sand, and light alluvial friable soils are strictly necessary.
  - *Rainfed Dry Zone Performance:* Groundnut is more resilient than sesame to mid-season dry spells because its flowering period is extended over 30–45 days. However, soil moisture must be adequate during pegging and pod filling (60–90 days after sowing).

---

### 2.7 Sunflower (*Helianthus annuus* — နေကြာ / Pan-hnan)
- **Scientific Profile:** Asteraceae family, deep-rooting $C_3$ oilseed.
- **Current Codebase Implementation Audit:**
  - **DEFICIENCY:** Sunflower is listed in `lib/engine/economics.ts` ($K_y = 0.95$) and `lib/engine/pest.ts`, but has **NO entry in `lib/data/crops/myanmar.ts` or `MYANMAR_CROPS`**.
- **Agronomic Ground-Truth Audit:**
  - *Agro-Ecological Role in Myanmar:* Sunflower is cultivated on approximately 500,000 hectares across Myanmar as a winter/cold-season oilseed. In the Ayeyarwady Delta and Bago Region, it is sown in November–December following monsoon rice on residual soil moisture. In the Central Dry Zone, it serves as a late-rain or winter crop.
  - *Physiological Traits:* Deep taproot system ($1.5\text{–}2.0\text{ m}$), water requirement $350\text{–}500\text{ mm}$, base temperature $6^\circ\text{C}$, optimal $20\text{–}28^\circ\text{C}$, drought tolerance $4/5$, waterlogging tolerance $2/5$. It is a valuable break crop that interrupts pulse root disease cycles.
  - *Recommendation:* Sunflower must be formally added to `MYANMAR_CROPS` with regional calendars for Ayeyarwady (`11-15` to `12-31`) and Magway (`09-01` to `10-15`).

---

### 2.8 Chickpea (*Cicer arietinum* — ကုလားပဲ / Kalape)
- **Scientific Profile:** Fabaceae family, cool-season grain legume.
- **Current Codebase Implementation (`lib/data/crops/myanmar.ts`):**
  - Cycle: $[90, 105, 125]$ days. Optimal temperature $[15, 28]^\circ\text{C}$, Absolute $[5, 35]^\circ\text{C}$, Cold limit: $8^\circ\text{C}$.
  - Sowing window: Magway `10-15` to `11-30` (duration 90–120 days).
  - Water: Seasonal $[200, 300, 450]\text{ mm}$. Drought tolerance $4/5$, Waterlogging tolerance $1/5$.
- **Agronomic Ground-Truth Audit:**
  - *Vertisol Stored-Moisture Cropping:* Chickpea in Central Myanmar is grown almost exclusively on heavy, montmorillonite-rich black cracking clay soils (*Sane* soils / Vertisols) in river valleys (Mandalay, Monywa, Minbu). It is sown post-monsoon in October–November after flood recession.
  - *Temperature Constraints:* Chickpea requires cool vegetative temperatures ($15\text{–}22^\circ\text{C}$). If temperatures exceed $32^\circ\text{C}$ during early flowering, extensive flower drop occurs. In late February, pod borer (*Helicoverpa armigera*) and rising temperatures rapidly terminate the crop.

---

### 2.9 Pigeon Pea (*Cajanus cajan* — ပဲစင်းငုံ / Pesingon)
- **Scientific Profile:** Fabaceae family, long-duration semi-perennial shrub grown as an annual.
- **Current Codebase Implementation (`lib/data/crops/myanmar.ts`):**
  - Cycle: $[120, 160, 240]$ days. Optimal temperature $[20, 32]^\circ\text{C}$, Absolute $[10, 40]^\circ\text{C}$.
  - Sowing window: Magway `06-01` to `08-15` (duration 140–220 days).
  - Water: Seasonal $[400, 600, 900]\text{ mm}$. Drought tolerance $4/5$, Waterlogging tolerance $2/5$.
  - Biological Nitrogen Fixation: $[40, 100]\text{ kg N/ha}$, Residue $4.0\text{ t/ha}$ (C:N 40).
- **Agronomic Ground-Truth Audit:**
  - *Intercropping System:* In the Central Dry Zone, pigeon pea is rarely grown as a sole crop; it is intercropped with early sesame, green gram, or groundnut at a $1:3$ to $1:5$ row ratio. The companion crop is harvested in August–September, while the pigeon pea continues growing through the dry winter on subsoil moisture extracted from depths down to $2.0\text{ m}$, finally harvesting in January–February.
  - *Export Market Dependency:* Red pigeon pea is heavily geared toward export to India for *toor dal*. Farmgate prices are highly sensitive to Indian import tariff quotas and monsoon rainfall in Maharashtra and Karnataka.

---

### 2.10 Maize (*Zea mays* — ပြောင်းဖူး / Pyaung)
- **Scientific Profile:** Poaceae family, $C_4$ cross-pollinated annual cereal.
- **Current Codebase Implementation (`lib/data/crops/myanmar.ts`):**
  - Cycle: $[90, 120, 150]$ days. Optimal temperature $[18, 32]^\circ\text{C}$, Absolute $[8, 38]^\circ\text{C}$.
  - Sowing window: Shan `04-15` to `06-30` (duration 100–150 days).
  - Water: Seasonal $[450, 650, 900]\text{ mm}$. Drought tolerance $2/5$, Waterlogging tolerance $2/5$.
  - Nitrogen Demand: $160\text{ kg N/ha}$ (highest in the library).
- **Agronomic Ground-Truth Audit:**
  - *Highland Cash Engine:* Maize expansion in Southern and Northern Shan State represents the primary driver of commercial upland agriculture and deforestation. Grown for poultry feed export (primarily to China and Thailand).
  - *Soil Depletion & Erosion:* Maize is an exhaustive crop ($160\text{ kg N/ha}$ demand). On steep rolling slopes ($> 15^\circ$), wide-row maize cultivation without vegetative contour strips or legume cover generates massive soil erosion ($30\text{–}80\text{ t/ha/yr}$) during heavy June storms.

---

### 2.11 Fallow Management (အနားပေးမြေ)
- **Current Codebase Implementation (`lib/rotation/engine.ts`):**
  - Modeled as an explicit sequence option `fallow`.
  - Distinguishes `bare` vs `vegetated` fallow.
- **Agronomic Ground-Truth Audit:**
  - *Bare Fallow Hazard:* Leaving land uncultivated and tilled bare during the dry season exposes the soil to wind deflation, accelerated organic carbon oxidation under intense tropical solar radiation, and weed proliferation.
  - *Vegetated/Covered Fallow:* Retaining crop residues or managing volunteer vegetation provides critical surface mulch that conserves subsoil moisture, reduces soil surface temperature by $8\text{–}12^\circ\text{C}$, and protects soil aggregates from raindrop impact when the subsequent monsoon begins.

---

## 3. Systematic Codebase Evaluation & Diagnostic Trace

### 3.1 `lib/data/crops/myanmar.ts` & `reference.ts`
- **Scope Labeling:** Every parameter is carefully labeled with a `RuleScope`:
  - `"ecocrop-reference"`: Species-level data from FAO ECOCROP.
  - `"fao56"`: Irrigation and Drainage Paper 56 Tables 11 & 12.
  - `"analyst-assumption"`: Starting agronomic heuristics.
- **Variety Validation Gate:** `profile.varietyValidated` is set to `false` for every crop in `myanmar.ts`. This correctly blocks the UI from displaying misleading badges like *"Fits more dry seasons"* (see `compare.ts:488`), adhering strictly to scientific truthfulness.
- **Identified Gap:** The sowing windows in `calendars` are single static month-day intervals (e.g., Ayeyarwady black gram: `10-20` to `12-20`). In reality, monsoon withdrawal dates vary by $\pm 3\text{ weeks}$ annually. Sowing dates should dynamically couple to the detected end of monsoon rains.

### 3.2 `lib/data/crops/real-world-economics.ts`
- **Authenticity of Economic Benchmarks:** The table uses 2024–2026 farmgate and wholesale commodity depot prices in Myanmar Kyats per kilogram (MMK/kg), grounded in Bayintnaung Wholesale Commodity Exchange, War Tan Rice Depot, and MPBMSMA reports.
- **Conversion Authenticity:**
  - $1\text{ viss} = 1.63293\text{ kg}$.
  - $1\text{ basket rough paddy} = 46\text{ lbs} = 20.86\text{ kg}$ ($100\text{ baskets} = 2,086\text{ kg}$).
  - $1\text{ basket pulses} = 72\text{ lbs} = 31.75\text{ kg}$.
  - $1\text{ basket sesame} = 54\text{ lbs} = 24.5\text{ kg}$.
- **Cost Realism:** Production costs account for massive post-2021 fuel and fertilizer price inflation (urea prices rising from ~35,000 MMK/bag in 2020 to >120,000–160,000 MMK/bag in 2024–2026; diesel pump costs rising to >3,000 MMK/litre).

### 3.3 `lib/rotation/engine.ts`
- **ECOCROP Enveloping Logic:** Screens candidates against absolute and optimal temperature and soil pH boundaries.
- **Provable Limitation:** Temperature screening averages monthly mean temperatures. However, crop heat stress is driven by **acute daily maximums during anthesis** (e.g., 3 consecutive days with $T_{\max} \ge 38^\circ\text{C}$ causing flower abortion in black gram), not monthly mean temperatures. A monthly average of $29^\circ\text{C}$ can easily conceal 6 peak heatwave days of $40^\circ\text{C}$.

### 3.4 `lib/engine/limits.ts` & `farmer-decision.ts`
- **Hard Feasibility Gates (D-01):** Evaluates 5 farmer boundary constraints: `water`, `market`, `household`, `labour`, and `land`.
- **Precedence Logic:**
  - If a crop is planned as irrigated, but `farmer.availableWater === "rainfed"`, the engine issues a hard exclusion (`WATER_UNAVAILABLE`). High economic profit is strictly prevented from overriding this constraint.
  - If the farmer answers `unknown` to water access, the status becomes `needs_review` rather than `infeasible` or a blind `pass`.

### 3.5 `lib/engine/suitability.ts`
- **Range Fit Algorithm:** Evaluates each check as `preferred`, `tolerated`, `outside`, or `unknown`.
- **Soil pH Decisive Check:** If measured soil pH is outside the crop's absolute tolerance, it is decisively marked `outside`. If soil pH is unmeasured, it marks `unknown` and cites SoilGrids 250m gridded data as supporting evidence without asserting field truth.

### 3.6 `lib/engine/economics.ts`
- **FAO-33 Water-Yield Response Implementation:**
  $$\phi = \max\left(0, 1 - K_y \times \left(1 - \frac{ET_a}{ET_m}\right)\right)$$
  $$Y_{\text{adj}} = Y_{\text{base}} \times \phi$$
- **Rigorous Ky Sourcing:** Restricts $K_y$ to calibrated species from FAO Irrigation and Drainage Paper 33 (e.g., Rice $1.0$, Maize $1.25$, Groundnut $0.70$, Sunflower $0.95$). Uncalibrated species are not assigned fabricated numbers; they report water stress as an unquantified physical risk.
- **Break-Even Viability:** Evaluates break-even yield as $\text{FixedCosts} / (\text{Price} - \text{VariableCostPerKg})$. If unit price $\le$ variable harvesting cost, it correctly returns `viable: false` without dividing by zero or clamping to 1.

### 3.7 `lib/engine/mcda.ts` & The Anchor Utility Bottleneck
- **Rank-Sum Multi-Criteria Scoring:**
  $$S(R) = \sum_{i} w_i \cdot s_i(R)$$
- **Utility Anchors:** Criteria utilize fixed anchors (target and limit).
- **CRITICAL ARCHITECTURAL FINDING:** For `water-shortfall`, the anchor is defined as:
  ```typescript
  { id: "water-shortfall", target: 0, limit: 400, direction: "lower" }
  ```
  Formula for lower-is-better:
  $$u = \max\left(0, \min\left(1, \frac{400 - \text{shortfall}}{400 - 0}\right)\right)$$
  - When annual multi-crop sequences in the Central Dry Zone or drought-affected Delta accumulate $> 400\text{ mm}$ of cumulative water deficit, **utility saturates at zero ($u = 0.0$) across all competing options**.
  - As a result, the water criterion provides **zero differential score**, causing the multi-criteria ranking to default entirely to economic gross margin and legume share. This explains why NASA water data appears to have no impact on ranking in high-shortfall environments unless anchors are regionally calibrated.

---

## 4. Legume Rotation Impacts & Biological Nitrogen Dynamics

Legume integration is a cornerstone of sustainable crop rotation in Myanmar. Below is the quantitative breakdown of biological nitrogen fixation, disease breaking, and structural impacts.

| Crop Species | Functional Group | BNF Range ($\text{kg N/ha}$) | Typical Grain N Content ($\%$) | Typical Residue N Content ($\%$) | Net Soil N Balance ($\text{kg N/ha}$) | Key Pathogens Broken |
|:---|:---|:---:|:---:|:---:|:---:|:---|
| **Black Gram** (*Vigna mungo*) | Grain Legume | 20–60 | 3.8% | 1.4% | +5 to +20 | Rice blast, Brown planthopper |
| **Green Gram** (*Vigna radiata*) | Grain Legume | 30–70 | 3.8% | 1.5% | +10 to +25 | Sheath blight, Stem borer |
| **Groundnut** (*Arachis hypogaea*) | Oilseed Legume | 40–120 | 4.0% | 1.8% | +10 to +30 | Cereal root aphids, Downy mildew |
| **Chickpea** (*Cicer arietinum*) | Cool-Season Grain Legume | 20–80 | 3.2% | 0.9% | +5 to +15 | Sorghum shoot fly, Ergot |
| **Pigeon Pea** (*Cajanus cajan*) | Deep-Rooted Grain Legume | 40–100 | 3.4% | 1.0% | +15 to +35 | Sesame phyllody, Sesame root rot |
| **Sunn Hemp** (*Crotalaria juncea*) | Green Manure / Cover | 80–200 | N/A (Cut green) | 2.5% | **+80 to +180** | Root-knot nematodes, Fusarium |
| **Lablab Bean** (*Lablab purpureus*) | Dual Cover / Forage Legume | 50–150 | 3.5% | 2.2% | +30 to +80 | Maize stalk borer, Rust |

### 4.1 Biological Nitrogen Fixation vs Crop Export Dynamics
A common misconception in agricultural planning is assuming that growing a legume automatically deposits its entire biologically fixed nitrogen into the soil.
- For a black gram crop yielding $1,200\text{ kg/ha}$ of grain at $3.8\%\text{ N}$, **$45.6\text{ kg N/ha}$ is harvested and permanently removed from the field**.
- If the crop fixed $50\text{ kg N/ha}$ from the atmosphere via *Rhizobium* symbiosis, the net nitrogen balance left in the soil roots and nodules is only $+4.4\text{ kg N/ha}$.
- Only when crop haulms and residues ($1.5\text{–}2.5\text{ t/ha}$ at $1.4\%\text{ N} \approx 25\text{–}35\text{ kg N/ha}$) are retained and incorporated into the soil does the field realize a meaningful positive fertility benefit.

### 4.2 C:N Ratio Dynamics and Organic Matter Priming
- **Cereal Residues (Rice straw, Maize stover):** C:N ratio of $60:1$ to $80:1$. When incorporated alone, soil microbes require external mineral nitrogen to decompose the high-carbon material, causing **temporary nitrogen immobilization** (crop yellowing in the subsequent crop).
- **Legume Residues (Pulse haulms, Sunn hemp biomass):** C:N ratio of $18:1$ to $25:1$. Rapidly mineralized by soil bacteria, releasing available ammonium ($NH_4^+$) and nitrate ($NO_3^-$) within 20–40 days of incorporation.
- **Alternating Sequence Synergy:** Sowing black gram after rice stubble prevents nitrogen tie-up and accelerates decomposition of the refractory rice root mass.

### 4.3 Disease Breaks and Pest Interruption
- **Soil-Borne Pathogen Interruption:** Continuous double-rice monoculture promotes sheath blight (*Rhizoctonia solani*), bacterial leaf blight (*Xanthomonas oryzae*), and stem borers (*Scirpophaga incertulas*). Introducing a non-host dicotyledonous legume (black gram or green gram) starves the obligate pathogens, drastically reducing sclerotial inoculum in the topsoil.
- **Fusarium Wilt Warning:** Chickpea and pigeon pea are susceptible to species-specific strains of *Fusarium oxysporum* (*f. sp. ciceris* and *f. sp. udum*). The rotation engine in `lib/engine/pest.ts` correctly flags a 3-year minimum return interval for chickpea on wilt-prone fields.

---

## 5. Hard Feasibility Constraints & Physical Boundary Gates

Agricultural decision support systems must prioritize physical viability before ranking utility. The audit verifies four core physical gates:

```
                            DECISION FILTER PIPELINE
                     ┌───────────────────────────────────┐
                     │     Candidate Crop Rotation       │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │ 1. Sowing Window & Calendar Gate  │
                     │    - Cycle days vs open window    │
                     │    - Turnaround days (tillage)    │
                     └─────────────────┬─────────────────┘
                                       │ (Pass)
                                       ▼
                     ┌───────────────────────────────────┐
                     │ 2. Water Availability & Flood Gate│
                     │    - Irrigated need vs supply     │
                     │    - Flood/waterlogging tolerance │
                     └─────────────────┬─────────────────┘
                                       │ (Pass)
                                       ▼
                     ┌───────────────────────────────────┐
                     │ 3. Edaphic & Thermal Boundary Gate│
                     │    - Soil pH absolute limits      │
                     │    - Critical flowering heat limit│
                     └─────────────────┬─────────────────┘
                                       │ (Pass)
                                       ▼
                     ┌───────────────────────────────────┐
                     │ 4. Multi-Criteria Ranking (MCDA)  │
                     │    - Yield-adjusted gross margin  │
                     │    - Dynamic NASA water shortfall │
                     └───────────────────────────────────┘
```

### 5.1 Sowing Windows and Turnaround Days
- **Turnaround Timing:** In mechanized systems, turnaround between crops requires 14–21 days for plowing, harrowing, and leveling. In traditional Delta pulse systems, turnaround is compressed to **0–3 days** via zero-till relay broadcasting into damp mud.
- **Cycle Duration Ceiling:** In rainfed double-cropping, the sum of Crop 1 duration + turnaround + Crop 2 duration must strictly fit within the agro-hydrological window:
  $$\text{Duration}_1 + \text{Turnaround} + \text{Duration}_2 \le \text{Available Moist Days}$$
  - For Delta rainfed systems: $135\text{ days (Rice)} + 7\text{ days (Turnaround)} + 85\text{ days (Black Gram)} = 227\text{ days}$. With moist soil persisting from June 15 to January 31 ($230\text{ days}$), the sequence fits with only a 3-day buffer.

### 5.2 Waterlogging & Hypoxia Tolerance Ladder
Crops exhibit vast differences in root anoxia tolerance, defining strict placement rules:

```
Waterlogging Tolerance Class (1 = Extreme Sensitivity, 5 = High Tolerance)
────────────────────────────────────────────────────────────────────────────
Level 5: Paddy Rice (Oryza sativa)
         └── Requires submerged soil; specialized aerenchyma tissues.
Level 4: Fallow (Vegetated/Weed cover)
         └── Native flora adapts to transient surface saturation.
Level 3: Black Gram, Green Gram (Established vegetative stages)
         └── Tolerates brief transient saturation if surface drains in < 48 h.
Level 2: Sunflower, Pigeon Pea, Maize, Seedling Black/Green Gram
         └── Significant root damage and chlorosis if saturated for > 24 h.
Level 1: Sesame (Sesamum indicum), Groundnut (Arachis hypogaea), Chickpea
         └── Total root collapse and mortality from 24 h ponding. Must NOT
             be grown on poorly drained soils or flood-prone flats.
```

---

## 6. Agronomic Remediation Roadmap for Green Ally Project

Based on this audit, the following concrete improvements are recommended for the codebase:

1. **Add Sunflower to `MYANMAR_CROPS`:**
   - Create the full specification in `lib/data/crops/myanmar.ts` with regional calendars for Ayeyarwady (`11-15` to `12-31`) and Magway (`09-01` to `10-15`).
2. **Support Relay Broadcasting Mode:**
   - In `lib/engine/compare.ts`, revise the `overlapUnverified` gate to allow negative or zero turnaround days specifically when `establishmentMode === "relay_broadcast"` for rice-to-pulse transitions, utilizing the saturated post-paddy soil handover model.
3. **Calibrate Regional MCDA Anchors:**
   - Update `lib/engine/mcda.ts` to allow region-specific anchors for `water-shortfall`. For annual double-cropping in the Central Dry Zone, expand the upper limit anchor from $400\text{ mm}$ to $1,000\text{ mm}$ to prevent utility zero-saturation and preserve the discriminating power of NASA rainfall data.
4. **Cultivar-Specific Duration Selectors:**
   - Allow farmers or extension agents to select local cultivar classes (e.g., Short-duration 75-day vs Medium 90-day vs Traditional 150-day) to replace broad ECOCROP species-level ranges.
