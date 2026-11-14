"use client";

import { ActionBar } from "@/components/ui/action-bar";
import { Icon } from "@/components/ui/icon";
import { useEffect, useMemo, useState } from "react";
import { MONTHS, RainWaterChart, TemperatureChart } from "@/components/ui/charts";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoGlyph, ThermometerGlyph } from "@/components/ui/icons";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Reading } from "@/components/ui/reading";
import { RiskChip } from "@/components/ui/risk-chip";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceLine } from "@/components/ui/source-line";
import { CropCalendar } from "@/components/field/crop-calendar";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { TrendsView } from "@/components/field/trends-view";
import { SourceStatusPanel, VulnerabilityPanel, WaterUsePanel } from "@/components/field/conditions-panels";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { copy } from "@/lib/copy/en";
import { compareRotations } from "@/lib/engine/compare";
import { monthlyNormals } from "@/lib/engine/climate";
import { BASELINE } from "@/lib/engine/data";
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

  const comparison = useMemo(
    () => (field && engineData && rotations[0]?.slots.length ? compareRotations(engineData, rotations[0]) : null),
    [field, engineData, rotations],
  );
  const rainyMonths = useMemo(
    () =>
      engineData?.records.length
        ? monthlyNormals(engineData.records.filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear))
            .filter((n) => n.rainMm >= 100)
            .map((n) => n.month)
        : [],
    [engineData],
  );

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
        <Button href="/" variant="primary">
          Back to your fields
        </Button>
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
      <FieldPageHeader title={copy.conditions.title} summary="Rain, heat and soil around this field." />

      {phase === "loading" ? (
        <Panel as="div" role="status" aria-label={copy.conditions.loadingData} className="flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="m-0 text-headline text-ink">Getting the weather and soil for this field</h2>
          <p className="m-0 text-body-sm text-ink-muted">A few seconds. Satellite detail can take a few minutes and will appear when ready.</p>
          <Skeleton className="h-5 w-40" />
        </Panel>
      ) : null}

      {phase === "failed" ? (
        <EmptyState
          title="We couldn't reach the data sources"
          body="Check your connection and try again. Your field and crops are saved."
        >
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            {copy.home.retry}
          </Button>
          <Button href={`/fields/${field.id}/compare`} variant="secondary">
            {copy.conditions.compareButton}
          </Button>
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
            <PanelHeader id="rain" title={<span className="inline-flex items-center gap-2"><Icon name="water" />Rain and dry months</span>} description="Usual rain against the water crops may need." />
            {rain ? (
              <RainWaterChart rain={rain} cropUse={et0} />
            ) : (
              <p className="text-body text-ink-muted">NASA POWER didn&apos;t answer, so there is no rainfall chart yet.</p>
            )}
            <Disclosure title="About this rainfall" className="border-0 bg-surface-sunken">
              <p className="m-0 text-body-sm text-ink">
                Satellite rainfall:{" "}
                {data.imerg?.status === "ok"
                  ? "retrieved for the whole record"
                  : data.imerg?.status === "pending"
                    ? copy.conditions.imergProgress(data.imerg.covered, data.imerg.expected)
                    : data.imerg?.status === "unavailable"
                      ? "not available right now"
                      : "not connected on this server"}
              </p>
              {data.rainDays ? (
                <p className="m-0 text-body-sm text-ink">
                  This chart uses {data.rainSource === "imerg" ? "GPM IMERG satellite rainfall" : "NASA POWER rainfall"}:{" "}
                  {data.rainDays.imerg} days from IMERG, {data.rainDays.power} from NASA POWER
                  {data.rainDays.missing ? `, ${data.rainDays.missing} missing` : ""}.
                </p>
              ) : null}
              <p className="m-0 text-body-sm text-ink-muted">{copy.data.rainfallNote}</p>
            </Disclosure>
          </Panel>

          {/* Heat and frost */}
          {tmax && tmin ? (
            <Panel as="section" aria-labelledby="heat" className="flex flex-col gap-5 p-4 sm:p-6">
              <PanelHeader id="heat" title="Hot and cold months" description="The shaded range is what this crop prefers." />
              <TemperatureChart
                tmax={tmax}
                tmin={tmin}
                band={crop ? [crop.temp.optMinC, crop.temp.optMaxC] : undefined}
                bandLabel={crop ? `${cropName} grows best at ${crop.temp.optMinC} to ${crop.temp.optMaxC} °C` : undefined}
              />
              <p className="m-0 max-w-measure text-body-sm text-ink-muted">Monthly averages. Check local frost dates before planting.</p>
            </Panel>
          ) : null}

          <Disclosure title="More detail" className="border-0 bg-transparent [&>summary]:px-0 [&>div]:px-0">
          {comparison ? <VulnerabilityPanel comparison={comparison} /> : null}
            {comparison ? <WaterUsePanel comparison={comparison} /> : null}

            {comparison ? (
              <Panel as="section" aria-labelledby="calendar" className="flex flex-col gap-4 p-4 sm:p-6">
                <PanelHeader id="calendar" title={copy.calendar.title} description={copy.calendar.lead} />
                <CropCalendar option={comparison.current} rainyMonths={rainyMonths} />
                {comparison.current.lowCover.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body-sm text-ink">
                    {comparison.current.lowCover.map((g) => (
                      <li key={g.gap.from}>
                        {g.gap.from.slice(5)} to {g.gap.to.slice(5)}: {g.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            ) : null}

            <SourceStatusPanel conditions={data} remote={analysis.remote} />
            <Disclosure title="Long-term trends" lazy>
              <TrendsView fieldId={field.id} embedded />
            </Disclosure>
          </Disclosure>

          {/* Soil */}
          <Panel as="section" aria-labelledby="soil" className="flex flex-col gap-4 p-4 sm:p-6">
            <PanelHeader id="soil" title={<span className="inline-flex items-center gap-2"><Icon name="soil" />Soil around this field</span>} description="Mapped at 250 m. A soil test is more precise." />

            {effectivePh === null && effectiveSoc === null && !texture ? (
              <Panel tone="plain" as="div" className="flex flex-col gap-3 p-4 sm:p-5">
                <p className="m-0 text-body text-ink">No soil map data here.</p>
                <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.conditions.soilNullWarning}</p>
                <div>
                  <Button href={`/fields/${field.id}/profile`} variant="secondary">
                    Add a soil test
                  </Button>
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
                    source={{ dataset: "NASA POWER GWETROOT (modelled)", resolution: "about 0.5° x 0.625°", dates: `${data.completeYears ?? "baseline"} complete years, 2016 to 2025` }}
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
              {es?.ph?.from === "farmer" || es?.texture?.from === "farmer" || es?.organicCarbonGKg?.from === "farmer" ? copy.conditions.soilOverrideActive : copy.data.sourceSoilGrids + "."}
            </p>
          </Panel>

          <ActionBar>
            <Button href={`/fields/${field.id}/compare`} variant="primary" className="flex-1" size="lg">
              {copy.conditions.compareButton}
              <Icon name="next" />
            </Button>
          </ActionBar>
        </>
      ) : null}
    </>
  );
}
