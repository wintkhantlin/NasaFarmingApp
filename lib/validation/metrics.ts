/**
 * Skill scores for comparing a gridded product (model) with ground observations.
 * Pure functions: no I/O. Every function ignores pairs where either side is null or not finite.
 */

export interface Pair {
  obs: number;
  model: number;
}

export interface ContinuousScores {
  n: number;
  meanObs: number | null;
  meanModel: number | null;
  /** mean(model - obs). Positive means the product reads too high. */
  bias: number | null;
  /** bias / mean(obs). Null when mean(obs) is 0. */
  relBias: number | null;
  mae: number | null;
  rmse: number | null;
  /** Pearson correlation. Null with fewer than 3 pairs or no variance. */
  r: number | null;
}

export function cleanPairs(obs: Array<number | null>, model: Array<number | null>): Pair[] {
  if (obs.length !== model.length) throw new Error("obs and model must be the same length");
  const out: Pair[] = [];
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    const m = model[i];
    if (o === null || m === null || !Number.isFinite(o) || !Number.isFinite(m)) continue;
    out.push({ obs: o, model: m });
  }
  return out;
}

export function pearson(pairs: Pair[]): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  let so = 0;
  let sm = 0;
  for (const p of pairs) {
    so += p.obs;
    sm += p.model;
  }
  const mo = so / n;
  const mm = sm / n;
  let cov = 0;
  let vo = 0;
  let vm = 0;
  for (const p of pairs) {
    const a = p.obs - mo;
    const b = p.model - mm;
    cov += a * b;
    vo += a * a;
    vm += b * b;
  }
  if (vo === 0 || vm === 0) return null;
  return cov / Math.sqrt(vo * vm);
}

export function continuousScores(pairs: Pair[]): ContinuousScores {
  const n = pairs.length;
  if (n === 0) return { n, meanObs: null, meanModel: null, bias: null, relBias: null, mae: null, rmse: null, r: null };
  let so = 0;
  let sm = 0;
  let sa = 0;
  let ss = 0;
  for (const p of pairs) {
    const d = p.model - p.obs;
    so += p.obs;
    sm += p.model;
    sa += Math.abs(d);
    ss += d * d;
  }
  const meanObs = so / n;
  const meanModel = sm / n;
  const bias = meanModel - meanObs;
  return {
    n,
    meanObs,
    meanModel,
    bias,
    relBias: meanObs === 0 ? null : bias / meanObs,
    mae: sa / n,
    rmse: Math.sqrt(ss / n),
    r: pearson(pairs),
  };
}

export interface EventScores {
  /** Both say the event happened. */
  hits: number;
  /** Ground saw it, product did not. */
  misses: number;
  /** Product said it, ground did not. */
  falseAlarms: number;
  correctNegatives: number;
  /** Probability of detection, hits / (hits + misses). */
  pod: number | null;
  /** False alarm ratio, falseAlarms / (hits + falseAlarms). */
  far: number | null;
  /** Critical success index, hits / (hits + misses + falseAlarms). */
  csi: number | null;
  /** Frequency bias, (hits + falseAlarms) / (hits + misses). 1 is unbiased. */
  freqBias: number | null;
}

/** Scores for a yes/no event such as "wet day" or "day above the heat limit". */
export function eventScores(pairs: Pair[], isEvent: (v: number) => boolean): EventScores {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let correctNegatives = 0;
  for (const p of pairs) {
    const o = isEvent(p.obs);
    const m = isEvent(p.model);
    if (o && m) hits++;
    else if (o) misses++;
    else if (m) falseAlarms++;
    else correctNegatives++;
  }
  const ratio = (a: number, b: number) => (b === 0 ? null : a / b);
  return {
    hits,
    misses,
    falseAlarms,
    correctNegatives,
    pod: ratio(hits, hits + misses),
    far: ratio(falseAlarms, hits + falseAlarms),
    csi: ratio(hits, hits + misses + falseAlarms),
    freqBias: ratio(hits + falseAlarms, hits + misses),
  };
}

/**
 * Shift the model series by `lag` days before pairing: lag +1 compares obs[i] with model[i + 1].
 * Used to find day-boundary mismatches between station and product (UTC days vs local reading times).
 */
export function laggedPairs(obs: Array<number | null>, model: Array<number | null>, lag: number): Pair[] {
  const o: Array<number | null> = [];
  const m: Array<number | null> = [];
  for (let i = 0; i < obs.length; i++) {
    const j = i + lag;
    if (j < 0 || j >= model.length) continue;
    o.push(obs[i]);
    m.push(model[j]);
  }
  return cleanPairs(o, m);
}
