# P8.1 remediation and verification

This is a scoped remediation, not a production-readiness certification. Existing uncommitted work was preserved; no commit or deployment was made. Scientific formulas, anchors, thresholds and scientific tests were not changed.

## Farmer handoff

`components/field/plan-handoff.tsx` connects regional preview to a confirmed saved field in the same region. It uses `adaptPlanToFieldSlot`, requires confirmed exact dates and water access, applies residue fate, and applies a supported goal as the explicitly disclosed sole priority. Water access updates both the field and constraint representation; no irrigation amount is inferred. Original Plan remains local and backed up. Plain-language context is appended to field notes; original notes are not silently truncated.

Saving writes a stable Plan rotation ID. Source is farmer only after the adapter succeeds. The field comparison recomputes from persisted inputs through the existing scientific engine; absent evidence continues to return unresolved/unavailable states. A revision/input key removes the continuation action after edits until saved again. Existing regional examples remain on screen.

Boundary: the current draft schema supplies exact main-crop dates but not complete timing for previous/following/winter crops. Such drafts show needs-input and link to the saved-field sequence editor; they are never silently collapsed to the main crop. Relay/intercrop and interval gates remain intact. Unsupported risk priority and qualitative feasibility are not converted into invented scoring weights or enforcement. Full multi-crop automatic transfer remains unavailable until the schema captures all required dates. This is an explicit remaining limitation, not a completed migration of those records.

## Build

`npx --no-install next build --webpack` succeeded twice on this host, including compilation, TypeScript, all 23 static pages and build tracing. GeoTIFF's web-worker dynamic dependency emits a warning. Added `npm run build:webpack` as the repeatable fallback. Default `npm run build` still selects Turbopack and its previously reproduced worker port EPERM is unresolved; no claim that Turbopack was fixed. A successful build is not proof of runtime source availability or deployment topology suitability.

## Persistence

Browser export emits backup version 3 with the parsed Plan draft. Schema still accepts v1/v2. Restore validates before repository writes and restores an included draft; blocked Plan storage reports partial restoration rather than silent success. Fields and rotations retain repository semantics (add/replace matching IDs). `tests/lib/plan-backup.test.ts` exports a populated field + rotation + revised draft, removes them, restores, and asserts all three.

Backups do not contain evidence caches or display preferences. Restore is not transactional across IndexedDB and localStorage; keep the original file after failure. Legacy backups do not clear an unrelated current Plan draft.

## E2E and report

Dedicated `playwright.config.ts` restricts discovery to `e2e/`; projects are Pixel 7 and Desktop Chrome. `npm run test:e2e` targets an existing local app at localhost:3001 (override `E2E_BASE_URL`); installed Chrome is required. It does not auto-start or kill a user's server. Initial run failed because Playwright's downloaded headless shell was absent; using installed Chrome succeeded.

Four browser tests passed (two flows × two projects):

- Fresh welcome → typed area/no GPS → main crop → preview → water edit → reload → backup download.
- Populated v3 restore → exact-date main-crop Plan handoff → saved-field scientific comparison → report → print media screenshot and A4 PDF buffer generation.

The second flow routes the conditions request to the actual cached POWER file used in P8, and explicitly returns missing/gated remote sources. This is deterministic application E2E using real cached weather, not a live Earthdata/network integration test. Test fixtures supply hypothetical farmer inputs, never substitute synthetic NASA values. Populated storage round-trip is additionally checked by the store integration test.

Print screenshots in `test-results/.../print-view.png` and generated PDF buffers establish print rendering on both viewport projects. Inspection of the initial mobile screenshot found raw JSON context overflowing; handoff notes were changed to readable prose and tests rerun. Report remains long, with technical evidence disclosure; full paginated print design review is not certified by PDF size assertions.

## Accessibility and localization

Root document language now tracks persisted locale through the client provider. This changes language metadata, not translation coverage: many English strings remain. Initial server HTML is English until browser preferences hydrate. Myanmar crop/soil/practice wording and agricultural terminology still require human review as listed in `P7_TRANSLATION_REVIEW.md`; neither technical localization nor farmer-tested wording is complete.

Added an accessible name for local field observations. Replaced inappropriate label elements used as headings/text in OptionDetail, WhatIf, and the first guided-flow group. WhatIf retains aria-labelledby. Existing drawer Escape/focus-restoration component tests pass. React Doctor: 44 findings vs P8's 48, including 3 accessibility warnings vs 7. Remaining accessibility findings include two guided-flow group headings and the custom settings modal; broad screen-reader/contrast conformance remains open.

## Recorded checks

- `npm run typecheck`: pass.
- `npm run lint`: pass, one pre-existing test image warning.
- `npm run test:quiet`: 53 files, 477 tests passed (includes unchanged scientific suites).
- `npm run test:rotation`: 23/23 passed.
- `npm run test:e2e`: four passed across mobile/desktop in the recorded complete run; final rerun after prose note fix reported separately in handoff.
- `npx --no-install next build --webpack`: succeeded twice; default Turbopack remains blocked as described above.
- `bunx react-doctor@latest . --verbose --scope changed`: 65/100, 44 findings, not a full accessibility pass.

No production readiness recommendation: multi-crop transfer, full accessibility/localization review, paginated print review and default Turbopack build remain open. Human validation, source coverage and simultaneous-crop science limitations from P8 still apply.
