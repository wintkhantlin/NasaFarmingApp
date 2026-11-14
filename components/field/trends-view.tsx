"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ScaleBadge } from "@/components/ui/status";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrendSeries } from "@/lib/server/trends";
import { useFieldsStore } from "@/lib/store/fields-store";

type Payload = { trends: TrendSeries[]; through: number } | { error: string };

function Bars({ s }: { s: TrendSeries }) {
  const vals = s.years.map((y) => y.value).filter((v): v is number => v !== null);
  const max = Math.max(1, ...vals);
  const w = 100 / s.years.length;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={`${s.title}, ${s.years[0].year} to ${s.years[s.years.length - 1].year}`} className="h-24 w-full">
      {s.years.map((y, i) =>
        y.value === null ? (
          // a missing year is a gap marker, not a zero bar
          <line key={y.year} x1={i * w + w / 2} x2={i * w + w / 2} y1="28" y2="30" stroke="var(--color-ink-muted)" strokeWidth="0.4" />
        ) : (
          <rect key={y.year} x={i * w + 0.15} width={w - 0.3} y={30 - (y.value / max) * 28} height={(y.value / max) * 28} fill="var(--color-field)" />
        ),
      )}
    </svg>
  );
}

/** Long-term trends (S17): past change only, one sentence per trend, no line unless the test is significant. */
export function TrendsView({ fieldId, embedded = false }: { fieldId: string; embedded?: boolean }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const load = useFieldsStore((s) => s.load);
  const [data, setData] = useState<Payload | null>(null);

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

  if (status === "idle" || status === "loading" || (field && !data)) return <Skeleton className="h-64" />;
  if (!field) {
    return (
      <EmptyState title="Field not found" body="This field isn't saved in this browser.">
        <Button href="/" variant="primary">Back to your fields</Button>
      </EmptyState>
    );
  }
  return (
    <>
      {embedded ? null : <FieldPageHeader title="Long-term trends" summary={`What has changed around ${field.name}. Past change only.`} />}
      {data && "error" in data ? (
        <EmptyState title="No trends to show" body={data.error} />
      ) : (
        data?.trends.map((t) => (
          <Panel key={t.key} as="section" aria-labelledby={`t-${t.key}`} className="flex flex-col gap-2 p-4 sm:p-5">
            <PanelHeader id={`t-${t.key}`} as="h2" title={t.title} aside={<ScaleBadge scale="wider" />} />
            <Bars s={t} />
            <p className="m-0 flex justify-between text-source text-ink-muted"><span>{t.years[0].year}</span><span>{data.through}</span></p>
            <p className="m-0 text-body text-ink">{t.sentence}</p>
            <p className="m-0 text-source text-ink-muted">Source: NASA POWER daily. Years with too many missing days are left out.</p>
          </Panel>
        ))
      )}
      <p className="m-0 text-body-sm text-ink-muted">Soil moisture and regional water storage need a NASA Earthdata connection and are not shown.</p>
    </>
  );
}
