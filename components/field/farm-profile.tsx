"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph } from "@/components/ui/icons";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy/en";
import { getCropById, strategyCrops } from "@/lib/data/crops";
import { REGIONS } from "@/lib/data/regions";
import { constraintsSchema, economicsSchema, prioritiesSchema, soilObservationSchema } from "@/lib/schemas/field";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import { ValidationError } from "@/lib/store/repository";
import type {
  CropEconomics,
  Field,
  Rotation,
  FarmConstraints,
  Irrigation,
  PriorityId,
  SoilObservation,
  SoilProperty,
} from "@/lib/types";

const PRIORITY_IDS: PriorityId[] = ["water", "soil", "income", "forage", "lower-inputs"];
const EQUIPMENT = Object.keys(copy.profile.equipment) as Array<keyof typeof copy.profile.equipment>;
const SOIL_PROPERTIES = Object.keys(copy.profile.soilProperty) as SoilProperty[];
const SOIL_UNITS: Record<SoilProperty, string> = {
  ph: "pH",
  texture: "",
  drainage: "",
  salinity: "dS/m",
  "organic-carbon": "%",
  "available-water-capacity": "mm/m",
  "root-depth": "cm",
  nitrogen: "g/kg",
};
const IRRIGATION_OPTIONS = (Object.keys(copy.irrigation) as Irrigation[]).map((value) => ({ value, label: copy.irrigation[value] }));

const num = (v: string): number | undefined => {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : undefined;
};
const pair = (lo: string, hi: string): [number, number] | undefined => {
  const a = num(lo);
  const b = num(hi);
  return a !== undefined && b !== undefined ? [Math.min(a, b), Math.max(a, b)] : undefined;
};

interface EconDraft {
  cropId: string;
  yieldLo: string;
  yieldHi: string;
  priceLo: string;
  priceHi: string;
  costLo: string;
  costHi: string;
  source: string;
}

const blankSoil = () => ({ property: "ph" as SoilProperty, value: "", depthFrom: "0", depthTo: "20", date: new Date().toISOString().slice(0, 10), method: "laboratory" as SoilObservation["method"], source: "" });

/**
 * "Your farm": priorities, constraints, soil measurements and local price/yield/cost ranges.
 * Everything here is the farmer's own information. It overrides modelled values and is shown as theirs.
 */
export function FarmProfile({ fieldId }: { fieldId: string }) {
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

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!field) {
    return (
      <EmptyState title="Field not found" body="This field isn't saved in this browser.">
        <Link href="/" className={buttonClass("primary")}>
          Back to your fields
        </Link>
      </EmptyState>
    );
  }
  // keyed by field so a different field starts from its own saved values
  return <ProfileForm key={field.id} field={field} rotations={rotations} />;
}

function ProfileForm({ field, rotations }: { field: Field; rotations: Rotation[] }) {
  const update = useFieldsStore((s) => s.update);
  const p = field.priorities;
  const [order, setOrder] = useState<PriorityId[]>(() => [...(p?.order ?? []), ...PRIORITY_IDS.filter((x) => !p?.order.includes(x))]);
  const [included, setIncluded] = useState<Set<PriorityId>>(() => new Set(p?.order ?? []));
  const [irrigation, setIrrigation] = useState<Irrigation>(field.constraints?.irrigation?.access ?? field.irrigation);
  const [irrigationMm, setIrrigationMm] = useState(field.constraints?.irrigation?.amountMm?.toString() ?? "");
  const [equipment, setEquipment] = useState<Set<string>>(() => new Set(field.constraints?.equipment ?? []));
  const [labour, setLabour] = useState<"low" | "medium" | "high" | "">(field.constraints?.labour ?? "");
  const [market, setMarket] = useState<"poor" | "fair" | "good" | "">(field.constraints?.marketAccess ?? "");
  const [preferred, setPreferred] = useState<string[]>(field.constraints?.preferredCropIds ?? []);
  const [excluded, setExcluded] = useState<string[]>(field.constraints?.excludedCropIds ?? []);
  const [winFrom, setWinFrom] = useState(field.constraints?.plantingWindow?.from ?? "");
  const [winTo, setWinTo] = useState(field.constraints?.plantingWindow?.to ?? "");
  const [soil, setSoil] = useState<SoilObservation[]>(field.soilObservations ?? []);
  const [soilDraft, setSoilDraft] = useState(blankSoil());
  const [econ, setEcon] = useState<EconDraft[]>(() =>
    (field.economics ?? []).map((e) => ({
      cropId: e.cropId,
      yieldLo: e.yieldKgHa?.[0]?.toString() ?? "",
      yieldHi: e.yieldKgHa?.[1]?.toString() ?? "",
      priceLo: e.priceMmkPerKg?.[0]?.toString() ?? "",
      priceHi: e.priceMmkPerKg?.[1]?.toString() ?? "",
      costLo: e.costMmkPerHa?.[0]?.toString() ?? "",
      costHi: e.costMmkPerHa?.[1]?.toString() ?? "",
      source: e.source,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const region = field.region && field.region !== "unsupported" ? field.region : null;
  const cropChoices = useMemo(() => {
    const ids = new Set<string>(region ? strategyCrops(region).map((c) => c.id) : strategyCrops().map((c) => c.id));
    for (const s of rotations[0]?.slots ?? []) if (s.cropId) ids.add(s.cropId);
    return [...ids].map((id) => getCropById(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [region, rotations]);

  const touch = () => setSaved(false);
  const move = (id: PriorityId, dir: -1 | 1) => {
    touch();
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const toggle = <T,>(set: Set<T>, v: T, apply: (s: Set<T>) => void) => {
    touch();
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    apply(n);
  };

  const addSoil = () => {
    const d = soilDraft;
    const isText = d.property === "texture" || d.property === "drainage";
    const value = isText ? d.value.trim() : num(d.value);
    const candidate = {
      id: crypto.randomUUID(),
      property: d.property,
      value: value ?? "",
      units: SOIL_UNITS[d.property],
      depthCm: [num(d.depthFrom) ?? 0, num(d.depthTo) ?? 0] as [number, number],
      date: d.date,
      method: d.method,
      source: d.source,
    };
    const parsed = soilObservationSchema.safeParse(candidate);
    if (!parsed.success || value === undefined || value === "") {
      setError(parsed.success ? "Enter a value." : (parsed.error.issues[0]?.message ?? "Check the measurement."));
      return;
    }
    setError(null);
    touch();
    setSoil([...soil, parsed.data]);
    setSoilDraft(blankSoil());
  };

  const addEconRow = (cropId: string) => {
    if (!cropId || econ.some((e) => e.cropId === cropId)) return;
    touch();
    setEcon([...econ, { cropId, yieldLo: "", yieldHi: "", priceLo: "", priceHi: "", costLo: "", costHi: "", source: "" }]);
  };
  const patchEcon = (cropId: string, patch: Partial<EconDraft>) => {
    touch();
    setEcon(econ.map((e) => (e.cropId === cropId ? { ...e, ...patch } : e)));
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const orderedIncluded = order.filter((p) => included.has(p));
      const priorities = orderedIncluded.length ? prioritiesSchema.parse({ order: orderedIncluded, weights: {} }) : undefined;
      const constraints: FarmConstraints = constraintsSchema.parse({
        irrigation: { access: irrigation, amountMm: num(irrigationMm) },
        equipment: equipment.size ? [...equipment] : undefined,
        labour: labour || undefined,
        marketAccess: market || undefined,
        preferredCropIds: preferred.length ? preferred : undefined,
        excludedCropIds: excluded.length ? excluded : undefined,
        plantingWindow: winFrom && winTo ? { from: winFrom, to: winTo } : undefined,
      });
      const economics: CropEconomics[] = [];
      for (const e of econ) {
        const row = {
          cropId: e.cropId,
          yieldKgHa: pair(e.yieldLo, e.yieldHi),
          priceMmkPerKg: pair(e.priceLo, e.priceHi),
          costMmkPerHa: pair(e.costLo, e.costHi),
          source: e.source,
        };
        if (!row.yieldKgHa && !row.priceMmkPerKg && !row.costMmkPerHa) continue; // an empty row is dropped, not stored as zeros
        economics.push(economicsSchema.parse(row));
      }
      await update(field.id, { priorities, constraints, irrigation, soilObservations: soil, economics });
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof ValidationError
          ? e.message
          : e instanceof Error && "issues" in e
            ? String((e as { issues: Array<{ message: string }> }).issues[0]?.message ?? "Check your entries.")
            : "We couldn't save. Check your entries and that this browser allows site storage.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink sm:text-display">{copy.profile.title}</h1>
        <p className="max-w-measure text-body text-ink-muted">{copy.profile.lead}</p>
        {region ? <p className="m-0 text-body-sm text-ink-muted">{REGIONS[region].name}: {REGIONS[region].focus}.</p> : null}
      </div>

      <Panel as="section" aria-labelledby="priorities" className="flex flex-col gap-3 p-4 sm:p-6">
        <PanelHeader id="priorities" title={copy.profile.prioritiesTitle} description={copy.profile.prioritiesHelp} />
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {order.map((id, i) => (
            <li key={id} className="flex min-h-tap items-center gap-2 rounded-md border border-line bg-surface px-3">
              <span className="tabular font-mono text-source text-ink-muted">{i + 1}</span>
              <FormControlLabel
                className="min-w-0 flex-1"
                control={<Checkbox checked={included.has(id)} onChange={() => toggle(included, id, setIncluded)} />}
                label={copy.profile.priority[id]}
              />
              <Button variant="quiet" aria-label={`${copy.profile.moveUp}: ${copy.profile.priority[id]}`} onClick={() => move(id, -1)} disabled={i === 0}>
                ↑
              </Button>
              <Button variant="quiet" aria-label={`${copy.profile.moveDown}: ${copy.profile.priority[id]}`} onClick={() => move(id, 1)} disabled={i === order.length - 1}>
                ↓
              </Button>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel as="section" aria-labelledby="constraints" className="flex flex-col gap-4 p-4 sm:p-6">
        <PanelHeader id="constraints" title={copy.profile.constraintsTitle} />
        <Segmented legend={copy.profile.irrigationLabel} value={irrigation} onChange={(v) => { touch(); setIrrigation(v); }} options={IRRIGATION_OPTIONS} />
        {irrigation !== "none" ? (
          <TextField label={copy.profile.irrigationAmountLabel} value={irrigationMm} onChange={(e) => { touch(); setIrrigationMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} />
        ) : null}
        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="text-label text-ink">{copy.profile.equipmentLabel}</legend>
          <div className="flex flex-wrap gap-x-4">
            {EQUIPMENT.map((e) => (
              <FormControlLabel key={e} control={<Checkbox checked={equipment.has(e)} onChange={() => toggle(equipment, e as string, setEquipment)} />} label={copy.profile.equipment[e]} />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented legend={copy.profile.labourLabel} value={(labour || "") as "low" | "medium" | "high"} onChange={(v) => { touch(); setLabour(v); }} options={(["low", "medium", "high"] as const).map((v) => ({ value: v, label: copy.profile.levels[v] }))} />
          <Segmented legend={copy.profile.marketLabel} value={(market || "") as "poor" | "fair" | "good"} onChange={(v) => { touch(); setMarket(v); }} options={(["poor", "fair", "good"] as const).map((v) => ({ value: v, label: copy.profile.levels[v] }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField select label={copy.profile.preferredLabel} value={preferred} onChange={(e) => { touch(); setPreferred(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value); }} size="small" slotProps={{ select: { multiple: true } }}>
            {cropChoices.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.names.common}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={copy.profile.excludedLabel} value={excluded} onChange={(e) => { touch(); setExcluded(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value); }} size="small" slotProps={{ select: { multiple: true } }}>
            {cropChoices.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.names.common}
              </MenuItem>
            ))}
          </TextField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={copy.profile.windowFrom} value={winFrom} onChange={(e) => { touch(); setWinFrom(e.target.value); }} size="small" placeholder="05-15" />
          <TextField label={copy.profile.windowTo} value={winTo} onChange={(e) => { touch(); setWinTo(e.target.value); }} size="small" placeholder="07-31" />
        </div>
      </Panel>

      <Panel as="section" aria-labelledby="soil" className="flex flex-col gap-4 p-4 sm:p-6">
        <PanelHeader id="soil" title={copy.profile.soilTitle} description={copy.profile.soilHelp} />
        {soil.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {soil.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface p-3 text-body-sm">
                <span className="text-ink">
                  <strong>{copy.profile.soilProperty[o.property]}</strong>: {o.value} {o.units}, {o.depthCm[0]} to {o.depthCm[1]} cm, {o.date}, {copy.profile.soilMethod[o.method]}, {o.source}
                </span>
                <Button variant="quiet" onClick={() => { touch(); setSoil(soil.filter((x) => x.id !== o.id)); }}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField select label="What was measured" value={soilDraft.property} onChange={(e) => setSoilDraft({ ...soilDraft, property: e.target.value as SoilProperty })} size="small">
            {SOIL_PROPERTIES.map((p) => (
              <MenuItem key={p} value={p}>
                {copy.profile.soilProperty[p]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={`Value${SOIL_UNITS[soilDraft.property] ? ` (${SOIL_UNITS[soilDraft.property]})` : ""}`} value={soilDraft.value} onChange={(e) => setSoilDraft({ ...soilDraft, value: e.target.value })} size="small" />
          <TextField label="Depth from (cm)" value={soilDraft.depthFrom} onChange={(e) => setSoilDraft({ ...soilDraft, depthFrom: e.target.value })} size="small" type="number" />
          <TextField label="Depth to (cm)" value={soilDraft.depthTo} onChange={(e) => setSoilDraft({ ...soilDraft, depthTo: e.target.value })} size="small" type="number" />
          <TextField label="Date" value={soilDraft.date} onChange={(e) => setSoilDraft({ ...soilDraft, date: e.target.value })} size="small" type="date" slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="How it was measured" value={soilDraft.method} onChange={(e) => setSoilDraft({ ...soilDraft, method: e.target.value as SoilObservation["method"] })} size="small">
            {(Object.keys(copy.profile.soilMethod) as Array<SoilObservation["method"]>).map((m) => (
              <MenuItem key={m} value={m}>
                {copy.profile.soilMethod[m]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Where it came from" value={soilDraft.source} onChange={(e) => setSoilDraft({ ...soilDraft, source: e.target.value })} size="small" className="sm:col-span-2" />
        </div>
        <div>
          <Button variant="secondary" onClick={addSoil}>
            {copy.profile.addSoil}
          </Button>
        </div>
      </Panel>

      <Panel as="section" aria-labelledby="economics" className="flex flex-col gap-4 p-4 sm:p-6">
        <PanelHeader id="economics" title={copy.profile.economicsTitle} description={copy.profile.economicsHelp} />
        {econ.map((e) => {
          const crop = getCropById(e.cropId);
          return (
            <div key={e.cropId} className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3">
              <p className="m-0 text-label text-ink">{crop?.names.common ?? e.cropId}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {([["yield", copy.profile.yieldLabel, "yieldLo", "yieldHi"], ["price", copy.profile.priceLabel, "priceLo", "priceHi"], ["cost", copy.profile.costLabel, "costLo", "costHi"]] as const).map(([k, label, lo, hi]) => (
                  <div key={k} className="flex flex-col gap-1">
                    <span className="text-body-sm text-ink-muted">{label}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <TextField label={copy.profile.lowLabel} value={e[lo]} onChange={(ev) => patchEcon(e.cropId, { [lo]: ev.target.value })} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} />
                      <TextField label={copy.profile.highLabel} value={e[hi]} onChange={(ev) => patchEcon(e.cropId, { [hi]: ev.target.value })} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} />
                    </div>
                  </div>
                ))}
              </div>
              <TextField label={copy.profile.economicsSource} value={e.source} onChange={(ev) => patchEcon(e.cropId, { source: ev.target.value })} size="small" />
              <div>
                <Button variant="quiet" onClick={() => { touch(); setEcon(econ.filter((x) => x.cropId !== e.cropId)); }}>
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
        <TextField select label="Add a crop" value="" onChange={(e) => addEconRow(e.target.value)} size="small" className="sm:max-w-xs">
          {cropChoices.filter((c) => !econ.some((e) => e.cropId === c.id)).map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.names.common}
            </MenuItem>
          ))}
        </TextField>
      </Panel>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {saved ? <Alert severity="success">{copy.profile.saved}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="primary" onClick={save} disabled={saving}>
          {copy.profile.save}
        </Button>
        <Link href={`/fields/${field.id}/conditions`} className={buttonClass("secondary")}>
          {copy.profile.next}
          <ChevronRightGlyph />
        </Link>
      </div>
    </>
  );
}
