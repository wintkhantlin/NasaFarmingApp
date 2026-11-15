---
name: NASA Farming App UX
description: User research, interaction patterns and screen structure for a farming app that turns NASA Earth-observation data into decisions.
---

# UX: NASA Farming App

> How the app should behave: who it is for, what each screen does, and the patterns behind them. Visual tokens and styling rules live in `DESIGN.md`; follow both.

> Done on 14 Nov 2026, before any screens existed. Mobbin has almost no agriculture apps, so every pattern below is borrowed from a neighbouring domain (weather, maps, risk, plant care). Take the structure and behaviour, not the visual style. Full illustrated version: https://claude.ai/artifact/1dAjZXp4huJDEP1fiKWvd3

## The Problem

NASA publishes free, global data on soil moisture, rainfall, crop vigour and land temperature, but it arrives as gridded rasters with names like `SMAP L3` and `GPM IMERG`. The gap is translation, not access. Every screen should answer "what should I do on my land, and when?" before it shows the evidence.

## Who It Is For

These are working assumptions from the brief, not research findings. Validate them with five to eight interviews before committing to the information architecture.

**The grower in the field.** "Do I irrigate before the weekend, or will it rain?"
- Device: mid-range Android phone, often used one-handed.
- Setting: outdoors, bright sun, patchy 3G.
- Needs: one clear call per field, early warning of frost and heat, little reading.
- Fears: wasting water or diesel, losing a crop to a missed warning.

**The farm manager or adviser.** "Which of my 14 blocks is falling behind, and why?"
- Device: laptop in the office, phone in the truck.
- Setting: planning sessions, reports for owners or co-ops.
- Needs: comparison across fields, history, evidence they can cite.
- Fears: recommending from data they cannot explain.

## Method

Seven Mobbin searches covered weather home screens, map layer controls, severe-weather alerts, onboarding with location permission, metric detail charts, care schedules, and desktop map-plus-panel layouts. That gave 45 screens and 4 flows.

## Findings

**1. Lead with a sentence, then show the numbers.**
The Weather Channel opens with "It's 86° and fair" in display type, then an outlook sentence ("The nicest day in the next 7 days will be Sunday"). Apple Weather puts a one-line summary above the hourly strip.
- *For us:* Today opens with one recommendation per field in display type ("Irrigate Field 2 on Thursday"), then a "why" line, then the supporting data. Weekly outlooks follow the same shape ("Best spraying window this week is Tuesday morning").
- *Avoid:* full-bleed sky photos behind the headline. They lose contrast in direct sun.
- Refs: [TWC home](https://mobbin.com/screens/62c6b9f3-2b37-4478-b150-d35f9404d97b), [TWC rain outlook](https://mobbin.com/screens/283c7bab-a2a8-49e8-b574-6d4fe74b2a6f), [Apple Weather](https://mobbin.com/screens/19c0e840-fd25-46f0-beca-25889871bc2d)

**2. Layers belong in a sheet, with descriptions and a legend.**
Mature map apps put their layers behind one button and open them in a bottom sheet. The Weather Channel adds a line under each overlay saying what it is for. My BMW uses thumbnails for base maps and toggles for overlays. Strava gives each layer a legend sheet that explains the scale in words.
- *For us:* base map as thumbnails (Fields, Satellite, Terrain). Data layers are single-select because stacked rasters are unreadable: Soil moisture, Crop health, Rainfall, Land temperature. Each layer gets a one-line "what it tells you" and a legend sheet with units and the source date.
- *Avoid:* colour-only markers (Citizen, Felt dot maps). Field status needs an icon or label too.
- Refs: [TWC layers](https://mobbin.com/screens/98764793-2bb7-493d-8e4c-4ff91b9adae4), [My BMW map types](https://mobbin.com/screens/cfd0448c-0051-4344-ad1f-55c217a19a12), [Strava legend](https://mobbin.com/screens/2229d028-1ff5-4611-bf77-0762a60b6d3d), [Realtor.com environment layers](https://mobbin.com/screens/056f687e-8be8-404e-837b-39c20c9f4da3)

**3. State the consequence and the likelihood.**
Redfin's climate-risk rows pair a hazard and a severity word with a plain consequence ("67% chance of flooding in next 30 years"). AllTrails puts an "Excessive heat expected" chip inside the trail page, where the decision is made. The Weather Channel's severe alert is the counter-example: an all-caps agency bulletin with the action buried in boilerplate.
- *For us:* alerts follow **hazard · when · what to do**, for example "Frost likely Saturday 2–6 am. Cover seedlings in Field 3." Show alerts as chips on the field they affect, with the source bulletin one tap away.
- *Avoid:* forwarding agency text unchanged, and alert lists with no action.
- Refs: [Redfin climate risk](https://mobbin.com/screens/5a1cbf33-2ba5-46d6-af23-c87d154483da), [AllTrails heat](https://mobbin.com/screens/91d6c2f1-e74a-46b8-90ad-561129f79774), [TWC alert](https://mobbin.com/screens/087493d2-1732-4ffe-a35c-af6c3464c230), [(Not Boring) Weather alerts](https://mobbin.com/screens/5c5e4b4f-7a37-4650-9e55-01d6761d6b45)

**4. A chart becomes a decision when it shows the target band.**
Eight Sleep shades an "optimal range" behind its bars and labels each average "In range" or "Out of range". Apple Weather's Actual / Feels Like toggle comes with a sentence explaining the difference. Tide Guide pairs a day picker with one focused line.
- *For us:* the soil moisture chart shades the crop's comfortable band (for example 20–30% volumetric for maize at tasselling), shows a verdict ("Below range since Tuesday"), and ends with a footer giving the dataset, resolution and pass date.
- *Avoid:* raw index values (an NDVI of 0.62) with no band or comparison.
- Refs: [Eight Sleep](https://mobbin.com/screens/d1379400-dfe1-489b-8522-b513131756b3), [Apple Weather conditions](https://mobbin.com/screens/077d4f75-232d-46ac-8a77-5f8bf0e91205), [Tide Guide](https://mobbin.com/screens/a382643d-0daf-4896-93c7-898c65a10a9f)

**5. Recurring care works as a dated task list.**
Greg, a plant-care app, splits Today and Upcoming and puts the amount on each row ("½ cup"). Lumy's detail sheet ends with a single "Notify" button set relative to the event ("Before 30 minutes").
- *For us:* a Plan tab with rows like "Field 2 · Irrigate 25 mm · Thu". Each row has an amount, a reason, and a "Mark done" action that feeds back into the model. Reminders are relative to the window ("Remind me the evening before").
- *Avoid:* streaks and badges from habit apps. Farm tasks follow the weather, not a daily goal.
- Refs: [Greg schedule](https://mobbin.com/screens/c802b78e-a223-4ea6-b64a-b67b397e04ba), [Lumy notify](https://mobbin.com/screens/491f5781-df9b-46ea-86ec-fb258a83d369)

**6. Ask for permissions with something in return, and give managers a map with a panel.**
The Weather Channel asks for notifications one category at a time, shows what each does, and offers a clear "Keep these notifications off". Its location step is a wall of legal text, though. On desktop, Felt pairs a full map with a left legend panel and a popover for the selected item.
- *For us:* onboarding starts by drawing a box or tracing the field, then adding farm details and crops. A farmer can search or use two corner coordinates without granting GPS permission. On desktop, keep map controls in a compact panel beside the map.
- *Avoid:* a legal wall before any value is shown, or an account wall before the first recommendation.
- Refs: [TWC onboarding flow](https://mobbin.com/flows/ae802f49-393f-4a35-957d-cb0cc6b054c3), [Felt map](https://mobbin.com/screens/58a17ddb-ae85-48cf-96d8-aa8c632517d7)

## Translation Layer

The UI uses the plain name and keeps the dataset in the source line. This is the working vocabulary for copy and layer names.

Notices use the `Message` component and its five tones (info, success, caution, problem, needs); sources use the `Evidence` line. Tones, anatomy and writing rules are in DESIGN_SYSTEM.md 10.11 and 9.6.

| Farmer's question | UI name | NASA source | Shown as |
| --- | --- | --- | --- |
| Do I need to irrigate? | Soil moisture | `SMAP L3/L4 · 9 km · daily` | Chart with crop band, map layer |
| Is it going to rain enough? | Rainfall | `NASA POWER (MERRA-2, bias-corrected) · 0.5° · daily`; GPM IMERG (0.1°) once Earthdata access is set up | Seasonal totals, years compared with normal |
| Is my crop healthy? | Crop health | `MODIS / VIIRS NDVI · 250–500 m · 8–16 day` | Field compared with its own past seasons |
| Will heat or frost hurt it? | Heat and frost | `MODIS LST · 1 km · daily` | Alert chips with a time window |
| Is this season unusual? | Season so far | `NASA POWER · agroclimatology` | Growing degree days vs 20-year average |

A 9 km soil-moisture cell is larger than most smallholder fields. Say "around your field" and show uncertainty instead of implying a per-plot reading.

## Product Flow: Rotation Planner

The brief defines the product as a **rotation planner**: choose a field, record the current rotation, then compare it with at least two alternatives. This replaces the daily-advice tabs (Today, Map, Plan, Fields) that an earlier version of this study proposed. The findings above still apply; they now shape the screens below.

```
Home (your fields)
 └─ Field ──┬─ 1 Location        box or polygon on a map
            ├─ 2 Your rotation   ribbon (tablet, desktop) or numbered list (phone)
            ├─ 3 Conditions      climate, water, soil, satellite history
            ├─ 4 Compare         current rotation vs at least two alternatives
            │    └─ Option       fit, soil health, resilience, why, what we don't know
            └─ Report            one-page summary to take to an adviser
About the data                   datasets, resolution, methods, limits
```

A stepper shows steps 1 to 4 with their state (done, needs input, data loading). People can jump between steps; results recompute and keep earlier inputs.

### How each finding is used

| Finding | Where it lands |
| --- | --- |
| 1. Lead with a sentence | Each option opens with a `Recommendation`: "Try maize then groundnut, with cowpea as cover", then the reason, then the evidence. |
| 2. Layers in a sheet with a legend | The map step: base map thumbnails, resolution boxes toggled in a sheet, each with a one-line "what this satellite sees". |
| 3. Consequence and likelihood | Risks read "what could go wrong, how often, what to check", e.g. "Marginal: not enough rain in 6 of 10 years without irrigation". |
| 4. Chart with a target band | Water-need and soil readings show the crop's comfortable band, with an in-range verdict in words. |
| 5. Dated task list | The rotation input: numbered slots with date range and "exact / about / usual time" confidence. |
| 6. Permissions with something in return | Location is about the field, so search and corner coordinates work with no GPS permission. |

### Screens

- **Home:** list of fields with step status. Empty state: "Draw your first field".
- **Location:** map with search, "use my location" and two-corner coordinate entry. Draw a box or trace the field outline; a point alone is not a new field. The save sheet asks only for a field name. After a new field is saved, Farm details collects water access, soil tests and priorities.
- **Your rotation:** on tablet and desktop, a ribbon with one row per year of the cycle and a month axis starting at the local season start. Crop blocks are dragged and resized; gaps show as bare soil. On phone, a numbered list: "1. Maize, 15 Jun to 10 Oct" with "Add next crop". Picking a crop pre-fills typical dates. A satellite greenness line under the ribbon flags dates that don't match what the satellite saw.
- **Conditions:** a plain-language summary of the rainy seasons, frost and heat, dry spells; monthly rain against crop water use; soil readings with bands; a "what grows well here" grid; a place for the farmer's own information.
- **Compare:** a table on desktop (your rotation, then each alternative, row groups for fit, soil health, water and weather, unknowns); on phone, one tab per option with "Compare with now". No single winner badge: labels are factual ("Most reliable in dry years", "Biggest soil benefit").
- **Option:** the recommendation, a year-by-year strip showing how the rotation would have done in each past year, soil-health benefits and trade-offs against the current rotation, the evidence list, and "Unknowns and things to check".
- **Report:** a printable one-page summary of the rotations, key evidence and questions to ask locally.

### Simplified farmer path (14 Nov 2026)

The path is **Place → Farm → Crops → Answer**. Farm details are optional after choosing a location.

- **Place:** the save sheet asks only a name (pre-filled "Field N"), then opens Farm for water and soil details.
- **Crops:** tap the crops you grow. Usual dates are filled in; "Change dates" holds the editor. "See my answer" goes straight to Compare.
- **Answer:** priorities, prices and soil water that the farmer has not given are filled with typical values and marked **Assumed** (for example "Balanced priorities (assumed) · Change"). Nothing blocks the answer.
- **Farm details:** water, soil, priorities, and other observations are edited on the Farm tab. Answers used by comparison come from those field details.
- **Navigation:** bottom bar is Fields and Learn. Field tabs are Overview, Farm, Crops, Conditions, Compare. Trends sits inside Conditions and Share is a button on Report.
- **Text:** the judgment line moves to the bottom of Compare. Ranking detail, what-if and gaps sit behind `Disclosure` rows, which open when printed.

### Persistent framing

Every comparison screen carries: "Suggestions to discuss, not instructions. You know your land. Check these with your extension officer or adviser."

### States

Design for: location denied, no search result, a field smaller than a data cell, no soil map data at the point, satellite data still loading ("Satellite detail on its way, about 3 minutes"), a data source down, offline with cached results ("Data from 12 Nov"), no feasible alternative for a strategy ("Not a fit here because...").

## Information Architecture

- **Fields (Home):** every saved field and where it is in the flow.
- **Field steps:** Location, Your rotation, Conditions, Compare. Report and Option pages hang off Compare.
- **About the data:** datasets, resolution, methods and what is missing.

Settings, export and import of field data, and offline storage sit behind the profile icon. There are no accounts in the first version.

## Principles From The Study

1. **Answer, then evidence.** Every screen opens with a sentence a farmer could say aloud, and the chart that supports it comes after.
2. **Every number has a band.** Show the range a reading should sit in, not just the reading.
3. **Every warning has an action.** Hazard, time window, field, and what to do.
4. **One layer at a time.** Maps show one data layer, explained in words, with its date.
5. **Cite quietly, always.** Dataset, resolution and pass date in a small mono line, one tap from the full detail.
6. **Built for the field.** Solid surfaces instead of photos, AA contrast in light mode, 44px targets, and cached data with a clear "last updated".

## Next Steps

- Interview five to eight growers and two advisers to confirm the personas, crops and translation-table questions.
- Test the DESIGN.md tokens outdoors on a phone at full brightness.
- Prototype the rotation ribbon, the comparison table and an option page, then run a five-person test: "Which rotation would you try? What would you check first?"
- Decide how to show uncertainty for coarse grids before anyone treats a reading as per-plot.
- Design offline, loading and stale-data states early.
