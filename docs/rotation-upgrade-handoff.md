# Crop Rotation Engine Upgrade & Farmer UX Handoff Document

**Target Application:** Field Shift Crop Rotation Planner  
**Route:** `http://localhost:3001/fields/[fieldId]/rotation`  
**Primary Field Reference:** `88d66ad1-2324-4f18-b8d3-2ae4e4d86b18` ("Delta Field", Ayeyarwady Delta, Myanmar; `[96.1735, 16.8402]`, 3.5 ha, lowland rice $\rightarrow$ post-monsoon black/green gram)  
**Date of Verification:** 2026-11-15  
**Sign-off Status:** COMPLETE IMPLEMENTATION OF PROMPTS 0 THROUGH 10

---

## 1. Executive Summary & Design Contract Adherence

The Field Shift crop rotation planning system has been transformed from an uncalibrated theoretical scheduler into a robust, farmer-centered decision support system. The implementation strictly complies with all core project constraints:

1. **Light Mode Only (`DESIGN.md`):** Zero dark classes (`dark:`), zero dark tokens, no `prefers-color-scheme` switch, and no theme toggle introduced. Data colors (`water`, `heat`, `drought`, `frost`, `healthy`) are accompanied by icons or descriptive plain-language text.
2. **Missing Stays Missing Invariant:** Unmeasured biophysical parameters report `unknown`, `needs_review`, or `unquantified` (never defaulted to 0 or regional mean without explicit user consent).
3. **No Fake Precision / No Invented EVSI:** Misnamed EVSI replaced with deterministic ranking sensitivity across market price and rainfall scenarios. Uncalibrated pulse crop water-production factors ($K_y$) are disclosed as `UNQUANTIFIED` rather than fabricating yield response numbers.
4. **Hydrological Mass Conservation:** Strict non-overlapping 3-zone hydrology ledger ($Z_1, Z_2, Z_3$) with verified mass balance residual error $\le 10^{-9}\text{ mm/day}$.
5. **Data Truthfulness & Open Attribution:** Coarse satellite data (SMAP 9 km, NASA POWER ~50 km) is explicitly typed as **regional hydrologic context**, strictly preventing any claim of "measured in your field".
6. **Mobile Accessibility:** Sized for 360px mobile viewports, $\ge 44\text{px}$ tap targets, Burmese/English bilingual hints, and dual view modes (`[ 🌾 Guided Farmer View | 🔬 Advanced Detail View ]`).

---

## 2. 14-Issue Verification Matrix

| Issue Code | Description | Final Status | Implementation Files | Passing Verification Tests |
| :--- | :--- | :--- | :--- | :--- |
| **H-01** | Non-conserved water stores and instantaneous field capacity reset | **FIXED** | `lib/engine/water.ts` | `tests/lib/hydrology-three-zone.test.ts`, `tests/lib/rotation-end-to-end.test.ts` ($\le 10^{-9}\text{ mm}$ residual tolerance) |
| **H-02** | Static depletion fraction ($p = 0.5$) ignoring evaporative demand | **FIXED** | `lib/data/crops/myanmar.ts`, `lib/engine/et0.ts` | `tests/lib/et0-climate-hazards.test.ts` (Dynamic equation $p = \text{clamp}(p_{\text{base}} + 0.04(5 - ET_c), 0.1, 0.8)$) |
| **H-03** | Infiltration excess and dry topsoil homogenization during root growth | **FIXED** | `lib/engine/water.ts` | `tests/lib/hydrology-three-zone.test.ts` (`redistributeAtRootChangeThreeZone` preserves dry seedbed; non-overlapping $Z_1, Z_2, Z_3$ accounting) |
| **H-04** | Immediate paddy drainage assumption masking plough pan resistance | **FIXED** (Numerical model complete; $k_{\text{pan}}$ noted as uncalibrated in Myanmar) | `lib/engine/water.ts` | `tests/lib/hydrology-three-zone.test.ts`, `tests/lib/rotation-end-to-end.test.ts` (`paddyDrainageHandover` with explicit pond drainage and pan conductance $2.5–6.0\text{ mm/d}$) |
| **C-01** | Missing FAO-56 Penman-Monteith reference ET0 and uncalibrated Hargreaves | **FIXED** | `lib/engine/et0.ts` | `tests/lib/et0-climate-hazards.test.ts` (FAO-56 PM with net radiation $R_{ns}, R_{nl}$ and Hargreaves fallback) |
| **C-02** | Whole-season temperature averaging obscuring reproductive heat/rain hazards | **FIXED** | `lib/engine/exposure.ts` | `tests/lib/et0-climate-hazards.test.ts` (Stage-aware screening for acute flowering heat $>35^\circ\text{C}$ and excess rain) |
| **A-01** | Annual recurrence of crop families in same seasonal slot undetected | **FIXED** | `lib/engine/pest.ts` | `tests/lib/sequence-nitrogen-disease.test.ts` (`detectMultiYearDiseasePressure` tracks multi-year cycle repetition, with flooded paddy disease break) |
| **A-02** | Nitrogen balance lacking residue fate partitioning and kinetics | **FIXED** | `lib/engine/soil-health.ts` | `tests/lib/sequence-nitrogen-disease.test.ts` (`assessResidueNitrogen`: burn 95% volatilized, fodder 85% exported, cereal $<21\text{d}$ immobilization alert, legume 25–40% mineralization) |
| **E-01** | Yields uncoupled from water deficit and missing cost partitioning | **FIXED** | `lib/engine/economics.ts` | `tests/lib/water-economics.test.ts`, `tests/lib/rotation-end-to-end.test.ts` (Sourced FAO 33/66 $K_y$; uncalibrated pulses UNQUANTIFIED; null break-even when $P \le c_{\text{var}}$) |
| **D-01** | Compensatory MCDA additive utility sum allowing profit to mask water deficit | **FIXED** | `lib/engine/farmer-decision.ts` | `tests/lib/farmer-decision-mcda.test.ts`, `tests/lib/rotation-end-to-end.test.ts` (Hard Feasibility Gate filters unviable options before ranking; missing evidence is `needs_review`) |
| **D-02** | Misnamed EVSI and lack of actionable ranking sensitivity analysis | **FIXED** | `lib/engine/farmer-decision.ts` | `tests/lib/farmer-decision-mcda.test.ts`, `tests/lib/rotation-end-to-end.test.ts` (Deterministic sensitivity evaluates price/water switches; baseline vs NASA comparison without forced flips) |
| **U-01** | Calendar geometry dividing by 365 days causing leap year 2028 drift | **FIXED** | `lib/rotation-format.ts` | `tests/lib/rotation-calendar-rules.test.ts`, `tests/lib/rotation-end-to-end.test.ts` (366 days in 2028; UTC-safe dayOfYear; ground cover calculation) |
| **U-02** | Turnaround policies flagging legitimate relay broadcast (*Ye-pyan*) as collision | **FIXED** | `lib/engine/transition.ts`, `components/field/rotation-editor.tsx` | `tests/lib/rotation-calendar-rules.test.ts`, `tests/lib/rotation-end-to-end.test.ts` (Negative gap up to -12d allowed for eligible rice $\rightarrow$ pulse; 1-click snap repairs) |
| **U-03** | Farmer interface displaying fake countdown clocks without field verification | **FIXED** | `components/field/moisture-clock-ribbon.tsx`, `components/field/farmer-guided-flow.tsx`, `components/field/rotation-editor.tsx` | `tests/components/farmer-rotation-ui.test.tsx` (Moisture Clock ribbon renders honest "Check topsoil moisture and drainage before sowing" when unconfirmed; dual Guided/Advanced views) |

---

## 3. Changed Files & Public API Contracts

### Data Schemas & Types
- `lib/types.ts` & `lib/schemas/field.ts`:
  - Added `EstablishmentMode = "tillage" | "zero_till" | "relay_broadcast" | "unknown"`.
  - Added `ResidueFate = "retain_incorporate" | "retain_mulch" | "remove_fodder" | "burn" | "unknown"`.
  - Added `farmerObservedDrainage` and `farmerObservedSoilCondition` to `RotationSlot`.
  - Backward compatibility: All new properties are optional; legacy rotations in IndexedDB parse cleanly without schema break.

### Core Calculation Engines
- `lib/engine/water.ts`:
  - `threeZoneCapacities`, `threeZoneStep`: Non-overlapping 3-zone hydrology ledger ($Z_1 = 0.12\text{ m}, Z_2, Z_3$) with runoff and drainage partitioning.
  - `redistributeAtRootChangeThreeZone`: Layer-preserving root expansion.
  - `paddyDrainageHandover`: Post-monsoon surface pond evacuation and plough pan decay conductance ($k_{\text{pan}} \in [2.5, 6.0]\text{ mm/d}$).
  - `seedbedMoistureWindow`: Physical 3-phase drydown window when soil is confirmed; returns `"field-check-needed"` when soil or drainage is unconfirmed.
- `lib/engine/et0.ts`:
  - `penmanMonteithEt0`, `penmanMonteithDetails`: Two-tier reference ET0 with FAO-56 net radiation.
  - `evaluateDailyEt0`: Automatic tier selection (Penman-Monteith when complete; Hargreaves fallback when solar/humidity missing).
- `lib/engine/exposure.ts`:
  - `screenPhenologicalHazards`: Stage-aware screening for acute reproductive heat ($>35^\circ\text{C}$) and flowering rain hazards.
- `lib/engine/soil-health.ts`:
  - `assessResidueNitrogen`: Residue fate partitioning (burn 95% loss, fodder 85% export, cereal turnaround $<21\text{d}$ immobilization alert, legume 25–40% mineralization).
- `lib/engine/pest.ts`:
  - `detectMultiYearDiseasePressure`: Tracks recurring crop family pressure across multi-year cycles, accounting for anaerobic paddy disease breaks.
- `lib/engine/economics.ts`:
  - `evaluateWaterYieldResponse`: Sourced FAO 33/66 $K_y$ factors; uncalibrated pulses marked `UNQUANTIFIED`.
  - `calculateBreakEvenYield`: Sourced fixed, variable, and irrigation costs. Returns `viable: false` and `null` when $P \le c_{\text{var}}$.
  - `calculateScenarioGrossMargin`: Exposes committed cash-at-risk and gross margin envelope.
- `lib/engine/farmer-decision.ts`:
  - `classifyRotationFeasibility`: Hard feasibility gate prior to ranking (checks water, budget, machinery; missing evidence is `needs_review`).
  - `evaluateDeterministicSensitivity`: Sourced deterministic ranking sensitivity identifying price and drought tipping points.
  - `compareBaselineVsNasa`: Truthful baseline vs NASA audit without forced ranking flips; marks unavailable if no baseline exists.
- `lib/engine/provenance.ts`:
  - `EngineInputProvenance`: Structured data provenance contract.
  - `assertTruthfulSoilMoistureLabel`: Invariant check ensuring SMAP 9 km coarse data is never labeled "measured in your field".
- `lib/engine/transition.ts`:
  - `evaluateTransition`: Shared transition policy supporting +14d turnaround, +7d zero-till, and negative gap pre-harvest relay broadcast (*Ye-pyan*, up to -12d for eligible rice $\rightarrow$ pulse pairing).
  - `snapToRelayBroadcast`, `snapToStandardTurnaround`: Reusable 1-click date repair helpers.

### UI Components
- `components/field/moisture-clock-ribbon.tsx`:
  - Honest moisture clock: renders "Check topsoil moisture and drainage before sowing" advisory when unconfirmed; renders 3-phase physical drydown window when ground-confirmed.
- `components/field/farmer-guided-flow.tsx`:
  - 5-step guided journey (Field $\rightarrow$ Constraints $\rightarrow$ Priorities $\rightarrow$ Compare $\rightarrow$ My Plan).
  - Mobile-first (~360px), 16px body, $\ge 44$px tap targets, Burmese/English bilingual hints, acre/ha unit toggle, at most 3 candidate cards.
- `components/field/rotation-editor.tsx`:
  - Dual view toggle: `[ 🌾 Guided Farmer View | 🔬 Advanced Detail View ]`.
  - Integrated `evaluateTransition` with emerald `🌱 Relay Broadcast (Ye-pyan)` badge and 1-click snap buttons (`Snap to Relay -7d`, `Snap to Turnaround +14d`).

---

## 4. Test Suite Execution & Verification Results

All automated tests in the repository run cleanly with zero regressions:

```bash
# Run all tests in the workspace (43 test files, 439 tests)
npm test

# Run TypeScript typechecker
npm run typecheck

# Run ESLint
npm run lint
```

**Verification Results:**
- **Vitest Unit & Integration Suite:** 43 passed (43/43 files, 100%), 439 passed (439/439 tests, 100%).
- **TypeScript Typecheck:** 0 errors (exited with code 0).
- **ESLint:** 0 errors (exited with code 0).

---

## 5. Unvalidated Parameters Requiring Local Ground Calibration in Myanmar

While all physical models are mathematically rigorous and conserve mass, the following parameters remain empirical hypotheses needing local field validation:

1. **Plough Pan Conductance ($k_{\text{pan}}$):** Default $2.5 - 6.0\text{ mm/day}$ based on tropical lowland paddy literature. In-situ double-ring infiltrometer percolation tests are required across Ayeyarwady Delta alluvial clay loams post-monsoon.
2. **Pulse Water Yield Response ($K_y$):** FAO 33/66 provides standard response factors for soybean (0.85) and groundnut (0.70), but omits black gram (*Vigna mungo*) and green gram (*Vigna radiata*). Currently reported as `UNQUANTIFIED`. Deficit irrigation field trials in Myanmar are needed before quoting yield discount percentages.
3. **Pre-Harvest Relay Broadcast (*Ye-pyan*) Sowing Window:** 7–12 days pre-drainage practiced traditionally; precise soil moisture tensiometer thresholds require on-site calibration.
4. **Reproductive Heat Stress Duration:** 35°C daytime maximum threshold for pulses; hours of exposure per day are not resolved by daily reanalysis summaries.
5. **Legume Mineralization Kinetics:** 25–40% release over 90 days varies with soil temperature, aeration, and biological activity.

---

## 6. What Still Needs a Local Farmer / Agronomist Check

Before deploying to production smallholders:
1. **On-Site Usability Testing:** Execute the five moderated tasks defined in [`docs/rotation-farmer-ux-test.md`](file:///Users/happer/Projects/nasafarmingapp/docs/rotation-farmer-ux-test.md) with 10–15 smallholders in Danubyu and Hinthada townships.
2. **Wholesale Depot Price Calibration:** Connect real-time or weekly township wholesale depot price feeds from the Myanmar Department of Agriculture / Central Statistical Organization.
3. **Local Cultivar Maturation Durations:** Calibrate 80–180 day species-wide durations to local popular seed varieties (e.g. Sin Thu Kha, Manaw Thu Kha for rice; Yezin-3, Yezin-7 for black gram).
4. **Soil Texture Overrides:** Encourage farmers to confirm soil texture and drainage in the Farm Profile tab (`/fields/[id]/profile`) to unlock the calibrated Moisture Clock.
