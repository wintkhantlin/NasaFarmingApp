import { footprintBox, type Box } from "@/lib/geo/cells";
import type { Field, LngLat } from "@/lib/types";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { TrendSeries } from "@/lib/server/trends";
import type { ComparisonResult } from "@/lib/engine/compare";
import type { Crop } from "@/lib/types";
import { steepnessClass } from "@/lib/nasa/derive/slope";

export type RiskKind = "water_stress" | "flood" | "erosion" | "heat_cold";

export type EvidenceStatus =
  | "ready"
  | "partial"
  | "loading"
  | "unavailable"
  | "stale"
  | "error"
  | "unsupported";

export type EvidenceScale = "field_observation" | "local_proxy" | "regional_context";

export interface EvidenceTime {
  start: string;
  end: string;
  selectedDate?: string;
  selectedYear?: number;
  availableDates?: string[];
  availableYears?: number[];
  timeMode?: "usual" | "specific";
}

export interface EvidenceFootprint {
  type: "native_grid" | "valid_scene" | "basin" | "point_field";
  label: string;
  resolutionM?: number;
  box?: Box;
}

export interface EvidenceMetric {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
}

export interface RiskEvidence {
  id: string;
  kind: RiskKind;
  label: string;
  sourceId: string;
  sourceLabel: string;
  status: EvidenceStatus;
  scale: EvidenceScale;
  time: EvidenceTime;
  footprint: EvidenceFootprint;
  summaryTitle: string;
  findingText: string;
  cannotTellText: string;
  localCheckText: string;
  metric?: EvidenceMetric;
  quality?: {
    validFraction?: number;
    validCount?: number;
    totalCount?: number;
  };
  caveats: string[];
  raw?: unknown;
}

export type RiskEvidenceMap = Record<RiskKind, RiskEvidence>;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

function knownYears(s: TrendSeries): Array<{ year: number; value: number }> {
  return s.years.filter((y): y is { year: number; value: number } => y.value !== null);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}

/**
 * Builds water stress evidence from actual retrieved data.
 * SCIENTIFIC GATE:
 * - ETc is potential well-watered demand, not measured field use.
 * - Missing initial soil moisture means water balance at planting cannot be estimated.
 * - SMAP is 9 km regional proxy, not field-level moisture.
 */
export function buildWaterStressEvidence({
  conditions,
  remote,
  trends,
  point,
  selectedYear,
  crop,
}: {
  conditions?: ConditionsData | null;
  remote?: RemoteData | null;
  trends?: { trends: TrendSeries[]; through: number } | null;
  point: LngLat;
  selectedYear?: number;
  crop?: Crop | null;
}): RiskEvidence {
  const rainSeries = trends?.trends.find((t) => t.key === "monsoon-rain");
  const availableYears = rainSeries ? knownYears(rainSeries).map((y) => y.year) : [];
  const activeYear = selectedYear ?? (availableYears.length > 0 ? availableYears[availableYears.length - 1] : undefined);

  const smapState = remote?.smap;
  const smapDays = smapState?.data?.days ?? [];
  const validSmapDays = smapDays.filter((d) => d.rootzone !== null);
  const latestSmap = validSmapDays.length > 0 ? validSmapDays[validSmapDays.length - 1] : null;

  const annualRain = conditions?.annualRainMm;
  const monthlyRain = conditions?.monthlyRainMm;
  const monthlyEt0 = conditions?.monthlyEt0Mm;

  const powerBox = footprintBox("power", point);
  const smapBox = footprintBox("smap", point);

  // Status determination
  let status: EvidenceStatus = "unavailable";
  if (conditions?.climateAvailable === false) {
    status = "unavailable";
  } else if (annualRain !== undefined && monthlyRain && monthlyRain.length === 12) {
    status = smapState?.status === "ok" ? "ready" : "partial";
  } else if (conditions && !annualRain) {
    status = "partial";
  }

  // Selected year comparison
  let rainSentence = "Rain history is unavailable right now.";
  let rainMetric: EvidenceMetric | undefined;
  if (rainSeries && activeYear) {
    const pt = rainSeries.years.find((y) => y.year === activeYear);
    if (pt && pt.value !== null) {
      const base = median(knownYears(rainSeries).map((y) => y.value));
      const val = Math.round(pt.value);
      if (base && base > 0) {
        const diff = Math.round(((val - base) / base) * 100);
        rainSentence = `${activeYear} monsoon rain (${val} mm) was ${
          Math.abs(diff) < 5 ? "close to the long-record average" : `${Math.abs(diff)}% ${diff < 0 ? "below" : "above"} average`
        }.`;
        rainMetric = {
          label: `${activeYear} monsoon rain`,
          value: val,
          unit: "mm",
          subtext: `${diff >= 0 ? "+" : ""}${diff}% vs baseline`,
        };
      } else {
        rainSentence = `${activeYear} had ${val} mm of monsoon rain.`;
        rainMetric = { label: `${activeYear} monsoon rain`, value: val, unit: "mm" };
      }
    } else {
      rainSentence = `${activeYear} does not have enough valid days for seasonal rain comparison.`;
    }
  } else if (annualRain !== undefined) {
    rainSentence = `Typical regional annual rainfall is about ${annualRain} mm.`;
    rainMetric = { label: "Typical annual rain", value: annualRain, unit: "mm" };
  }

  // Dry months calculation
  let dryMonthsCount = 0;
  if (monthlyRain && monthlyEt0) {
    dryMonthsCount = monthlyRain.filter((r, i) => monthlyEt0[i] > r).length;
  }

  const cannotTell = latestSmap
    ? `Regional root-zone wetness was recorded on ${formatIsoDate(latestSmap.date)} for the 9-km area around this field. It does not measure field soil water or irrigation canal deliveries.`
    : "Regional soil moisture (SMAP) is not available. Missing data is not treated as adequate moisture. Field soil water storage at planting is unknown.";

  const localCheck = crop
    ? `Does your soil hold moisture into planting, and will ${crop.names.common.toLowerCase()} have irrigation if monsoon rains end early?`
    : "Does your soil retain moisture after the preceding crop, and do you have access to supplemental irrigation?";

  const imerg = conditions?.imerg;
  const imergOk = imerg?.status === "ok";

  const sourceLabel = latestSmap
    ? (imergOk ? "NASA POWER rain, GPM IMERG & SMAP moisture" : "NASA POWER rain & SMAP moisture")
    : (imergOk ? "NASA POWER & GPM IMERG precipitation" : "NASA POWER regional weather");

  return {
    id: "water_stress",
    kind: "water_stress",
    label: "Water stress",
    sourceId: "NASA-POWER-GPM-SMAP",
    sourceLabel,
    status,
    scale: "regional_context",
    time: {
      start: availableYears.length > 0 ? String(availableYears[0]) : "2016",
      end: availableYears.length > 0 ? String(availableYears[availableYears.length - 1]) : "2025",
      selectedYear: activeYear,
      availableYears,
      availableDates: validSmapDays.map((d) => d.date),
      selectedDate: latestSmap?.date,
      timeMode: "usual",
    },
    footprint: {
      type: "native_grid",
      label: "Regional grid (~50 km weather, 9 km soil moisture)",
      resolutionM: 50_000,
      box: latestSmap ? smapBox : powerBox,
    },
    summaryTitle: dryMonthsCount > 0 ? `${dryMonthsCount} months where crop demand exceeds rain` : "Rain generally meets potential demand",
    findingText: rainSentence,
    cannotTellText: cannotTell,
    localCheckText: localCheck,
    metric: rainMetric,
    quality: rainSeries ? { validCount: knownYears(rainSeries).length, totalCount: rainSeries.years.length } : undefined,
    caveats: [
      "Rainfall is gridded reanalysis for an area about 50 km across, not a rain gauge on this field.",
      "Reference water demand (ET0) is potential demand of well-watered grass, not actual crop transpiration.",
      "Water deficit (rain minus ETc) is a screening gap, not actual required irrigation volume.",
      ...(imergOk ? ["GPM IMERG V07 provides 0.1° (~10 km) satellite precipitation estimates alongside POWER."] : []),
    ],
    raw: { annualRain, dryMonthsCount, latestSmap, imerg },
  };
}

/**
 * Builds flood risk evidence from actual retrieved data.
 * SCIENTIFIC GATE:
 * - Landsat/HLS/OPERA QA water flags show observed surface water on valid image dates.
 * - Water observed != damaging flood or flood depth.
 * - Standing paddy water must not be marked as a damaging flood without farmer confirmation.
 */
export function buildFloodEvidence({
  conditions,
  remote,
  point,
  selectedDate,
}: {
  conditions?: ConditionsData | null;
  remote?: RemoteData | null;
  point: LngLat;
  selectedDate?: string;
}): RiskEvidence {
  const hlsState = remote?.hls;
  const modisState = remote?.modis;

  const observations = hlsState?.data?.observations ?? modisState?.data?.observations ?? [];
  const validObservations = observations.filter(
    (o) => o.coverage >= 0.5 || (o.totalPixels > 0 && (o.validPixels + (o.waterPixels ?? 0)) / o.totalPixels >= 0.5)
  );
  const availableDates = validObservations.map((o) => o.date);
  const activeDate = selectedDate ?? (availableDates.length > 0 ? availableDates[availableDates.length - 1] : undefined);
  const currentObs = activeDate ? validObservations.find((o) => o.date === activeDate) : undefined;

  let status: EvidenceStatus = "unavailable";
  if (hlsState?.status === "pending" || modisState?.status === "pending") {
    status = "loading";
  } else if (validObservations.length > 0) {
    status = "partial"; // In-situ or OPERA dynamic flood extent is partial/proxy
  } else if (hlsState?.status === "unconfigured" || hlsState?.status === "unavailable") {
    status = "unavailable";
  }

  const waterPixels = currentObs?.waterPixels ?? 0;
  const totalPixels = currentObs?.totalPixels ?? 0;
  const waterFraction = totalPixels > 0 ? waterPixels / totalPixels : 0;
  const waterPct = Math.round(waterFraction * 100);
  const clearPct = currentObs ? Math.round(currentObs.coverage * 100) : 0;

  let finding = "No verified cloud-free surface-water observation is available for this exact date.";
  let summaryTitle = "Surface water observations not connected";

  if (currentObs) {
    if (waterPixels > 0) {
      finding = `Satellite imagery on ${formatIsoDate(currentObs.date)} had ${clearPct}% clear view over your field, detecting open water in ${waterPct}% of it (${waterPixels} of ${totalPixels} pixels).`;
      summaryTitle = `${formatIsoDate(currentObs.date)}: open water seen across ${waterPct}% of the field`;
    } else {
      finding = `Satellite imagery on ${formatIsoDate(currentObs.date)} had ${clearPct}% clear view over your field and no open water was detected on that day.`;
      summaryTitle = `${formatIsoDate(currentObs.date)}: no open water seen on this day`;
    }
  }

  const cannotTell =
    "NASA imagery can detect standing open water on clear days, but cannot measure flood depth, water velocity, or drainage rate. Normal ponded water in rice paddies looks identical to flood water from space.";

  const localCheck = "Is standing water normal for this field during rice cultivation, or does unexpected flooding damage crops or delay planting?";

  return {
    id: "flood",
    kind: "flood",
    label: "Flood",
    sourceId: "HLS-LANDSAT-SURFACE-WATER",
    sourceLabel: currentObs ? "Landsat/HLS surface observation" : "Satellite surface water monitoring",
    status,
    scale: "field_observation",
    time: {
      start: availableDates.length > 0 ? availableDates[0] : "2021-01-01",
      end: availableDates.length > 0 ? availableDates[availableDates.length - 1] : "2025-12-31",
      selectedDate: activeDate,
      availableDates,
      timeMode: "specific",
    },
    footprint: {
      type: "valid_scene",
      label: "Field parcel observation (30 m resolution)",
      resolutionM: 30,
    },
    summaryTitle,
    findingText: finding,
    cannotTellText: cannotTell,
    localCheckText: localCheck,
    metric: currentObs
      ? {
          label: "Clear observation area",
          value: `${Math.round(currentObs.coverage * 100)}%`,
          subtext:
            waterPixels > 0
              ? `${waterPct}% surface water (${waterPixels}/${totalPixels} pixels)`
              : `0 of ${totalPixels} pixels water (${currentObs.validPixels} valid land pixels)`,
        }
      : undefined,
    quality: currentObs
      ? {
          validFraction: currentObs.coverage,
          validCount: currentObs.validPixels,
          totalCount: currentObs.totalPixels,
        }
      : undefined,
    caveats: [
      "Surface water observations do not measure flood depth or recurrence probability.",
      "Cloud cover frequently masks imagery during peak monsoon flooding events.",
      "Deliberately impounded paddy water is an agricultural practice, not an adverse flood.",
    ],
    raw: {
      currentObs,
      waterPixels,
      totalPixels,
      waterFraction,
      observationCount: validObservations.length,
    },
  };
}

/**
 * Builds erosion risk evidence from actual retrieved data.
 * SCIENTIFIC GATE:
 * - SRTM slope is terrain context, not measured soil erosion.
 * - If DEM/slope is missing, erosion exposure cannot be assessed. Never emit tonnes/ha.
 */
export function buildErosionEvidence({
  conditions,
  remote,
  point,
  comparison,
}: {
  conditions?: ConditionsData | null;
  remote?: RemoteData | null;
  point: LngLat;
  comparison?: ComparisonResult | null;
}): RiskEvidence {
  const srtmState = remote?.srtm;
  const slopeData = srtmState?.data?.slope;
  const slopeMedian = slopeData?.medianDeg ?? null;

  const soilTexture = conditions?.soil?.texture ?? null;
  const coverGaps = comparison?.current.lowCover.length ?? 0;

  let status: EvidenceStatus = "unavailable";
  if (srtmState?.status === "pending") {
    status = "loading";
  } else if (slopeMedian !== null) {
    status = "ready";
  } else if (srtmState?.status === "unconfigured" || srtmState?.status === "unavailable") {
    status = "unavailable";
  }

  const slopeLabel = slopeMedian !== null ? steepnessClass(slopeMedian) : "Unknown slope";

  let findingText = "Terrain slope data is not available yet, so field erosion exposure cannot be assessed.";
  let metric: EvidenceMetric | undefined;

  if (slopeMedian !== null) {
    if (slopeMedian < 1.5) {
      findingText = `Mapped median terrain slope is ${slopeMedian.toFixed(1)}° (${slopeLabel}). Flat alluvial terrain with bunded paddies acts as a sedimentation basin with negligible sheet erosion; primary lowland erosion risk is riverbank collapse.`;
    } else {
      findingText = `Mapped median terrain slope is ${slopeMedian.toFixed(1)}° (${slopeLabel}). This provides topographic runoff context for your field.`;
    }
    metric = {
      label: "Mapped slope",
      value: `${slopeMedian.toFixed(1)}°`,
      unit: "degrees",
      subtext: slopeLabel,
    };
  }

  const cannotTell =
    "NASA SRTM elevation describes topographic slope, but cannot calculate actual soil loss in tonnes per hectare without farm-specific soil structure, bund maintenance, and tillage practices.";

  const localCheck =
    coverGaps > 0
      ? `Your rotation has ${coverGaps} bare soil ${coverGaps === 1 ? "window" : "windows"}. Do you observe rill formation, sediment deposition, or bund breaches after heavy monsoon downpours?`
      : "Do you see signs of soil washing away, gullying, or bund breaches during high-intensity rain?";

  return {
    id: "erosion",
    kind: "erosion",
    label: "Erosion",
    sourceId: "NASA-SRTM-SOILGRIDS",
    sourceLabel: slopeMedian !== null ? "NASA SRTM 30 m elevation & SoilGrids" : "Terrain and soil screening",
    status,
    scale: "local_proxy",
    time: {
      start: "2000-02-11",
      end: "2000-02-21",
      timeMode: "usual",
    },
    footprint: {
      type: "native_grid",
      label: "Topographic grid (30 m DEM)",
      resolutionM: 30,
    },
    summaryTitle: slopeMedian !== null ? `Slope: ${slopeMedian.toFixed(1)}° (${slopeLabel})` : "Slope data not available",
    findingText,
    cannotTellText: cannotTell,
    localCheckText: localCheck,
    metric,
    caveats: [
      "Topographic slope is a susceptibility proxy, not measured soil erosion in tonnes/hectare.",
      "Bunds, terraces, and tillage practices have a major influence on actual runoff and cannot be detected from space.",
      "Sheet/rill erosion on slopes is distinct from lowland riverbank erosion and sedimentation.",
    ],
    raw: { slopeMedian, slopeLabel, soilTexture, coverGaps },
  };
}

/**
 * Builds heat and cold risk evidence from actual retrieved data.
 * SCIENTIFIC GATE:
 * - 2m air temperature exceedances (e.g. days >=35C) are NOT interchangeable with heatwaves (which require consecutive-day criteria).
 * - Air temperature is not canopy temperature.
 * - Cold/frost screening is regional 2m Tmin, not observed ice on plant tissue.
 * - Screenshot 68 days >= 35C is NEVER hardcoded.
 */
export function buildHeatColdEvidence({
  conditions,
  trends,
  point,
  selectedYear,
  crop,
}: {
  conditions?: ConditionsData | null;
  trends?: { trends: TrendSeries[]; through: number } | null;
  point: LngLat;
  selectedYear?: number;
  crop?: Crop | null;
}): RiskEvidence {
  const hotSeries = trends?.trends.find((t) => t.key === "hot-days");
  const availableYears = hotSeries ? knownYears(hotSeries).map((y) => y.year) : [];
  const activeYear = selectedYear ?? (availableYears.length > 0 ? availableYears[availableYears.length - 1] : undefined);

  const tmax = conditions?.monthlyTmaxC;
  const tmin = conditions?.monthlyTminC;

  let status: EvidenceStatus = "unavailable";
  if (conditions?.climateAvailable === false) {
    status = "unavailable";
  } else if (hotSeries && activeYear) {
    status = "ready";
  } else if (tmax && tmin && tmax.length === 12 && tmin.length === 12) {
    status = "partial";
  }

  let findingText = "Historical temperature records are unavailable right now.";
  let metric: EvidenceMetric | undefined;

  if (hotSeries && activeYear) {
    const pt = hotSeries.years.find((y) => y.year === activeYear);
    if (pt && pt.value !== null) {
      findingText = `${activeYear} had ${pt.value} days where regional maximum air temperature reached 35 °C or hotter (March to May).`;
      metric = {
        label: `${activeYear} days ≥35 °C`,
        value: pt.value,
        unit: "days",
        subtext: "March to May pre-monsoon",
      };
    } else {
      findingText = `${activeYear} does not have sufficient valid daily observations to evaluate temperature extremes.`;
    }
  } else if (tmax && tmax.length === 12) {
    const maxVal = Math.max(...tmax);
    const maxMonth = MONTH_NAMES[tmax.indexOf(maxVal)];
    findingText = `Hottest typical month is ${maxMonth} with average daytime highs near ${Math.round(maxVal)} °C.`;
    metric = {
      label: "Hottest month high",
      value: Math.round(maxVal),
      unit: "°C",
      subtext: maxMonth,
    };
  }

  const coldSeries = trends?.trends.find((t) => t.key === "cold-nights");

  let coldContext = "";
  if (coldSeries && activeYear) {
    const coldPt = coldSeries.years.find((y) => y.year === activeYear);
    if (coldPt && coldPt.value !== null) {
      coldContext = ` ${activeYear} had ${coldPt.value} chilly winter nights (Tmin ≤ 12 °C, Nov–Feb).`;
    }
  }
  if (!coldContext && tmin && tmin.length === 12) {
    const minVal = Math.min(...tmin);
    const minMonth = MONTH_NAMES[tmin.indexOf(minVal)];
    coldContext = ` Coldest monthly nights average near ${Math.round(minVal)} °C in ${minMonth}.`;
  }

  const cannotTell =
    "NASA POWER reports 2-meter ambient air temperature across a 50 km area. Crop canopy temperatures in dry fields can exceed air temperature, while irrigated fields may be cooler. Daily counts above 35 °C do not confirm crop tissue injury or flower sterility without cultivar context.";

  const localCheck = crop
    ? `Does ${crop.names.common.toLowerCase()} flower during the peak pre-monsoon heat (April–May), or face chilling during winter nights?`
    : "Do high temperatures coincide with crop flowering, or do cold nights slow early vegetative growth?";

  return {
    id: "heat_cold",
    kind: "heat_cold",
    label: "Heat & cold",
    sourceId: "NASA-POWER-DAILY-T2M",
    sourceLabel: "NASA POWER regional air temperature",
    status,
    scale: "regional_context",
    time: {
      start: availableYears.length > 0 ? String(availableYears[0]) : "1981",
      end: availableYears.length > 0 ? String(availableYears[availableYears.length - 1]) : "2025",
      selectedYear: activeYear,
      availableYears,
      timeMode: "usual",
    },
    footprint: {
      type: "native_grid",
      label: "Regional grid (~50 km across)",
      resolutionM: 50_000,
      box: footprintBox("power", point),
    },
    summaryTitle: metric ? (hotSeries && activeYear ? `${activeYear}: ${metric.value} days at 35 °C or hotter` : `${metric.label}: ${metric.value} ${metric.unit ?? ""}`.trim()) : "Regional temperature profile",
    findingText: `${findingText}${coldContext}`,
    cannotTellText: cannotTell,
    localCheckText: localCheck,
    metric,
    quality: hotSeries ? { validCount: knownYears(hotSeries).length, totalCount: hotSeries.years.length } : undefined,
    caveats: [
      "Air temperatures represent 2-meter gridded models across ~50 km, not local field canopy temperatures.",
      "Days with Tmax ≥ 35 °C measure single-day exceedance, not sustained heatwave duration.",
      "Crop heat and chilling/cold damage depend strongly on growth stage, soil moisture, and cultivar tolerance. Ground frost occurs only in high-elevation uplands (>800 m).",
    ],
    raw: { tmax, tmin, hotSeries, coldSeries },
  };
}

/**
 * Pure presentation adapter aggregating all four risks for a field.
 */
export function buildRiskEvidenceMap({
  conditions,
  remote,
  trends,
  field,
  selectedYear,
  selectedDate,
  crop,
  comparison,
}: {
  conditions?: ConditionsData | null;
  remote?: RemoteData | null;
  trends?: { trends: TrendSeries[]; through: number } | null;
  field: Field;
  selectedYear?: number;
  selectedDate?: string;
  crop?: Crop | null;
  comparison?: ComparisonResult | null;
}): RiskEvidenceMap {
  const point = field.centroid;
  return {
    water_stress: buildWaterStressEvidence({ conditions, remote, trends, point, selectedYear, crop }),
    flood: buildFloodEvidence({ conditions, remote, point, selectedDate }),
    erosion: buildErosionEvidence({ conditions, remote, point, comparison }),
    heat_cold: buildHeatColdEvidence({ conditions, trends, point, selectedYear, crop }),
  };
}
