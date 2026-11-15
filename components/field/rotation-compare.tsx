"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { en } from "@/app/plan/messages";
import { SequenceEvidence, SequenceReasoning } from "@/components/field/sequence-reasoning";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { buildFieldRequest, lastKnownCrop } from "@/lib/rotation/field-request";
import { suggestPlanningWindow } from "@/lib/rotation/planning";
import { farmerReasons, statusText, temperatureScreenText, type EngineResult, type Scenario } from "@/lib/rotation/presentation";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import cropData from "@/rotation-engine/data/crops.json";

const names: Record<string, string> = Object.fromEntries(cropData.crops.map((crop) => [crop.id, en.crops[crop.id as keyof typeof en.crops] ?? crop.name]));
names.fallow = en.crops.fallow;

function Candidate({ scenario }: { scenario: Scenario }) {
  const reasons = farmerReasons(scenario);
  return <li className="rounded-md border border-line bg-surface-raised p-4 print:break-inside-avoid">
    <h3 className="m-0 text-headline text-ink">{scenario.proposed_crops.map((id) => names[id] ?? id).join(" → ")}</h3>
    <p className="mt-1 text-label text-ink">{statusText(scenario.status)}</p>
    {reasons.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-body-sm text-ink-muted">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
    <div className="mt-3"><SequenceReasoning steps={scenario.sequence_reasoning} names={names} /></div>
    <details className="mt-4 border-t border-line pt-2 text-body-sm">
      <summary className="min-h-tap cursor-pointer font-semibold text-field">{en.scientific}</summary>
      <p className="font-mono text-source text-ink-muted">Status: {scenario.status} · Priority comparison: not evaluated · Unevaluated criteria: {scenario.unsupported_priorities?.join(", ") || "none selected"}. No scientific score or best-crop rank is claimed.</p>
      <p className="text-body-sm text-ink-muted">Temperature screen: {temperatureScreenText(scenario.temperature_screen)}.</p>
      {scenario.stages.map((stage, index) => <p key={index}>{names[stage.crop_id] ?? stage.crop_id}: {stage.start}{stage.estimated_harvest ? ` to ${stage.estimated_harvest}` : " · harvest unknown"}</p>)}
      {([[en.limits, scenario.hard_constraints], [en.cautions, scenario.cautions], [en.missing, scenario.missing_information]] as const).map(([label, items]) => items.length > 0 && <div key={label}><strong>{label}</strong><ul className="list-disc pl-5">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>)}
      {scenario.observations_used.length > 0 && <div><strong>Monthly values used</strong><ul className="font-mono text-source">{scenario.observations_used.map((row, index) => <li key={index}>{row.month}: {row.temp_c ?? "unknown"} °C, {row.rain_mm ?? "unknown"} mm rain</li>)}</ul></div>}
      <SequenceEvidence steps={scenario.sequence_reasoning} />
      {scenario.evidence.map((item, index) => <p key={index}><a href={item.source} target="_blank" rel="noreferrer" className="text-field underline">{names[item.crop_id] ?? item.crop_id} crop evidence</a></p>)}
    </details>
  </li>;
}

export function RotationCompare({ fieldId, report = false, initialPlanning }: { fieldId: string; report?: boolean; initialPlanning?: { startDate: string; endDate: string } }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((item) => item.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const analysis = useFieldAnalysis(field);
  const [planning, setPlanning] = useState(() => initialPlanning ?? suggestPlanningWindow());
  const [answer, setAnswer] = useState<{ key: string; result: EngineResult | null; error: string } | null>(null);

  useEffect(() => { if (status === "idle") void load(); }, [status, load]);
  useEffect(() => { void loadRotations(fieldId); }, [fieldId, loadRotations]);

  const active = rotations[0];
  const built = useMemo(() => {
    if (!field || !active?.slots.length || !planning) return null;
    try { return { value: buildFieldRequest(field, active, analysis.conditions, planning, analysis.remote), error: "" }; }
    catch (caught) { return { value: null, error: caught instanceof Error ? caught.message : en.requestFailed }; }
  }, [field, active, analysis.conditions, analysis.remote, planning]);
  const requestKey = built?.value ? JSON.stringify(built.value.request) : "";
  const result = answer?.key === requestKey ? answer.result : null;
  const error = answer?.key === requestKey ? answer.error : "";
  const loading = !!requestKey && analysis.phase !== "loading" && answer?.key !== requestKey;

  useEffect(() => {
    if (!built?.value || analysis.phase === "loading") return;
    const controller = new AbortController();
    fetch("/api/rotation", { method: "POST", headers: { "Content-Type": "application/json" }, body: requestKey, signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? en.requestFailed); return body as EngineResult; })
      .then((body) => { if (!controller.signal.aborted) setAnswer({ key: requestKey, result: body, error: "" }); })
      .catch((caught) => { if (!controller.signal.aborted) setAnswer({ key: requestKey, result: null, error: caught instanceof Error ? caught.message : en.requestFailed }); });
    return () => controller.abort();
  }, [requestKey, analysis.phase, built]);

  if (status === "idle" || status === "loading") return <div role="status" aria-label="Loading field"><Skeleton className="h-12 w-64" /><Skeleton className="mt-4 h-48" /></div>;
  if (!field) return <EmptyState title="Field not found" body="This field is not saved in this browser."><Link href="/" className={buttonClass("primary")}>Back to fields</Link></EmptyState>;
  if (!active?.slots.length) return <EmptyState title="Add your previous crop" body="Record a crop on this field before screening what might follow it."><Link href={`/fields/${fieldId}/rotation`} className={buttonClass("primary")}>Add a crop</Link></EmptyState>;
  const eligible = result?.scenarios.filter((item) => item.status !== "infeasible") ?? [];
  const noPriorityEvidence = eligible.length > 0 && eligible.every((item) => !item.priority_coverage);
  const last = lastKnownCrop(active);
  return <main className="mx-auto max-w-5xl space-y-6 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
      <div><Link href={`/fields/${fieldId}/rotation`} className="text-body-sm text-field underline">← Field rotation</Link><h1 className="mt-2 text-display text-ink">{report ? "Next crop report" : "Explore your next crop"}</h1><p className="mt-2 text-body-sm text-ink-muted">{field.name} · Previous crop: {last?.label ?? "unknown"}</p></div>
      {report ? <button type="button" onClick={() => window.print()} className={buttonClass("primary", "print:hidden")}>Print report</button> : <Link href={`/fields/${fieldId}/report?start=${planning.startDate}&end=${planning.endDate}`} className={buttonClass("secondary")}>View report</Link>}
    </header>
    <p className="max-w-measure text-body text-ink-muted">Your saved field details and available NASA POWER history are used to screen the five crops covered by this engine. This compares possible <strong>next crops</strong>, not complete multi-year rotations.</p>
    {planning && <section className="rounded-md border border-line bg-surface-raised p-4"><h2 className="text-title">Next planting period</h2><p className="mt-1 text-body-sm text-ink-muted">Suggested from today’s date. Adjust to match your farm plan; this is not a planting forecast.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-label">Start planting around<input type="date" value={planning.startDate} onChange={(event) => setPlanning({ ...planning, startDate: event.target.value })} className="mt-1 min-h-tap w-full rounded-sm border border-line-strong bg-surface px-3" /></label><label className="text-label">Finish this crop by<input type="date" value={planning.endDate} onChange={(event) => setPlanning({ ...planning, endDate: event.target.value })} className="mt-1 min-h-tap w-full rounded-sm border border-line-strong bg-surface px-3" /></label></div></section>}
    {built?.error && <p role="alert" className="rounded-md border border-line p-4 text-body">{built.error}</p>}
    {error && <p role="alert" className="rounded-md border border-line p-4 text-body">{error}</p>}
    {loading && <p role="status" className="text-body-sm text-ink-muted">Screening crop options…</p>}
    {result && <section aria-live="polite"><h2 className="text-title">Crop options</h2><p className="mt-2 text-body-sm text-ink-muted">{result.scenario_count_total} options screened · {result.input_environment_basis === "historical_analogue" ? "NASA POWER temperature and IMERG rainfall from one past year, not a forecast" : result.input_environment_basis === "historical_normals" ? "NASA POWER historical monthly averages, not a forecast" : result.input_environment_basis === "synthetic" ? "Synthetic demonstration weather, not farm observations" : "Weather data unavailable; climate suitability is unknown"}</p>
      {result.input_variable_sources?.missing?.length ? <p className="mt-2 text-body-sm text-ink-muted">Some data is unavailable: {result.input_variable_sources.missing.join(" ")}</p> : null}
      {built?.value?.preferencesNotApplied.length ? <p className="mt-2 text-body-sm text-ink-muted">Your preferred crops ({built.value.preferencesNotApplied.join(", ")}) are saved but are not used for ranking by this engine. Excluded crops are respected.</p> : null}
      {built?.value?.historyNotApplied.length ? <p className="mt-2 text-body-sm text-ink-muted">Earlier recorded crops outside this five-crop model were not used: {built.value.historyNotApplied.join(", ")}.</p> : null}
      {built?.value?.unsupportedPriority && <p className="mt-2 text-body-sm text-ink-muted">Your “{built.value.unsupportedPriority}” priority is not scored by this engine. No priority ranking is claimed.</p>}
      {built?.value?.priorityMissing && <p className="mt-2 text-body-sm text-ink-muted">No main priority is saved for this field, so these options are not ranked to your goals.</p>}
      {noPriorityEvidence && <p className="mt-3 rounded-md border border-line bg-surface-raised p-3 text-body-sm">{en.noPriorityEvidence}</p>}
      <ol className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">{result.scenarios.map((scenario, index) => <Candidate key={`${scenario.proposed_crops.join("-")}-${index}`} scenario={scenario} />)}</ol>
      <p className="mt-5 text-body-sm text-ink-muted">{en.scope}</p>
      <details className="mt-5 border-t border-line pt-3 text-body-sm"><summary className="min-h-tap cursor-pointer font-semibold text-field">Scientific details and data source</summary><p>{result.input_environment_source ?? "No environmental source"}</p><p>Basis: {result.input_environment_basis ?? "unknown"}</p><p>Observation or forecast period: {result.input_observation_period ? `${result.input_observation_period.start_date} to ${result.input_observation_period.end_date}` : "unknown"}</p><p>Units: {result.input_environment_units ? `${result.input_environment_units.temp_c}, ${result.input_environment_units.rain_mm}` : "unverified"} · Spatial resolution: {result.input_spatial_resolution_km == null ? "unknown" : `${result.input_spatial_resolution_km} km`}</p>{result.input_variable_sources && <p>Temperature: {result.input_variable_sources.temperature}. Rainfall: {result.input_variable_sources.rainfall}{result.input_variable_sources.rainfall_period ? ` (${result.input_variable_sources.rainfall_period.start_date} to ${result.input_variable_sources.rainfall_period.end_date})` : ""}.</p>}{result.input_environment_context?.soil_ph_estimate && <p>SoilGrids estimated pH: {result.input_environment_context.soil_ph_estimate.value}, {result.input_environment_context.soil_ph_estimate.depth}, {result.input_environment_context.soil_ph_estimate.resolution}. Map estimate; not a measured field test.</p>}{result.input_environment_context?.smap && <p>SMAP regional root-zone moisture: {result.input_environment_context.smap.observations.length} valid daily observations, {result.input_environment_context.smap.missing_count} missing or invalid, {result.input_environment_context.smap.period.start_date} to {result.input_environment_context.smap.period.end_date}. Latest valid reading: {result.input_environment_context.smap.observations.at(-1)?.date ?? "none"}, {result.input_environment_context.smap.observations.at(-1)?.rootzone ?? "unknown"} {result.input_environment_context.smap.units}. {result.input_environment_context.smap.resolution}. Context only; not field water availability.</p>}<p>{result.ranking.status_note}</p><ul className="list-disc pl-5">{result.global_warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>
    </section>}
  </main>;
}
