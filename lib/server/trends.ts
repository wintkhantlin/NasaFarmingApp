import { fetchPowerDaily } from "../nasa/power";
import { mannKendall, trendSentence, type TrendTest } from "../engine/trend";
import { cacheKey, serverCache } from "./cache";

export interface TrendSeries {
  key: "monsoon-rain" | "hot-days";
  title: string;
  unit: string;
  source: "NASA POWER";
  /** Badge: POWER cells are about 50 km wide. */
  scale: "wider";
  years: Array<{ year: number; value: number | null }>;
  test: TrendTest | null;
  sentence: string;
}

const START_YEAR = 1981;
const HOT_C = 35;

/** Annual series from one long POWER request. A year with under 90% of its days is left missing, not scaled up. */
export async function loadTrends(lat: number, lng: number, now = new Date()): Promise<{ trends: TrendSeries[]; through: number } | { error: string }> {
  const through = now.getUTCFullYear() - 1;
  const cache = serverCache();
  const key = cacheKey("power-trends", "v1", lat.toFixed(2), lng.toFixed(2), String(through));
  const hit = await cache.get<{ trends: TrendSeries[]; through: number }>(key);
  if (hit) return hit;
  try {
    const w = await fetchPowerDaily(
      { lat, lon: lng, start: `${START_YEAR}0101`, end: `${through}1231`, parameters: ["PRECTOTCORR", "T2M_MAX"], timeStandard: "UTC" },
      { signal: AbortSignal.timeout(60_000) },
    );
    const rain = w.series.PRECTOTCORR ?? [];
    const tmax = w.series.T2M_MAX ?? [];
    const acc = new Map<number, { rain: number; rainN: number; hot: number; hotN: number }>();
    w.dates.forEach((d, i) => {
      const y = Number(d.slice(0, 4));
      const m = Number(d.slice(5, 7));
      const a = acc.get(y) ?? { rain: 0, rainN: 0, hot: 0, hotN: 0 };
      if (m >= 6 && m <= 10 && rain[i] != null) {
        a.rain += rain[i] as number;
        a.rainN++;
      }
      if (m >= 3 && m <= 5 && tmax[i] != null) {
        a.hotN++;
        if ((tmax[i] as number) >= HOT_C) a.hot++;
      }
      acc.set(y, a);
    });
    const years = Array.from({ length: through - START_YEAR + 1 }, (_, i) => START_YEAR + i);
    const rainYears = years.map((year) => ({ year, value: (acc.get(year)?.rainN ?? 0) >= 0.9 * 153 ? Math.round(acc.get(year)!.rain) : null }));
    const hotYears = years.map((year) => ({ year, value: (acc.get(year)?.hotN ?? 0) >= 0.9 * 92 ? acc.get(year)!.hot : null }));
    const mk = (title: string, k: TrendSeries["key"], unit: string, noun: string, ys: TrendSeries["years"]): TrendSeries => {
      const test = mannKendall(ys.map((y) => y.value));
      return { key: k, title, unit, source: "NASA POWER", scale: "wider", years: ys, test, sentence: trendSentence(test, START_YEAR, noun, unit) };
    };
    const out = {
      trends: [
        mk("Monsoon rain (Jun to Oct)", "monsoon-rain", "mm", "monsoon rain", rainYears),
        mk(`Days at ${HOT_C} °C or hotter (Mar to May)`, "hot-days", "days", "hot days before the rains", hotYears),
      ],
      through,
    };
    await cache.set(key, out, 60 * 60 * 24 * 30);
    return out;
  } catch {
    return { error: "NASA POWER could not be reached, so there is no trend to show. Nothing has been filled in." };
  }
}
