# SCIENTIFIC CORRECTIONS AND CODE REMEDIATIONS

**Project:** Field Shift — Adapting Farms with NASA Data (NASA Space Apps Challenge 2026)  
**Lead Scientific Research Orchestrator**  
**Date:** November 15, 2026  
**Scope:** Applied production code corrections, algorithmic fixes, and verification test proofs.

---

## 1. Summary of Applied Corrections

| Correction ID | Component / File | Problem Fixed | Scientific Justification | Verification Test |
| :--- | :--- | :--- | :--- | :--- |
| **CORR-01** | `lib/nasa/planetary-computer.ts`<br>`lib/conditions/condition-evidence.ts` | Discarding clear-sky flooded satellite scenes (`coverage < 0.50`) | Clear water pixels are valid observations, not atmospheric cloud obscuration | `tests/lib/condition-evidence.test.ts`<br>(11/11 tests pass) |
| **CORR-02** | `lib/engine/mcda.ts` | MCDA utility saturation at 400 mm shortfall causing market price dominance | Preserves NASA precipitation discrimination power during severe drought anomalies | `tests/lib/ablation-experiment.test.ts`<br>(7/7 tests pass) |
| **CORR-03** | `components/field/risk-panels/heat-cold-panel.tsx`<br>`tests/components/risk-panels/heat-cold-panel.test.tsx` | "Frost Risk" displayed for 14°C night in tropical Ayeyarwady Delta | Absolute min temp in Delta is >11.5°C; re-scoped to "Winter Chilly Nights" (chilling sterility) | `tests/components/risk-panels/heat-cold-panel.test.tsx` |
| **CORR-04** | `scripts/predownload-heartland.ts`<br>`data/predownload/` | SoilGrids returned 60% null values due to administrative urban centroids | Moved coordinate queries 5–10 km into verified cultivated fields | `scripts/research/reproduce_experiments.mjs`<br>(Exp A: 100% valid clay loam) |
| **CORR-05** | `lib/plan/crop-library.ts`<br>`lib/plan/crop-decision-engine.ts` | Omission of Sunflower in Dry Zone & 100% legume BNF credit in flooded soil | Sunflower is essential drought-tolerant cash crop; Rhizobia nodulation fails under anoxia | `research/06_AGRONOMY_ROTATION_AUDIT.md` |
| **CORR-06** | `research/08_SCIENTIFIC_DATA_CONTRACT.md`<br>`components/field/report-view.tsx` | Attributing 9 km SMAP & 300 km GRACE to sub-hectare field boundaries | Explicit 3-tier spatial resolution contract prevents false precision | `research/08_SCIENTIFIC_DATA_CONTRACT.md` |

---

## 2. Deep-Dive Code Corrections

### CORR-01: Decoupling Scene Inundation from Clear-Sky Coverage

#### File: `lib/nasa/planetary-computer.ts`
**Root Cause:** The ingestion pipeline evaluated scene validity using `validLandRatio`. When a field was severely flooded (>50% water surface), the Scene Classification Layer (SCL) labeled pixels as Water (SCL 6). Because water is not "land," `validLandRatio` fell below 0.50, and the entire observation was discarded as missing data.

**Applied Code Diff:**
```typescript
// BEFORE:
const validLandRatio = validLandPixels / totalPixels;
if (validLandRatio < 0.50) {
  return { status: 'INSUFFICIENT_COVERAGE', valid: false };
}

// AFTER (CORRECTED):
// Inundated fields are scientifically valid observations of flood hazard, not cloud obscuration.
// Clear-sky coverage must count both valid land and standing water.
const clearObservationPixels = validLandPixels + waterPixels;
const clearCoverageRatio = clearObservationPixels / totalPixels;

if (clearCoverageRatio < 0.50) {
  return { status: 'CLOUD_OBSCURED', valid: false, coverage: clearCoverageRatio };
}
```

**Verification:**
Running `npx vitest run tests/lib/condition-evidence.test.ts`:
- Passed 11/11 tests, verifying that flooded scenes with 100% standing water and 0% cloud cover are accepted as valid flood evidence.

---

### CORR-02: MCDA Saturation Guard Under Climate Extremes

#### File: `lib/engine/mcda.ts`
**Root Cause:** In the Multi-Criteria Decision Analysis (MCDA) engine, candidate crop rotations are scored on multiple criteria: economic gross margin, water risk, heat risk, soil health, and food security. The water utility was bounded by an anchor threshold of 400 mm:
```typescript
function computeWaterUtility(shortfall: number): number {
  if (shortfall <= 0) return 1.0;
  if (shortfall >= 400) return 0.0;
  return 1.0 - (shortfall / 400);
}
```
During severe drought in the Central Dry Zone (where seasonal rainfall is cut by 60%), *every* multi-crop rotation incurs a water shortfall exceeding 400 mm (e.g., Rice-Sesame = 620 mm; Rice-Pulse = 480 mm). Because all candidates received utility `0.0`, the water criterion cancelled out across all candidates. Consequently, the MCDA score was decided purely by the economic criterion, recommending the most water-intensive crop because of higher market price.

**Applied Code Diff:**
```typescript
// Added Adaptive Relative-Scaling Saturation Guard in lib/engine/mcda.ts:
export function evaluateCandidateRotations(candidates: CandidateRotation[], climateContext: ClimateContext): ScoredRotation[] {
  // Check if all multi-crop candidates exceed the absolute shortfall anchor
  const allSaturated = candidates.length > 1 && candidates.every(c => c.waterShortfall >= 400);

  if (allSaturated) {
    // Relative scaling across candidate set preserves NASA precipitation signal
    const minShortfall = Math.min(...candidates.map(c => c.waterShortfall));
    const maxShortfall = Math.max(...candidates.map(c => c.waterShortfall));
    const range = maxShortfall - minShortfall;

    for (const candidate of candidates) {
      // Scale utility from 0.0 (worst candidate) to 1.0 (best candidate in drought)
      candidate.waterUtility = range > 0 
        ? 1.0 - ((candidate.waterShortfall - minShortfall) / range)
        : 0.5;
    }
  } else {
    for (const candidate of candidates) {
      candidate.waterUtility = Math.max(0, 1 - (candidate.waterShortfall / 400));
    }
  }

  // Proceed with multi-criteria weighted scoring
  return scoreRotations(candidates);
}
```

**Verification:**
Implemented in `tests/lib/ablation-experiment.test.ts`:
```typescript
it('ensures NASA precipitation anomaly flips recommendation from Rice-Pulse to Single Crop Fallow under 70% drought', () => {
  const normalResult = runDecisionEngine(baselineWeather);
  const droughtResult = runDecisionEngine(droughtWeather);
  
  expect(normalResult.topRecommendation).toBe('Rice - Black Gram');
  expect(droughtResult.topRecommendation).toBe('Single Crop Early Rice - Fallow');
  expect(droughtResult.waterRiskScore).toBeGreaterThan(0.75);
});
```
Result: **7/7 tests passed.** Verifies that NASA precipitation data actively alters the farmer's decision under climate distress.

---

### CORR-03: Decoupling Ground Frost from Tropical Chilling Injury

#### File: `components/field/risk-panels/heat-cold-panel.tsx`
**Scientific Reality:**
- In the Ayeyarwady Delta, 10-year NASA POWER meteorological records show the absolute lowest temperature ever observed was 11.5°C (Pathein). Ground frost ($T \le 0^\circ\text{C}$) is physically impossible in this tropical maritime basin.
- However, dry-season *boro* rice undergoes microsporogenesis (pollen development) in December–January. Minimum temperatures below $15^\circ\text{C}$ for 3 consecutive nights induce tapetal hypertrophy, pollen abortion, and spikelet sterility (up to 40% yield loss).
- Labeling this hazard "Frost Risk" confused farmers and agricultural extension officers.

**Applied Code Diff:**
```typescript
// BEFORE:
{risk.coldDays > 0 && (
  <div className="risk-item">
    <Icon name="snowflake" />
    <span>Coldest Typical Night Temperature: {risk.minTemp}°C (Frost Hazard)</span>
  </div>
)}

// AFTER:
{risk.coldDays > 0 && (
  <div className="risk-item">
    <Icon name="thermometer-low" />
    <span>Winter Chilly Nights (&le;15&deg;C): {risk.chillyNights} nights</span>
    <span className="risk-subtext">Pollen sterility risk for dry-season rice panicle initiation</span>
  </div>
)}
```
**Verification:**
Updated `tests/components/risk-panels/heat-cold-panel.test.tsx` to assert "Winter Chilly Nights" and biological chilling descriptions. Test passed cleanly.

---

### CORR-04: SoilGrids Sampling Coordinate Relocation

#### Files: `scripts/predownload-heartland.ts`, `data/predownload/`
**Problem:**
Initial SoilGrids queries used township administrative centroids (e.g., Mandalay City Hall, Pathein Municipal Center). Because these points are located in dense urban infrastructure, SoilGrids ISRIC returned null values (no soil map for urban class) for 15 out of 25 parameters.

**Correction:**
Relocated the coordinate lookup from town center to verified surrounding agricultural polygons:
- **Pathein:** Shifted from urban center (16.78°N, 94.73°E) to Kangyidaunt paddy plain (16.95°N, 94.88°E). Result: 100% valid clay loam profile (Clay: 42%, Sand: 18%, Silt: 40%, pH: 5.4).
- **Mandalay:** Shifted from urban center (21.98°N, 96.08°E) to Amarapura-Natogyi agricultural zone (21.75°N, 95.85°E). Result: 100% valid sandy clay loam profile (Sand: 52%, Clay: 28%, pH: 7.8).

**Verification:**
Executed in Experiment A (`scripts/research/reproduce_experiments.mjs`). All 5 regional demonstration hubs now return 100% non-null agronomic soil profiles.

---

## 3. Regression Test Verification Suite

All 96 test suites across the repository were executed quietly to verify complete codebase integrity after applied corrections:

```bash
$ npm run test:quiet
✓ tests/lib/ablation-experiment.test.ts (7)
✓ tests/lib/condition-evidence.test.ts (11)
✓ tests/lib/spec-v3-1.test.ts (24)
✓ tests/lib/farmer-decision-mcda.test.ts (23)
✓ tests/components/risk-panels/heat-cold-panel.test.tsx (5)
...
Test Files  96 passed (96)
     Tests  776 passed (776)
  Duration  18.42s
```

TypeScript type-check:
```bash
$ npm run typecheck
Found 0 errors.
```
