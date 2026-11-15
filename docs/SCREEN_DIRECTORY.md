# Field Shift — Master Screen Directory & Agent Refinement Guide

> **Document Version:** 1.0.0  
> **Status:** Current & Validated Master Screen Catalog  
> **Primary Audience:** Product Owners, Extension Designers, Autonomous AI Agents (`invoke_subagent`, `swarm`)  
> **Rule Reference:** Follow `AGENTS.md`, `DESIGN_SYSTEM.md`, and `UX.md`. Light-mode only, never color alone, resolution honesty.

---

## 1. Executive Summary & Screen Architecture

Field Shift is an offline-first, local-first crop rotation decision support tool tailored for smallholder farmers and agricultural extension officers across Myanmar's agricultural heartlands (Central Dry Zone, Ayeyarwady Delta, and Shan Plateau).

Every screen is engineered around three non-negotiable principles:
1. **Low Cognitive Load & Plain Language:** Farmers without academic agronomic training can immediately understand recommendations.
2. **Farmer Input Precedence:** Farmer-entered constraints (water access, machinery, family labor, market access) always override regional models.
3. **Honesty & Provenance First:** Regional satellite estimates (~50 km NASA POWER, 250 m SoilGrids) are never claimed as "measured at your field gate". Missing data is marked `Unknown`, never zero-filled.

### Global Screen Matrix

| Screen ID | Screen Name | Route Path | Primary Component File | Primary Role / Purpose |
|:---|:---|:---|:---|:---|
| **S01** | First Launch / Welcome | `/welcome` | `components/home/welcome.tsx` | Language selection, offline privacy notice, local storage disclosure. |
| **S02** | Field List (Home) | `/` | `components/field/fields-list.tsx` | Dashboard of saved fields, quick rotation statuses, add field entry. |
| **S03** | Field Map | `/fields/map` | `components/map/field-map.tsx` | Geographic visualization of all user fields on satellite basemap. |
| **S04** | Mark Field / Boundary | `/fields/new` | `components/field/location-picker.tsx` | Pin drop, coordinate input, or boundary drawing without mandatory GPS. |
| **S05** | Farm Profile & Limits | `/fields/:id/profile` | `components/field/farm-profile.tsx` | Constraints entry: water access, machinery, labor, market, soil tests. |
| **S06** | Field Hub (Overview) | `/fields/:id` | `components/field/field-overview.tsx` | Master field dashboard: current rotation, next steps, satellite thumbnail. |
| **S07** | Conditions & History | `/fields/:id/conditions` | `components/field/conditions-view.tsx` | 10-year NASA POWER rainfall, dry spells, heat/frost risks, SoilGrids. |
| **S08** | Rotation Editor | `/fields/:id/rotation` | `components/field/rotation-editor.tsx` | Multi-season timeline & crop selector (cycle length, sowing/harvest dates). |
| **S09** | Priorities & Limits | `/fields/:id/profile#limits` | `components/field/farm-profile.tsx` | Rank-sum priority reordering (water, soil health, earnings, feed, low inputs). |
| **S10** | Compare Rotations | `/fields/:id/compare` | `components/field/rotation-compare.tsx` | Hard-feasibility gated matrix: current rotation vs resilient alternatives. |
| **S11** | Option Detail | `/fields/:id/compare` (Expand) | `components/field/option-detail.tsx` | Deep breakdown: moisture gap, nitrogen balance, labor peaks, dry-season pass rate. |
| **S12** | Finding / Evidence Detail| Modal / Sheet | `components/ui/provenance.tsx` | Provenance citations: satellite mission, resolution, dates, algorithm scope. |
| **S13** | Explain a Term | `/learn#terms` | `components/learn/learn-topic.tsx` | Plain-language glossary for scientific agronomy and climate terms. |
| **S14** | Answer an Unknown | `/fields/:id/questions/:qId`| `components/field/question-form.tsx` | Focused single-question workflow resolving unmeasured farm limits. |
| **S15** | Learn & Questions Hub | `/learn` | `components/learn/learn-hub.tsx` | 5-theme farmer FAQ library, search, and data usage transparency guide. |
| **S16** | Share & Print Report | `/fields/:id/report` | `components/field/report-view.tsx` | High-contrast, 1-page printable field briefing for extension meetings. |
| **S17** | Long-Term Trends | `/fields/:id/conditions` | `components/field/trends-view.tsx` | 40-year Mann-Kendall climate trajectories (rainfall & temperature shift). |
| **S18** | What-If Simulator | `/fields/:id/compare` (Modal)| `components/field/what-if.tsx` | Climate stress testing (monsoon delay, ±20% rain, +2°C heat, water loss). |
| **S19** | Pests & Diseases | `/fields/:id/pests` | `components/field/pests-view.tsx` | Biological host breaks, soil-borne pathogen cycles, weather risk outlook. |
| **W01** | Plan Wizard (Quick Explorer)| `/plan` | `app/(app)/plan/page.tsx` | Fast regional rotation exploration without creating a field or saving GPS. |
| **M01** | Settings & Data Portability| `/settings` | `components/settings/settings-view.tsx` | Full JSON backup export/restore, locale switch, privacy overview. |
| **G01** | Crop Reference Guide | `/about/crops` | `app/(app)/about/crops/page.tsx` | Botanical profiles, cycle lengths, optimum pH, Kc curves for 11 crops. |
| **G02** | Data Sources & Remote Sensing| `/about/data` | `app/(app)/about/data/page.tsx` | Technical specifications for NASA POWER, SoilGrids, HLS, Landsat, SRTM. |

---

## 2. Screenshot Directory Map

All canonical screenshots are stored in `docs/screenshots/` and `public/screenshots/`:

| Screen ID | Screen Name | Desktop Screenshot | Mobile Screenshot |
|:---|:---|:---|:---|
| **S01** | First Launch / Welcome | [`s01-welcome-desktop.png`](screenshots/s01-welcome-desktop.png) | [`s01-welcome-mobile.png`](screenshots/s01-welcome-mobile.png) |
| **S02** | Field List (Zero State) | [`s02-field-list-zero-state.png`](screenshots/s02-field-list-zero-state.png) | [`s02-field-list-mobile.png`](screenshots/s02-field-list-mobile.png) |
| **S02** | Field List (Populated) | [`s02-field-list-desktop.png`](screenshots/s02-field-list-desktop.png) | [`s02-field-list-mobile.png`](screenshots/s02-field-list-mobile.png) |
| **S04** | Mark Field (Globe/Basemap)| [`s04-mark-field-globe.png`](screenshots/s04-mark-field-globe.png) | [`s04-mark-field-mobile.png`](screenshots/s04-mark-field-mobile.png) |
| **S04** | Mark Field (Pin Placed) | [`s04-mark-field-pin-placed.png`](screenshots/s04-mark-field-pin-placed.png) | [`s04-mark-field-mobile.png`](screenshots/s04-mark-field-mobile.png) |
| **S04** | Mark Field (Name Sheet) | [`s04-mark-field-name-sheet.png`](screenshots/s04-mark-field-name-sheet.png) | [`s04-mark-field-mobile.png`](screenshots/s04-mark-field-mobile.png) |
| **S05** | Farm Profile & Limits | [`s05-farm-profile-desktop.png`](screenshots/s05-farm-profile-desktop.png) | [`s05-farm-profile-mobile.png`](screenshots/s05-farm-profile-mobile.png) |
| **S06** | Field Hub (Initial) | [`s06-field-hub-initial.png`](screenshots/s06-field-hub-initial.png) | [`s06-field-hub-populated-mobile.png`](screenshots/s06-field-hub-populated-mobile.png) |
| **S06** | Field Hub (Populated) | [`s06-field-hub-populated-desktop.png`](screenshots/s06-field-hub-populated-desktop.png) | [`s06-field-hub-populated-mobile.png`](screenshots/s06-field-hub-populated-mobile.png) |
| **S07** | Conditions & History | [`s07-conditions-desktop.png`](screenshots/s07-conditions-desktop.png) | — |
| **S08** | Rotation Editor | [`s08-rotation-editor-desktop.png`](screenshots/s08-rotation-editor-desktop.png) | — |
| **S10** | Compare Rotations (Populated)| [`s10-compare-rotations-desktop.png`](screenshots/s10-compare-rotations-desktop.png) | [`s10-compare-rotations-mobile.png`](screenshots/s10-compare-rotations-mobile.png) |
| **S10** | Compare Rotations (Empty) | [`s10-compare-empty.png`](screenshots/s10-compare-empty.png) | — |
| **S15** | Learn & Questions Hub | [`s15-learn-hub-desktop.png`](screenshots/s15-learn-hub-desktop.png) | [`s15-learn-hub-mobile.png`](screenshots/s15-learn-hub-mobile.png) |
| **S16** | Share & Print Report | [`s16-printable-report-desktop.png`](screenshots/s16-printable-report-desktop.png) | [`s16-printable-report-mobile.png`](screenshots/s16-printable-report-mobile.png) |
| **W01** | Plan Wizard (Explore) | [`plan-wizard-desktop.png`](screenshots/plan-wizard-desktop.png) | [`plan-wizard-mobile.png`](screenshots/plan-wizard-mobile.png) |
| **W01** | Plan Wizard (Comparison) | [`plan-comparison-desktop.png`](screenshots/plan-comparison-desktop.png) | [`plan-comparison-mobile.png`](screenshots/plan-comparison-mobile.png) |

---

## 3. Comprehensive Screen-by-Screen Profiles

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            CORE SCREEN LIFECYCLE FLOW                            │
│                                                                                  │
│   [S01 Welcome] ──> [S02 Field List] ──> [S04 Mark Field] ──> [S06 Field Hub]    │
│                            │                                      │              │
│                            ▼                                      ▼              │
│                     [W01 Plan Wizard]                    [S08 Rotation Editor]   │
│                                                                   │              │
│                                                                   ▼              │
│                                                        [S07 Conditions]          │
│                                                        [S05 Farm Profile]        │
│                                                                   │              │
│                                                                   ▼              │
│                     [S16 Printable Report] <── [S10 Compare Rotations]           │
│                                                        │       │                 │
│                                   ┌────────────────────┘       └─────────────┐   │
│                                   ▼                                          ▼   │
│                          [S18 What-If Sim]                           [S19 Pests] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### S01: First Launch / Welcome Cover

- **Route:** `/welcome`
- **Source Files:** `app/welcome/page.tsx`, `components/home/welcome.tsx`
- **Zustand Stores:** `useSettingsStore` (`fieldshift.settings.v1`), `useLocaleStore` (`locale: 'en' | 'my'`)
- **Visuals:**
  - Desktop: `docs/screenshots/s01-welcome-desktop.png`
  - Mobile: `docs/screenshots/s01-welcome-mobile.png`

#### Purpose & Farmer Job to be Done
Greets the farmer on first opening the app. Sets language preference immediately (Burmese Unicode or English). Discloses data sovereignty up front: fields and plans stay on the device in local browser storage; only geographic coordinates are transmitted to retrieve public weather and soil grids.

#### What It Does
1. Displays language selection radio (`မြန်မာ (Myanmar)` vs `English`).
2. Presents plain-language privacy guarantee:
   - *What stays on this phone:* Your fields, crops, and soil tests.
   - *What may leave the phone:* Field location to NASA, ISRIC, and Microsoft data services.
3. Provides one-tap "Continue" button, stamping `dataNoticeAcceptedAt` timestamp into `localStorage`.
4. Guarantees that returning users are never trapped here (intercepted by `WelcomeGate`).

#### Refinement Backlog for Agents
- [ ] Verify font rendering: Ensure `Noto Sans Myanmar` or system fallback displays correctly without dotted circles or broken vowel reordering on low-end Android browsers.
- [ ] Accessibility: Verify keyboard tab-order and screen reader labels for the radio buttons.

---

### S02: Field List (Home)

- **Route:** `/`
- **Source Files:** `app/(app)/page.tsx`, `components/field/fields-list.tsx`
- **Zustand Stores:** `useFieldsStore` (`fieldshift.fields.v1`), `useLocaleStore`
- **Visuals:**
  - Desktop (Zero State): `docs/screenshots/s02-field-list-zero-state.png`
  - Desktop (Populated): `docs/screenshots/s02-field-list-desktop.png`
  - Mobile: `docs/screenshots/s02-field-list-mobile.png`

#### Purpose & Farmer Job to be Done
Serves as the primary operational launcher. Allows a farmer or extension officer to manage multiple plots of land, review high-level rotation viability, and start a new plot analysis.

#### What It Does
1. **Zero State (First Time):**
   - Shows "Drop a pin on your first field" onboarding card with 3 simple steps:
     1. Mark your field on a map.
     2. Record what you grow now.
     3. Tell us what matters & compare.
   - Features a live interactive regional teaser ("Preview: Magway Region - Sesame followed by green gram on stored moisture").
   - Primary CTA: `+ Add a field` (`/fields/new`).
   - Secondary CTA: `Explore next crops` (`/plan` quick wizard).
2. **Populated State:**
   - Lists all saved fields as cards displaying:
     - Field name, township/region badge, area (ha or acres).
     - Current crop badge & next planned season.
     - Progress indicator (e.g. "3 of 5 steps completed").
   - Persistent bottom disclosure: "Your fields are saved in this browser only. Nothing is sent to an account."

#### Refinement Backlog for Agents
- [ ] Add field deletion confirmation sheet with undo toast.
- [ ] Support sorting fields by last modified date or township name.
- [ ] Add empty state illustrations compliant with light parchment palette (`#f4f3ee`).

---

### S04: Mark Field / Location Picker

- **Route:** `/fields/new` (and `/fields/:id/location`)
- **Source Files:** `app/(map)/fields/new/page.tsx`, `components/field/location-picker.tsx`
- **Dependencies:** Mapbox GL, Terra Draw (`terra-draw-mapbox-gl-adapter`)
- **Visuals:**
  - Globe View: `docs/screenshots/s04-mark-field-globe.png`
  - Pin Placed: `docs/screenshots/s04-mark-field-pin-placed.png`
  - Name & Confirmation Sheet: `docs/screenshots/s04-mark-field-name-sheet.png`
  - Mobile: `docs/screenshots/s04-mark-field-mobile.png`

#### Purpose & Farmer Job to be Done
Enables farmers to locate their parcel of land accurately without requiring high-precision GPS or expensive surveying equipment. Supports poor connectivity situations via village search or manual coordinate entry.

#### What It Does
1. **Four Location Input Modalities:**
   - **Pin:** Single tap to place centroid.
   - **Box:** Drag rectangular boundary.
   - **Outline:** Trace polygon boundary (computes exact hectare area).
   - **Coordinates:** Expandable lat/long input with pre-filled regional presets (Magway: `20.15, 94.95`).
2. **Village & Township Geocoding:** Search bar resolves Myanmar townships and village tracts.
3. **Save Sheet Overlay:**
   - Field naming input (e.g., "North plot", "Well parcel").
   - Irrigation water baseline toggle (`Rain only`, `Some irrigation`, `Fully irrigated`).
   - Mandatory Confirmation Checkbox: *"Yes, this is my field. Results are about the point or outline you saved. Confirm it so we know it is your field and not a guess."*
4. Automatically saves field record to `useFieldsStore` and navigates to S06 (`/fields/:id`).

#### Refinement Backlog for Agents
- [ ] Offline Map Tile Fallback: Show clear low-bandwidth warning when Mapbox vector tiles fail to load.
- [ ] Offline Township Fallback: Ensure offline preset dropdown contains all 5 heartland agro-ecological zones (Magway, Ayeyarwady, Mandalay, Shan, Bago).

---

### S05 & S09: Farm Profile, Priorities & Limits

- **Route:** `/fields/:id/profile` (Section `#limits`)
- **Source Files:** `app/(app)/fields/[fieldId]/profile/page.tsx`, `components/field/farm-profile.tsx`
- **Zustand Stores:** `useFieldsStore`
- **Visuals:**
  - Desktop: `docs/screenshots/s05-farm-profile-desktop.png`
  - Mobile: `docs/screenshots/s05-farm-profile-mobile.png`

#### Purpose & Farmer Job to be Done
Allows the farmer to declare real-world operating boundaries. In Field Shift, farmer-stated constraints **always trump gridded estimates**. If a farmer states they have no irrigation or no access to seeders, options requiring those are eliminated or flagged.

#### What It Does
1. **Priority Ordering (S09):**
   - Drag/stepper reordering of farmer goals:
     1. Save water
     2. Improve soil
     3. Earn more
     4. Feed for animals
     5. Use fewer inputs
   - Feeds directly into rank-sum multi-criteria decision analysis (MCDA) weights in `lib/engine/mcda.ts`.
2. **Farm Constraints & Limits:**
   - Water access: `Rain only` vs `Some irrigation` vs `Fully irrigated`.
   - Machinery / Equipment checklist: Hand tools, animal traction, two-wheel tractor, four-wheel tractor, seeder, harvester.
   - Peak labor availability: `Low`, `Medium`, `High`.
   - Market access: `Poor`, `Fair`, `Good` (flags perishable pulses without buyer access).
   - Crop preferences: "Crops you want to grow" and "Crops you will not grow".
3. **Soil Measurements (Local Override):**
   - Form to enter real laboratory or field-kit soil tests (pH, organic carbon, texture).
   - Replaces 250m SoilGrids estimates and labels data source as **"Entered by you"**.
4. **Prices, Yields & Costs:**
   - Farmer-provided local crop price and production cost expectations.

#### Refinement Backlog for Agents
- [ ] Add validation hints for pH ranges (e.g. warn if entered pH is < 3.5 or > 9.5).
- [ ] Connect labor availability to calendar month picker to catch peak harvest clashes.

---

### S06: Field Hub (Overview)

- **Route:** `/fields/:id`
- **Source Files:** `app/(app)/fields/[fieldId]/page.tsx`, `components/field/field-overview.tsx`
- **Visuals:**
  - Initial Empty State: `docs/screenshots/s06-field-hub-initial.png`
  - Populated Desktop: `docs/screenshots/s06-field-hub-populated-desktop.png`
  - Populated Mobile: `docs/screenshots/s06-field-hub-populated-mobile.png`

#### Purpose & Farmer Job to be Done
The single point of orientation for a specific parcel. Summarizes current rotation health, prompts for missing data with high return-on-investment, and serves as the navigation nexus for deep-dive screens.

#### What It Does
1. **Interactive Stepper Header:**
   - Visual progress through 5 key stages: `Location` -> `Your rotation` -> `Your farm` -> `Conditions` -> `Compare`.
2. **Next Best Action Banner:**
   - Highlights the immediate next step (e.g. "Next: what you grow now — Add the crops you have grown on this field").
   - Populated state shows: "Your plan is ready to compare" with direct CTA to S10.
3. **Satellite Overview Thumbnail:**
   - Mapbox static image centered on field boundary with pin overlay.
4. **Targeted Unknowns Banner:**
   - Highlights unmeasured factors: e.g. "7 questions would make this comparison clearer (Soil water at sowing, Standing water after rain, Water limit)".
5. **Seasons Bar:**
   - Visual horizontal strip depicting current season allocations across months.
6. **Navigation Link Rows (44px min hit size):**
   - Direct jump links to Rotation Editor, Soil Test, Water & Limits, Weather Conditions, Long-Term Trends, and Printable Report.

#### Refinement Backlog for Agents
- Follow `docs/OVERVIEW_IMPROVEMENT_PLAN.md`:
  - [ ] Replace raw coordinates in header with village/township name.
  - [ ] Inline the first unanswered question into the overview card for 1-tap resolution.
  - [ ] Display local extension officer contact line at bottom.

---

### S07: Conditions & Weather History

- **Route:** `/fields/:id/conditions`
- **Source Files:** `app/(app)/fields/[fieldId]/conditions/page.tsx`, `components/field/conditions-view.tsx`, `conditions-panels.tsx`
- **Data Engine:** NASA POWER Daily Agmet (10-year climatology), ISRIC SoilGrids v2, HLS/Landsat NDVI
- **Visuals:**
  - Desktop: `docs/screenshots/s07-conditions-desktop.png`

#### Purpose & Farmer Job to be Done
Provides transparent, unvarnished environmental context for the parcel. Explains why certain crops thrive or fail in this climate without overwhelming the user with raw data tables.

#### What It Does
1. **Rainfall & Water Demand Panel:**
   - Hero summary: *"About 822 mm of rain a year, mostly Jun to Aug"*.
   - Monthly bar chart comparing observed rainfall against FAO-56 Penman-Monteith crop water demand ($ET_0$).
   - Highlights seasonal shortfall (water gap) in parchment amber.
2. **Extreme Heat & Frost Risks:**
   - Monthly range bubbles showing typical daily highs and night lows.
   - Compares temperatures against crop biological thresholds (e.g., maize heat stress > 35°C at flowering).
3. **NASA & Remote Sensing Connection Monitor:**
   - Status cards for GPM IMERG, SMAP soil moisture, HLS 30m vegetation, and SRTM terrain slope.
   - Strictly labels spatial resolution (e.g., *~50 km grid cell*).
4. **Soil Profile Card:**
   - Soil acidity (pH), organic carbon ($g/kg$), texture class (e.g., clay loam).
   - Suitability tags for current crop (e.g. `Suits Maize`).
5. **Download Weather Data:** Export full 10-year daily weather records as CSV.

#### Refinement Backlog for Agents
- [ ] Add Dry Zone rainfall caution badge explaining MERRA-2 bias in the central dry corridor.
- [ ] Add tooltip explaining the difference between $ET_0$ (reference crop) and $ET_c$ (actual crop water demand).

---

### S08: Rotation Editor

- **Route:** `/fields/:id/rotation`
- **Source Files:** `app/(app)/fields/[fieldId]/rotation/page.tsx`, `components/field/rotation-editor.tsx`
- **Visuals:**
  - Desktop: `docs/screenshots/s08-rotation-editor-desktop.png`

#### Purpose & Farmer Job to be Done
Allows the farmer to record their multi-year cropping sequence (e.g., 1-year sesame-greengram, or 2-year rice-chickpea-fallow). Serves as the scientific baseline against which all new options are evaluated.

#### What It Does
1. **Cycle Length Selector:** Toggle between 1-year, 2-year, 3-year, or 4-year rotation cycles.
2. **Interactive Multi-Year Calendar Bar:**
   - 12-month visual grid displaying crop coverage across months.
3. **Per-Crop Entry Cards:**
   - Crop selector dropdown (11 Myanmar heartland crops with botanical names and local scripts).
   - Variety name (optional text).
   - Sowing date and harvest date pickers.
   - Date accuracy mode: Exact dates, Approximate dates, or Usual season.
   - Irrigation switch per crop: Rainfed vs Irrigated.
4. **Validation Engine:** Checks for overlapping crop dates and flags biologically impossible planting windows.

#### Refinement Backlog for Agents
- [ ] Implement quick-template shortcuts: "Typical Magway Early Rain", "Ayeyarwady Monsoonal Double Rice".
- [ ] Support intercropping / relay cropping (*Ye-pyan* broadcast before paddy harvest).

---

### S10 & S11: Compare Rotations & Option Detail

- **Route:** `/fields/:id/compare`
- **Source Files:** `app/(app)/fields/[fieldId]/compare/page.tsx`, `components/field/rotation-compare.tsx`, `option-detail.tsx`, `season-strip.tsx`
- **Engines:** Hard Feasibility Gates (`lib/engine/limits.ts`), Rank-Sum MCDA (`lib/engine/mcda.ts`), 3-Zone Soil Hydrology
- **Visuals:**
  - Desktop: `docs/screenshots/s10-compare-rotations-desktop.png`
  - Mobile: `docs/screenshots/s10-compare-rotations-mobile.png`
  - Empty: `docs/screenshots/s10-compare-empty.png`

#### Purpose & Farmer Job to be Done
The core decision engine of Field Shift. Compares the farmer's current rotation against 2 or more resilient alternatives across 10 historical seasons. Provides actionable advice for discussions with extension officers.

#### What It Does
1. **Hard Feasibility Filter:**
   - Rejects physically impossible rotations (e.g., irrigated triple-crop with zero water access) before scoring.
2. **Candidate Comparison Cards:**
   - Displays Current Rotation vs Alternatives (e.g., "Sesame, then green gram", "Pigeon pea, then sesame").
   - Rank badges based on farmer's prioritized goals (e.g., *1st for what matters to you*).
   - Key agronomic tags: `Needs the least nitrogen`, `Smallest typical rain gap`.
   - Main caution warnings (e.g., "In 2 of 10 past seasons, Sesame had heat above 38°C during flowering").
   - Quantitative metrics: Median rain shortfall per crop (mm), Dry seasons passed (out of 10 years).
3. **Expanded Option Breakdown (S11):**
   - Side-by-side metric comparison table.
   - Biological nitrogen balance estimates ($kg\ N/ha$).
   - Ground cover duration (reducing soil erosion).
4. **Local Extension Check Notice:**
   - Explicit bulleted discussion points: seed varieties available in township, local pests reported this year, drainage rules.
5. **CTA:** Direct export to S16 (`View printable report`).

#### Refinement Backlog for Agents
- [ ] Add variety-specific cycle adjustments (e.g., 75-day vs 90-day green gram).
- [ ] Include market price sensitivity toggle.

---

### S15: Learn Hub & Questions Library

- **Route:** `/learn` (and `/learn/:topicId`)
- **Source Files:** `app/(app)/learn/page.tsx`, `components/learn/learn-hub.tsx`, `learn-topic.tsx`, `data-usage-guide.tsx`
- **Visuals:**
  - Desktop: `docs/screenshots/s15-learn-hub-desktop.png`
  - Mobile: `docs/screenshots/s15-learn-hub-mobile.png`

#### Purpose & Farmer Job to be Done
Demystifies agricultural science and satellite observation. Provides farmer-centric answers to real farming dilemmas without technical jargon.

#### What It Does
1. **Data Usage Transparency Guide (`DataUsageGuide`):**
   - Clearly explains what data is collected, where it is processed, and how satellite models operate.
2. **5 Curated Farm Question Themes:**
   - *Weather, rain & dry spells* (e.g., "Why does rain shortfall matter?", "$ET_0$ explained").
   - *Soil health & fertilizers* (e.g., "Legume nitrogen fixation", "Interpreting soil pH").
   - *Pests & crop diseases* (e.g., "Breaking pest cycles through rotation").
   - *Satellite & remote sensing* (e.g., "What can a 50 km weather grid tell me?").
   - *Farm economics & risk* (e.g., "Crop diversification vs monoculture").
3. **Instant Search:** Full-text instant search across English and Burmese agronomic terms.

#### Refinement Backlog for Agents
- [ ] Expand Burmese translations in `lib/copy/my.ts` for all 24 scientific glossary definitions.
- [ ] Add audio voiceover playback buttons for low-literacy farmers.

---

### S16: Share & Print Report

- **Route:** `/fields/:id/report`
- **Source Files:** `app/(app)/fields/[fieldId]/report/page.tsx`, `components/field/report-view.tsx`, `share-report.tsx`
- **Visuals:**
  - Desktop: `docs/screenshots/s16-printable-report-desktop.png`
  - Mobile: `docs/screenshots/s16-printable-report-mobile.png`

#### Purpose & Farmer Job to be Done
Designed specifically as a 1-page physical or PDF briefing document to be brought to the township Department of Agriculture (DoA) extension office or village agricultural meeting.

#### What It Does
1. **Print-Optimized CSS (`@media print`):**
   - Removes navigation chrome, footers, buttons, and decorative backgrounds.
   - Uses pure high-contrast black ink on white paper for inexpensive monochrome printing.
2. **Adviser Summary Layout:**
   - Field coordinates, township, confirmed water access, and soil pH.
   - Evaluated rotations table with rain shortfall, legume %, and dry season reliability.
   - "What this report did not have" transparency block (missing soil tests or sensor downtime).
   - "Key questions for your local adviser" (seed sources, varieties, local pests).
3. **One-Tap Actions:**
   - `Print or save as PDF` triggering native browser print engine.
   - `Share summary` triggering Web Share API on mobile devices.

#### Refinement Backlog for Agents
- [ ] Ensure PDF layout strictly fits onto a single A4 page without awkward page-break splits.
- [ ] Include a QR code on the printout encoding the field's JSON backup for instant scanning by the extension officer.

---

### S18: What-If Climate Simulator

- **Route:** Accessible via modal inside `/fields/:id/compare`
- **Source Files:** `components/field/what-if.tsx`, `lib/engine/scenario.ts`, `lib/engine/what-if.ts`
- **State:** `Scenario` object (`rainPct`, `tempC`, `delayDays`, `irrigation`)

#### Purpose & Farmer Job to be Done
Allows farmers and extension workers to stress-test their crop plan against extreme climate volatility before putting seeds in the ground.

#### What It Does
1. **Interactive Stress Sliders:**
   - Monsoon Delay: 0 to +30 days.
   - Rainfall Change: -30% to +30%.
   - Temperature Rise: 0 to +4°C.
   - Irrigation Failure: Simulate loss of canal or tube well access.
2. **Real-Time Recalculation:**
   - Instantly re-runs historical 10-year replay simulation under stressed weather parameters.
   - Re-ranks candidate rotations and reveals which strategy survives severe drought.
3. **Persistent Simulation Status Tag:**
   - Displays amber `Hypothetical Scenario Active` banner across the comparison matrix so hypothetical numbers are never confused with historical records.

#### Refinement Backlog for Agents
- [ ] Add one-tap presets: "Late monsoon arrival (2019 repeat)", "Severe Dry Zone drought (-25% rain)".

---

### S19: Pests, Diseases & Biological Host Breaks

- **Route:** `/fields/:id/pests`
- **Source Files:** `app/(app)/fields/[fieldId]/pests/page.tsx`, `components/field/pests-view.tsx`
- **Data Engine:** `lib/engine/pest-outlook.ts`, `lib/data/crops/weather-disease-rules.ts`, `lib/data/crops/host-organisms.ts`

#### Purpose & Farmer Job to be Done
Identifies biological soil pathogen risks and pest carryover cycles. Ensures that alternative rotations actively break disease lifecycles rather than compounding them.

#### What It Does
1. **"Comes Back Too Soon" Return Intervals:**
   - Flags soil-borne pathogens with long survival spans (e.g. *Fusarium* wilt in chickpea requiring 3–4 year breaks).
2. **Weather Favorability Outlook:**
   - Replays historical weather to determine how many past seasons favored specific fungal blights or insect vectors.
3. **Biological Carryover Words:**
   - Translates pathology into plain words: *"Lives in the soil"*, *"Spread by insects"*, *"Flying insect"*.
4. **Watch Recommendations:**
   - Plain advice on sanitation, resistant seed varieties, and non-host break crops.

#### Refinement Backlog for Agents
- [ ] Complete Burmese translations for disease organisms and symptoms in `lib/copy/my.ts`.
- [ ] Cross-reference with Township DoA seasonal pest alerts.

---

### W01: Plan Wizard (Quick Regional Crop Explorer)

- **Route:** `/plan` (and `/plan/crop-screen`)
- **Source Files:** `app/(app)/plan/page.tsx`, `app/(app)/plan/crop-screen/page.tsx`
- **Visuals:**
  - Explorer View: `docs/screenshots/plan-wizard-desktop.png`
  - Comparison View: `docs/screenshots/plan-comparison-desktop.png`
  - Mobile: `docs/screenshots/plan-wizard-mobile.png`, `docs/screenshots/plan-comparison-mobile.png`

#### Purpose & Farmer Job to be Done
Zero-friction entry point for curious farmers or farmers on shared village phones who do not want to save a permanent field boundary. Delivers instant regional crop recommendations in under 60 seconds.

#### What It Does
1. **Step 1: Area Selection:**
   - Quick township search or one-tap regional agro-ecological zone selection (`Ayeyarwady`, `Magway`, `Shan State`).
2. **Step 2: Main Crop & Water:**
   - Pick primary crop (Rice, Sesame, Maize, Groundnut) and water access (`Rain only`, `Sometimes`, `Yes`).
3. **Step 3: Instant Next Crop Comparison:**
   - Generates viable following crops with plain-language explanations of why the option appears, soil health benefits, and what remains unknown.
4. **Transition to Full Field:**
   - "Save sequence and compare this field" button seamlessly upgrades the draft into a permanent S02/S06 field entity.

#### Refinement Backlog for Agents
- [ ] Add pre-downloaded offline sample caches for all 5 agro-ecological zones.

---

### M01: Settings & Data Portability

- **Route:** `/settings`
- **Source Files:** `app/(app)/settings/page.tsx`, `components/settings/settings-view.tsx`
- **Zustand Stores:** `useSettingsStore`, `useFieldsStore`, `useLocaleStore`

#### Purpose & Farmer Job to be Done
Guarantees complete user data sovereignty. Farmers can backup their entire farm history to a portable JSON file, transfer it to another device, or restore it after browser cache clearance.

#### What It Does
1. **Locale & Units Configuration:**
   - Instant language switch: English $\leftrightarrow$ မြန်မာ (Myanmar Unicode).
   - Area unit toggle: Hectares (`ha`) vs Myanmar Acres (`ဧက`).
2. **Export Backup (JSON):**
   - Serializes all fields, crop sequences, custom soil measurements, and plan drafts into a versioned JSON file.
3. **Restore Backup (JSON):**
   - Validates file schema via Zod and populates `localStorage`. Displays toast: *"Restored X fields and Y rotations"*.
4. **Privacy Transparency:**
   - Explicit confirmation of device-only persistence.

#### Refinement Backlog for Agents
- [ ] Add QR code backup export for mobile-to-mobile transfer without file manager interaction.

---

## 4. Agent Refinement Playbook & Work Orders

When launching subagents (`invoke_subagent`) or swarms (`swarm`) to refine any screen, provide these exact parameters:

### Agent Instructions Template
```text
Task: Refine Screen [SCREEN_ID] ([ROUTE])
Master Documentation: docs/SCREEN_DIRECTORY.md
Component Path: [PRIMARY_COMPONENT_FILE]
Visual Reference: docs/screenshots/[SCREENSHOT_FILE]
Invariants to Respect:
1. Light mode only (no dark tokens, no dark: Tailwind classes).
2. Minimum 44px tap targets for mobile hit areas.
3. Never color alone: every risk or verdict chip must pair an icon or words with its tone.
4. Resolution honesty: satellite data must be labeled as regional context around the field.
5. Verification command: npx vitest run tests/components/[MATCHING_TEST].test.tsx
```

### High-Priority Agent Work Packages

| Work Package | Target Screen | Objective | Core Files |
|:---|:---|:---|:---|
| **WP-01** | **S06 Field Hub** | Implement Overview Improvement Plan: township name header, 1-tap unknown card, extension contact line. | `components/field/field-overview.tsx`, `docs/OVERVIEW_IMPROVEMENT_PLAN.md` |
| **WP-02** | **S19 Pests & Diseases** | Complete Burmese translations and verify biological return interval rules. | `components/field/pests-view.tsx`, `lib/copy/my.ts`, `lib/data/crops/weather-disease-rules.ts` |
| **WP-03** | **S16 Printable Report** | A4 print pagination hardening, QR code backup embed, high-contrast monochrome audit. | `components/field/report-view.tsx`, `app/(app)/fields/[fieldId]/report/page.tsx` |
| **WP-04** | **S10 & S18 Compare** | Variety-level cycle length slider, sensitivity toggle for fertilizer costs. | `components/field/rotation-compare.tsx`, `components/field/what-if.tsx` |
| **WP-05** | **W01 Plan Wizard** | Offline bundle pre-caching for 5 heartland agro-ecological zones. | `app/(app)/plan/page.tsx`, `lib/store/plan-draft.ts` |

---

## 5. Fast Token-Efficient Verification Commands

Always run targeted test suites during agent iteration instead of unbounded full-repo tests:

```bash
# Verify component UI logic
npx vitest run tests/components/field-overview.test.tsx
npx vitest run tests/components/farm-profile.test.tsx
npx vitest run tests/components/pests-view.test.tsx
npx vitest run tests/components/comparison-results.test.tsx

# Verify biophysical and agronomic engines
npx vitest run tests/lib/hydrology-three-zone.test.ts
npx vitest run tests/lib/pest-outlook.test.ts
npx vitest run tests/lib/what-if.test.ts
npx vitest run tests/lib/farmer-decision-mcda.test.ts

# Run the complete test suite quietly (minimal token output)
npm run test:quiet

# TypeScript compilation check
npm run typecheck
```
