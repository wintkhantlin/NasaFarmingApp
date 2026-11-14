# Rotation Engine & Farmer UX Upgrade Audit (Prompt 0 Baseline)

**Target:** Existing Next.js/TypeScript Crop Rotation Planner (`http://localhost:3001/fields/[fieldId]/rotation`)  
**Evaluation Date:** 2026-11-14  
**Audit Scope:** Verify issues H-01..H-04, C-01..C-02, A-01..A-02, E-01, D-01..D-02, U-01..U-03 against actual codebase.

---

## 1. Issue Matrix

| ID | File & Lines | Summary of Code Vulnerability | Status in Repo | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **H-01** | `lib/engine/water.ts:320-332` | `uplandStartAfterPaddy` resets soil layers immediately to field capacity without accounting for plough-pan drainage delay, saturation excess, or turnaround evaporation. | **CONFIRMED** | Critical |
| **H-02** | `lib/engine/water.ts:131-146` | `DEFAULT_DEPLETION_FRACTION = 0.5` is statically hardcoded across all crops; does not adapt dynamically to evaporative demand $ET_c$ (FAO-56 Eq. 84). | **CONFIRMED** | High |
| **H-03** | `lib/engine/water.ts:161-175` | In `dailySoilWaterStep`, all rainfall enters root-zone storage until field capacity is exceeded. Infiltration-excess surface runoff before saturation is ignored. | **CONFIRMED** | High |
| **H-04** | `lib/engine/water.ts:298-318` | `redistributeAtRootChange` averages moisture uniformly when root depth contracts to seedling depth ($Z_r = 0.1\text{ m}$), masking topsoil crusting/seedbed desiccation. | **CONFIRMED** | Critical |
| **C-01** | `lib/engine/et0.ts:28-38` | `hargreavesEt0` uses uncalibrated constant $0.0023$ without coastal delta humidity adaptation; no uncertainty interval returned when inputs missing. | **CONFIRMED** | High |
| **C-02** | `lib/engine/suitability.ts:43-62` | Evaluates temperature envelope over whole-season mean; misses acute mid-season reproductive heat ($>35^\circ\text{C}$) and flowering rain hazards. | **CONFIRMED** | High |
| **A-01** | `lib/engine/soil-health.ts:27-55` | Nitrogen balance lacks user-selectable `residueFate` (incorporate, mulch, remove, burn) and first-season mineralization kinetics. | **CONFIRMED** | Medium |
| **A-02** | `lib/engine/pest.ts:20-51` | `pestSequence` only evaluates adjacent pairs $(t-1 \rightarrow t)$; misses annual repetition of same crop family in the same seasonal slot. | **CONFIRMED** | Medium |
| **E-01** | `lib/engine/economics.ts:56-80` | Margin calculation uses static yield bounds decoupled from simulated hydrological deficit ($ET_a / ET_c$); costs are not split into fixed vs variable. | **CONFIRMED** | Critical |
| **D-01** | `lib/engine/mcda.ts:54-90` | Fully compensatory additive utility sum allows high income to mask lethal drought ($0.0$ water utility); lacks biophysical survival veto. | **CONFIRMED** | High |
| **D-02** | `lib/rotation/engine.ts:251-273` | Missing data passively triggers `requires_review` without computing decision sensitivity to guide the farmer on which field check changes the ranking. | **CONFIRMED** | Medium |
| **U-01** | `components/field/rotation-editor.tsx`, `lib/rotation-format.ts` | Calendar geometry divides by 365 days; fails to support leap years (e.g., 2028: 366 days) and causes geometry clipping/drift. | **CONFIRMED** | Medium |
| **U-02** | `components/field/rotation-editor.tsx`, `lib/rotation-plan.ts` | Overlap detection flags all negative date gaps as errors, blocking legitimate relay broadcasting (*Ye-pyan*) of Black Gram into standing rice. Turnaround defaults vary (+14d vs +7d). | **CONFIRMED** | High |
| **U-03** | `components/field/rotation-editor.tsx` | Shading for monsoon is static (months 6-9) and sowing presets are hardcoded (Oct 25); missing interactive post-paddy Moisture Clock countdown. | **CONFIRMED** | High |

---

## 2. Baseline Test Results

- **Typecheck (`npm run typecheck`)**: PASSED (0 errors).
- **Rotation Integration Tests (`npm run test:rotation`)**: PASSED (23/23 tests pass).
- **Vitest Unit Suite (`npm test`)**: PASSED (252/252 tests pass).

---

## 3. Dependency Order for Implementation

```text
Prompt 1: Calendar & Transitions (lib/rotation-format.ts, lib/rotation-plan.ts, types)
   ↓
Prompt 2: Reference ET & Phenology (lib/engine/et0.ts, lib/engine/climate.ts, lib/engine/suitability.ts)
   ↓
Prompt 3: Soil Hydrology & Moisture Window (lib/soil/pedotransfer.ts, lib/engine/water.ts)
   ↓
Prompt 4: Crop Sequence, N & Disease (lib/engine/soil-health.ts, lib/engine/pest.ts)
   ↓
Prompt 5: Hydro-Economics & Cost Splitting (lib/engine/economics.ts)
   ↓
Prompt 6: Farmer Decision Input, Safe MCDA & Sensitivity (lib/engine/mcda.ts, lib/rotation/engine.ts)
   ↓
Prompt 7 & 8: Guided Farmer UX, Timeline Ribbon, Moisture Clock (components/field/*)
   ↓
Prompt 9: NASA Provenance & Resilient Integration (lib/nasa/*, docs/rotation-data-provenance.md)
   ↓
Prompt 10: Full Regression & Verification (docs/rotation-upgrade-handoff.md)
```

**Audit Status:** Baseline verified. Ready for execution of Prompts 1 through 10.
