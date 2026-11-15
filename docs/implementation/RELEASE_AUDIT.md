# P8 release audit

Audit date: 2026-11-15 (environment date; browser/download timestamps used UTC 2026-11-14). Scope: local migration verification only. No deployment or production mutation.

## Decision

**NO RELEASE for farmer-facing decision use or a claimed completed P0–P7 migration.** A supervised demonstration of the regional preview and the reproducible offline engine experiment is possible with the limitations below. Production build, complete browser journey, full accessibility, agricultural translation and field validation gates are not met.

The previous P7 completion message was broader than its evidence: its component tests did not establish mobile/desktop layout, report export, restore, or a complete journey. P8 adds targeted real-browser evidence, but does not certify the missing paths.

## Inputs inspected

- `docs/implementation/CONTEXT_BRIEF.md` (still a P0 snapshot, not current implementation status).
- `CODEX_REPO_AUDIT.md`, `P3_REFINEMENT_CONTRACT.md`, `P6_LIMITATIONS.md`, `P7_TRANSLATION_REVIEW.md` in that directory.
- No separate P1/P2/P4/P5 completion reports exist there. `field-shift-mui-v6-plan.md` remains absent. The supplied UX v6 screen contracts are in `FIELD_SHIFT_FINAL_MOBILE_FIRST_MUI_UX_PLAN.md`.
- Actual package scripts, saved-field and Plan consumers, display adapter, engine, schemas, repository, source adapters, tests and targeted cached POWER metadata.
- The workspace already contains extensive uncommitted migration work. P8 preserves it; this is not an audit of a clean tagged release.

## Commands and actual results

| Command | Result |
| --- | --- |
| `npm run lint` | Exit 0; 0 errors, 1 existing `@next/next/no-img-element` warning in `tests/components/field-overview.test.tsx:14`. |
| `npm run typecheck` | Exit 0, including final P8 code and tests. |
| `npm run test:quiet` | Initial: 51 files / 474 tests passed. Final after repairs: **52 files / 476 tests passed**. Includes scientific suites unchanged by P8. Simulated NASA timeout logs expected stderr; SQLite emits an experimental warning. |
| `npm run test:rotation` | Initially 21/23 passed, 2 exact location-shape assertions failed. After contract repair: **23/23 passed**, no skips. |
| `npx vitest run tests/components/release-truthfulness.test.tsx --reporter=dot` | 2/2 passed: credentials are not successful retrieval; unconfirmed field cannot get a field-informed report. |
| `npx --no-install playwright test --list` | Exit 1, zero Playwright tests. No repo Playwright config or E2E script exists. Default discovery collects Vitest and skill test files, producing incompatible imports and unrelated skill-test failures. These are not application E2E results. |
| `npm run build` | Exit 1: Turbopack CSS worker fails creating process/binding port (`EPERM`) while processing Mapbox CSS. Repeated with elevated execution: same failure. Production output not verified. |
| `npm run dev -- --port 3098` | Sandbox: listen EPERM. Elevated attempt initially announced Ready, then exited because another Next server was running on 3001. Used that existing local server; did not kill it. |
| `bunx react-doctor@latest . --verbose --scope changed` | Sandbox tempdir EPERM; elevated final scan succeeds: **65/100, 48 findings** (15 performance, 16 maintainability, 7 accessibility, 10 bugs). Not an accessibility conformance pass. |
| `node test/p8-nasa-demo.mjs` | Exit 0, actual cached NASA ablation described below. No network or synthetic weather used. |

There is **no repository accessibility command**. No axe/WCAG conformance result is claimed. Browser checks below inspect selected accessibility behavior. React Doctor still flags labels in `farmer-guided-flow.tsx`, `option-detail.tsx` and `what-if.tsx`, a placeholder-only field, and the custom settings modal. These require review before release; broad cleanup was not bundled into P8.

## P8 repairs

1. `test/rotation-integration.test.mjs`: retain exact deep equality and require the new `name` + `context` fields for both Mapbox and custom providers. These fields support duplicate-name disambiguation. No assertion was removed or relaxed.
2. `components/field/report-view.tsx`: require confirmed location and farmer-sourced sequence before field-informed report; distinguish absent rainfall from POWER; state SoilGrids availability from effective soil; describe POWER as regional grid estimates, not field observations.
3. `app/(app)/about/data/page.tsx`: connected adapter vs credentials configured/unverified vs gated vs proposed. Configuration no longer proves live service health; HLS fallback is explicitly gated. Terrain now reflects whether credentials are configured without asserting successful retrieval.
4. New `tests/components/release-truthfulness.test.tsx` and reproducible `test/p8-nasa-demo.mjs`. Scientific formulas, ranking anchors, scientific tests and thresholds were not edited.

## Real browser verification

Used Playwright CLI via `bash /Users/happer/.codex/skills/playwright/scripts/playwright_cli.sh -s=p8 …` against `http://localhost:3001`, with a separate browser session. First sandbox package resolution stalled; elevated CLI worked. Session closed after checks. Existing server remains running.

Commands exercised: `open`, `goto`, `resize 320 740`, `fill`, `click`, `check`, `press Escape`, `eval`, `resize 1440 900`, `reload`, `network-state-set offline`, `network-state-set online`, `press Tab`, `close`.

- Welcome → Continue → Plan → typed Bogale + Ayeyarwady → Rice → three explicitly labeled catalog examples: passed without GPS, polygon, account or dates.
- At 320px the preview and water drawer had `documentElement.scrollWidth=320`; at 1440px preview width was 1440. This is an overflow check, not complete visual/contrast validation.
- Water drawer: Rain only selectable; Escape canceled the unsaved edit and returned focus to `Water: Not set`. No drag needed.
- Reload resumed Bogale/Rice regional preview. Network interruption after loading left preview readable. Cold offline reload and cached saved-field analysis were not verified.
- Settings: Export backup downloaded a JSON file, then Tab moved to Restore backup; zero empty/unlabelled buttons in that tested DOM. The session had no saved fields, so this proves an **empty backup download**, not a populated restore round-trip or adviser PDF export.
- Local evidence: `.playwright-cli/page-2026-11-14T20-35-19-254Z.yml` (preview), `page-2026-11-14T20-35-31-188Z.yml` (water), `page-2026-11-14T20-35-51-142Z.yml` (resume), `page-2026-11-14T20-36-51-311Z.yml` (backup). These ignored artifacts are local inspection aids, not committed release artifacts.

## Requested flow and edge-case coverage

Passing isolated tests do not establish a complete end-to-end farmer journey.

| Responsibility / case | Evidence and boundary |
| --- | --- |
| New location + crop → preview; no GPS | Real browser above; `tests/components/plan-first-run.test.tsx`; no API fetch in preview test. Actual GPS-denied prompt not exercised. |
| Duplicate village | `tests/lib/regional-preview.test.ts` distinguishes duplicate names by context; repaired provider integration asserts context. Not tested with a live provider. |
| No catalog / only two templates / invalid crop | `tests/lib/regional-preview.test.ts`, `engine-display.test.ts`: unavailable, fewer-patterns, rejection; no invented third pattern. |
| Correct current sequence / unknown dates / undo | `tests/components/plan-refinements.test.tsx`, `tests/lib/plan-refinements.test.ts`; separate saved-field editor tests. No unified Plan-to-field transfer. |
| Water / priority / residue | Draft/revision tests and refinement controls exist. Only water checked in real browser. Plan qualitative inputs do not run scientific ranking. |
| Current + alternatives / stale edits / unresolved top priority / ties | `tests/lib/engine-display.test.ts`, `compare.test.ts`, MCDA tests; actual POWER experiment below. No full browser evaluation certified. |
| Evidence drill-down / keep-edit / report export | Saved-field Compare has actions and OptionDetail; Keep mine is component state, not a separately persisted decision. Report uses `window.print()`. Native print/PDF and complete evidence interaction not exercised. |
| Refresh and restore | Browser Plan reload passed; repository backup round-trip tests passed; empty browser backup downloaded. Populated browser restore not exercised. Plan refinements are not included in backup v2. |
| Invalid / huge polygons | `repository.test.ts` rejects self-intersection; geo tests detect bow-tie. `geometrySchema` has no maximum vertex/area bound; no huge-polygon resource/load test. Release gap; no arbitrary scientific area limit invented. |
| Slow POWER | Timeout/unavailable and retry tests pass (`data-truthfulness`, `fetch-with-retry`); preview does not wait on POWER. Delayed browser source loading not exercised. |
| Missing Earthdata credentials | `remote-sensing.test.ts` explicitly removes credentials and asserts unconfigured/no fetch. No secret values inspected or recorded. |
| Cloudy Landsat | `planetary-computer.test.ts` checks QA_PIXEL cloud/shadow exclusions; data adapter tests cover quality. No live cloudy acquisition or full cloudy UI flow verified. |
| No initial soil moisture | `plan-p6.test.ts` keeps numeric storage unknown despite feel/known capacity; actual demo reports missing initial storage. |
| Unknown market / rain-only / no machinery | Limits and farmer-decision tests cover constraints. Plan feasibility is `needs-local-check`, not enforced. Demo has no market and rain-only water. No machinery evidence was supplied to demo. |
| Relay overlap / unknown dekad | `plan-p6.test.ts`, refinement tests, transition suites; overlap suppresses sequential water/ET/hazards/disease; interval boundary returns exact-date-needed. |
| Offline cache | Loaded regional preview survived offline; remote-sensing tests cover server cache reuse. Full browser conditions-cache interruption, cold offline boot and permission-denied storage are not proven. |

## Screen responsibilities: actual completion, not route existence

| UX ID | Current responsibility and remaining gap |
| --- | --- |
| S01 | Welcome/language/privacy exist; incomplete translation; disclosure should also explain map provider and outline requests. |
| S02 | Field list and Plan links exist; Plan draft resume lives on Plan, not an integrated My Farm list. Archived card handler and saved decision status need review. |
| S03 | Typed place and provider search with context; no-GPS path verified. Human village/region recognition untested. |
| S04 | Optional boundary route exists separately; oversized geometry limits/load recovery unverified. |
| S05 | Field context exists in profile and Plan water; models remain separate. |
| S06 | Sequence drawers and saved-field editor exist; no transfer of interval draft to field engine; exact dates required there. |
| S07 | Residue/qualitative moisture/transition records exist in Plan; typed uncertainty preserved. Full practice history not unified with IndexedDB fields. |
| S08 | Goals/feasibility saved; unsupported risk/enforcement stays local review; no invented weights from Plan answers. |
| S09 | Input states and adapter gate exist; no complete unified confirmation-to-evaluation path. |
| S10 | Saved-field analysis has source states/cache/retry; no unified evidence loader for Plan. |
| S11 | Regional catalog preview and separate field comparison exist. Main release gap: refinement does not progress into field evaluation. |
| S12 | Existing OptionDetail/reasons; not a completed new typed P5 screen suite. |
| S13 | Existing water/conditions detail; missing moisture/relay gates remain; purposeful standalone P5 sheet not certified. |
| S14 | Historical weather/season detail exists; source/crop-stage completeness needs full-browser QA. |
| S15 | Soil/health engine screens exist; no locally validated fertility/disease/erosion recommendation. |
| S16 | Existing satellite panels with adapters/QA; cloudy/unavailable farmer flow unverified. |
| S17 | Economics benchmark/entered ranges and market checks exist; unsupported buyer and price guarantees must remain absent. |
| S18 | Separate WhatIf and Plan undo exist; complete persist/recompare/adopt flow not proven. |
| S19 | Saved-field report guarded and print action present; regional report absent; mobile print/PDF/page-break review missing. |
| S20 | Sourced bilingual names and crop guide present; technical values dominate; farmer-tested crop illustrations and language review missing. |
| S21 | Status claims repaired in P8; per-result provenance remains authoritative; catalog is not a live availability monitor. |
| S22 | Language/area unit local persistence and backup v2 exist; comprehensive translation, dynamic document language, per-field deletion review and draft backup remain gaps. |

## Numerical labels, source lineage and historical framing

Audited bindings in saved Compare/Report against `EvaluatedOption`, `ComparisonResult`, `ComparisonDisplay` and scientific tests. This is a code/data audit and one actual data experiment, **not an exhaustive rendered check of every numeric label on all 22 screens**.

- Rain shortfall uses `metrics['water-shortfall']` in mm per crop; null displays unknown. It is demand-minus-rain screening, not measured irrigation required or root-zone storage.
- Crop cover uses `structure.coveredShare * 100`; legume share/count comes from structure, not satellite measurement. Dry-year passes must include evaluated denominator; demo denominators vary by eligible crop windows, so they cannot be compared as equal counts without disclosure.
- Economic ranges must identify benchmark vs entered values. Margin is not profit or guaranteed income; no live buyer/market evidence is supplied here.
- Evidence values retain product, dates, units, missing reason and source metadata through `provenanceLine`; source status is preserved by `engine-display.ts`.
- Report previously described missing rainfall as POWER and SoilGrids as universally present; repaired. Report still uses the legacy comparison directly rather than the complete typed P4 display contract: partial-candidate/viability filtering and all printed uncertainty require further review.
- POWER is coarse gridded model/satellite-derived weather; SoilGrids is ISRIC, 250 m, non-NASA; Landsat C2 via Microsoft is USGS imagery at 30 m. SMAP is 9 km context. MODIS is unwired; ECOSTRESS QA helper is not a live adapter. Earthdata configuration is not a retrieval result.
- Verified `BASELINE={2016,2025}`, display text, Compare/Report copy and integration checks. They explicitly frame historical replay, not next-season prediction. WhatIf likewise says not a forecast. No affirmative future-weather forecast claim was found in those inspected surfaces. Unreviewed routes are not certified by this statement.

## Reproducible NASA included vs withheld demonstration

Run **`node test/p8-nasa-demo.mjs`** from repository root. It uses actual repository cache `data/predownload/weather/power_20.0_95.000.json`, SHA-256 `bf9de11b66e1bcbf422cfcc7a6623a582a7ec1e0955eafd0bfd207bcffc6af12`. Manifest generated 2026-11-14; response metadata POWER API v2.10.3, UTC, sources MERRA2/GEOSIT/SYN1DEG/POWER. Cache spans 2016-01-01 to 2026-10-31; experiment explicitly filters to **3,653 days, 2016–2025, 10 complete years**. No live redownload/authenticity verification was performed in P8.

Hypothetical Magway location [95E,20N], rain-only, one sesame season May 15–Aug 15, typical dates, water as sole priority with weight 1. This is disclosed experiment input, not an observed farmer. Current plus first two actual generated alternatives are frozen across both arms. `compareRotations` computes each and `rankRotations` compares that fixed set. No custom scientific formula is used in the script. Withheld arm removes NASA records and retains unknowns; it does not substitute a fabricated climatology.

| Fixed rotation | POWER rain-shortfall mm/crop | POWER dry-year passes/evaluated | Withheld shortfall | POWER water score |
| --- | ---: | ---: | --- | ---: |
| Sesame reference sequence | 0 | 2/3 | null | 1 |
| Sesame → green gram | 3.3325693985566147 | 0/3 | null | 0.9916685765036084 |
| Groundnut → chickpea | 103.21520161315675 | 0/2 | null | 0.7419619959671081 |

Included ranking: current, sesame/green gram, groundnut/chickpea. All three remain `fit: not-confirmed`; no initial root storage, soil pH, slope, farmer yield or market data was supplied. Missing root-zone moisture is returned explicitly, even where gross seasonal rain shortfall is zero. Dry-year and cross-year window availability differs; these pass counts are not equivalent sample sizes.

Withheld: every water shortfall is null; dry years evaluated = 0 (passes=0 is not a zero-risk result); ranking status `unresolved`, no ranked list, first priority lacks evidence. **NASA changes risk evidence and ranking availability. No supported rank reversal is established**, because the withheld arm has no defensible water ranking. This is a reproducible evidence-availability ablation, not a NASA-vs-independent-weather validation or persuasive proof that one crop should replace another. A comparison against an accepted local non-NASA weather baseline remains blocked: no such matched baseline is supplied.

## Scientific, design and human gates

- Crop rules are species-level; varietyValidated=false; calendars, MCDA anchors, some coefficients and agronomic screens remain analyst assumptions. No field trial or calibrated probability is established.
- Relay/intercrop simultaneous hydrology, disease and windows are not evaluated; no universal sowing countdown. Approximate dates require exact-date-needed; no implemented interval sensitivity replay.
- Source grid resolution/QA and spatial fallback limit precision. Cloud-free availability and crop-stage coverage vary. Modelled soil moisture/soil feel cannot initialize measured root storage.
- Independent evaluation of all candidate replay sample denominators, provenance fallbacks, printed partial candidates and source-error states remains necessary.
- Browser-only storage can be cleared; backup omits Plan draft/preferences/evidence caches. No accounts, shareable URL or server recovery. No new P8 requests carry farmer details.
- Design gaps: raw `exact-date-needed`, `theta`, area reference keys and technical language remain visible; Learn does not prominently connect all help routes; report remains long; full contrast, print, keyboard traps, focus order and screen-reader testing are missing. Language preference does not translate most hardcoded English or update root lang.
- Real browser crop grid displays Green gram alongside a Myanmar name that needs explicit agricultural identification review; do not treat bilingual presence as correct translation. Farmer-tested illustrations and crop recognition, village disambiguation, no-GPS comprehension, unknown-vs-zero understanding, historical-vs-forecast understanding, shared-device backup privacy and adviser print usability all need actual participant review.

Release requires: complete connected Plan-to-field journey or explicitly narrow product scope; a successful production build; configured repeatable E2E/a11y checks; populated restore and print verification; bounded geometry handling; uncertainty/source/number review on every released surface; agricultural translation and real farmer/adviser testing. Stop after P8.
