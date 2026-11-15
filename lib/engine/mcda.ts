import type { FarmerPriorities, PriorityId } from "../types";
import { percentileOf } from "./rain";

/**
 * Multi-criteria ranking: S(R) = sum_i w_i s_i(R), the sum of farmer priority weights times
 * normalised, evidence-based scores.
 *
 * Rules (Section 8, v3.1): only feasible rotations are ranked. Utilities use fixed anchors (a target and a
 * limit per criterion) so that tiny differences between options are not stretched over 0 to 1; a criterion
 * with no anchor falls back to relative min-max scaling, which scores 1 for everyone when all options tie.
 * A missing value is never zero or an average: options that lack evidence on a criterion the others have are
 * set apart as a partial-evidence set, with a warning, and do not blind the comparison of the complete set.
 * Weights are renormalised over the criteria used. If the farmer's top priority cannot be evaluated, or an
 * option has no evidence at all on it, the result is `unresolved`. There is no probability or confidence
 * percentage.
 */

export type CriterionId = "water-shortfall" | "soil-legume-share" | "soil-cover" | "income-margin" | "forage-slots" | "input-nitrogen";

export interface CriterionDef {
  id: CriterionId;
  label: string;
  priority: PriorityId;
  direction: "higher" | "lower";
  unit: string;
  /** What "better" means, in words. */
  meaning: string;
  /** Fixed anchors for the utility. Income has none by default; the caller passes a regional benchmark anchor. */
  anchor?: Anchor;
}

/**
 * A utility of 1 at `target`, 0 at `limit`, linear between. These are analyst assumptions to be tuned with
 * local validation; they are listed here, in one place, so that none is hidden inside a formula.
 */
export interface Anchor {
  target: number;
  limit: number;
  scope: "analyst-assumption";
  ref: string;
}

const assumed = (target: number, limit: number, ref: string): Anchor => ({ target, limit, scope: "analyst-assumption", ref });

export const CRITERIA: CriterionDef[] = [
  { id: "water-shortfall", label: "Rain shortfall against crop demand", priority: "water", direction: "lower", unit: "mm per crop", meaning: "Less shortfall between estimated crop water demand and rain", anchor: assumed(0, 400, "No shortfall is best; 400 mm per crop means rain covers little of the season. Analyst choice, not tuned for Myanmar.") },
  { id: "soil-legume-share", label: "Legume share of crops", priority: "soil", direction: "higher", unit: "share", meaning: "More of the crops fix nitrogen", anchor: assumed(0.5, 0, "Half the crops being legumes is taken as full credit. Analyst choice.") },
  { id: "soil-cover", label: "Share of the cycle with a crop in the field", priority: "soil", direction: "higher", unit: "share", meaning: "Fewer bare days", anchor: assumed(1, 0.5, "A crop in the field all cycle is best; half the cycle or less bare scores zero. Analyst choice.") },
  { id: "income-margin", label: "Margin from your own price, yield and cost ranges", priority: "income", direction: "higher", unit: "MMK per ha per year", meaning: "Higher midpoint margin" },
  { id: "forage-slots", label: "Crops that give fodder or forage", priority: "forage", direction: "higher", unit: "count per year", meaning: "More fodder or forage crops", anchor: assumed(1, 0, "One fodder or forage crop a year is taken as full credit. Analyst choice.") },
  { id: "input-nitrogen", label: "Nitrogen the crops need (library values)", priority: "lower-inputs", direction: "lower", unit: "kg N per ha per year", meaning: "Lower nitrogen demand", anchor: assumed(0, 150, "No nitrogen need is best; 150 kg N per ha per year scores zero. Analyst choice.") },
];

export interface McdaInput {
  rotationId: string;
  feasible: boolean;
  values: Partial<Record<CriterionId, number | null>>;
}

export interface McdaScore {
  rotationId: string;
  score: number;
  /** Per-criterion normalised score 0..1 and the weight applied. */
  parts: Array<{ criterion: CriterionId; normalised: number; weight: number }>;
}

/** An option that lacks evidence the other options have. It is shown, not scored, and never imputed. */
export interface PartialCandidate {
  rotationId: string;
  missing: CriterionId[];
  /** True when it has no evidence at all on the farmer's first priority. That halts the ranking. */
  lacksTopPriority: boolean;
  warning: string;
}

export interface McdaResult {
  status: "ranked" | "unresolved" | "no-priorities";
  /** True when the farmer set no priorities and every priority was weighted equally. */
  assumedPriorities?: boolean;
  /** The complete-evidence set, best first. */
  ranking: McdaScore[];
  /** Options set apart for missing evidence. Empty when every option could be compared on every criterion. */
  partial: PartialCandidate[];
  used: CriterionId[];
  excluded: Array<{ criterion: CriterionId; label: string; reason: "missing-evidence" | "no-priority" | "no-difference"; detail: string }>;
  /** Final weights over used criteria, summing to 1. */
  weights: Partial<Record<CriterionId, number>>;
  note: string;
  /** How far the best option leads the next one, and whether that is a real lead. Only when ranked. */
  lead?: ScoreLead;
  /** The smallest change in what you care about that would put a different option first. Null when none does. */
  weightSwitch?: WeightSwitch | null;
}

/**
 * Score gaps are on a 0 to 1 scale built from analyst anchors, so a gap of a few hundredths is noise, not a
 * finding. Below TIE_MARGIN the options are "about the same". Below CLEAR_MARGIN the lead is "slight".
 * The old rule (equal at two decimals) crowned a winner on gaps of 0.006 and called 0.0049 a tie: rounding
 * boundaries decided it. A margin does not depend on where the digits happen to fall.
 */
export const TIE_MARGIN = 0.03;
export const CLEAR_MARGIN = 0.08;
/** A winner that flips when a priority's share of the weight moves by less than this is not a stable winner. */
export const FRAGILE_WEIGHT_SHIFT = 0.1;

export type LeadClass = "tie" | "slight" | "clear";

export function classifyGap(gap: number): LeadClass {
  const g = Math.abs(gap);
  return g < TIE_MARGIN - 1e-12 ? "tie" : g < CLEAR_MARGIN - 1e-12 ? "slight" : "clear";
}

/** True when two scores are too close to call one better than the other. */
export function scoresTied(a: number, b: number): boolean {
  return classifyGap(a - b) === "tie";
}

export interface ScoreLead {
  /** Best score minus second-best score; 0 when there is only one option. */
  gap: number;
  class: LeadClass;
  /** Every option within TIE_MARGIN of the best one, best first. Has one entry when the best is not tied. */
  tiedIds: string[];
}

export interface WeightSwitch {
  /** The priority whose weight, if moved, changes the first place. */
  priority: PriorityId;
  /** Its share of the total weight now, and the share at which another option draws level. */
  fromShare: number;
  toShare: number;
  direction: "more" | "less";
  /** The option that would come first beyond that point. */
  toRotationId: string;
  /** Absolute change in share needed. Smaller means a more fragile first place. */
  shift: number;
  fragile: boolean;
}

/** Priority weights from the farmer: use given weights, else rank-order weights; normalised to sum 1. */
export function priorityWeights(p: FarmerPriorities | undefined): Partial<Record<PriorityId, number>> | null {
  if (!p || p.order.length === 0) return null;
  const hasExplicitWeights = Object.keys(p.weights).length > 0;
  // A negative or non-numeric weight is not a weight: it would cancel another priority out of the total.
  const given = p.order.map((id) => {
    const w = p.weights[id];
    return typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 0;
  });
  const total = given.reduce((a, b) => a + b, 0);
  if (hasExplicitWeights && total <= 0) {
    // If all weights entered are zero, ask for priorities
    return null;
  }
  const out: Partial<Record<PriorityId, number>> = {};
  if (total > 0) p.order.forEach((id, i) => (out[id] = given[i] / total));
  else {
    // rank-sum weights: first of n gets n, last gets 1
    const n = p.order.length;
    const sum = (n * (n + 1)) / 2;
    p.order.forEach((id, i) => (out[id] = (n - i) / sum));
  }
  return out;
}

export interface ScenarioUtility {
  candidateId: string;
  utilities: Record<string, number>; // scenarioName -> utility
}

export interface RegretResult {
  candidateId: string;
  regrets: Record<string, number>; // scenarioName -> regret
  /** L_max: the regret in the worst single season. One extreme year can set this alone. */
  worstRegret: number;
  /** L_P90: the 90th-percentile regret over the seasons, to tell a chronic weakness from a one-off year. */
  p90Regret: number;
}

/**
 * Calculates utility scaled to fixed interpretable anchors instead of candidate-relative min/max (Section F).
 * e.g. for lower-is-better (withdrawal/shortfall): utility = clip((upper - val) / (upper - target), 0, 1).
 */
export function anchorUtility(value: number, target: number, limit: number, direction: "higher" | "lower"): number {
  if (direction === "lower") {
    if (limit <= target) return value <= target ? 1 : 0;
    const u = (limit - value) / (limit - target);
    return Math.max(0, Math.min(1, u));
  } else {
    if (target <= limit) return value >= target ? 1 : 0;
    const u = (value - limit) / (target - limit);
    return Math.max(0, Math.min(1, u));
  }
}

/**
 * Relative min-max scaling for a criterion with no anchors. When every option ties the range is zero and the
 * utility is 1 for all (Section 8.1 zero-variance guard), never a division by zero or a stretch of noise.
 */
export function relativeUtility(value: number, values: number[], direction: "higher" | "lower"): number {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi - lo < 1e-9) return 1;
  const x = (value - lo) / (hi - lo);
  return direction === "higher" ? x : 1 - x;
}

/** Anchor utility when the criterion has anchors, relative scaling otherwise. */
export function criterionUtility(def: CriterionDef, value: number, values: number[]): number {
  if (def.anchor) {
    const u = anchorUtility(value, def.anchor.target, def.anchor.limit, def.direction);
    // Saturation guard: if every option is beyond the anchor limit (e.g. severe drought in the Central Dry
    // Zone) all would tie at 0, so the limit is stretched to the worst option actually seen. Earlier this fell
    // back to min-max scaling, which turned a 2 mm difference between two hopeless options into 1 against 0.
    // Stretching keeps a gap proportional to its size against the target: 410 vs 412 mm stays a 0.005 gap, while
    // 420 vs 900 mm still separates clearly (0.53 against 0).
    const allSaturatedZero =
      values.length > 1 &&
      values.every((v) => anchorUtility(v, def.anchor!.target, def.anchor!.limit, def.direction) === 0);
    if (allSaturatedZero) {
      const stretched = def.direction === "lower" ? Math.max(...values) : Math.min(...values);
      return anchorUtility(value, def.anchor.target, stretched, def.direction);
    }
    return u;
  }
  return relativeUtility(value, values, def.direction);
}

/**
 * Calculates scenario regret and minimax regret across candidate options (Section 8.3).
 * L(r, s) = max_j U(j, s) - U(r, s)
 * r* = argmin_r max_s L(r, s), and L_P90(r) alongside it. The choice stays minimax (ties go to the lower P90);
 * the P90 column and `bestByP90CandidateId` let a reader see when one outlier season decides the result.
 */
export function minimaxRegret(
  candidates: ScenarioUtility[],
  scenarioNames: string[],
): {
  table: RegretResult[];
  bestCandidateId: string;
  bestByP90CandidateId: string;
  /** Scenarios every option has a utility for. Only these count. */
  scenariosUsed: string[];
  /** Scenarios dropped because at least one option has no utility for them. Never filled with zero. */
  scenariosSkipped: string[];
} {
  // A missing utility is not a utility of zero. Earlier it was read as 0, which made an option that simply was
  // not evaluated in a season look maximally regretful there (or let it win by hiding the season). Seasons the
  // options cannot all be judged on are set aside and named, in the same way the ranking drops a criterion
  // that only some options have evidence for.
  const has = (c: ScenarioUtility, s: string) => typeof c.utilities[s] === "number" && Number.isFinite(c.utilities[s]);
  const used = scenarioNames.filter((s) => candidates.length > 0 && candidates.every((c) => has(c, s)));
  const skipped = scenarioNames.filter((s) => !used.includes(s));
  const maxUtility: Record<string, number> = {};
  for (const s of used) maxUtility[s] = Math.max(...candidates.map((c) => c.utilities[s]));

  const table: RegretResult[] = candidates.map((c) => {
    const regrets: Record<string, number> = {};
    let worst = 0;
    for (const s of used) {
      const reg = Math.max(0, maxUtility[s] - c.utilities[s]);
      regrets[s] = Math.round(reg * 1000) / 1000;
      if (regrets[s] > worst) worst = regrets[s];
    }
    const p90 = percentileOf(Object.values(regrets), 0.9) ?? 0;
    return {
      candidateId: c.candidateId,
      regrets,
      worstRegret: worst,
      p90Regret: Math.round(p90 * 1000) / 1000,
    };
  });

  table.sort((a, b) => a.worstRegret - b.worstRegret || a.p90Regret - b.p90Regret);
  const byP90 = [...table].sort((a, b) => a.p90Regret - b.p90Regret || a.worstRegret - b.worstRegret);
  return {
    table,
    bestCandidateId: used.length > 0 ? (table[0]?.candidateId ?? "") : "",
    bestByP90CandidateId: used.length > 0 ? (byP90[0]?.candidateId ?? "") : "",
    scenariosUsed: used,
    scenariosSkipped: skipped,
  };
}

/**
 * Switching point analysis for two criteria between two candidates (Section F).
 */
export function switchingPoint(
  utilityA: { u1: number; u2: number },
  utilityB: { u1: number; u2: number },
): number | null {
  const diff1 = utilityA.u1 - utilityB.u1;
  const diff2 = utilityA.u2 - utilityB.u2;
  const denom = diff1 - diff2;
  if (Math.abs(denom) < 1e-9) return null;
  const w = -diff2 / denom;
  return w >= 0 && w <= 1 ? w : null;
}

/** Which criterion each finer choice is measured by. A choice missing here has no measure yet. */
export const SUB_CRITERION: Record<string, CriterionId | undefined> = {
  nitrogen: "soil-legume-share",
  erosion: "soil-cover",
  "organic-matter": undefined,
  infiltration: undefined,
  margin: "income-margin",
  "market-fit": undefined,
  "extra-income": undefined,
};

/** Finer choices the app has no measure for. Shown as "no measure yet", never counted as zero. */
export function unmeasuredSubs(p: FarmerPriorities | undefined): string[] {
  return [...(p?.soil ?? []), ...(p?.income ?? [])].filter((s) => SUB_CRITERION[s] === undefined);
}

/** Criteria a priority is narrowed to by finer choices; null means no narrowing (none chosen, or none measurable). */
function narrowed(p: FarmerPriorities | undefined, priority: PriorityId): Set<CriterionId> | null {
  const subs = priority === "soil" ? p?.soil : priority === "income" ? p?.income : undefined;
  const ids = (subs ?? []).map((s) => SUB_CRITERION[s]).filter((c): c is CriterionId => c !== undefined);
  return ids.length ? new Set(ids) : null;
}

const ALL_PRIORITIES: PriorityId[] = ["water", "soil", "income", "forage", "lower-inputs"];

export interface RankOptions {
  /** Anchors that replace or add to the defaults, e.g. a regional income benchmark. */
  anchors?: Partial<Record<CriterionId, Anchor>>;
}

const priorityOfCriterion = (id: CriterionId): PriorityId => CRITERIA.find((d) => d.id === id)?.priority ?? "water";

/**
 * Finds the smallest change to one priority's share of the weight that puts a different option first.
 * The score is linear in the weights, so this is exact, not a search: scale one priority's weight by t,
 * renormalise, and the first place changes where the best option's lead over a rival crosses zero.
 * Returns null when no change to a single priority can do it (the first place is robust to weights).
 */
export function findWeightSwitch(ranking: McdaScore[]): WeightSwitch | null {
  if (ranking.length < 2) return null;
  const top = ranking[0];
  const priorities = [...new Set(top.parts.map((p) => priorityOfCriterion(p.criterion)))];
  let best: WeightSwitch | null = null;
  for (const rival of ranking.slice(1)) {
    for (const priority of priorities) {
      let wP = 0;
      let rP = 0;
      let total = 0;
      for (const part of top.parts) {
        const other = rival.parts.find((x) => x.criterion === part.criterion);
        if (!other) continue;
        const d = part.weight * (part.normalised - other.normalised);
        total += d;
        if (priorityOfCriterion(part.criterion) === priority) {
          wP += part.weight;
          rP += d;
        }
      }
      const rO = total - rP;
      const wO = 1 - wP;
      if (wP <= 1e-9 || Math.abs(rP) < 1e-12) continue;
      const t = -rO / rP;
      if (!Number.isFinite(t) || t <= 0) continue;
      const denom = wO + t * wP;
      if (denom <= 1e-12) continue;
      const toShare = (t * wP) / denom;
      const shift = Math.abs(toShare - wP);
      if (!best || shift < best.shift) {
        best = { priority, fromShare: wP, toShare, direction: toShare > wP ? "more" : "less", toRotationId: rival.rotationId, shift, fragile: shift < FRAGILE_WEIGHT_SHIFT };
      }
    }
  }
  return best;
}

export function leadOf(ranking: McdaScore[]): ScoreLead {
  if (ranking.length < 2) return { gap: 0, class: "clear", tiedIds: ranking.map((r) => r.rotationId) };
  const gap = ranking[0].score - ranking[1].score;
  return { gap, class: classifyGap(gap), tiedIds: ranking.filter((r) => scoresTied(ranking[0].score, r.score)).map((r) => r.rotationId) };
}

export function rankRotations(inputs: McdaInput[], farmerPriorities: FarmerPriorities | undefined, opts: RankOptions = {}): McdaResult {
  const CRITERIA_IN_USE: CriterionDef[] = CRITERIA.map((d) => (opts.anchors?.[d.id] ? { ...d, anchor: opts.anchors[d.id] } : d));
  const given = priorityWeights(farmerPriorities);
  // No priorities set: weigh everything equally so there is always an answer. The result says so.
  const assumedPriorities = !given;
  const priorities: FarmerPriorities | undefined = given ? farmerPriorities : { order: ALL_PRIORITIES, weights: {} };
  const pw = given ?? priorityWeights(priorities);
  const empty = (status: McdaResult["status"], note: string, excluded: McdaResult["excluded"] = [], partial: PartialCandidate[] = []): McdaResult => ({ status, ranking: [], partial, used: [], excluded, weights: {}, note });
  if (!pw) {
    return empty("no-priorities", "Choose what matters most to you to see a ranking. Without your priorities the options are compared side by side, not ranked.");
  }
  const feasible = inputs.filter((i) => i.feasible);
  if (feasible.length < 2) return empty("unresolved", "Fewer than two options fit this field, so there is nothing to rank.");

  const valueOf = (r: McdaInput, def: CriterionDef): number | null => {
    const v = r.values[def.id];
    return v === null || v === undefined || !Number.isFinite(v) ? null : v;
  };

  const excluded: McdaResult["excluded"] = [];
  const wanted: CriterionDef[] = [];
  for (const def of CRITERIA_IN_USE) {
    const keep = narrowed(priorities, def.priority);
    if ((pw[def.priority] ?? 0) <= 0) excluded.push({ criterion: def.id, label: def.label, reason: "no-priority", detail: "Not one of your priorities." });
    else if (keep && !keep.has(def.id)) excluded.push({ criterion: def.id, label: def.label, reason: "no-priority", detail: "Not one of the finer choices you made." });
    else wanted.push(def);
  }

  // A criterion nobody has evidence for is dropped for everyone. One that only some options lack splits the options.
  const known = wanted.filter((def) => feasible.some((r) => valueOf(r, def) !== null));
  for (const def of wanted.filter((d) => !known.includes(d))) {
    excluded.push({ criterion: def.id, label: def.label, reason: "missing-evidence", detail: `Not known for any of the ${feasible.length} options, so it is not ranked.` });
  }

  const topPriority = priorities?.order[0];
  const complete = feasible.filter((r) => known.every((def) => valueOf(r, def) !== null));
  let evaluated = feasible;
  let criteria = known;
  let partial: PartialCandidate[] = [];
  if (complete.length >= 2) {
    evaluated = complete;
    const topKnown = known.filter((d) => d.priority === topPriority);
    partial = feasible
      .filter((r) => !complete.includes(r))
      .map((r) => {
        const missing = known.filter((def) => valueOf(r, def) === null);
        const lacksTopPriority = topKnown.length > 0 && topKnown.every((def) => valueOf(r, def) === null);
        return {
          rotationId: r.rotationId,
          missing: missing.map((d) => d.id),
          lacksTopPriority,
          warning: `Not ranked: no evidence yet for ${missing.map((d) => d.label.toLowerCase()).join(", ")}.`,
        };
      });
  } else {
    // Fewer than two options are complete, so there is nothing to set apart: use only what every option has.
    criteria = known.filter((def) => feasible.every((r) => valueOf(r, def) !== null));
    for (const def of known.filter((d) => !criteria.includes(d))) {
      const missing = feasible.filter((r) => valueOf(r, def) === null).length;
      excluded.push({ criterion: def.id, label: def.label, reason: "missing-evidence", detail: `Not known for ${missing} of ${feasible.length} options, so it is not ranked.` });
    }
  }

  const usable: Array<{ def: CriterionDef; raw: Map<string, number> }> = [];
  for (const def of criteria) {
    const raw = new Map<string, number>();
    for (const r of evaluated) raw.set(r.rotationId, valueOf(r, def) as number);
    const vals = [...raw.values()];
    // Anchored utilities mean something when options tie. A relative scale does not: it would hand every option 1.
    if (!def.anchor && Math.max(...vals) - Math.min(...vals) < 1e-9) {
      excluded.push({ criterion: def.id, label: def.label, reason: "no-difference", detail: "The options do not differ on this." });
      continue;
    }
    usable.push({ def, raw });
  }

  const topEvaluable = topPriority ? usable.some((u) => u.def.priority === topPriority) : false;
  if (usable.length === 0 || !topEvaluable) {
    return empty(
      "unresolved",
      topPriority && !topEvaluable
        ? "The evidence needed for your first priority is missing, so the options are not ranked. See what is missing below."
        : "No criterion could be evaluated for every option.",
      excluded,
      partial,
    );
  }
  // An option with nothing on the first priority could still be the best one: no winner is declared.
  if (partial.some((p) => p.lacksTopPriority)) {
    return empty(
      "unresolved",
      "At least one option has no evidence on your first priority, so the options are not ranked. Adding that evidence, or removing the option, would allow a ranking.",
      excluded,
      partial,
    );
  }

  // weights: a priority's weight is split equally across its usable criteria, then renormalised
  const perPriority = new Map<PriorityId, number>();
  for (const u of usable) perPriority.set(u.def.priority, (perPriority.get(u.def.priority) ?? 0) + 1);
  const rawW = usable.map((u) => (pw[u.def.priority] ?? 0) / (perPriority.get(u.def.priority) as number));
  const wSum = rawW.reduce((a, b) => a + b, 0);
  const weights: Partial<Record<CriterionId, number>> = {};
  usable.forEach((u, i) => (weights[u.def.id] = rawW[i] / wSum));

  const ranking: McdaScore[] = evaluated.map((r) => {
    const parts = usable.map((u) => {
      const normalised = criterionUtility(u.def, u.raw.get(r.rotationId) as number, [...u.raw.values()]);
      return { criterion: u.def.id, normalised, weight: weights[u.def.id] as number };
    });
    return { rotationId: r.rotationId, score: parts.reduce((sum, p) => sum + p.weight * p.normalised, 0), parts };
  });
  ranking.sort((a, b) => b.score - a.score);
  return {
    status: "ranked",
    assumedPriorities,
    ranking,
    partial,
    used: usable.map((u) => u.def.id),
    excluded,
    weights,
    lead: leadOf(ranking),
    weightSwitch: findWeightSwitch(ranking),
    note:
      "Scores compare these options with each other on the criteria that could be evaluated for all of them. A higher score is a better match to your priorities, not a forecast." +
      (partial.length > 0 ? ` ${partial.length === 1 ? "One option is" : `${partial.length} options are`} not ranked because evidence is missing; see below.` : ""),
  };
}
