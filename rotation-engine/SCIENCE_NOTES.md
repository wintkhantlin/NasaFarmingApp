# FieldShift — Crop-rotation scientific notes (research phase 1)

## The central distinction

**Crop suitability** = ecological compatibility of crop C at site X for a given period.

**Rotation suitability** = feasibility of an *ordered sequence* of crops, allowing the preceding crops to affect water, nutrients, pest populations, soil cover, management resources and timing.

A two-crop sequence must not be evaluated by summing two independent crop suitability ratings alone. Sources: USDA NRCS Part 503A and FAO's crop-sequence guidance.

## Verified crop data (FAO ECOCROP)

| Crop | Temp optimal °C | Temp absolute °C | pH optimal | pH absolute | Species-wide cycle days | Drainage descriptor |
|---|---|---|---|---|---|---|
| Rice (lowland) | 20–30 | 10–36 | 5.5–7.0 | 4.5–9.0 | 80–180 | poorly drained/wet rice system |
| Green gram | 21–36 | 8–40 | 5.5–6.2 | 4.3–8.3 | 50–120 | well-drained |
| Black gram | 22–35 | 8–40 | 5.5–6.5 | 4.5–7.5 | 60–130 | well-drained |
| Sesame | 20–30 | 10–40 | 5.5–7.5 | 4.5–8.0 | 40–180 | well-drained |
| Maize | 18–33 | 10–47 | 5.0–7.0 | 4.5–8.5 | 65–365 | well-drained |

Values transcribed from individual FAO ECOCROP data sheets, not local Myanmar varieties. ECOCROP was discontinued as a standalone database ca. 2015, though data remain accessible via FAO GAEZ. Absolute ecological envelopes are a *coarse screening rule*, not physiological death thresholds or validated exclusion at field scale. Monthly means do not capture short-term damaging extremes. ECOCROP's broad species-wide durations can include unusual varieties or production practices.

## Rotation mechanisms

1. **Different botanical families:** a cheap proxy for rotation diversity. Some pests cross plant families. This is not sufficient to guarantee pest break or disease suppression (USDA NRCS Part 503A).
2. **Legumes:** symbiotic biological nitrogen fixation is possible but depends on rhizobia, soil fertility, water and management. Harvesting legume grains removes nitrogen, so no automatic soil nitrogen increase is assigned (FAO climate-smart agriculture sourcebook).
3. **Living cover and residues:** crop growth creates an opportunity for cover; residue removal, crop calendar, canopy cover and tillage determine actual erosion benefit. A vegetated or mulched fallow is not synonymous with bare soil (USDA NRCS Part 503A).
4. **Water:** crop ET is usually estimated via `ETc = Kc * ET0` where `Kc` varies by crop and growth stage. ET is NOT the same as irrigation requirement; rainfall effectiveness, stored root-zone water, runoff, deep drainage and irrigation matter. Without these, the engine reports water adequacy as unknown (FAO 56).
5. **Farm economics:** profitability varies across years and markets. The World Bank 2019 report describes substantial price swings and margins in Myanmar pulses. Avoid importing those historical margins as current prices.

## Myanmar research context

- Lower Myanmar: green gram and black gram often follow monsoon rice. The World Bank 2019 report's Figure 24 documents seasonal windows for Sagaing, Bago, and Ayeyarwady. The figure is an example of prevalent practices, **not a universal planting calendar**.
- Upland Central Dry Zone: ACIAR documents sesame, millet/sorghum/maize and diverse legumes in sequences.
- Don't hardcode region-to-rotation mappings. Use study locations as validation samples, and use region to look up environmental data and locally verified cultivation calendars only.

## Evidence levels for future extensions

- **Documented biological possibility**: legumes can fix N (current engine).
- **Qualitative local crop-practice observation**: rice→green gram is observed in certain regions (documentation, not hard rule).
- **Model-based estimate with stated inputs**: crop water demand with sourced Kc, ET0 and weather (future).
- **Measured result**: field-level changes in soil N, pest pressure, yield and profit (needs field/literature validation).

Do not mix these evidence levels in a single percentage score and represent it as measured predictive accuracy. A heuristic priority-alignment index can only describe how much the user favors documented *features*, with coverage reported separately.

## Remaining research tasks, in priority order

1. Select actual cultivar-specific growth duration and sowing windows for three core crops at the selected farms.
2. Obtain soil pH, drainage, field history and available irrigation from farmer inputs or local datasets; report missingness.
3. Agree with modeling teammates on how to compute reliable ET0, effective rainfall, soil moisture anomalies and root-zone water. Decide the temporal/spatial coverage.
4. Find peer-reviewed rotation- or crop-specific nitrogen and pest-host evidence for the exact sequences, not generic legume assumptions.
5. If profitability matters, obtain current locally relevant farm-gate prices and input costs, clearly dated and sourced.
6. Validate a handful of model outputs with locally knowledgeable farmers or agricultural experts before presenting prescriptive recommendations.
