import { getCropById } from "../data/crops";
import { ofSeasons, type DerivedIndicator } from "../evidence/indicator";
import type { Crop, Evidence, Rotation, RotationSlot, Risk } from "../types";
import { generateCandidates, type RejectedCandidate } from "./candidates";
import { buildRainSeries, baselineYears, BASELINE, type EngineData, type RainSeries } from "./data";
import { economicsFor, type EconomicsAssessment } from "./economics";
import { exposureForCrop, type ExposureSummary } from "./exposure";
import { forageMarket, type ForageMarketAssessment } from "./forage-market";
import { assessGaps, type GapAssessment } from "./lowcover";
import { rankRotations, CRITERIA, type CriterionId, type McdaInput, type McdaResult } from "./mcda";
import { pestSequence, type SequenceCheck } from "./pest";
import {
  appIndicator,
  farmerIndicator,
  hlsIndicator,
  libraryIndicator,
  powerIndicator,
  rainIndicator,
  smapIndicator,
  srtmIndicator,
} from "./provenance";
import { windowRain, spread, type Spread } from "./rain";
import { replayWindows, slotOverlaps } from "./season";
import { erosionScreen, nitrogenAssessment, soilMechanisms, type ErosionScreen, type Mechanism, type NitrogenAssessment } from "./soil-health";
import { rotationStructure, type RotationStructure } from "./structure";
import { assessSuitability, type Suitability } from "./suitability";
import { dailyEt0, rootZoneBalance, waterForCrop, type DailyEt0, type RootZoneResult, type WaterSummary } from "./water";
import { monthlyNormals } from "./climate";
import { smapWindowStats } from "../nasa/appeears/results";

/**
 * The comparison engine: read the farm condition, generate candidate sequences, evaluate feasibility
 * and effects, then compare. Everything here is a pure function of `EngineData` and the rotation, so
 * the same inputs give the same comparison. Missing evidence stays missing: it is listed as an
 * unknown, never turned into zero, an average or a pass.
 */

export type FitStatus = "fits" | "does-not-fit" | "not-confirmed";

export interface SlotEvaluation {
  slot: RotationSlot;
  cropId: string | null;
  name: string;
  hasRules: boolean;
  suitability: Suitability | null;
  exposure: ExposureSummary | null;
  water: WaterSummary | null;
  rain: { eligible: number; windows: number; total: Spread; longestDry: Spread; heavyDays: Spread; source: RainSeries["primary"] };
  rootZone: RootZoneResult | null;
  irrigated: boolean;
  unknowns: string[];
}

export interface DryYearFit {
  dryYears: number[];
  evaluated: number;
  passes: number;
  /** Shown as a label only when thresholds are validated for a named variety. */
  label: string | null;
  note: string;
}

export interface Explanation {
  id: string;
  claim: string;
  rule: string;
  input: string;
  period: string;
  source: string;
  metric: string;
  /** What change in assumptions could alter this. */
  changeIf: string;
}

export interface EvaluatedOption {
  id: string;
  label: string;
  headline: string;
  reason: string;
  /** Factual labels such as "Lowest median rain shortfall". Never "best". */
  badges: string[];
  rotation: Rotation;
  fit: FitStatus;
  noFitReason?: string;
  slots: SlotEvaluation[];
  structure: RotationStructure;
  nitrogen: NitrogenAssessment;
  erosion: ErosionScreen;
  mechanisms: Mechanism[];
  lowCover: GapAssessment[];
  pest: SequenceCheck[];
  forage: ForageMarketAssessment;
  economics: EconomicsAssessment;
  overlaps: Array<{ from: string; to: string; days: number }>;
  dryYear: DryYearFit;
  metrics: Partial<Record<CriterionId, number | null>>;
  evidence: Evidence[];
  risks: Risk[];
  unknowns: string[];
  explanations: Explanation[];
}

export interface ComparisonResult {
  current: EvaluatedOption;
  alternatives: EvaluatedOption[];
  rejected: RejectedCandidate[];
  shortfall: string | null;
  mcda: McdaResult;
  /** For each single priority, which option would rank first if it were the only one. */
  sensitivity: Array<{ priority: string; topOptionId: string | null; topLabel: string | null }>;
  baseline: { startYear: number; endYear: number; completeYears: number };
  rain: Pick<RainSeries, "fromR" | "fromP" | "missing" | "primary">;
  /** Context that is not tied to one option: regional moisture, imagery and terrain. */
  context: DerivedIndicator[];
  dataGaps: string[];
  region: string;
  processedAt: string;
}

const fmt = (n: number, d = 0) => n.toFixed(d);
const rangeText = (r: [number, number]) => `${fmt(r[0])} to ${fmt(r[1])}`;

function slotsOf(r: Rotation): RotationSlot[] {
  return [...r.slots].sort((a, b) => a.plantDate.localeCompare(b.plantDate));
}

export function compareRotations(data: EngineData, currentRotation: Rotation, opts: { baseYear?: number; now?: Date } = {}): ComparisonResult {
  const now = opts.now ?? new Date();
  const baseYear = opts.baseYear ?? now.getUTCFullYear();
  const years = baselineYears(data.records);
  const rain = buildRainSeries(data.records, data.imerg);
  const et0 = dailyEt0(data.records, data.latitude, data.elevationM);
  const normals = monthlyNormals(data.records.filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear));

  const cand = generateCandidates({
    fieldId: data.field.id,
    region: data.region,
    current: currentRotation,
    constraints: data.field.constraints,
    fieldIrrigation: data.field.irrigation,
    baseYear,
  });

  const ctx = { data, years, rain, et0, normals };
  const current = evaluate(ctx, { ...currentRotation, label: currentRotation.label || "Your rotation" }, "Your rotation", `Your recorded ${currentRotation.cycleYears}-year cycle on ${data.field.name}.`);
  const alternatives = cand.alternatives.map((c) => evaluate(ctx, c.rotation, c.template.headline, c.template.rationale));
  const all = [current, ...alternatives];

  // MCDA over feasible options only
  const mcdaInputs: McdaInput[] = all.map((o) => ({ rotationId: o.id, feasible: o.fit !== "does-not-fit", values: o.metrics }));
  const mcda = rankRotations(mcdaInputs, data.field.priorities);

  const sensitivity = (["water", "soil", "income", "forage", "lower-inputs"] as const).map((p) => {
    const r = rankRotations(mcdaInputs, { order: [p], weights: { [p]: 1 } });
    const top = r.status === "ranked" ? all.find((o) => o.id === r.ranking[0].rotationId) : undefined;
    return { priority: p, topOptionId: top?.id ?? null, topLabel: top?.label ?? null };
  });

  addBadges(all);

  const regionName = data.region === "unsupported" ? "unsupported" : data.region;
  const context = contextIndicators(data, current);
  return {
    current,
    alternatives,
    rejected: cand.rejected,
    shortfall: cand.shortfall,
    mcda,
    sensitivity,
    baseline: { startYear: BASELINE.startYear, endYear: BASELINE.endYear, completeYears: years.length },
    rain: { fromR: rain.fromR, fromP: rain.fromP, missing: rain.missing, primary: rain.primary },
    context,
    dataGaps: dataGaps(data, years.length, rain),
    region: regionName,
    processedAt: now.toISOString(),
  };
}

interface Ctx {
  data: EngineData;
  years: number[];
  rain: RainSeries;
  et0: DailyEt0[];
  normals: ReturnType<typeof monthlyNormals>;
}

function evaluate(ctx: Ctx, rotation: Rotation, headline: string, reason: string): EvaluatedOption {
  const { data, years, rain, et0, normals } = ctx;
  const slots = slotsOf(rotation);
  const fieldIrrigated = data.field.irrigation === "full";

  const evals: SlotEvaluation[] = slots
    .filter((s) => s.kind !== "fallow")
    .map((slot) => {
      const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
      const unknowns: string[] = [];
      const irrigated = slot.irrigated || fieldIrrigated;
      if (!crop) {
        return emptySlot(slot, null, "Crop", unknowns.concat("No crop chosen for this slot."), irrigated, rain);
      }
      if (!crop.profile || data.region === "unsupported") {
        unknowns.push(
          data.region === "unsupported"
            ? "Crop rules are only available inside Ayeyarwady, Magway and Shan State."
            : `${crop.names.common} has no sourced stage-level rules in the library, so it is not assessed.`,
        );
        return emptySlot(slot, crop, crop.names.common, unknowns, irrigated, rain);
      }
      const windows = replayWindows(slot, crop, years);
      const suitability = assessSuitability({ crop, region: data.region, slot, windows, records: data.records, soil: data.soil });
      const exposure = data.records.length ? exposureForCrop(crop, windows, data.records) : null;
      const water = data.records.length ? waterForCrop(crop, windows, et0, rain.days) : null;
      const rw = windows.map((w) => windowRain(rain.days, w.from, w.to));
      const ok = rw.filter((r) => r.evaluable);
      const rz = rootZoneFor(ctx, crop, slot, windows, rain);
      if (!data.records.length) unknowns.push("NASA POWER weather could not be read, so weather results are unknown.");
      else if (ok.length < 5) unknowns.push(`Only ${ok.length} complete ${ok.length === 1 ? "season" : "seasons"} of weather for this crop window.`);
      for (const c of suitability.checks) if (c.level === "unknown" && c.decisive) unknowns.push(`${c.label}: ${c.detail}`);
      if (rz.status === "unknown") unknowns.push(`Root-zone water balance needs: ${rz.missing.join(", ")}.`);
      return {
        slot,
        cropId: crop.id,
        name: crop.names.common,
        hasRules: true,
        suitability,
        exposure,
        water,
        rain: {
          eligible: ok.length,
          windows: windows.length,
          total: spread(ok.map((r) => r.totalMm)),
          longestDry: spread(ok.map((r) => r.longestDryDays)),
          heavyDays: spread(ok.map((r) => r.heavyRainDays)),
          source: rain.primary,
        },
        rootZone: rz,
        irrigated,
        unknowns,
      };
    });

  const structure = rotationStructure(rotation);
  const nitrogen = nitrogenAssessment(rotation);
  const erosion = erosionScreen(structure, normals, data.slope);
  const mechanisms = soilMechanisms(rotation, structure);
  const lowCover = assessGaps(structure.gaps, data.hls);
  const pest = pestSequence(rotation);
  const forage = forageMarket(rotation, data.field.constraints);
  const economics = economicsFor(rotation, data.field.economics, data.field.areaHa);
  const overlaps = slotOverlaps(slots).map((o) => ({ from: slots[o.from].id, to: slots[o.to].id, days: o.days }));

  // feasibility
  const outside = evals.filter((e) => e.suitability?.overall === "outside");
  const unconfirmed = evals.filter((e) => !e.suitability || e.suitability.overall === "unknown");
  const fit: FitStatus = outside.length > 0 || overlaps.length > 0 ? "does-not-fit" : unconfirmed.length > 0 || evals.length === 0 ? "not-confirmed" : "fits";
  const noFitReason =
    fit === "does-not-fit"
      ? [
          ...outside.map((e) => `${e.name}: ${e.suitability?.blockers[0] ?? "outside its documented range"}`),
          ...overlaps.map((o) => `Two crops overlap by ${o.days} days.`),
        ].join(" ")
      : undefined;

  const dryYear = dryYearFit(ctx, evals);
  const metrics = metricsFor(evals, structure, economics, forage, rotation);
  const evidence = buildEvidence(ctx, rotation, evals, structure, nitrogen, dryYear);
  const risks = buildRisks(ctx, evals, erosion, pest, economics, structure);
  const explanations = buildExplanations(ctx, evals, structure, nitrogen);
  const unknowns = [...new Set([...evals.flatMap((e) => e.unknowns), ...(economics.unknownSlots > 0 ? ["Yield, price and cost ranges for every crop (economic comparison)"] : [])])];
  if (erosion.exposure === "needs-slope-data") unknowns.push("Slope of the field (needs terrain data)");
  if (nitrogen.removedKgHa === null && nitrogen.fixingSlots > 0) unknowns.push("Nitrogen removed at harvest (needs your yields)");

  return {
    id: rotation.id,
    label: rotation.label,
    headline,
    reason,
    badges: [],
    rotation,
    fit,
    noFitReason,
    slots: evals,
    structure,
    nitrogen,
    erosion,
    mechanisms,
    lowCover,
    pest,
    forage,
    economics,
    overlaps,
    dryYear,
    metrics,
    evidence,
    risks,
    unknowns,
    explanations,
  };
}

function emptySlot(slot: RotationSlot, crop: Crop | null, name: string, unknowns: string[], irrigated: boolean, rain: RainSeries): SlotEvaluation {
  const none: Spread = { n: 0, p10: null, p50: null, p90: null };
  return { slot, cropId: crop?.id ?? null, name, hasRules: false, suitability: null, exposure: null, water: null, rain: { eligible: 0, windows: 0, total: none, longestDry: none, heavyDays: none, source: rain.primary }, rootZone: null, irrigated, unknowns };
}

function rootZoneFor(ctx: Ctx, crop: Crop, slot: RotationSlot, windows: ReturnType<typeof replayWindows>, rain: RainSeries): RootZoneResult {
  const soil = ctx.data.soil;
  const input = {
    awcMmPerM: soil.awcMmPerM?.value ?? null,
    rootDepthM: soil.rootDepthM?.value ?? null,
    // moisture at planting is never defaulted; no field input exists for it yet
    initialDepletionMm: null,
    irrigationMm: slot.irrigated ? (ctx.data.field.constraints?.irrigation?.amountMm ?? null) : 0,
  };
  const w = windows[windows.length - 1];
  if (!w) return { status: "unknown", missing: ["weather years"] };
  const etc = new Map<string, number>();
  for (const st of w.stages) {
    const kc = crop.profile?.stages.find((s) => s.id === st.id)?.kc.value ?? crop.kc.mid;
    for (let t = Date.parse(st.from); t <= Date.parse(st.to); t += 86_400_000) {
      const iso = new Date(t).toISOString().slice(0, 10);
      const e = ctx.et0.find((d) => d.date === iso)?.mm;
      if (e != null) etc.set(iso, kc * e);
    }
  }
  return rootZoneBalance(input, w, etc, new Map(rain.days.map((d) => [d.date, d.mm])));
}

function dryYearFit(ctx: Ctx, evals: SlotEvaluation[]): DryYearFit {
  const annual = new Map<number, number>();
  for (const d of ctx.rain.days) {
    const y = Number(d.date.slice(0, 4));
    if (d.mm !== null && y >= BASELINE.startYear && y <= BASELINE.endYear) annual.set(y, (annual.get(y) ?? 0) + d.mm);
  }
  const completeYearSet = new Set(ctx.years);
  const totals = [...annual.entries()].filter(([y]) => completeYearSet.has(y)).sort((a, b) => a[1] - b[1]);
  const quarter = Math.max(3, Math.floor(totals.length / 4));
  const dryYears = totals.length >= 8 ? totals.slice(0, quarter).map(([y]) => y).sort() : [];
  const crops = evals.map((e) => (e.cropId ? getCropById(e.cropId) : undefined));
  const validated = crops.length > 0 && crops.every((c) => c?.profile?.varietyValidated === true);

  let evaluated = 0;
  let passes = 0;
  for (const y of dryYears) {
    let evaluable = true;
    let pass = true;
    for (const e of evals) {
      const crop = e.cropId ? getCropById(e.cropId) : undefined;
      if (!crop?.profile || !e.water) {
        evaluable = false;
        break;
      }
      const sw = e.water.seasons.find((s) => s.year === y);
      if (!sw || !sw.evaluable || sw.rainMm === null) {
        evaluable = false;
        break;
      }
      if (!e.irrigated && sw.rainMm < crop.water.seasonMm.min) pass = false;
      const ex = e.exposure?.seasons.find((s) => s.year === y);
      if (ex && ex.stages.some((st) => (st.heatDays ?? 0) > 0)) pass = false;
    }
    if (!evaluable) continue;
    evaluated++;
    if (pass) passes++;
  }
  return {
    dryYears,
    evaluated,
    passes,
    label: validated && evaluated >= 3 ? "Fits more dry seasons" : null,
    note:
      dryYears.length === 0
        ? "Too few complete seasons to define dry years."
        : validated
          ? "Share of the driest seasons in which every crop met the stated thresholds."
          : "Thresholds are species-level starting values, not validated for a variety, so no 'most reliable in dry years' label is shown. This is a historical proxy, not a forecast.",
  };
}

function metricsFor(evals: SlotEvaluation[], structure: RotationStructure, economics: EconomicsAssessment, forage: ForageMarketAssessment, rotation: Rotation): Partial<Record<CriterionId, number | null>> {
  const cycle = rotation.cycleYears || 1;
  const shortfalls = evals.map((e) => e.water?.shortfall.p50 ?? null);
  const allRules = evals.length > 0 && evals.every((e) => e.hasRules);
  const nDemand = evals.reduce((s, e) => s + (e.cropId ? (getCropById(e.cropId)?.nDemandKgHa ?? 0) : 0), 0);
  return {
    "water-shortfall": allRules && shortfalls.every((s) => s !== null) ? (shortfalls as number[]).reduce((a, b) => a + b, 0) / shortfalls.length : null,
    "soil-legume-share": structure.legumeShare,
    "soil-cover": structure.cycleDays > 0 ? structure.coveredShare : null,
    "income-margin": economics.cycleMarginMmkHa ? (economics.cycleMarginMmkHa[0] + economics.cycleMarginMmkHa[1]) / 2 / cycle : null,
    "forage-slots": allRules ? forage.forageSlots / cycle : null,
    "input-nitrogen": allRules ? nDemand / cycle : null,
  };
}

function addBadges(options: EvaluatedOption[]) {
  const fit = options.filter((o) => o.fit !== "does-not-fit");
  if (fit.length < 2) return;
  const labels: Record<CriterionId, { text: string; dir: "min" | "max" }> = {
    "water-shortfall": { text: "Lowest median rain shortfall", dir: "min" },
    "soil-legume-share": { text: "Most legumes", dir: "max" },
    "soil-cover": { text: "Most days with a crop", dir: "max" },
    "income-margin": { text: "Highest midpoint margin from your numbers", dir: "max" },
    "forage-slots": { text: "Most fodder or forage crops", dir: "max" },
    "input-nitrogen": { text: "Lowest nitrogen demand", dir: "min" },
  };
  for (const def of CRITERIA) {
    const vals = fit.map((o) => o.metrics[def.id]);
    if (vals.some((v) => v === null || v === undefined)) continue; // not evaluable for all: no label
    const nums = vals as number[];
    const target = labels[def.id].dir === "min" ? Math.min(...nums) : Math.max(...nums);
    if (Math.max(...nums) - Math.min(...nums) < 1e-9) continue;
    fit.forEach((o) => {
      if (o.metrics[def.id] === target) o.badges.push(labels[def.id].text);
    });
  }
}

function buildEvidence(ctx: Ctx, rotation: Rotation, evals: SlotEvaluation[], structure: RotationStructure, nitrogen: NitrogenAssessment, dryYear: DryYearFit): Evidence[] {
  const { data, rain } = ctx;
  const out: Evidence[] = [];
  const start = `${BASELINE.startYear}-01-01`;
  const end = `${BASELINE.endYear}-12-31`;
  evals.forEach((e) => {
    if (!e.hasRules) return;
    const id = `${rotation.id}:${e.slot.id}`;
    const eligible = e.rain.eligible;
    const windows = e.rain.windows;
    out.push({
      id: `${id}:rain`,
      claim: `Rain in the ${e.name} season`,
      comparedTo: e.rain.total.p10 !== null && e.rain.total.p90 !== null ? `Driest tenth ${fmt(e.rain.total.p10)} mm, wettest tenth ${fmt(e.rain.total.p90)} mm` : undefined,
      indicator: rainIndicator({
        data, rain, name: `${e.name} season rain`, value: e.rain.total.p50 === null ? null : Math.round(e.rain.total.p50), units: "mm", statistic: `median of ${eligible} seasons`,
        start, end, valid: eligible, expected: windows,
        assumptions: ["Rainfall is for a grid cell around your field, not a rain gauge on it."],
      }),
    });
    if (e.water) {
      out.push({
        id: `${id}:shortfall`,
        claim: `Rain compared with estimated ${e.name} water demand`,
        comparedTo: e.water.etc.p50 !== null ? `Estimated crop demand about ${fmt(e.water.etc.p50)} mm (median)` : undefined,
        indicator: powerIndicator({
          data, name: `${e.name} rain shortfall`, variable: "T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN, PS (ETo inputs)",
          value: e.water.shortfall.p50 === null ? null : Math.round(e.water.shortfall.p50), units: "mm", statistic: `median of ${e.water.eligibleSeasons} seasons`,
          start, end, valid: e.water.eligibleSeasons, expected: windows,
          assumptions: [e.water.methodNote, e.irrigated ? "This crop is marked irrigated, so rain alone is not the whole water picture." : "Rainfed: no irrigation assumed."],
          ruleSources: [`Kc stages for ${e.name}: ${getCropById(e.cropId ?? "")?.profile?.stages[0]?.kc.ref ?? "crop library"}`],
        }),
      });
    }
    const heatStage = e.exposure?.byStage.find((s) => s.heatThresholdC !== null);
    if (heatStage && e.exposure) {
      out.push({
        id: `${id}:heat`,
        claim: `Hot days at ${heatStage.label.toLowerCase()} for ${e.name}`,
        indicator: powerIndicator({
          data, name: `${e.name} heat exposure`, variable: "T2M_MAX",
          value: heatStage.seasonsWithHeat === null ? null : ofSeasons(heatStage.seasonsWithHeat, e.exposure.eligibleSeasons),
          units: `seasons with a day above ${heatStage.heatThresholdC} °C`, statistic: "count of seasons", start, end,
          valid: e.exposure.eligibleSeasons, expected: windows,
          assumptions: ["Air temperature from a grid cell. Land-surface temperature is not used for this test.", "Historical replay, not a forecast."],
          ruleSources: heatStage.thresholdRef ? [`${heatStage.thresholdRef} (${heatStage.thresholdScope})`] : [],
        }),
      });
    }
  });
  out.push({
    id: `${rotation.id}:cover`,
    claim: "Share of the cycle with a crop in the field",
    indicator: appIndicator({ data, name: "Covered share of the cycle", variable: "covered_days / cycle_days", value: Math.round(structure.coveredShare * 100), units: "%", statistic: "planned dates", start: null, end: null, valid: structure.coveredDays, expected: structure.cycleDays, assumptions: ["From the planned planting and harvest dates, not from satellite cover."], kind: "scenario" }),
  });
  if (nitrogen.fixedKgHa) {
    out.push({
      id: `${rotation.id}:nfix`,
      claim: "Nitrogen the legumes in this cycle can fix",
      comparedTo: nitrogen.removedKgHa !== null ? `You entered yields that remove about ${fmt(nitrogen.removedKgHa)} kg N/ha in grain` : "Nitrogen removed at harvest is unknown without your yields",
      indicator: libraryIndicator({ data, name: "Nitrogen fixation range", variable: "nFixKgHa", value: rangeText(nitrogen.fixedKgHa), units: "kg N/ha per cycle", statistic: "literature range summed over legume slots", start: null, end: null, assumptions: [nitrogen.note], ruleSources: ["Crop library nitrogen-fixation ranges (analyst scope)"] }),
    });
  }
  out.push({
    id: `${rotation.id}:dry`,
    claim: "Historical dry seasons that every crop got through",
    indicator: appIndicator({ data, name: "Dry-season replay", variable: "dry_year_fit", value: dryYear.evaluated > 0 ? ofSeasons(dryYear.passes, dryYear.evaluated) : null, units: "dry seasons", statistic: "count", start, end, valid: dryYear.evaluated, expected: dryYear.dryYears.length, assumptions: [dryYear.note, "Dry seasons are the driest quarter of complete years, by annual rain at this grid cell."], kind: "scenario" }),
  });
  return out;
}

function buildRisks(ctx: Ctx, evals: SlotEvaluation[], erosion: ErosionScreen, pest: SequenceCheck[], economics: EconomicsAssessment, structure: RotationStructure): Risk[] {
  const { data } = ctx;
  const risks: Risk[] = [];
  const add = (r: Omit<Risk, "relatedEvidence"> & { relatedEvidence?: string[] }) => risks.push({ relatedEvidence: [], ...r });
  if (data.region === "unsupported") {
    add({ id: "region", kind: "missing-data", severity: "important", text: "This location is outside Ayeyarwady, Magway and Shan State, so there are no crop rules for it.", action: "Move the pin to a supported region, or use the app only to look at weather and soil." });
  }
  if (data.power.status !== "ok") {
    add({ id: "power", kind: "missing-data", severity: "important", text: "NASA POWER weather could not be read, so weather results are unknown.", action: "Check the connection and try again." });
  } else {
    add({ id: "coarse-weather", kind: "coarse-data", severity: "info", text: "Weather comes from a grid about 50 km wide. It does not see each slope, valley or rain shower on your field.", action: "Compare with a rain gauge or what neighbours see." });
  }
  evals.forEach((e) => {
    if (!e.suitability) return;
    for (const c of e.suitability.checks) {
      if (c.level === "outside") add({ id: `${e.slot.id}:${c.id}`, kind: "agronomic", severity: "important", text: `${e.name}: ${c.detail}`, action: c.id === "sowing-window" ? "Check the planting date with your local extension office." : "Check this with a soil test or local advice." });
    }
    const heat = e.exposure?.byStage.find((s) => (s.seasonsWithHeat ?? 0) > 0);
    if (heat && e.exposure) add({ id: `${e.slot.id}:heat`, kind: "agronomic", severity: "caution", text: `${e.name}: ${ofSeasons(heat.seasonsWithHeat as number, e.exposure.eligibleSeasons)} had a day above ${heat.heatThresholdC} °C at ${heat.label.toLowerCase()}.`, action: "Think about sowing earlier or later, or a heat-tolerant variety." });
    const sf = e.water?.shortfall.p50;
    if (!e.irrigated && sf != null && sf > 100) add({ id: `${e.slot.id}:water`, kind: "agronomic", severity: "caution", text: `${e.name}: rain was about ${fmt(sf)} mm short of estimated crop demand in a median season.`, action: "Check your water access, soil water holding and whether stored moisture is enough." });
  });
  pest.filter((p) => p.result === "same-family").forEach((p, i) => add({ id: `pest:${i}`, kind: "agronomic", severity: "caution", text: p.text, action: "Ask local advisers about pests and diseases for this sequence." }));
  if (erosion.exposure === "possible" || erosion.exposure === "elevated") {
    add({ id: "erosion", kind: "agronomic", severity: erosion.exposure === "elevated" ? "important" : "caution", text: erosion.reasons.join(" "), action: "Consider keeping cover on the ground in rainy months. This screen does not measure soil loss." });
  } else if (erosion.exposure === "needs-slope-data") {
    add({ id: "erosion-slope", kind: "missing-data", severity: "info", text: "Slope has not been read for this field, so erosion exposure is not assessed.", action: "Connect terrain data or check the slope on the ground." });
  }
  if (!data.field.locationConfirmed) add({ id: "unconfirmed", kind: "local-review", severity: "caution", text: "You have not confirmed that this pin or outline is your field.", action: "Confirm the location so results are about your field and not a guess." });
  if (data.soil.ph === null) add({ id: "soil-ph", kind: "missing-data", severity: "caution", text: "No soil pH is available for this field.", action: "A soil test gives a better answer than any map." });
  if (economics.unknownSlots > 0) add({ id: "econ", kind: "missing-data", severity: "info", text: "Income is not compared because yield, price or cost ranges are missing for some crops.", action: "Enter local ranges on the Your farm page." });
  add({ id: "library", kind: "model-limit", severity: "info", text: "Crop rules are species-level starting values, not validated for a variety.", action: "Ask a local agronomist to check the thresholds shown with each reason." });
  if (structure.coveredShare < 0.5) add({ id: "cover", kind: "agronomic", severity: "info", text: "More than half the cycle has no planned crop.", action: "Check whether another crop or a cover could fit in the gaps." });
  return risks;
}

function buildExplanations(ctx: Ctx, evals: SlotEvaluation[], structure: RotationStructure, nitrogen: NitrogenAssessment): Explanation[] {
  const out: Explanation[] = [];
  const period = `${BASELINE.startYear} to ${BASELINE.endYear}`;
  for (const e of evals) {
    if (!e.suitability) continue;
    const t = e.suitability.checks.find((c) => c.id === "temperature");
    if (t && t.level !== "unknown") {
      out.push({
        id: `${e.slot.id}:temp`, claim: `${e.name} suits the air temperature (${t.level})`, rule: t.ruleSource ? `${t.ruleSource.ref} [${t.ruleSource.scope}]` : "No sourced rule", input: t.inputSource ?? "", period,
        source: "NASA POWER daily T2M, UTC days", metric: t.detail, changeIf: "A different variety or sowing date, or a threshold checked locally, could change this.",
      });
    }
    const sf = e.water?.shortfall.p50;
    if (sf != null) {
      out.push({
        id: `${e.slot.id}:water`, claim: `${e.name}: rain was ${sf > 0 ? `about ${fmt(sf)} mm short of` : "enough for"} estimated crop demand in a median season`,
        rule: `Kc by stage x ETo [${getCropById(e.cropId ?? "")?.profile?.stages[1]?.kc.scope ?? "analyst-assumption"}]`, input: e.irrigated ? "Marked irrigated: rainfall alone is not the full picture" : "Rainfed", period,
        source: `${e.rain.source === "R" ? "GPM IMERG daily precipitation" : "NASA POWER PRECTOTCORR"} for rain; NASA POWER for ETo`,
        metric: `Median demand ${e.water?.etc.p50 != null ? fmt(e.water.etc.p50) : "unknown"} mm, median rain ${e.water?.rain.p50 != null ? fmt(e.water.rain.p50) : "unknown"} mm over ${e.water?.eligibleSeasons} seasons`,
        changeIf: "Irrigation, stored soil moisture or runoff would change the water picture; none is modelled here.",
      });
    }
  }
  out.push({
    id: "structure", claim: `${structure.legumeSlots} of ${structure.cropSlots} crops are legumes and ${Math.round(structure.coveredShare * 100)}% of the cycle has a crop`,
    rule: "Descriptor of the plan, not a prediction", input: "Your planned dates", period: "The planned cycle", source: "Crop library family and group", metric: `${structure.distinctFamilies} crop families`, changeIf: "Changing the crops or dates changes this.",
  });
  if (nitrogen.fixedKgHa) {
    out.push({ id: "nfix", claim: `Legumes here can fix about ${rangeText(nitrogen.fixedKgHa)} kg N/ha over the cycle`, rule: "Literature range [analyst-assumption]", input: "Crop library", period: "Per cycle", source: "Crop library", metric: "kg N/ha", changeIf: "Actual fixation depends on the variety, inoculation and yield. Nitrogen fixed is not nitrogen left after harvest." });
  }
  return out;
}

function contextIndicators(data: EngineData, current: EvaluatedOption): DerivedIndicator[] {
  const out: DerivedIndicator[] = [];
  const slot = current.slots.find((s) => s.hasRules)?.slot ?? current.rotation.slots[0];
  const year = BASELINE.endYear;
  const from = slot ? `${year}-${slot.plantDate.slice(5)}` : `${year}-01-01`;
  const to = slot ? `${slot.harvestDate.slice(5) >= slot.plantDate.slice(5) ? year : year + 1}-${slot.harvestDate.slice(5)}` : `${year}-12-31`;
  const stats = smapWindowStats(data.smap, from, to);
  out.push(
    smapIndicator({
      data, name: "Regional root-zone moisture", value: data.smapInfo.status === "ok" && stats.meanRootzone !== null ? Number(stats.meanRootzone.toFixed(3)) : null, units: "m³/m³", statistic: "mean of valid days in the first crop window, 2025",
      start: from, end: to, valid: stats.validDays, expected: stats.expectedDays,
      assumptions: ["A 9 km modelled value. It is regional context and does not say how wet your field is."],
    }),
  );
  const hlsValid = data.hls.filter((h) => h.ndviMedian !== null);
  out.push(
    hlsIndicator({
      data, name: "Clear satellite observations of the field", value: data.hlsInfo.status === "ok" ? hlsValid.length : null, units: "clear observations", statistic: "count", start: data.hlsInfo.start, end: data.hlsInfo.end,
      valid: hlsValid.length, expected: data.hls.length, assumptions: ["Greenness is not bare soil, and cloudy dates are missing, not zero."],
    }),
  );
  const slope = data.slope;
  out.push(
    srtmIndicator({
      data, name: "Median slope", value: data.srtmInfo.status === "ok" && slope?.medianDeg != null ? Number(slope.medianDeg.toFixed(1)) : null, units: "degrees", statistic: "median of valid 3 x 3 cells",
      start: null, end: null, valid: slope?.validCells ?? null, expected: slope?.totalCells ?? null,
      assumptions: ["Slope is not soil loss. Terrain is from February 2000."],
    }),
  );
  if (data.soil.ph?.from === "farmer") {
    out.push(farmerIndicator({ data, name: "Soil pH you entered", variable: "ph", value: data.soil.ph.value, units: "pH", statistic: data.soil.ph.note, start: null, end: null, kind: "lab" }));
  }
  return out;
}

function dataGaps(data: EngineData, completeYears: number, rain: RainSeries): string[] {
  const gaps: string[] = [];
  if (data.power.status !== "ok") gaps.push("NASA POWER weather is not available.");
  else if (completeYears < 8) gaps.push(`Only ${completeYears} complete weather years in ${BASELINE.startYear} to ${BASELINE.endYear}; statistics are less reliable.`);
  if (data.imergInfo.status !== "ok") gaps.push(data.imergInfo.status === "unconfigured" ? "GPM IMERG rainfall is not connected; NASA POWER rainfall is used instead." : "GPM IMERG rainfall is not available; NASA POWER rainfall is used instead.");
  else if (rain.fromP > 0) gaps.push(`${rain.fromP} days used NASA POWER rainfall because IMERG was missing or partly sampled.`);
  if (data.smapInfo.status !== "ok") gaps.push("SMAP regional soil moisture is not available.");
  if (data.hlsInfo.status !== "ok") gaps.push("HLS satellite vegetation observations are not available, so low-cover periods come from your plan only.");
  if (data.srtmInfo.status !== "ok") gaps.push("SRTM terrain is not available, so slope is unknown.");
  if (!data.soil.ph) gaps.push("No soil pH for this field.");
  return gaps;
}
