/**
 * The evidence contract. Every number the app shows comes with one of these:
 * where it came from, what it covers, how it was screened and what is missing.
 * Field names follow the 14 Nov 2026 NASA data handoff ("Data integration and
 * evidence contract"). They are application fields, not NASA parameter names.
 */

/** Bump when a formula, threshold rule or QA policy changes. Cache keys include it. */
export const PROCESSING_VERSION = "2026.11.1";

export type EvidenceKind =
  /** A measured quantity from an instrument or station. */
  | "observation"
  /** A model or reanalysis estimate, including NASA POWER and SMAP L4. */
  | "model-estimate"
  /** Something the farmer told us. Shown as theirs. */
  | "farmer-report"
  /** A laboratory or field soil test the farmer supplied. */
  | "lab"
  /** A what-if made by the app from stated assumptions. */
  | "scenario";

export type MissingReason =
  | "source-unconfigured"
  | "source-unavailable"
  | "source-pending"
  | "no-valid-observations"
  | "insufficient-coverage"
  | "missing-input"
  | "unsupported-region"
  | "not-evaluable";

export type SourceId = "P" | "R" | "M" | "V" | "T" | "G" | "E" | "soilgrids" | "farmer" | "crop-library" | "app";

export interface DerivedIndicator {
  id: string;
  fieldId: string;
  /** Region id, or "unsupported". */
  region: string;
  /** "point" or "polygon" analysis, or an explicitly labelled regional analysis. */
  geometryOrPoint: "point" | "polygon" | "regional";
  farmLocationConfirmed: boolean;

  indicatorName: string;
  kind: EvidenceKind;
  sourceId: SourceId;
  /** null only together with `missingReason`. A fill value is never turned into a number. */
  value: number | string | null;
  units: string;
  statistic: string;
  periodStart: string | null;
  periodEnd: string | null;

  product: string;
  productVersion: string | null;
  variableOrLayer: string;
  sourceUrl: string | null;
  doi: string | null;
  granuleIds: string[];
  observationTimes: string[];
  retrievedAt: string | null;
  sourceResolution: string;
  sourceCrs: string | null;
  /** What one source value physically represents, e.g. "0.5° x 0.625° cell". */
  nativeFootprint: string;
  aggregationMethod: string;
  /** "UTC" for the initial P/R comparison; "n/a" for static data. */
  timeStandard: string;

  qaPolicy: string;
  validCount: number | null;
  expectedCount: number | null;
  /** 0 to 1 share of the field with valid pixels, or null when unknown (a single pin). */
  spatialCoverage: number | null;

  missingReason: MissingReason | null;
  assumptions: string[];
  ruleSources: string[];
  processingVersion: string;
}

export type IndicatorInit = Partial<DerivedIndicator> &
  Pick<DerivedIndicator, "fieldId" | "indicatorName" | "sourceId" | "product" | "variableOrLayer">;

/** Builds an indicator with every contract field present, so nothing is silently undefined. */
export function makeIndicator(init: IndicatorInit): DerivedIndicator {
  const value = init.value ?? null;
  const base: DerivedIndicator = {
    id: `${init.sourceId}:${init.indicatorName}:${init.periodStart ?? "static"}`,
    fieldId: init.fieldId,
    indicatorName: init.indicatorName,
    sourceId: init.sourceId,
    product: init.product,
    variableOrLayer: init.variableOrLayer,
    region: "unsupported",
    geometryOrPoint: "point",
    farmLocationConfirmed: false,
    kind: "model-estimate",
    value: null,
    units: "",
    statistic: "",
    periodStart: null,
    periodEnd: null,
    productVersion: null,
    sourceUrl: null,
    doi: null,
    granuleIds: [],
    observationTimes: [],
    retrievedAt: null,
    sourceResolution: "",
    sourceCrs: null,
    nativeFootprint: "",
    aggregationMethod: "",
    timeStandard: "n/a",
    qaPolicy: "",
    validCount: null,
    expectedCount: null,
    spatialCoverage: null,
    missingReason: null,
    assumptions: [],
    ruleSources: [],
    processingVersion: PROCESSING_VERSION,
  };
  const merged: DerivedIndicator = { ...base, ...(init as Partial<DerivedIndicator>), value };
  merged.missingReason = value === null ? (init.missingReason ?? "not-evaluable") : null;
  return merged;
}

/** "6 of 10 seasons": counts are always shown with the number of eligible seasons. */
export function ofSeasons(events: number, eligible: number): string {
  return eligible === 0 ? "no complete seasons" : `${events} of ${eligible} seasons`;
}

export function isMissing(i: Pick<DerivedIndicator, "value">): boolean {
  return i.value === null;
}

const MISSING_TEXT: Record<MissingReason, string> = {
  "source-unconfigured": "Not connected: this source needs an Earthdata login on the server.",
  "source-unavailable": "The source did not answer.",
  "source-pending": "Still being retrieved.",
  "no-valid-observations": "No clear observations in this period.",
  "insufficient-coverage": "Too little of the field was covered by valid data.",
  "missing-input": "A required input has not been entered.",
  "unsupported-region": "Crop rules for this region are not in the library.",
  "not-evaluable": "Could not be evaluated from the data available.",
};

export function missingText(reason: MissingReason | null): string {
  return reason ? MISSING_TEXT[reason] : "";
}

/** One line a farmer or adviser can read under a number. */
export function provenanceLine(i: DerivedIndicator): string {
  const parts = [i.product + (i.productVersion ? ` ${i.productVersion}` : "")];
  if (i.sourceResolution) parts.push(i.sourceResolution);
  if (i.periodStart && i.periodEnd) parts.push(`${i.periodStart} to ${i.periodEnd}`);
  if (i.validCount !== null && i.expectedCount !== null) parts.push(`${i.validCount} of ${i.expectedCount} valid`);
  if (i.timeStandard && i.timeStandard !== "n/a") parts.push(i.timeStandard);
  return parts.join(" · ");
}
