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
- *For us:* onboarding in three steps: drop a pin or draw the field, pick the crop and planting date, then choose alert types with an example of each. Location is about the field, not the phone, so a manual pin works without GPS permission. On desktop, put the fields list and legend on the left, the map in the centre, and the selected field's recommendation in a right panel.
- *Avoid:* a legal wall before any value is shown, or an account wall before the first recommendation.
- Refs: [TWC onboarding flow](https://mobbin.com/flows/ae802f49-393f-4a35-957d-cb0cc6b054c3), [Felt map](https://mobbin.com/screens/58a17ddb-ae85-48cf-96d8-aa8c632517d7)

## Translation Layer

The UI uses the plain name and keeps the dataset in the source line. This is the working vocabulary for copy and layer names.

| Farmer's question | UI name | NASA source | Shown as |
| --- | --- | --- | --- |
| Do I need to irrigate? | Soil moisture | `SMAP L3/L4 · 9 km · daily` | Chart with crop band, map layer |
| Is it going to rain enough? | Rainfall | `GPM IMERG · 0.1° · half-hourly` | 7-day bars, running total vs normal |
| Is my crop healthy? | Crop health | `MODIS / VIIRS NDVI · 250–500 m · 8–16 day` | Field compared with its own past seasons |
| Will heat or frost hurt it? | Heat and frost | `MODIS LST · 1 km · daily` | Alert chips with a time window |
| Is this season unusual? | Season so far | `NASA POWER · agroclimatology` | Growing degree days vs 20-year average |

A 9 km soil-moisture cell is larger than most smallholder fields. Say "around your field" and show uncertainty instead of implying a per-plot reading.

## Today Screen Concept

From top to bottom:
1. **One answer in display type.** If several fields need action, the most urgent one leads and the rest go in the list below.
2. **A "why" line** in plain words that names the evidence ("Soil moisture has been below the maize range for 3 days, and less than 4 mm of rain is expected before Sunday").
3. **Risk chip** with icon, time window and field ("Frost likely Sat 2–6 am · Field 3"). Never shown by colour alone.
4. **One primary action** that turns the advice into a task ("Add to plan").
5. **7-day rain strip**, kept small because it supports the headline.
6. **Other fields** as a short list with status and timing.
7. **Source and pass date** in mono type (`SMAP · GPM IMERG · 12 Nov pass`).

## Information Architecture

- **Today:** what to do now, across all fields. Lead recommendation, active alerts, rain this week.
- **Map:** where it's happening. Base map thumbnails, one data layer at a time, legend sheet with source.
- **Plan:** when to do it. Today / This week / Later, amounts and reasons, mark done, set reminder.
- **Fields:** how each field is doing. Per-field charts, season compared with past years, crop and planting date.

Settings, offline data and account sit behind the profile icon. Alerts do not get a tab because they appear on Today and as notifications.

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
- Prototype Today, the layer sheet and the alert chip, then run a five-person test: "Should you irrigate this week? How sure are you?"
- Decide how to show uncertainty for coarse grids before anyone treats a reading as per-plot.
- Design offline, loading and stale-data states early.
