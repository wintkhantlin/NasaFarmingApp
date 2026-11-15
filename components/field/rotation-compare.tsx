"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { FIT_HAZARD, OptionDetail } from "@/components/field/option-detail";
import { StatusTag } from "@/components/ui/status";
import { LimitSummary } from "@/components/field/limit-checks";
import { CheckLocally } from "@/components/field/check-locally";
import { WhatIf, WhatIfBanner } from "@/components/field/what-if";
import { applyScenario, NO_SCENARIO, isNeutral, type Scenario } from "@/lib/engine/scenario";
import { whatIfResult } from "@/lib/engine/what-if";
import { checkLimits, type LimitCheck } from "@/lib/engine/limits";
import { buttonClass } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { Message } from "@/components/ui/message";
import { Panel } from "@/components/ui/panel";
import { RiskChip } from "@/components/ui/risk-chip";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { copy } from "@/lib/copy/en";
import { getCropById } from "@/lib/data/crops";
import { monthlyNormals } from "@/lib/engine/climate";
import { compareRotations, type EvaluatedOption } from "@/lib/engine/compare";
import { BASELINE } from "@/lib/engine/data";
import { ComparisonResults } from "@/components/field/results/comparison-results";
import { AnalysisLoading } from "@/components/field/analysis-loading";
import { NextSteps } from "@/components/field/next-steps";
import { useCompareViewedStore } from "@/lib/store/compare-viewed";
import { useAppCopy, useLocaleStore } from "@/lib/store/locale-store";
import { OfflineBanner, ResultBlocker, resolveBlocker, useOnline } from "@/components/field/result-blocker";
import { buildResultsModel } from "@/lib/plan/results-model";
import { adaptComparison } from "@/lib/plan/engine-display";
import { CRITERIA } from "@/lib/engine/mcda";
import { slotName } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import type { Rotation } from "@/lib/types";

const unknown = "Not known";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? unknown : n.toFixed(d));
const mmk = (n: number) => Math.round(n).toLocaleString();
const FARMER_DATE = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const farmerDate = (date: string) =>
  FARMER_DATE.format(new Date(`${date}T00:00:00Z`));

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
  if (region === "yangon") return copy.compare.blocker.regionName.yangon;
  if (region === "myanmar") return copy.compare.blocker.regionName.myanmar;
  return copy.compare.blocker.regionName.unsupported;
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

export function RotationCompare({ fieldId }: { fieldId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const [scenario, setScenario] = useState<Scenario>(NO_SCENARIO);
  const text = useAppCopy();
  const locale = useLocaleStore((s) => s.locale);
  const online = useOnline();
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
    // While What-if sliders move, the previous result stays on screen (the sliders show their own pending state).
    comparison, inputRevision: revision, resultRevision: comparison ? revision : null, locale,
  });
  const blocker = resolveBlocker(display, comparison, field, { copy: text, online, retry: analysis.retry });
  const offlineBanner = !online ? <OfflineBanner text={text.compare.blocker.offlineBanner} /> : null;
  // Tick the Compare step only once a result has really been shown (not while stale or unavailable).
  const markCompareViewed = useCompareViewedStore((s) => s.markViewed);
  const comparisonShown = Boolean(comparison) && display.state !== "stale" && display.state !== "data-unavailable";
  useEffect(() => {
    if (comparisonShown && fieldId) markCompareViewed(fieldId);
  }, [comparisonShown, fieldId, markCompareViewed]);
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

  const cropNames = (savedRotation?.slots ?? []).filter((slot) => slot.kind === "crop").map((slot) => slotName(slot).replace(/\s*\(.*\)\s*$/, ""));

  if (status === "idle" || status === "loading") {
    return (
      <div aria-label={copy.home.loading} className="flex flex-col gap-4">
        <AnalysisLoading title="Getting your crop comparison ready" crops={cropNames} />
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

  if (!comparison && analysis.phase === "loading") {
    return (
      <div className="flex flex-col gap-4">
        {offlineBanner}
        <AnalysisLoading title="Checking your crops against 10 years of weather" crops={cropNames} />
      </div>
    );
  }

  if (!comparison || display.state === "stale" || display.state === "data-unavailable") {
    const earlyBlocker = blocker ?? resolveBlocker({ ...display, state: "error" }, comparison, field, { copy: text, online, retry: analysis.retry });
    const needsCurrentCrops = display.state === "field-incomplete" && field.locationConfirmed;
    return (
      <div className="flex flex-col gap-4">
        {offlineBanner}
        {earlyBlocker ? <ResultBlocker blocker={earlyBlocker} heading="h1" reasonsTitle={text.compare.blocker.limitsReasonsTitle} /> : null}
        {earlyBlocker?.kind === "refreshing" && display.gaps.length > 0 ? (
          <ul className="m-0 list-disc space-y-2 pl-5 text-body-sm text-ink-muted">
            {display.gaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        ) : null}
        {savedPlan && needsCurrentCrops ? <p className="m-0 text-body-sm text-ink-muted">{text.compare.blocker.planSavedNote}</p> : null}
      </div>
    );
  }

  const alternatives = display.options.filter((o) => o.kind === "alternative").map((o) => o.engine);
  const rankOrder = new Map(comparison.mcda.ranking.map((r, i) => [r.rotationId, i]));
  const orderedAlternatives = [...alternatives].sort(
    (a, b) => (rankOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rankOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const displayOptions: EvaluatedOption[] = [comparison.current, ...orderedAlternatives];
  const bestId =
    display.state === "comparable" && !display.tiedFirst
      ? comparison.mcda.ranking[0]?.rotationId
      : undefined;
  const bestOption = displayOptions.find((option) => option.id === bestId);
  const nextCrop = bestOption?.rotation.slots.filter((slot) => slot.kind === "crop").at(-1);
  const suggestedSowDate =
    nextCrop?.dateConfidence === "typical" && nextCrop.plantDate >= new Date().toISOString().slice(0, 10)
      ? farmerDate(nextCrop.plantDate)
      : null;
  const place = placeName(comparison.region);
  const weatherLoading = analysis.phase === "loading";
  const weatherMissing = !weatherLoading && engineData?.power.status !== "ok";
  const hasAlternatives = alternatives.length > 0;

  const limitsById = new Map<string, LimitCheck[]>(
    displayOptions.map((o) => [o.id, checkLimits(o.rotation, field.constraints, field.irrigation, (id) => getCropById(id)?.names.common ?? id)]),
  );

  const pastSeasons = comparison.baseline.completeYears;
  const summary =
    comparison.region === "unsupported"
      ? copy.compare.summaryUnsupported
      : hasOwnRotation
        ? copy.compare.summaryWith(place, alternatives.length, pastSeasons)
        : copy.compare.summaryWithout(place, pastSeasons);

  const answerHeadline = bestOption
    ? bestOption.id === comparison.current.id
      ? "Your current crops best match the priorities you chose."
      : "This option ranks highest among the choices we checked."
    : display.headline;
  const answerReason = bestOption
    ? `${bestOption.rotation.slots.map((slot) => slotName(slot)).join(" → ")} ranks highest for your selected priorities.${suggestedSowDate ? ` Suggested sow date for the last crop: ${suggestedSowDate}.` : ""} Verify local planting dates, water availability, and field conditions before planting.`
    : display.detail;


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
            if (balance > 0) return <RiskChip hazard="healthy">Puts back about {balance} kg N/ha more than it takes</RiskChip>;
            if (balance === 0) return <RiskChip hazard="neutral">Puts back about as much as it takes</RiskChip>;
            return (
              <RiskChip hazard="drought" icon={<Icon name="alert" size={14} className="shrink-0" />}>
                Takes about {Math.abs(balance)} kg N/ha more than it puts back
              </RiskChip>
            );
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
        row(copy.compare.measureDry, (o) => (o.dryYear.evaluated === 0 ? unknown : `Passed ${o.dryYear.passes} of ${o.dryYear.evaluated} severe dry ${o.dryYear.evaluated === 1 ? "year" : "years"} (of ${pastSeasons} ${pastSeasons === 1 ? "year" : "years"} checked)`)),
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
  const resultsModel = buildResultsModel({ field, comparison, display, options: displayOptions });
  const visibleOptions = displayOptions.filter((o) => hasOwnRotation || o.id !== comparison.current.id || !hasAlternatives);

  return (
    <>
      {offlineBanner}
      <FieldPageHeader title={copy.compare.title} summary={hasAlternatives && !blocker ? undefined : summary} />

      <WhatIfBanner scenario={testScenario} recorded={field.irrigation} onReset={() => setScenario(NO_SCENARIO)} />

      {/* 1. The short answer. With choices to compare it is the verdict card inside the results below; a dead end shows one blocker card here instead, never two. */}
      {blocker ? (
        <ResultBlocker blocker={blocker} reasonsTitle={text.compare.blocker.limitsReasonsTitle} />
      ) : !hasAlternatives ? (
      <section aria-label="Comparison summary" className="flex flex-col gap-3 rounded-lg border border-field/30 bg-field-soft/40 p-4 sm:p-5">
        <h2 className="m-0 text-headline text-ink">{answerHeadline}</h2>
        <p className="m-0 max-w-measure text-body text-ink">{answerReason}</p>
        {bestOption && locale === "my" ? (
          <p lang="my" className="m-0 text-body-sm text-ink-muted">
            သင်ရွေးထားသော ဦးစားပေးချက်များအရ ဤအစီအစဉ်သည် စစ်ဆေးထားသော ရွေးချယ်စရာများအနက် အဆင့်အမြင့်ဆုံးဖြစ်သည်။ မစိုက်မီ ရက်၊ ရေနှင့် ဒေသအခြေအနေများကို စစ်ဆေးပါ။
          </p>
        ) : null}
      </section>
      ) : null}

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
          title={text.compare.shortfallTitle}
          action={
            <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
              {text.compare.shortfallAction}
            </Link>
          }
        >
          {text.compare.shortfallBody}
        </Message>
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

      {/* 2. Full results: overview, comparison, water, soil, money, reasons, unknowns */}
      {resultsModel && hasAlternatives ? <ComparisonResults field={field} model={resultsModel} /> : null}
      {!hasAlternatives && visibleOptions.length > 0 ? (
        <section aria-labelledby="options-title" className="flex flex-col gap-2">
          <h2 id="options-title" className="m-0 text-headline text-ink">{copy.compare.optionsTitleYours}</h2>
          <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.compare.optionsDescriptionYours}</p>
          {visibleOptions.map((o) => <CropPills key={o.id} names={o.rotation.slots.map((sl) => slotName(sl))} />)}
        </section>
      ) : null}

      {/* 3. Without choices to compare there is no verdict card, so the way on sits here. */}
      {!hasAlternatives ? (
        <section aria-labelledby="next-step" className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4 sm:p-5 print:hidden">
          <h2 id="next-step" className="m-0 text-headline text-ink">What would you like to do?</h2>
          <Link href={`/fields/${field.id}/report`} className={buttonClass("primary", "w-full sm:w-auto", "lg")}>
            <Icon name="report" />
            See my farmer summary
          </Link>
          <Link href={`/fields/${field.id}/rotation`} className="inline-flex min-h-tap items-center self-start text-label text-field underline hover:text-ink">
            Change my crops
          </Link>
        </section>
      ) : null}

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

        <Link href={`/plan/crop-screen?fieldId=${encodeURIComponent(field.id)}`} className="inline-flex min-h-tap items-center self-start text-label text-field underline hover:text-ink">
          Check next crops against this field&apos;s weather and soil
        </Link>

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
        </Disclosure>
      {hasAlternatives && display.state === "comparable" ? (
        <details className="border-t border-line">
          <summary className="min-h-tap cursor-pointer py-3 text-label text-ink">{copy.compare.measures}</summary>
          {/* Mobile: vertically organized comparison without wide tables */}
          <div className="flex flex-col divide-y divide-line md:hidden">
            {tableRows.map((g) => (
              <div key={g.group} className="flex flex-col gap-3 py-3">
                <h4 className="m-0 text-label font-semibold text-ink">{g.group}</h4>
                <div className="flex flex-col gap-4">
                  {g.items.map((it) => (
                    <div key={it.label} className="flex flex-col gap-2">
                      <span className="text-body-sm font-semibold text-ink">{it.label}</span>
                      <div className="flex flex-col gap-2">
                        {displayOptions.map((o) => (
                          <div key={o.id} className="flex flex-col gap-1 border-t border-line/60 pt-2 first:border-0 first:pt-0">
                            <div className="flex items-center gap-1.5 text-source font-medium text-ink-muted">
                              <span>{optionName(o)}</span>
                              {o.id === comparison.current.id && hasOwnRotation ? <StatusTag tag="yours" /> : null}
                              {o.id === bestId ? <StatusTag tag="best-match" /> : null}
                              {(limitsById.get(o.id) ?? []).some((c) => c.result === "fail") ? <StatusTag tag="limit-fail" /> : null}
                            </div>
                            <div className="text-body-sm text-ink">{it.cell(o)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: side-by-side comparison table */}
          <div className="hidden overflow-x-auto border-t border-line md:block">
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
                <OptionDetail option={o} rainyMonths={rainyMonths} fieldId={field.id} yearsChecked={pastSeasons} region={field.region} showCalls={i === 0} />
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
              <Link href={`/fields/${field.id}/questions/priority`} className={buttonClass("secondary")}>
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

      <NextSteps fieldId={field.id} current="compare" />
    </>
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
