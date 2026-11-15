"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import cropData from "@/rotation-engine/data/crops.json";
import dryZone from "@/rotation-engine/examples/dryzone_demo.json";
import delta from "@/rotation-engine/examples/ayeyarwady_demo.json";
import { en } from "@/lib/rotation/plan-messages";
import { SequenceEvidence, SequenceReasoning } from "@/components/field/sequence-reasoning";
import { farmerReasons, statusText, temperatureScreenText, type EngineResult, type Scenario } from "@/lib/rotation/presentation";
import type { FarmerRequest, Irrigation, Priority } from "@/lib/rotation/farmer-request";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { buildLocationRequest, unsavedLocationField } from "@/lib/rotation/explorer-request";
import { buildFieldRequest, engineCropId, fieldPriority, lastKnownCrop } from "@/lib/rotation/field-request";
import { useFieldsStore } from "@/lib/store/fields-store";

type Place = { id: string; kind: "demo" | "farm"; label: string; lat?: number; lon?: number };
type ExplorerResponse = { environment: { state: "demo" | "connected" | "unavailable"; note: string }; recommendation: EngineResult; historyNotApplied?: string[] };

const cropNames: Record<string, string> = Object.fromEntries(cropData.crops.map((crop) => [crop.id, en.crops[crop.id as keyof typeof en.crops] || crop.name]));
cropNames.fallow = en.crops.fallow;

const demoPlaces: Place[] = [
  { id: "dryzone", kind: "demo", label: en.demoPlaces.dryzone, lat: dryZone.location.lat, lon: dryZone.location.lon },
  { id: "delta", kind: "demo", label: en.demoPlaces.delta, lat: delta.location.lat, lon: delta.location.lon },
];

function OptionCard({ scenario }: { scenario: Scenario }) {
  const reasons = farmerReasons(scenario);
  return (
    <article className="border-t border-line py-5">
      <h3 className="text-headline">{scenario.proposed_crops.map((id) => cropNames[id] || id).join(" → ")}</h3>
      <p className="mt-1 font-semibold text-ink">{statusText(scenario.status)}</p>
      <h4 className="mt-3 font-semibold">{en.checkNext}</h4>
      <ul className="mt-2 space-y-2 text-body-sm text-ink-muted">
        {reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <div className="mt-4">
        <h4 className="font-semibold">{en.why}</h4>
        <div className="mt-2"><SequenceReasoning steps={scenario.sequence_reasoning} names={cropNames} /></div>
      </div>
      <details className="mt-4 rounded-md border border-line bg-surface-raised p-3 text-body-sm">
        <summary className="min-h-tap cursor-pointer py-2 font-semibold text-field">{en.scientific}</summary>
        <div className="space-y-4 pb-2 text-ink-muted">
          <p className="font-mono text-source">Status: {scenario.status} · Priority comparison: not evaluated · Unevaluated criteria: {scenario.unsupported_priorities?.join(", ") || "none selected"}. No scientific score or best-crop rank is claimed.</p>
          <p>Temperature screen: {temperatureScreenText(scenario.temperature_screen)}.</p>
          {scenario.stages.map((stage, index) => <p key={index}><strong className="text-ink">{cropNames[stage.crop_id] || stage.crop_id}</strong> · {stage.start}{stage.estimated_harvest ? ` to ${stage.estimated_harvest}` : " · harvest date unknown"}</p>)}
          {([
            [en.limits, scenario.hard_constraints], [en.cautions, scenario.cautions], [en.missing, scenario.missing_information],
          ] as const).map(([heading, items]) => items.length > 0 && <div key={heading}><strong className="text-ink">{heading}</strong><ul className="mt-1 list-disc space-y-1 pl-5">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>)}
          <div><strong className="text-ink">Engine explanation</strong><ul className="mt-1 list-disc space-y-1 pl-5">{scenario.explanations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
          <SequenceEvidence steps={scenario.sequence_reasoning} />
          {scenario.observations_used.length > 0 && <div><strong className="text-ink">Monthly values used</strong><ul className="mt-1 space-y-1 font-mono text-source">{scenario.observations_used.map((row, index) => <li key={index}>{row.month} · {row.temp_c ?? "unknown"}°C · {row.rain_mm ?? "unknown"} mm rain</li>)}</ul></div>}
          {scenario.evidence.map((item, index) => <p key={index}><a href={item.source} target="_blank" rel="noreferrer" className="text-field underline underline-offset-4">{cropNames[item.crop_id] || item.crop_id} {en.evidence}</a></p>)}
        </div>
      </details>
    </article>
  );
}

export default function RotationExplorer({ suggestedWindow }: { suggestedWindow: { startDate: string; endDate: string } }) {
  const searchParams = useSearchParams();
  const requestedFieldId = searchParams.get("fieldId");
  const savedFields = useFieldsStore((state) => state.fields);
  const rotations = useFieldsStore((state) => state.rotations);
  const storeStatus = useFieldsStore((state) => state.status);
  const loadFields = useFieldsStore((state) => state.load);
  const [entry, setEntry] = useState<"new" | "saved">(requestedFieldId ? "saved" : "new");
  const [savedFieldId, setSavedFieldId] = useState(requestedFieldId ?? "");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [searchText, setSearchText] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searchMode, setSearchMode] = useState<"demo_only" | "connected" | null>(null);
  const [searching, setSearching] = useState(false);
  const [previousCrop, setPreviousCrop] = useState("");
  const [irrigation, setIrrigation] = useState<Irrigation>("sometimes");
  const [priority, setPriority] = useState<Priority>("balanced");
  const [planning, setPlanning] = useState(suggestedWindow);
  const [soilPh, setSoilPh] = useState("");
  const [drainage, setDrainage] = useState<"unknown" | "well" | "moderate" | "poor">("unknown");
  const [equipment, setEquipment] = useState("");
  const [availableCrops, setAvailableCrops] = useState<string[]>(cropData.crops.map((crop) => crop.id));
  const [result, setResult] = useState<ExplorerResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const savedField = savedFields.find((field) => field.id === savedFieldId);
  const savedRotation = savedField ? rotations[savedField.id]?.[0] : undefined;
  const temporaryField = useMemo(() => selectedPlace ? unsavedLocationField({ kind: selectedPlace.kind, label: selectedPlace.label, lat: selectedPlace.lat, lon: selectedPlace.lon }, irrigation) : null, [selectedPlace, irrigation]);
  const activeField = entry === "saved" ? savedField : temporaryField ?? undefined;
  const analysis = useFieldAnalysis(activeField);
  const dataPending = Boolean(activeField && analysis.conditions?.fieldId !== activeField.id && analysis.phase !== "failed");

  useEffect(() => { if (storeStatus === "idle") void loadFields(); }, [storeStatus, loadFields]);

  function chooseSavedField(id: string) {
    const field = savedFields.find((item) => item.id === id);
    setSavedFieldId(id);
    setEntry("saved");
    setResult(null);
    setError("");
    if (!field) return;
    const last = rotations[id]?.[0] ? lastKnownCrop(rotations[id][0]) : null;
    setPreviousCrop(last ? engineCropId(last.id) ?? "" : "");
    setIrrigation((field.constraints?.irrigation?.access ?? field.irrigation) === "full" ? "yes" : (field.constraints?.irrigation?.access ?? field.irrigation) === "none" ? "no" : "sometimes");
    setPriority(fieldPriority(field) ?? "balanced");
    const ph = field.soilObservations?.filter((item) => item.property === "ph" && typeof item.value === "number" && ["laboratory", "field-kit"].includes(item.method)).sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? field.soilOverride?.ph;
    setSoilPh(typeof ph === "number" ? String(ph) : "");
    const drainage = field.soilObservations?.filter((item) => item.property === "drainage" && ["well", "moderate", "poor"].includes(String(item.value))).sort((a, b) => b.date.localeCompare(a.date))[0]?.value;
    setDrainage(drainage === "well" || drainage === "moderate" || drainage === "poor" ? drainage : "unknown");
    setAvailableCrops(cropData.crops.map((crop) => crop.id).filter((id) => !field.constraints?.excludedCropIds?.some((excluded) => engineCropId(excluded) === id)));
  }

  useEffect(() => {
    const id = requestedFieldId;
    let cancelled = false;
    if (id && storeStatus === "ready" && savedFields.some((field) => field.id === id)) {
      queueMicrotask(() => { if (!cancelled) chooseSavedField(id); });
    }
    // Run after the saved fields are loaded; later form changes must not be reset.
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeStatus, requestedFieldId]);

  function choosePlace(place: Place) {
    setSelectedPlace(place);
    setSearchText(place.label);
    setPlaces([]);
    setResult(null);
    setError("");
    if (place.kind === "demo") {
      const demo = place.id === "dryzone" ? dryZone : delta;
      setPlanning({ startDate: demo.planning.start_date, endDate: demo.planning.end_date });
    } else {
      setPlanning(suggestedWindow);
    }
  }

  async function searchPlaces(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchText.trim()) return;
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/locations?q=${encodeURIComponent(searchText.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || en.noPlaces);
      setSearchMode(data.mode);
      setPlaces(data.locations);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : en.noPlaces);
    } finally {
      setSearching(false);
    }
  }

  function usePosition() {
    if (!navigator.geolocation) {
      setError(en.locationPermission);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => choosePlace({ id: "current", kind: "farm", label: en.positionLabel, lat: position.coords.latitude, lon: position.coords.longitude }),
      () => setError(en.locationPermission),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (entry === "new" && !selectedPlace) { setError(en.chooseLocation); return; }
    if (entry === "saved" && !savedField) { setError("Choose one of your saved farms first."); return; }
    if (entry === "saved" && !savedRotation) { setError("Record the previous crop in this saved farm before comparing."); return; }
    if (!previousCrop) { setError("Choose the crop last grown on this field."); return; }
    if (!availableCrops.length) { setError(en.chooseAvailableCrop); return; }
    const payload: FarmerRequest = {
      location: entry === "saved" && savedField
        ? { kind: "farm", label: savedField.name, lat: savedField.centroid[1], lon: savedField.centroid[0] }
        : { kind: selectedPlace!.kind, label: selectedPlace!.label, lat: selectedPlace!.lat, lon: selectedPlace!.lon, ...(selectedPlace!.kind === "demo" ? { demoId: selectedPlace!.id as "dryzone" | "delta" } : {}) },
      previousCrop,
      irrigation,
      priority,
      planning,
      advanced: { soilPh: soilPh === "" ? null : Number(soilPh), drainage, equipment, availableCrops },
    };
    setLoading(true);
    try {
      const demo = payload.location.kind === "demo";
      const savedBuilt = !demo && entry === "saved" && savedField && savedRotation
        ? buildFieldRequest(savedField, savedRotation, analysis.conditions, planning, analysis.remote, payload) : null;
      const engineRequest = demo ? null : savedBuilt
        ? savedBuilt.request
        : buildLocationRequest(payload, analysis.conditions, analysis.remote);
      const response = await fetch(demo ? "/api/rotation/explore" : "/api/rotation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(demo ? payload : engineRequest) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || en.requestFailed);
      const recommendation = demo ? data.recommendation as EngineResult : data as EngineResult;
      setResult({ environment: demo ? data.environment : {
        state: recommendation.input_environment_basis === "synthetic" ? "demo" : recommendation.input_environment_basis ? "connected" : "unavailable",
        note: recommendation.input_environment_basis === "historical_analogue"
          ? "POWER temperature and IMERG rainfall from one past year. These are not a forecast."
          : recommendation.input_environment_basis === "historical_normals"
            ? "NASA POWER historical monthly averages around this location. These are not a forecast."
            : "Weather data is unavailable. Climate checks remain unknown; no demonstration values were substituted.",
      }, recommendation, historyNotApplied: savedBuilt?.historyNotApplied });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : en.requestFailed);
    } finally {
      setLoading(false);
    }
  }

  const eligible = result?.recommendation.scenarios.filter((scenario) => scenario.status !== "infeasible") || [];
  const noPriorityEvidence = eligible.length > 0 && eligible.every((scenario) => !scenario.priority_coverage);

  return (
    <section className="w-full space-y-6 pb-10" aria-labelledby="rotation-explorer-heading">
      <header className="border-b border-line pb-5">
        <Link href="/plan" className="inline-flex min-h-tap items-center text-body-sm font-semibold text-field underline underline-offset-4">← Back to Plan</Link>
        <h1 id="rotation-explorer-heading" className="mt-2 max-w-3xl text-display">{en.title}</h1>
        <p className="mt-3 max-w-measure text-ink-muted">{en.intro}</p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Choose how to start">
        <button type="button" aria-pressed={entry === "new"} onClick={() => { setEntry("new"); setResult(null); setError(""); }} className={`min-h-tap rounded-md border px-4 text-label ${entry === "new" ? "border-field bg-field-soft text-field" : "border-line-strong bg-surface-raised text-ink"}`}>Select a new location</button>
        <button type="button" aria-pressed={entry === "saved"} onClick={() => { setEntry("saved"); setResult(null); setError(""); }} className={`min-h-tap rounded-md border px-4 text-label ${entry === "saved" ? "border-field bg-field-soft text-field" : "border-line-strong bg-surface-raised text-ink"}`}>Select a saved farm</button>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:gap-12">
        <div>
          {entry === "saved" && <section aria-labelledby="saved-heading" className="border-b border-line pb-8">
            <h2 id="saved-heading" className="text-title">Your saved farms</h2>
            <label className="mt-4 block font-semibold">Farm<select value={savedFieldId} onChange={(event) => chooseSavedField(event.target.value)} className="mt-2 min-h-tap w-full rounded-sm border border-line-strong bg-surface-raised px-3 text-body"><option value="">Choose a saved farm</option>{savedFields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
            {storeStatus === "loading" && <p role="status" className="mt-2 text-body-sm text-ink-muted">Loading your saved farms…</p>}
            {storeStatus === "error" && <p role="alert" className="mt-2 text-body-sm text-ink-muted">Saved farms could not be read in this browser. Check site storage, or select a new location.</p>}
            {storeStatus === "ready" && !savedFields.length && <p className="mt-2 text-body-sm text-ink-muted">No saved farms yet. Select a new location above, or <Link href="/fields/new" className="text-field underline">save a farm</Link>.</p>}
            {storeStatus === "ready" && savedFieldId && !savedField && <p role="alert" className="mt-2 text-body-sm text-ink-muted">This saved farm is not in this browser. Choose another farm or select a new location.</p>}
            {savedField && <p className="mt-3 text-body-sm text-ink-muted">Using the recorded crop history and field measurements for {savedField.name}. You can adjust the simple choices below for this comparison.</p>}
            {savedField?.priorities?.order[0] && !fieldPriority(savedField) && <p className="mt-2 text-body-sm text-ink-muted">The saved “{savedField.priorities.order[0]}” priority is outside this Explorer’s choices. Choose a priority below; no crop ranking is claimed.</p>}
            {savedField && !savedRotation && <p className="mt-2 text-body-sm text-ink-muted">No crop history is recorded yet. <Link href={`/fields/${savedField.id}/rotation`} className="text-field underline">Record a crop</Link> before comparing this farm.</p>}
          </section>}
          {entry === "new" && <section aria-labelledby="location-heading" className="border-b border-line pb-8">
            <h2 id="location-heading" className="text-title">{en.location}</h2>
            <form onSubmit={searchPlaces} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="place-search">{en.location}</label>
              <input id="place-search" type="search" value={searchText} onChange={(event) => { setSearchText(event.target.value); setSelectedPlace(null); setResult(null); }} placeholder={en.searchPlaceholder} className="min-h-tap min-w-0 w-full flex-1 rounded-sm border border-line-strong bg-surface-raised px-3 text-body" />
              <button type="submit" disabled={searching} className="min-h-tap rounded-md border border-line-strong px-4 font-semibold hover:bg-field-soft disabled:opacity-60">{searching ? en.searching : en.search}</button>
            </form>
            {searchMode === "demo_only" && <p className="mt-2 text-body-sm text-ink-muted">{en.demoOnly}</p>}
            {places.length > 0 && <ul className="mt-3 divide-y divide-line border-y border-line">{places.map((place) => <li key={place.id}><button type="button" onClick={() => choosePlace(place)} className="min-h-tap w-full py-3 text-left font-medium text-field">{place.label}{place.kind === "demo" ? " · demo" : ""}</button></li>)}</ul>}
            {places.length === 0 && searchMode === "connected" && <p className="mt-2 text-body-sm text-ink-muted">{en.noPlaces}</p>}
            {searchMode === "demo_only" && searchText.trim() && !places.length && !selectedPlace && <button type="button" onClick={() => choosePlace({ id: "name-only", kind: "farm", label: searchText.trim() })} className="mt-3 min-h-tap text-left font-semibold text-field underline underline-offset-4">{en.useNameOnly}: “{searchText.trim()}”</button>}
            <button type="button" onClick={usePosition} className="mt-4 min-h-tap font-semibold text-field underline underline-offset-4">{en.usePosition}</button>
            <p className="mt-5 text-body-sm text-ink-muted">{en.demoPlacesPrompt}</p>
            <div className="mt-2 flex flex-wrap gap-2">{demoPlaces.map((place) => <button key={place.id} type="button" onClick={() => choosePlace(place)} className="min-h-tap rounded-md border border-line-strong bg-surface-raised px-3 text-label hover:bg-field-soft">{place.label}</button>)}</div>
            {selectedPlace && <p className="mt-4 rounded-md bg-field-soft p-3 text-body-sm"><strong>{en.selected}:</strong> {selectedPlace.label}{selectedPlace.kind === "demo" ? ` · ${en.demoData}` : selectedPlace.lat === undefined ? ` · ${en.positionUnmapped}` : ` · ${en.locationMatched}`}</p>}
          </section>}

          <form onSubmit={compare} className="space-y-8 pt-8">
            <section className="space-y-5">
              <label className="block font-semibold">{en.previousCrop}<select required value={previousCrop} onChange={(event) => { setPreviousCrop(event.target.value); setResult(null); }} className="mt-2 min-h-tap w-full rounded-sm border border-line-strong bg-surface-raised px-3 text-body"><option value="">{en.chooseCrop}</option>{cropData.crops.map((crop) => <option key={crop.id} value={crop.id}>{cropNames[crop.id]}</option>)}</select></label>
              <fieldset><legend className="font-semibold">{en.irrigation}</legend><div className="mt-3 flex flex-wrap gap-2">{([ ["yes", en.yes], ["no", en.no], ["sometimes", en.sometimes] ] as const).map(([value, label]) => <label key={value} className={`flex min-h-tap items-center gap-2 rounded-md border px-4 text-label ${irrigation === value ? "border-field bg-field-soft" : "border-line-strong bg-surface-raised"}`}><input type="radio" name="irrigation" value={value} checked={irrigation === value} onChange={() => { setIrrigation(value); setResult(null); }} className="accent-field" />{label}</label>)}</div></fieldset>
              <fieldset><legend className="font-semibold">{en.priority}</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{([ ["soil_health", en.soilHealth], ["water_conservation", en.water], ["income", en.income], ["balanced", en.balanced] ] as const).map(([value, label]) => <label key={value} className={`flex min-h-tap items-center gap-3 rounded-md border px-4 text-label ${priority === value ? "border-field bg-field-soft" : "border-line-strong bg-surface-raised"}`}><input type="radio" name="priority" value={value} checked={priority === value} onChange={() => { setPriority(value); setResult(null); }} className="accent-field" />{label}</label>)}</div></fieldset>
              <p className="text-body-sm text-ink-muted">{en.priorityNote}</p>
            </section>

            <section className="border-t border-line pt-6"><h2 className="text-title">{en.planning}</h2><p className="mt-2 text-body-sm text-ink-muted">{selectedPlace?.kind === "demo" ? en.demoPeriod : en.suggestedPeriod}</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block font-semibold">{en.starts}<input required type="date" value={planning.startDate} onChange={(event) => { setPlanning({ ...planning, startDate: event.target.value }); setResult(null); }} className="mt-2 min-h-tap w-full rounded-sm border border-line-strong bg-surface-raised px-3 font-mono text-data tabular" /></label><label className="block font-semibold">{en.ends}<input required type="date" value={planning.endDate} onChange={(event) => { setPlanning({ ...planning, endDate: event.target.value }); setResult(null); }} className="mt-2 min-h-tap w-full rounded-sm border border-line-strong bg-surface-raised px-3 font-mono text-data tabular" /></label></div></section>

            <details className="border-t border-line pt-6"><summary className="min-h-tap cursor-pointer text-title font-semibold">{en.advanced}</summary><div className="mt-4 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2"><label className="block font-semibold">{en.soilPh}<input type="number" min="0" max="14" step="0.1" value={soilPh} onChange={(event) => { setSoilPh(event.target.value); setResult(null); }} placeholder="Unknown" className="mt-2 min-h-tap w-full rounded-sm border border-line-strong bg-surface-raised px-3 font-mono tabular" /></label><label className="block font-semibold">{en.drainage}<select value={drainage} onChange={(event) => { setDrainage(event.target.value as typeof drainage); setResult(null); }} className="mt-2 min-h-tap w-full rounded-sm border border-line-strong bg-surface-raised px-3 text-body"><option value="unknown">{en.drainageUnknown}</option><option value="well">{en.drainageWell}</option><option value="moderate">{en.drainageModerate}</option><option value="poor">{en.drainagePoor}</option></select></label></div>
              <label className="block font-semibold">{en.equipment}<input maxLength={200} value={equipment} onChange={(event) => { setEquipment(event.target.value); setResult(null); }} className="mt-2 min-h-tap w-full rounded-sm border border-line-strong bg-surface-raised px-3 text-body" /></label><p className="text-body-sm text-ink-muted">{en.equipmentNote}</p>
              <fieldset><legend className="font-semibold">{en.cropPreferences}</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{cropData.crops.map((crop) => <label key={crop.id} className="flex min-h-tap items-center gap-3 rounded-md border border-line-strong bg-surface-raised px-3 text-label"><input type="checkbox" checked={availableCrops.includes(crop.id)} onChange={(event) => { setAvailableCrops(event.target.checked ? [...availableCrops, crop.id] : availableCrops.filter((id) => id !== crop.id)); setResult(null); }} className="size-4 accent-field" />{cropNames[crop.id]}</label>)}</div></fieldset>
            </div></details>

            {dataPending && <p role="status" className="text-body-sm text-ink-muted">Checking available weather and soil data for this location…</p>}
            {error && <p role="alert" className="rounded-md border border-heat bg-heat-soft p-3 text-body-sm text-ink">{error}</p>}
            <button type="submit" disabled={loading || dataPending} className="min-h-tap rounded-md bg-field px-6 font-semibold text-on-field hover:brightness-95 disabled:opacity-60">{loading ? en.comparing : dataPending ? "Checking local data…" : en.compare}</button>
          </form>
        </div>

        <aside aria-live="polite" className="lg:border-l lg:border-line lg:pl-8"><h2 className="text-title">{en.results}</h2>
          {!result && <p className="mt-3 text-ink-muted">{en.empty}</p>}
          {result && <div className="mt-4">
            <p className="text-body-sm text-ink-muted">{result.recommendation.scenario_count_total} {en.resultsCount}</p>
            <div className="mt-4 rounded-md border border-line bg-surface-raised p-4 text-body-sm"><strong className="text-ink">{en.dataStatus}</strong><p className="mt-1 text-ink-muted">{result.environment.state === "demo" ? en.demoWarning : result.environment.state === "unavailable" ? en.noDataWarning : result.environment.note}</p></div>
            {result.recommendation.input_variable_sources?.missing?.length ? <p className="mt-3 text-body-sm text-ink-muted">Some data is unavailable: {result.recommendation.input_variable_sources.missing.join(" ")}</p> : null}
            {result.historyNotApplied?.length ? <p className="mt-3 text-body-sm text-ink-muted">Earlier recorded crops outside this five-crop model were not used: {result.historyNotApplied.join(", ")}.</p> : null}
            {noPriorityEvidence && <p className="mt-4 rounded-md border border-line bg-surface-raised p-4 text-body-sm text-ink-muted">{en.noPriorityEvidence}</p>}
            <p className="mt-5 text-body-sm text-ink-muted">{en.scope}</p>
            {entry === "saved" && savedField && <div className="mt-3 text-body-sm"><Link href={`/fields/${savedField.id}/report?start=${planning.startDate}&end=${planning.endDate}`} className="inline-flex min-h-tap items-center font-semibold text-field underline">Open saved farm report</Link><p className="text-ink-muted">The report uses the farm’s saved records, including its saved crop and priorities.</p></div>}
            <div className="mt-5">{result.recommendation.scenarios.map((scenario, index) => <OptionCard key={`${scenario.proposed_crops.join("-")}-${index}`} scenario={scenario} />)}</div>
            <details className="border-t border-line py-4 text-body-sm"><summary className="min-h-tap cursor-pointer font-semibold text-field">{en.scientific} · {en.source}</summary><div className="space-y-2 pt-2 text-ink-muted"><p>{result.recommendation.input_environment_source || en.notProvided}</p><p>Basis: {result.recommendation.input_environment_basis || en.notProvided}</p><p>Observation or forecast period: {result.recommendation.input_observation_period ? `${result.recommendation.input_observation_period.start_date} to ${result.recommendation.input_observation_period.end_date}` : "unknown"}</p><p>Units: {result.recommendation.input_environment_units ? `${result.recommendation.input_environment_units.temp_c}, ${result.recommendation.input_environment_units.rain_mm}` : "unverified"} · Spatial resolution: {result.recommendation.input_spatial_resolution_km == null ? "unknown" : `${result.recommendation.input_spatial_resolution_km} km`}</p>{result.recommendation.input_variable_sources && <p>Temperature: {result.recommendation.input_variable_sources.temperature}. Rainfall: {result.recommendation.input_variable_sources.rainfall}{result.recommendation.input_variable_sources.rainfall_period ? ` (${result.recommendation.input_variable_sources.rainfall_period.start_date} to ${result.recommendation.input_variable_sources.rainfall_period.end_date})` : ""}.</p>}{result.recommendation.input_environment_context?.soil_ph_estimate && <p>SoilGrids estimated pH: {result.recommendation.input_environment_context.soil_ph_estimate.value}, {result.recommendation.input_environment_context.soil_ph_estimate.depth}, {result.recommendation.input_environment_context.soil_ph_estimate.resolution}. Map estimate, not a field test.</p>}{result.recommendation.input_environment_context?.smap && <p>SMAP regional root-zone moisture: {result.recommendation.input_environment_context.smap.observations.length} valid days, {result.recommendation.input_environment_context.smap.missing_count} missing days, {result.recommendation.input_environment_context.smap.period.start_date} to {result.recommendation.input_environment_context.smap.period.end_date}. Latest reading: {result.recommendation.input_environment_context.smap.observations.at(-1)?.rootzone ?? "unknown"} {result.recommendation.input_environment_context.smap.units}. {result.recommendation.input_environment_context.smap.resolution}. Context only; not field water availability.</p>}<p>{result.recommendation.ranking.method}</p><ul className="list-disc space-y-1 pl-5">{result.recommendation.global_warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div></details>
          </div>}
        </aside>
      </div>
    </section>
  );
}
