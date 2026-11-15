"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Message } from "@/components/ui/message";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { DryZoneRainNote } from "@/components/field/conditions-panels";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { Button, buttonClass } from "@/components/ui/button";
import { FlowNav } from "@/components/ui/flow-nav";
import { BandChip, bandPh, bandRain } from "@/components/field/conditions/bands";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { NavLink } from "@/components/ui/nav-link";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RiskChip } from "@/components/ui/risk-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { REGIONS, regionOfPoint } from "@/lib/data/regions";
import { formatAreaForLocale } from "@/lib/format-area";
import { formatPoint } from "@/lib/geo/format";
import { staticMapUrl } from "@/lib/geo/static-map";
import { formatSpan, plural, sequenceText, slotName, currentRotation } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import { useAppCopy, useLocaleStore } from "@/lib/store/locale-store";
import { isDryZone } from "@/lib/validation/source-checks";


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function wettestSeason(rain?: number[]): string | null {
  if (!rain || rain.length < 12) return null;
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

/**
 * Field Overview (S06 Field Hub).
 * Acts as the master dashboard for the field:
 * - Clear next action orientation
 * - Current crop rotation sequence
 * - Local weather & soil conditions snapshot from NASA POWER & SoilGrids
 * - Farm profile, water access, and management constraints
 * - Rotation comparison preview
 * - Field satellite map & boundary status
 */
export function FieldOverview({ fieldId }: { fieldId: string }) {
  const router = useRouter();
  const t = useAppCopy();
  const locale = useLocaleStore((s) => s.locale);
  const areaUnit = useLocaleStore((s) => s.areaUnit);
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const update = useFieldsStore((s) => s.update);
  const remove = useFieldsStore((s) => s.remove);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  // Load NASA POWER, IMERG & SoilGrids analysis
  const analysis = useFieldAnalysis(field);

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={t.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-44 w-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  if (!field) {
    return (
      <EmptyState title="This field isn't saved on this phone" body="Fields are stored on the phone where you added them.">
        <Link href="/" className={buttonClass("primary")}>Back to your fields</Link>
      </EmptyState>
    );
  }

  const rotation = currentRotation(rotations) ?? null;
  const hasRotation = Boolean(rotation);
  const hasBoundary = field.geometry.type === "Polygon";
  const boundaryHref = `/fields/${field.id}/location`;
  const boundaryLabel = hasBoundary ? "Edit field boundary" : "Draw field boundary";

  const regionId = field.region && field.region !== "unsupported" ? field.region : regionOfPoint(field.centroid);
  const regionName = regionId !== "unsupported" ? REGIONS[regionId]?.name : null;

  // Conditions: only what was actually retrieved or entered.
  const conditions = analysis.conditions;
  const annualRainMm = conditions?.annualRainMm ? Math.round(conditions.annualRainMm) : null;
  const wetSeason = conditions?.monthlyRainMm ? wettestSeason(conditions.monthlyRainMm) : null;
  const maxT = conditions?.monthlyTmaxC && conditions.monthlyTmaxC.length > 0 ? Math.max(...conditions.monthlyTmaxC) : null;
  const minT = conditions?.monthlyTminC && conditions.monthlyTminC.length > 0 ? Math.min(...conditions.monthlyTminC) : null;

  const soilTexture = field.soilOverride?.texture ?? conditions?.soil?.texture ?? null;
  const rawPh = field.soilOverride?.ph ?? conditions?.soil?.ph ?? null;
  // One decimal: a lab reports pH to 0.1, and SoilGrids averages can carry long fractions.
  const soilPh = rawPh === null || rawPh === undefined ? null : Math.round(Number(rawPh) * 10) / 10;
  const isSoilTested = Boolean(
    field.soilOverride?.testedOn ||
    field.soilOverride?.ph ||
    field.soilOverride?.texture ||
    (field.soilObservations && field.soilObservations.length > 0)
  );
  const soilSource = field.soilOverride ? "Your soil test" : "ISRIC SoilGrids";

  const primaryEquipment = field.constraints?.equipment?.length
    ? field.constraints.equipment.map((e) => t.profile.equipment[e] ?? e).join(", ")
    : null;
  const topPriority = field.priorities?.order?.[0];
  const labour = field.constraints?.labour;
  const market = field.constraints?.marketAccess;
  // Farm details saves constraints.irrigation only once the farmer answers; field.irrigation alone is the default.
  const waterSetByFarmer = Boolean(field.constraints?.irrigation);

  // Optional details that would sharpen the answer. The boundary is reachable from the map and Field options.
  const optionalLeft = [isSoilTested, Boolean(topPriority || labour || primaryEquipment)].filter((done) => !done).length;
  const profileHref = `/fields/${field.id}/profile`;

  const next = !rotation
    ? { title: t.path.nextAddCrops, body: t.path.nextAddCropsBody, href: `/fields/${field.id}/rotation`, cta: "Add my crops", icon: "rotation" as const }
    : { title: t.path.nextAnswerReady, body: t.path.nextAnswerBody(sequenceText(rotation, " then ")), href: `/fields/${field.id}/compare`, cta: t.path.seeAnswer, icon: "compare" as const };

  const handleRemove = async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      await remove(field.id);
      setRemoveOpen(false);
      router.push("/");
    } catch {
      setRemoveError(t.overview.removeError);
    } finally {
      setRemoving(false);
    }
  };

  const handleArchive = async () => {
    const isArchived = Boolean(field.archivedAt);
    await update(field.id, { archivedAt: isArchived ? undefined : new Date().toISOString() });
  };


  const soilOc = field.soilOverride?.ocPct ?? (conditions?.soil?.socGKg ? conditions.soil.socGKg / 10 : null);
  const salinityObs = field.soilObservations?.find((o) => o.property === "salinity");
  const salinity = field.soilOverride?.salinityDsM ?? (salinityObs ? Number(salinityObs.value) : null);

  const textureMeaning = (tex: string) =>
    /sand/.test(tex) && !/clay/.test(tex) ? "drains fast, holds little water"
    : /clay/.test(tex) && !/loam/.test(tex) ? "holds water, drains slowly"
    : "balanced, holds water and drains";
  const phMeaning = (ph: number) => (ph < 5.5 ? "acidic" : ph > 7.5 ? "alkaline" : "close to neutral");
  const ocMeaning = (oc: number) => (oc < 1 ? "low organic matter" : oc < 2 ? "moderate organic matter" : "good organic matter");
  const salMeaning = (ds: number) => (ds < 2 ? "no salt problem" : ds < 4 ? "slightly salty" : "salty, hurts sensitive crops");
  const soilLoading = analysis.phase === "loading" || analysis.showingCache;

  // Only rows that have a value. "typical" rows use a default the farmer has not confirmed.
  type Row = { label: string; value: string; typical?: boolean };
  const rows: Row[] = [];
  if (field.areaHa !== null) rows.push({ label: "Area", value: formatAreaForLocale(field.areaHa, areaUnit, locale) });
  if (field.administrativeContext) {
    const admin = field.administrativeContext;
    rows.push({
      label: "Township",
      value: `${admin.TS}${admin.TS_MMR ? ` (${admin.TS_MMR})` : ""}, ${admin.ST}`,
    });
  }
  rows.push({ label: "Water", value: t.irrigation[field.irrigation], typical: !waterSetByFarmer });
  if (soilTexture) rows.push({ label: "Soil type", value: `${soilTexture}: ${textureMeaning(soilTexture)}` });
  if (soilPh) rows.push({ label: "Acidity", value: phMeaning(Number(soilPh)) });
  if (soilOc !== null) rows.push({ label: "Organic matter", value: ocMeaning(Number(soilOc)) });
  if (!soilTexture && !soilPh && soilOc === null) {
    rows.push({ label: "Soil", value: soilLoading ? "Retrieving soil profile…" : "Digital soil profile loading. You can enter local measurements" });
  }
  if (salinity !== null) rows.push({ label: "Soil salt", value: salMeaning(salinity) });
  rows.push({ label: "Top priority", value: topPriority ? t.profile.priority[topPriority] : "Balanced across water, soil and income", typical: !topPriority });
  rows.push({ label: "Equipment", value: primaryEquipment ?? "Hand tools", typical: !primaryEquipment });
  rows.push({ label: "Labour", value: labour ? t.profile.levels[labour] : "Typical household labour", typical: !labour });
  if (market) rows.push({ label: "Market", value: `${t.profile.levels[market]} access to buyers` });
  const typicalCount = rows.filter((r) => r.typical).length;

  // Where a reading here is a regional estimate that local knowledge or a test can refine.
  const showDryZoneRain = Boolean(annualRainMm) && isDryZone(regionId);
  const conditionCautions: string[] = [];
  if (soilTexture && !field.soilOverride) conditionCautions.push("Soil is a map estimate (ISRIC SoilGrids 250m). Local soil tests can be added in your farm profile.");

  const stats: { icon: "water" | "conditions" | "soil"; tone: string; label: string; value: string; note: string }[] = [];
  if (annualRainMm) stats.push({ icon: "water", tone: "text-water", label: "Annual rainfall", value: `${annualRainMm} mm`, note: wetSeason ? `Wettest ${wetSeason}` : "NASA POWER" });
  if (maxT !== null && minT !== null) stats.push({ icon: "conditions", tone: "text-heat", label: "Monthly high / low", value: `${Math.round(maxT)}° / ${Math.round(minT)}°C`, note: "NASA POWER" });
  if (soilTexture) stats.push({ icon: "soil", tone: "text-field", label: "Soil", value: `${soilTexture}${soilPh ? ` · pH ${soilPh}` : ""}`, note: soilSource });

  // Once crops are recorded, conditions shrink to one sentence; the cautions stay.
  const conditionsSentence = [
    annualRainMm ? `About ${annualRainMm} mm of rain a year${wetSeason ? `, wettest ${wetSeason}` : ""}.` : "",
    soilTexture ? `Soil: ${soilTexture}${soilPh ? `, pH ${soilPh}` : ""}.` : "",
  ].filter(Boolean).join(" ");
  const cautions = (
    <>
      {showDryZoneRain ? <DryZoneRainNote /> : null}
      {conditionCautions.length ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {conditionCautions.map((c) => (
            <li key={c} className="flex items-start gap-1.5 text-body-sm text-ink-muted">
              <Icon name="info" size={15} className="mt-0.5 shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

  return (
    <>
      <FieldPageHeader
        title={field.name}
        summary={field.administrativeContext
          ? `${field.administrativeContext.TS}, ${field.administrativeContext.ST}`
          : regionName ?? undefined}
      />

      {/* One plain answer, then the one next step. The step sits in the same place as on every screen. */}
      <Panel tone="field" radius="lg" className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold uppercase tracking-wider text-field">
            <Icon name={next.icon} size={16} />
            Next step
          </span>
          <h2 className="text-title text-ink">{next.title}</h2>
          <p className="max-w-measure text-body text-ink-muted">{next.body}</p>
        </div>
        {hasRotation ? (
          <p role="status" className="m-0 flex items-center gap-2 border-t border-line pt-3 text-body-sm text-ink-muted">
            <Icon name={analysis.phase === "ready" ? "success" : analysis.phase === "failed" ? "warning" : "time"} size={16} aria-hidden className="shrink-0 text-field" />
            <span>
              {analysis.phase === "ready"
                ? `${t.path.weatherReady}${(analysis.satelliteImageryPending ?? analysis.retrieving) ? `. ${t.path.satelliteLater}` : ""}`
                : analysis.phase === "failed"
                  ? t.path.weatherFailed
                  : analysis.slow
                    ? t.path.weatherSlow
                    : t.path.weatherChecking}
            </span>
          </p>
        ) : null}
        {hasRotation ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-line pt-1 text-body-sm text-ink-muted">
            <span>{optionalLeft > 0 ? t.path.answerReadyDetails(optionalLeft) : t.path.answerReadyOnly}</span>
            {optionalLeft > 0 ? (
              <Link href={profileHref} className="inline-flex min-h-tap items-center px-1 text-body-sm font-medium text-field underline underline-offset-4 hover:text-ink">
                {t.path.review}
              </Link>
            ) : null}
          </div>
        ) : null}
      </Panel>
      <FlowNav back={{ label: "My fields", href: "/" }} next={{ label: next.cta, href: next.href, icon: "go" }} />

      {/* Conditions is already a field tab; keep only the separate pest outlook task here. */}
      {rotation?.slots.length ? (
        <nav aria-label="More about this field" className="-mt-2 flex flex-wrap items-center gap-x-6 gap-y-0">
          <NavLink href={`/fields/${field.id}/pests`} icon="pest">
            {t.path.pestsLink}
          </NavLink>
        </nav>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Rotation */}
          <Panel as="section" aria-labelledby="overview-rotation" className="flex flex-col gap-3 p-4 sm:p-5">
            <PanelHeader
              id="overview-rotation"
              title="Current rotation"
              description={rotation ? `${rotation.cycleYears}-year cycle · ${plural(rotation.slots.length, "crop")}` : undefined}
              aside={
                <NavLink href={`/fields/${field.id}/rotation`} icon="rotation" className="-my-3">
                  {rotation ? "Edit crops" : "Add crops"}
                </NavLink>
              }
            />
            {rotation ? (
              <ol className="m-0 flex list-none flex-col divide-y divide-line/70 p-0">
                {rotation.slots.map((slot, index) => (
                  <li key={slot.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-baseline gap-2.5">
                      <span className="tabular font-mono text-body-sm text-ink-muted">{index + 1}</span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-ink">
                          {slotName(slot)}
                          {slot.variety ? <span className="font-normal text-ink-muted"> ({slot.variety})</span> : null}
                        </span>
                        <span className="text-body-sm text-ink-muted">
                          {formatSpan(slot.plantDate, slot.harvestDate)}
                          {slot.kind === "cover" ? " · Cover crop" : slot.residue === "retained" ? " · Residue retained" : ""}
                        </span>
                      </div>
                    </div>
                    <RiskChip hazard={slot.irrigated ? "water" : "neutral"} className="shrink-0 text-body-sm">
                      {slot.irrigated ? "Irrigated" : "Rainfed"}
                    </RiskChip>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="m-0 rounded-md bg-surface-sunken p-4 text-body text-ink-muted">
                No crops recorded yet.
              </p>
            )}
          </Panel>

          {/* Conditions: real retrieved values only. Full panel before crops are added, one sentence after. */}
          {hasRotation ? (
            conditionsSentence || showDryZoneRain || conditionCautions.length ? (
              <section aria-label="Local conditions" className="flex flex-col gap-2">
                {annualRainMm || soilPh ? (
                  <ul aria-label="Conditions at a glance" className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {annualRainMm ? (
                      <li>
                        <span className="inline-flex items-center gap-2 text-body-sm text-ink">
                          <Icon name="rain" size={18} className="text-water" />
                          Rain <BandChip band={bandRain(annualRainMm)} />
                        </span>
                      </li>
                    ) : null}
                    {soilPh ? (
                      <li>
                        <span className="inline-flex items-center gap-2 text-body-sm text-ink">
                          <Icon name="soil" size={18} className="text-soil" />
                          Soil acidity <BandChip band={bandPh(Number(soilPh))} />
                        </span>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {conditionsSentence ? <p className="m-0 max-w-measure text-body text-ink-muted">{conditionsSentence}</p> : null}
                {cautions}
              </section>
            ) : null
          ) : analysis.phase === "loading" && !conditions ? (
            <Skeleton className="h-24 w-full" />
          ) : stats.length > 0 ? (
            <Panel as="section" aria-labelledby="overview-conditions" className="flex flex-col gap-3 p-4 sm:p-5">
              <PanelHeader id="overview-conditions" title="Local conditions" />
              <dl className="m-0 grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {stats.map((st) => (
                  <div key={st.label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:px-4 sm:py-0 sm:first:pl-0 sm:last:pr-0">
                    <dt className="flex items-center gap-1.5 text-body-sm text-ink-muted">
                      <Icon name={st.icon} size={15} className={st.tone} />
                      {st.label}
                    </dt>
                    <dd className="m-0 font-mono text-headline text-ink">{st.value}</dd>
                    <dd className="m-0 text-body-sm text-ink-muted">{st.note}</dd>
                  </div>
                ))}
              </dl>
              {cautions}
              {analysis.showingCache ? <span className="text-body-sm text-ink-muted">Cached data</span> : null}
            </Panel>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Map + details */}
          <Panel as="section" aria-labelledby="overview-details" className="overflow-hidden">
            <Link
              href={boundaryHref}
              aria-label={boundaryLabel}
              className="group relative block bg-surface-sunken no-underline focus-visible:outline-field"
            >
              {MAPBOX_TOKEN ? (
                <Image
                  src={staticMapUrl(field.geometry, MAPBOX_TOKEN, 900, 320)}
                  alt=""
                  width={900}
                  height={320}
                  unoptimized
                  priority
                  className="h-40 w-full object-cover transition-transform group-hover:scale-[1.01]"
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-body-sm text-ink-muted">Map preview unavailable</div>
              )}
            </Link>
            <div className="flex flex-col gap-3 p-4 sm:p-5">
              <PanelHeader id="overview-details" title="Field details" />
              <dl className="m-0 flex flex-col divide-y divide-line">
                {rows.map((r) => (
                  <div key={r.label} className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-4 py-2 first:pt-0 last:pb-0">
                    <dt className="shrink-0 text-body-sm text-ink-muted">{r.label}</dt>
                    <dd className="m-0 flex flex-wrap items-baseline gap-x-2 text-left sm:justify-end sm:text-right text-body-sm">
                      <span className={`first-letter:uppercase ${r.typical ? "text-ink-muted" : "font-medium text-ink"}`}>{r.value}</span>
                      {r.typical ? <span className="text-body-sm text-ink-muted">({t.path.typical})</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
              {/* One line instead of a button on every assumed row */}
              <p className="m-0 flex flex-wrap items-center gap-x-3 border-t border-line pt-1 text-body-sm text-ink-muted">
                {typicalCount > 0 ? <span>{t.path.typicalFor(typicalCount)}</span> : null}
                <Link href={profileHref} className="inline-flex min-h-tap items-center px-1 text-body-sm font-medium text-field underline underline-offset-4 hover:text-ink">
                  {typicalCount > 0 ? t.path.review : t.path.editDetails}
                </Link>
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <JudgmentNote compact />

      {/* Field Options Disclosure */}
      <details className="border-t border-line pt-3 print:hidden">
        <summary className="min-h-tap cursor-pointer content-center text-body-sm text-ink-muted hover:text-ink">
          Field options
        </summary>
        <div className="flex flex-col gap-3 pb-3 pt-2">
          <dl className="m-0 flex flex-col gap-1 text-body-sm text-ink-muted">
            <div className="flex flex-wrap gap-x-2">
              <dt>Location</dt>
              <dd className="m-0 font-mono">{formatPoint(field.centroid)}</dd>
            </div>
            {field.administrativeContext ? (
              <div className="flex flex-wrap gap-x-2">
                <dt>Administrative context</dt>
                <dd className="m-0">
                  {field.administrativeContext.TS}, {field.administrativeContext.DT}, {field.administrativeContext.ST}
                </dd>
              </div>
            ) : null}
            {field.areaHa !== null ? (
              <div className="flex flex-wrap gap-x-2">
                <dt>Measured area</dt>
                <dd className="m-0">{field.areaHa.toFixed(2)} ha · {field.geometry.type === "Polygon" ? "drawn boundary" : "pin only"}</dd>
              </div>
            ) : null}
            {soilTexture || soilPh ? (
              <div className="flex flex-wrap gap-x-2">
                <dt>Soil source</dt>
                <dd className="m-0">{soilSource}</dd>
              </div>
            ) : null}
          </dl>
          <NavLink href={boundaryHref} icon="outline" className="self-start">
            {boundaryLabel}
          </NavLink>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" icon={field.archivedAt ? "restore" : "archive"} onClick={handleArchive}>
              {field.archivedAt ? "Restore field" : "Archive field"}
            </Button>
            <Button variant="destructive" icon="remove" onClick={() => setRemoveOpen(true)}>
              {t.overview.removeTitle}
            </Button>
          </div>
        </div>
      </details>

      {/* Delete Field Dialog */}
      <Dialog
        open={removeOpen}
        onClose={() => !removing && setRemoveOpen(false)}
        aria-labelledby="remove-dialog-title"
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              pb: "env(safe-area-inset-bottom)",
            },
          },
        }}
      >
        <DialogTitle id="remove-dialog-title" sx={{ fontWeight: 600 }}>
          {t.overview.removeTitle}
        </DialogTitle>
        <DialogContent>
          <p className="text-body text-ink">{t.overview.removePrompt(field.name)}</p>
          {removeError ? <Message tone="problem" role="alert" className="mt-4" title="Field removal failed">{removeError}</Message> : null}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button variant="secondary" onClick={() => setRemoveOpen(false)} disabled={removing}>
            {t.overview.removeCancel}
          </Button>
          <Button variant="primary" onClick={handleRemove} disabled={removing}>
            {t.overview.removeConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
