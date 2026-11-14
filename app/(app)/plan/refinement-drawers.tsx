"use client";

import { Droplets, Hand, Wind, CircleHelp } from "lucide-react";
import MuiButton from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import { useRef, useState } from "react";
import { Button, Pressable } from "@/components/ui/button";
import { getCropById } from "@/lib/data/crops";
import { REGIONS } from "@/lib/data/regions";
import { adaptPlanToFieldSlot } from "@/lib/plan/refinement-adapter";
import { type FarmerDateInput, type PlanDraft, type PlanRefinements, type RefinementKey } from "@/lib/store/plan-draft";

const keys: RefinementKey[] = ["sequence", "water", "goal", "residue", "feasibility"];
const labels: Record<RefinementKey, string> = { sequence: "Crop sequence", water: "Water", goal: "Main goal", residue: "Residue practice", feasibility: "Local feasibility" };
const choices = {
  water: [["rain-only", "Rain only"], ["occasional", "Occasional irrigation"], ["reliable", "Reliable irrigation"], ["unknown", "Unknown"]],
  goal: [["water", "Save water"], ["soil", "Improve soil"], ["income", "Increase income"], ["forage", "Obtain fodder"], ["risk", "Reduce risk (record only; no ranking model)"], ["unknown", "Unknown"]],
  residue: [["kept", "Kept"], ["incorporated", "Incorporated"], ["mulched", "Mulched"], ["removed", "Removed for fodder"], ["burned", "Burned"], ["unknown", "Unknown"]],
} as const;
type FeasibilityKey = keyof PlanRefinements["feasibility"]["values"];

function DateEditor({ label, value, onChange }: { label: string; value: FarmerDateInput; onChange: (date: FarmerDateInput) => void }) {
  return <fieldset className="min-w-0 space-y-2 border-t border-line pt-4"><legend className="text-label font-semibold">{label}</legend>
    <TextField select size="small" label={`${label} precision`} value={value.kind} onChange={e => onChange(e.target.value === "exact" ? { kind: "exact", date: "" } : e.target.value === "dekad" ? { kind: "dekad", year: 0, month: 0, period: "early" } : { kind: "unknown" })} fullWidth slotProps={{ select: { native: true } }}>
      <option value="unknown">Unknown</option><option value="dekad">Early / mid / late month</option><option value="exact">Exact date I know</option>
    </TextField>
    {value.kind === "exact" ? <TextField label={`${label} exact date`} type="date" value={value.date} onChange={e => onChange({ kind: "exact", date: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} /> : null}
    {value.kind === "dekad" ? <div className="grid grid-cols-2 gap-2">
      <TextField label="Year" type="number" value={value.year || ""} onChange={e => onChange({ ...value, year: Number(e.target.value) })} />
      <TextField label="Month" type="number" value={value.month || ""} onChange={e => onChange({ ...value, month: Number(e.target.value) })} />
      <div className="col-span-2 flex flex-wrap gap-2" role="group" aria-label={`${label} month interval`}>{(["early", "mid", "late"] as const).map(period => <Chip key={period} label={period === "early" ? "Early (1–10)" : period === "mid" ? "Mid (11–20)" : "Late (21–end)"} clickable aria-pressed={value.period === period} variant={value.period === period ? "filled" : "outlined"} onClick={() => onChange({ ...value, period })} sx={{ minHeight: 44 }} />)}</div>
    </div> : null}
  </fieldset>;
}

export function RefinementDrawers({ draft, onChange }: { draft: PlanDraft; onChange: (next: PlanDraft) => void }) {
  const [open, setOpen] = useState<RefinementKey | null>(null);
  const [working, setWorking] = useState<PlanRefinements>(draft.refinements);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const [previous, setPrevious] = useState<PlanDraft | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  function launch(key: RefinementKey, target: HTMLElement) { opener.current = target; setWorking(structuredClone(draft.refinements)); setError(""); setOpen(key); window.setTimeout(() => titleRef.current?.focus(), 0); }
  function close() { setOpen(null); setError(""); window.setTimeout(() => opener.current?.focus(), 0); }
  function update<K extends RefinementKey>(key: K, value: PlanRefinements[K]) { setWorking(current => ({ ...current, [key]: value })); setError(""); }
  function save() {
    if (!open) return;
    if (open === "sequence") {
      const s = working.sequence;
      const supported = REGIONS[draft.place!.region].candidateCropIds;
      if ([s.previousCropId, s.nextCropId, s.winterCropId].some(id => id && id !== "fallow" && !supported.includes(id))) { update("sequence", { ...s, state: "invalid" }); setError("Choose listed crops or remove the incorrect crop."); return; }
      for (const date of [s.sowing, s.harvest, ...(s.transition ? [s.transition.previousHarvest, s.transition.nextSowing] : [])]) {
        if (date.kind === "exact" && (!/^\d{4}-\d{2}-\d{2}$/.test(date.date) || Number.isNaN(Date.parse(date.date)) || new Date(date.date).toISOString().slice(0, 10) !== date.date)) { update("sequence", { ...s, state: "invalid" }); setError("Enter a valid exact date or choose Unknown."); return; }
        if (date.kind === "dekad" && (!Number.isInteger(date.year) || date.year < 1900 || date.year > 2200 || !Number.isInteger(date.month) || date.month < 1 || date.month > 12)) { update("sequence", { ...s, state: "invalid" }); setError("Enter a valid year and month."); return; }
      }
    }
    if (open === "water" && working.water.observation) {
      const o = working.water.observation;
      if (o.depthCm !== null && (!Number.isFinite(o.depthCm) || o.depthCm < 0 || o.depthCm > 100)) { setError("Enter an observation depth from 0 to 100 cm, or leave it unknown."); return; }
      const d = o.observedOn;
      if (d.kind === "exact" && (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(Date.parse(d.date)) || new Date(d.date).toISOString().slice(0, 10) !== d.date)) { setError("Correct the observation date or choose Unknown."); return; }
      if (d.kind === "dekad" && (!Number.isInteger(d.year) || d.year < 1900 || d.year > 2200 || !Number.isInteger(d.month) || d.month < 1 || d.month > 12)) { setError("Correct the observation year and month or choose Unknown."); return; }
    }
    const nextRefinements = { ...working, [open]: { ...working[open], state: open === "sequence" ? "confirmed" : open === "feasibility" ? "saved" : (working[open] as { value: string }).value === "unknown" ? "unknown" : "saved" } } as PlanRefinements;
    setPrevious(draft);
    onChange({ ...draft, refinements: nextRefinements, revision: draft.revision + 1 });
    close();
  }
  const region = draft.place!.region;
  const cropOptions = REGIONS[region].candidateCropIds.map(id => ({ id, label: getCropById(id)?.names.common ?? id }));
  const cropSelect = (label: string, value: string | null, change: (value: string | null) => void) => <TextField select label={label} value={value ?? ""} onChange={e => change(e.target.value || null)} fullWidth slotProps={{ select: { native: true } }}><option value="">Not known / remove</option>{cropOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}<option value="fallow">Fallow</option></TextField>;
  return <section aria-label="Refine comparison" className="space-y-3">
    <h3 className="text-headline text-ink">Add what you know</h3>
    <div className="flex flex-wrap gap-2">{keys.slice(0, 3).map(key => <Chip key={key} clickable onClick={e => launch(key, e.currentTarget)} label={`${labels[key]}: ${draft.refinements[key].state === "unknown" ? "Not set" : draft.refinements[key].state}`} variant="outlined" sx={{ minHeight: 44 }} />)}</div>
    <MuiButton
      variant="text"
      onClick={() => setMore(!more)}
      aria-expanded={more}
      sx={{ minHeight: 44, textDecoration: "underline", color: "var(--color-field)", p: 0, justifyContent: "flex-start", fontWeight: 600 }}
    >
      More field details
    </MuiButton>
    {more ? <div className="flex flex-wrap gap-2">{keys.slice(3).map(key => <Chip key={key} clickable onClick={e => launch(key, e.currentTarget)} label={`${labels[key]}: ${draft.refinements[key].state}`} variant="outlined" sx={{ minHeight: 44 }} />)}</div> : null}
    {previous ? <Button variant="quiet" onClick={() => { onChange({ ...previous, revision: draft.revision + 1 }); setPrevious(null); }}>Undo last change</Button> : null}
    <p className="text-body-sm text-ink-muted">Your answers stay in this browser. Regional examples remain examples; we do not know your full field conditions.</p>
    <p className="text-body-sm text-ink-muted">Intervals are saved as reported. exact-date-needed: the saved-field engine requires exact dates for numerical replay; no midpoint is substituted.</p>
    <p role="status" className="text-body-sm text-ink-muted">{adaptPlanToFieldSlot(draft).state === "ready" ? "Exact dates recorded. Field evaluation still needs a saved field and evidence." : "Field comparison needs more confirmed information; regional examples remain available."}</p>
    <Drawer anchor="bottom" variant="persistent" open={open !== null} onClose={close} slotProps={{ paper: { sx: { maxHeight: "85dvh", overflowY: "auto", bgcolor: "var(--color-surface-raised)", borderTopLeftRadius: 16, borderTopRightRadius: 16 } } }}>
      {open ? <div className="mx-auto w-full max-w-2xl space-y-5 p-4 pb-8" onKeyDown={e => { if (e.key === "Escape") close(); }}>
        <h3 ref={titleRef} tabIndex={-1} className="text-title text-ink">{labels[open]}</h3>
        <p role="status" className="text-body-sm text-ink-muted">Input state: {working[open].state}. Changes are saved only when you choose Save details.</p>
        {open === "sequence" ? <div className="space-y-4">
          <p className="text-body-sm">Main crop: {getCropById(draft.mainCropId!)?.names.common}. Confirm only crops you actually grew. Dates may stay unknown.</p>
          {cropSelect("Previous crop", working.sequence.previousCropId, value => update("sequence", { ...working.sequence, previousCropId: value, state: "draft" }))}
          {cropSelect("Following crop", working.sequence.nextCropId, value => update("sequence", { ...working.sequence, nextCropId: value, transition: value && value !== "fallow" ? { fromCropId: draft.mainCropId!, toCropId: value, method: "unknown", previousHarvest: working.sequence.harvest, nextSowing: { kind: "unknown" } } : undefined, state: "draft" }))}
          {cropSelect("Winter crop", working.sequence.winterCropId, value => update("sequence", { ...working.sequence, winterCropId: value, state: "draft" }))}
          {working.sequence.nextCropId && working.sequence.nextCropId !== "fallow" ? <fieldset className="space-y-3"><legend className="text-label">How did you sow the following crop?</legend>
            <RadioGroup aria-label="Rice to pulse method" value={working.sequence.transition?.method ?? "unknown"} onChange={e => update("sequence", { ...working.sequence, state: "draft", transition: { fromCropId: draft.mainCropId!, toCropId: working.sequence.nextCropId!, previousHarvest: working.sequence.transition?.previousHarvest ?? working.sequence.harvest, nextSowing: working.sequence.transition?.nextSowing ?? { kind: "unknown" }, method: e.target.value as import("@/lib/store/plan-draft").TransitionMethod } })}>
              {[["relay-standing-rice", "Relay into standing rice"], ["post-harvest-no-till", "After harvest, no tillage"], ["post-harvest-tilled", "After harvest, tilled"], ["intercrop", "Planted together / intercrop"], ["unknown", "Don't know"]].filter(([value]) => value !== "relay-standing-rice" || (draft.mainCropId === "rice" && ["black-gram", "green-gram", "chickpea", "pigeon-pea"].includes(working.sequence.nextCropId ?? ""))).map(([value, label]) => <FormControlLabel key={value} value={value} control={<Radio />} label={label} />)}
            </RadioGroup>
            {working.sequence.transition ? <><DateEditor label="Rice harvest for transition" value={working.sequence.transition.previousHarvest} onChange={previousHarvest => update("sequence", { ...working.sequence, transition: { ...working.sequence.transition!, previousHarvest }, state: "draft" })} /><DateEditor label="Pulse sowing" value={working.sequence.transition.nextSowing} onChange={nextSowing => update("sequence", { ...working.sequence, transition: { ...working.sequence.transition!, nextSowing }, state: "draft" })} /></> : null}
            <p className="text-body-sm text-ink-muted">Record what happened, including dates before rice harvest. Overlapping water/ET, disease and planting windows are not-evaluated. Check seedbed moisture, drainage, variety and machinery locally; there is no universal 7–10 day rule.</p>
          </fieldset> : null}
          <DateEditor label="Sowing" value={working.sequence.sowing} onChange={value => update("sequence", { ...working.sequence, sowing: value, state: "draft" })} />
          <DateEditor label="Harvest" value={working.sequence.harvest} onChange={value => update("sequence", { ...working.sequence, harvest: value, state: "draft" })} />
        </div> : null}
        {open === "water" || open === "goal" || open === "residue" ? <RadioGroup aria-label={labels[open]} value={working[open].value} onChange={e => update(open, { ...working[open], value: e.target.value, state: "draft" } as PlanRefinements[typeof open])}>{choices[open].map(([value, label]) => <FormControlLabel key={value} value={value} control={<Radio />} label={label} />)}</RadioGroup> : null}
        {open === "water" ? <TopsoilEditor value={working.water.observation} fieldRef={draft.place!.id} onChange={observation => update("water", { ...working.water, observation, state: "draft" })} /> : null}
        {open === "residue" ? <p className="text-body-sm text-ink-muted">This records residue from your selected main crop only. Kept without a fate stays unquantified. Cover history comes from crop periods; retaining straw does not add invented crop-cover days.</p> : null}
        {open === "feasibility" ? <div className="space-y-4"><p className="text-body-sm">These are local checks. No scientific rule enforces them here.</p>{(Object.keys(working.feasibility.values) as FeasibilityKey[]).map(key => <div key={key}><p className="text-label font-semibold capitalize">{key} · needs-local-check</p><RadioGroup row aria-label={key} value={working.feasibility.values[key]} onChange={e => update("feasibility", { values: { ...working.feasibility.values, [key]: e.target.value }, state: "draft" })}>{["available", "unavailable", "unknown"].map(value => <FormControlLabel key={value} value={value} control={<Radio />} label={value} />)}</RadioGroup></div>)}</div> : null}
        {error ? <p role="alert" className="text-body-sm text-heat">{error}</p> : null}
        <div className="flex flex-wrap gap-3"><Button variant="primary" onClick={save}>Save details</Button><Button variant="secondary" onClick={close}>Cancel and close</Button></div>
      </div> : null}
    </Drawer>
  </section>;
}

function TopsoilEditor({ value, fieldRef, onChange }: { value: import("@/lib/store/plan-draft").TopsoilObservation | undefined; fieldRef: string; onChange: (v: import("@/lib/store/plan-draft").TopsoilObservation) => void }) {
  const v = value ?? { fieldRef, feel: "unknown", observedOn: { kind: "unknown" }, depthCm: null, texture: "unknown", context: "unknown" };
  const cards = [{ id: "very-wet", label: "Very wet / oozing", description: "Visible water or shine; water squeezes out.", Icon: Droplets }, { id: "moist", label: "Moist / moldable", description: "Holds together; feel depends on texture.", Icon: Hand }, { id: "dry", label: "Dry / crumbly", description: "Crumbles or feels hard, depending on texture.", Icon: Wind }, { id: "unknown", label: "Don't know / cannot check", description: "Keep the observation unknown.", Icon: CircleHelp }] as const;
  return <fieldset className="space-y-4"><legend className="text-headline">How does the topsoil feel?</legend>
    <p className="text-body-sm">Observation for area {fieldRef}. A village reference is not a confirmed field.</p>
    <div className="grid grid-cols-2 gap-2">{cards.map(({ id, label, description, Icon }) => <Pressable key={id} type="button" aria-pressed={v.feel === id} onClick={() => onChange({ ...v, feel: id })} className="flex min-w-0 flex-col items-start gap-2 rounded-lg border border-line bg-surface p-3 text-left text-ink focus-visible:outline-2 focus-visible:outline-field"><Icon size={32} aria-hidden="true" /><strong>{label}</strong><span className="text-body-sm">{description}</span></Pressable>)}</div>
    <TextField label="Field name or local identifier (optional)" value={v.fieldRef} onChange={e => onChange({ ...v, fieldRef: e.target.value })} fullWidth />
    <TextField select label="When was this observed?" value={v.context} onChange={e => onChange({ ...v, context: e.target.value as typeof v.context })} fullWidth slotProps={{ select: { native: true } }}>{["unknown", "now", "at-planting", "remembered"].map(x => <option key={x} value={x}>{x}</option>)}</TextField>
    <DateEditor label="Observation" value={v.observedOn} onChange={observedOn => onChange({ ...v, observedOn })} />
    <TextField label="Observation depth in cm (optional)" type="number" value={v.depthCm ?? ""} onChange={e => onChange({ ...v, depthCm: e.target.value === "" ? null : Number(e.target.value) })} fullWidth />
    <TextField select label="Known texture" value={v.texture} onChange={e => onChange({ ...v, texture: e.target.value as typeof v.texture })} fullWidth slotProps={{ select: { native: true } }}>{["unknown", "sandy", "loamy", "clayey"].map(x => <option key={x} value={x}>{x}</option>)}</TextField>
    <p className="text-body-sm text-ink-muted">This qualitative topsoil report supplies no numeric theta or root-zone storage. It cannot establish a germination date or a safe sowing window. Check drainage and seedbed conditions locally.</p>
  </fieldset>;
}
