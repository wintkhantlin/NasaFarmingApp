# File Ownership Manifest: Field Conditions & Four Geospatial Risks

**Date:** 15 November 2026  
**Implementation Lead:** Coordinator  
**Status:** Frozen file boundaries for modular multi-agent implementation  

---

## 1. File Allocation Matrix

| Module / Component | Allowed Files | Assigned Owner | Dependencies |
|:---|:---|:---|:---|
| **Science & Data Contract** | `lib/conditions/condition-evidence.ts`<br>`docs/conditions/science-audit.md`<br>`tests/lib/condition-evidence.test.ts` | Agent A (Science) | Existing data stores (`data-cache`, `power`, `imerg`, `remote-sensing`, `trends`) |
| **UX & Copy Specification** | `docs/conditions/ux-copy-plan.md` | Agent B (UX) | `FIELD_SHIFT_CONDITIONS_GEOSPATIAL_SCREEN_PLAN.md`, Mobbin analysis |
| **Geospatial Map Explorer Shell** | `components/field/conditions/risk-explorer.tsx`<br>`components/field/conditions/risk-map.tsx`<br>`components/field/conditions/risk-layer-selector.tsx`<br>`components/field/conditions/risk-time-control.tsx`<br>`components/field/conditions/risk-findings-sheet.tsx`<br>`tests/components/risk-explorer.test.tsx` | Agent C (Map Shell) | Agent A Contract, `mapbox-config`, `static-map`, `cells` |
| **Water Stress Panel** | `components/field/conditions/risk-panels/water-stress-panel.tsx`<br>`tests/components/risk-panels/water-stress-panel.test.tsx` | Agent D (Water) | Agent A Contract, Agent C shell props |
| **Flood Risk Panel** | `components/field/conditions/risk-panels/flood-panel.tsx`<br>`tests/components/risk-panels/flood-panel.test.tsx` | Agent E (Flood) | Agent A Contract, Agent C shell props |
| **Erosion Risk Panel** | `components/field/conditions/risk-panels/erosion-panel.tsx`<br>`tests/components/risk-panels/erosion-panel.test.tsx` | Agent F (Erosion) | Agent A Contract, Agent C shell props |
| **Heat & Cold Risk Panel** | `components/field/conditions/risk-panels/heat-cold-panel.tsx`<br>`tests/components/risk-panels/heat-cold-panel.test.tsx` | Agent G (Heat) | Agent A Contract, Agent C shell props |
| **Conditions Overview & Shell Integration** | `components/field/conditions-view.tsx`<br>`components/field/conditions-summary.tsx`<br>`components/field/conditions/risk-entry-grid.tsx`<br>`components/field/conditions-panels.tsx` (modifications only if required)<br>`lib/copy/en.ts`<br>`lib/copy/my.ts` | Coordinator (Lead) | Agents A–G deliverables |
| **Integrated QA & Verification** | `tests/components/conditions-risk-explorer.integration.test.tsx`<br>`docs/conditions/qa-report.md` | Agent H (QA) | Integrated app |

---

## 2. Hard Boundaries & Forbidden Overlaps

1. **No Shared File Writes:** No two agents may edit the same file.
2. **Read-Only Science Engine:** Physical models (`lib/engine/`, `lib/nasa/`, `lib/soil/`, `lib/server/`) are read-only.
3. **No Uncommitted Reset:** Existing uncommitted work (`report-view`, etc.) must be strictly preserved.
4. **Light Mode Only:** Strictly no `dark:` classes or dark token additions.
5. **Simplicity Contract:** Decision → Action → Reason → Evidence → Method.
