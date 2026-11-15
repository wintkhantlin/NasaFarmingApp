import { getRealWorldCropEconomics } from "../data/crops";
import { copy } from "../copy/en";
import type { ComparisonResult, EvaluatedOption, SlotEvaluation } from "../engine/compare";
import { REGIONAL_INCOME_BENCHMARK } from "../engine/economics";
import { CRITERIA, type CriterionId } from "../engine/mcda";
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
  ranking: Array<{ optionId: string; place: number; closeToNext: boolean }>;
  sensitivity: string[];
  rankingNotes: string[];
  unknowns: UnknownItem[];
  assumptions: string[];
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
  return { text: `${fixed}; grain removes about ${Math.round(n.removedKgHa)} kg N/ha`, basis: "library" };
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
    // "Similar" uses the same two-decimal rounding the page uses to call two scores tied.
    const vs = !yoursPart ? null : p.normalised.toFixed(2) === yoursPart.normalised.toFixed(2) ? "similar" : p.normalised > yoursPart.normalised ? "better" : "worse";
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
    { id: "pest", label: "Pest and disease risk", measures: "Whether back-to-back crops share soil-borne pests or diseases.", better: "Fewer shared pests is better.", limits: "Based on crop families. Not a validated disease prediction for your field.", cells: cells(pestCell) },
    { id: "erosion", label: "Erosion exposure", measures: "Bare, rainy intervals on sloping ground.", better: "Not flagged is better.", limits: "A screen. It does not estimate soil loss.", cells: cells(erosionCell) },
    { id: "economics", label: "Economic performance", measures: "Estimated return after listed costs, as a range.", better: "A higher range is better, if the inputs are realistic.", limits: "Not guaranteed income. Prices, yields and costs vary.", cells: cells((o) => economicsCell(field, o)) },
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
    // The page's existing tie rule: scores equal at two decimals are called close.
    closeToNext: i < c.mcda.ranking.length - 1 && r.score.toFixed(2) === c.mcda.ranking[i + 1].score.toFixed(2),
  }));
  const nameOf = (id: string) => options.find((x) => x.id === id)?.name ?? null;
  const sensitivity = c.sensitivity
    .filter((s) => s.topOptionId && nameOf(s.topOptionId))
    .map((s) => `If only "${copy.profile.priority[s.priority as PriorityId].toLowerCase()}" mattered, ${nameOf(s.topOptionId as string)} would come first.`);

  for (const d of [...dimensions, ...soil]) d.matters = MATTERS[d.id] ?? "";

  const status: AnalysisStatus = display.state === "comparable" ? "complete" : display.state === "unresolved" ? "unresolved" : "partial";
  const statusTitle = { complete: "Complete comparison", partial: "Partial evidence", unresolved: "Ranking unresolved" }[status];
  const statusDetail =
    status === "complete"
      ? "Every option had evidence for the criteria used, so the order below is supported."
      : status === "unresolved"
        ? "There is not enough matching evidence to put these options in a fair order, so none is called best."
        : "Some options lack information the others have. They are shown side by side without a forced winner.";

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
