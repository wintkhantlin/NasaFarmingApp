---
name: NASA Farming App
description: A calm, field-readable interface that turns NASA Earth-observation data into clear decisions for farmers adapting to a changing climate.
---

> **Superseded for tokens by `DESIGN_SYSTEM.md`** (light values only; the repo stays light-only). Colours, type scale, radii and fonts in `app/globals.css` follow it. Treat the rest of this file as background.

# Design System: NASA Farming App

> Direction is proposed from the project name and the NASA Space Apps challenge "Adapting Farms with NASA Data". Tokens are implemented in `app/globals.css` (Tailwind v4 `@theme`) and mirrored in the Field Almanac design system: https://claude.ai/artifact/71qXy2Mh5EzaN9ZyfzNjtn. When a value changes, change it here and in `app/globals.css` together.

## Overview

**Creative North Star: "The Field Almanac"**

A farmer's almanac with satellite eyes. The interface speaks plainly about land, weather and timing, and uses NASA data as quiet evidence behind each recommendation rather than as spectacle. It is warm, grounded and trustworthy. It does not imitate mission control.

Decisions come first and data second. Every screen answers "what should I do on my land, and when?" before showing the maps, charts and indices that support it. Density is moderate: more generous than an analyst tool, tighter than a consumer app. It must be readable outdoors on a phone in bright sun, so contrast and tap size outrank decoration.

**Key Characteristics:**
- White-led and organic, with quiet soft-neutral sections, one confident accent and semantic colors reserved for risk and status.
- Plain-language headlines, with the data source and date always one tap away.
- Maps and charts are first-class, styled as part of the system rather than dropped in.
- Mobile-first, **light mode only**, usable in low connectivity and high glare.

## Colors

Strategy: restrained earth palette, light mode only. Warm neutrals carry most of the surface, a single deep field green is the accent, and a separate semantic set (water, heat, drought, frost) encodes data. Tailwind classes use the token name: `bg-surface`, `text-ink`, `bg-field`, `text-drought`, `border-line-strong`.

### Neutral
| Token | Value | Use |
| --- | --- | --- |
| `surface` | `#ffffff` | Clear white page canvas. |
| `surface-raised` | `#f8faf7` | Quiet soft-neutral cards, sheets and recommendation blocks. |
| `surface-sunken` | `#f0f3ee` | Inputs, chart plots and map frames. |
| `line` | `#d8ddd6` | Hairlines. Decorative only, never a control's only boundary. |
| `line-strong` | `#7f877d` | Control borders (3.5:1 on raised surfaces). |
| `ink` | `#20241f` | Graphite. Primary text (15:1 on raised surfaces). Never pure black. |
| `ink-muted` | `#4f574f` | Reasons, metadata and source lines (7.1:1 on raised surfaces). |

### Primary
| Token | Value | Use |
| --- | --- | --- |
| `field` | `#2e5e3a` | Field Green. Primary actions, active states, focus ring. A small share of any screen. |
| `field-soft` | `#dfe8d8` | Fill behind field text, the in-range band on charts. |
| `on-field` | `#ffffff` | Label on a field fill. |

### Semantic (data)
Used only for data meaning, always paired with a label or icon, never color alone. Each has a `-soft` fill for chips and bands; the strong color reads at 5:1 or better on its soft fill and on every surface.

| Token | Value | Soft | Meaning |
| --- | --- | --- | --- |
| `healthy` | `#2e5e3a` | `field-soft` | Crop in good condition, reading in range |
| `water` | `#1d5c91` | `#dce8f2` | Rainfall, soil moisture, irrigation |
| `heat` | `#a33d17` | `#f6e1d6` | Heat stress, high land temperature |
| `drought` | `#765709` | `#f1e6c8` | Dry soil, rainfall deficit |
| `frost` | `#4850a6` | `#e3e4f5` | Frost and cold risk |

### Named Rules
**The Light-Only Rule.** The app ships in light mode only. There is no dark palette and no `prefers-color-scheme` switch: `:root` sets `color-scheme: light`, the viewport sets `colorScheme: "light"`, and Tailwind's `dark:` variant is bound to a `.dark` class that is never set. Don't add `dark:` classes, dark tokens or a theme toggle. A clear white canvas with graphite text holds up best in direct sun, which is where this app is used.
**The Meaning-Only Rule.** Data hues (water, heat, drought) are never used decoratively, so a color always means something.
**The Never-Color-Alone Rule.** Every status carries text or an icon as well, for color-blind users and glare.

## Typography

**Display / Body:** Geist (already loaded via `next/font`), with system sans fallback.
**Data / Mono:** Geist Mono for readings, coordinates and units, with tabular numerals.

**Character:** Neutral, clear and sturdy. Personality comes from copy and color, not from novelty fonts.

### Hierarchy
Tailwind classes are `text-<name>`; size, line height, weight and tracking come with the class.

| Style | Font | Size / line | Weight | Use |
| --- | --- | --- | --- | --- |
| `display` | Geist | 40 / 44, -0.02em | 700 | The one answer per screen ("Irrigate Field 2 on Thursday") |
| `title` | Geist | 24 / 30, -0.01em | 650 | Screen and sheet titles |
| `headline` | Geist | 19 / 26 | 600 | Card titles, alert headings |
| `body` | Geist | 16 / 24 | 400 | Running text, never smaller on phones, `max-w-measure` (68ch) |
| `body-sm` | Geist | 14 / 20 | 400 | Secondary lines in rows and legends |
| `label` | Geist | 14 / 18 | 500 | Buttons, chips, tabs, form labels |
| `reading` | Geist Mono | 28 / 32, -0.01em | 500 | A measured value, unit attached |
| `data` | Geist Mono | 15 / 20 | 500 | Amounts and times in rows |
| `source` | Geist Mono | 12 / 16 | 400 | Dataset · resolution · pass date |
| `overline` | Geist | 13 / 18 | 500 | Small context above a headline, in sentence case and `ink-muted` (no tracked capitals) |

Mono styles add the `tabular` utility so digits line up.

## Layout

Mobile-first single column that expands to a map-plus-panel layout on larger screens. The map or chart is the hero when the task is spatial; a summary card leads when the task is a decision. Touch targets are at least 44px (`min-h-tap`). Content never relies on hover.

Spacing follows a 4px scale. Tailwind's default spacing is the same 4px scale, so use it directly; plain CSS uses the `--space-*` variables.

| Step | Value | Tailwind | Use |
| --- | --- | --- | --- |
| `space-1` | 4px | `1` | Icon-to-label gap in chips |
| `space-2` | 8px | `2` | Value to source line, tight stacks |
| `space-3` | 12px | `3` | Row padding (vertical), chip padding |
| `space-4` | 16px | `4` | Card padding and side gutter on phones |
| `space-5` | 24px | `6` | Between blocks; card padding on desktop |
| `space-6` | 32px | `8` | Between sections |
| `space-7` | 48px | `12` | Screen top to display answer on large layouts |
| `space-8` | 64px | `16` | Desktop section breaks |

## Elevation & Depth

Mostly flat, with tonal layering to separate surfaces (page, card, raised panel). Shadows are soft and appear only for floating elements such as map controls, sheets and menus.

**The Flat-By-Default Rule.** Surfaces are flat at rest; elevation signals something floating above the content. The one shadow is `shadow-float` (`0 8px 24px -12px rgb(31 29 23 / 0.35)`), for map controls, sheets and menus only.

Focus: every interactive element shows a 2px solid `field` outline with a 2px offset (set globally on `:focus-visible`).

## Shapes

Softly rounded, organic but not bubbly. Thin borders are preferred to heavy fills. Charts use rounded line joins and gentle area fills.

| Token | Value | Use |
| --- | --- | --- |
| `rounded-sm` | 6px | Inputs, legend swatches, map parcels |
| `rounded-md` | 10px | Buttons, cards, row groups |
| `rounded-lg` | 16px | Sheets, the recommendation block |
| `rounded-pill` | 999px | Risk chips and status pills only |

## Do's and Don'ts

### Do:
- **Do** lead with the recommendation, then show supporting data.
- **Do** cite the NASA dataset and the date for every figure.
- **Do** show units, uncertainty and "last updated" on all readings.
- **Do** keep AA contrast minimum and test outdoors on a phone at full brightness.
- **Do** design empty, loading and offline states.

### Don't:
- **Don't** use a neon sci-fi or mission-control look; it alienates farmers.
- **Don't** convey status by color alone.
- **Don't** bury the action under dashboards of raw indices.
- **Don't** use stock-photo tractors or generic dashboard gradients.
- **Don't** add a dark mode, `dark:` classes or a theme toggle (The Light-Only Rule).

## UX

User research, the Mobbin pattern study, the information architecture and the Today screen concept are in `UX.md`. This file covers visual design only.
