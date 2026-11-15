# Validation

Evidence for the "data reliability" and "scientific defensibility" ratings. Each harness compares an input or
output of the app with independent ground data and writes a generated report. This page interprets them.

| Harness | Command | Generated report | Status |
|:--|:--|:--|:--|
| Weather: NASA POWER vs GHCN-Daily stations | `npm run validate:weather` | [WEATHER_VALIDATION.md](WEATHER_VALIDATION.md), `data/validation/power-vs-ghcn.json` | Run 2026-11-15, 2015–2024 |
| Rain: GPM IMERG vs stations | — | — | Not built: needs `EARTHDATA_TOKEN` |
| Engine backtest vs township yields | — | — | Not built |

Code: `lib/validation/` (metrics, GHCN parser, grading, report), `scripts/validation/weather.run.ts`,
tests in `tests/lib/validation-weather.test.ts`. The acceptance rules are in `ACCEPTANCE` in
`lib/validation/weather.ts` and were fixed before the first run.

## Weather findings (run of 2026-11-15)

Ground truth is NOAA GHCN-Daily. It holds only five Myanmar stations, all at airports, so these results
check the grid at five points and say nothing about the hills or the interior of the Delta.

### 1. Dry Zone rain from POWER is about half the station total (Poor)

At Mandalay, the only station with a near-complete rain record, POWER `PRECTOTCORR` monthly totals are
**51% lower** than the station (r 0.48, 43 complete months). They are 53% low in the monsoon and 63% low in the hot season.

This matters because `lib/rotation/power-environment.ts` builds the rotation engine's monthly rainfall from
`PRECTOTCORR`. In Magway and Mandalay the water balance is therefore likely to **overstate drought stress**
for sesame, pulses and other rain-fed crops. The provenance contract names IMERG as the primary rain source
and POWER as the fallback, but the rotation engine path uses POWER directly.

### 2. Temperature is usable inland, poor on the coast

| Station | Max temp | Min temp | Notes |
|:--|:--|:--|:--|
| Yangon (Delta edge) | bias −0.8 °C, usable | +1.4 °C, usable | |
| Mandalay (Dry Zone) | −0.3 °C, usable | −1.1 °C, usable | POWER cell is 276 m higher than the station |
| Myitkyina | −1.9 °C, usable | −0.4 °C, good | POWER cell is 471 m higher than the station |
| Sittwe (coast) | −2.6 °C, poor | **+5.0 °C**, poor | The cell mixes in sea surface |
| Kawthaung (coast) | −3.1 °C, poor | +2.9 °C, poor | Same |

On the coast POWER makes days too cool and nights too warm, so it misses both heat and cold stress there.

### 3. Heat-limit checks are reliable only at 35 °C in the main regions

The crop catalog flags flowering heat when the daily maximum goes above 32, 34, 35, 36 or 38 °C.

- **35 °C** (rice, maize): good at Yangon and Mandalay, which catch 84% and 70% of the hot days.
- **38 °C** (black gram, green gram, sesame, pigeon pea): **poor everywhere**. At Yangon half of the flagged days
  are false alarms. At Mandalay POWER misses 54% of the real ones.
- **32 °C** (chickpea): good at Mandalay, usable at Yangon.
- **Cold nights < 15 °C** (rice): poor at Yangon and Sittwe, usable at Mandalay.

### 4. Station records need care too

- Yangon, Sittwe and Kawthaung leave most dry days blank instead of writing 0: only 19–25% of their days
  have a rain reading. Myitkyina is at 51%. At these stations daily rain bias and false alarms cannot be
  measured, and too few months are complete to grade the monthly totals. The harness detects this
  (`wetDaysOnly`) and does not report those numbers.
- Station rain lines up best with the **previous** UTC day in POWER, at every station. The station day is a
  24-hour total read in the morning. Any daily comparison must shift by one day.

## What this changes in the app

Done (`lib/validation/source-checks.ts`, kept in step with the results file by `tests/lib/source-checks.test.ts`):

- When rain comes from POWER in Magway, comparisons carry a caution that rain shortfall is probably overstated.
  The rotation engine path (`powerEnvironment`) adds the same note.
- Heat-day counts at 36 °C and above are marked as rough.

Not done yet:

1. Use IMERG, or a bias-corrected POWER, for rotation rainfall in the Dry Zone, instead of only labelling it.
2. Lower confidence for cold-night checks and for fields within about 30 km of the coast.
3. Read `data/validation/power-vs-ghcn.json` in the provenance layer so each reading can say how well its
   source did at the nearest checked station.

## Limits of this check

- Five airport stations for a whole country. Shan State, the inner Delta and Magway have no station.
  More ground data needs Myanmar's Department of Meteorology and Hydrology (DMH) or Department of Agriculture (DoA) records.
- A station is a point and a POWER cell is about 50 km across. Part of every error is that difference in scale,
  not a fault in the product.
- Only 2015–2024. Nothing here checks SMAP, SoilGrids, prices or yields.
