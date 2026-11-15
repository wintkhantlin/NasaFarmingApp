# Farmer UX, Mobbin Patterns & Localized Copy Plan: Field Conditions & Four Geospatial Risks

**Date:** 15 November 2026  
**Author:** Agent B (Farmer UX & Copy Design Agent)  
**Standard:** `FIELD_SHIFT_CONDITIONS_GEOSPATIAL_SCREEN_PLAN.md`, `DESIGN_SYSTEM.md`, `UX.md`  

---

## 1. Screen-to-Screen User Journey

```text
Surface A: Conditions Overview (/fields/:fieldId/conditions)
  │
  ├─ Field Header (e.g. Field 4 · Ayeyarwady · Rainfed)
  ├─ Calm Decision Finding ("Most modelled rain falls in June–August")
  ├─ 3 Core Fact Rows (Rainfall, Heat days, Soil pH/texture)
  ├─ 1 Local Check Question ("Does soil stay moist after rice harvest?")
  │
  ▼ [Tap "Explore 4 field risks" or specific risk tile]
  │
Surface B: Field Risk Explorer (Embedded View / Modal Drawer)
  │
  ├─ Top Bar: ‹ Back to Conditions | Risk Explorer
  ├─ 2×2 Risk Entry Tiles (Water stress | Flood | Erosion | Heat & cold)
  ├─ Map Canvas with Farmer-Confirmed Boundary + Active Layer Footprint
  ├─ Time / Season Controls (Syncs map, legend, metric, and findings atomically)
  ├─ 3-Level Findings Bottom Sheet (Peek → Half → Full) / Desktop Side Panel
  │   ├─ Plain-language Finding & Metric
  │   ├─ What the science cannot tell yet
  │   ├─ Practical local check on your field
  │   └─ Data sources, footprint & caveats disclosure
  │
  └─ Primary CTA: [Compare crop rotations] (sends context, no fake reranking)
```

---

## 2. Text Wireframes

### Mobile (320px – 390px)
```text
┌──────────────────────────────────────────┐
│ ‹ Conditions          Risk Explorer      │
│ Field 4 · Ayeyarwady · Rainfed           │
├──────────────────────────────────────────┤
│ ┌──────────────────┐ ┌─────────────────┐ │
│ │ 💧 Water stress  │ │ 🌊 Flood        │ │
│ │ Regional context │ │ Valid scenes    │ │
│ └──────────────────┘ └─────────────────┘ │
│ ┌──────────────────┐ ┌─────────────────┐ │
│ │ ⛰️ Erosion       │ │ ☀️ Heat & cold  │ │
│ │ Slope screening  │ │ Regional power  │ │
│ └──────────────────┘ └─────────────────┘ │
├──────────────────────────────────────────┤
│ [Layer: Regional rain ▼]    [Satellite]  │
│ ┌──────────────────────────────────────┐ │
│ │             MAP VIEW                 │ │
│ │    [Confirmed Field Polygon]         │ │
│ │    [~50 km Footprint Grid Outline]   │ │
│ │                                      │ │
│ │ [Footprint: ~50 km] [Legend: Rain]   │ │
│ └──────────────────────────────────────┘ │
│ [◀]  2025 (latest valid historical year) [▶]
├──────────────────────────────────────────┤
│ ━━━ [Expand Details ▲] ━━━━━━━━━━━━━━━━━ │
│ WATER STRESS · REGIONAL CONTEXT          │
│ 2025 monsoon rain (810 mm) was 12% below │
│ the long-record average.                 │
│                                          │
│ What we cannot tell yet:                 │
│ Regional 9 km SMAP wetness is not        │
│ measured soil water on your field.       │
│                                          │
│ Local check:                             │
│ Does your soil hold moisture into sowing?│
│                                          │
│ [See data, resolution & methods ▼]       │
│ [Compare crop rotations →]               │
└──────────────────────────────────────────┘
```

### Desktop (≥1024px)
```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ ‹ Back to Conditions      Field 4 · Ayeyarwady · Rainfed        Risk Explorer │
├───────────────────────────────────────┬───────────────────────────────────────┤
│ [Water stress] [Flood] [Erosion] [Heat]│ FINDINGS PANEL                        │
│                                       │                                       │
│ Layer: [Regional rainfall ▼] [Basemap]│ WATER STRESS · REGIONAL CONTEXT       │
│ ┌───────────────────────────────────┐ │ Metric: 810 mm (2025 monsoon rain)    │
│ │                                   │ │                                       │
│ │   MAP CANVAS                      │ │ Evidence finding:                     │
│ │   Confirmed Parcel Outline        │ │ 2025 monsoon rain was 12% below       │
│ │   Active Footprint Overlay        │ │ long-term regional baseline.          │
│ │                                   │ │                                       │
│ │   [Legend]     [Footprint Scale]  │ │ What remains unknown:                 │
│ └───────────────────────────────────┘ │ Field-scale soil moisture at planting │
│ Time: [◀] 2025 [▶]  [Historical usual]│ is not measured from space.           │
│                                       │                                       │
│                                       │ Local field check:                    │
│                                       │ Check bund moisture and canal access. │
│                                       │                                       │
│                                       │ [Methods & Disclosures ▼]             │
│                                       │ [Compare crop rotations →]            │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Findings Sheet States & Mechanics

1. **Peek State (Height ~72px):**
   - Active risk title + one-line factual verdict + status pill + accessible `Expand details` button.
2. **Half State (Height ~45dvh):**
   - Quantitative metric card + finding narrative + "What remains unknown" + "Local field check".
3. **Full State (Height ~85dvh):**
   - All half-state items + complete time series/dates list + data provenance + technical resolution disclosure + `Compare crop rotations` CTA.
4. **Non-Drag Accessibility:**
   - Chevron/toggle buttons at top of sheet: `Expand details` (Enter/Space) and `Collapse details`. Never require drag gesture.

---

## 4. Grounded Plain-Language Microcopy

### Water Stress
- **Headline:** Regional rainfall history and seasonal water balance
- **Finding:** "2025 monsoon rain (810 mm) was about 12% below the long-record average."
- **Unknown:** "NASA POWER reports rainfall averaged across 50 km. Field soil water storage at planting is not known."
- **Local Check:** "Does your soil retain enough moisture after harvest, or will your next crop need supplemental canal/well irrigation?"

### Flood
- **Headline:** Satellite surface water observations
- **Finding:** "Surface water observed in valid cloud-free satellite imagery."
- **Unknown:** "Satellite images show standing water, but cannot measure flood depth, flow velocity, or whether water is intentional paddy irrigation."
- **Local Check:** "Is standing water normal for your rice fields, or does it cause crop damage and delay planting?"

### Erosion
- **Headline:** Terrain slope and soil runoff screening
- **Finding:** "Mapped median terrain slope is 2.4° (gentle slope). This provides regional runoff context."
- **Unknown:** "Topographic slope is a susceptibility screening. Actual soil loss in tonnes per hectare cannot be calculated without field bund and management records."
- **Local Check:** "Do you observe soil washing away, rill channels, or bund breaches during heavy monsoon downpours?"

### Heat & Cold
- **Headline:** Regional air temperature exceedances
- **Finding:** "2025 had 68 days reaching 35 °C or hotter between March and May."
- **Unknown:** "Daily counts above 35 °C measure single-day hot air temperatures across ~50 km, not continuous heatwaves or direct crop canopy flower damage."
- **Local Check:** "Will flowering coincide with peak pre-monsoon heat, or do cold winter nights slow vegetative growth?"

---

## 5. Myanmar Unicode Readability & Keys

- Font family: Inter, system fonts, with Burmese Unicode fallback (`Padauk`, `Noto Sans Myanmar`).
- Minimum body size: 16px to prevent clipping of complex stacked diacritics (`္`, `ွ`, `ှ`).
- Line height: minimum 1.5–1.6 for Burmese text readability in outdoor sunlight.
- Translation keys structured in `lib/copy/en.ts` and `lib/copy/my.ts` under `conditions.risks.*`.

---

## 6. WCAG 2.2 AA Compliance

1. **Touch Targets:** Minimum 44×44 CSS pixels for all tiles, timeline arrows, and sheet triggers.
2. **Color Alone:** Never use red/green alone. Every status uses words ("Ready", "Partial", "Unavailable") and distinctive icons.
3. **Contrast:** Minimum 4.5:1 text-to-background contrast in light parchment theme.
4. **Zoom:** Preserves readability and layout integrity at 200% browser zoom.
