# Field Shift Design System

**Version:** 1.0 (draft for Phase 0 testing)
**Applies to:** iOS app (SwiftUI) and the browser prototype (HTML/CSS).
**Companion documents:** `PLAN.md` (screens, flows, build order), `whitepaper.md` (science and honesty rules).

The system has four layers. Agents implement them in this order:

1. **Foundations:** tokens for colour, type, space, shape, elevation, motion and icons (Sections 2–8).
2. **Data-display language:** how stress, unknowns, scale and crop calendars look (Section 9).
3. **Components:** anatomy, variants, states and rules for every building block (Section 10).
4. **Layout and placement:** grids, screen zones, thumb reach and per-screen placement (Sections 11–13).

Everything here serves the honesty rules in the whitepaper. When a visual choice would hide an *unknown*, blur a scale, or make a hypothetical look like a forecast, the honesty rule wins.

---

## 1. Design principles

| Principle | In practice |
| --- | --- |
| **Calm field notebook** | Warm off-white canvas, plain type, few colours. The app should feel like a well-kept notebook, not a dashboard |
| **Plain words lead** | Every block starts with a sentence; numbers and indices sit one level down |
| **Two things stand out** | Only the best-match outline (accent) and *Not known* (amber) get distinctive treatment (Von Restorff). Everything else is neutral |
| **Shape and word, never colour alone** | Each status has a word, an icon and a shape as well as a colour, so it survives colour blindness, sunlight and black-and-white printing |
| **Native first** | System controls, system navigation, system sheets. Custom components only for data display (season strip, calendar bar, scale badge) |
| **Readable outdoors** | Higher-than-minimum contrast, solid fills over imagery, large tap targets |

---

## 2. Colour

### 2.1 Primitive palette

Warm neutrals, one green accent, an amber family for unknowns, a clay family for stress, and a red for destructive actions only.

| Token | Light | Dark |
| --- | --- | --- |
| `neutral.0` | `#FFFFFF` | `#1D1C19` |
| `neutral.50` | `#F4F3EE` | `#121210` |
| `neutral.100` | `#ECEAE3` | `#0B0B0A` |
| `neutral.200` | `#E7E1D2` | `#3A372F` |
| `neutral.300` | `#D9D6CC` | `#34322D` |
| `neutral.500` | `#8F8C82` | `#6B685F` |
| `neutral.600` | `#6E6C64` | `#A19E94` |
| `neutral.700` | `#5A5850` | `#B9B6AC` |
| `neutral.900` | `#1C1B18` | `#F2F0EA` |
| `green.50` | `#E3F2EC` | `#123A2D` |
| `green.300` | `#7FB59A` | `#2C6B51` |
| `green.600` | `#2F7D5B` | `#4FB387` |
| `green.700` | `#0E6B4F` | `#5FC9A0` |
| `green.800` | `#0A5139` | `#8FE0C0` |
| `amber.50` | `#FBEFD5` | `#3A2A0A` |
| `amber.600` | `#B77700` | `#D49A2A` |
| `amber.800` | `#7A4A00` | `#F4C66B` |
| `clay.50` | `#F8E3D8` | `#3B1E12` |
| `clay.700` | `#9C3D12` | `#F08A5B` |
| `red.50` | `#FDECEA` | `#3A1512` |
| `red.700` | `#B42318` | `#FF7A6E` |

### 2.2 Semantic tokens (what components use)

| Token | Maps to | Use |
| --- | --- | --- |
| `bg.canvas` | `neutral.50` | Screen background behind grouped content |
| `bg.surface` | `neutral.0` | Inset groups, cards, sheets |
| `bg.sunken` | `neutral.100` | Segmented-control track, inputs, map placeholder |
| `text.primary` | `neutral.900` | Body, titles |
| `text.secondary` | `neutral.700` | Supporting lines, values in rows |
| `text.tertiary` | `neutral.600` | Captions, timestamps, placeholders |
| `border.hairline` | `neutral.300` | Row separators, card edges where needed |
| `border.strong` | `neutral.500` | Control outlines, unchecked boxes |
| `accent` | `green.700` | Links, selected tab, best-match outline, primary button fill |
| `on.accent` | `#FFFFFF` light / `neutral.50` dark | Text on `accent` fills |
| `accent.bg` / `accent.text` | `green.50` / `green.800` | Best-match tag |
| `unknown.bg` / `unknown.text` / `unknown.border` | `amber.50` / `amber.800` / `amber.600` | *Not known*, *Not asked* (outline only), open-question badge |
| `stress` / `stress.bg` | `clay.700` / `clay.50` | Stressed season cells, failed-limit reason |
| `danger` / `danger.bg` | `red.700` / `red.50` | Destructive actions only (Delete) |
| `viz.crop` / `viz.crop2` / `viz.bare` | `green.600` / `green.300` / `neutral.200` | Calendar bar segments |

### 2.3 Measured contrast (WCAG 2.x)

Measured with `scripts/contrast.py`. AA needs 4.5:1 for text and 3:1 for UI parts.

| Pair | Light | Dark |
| --- | --- | --- |
| `text.primary` on `bg.surface` | 17.22 | 14.95 |
| `text.secondary` on `bg.surface` | 7.13 | 8.40 |
| `text.secondary` on `bg.canvas` | 6.41 | 9.24 |
| `text.tertiary` on `bg.surface` | 5.26 | 6.36 |
| `accent` on `bg.surface` (links) | 6.49 | 8.40 |
| `on.accent` on `accent` (buttons) | 6.49 | 9.24 |
| `accent.text` on `accent.bg` | 8.08 | 8.14 |
| `unknown.text` on `unknown.bg` | 6.56 | 8.67 |
| `stress` on `bg.surface` | 6.80 | 6.89 |
| `danger` on `bg.surface` | 6.57 | 6.70 |
| `unknown.border` on `bg.surface` (UI) | 3.72 | 6.86 |
| `border.strong` on `bg.surface` (UI) | 3.36 | 3.06 |
| `viz.crop` on `viz.bare` (UI) | 3.83 | 4.60 |

Rule: white text on the dark-mode accent measures 2.03:1 and is **not allowed**; `on.accent` switches to the dark canvas colour in dark mode.

### 2.4 Colour rules

- Accent appears **at most once as an outline or fill per screen**, plus links and the selected tab.
- Red is for destructive actions only, never for a bad result. A stressed season is clay, not red, so "stressed" never reads as "error".
- With **Increase Contrast** on: hairlines use `border.strong`, translucent materials become solid `bg.surface`, and the best-match outline goes from 2 pt to 3 pt.

---

## 3. Typography

### 3.1 Families

| Platform | Latin | Myanmar |
| --- | --- | --- |
| iOS | SF Pro (system) | System Myanmar font via the font cascade (Noto Sans Myanmar or Myanmar Sangam MN, depending on the iOS version; check on the oldest supported version) |
| Web | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | `"Noto Sans Myanmar"` (Unicode), self-hosted for offline use |

Text is stored and rendered as Unicode. Zawgyi-encoded input is detected and converted on entry (Postel's Law), never stored.

### 3.2 Type scale (iOS text styles at the default size)

| Token | iOS style | Size / leading (pt) | Weight | Web (rem at 16 px) | Use |
| --- | --- | --- | --- | --- | --- |
| `type.largeTitle` | Large Title | 34 / 41 | Bold | 2.125 / 2.56 | Tab-root titles |
| `type.title2` | Title 2 | 22 / 28 | Bold | 1.375 / 1.75 | Option title in detail |
| `type.title3` | Title 3 | 20 / 25 | Semibold | 1.25 / 1.56 | Card titles, sheet titles |
| `type.headline` | Headline | 17 / 22 | Semibold | 1.0625 / 1.375 | Row titles that need weight, button labels |
| `type.body` | Body | 17 / 22 | Regular | 1.0625 / 1.375 | The plain-language answer sentence |
| `type.callout` | Callout | 16 / 21 | Regular | 1 / 1.31 | Explanations in sheets |
| `type.subheadline` | Subheadline | 15 / 20 | Regular | 0.9375 / 1.25 | Row values, secondary lines |
| `type.footnote` | Footnote | 13 / 18 | Regular | 0.8125 / 1.125 | Section headers, scale badges, provenance |
| `type.caption` | Caption 1 | 12 / 16 | Regular | 0.75 / 1 | Year labels under strips, chart axes |

### 3.3 Typography rules

- **Dynamic Type everywhere.** Every token scales with the user's text size, up to the accessibility sizes. Layouts reflow; they never truncate decision text (see Section 11.5).
- **Myanmar script needs more line height.** Stacked vowel signs and medials clip at Latin leading. Set Myanmar line height to at least 1.6× the font size (start at 1.7×), and test every component with the longest Myanmar strings, not English.
- **Numbers:** tabular figures in strips, tables and charts so columns line up. Accept Myanmar digits (၀–၉) and Latin digits on input. Display in the user's chosen digit set, consistently.
- **Weights:** Regular and Semibold only, plus Bold for titles. No light weights, which fade outdoors.
- **Case:** sentence case everywhere. iOS section headers in grouped lists use `type.footnote` in `text.secondary`. Don't force uppercase; uppercase hurts Myanmar text and readability.

---

## 4. Spacing and sizing

4-pt base grid.

| Token | Value | Typical use |
| --- | --- | --- |
| `space.1` | 4 | Icon-to-label gap inside a badge |
| `space.2` | 8 | Gap between related lines; chip gap |
| `space.3` | 12 | Row vertical padding (with 44 pt minimum height) |
| `space.4` | 16 | Screen side margin (compact); card padding |
| `space.5` | 20 | Screen side margin (regular width); sheet padding |
| `space.6` | 24 | Gap between groups / cards |
| `space.8` | 32 | Gap between major sections |
| `space.10` | 40 | Top padding of empty states |

| Size token | Value | Rule |
| --- | --- | --- |
| `size.hit` | 44 × 44 pt | Minimum tap area for anything tappable (Fitts) |
| `size.row` | ≥ 44 pt | List row minimum height; grows with text |
| `size.button` | 50 pt high | Primary and secondary buttons; full width on compact |
| `size.seasonCell` | ≥ 44 × 44 pt (compact), ≥ 32 × 32 visual inside a 44 hit area (regular) | Season strip cells |
| `size.icon.row` | 20–22 pt | Leading icons in rows |
| `size.icon.tab` | 24–28 pt | Tab bar symbols (system) |

---

## 5. Shape

| Token | Value | Use |
| --- | --- | --- |
| `radius.sm` | 6 | Season cells, small tags |
| `radius.md` | 10 | Inset grouped lists, inputs, segmented control |
| `radius.lg` | 14 | Option cards, chart cards, map bottom card |
| `radius.sheet` | system | Sheets (use the system value; don't override) |
| `radius.pill` | 999 | Scale badges, status tags, layer chips |

Borders: `0.5 pt` hairline (`border.hairline`) by default; `2 pt accent` for the best match only; **dashed 1 pt `unknown.border` only for unknown or not-asked** content.

---

## 6. Elevation and materials

| Level | Treatment | Use |
| --- | --- | --- |
| 0 Flat | Solid `bg.surface` on `bg.canvas`, no shadow | All content: cards, lists, charts |
| 1 Controls | System material / Liquid Glass (iOS 26), solid fallback with Increase Contrast or Reduce Transparency | Tab bar, toolbars, floating map controls |
| 2 Sheets | System sheet presentation with its own shadow and dimming | Priorities, explain, answer, what-if, add field |
| 3 Popover | System menus and popovers | Field switcher, More menu |

Never put translucent material behind body text, and never add custom shadows to cards.

---

## 7. Motion and haptics

| Token | Value | Use |
| --- | --- | --- |
| `motion.fast` | 150 ms ease-out | Tag changes, chip selection |
| `motion.base` | 250 ms ease-in-out | Card re-order after priorities change, layer cross-fade |
| `motion.reveal` | 350 ms ease-out | Recall answer reveal, what-if result change |
| `motion.system` | system springs | Push, sheets, tab changes (don't override) |

- **Reduce Motion:** replace movement with cross-fades; never animate season cells one by one.
- **Re-ordering:** when priorities change the ranking, cards move with `motion.base` and the moved card shows "Moved up: matches 'Save water' better" for 3 s. Changes are never silent.
- **Haptics:** selection tick when a priority card snaps or a slider passes zero; warning when an option fails a limit; success when a field is saved. Nothing else.

---

## 8. Iconography

iOS uses SF Symbols (outline, matching text weight); web uses an equivalent outline set. One meaning per icon.

| Meaning | SF Symbol | Web (Tabler) |
| --- | --- | --- |
| Fields tab | `map` | `map-2` |
| Compare tab | `scalemass` | `scale` |
| Learn tab | `book` | `book` |
| Water / rain | `drop` | `droplet` |
| No water available | `drop.degreesign.slash` or `drop` with slash overlay | `droplet-off` |
| Heat | `thermometer.sun` | `temperature-sun` |
| Soil / cover | `leaf` | `plant` |
| Nitrogen / legume | `circle.hexagongrid` | `atom-2` |
| Erosion | `mountain.2` | `mountain` |
| Money | `banknote` | `coin` |
| Market | `storefront` | `building-store` |
| Animals / forage | `hare` (pick a cattle-like symbol if available) | `cow` |
| Not known | `questionmark.circle` | `help-circle` |
| Not asked | `ellipsis.circle` | `dots-circle-horizontal` |
| Check locally | `person.2.wave.2` | `user-check` |
| Scale: your field | `square.dashed` | `square` |
| Scale: area | `circle.dashed` | `circle-dashed` |
| Hypothetical | `slider.horizontal.3` | `adjustments-horizontal` |
| Share | `square.and.arrow.up` | `share` |

Each SF Symbol name must be checked against the minimum supported iOS version's catalogue during Phase 1; substitute the nearest equivalent if one is missing.

---

## 9. Data-display language

These are custom components, so they follow the strictest rules.

### 9.1 Season state

| State | Fill | Mark | Border | Word (VoiceOver) |
| --- | --- | --- | --- | --- |
| Stressed | `stress` | `×` in `bg.surface` (6.80:1 light, 7.58:1 dark using the dark canvas) | none | "2022: stressed. Rain fell short." |
| Not stressed | `bg.sunken` | none | none | "2019: no stress found" |
| Not known | `unknown.bg` | `?` in `unknown.text` | 1 pt dashed `unknown.border` | "2017: not known. Rain data missing." |
| Farmer recall given | as above | small dot at bottom-right in `text.primary` | — | "…You said: dry." |

Count text always accompanies the strip: "Short of rain in 2 of 10 seasons". The strip never stands alone.

### 9.2 Calendar bar (12 months)

- Segments: `viz.crop` (first crop), `viz.crop2` with diagonal hatch (second crop), `viz.bare` (bare), white with dashed outline (planned).
- Rainy months are marked with a row of small drop icons above the bar, not a colour band, which keeps the palette small and the meaning readable in black and white.
- A bare segment that overlaps rainy months gets a `stress`-coloured underline and the word "bare in rains" below the bar.
- Month labels in `type.caption`; on compact width only the first letter of each month and the current-month marker "Now".

### 9.3 Scale badge

Pill, `type.footnote`, `bg.sunken` fill, `text.secondary` text, leading icon (`square.dashed` for field, `circle.dashed` for areas, `map` for estimated). Four values only: *Your field*, *Village area*, *Wider area*, *Estimated map*; plus *Wider region* for GRACE. Trailing position in rows; top-right in chart cards.

### 9.4 Status tags

| Tag | Style | Where |
| --- | --- | --- |
| Best match to your priorities | `accent.bg` fill, `accent.text`, check icon | Top-right of one option card |
| Yours | `bg.sunken` fill, `text.secondary` | Next to the current rotation's title |
| Not known | `unknown.bg`, `unknown.text`, `questionmark.circle` | Trailing in rows; inline in sentences |
| Not asked | Dashed `unknown.border` outline, `text.secondary`, `ellipsis.circle` | Limit rows, limit checks |
| Hypothetical | `bg.sunken`, `text.primary`, slider icon, never dismissible | Top of S18 and on any pinned what-if result |
| Doesn't fit your limits | `stress.bg`, `stress`, short reason | Dimmed option card |

### 9.5 Charts (trends, per-season bars)

- Bars in `text.secondary`; highlighted year in `text.primary`; missing years as gaps with "no data" ticks, never zero-height bars.
- A trend line only when the trend test is significant, drawn 2 pt `text.primary` dashed, with the sentence above the chart.
- Axes: years at start and end only on compact; every fifth year on regular width.
- No dual axes, no 3D, no gradients.

---

## 10. Components

Each component lists **anatomy**, **variants**, **states**, **placement** and **accessibility**. iOS names in `code`; web equivalents in brackets.

### 10.1 Buttons

| Variant | Look | Use | Rule |
| --- | --- | --- | --- |
| Primary | `accent` fill, `on.accent` text, `size.button`, `radius.md`, full width on compact | The one main action on a screen (Compare options, Confirm field, Continue) | One per screen; placed in the bottom action zone (Z5) |
| Secondary | `bg.surface` fill, 1 pt `border.strong`, `text.primary` | Alternatives next to a primary (Drop a point) | Never more than two |
| Plain | Text in `accent` | Toolbar actions (Edit, Done, Cancel, Save), links | Done/Save trailing; Cancel leading |
| Destructive | Text or fill in `danger` | Delete only, inside a confirmation | Never adjacent to the primary action |

**Web implementation (repo rule).** Every button is an MUI `ButtonBase`, so every one has MUI's default touch ripple. Use the components in `components/ui/button.tsx`, never a raw `<button>` or a link styled as one: `Button` (variants `primary`, `secondary`, `quiet`, `destructive`, `link`, `choice` for toggles and options; pass `href` for navigation), `IconButton` (44 pt, always labelled), `Pressable` (free-form card or list row that needs the ripple) and `ButtonRow`. Items in a `ButtonRow` (and in the `ActionBar`) always share one width and one height, whatever their labels, and stack full width on a phone. MUI's styles sit in the `mui` cascade layer (`@layer theme, base, mui, components, utilities`, set in `app/globals.css` and emitted first by `app/providers.tsx`), so Tailwind utilities in `className` still override them.

States: default, pressed (opacity 0.8 or system highlight), loading (label replaced by spinner, width unchanged), unavailable (keep enabled where possible and explain on tap, per the restraint rule; if disabled, show the reason beneath).

### 10.2 Navigation and structure

| Component | Spec |
| --- | --- |
| Tab bar (`TabView`) [bottom nav] | 3 items: Fields, Compare, Learn. System material. Badge on Fields for total open questions |
| Sidebar (`NavigationSplitView`) [left rail, 260 px web] | Same three destinations plus area groups of fields; replaces the tab bar on regular width |
| Navigation bar | Back leading; context (field switcher) in the title area on S10; up to two trailing icon buttons |
| Large title | Tab roots only; collapses on scroll |
| Progress steps | "Step n of 4" text plus four dots under the nav bar, first run only |
| Sheet | Grabber visible; detents medium and large as specified per screen; Cancel leading, Done/Save trailing; interactive dismiss blocked when dirty |

### 10.3 Lists and rows

| Row type | Anatomy (leading → trailing) | Notes |
| --- | --- | --- |
| Navigation row | icon · title · value · chevron | Whole row tappable |
| Value row | title · value | Read-only |
| Finding row | icon · title · scale badge · chevron | Value moves to second line at large text |
| Unknown row | icon · title · *Not known* tag · chevron | Opens S14 |
| Limit row | icon · title · value or *Not asked* · chevron | Never shows a tick for unanswered |
| Field row | outline thumbnail (40 pt) · name / status line · open-question badge · chevron | Swipe: Archive, Delete |
| Check-locally row | person icon · item text | Not tappable in v1; optional checkbox in adviser mode |

Separators: hairline, inset to the text start. Group headers: `type.footnote`, `text.secondary`, 6 pt above the group.

### 10.4 Option card

```
┌──────────────────────────────────────────┐  radius.lg, bg.surface
│ B  Rice, then black gram   [Best match]  │  type.title3 · status tag (top-right)
│ Short of rain in 2 of 10 seasons,        │  type.body: the answer sentence
│ mostly in February.                      │
│ Not a forecast · past 10 seasons         │  type.footnote, text.secondary, inline (not a banner)
│ [2016][2017][2018][2019][2020]           │  season strip (2 × 5 on compact)
│ [2021][2022][2023][2024][2025]           │
│ ███████▒▒▒▒▒░░░░  rice · gram · bare     │  calendar bar + legend
└──────────────────────────────────────────┘
```

- Variants: **best match** (2 pt accent border + tag), **default**, **yours** (Yours tag), **limit fail** (content at 60% contrast but text stays ≥ 4.5:1, *Doesn't fit your limits* tag with reason; still tappable), **partial evidence** ("Missing: water use" line in `unknown.text`).
- Layers: Answer (as drawn), Reasons (adds two lines: hardest seasons and causes), Evidence (adds the source line and rainfall mix).
- Accessibility: one VoiceOver element reading title, tag, sentence and count; strip and bar are child elements reachable with the rotor.

### 10.5 Season strip

- Compact: two rows of five, full years, each ≥ 44 pt wide. Regular: one row of ten.
- Interactive only in S11 (recall). In S10 it is display-only, and the whole card is the tap target.
- Recall prompt sits directly beneath the strip (proximity); answer buttons are four equal-width secondary buttons.

### 10.6 Priority card (reorderable)

Row with rank number, icon, label, drag handle (`line.3.horizontal`). Long-press or handle-drag to move; selection haptic on snap. VoiceOver custom actions "Move up" and "Move down". Expanded state for Build the soil / Earn more shows the finer choices as an indented reorderable sub-list.

### 10.7 Inputs

- Text field: `bg.sunken`, `radius.md`, 44 pt min height, label above (not placeholder-only).
- Date: system date picker; also accepts "early/mid/late + month" through a month-part picker (Postel).
- Range input (yield, price, cost): two fields "from – to" with the unit trailing; a single value is accepted and stored as a zero-width range.
- Units: unit picker trailing (acres/hectares; basket/viss/kg) with per-crop conversion shown under the field.
- Validation: an inline message below the field in `stress` colour with a leading icon, saying what to do ("Add at least two other options"); never only a coloured border, and never `danger` red, which is reserved for deleting.

### 10.8 Map components

| Component | Placement | Spec |
| --- | --- | --- |
| Search field | Top, under the nav bar, full width minus margins | `bg.surface` solid (not glass) for legibility over imagery |
| Layers button | Top-right floating, 44 pt | Material; opens a menu of layers |
| Locate me | Bottom-right floating, above the bottom card, 44 pt | Asks permission on first tap only |
| Layer chips | Above the bottom card, horizontally scrollable, max 4 visible | Selected chip uses `accent.bg` |
| Legend row | Directly above chips | Layer name + scale badge |
| Bottom card | Bottom, sheet with small detent | Field name, one line, primary "Open field" |
| Drawing handles | On vertices | 44 pt hit area, 12 pt visual |
| Keep clear | Bottom-left corner | Map attribution/legal label lives there |

### 10.9 Charts card (trends)

Title row (trend name + scale badge), sentence, chart (120–160 pt tall on compact), axis caption, optional "How this is tested" link. The whole card is one VoiceOver element that reads the sentence, record span and trend result.

### 10.10 Slider (what-if)

System slider with stepped values (rain 5%, temperature 0.5 °C), a zero detent with haptic, and a value label trailing. Paired with the before → after list directly below (working memory). Reset in the leading toolbar.

### 10.11 Feedback

| Component | Use | Rule |
| --- | --- | --- |
| Inline notice | "Not a forecast", "Hypothetical", "Updated 3 days ago" | Part of the layout, not dismissible |
| Toast | Undo after archive; "Comparison updated" | 5 s, bottom above tab bar, with action |
| Confirmation dialog | Delete field, discard changes | System action sheet; destructive option in `danger` |
| Empty state | No fields, no comparisons | Title, one sentence, one primary button, centred in content zone |
| Loading | Remote fetch | Keep old values visible, spinner in nav bar; skeletons only on first ever load |
| Offline | No connection | Small "Offline · showing saved data from 3 Nov" line under the title |

---

## 11. Layout system

### 11.1 Grids and breakpoints

| Context | Width | Columns | Margin | Gutter | Content max width |
| --- | --- | --- | --- | --- | --- |
| iPhone compact | 320–430 pt | 4 | 16 | 12 | full |
| iPhone landscape / small iPad window | 568–700 pt | 8 | 20 | 16 | full |
| iPad regular | 700–1366 pt | 12 | 20–24 | 20 | detail column 720 |
| Web < 600 px | — | 4 | 16 | 12 | full |
| Web 600–900 px | — | 8 | 24 | 16 | full |
| Web 900–1200 px | — | 12 | 24 | 20 | 1120 |
| Web ≥ 1200 px | — | 12 | 32 | 24 | 1440 |

Regular-width columns: sidebar 260–320, list 320–375, detail flexible; web evidence panel 320 px, collapsible.

### 11.2 Screen zones (compact)

Every screen is built from the same vertical zones. Placement rules in Section 12 refer to these names.

```
┌───────────────────────────┐
│ Z0 Status bar / safe area │  system
│ Z1 Navigation bar         │  back · context · ≤2 trailing actions
│ Z2 Title + context        │  large title (tab roots) or inline title; field name; progress
│ Z3 Mode controls          │  segmented control, search, layer chips
│ Z4 Content (scrolls)      │  sentence first, then groups, then evidence
│ Z5 Action zone (sticky)   │  one primary button, or what-if entry
│ Z6 Tab bar / home ind.    │  system
└───────────────────────────┘
```

### 11.3 Thumb reach (one-handed phone use)

| Zone | Reach | What goes there |
| --- | --- | --- |
| Bottom third (Z5, lower Z4) | Easy | Primary actions, recall answers, slider, bottom card |
| Middle (Z4) | OK | Content, cards, rows |
| Top (Z1–Z3) | Hard | Navigation, infrequent actions (Edit, Share, Layers), mode switches that are set once per visit |

Destructive actions are never in the easy zone by default; they live behind swipe or a menu, then a confirmation.

### 11.4 Content order inside Z4 (every screen)

1. **The answer sentence** (what this screen tells you)
2. **The honesty line** (Not a forecast / Hypothetical / scale), inline next to what it qualifies
3. **The visual** (strip, bar, chart, map)
4. **Groups of detail**, at most about seven rows each
5. **Unknowns** (with the question that resolves them)
6. **Check locally**
7. **Evidence and sources** (or a link to them)

### 11.5 Large text and narrow widths

- At accessibility text sizes: rows stack (title above value); badges move under the title; season strip stays 2 × 5 and cells grow taller; calendar bar legend moves below the bar; toolbars move secondary actions into a More menu.
- Never truncate: option titles, answer sentences, *Not known* text, Check-locally items, warnings. Truncation is allowed only in field-name lists (middle truncation) with the full name in VoiceOver.

---

## 12. Per-screen placement

Each table lists what sits in each zone, top to bottom. Items in **bold** are placement-critical (tested in UI review).

### S01 First launch (full-screen cover)
| Zone | Content |
| --- | --- |
| Z2 | App mark, name, one-line purpose (centred, upper third) |
| Z4 | Language choice (inset group) → "What stays on this phone" → "What is sent" → Read more |
| Z5 | **Continue (primary, full width)** |

### S02 Field list
| Zone | Content |
| --- | --- |
| Z1 | Edit (leading), + Add field (trailing) |
| Z2 | Large title "Fields" |
| Z3 | Search; List / Map segmented control |
| Z4 | Area groups with totals header → field rows (thumbnail, name, status, **open-question badge**) → "Show archived" row last |
| Z5 | None (adding lives in Z1 and the empty state) |
| Z6 | Tab bar with open-question badge on Fields |

### S03 Field map
| Zone | Content |
| --- | --- |
| Z1–Z3 | Segmented control List / Map; **Layers button top-right** |
| Z4 | Map full bleed; legend row and **layer chips above the bottom card**; locate-me bottom-right; keep bottom-left clear for attribution |
| Z5 | Bottom card (field summary + Open field) |

### S04 Mark field
| Zone | Content |
| --- | --- |
| Z1 | Back · "Step 1 of 4" · Undo |
| Z3 | Place search (solid surface) |
| Z4 | Satellite map with Box and Trace outline controls; area readout in the bottom panel |
| Z5 | Draw a box or trace an outline → Continue to name the field |

### S05 Add or edit field (sheet)
| Zone | Content |
| --- | --- |
| Sheet header | Name your field · return to map |
| Content | Field name → Save field and continue. Water and soil details belong on Farm details. |

### S06 Field hub
| Zone | Content |
| --- | --- |
| Z1 | Back to Fields · More menu (Edit, Draw outline, Export, Archive, Delete) |
| Z2 | Field name and area → map snapshot linked to boundary editing |
| Z4 | Crops recorded on this field; Field options disclosure for removal |
| Z5 | Field tabs: Overview, Farm details, Crops, Conditions, Compare |

The browser implementation uses a conventional tab row for field navigation. Overview shows the map and recorded crops. Farm details, Crops, Conditions and Compare each have their own page; there is no second navigation list or progress card on Overview.

### S07 Past seasons
| Zone | Content |
| --- | --- |
| Z1 | Back · + Add season |
| Z4 | Year sections newest first; "Add a past season" row last |

### S08 Options to compare
| Zone | Content |
| --- | --- |
| Z1 | Back · "Step 3 of 4" · Next |
| Z4 | Current (A, Yours) → Alternatives B, C (D) → **max 3 suggested templates with their "why"** → Build your own |
| Z5 | Next (primary) once at least two alternatives exist; otherwise inline message above it |

### S09 Priorities and limits (sheet)
| Zone | Content |
| --- | --- |
| Sheet header | Cancel · title · Done; "Step 4 of 4" in first run |
| Content | Instruction line → 4 priority cards (expandable soil / income) → **3 quick limits** → More limits (5) |

### S10 Compare
| Zone | Content |
| --- | --- |
| Z1 | **Field switcher (title menu)** · Priorities (adjust) · Share |
| Z2 | Large title "Compare"; offline/updated line when relevant |
| Z3 | **Answer / Reasons / Evidence** segmented control |
| Z4 | Unresolved notice (if any) → **best-match card** → other alternatives → **farmer's current rotation last ("Yours")** → limit-failing cards → partial-evidence cards → switching-point sentence |
| Z5 | **What if rain were less? (secondary, sticky)** |
| Regular width | Cards become columns; year guides aligned across strips; evidence panel at ≥ 1200 px |

### S11 Option detail
| Zone | Content |
| --- | --- |
| Z1 | Back to Compare · Share |
| Z2 | Option title (title2) + tag |
| Z4 | **Why it was suggested → What it could do → season strip with recall directly under it → What we found (Water and weather; Soil; Money) → Not known rows → Check locally (last before evidence)** → Evidence link |
| Z5 | None (the recall answers sit in the easy zone when the strip is scrolled to) |

### S12 Finding detail
| Zone | Content |
| --- | --- |
| Z2 | Finding name + scale badge |
| Z4 | Sentence → per-season bars → Evidence rows (source, resolution, dates, valid share, rainfall mix) → Assumptions → Learn link |

### S13 Explain a term (sheet, medium)
| Zone | Content |
| --- | --- |
| Sheet header | Term title · Done |
| Content | Short explanation (≤ 40 words) → Read aloud → Where it comes from → "Drag up for more" |

### S14 Answer an unknown (sheet, medium)
| Zone | Content |
| --- | --- |
| Sheet header | Cancel · Save |
| Content | Question title → plain question → answer choices (full-width rows, in the easy zone) → "Helps: …" line |

### S15 Learn
| Zone | Content |
| --- | --- |
| Z2 | Large title |
| Z3 | Search |
| Z4 | Groups: Weather and water → From satellites → Crops and soil → Your data |

### S16 Share or print (sheet)
| Zone | Content |
| --- | --- |
| Sheet header | Cancel · Share |
| Content | **Report preview (ends with Check locally)** → Format → Include location (off by default) → Include Evidence page |

### S17 Long-term trends
| Zone | Content |
| --- | --- |
| Z2 | Title; **"Past change only. Not a forecast." directly under it** |
| Z4 | Chart cards: Monsoon rain → Hot days → Soil moisture → Water stored in the region → How trends are tested |

### S18 What if (sheet, large)
| Zone | Content |
| --- | --- |
| Sheet header | Reset · Done |
| Content top | **Hypothetical label (not dismissible)** |
| Content middle | Rain slider → Temperature slider |
| Content bottom (easy zone) | **Before → after list per option**, best-match change → limitation note → Pin to report |

---

## 13. Accessibility checklist (every component)

- VoiceOver: every custom element has a label that includes its meaning, not its colour ("stressed", not "orange").
- Rotor: season strips and calendar bars expose each year/segment as an element.
- Dynamic Type up to AX5 without truncation of decision text (Section 11.5).
- Contrast meets Section 2.3; Increase Contrast and Reduce Transparency honoured.
- Reduce Motion honoured (Section 7).
- Hit areas ≥ 44 pt (Section 4).
- Myanmar VoiceOver: labels localised; test with a Myanmar voice where available, otherwise ensure Read aloud on S13 works.
- Keyboard and pointer (iPad, web): full keyboard navigation in a logical order matching Section 11.4; visible focus ring in `accent`.

---

## 14. Token delivery formats

Single source: `tokens.json` (W3C Design Tokens format), generated to Swift and CSS.

```json
{
  "color": {
    "bg": {
      "canvas":  { "$type": "color", "$value": { "light": "#F4F3EE", "dark": "#121210" } },
      "surface": { "$type": "color", "$value": { "light": "#FFFFFF", "dark": "#1D1C19" } },
      "sunken":  { "$type": "color", "$value": { "light": "#ECEAE3", "dark": "#0B0B0A" } }
    },
    "text": {
      "primary":   { "$type": "color", "$value": { "light": "#1C1B18", "dark": "#F2F0EA" } },
      "secondary": { "$type": "color", "$value": { "light": "#5A5850", "dark": "#B9B6AC" } },
      "tertiary":  { "$type": "color", "$value": { "light": "#6E6C64", "dark": "#A19E94" } }
    },
    "accent":   { "$type": "color", "$value": { "light": "#0E6B4F", "dark": "#5FC9A0" } },
    "onAccent": { "$type": "color", "$value": { "light": "#FFFFFF", "dark": "#121210" } },
    "unknown": {
      "bg":     { "$type": "color", "$value": { "light": "#FBEFD5", "dark": "#3A2A0A" } },
      "text":   { "$type": "color", "$value": { "light": "#7A4A00", "dark": "#F4C66B" } },
      "border": { "$type": "color", "$value": { "light": "#B77700", "dark": "#D49A2A" } }
    },
    "stress": {
      "fg": { "$type": "color", "$value": { "light": "#9C3D12", "dark": "#F08A5B" } },
      "bg": { "$type": "color", "$value": { "light": "#F8E3D8", "dark": "#3B1E12" } }
    },
    "danger": { "$type": "color", "$value": { "light": "#B42318", "dark": "#FF7A6E" } }
  },
  "space": { "1": {"$type":"dimension","$value":"4"}, "2": {"$type":"dimension","$value":"8"}, "3": {"$type":"dimension","$value":"12"}, "4": {"$type":"dimension","$value":"16"}, "5": {"$type":"dimension","$value":"20"}, "6": {"$type":"dimension","$value":"24"}, "8": {"$type":"dimension","$value":"32"}, "10": {"$type":"dimension","$value":"40"} },
  "radius": { "sm": {"$type":"dimension","$value":"6"}, "md": {"$type":"dimension","$value":"10"}, "lg": {"$type":"dimension","$value":"14"}, "pill": {"$type":"dimension","$value":"999"} },
  "size": { "hit": {"$type":"dimension","$value":"44"}, "button": {"$type":"dimension","$value":"50"} },
  "motion": { "fast": {"$type":"duration","$value":"150ms"}, "base": {"$type":"duration","$value":"250ms"}, "reveal": {"$type":"duration","$value":"350ms"} }
}
```

**SwiftUI:** colour assets with Any/Dark appearances named as the semantic tokens (`Color("accent")`); a `FS` namespace for spacing and radii; text via `.font(.body)` etc. so Dynamic Type works.

**CSS:** custom properties on `:root` with a `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)` override; `rem` type scale; `@media (prefers-reduced-motion)` and `(prefers-contrast: more)` mapped to Sections 6–7.

```css
:root{
  --bg-canvas:#F4F3EE; --bg-surface:#FFFFFF; --bg-sunken:#ECEAE3;
  --text-primary:#1C1B18; --text-secondary:#5A5850; --text-tertiary:#6E6C64;
  --accent:#0E6B4F; --on-accent:#FFFFFF;
  --unknown-bg:#FBEFD5; --unknown-text:#7A4A00; --unknown-border:#B77700;
  --stress:#9C3D12; --stress-bg:#F8E3D8; --danger:#B42318;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px;
  --radius-md:10px; --radius-lg:14px; --hit:44px;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg-canvas:#121210; --bg-surface:#1D1C19; --bg-sunken:#0B0B0A;
  --text-primary:#F2F0EA; --text-secondary:#B9B6AC; --text-tertiary:#A19E94;
  --accent:#5FC9A0; --on-accent:#121210;
  --unknown-bg:#3A2A0A; --unknown-text:#F4C66B; --unknown-border:#D49A2A;
  --stress:#F08A5B; --stress-bg:#3B1E12; --danger:#FF7A6E;
}}
```

---

## 15. Governance

- New components need: a use that no existing component covers, anatomy, states, placement, accessibility notes, and a contrast check added to `scripts/contrast.py`.
- Any change to the data-display language (Section 9) is reviewed against the whitepaper honesty rules before merging.
- Phase 0 interviews may change colours (local meanings of green, red or amber), icons and units; record the change and the reason here.
