# Field Shift P1 Context Brief

**Status:** P0 handoff only. Repository truth as inspected 2026-11-15.  
**Rule:** Do not begin P1 until the blockers at the end are resolved. Do not infer successful remote data access from adapter code or credentials.

## Product contract

- Field Shift is historical decision support, not a forecast, prescription, guaranteed yield/profit result or NASA endorsement.
- V6 first value: **area + main monsoon crop → labeled regional examples**, then inline refinement into a field-informed comparison.
- Unknown is never zero. Historical replay is never future weather. A priority is not a hard constraint.
- Light mode only. Data colors are data-only and always paired with text/icon meaning.
- Scientific authority: `whitepaper.md` (requested `whitepaper(2).md` is absent) and `whitepaper-technical-appendix.md`.
- UX proposal: `FIELD_SHIFT_FINAL_MOBILE_FIRST_MUI_UX_PLAN.md`.
- Requested execution plan `field-shift-mui-v6-plan.md` is absent.

## Installed platform

- `next@16.4.6`, `react@19.3.0`, `@mui/material@9.5.0`, `tailwindcss@4.3.3`, Bun lockfile.
- Cache Components + Partial Prefetching are enabled in `next.config.ts`; Node runtime is required.
- Styling contracts: `DESIGN_SYSTEM.md` + `app/globals.css`; MUI mapping in `lib/theme.ts`; Emotion SSR in `app/providers.tsx`.
- The “MUI v6” plan name does not match installed MUI 9.5.0.

## Route map

| Route | Current owner |
|---|---|
| `/welcome` | `components/home/welcome.tsx` |
| `/` | `components/field/fields-list.tsx` |
| `/plan` | `app/(app)/plan/rotation-explorer.tsx` |
| `/fields/new`, `/fields/:id/location` | `components/field/location-picker.tsx`, `components/map/field-map.tsx` |
| `/fields/:id` | `components/field/field-overview.tsx` |
| `/fields/:id/rotation` | `components/field/rotation-editor.tsx` |
| `/fields/:id/profile` | `components/field/farm-profile.tsx` |
| `/fields/:id/conditions` | `components/field/conditions-view.tsx` |
| `/fields/:id/compare` | `components/field/rotation-compare.tsx` |
| `/fields/:id/report` | `components/field/report-view.tsx` |
| `/learn`, `/about/crops`, `/about/data` | Learn, crop catalog, source catalog |

## Screen disposition

| ID | Class | Purpose / existing anchor |
|---|---|---|
| S01 Welcome | reuse | Role, language, notice; `/welcome` |
| S02 My Farm | move | Start/resume useful task; `/` |
| S03 Area | move | Approximate recognizable place; `/plan`, `/api/locations` |
| S04 Boundary | reuse | Optional parcel; `LocationPicker`/`FieldMap` |
| S05 Context | move | Water/field facts; `FarmProfile` |
| S06 Sequence | move | Actual crops/order/timing; `RotationEditor` |
| S07 Practices | move | Establishment/residue/observations; editor/profile fields |
| S08 Goals/limits | move | Preferences vs enforced constraints; profile/guided flow |
| S09 Review | new | Confirm material assumptions before analysis |
| S10 Evidence | move | Ready/pending/missing/error; `useFieldAnalysis` |
| S11 Preview/compare | new | Regional examples then field comparison; no current unified path |
| S12 Why | reuse | Causal explanation; `OptionDetail`/provenance |
| S13 Water | move | Water stress/planting window; compare/conditions |
| S14 Weather | move | Past stage risks; conditions/season strip |
| S15 Soil/health | move | Nitrogen/cover/erosion/pest screens; option detail |
| S16 Satellite | move | Quality-screened field history; conditions panels |
| S17 Money | move | Local ranges/market gaps; profile/economics |
| S18 Adjust | reuse | Reversible what-if; `WhatIf` |
| S19 Report | reuse | Save/print/discuss; `/report` |
| S20 Crops/Learn | move | Crop recognition and guidance; `/learn`, `/about/crops` |
| S21 Methods | move | Provenance and source truth; `/about/data` |
| S22 Settings/privacy | move | Units/language/local data/backup; settings sheet + repository |

## Two engine stacks: do not blur them

### Saved-field engine

- Input types: `Field`, `Rotation`, `EngineData` in `lib/types.ts`, `lib/engine/data.ts`.
- Assembly: `useFieldAnalysis()` → `buildEngineData()`.
- Entrypoint: `compareRotations()` in `lib/engine/compare.ts`.
- Result: `ComparisonResult` → `EvaluatedOption[]`, `McdaResult`, rejected/shortfall, source mix, context, gaps.
- UI consumers: compare, conditions and report.
- Candidate source: `TEMPLATES` and `generateCandidates()` in `lib/engine/candidates.ts`.

### `/plan` explorer engine

- Input: `FarmerRequest` → `buildEngineRequest()`.
- Entrypoint: `recommend()` in `lib/rotation/engine.ts` via `/api/rotation`.
- Crop source: `rotation-engine/data/crops.json`.
- Result: lightweight `Scenario[]` with status, constraints, cautions, missing information, heuristic alignment.
- It is not `ComparisonResult` and does not implement the v6 regional-preview contract.

`lib/engine/farmer-decision.ts` adds tested hard-gate/sensitivity helpers. It is not the ranking core inside `compareRotations()`.

## Regional and crop truth

- `RegionId`: `ayeyarwady | magway | shan`; outside is `unsupported`.
- Crop library: `lib/data/crops/myanmar.ts`, version `myanmar-2026.11.1`.
- Strategy crop IDs: rice, black-gram, green-gram, sesame, groundnut, chickpea, pigeon-pea, maize, soybean, lablab, sunn-hemp.
- Reference-only: wheat, sorghum, cowpea, crimson-clover.
- All crop profiles have `varietyValidated: false`; many parameters/calendars are `analyst-assumption`.
- Templates: 5 Ayeyarwady, 4 Magway, 4 Shan before filtering.
- Missing contract: no versioned catalog keyed by `RegionId + mainCropId`; do not fabricate it from candidate crop lists.

## Source contract

| Source | Actual status boundary |
|---|---|
| POWER | Connected adapter; coarse historical weather; unvalidated |
| SoilGrids | Connected; model estimate; nearest-cell fallback can move away from parcel |
| IMERG | Token-gated; 95% baseline coverage before primary use; POWER fallback counted |
| Landsat C2 | Primary vegetation path through Planetary Computer |
| HLS | Earthdata-gated fallback |
| SMAP | Earthdata-gated 9 km context only |
| SRTM | Earthdata-gated terrain screen |
| MODIS | Extractor exists, but nothing requests it; proposed/unwired |
| ECOSTRESS | QA helper only; proposed/unwired |
| GRACE | No active adapter |

Fix `app/(app)/about/data/page.tsx`: it currently calls MODIS “Working” and makes ECOSTRESS “Working” from AppEEARS credentials, contradicting actual wiring and the whitepaper.

## Persistence and privacy

- IndexedDB DB/store: `nasa-farming-app` / `keyval`.
- Record keys: `field:<id>`, `rotation:<id>`.
- Evidence caches: `conditions_cache:<fieldId>`, `remote_cache:<fieldId>`, schema v3.
- LocalStorage: `fieldshift.settings.v1` stores only notice acceptance.
- Locale/area unit are not persisted. Root HTML remains `lang="en"`.
- Backup v2 contains fields + rotations only.
- Centroid and client field ID leave the device for point sources; polygon leaves for satellite jobs; Mapbox gets searches/tiles.
- Current saved-field creation requires a polygon. Approximate-point privacy flow is not implemented in that store journey.

## Unknown/unresolved contracts already present

- Engine source status: `ok | unconfigured | unavailable | pending | not-requested`.
- Remote status: `unconfigured | pending | ok | unavailable`.
- Fit: `fits | does-not-fit | not-confirmed`.
- MCDA: `ranked | unresolved | no-priorities`; partial candidates are separate.
- Missing evidence remains null/unknown; candidate shortage and rejection reasons are returned.

Missing for v6: persisted view mode, unified source vocabulary, stale-result versioning, dekad/date intervals, typed soil-feel observation, and supported intercrop/relay overlap semantics.

## Deployment constraints

- Node runtime only; code uses filesystem, `node:sqlite` and Buffer.
- Queue defaults to `.cache/ingestion_queue.sqlite`; failure falls back to per-process memory.
- Upstash can persist general cache but does not replace the queue ledger.
- Multi-instance/serverless durability is unresolved.
- Server needs outbound access to source services and server-only Earthdata secrets.
- `NEXT_PUBLIC_MAPBOX_TOKEN` is public/build-exposed and must start `pk.`.
- Browser IndexedDB is required for saved records; no account/server recovery exists.

## Baseline snapshot

- `bun run typecheck`: pass.
- `bun run lint`: 0 errors, 1 test-only `<img>` warning.
- `bun run test:quiet`: 43 files, 439 tests passed.
- `bun run test:rotation`: 23 tests passed.
- `bun run build`: not verified; Turbopack panicked twice on `mapbox-gl.css` because process/port binding returned `Operation not permitted`, including outside-workspace-sandbox retry.

## P1 proposed scope

1. Choose one authoritative Plan result contract.
2. Add one typed UI adapter boundary for v6 modes/evidence/statuses.
3. Add a reviewed, versioned `region + main crop` preview catalog.
4. Rework `/plan` into area + crop → labeled preview → inline refinements.
5. Add versioned Plan draft and stale-result invalidation under `lib/store/`.
6. Reuse explanation/provenance/analysis primitives; do not rewrite engine math for UI completeness.
7. Synchronize `components/shell/app-nav.tsx`, `lib/theme.ts`, `app/globals.css` and `DESIGN_SYSTEM.md`.
8. Correct MODIS/ECOSTRESS source statuses and add focused contract tests.

## Blockers before P1

1. Missing `field-shift-mui-v6-plan.md`.
2. No decision on saved-field engine vs `/plan` engine.
3. No reviewed area+main-crop regional catalog.
4. No approved approximate-point/draft/privacy model.
5. Relay/intercrop quantitative semantics unresolved.
6. Queue/cache deployment topology unresolved.
7. Myanmar agricultural copy/images/review are not supplied.
8. Production build needs verification on an environment that permits Turbopack worker binding.

**Stop after P0. No application-code change is authorized by this brief.**
