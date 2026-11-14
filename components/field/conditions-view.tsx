"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MONTHS, RainWaterChart, TemperatureChart } from "@/components/ui/charts";
import { buttonClass, Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph, InfoGlyph } from "@/components/ui/icons";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Reading } from "@/components/ui/reading";
import { RiskChip } from "@/components/ui/risk-chip";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceLine } from "@/components/ui/source-line";
import { copy } from "@/lib/copy/en";
import { getCropById } from "@/lib/data/crops";
import { shortSlotName } from "@/lib/rotation-format";
import { getCachedConditions, isStale, setCachedConditions, type ConditionsData } from "@/lib/store/data-cache";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";

type Phase = "loading" | "ready" | "failed";

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

  const [data, setData] = useState<ConditionsData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [showingCache, setShowingCache] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [cropChoice, setCropChoice] = useState<string | null>(null);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  const id = field?.id;
  const lng = field?.centroid[0];
  const lat = field?.centroid[1];

  useEffect(() => {
    if (!id || lng === undefined || lat === undefined) return;
    let mounted = true;

    async function run() {
      setPhase("loading");
      setShowingCache(false);
      const cached = await getCachedConditions(id!);
      if (cached && mounted) {
        setData(cached);
        // Fresh enough: no need to ask again
        if (!isStale(cached.fetchedAt, 6)) {
          setPhase("ready");
          return;
        }
      }
      try {
        const res = await fetch(`/api/field/${id}/conditions?lng=${lng}&lat=${lat}`);
        if (!res.ok) throw new Error(`Conditions answered ${res.status}`);
        const json = (await res.json()) as ConditionsData;
        if (!mounted) return;
        if (!json.climateAvailable && !json.soilAvailable) throw new Error("No source answered");
        setData(json);
        setPhase("ready");
        void setCachedConditions(id!, json);
      } catch {
        if (!mounted) return;
        if (cached) {
          setShowingCache(true);
          setPhase("ready");
        } else {
          setPhase("failed");
        }
      }
    }

    void run();
    return () => {
      mounted = false;
    };
  }, [id, lng, lat, attempt]);

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
      ? dryMonths.length > 0
        ? `Rain falls short of what crops use in ${dryMonths.length} ${dryMonths.length === 1 ? "month" : "months"} (${listMonths(dryMonths)}). Plan water for those months, or time planting to avoid them.`
        : "On average, rain keeps up with what crops use in every month."
      : rain
        ? "Soil information is below. Temperature and crop water use could not be read."
        : "Your saved crops and soil below still apply. Try again in a moment.";

  const effectivePh = field.soilOverride?.ph ?? soil?.ph ?? null;
  const effectiveSoc = field.soilOverride?.ocPct ? field.soilOverride.ocPct * 10 : (soil?.socGKg ?? null);
  const texture = field.soilOverride?.texture ?? soil?.texture ?? null;
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
        <div role="status" aria-label={copy.conditions.loadingData} className="flex flex-col gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-72" />
          <p className="text-body-sm text-ink-muted">{copy.conditions.loadingData}</p>
        </div>
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
                <RiskChip hazard={tmin[coldest] <= 3 ? "frost" : "healthy"}>
                  {tmin[coldest] <= 3
                    ? `Frost possible: nights near ${Math.round(tmin[coldest])} °C in ${MONTHS[coldest]}`
                    : `Coldest nights near ${Math.round(tmin[coldest])} °C in ${MONTHS[coldest]}`}
                </RiskChip>
              </div>
            ) : null}
            <SourceLine
              dataset={copy.data.sourceNasaPower}
              resolution="0.5°, about 50 km"
              dates="long-term monthly means"
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
            <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3 text-body-sm text-ink-muted">
              <p className="m-0 text-ink">
                <span className="font-medium">Satellite rainfall (GPM IMERG):</span> not connected yet
              </p>
              <p className="m-0">{copy.data.rainfallNote}</p>
            </div>
            <SourceLine dataset={copy.data.sourceNasaPower} resolution="0.5°" dates="long-term monthly means" />
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
              <SourceLine dataset={copy.data.sourceNasaPower} resolution="0.5°" dates="long-term monthly means" />
            </Panel>
          ) : null}

          {/* Soil */}
          <section aria-labelledby="soil" className="flex flex-col gap-4">
            <PanelHeader id="soil" title={copy.conditions.soilTitle} description={copy.conditions.soilDescription} />

            {effectivePh === null && effectiveSoc === null && !texture ? (
              <Panel tone="plain" as="div" className="flex flex-col gap-3 p-4 sm:p-5">
                <p className="m-0 text-body text-ink">No soil map data here.</p>
                <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.conditions.soilNullWarning}</p>
                <div>
                  <Link href={`/fields/${field.id}/location`} className={buttonClass("secondary")}>
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
                      dataset: field.soilOverride?.ph ? "Your soil test" : soil?.source.dataset ?? "ISRIC SoilGrids v2",
                      resolution: field.soilOverride?.ph ? "this field" : "250 m",
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
                      dataset: field.soilOverride?.ocPct ? "Your soil test" : soil?.source.dataset ?? "ISRIC SoilGrids v2",
                      resolution: field.soilOverride?.ocPct ? "this field" : "250 m",
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
              {field.soilOverride ? copy.conditions.soilOverrideActive : "Soil values come from a 250 m world map, not from this field. A soil test, if you have one, is more accurate."}{" "}
              {copy.data.sourceSoilGrids}.
            </p>
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-raised px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <Link href={`/fields/${field.id}/rotation`} className="inline-flex min-h-tap items-center text-label text-ink-muted hover:underline">
              Back to your rotation
            </Link>
            <Link href={`/fields/${field.id}/compare`} className={buttonClass("primary", "max-sm:flex-1")}>
              {copy.conditions.compareButton}
              <ChevronRightGlyph />
            </Link>
          </div>
        </>
      ) : null}
    </>
  );
}
