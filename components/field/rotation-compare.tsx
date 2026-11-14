"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActionBar } from "@/components/ui/action-bar";
import { Icon } from "@/components/ui/icon";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { FIT_HAZARD, OptionDetail } from "@/components/field/option-detail";
import { StatusTag } from "@/components/ui/status";
import { LimitSummary } from "@/components/field/limit-checks";
import { CheckLocally } from "@/components/field/check-locally";
import { SeasonStrip } from "@/components/field/season-strip";
import { WhatIfBody, type WhatIfRow } from "@/components/field/what-if";
import { applyScenario, ASSUMED_IRRIGATION_MM, NO_SCENARIO, isNeutral, type Scenario } from "@/lib/engine/scenario";
import { knownCount, seasonStrip, stressedCount } from "@/lib/engine/strip";
import { openQuickQuestions } from "@/lib/engine/questions";
import { checkLimits, type LimitCheck } from "@/lib/engine/limits";
import { buttonClass } from "@/components/ui/button";
import { InfoGlyph } from "@/components/ui/icons";
import { Disclosure } from "@/components/ui/disclosure";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Recommendation } from "@/components/ui/recommendation";
import { RiskChip } from "@/components/ui/risk-chip";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { copy } from "@/lib/copy/en";
import { getCropById } from "@/lib/data/crops";
import { monthlyNormals } from "@/lib/engine/climate";
import { compareRotations, type EvaluatedOption } from "@/lib/engine/compare";
import { BASELINE } from "@/lib/engine/data";
import { CRITERIA } from "@/lib/engine/mcda";
import { formatSpan, slotName } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import type { Field, Irrigation, Rotation } from "@/lib/types";

const unknown = "Not known";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? unknown : n.toFixed(d));
const mmk = (n: number) => Math.round(n).toLocaleString();

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
  if (m) out.push({ label: copy.compare.numbersMargin, value: `${mmk(m[0])}–${mmk(m[1])} MMK/ha` });
  if (o.forage.forageSlots > 0) out.push({ label: copy.compare.numbersFodder, value: String(o.forage.forageSlots) });
  return out;
}

function keySeasonCount(strip: ReturnType<typeof seasonStrip>) {
  const known = knownCount(strip);
  return known === 0 ? unknown : `${stressedCount(strip)} of ${known}`;
}

interface RangeInsight {
  label: string;
  min: string;
  max: string;
  yours: string | null;
}

/** The measure where the alternatives spread widest, so the answer says something true when nothing is ranked. */
function widestRange(options: EvaluatedOption[], now: EvaluatedOption): RangeInsight | null {
  const build = (
    label: string,
    values: number[],
    yours: number | null,
    format: (n: number) => string,
    floor: number,
  ): RangeInsight | null => {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max - min < floor) return null;
    return { label, min: format(min), max: format(max), yours: yours === null ? null : format(yours) };
  };

  const rain = build(
    copy.compare.numbersRain,
    options.map((o) => o.metrics["water-shortfall"]).filter((v): v is number => v !== null && v !== undefined),
    now.metrics["water-shortfall"] ?? null,
    (n) => `${Math.round(n)} mm`,
    10,
  );
  if (rain) return rain;

  const cover = build(
    copy.compare.numbersCover,
    options.map((o) => o.structure.coveredShare * 100),
    now.structure.coveredShare * 100,
    (n) => `${Math.round(n)}%`,
    10,
  );
  if (cover) return cover;

  const margins = options.map((o) => o.economics.cycleMarginMmkHa).filter((v): v is [number, number] => Boolean(v));
  const mine = now.economics.cycleMarginMmkHa;
  return build(
    copy.compare.numbersMargin,
    margins.map((v) => Math.round((v[0] + v[1]) / 2)),
    mine ? Math.round((mine[0] + mine[1]) / 2) : null,
    (n) => `${mmk(n)} MMK/ha`,
    2_000,
  );
}

export function RotationCompare({ fieldId }: { fieldId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const [depth, setDepth] = useState<"answer" | "reasons" | "evidence">("answer");
  const [scenario, setScenario] = useState<Scenario>(NO_SCENARIO);
  const [whatIfIrrigation, setWhatIfIrrigation] = useState<Irrigation | null>(null);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);
  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  const analysis = useFieldAnalysis(field);
  const { engineData } = analysis;

  const savedRotation = rotations[0];
  const hasOwnRotation = !!savedRotation && savedRotation.slots.length > 0;

  /**
   * When the farmer has not recorded their crops, the alternatives are still worth reading.
   * The engine needs a rotation to generate them from, so it gets an empty one; the empty
   * "current" option is never shown.
   */
  const placeholderRotation = useMemo<Rotation>(
    () => ({ id: "no-rotation", fieldId, label: "", cycleYears: 1, slots: [], source: "farmer" }),
    [fieldId],
  );
  const compareRotation = hasOwnRotation ? savedRotation : placeholderRotation;

  const effectiveEngineData = useMemo(() => {
    if (!engineData) return null;
    const base = applyScenario(engineData, scenario);
    if (whatIfIrrigation === null) return base;
    const clonedField = {
      ...engineData.field,
      irrigation: whatIfIrrigation,
      constraints: {
        ...engineData.field.constraints,
        irrigation: {
          access: whatIfIrrigation,
          amountMm: engineData.field.constraints?.irrigation?.amountMm ?? ASSUMED_IRRIGATION_MM[whatIfIrrigation === "supplemental" ? "supplemental" : "full"],
        },
      },
    };
    return { ...base, field: clonedField };
  }, [engineData, whatIfIrrigation, scenario]);

  const baseComparison = useMemo(
    () => (engineData ? compareRotations(engineData, compareRotation) : null),
    [engineData, compareRotation],
  );
  const comparison = useMemo(
    () => (effectiveEngineData ? compareRotations(effectiveEngineData, compareRotation) : null),
    [effectiveEngineData, compareRotation],
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

  const questions = useMemo(() => (field ? openQuickQuestions(field) : []), [field]);
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

  if (!comparison) {
    return (
      <Panel as="section" role="alert" className="flex flex-col items-start gap-3 p-5">
        <h1 className="m-0 text-title text-ink">The comparison did not load</h1>
        <p className="m-0 max-w-measure text-body text-ink-muted">The field data could not be prepared. Try again, or check the Conditions page.</p>
        <button type="button" onClick={analysis.retry} className={buttonClass("secondary")}>
          Try again
        </button>
      </Panel>
    );
  }

  const now = hasOwnRotation ? comparison.current : null;
  const alternatives = comparison.alternatives;
  const bestId = comparison.mcda.status === "ranked" ? comparison.mcda.ranking[0]?.rotationId : undefined;
  const rankOrder = new Map(comparison.mcda.ranking.map((r, i) => [r.rotationId, i]));
  const orderedAlternatives = [...alternatives].sort(
    (a, b) => (rankOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rankOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const displayOptions: EvaluatedOption[] = hasOwnRotation ? [...orderedAlternatives, comparison.current] : orderedAlternatives;
  const leadOption = orderedAlternatives.find((o) => o.fit !== "does-not-fit") ?? orderedAlternatives[0];
  const bestOption = bestId ? displayOptions.find((o) => o.id === bestId) : undefined;
  const range = hasOwnRotation && !bestOption && orderedAlternatives.length >= 2 ? widestRange(orderedAlternatives, comparison.current) : null;
  const leadDifferences = leadOption && now ? differences(leadOption, now) : [];
  const place = placeName(comparison.region);
  const weatherLoading = analysis.phase === "loading";
  const weatherMissing = !weatherLoading && engineData?.power.status !== "ok";
  const hasAlternatives = alternatives.length > 0;

  const limitsById = new Map<string, LimitCheck[]>(
    displayOptions.map((o) => [o.id, checkLimits(o.rotation, field.constraints, field.irrigation, (id) => getCropById(id)?.names.common ?? id)]),
  );
  const yearsOf = (o: EvaluatedOption) => [...new Set(o.slots.flatMap((e) => e.water?.seasons.map((x) => x.year) ?? []))].sort();
  const stripOf = (o: EvaluatedOption) => seasonStrip(o, yearsOf(o));
  const baseById = new Map((baseComparison ? [baseComparison.current, ...baseComparison.alternatives] : []).map((o) => [o.id, o]));
  const whatIfRows: WhatIfRow[] = displayOptions.map((o) => {
    const after = stripOf(o);
    const b = baseById.get(o.id);
    return { id: o.id, label: o.label, before: b ? stressedCount(stripOf(b)) : 0, after: stressedCount(after), known: knownCount(after) };
  });
  const rankedById = new Map(comparison.mcda.ranking.map((r, i) => [r.rotationId, { ...r, place: i + 1 }]));

  const pastSeasons = Math.max(comparison.baseline.completeYears, BASELINE.endYear - BASELINE.startYear + 1);
  const summary =
    comparison.region === "unsupported"
      ? copy.compare.summaryUnsupported
      : hasOwnRotation
        ? copy.compare.summaryWith(place, alternatives.length, pastSeasons)
        : copy.compare.summaryWithout(place, pastSeasons);

  const answerHeadline = comparison.region === "unsupported"
    ? copy.compare.unsupported
    : hasOwnRotation && !hasAlternatives
    ? copy.compare.noAlternativesTitle
    : bestOption && bestOption.id === comparison.current.id && hasOwnRotation
      ? copy.compare.answerYours
      : bestOption
        ? copy.compare.answerBest(bestOption.label)
        : !hasOwnRotation
          ? copy.compare.answerNoRotation(alternatives.length, place)
          : range
            ? copy.compare.answerRange(range.label)
            : copy.compare.answerWhere;

  const answerReason = comparison.region === "unsupported"
    ? copy.compare.unsupportedBody
    : hasOwnRotation && !hasAlternatives
      ? copy.compare.noAlternativesBody(place)
      : bestOption && !hasOwnRotation
      ? copy.compare.answerNoRotationBest
      : !hasOwnRotation
        ? copy.compare.answerNoRotationReason
        : range && !bestOption
          ? copy.compare.answerRangeBody(range.min, range.max, range.yours)
          : leadOption && leadDifferences.length > 0
            ? `${bestOption && bestOption.id === comparison.current.id ? copy.compare.answerLead(leadOption.label) : ""} ${leadDifferences.slice(0, 2).join(" ")}`.trim()
            : copy.compare.answerNoNumbers;

  const answerOption = bestOption ?? (range ? undefined : leadOption);

  const row = (label: string, cell: (o: EvaluatedOption) => ReactNode) => ({ label, cell });
  const tableRows: Array<{ group: string; items: Array<ReturnType<typeof row>> }> = [
    {
      group: copy.compare.groupLimits,
      items: [row(copy.compare.measureLimits, (o) => <LimitSummary checks={limitsById.get(o.id) ?? []} />)],
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
          o.pest.length === 0 ? "No same-family pair" : `${o.pest.filter((p) => p.result === "same-family").length} of ${o.pest.length} pairs in the same family`,
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
        row(copy.compare.measureMargin, (o) =>
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

  return (
    <>
      <FieldPageHeader title={copy.compare.title} summary={summary} />

      <Recommendation
        as="h2"
        context={copy.compare.answerContext}
        headline={answerHeadline}
        reason={answerReason}
        risks={
          answerOption
            ? [
                { hazard: FIT_HAZARD[answerOption.fit], label: copy.compare.fitLabel[answerOption.fit] },
                ...answerOption.badges.map((b) => ({ hazard: "healthy" as const, label: b })),
              ]
            : undefined
        }
      />

      {hasOwnRotation && comparison.mcda.assumedPriorities ? (
        <p className="m-0 flex flex-wrap items-center gap-x-2 text-body-sm text-ink-muted">
          <span className="rounded-pill border border-line bg-surface px-2.5 py-1 text-source text-ink">{copy.compare.assumedPriorities}</span>
          <Link href={`/fields/${field.id}/questions/priority`} className="inline-flex min-h-tap items-center text-label text-field underline hover:text-ink">
            {copy.compare.assumedChange}
          </Link>
        </p>
      ) : null}

      {questions.length > 0 && comparison.region !== "unsupported" ? (
        <Link
          href={questions[0].href}
          className="flex min-h-tap items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-label text-ink no-underline hover:border-line-strong"
        >
          <span>{copy.compare.sharpen(questions.length)}</span>
          <Icon name="next" />
        </Link>
      ) : null}

      {!hasOwnRotation && hasAlternatives ? (
        <Panel as="section" tone="plain" role="status" className="flex flex-col items-start gap-3 p-4 sm:p-5">
          <h2 className="m-0 text-headline text-ink">{copy.compare.noRotationTitle}</h2>
          <p className="m-0 max-w-measure text-body text-ink-muted">{copy.compare.noRotationBody}</p>
          <Link href={`/fields/${field.id}/rotation`} className={buttonClass("secondary")}>
            {copy.compare.noRotationAction}
          </Link>
        </Panel>
      ) : null}

      {hasOwnRotation && comparison.shortfall && hasAlternatives ? (
        <Panel as="section" tone="plain" role="status" className="flex flex-col items-start gap-2 p-4 sm:p-5">
          <h2 className="m-0 text-headline text-ink">
            {comparison.region === "unsupported" ? copy.compare.unsupported : copy.compare.shortfallTitle}
          </h2>
          <p className="m-0 max-w-measure text-body text-ink-muted">
            {comparison.region === "unsupported" ? copy.compare.unsupportedBody : copy.compare.shortfallBody}
          </p>
          {comparison.region !== "unsupported" && hasAlternatives ? (
            <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
              {copy.compare.shortfallAction}
            </Link>
          ) : null}
        </Panel>
      ) : null}

      {!hasAlternatives ? (
        comparison.region === "unsupported" ? (
          <Link href={`/fields/${field.id}/conditions`} className={buttonClass("secondary", "self-start")}>
            {copy.compare.unsupportedAction}
          </Link>
        ) : (
          <Panel as="section" tone="plain" role="status" className="flex flex-col items-start gap-2 p-4 sm:p-5">
            <h2 className="m-0 text-headline text-ink">{copy.compare.noAlternativesTitle}</h2>
            <p className="m-0 max-w-measure text-body text-ink-muted">{copy.compare.noAlternativesBody(place)}</p>
            <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
              {copy.compare.shortfallAction}
            </Link>
          </Panel>
        )
      ) : null}

      {weatherLoading ? (
        <Panel as="section" tone="plain" role="status" className="flex flex-col items-start gap-2 p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <InfoGlyph className="mt-0.5 shrink-0 text-ink-muted" />
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="m-0 text-label text-ink">{copy.compare.weatherLoadingTitle}</h2>
              <p className="m-0 max-w-measure text-body-sm text-ink">{copy.compare.weatherLoadingBody}</p>
            </div>
          </div>
        </Panel>
      ) : null}

      {weatherMissing ? (
        <Panel as="section" tone="plain" role="status" className="flex flex-col items-start gap-2 p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <InfoGlyph className="mt-0.5 shrink-0 text-drought" />
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="m-0 text-label text-ink">{copy.compare.weatherMissingTitle}</h2>
              <p className="m-0 max-w-measure text-body-sm text-ink">{copy.compare.weatherMissingBody}</p>
            </div>
          </div>
          <button type="button" onClick={analysis.retry} className={buttonClass("secondary")}>
            {copy.home.retry}
          </button>
        </Panel>
      ) : null}

      {displayOptions.length > 0 ? (
        <section aria-labelledby="options-title" className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="options-title" className="m-0 text-headline text-ink">
                {hasAlternatives ? copy.compare.optionsTitle : copy.compare.optionsTitleYours}
              </h2>
              <p className="m-0 max-w-measure text-body-sm text-ink-muted">
                {!hasAlternatives
                  ? copy.compare.optionsDescriptionYours
                  : hasOwnRotation
                    ? copy.compare.optionsDescription
                    : copy.compare.optionsDescriptionSolo}
              </p>
            </div>
            <Segmented
              legend={copy.compare.showLabel}
              value={depth}
              onChange={setDepth}
              options={[
                { value: "answer", label: copy.compare.depthAnswer },
                { value: "reasons", label: copy.compare.depthReasons },
                { value: "evidence", label: copy.compare.depthEvidence },
              ]}
            />
          </div>
          <div className="grid items-start gap-x-4 gap-y-6 pt-3 lg:grid-cols-2 lg:[&>article:nth-child(2)]:border-0 lg:[&>article:nth-child(2)]:pt-0">
            {displayOptions.map((o) => (
              <OptionRow
                key={o.id}
                option={o}
                now={now}
                limits={limitsById.get(o.id) ?? []}
                strip={stripOf(o)}
                depth={depth}
                best={o.id === bestId}
                isYours={o.id === comparison.current.id && hasOwnRotation}
                place={rankedById.get(o.id)?.place}
                field={field}
              />
            ))}
          </div>
        </section>
      ) : null}

      {hasAlternatives ? (
        <details className="rounded-lg border border-line bg-surface-raised">
          <summary className="min-h-tap cursor-pointer p-4 text-headline text-ink">{copy.compare.measures}</summary>
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
                      <span className="block text-headline text-ink">{o.label}</span>
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

      {depth === "evidence" && displayOptions.length > 0 ? (
        <section aria-labelledby="evidence-all" className="flex flex-col gap-6">
          <h2 id="evidence-all" className="m-0 text-headline text-ink">
            {copy.compare.evidenceAllTitle}
          </h2>
          {displayOptions.map((o, i) => (
            <div key={o.id} className="flex flex-col gap-3">
              <h3 className="m-0 text-headline text-ink">{o.label}</h3>
              <OptionDetail option={o} rainyMonths={rainyMonths} fieldId={field.id} region={field.region} showCalls={i === 0} />
            </div>
          ))}
        </section>
      ) : null}

      {comparison.region !== "unsupported" && (hasOwnRotation || comparison.mcda.status === "ranked") ? (
        <Panel as="section" aria-labelledby="ranking" className="flex flex-col gap-3 p-4 sm:p-6">
          <PanelHeader id="ranking" title={copy.compare.rankingTitle} />
          {comparison.mcda.status === "no-priorities" ? (
            <div className="flex flex-col items-start gap-2">
              <p className="m-0 max-w-measure text-body text-ink">{copy.compare.rankingNone}</p>
              <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.compare.rankingNoneBody}</p>
              <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
                {copy.compare.needProfile}
              </Link>
            </div>
          ) : null}
          {comparison.mcda.status === "ranked" ? (
            <>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {comparison.mcda.ranking.map((r, i) => {
                  const o = displayOptions.find((x) => x.id === r.rotationId);
                  return (
                    <li key={r.rotationId} className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-3">
                      <span className="tabular grid min-h-7 min-w-10 place-items-center rounded-pill border border-line-strong px-2 font-mono text-source">
                        {copy.compare.rankPlace(i + 1)}
                      </span>
                      <span className="min-w-0 flex-1 text-label text-ink">{o?.label}</span>
                      {i === 0 ? <StatusTag tag="best-match" /> : null}
                      {o && o.badges.length > 0 ? <span className="w-full text-body-sm text-ink-muted">{o.badges.join(" · ")}</span> : null}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
          {comparison.mcda.status === "unresolved" ? <p className="m-0 max-w-measure text-body text-ink">{comparison.mcda.note}</p> : null}
          <Disclosure title={copy.compare.howRanked}>
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
                    {displayOptions.find((o) => o.id === x.rotationId)?.label}: {x.warning}
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
        </Panel>
      ) : null}

      {displayOptions.length > 0 ? (
        <Disclosure title={copy.compare.whatIfTitle}>
          {!isNeutral(scenario) || whatIfIrrigation !== null ? (
            <button
              type="button"
              onClick={() => {
                setScenario(NO_SCENARIO);
                setWhatIfIrrigation(null);
              }}
              className="min-h-tap cursor-pointer self-start border-0 bg-transparent p-0 text-label text-field underline hover:text-ink"
            >
              Reset test
            </button>
          ) : null}
          {!isNeutral(scenario) ? <StatusTag tag="hypothetical" className="self-start" /> : null}
          <div className="flex flex-col gap-2">
            <span className="text-label text-ink">{copy.compare.waterSupplyLabel}</span>
            <div className="flex flex-wrap gap-2">
              {(["none", "supplemental", "full"] as const).map((mode) => {
                const isCurrent = (whatIfIrrigation ?? field.irrigation) === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={isCurrent && whatIfIrrigation === mode}
                    onClick={() => setWhatIfIrrigation(mode === field.irrigation ? null : mode)}
                    className={
                      "min-h-tap cursor-pointer rounded-pill px-3 py-1.5 text-label font-medium transition-colors " +
                      (isCurrent ? "bg-field text-on-field" : "border border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink")
                    }
                  >
                    {copy.irrigation[mode]}
                  </button>
                );
              })}
            </div>
            <p className={"m-0 text-body-sm " + (whatIfIrrigation !== null ? "font-medium text-drought" : "text-ink-muted")}>
              {whatIfIrrigation !== null
                ? copy.compare.irrigationTest(copy.irrigation[whatIfIrrigation])
                : copy.compare.irrigationCurrent(copy.irrigation[field.irrigation])}
            </p>
          </div>
          <WhatIfBody scenario={scenario} onChange={setScenario} rows={whatIfRows} />
        </Disclosure>
      ) : null}

      {comparison.region !== "unsupported" &&
      (comparison.dataGaps.length > 0 || comparison.rejected.length > 0 || analysis.retrieving) ? (
        <Disclosure title={copy.compare.couldntCheck} hint={`(${comparison.dataGaps.length + comparison.rejected.length})`}>
          {analysis.retrieving ? <p className="m-0 text-body-sm text-ink-muted">{copy.compare.stillRetrieving}</p> : null}
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
            {comparison.dataGaps.map((g) => (
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

      <JudgmentNote compact />

      <ActionBar>
        <Link href={`/fields/${field.id}/report`} className={buttonClass("primary", "flex-1", "lg")}>
          {copy.compare.reportButton}
          <Icon name="next" />
        </Link>
      </ActionBar>
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
}) {
  const diffs = now && !isYours ? differences(o, now) : [];
  const figures = keyFigures(o, strip);
  const fail = limits.some((c) => c.result === "fail");

  return (
    <article
      aria-labelledby={`option-${o.id}`}
      className={
        "relative flex min-w-0 flex-col gap-4 rounded-lg border bg-surface-raised p-4 sm:p-5 " +
        (best ? "border-2 border-field bg-field-soft/40 pt-6" : "border-line")
      }
    >
      {best ? (
        <span className="absolute -top-3 left-4 inline-flex min-h-6 items-center gap-1 rounded-pill bg-field px-3 text-source font-medium text-on-field">
          <span aria-hidden>✓</span>
          Best match
        </span>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`option-${o.id}`} className="m-0 min-w-0 text-headline text-ink">
            {o.label}
          </h3>
          {isYours ? <StatusTag tag="yours" /> : null}
          {fail ? <StatusTag tag="limit-fail" /> : null}
          {place && !best ? <span className="text-source text-ink-muted">{copy.compare.rankPlace(place)} on your priorities</span> : null}
        </div>
        <p className="m-0 max-w-measure text-body text-ink-muted">{isYours ? copy.compare.yoursNote : o.reason}</p>
        <div className="flex flex-wrap gap-2">
          <RiskChip hazard={FIT_HAZARD[o.fit]}>{copy.compare.fitLabel[o.fit]}</RiskChip>
          {o.badges.map((b) => (
            <RiskChip key={b} hazard="healthy">
              {b}
            </RiskChip>
          ))}
        </div>
        {o.fit === "does-not-fit" && o.noFitReason ? <p className="m-0 max-w-measure text-body-sm text-ink">{o.noFitReason}</p> : null}
      </div>

      {now && !isYours && diffs.length > 0 ? (
        <ul className="m-0 flex max-w-measure list-disc flex-col gap-1 pl-5 text-body text-ink">
          {diffs.slice(0, depth === "answer" ? 2 : diffs.length).map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}

      <dl className="m-0 grid grid-cols-2 gap-2">
        {figures.map((f) => (
          <div key={f.label} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-surface p-3">
            <dt className="text-body-sm text-ink-muted">{f.label}</dt>
            <dd className="tabular m-0 text-label text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>

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
            <LimitSummary checks={limits} />
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
