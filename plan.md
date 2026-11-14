# Plan: improve the UI/UX flow

Goal: take the app from "step 1 of 4 works" to the full rotation-planner flow described in `UX.md` — Home → Location → Your rotation → Conditions → Compare → Report — and rebuild the UI layer on MUI v9 so the remaining screens are fast to build, accessible out of the box, and consistent with the Field Almanac design.

Constraints that do not change:

- **`DESIGN.md` tokens stay the source of truth.** Field Almanac palette, earth tones, light mode only, no dark tokens, no `prefers-color-scheme` switch, no theme toggle. MUI themes are generated *from* those tokens, not the other way around.
- **Data colours never stand alone.** `water`, `heat`, `drought`, `frost`, `healthy` always appear with an icon or words (the `RiskChip` rule).
- **Answer-then-evidence.** Every screen opens with a sentence a farmer could say aloud (`Recommendation` block), then numbers, then a quiet mono source line.
- **Mapbox code stays put.** `components/map/field-map.tsx` and `components/map/mapbox-config.ts` are not rewritten; only the chrome around the map (sheets, controls, bars) changes.
- **All strings live in `lib/copy/en.ts`** (and the translation table in `UX.md` is the vocabulary). New screens must not hard-code copy.
- **Phone-first, outdoor, patchy connectivity.** 44px minimum targets, cached results with "last updated" states, loading copy like `copy.data.satellitePending`.

Current data reality (from `docs/data-spikes.md`): POWER and SoilGrids work without credentials; SMAP/MODIS/IMERG are blocked on Earthdata. The UI must say **NASA POWER** for rainfall (`copy.data.rainfallNote`), and any satellite-detail screen shows the `data.satellitePending` state instead.

---

## 1. What exists today

| Area | State |
| --- | --- |
| Routes | `(app)/` Home + `fields/[fieldId]` + `about/data`; `(map)/` `fields/new` + `fields/[fieldId]/location`. Steps 2–4 have **no pages** — the `Stepper` renders them as plain text via the `AVAILABLE` flag in `field-overview.tsx`. |
| UI kit | 10 hand-rolled components in `components/ui/`: `Button` (+ `buttonClass` for links), `RiskChip`, `Segmented`, `Stepper`, `Reading`, `SourceLine`, `Skeleton`, `EmptyState`, `JudgmentNote`, `Recommendation`. All Tailwind classes + `cn()`. |
| Data layer | `lib/nasa/power.ts`, `lib/soil/soilgrids.ts`, `lib/engine/climate.ts` + `et0.ts` are done and unit-tested. Types for the unbuilt screens (`Rotation`, `Crop`, `Evidence`, `Risk`) exist in `lib/types.ts` but have no renderer. |
| Store | zustand + IndexedDB (`lib/store/fields-store.ts`); no account, no network sync. |
| Theme | Tailwind v4 tokens in `app/globals.css`; MUI packages (`@mui/material`, `@emotion/*`, icons) are installed and in `package.json`, but **zero MUI components exist yet** (codemod ran as a no-op, 25 files, 0 transforms). |

UX gaps in the existing flow:

1. **Dead-ends.** The overview's "Next: what you grow now" card is a permanent "not available yet" notice. The whole value chain (rotation → conditions → compare) is unreachable.
2. **No data state machinery.** `SourceLine` has a `stale` flag and `Reading` has a band/verdict, but nothing feeds them yet: no route handlers for POWER/SoilGrids, no cache, no "Data from 12 Nov" line, no "source down" or offline states (UX.md §States).
3. **Step status is hard-coded.** `STATES` in `field-overview.tsx` says location is always done, rotation always needs input. Once rotations exist in the store, states must be derived.
4. **No report, no alerts surface.** UX.md lists a printable Report screen and hazard·when·what-to-do alert chips; neither exists.
5. **Inconsistent chrome.** Home, overview and the map screens each hand-roll headers, cards and detail rows (`dl` grids, `<figure>` blocks). The MUI migration should consolidate these patterns.

---

## 2. MUI migration strategy

MUI becomes the component substrate; the Field Almanac look comes from a theme generated from the existing CSS variables. **Principle: keep the public API of every `components/ui/*` component identical, so call sites barely change.** A Tailwind implementation gets swapped for MUI underneath; screens keep using `<Button variant>`, `<RiskChip hazard>`, `<Reading band>` exactly as they do today.

### 2.1 Theme (`lib/theme.ts` + `app/providers.tsx`)

- `createTheme` mapping, token by token:

  | MUI key | Field Almanac token |
  | --- | --- |
  | `palette.background.default / paper` | `surface` / `surface-raised` |
  | `palette.text.primary / secondary` | `ink` / `ink-muted` |
  | `palette.primary` | `field` (`on-field` for contrastText) |
  | `palette.success / info / warning / error` | `healthy` / `water` / `drought` / `heat` — data colours only, used through `RiskChip`, not sprinkled in MUI defaults |
  | `typography` | the 10-step scale (`display`, `title`, `headline`, `body`, `label`, `reading`, `data`, `source`, `overline`) → MUI sizes with the same px values, tabular-nums on `reading`/`data`/`source`, Geist via `fontFamily` from the existing `--font-geist-sans`/`--font-geist-mono` CSS variables |
  | `shape` | `radius-md` (10px) for buttons/cards, `radius-lg` (16px) for sheets/modals, `radius-pill` via a custom `Chip` variant |
  | `components` overrides | `MuiButton`: `minHeight` 44 (`--spacing-tap`), `minWidth` 44; `MuiChip`: pill radius + icon+word pairing; `MuiDialog`/`MuiDrawer` (temporary): `boxShadow: shadow-float`, rounded 16, paper = `surface-raised`; `MuiSkeleton`: `surface-sunken`, pulse off under `prefers-reduced-motion` (the global CSS already handles this) |

- **Light only.** No `createTheme` dark variant; `viewport` in `app/layout.tsx` already forces `colorScheme: "light"`.
- **SSR/Cache Components.** App Router renders RSC, and MUI components use `useInsertionEffect` → the provider must be a client component:
  - `app/providers.tsx`: `"use client"`, `CacheProvider` (from `@emotion/cache`, default export — verified under React 19.3) + `ThemeProvider`.
  - Wrap `{children}` in `RootLayout` (`app/layout.tsx`). Everything under the `(app)`/`(map)` groups then renders through MUI providers; no per-page providers needed.
  - Static map/overview pages that keep Tailwind markup don't break: MUI only affects MUI components.

### 2.2 Component-by-component swaps (`components/ui/`)

| Component | MUI base | What's kept |
| --- | --- | --- |
| `Button` / `buttonClass` | `MuiButton` + `MuiLink`-styled `next/link` (or `ButtonBase` wrapper) | `variant: primary/secondary/quiet`, `block`. primary = filled `field`, secondary = outlined `line-strong`, quiet = text. `buttonClass` stays as a helper that returns `sx`-free class names from `unstable_ClassNameGenerator` or a `styled` link. |
| `RiskChip` | `MuiChip` (`icon` + label, pill `borderRadius`) | `TONES` map: soft background + data colour text + `HazardGlyph` icon. This is the enforcement point for "never colour alone". |
| `Segmented` | `MuiToggleButtonGroup` + `MuiToggleButton` | `legend` prop → `FormField` label above; native-radio accessibility is replaced by ToggleButtonGroup's keyboard support (verified in test phase 5). |
| `Stepper` | `MuiStepper` + custom `StepLabel`/`StepConnector` | 4 steps, `stepState` words from `copy`, the `available` flag still downgrades un-build steps to non-clickable labels. |
| `Reading` | custom on `MuiPaper` (bar is bespoke) | value + unit, band overlay on a track, verdict word, `offTone`, nested `SourceLine`. Keep the exact `ReadingProps`. |
| `SourceLine` | plain `<p>` with `MuiTooltip`/expandable detail ("one tap from the full detail", UX.md principle 5) | same `SourceLineProps`; add optional `details` expansion instead of new data. |
| `Skeleton` | `MuiSkeleton` | same `className` escape hatch. |
| `EmptyState` | `MuiPaper`/`MuiContainer` + icon | same `title/body/children` API; dashed-border look via `sx`. |
| `JudgmentNote` / `Recommendation` | `MuiPaper` + `MuiCard` semantics | **API unchanged.** `Recommendation` stays the answer block that opens screens (context / headline / reason / risks[] / source / children, one primary button max). |
| `icons.tsx` | keep; replace where an `@mui/icons-material` equivalent exists (checkmark, arrow) but keep `HazardGlyph` hand-drawn — the five data glyphs are the app's visual language |

Order of operations: theme first (2.1), then `Button` → `RiskChip`/`SourceLine` → `Reading`/`Recommendation` → `Segmented`/`Stepper` → the rest. Each step ends with `bun test` + `bun typecheck` and a visual pass of the two live screens (home, new-field map).

**Not migrated:** the Mapbox layer of `location-picker.tsx` (map, terra-draw tools, save sheet's map controls). MUI enters that screen for the surrounding chrome: the bottom control bar (tool `ToggleButtonGroup`, `TextField` for name/coordinates, `Autocomplete` for place search), the save sheet (`Dialog`/`Drawer`), and validation `Alert`s. The existing `--bar-h` CSS that lifts Mapbox attribution above the bar keeps working — set `--bar-h` on the MUI bar too.

### 2.3 Screen chrome consolidated on MUI

- `(app)/layout.tsx` header → `AppBar` (fixed, `surface-raised`, hairline border; `Toolbar` with app name as `MuiLink` and "About the data" as a quiet `ButtonBase`). Footer stays plain text (storage notice).
- Cards/sections (`field-overview`'s detail `<section>`, satellite `<figure>`) → `MuiCard`/`MuiCardContent` with `border: line`, radius 10.
- Detail rows (`dl` Location/Area/Water) → `MuiListItem`-less `Grid` or `Stack` with `label` + mono `data` type.
- The remove-field inline confirm → `MuiDialog` (small, title + two buttons + `Alert` on failure) instead of the inline swap; keyboard/focus handling comes for free.

---

## 3. The flow work (phased)

Each phase ends with the full flow usable and every new string in `lib/copy/en.ts`. Phases build on the MUI kit from §2, so §2.1–2.3 land first.

### Phase A — Step 2: Your rotation (`app/(app)/fields/[fieldId]/rotation/page.tsx`)

The input step: record what's actually grown. UX.md: numbered list on phone ("1. Maize, 15 Jun to 10 Oct"), ribbon only later for tablet/desktop.

- **Screen shape:** `JudgmentNote`-style context line ("North plot, maize"), then a numbered `Stack` of slot cards: crop name, `Segmented` for exact/approx/usual date confidence, plant–harvest date inputs (`TextField` + native date input), `irrigated` toggle, "Add next crop" (`Button`, quiet). Pre-fill typical dates from the `Crop` table when a crop is picked.
- **Validation:** zod `rotationSchema` (add to `lib/schemas/` alongside `field.ts`); slot count per `cycleYears` 1–4, dates in order, cycle gaps flagged — not blocked.
- **Save path:** rotations persist in the IndexedDB store (`NewField`/repository extended with `rotations: Rotation[]` — the type is already in `lib/types.ts`). Stepper state for "Your rotation" flips to `done` from the store, replacing the hard-coded `STATES`.
- **States:** empty ("What have you grown here in the last two or three years?"), date-confusion error ("Harvest comes before planting — check the year"), crop not in the table (free-text variety, marked low confidence).

Deliverable: a field with a saved rotation; overview card changes from "not available yet" to the real next step.

### Phase B — Step 3: Conditions (`app/(app)/fields/[fieldId]/conditions/page.tsx`)

The evidence step. Data: POWER daily + climatology (works today) and SoilGrids point (works today); SMAP/MODIS/IMERG are absent by design — the screen says so.

- **Opening:** `Recommendation`-shaped summary sentence ("Rains arrive late here: dry spells of 20+ days in 7 of the last 10 years"), then sections, each a band-bearing `Reading` + `SourceLine`:
  1. **Rain and dry spells** — POWER `PRECTOTCORR` monthly bar against the crop's `water.seasonMm` band (d3-shape, the dependency is already there); rainfall labelled **NASA POWER**, with `copy.data.rainfallNote` as the footnote. Satellite-rain (IMERG) row shows `copy.data.satellitePending` until Earthdata lands.
  2. **Heat and frost** — `T2M_MAX`/`T2M_MIN` vs the crop's `temp` limits; any breach renders as `RiskChip`s (hazard · when · what to check), per UX.md finding 3.
  3. **Water balance** — ET0 (Hargreaves, `lib/engine/et0.ts`) − rainfall, `GWETROOT` wetness readings with the crop's comfortable band and an in-range/out-of-range verdict (finding 4).
  4. **Soil** — SoilGrids profile (pH, texture, SOC) with a "your soil test overrides the map" callout when `field.soilOverride` is set; null profile → "no soil data here, add a test".
  5. **Season so far** — GDD vs the 20-year average (`lib/engine/climate.ts`).
- **Route handler:** `app/api/field/[fieldId]/conditions/route.ts` fetching POWER + SoilGrids, returning `DailyWeather`/`SoilProfile` + a `Source` block; response cached in a small browser-side cache (IndexedDB, keyed by field+date) with `fetchedAt` so the UI can say `copy.data.cachedFrom(when)` offline. Stale > 48h → `SourceLine stale`.
- **States (UX.md §States):** source down (`Alert` + "Use data from 12 Nov"), field smaller than a data cell ("around your field" wording + cell-size note), satellite loading (`satellitePending`), soil null.

### Phase C — Step 4: Compare (`app/(app)/fields/[fieldId]/compare/page.tsx`) + Report

The decision step.

- **Generation:** two strategy alternatives per `lib/types` `Crop` constraints (drought tolerance vs the field's dry-spell record, N demand vs `nApplied`/legume N fix, GDD vs the season's GDD) — the strategy engine itself is a small pure function in `lib/engine/`, unit-tested; the UI only renders.
- **Phone:** `Tab` per option ("Your rotation" first, then alternatives), each opening with its `Recommendation` (factual labels, no winner badge: "Most reliable in dry years"). Desktop: the comparison `Table` with row groups fit / soil health / water & weather / unknowns (MUI `Table`, sticky group headers, `hidden md:table` responsive swap to tabs).
- **Option content:** `Evidence` list (each claim + value + `SourceLine` + `Confidence`), `Risk` list rendered hazard·when·what-to-do ("Marginal: not enough rain in 6 of 10 years without irrigation — check your water access"), "Unknowns and things to check".
- **No-fit case:** an alternative that can't work renders the explanation, not a blank tab ("Not a fit here because…").
- **Report:** `app/(app)/fields/[fieldId]/report/page.tsx`, one printable page (`@media print` CSS): rotations, key evidence, questions to ask locally; "Print or save as PDF" button. No backend, no accounts.
- **Persistent framing:** `JudgmentNote` ("Suggestions to discuss, not instructions…") on every compare/report screen, per UX.md.

### Phase D — polish pass across the flow

- **Home (`(app)/page.tsx`):** field cards show the real step state (derived from store, not `STATES` constant) and a one-line "next step" prompt; empty state keeps "Drop a pin on your first field".
- **Overview (`field-overview.tsx`):** drop the hard-coded `AVAILABLE` flag; `Stepper` links activate as pages exist. Overview becomes the "answer" screen: when conditions data exists, show its summary sentence instead of the satellite image first (findings 1), demoting the map image to a figure.
- **Onboarding nudge:** first visit (no fields) gets a two-step card: "Add a field" + "About the data". No account, no legal wall (finding 6).
- **Accessibility pass:** MUI focus rings on the `field` colour (the global `:focus-visible` already defines it), `Segmented`→ToggleButtonGroup keyboard audit, chip labels read by screen readers (icon + word, never icon only).
- **Outdoor test:** the DESIGN.md rule "test the tokens outdoors at full brightness" — run the Compare + Conditions screens on a phone, sunlit, checking AA contrast on `ink-muted` over `surface-raised`.

---

## 4. Files this plan touches

**New:** `lib/theme.ts`, `app/providers.tsx`, rotation/conditions/compare/report pages + `conditions` route handler, `lib/schemas/rotation.ts`, `lib/engine/strategies.ts`, `lib/store/data-cache.ts`, copy additions to `lib/copy/en.ts` (`rotation`, `conditions`, `compare`, `report` sections).

**Rewritten internals, same API:** every `components/ui/*` component; chrome in `(app)/layout.tsx`, `field-overview.tsx`, `fields-list.tsx`, `location-picker.tsx` (bottom bar + save sheet only).

**Untouched:** `components/map/*`, `lib/nasa/power.ts`, `lib/soil/soilgrids.ts`, `lib/engine/climate.ts`/`et0.ts` (read-only dependencies), `app/globals.css` tokens (MUI theme *mirrors* them; the CSS variables remain for the un-migrated map chrome).

**Tests:** keep existing `tests/lib/*` green throughout; add component tests for `RiskChip` (icon+word pairing), `Reading` (band verdict), rotation slot validation, and a flow test "save rotation → stepper state flips". `@testing-library/react` + jsdom are already devDeps.

## 5. Build order & definition of done

1. MUI theme + providers (§2.1) — *the two live screens render identically* (pixel-level pass on home + new-field).
2. UI-kit swaps, one component per commit, tests green.
3. Phase A (rotation) → Phase B (conditions) → Phase C (compare + report) → Phase D (polish).
4. Done = a farmer can: add a field on the map → record their rotation → read the conditions evidence with bands and source lines → compare two alternatives with unknowns → print the report — on a phone, offline-tolerant (cached data + "last updated"), light mode only, every string from `en.ts`.

Open question for scope: does the strategy engine in Phase C stay "two hand-picked alternatives from the crop table" (small, shippable now) or wait on a real suitability scoring pass? The plan assumes the former; scoring can land behind the same UI later.
