/**
 * Long-record trends. Mann-Kendall test with tie correction and Sen's slope. A trend is only
 * reported when the test is significant; otherwise the sentence says there is no clear change.
 */

export interface TrendTest {
  n: number;
  s: number;
  z: number;
  p: number;
  significant: boolean;
  /** Sen's slope per step of the series (per year for annual series). */
  slope: number;
}

const erf = (x: number) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

export const MIN_TREND_YEARS = 10;

/** Values are in time order; null entries are dropped (their year stays missing, never zero). */
export function mannKendall(values: Array<number | null>, alpha = 0.05): TrendTest | null {
  const idx: number[] = [];
  const v: number[] = [];
  values.forEach((x, i) => {
    if (x !== null && Number.isFinite(x)) {
      idx.push(i);
      v.push(x);
    }
  });
  const n = v.length;
  if (n < MIN_TREND_YEARS) return null;
  let s = 0;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      s += Math.sign(v[j] - v[i]);
      slopes.push((v[j] - v[i]) / (idx[j] - idx[i]));
    }
  }
  const counts = new Map<number, number>();
  for (const x of v) counts.set(x, (counts.get(x) ?? 0) + 1);
  let tie = 0;
  for (const t of counts.values()) tie += t * (t - 1) * (2 * t + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tie) / 18;
  const z = varS <= 0 ? 0 : s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  slopes.sort((a, b) => a - b);
  const m = slopes.length;
  const slope = m % 2 ? slopes[(m - 1) / 2] : (slopes[m / 2 - 1] + slopes[m / 2]) / 2;
  return { n, s, z, p, significant: p < alpha, slope };
}

/** Past-tense sentence. No claim about the future, and "no clear change" unless significant. */
export function trendSentence(test: TrendTest | null, since: number, noun: string, unit: string): string {
  if (!test) return "Too few years to judge a trend.";
  if (!test.significant) return `No clear change in ${noun} since ${since}.`;
  const perDecade = Math.round(test.slope * 10 * 10) / 10;
  return `${noun[0].toUpperCase()}${noun.slice(1)} ${test.slope > 0 ? "rose" : "fell"} about ${Math.abs(perDecade)} ${unit} per decade since ${since}.`;
}
