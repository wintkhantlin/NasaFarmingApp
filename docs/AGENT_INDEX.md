# AI Agent Fast Reference & File Index

> **Purpose:** High-density, token-efficient reference for AI agents.  
> **Rule:** Consult this index instead of reading giant documents (`PLAN.md`, `DATASET_RESEARCH_DOSSIER.md`, `UX.md`).

---

## 1. Quick Directory & Responsibility Map

| Path | Responsibility | Primary Files |
|:---|:---|:---|
| `app/(app)/` | Main application routes (wrapped in layout chrome) | `page.tsx` (Home/Field List), `learn/page.tsx` |
| `app/(app)/fields/[fieldId]/` | Field sub-routes (wrapped in `FieldShell`) | `page.tsx` (Overview), `rotation/`, `conditions/`, `pests/`, `compare/`, `trends/`, `profile/`, `report/`, `share/`, `questions/` |
| `app/(map)/` | Full-screen map views (no header/tabbar) | `fields/new/page.tsx`, `fields/[fieldId]/location/page.tsx` |
| `app/welcome/` | First launch onboarding cover (S01) | `page.tsx` |
| `components/field/` | Field-specific UI views & controls | `field-overview.tsx`, `rotation-editor.tsx`, `rotation-compare.tsx`, `conditions-view.tsx`, `farm-profile.tsx`, `report-view.tsx`, `what-if.tsx`, `question-form.tsx` |
| `components/shell/` | Application chrome | `app-nav.tsx` (HeaderNav, TabBar), `welcome-gate.tsx` (First-launch guard), `brand-mark.tsx` |
| `components/ui/` | Reusable design tokens & primitives | `button.tsx`, `panel.tsx`, `reading.tsx`, `risk-chip.tsx`, `status.tsx`, `icon.tsx`, `stepper.tsx`, `judgment-note.tsx` |
| `lib/engine/` | Agronomic calculations & MCDA | `mcda.ts` (Rank-sum scoring), `limits.ts` (Boundary checks), `questions.ts` (Unknowns), `scenario.ts` (What-If), `trend.ts` (Mann-Kendall) |
| `lib/store/` | Zustand client-side state stores | `fields-store.ts` (Fields & Rotations), `settings-store.ts` (Consent), `locale-store.ts` (en/my) |
| `lib/nasa/` & `lib/soil/` | External API clients & adapters | POWER, IMERG, AppEEARS (SMAP/HLS/SRTM/MODIS/ECOSTRESS), Planetary Computer (Landsat/MODIS), SoilGrids; orchestration in `lib/server/remote-sensing.ts` |
| `lib/geo/` | Geospatial math & static maps | `format.ts`, `static-map.ts`, `field-clip.ts` |
| `lib/validation/` | Ground-truth checks of inputs (`npm run validate:weather`, network) | `metrics.ts`, `ghcn.ts`, `weather.ts`, `report.ts`; findings in `docs/validation/README.md` |

---

## 2. Screen Inventory Map (S01–S18)

| ID | Screen Name | Route | Primary Implementation File |
|:---|:---|:---|:---|
| **S01** | First Launch | `/welcome` | `components/home/welcome.tsx` |
| **S02** | Field List | `/` | `components/field/fields-list.tsx` |
| **S03** | Field Map | `/fields/map` | `components/map/field-map.tsx` |
| **S04** | Mark Field | `/fields/new` | `components/field/location-picker.tsx` |
| **S05** | Farm Profile & Limits | `/fields/:id/profile` | `components/field/farm-profile.tsx` |
| **S06** | Field Hub | `/fields/:id` | `components/field/field-overview.tsx` |
| **S07** | Conditions & History | `/fields/:id/conditions` | `components/field/conditions-view.tsx`, `conditions-panels.tsx` |
| **S08** | Rotation Editor | `/fields/:id/rotation` | `components/field/rotation-editor.tsx` |
| **S09** | Priorities & Limits | `/fields/:id/profile#limits`| `components/field/farm-profile.tsx` |
| **S10** | Compare Rotations | `/fields/:id/compare` | `components/field/rotation-compare.tsx`, `compare-entry.tsx` |
| **S11** | Option Detail | `/fields/:id/compare` | `components/field/option-detail.tsx`, `season-strip.tsx` |
| **S12** | Finding Detail | Modal / Drawer | `components/ui/provenance.tsx` |
| **S13** | Explain a Term | `/learn#terms` | `components/learn/learn-list.tsx` |
| **S14** | Answer an Unknown | `/fields/:id/questions/:qId`| `components/field/question-form.tsx` |
| **S15** | Learn & Library | `/learn` | `components/learn/learn-list.tsx` |
| **S16** | Share & Print Report | `/fields/:id/report` | `components/field/report-view.tsx`, `share-report.tsx` |
| **S17** | Long-Term Trends | `/fields/:id/trends` | `components/field/trends-view.tsx` |
| **S18** | What-If Simulator | Modal | `components/field/what-if.tsx` |
| **S19** | Pests and Diseases | `/fields/:id/pests` | `components/field/pests-view.tsx` (engine `lib/engine/pest-outlook.ts`, rules `lib/data/crops/weather-disease-rules.ts`, hosts `lib/data/crops/host-organisms.ts`) |

---

## 3. Zustand Stores & LocalStorage Keys

- **`useFieldsStore`** (`lib/store/fields-store.ts`):
  - Storage Key: `fieldshift.fields.v1`
  - State: `fields: Field[]`, `rotations: Record<string, Rotation[]>`, `activeFieldId: string | null`
  - Helpers: `deriveStepStates(field, rotations)` returns `{ location, rotation, profile, conditions, compare }`
- **`useSettingsStore`** (`lib/store/settings-store.ts`):
  - Storage Key: `fieldshift.settings.v1`
  - State: `hydrated: boolean`, `dataNoticeAcceptedAt: string | null`
- **`useLocaleStore`** (`lib/store/locale-store.ts`):
  - State: `locale: 'en' | 'my'` (Myanmar Unicode)

---

## 4. Token-Efficient Verification Commands

- **Run Single Test (Fastest & lowest tokens):**  
  `npx vitest run tests/components/farm-profile.test.tsx`
- **Run Changed Tests:**  
  `npx vitest run --changed`
- **Run Full Suite Quietly (2 lines output, no terminal flood):**  
  `npx vitest run --reporter=dot`
- **TypeScript Check:**  
  `npm run typecheck`
