import type { Field, Rotation } from "@/lib/types";
import type { ComparisonResult, EvaluatedOption } from "@/lib/engine/compare";
import type { EngineData } from "@/lib/engine/data";
import { regionName } from "@/lib/data/regions";
import { formatPoint } from "@/lib/geo/format";
import { formatArea } from "@/lib/units";
import { sequenceText, shortSlotName } from "@/lib/rotation-format";
import { prettifyNoteLine } from "@/lib/plan/handoff-note";
import { redactCoordinates } from "@/components/field/report-view";
import type { AppCopy } from "@/lib/store/locale-store";

export type KnowledgeState =
  | "confirmed"
  | "estimated"
  | "assumed"
  | "not_asked"
  | "unknown"
  | "unavailable"
  | "not_applicable"
  | "stale";

export interface Provenance {
  label: string;
  kind: "farmer" | "nasa" | "non_nasa" | "model";
  state: KnowledgeState;
  period?: { from: string; through: string };
  resolutionLabel?: string;
  fetchedAt?: string;
  notes?: string;
}

export interface DisplayMetric {
  value: number | null;
  unit: string;
  label: string;
  state: KnowledgeState;
  provenance: Provenance[];
  comparisonGroupId?: string;
  comparable: boolean;
  explanation?: string;
}

export interface ReportChoice {
  id: string;
  label: string;
  isFarmerCurrent: boolean;
  cropSequence: string[];
  cropIds: string[];
  cycleYears: number;
  shortfall: DisplayMetric;
  fieldScreeningStatus: "passed_checked_rules" | "failed" | "incomplete";
  fieldScreeningLabel: string;
  fieldScreeningRemaining?: string[];
  reason: string;
  verifiedBenefits: string[];
  unresolvedChecks: string[];
  cultivationPeriod?: string;
  daysWithCropShare: number;
  legumeShare: number | null;
  dryYearPasses?: { passes: number; evaluated: number };
  erosionExposure?: string;
}

export interface FarmerReport {
  reportId: string;
  generatedAt: string;
  fieldId: string;
  fieldName: string;
  regionLabel: string;
  regionId: string;
  centroid: [number, number];
  locationConfirmed: boolean;
  coordinatesText: string;
  hideExactLocation: boolean;
  area: { value: number | null; unit: string; state: KnowledgeState; text: string };
  waterAccess: { label: string; state: KnowledgeState };
  priorities: string[];
  priorityLabel: string;
  keyFindingText: string;
  keyFindingWarning?: string;
  isComparableFinding: boolean;
  showComparisonBars: boolean;
  maxComparableShortfall: number;
  choices: ReportChoice[];
  sources: Provenance[];
  checkLocallyQuestions: string[];
  localNotes: Array<{ topic: string; text: string }>;
  soilTestObservations: Array<{ property: string; value: string; depth: string; method: string; source: string }>;
  dataWarnings: string[];
  baselineYears: { start: number; end: number; count: number };
  processedAt: string;
  satelliteCheckingPending: boolean;
  engineVersion?: string;
}

export interface BuildFarmerReportParams {
  field: Field;
  comparison: ComparisonResult;
  rotations: Rotation[];
  engineData?: EngineData | null;
  hideLocation: boolean;
  areaUnit: "ha" | "acre";
  locale: "en" | "my";
  t: AppCopy;
  satellitePending?: boolean;
}

/** Pure adapter transforming comparison engine results into the farmer-facing truthful report model. */
export function buildFarmerReport({
  field,
  comparison,
  engineData,
  hideLocation,
  areaUnit,
  t,
  satellitePending = false,
}: BuildFarmerReportParams): FarmerReport {
  const rCopy = t.report;
  const scrub = (str: string) => (hideLocation ? redactCoordinates(str) : str);

  // 1. Evaluate choices
  const rawOptions: EvaluatedOption[] = [comparison.current, ...comparison.alternatives];

  const choices: ReportChoice[] = rawOptions.map((opt, idx) => {
    const isFarmerCurrent = idx === 0;
    const slots = opt.rotation.slots;
    const hasFallow = slots.some((s) => s.kind === "fallow" || s.cropId === "fallow");
    const cycleYears = opt.rotation.cycleYears || 1;
    const cropSequence = slots.map((s) =>
      s.kind === "fallow" ? "Fallow" : shortSlotName(s)
    );
    const cropIds = slots.map((s) => (s.kind === "fallow" ? "fallow" : (s.cropId ?? ""))).filter(Boolean);

    // Shortfall metric handling
    let shortfallState: KnowledgeState = "estimated";
    let shortfallValue: number | null = null;
    let comparable = false;
    let comparisonGroupId: string | undefined;
    let explanation: string | undefined;

    if (hasFallow) {
      shortfallState = "not_applicable";
      shortfallValue = null;
      comparable = false;
      comparisonGroupId = undefined;
      explanation = rCopy.fallowShortfallNote;
    } else if (cycleYears > 1) {
      shortfallValue = opt.metrics["water-shortfall"] != null ? Math.round(opt.metrics["water-shortfall"]) : null;
      shortfallState = shortfallValue !== null ? "estimated" : "unknown";
      comparable = false;
      comparisonGroupId = "multi-year-cycle";
      explanation = rCopy.multiYearShortfallNote;
    } else {
      shortfallValue = opt.metrics["water-shortfall"] != null ? Math.round(opt.metrics["water-shortfall"]) : null;
      shortfallState = shortfallValue !== null ? "estimated" : "unknown";
      comparable = shortfallValue !== null;
      comparisonGroupId = "single-year-rain-shortfall";
      explanation = rCopy.metricExplanation;
    }

    const shortfallProvenance: Provenance[] = [
      {
        label: "NASA POWER",
        kind: "nasa",
        state: "estimated",
        resolutionLabel: "0.5° × 0.625° (~50 km)",
      },
    ];

    const shortfall: DisplayMetric = {
      value: shortfallValue,
      unit: "mm per crop",
      label: rCopy.comparisonShortfallLabel,
      state: shortfallState,
      provenance: shortfallProvenance,
      comparisonGroupId,
      comparable,
      explanation,
    };

    // Screening status
    let fieldScreeningStatus: "passed_checked_rules" | "failed" | "incomplete" = "incomplete";
    let fieldScreeningLabel: string = rCopy.incompleteScreening;
    if (opt.fit === "fits") {
      fieldScreeningStatus = "passed_checked_rules";
      fieldScreeningLabel = rCopy.passedScreening;
    } else if (opt.fit === "does-not-fit") {
      fieldScreeningStatus = "failed";
      fieldScreeningLabel = rCopy.failedScreening;
    }

    return {
      id: opt.id,
      label: opt.label,
      isFarmerCurrent,
      cropSequence,
      cropIds,
      cycleYears,
      shortfall,
      fieldScreeningStatus,
      fieldScreeningLabel,
      fieldScreeningRemaining: opt.noFitReason ? [opt.noFitReason] : undefined,
      reason: opt.reason,
      verifiedBenefits: opt.badges.filter((b) => !b.includes("forage") && !b.includes("margin")),
      unresolvedChecks: opt.unknowns,
      cultivationPeriod: `${Math.round(opt.structure.coveredShare * 100)}% of cycle`,
      daysWithCropShare: opt.structure.coveredShare,
      legumeShare: opt.structure.legumeShare,
      dryYearPasses: opt.dryYear.evaluated > 0 ? { passes: opt.dryYear.passes, evaluated: opt.dryYear.evaluated } : undefined,
      erosionExposure: opt.erosion.exposure === "needs-slope-data" ? "needs-slope-data" : opt.erosion.exposure,
    };
  });

  // 2. Bar chart visibility rule:
  // Only show paired horizontal bars if the selected comparison group is
  // model-validated, has identical definition/time basis, and at least 2 comparable choices exist.
  const comparableChoices = choices.filter(
    (c) =>
      c.shortfall.state === "estimated" &&
      c.shortfall.value !== null &&
      c.shortfall.comparable &&
      Boolean(c.shortfall.comparisonGroupId)
  );

  const showComparisonBars =
    comparableChoices.length >= 2 &&
    comparableChoices.every(
      (c) => c.shortfall.comparisonGroupId === comparableChoices[0].shortfall.comparisonGroupId
    );

  const maxComparableShortfall = showComparisonBars
    ? Math.max(...comparableChoices.map((c) => c.shortfall.value ?? 0), 1)
    : 100;

  // 3. Key Finding calibrated interpretation:
  // Derived from validated engine outputs without an unguarded min/sort.
  const priority = field.priorities?.order[0] ?? "water";
  const priorityLabel = `${rCopy.priorityPrefix} ${t.profile.priority[priority] ?? "Save water"}`;

  let keyFindingText = "";
  let isComparableFinding = false;

  const currentChoice = choices[0];
  const eligibleAlt = choices.slice(1).find((c) => c.shortfall.comparable && c.shortfall.value !== null);

  if (
    currentChoice?.shortfall.comparable &&
    currentChoice.shortfall.value !== null &&
    eligibleAlt &&
    eligibleAlt.shortfall.value !== null
  ) {
    if (eligibleAlt.shortfall.value < currentChoice.shortfall.value) {
      keyFindingText = rCopy.findingWaterComp;
      isComparableFinding = true;
    } else {
      keyFindingText = rCopy.findingInconclusive;
    }
  } else {
    keyFindingText = rCopy.findingInconclusive;
  }

  // 4. Before you decide: Check Locally (Maximum 3 questions)
  const altCropName = eligibleAlt
    ? eligibleAlt.cropSequence.find((c) => c !== "Rice" && c !== "Fallow") ?? "green gram"
    : "green gram";

  const checkLocallyQuestions = [
    rCopy.checkSoilMoisture,
    rCopy.checkSeedMarket(altCropName),
    rCopy.checkWindow,
  ];

  // 5. Provenance & Evidence list
  const startYear = comparison.baseline.startYear;
  const endYear = comparison.baseline.endYear;
  const countYears = comparison.baseline.completeYears;

  const sources: Provenance[] = [
    {
      label: "NASA POWER",
      kind: "nasa",
      state: "estimated",
      period: { from: `${startYear}-01-01`, through: `${endYear}-12-31` },
      resolutionLabel: "0.5° × 0.625° (~50 km)",
      notes: rCopy.weatherSource(countYears, startYear, endYear),
    },
    {
      label: "ISRIC SoilGrids v2",
      kind: "non_nasa",
      state: engineData?.soil?.soilGridsAvailable ? "estimated" : "unavailable",
      resolutionLabel: "250 m, 0–30 cm",
      notes: rCopy.soilSource,
    },
    {
      label: "GPM IMERG",
      kind: "nasa",
      state: comparison.rain.primary === "R" ? "estimated" : "unavailable",
      resolutionLabel: "0.1° (~11 km)",
      notes: comparison.rain.primary === "R" ? "GPM IMERG calibrated rainfall used." : rCopy.imergUnavailable,
    },
    {
      label: "SMAP root-zone moisture",
      kind: "nasa",
      state: "unavailable",
      notes: rCopy.smapUnavailable,
    },
    {
      label: "SRTM terrain",
      kind: "nasa",
      state: "unavailable",
      notes: rCopy.srtmUnavailable,
    },
  ];

  // 6. Farmer local notes & observations
  const localNotes = (field.localNotes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(prettifyNoteLine)
    .map((n) => ({
      topic: scrub(n.topic),
      text: scrub(n.text),
    }));

  const soilTestObservations = (field.soilObservations ?? []).map((obs) => ({
    property: obs.property,
    value: `${obs.value} ${obs.units}`,
    depth: `${obs.depthCm[0]}–${obs.depthCm[1]} cm`,
    method: scrub(obs.method),
    source: scrub(obs.source),
  }));

  // Coordinates formatting
  const coordinatesText = hideLocation
    ? rCopy.locationHidden
    : `${formatPoint(field.centroid)}${field.locationConfirmed ? `, ${rCopy.confirmedByYou}` : `, ${rCopy.notConfirmed}`}`;

  // Area formatting
  const areaText = field.areaHa === null ? t.home.pinOnly : formatArea(field.areaHa, areaUnit);

  return {
    reportId: `fs-rep-${field.id}`,
    generatedAt: comparison.processedAt || new Date().toISOString(),
    fieldId: field.id,
    fieldName: scrub(field.name),
    regionLabel: regionName(field.region),
    regionId: field.region ?? "unsupported",
    centroid: field.centroid,
    locationConfirmed: Boolean(field.locationConfirmed),
    coordinatesText,
    hideExactLocation: hideLocation,
    area: {
      value: field.areaHa,
      unit: areaUnit,
      state: field.areaHa !== null ? "confirmed" : "unknown",
      text: areaText,
    },
    waterAccess: {
      label: t.irrigation[field.irrigation] ?? "Rain only",
      state: "confirmed",
    },
    priorities: field.priorities?.order ?? [],
    priorityLabel,
    keyFindingText,
    keyFindingWarning: rCopy.waterWarning,
    isComparableFinding,
    showComparisonBars,
    maxComparableShortfall,
    choices,
    sources,
    checkLocallyQuestions,
    localNotes,
    soilTestObservations,
    dataWarnings: [rCopy.waterWarning, rCopy.terrainWarning],
    baselineYears: { start: startYear, end: endYear, count: countYears },
    processedAt: comparison.processedAt.slice(0, 10),
    satelliteCheckingPending: satellitePending,
    engineVersion: "Field Shift 2.0 (Verified NASA POWER & SoilGrids)",
  };
}
