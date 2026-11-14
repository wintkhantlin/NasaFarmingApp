"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph, DocGlyph, InfoGlyph } from "@/components/ui/icons";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Recommendation } from "@/components/ui/recommendation";
import { RiskChip } from "@/components/ui/risk-chip";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceLine } from "@/components/ui/source-line";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { generateStrategies, type EvaluatedOption } from "@/lib/engine/strategies";
import { formatSpan, slotName } from "@/lib/rotation-format";
import { getCachedConditions } from "@/lib/store/data-cache";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";

/** Rainfall to assume when this field's own rainfall hasn't been read yet. */
const ASSUMED_RAIN_MM = 720;

const level = (l: EvaluatedOption["soilScore"]) => l;
const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}`;

function optionTitle(i: number) {
  return i === 0 ? copy.compare.yourRotationTab : copy.compare.alternativeTab(i);
}

/** How an option differs from the farmer's rotation, in words. */
function deltaLines(opt: EvaluatedOption, now: EvaluatedOption): string[] {
  const out: string[] = [];
  const dN = opt.estimatedNBalanceKgHa - now.estimatedNBalanceKgHa;
  out.push(
    Math.abs(dN) < 1
      ? "Nitrogen balance is about the same as now."
      : `Nitrogen balance is ${signed(dN)} kg/ha ${dN > 0 ? "better" : "worse"} than now.`,
  );
  out.push(
    opt.soilScore === now.soilScore
      ? `Soil benefit stays ${level(opt.soilScore)}.`
      : `Soil benefit goes from ${level(now.soilScore)} to ${level(opt.soilScore)}.`,
  );
  out.push(
    opt.waterResilience === now.waterResilience
      ? `Drought resilience stays ${level(opt.waterResilience)}.`
      : `Drought resilience goes from ${level(now.waterResilience)} to ${level(opt.waterResilience)}.`,
  );
  return out;
}

export function RotationCompare({ fieldId }: { fieldId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);

  const [selected, setSelected] = useState(0);
  const [readRainMm, setReadRainMm] = useState<number | null>(null);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  // Use this field's own rainfall when the Conditions screen has already fetched it.
  useEffect(() => {
    let mounted = true;
    void getCachedConditions(fieldId).then((c) => {
      if (mounted) setReadRainMm(c?.annualRainMm ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [fieldId]);

  const activeRotation = rotations[0];
  const comparison = useMemo(
    () =>
      field && activeRotation && activeRotation.slots.length > 0
        ? generateStrategies(field, activeRotation, readRainMm ?? ASSUMED_RAIN_MM)
        : null,
    [field, activeRotation, readRainMm],
  );

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!field) {
    return (
      <EmptyState title="Field not found" body="This field isn't saved in this browser. Please return to your fields list.">
        <Link href="/" className={buttonClass("primary")}>
          Back to your fields
        </Link>
      </EmptyState>
    );
  }

  if (!comparison) {
    return (
      <EmptyState
        title="Add your rotation first"
        body="Before we can compare other rotations with yours, record the crops you grow now."
      >
        <Link href={`/fields/${field.id}/rotation`} className={buttonClass("primary")}>
          Add your rotation
        </Link>
      </EmptyState>
    );
  }

  const options: EvaluatedOption[] = [comparison.current, ...comparison.alternatives];
  const active = options[selected] ?? options[0];
  const now = options[0];

  const rows: Array<{ group: string; items: Array<{ label: string; cell: (o: EvaluatedOption) => React.ReactNode }> }> = [
    {
      group: copy.compare.groupFit,
      items: [
        { label: "Cycle length", cell: (o) => `${o.rotation.cycleYears} ${o.rotation.cycleYears > 1 ? "years" : "year"}` },
        {
          label: "Crops in order",
          cell: (o) => (
            <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
              {o.rotation.slots.map((s, i) => (
                <li key={s.id}>
                  <span className="tabular font-mono text-source text-ink-muted">{i + 1} </span>
                  {slotName(s)}
                </li>
              ))}
            </ol>
          ),
        },
      ],
    },
    {
      group: copy.compare.groupSoil,
      items: [
        {
          label: "Nitrogen balance",
          cell: (o) => (
            <span className="tabular font-mono">
              {signed(o.estimatedNBalanceKgHa)} kg/ha
            </span>
          ),
        },
        { label: "Soil benefit", cell: (o) => <RiskChip hazard="healthy">{o.soilScore} benefit</RiskChip> },
      ],
    },
    {
      group: copy.compare.groupWater,
      items: [
        {
          label: "Drought resilience",
          cell: (o) => (
            <RiskChip hazard={o.waterResilience === "high" ? "water" : "drought"}>{o.waterResilience}</RiskChip>
          ),
        },
      ],
    },
    {
      group: copy.compare.groupUnknowns,
      items: [{ label: "Things to check", cell: (o) => `${o.unknowns.length} to check locally` }],
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-title text-ink sm:text-display">{copy.compare.title}</h1>
          <p className="max-w-measure text-body text-ink-muted">
            Your rotation next to two other options, using the climate record for this field.
          </p>
        </div>
        <Link href={`/fields/${field.id}/report`} className={buttonClass("secondary", "max-sm:w-full")}>
          <DocGlyph />
          {copy.compare.reportButton}
        </Link>
      </div>

      <JudgmentNote />

      {readRainMm === null ? (
        <Panel as="p" tone="plain" className="flex items-start gap-2 px-4 py-3 text-body-sm text-ink">
          <InfoGlyph className="mt-0.5 shrink-0 text-drought" />
          <span>
            We haven&apos;t read this field&apos;s rainfall yet, so water results assume a typical {ASSUMED_RAIN_MM} mm
            year.{" "}
            <Link href={`/fields/${field.id}/conditions`} className="text-field underline">
              Check conditions
            </Link>{" "}
            to use the real figure.
          </span>
        </Panel>
      ) : null}

      {/* Desktop: the three rotations aligned, row by row. Click a column to read it below. */}
      <div className="hidden overflow-x-auto rounded-md border border-line bg-surface-raised md:block">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <caption className="sr-only">{copy.compare.tableLabel}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[22%] p-0">
                <span className="sr-only">Measure</span>
              </th>
              {options.map((o, i) => {
                const isSel = i === selected;
                return (
                  <th key={o.id} scope="col" className={cn("p-0 align-top", isSel && "bg-field-soft")}>
                    <button
                      type="button"
                      aria-pressed={isSel}
                      onClick={() => setSelected(i)}
                      className="flex min-h-tap w-full flex-col items-start gap-1 p-4 text-left transition-colors hover:bg-surface-sunken"
                    >
                      <span className="text-headline text-ink">{optionTitle(i)}</span>
                      <span className="text-body-sm font-normal text-ink-muted">{o.badge}</span>
                      <span className={cn("text-body-sm", isSel ? "text-field" : "text-ink-muted")}>
                        {isSel ? "Shown below" : "Read this one"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <RowGroup key={g.group} title={g.group} cols={options.length + 1}>
                {g.items.map((it) => (
                  <tr key={it.label} className="border-t border-line">
                    <th scope="row" className="p-4 text-left text-body-sm font-normal text-ink-muted">
                      {it.label}
                    </th>
                    {options.map((o, i) => (
                      <td key={o.id} className={cn("p-4 align-top text-body-sm text-ink", i === selected && "bg-field-soft/50")}>
                        {it.cell(o)}
                      </td>
                    ))}
                  </tr>
                ))}
              </RowGroup>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: one option at a time */}
      <Segmented
        legend="Rotation to read"
        value={String(selected)}
        onChange={(v) => setSelected(Number(v))}
        options={options.map((_, i) => ({ value: String(i), label: optionTitle(i) }))}
        className="md:hidden"
      />

      <section aria-labelledby="option-title" className="flex flex-col gap-4">
        <Recommendation
          as="h2"
          context={`${optionTitle(selected)}: ${active.label}`}
          headline={active.headline}
          reason={active.reason}
          risks={[
            { hazard: "healthy", label: active.badge },
            {
              hazard: active.waterResilience === "high" ? "water" : "drought",
              label: `Drought resilience: ${active.waterResilience}`,
            },
            { hazard: "healthy", label: `Nitrogen balance ${signed(active.estimatedNBalanceKgHa)} kg/ha` },
          ]}
        />
        <span id="option-title" className="sr-only">
          {optionTitle(selected)}
        </span>

        {selected > 0 ? (
          <Panel as="div" className="flex flex-col gap-3 p-4 sm:p-5">
            <PanelHeader as="h3" title="Compared with your rotation" />
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-body text-ink">
              {deltaLines(active, now).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {!active.isFit && active.noFitReason ? (
          <Panel as="div" tone="plain" className="p-4 text-body text-ink">
            {active.noFitReason}
          </Panel>
        ) : null}

        <Panel as="div" className="flex flex-col gap-3 p-4 sm:p-5">
          <PanelHeader as="h3" title="Crops in order" />
          <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {active.rotation.slots.map((slot, i) => (
              <li key={slot.id} className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line bg-surface p-3">
                <span className="flex items-center gap-2 text-body-sm text-ink-muted">
                  <span className="tabular font-mono text-source">{i + 1}</span>
                  {slot.kind === "cover" ? "Cover crop" : slot.kind === "fallow" ? "Fallow" : "Crop"}
                </span>
                <span className="text-label text-ink">{slotName(slot)}</span>
                <span className="text-body-sm text-ink-muted">{formatSpan(slot.plantDate, slot.harvestDate)}</span>
                {slot.notes ? <span className="mt-1 text-body-sm text-ink-muted">{slot.notes}</span> : null}
              </li>
            ))}
          </ol>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel as="div" className="flex flex-col gap-3 p-4 sm:p-5">
            <PanelHeader as="h3" title="The evidence" />
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {active.evidence.map((ev) => (
                <li key={ev.id} className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0">
                  <p className="m-0 text-label text-ink">{ev.claim}</p>
                  <p className="tabular m-0 font-mono text-data text-field">
                    {ev.value}
                    {ev.unit ? ` ${ev.unit}` : ""}
                  </p>
                  {ev.comparedTo ? <p className="m-0 text-body-sm text-ink-muted">Compared with {ev.comparedTo}</p> : null}
                  <SourceLine dataset={ev.source.dataset} resolution={ev.source.resolution} dates={ev.source.dates} />
                </li>
              ))}
            </ul>
          </Panel>

          <div className="flex min-w-0 flex-col gap-4">
            {active.risks.length > 0 ? (
              <Panel as="div" className="flex flex-col gap-3 p-4 sm:p-5">
                <PanelHeader as="h3" title="What could go wrong" />
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {active.risks.map((risk) => (
                    <li key={risk.id} className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3">
                      <p className="m-0 text-label text-ink">{risk.text}</p>
                      <p className="m-0 text-body-sm text-ink-muted">
                        <span className="text-ink">What to check: </span>
                        {risk.action}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            <Panel as="div" className="flex flex-col gap-3 p-4 sm:p-5">
              <PanelHeader as="h3" title={copy.compare.groupUnknowns} description={copy.compare.unknownsWarning} />
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
                {active.unknowns.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-raised px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Link href={`/fields/${field.id}/conditions`} className="inline-flex min-h-tap items-center text-label text-ink-muted hover:underline">
          Back to conditions
        </Link>
        <Link href={`/fields/${field.id}/report`} className={buttonClass("primary", "max-sm:flex-1")}>
          {copy.compare.reportButton}
          <ChevronRightGlyph />
        </Link>
      </div>
    </>
  );
}

function RowGroup({ title, cols, children }: { title: string; cols: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="border-t border-line bg-surface">
        <th scope="colgroup" colSpan={cols} className="px-4 py-2 text-left text-body-sm text-ink-muted">
          {title}
        </th>
      </tr>
      {children}
    </>
  );
}
