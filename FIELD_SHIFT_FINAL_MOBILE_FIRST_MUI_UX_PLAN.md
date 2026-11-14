# FIELD SHIFT
## Final Mobile-First, Farmer-Centered UI/UX Product Specification

**One consolidated source of truth — UX Plan v6.0**  
**Date:** 15 November 2026  
**Challenge:** NASA Space Apps Challenge 2026 — *Field Shift: Adapting Farms with NASA Data*  
**Platform:** Browser-based Next.js / React, **Material UI (MUI)**, mobile-first  
**Geographic research context:** Ayeyarwady, Magway, and Shan State, Myanmar; expand only after local review  
**Owners:** Product/UX, frontend, scientific engine/backend, agricultural reviewer, Myanmar localization reviewer  
**Document status:** Implementation proposal built from the uploaded v3.2 science documentation and original app screenshots; not a claim that proposed UI or field validation is already complete.

> **Product promise** — Help farmers explore what to grow after their current crop, compare credible rotation options against past weather and soil context, and decide what to check locally. Field Shift is a **research decision-support prototype**: not a forecast, guaranteed profit estimate, agronomic prescription, or NASA-endorsed product.

### How to use this document

This specification **supersedes previous standalone UX v4/v5 plans and research addenda** for the product interface. The uploaded *Field Shift Whitepaper v3.2* and *Technical Appendix v3.2* remain the scientific authority: UI proposals here must not silently alter model assumptions, data availability, or validation claims. The numbered screens are **responsibilities/surfaces**, not 22 compulsory steps.

**Reading order:** Decision record → first-run flow → 22 screen contracts → MUI design system → science/interaction contracts → testing and delivery.

## Contents

1. [Executive decisions](#1-executive-decisions-and-non-negotiables)
2. [Challenge alignment and research](#2-challenge-alignment-farmer-needs-and-research-basis)
3. [Scientific feature inventory](#3-scientific-feature-inventory-and-honest-ui-status)
4. [First-run journey and navigation](#4-final-first-run-architecture-and-navigation)
5. [22-screen purpose index](#5-screen-map-22-responsibilities-not-22-mandatory-pages)
6. [Detailed screen contracts](#6-detailed-screen-contracts)
7. [Mobile wireframes and key interactions](#7-critical-mobile-layouts-and-interaction-sequences)
8. [Scientific and recommendation rules](#8-result-logic-scientific-honesty-and-evidence-hierarchy)
9. [Data contracts and UI states](#9-data-contracts-and-application-state-model)
10. [MUI design system](#10-mui-mobile-design-system-and-engineering-implementation)
11. [Farmer scenarios](#11-real-world-scenario-matrix-and-recovery-requirements)
12. [Acceptance criteria](#12-acceptance-criteria-and-success-measurement)
13. [Implementation roadmap](#13-implementation-roadmap-and-team-handoff)
14. [Microcopy and localization](#14-copywriting-and-localization-rules)
15. [Research and source references](#15-documentation-and-research-references)

---

## 1. Executive decisions and non-negotiables

| Decision | Final direction | Why it matters |
|---|---|---|
| First-use entry | **Two meaningful choices:** farming area + main monsoon crop → regional preview | Value appears before lengthy data entry |
| Preview meaning | Three **regional rotation examples** when templates legitimately exist; never label a template "your current rotation" | Prevents invented personal context |
| Progression | Use **inline refinement chips/drawers** on results rather than a seven-step compulsory questionnaire | Farmers refine only what matters to them |
| Core navigation | **My Farm / Plan / Learn** with labeled bottom navigation; settings from header | Simple mental model and reachable actions |
| Crop entry | Illustrated cards with Myanmar/local names; dekad date chips; exact dates optional | Reduces typing and date-picker friction |
| Post-paddy methods | **Relay broadcast, post-harvest no-till, post-harvest tillage, grown together, and unknown** are distinct representations | Avoids incorrect sequence and moisture assumptions |
| Soil check | Three qualitative topsoil feel cards + "I don't know"; never convert to numerical root-zone moisture | Farmer observations remain honest |
| Comparison | Current confirmed sequence + two alternatives, **only when comparable**; otherwise partial/unresolved state | No forced "winner" |
| NASA | Show where historical evidence affects the comparison; reveal scale, dates, source and missing coverage | NASA is substantive, not decorative |
| Model status | Built ≠ connected ≠ field-validated; never present proposed datasets as active | Protects trust and scientific accuracy |
| Agency | **Keep mine / Adjust / Discuss with adviser**; local observations can challenge mapped estimates | Farmer makes final decision |
| Delivery | MUI, progressive disclosure, locally saved drafts, responsive to poor connectivity | Practical mobile-first experience |

**Three rules for all teams**

1. **Unknown is never zero.** Missing soil moisture, price, source, buyer, or crop input must remain `unknown`, `not-evaluated`, or another truthful explicit state.
2. **Historical replay is not a forecast.** The documented 2016–2025 comparison explores ten past seasons; it does not predict next season's weather or yield.
3. **A soft priority is not a hard constraint.** Water availability, affordable inputs, labor, machinery and access to buyers may restrict feasibility only where a documented, tested rule enforces them. Until then, show *needs local check*.

## 2. Challenge alignment, farmer needs and research basis

### 2.1 What the challenge needs to see

| Challenge objective | Farmer-visible response | Evidence check |
|---|---|---|
| Explore rotations | Three strategies: confirmed current + at least two alternatives where supported | Clearly distinct crop sequences and season windows |
| Explain suggested options | One reason, one trade-off, one local check per option | Model-derived reason and provenance |
| Climate/water resilience | Historical dry spells, growing-stage heat, crop water balance and rainy-season transitions | Past-period labels, source-specific coverage |
| Soil health and rotations | Residue fate, living cover, nitrogen bounds, disease family breaks, potential erosion exposure | Indicators described as screening, not measured outcomes |
| Farmer priorities | Goals for water, soil, income and fodder; separate constraints | Explicit priority weighting, feasibility status |
| NASA Earth data | POWER and available Landsat influence explainable risk screens; gated sources shown as gated | A reproducible with/without-data demo, not assumed impact |
| Map/geospatial understanding | Township/village first, optional precise parcel and satellite history | Coarse footprint never represented as an exact farm reading |
| Farmer agency | Edit, keep current, record local observations, discuss with adviser | No coercive recommendations |

### 2.2 The users we must test with

- **Low digital confidence:** may recognize crops and seasons but not coordinates, map boundaries or scientific charts.
- **Rain-fed smallholder:** cannot compensate for an irrigation-dependent choice; sometimes knows only seasonal water access.
- **Financially constrained farmer:** seed, labor and transport costs matter before projected margins.
- **Experienced farmer:** may dispute mapped soil or water estimates using local knowledge.
- **Rice/pulse grower:** may relay broadcast black gram into standing rice or sow after harvest.
- **Assisted farmer:** a household member or extension officer may operate the phone; shared-device privacy matters.

These are **testing archetypes**, not stereotypes or validated population segments. Observe the target farmers and extension workers in local context; test dialect, crop pictures, audio usefulness and trust with real users.

### 2.3 Research translated into design decisions

| Research / guidance | What it supports | What it does **not** establish |
|---|---|---|
| GSMA AgriTech UX Design Guidebook (2025) | Short, contextual farm tasks; tangible value; less unnecessary data entry | That any universal two-tap threshold guarantees success |
| Medhi et al., text-free / audiovisual HCI4D studies | Familiar imagery, contextual help, optional audio, co-design | That text should be removed or icons are universal |
| Cuendet et al., VideoKheti (CHI 2013) | Multimodal content can help some low-literacy agricultural users | That a particular seven-step funnel causes abandonment |
| Findlater et al., literacy/audio studies | Pairing understandable text with audio deserves testing | That audio is always beneficial or appropriate |
| Nielsen Norman Group heuristics/progressive disclosure | Status, undo, familiar words, fewer initial choices, advanced details on request | That hidden features should become undiscoverable |
| W3C WCAG 2.2 and WAI Forms | Accessible labels, focus, target sizes, no drag-only tasks | That formal compliance alone proves farmer comprehension |
| Myanmar agriculture and relay references | Local crop transitions differ by region and method | That one sowing offset/name is universally suitable |

**Research stance:** studies from India, general mobile UX, and worldwide agriculture offer design hypotheses; this specific Myanmar application still requires field usability testing and separate agronomic validation.

## 3. Scientific feature inventory and honest UI status

Status below reflects the uploaded **v3.2 whitepaper and appendix**, not an independent audit of the deployed code or latest credentials.

| Engine capability / source | Documented status | Where shown | UI boundary |
|---|---|---|---|
| NASA POWER daily weather | Implemented | Conditions, historical risks, water | Regional grid estimate; not a station measurement |
| ISRIC SoilGrids texture/pH/carbon/retention | Implemented | Soil, water, source details | 250 m modeled soil estimate; **not NASA** and not a soil test |
| Landsat Collection 2 via Planetary Computer | Implemented; one polygon live-checked | Satellite field history | Valid parcel + quality mask; NDVI ≠ crop identity or soil health |
| Crop fit / phenology / climate exposure | Implemented | Crop plan, risks, comparison | Some thresholds and calendar-stage assumptions are unvalidated |
| 3-zone soil-water model and dynamic depletion | Implemented | Water & planting | Root-zone calculation may be unknown without moisture-at-planting initialization |
| Paddy pond and post-paddy seedbed window | Implemented as screens | Rice→pulse transition, water | Paddy surface-water simplifications; **relay overlap not demonstrated** |
| Nitrogen, residue fate, living cover, erosion, crop family recurrence | Screening models implemented | Soil & crop health | Not measured nitrogen gain, soil loss, or disease diagnosis |
| Weighted MCDA, historical replay, regret | Implemented | Comparison, Why, past-year evidence | Scores match stated preferences; not calibrated prediction |
| Economic margin intervals and optional FAO Ky | Implemented with guards | Cost/markets | Only calibrated crop factors; estimates conditional on inputs/benchmarks |
| GPM IMERG rainfall | Partially implemented, credential/live retrieval gated | Rain source detail | Fallback/source mix disclosed; no false satellite-rain success |
| SMAP L4, SRTM, HLS via AppEEARS | Partially implemented | Regional moisture, terrain, satellite | Gate each source until genuinely retrieved/quality checked |
| MODIS NDVI, ECOSTRESS | Proposed | Methods / future availability only | Never show as computed evidence |
| GRACE / GRACE-FO | Challenge dataset, not evidenced as active in this app | Educational context only | No fabricated field-scale groundwater trends |

**Evidence hierarchy:** measured local soil tests / farmer-reported practices → appropriately applied modeled estimates → regional templates, each explicitly labeled. A farmer's report should be retained and prioritized as local input **within supported rules**, but not mistaken for laboratory-validated measurements.

## 4. Final first-run architecture and navigation

### 4.1 Default: two choices → preview

```text
Welcome (language + privacy once)
       ↓
My Farm / Explore options
       ↓
[Choice 1] Select township or village
       ↓
[Choice 2] Select main monsoon crop (illustrated cards)
       ↓
REGIONAL PREVIEW — 3 illustrative patterns if credible templates exist
       ↓
Inline improvements: [+ Next crop] [Water] [Sowing] [Straw] [Goal] [+ Exact field]
       ↓
Confirmed crop sequence + supported evidence → FIELD-INFORMED COMPARISON
       ↓
[Why?] [Water] [Past weather] [Soil] [Satellite] [Money]
       ↓
[Keep my plan] [Adjust alternative] [Save / Discuss with adviser]
```

**"Two taps" means two meaningful selections**, not literally two touch events for every village search. Do not force GPS, a parcel polygon, registration, precise dates, a soil test, a budget, or an adviser review before showing a **regional example**.

**When no suitable template exists:** show only supported ideas and say why there are fewer than three; do **not** manufacture a crop pair or use an unsupported crop to satisfy the challenge's "three strategies" aspiration.

### 4.2 Mode distinction (visible in header and report)

| Mode | Minimum knowledge | What the app may say | What it cannot say |
|---|---|---|---|
| `regional-preview` | Area + main crop | Typical **example** sequences for region and crop, with explanations of data availability | Your actual rotation, best crop for your field, precise water stress |
| `regional-with-evidence` | Same + legitimately retrieved regional weather/soil | Historical conditions **around** the area and conditional examples | Validated field measurement or future forecast |
| `field-incomplete` | Confirmed existing crop sequence; missing decisive inputs | Partial comparison of available dimensions | Complete ranking where evidence insufficient |
| `field-comparable` | Confirmed sequence, relevant local facts and supported criteria | Qualified comparison of current and actual alternatives | Field-validated prediction, assured profit |
| `unresolved` | Priority or decisive candidate evidence absent | Why no ranking can be justified and what would help | Winner, optimistic filled-in score |
| `source-error` | A source failed, timed out or returned unacceptable coverage | Which information is missing and what remains usable | “Everything is working” |

**Do not auto-promote** a regional preview to field-comparable after only adding a goal or a polygon. The actual current rotation must be confirmed; each criterion must pass its own evidence and feasibility checks.

### 4.3 Primary mobile navigation

- **My Farm:** saved fields, draft, latest summaries and quick exploration.
- **Plan:** one planning workspace that starts with regional preview and progressively becomes a field comparison.
- **Learn:** crop library, practical terms and scientific explanation.
- **Header/settings:** language, units, privacy and backups.

Use labeled MUI `BottomNavigation` on stable top-level destinations. During a full-screen field map, crop editor or modal, hide the global bar only if the user has obvious Back, Cancel and Save/Continue controls. On desktop, expand navigation into a side rail or top menu **without duplicating logic**.

### 4.4 Refinement ordering

At regional preview, display only **three highest-value suggestions** initially: `+ Next crop`, `Water: Not set`, `Goal: Not set`. Show `Sowing`, `Straw`, `How sown`, `Soil check`, `+ Exact field` contextually after relevant choices. Keep all controls reachable from a compact `More field details` link, avoiding an overwhelming chip cloud.

### 4.5 Adviser and detailed paths

Experienced farmers and advisers can add exact boundary, precise dates, local soil readings, irrigation months, cost ranges, residue management and crop-method details. They still start from or return to the **same comparison**; advanced inputs improve evidence, not create a parallel scientific product.

## 5. Screen map: 22 responsibilities, not 22 mandatory pages

| ID | Screen / surface | Unique job | Entry / default surface | Primary action |
|---|---|---|---|---|
| 01 | Welcome & language | Set expectation and privacy | Once / Settings | Explore |
| 02 | My Farm / home | Start or resume the next useful task | Home tab | Explore or Continue |
| 03 | Find farming area | Select recognizable approximate location | Quick start | Use this area |
| 04 | Exact boundary | Mark parcel for area/vegetation | Optional mapping view | Confirm boundary |
| 05 | Field context | Capture irrigation and field type | Water / Field details sheet | Save context |
| 06 | Crop sequence | Capture actual rotation, seasons and transitions | First crop + crop drawer | Confirm sequence |
| 07 | Practices & local observations | Capture residue, sowing method and tactile observation | Conditional sheets | Save observation |
| 08 | Goals and hard limits | Capture priorities and feasibility constraints | Goal / Limits sheet | Apply preferences |
| 09 | Review details | Correct material inputs and assumptions | Contextual field review | Confirm for analysis |
| 10 | Evidence progress | Reveal source loading and failure | Inline status in Plan | View what is ready |
| 11 | Compare / regional preview | Reveal strategy options and trade-offs | Plan main surface | Explore or Refine |
| 12 | Why this option? | Explain one option causally | Result drill-down | Check what matters |
| 13 | Water & planting | Explain modeled water stress and sowing windows | Result detail | Check/edit moisture or dates |
| 14 | Past weather risks | Show stage-specific risks across historical years | Result detail | Inspect a historical year |
| 15 | Soil & crop health | Translate nitrogen, cover, disease and erosion screens | Result detail | Review practice effects |
| 16 | Satellite field history | Show quality-screened imagery for exact plot | Optional field detail | Inspect clear observations |
| 17 | Costs and markets | Inspect cost/margin and sale feasibility | Optional result detail | Enter local economics |
| 18 | Adjust strategy | Run a supported what-if and keep changes reversible | Result action | Recompare |
| 19 | Adviser summary / report | Share evidence, limitations, local checks | Result action | Save / print / share |
| 20 | Crop library | Identify and understand supported crops | Learn tab | View crop guidance |
| 21 | Data and methods | Audit scientific sources and evidence | Learn + results drill-down | Inspect provenance |
| 22 | Settings, privacy and backup | Control display and locally stored information | Header/settings | Apply settings / export |

**Page architecture:** 02, 03, 06 quick crop entry, 11, 19 and 20 are the primary visible screens. Others are optional pages, drawers, sections or transient states depending on screen size and task complexity. Assign a distinct purpose and result to every surface; avoid two routes that answer the same question.

## 6. Detailed screen contracts

**Implementation template:** Every screen below has exactly one dominant purpose. `Primary action` must work; secondary links may open help, evidence or edits. Each UI should include Loading, Empty/Unknown, Error and Completed states where relevant. Purpose and acceptance are mandatory in pull-request reviews.

### S01 — Welcome & language

**Purpose.** Help the farmer understand the tool’s role, data flows and language options before trusting it.

**Farmer's question.** *What is this tool, and where does my information go?*

**Entry / where it lives.** First use; later Settings.

**Visible UI.** One line: “Explore crop rotation options using past weather, soil information and your experience.” Language cards; concise privacy disclosure; “Learn about data” link.

**Primary interaction / action.** Choose Myanmar / English; optionally hear help; Continue.

**Evidence and failure rules.** No forced tutorial; explain that field names and practices are stored in the browser while location/outline requests leave the device; no NASA endorsement.

**Recommended MUI.** `Button, RadioGroup/CardActionArea, Alert, Link`.

**Screen success criterion.** Farmer can correctly say the app supports comparison rather than forecasting or telling them to plant.

### S02 — My Farm / home

**Purpose.** Present one immediately useful action and make saved work easy to resume.

**Farmer's question.** *What should I do next?*

**Entry / where it lives.** Bottom nav: My Farm.

**Visible UI.** Primary “Explore next crops”; simple saved field cards with location, last change and current status; draft recovery; offline status.

**Primary interaction / action.** Explore, resume draft, open field, add another field.

**Evidence and failure rules.** Do not require farm registration to preview. Distinguish “regional example”, “needs crops”, “unresolved”, “comparison saved”.

**Recommended MUI.** `AppBar, Card, CardActionArea, Stack, Button, BottomNavigation`.

**Screen success criterion.** A new or returning farmer identifies the next action without instruction.

### S03 — Find farming area

**Purpose.** Get a recognizable approximate location without GIS expertise.

**Farmer's question.** *Where do you grow your crops?*

**Entry / where it lives.** Quick start after Home; direct return from preview.

**Visible UI.** Popular region/township choices; village list/search; similar-place disambiguation; optional “Use my location”; plain “Approximate area” label.

**Primary interaction / action.** Choose place and continue to crop selection; optional map link.

**Evidence and failure rules.** No forced coordinates; GPS denial and map tile failure cannot block preview; never call the town center the parcel center.

**Recommended MUI.** `List, ListItemButton, TextField/Autocomplete fallback, Button, Alert`.

**Screen success criterion.** User can select region/place without drawing a polygon and knows it is approximate.

### S04 — Exact boundary (optional)

**Purpose.** Capture a real parcel boundary when area and satellite clipping matter.

**Farmer's question.** *Where exactly does my field begin and end?*

**Entry / where it lives.** Open “Mark exact field” from Plan or field context.

**Visible UI.** Map and location marker; tap-to-place corners or trace; area in local units; Undo, Redraw, simpler base map, manual coordinates in Advanced.

**Primary interaction / action.** Confirm boundary; cancel safely.

**Evidence and failure rules.** Warn on unusual size (such as 465 ha example); do not hard reject diverse farm sizes; warn when field smaller than valid sensor footprint; partial map imagery is not a blocker.

**Recommended MUI.** `Dialog/full-screen layout, ToggleButtonGroup, Button, IconButton, Alert`.

**Screen success criterion.** Farmer can recognize the selected parcel and correct an oversized or wrong selection.

### S05 — Field context

**Purpose.** Record the water and land facts that may change interpretation.

**Farmer's question.** *Is this paddy or upland, and what water is actually available?*

**Entry / where it lives.** Water chip or detailed field sheet.

**Visible UI.** Rain only / seasonal irrigation / reliable irrigation / unknown; irrigated months when applicable; paddy/upland/unknown; flood/drainage/salinity observation and approximate field area optional.

**Primary interaction / action.** Save details and return to comparison.

**Evidence and failure rules.** Never assume “unknown irrigation” means rain-only. Local observations and SoilGrids should be separately labeled; field-specific tests can override modeled estimates where rules allow.

**Recommended MUI.** `RadioGroup, CardActionArea, Select/ToggleButtonGroup, Accordion, FormHelperText`.

**Screen success criterion.** Water and land situation is stored as selected or explicitly unknown; new status appears on preview.

### S06 — Crop sequence and timing

**Purpose.** Capture what has actually been grown and how crops follow one another.

**Farmer's question.** *What did you grow first, and what came next?*

**Entry / where it lives.** Second initial choice (main crop); + Next crop drawer.

**Visible UI.** 2-column illustrated crop cards with local/English names; season chips; fallow/not yet planted; dekad (Early/Mid/Late month); optional exact date; crop sequence; method-specific transitions.

**Primary interaction / action.** Select main crop for preview; later Confirm “This is my current rotation”.

**Evidence and failure rules.** A single crop is **not** a complete current rotation. Preserve approximate date intervals; prevent hidden fake exact dates; allow legitimate relay overlaps; other/unlisted crops may be recorded but not falsely evaluated.

**Recommended MUI.** `Grid, CardActionArea, CardMedia, ToggleButtonGroup, Chip, Drawer, optional MUI X DatePicker`.

**Screen success criterion.** Farmer identifies crop(s) correctly and accurately explains their crop order.

### S07 — Farming practices and local observations

**Purpose.** Capture behaviors that affect residue/soil models and rice-to-pulse transitions.

**Farmer's question.** *What happens after harvest, and how did you sow the next crop?*

**Entry / where it lives.** Conditional Straw / How sown / Soil check drawers.

**Visible UI.** Illustrations for burn/remove fodder/leave as mulch/incorporate; relay into standing rice vs after-harvest no-till/tillage; 3 tactile topsoil cards; unknown option.

**Primary interaction / action.** Save observation and return to same comparison.

**Evidence and failure rules.** Unknown residue fate → no nitrogen benefit assumed. Relay overlap modeled separately; subjective topsoil feel never becomes measured volumetric root-zone moisture or a universal sowing safety result.

**Recommended MUI.** `CardActionArea, RadioGroup, Drawer, Alert, HelpButton`.

**Screen success criterion.** Farmer can describe practice and observation without inventing scientific values.

### S08 — Goals and hard limits

**Purpose.** Record what matters, separately from what is impossible.

**Farmer's question.** *What do you want to improve, and what can you realistically do?*

**Entry / where it lives.** Goal chip and optional more-limits drawer.

**Visible UI.** Primary goal (water, soil, income, forage, reduce risk); optional second goal; water/budget/seeds/labor/machinery/buyer availability with “not sure”; clear “Goal” vs “Cannot do”.

**Primary interaction / action.** Apply priorities and feasibility flags.

**Evidence and failure rules.** Only claim enforced restriction if backed by tested rule; otherwise mark Needs local check. If top ranked goal cannot be computed, unresolved status takes precedence.

**Recommended MUI.** `RadioGroup, Card, Accordion, FormHelperText, Alert`.

**Screen success criterion.** Farmer can name their main goal and explain a hard constraint in their own words.

### S09 — Review my details

**Purpose.** Prevent a materially wrong farm profile from being used as truth.

**Farmer's question.** *Did the app understand my farm correctly?*

**Entry / where it lives.** Optional “Review inputs” before field comparison or report.

**Visible UI.** Short pictorial recap: place scale, crops/order/timing, water, method, priority, provenance (“You said”, “regional estimate”, “not known”); Edit beside each.

**Primary interaction / action.** Confirm details or correct one entry.

**Evidence and failure rules.** Never require this as a gate to regional preview. Reopen input sheet without losing others; invalidation runs after changes.

**Recommended MUI.** `List, Card, Chip, Button, Alert`.

**Screen success criterion.** Farmer can find and correct a seeded wrong crop/field entry without restarting.

### S10 — Evidence preparation (inline state)

**Purpose.** Make retrieval progress understandable and reversible.

**Farmer's question.** *What information is ready, still loading, or unavailable?*

**Entry / where it lives.** Inline inside Plan/Compare; not a standalone mandatory route.

**Visible UI.** Weather, soil, satellite and optional extra-source rows with Ready/Loading/Cached/Unavailable/Not connected; skeleton for not-yet-calculated metrics; Retry when valid.

**Primary interaction / action.** Continue with available evidence or retry a failed source.

**Evidence and failure rules.** No infinite spinner, fake progress or optimistic fallback; data provider success ≠ usable observations; preserve last valid comparison with “stale after edit” indicator.

**Recommended MUI.** `Skeleton, LinearProgress, Alert, List, Snackbar`.

**Screen success criterion.** Farmer understands source failure without losing inputs or mistaking missing values for zero.

### S11 — Regional preview and rotation comparison

**Purpose.** Show concrete strategy alternatives and the most important trade-offs immediately.

**Farmer's question.** *Which crop-rotation possibilities deserve a closer look?*

**Entry / where it lives.** Plan main destination, immediately after area + crop.

**Visible UI.** Three stacked cards **only where valid**; preview labels “Regional example”; after confirmation label “Your recorded rotation” vs Alternatives A/B; benefit, downside, feasibility/evidence flag, what to check; compact refinement chips.

**Primary interaction / action.** Make this match my farm / Why? / Adjust / Keep mine.

**Evidence and failure rules.** No winner if unresolved; no fabricated three templates; show historical range not forecast; no field-scale NDVI without parcel; show source-impact where meaningful.

**Recommended MUI.** `Stack, Card, CardActionArea, Chip, Button, Alert, Accordion`.

**Screen success criterion.** Farmer identifies example vs personal comparison and can describe one advantage and one risk.

### S12 — Why this option?

**Purpose.** Make the result explainable, including reasons against it.

**Farmer's question.** *Why might this rotation help me—and what could make it unsuitable?*

**Entry / where it lives.** Tap Why on a strategy card.

**Visible UI.** One-sentence interpretation; 2–3 supporting model factors; trade-offs; uncertainty; local-check questions; link to underlying source/assumption; optional audio.

**Primary interaction / action.** Open relevant evidence or edit an input.

**Evidence and failure rules.** Only attribute causal claims to actual evaluated factors; if rainfall did not change a ranking, say so. Do not imply nitrogen or yield gains are validated outcomes.

**Recommended MUI.** `Card, Accordion, Alert, Link, optional AudioExplanationButton`.

**Screen success criterion.** User can restate a reason, disadvantage and unknown factor accurately.

### S13 — Water and planting window

**Purpose.** Explain when crop water demand and seedbed condition may cause problems.

**Farmer's question.** *When could water or sowing conditions be difficult?*

**Entry / where it lives.** Water chip/detail from comparison.

**Visible UI.** Seasonal water-demand and rainfall visualization; historical shortage over relevant crop periods; rice→pulse method switch; drainage observation and 3-card topsoil feel; source quality.

**Primary interaction / action.** Add/check sowing conditions; revise date or water input.

**Evidence and failure rules.** Three-zone root-zone initialization unknown without supported measured/initialized moisture. Hand feel is qualitative. Post-paddy drainage rules cannot be applied unchanged to relay sowing; no automatic “safe to sow”.

**Recommended MUI.** `Tabs/ToggleButtonGroup, Card, Alert, chart with text equivalent, Drawer`.

**Screen success criterion.** Farmer understands what model can say and what needs hand/field verification.

### S14 — Past weather risks

**Purpose.** Explain the historical frequency and timing of crop-sensitive weather hazards.

**Farmer's question.** *Which past seasons had risky heat, rain or dry spells?*

**Entry / where it lives.** Past weather drill-down.

**Visible UI.** Plain risk headline; ten-year season list (2016–2025); growing-stage labels; heat/frost/rain/dry-spell risk; illustrative historical year view and source metadata.

**Primary interaction / action.** Inspect a year, compare another strategy.

**Evidence and failure rules.** Past weather **not next-season forecast**; assumed phenology thresholds labeled; missing years excluded visibly; no single threshold treated as crop failure proof.

**Recommended MUI.** `Card, Tabs, Accordion, Table/Chart, Alert`.

**Screen success criterion.** Farmer recognizes at least one relevant historical risk without calling it a prediction.

### S15 — Soil and crop health

**Purpose.** Translate management and crop sequence into bounded soil and pest-related insights.

**Farmer's question.** *How might each rotation affect soil cover and soil-related risks?*

**Entry / where it lives.** Soil drill-down.

**Visible UI.** Cover-time summary, residue fate illustration, nitrogen contribution bounds, repeat-family alerts, fallow gaps, erosion exposure where slope available; compare strategies.

**Primary interaction / action.** Change residue practice or view local checks.

**Evidence and failure rules.** Nitrogen budget partial; “more legumes” not guaranteed soil improvement; erosion hazard is only a screen, crop family recurrence not disease diagnosis; no slope reading if SRTM gated.

**Recommended MUI.** `Card, Accordion, Alert, comparison rows`.

**Screen success criterion.** Farmer can name one potential soil effect and why it needs local confirmation.

### S16 — Satellite field history

**Purpose.** Show what quality-screened vegetation images can actually reveal for an outlined parcel.

**Farmer's question.** *What did satellites observe over time at this field?*

**Entry / where it lives.** Optional Satellite from precise field or Learn.

**Visible UI.** Field outline on imagery; cloud-free dated NDVI/NDMI summaries, valid coverage label, image timeline and no-data handling; simple comparison with farmer field photo (if entered).

**Primary interaction / action.** Inspect a clear date or refine boundary.

**Evidence and failure rules.** Require valid polygon and clear-pixel coverage ≥ documented gate; NDVI means greenness, not crop ID, exact bare soil, or soil health. Coarse datasets remain regional.

**Recommended MUI.** `Map panel, Card, Slider/Tabs, Alert, caption`.

**Screen success criterion.** User understands dates, cloud gaps and what satellite indices cannot prove.

### S17 — Costs and markets

**Purpose.** Help farmer judge conditional affordability and sale opportunities.

**Farmer's question.** *Could I afford this crop, and can I sell it locally?*

**Entry / where it lives.** Money detail from comparison.

**Visible UI.** Estimated **gross-margin ranges**, input costs, local price/year/source, crop-specific units and conversions; optional own values; local buyer confidence and seed availability.

**Primary interaction / action.** Enter my costs/prices, compare estimates.

**Evidence and failure rules.** Benchmark ranges are dated conditional estimates, not guaranteed income; water-linked Ky only where calibrated; market/buyer feasibility remains unverified until rules exist.

**Recommended MUI.** `TextField, Card, RadioGroup, Alert, Table`.

**Screen success criterion.** Farmer can identify at least one assumption required before expecting income.

### S18 — Adjust strategy (what-if)

**Purpose.** Allow reversible edits and expose what changes in the result.

**Farmer's question.** *What happens if I change one crop or planting period?*

**Entry / where it lives.** Adjust from strategy card.

**Visible UI.** Tap-to-replace crop, change dekad/transition, edit priorities or practice; short “what changed” diff; preserved baseline and reset.

**Primary interaction / action.** Recompare / Undo / Keep original.

**Evidence and failure rules.** Invalidate stale metrics and rerun only supported engines; no change in score without recomputation; approximate date treatment clear; allow rejection of alternatives.

**Recommended MUI.** `Drawer, Card, ToggleButtonGroup, Button, Alert`.

**Screen success criterion.** Farmer can change a crop then return to comparison without losing the previous plan.

### S19 — Adviser summary and report

**Purpose.** Make trade-offs, limitations and local checks portable beyond the phone.

**Farmer's question.** *What can I show or discuss before deciding?*

**Entry / where it lives.** Save/Share from comparison.

**Visible UI.** One-page farmer summary: area precision, current/alternatives, primary goal, benefits, concerns, assumptions, source dates, missing data, local checklist; optional technical annex.

**Primary interaction / action.** Save local / Print / Share file.

**Evidence and failure rules.** Regional preview must be labeled regional; no fabricated source numbers; browser data may not survive clearing; sharing must be user-controlled.

**Recommended MUI.** `Card, Button, Dialog, print stylesheet, optional share action`.

**Screen success criterion.** Report explicitly differentiates local facts, models, assumptions and unresolved questions.

### S20 — Crop guide / Learn

**Purpose.** Explain crops in culturally recognizable terms and how they fit rotations.

**Farmer's question.** *What is this crop and what should I consider before growing it?*

**Entry / where it lives.** Learn tab; crop-card info action.

**Visible UI.** Farmer-tested crop photo/illustration and Myanmar name, regional season, water requirements, likely benefits, risks, variety caveat, reading/listening options.

**Primary interaction / action.** Explore crop, add to strategy if eligible.

**Evidence and failure rules.** No made-up suitability for unmodeled custom crops; locally reviewed variety/season claims; readable text still available without audio.

**Recommended MUI.** `Grid, CardActionArea, Accordion, Typography, IconButton`.

**Screen success criterion.** Farmer recognizes a crop and can describe one basic requirement.

### S21 — Data & methods

**Purpose.** Make sources, limitations and model decisions inspectable without cluttering farm flow.

**Farmer's question.** *Where does this conclusion come from, and how reliable is it?*

**Entry / where it lives.** Learn/source link from every result.

**Visible UI.** Sources with provider, observation date/range, native resolution, quality and source mix; implemented/partial/proposed, model methods, uncertainty, link to scientific appendix.

**Primary interaction / action.** Inspect a metric or open original source.

**Evidence and failure rules.** A connected API is not a validated field estimate; distinguish NASA from SoilGrids/Microsoft; keep native scale.

**Recommended MUI.** `Accordion, Table, Link, Chip, Alert`.

**Screen success criterion.** Reviewer can trace any reported claim to inputs and evidence status.

### S22 — Settings, privacy and backup

**Purpose.** Give control over device-local records and accessibility.

**Farmer's question.** *How do I change language or protect and keep my work?*

**Entry / where it lives.** Header Settings; also access from Home.

**Visible UI.** Myanmar/English language, units (acre/ha, local produce units), font sizing if supported, optional audio preference, export/import local backup, per-field delete with confirmation.

**Primary interaction / action.** Apply settings / Export / Delete with review.

**Evidence and failure rules.** No accounts assumed. Clearly disclose that IndexedDB/localStorage can be cleared, shared devices expose local records, and external location requests still leave device.

**Recommended MUI.** `List, Switch, Select, Button, Dialog, Alert`.

**Screen success criterion.** User can locate language/privacy settings and export or delete records intentionally.

## 7. Critical mobile layouts and interaction sequences

### 7.1 Quick start — home to preview

```text
┌──────────────────────────────────┐
│ Field Shift            Help  ☰  │
│                                  │
│ What could you grow next?        │
│ Explore ideas for your area.     │
│                                  │
│ [ Select village / township    ] │
│    e.g., Maubin, Magway, ...     │
│                                  │
│ What is your main monsoon crop?  │
│ [photo Rice]   [photo Sesame]    │
│ [photo Maize]  [photo Other]     │
│                                  │
│         [ Show crop ideas ]      │
│ ──────────────────────────────── │
│ My Farm       Plan       Learn   │
└──────────────────────────────────┘
```

Two meaningful choices are sufficient **only to preview regional examples**. If location cannot be resolved, show a meaningful retry and never fabricate local conditions. For crop tiles use recognizable, locally tested imagery plus Myanmar text, not icons alone; include accessible image alternatives.

### 7.2 Results — initial regional preview

```text
┌──────────────────────────────────┐
│ ← Crop ideas for Maubin         │
│ REGIONAL EXAMPLES — NOT MY FARM │
│ Based on location + main crop   │
│                                  │
│ Make this match your farm:       │
│ [+ Next crop] [Water: ?] [Goal:?] │
│ [More field details]             │
│                                  │
│ Pattern 1: Rice → winter pulse   │
│ [What it may help]  [Trade-off]  │
│ [Missing evidence / local check] │
│ [Why consider this?]             │
│                                  │
│ Pattern 2: ...                  │
│ Pattern 3: ... (when supported)  │
│                                  │
│ [Record my real crop sequence]   │
└──────────────────────────────────┘
```

No “best for you” badge, no “your current rotation”, no invented price or historical water-stress values. A regional template can be shown immediately, while live NASA/ISRIC calculations appear only after actual retrieval or documented cache/precalculation. If three credible templates do not exist, show fewer and state the limitation.

### 7.3 Results — field-informed comparison

```text
┌──────────────────────────────────┐
│ Compare my rotation             │
│ Field-informed / evidence notes │
│ Main goal: Save water [Change]  │
│                                  │
│ MY CURRENT: Rice → Black gram   │
│  Water: known / unknown         │
│  Soil: potential benefit        │
│  Main drawback: ...             │
│                                  │
│ OPTION A: Rice → ...            │
│  Benefit + drawback + field check│
│                                  │
│ OPTION B: Rice → ...            │
│  Benefit + drawback + field check│
│                                  │
│ [Why?] [Water] [Soil] [Money]    │
│ [Keep mine] [Adjust] [Report]    │
└──────────────────────────────────┘
```

When the engine is `unresolved`, replace any selected-winner presentation with: **“We can compare parts of these options, but cannot identify one as better with the evidence available.”** Show which exact missing criterion matters and what the farmer can check. A tie should also not be visually exaggerated.

### 7.4 Inline refinement sheets

- **Crop sheet:** crop cards → existing sequence → fallow / next crop → optional dates → confirm actual sequence.
- **Water sheet:** rain only / some months / reliable / unknown → optional local observations; explain difference between availability and crop demand.
- **Goal sheet:** one primary goal with optional secondary goal → separate availability constraints; if unenforced, flag clearly.
- **Sowing sheet:** show only for relevant crop transition; relay before harvest, after-harvest without plowing, after-harvest with preparation, grown together or unknown.
- **Soil feel sheet:** very wet / moist / dry / can't check; ask when observed and soil texture when relevant.

Use an explicitly opened MUI `Drawer` with enough height for a readable title, stable primary action, and safe Back/Close/Cancel. Do not rely on swipe gestures or put two competing fixed action bars on narrow devices.

### 7.5 Relay sowing: stateful UI, not ordinary crop overlap

For a recorded **rice → pulse** sequence, ask *“How did you sow the pulse?”* (not universally the same in all regions). An example relay timing of several days before rice harvest may be offered only as editable, locally checked guidance; **do not preselect a timing as if the farmer reported it**.

```text
Rice standing ──────────────── Rice harvest
                 └── Pulse sow (relay, before harvest)
                     Pulse continues after harvest ─────────▶

Rice harvest ── drainage/preparation ── Pulse sow (after harvest)
```

Use a method-specific `CropTransition` model (Section 9). A UI can show overlap, but the current v3.2 simulation has not demonstrated simultaneous rice-plus-pulse water extraction. In numerical comparisons, a relay case must be gated `relay_model_unverified` for affected metrics until scientific work is complete. Do not reapply the post-harvest wet-seedbed rejection logic to relay sowing.

### 7.6 Soil moisture hand-feel question

Use three illustrated, farmer-tested cards with descriptions: **Very wet (water/shine visible)**, **Moist (holds together, depending on texture)**, and **Dry (crumbles/hard depending on texture)**. Also offer **“I cannot check / I don't know.”** Ask whether the observation was made now, at planting, or remembered, and allow sandy/loamy/clayey/unknown texture when known.

**Scientific limit:** The qualitative feel result must remain a **topsoil observation**, not a numerical soil-water profile. Soil texture and timing change its meaning. It must not initialize the 3-zone hydrological model with invented volumetric percentages or automatically declare an ideal planting window.

## 8. Result logic, scientific honesty, and evidence hierarchy

### 8.1 Do not let the UI manufacture a crop recommendation

**The most important guardrail:** A regional crop *template*, a calculated *comparison*, and a validated *field recommendation* are not interchangeable. The v3.2 models are not field-validated, so even a complete result is a qualified comparison, not a validated prescription.

The comparison pipeline should be:

```text
region and selected crop
   ├─ supported regional templates ─────────────→ illustrative preview
   └─ no supported templates ────────────────────→ explain limited catalog

farmer confirms current crop sequence
   → known/unknown crop method + dates + water/field context
   → candidate generation with crop/season rules
   → feasibility: known hard constraints vs flags vs unknown
   → data adapters + per-criterion evidence/provenance
   → comparable candidate sets / incomplete candidates
   → v3.2 ranking if its evidence doctrine permits
   → field comparison OR unresolved/partial explanation
```

If an alternative requires irrigation that the farmer does not have, *do not make a soft “save water” preference override that restriction.* Where the engine lacks a rule for a restriction (such as equipment or seed supply), **do not claim the crop passed**; show a practical check needed before use.

### 8.2 Candidate cards: required content contract

Every primary strategy card has the same structure, whether it is an example or field-informed:

1. **Identity** — sequence of crops, growing season and “Regional example” vs “My recorded rotation” vs “Alternative”.
2. **Fit and constraints** — Feasible (supported), Infeasible (with reason), Needs local check, or Not evaluated. No color-only indicator.
3. **Farmer priority** — how the option relates to the selected goal where supported; if no goal, describe dimensions without ranking.
4. **One potential benefit** — supported model reason, not a predicted guaranteed benefit.
5. **One meaningful disadvantage** — water, disease recurrence, timing, cost or other relevant trade-off.
6. **Unknown / evidence** — plainly stated missing input, source scale or model assumption.
7. **Actions** — Why? / Adjust / Keep mine / Compare details.

Never show “best option” for `regional-preview`, `field-incomplete` or `unresolved`. When a score gap is small or ranking switches with reasonable priorities, avoid exaggerated badges and expose sensitivity. The primary result is **choice clarity**, not an impressive score.

### 8.3 Historical evidence and its impact on the ranking

The NASA challenge rewards meaningful Earth observation use. Build a reproducible **Evidence changes the answer?** detail for demonstration or expert review:

- Keep the same field context, farmer constraints and candidate rotations.
- Compare the **baseline** (crop calendar and available local context) against the same set **with legitimately retrieved NASA weather evidence**.
- Show which risks and comparative metrics change (rainfall shortfall, heat or dry-spell exposure), and whether the ordering changes.
- If the ranking **does not** change, explicitly say “These observations changed the risk explanation but not the ordering” or “No ranking change detected.”
- If a source is withheld, expose what becomes unknown and whether the engine correctly refuses to rank.
- Preserve input hash, data source and version, model version, baseline years, and output flags for repeatable testing.

Do not claim the demonstration has been run: the whitepaper describes its protocol but records no results. Do not hide the baseline comparison behind technical charts if a simple sentence suffices for the farmer.

### 8.4 Farmer knowledge vs mapped estimates

Use a **two-column provenance disclosure**, not a silent overwrite:

| Known by farmer / adviser | From maps and models |
|---|---|
| Crop sequence and approximate planting period | Regional rainfall and heat record |
| Soil test or surface observations | SoilGrids 250 m soil properties |
| Real irrigation access and drainage observations | Modeled crop demand and soil-water screen |
| Residue handling / actual price | Assumed crop traits or sourced benchmark ranges |

When two inputs disagree, display “You observed…” and “Regional estimate suggests…”. Let the farmer correct their entered fact, but do not claim such a correction scientifically validates every outcome. Where priority hierarchy is defined in the engine, use the stronger local input and record its source and date.

### 8.5 Source-specific failure and display rules

| Source / model | No valid result should display | Never substitute |
|---|---|---|
| NASA POWER | “Regional weather unavailable for this analysis” | A fake heat or rain series |
| GPM IMERG | POWER fallback **only as documented and labeled**, or unknown | “Satellite rainfall ready” if not retrieved |
| SMAP | “Regional soil-moisture layer not connected/available” | A field moisture measurement |
| ISRIC SoilGrids | “Mapped soil estimate unavailable; local test can help” | pH = 7 or default texture |
| Landsat | “No usable clear observations for the selected field/dates” | An inferred crop identity or healthy soil |
| SRTM | “Slope screening unavailable” | An erosion pass |
| Three-zone water | “Cannot quantify this stress without supported initial moisture” | Qualitative feel → numerical saturation |
| Nitrogen / residues | “Soil-N contribution unquantified without residue practice” | Guaranteed fertility gain |
| Economics | “Local price/buyer not confirmed; margin range conditional” | Guaranteed profit or local market access |
| Relay hydrology | “Relay transition recorded; numerical overlapping-crop water estimate not yet supported” | Ordinary sequential water accounting |

---

## 9. Data contracts and application-state model

The following types are **proposals for UI/backend coordination**; verify real repository schemas and adapters before migration. Avoid retrofitting the science engine with invented defaults just to render a complete screen.

```ts
type ViewMode =
  | 'regional-preview'
  | 'regional-with-evidence'
  | 'field-incomplete'
  | 'field-comparable'
  | 'unresolved';

type SourceStatus =
  | 'idle' | 'loading' | 'ready' | 'cached'
  | 'unavailable' | 'not-connected' | 'low-quality' | 'failed';

type EvidenceOrigin =
  | 'farmer-report' | 'measured-local-test' | 'earth-observation'
  | 'modeled' | 'regional-template' | 'analyst-assumption';

type DateChoice =
  | { precision: 'exact'; isoDate: string; origin: 'farmer-report' }
  | { precision: 'dekad'; month: number; year?: number;
      part: 'early' | 'mid' | 'late';
      origin: 'farmer-report' | 'regional-template' }
  | { precision: 'season'; season: 'monsoon' | 'post-monsoon' | 'summer';
      origin: 'farmer-report' | 'regional-template' }
  | { precision: 'unknown' };

type CropTransition = {
  fromCropId: string;
  toCropId: string;
  method: 'relay-broadcast' | 'post-harvest-zero-till'
        | 'post-harvest-tillage' | 'intercrop' | 'unknown';
  relativeTiming?: {
    relation: 'before-harvest' | 'after-harvest' | 'unknown';
    offsetDays?: number; // must be farmer-confirmed or explicitly templated
    approximate?: boolean;
  };
  origin: 'farmer-report' | 'adviser-report' | 'regional-template';
};

type SoilFeelObservation = {
  condition: 'very-wet' | 'moist' | 'dry' | 'unknown';
  soilTexture?: 'sandy' | 'loamy' | 'clayey' | 'unknown';
  observedWhen: 'now' | 'at-sowing' | 'remembered' | 'unknown';
  depthCm?: number;
  measuredVolumetricMoisture: null; // never inferred from feel cards
  origin: 'farmer-report' | 'adviser-report';
};

type FeasibilityCheck = {
  constraintId: string;
  state: 'enforced-pass' | 'enforced-fail' | 'needs-local-check'
       | 'not-evaluated' | 'unknown';
  reason: string;
  ruleVersion?: string;
};

type EvidenceEnvelope<T> = {
  value: T | null;
  origin: EvidenceOrigin;
  sourceName?: string;
  productVersion?: string;
  observedPeriod?: string;
  spatialResolution?: string;
  qualityStatus: SourceStatus;
  reasonUnknown?: string;
  processingVersion?: string;
};

type StrategyResult = {
  strategyId: string;
  kind: 'regional-example' | 'confirmed-current' | 'alternative';
  metrics: Record<string, EvidenceEnvelope<number | string>>;
  constraints: FeasibilityCheck[];
  comparisonState: ViewMode;
  rationale: string[];
  tradeoffs: string[];
  localChecks: string[];
};
```

### 9.1 Approximate dates are intervals

For “October — Late”, store *21 October to end of month* as an **interval** rather than pretending a chosen exact day was observed. Choose one implementation path explicitly:

- **Preferred:** calculate bounds / sensitivity across feasible dates and present a range when appropriate.
- **Simpler prototype:** choose a representative day only as a labeled model assumption, and avoid day-precise hazard claims.

Persist crop year/season context to prevent the December–January sequence from appearing reversed. “Exact date” is optional and should not be forced on farmers using remembered crop history.

### 9.2 Data lifecycle and edit invalidation

```text
DRAFT INPUT → REGIONAL PREVIEW → REFINEMENT → EVALUATING
                              ↓                 ↓
                           input edit       PARTIAL / COMPARABLE / UNRESOLVED
                              ↓                 ↓
                     previous output STALE ← view saved output
                              ↓
                    re-evaluate supported criteria
```

Never keep an old water stress chart or rank after the farmer changes sowing dates, crop sequence or irrigation when those outputs depend on it. Show “Updating comparison” while retaining old results as **stale**, not silently treating them as current.

**Cache:** browser-stored names, crop history, preferences, reports and optional backup; server-side geographic source queries keyed by location/time and source version as already documented. A saved local draft works without network, but new NASA data requests do not. Do not promise offline remote analysis or cross-device sync unless implemented.

### 9.3 Result and data-state matrix

| Situation | Page behavior | CTA |
|---|---|---|
| Area + main crop only | Regional examples, no personalized winner | + My next crop |
| Confirmed rotation, priority missing | Multi-dimension description without priority-specific winner | Choose main goal |
| Confirmed rotation, top priority unavailable | Unresolved; say exactly what is missing | Add relevant input / inspect limitations |
| Some candidates have incomplete evidence | Separate complete and partial evidence sets | Explore why incomplete |
| Three alternatives not available | Show available patterns, no filler | Adjust candidate criteria |
| NASA request slow | Show template and real loading status separately | Continue with available context |
| Field polygon has too few clear pixels | Withhold vegetation index | Change dates / use regional evidence |
| Relay mode selected | Record overlap and display local check; gate unsupported quantitative overlap | See relay practice explanation |
| User rejects an alternative | Preserve current strategy and reasons | Keep my plan |

---

## 10. MUI mobile design system and engineering implementation

### 10.1 Design priorities

- **Default viewport:** optimize for **360–430 CSS px** width before tablet/desktop. Verify 320 px at 200% zoom and correct text wrapping.
- **One primary action per view.** A farmer should never have to choose between two equally dominant sticky buttons.
- **Touch affordance:** aim for **48 × 48 CSS px** hit areas as an internal target; also meet WCAG 2.2 target-size and dragging-alternative success criteria.
- **Text and illustration together:** Myanmar name prominent, crop picture/illustration farmer-tested, English/species name optional as secondary text. Avoid decorative glyph-only instructions.
- **Visible information hierarchy:** headline (“what does it mean?”) → reason and downside → advanced model inputs and source.
- **Outdoor usability:** contrast at least WCAG 2.2 AA for appropriate text/components; avoid subtle green-on-green and never encode risk only by red/green.
- **Interruption resilience:** autosave meaningful changes, preserve sheet selection, undo accidental edits, allow back navigation.
- **Accessibility:** large text support, screen-reader labels, keyboard path, focus restore after drawers, reduced motion, no automatic audio, caption/transcript for audio.

### 10.2 Proposed visual tokens (implementation defaults, not validated palette)

| Token | Proposed value | Usage |
|---|---|---|
| Primary | `#176B4A` | Primary CTA and positive navigation accents |
| Primary hover | `#105137` | Hover / active states |
| Canvas | `#F8FAF8` | Page background |
| Surface | `#FFFFFF` | Cards, dialogs |
| Main text | `#18231F` | Primary copy |
| Secondary text | `#52635A` | Explanatory labels |
| Divider | `#DCE5DF` | Borders |
| Warning | `#A56418` | Needs local check, not conclusive danger |
| Error | `#A83D33` | Invalid input / source failure |
| Corner radius | `12–16 px` | Cards, drawers, input containers |
| Spacing base | `8 px` | Consistent vertical rhythm |
| Touch target | `48 px` internal goal | Cards, chips with large affordance, navigation |

Verify these contrast pairings using real rendered screens and large Myanmar text; choose accessible semantic colors and darken text if necessary. Do **not** imply green means agronomically “safe.”

### 10.3 Typography and localization

- Use a Unicode Myanmar font stack available on target devices, with a tested project fallback; **do not assume a Latin font supports Myanmar shaping**. Confirm line height, stacked glyphs, chip dimensions and text overflow on actual Android browsers.
- Base body around 16–17 px; headings roughly 22–26 px on mobile; helper copy around 14 px minimum where feasible. Honor system scaling.
- App strings require a real `my` translation catalog and human agricultural review. MUI's component locale, when available in installed version, translates only MUI-supplied UI strings, **not the application**.
- Avoid untranslated technical words such as “NDVI”, “ET”, “minimax regret”, “centroid”, or “dekad” in the primary farmer language. Show familiar “Early / Middle / Late month”; technical terms live in explanation.
- Regional terminology such as *Ye-pyan* vs *Ye-lite-pe* must be confirmed with actual users before shipping authoritative Burmese labels.

### 10.4 MUI component selection

| Pattern | Recommended MUI usage | Important behavior |
|---|---|---|
| Global navigation | `BottomNavigation`, `BottomNavigationAction` | Three visible text labels, no icon-only destinations |
| Crop cards | `Grid`, `Card`, `CardActionArea`, `CardMedia`, `Typography` | Local names, focus state, image alt text |
| Location | `List`, `ListItemButton`, `TextField`; `Autocomplete` **as fallback** | No mandatory typing if known locations displayed |
| Refinement sheets | `Drawer`, `RadioGroup`, `FormControl`, `Button` | Explicit open, Back, Close, save, focus restore |
| Approximate month timing | `ToggleButtonGroup`, `Chip`; optional MUI X `DatePicker` | Store interval, not fictitious exact day |
| Comparison | `Card`, `Stack`, `Chip`, `Accordion`, `Alert` | Equal prominence for alternatives, visible unknown state |
| Provenance/methods | `Accordion`, `Table`, `Link`, `Alert` | Native scale and dates accessible |
| Async NASA source status | `Skeleton`, `LinearProgress`, `Alert`, `Snackbar` | Real state, no fake 100% progress |
| Boundary map | Mapbox mapping UI with MUI `Button`, `ToggleButton`, `Dialog` controls | Tap alternatives to drag, Undo, no tile dependency |
| Confirmation | `Dialog`, `FormHelperText`, `Button` | Reversible, avoids losing work |
| Optional help/audio | `IconButton`, `Drawer`, `Tooltip` only as secondary | Audio user-initiated, text remains available |

**Avoid:** permanent `SwipeableDrawer` as the sole way to access actions on low-end phones; drag-only crop reordering; full-width horizontal comparison tables on mobile; tiny target `Chip` controls; hover-only instructions; automatic permission prompts on Welcome.

### 10.5 Next.js / MUI setup checklist

- Use the MUI package version actually installed and the matching **Next.js App Router** integration (`AppRouterCacheProvider` where supported). Do not copy obsolete versioned import paths without checking installed documentation.
- Build `FarmerThemeProvider`, localized typography and semantic component overrides (`MuiButton`, `MuiCard`, `MuiChip`, `MuiDrawer`, `MuiBottomNavigationAction`).
- Build reusable domain UI components: `CropChoiceCard`, `RefinementBar`, `EvidenceLabel`, `StrategyCard`, `FarmerHelpButton`, `ApproximateDateChoice`, `SoilFeelChoice`, `CropTransitionChoice`, `SourceProgress`, `ComparisonDiff`, `LocalCheckList`.
- Distinguish **client display state** from **engine calculation state**; place normalization at a typed mapper boundary.
- Lazy-load Mapbox and large chart libraries; don't load satellite previews into the first-use bundle. Defer optional resources without lying about network activity.
- Test using Chrome Android with throttled CPU/network; respect `prefers-reduced-motion`, browser back, off-screen keyboard and safe-area insets.
- Validate actual MUI licensing/dependency before adopting MUI X pickers; basic farmer flow must not depend on an optional paid component.

### 10.6 Suggested route/layout architecture

```text
app/
  (public)/
    page.tsx                         My Farm / Start
    plan/page.tsx                    Plan workspace / Regional preview / Compare
    learn/page.tsx                   Crop guide / Data sources
    fields/[fieldId]/page.tsx        Selected field summary
    fields/[fieldId]/report/page.tsx Adviser report
    settings/page.tsx                Preferences & privacy
components/farmer/
  QuickAreaPicker.tsx
  CropChoiceCard.tsx
  RegionalPreview.tsx
  StrategyCard.tsx
  RefinementBar.tsx
  FieldContextDrawer.tsx
  CropSequenceDrawer.tsx
  CropTransitionDrawer.tsx
  SoilFeelDrawer.tsx
  GoalAndLimitsDrawer.tsx
  EvidenceStatus.tsx
  ProvenanceDetails.tsx
  FarmerHelpButton.tsx
  LocalCheckList.tsx
lib/
  ui-adapters/                       Maps v3.2 domain outputs to evidence-safe UI
  locale/                            Localized copy and farmer-reviewed terms
  state/                             Drafts, versioning, invalidation, backups
```

These are proposed organizational names; adapt to your actual App Router structure and do not delete existing code solely to follow the sketch.

---

## 11. Real-world scenario matrix and recovery requirements

| Scenario | Failure risk | Required experience |
|---|---|---|
| Village known, no GPS permission | Dead end at map | Text-based township/village choice, regional preview |
| Duplicate village names | Wrong weather region | Require township/region disambiguation |
| Map image black/slow | Cannot define farm | Continue with approximate location |
| User selects 465 ha surrounding area | Bogus field measures | Area warning and one-step redraw |
| Tiny parcel compared with Landsat pixel | False NDVI precision | Coverage warning, skip field greenness |
| No sowing day remembered | Fabricated exact date | Month/dekad/season and uncertainty retained |
| Fallow or intercropping | Invalid ordered timeline | Recognize fallow and supported overlap record |
| Rice→black gram relay sowing | Post-harvest model rejects it | Distinct method, method-specific warning, overlap safely rendered |
| Topsoil feels wet but texture unknown | Numerical moisture fabrication | Store observation only, water output stays unknown if needed |
| Repeated same pulse family | Overstated disease diagnosis | Explain potential rotation-break concern, suggest local check |
| No initial root-zone moisture | Unjustified physical water balance | Show not-evaluable, no optimistic deficit |
| Farmer enters own soil test | Map estimate silently overrides | Prioritize local test within rules; show both sources |
| IMERG/SMAP/SRTM authorization absent | False data-ready badge | Clearly label not connected / fallback or unknown |
| Monsoon cloud obscures Landsat | Fake observation | Show low-quality/no clear data and source dates |
| No local crop buyer | “Profitable” scenario unusable | Local buyer check; do not claim verified feasibility |
| Cannot hire equipment | Infeasible suggestion | Enforced exclusion only if requirements model supports it; else warning |
| Farmer prioritizes income but margin unknown | Fabricated winner | Unresolved, ask for price/cost or explain uncertainty |
| Candidate scores almost equal | Arbitrary “best” | Balanced presentation, show sensitivity |
| Farmer changes irrigation or crop | Stale comparison | Invalidate affected metrics and explain update |
| Browser refreshes mid-input | Work lost | Autosave local draft and resume |
| Offline after saved result | Silent stale data | Show cached timestamp and no new retrieval |
| Shared family phone | Privacy and mixed fields | Field identification, delete/export, privacy explanation |
| Farmer disagrees with soil map | Local expertise excluded | Record farmer observation; show disagreement |
| Farmer wants their existing plan | Coercive adoption | Visible “Keep my plan” and no forced replacement |
| Mobile accessibility needs | Gesture/typing barrier | No drag-only tasks, readable labels, audio optional |
| Only two valid regional templates | Made-up third option | Two cards plus explanation why third is unavailable |

---

## 12. Acceptance criteria and success measurement

**These are proposed product gates for evaluation, not measured success rates.** Qualitative tests with a small group can reveal errors; they cannot prove population-wide percentages.

### 12.1 Must-pass release gates (functional and scientific)

- [ ] First-run farmer reaches a clearly labeled **regional preview** after area + main crop; polygon, exact date and account not required.
- [ ] Preview has three credible example strategies **only when source catalog supports all three**; never invent alternatives.
- [ ] No preview calls an unconfirmed crop template **“your current rotation”**.
- [ ] Current + two alternatives display for valid field comparisons; otherwise a truthful partial or unresolved explanation appears.
- [ ] Every card contains reason, drawback, uncertainty/local check and provenance entry.
- [ ] Every implemented constraint labelled “enforced” has a passing automated rule test; unimplemented constraints are not marked feasible.
- [ ] Every number shown from NASA/ISRIC has retrieval/processing status and source metadata; no fake values for missing or low-quality inputs.
- [ ] Historical replay explicitly says **2016–2025** and **not next-season forecast**.
- [ ] Missing first-priority evidence produces `unresolved`; unknown moisture is not converted to zero or inferred from soil-feel.
- [ ] Crop cards have recognizable image **and** readable Myanmar label, keyboard and screen-reader semantics, and an Other option.
- [ ] Dekad selection stays approximate on storage, evaluation and report; time across calendar years is correct.
- [ ] Rice→pulse relay selection is distinct from sequential planting; its overlapping hydrology is gated until verified.
- [ ] All significant edits invalidate or recompute affected outputs, with a visible stale/update state.
- [ ] Map failure, API failure or poor connectivity does not erase entered crop and field details.
- [ ] Report distinguishes regional examples, farmer-entered facts, regional gridded estimates and assumptions.
- [ ] “Keep my plan”, “Adjust”, and “Discuss with adviser” remain available when the model is inconclusive.
- [ ] Voice is opt-in, no autoplay; text remains usable without audio; no mandatory drag gestures.

### 12.2 Proposed usability targets (validate with real farmers)

| Criterion | Initial target | How to test |
|---|---|---|
| Start without coordinates | ≥ 9/10 participants | Observe area selection without coaching |
| Correct crop identity and order | ≥ 8/10 | Compare entry with spoken crop-history account |
| Regional vs field comprehension | ≥ 8/10 | Ask whether the preview describes their actual plot |
| Trade-off understanding | ≥ 8/10 | Ask for one benefit, one drawback, one missing fact |
| Error recovery | ≥ 9/10 | Deliberately enter wrong crop/boundary and request fix |
| Constraint understanding | No false feasibility claim in scenario tests | Test rain-only, no buyer, no machinery cases |
| Missing-data comprehension | ≥ 8/10 | Test no SMAP and no root-zone initialization |
| Mobile target accessibility | WCAG 2.2 AA for relevant components; ~48px internal goal | Automated checks + real-device audits |
| Easy regional preview | Median under 3 minutes in moderated task, **aspirational** | Timed first-use study, not a guarantee |
| Agency | 100% of completed outcomes allow keeping or editing the plan | E2E acceptance test |

### 12.3 Suggested farmer testing protocol

1. Recruit an initial **5–8 diverse farmer/adviser participants** for formative usability; supplement with broader rounds later. The purpose is to find severe misunderstandings, not calculate statistically representative rates.
2. Use actual devices and connectivity typical of the intended setting, in Myanmar language, with comfortable consent and no unnecessary collection of identifiable farm data.
3. Run realistic tasks: choose village + rice, explain preview type, add black gram, mark relay vs post-harvest, select water constraint, understand a missing water metric, compare three strategies, reject/adjust, explain report.
4. Record task completion, requests for assistance, critical errors, spoken understanding, reading/audio preference, recovery effort, and trust concerns.
5. Revise the product after the first round and retest critical tasks. Separately validate agricultural model outputs with real field observations and expert review.

---

## 13. Implementation roadmap and team handoff

### P0 — Trust/correctness before farmer demo

**Frontend:** Preview labels and provenance; unresolved/partial/error state; crop history confirmation; invalid boundary warnings; stale-result invalidation; historical-not-forecast language.  
**Science/backend:** Confirm candidate evidence completeness and unresolved rules, source status semantics, actual NASA source coverage, and benchmark provenance.  
**Done when:** Every release gate related to false precision, missing data, crop identity and wrong advice passes.

### P1 — The new mobile-first journey

**Frontend:** My Farm, quick location, illustrated crop chooser, results as main surface, top three refinement chips, MUI bottom navigation, editable current sequence, farmer priorities and basic report.  
**Science/backend:** Region/crop-specific versioned example catalog, confirmed rotation mapping, criterion-level evidence contract and async source statuses.  
**Done when:** A new farmer reaches regional preview with two selections and can convert it to a qualified comparison without restarting.

### P2 — Local practice and deep science

**Frontend:** Dekad sheets, relay/non-relay choices, tactile soil check, water/weather/soil/satellite/economics drill-down, adviser report, contextual audio/help if tested.  
**Science/backend:** Verify approximate-date handling and crop-transition semantics; gate numerical overlap until supported; connect per-metric source metadata.  
**Done when:** No optional advanced feature turns a qualitative farmer observation into unjustified numerical certainty.

### P3 — Coverage, validation, demonstration

**Backend:** Complete Earthdata authentication and end-to-end test of IMERG, SMAP, SRTM and HLS only where planned; do not label proposed MODIS/ECOSTRESS active.  
**Research:** Run the **with/without NASA data** comparison protocol on confirmed inputs and record real outputs, then field measurement and farmer/adviser validation when possible.  
**Done when:** The prototype can show where NASA evidence contributed, including cases where it did not change the ordering, with reproducible source provenance.

### Concrete development handoff

| Ticket | Owner | Dependency | Acceptance |
|---|---|---|---|
| UX-01 Quick region+crop preview | Frontend | Versioned template catalog | No field registration gate |
| UX-02 Crop images & Myanmar copy | UX/localization | Local farmer review | Recognizable cards, accessible labels |
| UX-03 Inline refinement drawers | Frontend | Typed UI draft state | Edits stay in context |
| UX-04 Dekad/season date types | Frontend + engine | Explicit interval strategy | No hidden exact date |
| UX-05 Relay transition record | Frontend + engine | Crop event schema | Overlap represented, calculations gated |
| UX-06 Topsoil feel protocol | UX + science | Typed qualitative evidence | No numerical moisture imputation |
| UX-07 Comparison state contract | Engine + frontend | Candidate/evidence doctrine | Correct partial/unresolved behavior |
| UX-08 Source/provenance indicators | Backend + frontend | Adapter metadata | No false data-ready signal |
| UX-09 MUI theme and mobile QA | Frontend | Localization/font review | Responsive and accessible |
| UX-10 Report + local verification | Frontend + UX | Evidence labels | Farmer can keep/edit/discuss |
| UX-11 NASA contribution demonstration | Science/research | Reproducible baseline | Actual outputs, no assumed ranking change |
| UX-12 User study and revisions | UX/local adviser | Working prototype | Misunderstandings recorded and corrected |

---

## 14. Copywriting and localization rules

| Avoid | Farmer-facing alternative |
|---|---|
| “Locate geodetic centroid” | “Where do you farm?” |
| “Select region of interest polygon” | “Mark your field” |
| “Enter crop phenology” | “When did you plant it?” |
| “Choose dekad 3” | “Late October (21st to end of month)” |
| “Relay broadcasting offset = −10 days” | “Sowed the pulse before rice harvest” |
| “Root zone depletion unknown” | “We need more information to estimate this water risk” |
| “NDVI = 0.51” | “Satellite images showed vegetation greenness on this clear day” |
| “Maximize MCDA score” | “Which goal matters most to you?” |
| “Economic output 2,000,000 MMK” | “Estimated gross margin range, based on stated prices and costs” |
| “Optimal rotation” | “An option worth comparing” |
| “NASA predicts the coming season” | “Historical NASA data helps compare past weather risks” |
| “No soil moisture = 0” | “Soil moisture information is not available” |
| “Approved crop choice” | “Check locally before deciding” |

**All Burmese copy in the live app requires agricultural language review.** Keep crop names consistent across Crop, Plan, Learn and Report. Illustrations must communicate what a farmer recognizes, not what a designer assumes is universal. Optional audio may narrate the same short copy, but must not add claims absent from the written version.

---

## 15. Documentation and research references

### 15.1 User-provided project sources (scientific authority and product baseline)

1. `whitepaper(2).md` — *Field Shift: Comparing Crop Rotations with NASA Earth Observations*, Research Prototype v3.2. Scientific role, implemented vs gated, risk limitations, demonstration protocol, local data-handling and validation status.
2. `whitepaper-technical-appendix.md` — 1,296-line v3.2 technical reference, three-zone hydrology, crop transitions, phenology, residual nitrogen, MCDA, regret, historical replay, economics and dataset provenance.
3. `README(2).md` and original `01-welcome.png` through `17-mobile-compare.png` — existing screen screenshots and behavior baseline.
4. Previous UX v4, MUI master, Medhi addendum and v5 quick-preview/relay plan — **superseded** as separate UI specifications by this document; retained as design-history references.

### 15.2 HCI/UX design references (research rationale, not direct validation of Field Shift)

- GSMA & Bopinc, *AgriTech UX Design Guidebook* (2025): https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma_resources/agritech-ux-design-guidebook/
- Medhi, Sagar & Toyama, *Text-Free User Interfaces for Illiterate and Semi-Literate Users* (2006): https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/medhi_ictd2006.pdf
- Medhi et al., *Optimal Audio-Visual Representations for Illiterate Users of Computers* (2007): https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/Medhi_www2007.pdf
- Cuendet et al., *VideoKheti*, CHI (2013): https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/Cuendet-CHI2013-VideoKheti-Final.pdf
- Findlater et al., CHI (2009), literacy and audio/text: https://www.dgp.toronto.edu/~ravin/papers/chi2009_literacy.pdf
- Nielsen Norman Group, *10 Usability Heuristics*: https://www.nngroup.com/articles/ten-usability-heuristics/
- Nielsen Norman Group, *Progressive Disclosure*: https://www.nngroup.com/articles/progressive-disclosure/
- W3C, *WCAG 2.2*: https://www.w3.org/TR/WCAG22/
- W3C WAI, *Forms Tutorials*: https://www.w3.org/WAI/tutorials/forms/
- UX Collective, *Designing tech for a low-tech, low-income, non-English speaking user*: https://uxdesign.cc/designing-tech-for-a-low-tech-low-income-non-english-speaking-user-203e9fd0bc7c
- Lightweight Solutions, *Designing for Digital Literacy*: https://lightweightsolutions.co/building-ui-ux-for-non-tech-savvy-users-designing-for-digital-literacy/
- Eleken, *Mobile UX Design*: https://www.eleken.co/blog-posts/mobile-ux-design

### 15.3 Agriculture and scientific usage references

- NASA Space Apps 2026 challenge (user-supplied brief): https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/
- Myanmar Pulses Sector Development Strategy (2017), regional sector context: https://www.mpbmsma.org/wp-content/uploads/2019/09/Myanmar-Pulses-Sector-Dev-Strategy-ACIAR-2017.pdf
- *A traditional farmers' practice of black gram cultivation in Maubin township* (2017), described in prior review: https://www.academia.edu/99942962/A_traditional_farmers_practice_of_black_gram_Mat_pe_Vigna_mungo_cultivation_in_Maubin_township_Ayeyarwady_region_Myanmar
- USDA NRCS, *Estimating Soil Moisture by Feel and Appearance*: https://www.nrcs.usda.gov/sites/default/files/2022-09/Estimating%20Soil%20Moisture%20by%20Feel%20and%20Appearance.pdf
- NASA POWER: https://power.larc.nasa.gov/
- NASA Earthdata: https://www.earthdata.nasa.gov/
- ISRIC SoilGrids: https://soilgrids.org/
- Microsoft Planetary Computer: https://planetarycomputer.microsoft.com/

### 15.4 MUI implementation references

- MUI overview: https://mui.com/material-ui/getting-started/
- MUI Next.js integration: https://mui.com/material-ui/integrations/nextjs/
- MUI Drawer: https://mui.com/material-ui/react-drawer/
- MUI Card: https://mui.com/material-ui/react-card/
- MUI Bottom Navigation: https://mui.com/material-ui/react-bottom-navigation/
- MUI accessibility guidance: https://mui.com/material-ui/guides/accessibility/

**Source limitations:** The research studies do not establish a universal “two taps” threshold. Reported relay timing is region and method dependent and is **not** a universal sowing prescription. Qualitative hand-feel cards do **not** produce calibrated moisture readings. Implemented and tested software is **not** independently validated agronomic science. These limitations are reflected in every interface contract above.

---

## Final release definition

Field Shift succeeds as a **farmer-centered research prototype** when someone with limited geospatial or technical experience can: (1) start by choosing an area and main crop; (2) see clearly labeled regional rotation ideas; (3) add their own crop, water and priority information without a long form; (4) compare an actual current rotation and scientifically supported alternatives while understanding benefits, drawbacks and unknowns; and (5) keep, adjust or discuss the plan using local agricultural knowledge. NASA Earth observations must meaningfully inform the explanation **where present**, but their absence and scientific limitations must remain visible.
