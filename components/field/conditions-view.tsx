"use client";

import { FlowNav } from "@/components/ui/flow-nav";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MONTHS, RainWaterChart, TemperatureChart } from "@/components/ui/charts";
import { buttonClass, Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoGlyph } from "@/components/ui/icons";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Reading } from "@/components/ui/reading";
import { RiskChip } from "@/components/ui/risk-chip";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisLoading } from "@/components/field/analysis-loading";
import { NextSteps } from "@/components/field/next-steps";
import { CropCalendar } from "@/components/field/crop-calendar";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { TrendsView } from "@/components/field/trends-view";
import { DryZoneRainNote, SourceStatusPanel, VulnerabilityPanel, WaterUsePanel } from "@/components/field/conditions-panels";
import { ConditionsSummary } from "@/components/field/conditions-summary";
import { BandChip, StatusChip, bandCarbon, bandPh } from "@/components/field/conditions/bands";
import { RiskEntryGrid } from "@/components/field/conditions/risk-entry-grid";
import { RiskExplorer } from "@/components/field/conditions/risk-explorer";
import { WaterStressPanel } from "@/components/field/conditions/risk-panels/water-stress-panel";
import { FloodPanel } from "@/components/field/conditions/risk-panels/flood-panel";
import { ErosionPanel } from "@/components/field/conditions/risk-panels/erosion-panel";
import { HeatColdPanel } from "@/components/field/conditions/risk-panels/heat-cold-panel";
import { buildRiskEvidenceMap, type RiskKind } from "@/lib/conditions/condition-evidence";
import { fieldIdentity } from "@/lib/conditions/explorer-model";
import type { TrendSeries } from "@/lib/server/trends";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { copy } from "@/lib/copy/en";
import { compareRotations } from "@/lib/engine/compare";
import { monthlyNormals } from "@/lib/engine/climate";
import { BASELINE } from "@/lib/engine/data";
import { getCropById } from "@/lib/data/crops";
import { regionOfPoint } from "@/lib/data/regions";
import { shortSlotName } from "@/lib/rotation-format";
import { isStale } from "@/lib/store/data-cache";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import { isDryZone } from "@/lib/validation/source-checks";

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

  const cropId = cropChoice ?? rotationCrops[0]?.value ?? "maize";
  const crop = getCropById(cropId);
  const cropName = rotationCrops.find((c) => c.value === cropId)?.label ?? crop?.names.common ?? "maize";

  const [activeView, setActiveView] = useState<"overview" | "explorer">("overview");
  const opener = useRef<string>("explore-entry");
  const openExplorer = (risk: RiskKind) => {
    opener.current = document.activeElement?.id || "explore-entry";
    setSelectedRisk(risk);
    setActiveView("explorer");
    // One history entry, so the phone's Back gesture closes the map instead of leaving the field.
    window.history.pushState({ riskExplorer: true }, "");
  };
  const closeExplorer = () => {
    setActiveView("overview");
    if (typeof window !== "undefined" && window.history.state?.riskExplorer) window.history.back();
  };
  useEffect(() => {
    const onPop = () => setActiveView("overview");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // After the map closes, put focus back where the farmer opened it.
  const wasExplorer = useRef(false);
  useEffect(() => {
    if (activeView === "explorer") wasExplorer.current = true;
    else if (wasExplorer.current) {
      wasExplorer.current = false;
      (document.getElementById(opener.current) ?? document.getElementById("explore-entry"))?.focus();
    }
  }, [activeView]);
  const [selectedRisk, setSelectedRisk] = useState<RiskKind>("water_stress");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [trendsData, setTrendsData] = useState<{ trends: TrendSeries[]; through: number } | null>(null);

  const lng = field?.centroid[0];
  const lat = field?.centroid[1];
  useEffect(() => {
    if (lng === undefined || lat === undefined) return;
    const ctl = new AbortController();
    fetch(`/api/field/${fieldId}/trends?lng=${lng}&lat=${lat}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) setTrendsData(d);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [fieldId, lng, lat]);

  // /conditions?risk=flood opens the map on that risk (used by Compare).
  const deepLinked = useRef(false);

  const evidenceMap = useMemo(() => {
    if (!field) return null;
    return buildRiskEvidenceMap({
      conditions: data,
      remote: analysis.remote,
      trends: trendsData,
      field,
      selectedYear,
      selectedDate,
      crop,
      comparison,
    });
  }, [data, analysis.remote, trendsData, field, selectedYear, selectedDate, crop, comparison]);

  useEffect(() => {
    if (deepLinked.current || !evidenceMap || typeof window === "undefined") return;
    const r = new URLSearchParams(window.location.search).get("risk");
    if (r === "water_stress" || r === "flood" || r === "erosion" || r === "heat_cold") {
      deepLinked.current = true;
      window.history.replaceState(window.history.state, "", window.location.pathname);
      setSelectedRisk(r);
      setActiveView("explorer");
      window.history.pushState({ riskExplorer: true }, "");
    }
  }, [evidenceMap]);

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

  const rain = data?.monthlyRainMm;
  const et0 = data?.monthlyEt0Mm;
  const tmax = data?.monthlyTmaxC;
  const tmin = data?.monthlyTminC;
  const soil = data?.soil ?? null;
  const stale = data ? isStale(data.fetchedAt, 48) : false;
  const latestSmapRootzone = [...(analysis.remote?.smap?.data?.days ?? [])]
    .reverse()
    .find((day) => day.rootzone !== null);
  const rootWetnessPct = latestSmapRootzone?.rootzone !== null && latestSmapRootzone?.rootzone !== undefined
    ? Math.round(latestSmapRootzone.rootzone * 100)
    : data?.rootWetnessPct;

  const dryMonths = rain && et0 ? rain.map((r, i) => (et0[i] > r ? i : -1)).filter((i) => i >= 0) : [];
  const annual = data?.annualRainMm;
  const regionId = field.region && field.region !== "unsupported" ? field.region : regionOfPoint(field.centroid);
  const dryZone = isDryZone(regionId);

  const headline =
    rain && et0
      ? dryMonths.length === 12
        ? `Rain peaks ${wettestSeason(rain)} but never covers what crops use`
        : dryMonths.length > 0
          ? `Most rain falls ${wettestSeason(rain)}. ${dryMonths.length} ${dryMonths.length === 1 ? "month runs" : "months run"} drier than crops need`
          : `Rain keeps up with crop water use all year, with most falling ${wettestSeason(rain)}`
      : rain
        ? `Most rain falls ${wettestSeason(rain)}`
        : "Climate data isn't available for this field right now";
  const reason =
    rain && et0
      ? dryMonths.length === 12
        ? "Most crops here need irrigation or stored soil water in every month."
        : dryMonths.length > 0
          ? `Dry months: ${listMonths(dryMonths)}. Plan water for them, or time planting to avoid them.`
          : "On average, rain keeps up with how much water crops would use in every month."
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
  // Temperature only earns a place on the first screen when a limit is hit. Otherwise it sits under "More detail".
  const frostHit = tmin ? tmin[coldest] <= 3 || (crop ? tmin[coldest] <= crop.temp.absMinC : false) : false;
  const heatHit =
    tmax && crop ? tmax[hottest] >= crop.temp.absMaxC || (crop.temp.heatFloweringC != null && tmax[hottest] >= crop.temp.heatFloweringC) : false;
  const tempFirst = frostHit || heatHit;
  const manyCrops = rotationCrops.length > 3;
  const supportingSection = "flex flex-col gap-5 border-t border-line py-5 first:border-0 first:pt-0";
  const cropPicker =
    rotationCrops.length > 1 ? (
      <Segmented legend="Show ranges for" value={cropId} onChange={setCropChoice} options={rotationCrops.slice(0, 4)} className="sm:max-w-md" />
    ) : null;
  const temperaturePanel =
    tmax && tmin ? (
      <section aria-labelledby="heat" className={supportingSection}>
        <PanelHeader id="heat" title="Hot and cold months" description="The shaded range is what this crop prefers." />
        {frostHit ? (
          <div>
            <RiskChip hazard="frost">
              {tmin[coldest] <= 0
                ? `Frost possible: nights near ${Math.round(tmin[coldest])} °C in ${MONTHS[coldest]}`
                : `Cold stress: nights near ${Math.round(tmin[coldest])} °C in ${MONTHS[coldest]}`}
            </RiskChip>
          </div>
        ) : null}
        {heatHit ? (
          <div>
            <RiskChip hazard="heat">
              Very hot: highs near {Math.round(tmax[hottest])} °C in {MONTHS[hottest]}
            </RiskChip>
          </div>
        ) : null}
        <TemperatureChart
          tmax={tmax}
          tmin={tmin}
          band={crop ? [crop.temp.optMinC, crop.temp.optMaxC] : undefined}
          bandLabel={crop ? `${cropName} grows best at ${crop.temp.optMinC} to ${crop.temp.optMaxC} °C` : undefined}
        />
        <p className="m-0 max-w-measure text-body-sm text-ink-muted">Monthly averages. Check local cold sensitivity and sowing dates before planting.</p>
      </section>
    ) : null;

  if (activeView === "explorer" && evidenceMap) {
    return (
      <RiskExplorer
        field={field}
        evidenceMap={evidenceMap}
        initialRisk={selectedRisk}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        trends={trendsData}
        remote={analysis.remote}
        onBack={closeExplorer}
        renderRiskPanel={(risk, evidence) => {
          if (risk === "water_stress") return <WaterStressPanel evidence={evidence} crop={crop} />;
          if (risk === "flood") return <FloodPanel evidence={evidence} />;
          if (risk === "erosion") return <ErosionPanel evidence={evidence} />;
          if (risk === "heat_cold") return <HeatColdPanel evidence={evidence} crop={crop} />;
          return null;
        }}
      />
    );
  }

  return (
    <>
      <FieldPageHeader
        title={copy.conditions.title}
        summary={(() => {
          const id = fieldIdentity(field);
          return id.context ? `${id.name} · ${id.context}` : id.name;
        })()}
      />

      {phase === "loading" ? (
        <AnalysisLoading
          title="Getting the weather and soil for this field"
          crops={rotationCrops.map((c) => c.label)}
          slow={analysis.slow}
          steps={[
            "Weather and rain for your area: checking now",
            "Soil map: checking now",
            analysis.remote?.hls.status === "ok"
              ? "Field photos from satellite: ready"
              : "Field photos from satellite: checking in the background, a minute or more (can use data)",
          ]}
        />
      ) : null}

      {phase === "failed" ? (
        <EmptyState
          title="We couldn't reach the data sources"
          body="Check your connection and try again. Your field and crops are saved."
        >
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            {copy.conditions.retryData}
          </Button>
          <Link href={`/fields/${field.id}/compare`} className={buttonClass("secondary")}>
            {copy.conditions.compareButton}
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

          {/* 1 · The answer: one seasonal insight */}
          <section aria-labelledby="summary" className="flex flex-col gap-2">
            <h2 id="summary" className="m-0 max-w-measure text-balance text-title text-ink sm:text-display">
              {headline}
            </h2>
            {annual !== undefined && rain && dryZone ? <DryZoneRainNote /> : null}
            <p className="m-0 max-w-measure text-body text-ink-muted">{reason}</p>
            <ul aria-label="Status" className="m-0 flex list-none flex-wrap gap-2 p-0">
              {rain && et0 ? (
                <li>
                  <StatusChip icon={dryMonths.length > 0 ? "rain" : "success"} tone={dryMonths.length > 0 ? "watch" : "good"}>
                    {dryMonths.length === 0 ? "Rain is enough" : dryMonths.length === 12 ? "Dry all year" : `${dryMonths.length} dry ${dryMonths.length === 1 ? "month" : "months"}`}
                  </StatusChip>
                </li>
              ) : null}
              {frostHit && tmin ? (
                <li>
                  <StatusChip icon="frost" tone="watch">{tmin[coldest] <= 0 ? "Frost possible" : "Cold nights"}</StatusChip>
                </li>
              ) : null}
              {heatHit && tmax ? (
                <li>
                  <StatusChip icon="heat" tone="watch">Very hot month</StatusChip>
                </li>
              ) : null}
              {textureFits === false ? (
                <li>
                  <StatusChip icon="soil" tone="watch">Soil not a usual fit</StatusChip>
                </li>
              ) : null}
            </ul>
            <p className="m-0 max-w-measure text-body-sm text-ink-muted">
              {copy.conditions.cellResolutionNote} Updated {formatFetched(data.fetchedAt)}.
            </p>
            {(analysis.satelliteImageryPending ?? analysis.retrieving) ? (
              <p role="status" className="m-0 flex items-center gap-2 text-body-sm text-ink-muted">
                <InfoGlyph className="shrink-0" />
                {copy.conditions.checkingPhotos}
              </p>
            ) : null}
          </section>

          {/* 2 · The evidence: three numbers and one local check */}
          <ConditionsSummary conditions={data} crop={crop} cropName={cropName} effectivePh={effectivePh} remote={analysis.remote} />

          {/* 3 · The way in: explore the vulnerabilities on the map */}
          {evidenceMap ? <RiskEntryGrid evidenceMap={evidenceMap} geometry={field.geometry} onSelectRisk={openExplorer} /> : null}

          {manyCrops ? cropPicker : null}

          {/* Rain and crop water use */}
          <section aria-labelledby="rain" className={supportingSection}>
            <PanelHeader id="rain" title={<span className="inline-flex items-center gap-2"><Icon name="rain" />Rain and dry months</span>} description="Usual rain against the water crops may need." />
            {rain ? (
              <RainWaterChart rain={rain} cropUse={et0} />
            ) : (
              <p className="text-body text-ink-muted">Regional NASA weather isn&apos;t available right now, so there is no rainfall chart yet.</p>
            )}
            <p className="m-0 max-w-measure text-body-sm text-ink-muted">Monthly totals in mm, averaged over past years. This is the usual pattern, not a forecast.</p>
            <Disclosure title={copy.conditions.sourceWeatherLine} hint={stale ? <span className="font-medium text-drought">Older than usual</span> : "Details"} className="border-0 bg-surface-sunken">
              <p className="m-0 max-w-measure text-body-sm text-ink">
                The dashed line is reference water demand (ET0): how much water a short, well-watered grass would use in this weather. It helps estimate crop water use and is calculated from regional NASA POWER weather, not measured on your field.
              </p>
              <p className="m-0 text-body-sm text-ink">
                Satellite rainfall:{" "}
                {data.imerg?.status === "ok"
                  ? "retrieved for the whole record"
                  : data.imerg?.status === "pending"
                    ? copy.conditions.imergProgress(data.imerg.covered, data.imerg.expected)
                    : "not available for your area yet, so NASA weather (about 50 km) is used"}
              </p>
              <p className="m-0 text-body-sm text-ink-muted">{copy.data.rainfallNote}</p>
              <p className="m-0 text-body-sm text-ink-muted">{copy.conditions.cellResolutionTechnical} Daily values, averaged by month.</p>
            </Disclosure>
          </section>

          {/* Heat and frost: first screen only when a limit is hit */}
          {tempFirst ? temperaturePanel : null}

          <Disclosure title="Long-term trends" hint="1981 to now" lazy className="border-0 bg-surface-sunken">
            <p className="m-0 max-w-measure text-body-sm text-ink-muted">Past observations for this area. They are not a forecast.</p>
            <TrendsView fieldId={field.id} embedded conditions={data} remote={analysis.remote} comparison={comparison} />
          </Disclosure>

          <Disclosure title="Crop, climate and source details" className="border-0 bg-transparent [&>summary]:px-0 [&>div]:px-0">
            {!manyCrops ? cropPicker : null}
            {!tempFirst ? temperaturePanel : null}
            {comparison ? <VulnerabilityPanel comparison={comparison} /> : null}
            {comparison ? <WaterUsePanel comparison={comparison} /> : null}

            {comparison ? (
              <section aria-labelledby="calendar" className={supportingSection}>
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
              </section>
            ) : null}

            <SourceStatusPanel conditions={data} remote={analysis.remote} />
          </Disclosure>

          {/* Soil */}
          <section aria-labelledby="soil" className={supportingSection}>
            <PanelHeader id="soil" title={<span className="inline-flex items-center gap-2"><Icon name="soil" />Soil around this field</span>} description={copy.conditions.soilCaveat} />

            {effectivePh === null && effectiveSoc === null && !texture ? (
              <div className="flex flex-col items-start gap-3">
                <p className="m-0 text-body text-ink">No soil map data here.</p>
                <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.conditions.soilNullWarning}</p>
                <div>
                  <Link href={`/fields/${field.id}/profile`} className={buttonClass("secondary")}>
                    Add a soil test
                  </Link>
                </div>
              </div>
            ) : (
              <>
              <ul aria-label="Soil at a glance" className="m-0 flex list-none flex-wrap gap-2 p-0">
                {effectivePh !== null ? (
                  <li>
                    <span className="inline-flex items-center gap-2 text-body-sm text-ink">
                      Acidity <BandChip band={bandPh(effectivePh, phBand ?? null)} />
                    </span>
                  </li>
                ) : null}
                {effectiveSoc !== null ? (
                  <li>
                    <span className="inline-flex items-center gap-2 text-body-sm text-ink">
                      Organic carbon <BandChip band={bandCarbon(effectiveSoc)} />
                    </span>
                  </li>
                ) : null}
              </ul>
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
                      resolution: fromFarmer(es?.ph) ? es?.ph?.note ?? "this field" : "map estimate",
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
                      resolution: fromFarmer(es?.organicCarbonGKg) ? es?.organicCarbonGKg?.note ?? "this field" : "map estimate",
                      dates: "0 to 30 cm",
                    }}
                  />
                ) : null}
                {rootWetnessPct !== undefined ? (
                  <Reading
                    label="Root-zone wetness"
                    value={rootWetnessPct}
                    unit="% full"
                    scale={[0, 100]}
                    source={latestSmapRootzone
                      ? { dataset: "NASA SMAP L4", resolution: "about 9 km", dates: latestSmapRootzone.date }
                      : { dataset: "NASA POWER", resolution: "about 50 km", dates: "long-term mean" }}
                  />
                ) : null}
              </div>
              </>
            )}

            {texture ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3">
                <p className="m-0 text-body text-ink">
                  Texture: <span className="font-medium">{texture}</span>
                </p>
                {textureFits === false ? <RiskChip hazard="drought">{`Not a usual fit for ${cropName}`}</RiskChip> : null}
              </div>
            ) : null}

            <Disclosure title="About these soil numbers" className="border-0 bg-surface-sunken">
              <p className="m-0 max-w-measure text-body-sm text-ink-muted">
                Map values (SoilGrids) are model estimates for a 250 m area and are not a soil test. {rootWetnessPct !== undefined ? latestSmapRootzone ? "Root-zone wetness is a 9 km SMAP model-and-satellite estimate, not a reading of your field. " : "Root-zone wetness is a long-term average from NASA POWER, a model for a regional cell, not a reading of your field. " : ""}Soil changes slowly, so these are not forecasts.
              </p>
              <p className="m-0 max-w-measure text-body-sm text-ink-muted">
                {es?.ph?.from === "farmer" || es?.texture?.from === "farmer" || es?.organicCarbonGKg?.from === "farmer" ? copy.conditions.soilOverrideActive : copy.data.sourceSoilGrids + "."}
              </p>
            </Disclosure>
          </section>

          <FlowNav
            back={{ label: "Back", href: `/fields/${field.id}` }}
            next={{ label: copy.conditions.compareButton, href: `/fields/${field.id}/compare` }}
          />

          <NextSteps fieldId={field.id} current="conditions" />
        </>
      ) : null}
    </>
  );
}
