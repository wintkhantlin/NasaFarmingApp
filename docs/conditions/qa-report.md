# QA, Accessibility & Scientific Claims Verification Report

**Date:** 15 November 2026  
**QA Lead:** Agent H (Integrated QA Subagent)  
**Verification Scope:** Field Conditions (Surface A) and Four Geospatial Risks Explorer (Surface B)  

---

## 1. Test Journey Matrix

| Journey / Verification Target | Status | Verification Evidence |
|:---|:---:|:---|
| **Journey 1: Surface A Mobile Overview (320px)**<br>Main insight, 3 key conditions, 1 local check, and 4-risk entry grid visible before long charts. | **PASS** | Verified via `tests/components/conditions-risk-explorer.integration.test.tsx` (Journey 1). Risk entry module precedes rainfall and temperature charts in DOM order. |
| **Journey 2: Seamless Surface A ↔ Surface B Navigation**<br>Tap any risk tile in Surface A to open Surface B with preselected risk; tap "Back to Conditions" to return to Surface A. | **PASS** | Verified via `tests/components/conditions-risk-explorer.integration.test.tsx` (Journey 2). State persists, no URL query coord leaks. |
| **Journey 3: Rapid Risk Switching**<br>Switch between Water stress, Flood, Erosion, Heat & cold without stale data bleed. | **PASS** | Verified via `tests/components/conditions-risk-explorer.integration.test.tsx` (Journey 3). Atomic update of layer selector, map overlay, footprint label, time controls, and findings panel. |
| **Journey 4: Missing Data & Scientific Safety Gates**<br>Simulate absent SMAP/IMERG, missing flood scenes, missing DEM slope, and unconfigured crop calendar. | **PASS** | Verified via unit and integration tests (`water-stress-panel.test.tsx`, `flood-panel.test.tsx`, `erosion-panel.test.tsx`, `heat-cold-panel.test.tsx`, Journey 4). No invented hazard scores, flood depths, or tonnes/ha. |
| **Journey 5: Paddy Flooding vs Destructive Flood Distinction**<br>Ensure deliberately impounded paddy water is not classified as an adverse flood disaster. | **PASS** | Verified in `FloodPanel` and `flood-panel.test.tsx`. Plain-language banner explains paddy irrigation vs destructive flood. |
| **Journey 6: Heat Exceedance Days vs Sustained Heatwaves**<br>Ensure single-day counts (days ≥35°C) are never conflated with sustained consecutive-day heatwaves. | **PASS** | Verified in `HeatColdPanel` and `condition-evidence.test.ts`. Clear caveat and description. |
| **Journey 7: Coarse Footprint vs Field Boundary Distinction**<br>Distinct styling for confirmed field outline vs ~50 km POWER / 9 km SMAP grid cell. | **PASS** | Verified via `RiskMap` and Journey 5 test. |
| **Journey 8: WCAG 2.2 Accessibility & Hit Targets**<br>Keyboard focusable controls, 44×44px hit targets, non-drag bottom sheet expand/collapse triggers. | **PASS** | Verified in `RiskFindingsSheet` and `risk-explorer.test.tsx`. Non-drag buttons support `Enter`/`Space` expand/collapse. |
| **Journey 9: Responsive Viewports & Zoom**<br>320px, 390px, 768px, 1280px, and 200% zoom compatibility without text clipping or layout destruction. | **PASS** | Responsive 2×2 mobile risk tiles, flexible flex/grid breakpoints, desktop split layout (lg:col-span-8 / lg:col-span-4). |
| **Journey 10: Compare Rotations Contextual Link**<br>Compare button carries evidence context without silently triggering re-ranking or marking fields safe. | **PASS** | Link to `/fields/:id/compare` maintains intact engine evaluation contract. |

---

## 2. Repo Test Executions & Proof

### TypeScript Typecheck
- **Command:** `npm run typecheck` (`tsc --noEmit`)
- **Result:** `PASS` (0 errors)

### Unit & Integration Test Suites
- **Command:** `npx vitest run tests/components/conditions-view.test.tsx tests/components/conditions-risk-explorer.integration.test.tsx tests/lib/condition-evidence.test.ts tests/components/risk-explorer.test.tsx tests/components/risk-panels/water-stress-panel.test.tsx tests/components/risk-panels/flood-panel.test.tsx tests/components/risk-panels/erosion-panel.test.tsx tests/components/risk-panels/heat-cold-panel.test.tsx`
- **Result:** `PASS`
  - Test Files: 8 passed (8)
  - Tests: 39 passed (39)
  - Time: ~1.2s

### Full Quiet Test Suite
- **Command:** `npm run test:quiet`
- **Result:** `PASS` (All 89 test files passed, 750 tests passed, 0 failures)

---

## 3. Unresolved Scientific Gaps & Honest Limitations

1. **OPERA Dynamic Surface Water (DSWx-HLS):**
   - The OPERA DSWx pipeline is pending backend integration. The UI truthfully falls back to cloud-free Landsat C2 L2 observations or honest "No valid scene" status.
2. **SMAP L4 Latency:**
   - SMAP root-zone observations end at late 2025 until the 2026 data release is validated. The UI displays "Regional soil-moisture observations not available" for current-year dates without assuming zero moisture.
3. **Field-Scale Soil Loss:**
   - Without farmer-verified bund heights, contour tillage records, and soil organic matter testing, RUSLE soil loss in tonnes/ha is scientifically inadmissible. The UI strictly confines erosion reporting to topographic slope screening (degrees).
