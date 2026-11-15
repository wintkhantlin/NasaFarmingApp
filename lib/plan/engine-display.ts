import type { ComparisonResult, EvaluatedOption } from "../engine/compare";
import { BASELINE, type EngineData, type SourceStatus } from "../engine/data";
import { provenanceLine, type DerivedIndicator } from "../evidence/indicator";
import { copy as copyEn } from "../copy/en";
import { copyMy } from "../copy/my";
import type { Field, Rotation } from "../types";
import type { RegionalPreviewResult } from "./regional-preview";

/** Presentation state, separate from the engine's MCDA and source statuses. */
export type ComparisonDisplayState =
  | "regional-preview" | "field-incomplete" | "evaluating" | "partial-evidence"
  | "comparable" | "unresolved" | "data-unavailable" | "stale" | "error";

export type DisplayLocale = "en" | "my";

export interface DisplaySource {
  claim: string;
  product: string;
  status: SourceStatus | "available";
  lineage: string;
  period: string | null;
  missingReason: DerivedIndicator["missingReason"];
  sourceUrl: string | null;
}

export interface DisplayOption {
  id: string;
  label: string;
  kind: "current" | "alternative";
  reason: string;
  tradeOff: string;
  assumption: string;
  unknown: string;
  localCheck: string;
  sources: DisplaySource[];
  engine: EvaluatedOption;
}

export interface ComparisonDisplay {
  state: ComparisonDisplayState;
  headline: string;
  detail: string;
  /** The engine result remains available for the evidence and methods drill-down. */
  engineStatus: ComparisonResult["mcda"]["status"] | null;
  replay: { startYear: number; endYear: number; completeYears: number } | null;
  options: DisplayOption[];
  tiedFirst: boolean;
  sourceStatuses: { power: SourceStatus; imerg: SourceStatus; smap: SourceStatus; hls: SourceStatus; srtm: SourceStatus } | null;
  gaps: string[];
  /** Why other plans were left out (crop does not fit, a limit was broken). Empty when nothing was excluded. */
  reasons: string[];
}

export type DisplayInput =
  | { mode: "regional-preview"; preview: RegionalPreviewResult; locale?: DisplayLocale }
  | {
      mode: "field";
      phase: "loading" | "ready" | "failed";
      field: Field | undefined;
      rotation: Rotation | undefined;
      data: EngineData | null;
      comparison: ComparisonResult | null;
      inputRevision: string;
      resultRevision: string | null;
      /** Language of the sentences built here. English when omitted. */
      locale?: DisplayLocale;
    };

type DisplayText = typeof copyEn.compare.display;
const textFor = (locale: DisplayLocale | undefined): DisplayText => (locale === "my" ? (copyMy.compare.display as unknown as DisplayText) : copyEn.compare.display);

const empty = (state: ComparisonDisplayState, headline: string, detail: string): ComparisonDisplay => ({
  state, headline, detail, engineStatus: null, replay: null, options: [], tiedFirst: false, sourceStatuses: null, gaps: [], reasons: [],
});

function farmerFriendlyGap(gap: string, t: DisplayText): string {
  if (gap.startsWith("GPM IMERG rainfall is not")) return t.gapImerg;
  if (gap === "SMAP regional soil moisture is not available.") return t.gapSmap;
  if (gap.startsWith("HLS satellite vegetation observations are not available")) return t.gapHls;
  if (gap === "SRTM terrain is not available, so slope is unknown.") return t.gapSrtm;
  return gap;
}

function farmerFriendlyRisk(risk: string, t: DisplayText): string {
  if (risk === "Crop rules are species-level starting values, not validated for a variety.") return t.riskGeneral;
  const heat = risk.match(/^(.+): (\d+) of (\d+) seasons had a day above (\d+) °C at flowering and pod or grain set\.$/);
  if (heat) return t.riskHeat(heat[1], heat[2], heat[3], heat[4]);
  return risk;
}

function sourceStatus(indicator: DerivedIndicator, data: EngineData): DisplaySource["status"] {
  if (indicator.sourceId === "P") return data.power.status;
  if (indicator.sourceId === "R") return data.imergInfo.status;
  if (indicator.sourceId === "M") return data.smapInfo.status;
  if (indicator.sourceId === "V") return data.hlsInfo.status;
  if (indicator.sourceId === "T") return data.srtmInfo.status;
  return indicator.value === null ? "unavailable" : "available";
}

function displayOption(option: EvaluatedOption, kind: DisplayOption["kind"], data: EngineData, t: DisplayText): DisplayOption {
  const sourceIndicators = option.evidence.map((e) => ({ claim: e.claim, indicator: e.indicator }));
  return {
    id: option.id,
    label: kind === "current" ? t.yourCurrent : option.label,
    kind,
    reason: option.reason,
    tradeOff: farmerFriendlyRisk(option.risks.find((r) => r.kind === "agronomic" || r.kind === "model-limit")?.text ?? t.tradeOffDefault, t),
    assumption: option.evidence.flatMap((e) => e.indicator.assumptions)[0] ?? option.explanations[0]?.input ?? t.assumptionDefault,
    unknown: option.unknowns[0] ?? t.unknownDefault,
    localCheck: option.risks.find((r) => r.action)?.action ?? t.localCheckDefault,
    sources: sourceIndicators.map(({ claim, indicator }) => ({
      claim,
      product: indicator.product,
      status: sourceStatus(indicator, data),
      lineage: provenanceLine(indicator),
      period: indicator.periodStart && indicator.periodEnd ? `${indicator.periodStart} to ${indicator.periodEnd}` : null,
      missingReason: indicator.missingReason,
      sourceUrl: indicator.sourceUrl,
    })),
    engine: option,
  };
}

/** Read the engine's result; never calculate a scientific score or fill a missing metric here. */
export function adaptComparison(input: DisplayInput): ComparisonDisplay {
  const t = textFor(input.locale);
  if (input.mode === "regional-preview") {
    return empty("regional-preview", t.regionalExamples, input.preview.message);
  }
  const { field, rotation, phase, data, comparison } = input;
  if (!field?.locationConfirmed) return empty("field-incomplete", t.confirmWhereTitle, t.confirmWhereBody);
  if (rotation?.source === "strategy" && rotation.slots.length > 0) return empty("field-incomplete", t.planSavedTitle, t.planSavedBody);
  if (!rotation || rotation.slots.length === 0) return empty("field-incomplete", t.addCropsTitle, t.addCropsBody);
  if (input.resultRevision !== null && input.inputRevision !== input.resultRevision) return empty("stale", t.staleTitle, t.staleBody);
  if (phase === "loading" && !comparison) return empty("evaluating", t.checkingTitle, t.checkingBody(BASELINE.startYear, BASELINE.endYear));
  if (phase === "failed" && !comparison) return empty("error", t.errorTitle, t.errorBody);
  if (!data || !comparison) return empty("data-unavailable", t.notReadyTitle, t.notReadyBody);

  const statuses = { power: data.power.status, imerg: data.imergInfo.status, smap: data.smapInfo.status, hls: data.hlsInfo.status, srtm: data.srtmInfo.status };
  const baseline = comparison.baseline;
  const expectedYears = BASELINE.endYear - BASELINE.startYear + 1;
  const partialIds = new Set(comparison.mcda.partial.map((p) => p.rotationId));
  const rankedIds = new Set(comparison.mcda.ranking.map((r) => r.rotationId));
  const evidenceSupported = (o: EvaluatedOption) => o.fit !== "does-not-fit" && o.slots.length > 0 && o.evidence.some((e) => e.indicator.value !== null);
  const alternatives = comparison.alternatives.filter(evidenceSupported);
  const rankPosition = new Map(comparison.mcda.ranking.map((r, index) => [r.rotationId, index]));
  const completeAlternatives = alternatives.filter((o) => !partialIds.has(o.id) && rankedIds.has(o.id))
    .sort((a, b) => (rankPosition.get(a.id) ?? Infinity) - (rankPosition.get(b.id) ?? Infinity));
  const selected = (completeAlternatives.length >= 2 ? completeAlternatives : alternatives).slice(0, 2);
  const options = [displayOption(comparison.current, "current", data, t), ...selected.map((o) => displayOption(o, "alternative", data, t))];
  const ranking = comparison.mcda.ranking;
  // At the precision presented to farmers, effectively equal scores carry no first-place badge.
  const tiedFirst = ranking.length > 1 && ranking[0].score.toFixed(2) === ranking[1].score.toFixed(2);
  const replay = { ...baseline };
  const frame = t.frame(baseline.completeYears, expectedYears, BASELINE.startYear, BASELINE.endYear);
  const common = {
    engineStatus: comparison.mcda.status, replay, options, tiedFirst, sourceStatuses: statuses,
    gaps: comparison.dataGaps.map((g) => farmerFriendlyGap(g, t)), reasons: [] as string[],
  };

  if (comparison.region === "unsupported" || alternatives.length === 0 || baseline.completeYears === 0 || comparison.rain.primary === "none") {
    const exclusions = [comparison.current, ...comparison.alternatives]
      .filter((o) => o.fit === "does-not-fit")
      .map((o) => `${o.label}: ${o.noFitReason ?? t.exclusionDefault}`);
    exclusions.push(...comparison.rejected.map((r) => `${r.template.label}: ${r.reason}`));
    if (comparison.shortfall) exclusions.unshift(comparison.shortfall);
    if (comparison.region === "myanmar" || comparison.region === "yangon") {
      const regionName = t.noCatalogRegion[comparison.region];
      return { ...common, state: "unresolved", headline: t.noCatalogTitle, detail: t.noCatalogBody(frame, regionName),
        gaps: [...new Set([...common.gaps, t.noCatalogGap(regionName)])] };
    }
    if (comparison.region === "unsupported") {
      return { ...common, gaps: [...new Set([...exclusions, ...common.gaps])], state: "data-unavailable", reasons: [],
        headline: t.outsideTitle, detail: t.outsideBody(frame) };
    }
    const weatherReady = baseline.completeYears > 0 && comparison.rain.primary !== "none";
    const reasons = [...new Set(exclusions)];
    return { ...common, gaps: [...new Set([...common.gaps, ...exclusions])], state: "data-unavailable", reasons,
      headline: weatherReady ? t.fewTitle : t.notReadyYetTitle,
      detail: t.fewBody(frame, weatherReady) };
  }
  if (comparison.mcda.status === "unresolved" || !rankedIds.has(comparison.current.id)) {
    const topPriorityMissing = comparison.mcda.partial.some((candidate) => candidate.lacksTopPriority)
      || /(?:first|top)[ -]priority/i.test(comparison.mcda.note);
    const reason = topPriorityMissing ? t.unresolvedTopPriority : t.unresolvedGeneral;
    return { ...common, state: "unresolved", headline: t.unresolvedTitle, detail: `${reason} ${frame}` };
  }
  if (comparison.mcda.status !== "ranked" || baseline.completeYears < expectedYears || completeAlternatives.length < 2 || partialIds.size > 0) {
    const reason = comparison.mcda.status === "no-priorities" ? t.partialNoPriorities : t.partialOther;
    return { ...common, state: "partial-evidence", headline: t.partialTitle, detail: `${frame} ${reason} ${t.partialCompared(completeAlternatives.length)}` };
  }
  return {
    ...common, state: "comparable", headline: tiedFirst ? t.comparableTied : t.comparableTitle,
    detail: t.comparableBody(baseline.completeYears, BASELINE.startYear, BASELINE.endYear),
  };
}
