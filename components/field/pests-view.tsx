"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { buttonClass } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { NavLink } from "@/components/ui/nav-link";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Evidence } from "@/components/ui/provenance";
import { RiskChip, type ChipTone } from "@/components/ui/risk-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { copy } from "@/lib/copy/en";
import { BASELINE } from "@/lib/engine/data";
import { pestOutlook, type CropPestOutlook, type PestOutlook, type WeatherLevel, type WeatherRiskResult } from "@/lib/engine/pest-outlook";
import { formatDay } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";

const CARRYOVER_WORDS = {
  "soil-borne": "Lives in the soil",
  "host-specific-soil": "Lives in the soil, one crop only",
  "vector-borne": "Spread by insects",
  "mobile-insect": "Flying insect",
} as const;

const LEVEL: Record<WeatherLevel, { tone: ChipTone; label: (r: WeatherRiskResult) => string }> = {
  often: { tone: "drought", label: (r) => `Most years · ${r.seasonsFavoured} of ${r.seasonsChecked}` },
  sometimes: { tone: "neutral", label: (r) => `Some years · ${r.seasonsFavoured} of ${r.seasonsChecked}` },
  rarely: { tone: "field", label: (r) => `Rarely · ${r.seasonsFavoured} of ${r.seasonsChecked}` },
  unknown: { tone: "neutral", label: () => "Not enough weather data" },
};

/** Everything a crop is checked for, in the words a farmer would use. Exported for tests. */
export function PestsContent({ outlook, fieldId }: { outlook: PestOutlook; fieldId: string }) {
  return (
    <>
      <WatchPanel outlook={outlook} />
      {outlook.returnIntervals.length ? (
        <Panel as="section" aria-labelledby="pests-return" className="flex flex-col gap-3 p-4 sm:p-5">
          <PanelHeader id="pests-return" title="Comes back too soon" description="Some wilts live in the soil for years and attack only one crop." />
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {outlook.returnIntervals.map((w) => (
              <li key={`${w.organismId}:${w.cropId}`} className="flex flex-col gap-1.5">
                <RiskChip hazard="drought">{`${w.cropName} every ${w.returnYears === 1 ? "year" : `${w.returnYears} years`}`}</RiskChip>
                <p className="m-0 text-body-sm text-ink">{w.text}</p>
                <Evidence scope={w.scope} refText={w.ref} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {outlook.crops.map((c) => (
        <CropPanel key={c.slotId} crop={c} weatherYears={outlook.weatherYears} />
      ))}
      <Panel as="section" tone="plain" aria-labelledby="pests-limits" className="flex flex-col gap-2 p-4 sm:p-5">
        <h2 id="pests-limits" className="m-0 text-label font-semibold text-ink">
          What this page can and can&apos;t tell you
        </h2>
        <ul className="m-0 flex flex-col gap-1 pl-5 text-body-sm text-ink-muted">
          <li>It shows when the weather suited a disease, not whether the disease came. Seed, variety, field history and crop care decide that.</li>
          <li>Weather comes from NASA POWER daily averages for an area about 50 km across, not the humidity inside your crop.</li>
          <li>The lists of which crops host which pests are drawn from general research and still need checking against Myanmar plant-protection advice.</li>
        </ul>
        <div className="flex flex-wrap gap-x-5">
          <NavLink href={`/fields/${fieldId}/rotation`} icon="rotation">
            Edit crops
          </NavLink>
          <NavLink href={`/fields/${fieldId}/compare`} icon="compare">
            Compare plans
          </NavLink>
        </div>
      </Panel>
    </>
  );
}

function WatchPanel({ outlook }: { outlook: PestOutlook }) {
  const top = outlook.watch.slice(0, 4);
  return (
    <Panel as="section" aria-labelledby="pests-watch" className="flex flex-col gap-3 p-4 sm:p-5">
      <PanelHeader
        id="pests-watch"
        title={top.length ? `Watch for ${top.length === 1 ? "this" : `these ${top.length}`}` : "Nothing stands out"}
        description={
          top.length
            ? "The pests and diseases most worth checking for in this plan."
            : outlook.weatherYears
              ? "No soil disease carries between your crops, and past weather rarely suited the diseases we check. Keep scouting as usual."
              : "No soil disease carries between your crops. Weather couldn't be checked yet, so keep scouting as usual."
        }
      />
      {top.length ? (
        <ol className="m-0 flex list-none flex-col divide-y divide-line p-0">
          {top.map((w) => (
            <li key={w.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <Icon name={w.kind === "weather" ? "conditions" : w.kind === "return" ? "calendar" : "soil"} size={18} className="mt-0.5 shrink-0 text-drought" />
              <div className="flex min-w-0 flex-col">
                <span className="text-body font-semibold text-ink">
                  {w.title} <span className="font-normal text-ink-muted">· {w.cropName}</span>
                </span>
                <span className="text-body-sm text-ink-muted">{w.reason}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  );
}

function CropPanel({ crop, weatherYears }: { crop: CropPestOutlook; weatherYears: PestOutlook["weatherYears"] }) {
  const id = `pests-${crop.slotId}`;
  const shown = new Set(crop.carriedIn?.shared.map((s) => s.organismId));
  const others = crop.hosts.filter((h) => !shown.has(h.id));
  return (
    <Panel as="section" aria-labelledby={id} className="flex flex-col gap-4 p-4 sm:p-5">
      <PanelHeader id={id} title={crop.cropName} description={`${formatDay(crop.plantDate)} to ${formatDay(crop.harvestDate)}`} />

      <div className="flex flex-col gap-2">
        <h3 className="m-0 flex items-center gap-1.5 text-label font-semibold text-ink">
          <Icon name="conditions" size={16} className="text-ink-muted" />
          Weather that suits disease
        </h3>
        {!weatherYears ? (
          <p className="m-0 text-body-sm text-ink-muted">Weather for this field isn&apos;t available yet, so this part can&apos;t be checked.</p>
        ) : crop.weather.length === 0 ? (
          <p className="m-0 text-body-sm text-ink-muted">We don&apos;t have a weather rule for {crop.cropName.toLowerCase()} diseases yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {crop.weather.map((w) => (
              <li key={w.ruleId} className="flex flex-col gap-1.5 rounded-md bg-surface-sunken p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-body font-semibold text-ink">
                    {w.name} <i className="font-normal text-ink-muted">{w.scientific}</i>
                  </span>
                  <RiskChip hazard={LEVEL[w.level].tone}>{LEVEL[w.level].label(w)}</RiskChip>
                </div>
                <p className="m-0 text-body-sm text-ink">
                  {w.level === "unknown"
                    ? `Too few seasons of weather to count (${w.seasonsChecked}).`
                    : `Seasons in ${weatherYears.start}–${weatherYears.end} with ${w.weather}${w.peakMonths.length ? `, mostly in ${w.peakMonths.join(", ")}` : ""}.`}
                </p>
                <p className="m-0 text-body-sm text-ink-muted">{w.advice}</p>
                {w.caveats.map((c) => (
                  <p key={c} className="m-0 flex items-start gap-1.5 text-source text-ink-muted">
                    <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                    {c}
                  </p>
                ))}
                <Evidence scope={w.scope} refText={w.ref} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {crop.carriedIn ? (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 flex items-center gap-1.5 text-label font-semibold text-ink">
            <Icon name="soil" size={16} className="text-ink-muted" />
            Can carry over from {crop.carriedIn.fromName}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {crop.carriedIn.shared.map((h) => (
              <li key={h.organismId} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-ink">
                    {h.name} <i className="font-normal text-ink-muted">{h.scientific}</i>
                  </span>
                  <RiskChip hazard={h.severity === "caution" ? "drought" : "neutral"}>{CARRYOVER_WORDS[h.carryover]}</RiskChip>
                </div>
                <p className="m-0 text-body-sm text-ink-muted">{h.advice}</p>
                <Evidence scope={h.scope} refText={h.ref} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {others.length ? (
        <Disclosure title={`Other pests ${crop.cropName.toLowerCase()} can host`} hint={`${others.length}`}>
          <ul className="m-0 flex list-none flex-col gap-3 p-0 pt-2">
            {others.map((h) => (
              <li key={h.id} className="flex flex-col gap-1">
                <span className="text-body-sm font-semibold text-ink">
                  {h.name} <i className="font-normal text-ink-muted">{h.scientific}</i>
                  <span className="font-normal text-ink-muted"> · {CARRYOVER_WORDS[h.carryover]}</span>
                </span>
                <p className="m-0 text-body-sm text-ink-muted">{h.advice}</p>
                <Evidence scope={h.scope} refText={h.ref} />
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </Panel>
  );
}

export function PestsView({ fieldId }: { fieldId: string }) {
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
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36" />
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

  return (
    <>
      <FieldPageHeader title="Pests and diseases" summary="What your crops can catch here, and when to look. Based on past weather and your crop order, not a field survey." />
      {!outlook || outlook.crops.length === 0 ? (
        <EmptyState title="Add your crops first" body="Pests and diseases depend on which crops you grow and when.">
          <Link href={`/fields/${fieldId}/rotation`} className={buttonClass("primary")}>
            Add crops
          </Link>
        </EmptyState>
      ) : (
        <>
          {phase === "loading" && !engineData ? (
            <Panel as="p" tone="plain" role="status" className="m-0 px-4 py-3 text-body-sm text-ink-muted">
              Getting past weather for this field. Crop order checks are shown now.
            </Panel>
          ) : null}
          <PestsContent outlook={outlook} fieldId={fieldId} />
        </>
      )}
      <JudgmentNote />
    </>
  );
}
