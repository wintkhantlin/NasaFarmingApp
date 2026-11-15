import type { Field } from "@/lib/types";
import type { RemoteData } from "@/lib/store/data-cache";
import type { TrendSeries } from "@/lib/server/trends";
import { REGIONS } from "@/lib/data/regions";
import type {
  EvidenceStatus,
  RiskEvidence,
  RiskEvidenceMap,
  RiskKind,
} from "@/lib/conditions/condition-evidence";

/**
 * Presentation model for the field risk explorer. Nothing here calculates science:
 * it only re-labels, orders and summarises what `condition-evidence.ts` already decided.
 */

export const RISK_ORDER: RiskKind[] = ["water_stress", "flood", "erosion", "heat_cold"];

export const RISK_META: Record<RiskKind, { label: string; short: string; icon: "water" | "salinity" | "clay" | "conditions" }> = {
  water_stress: { label: "Water stress", short: "Water", icon: "water" },
  flood: { label: "Flood", short: "Flood", icon: "salinity" },
  erosion: { label: "Erosion", short: "Erosion", icon: "clay" },
  heat_cold: { label: "Heat & cold", short: "Heat & cold", icon: "conditions" },
};

/** Words for the farmer. "ready" never means "safe": it only means we have data to show. */
export const AVAILABILITY: Record<EvidenceStatus, { label: string; tone: "ok" | "partial" | "missing" | "busy" | "error" }> = {
  ready: { label: "Data available", tone: "ok" },
  partial: { label: "Some data only", tone: "partial" },
  loading: { label: "Checking data", tone: "busy" },
  unavailable: { label: "No data for this field", tone: "missing" },
  stale: { label: "Older record", tone: "partial" },
  error: { label: "Source problem", tone: "error" },
  unsupported: { label: "Not covered here", tone: "missing" },
};

export const SCALE_WORD: Record<RiskEvidence["scale"], string> = {
  regional_context: "Wider area",
  local_proxy: "Your field (estimated)",
  field_observation: "Your field",
};

/** What the map does and does not show for each risk. No colour is drawn that the data cannot support. */
export const OVERLAY_NOTE: Record<RiskKind, string> = {
  water_stress:
    "No colour map: rain and soil moisture are averages over the dashed grid cell, not measured inside your field.",
  flood:
    "No water-extent map: the satellite reports the share of your parcel seen as open water on the chosen date.",
  erosion:
    "No erosion map: the figure is the middle terrain slope inside your parcel, not soil loss.",
  heat_cold:
    "No temperature map: values describe the dashed ~50 km weather cell, not the air over your field.",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const IRRIGATION_WORD: Record<Field["irrigation"], string> = {
  none: "Rainfed",
  supplemental: "Some irrigation",
  full: "Irrigated",
};

/** "Field 4 · Ayeyarwady · Rainfed". Missing or unsupported parts are left out, never printed as "none". */
export function fieldIdentity(field: Pick<Field, "name" | "region" | "irrigation">): { name: string; context: string } {
  const region = field.region && field.region !== "unsupported" ? REGIONS[field.region]?.name : undefined;
  const irrigation = field.irrigation ? IRRIGATION_WORD[field.irrigation] : undefined;
  return { name: field.name, context: [region, irrigation].filter(Boolean).join(" · ") };
}

export interface TimelinePoint {
  key: string;
  label: string;
  value: number | null;
}

export interface TimelineModel {
  id: string;
  /** "Monsoon rain (Jun to Oct)" */
  title: string;
  unit: string;
  /** years are chosen with onYearChange, dates with onDateChange */
  axis: "year" | "date";
  points: TimelinePoint[];
  selectedKey?: string;
  /** Long-record middle value. Only for yearly series with at least five valid years. */
  baseline?: { label: string; value: number; years: string };
  period: string;
  emptyText: string;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}

function yearModel(series: TrendSeries | undefined, id: string, title: string, unit: string, selectedYear: number | undefined, emptyText: string): TimelineModel | null {
  if (!series) return null;
  const known = series.years.filter((y) => y.value !== null) as Array<{ year: number; value: number }>;
  const base = known.length >= 5 ? median(known.map((y) => y.value)) : null;
  const first = series.years[0]?.year;
  const last = series.years[series.years.length - 1]?.year;
  return {
    id,
    title,
    unit,
    axis: "year",
    points: series.years.map((y) => ({ key: String(y.year), label: String(y.year), value: y.value })),
    selectedKey: selectedYear !== undefined ? String(selectedYear) : undefined,
    baseline: base !== null && first !== undefined && last !== undefined ? { label: "Median of all years shown", value: Math.round(base), years: `${first}–${last}` } : undefined,
    period: first !== undefined && last !== undefined ? `${first}–${last}` : "",
    emptyText,
  };
}

/**
 * The historical strip under each risk. Years for POWER series, scene dates for satellite water.
 * Erosion has no time dimension (a one-off 2000 terrain survey), so it returns an empty list on purpose.
 */
export function buildTimelines(
  kind: RiskKind,
  ctx: {
    evidence: RiskEvidence;
    trends?: { trends: TrendSeries[]; through: number } | null;
    remote?: RemoteData | null;
  },
): TimelineModel[] {
  const { evidence, trends, remote } = ctx;
  const find = (key: TrendSeries["key"]) => trends?.trends.find((t) => t.key === key);
  const year = evidence.time.selectedYear;

  if (kind === "water_stress") {
    const m = yearModel(find("monsoon-rain"), "monsoon-rain", "Monsoon rain, Jun to Oct", "mm", year, "No yearly rain record has loaded for this area.");
    return m ? [m] : [];
  }

  if (kind === "heat_cold") {
    const hot = yearModel(find("hot-days"), "hot-days", "Hot days, Mar to May (35 °C or more)", "days", year, "No yearly temperature record has loaded for this area.");
    const cold = yearModel(find("cold-nights"), "cold-nights", "Cool nights, Nov to Feb (12 °C or less)", "nights", year, "No yearly temperature record has loaded for this area.");
    return [hot, cold].filter((m): m is TimelineModel => m !== null);
  }

  if (kind === "flood") {
    const obs = remote?.hls?.data?.observations ?? remote?.modis?.data?.observations ?? [];
    const valid = new Set(evidence.time.availableDates ?? []);
    const points: TimelinePoint[] = obs
      .filter((o) => valid.has(o.date))
      .map((o) => ({
        key: o.date,
        label: formatShortDate(o.date),
        value: o.totalPixels > 0 ? Math.round(((o.waterPixels ?? 0) / o.totalPixels) * 100) : null,
      }));
    if (points.length === 0) return [];
    return [
      {
        id: "surface-water",
        title: "Open water seen on clear-sky dates",
        unit: "% of parcel",
        axis: "date",
        points,
        selectedKey: evidence.time.selectedDate,
        period: `${points[0].label} – ${points[points.length - 1].label}`,
        emptyText: "No clear-sky satellite scene has been recorded for this parcel.",
      },
    ];
  }

  return [];
}

/** Shown right under the finding, because one reading is easy to over-trust. */
export const HALF_CAVEAT: Partial<Record<RiskKind, string>> = {
  flood: "One clear day does not rule out flooding on other days. Standing water in a paddy looks the same from space.",
};

export function peekLine(evidence: RiskEvidence): string {
  const parts: string[] = [SCALE_WORD[evidence.scale]];
  const t = evidence.time;
  if (evidence.kind === "flood" && t.selectedDate) parts.push(formatShortDate(t.selectedDate));
  else if (evidence.kind === "erosion") parts.push("Terrain survey, 2000");
  else if (t.selectedYear) parts.push(`${t.selectedYear} selected · record ${t.start}–${t.end}`);
  else parts.push(`${t.start}–${t.end}`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------------------------
// Map data styling. Every colour here is driven by a real number from the evidence contract, and
// it is applied to the real footprint of that number: the whole data cell for regional sources,
// the whole field for parcel sources. Nothing is interpolated or drawn inside a shape.
// ---------------------------------------------------------------------------------------------

export const DATA_COLOR = { water: "#1d5c91", heat: "#9c3d12", drought: "#7a4a00", frost: "#4850a6", none: "#8b8f88" } as const;

export interface MapViz {
  /** Tint over the data cell (regional sources). */
  cell?: { color: string; opacity: number };
  /** Tint over the field outline (parcel sources). */
  field?: { color: string; opacity: number };
  /** The one readout that sits on the map. */
  readout: { value: string; note: string; scope: string; color: string; missing?: boolean };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function selectedPoint(m?: TimelineModel) {
  return m?.points.find((p) => p.key === m.selectedKey) ?? null;
}

export function buildMapViz(evidence: RiskEvidence, timelines: TimelineModel[]): MapViz {
  const cellScope = evidence.footprint.box
    ? `One value for the whole ${evidence.footprint.resolutionM && evidence.footprint.resolutionM >= 1000 ? `~${Math.round(evidence.footprint.resolutionM / 1000)} km ` : ""}data cell`
    : "One value for the whole field";

  if (evidence.status === "unavailable" || evidence.status === "unsupported") {
    return { readout: { value: "No data", note: "Not a sign that the field is safe", scope: "Nothing is drawn on the map", color: DATA_COLOR.none, missing: true } };
  }
  const raw = evidence.raw as Record<string, unknown> | undefined;
  const year = evidence.time.selectedYear;

  if (evidence.kind === "water_stress") {
    const m = timelines[0];
    const p = selectedPoint(m);
    if (m && p && p.value !== null) {
      const base = m.baseline?.value;
      if (base) {
        const pct = Math.round(((p.value - base) / base) * 100);
        const a = clamp((p.value - base) / base, -0.3, 0.3);
        const color = a < 0 ? DATA_COLOR.drought : DATA_COLOR.water;
        return {
          cell: { color, opacity: 0.1 + (Math.abs(a) / 0.3) * 0.3 },
          readout: { value: `${p.value} mm`, note: `${year ?? p.label} monsoon rain, ${Math.abs(pct) < 5 ? "close to the median" : `${Math.abs(pct)}% ${pct < 0 ? "below" : "above"} the median`}`, scope: cellScope, color },
        };
      }
      return { readout: { value: `${p.value} mm`, note: `${p.label} monsoon rain`, scope: cellScope, color: DATA_COLOR.water } };
    }
  }

  if (evidence.kind === "heat_cold") {
    const m = timelines.find((t) => t.id === "hot-days") ?? timelines[0];
    const p = selectedPoint(m);
    if (m && p && p.value !== null) {
      const vals = m.points.filter((q) => q.value !== null).map((q) => q.value as number);
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const t = hi > lo ? (p.value - lo) / (hi - lo) : 0.5;
      return {
        cell: { color: DATA_COLOR.heat, opacity: 0.08 + t * 0.32 },
        readout: {
          value: `${p.value} days`,
          note: `${year ?? p.label} at 35 °C or hotter, Mar to May${m.baseline ? ` (median ${m.baseline.value})` : ""}`,
          scope: cellScope,
          color: DATA_COLOR.heat,
        },
      };
    }
  }

  if (evidence.kind === "flood") {
    const share = typeof raw?.waterFraction === "number" ? (raw.waterFraction as number) : null;
    if (share !== null && evidence.time.selectedDate) {
      return {
        field: share > 0 ? { color: DATA_COLOR.water, opacity: 0.15 + share * 0.55 } : undefined,
        readout: {
          value: `${Math.round(share * 100)}%`,
          note: share > 0 ? `of your field seen as open water, ${formatShortDate(evidence.time.selectedDate)}` : `no open water seen, ${formatShortDate(evidence.time.selectedDate)}`,
          scope: cellScope,
          color: share > 0 ? DATA_COLOR.water : DATA_COLOR.none,
        },
      };
    }
  }

  if (evidence.kind === "erosion") {
    const slope = typeof raw?.slopeMedian === "number" ? (raw.slopeMedian as number) : null;
    if (slope !== null) {
      return {
        field: { color: DATA_COLOR.drought, opacity: clamp(0.1 + (slope / 15) * 0.4, 0.1, 0.5) },
        readout: { value: `${slope.toFixed(1)}°`, note: `middle terrain slope${typeof raw?.slopeLabel === "string" ? `, ${(raw.slopeLabel as string).toLowerCase()}` : ""}`, scope: cellScope, color: DATA_COLOR.drought },
      };
    }
  }

  return { readout: { value: "Partial", note: evidence.summaryTitle, scope: cellScope, color: DATA_COLOR.none } };
}

export function allUnavailable(map: RiskEvidenceMap): boolean {
  return RISK_ORDER.every((k) => map[k].status === "unavailable");
}
