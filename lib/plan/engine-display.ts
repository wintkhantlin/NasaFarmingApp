import type { ComparisonResult, EvaluatedOption } from "../engine/compare";
import { BASELINE, type EngineData, type SourceStatus } from "../engine/data";
import { provenanceLine, type DerivedIndicator } from "../evidence/indicator";
import type { Field, Rotation } from "../types";
import type { RegionalPreviewResult } from "./regional-preview";

/** Presentation state, separate from the engine's MCDA and source statuses. */
export type ComparisonDisplayState =
  | "regional-preview" | "field-incomplete" | "evaluating" | "partial-evidence"
  | "comparable" | "unresolved" | "data-unavailable" | "stale" | "error";

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
}

export type DisplayInput =
  | { mode: "regional-preview"; preview: RegionalPreviewResult }
  | {
      mode: "field";
      phase: "loading" | "ready" | "failed";
      field: Field | undefined;
      rotation: Rotation | undefined;
      data: EngineData | null;
      comparison: ComparisonResult | null;
      inputRevision: string;
      resultRevision: string | null;
    };

const empty = (state: ComparisonDisplayState, headline: string, detail: string): ComparisonDisplay => ({
  state, headline, detail, engineStatus: null, replay: null, options: [], tiedFirst: false, sourceStatuses: null, gaps: [],
});

function sourceStatus(indicator: DerivedIndicator, data: EngineData): DisplaySource["status"] {
  if (indicator.sourceId === "P") return data.power.status;
  if (indicator.sourceId === "R") return data.imergInfo.status;
  if (indicator.sourceId === "M") return data.smapInfo.status;
  if (indicator.sourceId === "V") return data.hlsInfo.status;
  if (indicator.sourceId === "T") return data.srtmInfo.status;
  return indicator.value === null ? "unavailable" : "available";
}

function displayOption(option: EvaluatedOption, kind: DisplayOption["kind"], data: EngineData): DisplayOption {
  const sourceIndicators = option.evidence.map((e) => ({ claim: e.claim, indicator: e.indicator }));
  return {
    id: option.id,
    label: kind === "current" ? "Your current rotation" : option.label,
    kind,
    reason: option.reason,
    tradeOff: option.risks.find((r) => r.kind === "agronomic" || r.kind === "model-limit")?.text
      ?? "Costs, timing and field fit may differ; check locally before changing crops.",
    assumption: option.evidence.flatMap((e) => e.indicator.assumptions)[0] ?? option.explanations[0]?.input
      ?? "Typical crop calendars and library rules may differ from your variety and field.",
    unknown: option.unknowns[0] ?? "Local field and market conditions still need checking.",
    localCheck: option.risks.find((r) => r.action)?.action ?? "Check seed access, water, labour and buyer with a local adviser.",
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
  if (input.mode === "regional-preview") {
    return empty("regional-preview", "Regional examples", input.preview.message);
  }
  const { field, rotation, phase, data, comparison } = input;
  if (!field?.locationConfirmed || !rotation || rotation.source !== "farmer" || rotation.slots.length === 0) {
    return empty("field-incomplete", "Add your current crop sequence", "Confirm this field and save your actual crop sequence before comparing it with alternatives. Regional examples do not describe your field.");
  }
  if (input.resultRevision !== null && input.inputRevision !== input.resultRevision) {
    return empty("stale", "Inputs changed", "The earlier result is out of date. Re-evaluate the saved sequence and conditions.");
  }
  if (phase === "loading" && !comparison) return empty("evaluating", "Checking historical evidence", "Loading the available sources for the 2016–2025 replay.");
  if (phase === "failed" && !comparison) return empty("error", "Sources could not be loaded", "Your saved rotation is still here. Retry the data request.");
  if (!data || !comparison) return empty("data-unavailable", "Comparison data unavailable", "No historical result is ready for this field. Retry the data request.");

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
  const options = [displayOption(comparison.current, "current", data), ...selected.map((o) => displayOption(o, "alternative", data))];
  const ranking = comparison.mcda.ranking;
  // At the precision presented to farmers, effectively equal scores carry no first-place badge.
  const tiedFirst = ranking.length > 1 && ranking[0].score.toFixed(2) === ranking[1].score.toFixed(2);
  const replay = { ...baseline };
  const frame = `${baseline.completeYears} of ${expectedYears} complete years in the ${BASELINE.startYear}–${BASELINE.endYear} historical replay. This is not a next-season forecast.`;
  const common = { engineStatus: comparison.mcda.status, replay, options, tiedFirst, sourceStatuses: statuses, gaps: comparison.dataGaps };

  if (comparison.region === "unsupported" || alternatives.length === 0 || baseline.completeYears === 0 || comparison.rain.primary === "none") {
    const exclusions = [comparison.current, ...comparison.alternatives]
      .filter(o => o.fit === "does-not-fit")
      .map(o => `${o.label}: ${o.noFitReason ?? "The recorded crop sequence does not pass the field checks."}`);
    exclusions.push(...comparison.rejected.map(r => `${r.template.label}: ${r.reason}`));
    if (comparison.shortfall) exclusions.unshift(comparison.shortfall);
    if (comparison.region === "myanmar") {
      return { ...common, state: "unresolved", headline: "Your field history is available; regional alternatives need local review",
        detail: `${frame} This Myanmar location is supported for field history. No sourced regional rotation catalog is available here yet, so no alternative ranking is claimed. Your recorded crop assessment remains available below.`,
        gaps: [...new Set([...common.gaps, "Regional crop calendars and alternative rotation templates have not been supplied for this area."])] };
    }
    if (comparison.region === "unsupported") {
      return { ...common, gaps: [...new Set([...exclusions, ...common.gaps])], state: "data-unavailable",
        headline: "This field location resolves outside Myanmar",
        detail: `${frame} The saved field location resolves outside Myanmar. Confirm its location before using Myanmar crop information. Regional weather coverage alone cannot supply a supported crop catalog.` };
    }
    const weatherReady = baseline.completeYears > 0 && comparison.rain.primary !== "none";
    return { ...common, gaps: [...new Set([...common.gaps, ...exclusions])], state: "data-unavailable",
      headline: weatherReady ? "Too few eligible crop options to compare" : "No supported field comparison yet",
      detail: `${frame} ${comparison.mcda.note}${weatherReady ? " Weather coverage is available. Review the crop and field checks below; retrying weather will not change those inputs." : ""}` };
  }
  if (comparison.mcda.status === "unresolved" || !rankedIds.has(comparison.current.id)) {
    return { ...common, state: "unresolved", headline: "No ranking can be justified", detail: `${comparison.mcda.note} ${frame}` };
  }
  if (comparison.mcda.status !== "ranked" || baseline.completeYears < expectedYears || completeAlternatives.length < 2 || partialIds.size > 0) {
    return { ...common, state: "partial-evidence", headline: "Some evidence is still missing", detail: `${frame} ${comparison.mcda.note} ${completeAlternatives.length} alternatives have comparable evidence.` };
  }
  return { ...common, state: "comparable", headline: tiedFirst ? "The leading options are close" : "Compare your current rotation", detail: `${frame} These are model comparisons under stated assumptions, not guaranteed harvest or profit. ${comparison.mcda.note}` };
}
