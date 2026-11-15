"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { useEffect, useMemo, useRef, useState } from "react";
import { Message } from "@/components/ui/message";
import { Disclosure } from "@/components/ui/disclosure";
import { clearDraft, readDraft, writeDraft } from "@/lib/store/form-drafts";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionBar } from "@/components/ui/action-bar";
import { Icon, type IconName } from "@/components/ui/icon";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy/en";
import { getCropById, strategyCrops, getRealWorldCropEconomics } from "@/lib/data/crops";
import type { SoilProfile } from "@/lib/soil/soilgrids";
import { SUB_CRITERION } from "@/lib/engine/mcda";
import { PriorityOrder } from "@/components/field/priority-order";
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
  SoilOverride,
  SoilProperty,
  SoilSub,
  IncomeSub,
  TextureClass,
} from "@/lib/types";

const TEXTURE_CLASSES: TextureClass[] = [
  "clay",
  "silty clay",
  "sandy clay",
  "clay loam",
  "silty clay loam",
  "sandy clay loam",
  "loam",
  "silt loam",
  "silt",
  "sandy loam",
  "loamy sand",
  "sand",
];

const PRIORITY_IDS: PriorityId[] = ["water", "soil", "income", "forage", "lower-inputs"];
const EQUIPMENT = Object.keys(copy.profile.equipment) as Array<keyof typeof copy.profile.equipment>;
const SOIL_PROPERTIES = Object.keys(copy.profile.soilProperty) as SoilProperty[];
const SOIL_UNITS: Record<SoilProperty, string> = {
  ph: "pH",
  texture: "",
  drainage: "",
  salinity: "dS/m",
  sand: "%",
  clay: "%",
  "organic-carbon": "%",
  "available-water-capacity": "mm/m",
  "root-depth": "cm",
  nitrogen: "g/kg",
};
const IRRIGATION_OPTIONS = (Object.keys(copy.irrigation) as Irrigation[]).map((value) => ({ value, label: copy.irrigation[value] }));

const PRIORITY_ICON: Record<PriorityId, IconName> = {
  water: "water",
  soil: "soil",
  income: "price",
  forage: "organic",
  "lower-inputs": "cost",
};

/** Small status pill: the farmer's own value, a map estimate that was auto-filled, or nothing known yet. */
function SourceBadge({ kind, loading }: { kind: "yours" | "estimate" | "none"; loading?: boolean }) {
  if (loading) return <span className="inline-flex items-center gap-1 text-source text-ink-muted"><Icon name="satellite" size={14} />Loading…</span>;
  if (kind === "yours") return <span className="inline-flex items-center gap-1 rounded bg-field-soft px-1.5 py-0.5 text-source font-medium text-field"><Icon name="done" size={14} />Your value</span>;
  if (kind === "estimate") return <span className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-source font-medium text-ink-muted"><Icon name="estimate" size={14} />Auto-filled estimate</span>;
  return <span className="inline-flex items-center gap-1 text-source text-ink-muted"><Icon name="close" size={14} />Needs test</span>;
}

const ECON_KEY = { yield: "yieldKgHa", price: "priceMmkPerKg", cost: "costMmkPerHa" } as const;

/** "5-15" and "5/15" become "05-15" so a window typed the short way is still understood. */
function monthDay(v: string): string {
  const m = v.trim().match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})$/);
  return m ? `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : v.trim();
}

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

interface SoilDraftState {
  property: SoilProperty;
  value: string;
  depthFrom: string;
  depthTo: string;
  /** Left blank on purpose: the date and method belong to the test, so the farmer picks them. */
  date: string;
  method: SoilObservation["method"] | "";
  source: string;
}

/** Everything the profile form holds, so unsaved answers can be carried across a remount. */
interface ProfileDraft {
  order: PriorityId[];
  included: PriorityId[];
  soilSub: SoilSub[];
  incomeSub: IncomeSub[];
  irrigation: Irrigation;
  irrigationMm: string;
  depletionMm: string;
  pumpRate: string;
  pumpEff: string;
  pumpHours: string;
  bundMm: string;
  seepage: string;
  equipment: string[];
  labour: "low" | "medium" | "high" | "";
  market: "poor" | "fair" | "good" | "";
  preferred: string[];
  excluded: string[];
  winFrom: string;
  winTo: string;
  asked: { market: boolean; household: boolean; labour: boolean; land: boolean };
  canSell: string[];
  mustGrow: string[];
  peak: number[];
  tenure: "owned" | "leased";
  leaseYears: string;
  soil: SoilObservation[];
  soilPh: string;
  soilTexture: string;
  soilSalinity: string;
  auto: { ph: boolean; texture: boolean };
  soilDraft: SoilDraftState;
  econ: EconDraft[];
}

/** The top 20 cm is the usual topsoil test depth, so it is the one default kept here. */
const blankSoil = (): SoilDraftState => ({ property: "ph", value: "", depthFrom: "0", depthTo: "20", date: "", method: "", source: "" });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * A month and day, stored as "MM-DD" (the same value the planning engine has always read).
 * Partial entries stay in the box; the stored value is only set once the day fits the month.
 */
function MonthDayField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  const [parts, setParts] = useState(() => {
    const m = /^(\d{2})-(\d{2})$/.exec(value);
    return { mm: m ? m[1] : "", dd: m ? String(Number(m[2])) : "" };
  });
  const maxDay = parts.mm ? DAYS_IN_MONTH[Number(parts.mm) - 1] : 31;
  const day = Number(parts.dd);
  const dayFits = parts.dd === "" || (Number.isInteger(day) && day >= 1 && day <= maxDay);
  const dayError = !dayFits
    ? parts.mm
      ? `${MONTHS[Number(parts.mm) - 1]} has ${maxDay} days at most.`
      : "Enter a day from 1 to 31."
    : null;

  const update = (next: { mm: string; dd: string }) => {
    setParts(next);
    const d = Number(next.dd);
    const limit = next.mm ? DAYS_IN_MONTH[Number(next.mm) - 1] : 31;
    const complete = next.mm !== "" && next.dd !== "" && Number.isInteger(d) && d >= 1 && d <= limit;
    onChange(complete ? `${next.mm}-${String(d).padStart(2, "0")}` : "");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label text-ink">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          select
          size="small"
          label="Month"
          value={parts.mm}
          onChange={(e) => update({ ...parts, mm: e.target.value })}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        >
          <option value="" disabled>
            Choose
          </option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Day"
          type="number"
          value={parts.dd}
          onChange={(e) => update({ ...parts, dd: e.target.value })}
          error={!dayFits}
          helperText={dayError ?? (parts.mm && !parts.dd ? "Add the day too." : undefined)}
          slotProps={{ htmlInput: { min: 1, max: maxDay, inputMode: "numeric" } }}
        />
      </div>
    </div>
  );
}

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
  const router = useRouter();
  const update = useFieldsStore((s) => s.update);
  const [soilMap, setSoilMap] = useState<SoilProfile | null>(null);
  const [soilMapStatus, setSoilMapStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const p = field.priorities;
  // Answers typed on an earlier visit in this session (for example before going back to the previous step) win over the saved values.
  const draftKey = `profile:${field.id}`;
  const draft = readDraft<ProfileDraft>(draftKey);
  const [order, setOrder] = useState<PriorityId[]>(() => draft?.order ?? [...(p?.order ?? []), ...PRIORITY_IDS.filter((x) => !p?.order.includes(x))]);
  const [included, setIncluded] = useState<Set<PriorityId>>(() => new Set(draft ? draft.included : (p?.order ?? [])));
  const [soilSub, setSoilSub] = useState<Set<SoilSub>>(() => new Set(draft ? draft.soilSub : (p?.soil ?? [])));
  const [incomeSub, setIncomeSub] = useState<Set<IncomeSub>>(() => new Set(draft ? draft.incomeSub : (p?.income ?? [])));
  const [irrigation, setIrrigation] = useState<Irrigation>(draft?.irrigation ?? field.constraints?.irrigation?.access ?? field.irrigation);
  const [irrigationMm, setIrrigationMm] = useState(draft?.irrigationMm ?? field.constraints?.irrigation?.amountMm?.toString() ?? "");
  const [depletionMm, setDepletionMm] = useState(draft?.depletionMm ?? field.constraints?.soilDepletionAtPlantingMm?.toString() ?? "");
  const [pumpRate, setPumpRate] = useState(draft?.pumpRate ?? field.constraints?.irrigation?.pump?.rateM3H?.toString() ?? "");
  const [pumpEff, setPumpEff] = useState(draft?.pumpEff ?? field.constraints?.irrigation?.pump?.efficiency?.toString() ?? "");
  const [pumpHours, setPumpHours] = useState(draft?.pumpHours ?? field.constraints?.irrigation?.pump?.hoursAvailable?.toString() ?? "");
  const [bundMm, setBundMm] = useState(draft?.bundMm ?? field.constraints?.paddy?.bundMm?.toString() ?? "");
  const [seepage, setSeepage] = useState(draft?.seepage ?? field.constraints?.paddy?.seepagePercolationMmDay?.toString() ?? "");
  const [equipment, setEquipment] = useState<Set<string>>(() => new Set(draft ? draft.equipment : (field.constraints?.equipment ?? [])));
  const [labour, setLabour] = useState<"low" | "medium" | "high" | "">(draft?.labour ?? field.constraints?.labour ?? "");
  const [market, setMarket] = useState<"poor" | "fair" | "good" | "">(draft?.market ?? field.constraints?.marketAccess ?? "");
  const [preferred, setPreferred] = useState<string[]>(draft?.preferred ?? field.constraints?.preferredCropIds ?? []);
  const [excluded, setExcluded] = useState<string[]>(draft?.excluded ?? field.constraints?.excludedCropIds ?? []);
  const [winFrom, setWinFrom] = useState(draft?.winFrom ?? field.constraints?.plantingWindow?.from ?? "");
  const [winTo, setWinTo] = useState(draft?.winTo ?? field.constraints?.plantingWindow?.to ?? "");
  const [asked, setAsked] = useState(() => draft?.asked ?? {
    market: field.constraints?.canSell !== undefined,
    household: field.constraints?.mustGrow !== undefined,
    labour: field.constraints?.peakMonths !== undefined,
    land: field.constraints?.land !== undefined,
  });
  const [canSell, setCanSell] = useState<string[]>(draft?.canSell ?? field.constraints?.canSell ?? []);
  const [mustGrow, setMustGrow] = useState<string[]>(draft?.mustGrow ?? field.constraints?.mustGrow ?? []);
  const [peak, setPeak] = useState<Set<number>>(() => new Set(draft ? draft.peak : (field.constraints?.peakMonths ?? [])));
  const [tenure, setTenure] = useState<"owned" | "leased">(draft?.tenure ?? field.constraints?.land?.tenure ?? "owned");
  const [leaseYears, setLeaseYears] = useState(draft?.leaseYears ?? field.constraints?.land?.leaseYears?.toString() ?? "");
  const [soil, setSoil] = useState<SoilObservation[]>(draft?.soil ?? field.soilObservations ?? []);
  const [soilPh, setSoilPh] = useState(() => {
    if (draft) return draft.soilPh;
    if (field.soilOverride?.ph !== undefined) return field.soilOverride.ph.toString();
    const obs = field.soilObservations?.find((o) => o.property === "ph");
    return obs && typeof obs.value === "number" ? obs.value.toString() : "";
  });
  const [soilTexture, setSoilTexture] = useState<string>(() => {
    if (draft) return draft.soilTexture;
    if (field.soilOverride?.texture) return field.soilOverride.texture;
    const obs = field.soilObservations?.find((o) => o.property === "texture");
    return obs && typeof obs.value === "string" ? obs.value : "";
  });
  const [soilSalinity, setSoilSalinity] = useState(() => {
    if (draft) return draft.soilSalinity;
    if (field.soilOverride?.salinityDsM !== undefined) return field.soilOverride.salinityDsM.toString();
    const obs = field.soilObservations?.find((o) => o.property === "salinity");
    return obs && typeof obs.value === "number" ? obs.value.toString() : "";
  });
  // true while the value in the box is the map estimate we filled in, not something the farmer entered
  const [auto, setAuto] = useState(draft?.auto ?? { ph: false, texture: false });
  const [soilDraft, setSoilDraft] = useState<SoilDraftState>(() => draft?.soilDraft ?? blankSoil());
  const [econ, setEcon] = useState<EconDraft[]>(() =>
    draft?.econ ??
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

  // Unsaved edits are kept in memory when this form unmounts (for example going back a step), so nothing typed is lost.
  const unsavedRef = useRef(false);
  const snapshot: ProfileDraft = {
    order, included: [...included], soilSub: [...soilSub], incomeSub: [...incomeSub], irrigation, irrigationMm, depletionMm,
    pumpRate, pumpEff, pumpHours, bundMm, seepage, equipment: [...equipment], labour, market, preferred, excluded,
    winFrom, winTo, asked, canSell, mustGrow, peak: [...peak], tenure, leaseYears, soil, soilPh, soilTexture, soilSalinity,
    auto, soilDraft, econ,
  };
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  });
  useEffect(
    () => () => {
      if (unsavedRef.current) writeDraft(draftKey, snapshotRef.current);
    },
    [draftKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    const [lng, lat] = field.centroid;
    void fetch(`/api/field/${field.id}/soil?lng=${lng}&lat=${lat}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Soil map unavailable");
        return response.json() as Promise<{ soil: SoilProfile | null }>;
      })
      .then(({ soil: estimate }) => {
        setSoilMap(estimate);
        setSoilMapStatus(estimate ? "ready" : "unavailable");
        if (estimate) {
          setSoilPh((cur) => (cur === "" && estimate.ph != null ? estimate.ph.toFixed(1) : cur));
          setSoilTexture((cur) => (cur === "" && estimate.texture ? estimate.texture : cur));
          setAuto((a) => ({
            ph: a.ph || estimate.ph != null,
            texture: a.texture || Boolean(estimate.texture),
          }));
        }
      })
      .catch(() => { if (!controller.signal.aborted) setSoilMapStatus("unavailable"); });
    return () => controller.abort();
  }, [field.id, field.centroid]);

  const region = field.region && field.region !== "unsupported" ? field.region : null;
  const cropChoices = useMemo(() => {
    const ids = new Set<string>(region ? strategyCrops(region).map((c) => c.id) : strategyCrops().map((c) => c.id));
    for (const s of rotations[0]?.slots ?? []) if (s.cropId) ids.add(s.cropId);
    const crops = new Map<string, NonNullable<ReturnType<typeof getCropById>>>();
    for (const id of ids) {
      const crop = getCropById(id);
      if (crop) crops.set(crop.id, crop);
    }
    return [...crops.values()];
  }, [region, rotations]);

  const touch = () => {
    unsavedRef.current = true;
    setSaved(false);
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
    // Ask for each missing part by name rather than letting the schema report the first problem it finds.
    if (value === undefined || value === "") {
      setError(`Enter the ${copy.profile.soilProperty[d.property].toLowerCase()} you measured.`);
      return;
    }
    if (!d.date) {
      setError("Pick the date the soil was measured.");
      return;
    }
    if (!d.method) {
      setError("Choose how it was measured: lab, field kit, map or your own estimate.");
      return;
    }
    if (!d.source.trim()) {
      setError("Say where this value came from, such as the lab name or “my own test”.");
      return;
    }
    const candidate = {
      id: crypto.randomUUID(),
      property: d.property,
      value,
      units: SOIL_UNITS[d.property],
      depthCm: [num(d.depthFrom) ?? 0, num(d.depthTo) ?? 0] as [number, number],
      date: d.date,
      method: d.method,
      source: d.source,
    };
    const parsed = soilObservationSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the measurement.");
      return;
    }
    setError(null);
    touch();
    setSoil([...soil, parsed.data]);
    if (d.property === "ph") { setSoilPh(String(parsed.data.value)); setAuto((a) => ({ ...a, ph: false })); }
    if (d.property === "texture") { setSoilTexture(String(parsed.data.value)); setAuto((a) => ({ ...a, texture: false })); }
    if (d.property === "salinity") setSoilSalinity(String(parsed.data.value));
    setSoilDraft(blankSoil());
  };

  const removeSoil = (id: string) => {
    touch();
    const target = soil.find((x) => x.id === id);
    const next = soil.filter((x) => x.id !== id);
    setSoil(next);
    if (target?.property === "ph") {
      const remaining = next.find((x) => x.property === "ph");
      if (remaining && typeof remaining.value === "number") setSoilPh(remaining.value.toString());
      else if (field.soilOverride?.ph !== undefined) setSoilPh(field.soilOverride.ph.toString());
      else setSoilPh("");
    }
    if (target?.property === "texture") {
      const remaining = next.find((x) => x.property === "texture");
      if (remaining && typeof remaining.value === "string") setSoilTexture(remaining.value);
      else if (field.soilOverride?.texture) setSoilTexture(field.soilOverride.texture);
      else setSoilTexture("");
    }
    if (target?.property === "salinity") {
      const remaining = next.find((x) => x.property === "salinity");
      if (remaining && typeof remaining.value === "number") setSoilSalinity(remaining.value.toString());
      else if (field.soilOverride?.salinityDsM !== undefined) setSoilSalinity(field.soilOverride.salinityDsM.toString());
      else setSoilSalinity("");
    }
  };

  const addEconRow = (cropId: string) => {
    if (!cropId || econ.some((e) => e.cropId === cropId)) return;
    touch();
    const ref = getRealWorldCropEconomics(cropId);
    setEcon([
      ...econ,
      {
        cropId,
        yieldLo: ref?.yieldKgHa?.[0]?.toString() ?? "",
        yieldHi: ref?.yieldKgHa?.[1]?.toString() ?? "",
        priceLo: ref?.priceMmkPerKg?.[0]?.toString() ?? "",
        priceHi: ref?.priceMmkPerKg?.[1]?.toString() ?? "",
        costLo: ref?.costMmkPerHa?.[0]?.toString() ?? "",
        costHi: ref?.costMmkPerHa?.[1]?.toString() ?? "",
        source: ref?.source ?? "",
      },
    ]);
  };

  const loadRealWorldPrices = () => {
    touch();
    const targetCropIds = new Set<string>();
    for (const s of rotations[0]?.slots ?? []) if (s.cropId) targetCropIds.add(s.cropId);
    for (const e of econ) targetCropIds.add(e.cropId);
    if (targetCropIds.size === 0) {
      for (const c of cropChoices) targetCropIds.add(c.id);
    }
    const filled: EconDraft[] = [...targetCropIds].map((id) => {
      const ref = getRealWorldCropEconomics(id);
      const existing = econ.find((e) => e.cropId === id);
      return {
        cropId: id,
        yieldLo: existing?.yieldLo || ref?.yieldKgHa?.[0]?.toString() || "",
        yieldHi: existing?.yieldHi || ref?.yieldKgHa?.[1]?.toString() || "",
        priceLo: ref?.priceMmkPerKg?.[0]?.toString() || existing?.priceLo || "",
        priceHi: ref?.priceMmkPerKg?.[1]?.toString() || existing?.priceHi || "",
        costLo: existing?.costLo || ref?.costMmkPerHa?.[0]?.toString() || "",
        costHi: existing?.costHi || ref?.costMmkPerHa?.[1]?.toString() || "",
        source: ref?.source || existing?.source || "",
      };
    });
    setEcon(filled);
  };
  const patchEcon = (cropId: string, patch: Partial<EconDraft>) => {
    touch();
    setEcon(econ.map((e) => (e.cropId === cropId ? { ...e, ...patch } : e)));
  };

  const save = async (openConditions = false) => {
    setError(null);
    setSaving(true);
    try {
      const phNum = auto.ph ? undefined : num(soilPh);
      if (phNum !== undefined && (phNum < 3 || phNum > 10)) {
        setError("Soil pH must be between 3 and 10.");
        setSaving(false);
        return;
      }
      const salNum = num(soilSalinity);
      if (salNum !== undefined && (salNum < 0 || salNum > 100)) {
        setError("Soil salinity must be between 0 and 100 dS/m.");
        setSaving(false);
        return;
      }
      const texVal = auto.texture ? undefined : ((soilTexture as TextureClass) || undefined);

      const hasOverride =
        phNum !== undefined ||
        texVal !== undefined ||
        salNum !== undefined ||
        field.soilOverride?.ocPct !== undefined ||
        field.soilOverride?.testedOn !== undefined;

      const soilOverride: SoilOverride | undefined = hasOverride
        ? {
            ...field.soilOverride,
            ph: phNum,
            texture: texVal,
            salinityDsM: salNum,
          }
        : undefined;

      let updatedSoil = [...soil];
      if (phNum !== undefined) {
        const idx = updatedSoil.findIndex((o) => o.property === "ph");
        if (idx >= 0) updatedSoil[idx] = { ...updatedSoil[idx], value: phNum };
      } else {
        updatedSoil = updatedSoil.filter((o) => o.property !== "ph");
      }
      if (texVal !== undefined) {
        const idx = updatedSoil.findIndex((o) => o.property === "texture");
        if (idx >= 0) updatedSoil[idx] = { ...updatedSoil[idx], value: texVal };
      } else {
        updatedSoil = updatedSoil.filter((o) => o.property !== "texture");
      }
      if (salNum !== undefined) {
        const idx = updatedSoil.findIndex((o) => o.property === "salinity");
        if (idx >= 0) updatedSoil[idx] = { ...updatedSoil[idx], value: salNum };
      } else {
        updatedSoil = updatedSoil.filter((o) => o.property !== "salinity");
      }

      const orderedIncluded = order.filter((p) => included.has(p));
      const priorities = orderedIncluded.length ? prioritiesSchema.parse({ order: orderedIncluded, weights: {}, soil: included.has("soil") && soilSub.size ? [...soilSub] : undefined, income: included.has("income") && incomeSub.size ? [...incomeSub] : undefined }) : undefined;
      const constraints: FarmConstraints = constraintsSchema.parse({
        irrigation: !field.constraints?.irrigation && irrigation === field.irrigation && num(irrigationMm) === undefined && num(pumpRate) === undefined ? undefined : {
          access: irrigation,
          amountMm: num(irrigationMm),
          // The capacity limit applies only when all three pump figures are given; a partial set is dropped, never guessed.
          pump: irrigation !== "none" && num(pumpRate) !== undefined && num(pumpEff) !== undefined && num(pumpHours) !== undefined ? { rateM3H: num(pumpRate)!, efficiency: (num(pumpEff)! > 1 ? num(pumpEff)! / 100 : num(pumpEff)!), hoursAvailable: num(pumpHours)! } : undefined,
        },
        soilDepletionAtPlantingMm: num(depletionMm),
        paddy: num(bundMm) !== undefined && num(seepage) !== undefined ? { bundMm: num(bundMm)!, seepagePercolationMmDay: num(seepage)! } : undefined,
        equipment: equipment.size ? [...equipment] : undefined,
        labour: labour || undefined,
        marketAccess: market || undefined,
        preferredCropIds: preferred.length ? preferred : undefined,
        excludedCropIds: excluded.length ? excluded : undefined,
        plantingWindow: winFrom && winTo ? { from: monthDay(winFrom), to: monthDay(winTo) } : undefined,
        canSell: asked.market ? canSell : undefined,
        mustGrow: asked.household ? mustGrow : undefined,
        peakMonths: asked.labour ? [...peak].sort((a, b) => a - b) : undefined,
        land: asked.land ? { tenure, leaseYears: tenure === "leased" ? num(leaseYears) : undefined } : undefined,
      });
      const economics: CropEconomics[] = [];
      for (const e of econ) {
        const row = {
          cropId: e.cropId,
          yieldKgHa: pair(e.yieldLo, e.yieldHi),
          priceMmkPerKg: pair(e.priceLo, e.priceHi),
          costMmkPerHa: pair(e.costLo, e.costHi),
          source: e.source.trim() || "Your estimate",
        };
        if (!row.yieldKgHa && !row.priceMmkPerKg && !row.costMmkPerHa) continue; // an empty row is dropped, not stored as zeros
        economics.push(economicsSchema.parse(row));
      }
      await update(field.id, { priorities, constraints, irrigation, soilOverride, soilObservations: updatedSoil, economics });
      unsavedRef.current = false;
      clearDraft(draftKey);
      setSoil(updatedSoil);
      setSaved(true);
      if (openConditions) router.push(`/fields/${field.id}/compare`);
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
      <FieldPageHeader
        title={copy.profile.title}
        summary="Tell us what matters to you. Add local details only when you know them."
      />

      <nav aria-label="On this page" className="flex flex-wrap gap-2 text-label">
        <a href="#priorities" className="inline-flex min-h-tap items-center gap-2 rounded-md border border-line px-3 text-field"><Icon name="priorities" />Priorities</a>
        <a href="#constraints" className="inline-flex min-h-tap items-center gap-2 rounded-md border border-line px-3 text-field"><Icon name="water" />Water and work</a>
        <a href="#soil" className="inline-flex min-h-tap items-center gap-2 rounded-md border border-line px-3 text-field"><Icon name="soil" />Soil</a>
      </nav>

      <Panel as="section" aria-labelledby="priorities" className="flex flex-col gap-3 p-4 sm:p-6">
        <PanelHeader id="priorities" title={<span className="inline-flex items-center gap-2"><Icon name="priorities" />{copy.profile.prioritiesTitle}</span>} description="Choose what matters and put it in order. The first one counts most." />
        <PriorityOrder
          value={order.filter((x) => included.has(x))}
          onChange={(next) => {
            touch();
            setOrder([...next, ...PRIORITY_IDS.filter((x) => !next.includes(x))]);
            setIncluded(new Set(next));
          }}
          renderDetail={(id) =>
        (id === "soil" || id === "income") ? (
                <fieldset className="m-0 flex w-full basis-full flex-col gap-0 border-0 p-0 pb-2 pl-6">
                  <legend className="sr-only">{copy.profile.priority[id]}: {copy.profile.subHelp}</legend>
                  <p className="m-0 text-body-sm text-ink-muted">{copy.profile.subHelp}</p>
                  {(id === "soil" ? (Object.keys(copy.profile.soilSub) as SoilSub[]) : (Object.keys(copy.profile.incomeSub) as IncomeSub[])).map((sub) => (
                    <div key={sub} className="flex flex-wrap items-center gap-x-2">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={id === "soil" ? soilSub.has(sub as SoilSub) : incomeSub.has(sub as IncomeSub)}
                            onChange={() => (id === "soil" ? toggle(soilSub, sub as SoilSub, setSoilSub) : toggle(incomeSub, sub as IncomeSub, setIncomeSub))}
                          />
                        }
                        label={id === "soil" ? copy.profile.soilSub[sub as SoilSub] : copy.profile.incomeSub[sub as IncomeSub]}
                      />
                      {SUB_CRITERION[sub] === undefined ? <span className="text-body-sm text-ink-muted">{copy.profile.subNoMeasure}</span> : null}
                    </div>
                  ))}
                </fieldset>
              ) : null
          }
        />
      </Panel>

      <Panel as="section" aria-labelledby="constraints" className="flex flex-col gap-4 p-4 sm:p-6">
        <PanelHeader id="constraints" title={<span className="inline-flex items-center gap-2"><Icon name="water" />Water and work</span>} />
        <Segmented legend={copy.profile.irrigationLabel} value={irrigation} onChange={(v) => { touch(); setIrrigation(v); }} options={IRRIGATION_OPTIONS} />
        {irrigation !== "none" ? (
          <TextField label={copy.profile.irrigationAmountLabel} value={irrigationMm} onChange={(e) => { touch(); setIrrigationMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText="Optional. A rough figure is fine." />
        ) : null}
        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="mb-1 inline-flex items-center gap-2 text-label text-ink"><Icon name="equipment" />{copy.profile.equipmentLabel}</legend>
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
        <div className="flex flex-col gap-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <MonthDayField label={copy.profile.windowFrom} value={winFrom} onChange={(v) => { touch(); setWinFrom(v); }} />
            <MonthDayField label={copy.profile.windowTo} value={winTo} onChange={(v) => { touch(); setWinTo(v); }} />
          </div>
          <p className="m-0 text-body-sm text-ink-muted">Optional. Only if you have a usual planting time. Both ends are needed to keep it.</p>
        </div>
        <Disclosure
          title="Advanced water and paddy settings"
          hint="Optional"
          defaultOpen={[pumpRate, pumpEff, pumpHours, depletionMm, bundMm, seepage].some((v) => v !== "")}
        >
          {irrigation !== "none" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={copy.profile.pumpRateLabel} value={pumpRate} onChange={(e) => { touch(); setPumpRate(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText="Water your pump moves per hour." />
              <TextField label={copy.profile.pumpHoursLabel} value={pumpHours} onChange={(e) => { touch(); setPumpHours(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText="Hours per season the pump can run." />
              <TextField label={copy.profile.pumpEfficiencyLabel} value={pumpEff} onChange={(e) => { touch(); setPumpEff(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, max: 100, step: "any" } }} helperText="Type 60 or 0.6. Fill all three pump boxes or none." />
            </div>
          ) : null}
          <TextField label={copy.profile.soilDepletionLabel} value={depletionMm} onChange={(e) => { touch(); setDepletionMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText="Leave blank if you do not know. The app will estimate it or say what is missing." />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={copy.profile.paddyBundLabel} value={bundMm} onChange={(e) => { touch(); setBundMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText="Paddy only. Fill both paddy boxes or neither." />
            <TextField label={copy.profile.paddySeepageLabel} value={seepage} onChange={(e) => { touch(); setSeepage(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText="Paddy only. Water lost through the soil each day." />
          </div>
        </Disclosure>
      </Panel>

      <Panel as="details" id="limits" className="p-4 sm:p-6">
        <summary className="min-h-tap cursor-pointer text-headline text-ink"><Icon name="stack" className="mr-2 inline" />Other limits <span className="block text-body-sm font-normal text-ink-muted">Optional: buyers, household needs, busy months and land</span></summary>
        <div className="flex flex-col gap-4 pt-4">
        {(
          [
            ["market", "What I can sell", "Crops you know a buyer for.", "market"],
            ["household", "Household needs", "Crops your household must grow for itself.", "fields"],
            ["labour", "Busy months", "Months when work is already heavy.", "calendar"],
            ["land", "Land and lease", "Whether you own the land or rent it.", "pin"],
          ] as const
        ).map(([key, title, help, icon]) => (
          <fieldset key={key} className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="inline-flex items-center gap-2 text-label text-ink"><Icon name={icon} />{title}</legend>
            <FormControlLabel
              control={<Checkbox checked={asked[key]} onChange={() => { touch(); setAsked({ ...asked, [key]: !asked[key] }); }} />}
              label={asked[key] ? help : `${help} Not asked yet. Tick to answer.`}
            />
            {asked[key] && key === "market" ? (
              <TextField select label="Crops I can sell" value={canSell} onChange={(e) => { touch(); setCanSell(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value); }} size="small" slotProps={{ select: { multiple: true } }}>
                {cropChoices.map((c) => <MenuItem key={c.id} value={c.id}>{c.names.common}</MenuItem>)}
              </TextField>
            ) : null}
            {asked[key] && key === "household" ? (
              <TextField select label="Crops we must grow" value={mustGrow} onChange={(e) => { touch(); setMustGrow(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value); }} size="small" slotProps={{ select: { multiple: true } }}>
                {cropChoices.map((c) => <MenuItem key={c.id} value={c.id}>{c.names.common}</MenuItem>)}
              </TextField>
            ) : null}
            {asked[key] && key === "labour" ? (
              <div className="flex flex-wrap gap-x-3">
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                  <FormControlLabel key={m} control={<Checkbox checked={peak.has(i + 1)} onChange={() => toggle(peak, i + 1, setPeak)} />} label={m} />
                ))}
              </div>
            ) : null}
            {asked[key] && key === "land" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Segmented legend="Tenure" value={tenure} onChange={(v) => { touch(); setTenure(v); }} options={[{ value: "owned", label: "I own it" }, { value: "leased", label: "I rent it" }]} />
                {tenure === "leased" ? <TextField label="Lease years left" value={leaseYears} onChange={(e) => { touch(); setLeaseYears(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} /> : null}
              </div>
            ) : null}
          </fieldset>
        ))}
        </div>
      </Panel>

      <Panel as="section" aria-labelledby="soil" className="flex flex-col gap-4 p-4 sm:p-6">
        <PanelHeader id="soil" title={<span className="inline-flex items-center gap-2"><Icon name="soil" />Soil around your field</span>} description="Map estimates appear automatically. Your own test is more reliable for this field." />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3.5">
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="ph" />Soil acidity</span>
              <SourceBadge loading={soilMapStatus === "loading" && !soilPh} kind={!soilPh ? "none" : auto.ph ? "estimate" : "yours"} />
            </div>
            <TextField
              label="Soil acidity (pH)"
              value={soilPh}
              onChange={(e) => {
                touch();
                setAuto((a) => ({ ...a, ph: false }));
                setSoilPh(e.target.value);
              }}
              size="small"
              type="number"
              placeholder={soilMapStatus === "loading" ? "Loading map…" : "e.g. 6.5"}
              slotProps={{ htmlInput: { min: 3, max: 10, step: 0.1 } }}
              helperText={auto.ph ? "Filled from the map. Type your own to replace it." : soilPh ? (soilMap?.ph != null ? `Your value (map said ${soilMap.ph.toFixed(1)})` : "Your value") : "Not known. Enter a pH from a test."}
            />
            {!auto.ph && soilPh && soilMap?.ph != null ? (
              <Button variant="quiet" onClick={() => { touch(); setSoilPh(soilMap.ph!.toFixed(1)); setAuto((a) => ({ ...a, ph: true })); }}><Icon name="reset" size={16} />Use map estimate</Button>
            ) : null}
            <p className="m-0 text-body-sm text-ink-muted">Affects how crops take up nutrients.</p>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3.5">
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="clay" />Soil texture</span>
              <SourceBadge loading={soilMapStatus === "loading" && !soilTexture} kind={!soilTexture ? "none" : auto.texture ? "estimate" : "yours"} />
            </div>
            <TextField
              select
              label="Soil texture"
              value={soilTexture}
              onChange={(e) => {
                touch();
                setAuto((a) => ({ ...a, texture: false }));
                setSoilTexture(e.target.value);
              }}
              size="small"
              helperText={auto.texture ? "Filled from the map. Pick your own to replace it." : soilTexture ? (soilMap?.texture ? `Your value (map said ${soilMap.texture})` : "Your value") : "Needs a soil test or observation"}
            >
              <MenuItem value="">
                <em>Not known</em>
              </MenuItem>
              {TEXTURE_CLASSES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </MenuItem>
              ))}
            </TextField>
            {!auto.texture && soilTexture && soilMap?.texture ? (
              <Button variant="quiet" onClick={() => { touch(); setSoilTexture(soilMap.texture!); setAuto((a) => ({ ...a, texture: true })); }}><Icon name="reset" size={16} />Use map estimate</Button>
            ) : null}
            <p className="m-0 text-body-sm text-ink-muted">Shows whether soil is sandy, loamy or clay-rich.</p>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3.5">
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="salinity" />Soil salinity</span>
              <SourceBadge kind={soilSalinity ? "yours" : "none"} />
            </div>
            <TextField
              label="Soil salinity (dS/m)"
              value={soilSalinity}
              onChange={(e) => {
                touch();
                setSoilSalinity(e.target.value);
              }}
              size="small"
              type="number"
              placeholder="e.g. 1.2"
              slotProps={{ htmlInput: { min: 0, max: 50, step: 0.1 } }}
              helperText={soilSalinity ? `Your value (${soilSalinity} dS/m)` : "Salt cannot be measured from the map"}
            />
            <p className="m-0 text-body-sm text-ink-muted">Only a soil test can show this.</p>
          </div>
        </div>
        {soilMap ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-sunken p-3.5">
            <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="estimate" />Also estimated from the map</span>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-5">
              {(
                [
                  ["organic", "Organic carbon", soilMap.socGKg != null ? `${(soilMap.socGKg / 10).toFixed(1)} %` : null],
                  ["clay", "Clay", soilMap.clayPct != null ? `${Math.round(soilMap.clayPct)} %` : null],
                  ["soil", "Sand", soilMap.sandPct != null ? `${Math.round(soilMap.sandPct)} %` : null],
                  ["nitrogen", "Nitrogen", soilMap.nitrogenGKg != null ? `${soilMap.nitrogenGKg.toFixed(1)} g/kg` : null],
                  ["water", "Water held", soilMap.fieldCapacityFrac != null && soilMap.wiltingPointFrac != null ? `${Math.round((soilMap.fieldCapacityFrac - soilMap.wiltingPointFrac) * 1000)} mm/m` : null],
                ] as const
              ).filter((x) => x[2] !== null).map(([icon, label, value]) => (
                <li key={label} className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-2">
                  <Icon name={icon} className="shrink-0 text-ink-muted" />
                  <span className="flex flex-col leading-tight"><span className="text-source text-ink-muted">{label}</span><span className="tabular text-label text-ink">{value}</span></span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="m-0 text-source text-ink-muted">{soilMapStatus === "ready" ? "Source: ISRIC SoilGrids v2 · 250 m area · 0–30 cm depth. These are regional estimates, not field tests." : soilMapStatus === "loading" ? "Reading the soil map for your field. This can take up to 30 seconds the first time." : "The soil map has no estimate for this exact spot, which can happen near towns or water. Enter your own values."}</p>
        <details className="group border-t border-line pt-3">
          <summary className="flex min-h-tap cursor-pointer items-center gap-2 text-label text-field"><Icon name="add" />Add your soil test or observation</summary>
        {soil.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {soil.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface p-3 text-body-sm">
                <span className="text-ink">
                  <strong>{copy.profile.soilProperty[o.property]}</strong>: {o.value} {o.units}, {o.depthCm[0]} to {o.depthCm[1]} cm, {o.date}, {copy.profile.soilMethod[o.method]}, {o.source}
                </span>
                <Button variant="quiet" onClick={() => removeSoil(o.id)}>
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
          <TextField label={`Value${SOIL_UNITS[soilDraft.property] ? ` (${SOIL_UNITS[soilDraft.property]})` : ""}`} value={soilDraft.value} onChange={(e) => setSoilDraft({ ...soilDraft, value: e.target.value })} size="small" required helperText="Required. The number on the test." />
          <TextField label="Depth from (cm)" value={soilDraft.depthFrom} onChange={(e) => setSoilDraft({ ...soilDraft, depthFrom: e.target.value })} size="small" type="number" helperText="Top layer starts at 0." />
          <TextField label="Depth to (cm)" value={soilDraft.depthTo} onChange={(e) => setSoilDraft({ ...soilDraft, depthTo: e.target.value })} size="small" type="number" helperText="20 is the usual topsoil depth." />
          <TextField label="Date measured" value={soilDraft.date} onChange={(e) => setSoilDraft({ ...soilDraft, date: e.target.value })} size="small" type="date" required slotProps={{ inputLabel: { shrink: true } }} helperText="The day of the test, not today." />
          <TextField select label="How it was measured" value={soilDraft.method} onChange={(e) => setSoilDraft({ ...soilDraft, method: e.target.value as SoilDraftState["method"] })} size="small" required>
            <MenuItem value="" disabled>
              Choose one
            </MenuItem>
            {(Object.keys(copy.profile.soilMethod) as Array<SoilObservation["method"]>).map((m) => (
              <MenuItem key={m} value={m}>
                {copy.profile.soilMethod[m]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Where it came from" value={soilDraft.source} onChange={(e) => setSoilDraft({ ...soilDraft, source: e.target.value })} size="small" required className="sm:col-span-2" helperText="Required. For example the lab name, or “my own test”." />
        </div>
        <div>
          <Button variant="secondary" onClick={addSoil}>
            {copy.profile.addSoil}
          </Button>
        </div>
        </details>
      </Panel>

      <details className="rounded-md border border-line bg-surface-raised p-4 sm:p-6" open={econ.length > 0}>
        <summary className="min-h-tap cursor-pointer text-headline text-ink">
          <Icon name="price" className="mr-2 inline" />Prices, yields and costs{" "}
          <span className="block text-body-sm font-normal text-ink-muted">
            Real-world market benchmark data (MMK/kg) with editable ranges
          </span>
        </summary>
        <div className="flex flex-col gap-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-sunken p-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-label text-ink">Myanmar Commodity Market Benchmarks (2024–2026)</span>
              <span className="text-body-sm text-ink-muted">
                Bayintnaung Wholesale, MPBMSMA, and Department of Agriculture indicative farm-gate prices.
              </span>
            </div>
            <Button variant="secondary" size="md" onClick={loadRealWorldPrices} className="w-full sm:w-auto justify-center">
              <Icon name="estimate" size={16} />Fill with market estimates
            </Button>
          </div>

          {econ.length === 0 ? (
            <p className="m-0 text-body-sm text-ink-muted">
              No crop prices recorded yet. Choose a crop below or click &ldquo;Load real-world market prices&rdquo; to populate current Myanmar market benchmarks.
            </p>
          ) : null}

          {econ.map((e) => {
            const crop = getCropById(e.cropId);
            const refEcon = getRealWorldCropEconomics(e.cropId);
            return (
              <div key={e.cropId} className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="m-0 text-label text-ink">
                    {crop?.names.common ?? e.cropId} {refEcon?.burmeseName ? `(${refEcon.burmeseName})` : ""}
                  </p>
                  {refEcon?.traditionalUnitNote ? (
                    <span className="text-source text-ink-muted">{refEcon.traditionalUnitNote}</span>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([["yield", copy.profile.yieldLabel, "yieldLo", "yieldHi"], ["price", copy.profile.priceLabel, "priceLo", "priceHi"], ["cost", copy.profile.costLabel, "costLo", "costHi"]] as const).map(([k, label, lo, hi]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-body-sm text-ink-muted">{label}</span>
                      <div className="grid grid-cols-2 gap-2">
                        <TextField label={copy.profile.lowLabel} value={e[lo]} onChange={(ev) => patchEcon(e.cropId, { [lo]: ev.target.value })} placeholder={refEcon?.[ECON_KEY[k]]?.[0]?.toString()} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} />
                        <TextField label={copy.profile.highLabel} value={e[hi]} onChange={(ev) => patchEcon(e.cropId, { [hi]: ev.target.value })} placeholder={refEcon?.[ECON_KEY[k]]?.[1]?.toString()} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} />
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
        </div>
      </details>

      {error ? <Message tone="problem" role="alert" title="This did not save">{error}</Message> : null}
      {saved ? <Message tone="success" role="status" title={copy.profile.saved} /> : null}

      <ActionBar>
        <Button variant="primary" size="lg" className="flex-1" onClick={() => void save(true)} disabled={saving}>
          {copy.profile.next}
          <Icon name="next" />
        </Button>
      </ActionBar>
    </>
  );
}
