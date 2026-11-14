"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FIT_HAZARD, OptionDetail } from "@/components/field/option-detail";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph, DocGlyph, InfoGlyph } from "@/components/ui/icons";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Recommendation } from "@/components/ui/recommendation";
import { RiskChip } from "@/components/ui/risk-chip";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { getCropById } from "@/lib/data/crops";
import { monthlyNormals } from "@/lib/engine/climate";
import { compareRotations, type EvaluatedOption } from "@/lib/engine/compare";
import { BASELINE } from "@/lib/engine/data";
import { CRITERIA } from "@/lib/engine/mcda";
import { formatSpan, slotName } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import type { Irrigation } from "@/lib/types";

const unknown = "Unknown";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? unknown : n.toFixed(d));

function optionTitle(i: number) {
  return i === 0 ? copy.compare.yourRotationTab : copy.compare.alternativeTab(i);
}

/** How an option differs from the farmer's rotation, in words. Only differences that both sides have evidence for. */
function deltaLines(opt: EvaluatedOption, now: EvaluatedOption): string[] {
  const out: string[] = [];
  const a = opt.metrics["water-shortfall"];
  const b = now.metrics["water-shortfall"];
  if (a != null && b != null) out.push(Math.abs(a - b) < 5 ? "Rain shortfall against crop demand is about the same as now." : `Median rain shortfall is ${fmt(a)} mm a crop, against ${fmt(b)} mm now.`);
  else out.push("Rain shortfall cannot be compared yet: weather or crop rules are missing for one of the two.");
  out.push(`Legumes are ${pct(opt.structure.legumeShare ?? 0)} of crops, against ${pct(now.structure.legumeShare ?? 0)} now.`);
  out.push(`A crop is in the field for ${pct(opt.structure.coveredShare)} of the cycle, against ${pct(now.structure.coveredShare)} now.`);
  return out;
}

export function RotationCompare({ fieldId }: { fieldId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const [selected, setSelected] = useState(0);
  const [whatIfIrrigation, setWhatIfIrrigation] = useState<Irrigation | null>(null);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);
  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  const analysis = useFieldAnalysis(field);
  const { engineData } = analysis;
  const activeRotation = rotations[0];

  const effectiveEngineData = useMemo(() => {
    if (!engineData) return null;
    if (whatIfIrrigation === null) return engineData;
    const clonedField = {
      ...engineData.field,
      irrigation: whatIfIrrigation,
      constraints: {
        ...engineData.field.constraints,
        irrigation: {
          access: whatIfIrrigation,
          amountMm: engineData.field.constraints?.irrigation?.amountMm ?? (whatIfIrrigation === "supplemental" ? 150 : 350),
        },
      },
    };
    return { ...engineData, field: clonedField };
  }, [engineData, whatIfIrrigation]);

  const comparison = useMemo(
    () => (effectiveEngineData && activeRotation && activeRotation.slots.length > 0 ? compareRotations(effectiveEngineData, activeRotation) : null),
    [effectiveEngineData, activeRotation],
  );

  const shapedByChips = useMemo(() => {
    if (!field) return [];
    const list: Array<{ label: string; href: string }> = [];
    const irri = field.constraints?.irrigation?.access ?? field.irrigation;
    list.push({ label: copy.irrigation[irri], href: `/fields/${field.id}/profile` });
    if (field.constraints?.equipment?.length) {
      list.push({
        label: field.constraints.equipment.map((e) => copy.profile.equipment[e as keyof typeof copy.profile.equipment] ?? e).join(", "),
        href: `/fields/${field.id}/profile`,
      });
    }
    if (field.constraints?.labour) {
      list.push({ label: `Labour: ${copy.profile.levels[field.constraints.labour]}`, href: `/fields/${field.id}/profile` });
    }
    if (field.constraints?.marketAccess) {
      list.push({ label: `Market: ${copy.profile.levels[field.constraints.marketAccess]}`, href: `/fields/${field.id}/profile` });
    }
    if (field.constraints?.excludedCropIds?.length) {
      const names = field.constraints.excludedCropIds.map((id) => getCropById(id)?.names.common ?? id).join(", ");
      list.push({ label: `Avoid: ${names}`, href: `/fields/${field.id}/profile` });
    }
    if (field.constraints?.preferredCropIds?.length) {
      const names = field.constraints.preferredCropIds.map((id) => getCropById(id)?.names.common ?? id).join(", ");
      list.push({ label: `Prefer: ${names}`, href: `/fields/${field.id}/profile` });
    }
    if (field.priorities?.order?.length) {
      list.push({
        label: `Priority: ${copy.profile.priority[field.priorities.order[0]]}`,
        href: `/fields/${field.id}/profile`,
      });
    }
    return list;
  }, [field]);
  const rainyMonths = useMemo(
    () =>
      engineData?.records.length
        ? monthlyNormals(engineData.records.filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear))
            .filter((n) => n.rainMm >= 100)
            .map((n) => n.month)
        : [],
    [engineData],
  );

  if (status === "idle" || status === "loading" || (field && analysis.phase === "loading" && !analysis.conditions)) {
    return (
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
        <p className="text-body-sm text-ink-muted">{copy.conditions.loadingData}</p>
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
      <EmptyState title="Add your rotation first" body="Before we can compare other rotations with yours, record the crops you grow now.">
        <Link href={`/fields/${field.id}/rotation`} className={buttonClass("primary")}>
          Add your rotation
        </Link>
      </EmptyState>
    );
  }

  const options: EvaluatedOption[] = [comparison.current, ...comparison.alternatives];
  const active = options[selected] ?? options[0];
  const now = options[0];
  const weatherMissing = engineData?.power.status !== "ok";

  const row = (label: string, cell: (o: EvaluatedOption) => React.ReactNode) => ({ label, cell });
  const rows: Array<{ group: string; items: Array<ReturnType<typeof row>> }> = [
    {
      group: copy.compare.groupFit,
      items: [
        row("Fits this field", (o) => <RiskChip hazard={FIT_HAZARD[o.fit]}>{copy.compare.fitLabel[o.fit]}</RiskChip>),
        row("Crops in order", (o) => (
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {o.rotation.slots.map((s, i) => (
              <li key={s.id}>
                <span className="tabular font-mono text-source text-ink-muted">{i + 1} </span>
                {slotName(s)}
              </li>
            ))}
          </ol>
        )),
        row("Cycle length", (o) => `${o.rotation.cycleYears} ${o.rotation.cycleYears > 1 ? "years" : "year"}`),
        row("A crop in the field", (o) => pct(o.structure.coveredShare)),
      ],
    },
    {
      group: copy.compare.groupSoil,
      items: [
        row("Legume share of crops", (o) => (o.structure.legumeShare === null ? unknown : pct(o.structure.legumeShare))),
        row("Nitrogen balance", (o) => {
          if (o.nitrogen.fixedKgHa && o.nitrogen.removedKgHa !== null) {
            const midFix = (o.nitrogen.fixedKgHa[0] + o.nitrogen.fixedKgHa[1]) / 2;
            const balance = Math.round(midFix - o.nitrogen.removedKgHa);
            if (balance >= 0) {
              return <RiskChip hazard="healthy">Puts back more nitrogen (about +{balance} kg N/ha)</RiskChip>;
            }
            return <RiskChip hazard="drought">Takes more nitrogen than it puts back (about {Math.abs(balance)} kg N/ha)</RiskChip>;
          }
          if (o.nitrogen.fixedKgHa) {
            return `${fmt(o.nitrogen.fixedKgHa[0])} to ${fmt(o.nitrogen.fixedKgHa[1])} kg N/ha fixed`;
          }
          return "None in this cycle";
        }),
        row("Erosion exposure", (o) => (o.erosion.exposure === "needs-slope-data" ? "Needs slope data" : o.erosion.exposure === "not-flagged" ? "Not flagged" : o.erosion.exposure === "possible" ? "Possible" : "Elevated")),
        row("Same-family sequences", (o) => (o.pest.length === 0 ? "None to check" : `${o.pest.filter((p) => p.result === "same-family").length} of ${o.pest.length}`)),
      ],
    },
    {
      group: copy.compare.groupWater,
      items: [
        row("Median rain shortfall per crop", (o) => (o.metrics["water-shortfall"] == null ? unknown : `${fmt(o.metrics["water-shortfall"])} mm`)),
        row("Dry seasons every crop got through", (o) => {
          if (o.dryYear.evaluated === 0) return unknown;
          const shortCount = o.dryYear.evaluated - o.dryYear.passes;
          if (shortCount === 0) return `All ${o.dryYear.evaluated} dry seasons passed without shortfall`;
          return `Short of water in ${shortCount} of ${o.dryYear.evaluated} dry seasons without irrigation`;
        }),
      ],
    },
    {
      group: "Income and fodder",
      items: [
        row("Margin from your numbers", (o) => (o.economics.cycleMarginMmkHa ? `${Math.round(o.economics.cycleMarginMmkHa[0]).toLocaleString()} to ${Math.round(o.economics.cycleMarginMmkHa[1]).toLocaleString()} MMK/ha` : unknown)),
        row("Crops with fodder or forage", (o) => String(o.forage.forageSlots)),
      ],
    },
    {
      group: copy.compare.groupUnknowns,
      items: [
        row("Things to check", (o) => {
          if (o.unknowns.length === 0) return "None to check locally";
          if (o.unknowns.length === 1) return o.unknowns[0];
          return `${o.unknowns[0]} (+${o.unknowns.length - 1} more)`;
        }),
      ],
    },
  ];

  const rankedById = new Map(comparison.mcda.ranking.map((r, i) => [r.rotationId, { ...r, place: i + 1 }]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-title text-ink sm:text-display">{copy.compare.title}</h1>
          <p className="max-w-measure text-body text-ink-muted">
            Your rotation next to defined alternatives for {comparison.region === "unsupported" ? "this location" : comparison.region === "shan" ? "Shan State" : comparison.region[0].toUpperCase() + comparison.region.slice(1)}, replayed over {comparison.baseline.completeYears} complete weather years.
          </p>
        </div>
        <Link href={`/fields/${field.id}/report`} className={buttonClass("secondary", "max-sm:hidden")}>
          <DocGlyph />
          {copy.compare.reportButton}
        </Link>
      </div>

      <JudgmentNote />

      {/* 2.3: Show what shaped the result */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-3 text-body-sm">
        <span className="font-medium text-ink">Shaped by:</span>
        {shapedByChips.length > 0 ? (
          shapedByChips.map((chip, idx) => (
            <Link
              key={idx}
              href={chip.href}
              className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface-raised px-2.5 py-1 text-label text-ink hover:border-line-strong hover:bg-surface-sunken no-underline transition-colors"
            >
              <span>{chip.label}</span>
            </Link>
          ))
        ) : (
          <Link
            href={`/fields/${field.id}/profile`}
            className="inline-flex items-center gap-1 text-body-sm text-field underline hover:text-ink"
          >
            Not tailored yet: tell us what matters to your farm
          </Link>
        )}
        <Link
          href={`/fields/${field.id}/profile`}
          className="ml-auto text-source text-field underline hover:text-ink"
        >
          Edit limits & priorities
        </Link>
      </div>

      {/* 2.4: What-if, live simulation */}
      <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-raised p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label text-ink">What-if live:</span>
            <span className="text-body-sm text-ink-muted">Simulate water levels:</span>
            <div className="flex items-center gap-1">
              {(["none", "supplemental", "full"] as const).map((mode) => {
                const isCurrent = (whatIfIrrigation ?? field.irrigation) === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setWhatIfIrrigation(mode === field.irrigation ? null : mode)}
                    className={cn(
                      "cursor-pointer rounded-pill px-2.5 py-1 text-source font-medium transition-colors",
                      isCurrent
                        ? "bg-field text-on-field"
                        : "border border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {copy.irrigation[mode]}
                  </button>
                );
              })}
            </div>
          </div>
          {whatIfIrrigation !== null ? (
            <button
              type="button"
              onClick={() => setWhatIfIrrigation(null)}
              className="cursor-pointer text-source text-field underline hover:text-ink"
            >
              Reset simulation
            </button>
          ) : null}
        </div>
        {whatIfIrrigation !== null ? (
          <p className="m-0 text-source text-drought font-medium">
            Simulating results if your field has {copy.irrigation[whatIfIrrigation].toLowerCase()}. Options and rankings update live.
          </p>
        ) : (
          <p className="m-0 text-source text-ink-muted">
            Assumptions: {field.irrigation === "none" ? "Rainfed only. No supplemental water applied." : `${copy.irrigation[field.irrigation]} active.`}
          </p>
        )}
      </div>

      {weatherMissing ? (
        <Panel as="p" tone="plain" role="status" className="flex items-start gap-2 px-4 py-3 text-body-sm text-ink">
          <InfoGlyph className="mt-0.5 shrink-0 text-drought" />
          <span>
            NASA POWER weather could not be read, so every weather result below is unknown. Nothing is filled in.{" "}
            <button type="button" onClick={analysis.retry} className="cursor-pointer border-0 bg-transparent p-0 text-field underline">
              Try again
            </button>
          </span>
        </Panel>
      ) : null}

      {comparison.dataGaps.length > 0 || analysis.retrieving ? (
        <Panel as="details" tone="plain" className="p-4">
          <summary className="min-h-tap cursor-pointer text-label text-ink">
            {analysis.retrieving ? "Some data is still being retrieved. " : ""}What data this comparison did not have ({comparison.dataGaps.length})
          </summary>
          <ul className="m-0 mt-2 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
            {comparison.dataGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {comparison.shortfall ? (
        <EmptyState title={comparison.region === "unsupported" ? copy.compare.unsupported : "Fewer than two alternatives fit"} body={comparison.shortfall}>
          <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
            Change your limits
          </Link>
        </EmptyState>
      ) : null}

      {/* Priorities and ranking */}
      <Panel as="section" aria-labelledby="ranking" className="flex flex-col gap-3 p-4 sm:p-6">
        <PanelHeader id="ranking" title={copy.compare.rankingTitle} description={comparison.mcda.note} />
        {comparison.mcda.status === "no-priorities" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="m-0 text-body text-ink">{copy.compare.rankingNone}</p>
            <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
              {copy.compare.needProfile}
            </Link>
          </div>
        ) : null}
        {comparison.mcda.status === "ranked" ? (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {comparison.mcda.ranking.map((r, i) => {
              const o = options.find((x) => x.id === r.rotationId);
              return (
                <li key={r.rotationId} className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-3">
                  <span className="tabular grid size-7 place-items-center rounded-pill border border-line-strong font-mono text-source">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-label text-ink">{o?.label}</span>
                  <span className="tabular font-mono text-data text-ink">{r.score.toFixed(2)}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
        {comparison.mcda.status === "unresolved" ? <p className="m-0 text-body text-ink">{comparison.mcda.note}</p> : null}
        {comparison.mcda.partial.length > 0 ? (
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-label text-ink">{copy.compare.partialTitle}</h3>
            <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-body-sm text-ink-muted">
              {comparison.mcda.partial.map((x) => (
                <li key={x.rotationId}>
                  {options.find((o) => o.id === x.rotationId)?.label}: {x.warning}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {comparison.mcda.excluded.filter((x) => x.reason !== "no-priority").length > 0 ? (
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-label text-ink">{copy.compare.notRankedTitle}</h3>
            <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-body-sm text-ink-muted">
              {comparison.mcda.excluded
                .filter((x) => x.reason !== "no-priority")
                .map((x) => (
                  <li key={x.criterion}>
                    {x.label}: {x.detail}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        {comparison.mcda.status === "ranked" ? (
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-label text-ink">{copy.compare.sensitivityTitle}</h3>
            <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-body-sm text-ink-muted">
              {comparison.sensitivity
                .filter((s) => s.topLabel)
                .map((s) => (
                  <li key={s.priority}>{copy.compare.sensitivityLine(copy.profile.priority[s.priority as keyof typeof copy.profile.priority].toLowerCase(), s.topLabel as string)}</li>
                ))}
            </ul>
            <p className="m-0 text-source text-ink-muted">Criteria used: {comparison.mcda.used.map((id) => CRITERIA.find((c) => c.id === id)?.label).join("; ")}.</p>
          </div>
        ) : null}
      </Panel>

      {/* Desktop: the options aligned, row by row. Click a column to read it below. */}
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
                const rank = rankedById.get(o.id);
                return (
                  <th key={o.id} scope="col" className={cn("p-0 align-top", isSel && "bg-field-soft")}>
                    <button type="button" aria-pressed={isSel} onClick={() => setSelected(i)} className="flex min-h-tap w-full flex-col items-start gap-1 p-4 text-left transition-colors hover:bg-surface-sunken">
                      <span className="text-headline text-ink">{optionTitle(i)}</span>
                      <span className="text-body-sm font-normal text-ink">{o.label}</span>
                      {rank ? <span className="tabular font-mono text-source text-ink-muted">Match to your priorities: {rank.place} of {comparison.mcda.ranking.length}</span> : null}
                      {o.badges.length > 0 ? <span className="text-body-sm font-normal text-ink-muted">{o.badges.join(" · ")}</span> : null}
                      <span className={cn("text-body-sm", isSel ? "text-field" : "text-ink-muted")}>{isSel ? "Shown below" : "Read this one"}</span>
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
      <Segmented legend="Rotation to read" value={String(selected)} onChange={(v) => setSelected(Number(v))} options={options.map((_, i) => ({ value: String(i), label: optionTitle(i) }))} className="md:hidden" />

      <section aria-labelledby="option-title" className="flex flex-col gap-4">
        <Recommendation
          as="h2"
          context={`${optionTitle(selected)}: ${active.label}`}
          headline={active.headline}
          reason={active.reason}
          risks={[
            { hazard: FIT_HAZARD[active.fit], label: copy.compare.fitLabel[active.fit] },
            ...(selected === 0 ? [{ hazard: "neutral" as const, label: "Current baseline" }] : []),
            ...active.badges.map((b) => ({ hazard: "healthy" as const, label: b })),
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

        <Panel as="div" className="flex flex-col gap-3 p-4 sm:p-5">
          <PanelHeader as="h3" title="Crops in order" />
          <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {active.rotation.slots.map((slot, i) => (
              <li key={slot.id} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-surface p-3">
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

        <OptionDetail option={active} rainyMonths={rainyMonths} fieldId={field.id} region={field.region} />
      </section>

      {comparison.rejected.length > 0 ? (
        <Panel as="details" tone="plain" className="p-4">
          <summary className="min-h-tap cursor-pointer text-label text-ink">{copy.compare.rejectedTitle} ({comparison.rejected.length})</summary>
          <ul className="m-0 mt-2 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink-muted">
            {comparison.rejected.map((r) => (
              <li key={r.template.id}>
                {r.template.label}: {r.reason}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

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
