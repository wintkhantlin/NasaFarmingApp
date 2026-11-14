# Main app UI and UX flow

Status: product and interface plan, 14 November 2026. This document plans the rotation planner described in [PRODUCT.md](PRODUCT.md) and [UX.md](UX.md). [DESIGN.md](DESIGN.md) owns the visual tokens. [plan.md](plan.md) covers implementation sequencing.

## Product decision

The main journey is **choose a field → record its current crop rotation → understand local conditions → compare the current rotation with at least two alternatives → take a one-page report to an adviser**. The earlier Today, Map, Plan, and Fields daily-advice tabs in `UX.md` have been superseded by this journey. The app helps a farmer weigh options; it does not decide what they should plant.

The first version has no account. Fields stay in this browser. A farmer can enter a field by coordinates if the map or device location is unavailable. NASA data is evidence beside the farmer's own knowledge, and the interface must say when a source is coarse, stale, missing, or still loading.

## Reference basis

Mobbin search returned an internal error twice while preparing this document. The links below are the references already recorded in the project's [Mobbin study](UX.md#findings). They support the named interface patterns, not the crop recommendations or agronomic rules. The proposed flow and copy in this document are product decisions for this app.

| Pattern to adapt | Observed reference from the existing study | Decision here |
| --- | --- | --- |
| A short answer before detailed readings | [The Weather Channel home](https://mobbin.com/screens/62c6b9f3-2b37-4478-b150-d35f9404d97b), [Apple Weather](https://mobbin.com/screens/19c0e840-fd25-46f0-beca-25889871bc2d) | Open Conditions and each option with a plain sentence, followed by the evidence. |
| A map layer control with explanation | [The Weather Channel layers](https://mobbin.com/screens/98764793-2bb7-493d-8e4c-4ff91b9adae4), [Strava legend](https://mobbin.com/screens/2229d028-1ff5-4611-bf77-0762a60b6d3d) | Keep map data layers in one sheet. Explain what each layer measures, its units, date, and resolution. |
| A range around a reading | [Eight Sleep range chart](https://mobbin.com/screens/d1379400-dfe1-489b-8522-b513131756b3) | Put the crop's relevant range on water and soil charts and state the verdict in words. |
| Risks at the point of decision | [Redfin climate risk](https://mobbin.com/screens/5a1cbf33-2ba5-46d6-af23-c87d154483da), [AllTrails heat](https://mobbin.com/screens/91d6c2f1-e74a-46b8-90ad-561129f79774) | Place a specific consequence and a local check beside each comparison option. |
| A dated sequence | [Greg care schedule](https://mobbin.com/screens/c802b78e-a223-4ea6-b64a-b67b397e04ba) | Use numbered crop slots and explicit planting and harvest dates on phones. |
| Map plus detail panel on desktop | [Felt map](https://mobbin.com/screens/58a17ddb-ae85-48cf-96d8-aa8c632517d7) | Keep the selected field's controls and explanation visible beside the map on wider screens. |

## Navigation and route map

The field is the main object. The top-level navigation is **Your fields** and **About the data**. Within a field, a four-step navigator shows **Location**, **Your rotation**, **Conditions**, and **Compare**, with a status word for each step. The user can return to completed steps without losing work. Option details and the Report are reached from Compare.

```text
Your fields /
├─ Add a field /fields/new
└─ Field /fields/:fieldId
   ├─ Location /fields/:fieldId/location
   ├─ Your rotation /fields/:fieldId/rotation
   ├─ Conditions /fields/:fieldId/conditions
   ├─ Compare /fields/:fieldId/compare
   ├─ Option detail /fields/:fieldId/compare/:optionId    proposed route
   └─ Report /fields/:fieldId/report
About the data /about/data
```

The stepper labels must describe real states: **Done**, **Needs your input**, **Loading data**, or **Not started**. A step can be visited while data is loading. Comparing alternatives requires a saved rotation and enough condition data to explain the result; unavailable evidence must be named on the screen. An unavailable page should never appear as a link.

## Primary journey

| Moment | User action | Visible response | Exit condition |
| --- | --- | --- | --- |
| 1. Start | Open Your fields | See saved fields and each field's next useful step. Empty state says "Drop a pin on your first field". | Choose or add a field. |
| 2. Locate | Search, type coordinates, use device location, or draw a pin, box, or outline | Map shows the selection. A resolution control explains what data covers the area around it. Save sheet asks for field name, irrigation access, and optional soil test. | Field is saved locally and its overview opens. |
| 3. Describe rotation | Add crops in order with planting and harvest dates | Phone shows numbered crop cards; wider screens may show a month ribbon. Date certainty is marked **Exact**, **About**, or **Usual time**. Gaps remain visible. | Current rotation is saved, including any flagged gaps. |
| 4. Read conditions | Open Conditions | First sentence states the most relevant finding. Weather, water, soil, and seasonal history follow with ranges, units, source dates, and missing-data notices. | Farmer can explain the main limits of this field and continue. |
| 5. Compare | Open Compare | Current rotation and at least two alternatives are available. Each has a factual label, a short suggestion, trade-offs, and unknowns. | Farmer opens an option or the report. |
| 6. Discuss | Open an option, then print the report | Option shows fit, soil health, water and weather resilience, evidence, risks, and questions to check locally. Report condenses these onto one printable page. | Farmer has a specific option and questions to discuss with an adviser. |

Returning to Location or Your rotation preserves other entered information and recomputes dependent results. If the field location changes, show that conditions and comparisons need refreshing. Never silently present results for the old location.

## Screen contracts

### 1. Your fields

**Purpose:** resume work at the right field. Each card shows field name, location, area or "Pin only", irrigation access, the next step, and a status word. The main action is **Add a field**. A card opens the field overview; its next-step action can open the relevant step directly.

**Empty:** one sentence describing the value of adding a field, then **Add a field**. **Loading:** stable card skeletons. **Storage error:** say that saved fields could not be read and offer **Try again**. State plainly that fields are stored in this browser only.

### 2. Field overview

**Purpose:** orient the farmer and give one next action. Show the field name, stepper, a short summary of what is known, and the next unfinished step. Once conditions exist, lead with their plain-language summary; keep the map image secondary. Field details and **Edit field** remain available. Removing a field requires a clear confirmation because it removes its saved rotation too.

### 3. Location

**Purpose:** define the land to analyse. Full-screen map on a phone, with search and a visible route for typed latitude and longitude. Provide **Pin**, **Box**, and **Field outline** tools. Offer **Use my location** only as a convenience; manual entry works if permission is denied. Before save, preview the selected geometry and ask for a name, irrigation access, and optional soil test.

The layer sheet offers a base map and a single data overlay at a time. A separate resolution display identifies the 250 m, 9 km, and 0.1° cells where applicable. Say **around your field** for a coarse cell rather than suggesting a plot-level measurement. Every legend has words, units, source, and date. Save remains available when satellite overlays are unavailable.

### 4. Your rotation

**Purpose:** capture the farmer's real sequence before offering alternatives. On a phone, each numbered crop card has crop, planting date, harvest date, and date certainty. **Add next crop** follows the list. Date suggestions can prefill fields, but the farmer confirms or edits them. Show a gap as **Bare soil or unknown** and allow the farmer to clarify it. On wider screens, a month ribbon may complement the cards; it must not be the only editor.

Save incomplete work as a draft. Block only impossible or ambiguous inputs needed for comparison, such as harvest before planting with no intended year. Other gaps become visible uncertainty. If satellite greenness is not connected, omit its validation claim and say the history cannot be checked from satellite data yet.

### 5. Conditions

**Purpose:** explain what the field's seasons, water, heat, and soil may mean for the saved rotation. Start with one evidence-based sentence. Then show: rain and dry spells; heat and frost; water balance; soil properties; season so far; farmer-entered soil or irrigation facts. Each reading carries a unit, a relevant comparison range where one is justified, the source and date, and a plain verdict.

NASA POWER rainfall must be called **NASA POWER rainfall**, not satellite rainfall. ISRIC SoilGrids is labelled as a non-NASA source. Farmer-entered soil tests are visibly labelled **Your soil test** and take precedence over modelled soil values. Where a source is too coarse for the field, explain the scale in words. A source failure leaves cached results readable with their date, if available.

### 6. Compare

**Purpose:** make trade-offs between the current rotation and at least two alternatives understandable. On a phone, use one option at a time with a persistent **Compare with now** action. On wider screens, align the three options in a table grouped by **Fit**, **Soil health**, **Water and weather**, and **Unknowns**. Keep row labels and units aligned. Do not award a single winner badge. Factual labels such as **Most reliable in dry years** may appear only when supported by the calculation shown below them.

Each option opens with a suggestion, one reason, and the main drawback. The comparison must state which data was used and which part came from a model or assumption. Keep this note visible on Compare, option detail, and Report: **Suggestions to discuss, not instructions. You know your land. Check these with your extension officer or adviser.** A strategy whose rules are still placeholders must not appear as a validated recommendation.

### 7. Option detail

**Purpose:** let a farmer or adviser inspect one alternative. Show its rotation sequence, crop and season fit, soil-health effect, resilience across past years, trade-offs against the current rotation, an evidence list, and **Unknowns and things to check**. A risk reads as **what could go wrong · when or how often · what to check locally**. Include the dataset, resolution, and date next to each supporting figure. If a strategy is unsuitable, explain the reason rather than leaving an empty result.

### 8. Report

**Purpose:** take a one-page summary to a discussion. Include the field name and location, current rotation, the two alternatives, the few differences that matter, evidence dates, missing information, and questions for an adviser. **Print or save as PDF** invokes the browser print flow. The printed page includes the judgment note and source limitations. It must work without colour meaning alone.

### 9. About the data

**Purpose:** explain each source, what it measures, where it covers, resolution, status, and limitations in plain words. Link here from source lines and from the app header. Data source status is a product state, so **Not connected** and **Working** must remain visible rather than being replaced with a generic error.

## State and decision rules

| Situation | Interface response |
| --- | --- |
| No field or no saved rotation | Give the next input action. Do not display a comparison assembled from invented data. |
| Device location denied or map fails | Keep search and typed coordinates usable. Explain the problem near the map control. |
| Field is smaller than a satellite cell | Say the reading is **around your field** and show the cell size. |
| Soil map has no value | Say **No soil map data here** and offer a place to enter a soil test. |
| Satellite history is unavailable | Name the missing source and show what can still be learned from NASA POWER or the farmer's inputs. Do not imply a satellite reading exists. |
| Source is loading | Keep saved inputs and already available evidence visible. Show a dated loading status for only the affected section. |
| Offline or source down | Show the last cached result and **Data from [date]**. If no cached result exists, show an honest unavailable state. |
| Field or rotation changes | Mark dependent evidence as updating; replace old comparisons only when new inputs and provenance match. |
| No feasible alternative | Explain which constraint failed and what local fact might change that assessment. Do not fabricate a second feasible option. |

All warnings carry a hazard or issue, a time or frequency when known, the affected field, and a practical check or action. Every data colour has an icon or word. Empty, loading, stale, error, and offline states use the same calm copy and light surfaces as the normal screens.

## Responsive and visual rules

- **Phone:** one column, 16 px side gutters, 44 px minimum tap targets, a full-screen location map, numbered rotation cards, and one comparison option at a time. The primary action stays easy to reach without covering evidence or map attribution.
- **Tablet and desktop:** the map can sit beside its field panel; the rotation ribbon can appear beside the editable list; Compare becomes an aligned table. The reading order remains answer, reason, evidence, source.
- **Light mode only:** use the parchment surfaces and Field Green accent defined in `DESIGN.md` and `app/globals.css`. Data colours mean data only and always carry words or an icon. No dark palette or theme switch.
- **Copy and accessibility:** plain names before dataset codes, units beside every value, visible focus, keyboard access to every control, and text that survives translation. New interface strings belong in `lib/copy/en.ts` when implemented.

## Build checkpoints

1. **Complete the input path:** rotation editor and persistent draft data. The field overview and stepper reflect the saved state.
2. **Complete the evidence path:** Conditions uses available NASA POWER and SoilGrids data, with provenance, bands, coarse-grid wording, and cached or unavailable states.
3. **Complete the decision path:** compare the current rotation with at least two genuinely defined alternatives; provide option detail, unknowns, and a printable report. Keep placeholder strategies out of farmer-facing recommendations.
4. **Validate the flow:** on a phone, ask a farmer to add a field, enter a rotation, identify the main difference between options, and name one fact they would check locally. Review the desktop report with an adviser. Confirm wording, season assumptions, and the meaning of uncertainty with growers and advisers before treating the flow as validated.

Current code has Home, Location, Field overview, and About the data. The rotation, conditions, comparison, option, and report screens in this document are planned work. The exact three strategy rules, crop calendar coverage, and locally valid suitability thresholds remain open product inputs; the UI must show those gaps rather than hide them.
