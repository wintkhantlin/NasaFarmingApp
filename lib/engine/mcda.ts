import type { FarmerPriorities, PriorityId } from "../types";

/**
 * Multi-criteria ranking: S(R) = sum_i w_i s_i(R), the sum of farmer priority weights times
 * normalised, evidence-based scores.
 *
 * Rules: only feasible rotations are ranked; a criterion is used only when EVERY ranked rotation has a
 * value for it (a missing value is never zero or an average); weights are renormalised over the used
 * criteria; a criterion with no spread between options is reported as "no difference"; and if the
 * farmer's top priority cannot be evaluated the result is `unresolved`. There is no probability or
 * confidence percentage.
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
}

export const CRITERIA: CriterionDef[] = [
  { id: "water-shortfall", label: "Rain shortfall against crop demand", priority: "water", direction: "lower", unit: "mm per crop", meaning: "Less shortfall between estimated crop water demand and rain" },
  { id: "soil-legume-share", label: "Legume share of crops", priority: "soil", direction: "higher", unit: "share", meaning: "More of the crops fix nitrogen" },
  { id: "soil-cover", label: "Share of the cycle with a crop in the field", priority: "soil", direction: "higher", unit: "share", meaning: "Fewer bare days" },
  { id: "income-margin", label: "Margin from your own price, yield and cost ranges", priority: "income", direction: "higher", unit: "MMK per ha per year", meaning: "Higher midpoint margin" },
  { id: "forage-slots", label: "Crops that give fodder or forage", priority: "forage", direction: "higher", unit: "count per year", meaning: "More fodder or forage crops" },
  { id: "input-nitrogen", label: "Nitrogen the crops need (library values)", priority: "lower-inputs", direction: "lower", unit: "kg N per ha per year", meaning: "Lower nitrogen demand" },
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

export interface McdaResult {
  status: "ranked" | "unresolved" | "no-priorities";
  ranking: McdaScore[];
  used: CriterionId[];
  excluded: Array<{ criterion: CriterionId; label: string; reason: "missing-evidence" | "no-priority" | "no-difference"; detail: string }>;
  /** Final weights over used criteria, summing to 1. */
  weights: Partial<Record<CriterionId, number>>;
  note: string;
}

/** Priority weights from the farmer: use given weights, else rank-order weights; normalised to sum 1. */
export function priorityWeights(p: FarmerPriorities | undefined): Partial<Record<PriorityId, number>> | null {
  if (!p || p.order.length === 0) return null;
  const hasExplicitWeights = Object.keys(p.weights).length > 0;
  const given = p.order.map((id) => p.weights[id] ?? 0);
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
  worstRegret: number;
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
 * Calculates scenario regret and minimax regret across candidate options (Section H5).
 * L(r, s) = max_j U(j, s) - U(r, s)
 * r* = argmin_r max_s L(r, s)
 */
export function minimaxRegret(
  candidates: ScenarioUtility[],
  scenarioNames: string[],
): {
  table: RegretResult[];
  bestCandidateId: string;
} {
  const maxUtility: Record<string, number> = {};
  for (const s of scenarioNames) {
    maxUtility[s] = Math.max(...candidates.map((c) => c.utilities[s] ?? 0));
  }

  const table: RegretResult[] = candidates.map((c) => {
    const regrets: Record<string, number> = {};
    let worst = 0;
    for (const s of scenarioNames) {
      const u = c.utilities[s] ?? 0;
      const reg = Math.max(0, maxUtility[s] - u);
      regrets[s] = Math.round(reg * 1000) / 1000;
      if (regrets[s] > worst) worst = regrets[s];
    }
    return {
      candidateId: c.candidateId,
      regrets,
      worstRegret: worst,
    };
  });

  table.sort((a, b) => a.worstRegret - b.worstRegret);
  return {
    table,
    bestCandidateId: table[0]?.candidateId ?? "",
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

export function rankRotations(inputs: McdaInput[], priorities: FarmerPriorities | undefined): McdaResult {
  const pw = priorityWeights(priorities);
  const empty = (status: McdaResult["status"], note: string, excluded: McdaResult["excluded"] = []): McdaResult => ({ status, ranking: [], used: [], excluded, weights: {}, note });
  if (!pw) {
    return empty("no-priorities", "Choose what matters most to you to see a ranking. Without your priorities the options are compared side by side, not ranked.");
  }
  const feasible = inputs.filter((i) => i.feasible);
  if (feasible.length < 2) return empty("unresolved", "Fewer than two options fit this field, so there is nothing to rank.");

  const excluded: McdaResult["excluded"] = [];
  const usable: Array<{ def: CriterionDef; raw: Map<string, number> }> = [];
  for (const def of CRITERIA) {
    if ((pw[def.priority] ?? 0) <= 0) {
      excluded.push({ criterion: def.id, label: def.label, reason: "no-priority", detail: "Not one of your priorities." });
      continue;
    }
    const raw = new Map<string, number>();
    let missing = 0;
    for (const r of feasible) {
      const v = r.values[def.id];
      if (v === null || v === undefined || !Number.isFinite(v)) missing++;
      else raw.set(r.rotationId, v);
    }
    if (missing > 0) {
      excluded.push({ criterion: def.id, label: def.label, reason: "missing-evidence", detail: `Not known for ${missing} of ${feasible.length} options, so it is not ranked.` });
      continue;
    }
    const vals = [...raw.values()];
    if (Math.max(...vals) - Math.min(...vals) < 1e-9) {
      excluded.push({ criterion: def.id, label: def.label, reason: "no-difference", detail: "The options do not differ on this." });
      continue;
    }
    usable.push({ def, raw });
  }

  const topPriority = priorities?.order[0];
  const topEvaluable = topPriority ? usable.some((u) => u.def.priority === topPriority) : false;
  if (usable.length === 0 || !topEvaluable) {
    return empty(
      "unresolved",
      topPriority && !topEvaluable
        ? "The evidence needed for your first priority is missing, so the options are not ranked. See what is missing below."
        : "No criterion could be evaluated for every option.",
      excluded,
    );
  }

  // weights: a priority's weight is split equally across its usable criteria, then renormalised
  const perPriority = new Map<PriorityId, number>();
  for (const u of usable) perPriority.set(u.def.priority, (perPriority.get(u.def.priority) ?? 0) + 1);
  const rawW = usable.map((u) => (pw[u.def.priority] ?? 0) / (perPriority.get(u.def.priority) as number));
  const wSum = rawW.reduce((a, b) => a + b, 0);
  const weights: Partial<Record<CriterionId, number>> = {};
  usable.forEach((u, i) => (weights[u.def.id] = rawW[i] / wSum));

  const ranking: McdaScore[] = feasible.map((r) => {
    const parts = usable.map((u) => {
      const vals = [...u.raw.values()];
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const x = ((u.raw.get(r.rotationId) as number) - lo) / (hi - lo);
      const normalised = u.def.direction === "higher" ? x : 1 - x;
      return { criterion: u.def.id, normalised, weight: weights[u.def.id] as number };
    });
    return { rotationId: r.rotationId, score: parts.reduce((s, p) => s + p.weight * p.normalised, 0), parts };
  });
  ranking.sort((a, b) => b.score - a.score);
  return {
    status: "ranked",
    ranking,
    used: usable.map((u) => u.def.id),
    excluded,
    weights,
    note: "Scores compare these options with each other on the criteria that could be evaluated for all of them. A higher score is a better match to your priorities, not a forecast.",
  };
}
