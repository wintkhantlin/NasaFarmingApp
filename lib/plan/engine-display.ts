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

function farmerFriendlyGap(gap: string): string {
  if (gap.startsWith("GPM IMERG rainfall is not")) {
    return "Detailed satellite rain data is not available. We used NASA POWER regional rain estimates instead.";
  }
  if (gap === "SMAP regional soil moisture is not available.") {
    return "Regional soil-moisture information is not available, so the soil's starting moisture is unknown.";
  }
  if (gap.startsWith("HLS satellite vegetation observations are not available")) {
    return "Clear satellite crop-cover images are not available. Bare-soil periods come only from the crops and dates you entered.";
  }
  if (gap === "SRTM terrain is not available, so slope is unknown.") {
    return "Land-slope information is not available, so slope remains unknown.";
  }
  return gap;
}

function farmerFriendlyRisk(risk: string): string {
  if (risk === "Crop rules are species-level starting values, not validated for a variety.") {
    return "These checks use general crop information. Your local variety may behave differently.";
  }
  const heat = risk.match(/^(.+): (\d+) of (\d+) seasons had a day above (\d+) °C at flowering and pod or grain set\.$/);
  if (heat) {
    return `In ${heat[2]} of ${heat[3]} past seasons, ${heat[1]} had heat above ${heat[4]} °C during flowering or grain filling.`;
  }
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

function displayOption(option: EvaluatedOption, kind: DisplayOption["kind"], data: EngineData): DisplayOption {
  const sourceIndicators = option.evidence.map((e) => ({ claim: e.claim, indicator: e.indicator }));
  return {
    id: option.id,
    label: kind === "current" ? "Your current rotation" : option.label,
    kind,
    reason: option.reason,
    tradeOff: farmerFriendlyRisk(option.risks.find((r) => r.kind === "agronomic" || r.kind === "model-limit")?.text
      ?? "Costs, timing and field fit may differ; check locally before changing crops."),
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
  if (!field?.locationConfirmed) {
    return empty("field-incomplete", "Confirm where this field is", "Check the field location first. This helps us use crop information for the right part of Myanmar.");
  }
  if (rotation?.source === "strategy" && rotation.slots.length > 0) {
    return empty("field-incomplete", "Your plan is saved", "Next, add the crops grown on this field now. Use the dates you know—you do not need to guess exact dates. We will keep your saved plan while you do this.");
  }
  if (!rotation || rotation.slots.length === 0) {
    return empty("field-incomplete", "What do you grow on this field?", "Add the crops grown here now. This lets us compare your field with other choices without treating a regional example as your own history.");
  }
  if (input.resultRevision !== null && input.inputRevision !== input.resultRevision) {
    return empty("stale", "Your answers changed", "The earlier comparison no longer matches your answers. Check the crops and field details again.");
  }
  if (phase === "loading" && !comparison) return empty("evaluating", "Checking past seasons", "We are loading the available weather and field information from 2016–2025.");
  if (phase === "failed" && !comparison) return empty("error", "We could not load the field information", "Your saved crops are safe. Try loading the information again.");
  if (!data || !comparison) return empty("data-unavailable", "The comparison is not ready", "Your saved crops are safe. Try loading the information again.");

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
  const frame = `We checked ${baseline.completeYears} of ${expectedYears} complete past years from ${BASELINE.startYear}–${BASELINE.endYear}. This does not predict next season.`;
  const common = { engineStatus: comparison.mcda.status, replay, options, tiedFirst, sourceStatuses: statuses, gaps: comparison.dataGaps.map(farmerFriendlyGap) };

  if (comparison.region === "unsupported" || alternatives.length === 0 || baseline.completeYears === 0 || comparison.rain.primary === "none") {
    const exclusions = [comparison.current, ...comparison.alternatives]
      .filter(o => o.fit === "does-not-fit")
      .map(o => `${o.label}: ${o.noFitReason ?? "The recorded crop sequence does not pass the field checks."}`);
    exclusions.push(...comparison.rejected.map(r => `${r.template.label}: ${r.reason}`));
    if (comparison.shortfall) exclusions.unshift(comparison.shortfall);
    if (comparison.region === "myanmar") {
      return { ...common, state: "unresolved", headline: "Your crops can be checked, but local alternatives are not ready",
        detail: `${frame} We do not yet have a trusted local list of crop choices for this part of Myanmar, so we will not rank alternatives. You can still review the crops you entered below.`,
        gaps: [...new Set([...common.gaps, "A trusted local crop calendar and list of alternatives are not available for this area yet."])] };
    }
    if (comparison.region === "unsupported") {
      return { ...common, gaps: [...new Set([...exclusions, ...common.gaps])], state: "data-unavailable",
        headline: "This field appears to be outside Myanmar",
        detail: `${frame} Check the saved field location before using Myanmar crop information. Weather information alone cannot tell us which local crops are suitable.` };
    }
    const weatherReady = baseline.completeYears > 0 && comparison.rain.primary !== "none";
    return { ...common, gaps: [...new Set([...common.gaps, ...exclusions])], state: "data-unavailable",
      headline: weatherReady ? "Not enough crop choices to compare" : "A field comparison is not ready yet",
      detail: `${frame} Fewer than two crop choices passed the checks for this field.${weatherReady ? " The weather information is ready. Check the crop and field questions below; loading the weather again will not change those answers." : ""}` };
  }
  if (comparison.mcda.status === "unresolved" || !rankedIds.has(comparison.current.id)) {
    const topPriorityMissing = comparison.mcda.partial.some((candidate) => candidate.lacksTopPriority)
      || /(?:first|top)[ -]priority/i.test(comparison.mcda.note);
    const reason = topPriorityMissing
      ? "Information for your main priority is missing from at least one option."
      : "The available information is not enough to put these options in a fair order.";
    return { ...common, state: "unresolved", headline: "We cannot choose between these options yet", detail: `${reason} ${frame}` };
  }
  if (comparison.mcda.status !== "ranked" || baseline.completeYears < expectedYears || completeAlternatives.length < 2 || partialIds.size > 0) {
    const reason = comparison.mcda.status === "no-priorities"
      ? "Tell us what matters most to you before asking the app to put the choices in order."
      : "Some choices do not have the same information, so they are shown without a forced ranking.";
    return { ...common, state: "partial-evidence", headline: "Some information is still missing", detail: `${frame} ${reason} We have enough information to compare ${completeAlternatives.length} alternative${completeAlternatives.length === 1 ? "" : "s"}.` };
  }
  return { ...common, state: "comparable", headline: tiedFirst ? "The leading options are close" : "Compare your crops with other options", detail: `We checked these choices against ${baseline.completeYears} past years from ${BASELINE.startYear}–${BASELINE.endYear} and what you said matters. This does not predict next season or promise a profit.` };
}
