"use client";

import Link from "next/link";
import { useEffect, useMemo, type ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { NavLink } from "@/components/ui/nav-link";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Evidence } from "@/components/ui/provenance";
import { RiskChip, type ChipTone } from "@/components/ui/risk-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/field/conditions/bands";
import { AnalysisLoading } from "@/components/field/analysis-loading";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { NextSteps } from "@/components/field/next-steps";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { BASELINE } from "@/lib/engine/data";
import type { HostOrganism } from "@/lib/data/crops/host-organisms";
import { getCropById } from "@/lib/data/crops";
import { buildPestSummary, pestOutlook, plainPestName, type PestAction, type PestCropRef, type PestOutlook, type PestSummary, type SoilGroup, type WeatherLevel, type WeatherRiskResult } from "@/lib/engine/pest-outlook";
import { formatDay } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import { useAppCopy, useLocaleStore } from "@/lib/store/locale-store";
import type { AnalysisPhase } from "@/lib/analysis/use-analysis";

const LEVEL_TONE: Record<WeatherLevel, ChipTone> = { often: "drought", sometimes: "neutral", rarely: "field", unknown: "neutral" };

type AppCopy = ReturnType<typeof useAppCopy>;

function levelLabel(text: AppCopy, w: WeatherRiskResult): string {
  const l = text.pests.level;
  return w.level === "unknown" ? l.unknown : l[w.level](w.seasonsFavoured, w.seasonsChecked);
}

const MYANMAR_SCRIPT = /[\u1000-\u109F]/;
const PROPER_NAME = /^(Cercospora|Fusarium|Rhizoctonia|Meloidogyne)/;

/** Crop name in the farmer's language: the Burmese name when there is one, otherwise the English name. */
function useCropLabel() {
  const locale = useLocaleStore((s) => s.locale);
  return (c: PestCropRef, lower = false): string => {
    if (locale === "my") {
      const local = getCropById(c.cropId)?.names.local.find((n) => MYANMAR_SCRIPT.test(n));
      if (local) return local;
    }
    return lower ? c.cropName.toLowerCase() : c.cropName;
  };
}

/** A pest or disease name inside a sentence: lower case, except names that start with a Latin genus. */
const inSentence = (name: string) => (PROPER_NAME.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

/** The long text behind one finding, closed until a farmer wants it. */
function Why({ children, id }: { children: ReactNode; id: string }) {
  const text = useAppCopy().pests;
  return (
    <details className="group text-body-sm" data-testid={`why-${id}`}>
      <summary className="inline-flex min-h-tap cursor-pointer list-none items-center gap-1 text-field marker:hidden [&::-webkit-details-marker]:hidden">
        <Icon name="info" size={16} />
        <span className="underline underline-offset-2">{text.why}</span>
      </summary>
      <div className="mt-1 flex flex-col gap-2 border-l-2 border-line pl-3 text-ink-muted">{children}</div>
    </details>
  );
}

function Headline({ summary }: { summary: PestSummary }) {
  const text = useAppCopy().pests;
  const label = useCropLabel();
  const h = summary.headline!;
  const names = text.joinNames(h.crops.map((c) => label(c, true)));
  const title = h.kind === "weather" ? text.mainThing(inSentence(h.name), label(h.crops[0], true)) : h.kind === "soil" ? text.mainThingSoil(inSentence(h.name)) : text.mainThing(inSentence(h.name), label(h.crops[0], true));
  const parts: string[] = [];
  if (h.weather) parts.push(text.detailWeather(h.weather.seasonsFavoured, h.weather.seasonsChecked));
  if (h.soil) parts.push(text.detailSoil(names));
  if (h.kind === "return" && h.returnYears !== null && h.minReturnYears !== null) parts.push(text.detailReturn(label(h.crops[0]), h.returnYears, h.minReturnYears));
  return (
    <Panel as="section" aria-labelledby="pests-main" className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-col items-start gap-2">
        <StatusChip icon={h.kind === "weather" ? "rain" : h.kind === "soil" ? "soil" : "calendar"} tone="watch">
          {h.kind === "weather" ? "Weather risk" : h.kind === "soil" ? "Soil carryover" : "Crop gap"}
        </StatusChip>
        <h2 id="pests-main" className="m-0 text-title text-ink">
          {title}
        </h2>
        {parts.length ? <p className="m-0 text-body text-ink-muted">{parts.join(" ")}</p> : null}
      </div>
      {summary.actions.length ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-body-sm font-semibold text-ink">{text.whatToDo}</h3>
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label={text.whatToDo}>
            {summary.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-body text-ink">
                <Icon name={a.kind === "when" || a.kind === "gap" ? "calendar" : a.kind === "look" ? "search" : "done"} size={18} className="mt-0.5 shrink-0 text-field" />
                <span>{actionText(a, text, label)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Panel>
  );
}

function actionText(a: PestAction, text: AppCopy["pests"], label: (c: PestCropRef, lower?: boolean) => string): string {
  switch (a.kind) {
    case "look":
      return `${text.lookLabel}${a.text}`;
    case "help":
      return `${text.helpLabel}${a.text}`;
    case "gap":
      return text.gapLine(a.days, label(a.fromCrop, true), label(a.toCrop, true));
    case "when":
      return a.months.length ? text.whenMonths(label(a.crop, true), a.months.join(", "), formatDay(a.plantDate)) : text.whenSeason(label(a.crop, true), formatDay(a.plantDate), formatDay(a.harvestDate));
  }
}

/** Organisms that carry between crops, each once with the crops it touches. */
function SoilPanel({ groups }: { groups: SoilGroup[] }) {
  const text = useAppCopy().pests;
  const label = useCropLabel();
  if (!groups.length) return null;
  return (
    <Panel as="section" aria-labelledby="pests-soil" className="flex flex-col gap-3 p-4 sm:p-5">
      <PanelHeader id="pests-soil" title={text.soilTitle} />
      <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
        {groups.map((g) => (
          <li key={g.organismId} className="flex flex-col py-2.5 first:pt-0 last:pb-0">
            <span className="flex flex-wrap items-center gap-x-2 text-body font-semibold text-ink">
              <Icon name="soil" size={16} className="shrink-0 text-ink-muted" />
              {plainPestName(g.name)}
            </span>
            <span className="text-body-sm text-ink-muted">{text.carryLine[g.carryover](text.joinNames(g.crops.map((c) => label(c, true))))}</span>
            <Why id={g.organismId}>
              <p className="m-0">
                <span className="text-ink">{text.whyScientific}</span>
                <i>{g.scientific}</i>
              </p>
              <p className="m-0">{g.advice}</p>
              <Evidence scope={g.scope} refText={g.ref} />
            </Why>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function WeatherRow({ w }: { w: WeatherRiskResult }) {
  const appCopy = useAppCopy();
  const text = appCopy.pests;
  return (
    <li className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-body font-semibold text-ink">{plainPestName(w.name)}</span>
        <RiskChip hazard={LEVEL_TONE[w.level]}>{levelLabel(appCopy, w)}</RiskChip>
      </div>
      {w.peakMonths.length && w.level !== "rarely" && w.level !== "unknown" ? <span className="text-body-sm text-ink-muted">{text.mostlyIn(w.peakMonths.join(", "))}</span> : null}
      <Why id={w.ruleId}>
        <p className="m-0">
          <span className="text-ink">{text.whyScientific}</span>
          <i>{w.scientific}</i>
        </p>
        <p className="m-0">
          <span className="text-ink">{text.whyWeather}</span>
          {w.weather}.
        </p>
        <p className="m-0">{w.advice}</p>
        <Evidence scope={w.scope} refText={w.ref} />
      </Why>
    </li>
  );
}

function WeatherPanel({ outlook }: { outlook: PestOutlook }) {
  const text = useAppCopy().pests;
  const label = useCropLabel();
  return (
    <Panel as="section" aria-labelledby="pests-weather" className="flex flex-col gap-3 p-4 sm:p-5">
      <PanelHeader id="pests-weather" title={text.weatherByCrop} description={text.weatherByCropDesc} />
      {outlook.crops.map((c) => (
        <div key={c.slotId} className="flex flex-col gap-2">
          <h3 className="m-0 text-body-sm font-semibold text-ink">
            {label(c)} <span className="font-normal text-ink-muted">· {formatDay(c.plantDate)} to {formatDay(c.harvestDate)}</span>
          </h3>
          {c.weather.length === 0 ? (
            <p className="m-0 text-body-sm text-ink-muted">{text.noRuleShort(label(c, true))}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {c.weather.map((w) => (
                <WeatherRow key={w.ruleId} w={w} />
              ))}
            </ul>
          )}
        </div>
      ))}
    </Panel>
  );
}

/** What waits behind a tap: every other pest the crops can host, each once, with the crops. */
function OtherPests({ outlook, summary }: { outlook: PestOutlook; summary: PestSummary }) {
  const text = useAppCopy().pests;
  const label = useCropLabel();
  const shown = new Set(summary.soil.map((g) => g.organismId));
  const rows = new Map<string, { host: HostOrganism; crops: PestCropRef[] }>();
  for (const c of outlook.crops) {
    for (const h of c.hosts) {
      if (shown.has(h.id)) continue;
      const row = rows.get(h.id) ?? { host: h, crops: [] };
      row.crops.push({ cropId: c.cropId, cropName: c.cropName });
      rows.set(h.id, row);
    }
  }
  if (!rows.size) return null;
  return (
    <Disclosure title={text.otherAllTitle} hint={`${rows.size}`}>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 pt-2">
        {[...rows.values()].map(({ host, crops }) => (
          <li key={host.id} className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-ink">
              {plainPestName(host.name)} <span className="font-normal text-ink-muted">· {text.joinNames(crops.map((c) => label(c, true)))}</span>
            </span>
            <span className="text-body-sm text-ink-muted">{text.carryover[host.carryover]}</span>
            <Why id={`other-${host.id}`}>
              <p className="m-0">
                <span className="text-ink">{text.whyScientific}</span>
                <i>{host.scientific}</i>
              </p>
              <p className="m-0">{host.advice}</p>
              <Evidence scope={host.scope} refText={host.ref} />
            </Why>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

/**
 * The page body: one main message with what to do, then what carries between crops, the weather risk crop by
 * crop, and the detail behind a tap. Exported for tests. `phase` says whether the weather is still loading
 * ("loading"), or could not be fetched ("failed"); it only matters when the outlook has no weather.
 */
export function PestsContent({ outlook, fieldId, phase, onRetry }: { outlook: PestOutlook; fieldId: string; phase?: AnalysisPhase; onRetry?: () => void }) {
  const text = useAppCopy().pests;
  const label = useCropLabel();
  const summary = useMemo(() => buildPestSummary(outlook), [outlook]);
  const noWeather = !outlook.weatherYears;
  const loading = noWeather && phase === "loading";
  return (
    <>
      {loading ? (
        <AnalysisLoading title={text.loadingTitle} crops={outlook.crops.map((c) => label(c))} />
      ) : summary.headline ? (
        <Headline summary={summary} />
      ) : (
        <Panel as="section" aria-labelledby="pests-main" className="flex flex-col items-start gap-2 p-4 sm:p-5">
          <StatusChip icon="success" tone="good">All clear</StatusChip>
          <h2 id="pests-main" className="m-0 text-title text-ink">
            {text.nothingStands}
          </h2>
          <p className="m-0 text-body text-ink-muted">{noWeather ? text.quietNoWeather : text.quietWithWeather}</p>
        </Panel>
      )}
      {noWeather && !loading ? (
        <Panel as="section" tone="plain" role="status" className="flex flex-col items-start gap-2 p-4">
          <p className="m-0 text-body-sm text-ink-muted">{text.weatherFailed}</p>
          {onRetry ? (
            <Button onClick={onRetry} icon="reset">
              {text.tryAgain}
            </Button>
          ) : null}
        </Panel>
      ) : null}
      <SoilPanel groups={summary.soil} />
      {outlook.returnIntervals.length && summary.headline?.kind !== "return" ? (
        <Panel as="section" aria-labelledby="pests-return" className="flex flex-col gap-3 p-4 sm:p-5">
          <PanelHeader id="pests-return" title={text.returnTitle} description={text.returnDesc} />
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {outlook.returnIntervals.map((w) => (
              <li key={`${w.organismId}:${w.cropId}`} className="flex flex-col gap-1.5">
                <RiskChip hazard="drought">{text.returnEvery(w.cropName, w.returnYears)}</RiskChip>
                <Why id={`return-${w.organismId}`}>
                  <p className="m-0">{w.text}</p>
                  <Evidence scope={w.scope} refText={w.ref} />
                </Why>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {!noWeather ? <WeatherPanel outlook={outlook} /> : null}
      {summary.caveats.length ? (
        <div className="flex flex-col gap-1" aria-label={text.weatherNoteTitle}>
          {summary.caveats.map((c) => (
            <p key={c} className="m-0 flex items-start gap-1.5 text-body-sm text-ink-muted">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              {c}
            </p>
          ))}
        </div>
      ) : null}
      <OtherPests outlook={outlook} summary={summary} />
      <Disclosure title={text.limitsOpen}>
        <div className="flex flex-col gap-2 pt-2">
          <ul className="m-0 flex flex-col gap-1 pl-5 text-body-sm text-ink-muted">
            {text.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-x-5">
            <NavLink href={`/fields/${fieldId}/rotation`} icon="rotation">
              {text.editCrops}
            </NavLink>
            <NavLink href={`/fields/${fieldId}/compare`} icon="compare">
              {text.comparePlans}
            </NavLink>
          </div>
        </div>
      </Disclosure>
    </>
  );
}

export function PestsView({ fieldId }: { fieldId: string }) {
  const appCopy = useAppCopy();
  const text = appCopy.pests;
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);
  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  const analysis = useFieldAnalysis(field);
  const { engineData, phase } = analysis;
  const rotation = rotations[0];

  const outlook = useMemo(
    () =>
      rotation?.slots.length
        ? pestOutlook({
            rotation,
            records: engineData?.records ?? [],
            years: { start: BASELINE.startYear, end: BASELINE.endYear },
            region: engineData?.region ?? field?.region ?? null,
          })
        : null,
    [rotation, engineData, field?.region],
  );

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={appCopy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36" />
      </div>
    );
  }

  if (!field) {
    return (
      <EmptyState title={text.notFoundTitle} body={text.notFoundBody}>
        <Link href="/" className={buttonClass("primary")}>
          {text.backToFields}
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <FieldPageHeader title={text.title} summary={text.summary} />
      {!outlook || outlook.crops.length === 0 ? (
        <EmptyState title={text.addCropsTitle} body={text.addCropsBody}>
          <Link href={`/fields/${fieldId}/rotation`} className={buttonClass("primary")}>
            {text.addCrops}
          </Link>
        </EmptyState>
      ) : (
        <PestsContent outlook={outlook} fieldId={fieldId} phase={phase} onRetry={analysis.retry} />
      )}
      <JudgmentNote />
      <NextSteps fieldId={field.id} current="pests" />
    </>
  );
}
