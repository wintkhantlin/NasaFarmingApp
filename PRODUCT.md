# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing codebase: Next.js 16 (App Router, Cache Components on), React 19, TypeScript, Tailwind CSS v4, bun. Field data is stored in the browser (IndexedDB) with no accounts. Data fetching runs in Next.js route handlers.

## Users

Inferred from the brief, to be confirmed with farmer and adviser interviews:

- **Farmers** (smallholder to mid-size, global) deciding what to plant next on a field. Often on a phone, outdoors, on slow connections.
- **Extension officers and farm advisers** who review options with farmers and need evidence they can cite.

## Product Purpose

Let a farmer choose a field, record the crops they grow now, and compare that rotation with at least two alternatives using NASA Earth-observation data alongside local information. For each option the app explains whether the crops fit the local seasons, soil and water, what it means for soil health and for resilience to weather and water stress, why it was suggested, and what is uncertain. Success is a farmer who understands the trade-offs and knows what to check locally before changing anything. The app supports farmer judgment and never presents its output as a decision.

## Positioning

A rotation comparison grounded in the field's own location and history: every claim shows its dataset, resolution and date, and the app says what it does not know. A generic crop-advice app or a plain weather app does not compare whole rotations or expose its evidence.

## Operating Context

- Phone first, outdoors, bright sun, patchy connectivity; also used at a desk with an adviser.
- Farmers know their land better than the data does. The tool's local information (irrigation, soil test, yields, notes) overrides modelled values.
- Satellite data arrives at different speeds: weather and soil load in seconds, SMAP and MODIS time series take minutes.

## Capabilities and Constraints

Ten required features (from the brief): farm location selection (pin, box, polygon); current rotation input with planting and harvest dates; local growing-condition analysis; comparison of the current rotation with at least two alternatives; crop suitability against seasons, soil and water; soil-health comparison; climate and water resilience comparison over historical years; recommendation explanations with evidence; risks and uncertainty; a farmer-friendly interface that makes clear the tool supports farmer judgment.

- **Coverage:** global, with a detailed crop library.
- **Map:** Mapbox GL JS (satellite-streets style) with Mapbox place search. Needs a public Mapbox token; without one, fields can still be added by typed coordinates.
- **Data stack (confirmed):** NASA POWER, SMAP, MODIS NDVI and GPM IMERG. Soil properties come from ISRIC SoilGrids and are labelled as not NASA.
- **Strategies:** the brief suggests three rotation strategies. Their content is **undecided**. The engine takes strategies as plugins and ships three clearly marked placeholders until the real three are supplied.
- **No accounts, no prices or market data, no pest forecasts** in the first version.
- **Open data facts:** the GES DISC Hydrology Data Rods service for IMERG has been discontinued, and NASA POWER's IMERG field returns no data, so IMERG needs Earthdata-authenticated access. AppEEARS (SMAP, MODIS) also needs an Earthdata login. Neither credential exists yet. See `docs/data-spikes.md`.

## Brand Commitments

Product name: NASA Farming App (working name). Visual identity is the Field Almanac system in `DESIGN.md`. NASA is cited as a data source only; the app must not use NASA logos or imply NASA endorsement.

## Evidence on Hand

- Real NASA POWER and SoilGrids responses for test sites (see `docs/data-spikes.md`).
- Mobbin pattern study in `UX.md`.
- **Absent, and must not be fabricated:** farmer interviews, real farm rotations or yields, the brief's three strategies, local crop calendars, adviser guidance, validation of the soil-health and resilience heuristics.

## Product Principles

1. **Support judgment, never replace it.** Options are suggestions to discuss; the farmer and local advisers decide.
2. **Evidence on every claim.** Dataset, resolution and date are shown with each figure.
3. **Say what we don't know.** Missing data, coarse resolution and model limits are part of the result, not footnotes.
4. **Local knowledge wins.** Anything the farmer enters overrides modelled values and is shown as theirs.
5. **Plain words first.** Answers lead with a sentence a farmer could say aloud; indices and units come second.

## Accessibility & Inclusion

Targets farmers with varied literacy, devices and connectivity: WCAG AA contrast in light mode, 44px touch targets, full keyboard operation, never colour alone for status, strings kept in one file for future translation, and cached results that open offline.
