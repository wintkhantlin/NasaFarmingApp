"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { FIT_HAZARD, OptionDetail } from "@/components/field/option-detail";
import { StatusTag } from "@/components/ui/status";
import { LimitSummary } from "@/components/field/limit-checks";
import { CheckLocally } from "@/components/field/check-locally";
import { SeasonStrip } from "@/components/field/season-strip";
import { WhatIf, WhatIfBanner } from "@/components/field/what-if";
import { applyScenario, NO_SCENARIO, isNeutral, type Scenario } from "@/lib/engine/scenario";
import { whatIfResult } from "@/lib/engine/what-if";
import { knownCount, seasonStrip, stressedCount } from "@/lib/engine/strip";
import { checkLimits, type LimitCheck } from "@/lib/engine/limits";
import { buttonClass } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { Message } from "@/components/ui/message";
import { Panel } from "@/components/ui/panel";
import { RiskChip } from "@/components/ui/risk-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { copy } from "@/lib/copy/en";
import { getCropById } from "@/lib/data/crops";
import { monthlyNormals } from "@/lib/engine/climate";
import { compareRotations, type EvaluatedOption } from "@/lib/engine/compare";
import { BASELINE } from "@/lib/engine/data";
import { adaptComparison, type DisplayOption } from "@/lib/plan/engine-display";
import { CRITERIA } from "@/lib/engine/mcda";
import { formatSpan, slotName } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import type { Field, Rotation } from "@/lib/types";

const unknown = "Not known";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? unknown : n.toFixed(d));
const mmk = (n: number) => Math.round(n).toLocaleString();

function plainSourceStatus(status: string | undefined): string {
  if (status === "ok" || status === "available") return "available";
  if (status === "pending") return "still loading";
  if (status === "unconfigured") return "not connected";
  if (status === "error" || status === "unavailable") return "not available";
  return "not checked";
}

function farmerBadge(label: string): string {
  if (label === "Lowest median rain shortfall") return "Smallest typical rain gap";
  if (label === "Lowest nitrogen demand") return "Needs the least nitrogen";
  if (label === "Most reliable in dry years") return "Handled more past dry seasons";
  if (label === "Highest soil organic matter benefit") return "More soil-building benefit";
  return label;
}

function placeName(region: string) {
  if (region === "ayeyarwady") return "Ayeyarwady";
  if (region === "magway") return "Magway";
  if (region === "shan") return "Shan State";
  return "this place";
}

/** How an option differs from the farmer's rotation, in words. Only differences both sides have evidence for. */
function differences(opt: EvaluatedOption, now: EvaluatedOption): string[] {
  const out: string[] = [];
  const a = opt.metrics["water-shortfall"] ?? null;
  const b = now.metrics["water-shortfall"] ?? null;
  if (a !== null && b !== null) {
    const d = Math.round(Math.abs(a - b));
    if (d < 5) out.push(copy.compare.diffWaterSame);
    else out.push(a < b ? copy.compare.diffWaterLess(d) : copy.compare.diffWaterMore(d));
  }
  if (opt.dryYear.evaluated > 0 && opt.dryYear.evaluated === now.dryYear.evaluated) {
    const d = opt.dryYear.passes - now.dryYear.passes;
    if (d > 0) out.push(copy.compare.diffDryMore(d));
    if (d < 0) out.push(copy.compare.diffDryFewer(-d));
  }
  const cover = Math.round((opt.structure.coveredShare - now.structure.coveredShare) * 100);
  if (Math.abs(cover) >= 5) out.push(cover > 0 ? copy.compare.diffCoverMore(cover) : copy.compare.diffCoverLess(-cover));
  if (opt.structure.cropSlots > 0 && now.structure.cropSlots > 0 && opt.structure.legumeSlots !== now.structure.legumeSlots) {
    out.push(copy.compare.diffLegumes(opt.structure.legumeSlots, opt.structure.cropSlots, now.structure.legumeSlots, now.structure.cropSlots));
  }
  const m = opt.economics.cycleMarginMmkHa;
  const n = now.economics.cycleMarginMmkHa;
  if (m && n) {
    const d = Math.round((m[0] + m[1]) / 2 - (n[0] + n[1]) / 2);
    if (Math.abs(d) >= 1000) out.push(d > 0 ? copy.compare.diffMarginMore(mmk(d)) : copy.compare.diffMarginLess(mmk(-d)));
  }
  if (opt.forage.forageSlots !== now.forage.forageSlots) {
    const d = opt.forage.forageSlots - now.forage.forageSlots;
    out.push(d > 0 ? copy.compare.diffFodderMore(d) : copy.compare.diffFodderFewer(-d));
  }
  return out.length > 0 ? out : [copy.compare.diffNone];
}

interface Figure {
  label: string;
  value: string;
}

function keyFigures(o: EvaluatedOption, strip: ReturnType<typeof seasonStrip>): Figure[] {
  const out: Figure[] = [
    { label: copy.compare.numbersRain, value: o.metrics["water-shortfall"] == null ? unknown : `${fmt(o.metrics["water-shortfall"])} mm` },
    { label: copy.compare.numbersDry, value: o.dryYear.evaluated === 0 ? unknown : `${o.dryYear.passes} of ${o.dryYear.evaluated}` },
    { label: copy.compare.numbersSeasons, value: keySeasonCount(strip) },
    { label: copy.compare.numbersCover, value: pct(o.structure.coveredShare) },
  ];
  if (o.structure.cropSlots > 0) {
    out.push({ label: copy.compare.numbersLegumes, value: `${o.structure.legumeSlots} of ${o.structure.cropSlots}` });
  }
  const m = o.economics.cycleMarginMmkHa;
  if (m) out.push({ label: "Estimated return after listed costs", value: `${mmk(m[0])}–${mmk(m[1])} MMK/ha` });
  if (o.forage.forageSlots > 0) out.push({ label: copy.compare.numbersFodder, value: String(o.forage.forageSlots) });
  return out;
}

interface SimpleFact {
  icon: IconName;
  label: string;
  text: string;
  tone: string;
}

/** Two to four short facts per choice, each with an icon, so the card can be read at a glance. */
function simpleFacts(
  o: EvaluatedOption,
  now: EvaluatedOption | null,
  isYours: boolean,
  comparable: boolean,
  item: DisplayOption | undefined,
): SimpleFact[] {
  const out: SimpleFact[] = [];
  if (comparable && now && !isYours) {
    const diff = differences(o, now)[0];
    if (diff && diff !== copy.compare.diffNone) out.push({ icon: "compare", label: "Compared with now", text: diff, tone: "bg-field-soft text-field" });
  }
  const m = o.economics.cycleMarginMmkHa;
  if (comparable && m) {
    out.push({
      icon: "cost",
      label: "Estimated return after listed costs",
      text: `${mmk(m[0])} to ${mmk(m[1])} MMK per hectare, using benchmark prices and costs.`,
      tone: "bg-surface-sunken text-ink",
    });
  }
  if (item?.tradeOff) out.push({ icon: "conditions", label: "Watch out for", text: item.tradeOff, tone: "bg-drought-soft text-drought" });
  if (item?.localCheck) out.push({ icon: "done", label: "Check before choosing", text: item.localCheck, tone: "bg-surface-sunken text-ink" });
  return out;
}

/** The crop sequence as large pills joined by arrows: readable without parsing a sentence. */
function CropPills({ names }: { names: string[] }) {
  if (names.length === 0) return <p className="m-0 text-body text-ink-muted">No crops recorded</p>;
  const occurrences = new Map<string, number>();
  return (
    <ol aria-label="Crops in order" className="m-0 flex list-none flex-wrap items-center gap-x-1.5 gap-y-2 p-0">
      {names.map((n, i) => {
        const occurrence = (occurrences.get(n) ?? 0) + 1;
        occurrences.set(n, occurrence);
        return (
          <li key={`${n}-${occurrence}`} className="flex items-center gap-1.5">
            {i > 0 ? <Icon name="next" size={16} className="text-ink-muted" aria-hidden /> : null}
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-field-soft px-3 text-body font-semibold text-ink">
              {n !== "Fallow" ? <Icon name="rotation" size={16} className="text-field" /> : null}
              {n.replace(/\s*\(.*\)\s*$/, "")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function keySeasonCount(strip: ReturnType<typeof seasonStrip>) {
  const known = knownCount(strip);
  return known === 0 ? unknown : `${stressedCount(strip)} of ${known}`;
}

export function RotationCompare({ fieldId }: { fieldId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const [scenario, setScenario] = useState<Scenario>(NO_SCENARIO);
  const [keepingMine, setKeepingMine] = useState(false);
  /** Sliders stay responsive while the options catch up on the same past seasons. */
  const testScenario = useDeferredValue(scenario);
  const testPending = testScenario !== scenario;

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);
  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  const analysis = useFieldAnalysis(field);
  const { engineData } = analysis;

  const savedPlan = rotations.find((rotation) => rotation.source === "strategy" && rotation.slots.length > 0);
  const savedRotation = rotations.find((rotation) => rotation.source === "farmer" && rotation.slots.length > 0) ?? savedPlan;
  const hasOwnRotation = savedRotation?.source === "farmer" && savedRotation.slots.length > 0;

  /**
   * When the farmer has not recorded their crops, the alternatives are still worth reading.
   * The engine needs a rotation to generate them from, so it gets an empty one; the empty
   * "current" option is never shown.
   */
  const placeholderRotation = useMemo<Rotation>(
    () => ({ id: "no-rotation", fieldId, label: "", cycleYears: 1, slots: [], source: "farmer" }),
    [fieldId],
  );
  const compareRotation = hasOwnRotation && savedRotation ? savedRotation : placeholderRotation;

  const effectiveEngineData = useMemo(() => (engineData ? applyScenario(engineData, testScenario) : null), [engineData, testScenario]);

  const canCompare = Boolean(field?.locationConfirmed && hasOwnRotation);
  const baseComparison = useMemo(
    () => (engineData && canCompare ? compareRotations(engineData, compareRotation) : null),
    [engineData, compareRotation, canCompare],
  );
  const comparison = useMemo(
    () => (effectiveEngineData && canCompare ? compareRotations(effectiveEngineData, compareRotation) : null),
    [effectiveEngineData, compareRotation, canCompare],
  );
  const revision = `${field?.updatedAt ?? ""}:${JSON.stringify(savedRotation ?? null)}`;
  const display = adaptComparison({
    mode: "field", phase: analysis.phase, field, rotation: savedRotation, data: effectiveEngineData,
    comparison, inputRevision: revision, resultRevision: testPending ? "pending" : comparison ? revision : null,
  });
  const whatIf = useMemo(
    () => (baseComparison && comparison && !isNeutral(testScenario) ? whatIfResult(baseComparison, comparison, { includeCurrent: hasOwnRotation }) : null),
    [baseComparison, comparison, testScenario, hasOwnRotation],
  );

  const shapedByChips = useMemo(() => {
    if (!field) return [];
    const list: Array<{ label: string; href: string }> = [];
    const irri = field.constraints?.irrigation?.access ?? field.irrigation;
    list.push({ label: copy.compare.chipWater(copy.irrigation[irri]), href: `/fields/${field.id}/profile` });
    if (field.constraints?.equipment?.length) {
      list.push({
        label: field.constraints.equipment.map((e) => copy.profile.equipment[e as keyof typeof copy.profile.equipment] ?? e).join(", "),
        href: `/fields/${field.id}/profile`,
      });
    }
    if (field.constraints?.labour) {
      list.push({ label: copy.compare.chipLabour(copy.profile.levels[field.constraints.labour]), href: `/fields/${field.id}/profile` });
    }
    if (field.constraints?.marketAccess) {
      list.push({ label: copy.compare.chipMarket(copy.profile.levels[field.constraints.marketAccess]), href: `/fields/${field.id}/profile` });
    }
    if (field.constraints?.excludedCropIds?.length) {
      const names = field.constraints.excludedCropIds.map((id) => getCropById(id)?.names.common ?? id).join(", ");
      list.push({ label: copy.compare.chipAvoids(names), href: `/fields/${field.id}/profile` });
    }
    if (field.constraints?.preferredCropIds?.length) {
      const names = field.constraints.preferredCropIds.map((id) => getCropById(id)?.names.common ?? id).join(", ");
      list.push({ label: copy.compare.chipPrefers(names), href: `/fields/${field.id}/profile` });
    }
    if (field.priorities?.order?.length) {
      list.push({
        label: copy.compare.chipPriority(copy.profile.priority[field.priorities.order[0]]),
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

  if (status === "idle" || status === "loading") {
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
      <Panel as="section" role="alert" className="flex flex-col items-start gap-3 p-5">
        <h1 className="m-0 text-title text-ink">Field not found</h1>
        <p className="m-0 max-w-measure text-body text-ink-muted">This field is not saved in this browser. Go back to your fields list to open a saved one.</p>
        <Link href="/" className={buttonClass("primary")}>
          Back to your fields
        </Link>
      </Panel>
    );
  }

  if (!comparison || display.state === "stale" || display.state === "data-unavailable") {
    const needsLocation = display.state === "field-incomplete" && !field.locationConfirmed;
    const needsCurrentCrops = display.state === "field-incomplete" && field.locationConfirmed;
    return (
      <Panel as="section" role="status" className="flex flex-col items-start gap-4 p-5 sm:p-6">
        <h1 className="m-0 text-title text-ink">{display.headline}</h1>
        <p className="m-0 max-w-measure text-body text-ink-muted">{display.detail}</p>
        {needsCurrentCrops ? (
          <Message tone="needs" title="Add what grows here">
            Choose the crops grown on this field and give the timing you remember. A month range or “not sure” is enough.
          </Message>
        ) : null}
        {display.gaps.length > 0 ? <ul className="m-0 list-disc space-y-2 pl-5 text-body-sm text-ink-muted">{display.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul> : null}
        {comparison && display.state === "data-unavailable" ? <>
          <Link href={`/fields/${field.id}/location`} className={buttonClass("secondary")}>Check field location</Link>
          <Link href={`/fields/${field.id}/rotation`} className={buttonClass("primary")}>Review crops and dates</Link>
          <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>Review water and field details</Link>
          <Link href="/plan" className={buttonClass("secondary")}>See regional examples</Link>
        </> : null}
        {display.state === "field-incomplete" ? (
          <Link href={needsLocation ? `/fields/${field.id}/location` : `/fields/${field.id}/rotation`} className={buttonClass("primary")}>
            {needsLocation ? "Confirm field location" : "Tell us what grows here now"}
          </Link>
        ) : display.state === "stale" ? null : (
          <button type="button" onClick={analysis.retry} className={buttonClass("secondary")}>Try loading again</button>
        )}
        {savedPlan && needsCurrentCrops ? <p className="m-0 text-body-sm text-ink-muted">Your saved plan stays in this browser while you add this information.</p> : null}
      </Panel>
    );
  }

  const now = hasOwnRotation ? comparison.current : null;
  const alternatives = display.options.filter((o) => o.kind === "alternative").map((o) => o.engine);
  const bestId: string | undefined = undefined;
  const rankOrder = new Map(comparison.mcda.ranking.map((r, i) => [r.rotationId, i]));
  const orderedAlternatives = [...alternatives].sort(
    (a, b) => (rankOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rankOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const displayOptions: EvaluatedOption[] = [comparison.current, ...orderedAlternatives];
  const place = placeName(comparison.region);
  const weatherLoading = analysis.phase === "loading";
  const weatherMissing = !weatherLoading && engineData?.power.status !== "ok";
  const hasAlternatives = alternatives.length > 0;

  const limitsById = new Map<string, LimitCheck[]>(
    displayOptions.map((o) => [o.id, checkLimits(o.rotation, field.constraints, field.irrigation, (id) => getCropById(id)?.names.common ?? id)]),
  );
  const yearsOf = (o: EvaluatedOption) => [...new Set(o.slots.flatMap((e) => e.water?.seasons.map((x) => x.year) ?? []))].sort();
  const stripOf = (o: EvaluatedOption) => seasonStrip(o, yearsOf(o));
  const rankedById = new Map(comparison.mcda.ranking.map((r, i) => [r.rotationId, { ...r, place: i + 1 }]));

  const pastSeasons = comparison.baseline.completeYears;
  const summary =
    comparison.region === "unsupported"
      ? copy.compare.summaryUnsupported
      : hasOwnRotation
        ? copy.compare.summaryWith(place, alternatives.length, pastSeasons)
        : copy.compare.summaryWithout(place, pastSeasons);

  const answerHeadline = display.headline;
  const answerReason = display.detail;


  const row = (label: string, cell: (o: EvaluatedOption) => ReactNode) => ({ label, cell });
  const tableRows: Array<{ group: string; items: Array<ReturnType<typeof row>> }> = [
    {
      group: copy.compare.groupLimits,
      items: [row(copy.compare.measureLimits, (o) => <LimitSummary checks={limitsById.get(o.id) ?? []} fieldId={field.id} />)],
    },
    {
      group: copy.compare.groupFit,
      items: [
        row(copy.compare.measureFit, (o) => <RiskChip hazard={FIT_HAZARD[o.fit]}>{copy.compare.fitLabel[o.fit]}</RiskChip>),
        row(copy.compare.measureCrops, (o) => (
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {o.rotation.slots.map((s, i) => (
              <li key={s.id}>
                <span className="tabular font-mono text-source text-ink-muted">{i + 1} </span>
                {slotName(s)}
              </li>
            ))}
          </ol>
        )),
        row(copy.compare.measureCycle, (o) => `${o.rotation.cycleYears} ${o.rotation.cycleYears > 1 ? "years" : "year"}`),
        row(copy.compare.measureCover, (o) => pct(o.structure.coveredShare)),
      ],
    },
    {
      group: copy.compare.groupSoil,
      items: [
        row(copy.compare.measureLegumes, (o) => (o.structure.cropSlots === 0 ? unknown : `${o.structure.legumeSlots} of ${o.structure.cropSlots} crops`)),
        row(copy.compare.measureNitrogen, (o) => {
          if (o.nitrogen.fixedKgHa && o.nitrogen.removedKgHa !== null) {
            const midFix = (o.nitrogen.fixedKgHa[0] + o.nitrogen.fixedKgHa[1]) / 2;
            const balance = Math.round(midFix - o.nitrogen.removedKgHa);
            if (balance >= 0) return <RiskChip hazard="healthy">Puts back about {balance} kg N/ha more than it takes</RiskChip>;
            return <RiskChip hazard="drought">Takes about {Math.abs(balance)} kg N/ha more than it puts back</RiskChip>;
          }
          if (o.nitrogen.fixedKgHa) return `${fmt(o.nitrogen.fixedKgHa[0])} to ${fmt(o.nitrogen.fixedKgHa[1])} kg N/ha fixed`;
          return "No legume nitrogen in this cycle";
        }),
        row(copy.compare.measureErosion, (o) =>
          o.erosion.exposure === "needs-slope-data" ? "Needs slope data" : o.erosion.exposure === "not-flagged" ? "Not flagged" : o.erosion.exposure === "possible" ? "Possible" : "Higher",
        ),
        row(copy.compare.measurePest, (o) =>
          o.slots.some(s => s.evaluationStatus === "not-evaluated") ? "Not-evaluated: overlapping crops" : o.pest.length === 0 ? "No same-family pair" : `${o.pest.filter((p) => p.shared.some((h) => h.severity === "caution")).length} of ${o.pest.length} pairs share a soil disease or pest; ${o.pest.filter((p) => p.result === "same-family").length} in the same family`,
        ),
      ],
    },
    {
      group: copy.compare.groupWater,
      items: [
        row(copy.compare.measureRain, (o) => (o.metrics["water-shortfall"] == null ? unknown : `${fmt(o.metrics["water-shortfall"])} mm`)),
        row(copy.compare.measureDry, (o) => (o.dryYear.evaluated === 0 ? unknown : `${o.dryYear.passes} of ${o.dryYear.evaluated} passed`)),
      ],
    },
    {
      group: copy.compare.groupMoney,
      items: [
        row("Estimated return after listed costs", (o) =>
          o.economics.cycleMarginMmkHa ? `${mmk(o.economics.cycleMarginMmkHa[0])} to ${mmk(o.economics.cycleMarginMmkHa[1])} MMK/ha` : unknown,
        ),
        row(copy.compare.measureFodder, (o) => String(o.forage.forageSlots)),
      ],
    },
    {
      group: copy.compare.groupUnknowns,
      items: [
        row(copy.compare.measureCheck, (o) => {
          if (o.unknowns.length === 0) return "None to check locally";
          if (o.unknowns.length === 1) return o.unknowns[0];
          return `${o.unknowns[0]} (+${o.unknowns.length - 1} more)`;
        }),
      ],
    },
  ];

  const alternativeNumber = new Map(orderedAlternatives.map((o, i) => [o.id, i + 1]));
  const optionName = (o: EvaluatedOption) =>
    o.id === comparison.current.id && hasOwnRotation ? "What you grow now" : `Choice ${alternativeNumber.get(o.id) ?? ""}`.trim();
  const visibleOptions = displayOptions.filter((o) => hasOwnRotation || o.id !== comparison.current.id || !hasAlternatives);

  return (
    <>
      <FieldPageHeader title={copy.compare.title} summary={summary} />

      <WhatIfBanner scenario={testScenario} recorded={field.irrigation} onReset={() => setScenario(NO_SCENARIO)} />

      {/* 1. The short answer, in one place */}
      <section aria-label="Comparison summary" className="flex flex-col gap-3 rounded-lg border border-field/30 bg-field-soft/40 p-4 sm:p-5">
        <h2 className="m-0 text-headline text-ink">{answerHeadline}</h2>
        <p className="m-0 max-w-measure text-body text-ink">{answerReason}</p>
        {hasOwnRotation && comparison.mcda.assumedPriorities ? (
          <Message
            tone="needs"
            title={copy.compare.assumedPriorities}
            action={
              <Link href={`/fields/${field.id}/questions/priority`} className={buttonClass("secondary")}>
                {copy.compare.assumedChange}
              </Link>
            }
          />
        ) : null}
      </section>

      {!hasOwnRotation && hasAlternatives ? (
        <Message
          tone="needs"
          title={copy.compare.noRotationTitle}
          action={
            <Link href={`/fields/${field.id}/rotation`} className={buttonClass("secondary")}>
              {copy.compare.noRotationAction}
            </Link>
          }
        >
          {copy.compare.noRotationBody}
        </Message>
      ) : null}

      {hasOwnRotation && comparison.shortfall && hasAlternatives ? (
        <Message
          tone="caution"
          title={comparison.region === "unsupported" ? copy.compare.unsupported : copy.compare.shortfallTitle}
          action={
            comparison.region !== "unsupported" && hasAlternatives ? (
              <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
                {copy.compare.shortfallAction}
              </Link>
            ) : null
          }
        >
          {comparison.region === "unsupported" ? copy.compare.unsupportedBody : copy.compare.shortfallBody}
        </Message>
      ) : null}

      {!hasAlternatives ? (
        comparison.region === "unsupported" ? (
          <Link href={`/fields/${field.id}/conditions`} className={buttonClass("secondary", "self-start")}>
            {copy.compare.unsupportedAction}
          </Link>
        ) : (
          <Message
            tone="info"
            title={copy.compare.noAlternativesTitle}
            action={
              <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
                {copy.compare.shortfallAction}
              </Link>
            }
          >
            {copy.compare.noAlternativesBody(place)}
          </Message>
        )
      ) : null}

      {weatherLoading ? (
        <Message tone="info" role="status" title={copy.compare.weatherLoadingTitle}>
          {copy.compare.weatherLoadingBody}
        </Message>
      ) : null}

      {weatherMissing ? (
        <Message
          tone="needs"
          role="status"
          title={copy.compare.weatherMissingTitle}
          action={
            <button type="button" onClick={analysis.retry} className={buttonClass("secondary")}>
              {copy.home.retry}
            </button>
          }
        >
          {copy.compare.weatherMissingBody}
        </Message>
      ) : null}

      {/* 2. Each choice as one open card: crops, one status, a few facts with icons */}
      {visibleOptions.length > 0 ? (
        <section aria-labelledby="options-title" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="options-title" className="m-0 text-headline text-ink">
              {hasAlternatives ? copy.compare.optionsTitle : copy.compare.optionsTitleYours}
            </h2>
            <p className="m-0 max-w-measure text-body-sm text-ink-muted">
              {!hasAlternatives ? copy.compare.optionsDescriptionYours : hasOwnRotation ? copy.compare.optionsDescription : copy.compare.optionsDescriptionSolo}
            </p>
          </div>
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {visibleOptions.map((o) => {
              const isYours = o.id === comparison.current.id && hasOwnRotation;
              const item = display.options.find((d) => d.id === o.id);
              const limits = limitsById.get(o.id) ?? [];
              const facts = simpleFacts(o, now, isYours, display.state === "comparable", item);
              return (
                <li key={o.id}>
                  <article
                    aria-labelledby={`choice-${o.id}`}
                    className={"flex flex-col gap-4 rounded-lg border bg-surface-raised p-4 sm:p-5 " + (isYours ? "border-line-strong" : "border-line")}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 id={`choice-${o.id}`} className="m-0 text-label font-semibold text-ink-muted">
                          {optionName(o)}
                        </h3>
                        <RiskChip hazard={FIT_HAZARD[o.fit]}>{copy.compare.fitLabel[o.fit]}</RiskChip>
                      </div>
                      <CropPills names={o.rotation.slots.map((sl) => slotName(sl))} />
                      {limits.some((c) => c.result === "fail") ? <Message tone="problem" compact title="Breaks one of the limits you set" /> : null}
                      {o.fit === "does-not-fit" && o.noFitReason ? <p className="m-0 text-body-sm text-ink">{o.noFitReason}</p> : null}
                    </div>

                    {facts.length > 0 ? (
                      <ul className="m-0 flex list-none flex-col gap-3 border-t border-line p-0 pt-3">
                        {facts.map((f) => (
                          <li key={f.text} className="flex items-start gap-3">
                            <span className={"grid size-9 shrink-0 place-items-center rounded-pill " + f.tone}>
                              <Icon name={f.icon} size={18} />
                            </span>
                            <span className="flex min-w-0 flex-col pt-0.5">
                              <span className="text-source font-medium text-ink-muted">{f.label}</span>
                              <span className="text-body text-ink">{f.text}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <details className="group border-t border-line pt-1">
                      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 text-label font-medium text-field [&::-webkit-details-marker]:hidden">
                        <Icon name="next" size={18} className="transition-transform group-open:rotate-90" />
                        More details
                      </summary>
                      <OptionRow
                        option={o}
                        now={now}
                        limits={limits}
                        strip={stripOf(o)}
                        depth="reasons"
                        best={o.id === bestId}
                        isYours={isYours}
                        place={display.state === "comparable" ? rankedById.get(o.id)?.place : undefined}
                        field={field}
                        display={item}
                        showComparativeMetrics={display.state === "comparable"}
                        hideSummary
                      />
                    </details>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {/* 3. What to do next, straight after the choices */}
      <section aria-labelledby="next-step" className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4 sm:p-5 print:hidden">
        <h2 id="next-step" className="m-0 text-headline text-ink">What would you like to do?</h2>
        <Link href={`/fields/${field.id}/report`} className={buttonClass("primary", "w-full sm:w-auto", "lg")}>
          <Icon name="report" />
          See my farmer summary
        </Link>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          {hasOwnRotation ? (
            <button type="button" onClick={() => setKeepingMine(true)} className={buttonClass("secondary", "w-full sm:w-auto")}>
              <Icon name="done" />
              Keep my current crops
            </button>
          ) : null}
          <Link href={`/fields/${field.id}/rotation`} className={buttonClass("secondary", "w-full sm:w-auto")}>
            <Icon name="rotation" />
            Change my crops
          </Link>
        </div>
        {keepingMine ? (
          <Message tone="success" role="status" title="Your current crops are unchanged">
            You can come back and change them later.
          </Message>
        ) : null}
      </section>

      <Disclosure title="Before planting: questions to check locally">
        <CheckLocally
          cropNames={[
            ...new Set(
              displayOptions
                .filter((o) => o.id !== comparison.current.id)
                .flatMap((o) => o.slots.map((e) => e.name))
                .filter(Boolean),
            ),
          ]}
        />
      </Disclosure>

      <JudgmentNote compact />

      {/* 4. Detail for advisers and extension workers, out of the farmer's way */}
      <section aria-labelledby="adviser-detail" className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 id="adviser-detail" className="m-0 text-label font-semibold text-ink">For advisers: more detail</h2>
          <p className="m-0 text-body-sm text-ink-muted">You do not need these to decide. They show how the choices were checked.</p>
        </div>

        <Disclosure title="How we checked these choices" hint={display.state === "comparable" ? "Ready" : "Some information is missing"}>
          <p className="m-0 max-w-measure text-body-sm text-ink-muted">
            We replayed {display.replay?.completeYears ?? 0} complete past years from 2016–2025 to compare how each choice handled the same weather.
          </p>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink-muted">
            <li>Regional weather: {plainSourceStatus(display.sourceStatuses?.power)}</li>
            <li>Detailed satellite rain: {plainSourceStatus(display.sourceStatuses?.imerg)}</li>
            <li>Regional soil moisture: {plainSourceStatus(display.sourceStatuses?.smap)}</li>
            <li>Clear crop-cover images: {plainSourceStatus(display.sourceStatuses?.hls)}</li>
            <li>Land slope: {plainSourceStatus(display.sourceStatuses?.srtm)}</li>
          </ul>
          {analysis.retrieving ? <p className="m-0 text-body-sm text-ink">More information is still loading. You can review what is ready now.</p> : null}
          {analysis.showingCache ? <p className="m-0 text-body-sm text-ink">You are seeing previously saved information because a refresh is not available.</p> : null}
          {display.state === "partial-evidence" || display.state === "unresolved" ? <button type="button" onClick={analysis.retry} className={buttonClass("secondary", "self-start")}>Try loading again</button> : null}
        </Disclosure>
      {hasAlternatives && display.state === "comparable" ? (
        <details className="rounded-md border border-line bg-surface">
          <summary className="min-h-tap cursor-pointer p-4 text-label text-ink">{copy.compare.measures}</summary>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[44rem] border-collapse text-left">
              <caption className="sr-only">{copy.compare.tableLabel}</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-[20%] bg-surface-raised p-4">
                    <span className="sr-only">Measure</span>
                  </th>
                  {displayOptions.map((o) => (
                    <th key={o.id} scope="col" className={"p-4 align-top " + (o.id === bestId ? "border-t-4 border-t-field bg-field-soft/60" : "")}>
                      <span className="block text-headline text-ink">{optionName(o)}</span>
                      <span className="mt-0.5 block text-body-sm text-ink-muted">{o.label}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {o.id === comparison.current.id && hasOwnRotation ? <StatusTag tag="yours" /> : null}
                        {o.id === bestId ? <StatusTag tag="best-match" /> : null}
                        {(limitsById.get(o.id) ?? []).some((c) => c.result === "fail") ? <StatusTag tag="limit-fail" /> : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((g) => (
                  <TableGroup key={g.group} title={g.group} cols={displayOptions.length + 1}>
                    {g.items.map((it) => (
                      <tr key={it.label} className="border-t border-line">
                        <th scope="row" className="sticky left-0 z-10 bg-surface-raised p-4 text-left text-body-sm font-normal text-ink-muted">
                          {it.label}
                        </th>
                        {displayOptions.map((o) => (
                          <td key={o.id} className={"p-4 align-top text-body-sm text-ink " + (o.id === bestId ? "bg-field-soft/60" : "")}>
                            {it.cell(o)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </TableGroup>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {displayOptions.length > 0 ? (
        <Disclosure title={copy.compare.evidenceAllTitle} lazy>
          <div className="flex flex-col gap-6">
            {displayOptions.map((o, i) => (
              <div key={o.id} className="flex flex-col gap-3">
                <h3 className="m-0 text-headline text-ink">{optionName(o)}</h3>
                <OptionDetail option={o} rainyMonths={rainyMonths} fieldId={field.id} region={field.region} showCalls={i === 0} />
              </div>
            ))}
          </div>
        </Disclosure>
      ) : null}

      {comparison.region !== "unsupported" && (hasOwnRotation || comparison.mcda.status === "ranked") ? (
        <Disclosure title="How the choices were ordered" hint={comparison.mcda.status === "ranked" ? "Using what matters to you" : "No fair order yet"}>
          {comparison.mcda.status === "no-priorities" ? (
            <div className="flex flex-col items-start gap-2">
              <p className="m-0 max-w-measure text-body text-ink">{copy.compare.rankingNone}</p>
              <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.compare.rankingNoneBody}</p>
              <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
                {copy.compare.needProfile}
              </Link>
            </div>
          ) : null}
          {comparison.mcda.status === "ranked" && display.state === "comparable" ? (
            <>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {comparison.mcda.ranking.map((r, i) => ({ ...r, originalPlace: i + 1 })).filter((r) => displayOptions.some((o) => o.id === r.rotationId)).map((r) => {
                  const o = displayOptions.find((x) => x.id === r.rotationId);
                  return (
                    <li key={r.rotationId} className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-3">
                      <span className="tabular grid min-h-7 min-w-10 place-items-center rounded-pill border border-line-strong px-2 font-mono text-source">
                        {copy.compare.rankPlace(r.originalPlace)}
                      </span>
                      <span className="min-w-0 flex-1 text-label text-ink">{o ? optionName(o) : ""}</span>
                      {r.originalPlace === 1 && display.tiedFirst ? <span className="text-source text-ink-muted">Close score; no clear first choice</span> : null}
                      {o && o.badges.length > 0 ? <span className="w-full text-body-sm text-ink-muted">{o.badges.map(farmerBadge).join(" · ")}</span> : null}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
          {comparison.mcda.status === "unresolved" ? <p className="m-0 max-w-measure text-body text-ink">There is not enough matching information to put these choices in a fair order. Review each choice and the local checks instead.</p> : null}
          {comparison.sensitivity.some((s) => s.topLabel) ? (
              <div className="flex flex-col gap-1">
                <h3 className="m-0 text-label text-ink">{copy.compare.sensitivityTitle}</h3>
                <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-body-sm text-ink-muted">
                  {comparison.sensitivity
                    .filter((s) => s.topLabel)
                    .map((s) => (
                      <li key={s.priority}>
                        {copy.compare.sensitivityLine(
                          copy.profile.priority[s.priority as keyof typeof copy.profile.priority].toLowerCase(),
                          s.topLabel as string,
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            <p className="m-0 text-source text-ink-muted">
              {copy.compare.rankCriteria(comparison.mcda.used.map((id) => CRITERIA.find((c) => c.id === id)?.label.toLowerCase()).join(", "))}
            </p>
          {comparison.mcda.partial.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-label text-ink">{copy.compare.partialTitle}</h3>
              <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-body-sm text-ink-muted">
                {comparison.mcda.partial.map((x) => (
                  <li key={x.rotationId}>
                    {comparison.alternatives.find((o) => o.id === x.rotationId)?.label ?? (comparison.current.id === x.rotationId ? "Your current rotation" : x.rotationId)}: {x.warning}
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
          <div className="flex flex-col items-start gap-2 border-t border-line pt-3">
            <h3 className="m-0 text-label text-ink">{copy.compare.rankUsed}</h3>
            {shapedByChips.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {shapedByChips.map((chip) => (
                  <Link
                    key={chip.label}
                    href={chip.href}
                    className="inline-flex items-center rounded-pill border border-line bg-surface-raised px-2.5 py-1 text-source text-ink no-underline transition-colors hover:border-line-strong hover:bg-surface-sunken"
                  >
                    {chip.label}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="m-0 text-body-sm text-ink-muted">{copy.compare.rankUsedNothing}</p>
            )}
            <Link href={`/fields/${field.id}/profile`} className="text-label text-field underline hover:text-ink">
              {copy.compare.rankChange}
            </Link>
          </div>
        </Disclosure>
      ) : null}

      {display.state === "comparable" && displayOptions.length > 0 ? (
        <WhatIf scenario={scenario} onChange={setScenario} result={whatIf} pending={testPending} recorded={field.irrigation} />
      ) : null}

      {comparison.region !== "unsupported" &&
      (comparison.dataGaps.length > 0 || comparison.rejected.length > 0 || analysis.retrieving) ? (
        <Disclosure title={copy.compare.couldntCheck} hint={`(${comparison.dataGaps.length + comparison.rejected.length})`}>
          {analysis.retrieving ? <p className="m-0 text-body-sm text-ink-muted">{copy.compare.stillRetrieving}</p> : null}
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
            {display.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
            {comparison.rejected.map((r) => (
              <li key={r.template.id}>
                {r.template.label}: {r.reason}
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      </section>
    </>
  );
}

function OptionRow({
  option: o,
  now,
  limits,
  strip,
  depth,
  best,
  isYours,
  place,
  field,
  display,
  showComparativeMetrics,
  hideSummary = false,
}: {
  option: EvaluatedOption;
  now: EvaluatedOption | null;
  limits: LimitCheck[];
  strip: ReturnType<typeof seasonStrip>;
  depth: "answer" | "reasons" | "evidence";
  best: boolean;
  isYours: boolean;
  place?: number;
  field: Field;
  display?: DisplayOption;
  showComparativeMetrics: boolean;
  /** Inside a choice card the name, status, caution and check are already shown above. */
  hideSummary?: boolean;
}) {
  const diffs = now && !isYours ? differences(o, now) : [];
  const figures = keyFigures(o, strip);
  const fail = limits.some((c) => c.result === "fail");

  return (
    <article
      aria-labelledby={hideSummary ? undefined : `option-${o.id}`}
      aria-label={hideSummary ? "More details" : undefined}
      className={
        "relative flex min-w-0 flex-col gap-4 border-t bg-surface-raised p-4 sm:p-5 " +
        (best ? "border-2 border-field bg-field-soft/40 pt-6" : "border-line")
      }
    >
      {best ? (
        <span className="absolute -top-3 left-4 inline-flex min-h-6 items-center gap-1 rounded-pill bg-field px-3 text-source font-medium text-on-field">
          <span aria-hidden>✓</span>
          Best match for what matters to you
        </span>
      ) : null}
      {!hideSummary ? <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`option-${o.id}`} className="m-0 min-w-0 text-headline text-ink">
            {isYours ? "What you grow now" : o.label}
          </h3>
          {isYours ? <StatusTag tag="yours" /> : null}
          {fail ? <StatusTag tag="limit-fail" /> : null}
          {place && !best ? <span className="text-source text-ink-muted">{copy.compare.rankPlace(place)} for what matters to you</span> : null}
        </div>
        <p className="m-0 max-w-measure text-body text-ink-muted">{isYours ? copy.compare.yoursNote : o.reason}</p>
        <div className="flex flex-wrap gap-2">
          <RiskChip hazard={FIT_HAZARD[o.fit]}>{copy.compare.fitLabel[o.fit]}</RiskChip>
          {o.badges.map((b) => (
            <RiskChip key={b} hazard="healthy">
              {farmerBadge(b)}
            </RiskChip>
          ))}
        </div>
        {o.fit === "does-not-fit" && o.noFitReason ? <p className="m-0 max-w-measure text-body-sm text-ink">{o.noFitReason}</p> : null}
      </div> : <p className="m-0 max-w-measure text-body-sm text-ink-muted">{isYours ? copy.compare.yoursNote : o.reason}</p>}

      {display ? (
        <dl className="m-0 flex flex-col gap-2 border-t border-line pt-3 text-body-sm">
          {!hideSummary ? <>
            <div><dt className="font-medium text-ink">Main caution</dt><dd className="m-0 text-ink-muted">{display.tradeOff}</dd></div>
            <div><dt className="font-medium text-ink">Check before choosing</dt><dd className="m-0 text-ink-muted">{display.localCheck}</dd></div>
          </> : null}
          {depth !== "answer" ? <>
            <div><dt className="font-medium text-ink">What we assumed</dt><dd className="m-0 text-ink-muted">{display.assumption}</dd></div>
            <div><dt className="font-medium text-ink">What we still do not know</dt><dd className="m-0 text-ink-muted">{display.unknown}</dd></div>
          </> : null}
          {depth === "evidence" ? <div><dt className="font-medium text-ink">Information used</dt><dd className="m-0 text-ink-muted">{display.sources.length ? `${display.sources[0].product}: ${plainSourceStatus(display.sources[0].status)}` : "No source is attached to this choice."}</dd></div> : null}
        </dl>
      ) : null}

      {depth === "evidence" && display?.sources.length ? (
        <details className="text-body-sm text-ink-muted">
          <summary className="min-h-tap cursor-pointer text-label text-field">See all information sources ({display.sources.length})</summary>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
            {display.sources.map((s, i) => <li key={`${s.product}-${i}`}>{s.claim}: {s.lineage}. Status: {s.status}{s.missingReason ? `; missing: ${s.missingReason}` : ""}{s.sourceUrl ? <> · <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-field underline">Source</a></> : null}</li>)}
          </ul>
        </details>
      ) : null}

      {showComparativeMetrics && now && !isYours && diffs.length > 0 ? (
        <ul className="m-0 flex max-w-measure list-disc flex-col gap-1 pl-5 text-body text-ink">
          {diffs.slice(0, depth === "answer" ? 2 : diffs.length).map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}

      {showComparativeMetrics ? <dl className="m-0 grid grid-cols-2 gap-2">
        {figures.slice(0, depth === "answer" ? 2 : figures.length).map((f) => (
          <div key={f.label} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-surface p-3">
            <dt className="text-body-sm text-ink-muted">{f.label}</dt>
            <dd className="tabular m-0 text-label text-ink">{f.value}</dd>
          </div>
        ))}
      </dl> : null}

      {depth !== "answer" ? (
        <>
          {strip.length > 0 ? (
            <div className="flex flex-col gap-2">
              <SeasonStrip strip={strip} field={field} />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <h4 className="m-0 text-label text-ink">{copy.compare.cropsInOrder}</h4>
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {o.rotation.slots.map((s, i) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-2 text-body-sm text-ink">
                  <span className="tabular font-mono text-source text-ink-muted">{i + 1}</span>
                  <span>{slotName(s)}</span>
                  <span className="text-ink-muted">{formatSpan(s.plantDate, s.harvestDate)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="m-0 text-label text-ink">{copy.compare.againstLimits}</h4>
            <LimitSummary checks={limits} fieldId={field.id} />
          </div>
          {o.unknowns.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h4 className="m-0 text-label text-ink">{copy.compare.notKnownYet}</h4>
              <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-body-sm text-ink-muted">
                {o.unknowns.slice(0, 3).map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function TableGroup({ title, cols, children }: { title: string; cols: number; children: ReactNode }) {
  return (
    <>
      <tr className="border-t border-line bg-surface">
        <th scope="colgroup" colSpan={cols} className="px-4 py-2 text-left text-label font-medium text-ink">
          {title}
        </th>
      </tr>
      {children}
    </>
  );
}
