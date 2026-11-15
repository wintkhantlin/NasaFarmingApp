/**
 * Weather validation harness: NASA POWER (as the app uses it) vs GHCN-Daily stations in Myanmar.
 *
 *   npm run validate:weather
 *
 * Runs through Vitest (vitest.validation.config.mts) so it resolves the app's TypeScript imports
 * without a separate runner. Needs network access to power.larc.nasa.gov and ncei.noaa.gov.
 * Writes data/validation/power-vs-ghcn.json and docs/validation/WEATHER_VALIDATION.md.
 *
 * Optional env: VALIDATION_START / VALIDATION_END (YYYYMMDD, default 2015-01-01 to 2024-12-31).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "vitest";
import { fetchPowerDaily } from "../../lib/nasa/power";
import { fetchWithRetry } from "../../lib/network/fetch-with-retry";
import { GHCN_ACCESS_BASE, MYANMAR_GHCN_STATIONS, parseGhcnCsv } from "../../lib/validation/ghcn";
import { renderWeatherReport, type WeatherValidationRun } from "../../lib/validation/report";
import { stationReport, type StationReport } from "../../lib/validation/weather";

const START = process.env.VALIDATION_START ?? "20150101";
const END = process.env.VALIDATION_END ?? "20241231";

async function fetchText(url: string): Promise<string> {
  const res = await fetchWithRetry(url, {}, { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 8000 });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

test(
  "validate NASA POWER against Myanmar GHCN-Daily stations",
  async () => {
    const stations: StationReport[] = [];
    for (const st of MYANMAR_GHCN_STATIONS) {
      const ghcn = parseGhcnCsv(await fetchText(`${GHCN_ACCESS_BASE}/${st.id}.csv`), st.id);
      const power = await fetchPowerDaily({
        lat: st.lat,
        lon: st.lon,
        start: START,
        end: END,
        parameters: ["T2M_MAX", "T2M_MIN", "PRECTOTCORR"],
        timeStandard: "UTC",
      });
      const rep = stationReport(st, ghcn, power);
      stations.push(rep);
      console.log(
        `${st.name}: tmax ${rep.tmax.daily.grade}, tmin ${rep.tmin.daily.grade}, monthly rain ${rep.rain.monthly.grade}`,
      );
    }

    const run: WeatherValidationRun = {
      generatedAt: new Date().toISOString(),
      product: "NASA POWER daily point (T2M_MAX, T2M_MIN, PRECTOTCORR)",
      powerTimeStandard: "UTC",
      groundTruth: `NOAA GHCN-Daily, all ${MYANMAR_GHCN_STATIONS.length} Myanmar stations, ${START.slice(0, 4)}-${START.slice(4, 6)}-${START.slice(6)} to ${END.slice(0, 4)}-${END.slice(4, 6)}-${END.slice(6)}, NCEI quality-flagged values removed`,
      stations,
    };

    const root = process.cwd();
    await mkdir(join(root, "data/validation"), { recursive: true });
    await mkdir(join(root, "docs/validation"), { recursive: true });
    await writeFile(join(root, "data/validation/power-vs-ghcn.json"), `${JSON.stringify(run, null, 2)}\n`);
    await writeFile(join(root, "docs/validation/WEATHER_VALIDATION.md"), `${renderWeatherReport(run)}\n`);
  },
  10 * 60 * 1000,
);
