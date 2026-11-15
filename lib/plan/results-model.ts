import { getCropById, getRealWorldCropEconomics } from "../data/crops";
import { copy } from "../copy/en";
import type { ComparisonResult, EvaluatedOption, SlotEvaluation } from "../engine/compare";
import { REGIONAL_INCOME_BENCHMARK } from "../engine/economics";
import { assessEvidence, CRITERION_PLAIN, EVIDENCE_WORDS, capitalise, firstSentence, joinWords, type EvidenceLevel } from "../engine/judgement";
import { checkLimits } from "../engine/limits";
import { CRITERIA, findWeightSwitch, leadOf, scoresTied, type CriterionId } from "../engine/mcda";
import type { Spread } from "../engine/rain";
import { seasonStrip, knownCount, stressedCount, type StripYear } from "../engine/strip";
import { slotName } from "../rotation-format";
import type { Field, PriorityId } from "../types";
import type { ComparisonDisplay } from "./engine-display";

/**
 * Presentation model for the results page. It only re-reads what the engine already produced:
 * no score, weight, threshold or formula is calculated here. A missing value stays missing and
 * is labelled by *why* it is missing, never turned into zero or a pass.
 */

/** Why a value is not shown. The four words are used the same way everywhere on the page. */
export type MissingKind = "unknown" | "not-measured" | "not-available" | "not-applicable";

export const MISSING_WORDS: Record<MissingKind, { label: string; meaning: string }> = {
  unknown: { label: "Unknown", meaning: "We could not work this out from the information we have." },
  "not-measured": { label: "Not measured", meaning: "Nobody has measured this on your field yet. A soil test, your own yields or a local check would fill it in." },
  "not-available": { label: "Not available", meaning: "A dataset or satellite source did not supply this for your field." },
  "not-applicable": { label: "Does not apply", meaning: "This does not apply to the crops in this cycle." },
};

/** Where a shown value comes from. */
export type Basis = "estimate" | "farmer" | "library" | "plan" | "benchmark" | "mixed";

export const BASIS_WORDS: Record<Basis, string> = {
  estimate: "Estimate from past weather",
  farmer: "Entered by you",
  library: "Crop library value",
  plan: "From the crops and dates you entered",
  benchmark: "Regional benchmark",
  mixed: "Your values and regional benchmarks",
};

export interface Cell {
  text: string;
  missing?: MissingKind;
  basis?: Basis;
  /** "deficit": a negative balance. Shown with a warning icon and a stress tone, never the healthy green. */
  tone?: "deficit";
}

export interface Dimension {
  id: string;
  label: string;
  /** One sentence: what this measures. */
  measures: string;
  /** Whether a higher or lower reading is the better one. */
  better: string;
  /** Why the reading matters to a farmer. */
  matters?: string;
  /** What the comparison can and cannot say. */
  limits: string;
  cells: Record<string, Cell>;
}

export type AnalysisStatus = "complete" | "partial" | "unresolved";

export interface OptionRef {
  id: string;
  /** "What you grow now" or "Choice 1". */
  name: string;
  isYours: boolean;
  crops: string[];
  option: EvaluatedOption;
}

export interface WaterRow {
  cropName: string;
  irrigated: boolean;
  eligible: number;
  shortSeasons: number;
  demand: Spread;
  rain: Spread;
  shortfall: Spread;
  longestDry: Spread;
  stages: Array<{ label: string; heat: string; cold: string; wet: string }>;
}

export interface Contribution {
  criterion: CriterionId;
  label: string;
  value: string;
  yoursValue: string | null;
  vsYours: "better" | "similar" | "worse" | null;
}

export interface WhyModel {
  optionId: string;
  rankPlace: number | null;
  rankNote: string;
  supports: Contribution[];
  tradeOffs: Contribution[];
  similar: Contribution[];
  risks: string[];
  missing: string[];
  reason: string;
  explanations: EvaluatedOption["explanations"];
}

export interface UnknownItem {
  kind: MissingKind;
  text: string;
  where: string;
}

export interface EconomicsRow {
  crop: string;
  yieldKgHa: [number, number] | null;
  priceMmkKg: [number, number] | null;
  costMmkHa: [number, number] | null;
  marginMmkHa: [number, number] | null;
  basis: "farmer" | "benchmark" | "missing";
  source: string | null;
  missing: string[];
}

/** How firm the answer is. clear: one plan leads and holds up. close: about the same, or a slim or fragile lead. unclear: no answer yet. */
export type VerdictKind = "clear" | "close" | "unclear";

/** One option in the farmer's words: one sentence on why, one on what to watch, and how firm the evidence is. */
export interface OptionJudgement {
  optionId: string;
  /** Plain name: "What you grow now" or the crops in order. */
  name: string;
  /** One sentence. Why this plan is worth a look, or why it is placed where it is. */
  whyShort: string;
  /** One sentence. The main thing to watch out for. Never empty: a plan with no flagged risk says to check locally. */
  watchOut: string;
  evidenceLevel: EvidenceLevel;
  /** "Strong evidence", "Fair evidence" or "Weak evidence". */
  evidenceLabel: string;
  /** Why the evidence is not strong, in plain words. */
  evidenceReasons: string[];
  /** Set on the lowest-input or lowest-risk choice among those that fit. */
  roles?: Array<"low-risk" | "low-input">;
  /** A limit the farmer set that this plan breaks, in words. Null when none is known to be broken. */
  limitConflict: string | null;
}

/** The compact answer for the top of the page. Everything here is worded from engine results, nothing is recalculated. */
export interface DecisionSummary {
  verdict: VerdictKind;
  /** One sentence. */
  headline: string;
  /** The plan that leads, when there is one worth naming. Null for a tie, or when nothing can be placed. */
  winnerId: string | null;
  /** Plans within the tie margin of the first place. Two or more means "about the same". */
  tiedIds: string[];
  /** One sentence. */
  whyShort: string;
  /** One sentence. */
  watchOut: string;
  /** How firm the evidence behind the headline plan (or the whole comparison when no plan leads) is. */
  evidenceLevel: EvidenceLevel;
  evidenceLabel: string;
  /** Up to three plain sentences: what new information or different priorities would change the answer. */
  whatWouldChange: string[];
  /** The change in priorities that would put another plan first, as one sentence. Null when none does. */
  prioritySwitch: string | null;
  /** The leading plan breaks a limit the farmer set. Then the verdict is never "clear". */
  limitConflict: { optionId: string; reason: string } | null;
  /** Per option, same keys as ResultsModel.options. */
  options: Record<string, OptionJudgement>;
}

export interface ResultsModel {
  status: AnalysisStatus;
  statusTitle: string;
  statusDetail: string;
  period: string;
  priorities: Array<{ id: PriorityId; label: string }>;
  prioritiesAssumed: boolean;
  options: OptionRef[];
  dimensions: Dimension[];
  soil: Dimension[];
  water: Record<string, WaterRow[]>;
  strips: Record<string, StripYear[]>;
  regionalMoisture: { text: string; missing?: MissingKind };
  economics: Record<string, EconomicsRow[]>;
  benchmarkText: string | null;
  why: Record<string, WhyModel>;
  /** closeToNext: scores within the tie margin of the next one, so no plan is crowned on a trivial gap. */
  ranking: Array<{ optionId: string; place: number; closeToNext: boolean; /** Score lead over the next plan (0 to 1). Absent for the last. */ gapToNext?: number }>;
  sensitivity: string[];
  rankingNotes: string[];
  unknowns: UnknownItem[];
  assumptions: string[];
  /** The one-message judgement: clear / close / unclear, with why, watch-out, evidence level and what would change it. */
  decision?: DecisionSummary;
}

const MATTERS: Record<string, string> = {
  suitability: "A crop outside its range for your place or sowing dates is more likely to struggle.",
  water: "Rain that does not cover crop needs means irrigation, a lower yield, or both.",
  climate: "Heat or dry spells at sensitive stages can cut yield even when the season total looks fine.",
  soil: "Living roots and legumes help the soil between harvests.",
  nitrogen: "Nitrogen is the nutrient crops use most. Legumes can supply some of it, which can lower fertiliser spending.",
  pest: "Crops from one family often share soil pests. Back-to-back plantings let them build up.",
  erosion: "Bare soil on a slope in the rains can wash away the best topsoil.",
  economics: "Your return decides whether a change is worth the effort and risk.",
  cover: "Bare days leave soil open to sun and rain.",
  legume: "Legumes can supply part of the nitrogen the next crop needs.",
  "nitrogen-budget": "It shows whether the plan puts back roughly what grain takes out.",
  residue: "Plant material left on the field feeds soil organic matter.",
  drainage: "Waterlogged or too-dry soil limits what each crop can do.",
  carryover: "A disease that carries over can hit the next crop before it is established.",
};

const mmk = (n: number) => Math.round(n).toLocaleString();
const range = (r: [number, number], unit: string) => `${mmk(r[0])} to ${mmk(r[1])} ${unit}`;
const mm = (n: number | null) => (n === null ? "not known" : `${Math.round(n)} mm`);

/** Group of the engine's free-text unknowns into the four words. Keyword based; the engine has no structured kind. */
export function classifyUnknown(text: string): MissingKind {
  const t = text.toLowerCase();
  if (/terrain|slope|weather could not|satellite|dataset|imagery|nasa/.test(t)) return "not-available";
  if (/your yield|your soil|soil test|measure|ph\b|texture|salinity|drainage|price|cost range|yield, price/.test(t)) return "not-measured";
  if (/does not apply|not applicable/.test(t)) return "not-applicable";
  return "unknown";
}

function suitabilityCell(o: EvaluatedOption): Cell {
  const rated = o.slots.filter((s) => s.suitability);
  if (rated.length === 0) return { text: "Crop checks not run", missing: "unknown", basis: "library" };
  const count = (lvl: string) => rated.filter((s) => s.suitability?.overall === lvl).length;
  const parts = [
    count("preferred") ? `${count("preferred")} well suited` : "",
    count("tolerated") ? `${count("tolerated")} workable` : "",
    count("outside") ? `${count("outside")} outside the crop's range` : "",
    count("unknown") ? `${count("unknown")} not confirmed` : "",
  ].filter(Boolean);
  return { text: `${parts.join(" · ")} (of ${rated.length} crops)`, basis: "library" };
}

function climateCell(o: EvaluatedOption, strip: StripYear[]): Cell {
  const known = knownCount(strip);
  if (known === 0) return { text: "Past-season stress not known", missing: "not-available", basis: "estimate" };
  return { text: `${stressedCount(strip)} of ${known} past seasons short of rain or too hot`, basis: "estimate" };
}

function nitrogenCell(o: EvaluatedOption): Cell {
  const n = o.nitrogen;
  if (!n.fixedKgHa) return { text: "No legume in this cycle, so no nitrogen fixed", missing: "not-applicable", basis: "library" };
  const fixed = `Legumes fix ${Math.round(n.fixedKgHa[0])} to ${Math.round(n.fixedKgHa[1])} kg N/ha`;
  if (n.removedKgHa === null) return { text: `${fixed}. Grain removal needs your yields.`, basis: "library" };
  const balance = Math.round((n.fixedKgHa[0] + n.fixedKgHa[1]) / 2 - n.removedKgHa);
  const base = `${fixed}; grain removes about ${Math.round(n.removedKgHa)} kg N/ha`;
  if (balance < 0) return { text: `${base}. Takes about ${Math.abs(balance)} kg N/ha more than it puts back.`, basis: "library", tone: "deficit" };
  return { text: base, basis: "library" };
}

function pestCell(o: EvaluatedOption): Cell {
  if (o.slots.some((s) => s.evaluationStatus === "not-evaluated")) return { text: "Not checked: crops overlap in time", missing: "unknown", basis: "library" };
  if (o.pest.length === 0) return { text: "No back-to-back crop pair to check", missing: "not-applicable", basis: "library" };
  const shared = o.pest.filter((p) => p.shared.some((h) => h.severity === "caution")).length;
  const same = o.pest.filter((p) => p.result === "same-family").length;
  const returns = o.hostReturns.length;
  const base = `${shared} of ${o.pest.length} crop pairs share a soil pest or disease; ${same} in the same family`;
  return { text: returns > 0 ? `${base}; ${returns} host crop${returns > 1 ? "s" : ""} return too soon` : base, basis: "library" };
}

function erosionCell(o: EvaluatedOption): Cell {
  switch (o.erosion.exposure) {
    case "needs-slope-data":
      return { text: "Needs land-slope data", missing: "not-available", basis: "plan" };
    case "not-flagged":
      return { text: "Not flagged", basis: "plan" };
    case "possible":
      return { text: "Possible: bare rainy interval on a moderate slope", basis: "plan" };
    default:
      return { text: "Higher: bare rainy interval on steep ground", basis: "plan" };
  }
}

export function economicsBasis(field: Field, o: EvaluatedOption): "farmer" | "benchmark" | "mixed" {
  const cropSlots = o.economics.slots.filter((s) => s.cropId);
  const own = cropSlots.filter((s) => field.economics?.some((e) => e.cropId === s.cropId)).length;
  if (own === 0) return "benchmark";
  return own === cropSlots.length ? "farmer" : "mixed";
}

function economicsCell(field: Field, o: EvaluatedOption): Cell {
  const m = o.economics.cycleMarginMmkHa;
  if (!m) return { text: "Needs yield, price and cost ranges for every crop", missing: "not-measured" };
  return { text: `${range(m, "MMK/ha")} over the cycle`, basis: economicsBasis(field, o) };
}

function soilCoverCell(o: EvaluatedOption): Cell {
  return { text: `${Math.round(o.structure.coveredShare * 100)}% of the cycle has a crop in the field`, basis: "plan" };
}

function legumeCell(o: EvaluatedOption): Cell {
  if (o.structure.cropSlots === 0) return { text: "No crops recorded", missing: "unknown" };
  return { text: `${o.structure.legumeSlots} of ${o.structure.cropSlots} crops are legumes`, basis: "plan" };
}

function residueCell(o: EvaluatedOption): Cell {
  const m = o.mechanisms.find((x) => x.id === "cover-om");
  return m
    ? { text: "A cover or high-residue crop is in the cycle. Benefit depends on residue being left on the field.", basis: "library" }
    : { text: "No cover or residue source listed. What you do with residues is not recorded.", missing: "not-measured" };
}

function drainageCell(o: EvaluatedOption): Cell {
  const checks = o.slots.flatMap((s) => s.suitability?.checks.filter((c) => c.id === "drainage") ?? []);
  if (checks.length === 0) return { text: "Not checked", missing: "unknown" };
  if (checks.some((c) => c.level === "outside")) return { text: "Soil drainage is outside range for at least one crop", basis: "library" };
  if (checks.every((c) => c.level === "unknown")) return { text: "Soil drainage not recorded", missing: "not-measured" };
  if (checks.some((c) => c.level === "unknown")) return { text: "Drainage fits some crops; not confirmed for others", basis: "library" };
  return { text: "Soil drainage fits the crops", basis: "library" };
}

function waterCell(o: EvaluatedOption): Cell {
  const v = o.metrics["water-shortfall"];
  return v == null ? { text: "Rain shortfall not available", missing: "not-available", basis: "estimate" } : { text: `${mm(v)} short per crop in a typical past season`, basis: "estimate" };
}

function irrigationNote(slots: SlotEvaluation[]) {
  return slots.some((s) => s.irrigated);
}

function waterRows(o: EvaluatedOption): WaterRow[] {
  return o.slots
    .filter((s) => s.water && s.slot.kind === "crop")
    .map((s) => {
      const ok = (s.water?.seasons ?? []).filter((x) => x.evaluable && x.rainMm !== null && x.etcMm !== null);
      return {
        cropName: s.name,
        irrigated: s.irrigated,
        eligible: ok.length,
        shortSeasons: ok.filter((x) => (x.rainMm as number) < (x.etcMm as number)).length,
        demand: s.water!.etc,
        rain: s.water!.rain,
        shortfall: s.water!.shortfall,
        longestDry: s.rain.longestDry,
        stages: (s.exposure?.byStage ?? [])
          .filter((b) => b.seasonsWithHeat !== null || b.seasonsWithCold !== null || b.seasonsWithExcessRain !== null)
          .map((b) => {
            const word = (n: number | null) => (n === null ? "No threshold in the crop library" : `${n} of ${s.exposure!.eligibleSeasons} seasons`);
            return { label: b.label, heat: word(b.seasonsWithHeat), cold: word(b.seasonsWithCold), wet: word(b.seasonsWithExcessRain) };
          }),
      };
    });
}

const fmtMetric = (id: CriterionId, v: number | null | undefined): string => {
  if (v == null) return "not known";
  const c = CRITERIA.find((x) => x.id === id);
  if (id === "soil-legume-share" || id === "soil-cover") return `${Math.round(v * 100)}%`;
  if (id === "income-margin") return `${mmk(v)} MMK/ha/yr`;
  return `${Math.round(v * 10) / 10} ${c?.unit ?? ""}`.trim();
};

function whyFor(c: ComparisonResult, o: EvaluatedOption, display: ComparisonDisplay | null): WhyModel {
  const ranked = c.mcda.ranking.findIndex((r) => r.rotationId === o.id);
  const mine = c.mcda.ranking.find((r) => r.rotationId === o.id);
  const yours = c.mcda.ranking.find((r) => r.rotationId === c.current.id);
  const partial = c.mcda.partial.find((p) => p.rotationId === o.id);
  const contributions: Contribution[] = (mine?.parts ?? []).map((p) => {
    const def = CRITERIA.find((x) => x.id === p.criterion);
    const yoursPart = yours?.parts.find((x) => x.criterion === p.criterion);
    // "Similar" uses the same tie margin the page uses to call two scores about the same.
    const vs = !yoursPart ? null : scoresTied(p.normalised, yoursPart.normalised) ? "similar" : p.normalised > yoursPart.normalised ? "better" : "worse";
    return {
      criterion: p.criterion,
      label: def?.label ?? p.criterion,
      value: fmtMetric(p.criterion, o.metrics[p.criterion]),
      yoursValue: yoursPart ? fmtMetric(p.criterion, c.current.metrics[p.criterion]) : null,
      vsYours: vs,
    };
  });
  const item = display?.options.find((d) => d.id === o.id);
  const risks = o.risks.filter((r) => r.severity !== "info").map((r) => r.text);
  if (item?.tradeOff && !risks.includes(item.tradeOff)) risks.unshift(item.tradeOff);
  const missing = [...o.unknowns];
  if (partial) missing.unshift(partial.warning);
  return {
    optionId: o.id,
    rankPlace: ranked >= 0 ? ranked + 1 : null,
    rankNote:
      ranked >= 0
        ? "Placed using only the priorities you set and the evidence available for every option."
        : partial
          ? "Shown but not placed: it is missing information the other options have."
          : "Not placed in the order for this comparison.",
    supports: contributions.filter((x) => x.vsYours === "better"),
    tradeOffs: contributions.filter((x) => x.vsYours === "worse"),
    similar: contributions.filter((x) => x.vsYours === "similar"),
    risks: [...new Set(risks)],
    missing: [...new Set(missing)],
    reason: o.reason,
    explanations: o.explanations,
  };
}

function economicsRows(field: Field, o: EvaluatedOption): EconomicsRow[] {
  return o.economics.slots.map((s) => {
    const own = field.economics?.find((e) => e.cropId === s.cropId);
    const bench = s.cropId ? getRealWorldCropEconomics(s.cropId) : undefined;
    const e = own ?? bench;
    return {
      crop: s.name,
      yieldKgHa: e?.yieldKgHa ?? null,
      priceMmkKg: e?.priceMmkPerKg ?? null,
      costMmkHa: e?.costMmkPerHa ?? null,
      marginMmkHa: s.marginMmkHa,
      basis: own ? "farmer" : bench ? "benchmark" : "missing",
      source: s.source,
      missing: s.missing,
    };
  });
}

export function buildResultsModel(input: { field: Field; comparison: ComparisonResult; display: ComparisonDisplay; options: EvaluatedOption[] }): ResultsModel {
  const model = buildResultsModelBase(input);
  return { ...model, decision: buildDecisionSummary(input.field, input.comparison, model) };
}

function buildResultsModelBase(input: { field: Field; comparison: ComparisonResult; display: ComparisonDisplay; options: EvaluatedOption[] }): ResultsModel {
  const { field, comparison: c, display } = input;
  const alts = input.options.filter((o) => o.id !== c.current.id);
  const options: OptionRef[] = [
    { id: c.current.id, name: "What you grow now", isYours: true, crops: c.current.rotation.slots.map((s) => slotName(s)), option: c.current },
    ...alts.map((o, i) => ({ id: o.id, name: `Choice ${i + 1}`, isYours: false, crops: o.rotation.slots.map((s) => slotName(s)), option: o })),
  ];
  const all = options.map((x) => x.option);

  const yearsOf = (o: EvaluatedOption) => [...new Set(o.slots.flatMap((e) => e.water?.seasons.map((x) => x.year) ?? []))].sort();
  const strips: Record<string, StripYear[]> = Object.fromEntries(all.map((o) => [o.id, seasonStrip(o, yearsOf(o))]));
  const cells = (fn: (o: EvaluatedOption) => Cell): Record<string, Cell> => Object.fromEntries(all.map((o) => [o.id, fn(o)]));

  const dimensions: Dimension[] = [
    { id: "suitability", label: "Crop suitability", measures: "Whether each crop suits your place, sowing dates and soil, from the crop library.", better: "More crops well suited is better.", limits: "Unknown soil facts stay unknown; they never count as a pass.", cells: cells(suitabilityCell) },
    { id: "water", label: "Water requirements", measures: "How far rain fell short of what the crops would use, in past seasons.", better: "A smaller shortfall (mm) is better.", limits: "Ignores runoff, stored soil water and irrigation. It is not an irrigation amount.", cells: cells(waterCell) },
    { id: "climate", label: "Climate exposure", measures: "How many past seasons were short of rain or too hot at a sensitive stage.", better: "Fewer stressed seasons is better.", limits: "A replay of 2016 to 2025, not a forecast of next season.", cells: Object.fromEntries(all.map((o) => [o.id, climateCell(o, strips[o.id])])) },
    { id: "soil", label: "Soil health", measures: "How much of the cycle has a crop in the field, and how many crops are legumes.", better: "More cover and more legumes is better.", limits: "Describes your plan. It does not measure soil carbon or fertility.", cells: Object.fromEntries(all.map((o) => [o.id, { text: `${soilCoverCell(o).text}; ${legumeCell(o).text}`, basis: "plan" as Basis }])) },
    { id: "nitrogen", label: "Nitrogen", measures: "Nitrogen fixed by legumes against nitrogen removed in grain.", better: "More fixed and less removed is better.", limits: "A partial budget, not a measured change in soil fertility.", cells: cells(nitrogenCell) },
    { id: "pest", label: "Pest and disease risk", measures: "Whether back-to-back crops share soil-borne pests or diseases.", better: "Fewer shared pests is better.", limits: "Screened against biological host families; scout field directly to evaluate local disease pressure.", cells: cells(pestCell) },
    { id: "erosion", label: "Erosion exposure", measures: "Bare, rainy intervals on sloping ground.", better: "Not flagged is better.", limits: "A screen. It does not estimate soil loss.", cells: cells(erosionCell) },
    { id: "economics", label: "Economic performance", measures: "Estimated return after listed costs, as a range.", better: "A higher range is better, if the inputs are realistic.", limits: "Estimated range based on listed costs and market price ranges; actual farm returns vary.", cells: cells((o) => economicsCell(field, o)) },
  ];

  const soil: Dimension[] = [
    { id: "cover", label: "Soil cover", measures: "The share of the cycle with a crop in the field.", better: "More days covered is better.", limits: "Counts planned crop days only; satellite greenness is not used as bare soil.", cells: cells(soilCoverCell) },
    { id: "legume", label: "Legume contribution", measures: "How many crops can fix their own nitrogen.", better: "More legumes is better.", limits: "Fixation ranges come from the library, not from your field.", cells: cells(legumeCell) },
    { id: "nitrogen-budget", label: "Partial nitrogen budget", measures: "Nitrogen fixed by legumes against nitrogen removed in grain.", better: "More fixed than removed is better.", limits: "A partial budget only. It is not a measured change in soil fertility, and it leaves out fertiliser, losses and residues.", cells: cells(nitrogenCell) },
    { id: "residue", label: "Crop residue", measures: "Whether the cycle returns plant material to the soil.", better: "A residue or cover source is better.", limits: "Depends on what you do with residues, which is not recorded.", cells: cells(residueCell) },
    { id: "drainage", label: "Soil drainage", measures: "Whether soil drainage suits each crop.", better: "A fit with the crop is better.", limits: "Needs a drainage observation or soil test from your field.", cells: cells(drainageCell) },
    { id: "erosion", label: "Erosion exposure", measures: "Bare, rainy intervals on sloping ground.", better: "Not flagged is better.", limits: "A screen. It does not estimate soil loss.", cells: cells(erosionCell) },
    { id: "carryover", label: "Disease carryover", measures: "Soil-borne pests and diseases shared by back-to-back crops.", better: "Fewer shared hosts is better.", limits: "Crop-family rules only. Weather cannot identify a disease.", cells: cells(pestCell) },
  ];

  const smap = c.context.find((x) => /root-zone moisture/i.test(x.indicatorName));
  const regionalMoisture = smap
    ? smap.value !== null
      ? { text: `Regional modelled root-zone moisture was about ${smap.value} ${smap.units} (${smap.statistic}). This is a 9 km regional estimate, not your field's soil moisture.` }
      : { text: "Regional soil moisture is not available. Your field's starting soil moisture is unknown.", missing: "not-available" as MissingKind }
    : { text: "Regional soil moisture was not checked.", missing: "unknown" as MissingKind };

  const rankingRows = c.mcda.ranking.map((r, i) => ({
    optionId: r.rotationId,
    place: i + 1,
    // Scores inside the tie margin are "about the same". The earlier rule, equal at two decimals, depended on where
    // the digits fell: a gap of 0.006 could count as a lead and 0.004 as a tie.
    closeToNext: i < c.mcda.ranking.length - 1 && scoresTied(r.score, c.mcda.ranking[i + 1].score),
    ...(i < c.mcda.ranking.length - 1 ? { gapToNext: r.score - c.mcda.ranking[i + 1].score } : {}),
  }));
  const nameOf = (id: string) => options.find((x) => x.id === id)?.name ?? null;
  const sensitivity = c.sensitivity
    .filter((s) => s.topOptionId && nameOf(s.topOptionId))
    .map((s) => `If only "${copy.profile.priority[s.priority as PriorityId].toLowerCase()}" mattered, ${nameOf(s.topOptionId as string)} would come first.`);

  for (const d of [...dimensions, ...soil]) d.matters = MATTERS[d.id] ?? "";

  const status: AnalysisStatus = display.state === "comparable" ? "complete" : display.state === "unresolved" ? "unresolved" : "partial";
  const statusTitle = { complete: "Complete comparison", partial: "Partial evidence", unresolved: "Too close to call" }[status];
  const statusDetail =
    status === "complete"
      ? "Every option had evidence for the criteria used, so the order below is supported."
      : status === "unresolved"
        ? "We can't pick one best plan yet. There is not enough matching evidence, so look at each plan on its own."
        : "Some plans lack information the others have. We show them side by side and do not pick a winner.";

  const order = field.priorities?.order ?? [];
  const priorities = order.map((id) => ({ id, label: copy.profile.priority[id] }));

  const unknowns: UnknownItem[] = [];
  const seen = new Set<string>();
  const add = (kind: MissingKind, text: string, where: string) => {
    const key = `${kind}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    unknowns.push({ kind, text, where });
  };
  for (const g of display.gaps) add(classifyUnknown(g), g, "Data sources");
  for (const x of c.context) if (x.value === null && x.missingReason) add(x.missingReason === "missing-input" ? "not-measured" : x.missingReason === "unsupported-region" ? "not-applicable" : x.missingReason === "not-evaluable" ? "unknown" : "not-available", `${x.indicatorName}: ${x.missingReason.replace(/-/g, " ")}`, "Regional context");
  for (const o of options) for (const u of o.option.unknowns) add(classifyUnknown(u), u, o.name);
  for (const p of c.mcda.partial) add("unknown", p.warning, nameOf(p.rotationId) ?? "An option");
  for (const x of c.mcda.excluded.filter((e) => e.reason === "missing-evidence")) add("unknown", `${x.label}: ${x.detail}`, "Ranking");
  const irr = field.constraints?.irrigation?.access ?? field.irrigation;
  if (irr === "supplemental" || all.some((o) => irrigationNote(o.slots)))
    add("unknown", "How much irrigation water is applied is not measured. The rain shortfall ignores irrigation.", "Irrigation");
  add("not-measured", "Soil measurements from your field (pH, texture, organic matter) unless you entered them.", "Soil");

  const assumptions = [
    ...new Set([
      "Utility anchors used in ranking (for example 400 mm of rain shortfall scores zero) are analyst assumptions, not tuned for Myanmar.",
      ...CRITERIA.filter((x) => c.mcda.used.includes(x.id) && x.anchor).map((x) => `${x.label}: ${x.anchor!.ref}`),
      ...all.flatMap((o) => o.mechanisms.filter((m) => m.scope === "analyst-assumption").map((m) => `${m.title}: ${m.text}`)),
    ]),
  ];

  const benchmark = c.region in REGIONAL_INCOME_BENCHMARK ? REGIONAL_INCOME_BENCHMARK[c.region as keyof typeof REGIONAL_INCOME_BENCHMARK] : null;

  return {
    status,
    statusTitle,
    statusDetail,
    period: `Replay of ${c.baseline.completeYears} complete past seasons (${c.baseline.startYear} to ${c.baseline.endYear}). Not a forecast of next season.`,
    priorities,
    prioritiesAssumed: Boolean(c.mcda.assumedPriorities) || order.length === 0,
    options,
    dimensions,
    soil,
    water: Object.fromEntries(all.map((o) => [o.id, waterRows(o)])),
    strips,
    regionalMoisture,
    economics: Object.fromEntries(all.map((o) => [o.id, economicsRows(field, o)])),
    benchmarkText: benchmark ? `Usual rotation in this region: ${benchmark.label}. Income is scored against it.` : null,
    why: Object.fromEntries(alts.map((o) => [o.id, whyFor(c, o, display)])),
    ranking: rankingRows,
    sensitivity,
    rankingNotes: [c.mcda.note, ...c.mcda.excluded.filter((e) => e.reason !== "no-priority").map((e) => `${e.label}: ${e.detail}`)].filter(Boolean),
    unknowns,
    assumptions,
  };
}

/* ---------------- Judgement: clear, close or unclear ---------------- */

const pct = (share: number) => `${Math.round(share * 100)}%`;
const priorityWord = (id: PriorityId) => copy.profile.priority[id].toLowerCase();

/** Plain, distinct names for the options: "What you grow now", or the crops in order. */
function optionNames(options: OptionRef[]): Map<string, string> {
  const base = options.map((o) => (o.isYours ? "What you grow now" : plainCrops(o.crops) || o.name));
  return new Map(options.map((o, i) => [o.id, base.filter((b) => b === base[i]).length > 1 ? `${base[i]} (${o.name})` : base[i]]));
}

function buildDecisionSummary(field: Field, c: ComparisonResult, model: ResultsModel): DecisionSummary {
  const names = optionNames(model.options);
  const nameOf = (id: string) => names.get(id) ?? "This plan";
  // The verdict speaks about the plans on the page, not about options the farmer is never shown.
  const shownIds = new Set(model.options.map((o) => o.id));
  const shownRanking = c.mcda.ranking.filter((r) => shownIds.has(r.rotationId));
  const ranked = c.mcda.status === "ranked" && shownRanking.length > 0;
  const placedIds = new Set(shownRanking.map((r) => r.rotationId));
  const limitsOf = (o: OptionRef) =>
    checkLimits(o.option.rotation, field.constraints, field.irrigation, (id) => (getCropById(id)?.names.common ?? id)).filter((l) => l.result === "fail");

  // Per option: one sentence on why, one on what to watch, and how firm the evidence is.
  const options: Record<string, OptionJudgement> = {};
  for (const o of model.options) {
    const opt = o.option;
    const mine = c.mcda.ranking.find((r) => r.rotationId === opt.id);
    const yours = c.mcda.ranking.find((r) => r.rotationId === c.current.id);
    const strip = model.strips[opt.id] ?? [];
    const evidence = assessEvidence(opt, { knownSeasons: strip.length ? knownCount(strip) : null, totalSeasons: strip.length, notPlaced: ranked && !placedIds.has(opt.id) });
    const fails = limitsOf(o);
    const limitConflict = fails.length > 0 ? firstSentence(fails[0].reason ?? "It breaks a limit you set.") : null;

    // Where this option does better and worse than what the farmer grows now, in words (never for the farmer's own plan).
    const vs = (mine && yours && !o.isYours ? mine.parts : []).map((p) => {
      const y = yours?.parts.find((x) => x.criterion === p.criterion);
      return y ? { criterion: p.criterion, diff: p.normalised - y.normalised } : null;
    }).filter((x): x is { criterion: CriterionId; diff: number } => x !== null && !scoresTied(x.diff, 0));
    const better = vs.filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 2).map((x) => CRITERION_PLAIN[x.criterion].better);
    const worse = vs.filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 1).map((x) => CRITERION_PLAIN[x.criterion].worse);

    let whyShort: string;
    if (o.isYours) {
      const bestPart = [...(mine?.parts ?? [])].sort((a, b) => b.weight * b.normalised - a.weight * a.normalised)[0];
      whyShort = bestPart ? `You already grow this, and it does well because ${CRITERION_PLAIN[bestPart.criterion].better}.` : "This is what you grow now, so it is the plan to beat.";
    } else if (!mine) {
      whyShort = firstSentence(opt.reason) || "It could not be placed in the order yet.";
    } else if (better.length > 0) {
      whyShort = `Better than what you grow now because ${joinWords(better)}.`;
    } else {
      whyShort = "About the same as what you grow now on what you said matters.";
    }

    // A warning about this plan's own crops comes before one that applies to every plan (regional data limits).
    const flagged = opt.risks.filter((r) => r.severity !== "info");
    const ownRisk = flagged.find((r) => r.kind === "agronomic" && r.severity === "important") ?? flagged.find((r) => r.kind === "agronomic");
    const anyRisk = flagged.find((r) => r.severity === "important") ?? flagged[0];
    const partial = c.mcda.partial.find((p) => p.rotationId === opt.id);
    let watchOut: string;
    if (limitConflict) watchOut = limitConflict;
    // Pest text is a bare crop pair ("X follows Y, both Fabaceae"); say what it means for the field.
    else if (ownRisk) watchOut = ownRisk.id.startsWith("pest:") ? "Back-to-back crops share a plant family, so pests and disease can carry over." : firstSentence(ownRisk.text);
    else if (worse.length > 0) watchOut = `Worse than what you grow now because ${worse[0]}.`;
    else if (anyRisk) watchOut = firstSentence(anyRisk.text);
    else if (partial) watchOut = firstSentence(partial.warning);
    else if (opt.unknowns.length > 0) watchOut = `Not known yet: ${opt.unknowns[0].replace(/[.\s]+$/, "").toLowerCase()}.`;
    else watchOut = "Nothing major was flagged, but check water and soil on your own land.";

    options[opt.id] = {
      optionId: opt.id,
      name: nameOf(opt.id),
      whyShort,
      watchOut,
      evidenceLevel: evidence.level,
      evidenceLabel: evidence.label,
      evidenceReasons: evidence.reasons,
      ...(opt.roles?.length ? { roles: opt.roles } : {}),
      limitConflict,
    };
  }

  const lead = ranked ? leadOf(shownRanking) : undefined;
  const tiedIds = ranked ? (lead?.tiedIds ?? []) : [];
  const first = ranked ? shownRanking[0].rotationId : null;
  const second = ranked && shownRanking.length > 1 ? shownRanking[1].rotationId : null;
  const isTie = tiedIds.length >= 2;
  const switchTo = ranked ? findWeightSwitch(shownRanking) : null;
  const fragile = Boolean(switchTo?.fragile);
  const firstJudgement = first ? options[first] : undefined;
  const blocked = firstJudgement?.limitConflict && first ? { optionId: first, reason: firstJudgement.limitConflict } : null;

  // The verdict is only as firm as its weakest part: placement, the size of the lead, how it holds up when your
  // priorities move a little, the evidence behind it, and whether it breaks a limit you set.
  let verdict: VerdictKind;
  if (!ranked || model.status !== "complete" || blocked) verdict = "unclear";
  else if (isTie || lead?.class !== "clear" || fragile || firstJudgement?.evidenceLevel === "weak") verdict = "close";
  else verdict = "clear";

  let headline: string;
  if (blocked && first) headline = `${nameOf(first)} ranks first, but it breaks a limit you set.`;
  else if (!ranked || model.status !== "complete") headline = "We can't pick one best plan yet.";
  else if (isTie) headline = tiedIds.length <= 3 ? `${capitalise(joinWords(tiedIds.map((id, i) => (i > 0 && id === c.current.id ? "what you grow now" : nameOf(id)))))} come out about the same.` : `${tiedIds.length} plans come out about the same.`;
  else if (verdict === "close" && first && second) headline = `${nameOf(first)} is slightly ahead of ${nameOf(second)}, but it is close.`;
  else headline = first === c.current.id ? "What you grow now is still the best match for what you said matters." : `${nameOf(first as string)} is the best match for what you said matters.`;

  let whyShort: string;
  if (verdict === "unclear") whyShort = blocked ? `The plan ranked first does not fit a limit you set: ${blocked.reason.replace(/[.\s]+$/, "").toLowerCase()}.` : firstSentence(model.statusDetail);
  else if (isTie) whyShort = "The difference between them is smaller than these estimates can tell apart.";
  else whyShort = firstJudgement?.whyShort ?? "";

  const watchOut = blocked ? blocked.reason : verdict === "unclear" ? firstSentence(model.unknowns[0]?.text ?? "Check water and soil on your own land before you change crops.") : (firstJudgement?.watchOut ?? "Check water and soil on your own land before you change crops.");

  // What would change the answer.
  const change: string[] = [];
  let prioritySwitch: string | null = null;
  if (switchTo && switchTo.shift <= 0.5) {
    prioritySwitch = `If "${priorityWord(switchTo.priority)}" counted for ${pct(switchTo.toShare)} of what you want instead of ${pct(switchTo.fromShare)}, ${nameOf(switchTo.toRotationId)} would come first.`;
    change.push(prioritySwitch);
  } else if (ranked && !switchTo && !isTie) {
    change.push("Moving how much each of your priorities counts would not change the first place.");
  }
  if (model.prioritiesAssumed) change.push("You did not choose what matters most, so every priority counted equally. Choosing one could change the order.");
  const lead2 = [first, second].filter((x): x is string => Boolean(x)).map((id) => model.options.find((o) => o.id === id)).filter((x): x is OptionRef => Boolean(x));
  const needsYieldNumbers = c.mcda.used.includes("income-margin") && lead2.some((o) => economicsBasis(field, o.option) !== "farmer");
  if (needsYieldNumbers && (isTie || verdict === "close")) change.push("Your own yield, price and cost numbers could separate them; income now uses regional benchmarks.");
  const soilUnsure = lead2.find((o) => o.option.slots.some((sl) => sl.slot.kind === "crop" && (!sl.suitability || sl.suitability.overall === "unknown")));
  if (soilUnsure) change.push(`A soil test (pH and texture) would show whether ${nameOf(soilUnsure.id)} suits your soil.`);
  const unplaced = c.mcda.partial.map((p) => p.rotationId).filter((id) => shownIds.has(id));
  if (unplaced.length > 0) change.push(`Filling in the missing information for ${joinWords(unplaced.slice(0, 2).map(nameOf))} would let ${unplaced.length === 1 ? "it" : "them"} be placed.`);
  if (blocked) change.push("If the limit you set can be met, this plan could stand as the best match.");
  if (change.length === 0) change.push("New weather data or different priorities are the main things that could change this.");

  const evidenceRef = firstJudgement ?? Object.values(options)[0];
  const evidenceLevel: EvidenceLevel = verdict === "unclear" && !firstJudgement ? "weak" : (evidenceRef?.evidenceLevel ?? "weak");
  return {
    verdict,
    headline,
    winnerId: ranked && !isTie && first ? first : null,
    tiedIds: isTie ? tiedIds : [],
    whyShort,
    watchOut,
    evidenceLevel,
    evidenceLabel: EVIDENCE_WORDS[evidenceLevel],
    whatWouldChange: change.slice(0, 3),
    prioritySwitch,
    limitConflict: blocked,
    options,
  };
}

/* ---------------- The one-message verdict ---------------- */

export interface VerdictRow {
  optionId: string;
  /** Plain name: "What you grow now" or the crops in order, "Groundnut then Green gram". */
  name: string;
  isYours: boolean;
  /** Past seasons with no rain or heat stress, out of the seasons that could be checked. */
  good: number | null;
  known: number | null;
  goodText: string;
  /** Typical rain shortfall per crop, in mm. */
  gapMm: number | null;
  gapText: string;
  /** Estimated return after listed costs, per hectare over the cycle. */
  income: [number, number] | null;
  incomeText: string;
}

export interface VerdictEvidence {
  kind: "safety" | "water" | "income" | "nitrogen";
  text: string;
}

export interface Verdict {
  /** What we found, in one sentence. */
  headline: string;
  /** The trade-off that decides it, when there is one. */
  detail: string | null;
  /** Lines with numbers. Missing values say "not known"; a line with no data at all is left out. */
  evidence: VerdictEvidence[];
  /** One honest warning: every plan struggles, or information is missing. */
  caution: string | null;
  nextStep: string;
  rows: VerdictRow[];
  /** Every plan was short of rain or too hot in at least half of the past seasons. */
  allStressed: boolean;
  /** Clear / close / unclear with why, watch-out, evidence level and what would change it. Absent on hand-built models. */
  decision?: DecisionSummary;
}

const NOT_KNOWN = "Not known";

/** 3790000 -> "3.79M". Smaller values keep their digits. */
function millions(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${+(n / 1_000_000).toFixed(2)}M`;
  return mmk(n);
}

function plainCrops(crops: string[]): string {
  return crops.map((c) => c.replace(/\s*\(.*\)\s*$/, "")).filter(Boolean).join(" then ");
}

function verdictRows(model: ResultsModel): VerdictRow[] {
  const shown = model.options.filter((o) => !(o.isYours && o.crops.length === 0));
  const base = shown.map((o) => (o.isYours ? "What you grow now" : plainCrops(o.crops) || o.name));
  return shown.map((o, i) => {
    const strip = model.strips[o.id] ?? [];
    const known = knownCount(strip);
    const good = known > 0 ? known - stressedCount(strip) : null;
    const gap = o.option.metrics["water-shortfall"];
    const income = o.option.economics.cycleMarginMmkHa ?? null;
    // Two plans can have the same crops in a different order or timing; keep their names apart.
    const name = base.filter((b) => b === base[i]).length > 1 ? `${base[i]} (${o.name})` : base[i];
    return {
      optionId: o.id,
      name,
      isYours: o.isYours,
      good,
      known: known > 0 ? known : null,
      goodText: good === null ? NOT_KNOWN : `${good} of ${known}`,
      gapMm: gap == null ? null : Math.round(gap),
      gapText: gap == null ? NOT_KNOWN : `${Math.round(gap)} mm`,
      income,
      incomeText: income ? `${millions(income[0])} to ${millions(income[1])}` : NOT_KNOWN,
    };
  });
}

const goodShare = (r: VerdictRow) => (r.good === null || !r.known ? null : r.good / r.known);
const incomeMid = (r: VerdictRow) => (r.income ? (r.income[0] + r.income[1]) / 2 : null);

/**
 * Turns the numbers the engine already produced into one verdict. It counts, compares and words;
 * it never makes up a figure, and a value that is missing is called "not known", never zero.
 */
export function buildVerdict(model: ResultsModel): Verdict {
  const rows = verdictRows(model);
  const subject = (r: VerdictRow) => (r.isYours ? "Your current crops" : r.name);
  const lower = (r: VerdictRow) => (r.isYours ? "your current crops" : r.name);

  const withSafety = rows.filter((r) => goodShare(r) !== null);
  const withIncome = rows.filter((r) => incomeMid(r) !== null);
  // Safest: most good past seasons; a smaller water gap breaks a tie.
  const safest = [...withSafety].sort(
    (a, b) => (goodShare(b) as number) - (goodShare(a) as number) || (a.gapMm ?? Infinity) - (b.gapMm ?? Infinity),
  )[0];
  const richest = [...withIncome].sort((a, b) => (incomeMid(b) as number) - (incomeMid(a) as number))[0];

  const stressedShares = withSafety.map((r) => 1 - (goodShare(r) as number));
  const allStressed = withSafety.length > 0 && stressedShares.every((s) => s >= 0.5);
  const worstFloor = allStressed ? withSafety.reduce((m, r) => ((r.known as number) - (r.good as number) < (m.known as number) - (m.good as number) ? r : m)) : null;

  const top = model.ranking[0];
  const picked = model.status === "complete" && top && !top.closeToNext ? rows.find((r) => r.optionId === top.optionId) : undefined;

  let headline: string;
  let detail: string | null = null;
  const struggled = allStressed ? ", but every plan struggled in past weather" : "";

  // Check if alternatives clearly dominate what the farmer currently grows
  const yours = rows.find((r) => r.isYours);
  const alts = rows.filter((r) => !r.isYours);
  const altsDominate = Boolean(
    yours &&
    alts.length > 0 &&
    yours.gapMm !== null &&
    alts.every((a) => a.gapMm !== null && a.gapMm < (yours.gapMm ?? 0) * 0.7) &&
    (yours.gapMm ?? 0) > 250
  );

  if (altsDominate && (model.status === "unresolved" || !picked)) {
    // Built from the plans on screen: their names and their own rain gaps, never a fixed crop list.
    headline =
      alts.length === 1
        ? `${subject(alts[0])} handles dry weather far better than what you grow now.`
        : `${alts.length === 2 ? "Both" : "All"} alternative plans handle dry weather far better than what you grow now.`;
    detail = `${alts.length === 1 ? "It cuts" : "They cut"} the typical rain gap per crop from ${yours?.gapText} to ${alts.map((a) => a.gapText).join(" and ")}. Choose a goal below to see which plan fits your farm best.`;
  } else if (model.status === "unresolved" || (!safest && !richest)) {
    if (safest && (goodShare(safest) as number) > 0 && withSafety.filter((r) => goodShare(r) === goodShare(safest)).length === 1) {
      headline = `${subject(safest)} handled past weather best, with ${safest.goodText} good seasons.`;
      detail = "Some information is missing, so this is a lead to check, not a final ranking.";
    } else {
      headline = "We can't pick one best plan yet. Read the numbers for each plan below.";
    }
  } else if (picked) {
    headline = `${subject(picked)} came out first for the goals you chose${struggled}.`;
    if (safest && safest.optionId !== picked.optionId) {
      detail = `${subject(safest)} had more good past seasons (${safest.goodText}), so check the rain risk before you decide.`;
    }
  } else if (safest && richest && safest.optionId === richest.optionId) {
    headline = `${subject(safest)} did best on both rain safety (${safest.goodText} good seasons) and income${struggled}.`;
  } else if (safest) {
    headline = `${subject(safest)} did best in past weather (${safest.good} good ${safest.good === 1 ? "season" : "seasons"} of ${safest.known})${struggled}.`;
    const richer = richest && safest ? rows.filter((r) => (incomeMid(r) ?? -Infinity) > (incomeMid(safest) ?? Infinity)) : [];
    const moreStressed = richer.length > 0 && richer.every((r) => (goodShare(r) ?? 1) < (goodShare(safest) as number));
    const others = rows.length - 1;
    const who =
      richer.length === 0 ? "" : richer.length === others && others > 1 ? `The other ${others === 2 ? "two" : "plans"}` : richer.map((r) => r.name).join(" and ");
    if (richer.length > 0) {
      detail = `${who} may earn more${moreStressed ? `, but ${richer.length > 1 ? "were" : "was"} short of rain more often` : ""}. Rain safety and income point to different plans.`;
    } else if (withIncome.length < rows.length) {
      detail = "Income is not known for every plan.";
    }
  } else if (richest) {
    headline = `${subject(richest)} may earn the most, but how it handled past weather is not known.`;
  } else {
    headline = "We can't pick one best plan yet. Read the numbers for each plan below.";
  }

  const list = (pick: (r: VerdictRow) => string) => rows.map((r) => `${r.name} ${pick(r)}`).join("; ");
  const evidence: VerdictEvidence[] = [];
  if (withSafety.length > 0) evidence.push({ kind: "safety", text: `Good seasons, out of past years checked: ${list((r) => r.goodText)}.` });
  if (rows.some((r) => r.gapMm !== null)) evidence.push({ kind: "water", text: `Water gap in a typical season, per crop: ${list((r) => r.gapText)}.` });
  if (withIncome.length > 0) evidence.push({ kind: "income", text: `Return after costs per hectare over the cycle (MMK): ${list((r) => r.incomeText)}.` });
  const nitrogen = model.dimensions.find((d) => d.id === "nitrogen");
  const deficit = rows.filter((r) => nitrogen?.cells[r.optionId]?.tone === "deficit");
  if (deficit.length > 0) {
    evidence.push({ kind: "nitrogen", text: `Nitrogen deficit: ${deficit.map(lower).join(" and ")} ${deficit.length > 1 ? "take" : "takes"} more nitrogen out of the soil than ${deficit.length > 1 ? "they put" : "it puts"} back.` });
  }

  let caution: string | null = null;
  if (altsDominate) {
    caution = null;
  } else if (worstFloor) {
    const bad = (worstFloor.known as number) - (worstFloor.good as number);
    caution = `Every plan was short of rain or too hot in at least ${bad} of ${worstFloor.known} past seasons. Check water access and soil moisture on your land before you decide.`;
  } else if (model.status !== "complete" || rows.some((r) => r.good === null || r.income === null || r.gapMm === null)) {
    caution = "Some information is missing, so use this as a guide and not a final answer.";
  }

  return {
    headline,
    detail,
    evidence,
    caution,
    nextStep: "Read your farmer summary, then check water and soil with a local adviser before you change crops.",
    rows,
    allStressed,
    decision: model.decision,
  };
}
