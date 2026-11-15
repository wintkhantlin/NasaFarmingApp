# Field Overview: farmer-centred improvement plan

Screen S06, `/fields/:id`, `components/field/field-overview.tsx`. This plan checks the screen against three
farmer-centred goals:

- A farmer with little technical background can read it.
- A farmer can enter their own priorities and constraints.
- It says where local judgment matters.

The audit used a Magway field with sesame followed by green gram, on 2026-11-15.

## Done in this pass

- **One shape for every page link.** The overview's "go to" links all use `components/ui/nav-link.tsx`:
  icon · label · chevron, at least 44 px tall (DESIGN_SYSTEM.md, "Navigation row" and `size.hit`). Before,
  they came in four styles at 18–20 px tall.
- **Shorter labels that make sense on their own:**

  | Before | After |
  |:--|:--|
  | Edit | Edit crops |
  | All farm details | Edit details |
  | Details / All conditions | Weather and soil (one link instead of two to the same page) |

  "Pests and diseases" and "Printable report" keep their labels.
- **Setup steps** (Boundary, Rotation, Soil test, Farm profile) now have 44 px tap areas.
- **Field tabs:** the done tick sits after the label instead of overlapping the icon.
- **Bug fixed:** soil pH printed as `6.833333333333333`. It now shows one decimal.

## 1. Easy to read without technical training

| # | Problem seen | Change | Size |
|:--|:--|:--|:--|
| 1.1 | The header leads with `20.150° N, 94.950° E` in a code font. Farmers know their village or township, not coordinates. | Lead with the township or village name. Move coordinates to the Technical view. | S |
| 1.2 | The "Village area" badge doesn't explain itself. | Say what it means: "Using the area around your village. Draw your field for a closer look." Put the boundary button next to it. | S |
| 1.3 | The next-step title "See my answer" repeats its button, and the body only lists crops. | Title: "Your plan is ready to compare". Body: the one thing the answer will tell them, e.g. "See if green gram after sesame is your best option". | S |
| 1.4 | "Local conditions" shows `40° / 15°C` and `clay loam · pH 6.8`, while Field details says the same soil in plain words. The Simple/Technical switch only applies to Field details. | Make Simple/Technical one setting that every panel follows. Simple says "Hottest month about 40 °C (Apr)" and "Clay loam, close to neutral". | M |
| 1.5 | Pests and diseases is a bare link. | Show the top item to watch on the card ("Watch: charcoal rot in green gram"), with the link under it. | S |
| 1.6 | The new Pests and diseases page is English only. Other screens have Burmese in `lib/copy/my.ts`. | Move its text into `lib/copy` and translate it, with local crop and disease names checked by an extension officer. | M |
| 1.7 | "1 of 4 done" reads as unfinished, though the answer is already available. | Say "Answer ready. 3 optional details would sharpen it." | S |

## 2. Let farmers enter their own priorities and constraints

The Farm tab (`farm-profile.tsx`) already collects:

- priorities, ranked
- water access
- equipment
- labour and peak months
- market access and whether they can sell

The overview hides most of this, and passes off defaults as facts.

| # | Problem seen | Change | Size |
|:--|:--|:--|:--|
| 2.1 | "Top priority: Balanced across water, soil and income" is a default, but it isn't marked. UX.md says unset values must say **Assumed**. Equipment and labour already do. | Mark it "Balanced (assumed) · Change". | S |
| 2.2 | Market access is collected but never shown on the overview. | Add a Market row. | S |
| 2.3 | The farm's constraints are spread through a long details list. | Make a "Your farm" card with five rows: Water, Equipment, Labour, Market and Priorities. Each row shows Set by you or Assumed, and opens its question with one tap. | M |
| 2.4 | "5 quick questions could sharpen this" hides what is being asked. | Show the first question in place, with its answer buttons, e.g. "Can you water a crop in the dry season? Yes / Sometimes / No". | M |
| 2.5 | Water says "Rain only" with no source. | Mark it "(you said)" or "(assumed)", like the other rows. | S |

## 3. Support local expertise, don't replace it

| # | Problem seen | Change | Size |
|:--|:--|:--|:--|
| 3.1 | The overview has no judgment note. Compare and Pests have one. | Add the compact `JudgmentNote` at the foot of the page. | S |
| 3.2 | The Dry Zone rain caution (POWER rain about 51% low at Mandalay) appears on Compare but not on this Magway overview, where 822 mm a year is shown as plain fact. | Under the rainfall figure, add: "Probably too low here. Check with local records." Use `dryZoneRainCaution()`. | S |
| 3.3 | Soil comes from a 250 m SoilGrids estimate, and salt is not measured, but nothing suggests a soil test. | On the soil row: "Estimate. A soil test from the township DoA office would settle it." | S |
| 3.4 | `CheckLocally` (variety, pests this year, flooding, land-use rules, buyer) only appears on Compare. | Show its top two items on the overview while the answer is still a draft. | S |
| 3.5 | Nothing says whose advice to seek. | Add a "Who to ask" line: township agriculture extension office, seed supplier, an experienced neighbour. Make it editable so a farmer can save a name. | M |

## Order of work

1. **Quick fixes (S):** 2.1, 2.5, 3.1, 3.2, 1.3, 1.7, 2.2, 3.3. These are copy and small layout changes in
   `field-overview.tsx`. They fix honesty gaps (things that look like facts but aren't) first.
2. **Read and act on one screen:** 1.1, 1.2, 1.5, 2.4, 3.4. These make the overview answer three questions:
   what is this, what should I check, what do you still need from me.
3. **Larger work (M):** 1.4 (one Simple/Technical setting), 2.3 (the Your farm card), 1.6 (Burmese copy), 3.5.

## How to check it worked

- **Tests:** component tests in `tests/components/` covering the "Assumed" marks, the Dry Zone line on a
  Magway field, and every overview link being at least 44 px tall.
- **Field test with 3–5 farmers or extension officers in Magway and Ayeyarwady:**
  - Can they say, without help, what the next step is?
  - Which values are guesses?
  - Who they would ask about pests?
