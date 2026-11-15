"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { NextSteps } from "@/components/field/next-steps";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { buttonClass } from "@/components/ui/button";
import { MONTHS } from "@/components/ui/charts";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { ScaleBadge, type Scale } from "@/components/ui/status";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComparisonResult } from "@/lib/engine/compare";
import { staticMapUrl } from "@/lib/geo/static-map";
import { steepnessClass } from "@/lib/nasa/derive/slope";
import type { TrendSeries } from "@/lib/server/trends";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import { useFieldsStore } from "@/lib/store/fields-store";

type Payload = { trends: TrendSeries[]; through: number } | { error: string };
type Hazard = "water" | "flood" | "erosion" | "temperature";

const HAZARDS = [
  { value: "water", label: "Water stress" },
  { value: "flood", label: "Flood" },
  { value: "erosion", label: "Erosion" },
  { value: "temperature", label: "Heat & cold" },
] as const;

function knownYears(s: TrendSeries): Array<{ year: number; value: number }> {
  return s.years.filter((y): y is { year: number; value: number } => y.value !== null);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}

function latestSmap(remote: RemoteData | null | undefined) {
  return [...(remote?.smap.data?.days ?? [])].reverse().find((d) => d.rootzone !== null) ?? null;
}

function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function coldestMonth(values: number[] | undefined): { value: number; month: string } | null {
  if (!values?.length) return null;
  const value = Math.min(...values);
  return { value, month: MONTHS[values.indexOf(value)] };
}

function Bars({ s, selectedYear }: { s: TrendSeries; selectedYear: number }) {
  const vals = knownYears(s).map((y) => y.value);
  const max = Math.max(1, ...vals);
  const w = 100 / s.years.length;
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${s.title}, ${s.years[0].year} to ${s.years[s.years.length - 1].year}. ${selectedYear} is selected.`}
      className="h-28 w-full"
    >
      {s.years.map((y, i) => {
        const selected = y.year === selectedYear;
        return y.value === null ? (
          <line
            key={y.year}
            x1={i * w + w / 2}
            x2={i * w + w / 2}
            y1="27"
            y2="30"
            stroke={selected ? "var(--color-ink)" : "var(--color-ink-muted)"}
            strokeWidth={selected ? "0.9" : "0.4"}
          />
        ) : (
          <rect
            key={y.year}
            x={i * w + 0.15}
            width={Math.max(0.35, w - 0.3)}
            y={30 - (y.value / max) * 28}
            height={(y.value / max) * 28}
            rx="0.25"
            fill={selected ? "var(--color-field)" : "var(--color-ink-muted)"}
            opacity={selected ? 1 : 0.62}
          />
        );
      })}
    </svg>
  );
}

function selectedRainSentence(series: TrendSeries | undefined, year: number): string {
  if (!series) return "Rain history is unavailable right now.";
  const point = series.years.find((y) => y.year === year);
  if (!point || point.value === null) return `${year} does not have enough valid days to compare.`;
  const baseline = median(knownYears(series).map((y) => y.value));
  if (baseline === null || baseline === 0) return `${year} had ${Math.round(point.value)} mm of monsoon rain.`;
  const difference = Math.round(((point.value - baseline) / baseline) * 100);
  if (Math.abs(difference) < 5) return `${year} monsoon rain was close to the long-record middle.`;
  return `${year} monsoon rain was about ${Math.abs(difference)}% ${difference < 0 ? "below" : "above"} the long-record middle.`;
}

function FieldMapPreview({ geometry, confirmed }: { geometry: Parameters<typeof staticMapUrl>[0]; confirmed: boolean }) {
  return (
    <div className="self-start overflow-hidden rounded-md border border-line bg-surface-sunken">
      {MAPBOX_TOKEN ? (
        <Image
          src={staticMapUrl(geometry, MAPBOX_TOKEN, 900, 320)}
          alt=""
          width={900}
          height={320}
          unoptimized
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-28 items-center justify-center px-4 text-center text-body-sm text-ink-muted">
          Satellite map preview is unavailable. The saved field location is still used for the history below.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
        <span className="text-body-sm text-ink">{confirmed ? "Farmer-confirmed field" : "Saved field location"}</span>
        <ScaleBadge scale="field" />
      </div>
    </div>
  );
}

interface HazardContent {
  title: string;
  action: string;
  reason: string;
  source: string;
  scale: Scale;
}

function explainHazard({
  hazard,
  selectedYear,
  selectedPoint,
  rainSentence,
  smapDate,
  slopeMedian,
  slopeLabel,
  coverGaps,
  coldest,
}: {
  hazard: Hazard;
  selectedYear: number;
  selectedPoint: { value: number | null } | null;
  rainSentence: string;
  smapDate: string | null;
  slopeMedian: number | null;
  slopeLabel: ReturnType<typeof steepnessClass>;
  coverGaps: number;
  coldest: { value: number; month: string } | null;
}): HazardContent {
  if (hazard === "water") {
    return {
      title: rainSentence,
      action: "Use this history to check water access, then compare crops with lower water demand.",
      reason: smapDate
        ? `Regional root-zone soil moisture was also available on ${formatIsoDate(smapDate)}. It describes the surrounding 9-km area, not this field.`
        : "Regional soil-moisture history is not available yet. Missing data is not treated as normal or low stress.",
      source: "NASA POWER daily · about 50 km · historical rain; SMAP, when available · about 9 km",
      scale: "wider",
    };
  }
  if (hazard === "flood") {
    return {
      title: "Flood exposure is not assessed yet.",
      action: "Use local flood history and drainage before changing sowing dates or crop choice.",
      reason: `${rainSentence} Rain can contribute to flooding, but rain alone cannot show where water covered the field. Planned paddy water must also be separated from harmful flooding.`,
      source: "Rain context: NASA POWER · about 50 km. OPERA open-water observations: not connected.",
      scale: "wider",
    };
  }
  if (hazard === "erosion") {
    const slopeText = slopeMedian === null
      ? "Terrain slope is unavailable, so erosion susceptibility is not classified."
      : `The mapped median slope is ${slopeMedian.toFixed(1)}° (${slopeLabel}). This is terrain context, not measured soil loss.`;
    return {
      title: coverGaps > 0 ? `Keep soil covered through ${coverGaps} planned bare ${coverGaps === 1 ? "period" : "periods"}.` : "Check soil cover before the wettest months.",
      action: "Review cover crops, retained residue and local signs of rills before the monsoon.",
      reason: `${slopeText} ${rainSentence} A defensible erosion estimate still needs local soil and field-practice information.`,
      source: "NASA SRTM terrain · about 30 m; HLS/Landsat clear observations · 30 m; rainfall context · about 50 km",
      scale: "estimated",
    };
  }
  const hotValue = selectedPoint?.value;
  return {
    title: hotValue == null
      ? `${selectedYear} does not have enough valid temperature days to compare.`
      : `${selectedYear} had ${hotValue} days at 35 °C or hotter from March to May.`,
    action: "Check whether flowering overlaps the hottest weeks, and confirm cold nights locally before planting.",
    reason: coldest
      ? `The coldest monthly night average is about ${Math.round(coldest.value)} °C in ${coldest.month}. A monthly regional average cannot verify frost in this field.`
      : "Cold-month context is unavailable. Missing temperature data is not treated as no frost risk.",
    source: "NASA POWER daily · about 50 km · past air temperature, not canopy temperature",
    scale: "wider",
  };
}

/** Past evidence and field vulnerabilities, kept inside Conditions rather than becoming another app screen. */
export function TrendsView({
  fieldId,
  embedded = false,
  conditions,
  remote,
  comparison,
}: {
  fieldId: string;
  embedded?: boolean;
  conditions?: ConditionsData | null;
  remote?: RemoteData | null;
  comparison?: ComparisonResult | null;
}) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const load = useFieldsStore((s) => s.load);
  const [data, setData] = useState<Payload | null>(null);
  const [hazard, setHazard] = useState<Hazard>("water");
  const [chosenYear, setChosenYear] = useState<number | null>(null);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);
  const lng = field?.centroid[0];
  const lat = field?.centroid[1];
  useEffect(() => {
    if (lng === undefined || lat === undefined) return;
    const ctl = new AbortController();
    fetch(`/api/field/${fieldId}/trends?lng=${lng}&lat=${lat}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {
        if (!ctl.signal.aborted) setData({ error: "Trends could not be loaded. Check your connection." });
      });
    return () => ctl.abort();
  }, [fieldId, lng, lat]);

  const trends = data && !("error" in data) ? data.trends : [];
  const rain = trends.find((t) => t.key === "monsoon-rain");
  const heat = trends.find((t) => t.key === "hot-days");
  const series = hazard === "temperature" ? heat : rain;
  const lastKnownYear = series ? knownYears(series).at(-1)?.year ?? series.years.at(-1)?.year : undefined;
  const selectedYear = chosenYear ?? lastKnownYear ?? 0;
  const selectedPoint = series?.years.find((y) => y.year === selectedYear) ?? null;
  const smap = latestSmap(remote);
  const slope = remote?.srtm.data?.slope;
  const slopeClass = steepnessClass(slope?.medianDeg ?? null);
  const coverGaps = comparison?.current.lowCover.length ?? 0;
  const coldest = coldestMonth(conditions?.monthlyTminC);

  if (status === "idle" || status === "loading" || (field && !data)) return <Skeleton className="h-96" />;
  if (!field) {
    return (
      <EmptyState title="Field not found" body="This field isn't saved in this browser.">
        <Link href="/" className={buttonClass("primary")}>Back to your fields</Link>
      </EmptyState>
    );
  }

  const rainSentence = selectedRainSentence(rain, selectedYear);
  const content = explainHazard({
    hazard,
    selectedYear,
    selectedPoint,
    rainSentence,
    smapDate: smap?.date ?? null,
    slopeMedian: slope?.medianDeg ?? null,
    slopeLabel: slopeClass,
    coverGaps,
    coldest,
  });

  return (
    <>
      {embedded ? null : <FieldPageHeader title="Field history and vulnerabilities" summary={`Past evidence around ${field.name}. Not a forecast.`} />}
      <div className="grid gap-5 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)]">
        <FieldMapPreview geometry={field.geometry} confirmed={Boolean(field.locationConfirmed)} />
        <div className="flex min-w-0 flex-col gap-4">
          <Segmented legend="Explore past evidence for" value={hazard} onChange={setHazard} options={HAZARDS} />

          <div className="flex flex-col gap-2" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="m-0 text-headline text-ink">{content.title}</h3>
              <ScaleBadge scale={content.scale} />
            </div>
            <p className="m-0 max-w-measure text-body text-ink"><strong>What to do:</strong> {content.action}</p>
            <p className="m-0 max-w-measure text-body-sm text-ink-muted"><strong>Why:</strong> {content.reason}</p>
          </div>

          {series && series.years.length > 0 ? (
            <div className="flex flex-col gap-1 border-t border-line pt-3">
              <Bars s={series} selectedYear={selectedYear} />
              <label htmlFor={`trend-year-${fieldId}`} className="flex items-center justify-between gap-3 text-label text-ink">
                <span>Choose a year</span>
                <span className="tabular font-mono">{selectedYear}{selectedPoint?.value == null ? " · no data" : ` · ${Math.round(selectedPoint.value)} ${series.unit}`}</span>
              </label>
              <input
                id={`trend-year-${fieldId}`}
                type="range"
                min={series.years[0].year}
                max={series.years.at(-1)!.year}
                step={1}
                value={selectedYear}
                onChange={(event) => setChosenYear(Number(event.currentTarget.value))}
                className="min-h-tap w-full accent-field"
              />
              <div className="flex justify-between text-source text-ink-muted" aria-hidden>
                <span>{series.years[0].year}</span>
                <span>{series.years.at(-1)!.year}</span>
              </div>
            </div>
          ) : null}

          <Disclosure title="Source, scale and method" className="bg-surface-sunken">
            <p className="m-0 text-source text-ink-muted">{content.source}</p>
            <p className="m-0 max-w-measure text-body-sm text-ink">
              Historical observations are analyzed at each dataset&apos;s native spatial resolution to preserve measurement integrity. Trends reflect multi-year observations without artificial interpolation or composite hazard masking.
            </p>
            {series ? <p className="m-0 text-body-sm text-ink-muted">{series.sentence}</p> : null}
          </Disclosure>

          <Link href={`/fields/${field.id}/compare#what-if`} className="inline-flex min-h-tap items-center gap-2 self-start text-label font-medium text-field underline underline-offset-4 hover:text-ink">
            Test the crop plan in Compare
            <Icon name="next" />
          </Link>
        </div>
      </div>
      {data && "error" in data ? <Panel as="p" role="status" className="mt-4 p-4 text-body-sm text-ink-muted">{data.error}</Panel> : null}
      {embedded ? null : <NextSteps fieldId={fieldId} current="conditions" />}
    </>
  );
}
