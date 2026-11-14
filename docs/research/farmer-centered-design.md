# Farmer-centred design: improvement areas

Study done 14 Nov 2026 against the brief's three farmer-centred design prompts, the working tree on `main` (uncommitted Myanmar work included) and the screens running at `localhost:3000`. Mobbin still has no farming apps, so the patterns are borrowed from health, finance, food and recommendation apps. Take the behaviour, not the look. `UX.md` and `DESIGN.md` still rule.

## What already works (keep)

- **Answer first, then evidence.** `Recommendation` opens each option with a headline and a reason. Evidence rows carry a `SourceLine`.
- **Risks come with an action.** "What could go wrong" pairs each risk with "What to check".
- **Unknowns are part of the result.** They are a panel on the option, not a footnote.
- **Badges state facts, not a winner.** "Most reliable in dry years" and "Highest soil health benefit" follow `UX.md`.
- **Location doesn't need GPS.** You can search, drop a pin, draw a box or trace an outline, or type coordinates. A pin explains that it has no area.
- **The farmer's soil test wins.** `field-overview.tsx:74` labels it "from your soil test".
- **There's a privacy line.** "Your fields are saved in this browser only."

## 1. Easy to read for farmers new to maps and data

| # | Finding | Where | Fix |
|---|---|---|---|
| 1.1 | The nitrogen balance always shows a green "healthy" chip, even when it's negative. That means `-80 kg/ha` looks like good news. It also breaks DESIGN.md's rule that data colours mean data. | `rotation-compare.tsx:283` | Make the verdict words: "Takes more nitrogen than it puts back (about 80 kg/ha)". Use the healthy colour only when the balance is positive. |
| 1.2 | "low / medium / high" never says what it is measured against. "Drought resilience: medium" can't be checked or acted on. | `rotation-compare.tsx:160–170`, `strategies.ts` | Use the Redfin pattern: the consequence plus how often it happens. "Short of water in 4 of the last 10 dry seasons without irrigation." Keep the level word, but put it second. |
| 1.3 | The "Things to check" cell only gives a count ("4 to check locally"), and a count isn't something a farmer can act on. | `rotation-compare.tsx:176` | Show the first item in words, then "+3 more". |
| 1.4 | When rainfall hasn't been read, water results quietly use 720 mm, and the engine's own default is 750 mm. A notice says so, but the chips and badges still look final. | `rotation-compare.tsx:23`, `report-view.tsx:17`, `strategies.ts:35` (now deleted; check the new engine does the same) | Mark every result that depends on water as "assumed" until real rain is read. Better still, fetch the conditions automatically before Compare. Keep one constant. |
| 1.5 | Conditions showed only skeletons for over 14 s, with no time estimate. `UX.md` promises "Satellite detail on its way, about 3 minutes". | `conditions-view.tsx` loading branch | Show progress for each source: weather (seconds), soil (seconds), satellite history (minutes). Show partial results as each one arrives. |
| 1.6 | Units such as kg/ha, mm and ETo aren't explained anywhere on screen. This is handoff feature 25, plain-language explanations. | Compare evidence panel | Add the Lovi pattern: a "What does this mean?" line right under each figure. Use one sentence and keep the number. |
| 1.7 | Everything is in English and in hectares, but the confirmed scope is Ayeyarwady, Magway and Shan. Strings already sit in `lib/copy/en.ts`. | `lib/copy/` | **Biggest lever, still to validate:** add Burmese copy and the units farmers there use (acres; baskets for paddy yield). Confirm both in the interviews `UX.md` already plans. |
| 1.8 | The engine now tags each piece of evidence as observation, model estimate, farmer report, soil test or scenario (`EvidenceKind`, `lib/evidence/indicator.ts:11`). The UI doesn't show the tag. Compare also still reads `ev.value` and `ev.source`, which the new `Evidence` type has dropped (`types.ts:268`). | Compare evidence panel | Show the kind as a word on each evidence row, e.g. "Satellite", "Weather model", "You told us", "Soil test", "What-if". That tag is what tells a farmer how far to trust the row. |

**Mobbin references**
- [Lovi: "What does this mean?" under a fit score](https://mobbin.com/screens/49f3e8d8-e3bc-472d-bade-24b21a18445f). Plain explanation right where the number is. (Their invented % score is *not* something to copy; see 3.4.)
- [Redfin affordability](https://mobbin.com/screens/af24a9b8-c6eb-4097-ac80-c2f1f2ded4e3). The verdict word sits on the scale ("41% | Stretch"), with a warning line and an info icon beside it.
- [Monzo projection](https://mobbin.com/screens/a196ebe3-0c04-4b4e-8241-201b961696a7). A "likely range" band and a one-line caveat under the chart.

## 2. Let farmers enter their own priorities and constraints

**The gap.** The data model is ready, but no screen collects any of it. `lib/schemas/field.ts` already defines:

- `priorities`: water, soil, income, forage, lower inputs
- `constraints`: irrigation amount, equipment, labour, market access, crops to prefer or avoid, planting window
- `economics`, `soilObservations` and `localNotes`

`lib/store/repository.ts:24–27` saves all of them.

**The engine is catching up (uncommitted, in progress).** `lib/engine/strategies.ts` has been deleted. New files take its place:

- `candidates.ts` builds rotations from region templates, drops crops on the excluded list and keeps to the planting window.
- `mcda.ts` ranks options by the farmer's priority weights. It says "unresolved" when a top priority can't be evaluated, and "no-priorities" when none are set.

Compare and Report still import the deleted file, so every page currently returns HTTP 500.

At the last commit, the alternatives are fixed: always "sorghum, groundnut, and cowpea" and "maize with crimson clover, soybean and cowpea". The audit test field in Magway was offered crimson clover. Once the new engine lands, the missing piece is the **screen** that collects priorities and constraints, plus a way to show which ones shaped the result.

| # | Improvement | Pattern |
|---|---|---|
| 2.1 | **A "What matters to you" step**, which can be skipped. The farmer taps the five priorities in order, and numbers appear as they tap. Ranking is easier than setting weights. Work out `weights` from the order instead of asking for 0–1 values. | [Happier: select goals in order](https://mobbin.com/screens/3e372797-e682-47d3-bf7c-f9fee298b33a), [Babbel: rank motivations](https://mobbin.com/screens/d78ed7b6-b6e0-456a-a2ff-2ef666665178) |
| 2.2 | **"Your farm" constraints as a Prefer / Avoid sheet**: water, equipment, labour, market, and crops to grow or avoid. Use chips, not forms. Each row starts at "Open to anything", so skipping changes nothing. | [CREME: Prefer / Avoid chips](https://mobbin.com/screens/1e4fd4bb-03e8-4043-9833-4256f77ca048), [happn: "Open to anything" defaults](https://mobbin.com/screens/3562e87e-29db-42f9-a01c-acddf1584034) |
| 2.3 | **Show what shaped the result.** Put a row of chips above Compare, like "Shaped by: rain only · hand tools · avoid groundnut · sesame buyer nearby". Each chip opens its setting, and the results update straight away. | [Hers: "Customized specifically for"](https://mobbin.com/screens/a2dc3d24-6b16-4580-ae24-53f2502591eb), [Instagram: "Your algorithm" in a sentence, with undo](https://mobbin.com/screens/c7c4cae7-defb-4f86-9468-5a11cd5fc55b) |
| 2.4 | **What-if, live.** Change the water amount or planting window and watch the comparison move. State what is assumed directly under the controls. | [Wealthsimple: "If you save $200"](https://mobbin.com/screens/f0c7701f-2b42-4e95-bccd-da8ca1f65324), [Wealthfront: "My assumptions"](https://mobbin.com/screens/287af5fa-3066-4305-bc1d-2bad0e22db46) |
| 2.5 | **Clash with a constraint: flag the option, don't hide it.** For example: "Needs a tractor for the harvest; you said hand tools." If there is no evidence for a priority, say "Not known", never score it as zero (handoff feature 11). | |
| 2.6 | **Show what the new engine does.** `candidates.ts` gives a reason for each rotation it rejects ("Groundnut is on your excluded list"). Show those reasons under the options as "Not shown, and why". For `mcda.ts`, a "no-priorities" result should lead into 2.1, and "unresolved" should name the priority that couldn't be judged. | |

**Where it goes.** Put a step called "What matters" between Conditions and Compare. The stepper grows from four steps to five. A farmer who skips it still gets a comparison, labelled "Not tailored yet: tell us what matters".

## 3. Supports the farmer, doesn't replace local knowledge

**The gap.** The app has one judgment message: `JudgmentNote`, the same two lines on Compare and Report (`rotation-compare.tsx:195`, `report-view.tsx:134`). A general disclaimer is what Mobbin shows people tapping past: see [Flo](https://mobbin.com/screens/3849126d-2a95-4ffd-bc0f-bf2384c6fc1c), [Revolut](https://mobbin.com/screens/d9cb5509-99c7-41ce-b49c-76eeccd832ac) and [QuestMobile](https://mobbin.com/screens/acdc78a8-1314-4b3a-a66e-64d8b3fc90d8). [Pillow](https://mobbin.com/screens/ad40984e-b6d7-4577-9be3-4653a8e3362f) does better, with three short plain bullets. But it is still a gate before the content, not something placed beside the claims it qualifies.

| # | Improvement | Why |
|---|---|---|
| 3.1 | **"Your call" markers at the exact claims where data runs out**, not a general banner. Each says why the farmer's knowledge beats the data on that point (see the list below). Keep the general note too, but make it shorter. | The brief asks to "highlight where human judgment is particularly important". A general banner doesn't do that. |
| 3.2 | **Let the farmer disagree.** Add "Not right for my field" on any claim, with a short note. The note becomes `farmer-report` evidence, overrides the claim where it can, and appears in the Report as "What the farmer knows". | Makes PRODUCT.md principle 4, "Local knowledge wins", something a farmer can actually do. |
| 3.3 | **The Report adds a "Bring this to your adviser" section.** It lists the farmer's notes, their constraints and the "Your call" items. Adviser questions already come from flagged risks (`report-view.tsx:21`), so build on that. | The adviser meeting is the real decision point. |
| 3.4 | **Say how sure we are in words, never as a percentage.** Use the evidence kind and coverage: "Based on 20 years of weather around your field" or "Based on one regional soil map, 250 m". Never use a Lovi-style "87% fit". | Handoff feature 9: "Do not invent a confidence percentage." |

**Where human judgment matters most** (from the handoff's own limits; use these for the "Your call" markers):

1. **Water on your field.** SMAP is a 9 km cell and can't see your well, canal or low corner.
2. **Soil fertility.** The soil map is 250 m and global. Your soil test or experience beats it.
3. **Pests and disease.** NASA data can't identify them or show that a rotation breaks their cycle (feature 22).
4. **Markets, prices and labour.** No satellite can see your buyer or your workforce (features 12, 23, 24).
5. **Variety and sowing dates.** Crop rules are generic until a local variety is chosen.
6. **Flooded rice and bare soil** (Ayeyarwady). Water pixels aren't bare ground.
7. **Slope and erosion** (Shan). The weather grid can't resolve each slope or valley.

## 4. UI: borders, surfaces, colour, type, layout

Checked against DESIGN.md (the locked system, which wins wherever Hallmark's defaults disagree). Screens were captured at 1440 and 375 px from the last commit (`9cc0205`), using a test field in Magway. The working tree currently returns 500 on every route.

Hallmark's static lint: **0 Floor FAIL, 4 Reflex, 2 WARN**, saved in `.hallmark/before.txt`. Its render tier couldn't run (no puppeteer installed), so everything below comes from the screenshots plus code search.

**What holds up.** Every colour in the Tailwind classes goes through a token. Focus rings are global. `overflow-x: clip` is set, there's a reduced-motion fallback, and touch targets are 44 px. Parchment, soil ink and one green read calmly. The heat chart's comfort band is clear.

### 4.1 Borders: too many lines doing the same job

There are 37 `border`, 37 `border-line`, 18 `border-t` and 9 `border-b` uses. On a typical screen, a hairline wraps the header, the footer, each panel, each card *inside* the panel, each table row, each ribbon cell and each chip. When every block has an outline, the outline stops grouping anything.

| # | Where | Fix |
|---|---|---|
| B1 | **Cards inside cards.** Risk rows inside "What could go wrong" (`rotation-compare.tsx`), the crop card inside "Crops in order", and the grey "Satellite rainfall: not connected" note inside the rain panel (`conditions-view.tsx:268`). | Inside a panel, separate rows with a hairline divider or spacing, not another bordered box. Keep one outline level per stack. |
| B2 | **The rotation ribbon has a border on every month cell.** That's 24 bordered boxes on a sunken background, and the crop block barely stands out (`rotation-editor.tsx`). | Drop the cell borders and keep faint month gridlines. Give the crop block the strong edge and fill. |
| B3 | **The home empty state uses a drawn browser window**, with traffic-light dots, a fake cursor and cards three levels deep (`first-run.tsx` → `components/preview/rotation-preview.tsx`). This breaks Hallmark Floor 11 (no hand-drawn browser or OS window, no card in card). It also shows a fixed sorghum/clover answer before the farmer has entered anything. | Replace it with the three-step list at full width, or one real Compare row with no window chrome. |
| B4 | **Header and footer both have hairlines plus a raised fill.** That frames the page twice. | Keep one: either the fill change or the line. |

### 4.2 Surfaces and backgrounds

| # | Where | Fix |
|---|---|---|
| S1 | Surface use is split evenly: `surface-raised` 17 times, `surface-sunken` 17 times, `surface` 10 times. Sunken is meant for inputs, chart plots and the map frame (DESIGN.md), but it is also used for notes, the empty field thumbnail and the ribbon, so "sunken" no longer means "you can type or plot here". | Keep sunken for inputs and plots only. Notes become plain text with an icon. |
| S2 | **The field card thumbnail is an empty grey box** with a pin, about 170 px tall on a phone (`fields-list.tsx:31`). It takes the biggest area on the home screen and says nothing. | Show a static map tile when there's a token. Without one, show the coordinates and crop ribbon, or drop the thumbnail. |
| S3 | **The "Rain falls short" fill covers the whole plot** whenever every month is short (the Magway case). The chart turns into one drought-yellow wall and the bars lose contrast. | Shade only the gap between the demand line and each bar, or tint the bars that fall short instead of the background. |
| S4 | **Section framing is inconsistent.** Rain and Heat sit inside raised cards, but Soil profile puts its heading on the page and only its empty state in a card (`conditions-view.tsx`). | Use one pattern for every Conditions section. |

### 4.3 Colour meaning: the data hues are used for status

DESIGN.md's Meaning-Only Rule says data hues mean data. Several places break it:

| # | Where | What it does | Fix |
|---|---|---|---|
| C1 | `rotation-compare.tsx:278, 283` | Green leaf "healthy" chips on "Current baseline" and on "Nitrogen balance -160 kg/ha". A large deficit shows as healthy. | Plain neutral chip for the baseline. The nitrogen chip follows the sign: `healthy` when positive, `drought` with words when negative. |
| C2 | `rotation-compare.tsx:160` | "low benefit", "medium benefit" and "high benefit" all get the same green leaf. | Neutral chip with the level word, or a scale (one, two or three filled marks) plus the word. |
| C3 | `fields-list.tsx:60` | Workflow status uses data hues: "Rotation recorded" is healthy green, "Needs rotation" is drought brown. A field that needs input isn't in drought. | Use neutral and accent status pills: `field` for done, an outlined chip for "Needs your input". |
| C4 | `conditions-view.tsx:233` | "Coldest nights near 9 °C" gets a green leaf because it isn't frost. | Neutral chip with a thermometer icon. Use `frost` only when frost is likely. |
| C5 | `rotation-compare.tsx:331` | Evidence values are set in field green mono ("572 mm annual rainfall"). Green is the action and accent colour, so the numbers look clickable. | `text-ink` for figures. |
| C6 | Drought resilience | High resilience uses `water` blue on Compare, but green in the empty-state preview. | One mapping everywhere. |
| C7 | `components/ui/segmented.tsx:45–71`, `skeleton.tsx:10` | MUI `sx` hard-codes `#8c8676`, `#2e5e3a`, `#fbfaf6`, `#1f1d17` and `#e9e6da`, next to Tailwind classes that set the same values. If a token changes in `globals.css`, these won't follow. | Use `var(--color-…)` in `sx`, or drop the duplicated Tailwind classes. Better still, build Segmented without MUI. |

### 4.4 Type

| # | Where | Fix |
|---|---|---|
| T1 | **Words set in mono.** "Pin only, area not set", "Rain only" and "From the regional soil map" use the mono data style (`field-overview.tsx:177`). Lint 64 also flags `report-view.tsx:189` and `source-line.tsx:23` ("Older than usual"). | DESIGN.md: mono is for readings, coordinates and units. Words go in Geist. |
| T2 | **The month axis is single letters** (J F M A M J J A S O N D) in the rotation ribbon, so J appears three times. | Use three-letter months, as the Conditions charts already do. In Burmese, use short month names (see 1.7). |
| T3 | **The crop picker shows botanical families**: "Maize (Corn) (Poaceae)". | Show the local name, and put the family in the detail. |
| T4 | **Placeholders look like real values**: 42.03 / -93.62 (Iowa), "North plot". | Use instructive placeholders ("e.g. 20.15") or drop them, since the label already says what goes there. |
| T5 | **Source lines join their parts with middle dots** ("NASA POWER · 0.5° · 1981–2024"). Hallmark Floor 10 bans this, but DESIGN.md defines it. | Keep it (the locked system wins). Waiver noted. |

### 4.5 Layout and components

| # | Where | Fix |
|---|---|---|
| L1 | **The longitude input spills past its card** in the Add-a-field panel (`location-picker.tsx:345`, `grid-cols-2` with inputs that won't shrink). | `grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` and `min-w-0 w-full` on the inputs. |
| L2 | **The stepper says "Done" for steps that haven't run.** Conditions and Compare show Done as soon as a rotation is saved (`fields-store.ts:131–132`), even while Conditions is still loading. The home progress bar fills completely. | Work out each step's state from real data: cached conditions for Conditions, a visit or result for Compare. |
| L3 | **The stepper's active item uses the same green fill as "done"**, so the current page and a finished step look alike. | Show the current page with an outline or an inset bar, and keep green fill for done. |
| L4 | **"About this field" sits in a half-width card** with empty space to its right at 1440 px. | Full width with two columns of rows, or put the next-step panel beside it. |
| L5 | **Add a field stacks three floating cards** (title, coordinates, save) over the map. Without a token, the centred "The map isn't set up yet" text runs under the stack. | One sheet with sections. Offset the no-map message to the free area. |
| L6 | **Conditions took about 25 s to load at 1440**, with two skeleton bars and one line of text (see 1.5). | Load each source with its own status. |
| L7 | **Lint warnings:** no `:active` styles anywhere (26b), no `:disabled` styles in Conditions (26b), and two sections labelled by a `<span>` or `PanelHeader` instead of a heading (54) (`conditions-view.tsx:297`, `rotation-compare.tsx:286`). | Add a pressed state to buttons and chips, and give disabled controls a visible style. Use `<h2>` for section labels. |

### 4.6 One direction for all of the above

Moving toward **fewer outlines, one level of panel, neutral status chips and data colours only on data** fixes most rows above together:

1. A panel is the only bordered box. Rows inside it are separated by hairline dividers.
2. Status and workflow chips are neutral or outlined. `healthy`, `water`, `heat`, `drought` and `frost` appear only next to a reading.
3. Sunken is reserved for inputs and plots.
4. Figures are `ink` mono. Words are Geist.

These are all token and class changes in the existing system, roughly Hallmark's "polish" depth. No new theme is needed.

## Priority

0. **Fix the 500s.** Compare and Report import the deleted `lib/engine/strategies.ts`.
1. **Fix the misleading figures and colours** (1.1–1.4, C1–C5, L2). These are small edits, and right now they can lead a farmer to the wrong reading.
2. **Connect priorities and constraints** (2.1–2.6). The schema and storage exist. What's missing is the screen, the engine input and alternatives drawn from the region.
3. **Put judgment at the claim level** (3.1, 3.2, 1.8). Show the evidence kind, add "Your call" markers and allow disagreement.
4. **Language and units** (1.7). Validate with the five to eight interviews `UX.md` already lists, then do it.
5. **Calm the surfaces** (4.1, 4.2, 4.6, T1–T4, L1, L3–L5, L7).
6. **Loading and the Report** (1.5, L6, 3.3, 3.4).

## Not covered

- No farmer interviews. Every finding above still needs a five-person test: "Which rotation would you try? What would you check first?"
- Hallmark's render tier didn't run (no puppeteer). The screenshots were taken by hand in the browser pane, from the last commit, because the working tree returns 500 on every route.
- No map was shown: the scratch preview had no Mapbox token, so the map layers and layer sheet weren't reviewed.
- No outdoor contrast test on a real phone.
