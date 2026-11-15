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
import { FieldPageHeader } from "@/components/field/field-page-header";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { NavLink } from "@/components/ui/nav-link";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RiskChip } from "@/components/ui/risk-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { ScaleBadge } from "@/components/ui/status";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { copy } from "@/lib/copy/en";
import { REGIONS, regionOfPoint } from "@/lib/data/regions";
import { openQuickQuestions } from "@/lib/engine/questions";
import { formatPoint } from "@/lib/geo/format";
import { staticMapUrl } from "@/lib/geo/static-map";
import { formatSpan, plural, sequenceText, slotName, currentRotation } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import { DRY_ZONE_POWER_RAIN, WEATHER_CHECK, isDryZone } from "@/lib/validation/source-checks";


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
  const [detail, setDetail] = useState<"simple" | "technical">("simple");

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
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
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
      <EmptyState title="This field isn't saved in this browser" body="Fields are stored on the device where you added them.">
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

  const questions = openQuickQuestions(field);

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
    ? field.constraints.equipment.map((e) => copy.profile.equipment[e] ?? e).join(", ")
    : null;
  const topPriority = field.priorities?.order?.[0];
  const irrigationAmount = field.constraints?.irrigation?.amountMm;
  const labour = field.constraints?.labour;
  const market = field.constraints?.marketAccess;
  // Farm details saves constraints.irrigation only once the farmer answers; field.irrigation alone is the default.
  const waterSetByFarmer = Boolean(field.constraints?.irrigation);

  const setup = [
    { label: "Boundary", done: hasBoundary, href: boundaryHref },
    { label: "Rotation", done: hasRotation, href: `/fields/${field.id}/rotation` },
    { label: "Soil test", done: isSoilTested, href: `/fields/${field.id}/profile` },
    { label: "Farm profile", done: Boolean(topPriority || labour || primaryEquipment), href: `/fields/${field.id}/profile` },
  ];
  const doneCount = setup.filter((s) => s.done).length;

  const next = !rotation
    ? { title: "Record what you grow now", body: "Tap the crops you grow.", href: `/fields/${field.id}/rotation`, cta: "Add my crops", icon: "rotation" as const }
    : { title: "Your answer is ready", body: `See how ${sequenceText(rotation, " then ")} compares with other plans for this field.`, href: `/fields/${field.id}/compare`, cta: "See my answer", icon: "compare" as const };

  const handleRemove = async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      await remove(field.id);
      setRemoveOpen(false);
      router.push("/");
    } catch {
      setRemoveError(copy.overview.removeError);
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
  const soilWho = field.soilOverride ? "your test" : "satellite estimate";

  const textureMeaning = (t: string) =>
    /sand/.test(t) && !/clay/.test(t) ? "drains fast, holds little water"
    : /clay/.test(t) && !/loam/.test(t) ? "holds water, drains slowly"
    : "balanced, holds water and drains";
  const phMeaning = (ph: number) => (ph < 5.5 ? "acidic" : ph > 7.5 ? "alkaline" : "close to neutral");
  const ocMeaning = (oc: number) => (oc < 1 ? "low organic matter" : oc < 2 ? "moderate organic matter" : "good organic matter");
  const salMeaning = (ds: number) => (ds < 2 ? "no salt problem" : ds < 4 ? "slightly salty" : "salty, hurts sensitive crops");

  type Row = { label: string; simple: string; technical: string; hint?: string };
  const rows: Row[] = [
    {
      label: "Area",
      simple: field.areaHa === null ? "" : `${field.areaHa.toFixed(1)} ha (${(field.areaHa * 2.471).toFixed(1)} acres)`,
      technical: field.areaHa === null ? "" : `${field.areaHa.toFixed(2)} ha · ${field.geometry.type}`,
      hint: "Draw the boundary to measure it",
    },
    {
      label: "Region",
      simple: regionName ?? "",
      technical: regionName ? `${regionName} · ${formatPoint(field.centroid)}` : "",
      hint: "Outside the regions covered so far",
    },
    {
      label: "Water",
      simple: `${copy.irrigation[field.irrigation]}${waterSetByFarmer ? "" : " (assumed)"}`,
      technical: `${copy.irrigation[field.irrigation]}${irrigationAmount ? ` · ${irrigationAmount} mm/season` : ""} · ${waterSetByFarmer ? "set by you" : "default, not asked yet"}`,
    },
    {
      label: "Soil type",
      simple: soilTexture ? `${soilTexture}: ${textureMeaning(soilTexture)}` : "",
      technical: soilTexture ? `${soilTexture} (USDA) · ${soilWho}` : "",
      hint: (analysis.phase === "loading" || analysis.showingCache) ? "Loading from soil map…" : "Soil map unavailable right now. Add a test result",
    },
    {
      label: "Acidity",
      simple: soilPh ? `${phMeaning(Number(soilPh))}` : "",
      technical: soilPh ? `pH ${soilPh} · ${soilWho}` : "",
      hint: (analysis.phase === "loading" || analysis.showingCache) ? "Loading from soil map…" : "Soil map unavailable right now. Add a test result",
    },
    {
      label: "Organic matter",
      simple: soilOc !== null ? ocMeaning(Number(soilOc)) : "",
      technical: soilOc !== null ? `SOC ${Number(soilOc).toFixed(1)}% · ${soilWho}` : "",
      hint: (analysis.phase === "loading" || analysis.showingCache) ? "Loading from soil map…" : "Soil map unavailable right now. Add a test result",
    },
    {
      label: "Soil salt",
      simple: salinity !== null ? salMeaning(salinity) : "Not measured. Satellites can't see salt",
      technical: salinity !== null ? `EC ${salinity} dS/m · ${field.soilOverride ? "your test" : "recorded"}` : "EC unknown · no satellite layer, test strip needed",
    },
    {
      label: "Top priority",
      simple: topPriority ? copy.profile.priority[topPriority] : "Balanced across water, soil and income (assumed)",
      technical: topPriority ? `${copy.profile.priority[topPriority]} · ranked 1 of ${field.priorities?.order?.length ?? 1}` : "Equal weights (assumed, not asked yet)",
    },
    {
      label: "Equipment",
      simple: primaryEquipment ?? "Hand tools (assumed)",
      technical: primaryEquipment ?? "Default: hand tools",
    },
    {
      label: "Labour",
      simple: labour ? copy.profile.levels[labour] : "Typical household labour (assumed)",
      technical: labour ? `${copy.profile.levels[labour]} (set by you)` : "Default: household labour",
    },
    {
      label: "Market",
      simple: market ? `${copy.profile.levels[market]} access to buyers` : "",
      technical: market
        ? `${copy.profile.levels[market]} market access (set by you)${field.constraints?.canSell?.length ? ` · buyer known for ${field.constraints.canSell.length} ${field.constraints.canSell.length === 1 ? "crop" : "crops"}` : ""}`
        : "",
      hint: "Not asked yet. Add it in farm details",
    },
  ];

  // Where a reading here is a guess that local knowledge or a test should settle.
  const conditionCautions: string[] = [];
  if (annualRainMm && isDryZone(regionId)) conditionCautions.push(`Rain here is probably higher than shown: NASA's figure was about ${Math.round(Math.abs(DRY_ZONE_POWER_RAIN.relBias) * 100)}% below the ${DRY_ZONE_POWER_RAIN.station} weather station (${WEATHER_CHECK.period}).`);
  if (soilTexture && !field.soilOverride) conditionCautions.push("Soil is a map estimate. A soil test from the township agriculture office would settle it.");

  const stats: { icon: "water" | "conditions" | "soil"; tone: string; label: string; value: string; note: string }[] = [];
  if (annualRainMm) stats.push({ icon: "water", tone: "text-water", label: "Annual rainfall", value: `${annualRainMm} mm`, note: wetSeason ? `Wettest ${wetSeason}` : "NASA POWER" });
  if (maxT !== null && minT !== null) stats.push({ icon: "conditions", tone: "text-heat", label: "Monthly high / low", value: `${Math.round(maxT)}° / ${Math.round(minT)}°C`, note: "NASA POWER" });
  if (soilTexture) stats.push({ icon: "soil", tone: "text-field", label: "Soil", value: `${soilTexture}${soilPh ? ` · pH ${soilPh}` : ""}`, note: soilSource });

  return (
    <>
      <FieldPageHeader
        title={field.name}
        summary={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">{formatPoint(field.centroid)}</span>
            {regionName ? (
              <>
                <span aria-hidden className="text-line-strong">•</span>
                <span>{regionName}</span>
              </>
            ) : null}
            <span aria-hidden className="text-line-strong">•</span>
            <ScaleBadge scale={hasBoundary ? "field" : "village"} />
          </span>
        }
        action={
          <Link href={boundaryHref} className={buttonClass("secondary", "gap-1.5")}>
            <Icon name="outline" size={16} />
            <span>{boundaryLabel}</span>
          </Link>
        }
      />

      {/* Next step + setup progress */}
      <Panel tone="field" radius="lg" className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-source font-medium uppercase tracking-wide text-ink-muted">Next step</span>
            <h2 className="text-headline text-ink">{next.title}</h2>
            <p className="max-w-measure text-body text-ink-muted">{next.body}</p>
          </div>
          <Link href={next.href} className={buttonClass("primary", "w-full sm:w-auto justify-center")}>
            <Icon name={next.icon} />
            <span>{next.cta}</span>
          </Link>
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex items-center justify-between text-body-sm text-ink-muted">
            <span>Field setup</span>
            <span className="tabular">
              {hasRotation
                ? doneCount === setup.length
                  ? "All done"
                  : `Answer ready · ${setup.length - doneCount} optional ${setup.length - doneCount === 1 ? "detail" : "details"} would sharpen it`
                : `${doneCount} of ${setup.length} done`}
            </span>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-2 p-0 sm:grid-cols-4">
            {setup.map((s) => (
              <li key={s.label} className="flex flex-col gap-1.5">
                <span aria-hidden className={`h-1.5 rounded-full ${s.done ? "bg-field" : "bg-line"}`} />
                <Link href={s.href} className="-my-2.5 inline-flex min-h-tap items-center gap-1 text-body-sm text-ink no-underline hover:underline">
                  <span aria-hidden className={s.done ? "text-field" : "text-ink-muted"}>{s.done ? "✓" : "○"}</span>
                  <span>{s.label}</span>
                  <span className="sr-only">{s.done ? "(done)" : "(not done)"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      {questions.length > 0 ? (
        <Link
          href={questions[0].href}
          className="flex min-h-tap items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-label text-ink no-underline hover:border-line-strong"
        >
          <span>{copy.compare.sharpen(questions.length)}</span>
          <Icon name="next" size={16} className="shrink-0 text-field" />
        </Link>
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
              <ol className="m-0 flex list-none flex-col divide-y divide-line p-0">
                {rotation.slots.map((slot, index) => (
                  <li key={slot.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-baseline gap-2.5">
                      <span className="tabular font-mono text-body-sm text-ink-muted">{index + 1}</span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-ink">
                          {slotName(slot)}
                          {slot.variety ? <span className="font-normal text-ink-muted"> ({slot.variety})</span> : null}
                        </span>
                        <span className="text-source text-ink-muted">
                          {formatSpan(slot.plantDate, slot.harvestDate)}
                          {slot.kind === "cover" ? " · Cover crop" : slot.residue === "retained" ? " · Residue retained" : ""}
                        </span>
                      </div>
                    </div>
                    <RiskChip hazard={slot.irrigated ? "water" : "neutral"} className="shrink-0 text-source">
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
            {rotation?.slots.length ? (
              <div className="-mb-2 border-t border-line pt-1">
                <NavLink href={`/fields/${field.id}/pests`} icon="pest">
                  Pests and diseases
                </NavLink>
              </div>
            ) : null}
          </Panel>

          {/* Conditions: real retrieved values only */}
          {analysis.phase === "loading" && !conditions ? (
            <Skeleton className="h-24 w-full" />
          ) : stats.length > 0 ? (
            <Panel as="section" aria-labelledby="overview-conditions" className="flex flex-col gap-3 p-4 sm:p-5">
              <PanelHeader
                id="overview-conditions"
                title="Local conditions"
              />
              <dl className="m-0 grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {stats.map((s) => (
                  <div key={s.label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:px-4 sm:py-0 sm:first:pl-0 sm:last:pr-0">
                    <dt className="flex items-center gap-1.5 text-body-sm text-ink-muted">
                      <Icon name={s.icon} size={15} className={s.tone} />
                      {s.label}
                    </dt>
                    <dd className="m-0 font-mono text-headline text-ink">{s.value}</dd>
                    <dd className="m-0 text-source text-ink-muted">{s.note}</dd>
                  </div>
                ))}
              </dl>
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
              <div className="-mb-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-1">
                <NavLink href={`/fields/${field.id}/conditions`} icon="conditions">
                  Weather and soil
                </NavLink>
                {analysis.showingCache ? <span className="text-source text-ink-muted">Cached data</span> : null}
              </div>
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
              <PanelHeader
                id="overview-details"
                title="Field details"
                aside={
                  <NavLink href={`/fields/${field.id}/profile`} icon="profile" className="-my-3">
                    Edit details
                  </NavLink>
                }
              />
              <div role="group" aria-label="Detail level" className="inline-flex self-start rounded-md border border-line bg-surface-sunken p-0.5 text-body-sm">
                {(["simple", "technical"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={detail === m}
                    onClick={() => setDetail(m)}
                    className={`min-h-8 rounded px-3 capitalize ${detail === m ? "bg-surface-raised font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <dl className="m-0 flex flex-col divide-y divide-line">
                {rows.map((r) => {
                  const value = detail === "simple" ? r.simple : r.technical;
                  return (
                    <div key={r.label} className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-4 py-2 first:pt-0 last:pb-0">
                      <dt className="shrink-0 text-body-sm text-ink-muted">{r.label}</dt>
                      <dd className={`m-0 text-left sm:text-right text-body-sm first-letter:uppercase ${value ? "font-medium text-ink" : "text-ink-muted"}`}>
                        {value || r.hint}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </Panel>

          <NavLink href={`/fields/${field.id}/report`} icon="report" className="self-start">
            Printable report
          </NavLink>
        </div>
      </div>

      <JudgmentNote compact />

      {/* Field Options Disclosure */}
      <details className="border-t border-line pt-3 print:hidden">
        <summary className="min-h-tap cursor-pointer content-center text-label text-ink-muted hover:text-ink">
          Field options
        </summary>
        <div className="flex flex-wrap items-center gap-3 pb-3 pt-2">
          <Button variant="secondary" icon={field.archivedAt ? "restore" : "archive"} onClick={handleArchive}>
            {field.archivedAt ? "Restore field" : "Archive field"}
          </Button>
          <Button variant="destructive" icon="remove" onClick={() => setRemoveOpen(true)}>
            {copy.overview.removeTitle}
          </Button>
        </div>
      </details>

      {/* Delete Field Dialog */}
      <Dialog
        open={removeOpen}
        onClose={() => !removing && setRemoveOpen(false)}
        aria-labelledby="remove-dialog-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="remove-dialog-title" sx={{ fontWeight: 600 }}>
          {copy.overview.removeTitle}
        </DialogTitle>
        <DialogContent>
          <p className="text-body text-ink">{copy.overview.removePrompt(field.name)}</p>
          {removeError ? <Message tone="problem" role="alert" className="mt-4" title="Field removal failed">{removeError}</Message> : null}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button variant="secondary" onClick={() => setRemoveOpen(false)} disabled={removing}>
            {copy.overview.removeCancel}
          </Button>
          <Button variant="primary" onClick={handleRemove} disabled={removing}>
            {copy.overview.removeConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
