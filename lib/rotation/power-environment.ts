import type { DailyWeather } from "@/lib/nasa/power";
import type { EnvironmentSnapshot, MonthlyCondition } from "./farmer-request";
import { regionOfPoint } from "@/lib/data/regions";
import { dryZoneRainCaution, isDryZone } from "@/lib/validation/source-checks";

type MonthSample = {
  dates: Set<string>;
  temperatureSum: number;
  temperatureDays: number;
  rainfallSum: number;
  rainfallDays: number;
};

function planningMonths(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(new Date(`${endDate}T00:00:00Z`).getTime() - 86_400_000);
  const result: string[] = [];
  for (let year = start.getUTCFullYear(), month = start.getUTCMonth(); year < last.getUTCFullYear() || (year === last.getUTCFullYear() && month <= last.getUTCMonth());) {
    result.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month++;
    if (month === 12) { year++; month = 0; }
  }
  return result;
}

/** Complete historical months only. A missing POWER day never becomes zero rain or an average temperature. */
export function powerEnvironment(weather: DailyWeather, startDate: string, endDate: string, retrievedAt: string | null): EnvironmentSnapshot {
  const samples = new Map<string, MonthSample>();
  for (const [index, date] of weather.dates.entries()) {
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) continue;
    const key = date.slice(0, 7);
    const sample = samples.get(key) ?? { dates: new Set<string>(), temperatureSum: 0, temperatureDays: 0, rainfallSum: 0, rainfallDays: 0 };
    if (sample.dates.has(date)) continue;
    sample.dates.add(date);
    const temperature = weather.series.T2M?.[index];
    if (typeof temperature === "number" && Number.isFinite(temperature)) {
      sample.temperatureSum += temperature;
      sample.temperatureDays++;
    }
    const rain = weather.series.PRECTOTCORR?.[index];
    if (typeof rain === "number" && Number.isFinite(rain) && rain >= 0) {
      sample.rainfallSum += rain;
      sample.rainfallDays++;
    }
    samples.set(key, sample);
  }

  const byMonth = new Map<number, { temperatures: number[]; rainfallTotals: number[] }>();
  for (const [key, sample] of samples) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const expectedDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (sample.dates.size !== expectedDays) continue;
    const values = byMonth.get(month) ?? { temperatures: [], rainfallTotals: [] };
    if (sample.temperatureDays === expectedDays) values.temperatures.push(sample.temperatureSum / expectedDays);
    if (sample.rainfallDays === expectedDays) values.rainfallTotals.push(sample.rainfallSum);
    byMonth.set(month, values);
  }

  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const monthly: MonthlyCondition[] = planningMonths(startDate, endDate).map((month) => {
    const historical = byMonth.get(Number(month.slice(5, 7)));
    return {
      month,
      temp_c: average(historical?.temperatures ?? []),
      rain_mm: average(historical?.rainfallTotals ?? []),
      soil_moisture_anomaly: null,
    };
  });
  const sourceParts = [weather.source.dataset, "complete-month historical daily averages"];
  if (weather.dates.length) sourceParts.push(`${weather.dates[0]} to ${weather.dates.at(-1)}`);
  if (weather.source.version) sourceParts.push(`API ${weather.source.version}`);
  if (weather.source.resolution) sourceParts.push(weather.source.resolution);
  if (retrievedAt) sourceParts.push(`retrieved ${retrievedAt}`);
  const synthetic = /synthetic|demo/i.test([weather.source.dataset, weather.source.resolution, weather.source.version].join(" "));
  // Monthly rain here is POWER PRECTOTCORR, which read about half the station total in the Dry Zone (docs/validation).
  const region = Number.isFinite(weather.latitude) && Number.isFinite(weather.longitude) ? regionOfPoint([weather.longitude, weather.latitude]) : null;
  const known_biases = !synthetic && isDryZone(region) ? [dryZoneRainCaution()] : undefined;
  return {
    source: sourceParts.join(" · "), basis: synthetic ? "synthetic" : "historical_normals",
    observation_period: weather.dates.length ? { start_date: weather.dates[0], end_date: weather.dates.at(-1)! } : undefined,
    units: { temp_c: "C", rain_mm: "mm" }, spatial_resolution_km: null,
    ...(known_biases ? { known_biases } : {}), monthly,
  };
}
