# FieldShift — Crop-Rotation Scientific Notes & Model Architecture

> **Decision Support Notice:** Field Shift is an agronomic decision support engine developed with open NASA Earth Observation data and regional agricultural statistics. It models physical and economic dynamics of crop sequences, but does not offer an agronomic yield or financial guarantee. Farmer field checks always take precedence.

---

## 1. Core Mathematical & Biophysical Models

### A. Reference Evapotranspiration ($ET_0$)
- **Primary Method:** FAO-56 Penman-Monteith equation (`lib/engine/et0.ts`):
  $$ET_0 = \frac{0.408 \Delta (R_n - G) + \gamma \frac{900}{T + 273} u_2 (e_s - e_a)}{\Delta + \gamma (1 + 0.34 u_2)}$$
  Where:
  - $R_n = R_{ns} - R_{nl}$ is net radiation ($R_{ns} = 0.77 R_s$, with albedo $\alpha = 0.23$).
  - Net longwave radiation $R_{nl}$ calculated using Stefan-Boltzmann constant, mean absolute temperature ($T_{K,\max}, T_{K,\min}$), actual vapor pressure $e_a$, and relative solar radiation $R_s / R_{so}$.
  - Latent heat conversion: $1\text{ mm/day} \approx 2.45\text{ MJ/m}^2/\text{day}$.
- **Fallback Method:** Hargreaves-Samani temperature-based formulation when humidity or solar radiation is missing:
  $$ET_0 = 0.0023 \cdot R_a \cdot (T_{\text{mean}} + 17.8) \cdot \sqrt{T_{\max} - T_{\min}}$$

### B. Soil Water Accounting & Mass Conservation
- **Non-Overlapping Three-Zone Soil Column (`lib/engine/water.ts`):**
  - Layer 1 ($Z_1 = 0.12\text{ m}$): Topsoil seedbed (evaporation active, germination zone).
  - Layer 2 ($Z_2 = \max(0, Z_{\text{root}} - Z_1)$): Active sub-seedbed root zone (transpiration active).
  - Layer 3 ($Z_3 = \max(0, Z_{\max} - Z_{\text{root}})$): Buffer subsoil layer below current root depth.
- **Mass Conservation Balance Ledger:**
  $$\Delta \left(S_{\text{pond}} + S_1 + S_2 + S_3 + S_{\text{perch}}\right) = P + I + \text{Cap} - RO - DP - E_{\text{soil}} - T_{\text{crop}}$$
  - Strictly verified with residual mass balance tolerance $\le 10^{-9}\text{ mm/day}$.
  - Runoff partitioning: Surface ponding capacity $B_{\text{spill}}$ (bund spill height, 100 mm for wetland rice, 0 mm for upland crops). Precipitation exceeding infiltration and bund height becomes runoff ($RO$).
  - Perched water & plough pan decay: $k_{\text{pan}} \in [2.5, 6.0]\text{ mm/day}$. While perched water table sits above plough pan, upward capillary flux maintains topsoil near saturation.

### C. Dynamic Depletion Fraction ($p$)
- Adjusts baseline depletion fraction $p_{\text{base}}$ (sourced from FAO-56 Table 22) based on daily evaporative demand $ET_c$:
  $$p = \text{clamp}\left(p_{\text{base}} + 0.04(5 - ET_c), 0.1, 0.8\right)$$
- Readily Available Water: $RAW = p \cdot TAW$. Water stress coefficient $K_s = 1.0$ when depletion $D_r \le RAW$; otherwise $K_s = \frac{TAW - D_r}{TAW - RAW}$.

### D. Water-Limited Crop Yield Response
- Evaluated using FAO 33 and FAO 66 (Steduto et al., 2012) yield response equation:
  $$\frac{Y_a}{Y_m} = 1 - K_y \left(1 - \frac{ET_a}{ET_m}\right)$$
  Yield reduction factor $\phi = \text{clamp}\left(1 - K_y(1 - ET_a/ET_m), 0, 1\right)$.
- Standard FAO $K_y$ values implemented:
  - Rice: $1.00$
  - Maize: $1.25$
  - Soybean: $0.85$
  - Groundnut: $0.70$
  - Chickpea: $0.80$
  - Sunflower: $0.95$
- **Unquantified Disclosure:** Pulses without calibrated FAO $K_y$ (black gram, green gram) report yield response as **UNQUANTIFIED**. Uncalibrated yield discounts are never fabricated.

### E. Real-World Enterprise Economics & Break-Even
- **Gross Margin Envelope:**
  $$GM = Y \cdot (P - c_{\text{var}}) - c_{\text{fixed}} - c_{\text{irr}}$$
- **Break-Even Yield:**
  $$Y_{\text{BE}} = \frac{c_{\text{fixed}} + c_{\text{irr}}}{P - c_{\text{var}}}$$
  - When $P \le c_{\text{var}}$ (market price does not cover harvest unit costs), $Y_{\text{BE}}$ is undefined. The system returns `viable: false` and `breakEvenYieldKgHa: null` (never artificially clamped to 1 kg/ha).
  - Cash-at-risk exposes non-recoverable upfront capital: $c_{\text{fixed}} + c_{\text{irr}}$.

### F. Multi-Year Disease & Residue Nitrogen Partitioning
- **Disease Recurrence:** Evaluates crop family repetition across multi-year cycles in the same calendar season. Anaerobic paddy flooding is recognized as an agronomic break for upland fungal pathogens.
- **Residue Nitrogen Fate:**
  - Burning: 95% nitrogen volatilization loss.
  - Fodder removal: 85% biomass export from parcel.
  - Retention/Mulch: Legume residues release 25–40% mineral nitrogen over 90 days. High C:N cereal stover with $< 21$ days turnaround triggers a temporary immobilization warning.

---

## 2. Scientific Limitations & Unvalidated Parameters

The following parameters are implemented within plausible literature ranges, but **require ground validation and field trials in Myanmar**:

1. **Plough Pan Conductance ($k_{\text{pan}}$):** Default $2.5 - 6.0\text{ mm/day}$ based on tropical lowland literature, uncalibrated for Ayeyarwady Delta clay loams.
2. **Pulse Water Yield Response ($K_y$):** FAO 33/66 standard response factors omit *Vigna radiata/mungo*.
3. **Pre-Harvest Relay Broadcast (*Ye-pyan*) Window:** 7–12 days pre-drainage practiced traditionally; precise soil moisture threshold requires on-site tensiometer trials.
4. **Reproductive Heat Stress:** 35°C daytime maximum threshold for pulses; hours of exposure per day are not resolved by daily summaries.
5. **Legume Mineralization Kinetics:** 25–40% release over 90 days varies with soil temperature, aeration, and biological activity.

---

## 3. Key References

- Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998). *Crop evapotranspiration: Guidelines for computing crop water requirements*. FAO Irrigation and Drainage Paper 56. Rome: FAO.
- Doorenbos, J., & Kassam, A. H. (1979). *Yield response to water*. FAO Irrigation and Drainage Paper 33. Rome: FAO.
- Steduto, P., Hsiao, T. C., Fereres, E., & Raes, D. (2012). *Crop yield response to water*. FAO Irrigation and Drainage Paper 66. Rome: FAO.
- Saxton, K. E., & Rawls, W. J. (2006). *Soil water characteristic estimates by texture and organic matter for hydrologic solutions*. Soil Science Society of America Journal, 70(5), 1569-1578.
- World Bank. (2019). *Myanmar: Agricultural pulse sector development and gross margin dynamics*. Washington, DC.
- ACIAR. (2018). *Improving livelihoods of smallholders in Central Dry Zone and Delta of Myanmar*. Australian Centre for International Agricultural Research.
