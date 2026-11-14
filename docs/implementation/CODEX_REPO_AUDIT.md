# Field Shift P0 Repository Audit

**Audit date:** 2026-11-15  
**Scope:** Read-only inspection of the current working tree plus non-destructive baseline commands. No application code was changed.  
**P0 output:** Repository truth for the v6 mobile-first plan and a bounded P1 proposal.

## 1. Source set and audit limits

| Requested source | Repository finding | Treatment |
|---|---|---|
| `FIELD_SHIFT_FINAL_MOBILE_FIRST_MUI_UX_PLAN.md` | Present, untracked, v6.0 dated 2026-11-15 | Read as the proposed UX source of truth. Its own Section 9 says its types and routes are proposals that must be checked against code. |
| `whitepaper(2).md` | **Not present under this name.** `whitepaper.md` has the matching title, v3.2 claims and references used by the UX plan. | Read `whitepaper.md`; this filename substitution is explicit and remains a documentation mismatch. |
| `whitepaper-technical-appendix.md` | Present | Read for implementation status, data contracts, provenance, limitations and deployment architecture. |
| `field-shift-mui-v6-plan.md` (“this execution plan”) | **Not found anywhere outside ignored dependency/artifact trees.** | The exact execution plan could not be audited. This P0 follows the user's supplied P0 instructions and the v6 document's P0/P1 roadmap only. The missing plan is a blocker for claiming exact plan conformance. |
| Repository guidance | `AGENTS.md`, `docs/AGENT_INDEX.md`, local Next.js 16 docs | Followed. `docs/AGENT_INDEX.md` is useful but still describes the older S01–S18 numbering, not v6 S01–S22. |

The tree was already dirty before this audit. Modified application, engine, test, dependency and documentation files were treated as the **actual current repository state** and not reverted. `package.json` itself has uncommitted additions for `test:quiet` and `test:changed`; those scripts are nevertheless real in the inspected working tree and were used as requested.

## 2. Runtime, dependencies and UI stack

`package.json` and `bun.lock` agree on the installed direct versions:

- Package manager: Bun 1.4.3 (`packageManager`); lockfile is `bun.lock`.
- Next.js 16.4.6, React 19.3.0 and React DOM 19.3.0.
- MUI Material and Icons 9.5.0 with Emotion 11.14.x.
- Tailwind CSS and `@tailwindcss/turbopack` 4.3.3.
- Zustand 5.1.0, Zod 4.6.7, Mapbox GL 3.35.0, React Map GL 8.1.3, Terra Draw 1.39.0, Vitest 5.1.0 and Playwright 1.65.1.

This is **not MUI v6** despite the absent execution plan's filename. P1 must use the installed MUI 9 APIs or make a separately approved dependency decision; it must not assume MUI v6 integration packages.

Actual styling is hybrid:

- `app/globals.css` imports Tailwind 4 and defines the light-only Field Shift token set.
- `lib/theme.ts` creates an Emotion-backed MUI theme, but its comment still names `DESIGN.md` as source of truth while `AGENTS.md` names `DESIGN_SYSTEM.md` and `app/globals.css`.
- `app/providers.tsx` implements a custom Emotion cache with `useServerInsertedHTML`, `ThemeProvider` and `CssBaseline`; it does not use an MUI-provided App Router cache provider.
- Most layout and domain components use Tailwind classes; MUI is used selectively for dialogs, alerts, inputs, switches, sliders, chips, skeletons and tooltips.
- `next.config.ts` enables Cache Components and Partial Prefetching. Current dynamic routes correctly await `params` under `Suspense`, matching the installed Next.js documentation.
- Light mode is enforced by `viewport.colorScheme`, `:root { color-scheme: light; }` and the MUI palette. There is no dark theme selector.

## 3. Actual route and surface inventory

Top-level routes:

- `/` → `app/(app)/page.tsx` → saved field list plus links to `/plan` and `/fields/new`.
- `/welcome` → `components/home/welcome.tsx` via the first-launch gate.
- `/plan` → `app/(app)/plan/rotation-explorer.tsx`, a separate rotation explorer using `rotation-engine/data/crops.json` and `/api/rotation/explore`.
- `/learn`, `/about/crops`, `/about/data` provide learning, crop-source and data-source surfaces.
- `/fields/new` and `/fields/[fieldId]/location` are full-screen Mapbox/Terra Draw routes.
- Saved-field routes are `/fields/[fieldId]`, `/rotation`, `/profile`, `/conditions`, `/compare`, `/report`, and `/questions/[questionId]`.
- There is no routed settings page, no dedicated regional-preview route and no separate S13–S18 detail routes; those responsibilities live inside existing components or dialogs.

API routes:

- `/api/field/[fieldId]/conditions`: POWER + SoilGrids + IMERG progress.
- `/api/field/[fieldId]/remote-sensing`: Landsat/AppEEARS state advancement for SMAP, vegetation and SRTM.
- `/api/field/[fieldId]/soil`, `/trends`: focused source reads.
- `/api/locations`: Mapbox or configured provider, with two explicit demo locations when unavailable.
- `/api/rotation` and `/api/rotation/explore`: the separate lightweight rotation engine.
- `/api/market/global`: external/global market loader; it is not the same as the local benchmark catalog.

## 4. V6 screen disposition

Classification meanings: **reuse** = the current surface already owns the responsibility; **move** = usable code/data exists but must be repositioned or composed into the v6 journey; **new** = no truthful farmer-facing surface currently satisfies the contract. “Move” may reuse named components without preserving the old route.

| ID | V6 responsibility | Class | Existing basis / gap | Farmer-visible purpose |
|---|---|---|---|---|
| S01 | Welcome & language | reuse | `/welcome`, `Welcome`, `WelcomeGate`; language state is session-only | Know what the tool does, choose language, understand the data notice. |
| S02 | My Farm / home | move | `/` and `FieldsList` exist; needs v6 next-task and regional-explore emphasis | Start an exploration or resume the next useful field task. |
| S03 | Find farming area | move | `/plan` location search, `/api/locations`, geolocation and Mapbox geocoder exist; no township/village-first saved draft contract | Select a recognizable approximate area without drawing a parcel. |
| S04 | Exact boundary | reuse | `LocationPicker`, `EditLocation`, `FieldMap`, polygon validation and coordinate fallback | Optionally mark the real parcel for area and imagery. |
| S05 | Field context | move | Irrigation and field facts exist in `FarmProfile` and `Field.constraints` | Record field type and usable water context. |
| S06 | Crop sequence | move | `RotationEditor`, `CropCalendar`, `RotationSlot` and `/plan` crop selection exist in two flows | Confirm crops, order, season and timing. |
| S07 | Practices & observations | move | Establishment, residue and drainage fields exist across `RotationSlot`, `FarmProfile` and editor UI; no tactile soil-feel contract | Record how crops are sown, straw use and what the farmer observed. |
| S08 | Goals & hard limits | move | `FarmProfile`, `LimitChecks`, `FarmerGuidedFlow`, priorities and constraints exist but are not one v6 drawer | Separate preferences from constraints that can block an option. |
| S09 | Review details | new | Field hub/profile/rotation summaries exist, but no single material-assumption confirmation surface or versioned analysis snapshot | Correct decisive inputs before analysis. |
| S10 | Evidence progress | move | `useFieldAnalysis`, source statuses, polling and loading UI exist; not integrated into the Plan main surface | See what evidence is ready, pending, missing or failed. |
| S11 | Preview / compare | new | `RotationCompare` supports confirmed fields; `/plan` returns lightweight scenarios after many inputs. Neither implements area + main crop → labeled regional examples | Compare honest regional examples first, then qualified field options. |
| S12 | Why this option? | reuse | `OptionDetail`, explanation records, evidence and provenance components | Understand one reason, one trade-off and what could change the result. |
| S13 | Water & planting | move | Water/root-zone/paddy results and `MoistureClockRibbon` exist in compare/conditions | Understand historical water stress and planting-window limits. |
| S14 | Past weather risks | move | `ConditionsView`, exposure results, season strips and trends exist | Inspect stage-specific risk across past seasons, not a forecast. |
| S15 | Soil & crop health | move | Nitrogen, cover, erosion, pest and mechanism outputs are rendered in comparison details | Understand screening indicators and practice effects without diagnosis claims. |
| S16 | Satellite field history | move | `ConditionsPanels`, Landsat/HLS observations and quality gates exist | Inspect clear-date vegetation history for an exact field. |
| S17 | Costs & markets | move | `FarmProfile`, economics assessment and benchmark data exist; no dedicated result drill-down | Enter local costs/prices and see conditional margin and buyer gaps. |
| S18 | Adjust strategy | reuse | `WhatIf`, scenario transforms and reversible recomparison exist | Test a supported change without overwriting the saved plan. |
| S19 | Adviser report | reuse | `/report`, `ReportView`, print/share behavior and provenance exist | Save or discuss evidence, limitations and local checks. |
| S20 | Crop library / Learn | move | `/learn` and `/about/crops` split plain-language help from sourced crop rules | Recognize supported crops and understand practical guidance. |
| S21 | Data & methods | move | `/about/data`, provenance UI and source metadata exist; some displayed statuses overclaim wiring | Audit sources, periods, scale, quality and assumptions. |
| S22 | Settings, privacy & backup | move | Settings sheet, units/language state, repository export/import exist; locale/unit persistence and a complete privacy surface do not | Control display, local records, export/import and disclosure choices. |

## 5. Storage, localization, map and privacy seams

### Browser storage

- Saved `Field` and `Rotation` records use IndexedDB database `nasa-farming-app`, store `keyval`, keys `field:<id>` and `rotation:<id>` through `lib/store/repository.ts`.
- Conditions and remote results are cached separately with `idb-keyval` keys `conditions_cache:<fieldId>` and `remote_cache:<fieldId>`, cache schema version 3.
- First-launch consent alone uses localStorage key `fieldshift.settings.v1`.
- The locale and area unit Zustand store is **not persisted**. Reload returns English/hectares.
- Backup schema is `{ app: "nasa-farming-app", version: 2, exportedAt, fields, rotations }`; import replaces matching IDs. Cached source payloads and settings are not in the backup.
- There is no account, cross-device sync or remote field-record database in the inspected code.

### Localization

- `lib/copy/en.ts` and `lib/copy/my.ts` exist, but most components import English copy or contain inline English.
- Only welcome selects localized copy; settings toggles Zustand state; report reads area unit. Root `<html lang="en">` never follows the store.
- `Noto_Sans_Myanmar` is configured, but the UI is not a complete Myanmar localization and no agricultural-language review artifact is wired to runtime copy.

### Map and outbound disclosure

- Exact maps use a public `NEXT_PUBLIC_MAPBOX_TOKEN` only when it starts with `pk.`. Secret `sk.` tokens are rejected in client configuration.
- `FieldMap` lazy-loads client-side and uses Mapbox satellite streets plus Terra Draw rectangles/polygons. The create flow currently requires a polygon, even though the domain supports points.
- Field records remain in IndexedDB, but analysis sends centroid + client field ID to the app server; remote sensing sends the polygon. The server forwards location/geometry to POWER, GES DISC/Earthdata, SoilGrids and Planetary Computer/AppEEARS as applicable. Map search/tiles go to Mapbox or the configured location provider.
- The v6 promise that a privacy-sensitive farmer may use an approximate point conflicts with the current new-field UI's polygon requirement. `/plan` can use coordinates without saving a field, but it is a different engine and draft model.

## 6. Scientific engines and concrete contracts

### Saved-field comparison engine (richer, current field flow)

- Entrypoint: `compareRotations(data: EngineData, currentRotation: Rotation, opts?)` in `lib/engine/compare.ts`.
- Input assembly: `useFieldAnalysis` → API/cache payloads → `buildEngineData` in `lib/analysis/engine-data.ts`.
- Result: `ComparisonResult` with `current`, `alternatives`, `rejected`, `shortfall`, `mcda`, sensitivity rows, baseline, rain source counts, context indicators, `dataGaps`, region and timestamp.
- Candidate result: `EvaluatedOption` with fit status, slot evaluations, water/paddy/root-zone outputs, structure, nitrogen, erosion, mechanisms, vegetation gaps, pest screens, forage, economics, overlaps, dry-year fit, metrics, evidence, risks, unknowns and explanations.
- Ranking: `rankRotations` returns `McdaResult.status` of `ranked`, `unresolved` or `no-priorities`; partial-evidence candidates are separate and missing values are not imputed.
- Candidate catalog: `TEMPLATES` in `lib/engine/candidates.ts`, filtered by region, current sequence, excluded crops, irrigation and calendars. It is a project-authored template set, not an API-derived or locally validated recommendation catalog.

### `/plan` rotation explorer engine (separate, lightweight)

- Entrypoint: `recommend(value)` in `lib/rotation/engine.ts`, exposed by `/api/rotation` and mapped from simple UI input by `/api/rotation/explore`.
- Data source: `rotation-engine/data/crops.json`, not `lib/data/crops/myanmar.ts`.
- Result: scenario objects with `infeasible | requires_review | screened_plausible`, hard constraints, cautions, missing information, stages, observations, signals, evidence, explanations and heuristic alignment/coverage.
- It uses demo snapshots or POWER monthly historical averages. It does not return the saved-field `ComparisonResult`, `EvaluatedOption`, criterion evidence envelopes or regional templates.

### Additional decision code

`lib/engine/farmer-decision.ts` defines farmer decision inputs, hard-gate classification and deterministic sensitivity helpers. It is used by `FarmerGuidedFlow` and tests, but it is not the ranking entrypoint inside `compareRotations`. P1 must not describe these helpers as a single unified engine until the integration boundary is chosen and tested.

## 7. Crop and regional-catalog truth

- Supported region type is exactly `ayeyarwady | magway | shan`; polygon/point resolution uses bundled simplified boundaries. Outside returns `unsupported`.
- Myanmar crop library version is `myanmar-2026.11.1` with 11 strategy crops: rice, black gram, green gram, sesame, groundnut, chickpea, pigeon pea, maize, soybean, lablab and sunn hemp.
- Four additional crops—wheat, sorghum, cowpea, crimson clover—are `reference-only`: selectable in the editor but never used by `strategyCrops` or regional templates.
- Every Myanmar profile has `varietyValidated: false`. Many calendars, thresholds, nitrogen values and rotation rules are explicitly `analyst-assumption`.
- Region candidate lists are defined in `lib/data/regions.ts`; actual rotation examples are separately hard-coded in `lib/engine/candidates.ts`: 5 Ayeyarwady, 4 Magway and 4 Shan templates before filtering.
- The v6 “area + main crop” catalog does not exist. Current templates are region-level and are not filtered by a selected main crop except indirectly when the confirmed current sequence is removed. Therefore the code cannot yet truthfully satisfy the v6 two-choice preview contract.
- The `/plan` crop JSON is another catalog with another ID/model contract. P1 needs one explicit mapping or deprecation decision; silent merging would be unsafe.

## 8. Source availability and doc/code differences

| Source/capability | Actual code availability | Difference that must remain visible |
|---|---|---|
| NASA POWER | Connected server adapter; 2016 to previous month for field analysis; 1981 onward for trends | Whitepaper says “2016 to present”; runtime intentionally stops at the last completed month. Regional values remain coarse and unvalidated. |
| SoilGrids | Connected public adapter with nearest-cell fallback and 30-day cache | Nearest valid cell can be about 2–9 km away and is labeled in the source resolution; it is not always the field's own 250 m cell. |
| IMERG | CMR/OPeNDAP adapter and backfill; gated by `EARTHDATA_TOKEN`; 95% baseline rule before primary use | No authenticated end-to-end result is established by this audit or the source docs. POWER fallback is real; source mixing is counted. |
| Landsat C2 | Planetary Computer STAC/COG path is primary for the field vegetation slot | The `hls` state/property name can contain Landsat results; provider metadata is required to label it correctly. |
| HLS | AppEEARS fallback, gated by Earthdata username/password | Partially implemented and not verified live in the supplied docs. |
| SMAP | AppEEARS point job, gated | Context only, not field moisture; no verified authenticated extraction in the supplied record. |
| SRTM | AppEEARS area job and Horn slope, gated | Polygon/neighborhood required; it screens terrain, not soil loss. |
| MODIS | Extractor/QA code exists in `planetary-computer.ts`, but `useFieldAnalysis` and remote route never request or return it | `app/(app)/about/data/page.tsx` labels regional MODIS vegetation “Working”; whitepaper/appendix correctly call it proposed and unwired. The UI status is an overclaim. |
| ECOSTRESS | QA helper/product metadata only; no ingestion state in `useFieldAnalysis` | About Data marks it “Working” whenever AppEEARS credentials exist, but credentials do not create an implemented ingestion path. Whitepaper correctly calls it proposed. |
| GRACE | No active adapter or engine input found | V6 correctly limits it to educational context; do not add a working status. |
| Economics | Farmer ranges plus `real-world-economics.ts` benchmarks and interval logic | Scientific validation remains absent. Global price endpoint is separate and must not be presented as the same local benchmark provenance. |

The technical appendix says “400 automated unit tests (39 suites)”; the actual baseline on this working tree is **439 tests in 43 Vitest files**, plus **23 Node integration tests**. This is a doc-count drift, not scientific validation.

## 9. Unknown, unresolved and stale-result handling

Existing truthful behavior:

- Source states distinguish `ok`, `unconfigured`, `unavailable`, `pending` and `not-requested` in engine input; remote route states use `unconfigured | pending | ok | unavailable`.
- Missing climate becomes empty records and explicit gaps; missing soil remains null; IMERG only replaces POWER after its completeness threshold.
- MCDA separates partial candidates and becomes `unresolved` if top-priority evidence is absent.
- Candidate shortages and rejected template reasons are returned explicitly.
- Source indicators carry missing reasons and provenance details; comparison/report reuse the same analysis hook.

Gaps against v6:

- There is no persisted `ViewMode`, no `regional-preview`/`field-comparable` transition contract and no unified `SourceStatus` vocabulary matching the proposed UX types.
- Input edits do not create a versioned “stale result” record. React recomputation handles current in-memory values, but the v6 lifecycle and retained-old-output label are not implemented.
- `DateConfidence` supports exact/approx/typical but not dekad or interval bounds. Existing defaults choose an exact ISO day and label it typical.
- `EstablishmentMode` has tillage, zero till, relay broadcast and unknown, but no explicit intercrop/grown-together representation; overlap is generally treated as `does-not-fit`.
- A farmer soil-feel observation can be represented only loosely through strings/decision helpers; the v6 typed qualitative observation and non-imputation boundary do not exist.

## 10. Deployment constraints

- Cache Components require the Node.js runtime according to the installed Next.js 16 documentation. The code also imports `node:fs`, `node:path`, `node:sqlite` and `Buffer`, so Edge deployment is not supported.
- `.cache/ingestion_queue.sqlite` is the default queue ledger. On a read-only/ephemeral filesystem or without `node:sqlite`, it silently falls back to process memory; jobs and results then do not survive instance teardown or coordinate across instances.
- Upstash Redis is optional for the general server cache, but the SQLite ingestion queue is not replaced by Redis. Serverless multi-instance queue semantics are therefore not durable as described by the appendix.
- Long outbound requests need access to NASA POWER, GES DISC/CMR/OPeNDAP, AppEEARS, Planetary Computer, SoilGrids and optional market/location providers. `maxDuration = 60` is set only on the soil route.
- Earthdata secrets must remain server-only. Mapbox uses a build-exposed public token and should be URL-restricted. Optional `PLANETARY_COMPUTER_API_KEY`, `PREFER_APPEEARS`, provider URLs and Upstash settings are used in code; `.env.example` omits the first two.
- Next/font downloads Noto Sans Myanmar at build time unless already cached by the build system.
- Browser IndexedDB availability/quota is a functional dependency. Blocking storage degrades saved fields and cached evidence; there is no server recovery.

## 11. Baseline commands and literal results

Run from repository root on 2026-11-15:

| Command | Result |
|---|---|
| `bun run typecheck` | **Pass**, exit 0. `tsc --noEmit` produced no diagnostics. |
| `bun run lint` | **Pass with warning**, exit 0. One `@next/next/no-img-element` warning in `tests/components/field-overview.test.tsx:14`; 0 errors. |
| `bun run test:quiet` | **Pass**, exit 0. 43 files and 439 tests passed. Expected stderr from the timeout-resilience test and an experimental `node:sqlite` warning were printed. |
| `bun run test:rotation` | **Pass**, exit 0. 23/23 Node integration tests passed. |
| `bun run build` | **Not established.** Failed twice, including an approved retry outside the workspace sandbox, with a Turbopack internal panic while processing `mapbox-gl.css`: it attempted to create a process/bind a port and received `Operation not permitted`. This is an execution-environment restriction or Next/Turbopack failure, not evidence of an application type/test failure; no successful build is claimed. |

No live external-source call was made, so no source credential, crop catalog or remote retrieval is claimed operational beyond code and tests.

## 12. Precise P1 file-scope proposal

P1 should be a **contract-integration phase**, not a visual rewrite of all field screens.

Proposed application scope:

1. **Unify Plan domain boundary**
   - Add `lib/ui-adapters/plan.ts` (or an equivalently named single mapper) for v6 view modes, source states and evidence-safe strategy cards.
   - Decide and document whether `/plan` calls the saved-field `compareRotations` stack or retains `lib/rotation/engine.ts`. Do not present both result shapes as one comparison.
   - Add a versioned regional preview catalog keyed by exact `RegionId + mainCropId`, with provenance/review status; do not derive it by guessing from `TEMPLATES`.

2. **New v6 Plan surface**
   - Rewrite only `app/(app)/plan/page.tsx` and `app/(app)/plan/rotation-explorer.tsx`, or replace the latter with focused components under a new `components/farmer/` directory.
   - Implement area + main crop → regional preview; inline next-crop/water/goal refinements; explicit regional/field/unresolved/source-error labels.
   - Reuse `components/field/option-detail.tsx`, provenance primitives and existing analysis status concepts where their contracts match.

3. **Draft and invalidation state**
   - Extend `lib/store/` with a versioned Plan draft/invalidation record. Keep it separate from saved `Field` until the farmer confirms a field.
   - Persist locale/units only after agreeing backup/privacy behavior.

4. **Navigation and design synchronization**
   - Update `components/shell/app-nav.tsx`, `lib/theme.ts`, `app/globals.css` and `DESIGN_SYSTEM.md` together for My Farm / Plan / Learn and MUI 9 component overrides.
   - Keep light-only behavior and data-color semantics.

5. **Targeted truth fixes included in P1 acceptance**
   - Correct `app/(app)/about/data/page.tsx` so MODIS and ECOSTRESS cannot show “Working” merely from code/credentials.
   - Add tests for regional-vs-field labels, fewer-than-three templates, top-priority missing evidence, source-specific failure and stale-result invalidation.

Proposed test scope:

- Add focused Plan/UI-adapter tests under `tests/lib/` and `tests/components/`.
- Keep `tests/lib/compare.test.ts`, `tests/lib/nasa-sources.test.ts`, `tests/lib/data-truthfulness.test.ts`, `tests/lib/flow.test.ts` and `test/rotation-integration.test.mjs` as regression boundaries.
- Run the same baseline scripts plus a successful production build in an environment that allows Turbopack's worker process/port behavior.

## 13. P1 blockers / decisions required

1. Restore or provide `field-shift-mui-v6-plan.md`; its absence prevents exact execution-plan conformance.
2. Approve the authoritative Plan engine/result contract: richer saved-field engine, lightweight `/plan` engine, or an explicit adapter with stated capability loss.
3. Provide a reviewed, versioned `region + main crop` preview catalog. Current crop lists/templates are assumptions and do not satisfy that contract.
4. Define the v6 approximate-area draft/privacy behavior because current saved field creation requires a polygon.
5. Resolve the crop-transition model for relay/intercrop before accepting overlaps quantitatively.
6. Decide deployment topology for durable queues/caches; local SQLite + memory fallback is not multi-instance durable.
7. Correct source-status truth for MODIS/ECOSTRESS before exposing S21 as authoritative.
8. Treat Myanmar copy, crop images and agricultural-language review as missing inputs, not completed assets.
9. Re-run `bun run build` on an unrestricted compatible builder and investigate/report the Turbopack panic if it reproduces.

**Stop point:** This document completes P0 audit only. No P1 application change has been made.
