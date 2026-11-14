# Crop Rotation Data Provenance & Science Contract

> **Notice:** Field Shift is an agronomic decision support tool developed with open NASA Earth Observation data and regional agricultural statistics. It provides comparative scenario modeling, not an agronomic guarantee. Field observations by the farmer always take precedence over coarse satellite or digital soil estimates.

---

## 1. Data Source Inventory & Safe UX Claims

Every data point consumed by the Field Shift Crop Rotation Engine follows a strict provenance contract. Below is the full inventory mapping:
`Source → Engine Feature → Units → True Native Resolution → Safe UX Claim → Fallback`

| Source & Provider | Engine Feature | Native Units | True Spatial Resolution & Footprint | Safe UX Claim | Fallback When Unavailable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NASA POWER** (NASA Langley) | Daily Temperature ($T_{\text{2M}}$, $T_{\text{2M\_MAX}}$, $T_{\text{2M\_MIN}}$) | °C | 0.5° × 0.625° (~50 km × ~60 km) MERRA-2 gridded atmospheric assimilation | *"Regional climate history (~50 km grid). Useful for seasonal screening; not a local microclimate forecast."* | Mark temperature checks incomplete / `unknown`. Never substitute demo weather or regional mean without explicit user consent. |
| **NASA POWER** (NASA Langley) | Solar Radiation (`ALLSKY_SFC_SW_DWN`) | $\text{MJ/m}^2/\text{day}$ | 1.0° × 1.0° (~110 km) CERES SYN1deg assimilation | *"Regional solar irradiance estimate."* | Hargreaves radiation approximation from temperature range ($\Delta T$). |
| **GPM IMERG** (NASA GSFC / JAXA) | Daily Precipitation (`GPM_3IMERGDF`) | mm/day | 0.1° × 0.1° (~10 km) multi-satellite radar/microwave precipitation with gauge calibration | *"Regional satellite rainfall estimate (~10 km). Informs seasonal rainfall patterns; does not capture parcel-level cloudbursts."* | NASA POWER `PRECTOTCORR` (MERRA-2 reanalysis, ~50 km) recorded explicitly as secondary fallback. |
| **SMAP L4** (NASA JPL / GSFC) | Surface and Root-Zone Soil Moisture (`SPL4SMGP`) | $\text{m}^3/\text{m}^3$ (volumetric water content) | 9 km grid posting (assimilated with Catchment Land Surface Model) | *"Regional catchment moisture context (~9 km). Informs basin-wide wetness trends. **NEVER labeled as measured in your field**."* | Mark soil moisture trend `unknown`. Require physical farmer seedbed moisture check. |
| **SoilGrids 2.0** (ISRIC — World Soil Information) | Topsoil Sand, Clay, Silt, Organic Carbon, pH | g/kg, %, pH units | 250 m digital elevation & machine learning interpolation | *"Digital soil map estimate (~250 m). Provides broad regional soil texture; not a laboratory soil test of your plot."* | Use broad regional default if unconfigured; require farmer field observation before scheduling sensitive operations. |
| **Farmer Field Input** (On-Site Observation) | Soil Texture Override, Post-Harvest Drainage Date, Establishment Mode | Categorical, ISO Date, Enum | Exact parcel plot ($< 1$ ha to 10 ha) | *"Observed by farmer in this field. Overrides coarse satellite and global digital soil models."* | None (remains unconfirmed / `needs_review`). |
| **FAO-56 Standard** (FAO Irrigation & Drainage 56) | Reference Evapotranspiration ($ET_0$), Crop ET ($ET_c$), Water Stress ($K_s$) | mm/day, dimensionless | Point calculation at field coordinates using gridded inputs | *"Calculated crop water balance adhering to FAO-56 Penman-Monteith physical equations."* | Hargreaves-Samani temperature-only $ET_0$ fallback when solar/humidity is missing. |
| **DoA Myanmar / CSO** (Dept of Agriculture, Township Markets) | Wholesale Crop Prices, Variable & Fixed Enterprise Costs | MMK/kg, MMK/acre, MMK/ha | Regional township wholesale trading centers (Hinthada, Danubyu, Yangon) | *"Regional market prices and input cost benchmarks (2025–2026). Actual net returns depend on local quality grading and logistics."* | User editable cost/price inputs; report unadjusted unit margin. |

---

## 2. Strict Truthfulness Invariants

1. **The Regional Soil Moisture Invariant:**
   - Coarse satellite soil moisture (SMAP 9 km grid) must **NEVER** be described as *"measured in your field"*, *"field soil sensor"*, or *"ground truth"*.
   - In UI and documentation, SMAP data is strictly identified as **Regional Hydrological Context**.
   - Sowing readiness and workable soil windows **always** require on-site farmer verification (`farmerObservedSoilCondition`, `farmerObservedDrainage`).

2. **The "Missing Stays Missing" Invariant:**
   - If NASA POWER or IMERG servers time out or return an unconfigured/error state, the system **never** fabricates substitute data.
   - The engine returns explicit missing states (`"source-unavailable"`, `"needs_review"`, `"unquantified"`).
   - In offline mode or when remote servers are unreachable, local saved drafts remain fully reviewable and editable in IndexedDB storage, with clear UI indicators: `[ ⚠️ Data unavailable / using dated cached observations ]`.

3. **No Fake Crop Response:**
   - Yield response factors ($K_y$) are only calculated for crops with established FAO 33/66 calibration (rice, maize, soybean, groundnut, chickpea, sunflower).
   - Crops without published calibration (black gram, green gram, sesame) report water response as **UNQUANTIFIED** rather than using fabricated response coefficients.

4. **Break-Even Non-Negativity:**
   - When harvest price is less than or equal to variable harvest cost ($P \le c_{\text{var}}$), break-even yield is mathematically undefined. The system returns `viable: false` and `breakEvenYieldKgHa: null`, never clamping to an artificial 1.0 kg/ha.

---

## 3. Science Parameters Needing Ground Calibration in Myanmar

The following empirical parameters are implemented within biologically plausible physical ranges based on international literature, but remain **uncalibrated against ground field trials in Myanmar**:

| Parameter | Current Range / Default | Scientific Literature Basis | Ground Validation Needed in Myanmar |
| :--- | :--- | :--- | :--- |
| **Plough Pan Conductance Decay ($k_{\text{pan}}$)** | $2.5 - 6.0\text{ mm/day}$ | ACIAR / IRRI tropical lowland paddy soil drainage studies | In-situ double-ring infiltrometer percolation tests across Ayeyarwady Delta clay loams post-monsoon. |
| **Relay Sowing Window (*Ye-pyan*)** | $-7\text{ to } -12\text{ days}$ pre-harvest | World Bank / ACIAR Myanmar pulse intensification guidelines | Soil moisture tensiometer and standing water depth monitoring during broadcast into standing rice. |
| **Black/Green Gram Water Yield Factor ($K_y$)** | UNQUANTIFIED (FAO standard missing) | FAO Irrigation & Drainage Papers 33 & 66 omit *Vigna radiata/mungo* | Multi-treatment deficit irrigation trials across Central Dry Zone and Delta post-monsoon seasons. |
| **Pulse Reproductive Heat Threshold** | $35^\circ\text{C}$ daytime maximum | ICRISAT / ACIAR legumes heat tolerance trials | Microclimate canopy temperature logging vs flower abortion counts in March–April harvest windows. |
| **Legume Residue Mineralization Fraction** | $25\% - 40\%$ over 90 days | Tropical legume green manure and residue retention studies | Soil mineral N ($NH_4^+, NO_3^-$) incubation trials under alternating wet-dry delta conditions. |
| **Cereal Stover Immobilization Window** | $< 21\text{ days}$ turnaround alert | Soil science C:N ratio dynamics ($C:N > 60:1$ for rice straw) | Field crop vigor and starter N response trials when sowing immediately after combine harvesting. |

---

## 4. Cache & Offline Draft Resilience

- **Storage Engine:** Browser IndexedDB via `idb-keyval` and custom repository pattern (`lib/store/repository.ts`).
- **Cache Invalidation:** 48-hour staleness threshold for historical weather normals; immediate refresh if soil data was incomplete.
- **Offline Drafts:** All field configurations, crop selections, calendar dates, and custom price overrides are persisted locally. Farmers can draft, edit, and evaluate rotations without an active internet connection.
