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
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionBar } from "@/components/ui/action-bar";
import { Icon } from "@/components/ui/icon";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { copy as copyKeys } from "@/lib/copy/en";
import { useAppCopy } from "@/lib/store/locale-store";
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
/** Only the keys are read from the English copy here. Every visible word comes from useAppCopy(). */
const EQUIPMENT = Object.keys(copyKeys.profile.equipment) as Array<keyof typeof copyKeys.profile.equipment>;
const SOIL_PROPERTIES = Object.keys(copyKeys.profile.soilProperty) as SoilProperty[];
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
const IRRIGATION_KEYS = Object.keys(copyKeys.irrigation) as Irrigation[];

/** Small status pill using the three words: You told us, We guessed, Not answered. */
function SourceBadge({ kind, loading }: { kind: "yours" | "estimate" | "none"; loading?: boolean }) {
  const f = useAppCopy().profile.form;
  if (loading) return <span className="inline-flex items-center gap-1 text-source text-ink-muted"><Icon name="satellite" size={14} />{f.badgeLoading}</span>;
  if (kind === "yours") return <span className="inline-flex items-center gap-1 rounded bg-field-soft px-1.5 py-0.5 text-source font-medium text-field"><Icon name="done" size={14} />{f.badgeYours}</span>;
  if (kind === "estimate") return <span className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-source font-medium text-ink-muted"><Icon name="estimate" size={14} />{f.badgeGuess}</span>;
  return <span className="inline-flex items-center gap-1 text-source text-ink-muted"><Icon name="close" size={14} />{f.badgeNone}</span>;
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

const LEGEND_KEY = "fieldshift.profile-legend.v1";

/** Today as YYYY-MM-DD in the farmer's own time zone, used when a soil test has no date. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The top 20 cm is the usual topsoil test depth, so it is the one default kept here. */
const blankSoil = (): SoilDraftState => ({ property: "ph", value: "", depthFrom: "0", depthTo: "20", date: "", method: "", source: "" });

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * A month and day, stored as "MM-DD" (the same value the planning engine has always read).
 * Partial entries stay in the box; the stored value is only set once the day fits the month.
 */
function MonthDayField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  const f = useAppCopy().profile.form;
  const MONTHS = f.months;
  const [parts, setParts] = useState(() => {
    const m = /^(\d{2})-(\d{2})$/.exec(value);
    return { mm: m ? m[1] : "", dd: m ? String(Number(m[2])) : "" };
  });
  const maxDay = parts.mm ? DAYS_IN_MONTH[Number(parts.mm) - 1] : 31;
  const day = Number(parts.dd);
  const dayFits = parts.dd === "" || (Number.isInteger(day) && day >= 1 && day <= maxDay);
  const dayError = !dayFits
    ? parts.mm
      ? f.dayMax(MONTHS[Number(parts.mm) - 1], maxDay)
      : f.dayRange
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
          label={f.month}
          value={parts.mm}
          onChange={(e) => update({ ...parts, mm: e.target.value })}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        >
          <option value="" disabled>
            {f.choose}
          </option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </TextField>
        <TextField
          size="small"
          label={f.day}
          type="number"
          value={parts.dd}
          onChange={(e) => update({ ...parts, dd: e.target.value })}
          error={!dayFits}
          helperText={dayError ?? (parts.mm && !parts.dd ? f.addDay : undefined)}
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
  const text = useAppCopy();

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);
  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={text.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!field) {
    return (
      <EmptyState title={text.profile.form.notFoundTitle} body={text.profile.form.notFoundBody}>
        <Link href="/" className={buttonClass("primary")}>
          {text.profile.form.backToFields}
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
  const text = useAppCopy();
  const t = text.profile;
  const f = t.form;
  const lim = text.limits;
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
  // True once something has changed since the last save. The save bar only shows then.
  const [dirty, setDirty] = useState(draft !== undefined);
  // The pump and paddy figures stay hidden until the farmer says they have a record.
  const [pumpRecord, setPumpRecord] = useState(() => [pumpRate, pumpEff, pumpHours, depletionMm].some((v) => v !== ""));
  const [paddyRecord, setPaddyRecord] = useState(() => [bundMm, seepage].some((v) => v !== ""));
  // The extra sections start open only when the farmer already gave an answer in them.
  const [moreOpen] = useState(
    () =>
      equipment.size > 0 ||
      market !== "" ||
      preferred.length > 0 ||
      excluded.length > 0 ||
      winFrom !== "" ||
      winTo !== "" ||
      pumpRecord ||
      paddyRecord,
  );
  const [fineOpen] = useState(() => ({ soil: soilSub.size > 0, income: incomeSub.size > 0 }));
  const [limitsOpen, setLimitsOpen] = useState(() => Object.values(asked).some(Boolean));
  // Soil fields stay folded behind one line until the farmer wants to give their own values.
  const [soilOpen, setSoilOpen] = useState(() => soilPh !== "" || soilTexture !== "" || soilSalinity !== "" || soil.length > 0);
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null);
  const [legendSeen, setLegendSeen] = useState(() => {
    try {
      return localStorage.getItem(LEGEND_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismissLegend = () => {
    setLegendSeen(true);
    try {
      localStorage.setItem(LEGEND_KEY, "1");
    } catch {
      // Without storage the note simply shows again next visit.
    }
  };
  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(id);
  }, [undo]);
  useEffect(() => {
    // The hash only exists in the browser, so it cannot seed the initial state without a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof window !== "undefined" && window.location.hash === "#limits") setLimitsOpen(true);
  }, []);

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
    setDirty(true);
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
    // Only the value is needed. Date, method and source have honest defaults so they never block saving.
    if (value === undefined || value === "") {
      setError(f.enterValue(t.soilProperty[d.property].toLowerCase()));
      return;
    }
    const candidate = {
      id: crypto.randomUUID(),
      property: d.property,
      value,
      units: SOIL_UNITS[d.property],
      depthCm: [num(d.depthFrom) ?? 0, num(d.depthTo) ?? 20] as [number, number],
      date: d.date || today(),
      method: d.method || ("farmer-estimate" as const),
      source: d.source.trim() || f.sourceDefault,
    };
    const parsed = soilObservationSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? f.checkMeasurement);
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
    const before = { soil, soilPh, soilTexture, soilSalinity, auto };
    if (target) {
      setUndo({
        label: f.removedMeasure(t.soilProperty[target.property]),
        restore: () => {
          setSoil(before.soil);
          setSoilPh(before.soilPh);
          setSoilTexture(before.soilTexture);
          setSoilSalinity(before.soilSalinity);
          setAuto(before.auto);
          setUndo(null);
        },
      });
    }
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
  const removeEcon = (cropId: string) => {
    touch();
    const before = econ;
    setEcon(econ.filter((x) => x.cropId !== cropId));
    setUndo({
      label: f.removedEcon(getCropById(cropId)?.names.common ?? cropId),
      restore: () => {
        setEcon(before);
        setUndo(null);
      },
    });
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
        setError(f.phRange);
        setSaving(false);
        return;
      }
      const salNum = num(soilSalinity);
      if (salNum !== undefined && (salNum < 0 || salNum > 100)) {
        setError(f.salRange);
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

      // Figures behind an unticked "I have a record" box are not used or saved.
      const pump = (v: string) => (pumpRecord ? num(v) : undefined);
      const paddy = (v: string) => (paddyRecord ? num(v) : undefined);
      const orderedIncluded = order.filter((p) => included.has(p));
      const priorities = orderedIncluded.length ? prioritiesSchema.parse({ order: orderedIncluded, weights: {}, soil: included.has("soil") && soilSub.size ? [...soilSub] : undefined, income: included.has("income") && incomeSub.size ? [...incomeSub] : undefined }) : undefined;
      const constraints: FarmConstraints = constraintsSchema.parse({
        irrigation: !field.constraints?.irrigation && irrigation === field.irrigation && num(irrigationMm) === undefined && pump(pumpRate) === undefined ? undefined : {
          access: irrigation,
          amountMm: num(irrigationMm),
          // The capacity limit applies only when all three pump figures are given; a partial set is dropped, never guessed.
          pump: irrigation !== "none" && pump(pumpRate) !== undefined && pump(pumpEff) !== undefined && pump(pumpHours) !== undefined ? { rateM3H: pump(pumpRate)!, efficiency: (pump(pumpEff)! > 1 ? pump(pumpEff)! / 100 : pump(pumpEff)!), hoursAvailable: pump(pumpHours)! } : undefined,
        },
        soilDepletionAtPlantingMm: pump(depletionMm),
        paddy: paddy(bundMm) !== undefined && paddy(seepage) !== undefined ? { bundMm: paddy(bundMm)!, seepagePercolationMmDay: paddy(seepage)! } : undefined,
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
          source: e.source.trim() || f.econDefaultSource,
        };
        if (!row.yieldKgHa && !row.priceMmkPerKg && !row.costMmkPerHa) continue; // an empty row is dropped, not stored as zeros
        economics.push(economicsSchema.parse(row));
      }
      await update(field.id, { priorities, constraints, irrigation, soilOverride, soilObservations: updatedSoil, economics });
      unsavedRef.current = false;
      clearDraft(draftKey);
      setSoil(updatedSoil);
      setSaved(true);
      setDirty(false);
      setUndo(null);
      if (openConditions) router.push(`/fields/${field.id}/compare`);
    } catch (e) {
      setError(
        e instanceof ValidationError
          ? e.message
          : e instanceof Error && "issues" in e
            ? String((e as { issues: Array<{ message: string }> }).issues[0]?.message ?? f.checkEntries)
            : f.saveFailed,
      );
    } finally {
      setSaving(false);
    }
  };

  const phValue = auto.ph ? undefined : num(soilPh);
  const phHardBad = phValue !== undefined && (phValue < 3 || phValue > 10);
  const phUnusual = phValue !== undefined && !phHardBad && (phValue < 3.5 || phValue > 9.5);

  const irrigationOptions = IRRIGATION_KEYS.map((value) => ({ value, label: text.irrigation[value] }));
  const cropSelect = (set: (next: string[]) => void) => (e: { target: { value: unknown } }) => {
    // The returned handler only runs on user input, never during render.
    // eslint-disable-next-line react-hooks/refs
    touch();
    const next = e.target.value;
    set(typeof next === "string" ? next.split(",") : (next as string[]));
  };

  // One line for the soil, so the fields below only open when the farmer wants to give their own values.
  const ownSoil = (!auto.ph && soilPh !== "") || (!auto.texture && soilTexture !== "") || soilSalinity !== "";
  const soilWhat = [soilTexture ? soilTexture.toLowerCase() : "", soilPh ? `pH ${soilPh}` : ""].filter(Boolean).join(", ");
  const soilLine =
    soilMapStatus === "loading" && !soilPh && !soilTexture && !ownSoil
      ? f.soilLoading
      : ownSoil
        ? f.soilYoursLine([soilTexture ? soilTexture.toLowerCase() : "", soilPh ? `pH ${soilPh}` : "", soilSalinity ? `${soilSalinity} dS/m` : ""].filter(Boolean).join(", "))
        : soilWhat
          ? f.soilMapLine(soilWhat)
          : f.soilNoMap;

  return (
    <>
      <FieldPageHeader title={t.title} summary={f.summary} />

      {!legendSeen ? (
        <Message tone="info" title={f.legendTitle} action={<Button variant="quiet" onClick={dismissLegend}>{f.gotIt}</Button>}>
          {f.legendYou} {f.legendGuess} {f.legendNone}
        </Message>
      ) : null}

      <Panel as="section" aria-labelledby="priorities" className="flex flex-col gap-3 p-4 sm:p-6">
        <PanelHeader id="priorities" title={<span className="inline-flex items-center gap-2"><Icon name="priorities" />{t.prioritiesTitle}</span>} description={f.prioritiesIntro} />
        <PriorityOrder
          value={order.filter((x) => included.has(x))}
          onChange={(next) => {
            touch();
            setOrder([...next, ...PRIORITY_IDS.filter((x) => !next.includes(x))]);
            setIncluded(new Set(next));
          }}
          renderDetail={(id) =>
            id === "soil" || id === "income" ? (
              <Disclosure title={f.fineTune} defaultOpen={id === "soil" ? fineOpen.soil : fineOpen.income} className="w-full">
                <fieldset className="m-0 flex w-full flex-col gap-0 border-0 p-0">
                  <legend className="sr-only">{t.priority[id]}: {t.subHelp}</legend>
                  <p className="m-0 text-body-sm text-ink-muted">{t.subHelp}</p>
                  {(id === "soil" ? (Object.keys(t.soilSub) as SoilSub[]) : (Object.keys(t.incomeSub) as IncomeSub[])).map((sub) => (
                    <div key={sub} className="flex flex-wrap items-center gap-x-2">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={id === "soil" ? soilSub.has(sub as SoilSub) : incomeSub.has(sub as IncomeSub)}
                            onChange={() => (id === "soil" ? toggle(soilSub, sub as SoilSub, setSoilSub) : toggle(incomeSub, sub as IncomeSub, setIncomeSub))}
                          />
                        }
                        label={id === "soil" ? t.soilSub[sub as SoilSub] : t.incomeSub[sub as IncomeSub]}
                      />
                      {SUB_CRITERION[sub] === undefined ? <span className="text-body-sm text-ink-muted">{t.subNoMeasure}</span> : null}
                    </div>
                  ))}
                </fieldset>
              </Disclosure>
            ) : null
          }
        />
      </Panel>

      <Panel as="section" aria-labelledby="constraints" className="flex flex-col gap-4 p-4 sm:p-6">
        <PanelHeader id="constraints" title={<span className="inline-flex items-center gap-2"><Icon name="water" />{f.waterWorkTitle}</span>} />
        <Segmented legend={t.irrigationLabel} value={irrigation} onChange={(v) => { touch(); setIrrigation(v); }} options={irrigationOptions} />
        {irrigation !== "none" ? (
          <TextField label={t.irrigationAmountLabel} value={irrigationMm} onChange={(e) => { touch(); setIrrigationMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText={f.irrigationAmountHelp} />
        ) : null}
        <Segmented legend={t.labourLabel} value={(labour || "") as "low" | "medium" | "high"} onChange={(v) => { touch(); setLabour(v); }} options={(["low", "medium", "high"] as const).map((v) => ({ value: v, label: t.levels[v] }))} />

        <Disclosure title={f.moreTitle} hint={f.moreHint} defaultOpen={moreOpen}>
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 inline-flex items-center gap-2 text-label text-ink"><Icon name="equipment" />{t.equipmentLabel}</legend>
            <div className="flex flex-wrap gap-x-4">
              {EQUIPMENT.map((e) => (
                <FormControlLabel key={e} control={<Checkbox checked={equipment.has(e)} onChange={() => toggle(equipment, e as string, setEquipment)} />} label={t.equipment[e]} />
              ))}
            </div>
          </fieldset>
          <Segmented legend={t.marketLabel} value={(market || "") as "poor" | "fair" | "good"} onChange={(v) => { touch(); setMarket(v); }} options={(["poor", "fair", "good"] as const).map((v) => ({ value: v, label: t.levels[v] }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField select label={t.preferredLabel} value={preferred} onChange={cropSelect(setPreferred)} size="small" slotProps={{ select: { multiple: true } }}>
              {cropChoices.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.names.common}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label={t.excludedLabel} value={excluded} onChange={cropSelect(setExcluded)} size="small" slotProps={{ select: { multiple: true } }}>
              {cropChoices.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.names.common}
                </MenuItem>
              ))}
            </TextField>
          </div>
          <div role="group" aria-labelledby="planting-window-heading" aria-describedby="planting-window-help" className="flex flex-col gap-2">
            <h3 id="planting-window-heading" className="m-0 inline-flex items-center gap-2 text-label text-ink"><Icon name="calendar" />{t.windowHeading}</h3>
            <p id="planting-window-help" className="m-0 text-body-sm text-ink-muted">{t.windowExample}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <MonthDayField label={t.windowFrom} value={winFrom} onChange={(v) => { touch(); setWinFrom(v); }} />
              <MonthDayField label={t.windowTo} value={winTo} onChange={(v) => { touch(); setWinTo(v); }} />
            </div>
            <p className="m-0 text-body-sm text-ink-muted">{f.windowOnly}</p>
          </div>

          <FormControlLabel control={<Switch checked={pumpRecord} onChange={() => { touch(); setPumpRecord(!pumpRecord); }} />} label={f.pumpRecord} />
          {pumpRecord ? (
            <div className="flex flex-col gap-4">
              {irrigation !== "none" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label={t.pumpRateLabel} value={pumpRate} onChange={(e) => { touch(); setPumpRate(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText={f.pumpRateHelp} />
                  <TextField label={t.pumpHoursLabel} value={pumpHours} onChange={(e) => { touch(); setPumpHours(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText={f.pumpHoursHelp} />
                  <TextField label={t.pumpEfficiencyLabel} value={pumpEff} onChange={(e) => { touch(); setPumpEff(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, max: 100, step: "any" } }} helperText={f.pumpEffHelp} />
                </div>
              ) : null}
              <TextField label={t.soilDepletionLabel} value={depletionMm} onChange={(e) => { touch(); setDepletionMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText={f.dryHelp} />
            </div>
          ) : null}
          <FormControlLabel control={<Switch checked={paddyRecord} onChange={() => { touch(); setPaddyRecord(!paddyRecord); }} />} label={f.paddyRecord} />
          {paddyRecord ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t.paddyBundLabel} value={bundMm} onChange={(e) => { touch(); setBundMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText={f.bundHelp} />
              <TextField label={t.paddySeepageLabel} value={seepage} onChange={(e) => { touch(); setSeepage(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} helperText={f.seepHelp} />
            </div>
          ) : null}
        </Disclosure>
      </Panel>

      <details id="limits" className="min-w-0 rounded-md border border-line bg-surface-raised p-4 sm:p-6" open={limitsOpen} onToggle={(e) => setLimitsOpen(e.currentTarget.open)}>
        <summary className="min-h-tap cursor-pointer text-headline text-ink"><Icon name="stack" className="mr-2 inline" />{f.limitsTitle} <span className="block text-body-sm font-normal text-ink-muted">{f.limitsSub}</span></summary>
        <div className="flex flex-col gap-4 pt-4">
        {(
          [
            ["market", "market"],
            ["household", "fields"],
            ["labour", "calendar"],
            ["land", "pin"],
          ] as const
        ).map(([key, icon]) => (
          <fieldset key={key} className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="inline-flex items-center gap-2 text-label text-ink"><Icon name={icon} />{lim.labels[key]}</legend>
            <FormControlLabel
              control={<Switch checked={asked[key]} onChange={() => { touch(); setAsked({ ...asked, [key]: !asked[key] }); }} />}
              label={f.limitAdd}
            />
            {!asked[key] ? <p className="m-0 text-body-sm text-ink-muted">{lim.helps[key]}</p> : null}
            {asked[key] && key === "market" ? (
              <TextField select label={f.pickCrops} value={canSell} onChange={cropSelect(setCanSell)} size="small" slotProps={{ select: { multiple: true } }}>
                {cropChoices.map((c) => <MenuItem key={c.id} value={c.id}>{c.names.common}</MenuItem>)}
              </TextField>
            ) : null}
            {asked[key] && key === "household" ? (
              <TextField select label={f.mustGrowLabel} value={mustGrow} onChange={cropSelect(setMustGrow)} size="small" slotProps={{ select: { multiple: true } }}>
                {cropChoices.map((c) => <MenuItem key={c.id} value={c.id}>{c.names.common}</MenuItem>)}
              </TextField>
            ) : null}
            {asked[key] && key === "labour" ? (
              <div className="flex flex-wrap gap-x-3">
                {f.months.map((m, i) => (
                  <FormControlLabel key={m} control={<Checkbox checked={peak.has(i + 1)} onChange={() => toggle(peak, i + 1, setPeak)} />} label={m} />
                ))}
              </div>
            ) : null}
            {asked[key] && key === "land" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Segmented legend={lim.helps.land} value={tenure} onChange={(v) => { touch(); setTenure(v); }} options={[{ value: "owned", label: f.ownIt }, { value: "leased", label: f.rentIt }]} />
                {tenure === "leased" ? <TextField label={f.leaseYears} value={leaseYears} onChange={(e) => { touch(); setLeaseYears(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} /> : null}
              </div>
            ) : null}
          </fieldset>
        ))}
        </div>
      </details>

      <Panel as="section" aria-labelledby="soil" className="flex flex-col gap-4 p-4 sm:p-6">
        <PanelHeader id="soil" title={<span className="inline-flex items-center gap-2"><Icon name="soil" />{f.soilTitle}</span>} description={soilOpen ? f.soilDesc : undefined} />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="m-0 min-w-0 flex-1 text-body text-ink" role="status">{soilLine}</p>
          <Button variant="quiet" aria-expanded={soilOpen} onClick={() => setSoilOpen(!soilOpen)}>
            {soilOpen ? f.soilHide : f.soilUseOwn}
          </Button>
        </div>
        <p className="m-0 text-source text-ink-muted">{soilMapStatus === "ready" ? f.soilSourceReady : soilMapStatus === "loading" ? f.soilSourceLoading : f.soilSourceNone}</p>
        {soilOpen ? (
          <>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3.5">
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="ph" />{f.phTitle}</span>
              <SourceBadge loading={soilMapStatus === "loading" && !soilPh} kind={!soilPh ? "none" : auto.ph ? "estimate" : "yours"} />
            </div>
            <TextField
              label={f.phLabel}
              value={soilPh}
              onChange={(e) => {
                touch();
                setAuto((a) => ({ ...a, ph: false }));
                setSoilPh(e.target.value);
              }}
              size="small"
              type="number"
              placeholder={soilMapStatus === "loading" ? f.phLoadingMap : f.phPlaceholder}
              slotProps={{ htmlInput: { min: 3, max: 10, step: 0.1 } }}
              error={phHardBad}
              helperText={
                phHardBad
                  ? t.phOutOfRange
                  : phUnusual
                    ? t.phOutOfUsual
                    : auto.ph
                      ? f.phHelpAuto
                      : soilPh
                        ? `${soilMap?.ph != null ? f.phHelpYoursMap(soilMap.ph.toFixed(1)) : f.phHelpYours} ${t.phRangeHint}`
                        : `${f.phHelpNone} ${t.phRangeHint}`
              }
            />
            {!auto.ph && soilPh && soilMap?.ph != null ? (
              <Button variant="quiet" onClick={() => { touch(); setSoilPh(soilMap.ph!.toFixed(1)); setAuto((a) => ({ ...a, ph: true })); }}><Icon name="reset" size={16} />{f.useMap}</Button>
            ) : null}
            <p className="m-0 text-body-sm text-ink-muted">{f.phWhy}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3.5">
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="clay" />{f.textureTitle}</span>
              <SourceBadge loading={soilMapStatus === "loading" && !soilTexture} kind={!soilTexture ? "none" : auto.texture ? "estimate" : "yours"} />
            </div>
            <TextField
              select
              label={f.textureTitle}
              value={soilTexture}
              onChange={(e) => {
                touch();
                setAuto((a) => ({ ...a, texture: false }));
                setSoilTexture(e.target.value);
              }}
              size="small"
              helperText={auto.texture ? f.textureHelpAuto : soilTexture ? (soilMap?.texture ? f.textureHelpYoursMap(soilMap.texture) : f.textureHelpYours) : f.textureHelpNone}
            >
              <MenuItem value="">
                <em>{f.textureNone}</em>
              </MenuItem>
              {TEXTURE_CLASSES.map((tc) => (
                <MenuItem key={tc} value={tc}>
                  {tc.charAt(0).toUpperCase() + tc.slice(1)}
                </MenuItem>
              ))}
            </TextField>
            {!auto.texture && soilTexture && soilMap?.texture ? (
              <Button variant="quiet" onClick={() => { touch(); setSoilTexture(soilMap.texture!); setAuto((a) => ({ ...a, texture: true })); }}><Icon name="reset" size={16} />{f.useMap}</Button>
            ) : null}
            <p className="m-0 text-body-sm text-ink-muted">{f.textureWhy}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3.5">
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="salinity" />{f.salTitle}</span>
              <SourceBadge kind={soilSalinity ? "yours" : "none"} />
            </div>
            <TextField
              label={f.salLabel}
              value={soilSalinity}
              onChange={(e) => {
                touch();
                setSoilSalinity(e.target.value);
              }}
              size="small"
              type="number"
              placeholder={f.salPlaceholder}
              slotProps={{ htmlInput: { min: 0, max: 50, step: 0.1 } }}
              helperText={soilSalinity ? f.salHelpYours(soilSalinity) : f.salHelpNone}
            />
            <p className="m-0 text-body-sm text-ink-muted">{f.salWhy}</p>
          </div>
        </div>
        {soilMap ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-sunken p-3.5">
            <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="estimate" />{f.mapAlso}</span>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-5">
              {(
                [
                  ["organic", f.organicCarbon, soilMap.socGKg != null ? `${(soilMap.socGKg / 10).toFixed(1)} %` : null],
                  ["clay", f.clay, soilMap.clayPct != null ? `${Math.round(soilMap.clayPct)} %` : null],
                  ["soil", f.sand, soilMap.sandPct != null ? `${Math.round(soilMap.sandPct)} %` : null],
                  ["nitrogen", f.nitrogen, soilMap.nitrogenGKg != null ? `${soilMap.nitrogenGKg.toFixed(1)} g/kg` : null],
                  ["water", f.waterHeld, soilMap.fieldCapacityFrac != null && soilMap.wiltingPointFrac != null ? `${Math.round((soilMap.fieldCapacityFrac - soilMap.wiltingPointFrac) * 1000)} mm/m` : null],
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
        <details className="group border-t border-line pt-3">
          <summary className="flex min-h-tap cursor-pointer items-center gap-2 text-label text-field"><Icon name="add" />{f.addTest}</summary>
        {soil.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {soil.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface p-3 text-body-sm">
                <span className="text-ink">
                  <strong>{t.soilProperty[o.property]}</strong>: {o.value} {o.units}, {o.depthCm[0]}–{o.depthCm[1]} cm, {o.date}, {t.soilMethod[o.method]}, {o.source}
                </span>
                <Button variant="quiet" onClick={() => removeSoil(o.id)}>
                  {f.remove}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField select label={f.measuredWhat} value={soilDraft.property} onChange={(e) => setSoilDraft({ ...soilDraft, property: e.target.value as SoilProperty })} size="small">
            {SOIL_PROPERTIES.map((p) => (
              <MenuItem key={p} value={p}>
                {t.soilProperty[p]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={f.valueLabel(SOIL_UNITS[soilDraft.property])} value={soilDraft.value} onChange={(e) => setSoilDraft({ ...soilDraft, value: e.target.value })} size="small" required helperText={f.valueHelp} />
        </div>
        <Disclosure title={f.moreDetails} className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={f.depthFrom} value={soilDraft.depthFrom} onChange={(e) => setSoilDraft({ ...soilDraft, depthFrom: e.target.value })} size="small" type="number" helperText={f.depthFromHelp} />
            <TextField label={f.depthTo} value={soilDraft.depthTo} onChange={(e) => setSoilDraft({ ...soilDraft, depthTo: e.target.value })} size="small" type="number" helperText={f.depthToHelp} />
            <TextField label={f.dateLabel} value={soilDraft.date} onChange={(e) => setSoilDraft({ ...soilDraft, date: e.target.value })} size="small" type="date" slotProps={{ inputLabel: { shrink: true } }} helperText={f.dateHelp} />
            <TextField select label={f.methodLabel} value={soilDraft.method} onChange={(e) => setSoilDraft({ ...soilDraft, method: e.target.value as SoilDraftState["method"] })} size="small">
              <MenuItem value="">{f.methodDefault}</MenuItem>
              {(Object.keys(t.soilMethod) as Array<SoilObservation["method"]>).map((m) => (
                <MenuItem key={m} value={m}>
                  {t.soilMethod[m]}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={f.sourceLabel} value={soilDraft.source} onChange={(e) => setSoilDraft({ ...soilDraft, source: e.target.value })} size="small" className="sm:col-span-2" helperText={f.sourceHelp} />
          </div>
        </Disclosure>
        <div className="mt-3">
          <Button variant="secondary" onClick={addSoil}>
            {t.addSoil}
          </Button>
        </div>
        </details>
          </>
        ) : null}
      </Panel>

      <details className="rounded-md border border-line bg-surface-raised p-4 sm:p-6" open={econ.length > 0}>
        <summary className="min-h-tap cursor-pointer text-headline text-ink">
          <Icon name="price" className="mr-2 inline" />{t.economicsTitle}{" "}
          <span className="block text-body-sm font-normal text-ink-muted">
            {f.econSub}
          </span>
        </summary>
        <div className="flex flex-col gap-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-sunken p-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-label text-ink">{f.marketBench}</span>
              <span className="text-body-sm text-ink-muted">
                {f.marketBenchBody}
              </span>
            </div>
            <Button variant="secondary" size="md" onClick={loadRealWorldPrices} className="w-full sm:w-auto justify-center">
              <Icon name="estimate" size={16} />{f.fillMarket}
            </Button>
          </div>

          <div className="flex flex-col gap-0.5 text-body-sm text-ink-muted">
            <span className="text-label text-ink">{t.unitsTitle}</span>
            <span>{t.unitsHelp.join(" · ")}</span>
          </div>

          {econ.length === 0 ? (
            <p className="m-0 text-body-sm text-ink-muted">
              {f.noPrices}
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
                  {([["yield", t.yieldLabel, "yieldLo", "yieldHi"], ["price", t.priceLabel, "priceLo", "priceHi"], ["cost", t.costLabel, "costLo", "costHi"]] as const).map(([k, label, lo, hi]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-body-sm text-ink-muted">{label}</span>
                      <div className="grid grid-cols-2 gap-2">
                        <TextField label={t.lowLabel} value={e[lo]} onChange={(ev) => patchEcon(e.cropId, { [lo]: ev.target.value })} placeholder={refEcon?.[ECON_KEY[k]]?.[0]?.toString()} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} />
                        <TextField label={t.highLabel} value={e[hi]} onChange={(ev) => patchEcon(e.cropId, { [hi]: ev.target.value })} placeholder={refEcon?.[ECON_KEY[k]]?.[1]?.toString()} size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} />
                      </div>
                    </div>
                  ))}
                </div>
                <TextField label={t.economicsSource} value={e.source} onChange={(ev) => patchEcon(e.cropId, { source: ev.target.value })} size="small" />
                <div>
                  <Button variant="quiet" onClick={() => removeEcon(e.cropId)}>
                    {f.remove}
                  </Button>
                </div>
              </div>
            );
          })}
          <TextField select label={f.addCrop} value="" onChange={(e) => addEconRow(e.target.value)} size="small" className="sm:max-w-xs">
            {cropChoices.filter((c) => !econ.some((e) => e.cropId === c.id)).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.names.common}
              </MenuItem>
            ))}
          </TextField>
        </div>
      </details>

      {error ? <Message tone="problem" role="alert" title={f.didNotSave}>{error}</Message> : null}
      {undo ? (
        <div className="sticky bottom-[calc(var(--tabbar-h,0px)+5rem)] z-30 lg:bottom-4">
          <Message tone="info" role="status" title={undo.label} className="shadow-sm" action={<Button variant="quiet" onClick={undo.restore}>{f.undo}</Button>} />
        </div>
      ) : null}

      {dirty ? (
        <ActionBar>
          <Button variant="secondary" size="lg" onClick={() => void save(false)} disabled={saving}>
            {t.saveStay}
          </Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={() => void save(true)} disabled={saving}>
            {t.next}
            <Icon name="next" />
          </Button>
        </ActionBar>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {saved ? <Message tone="success" role="status" compact title={t.saved} /> : <span />}
          <Link href={`/fields/${field.id}/compare`} className={buttonClass("primary")}>
            {t.seeAnswer}
            <Icon name="next" />
          </Link>
        </div>
      )}
    </>
  );
}
