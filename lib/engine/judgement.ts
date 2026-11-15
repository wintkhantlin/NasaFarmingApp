import type { EvaluatedOption } from "./compare";
import type { CriterionId } from "./mcda";

/**
 * Plain-language judgement helpers. They read what the engine already produced and word it for a farmer;
 * they never calculate a score and never fill a missing value.
 */

export type EvidenceLevel = "strong" | "fair" | "weak";

export const EVIDENCE_WORDS: Record<EvidenceLevel, string> = {
  strong: "Strong evidence",
  fair: "Fair evidence",
  weak: "Weak evidence",
};

export interface EvidenceAssessment {
  level: EvidenceLevel;
  label: string;
  /** Why it is not "strong", in plain words. Empty when strong. */
  reasons: string[];
}

/** Share of the past seasons that could be judged below which the weather evidence is weak. */
const WEAK_SEASON_SHARE = 0.5;
/** Share at or above which weather evidence counts as solid. */
const STRONG_SEASON_SHARE = 0.8;

/**
 * How much weight the evidence behind one option can bear, in words.
 *   Weak:   it does not fit, it was not placed, fewer than half the past seasons could be judged, or three or more
 *           things the ranking needs are missing or unconfirmed.
 *   Strong: every crop is confirmed for the place and soil, every ranking measure is known, and at least 80% of
 *           past seasons could be judged.
 *   Fair:   everything in between.
 * The cut-offs are judgement calls, listed here so none is hidden in a sentence.
 */
export function assessEvidence(
  option: Pick<EvaluatedOption, "fit" | "metrics" | "slots" | "unknowns">,
  ctx: { knownSeasons: number | null; totalSeasons: number | null; notPlaced?: boolean },
): EvidenceAssessment {
  const reasons: string[] = [];
  let gaps = 0;
  const missingMetrics = Object.values(option.metrics).filter((v) => v === null || v === undefined).length;
  if (missingMetrics > 0) {
    gaps += missingMetrics;
    reasons.push(missingMetrics === 1 ? "One thing we compare on is not known for this plan." : `${missingMetrics} things we compare on are not known for this plan.`);
  }
  const cropSlots = option.slots.filter((s) => s.slot.kind === "crop");
  const unconfirmed = cropSlots.filter((s) => !s.suitability || s.suitability.overall === "unknown").length;
  if (unconfirmed > 0) {
    gaps += unconfirmed;
    reasons.push(unconfirmed === 1 ? "One crop is not confirmed for your soil and place." : `${unconfirmed} crops are not confirmed for your soil and place.`);
  }
  const share = ctx.totalSeasons && ctx.totalSeasons > 0 && ctx.knownSeasons !== null ? ctx.knownSeasons / ctx.totalSeasons : null;
  if (share === null) reasons.push("Past weather could not be checked for this plan.");
  else if (share < STRONG_SEASON_SHARE) reasons.push(`Only ${ctx.knownSeasons} of ${ctx.totalSeasons} past seasons could be judged.`);
  if (option.fit === "does-not-fit") reasons.push("A crop is outside its range for your place.");
  if (ctx.notPlaced) reasons.push("It was set aside from the ranking for missing information.");

  const weak = option.fit === "does-not-fit" || Boolean(ctx.notPlaced) || share === null || share < WEAK_SEASON_SHARE || gaps >= 3;
  const strong = !weak && gaps === 0 && option.fit === "fits" && share !== null && share >= STRONG_SEASON_SHARE;
  const level: EvidenceLevel = weak ? "weak" : strong ? "strong" : "fair";
  return { level, label: EVIDENCE_WORDS[level], reasons: level === "strong" ? [] : reasons };
}

/** What a better or worse score on each measure means, in a farmer's words. Used as "because ...". */
export const CRITERION_PLAIN: Record<CriterionId, { better: string; worse: string }> = {
  "water-shortfall": { better: "it is less short of rain", worse: "it is more short of rain" },
  "soil-legume-share": { better: "more of its crops put nitrogen back in the soil", worse: "fewer of its crops put nitrogen back in the soil" },
  "soil-cover": { better: "a crop is growing in the field for more of the cycle", worse: "the field is bare for more of the cycle" },
  "income-margin": { better: "it may earn more per hectare", worse: "it may earn less per hectare" },
  "forage-slots": { better: "it gives more fodder", worse: "it gives less fodder" },
  "input-nitrogen": { better: "it needs less nitrogen fertiliser", worse: "it needs more nitrogen fertiliser" },
};

/** First sentence of a text, so a warning stays one sentence. */
export function firstSentence(text: string): string {
  const t = text.trim();
  const m = t.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : t).trim();
}

/** "a", "a and b", "a, b and c". */
export function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
