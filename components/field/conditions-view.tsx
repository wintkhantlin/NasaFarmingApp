"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MONTHS, RainWaterChart, TemperatureChart } from "@/components/ui/charts";
import { buttonClass, Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph, DownloadGlyph, InfoGlyph, ThermometerGlyph } from "@/components/ui/icons";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Reading } from "@/components/ui/reading";
import { RiskChip } from "@/components/ui/risk-chip";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceLine } from "@/components/ui/source-line";
import { SourceStatusPanel } from "@/components/field/conditions-panels";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { copy } from "@/lib/copy/en";
import { downloadCsv, generateWeatherCsv } from "@/lib/download";
import { getCropById } from "@/lib/data/crops";
import { shortSlotName } from "@/lib/rotation-format";
import { isStale } from "@/lib/store/data-cache";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";

const argMax = (a: number[]) => a.indexOf(Math.max(...a));
const argMin = (a: number[]) => a.indexOf(Math.min(...a));

/** The three consecutive months (wrapping the year) with the most rain: "Jun to Aug". */
function wettestSeason(rain: number[]): string {
  let best = 0;
  let bestSum = -1;
  for (let i = 0; i < 12; i++) {
    const sum = rain[i] + rain[(i + 1) % 12] + rain[(i + 2) % 12];
    if (sum > bestSum) {
      bestSum = sum;
      best = i;
    }
  }
  return `${MONTHS[best]} to ${MONTHS[(best + 2) % 12]}`;
}

const listMonths = (idx: number[]) => idx.map((i) => MONTHS[i]).join(", ");

function formatFetched(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function ConditionsView({ fieldId }: { fieldId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);

  const [cropChoice, setCropChoice] = useState<string | null>(null);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  // one shared loader for conditions (POWER, IMERG, SoilGrids) and the AppEEARS jobs
  const analysis = useFieldAnalysis(field);
  const { phase, showingCache, engineData } = analysis;
  const data = analysis.conditions;
  const setAttempt = (updater: (n: number) => number) => {
    void updater;
    analysis.retry();
  };

  // The crops of the farmer's rotation. Ranges on this screen are for one of them.
  const rotationCrops = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of rotations[0]?.slots ?? []) {
      if (s.kind !== "fallow" && s.cropId && !seen.has(s.cropId)) seen.set(s.cropId, shortSlotName(s));
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [rotations]);

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36" />
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

  const cropId = cropChoice ?? rotationCrops[0]?.value ?? "maize";
  const crop = getCropById(cropId);
  const cropName = rotationCrops.find((c) => c.value === cropId)?.label ?? crop?.names.common ?? "maize";

  const rain = data?.monthlyRainMm;
  const et0 = data?.monthlyEt0Mm;
  const tmax = data?.monthlyTmaxC;
  const tmin = data?.monthlyTminC;
  const soil = data?.soil ?? null;
  const stale = data ? isStale(data.fetchedAt, 48) : false;

  const dryMonths = rain && et0 ? rain.map((r, i) => (et0[i] > r ? i : -1)).filter((i) => i >= 0) : [];
  const annual = data?.annualRainMm;

  const headline =
    annual !== undefined && rain
      ? `About ${annual} mm of rain a year, mostly ${wettestSeason(rain)}`
      : "Climate data isn't available for this field right now";
  const reason =
    rain && et0
      ? dryMonths.length === 12
        ? "Rain falls short of estimated crop water use in every month on average, so most crops here need irrigation or stored soil water."
        : dryMonths.length > 0
          ? `Rain falls short of estimated crop water use in ${dryMonths.length} ${dryMonths.length === 1 ? "month" : "months"} (${listMonths(dryMonths)}). Plan water for those months, or time planting to avoid them.`
          : "On average, rain keeps up with estimated crop water use in every month."
      : rain
        ? "Soil information is below. Temperature and crop water use could not be read."
        : "Your saved crops and soil below still apply. Try again in a moment.";

  const es = engineData?.soil;
  const effectivePh = es?.ph?.value ?? null;
  const effectiveSoc = es?.organicCarbonGKg?.value ?? null;
  const texture = es?.texture?.value ?? null;
  const fromFarmer = (x: { from: string } | null | undefined) => x?.from === "farmer";
  const textureFits = crop && texture ? crop.soil.textures.includes(texture) : null;
  const phBand = crop?.soil.phOpt;

  const hottest = tmax ? argMax(tmax) : -1;
  const coldest = tmin ? argMin(tmin) : -1;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink sm:text-display">{copy.conditions.title}</h1>
        <p className="max-w-measure text-body text-ink-muted">What the climate and soil around this field allow.</p>
      </div>

      {phase === "loading" ? (
        <Panel as="div" role="status" aria-label={copy.conditions.loadingData} className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-headline text-ink">Gathering satellite and climate data for this field</h2>
            <p className="text-body-sm text-ink-muted">Reading historical conditions from NASA and global soil surveys.</p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            <li className="flex items-center gap-3 rounded-md bg-surface p-3 text-body-sm text-ink">
              <span className="tabular grid size-6 shrink-0 place-items-center rounded-pill border border-line-strong font-mono text-source text-ink-muted">1</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">NASA POWER Weather & Climate (0.5°)</span>
                <span className="text-source text-ink-muted">Reading 40 years of temperature, solar radiation and rain (usually 2–4 seconds)</span>
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
            </li>
            <li className="flex items-center gap-3 rounded-md bg-surface p-3 text-body-sm text-ink">
              <span className="tabular grid size-6 shrink-0 place-items-center rounded-pill border border-line-strong font-mono text-source text-ink-muted">2</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">ISRIC SoilGrids Profile (250 m)</span>
                <span className="text-source text-ink-muted">Reading soil texture, pH, carbon and drainage (usually 1–3 seconds)</span>
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
            </li>
            <li className="flex items-center gap-3 rounded-md bg-surface p-3 text-body-sm text-ink">
              <span className="tabular grid size-6 shrink-0 place-items-center rounded-pill border border-line-strong font-mono text-source text-ink-muted">3</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">GPM IMERG & SMAP Satellite Detail (0.1° / 9 km)</span>
                <span className="text-source text-ink-muted">High-resolution rainfall history and root-zone moisture (about 2–3 minutes)</span>
              </div>
              <Skeleton className="h-5 w-20 shrink-0" />
            </li>
          </ul>
          <p className="m-0 text-source text-ink-muted">Partial results will appear as each source answers.</p>
        </Panel>
      ) : null}

      {phase === "failed" ? (
        <EmptyState
          title="We couldn't reach the data sources"
          body="Conditions come from NASA POWER and ISRIC SoilGrids. Check your connection and try again. Your field and rotation are saved."
        >
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            {copy.home.retry}
          </Button>
          <Link href={`/fields/${field.id}/rotation`} className={buttonClass("secondary")}>
            Back to your rotation
          </Link>
        </EmptyState>
      ) : null}

      {phase === "ready" && data ? (
        <>
          {showingCache ? (
            <Panel as="p" tone="plain" role="status" className="flex items-center gap-2 px-4 py-3 text-body-sm text-ink">
              <InfoGlyph className="shrink-0 text-drought" />
              {copy.data.cachedFrom(formatFetched(data.fetchedAt))}. We couldn&apos;t refresh it just now.
            </Panel>
          ) : null}

          {/* The answer first */}
          <Panel as="section" radius="lg" aria-labelledby="summary" className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <h2 id="summary" className="text-balance text-title text-ink sm:text-display">
                {headline}
              </h2>
              <p className="max-w-measure text-body text-ink-muted">{reason}</p>
            </div>
            {rain && tmax && tmin ? (
              <div className="flex flex-wrap gap-2">
                <RiskChip hazard="water">Rain {annual} mm a year</RiskChip>
                <RiskChip hazard="heat">
                  Hottest: highs near {Math.round(tmax[hottest])} °C in {MONTHS[hottest]}
                </RiskChip>
                {tmin[coldest] <= 3 ? (
                  <RiskChip hazard="frost">
                    Frost possible: nights near {Math.round(tmin[coldest])} °C in {MONTHS[coldest]}
                  </RiskChip>
                ) : (
                  <RiskChip hazard="neutral" icon={<ThermometerGlyph className="shrink-0" />}>
                    Coldest nights near {Math.round(tmin[coldest])} °C in {MONTHS[coldest]}
                  </RiskChip>
                )}
              </div>
            ) : null}
            <SourceLine
              dataset={copy.data.sourceNasaPower}
              resolution="about 0.5° x 0.625°, 50 km"
              dates="2016 to 2025, daily values averaged by month"
              stale={stale}
              detail={copy.conditions.cellResolutionNote}
              className="border-t border-line pt-3"
            />
          </Panel>

          {rotationCrops.length > 1 ? (
            <Segmented
              legend="Show ranges for"
              value={cropId}
              onChange={setCropChoice}
              options={rotationCrops.slice(0, 4)}
              className="sm:max-w-md"
            />
          ) : null}

          {/* Rain and crop water use */}
          <Panel as="section" aria-labelledby="rain" className="flex flex-col gap-5 p-4 sm:p-6">
            <PanelHeader id="rain" title={copy.conditions.rainTitle} description={copy.conditions.rainDescription} />
            {rain ? (
              <RainWaterChart rain={rain} cropUse={et0} />
            ) : (
              <p className="text-body text-ink-muted">NASA POWER didn&apos;t answer, so there is no rainfall chart yet.</p>
            )}
            <div className="flex flex-col gap-1 border-t border-line pt-3 text-body-sm text-ink-muted">
              <p className="m-0 text-ink">
                <span className="font-medium">Satellite rainfall (GPM IMERG):</span>{" "}
                {data.imerg?.status === "ok"
                  ? "retrieved for the whole record"
                  : data.imerg?.status === "pending"
                    ? copy.conditions.imergProgress(data.imerg.covered, data.imerg.expected)
                    : data.imerg?.status === "unavailable"
                      ? "not available right now"
                      : "not connected on this server"}
              </p>
              <p className="m-0">{copy.data.rainfallNote}</p>
            </div>
            <SourceLine dataset={copy.data.sourceNasaPower} resolution="0.5°" dates="2016 to 2025, daily values averaged by month" />
          </Panel>

          {/* Heat and frost */}
          {tmax && tmin ? (
            <Panel as="section" aria-labelledby="heat" className="flex flex-col gap-5 p-4 sm:p-6">
              <PanelHeader id="heat" title={copy.conditions.heatFrostTitle} description={copy.conditions.heatFrostDescription} />
              <TemperatureChart
                tmax={tmax}
                tmin={tmin}
                band={crop ? [crop.temp.optMinC, crop.temp.optMaxC] : undefined}
                bandLabel={crop ? `${cropName} grows best at ${crop.temp.optMinC} to ${crop.temp.optMaxC} °C` : undefined}
              />
              <p className="m-0 max-w-measure text-body-sm text-ink-muted">
                These are monthly averages. A single cold night or hot afternoon can go past them, so check local frost
                dates before planting.
              </p>
              <SourceLine dataset={copy.data.sourceNasaPower} resolution="0.5°" dates="2016 to 2025, daily values averaged by month" />
            </Panel>
          ) : null}

          <SourceStatusPanel conditions={data} remote={analysis.remote} />

          {/* Soil */}
          <Panel as="section" aria-labelledby="soil" className="flex flex-col gap-4 p-4 sm:p-6">
            <PanelHeader id="soil" title={copy.conditions.soilTitle} description={copy.conditions.soilDescription} />

            {effectivePh === null && effectiveSoc === null && !texture ? (
              <Panel tone="plain" as="div" className="flex flex-col gap-3 p-4 sm:p-5">
                <p className="m-0 text-body text-ink">No soil map data here.</p>
                <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.conditions.soilNullWarning}</p>
                <div>
                  <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
                    Add a soil test
                  </Link>
                </div>
              </Panel>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {effectivePh !== null ? (
                  <Reading
                    label="Soil acidity"
                    value={Number(effectivePh.toFixed(1))}
                    unit="pH"
                    band={phBand}
                    scale={[4, 9]}
                    verdictText={
                      phBand
                        ? effectivePh < phBand[0]
                          ? `More acidic than ${cropName} likes`
                          : effectivePh > phBand[1]
                            ? `More alkaline than ${cropName} likes`
                            : `In the range ${cropName} likes`
                        : undefined
                    }
                    source={{
                      dataset: fromFarmer(es?.ph) ? "Your soil value" : soil?.source.dataset ?? "ISRIC SoilGrids v2",
                      resolution: fromFarmer(es?.ph) ? es?.ph?.note ?? "this field" : "250 m",
                      dates: "0 to 30 cm",
                    }}
                  />
                ) : null}
                {effectiveSoc !== null ? (
                  <Reading
                    label="Soil organic carbon"
                    value={Number(effectiveSoc.toFixed(1))}
                    unit="g/kg"
                    scale={[0, 50]}
                    source={{
                      dataset: fromFarmer(es?.organicCarbonGKg) ? "Your soil value" : soil?.source.dataset ?? "ISRIC SoilGrids v2",
                      resolution: fromFarmer(es?.organicCarbonGKg) ? es?.organicCarbonGKg?.note ?? "this field" : "250 m",
                      dates: "0 to 30 cm",
                    }}
                  />
                ) : null}
                {data.rootWetnessPct !== undefined ? (
                  <Reading
                    label="Root-zone wetness"
                    value={data.rootWetnessPct}
                    unit="% full"
                    scale={[0, 100]}
                    source={{ dataset: "NASA POWER", resolution: "0.5°", dates: "long-term mean" }}
                  />
                ) : null}
              </div>
            )}

            {texture ? (
              <Panel as="div" tone="plain" className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="m-0 text-body text-ink">
                  Texture: <span className="font-medium">{texture}</span>
                </p>
                {textureFits !== null ? (
                  <RiskChip hazard={textureFits ? "healthy" : "drought"}>
                    {textureFits ? `Suits ${cropName}` : `Not a usual fit for ${cropName}`}
                  </RiskChip>
                ) : null}
              </Panel>
            ) : null}

            <p className="m-0 max-w-measure text-body-sm text-ink-muted">
              {es?.ph?.from === "farmer" || es?.texture?.from === "farmer" || es?.organicCarbonGKg?.from === "farmer" ? copy.conditions.soilOverrideActive : "Soil values come from a 250 m world map, not from this field. A soil test, if you have one, is more accurate."}{" "}
              {copy.data.sourceSoilGrids}.
            </p>
          </Panel>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-raised px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <Link href={`/fields/${field.id}/rotation`} className="inline-flex min-h-tap items-center text-label text-ink-muted hover:underline">
              Back to your rotation
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {data.weather ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const csv = generateWeatherCsv(field.name, data.weather!);
                    const slug = field.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    downloadCsv(`${slug}-weather-observations.csv`, csv);
                  }}
                  className="min-h-tap"
                >
                  <DownloadGlyph />
                  Download weather CSV
                </Button>
              ) : null}
              <Link href={`/plan?fieldId=${encodeURIComponent(field.id)}`} className={buttonClass("primary", "max-sm:flex-1")}>
                {copy.conditions.compareButton}
                <ChevronRightGlyph />
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
