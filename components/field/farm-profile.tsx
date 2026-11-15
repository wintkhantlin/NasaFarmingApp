"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePick } from "@/components/shell/use-pick";
import { cn } from "@/lib/cn";
import { regionShort, suggestedProfile } from "@/lib/plan/profile-defaults";
import { Message } from "@/components/ui/message";
import { Disclosure } from "@/components/ui/disclosure";
import { clearDraft, readDraft, writeDraft } from "@/lib/store/form-drafts";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel, { type FormControlLabelProps } from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FlowNav } from "@/components/ui/flow-nav";
import { Icon, type IconName } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { copy as copyKeys } from "@/lib/copy/en";
import { useAppCopy } from "@/lib/store/locale-store";
import { getCropById, strategyCrops, getRealWorldCropEconomics } from "@/lib/data/crops";
import type { SoilProfile } from "@/lib/soil/soilgrids";
import { SUB_CRITERION } from "@/lib/engine/mcda";
import { PriorityExplainer, PriorityTiles } from "@/components/field/priority-order";
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

/** Small status pill using the three words: You told us, We guessed, Not answered. */
function SourceBadge({ kind, loading }: { kind: "yours" | "estimate" | "none"; loading?: boolean }) {
  const f = useAppCopy().profile.form;
  if (loading) return <span className="inline-flex items-center gap-1 text-body-sm text-ink-muted"><Icon name="satellite" size={14} />{f.badgeLoading}</span>;
  if (kind === "yours") return <span className="inline-flex items-center gap-1 rounded bg-field-soft px-1.5 py-0.5 text-body-sm font-medium text-field"><Icon name="done" size={14} />{f.badgeYours}</span>;
  if (kind === "estimate") return <span className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-body-sm font-medium text-ink-muted"><Icon name="estimate" size={14} />{f.badgeGuess}</span>;
  return <span className="inline-flex items-center gap-1 text-body-sm text-ink-muted"><Icon name="close" size={14} />{f.badgeNone}</span>;
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

type YoursKey = "priorities" | "water" | "labour" | "market";
type YoursState = Record<YoursKey, boolean>;

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
  /** Which of the four everyday questions the farmer has answered, so the rest stay marked "Suggested". */
  yours: YoursState;
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
        <Field
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
        </Field>
        <Field
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

/** A small text box that is still 44px tall, so it is easy to hit with a thumb. */
function Field({ stack, ...props }: TextFieldProps & { stack?: boolean }) {
  const id = useId();
  const box = <TextField size="small" {...props} sx={{ "& .MuiInputBase-root": { minHeight: 44 }, ...props.sx }} />;
  if (!stack) return box;
  // A long question is written above the box, where it can wrap, instead of being cut short inside the border.
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-body-sm font-medium text-ink">{props.label}</label>
      <TextField size="small" {...props} id={id} label={undefined} sx={{ "& .MuiInputBase-root": { minHeight: 44 }, ...props.sx }} />
    </div>
  );
}

/** A checkbox or switch row whose whole line (at least 44px) is the tap target. */
function TapLabel(props: FormControlLabelProps) {
  return <FormControlLabel {...props} sx={{ minHeight: 44, ...props.sx }} />;
}

/**
 * Says where an everyday answer came from: "Suggested for <place>" until the farmer changes it, then "Your answer".
 * Always an icon and words, never colour alone.
 */
function AnswerLabel({ yours, place }: { yours: boolean; place: string }) {
  const pick = usePick();
  return yours ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-field-soft px-2 py-0.5 text-body-sm font-medium text-field">
      <Icon name="done" size={16} />
      {pick("Your answer", "သင့်အဖြေ")}
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-line px-2 py-0.5 text-body-sm font-medium text-ink-muted">
      <Icon name="estimate" size={16} />
      {pick(`Suggested for ${place}`, `${place} အတွက် အကြံပြုထား`)}
    </span>
  );
}

/** Heading of one everyday question: icon and name on the left, where the answer came from on the right (wraps below on a phone). */
function QuestionHead({ id, icon, title, hint, yours, place }: { id: string; icon: IconName; title: string; hint?: string; yours: boolean; place: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id={id} className="m-0 inline-flex items-center gap-2 text-headline text-ink">
          <Icon name={icon} size={22} className="shrink-0 text-field" />
          {title}
        </h2>
        <AnswerLabel yours={yours} place={place} />
      </div>
      {hint ? <p className="m-0 text-body-sm text-ink-muted">{hint}</p> : null}
    </div>
  );
}

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** One icon, or several to show "more" (for example one, two, three people). */
  icons: IconName[];
}

/**
 * Two or three big, exclusive choices as tiles: icon above the words, one row, full width.
 * Each tile is at least 80px high and shows a tick when chosen, so the state is never colour alone.
 */
function ChoiceTiles<T extends string>({ labelledBy, value, onChange, options }: { labelledBy: string; value: T | ""; onChange: (v: T) => void; options: ChoiceOption<T>[] }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={cn("grid gap-2", options.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex min-h-20 min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border px-1.5 py-2.5 text-center transition-colors",
              on ? "border-field bg-field-soft ring-1 ring-field" : "border-line-strong bg-surface-raised hover:bg-surface-sunken",
            )}
          >
            <span className={cn("flex items-center justify-center gap-0.5", on ? "text-field" : "text-ink-muted")}>
              {o.icons.map((name, i) => (
                <Icon key={i} name={name} size={24} />
              ))}
            </span>
            <span className="text-body-sm font-semibold leading-tight text-ink [overflow-wrap:anywhere]">{o.label}</span>
            {on ? (
              <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-pill bg-field text-on-field">
                <Icon name="done" size={14} strokeWidth={3} />
              </span>
            ) : null}
          </button>
        );
      })}
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
  const pick = usePick();
  const t = text.profile;
  const f = t.form;
  const lim = text.limits;
  // What a typical farmer in this region would answer, shown as "Suggested" until the farmer changes it.
  const suggested = useMemo(() => suggestedProfile(field.region), [field.region]);
  const place = pick(regionShort(field.region).en, regionShort(field.region).my);
  const [soilMap, setSoilMap] = useState<SoilProfile | null>(null);
  const [soilMapStatus, setSoilMapStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const p = field.priorities;
  // Answers typed on an earlier visit in this session (for example before going back to the previous step) win over the saved values.
  const draftKey = `profile:${field.id}`;
  const draft = readDraft<ProfileDraft>(draftKey);
  const savedOrder = p && p.order.length > 0 ? p.order : null;
  const startOrder = savedOrder ?? suggested.priorities;
  const [order, setOrder] = useState<PriorityId[]>(() => draft?.order ?? [...startOrder, ...PRIORITY_IDS.filter((x) => !startOrder.includes(x))]);
  const [included, setIncluded] = useState<Set<PriorityId>>(() => new Set(draft ? draft.included : startOrder));
  // An answer counts as "yours" once it was saved before or the farmer changes it here. Until then it is a regional suggestion.
  const [yours, setYours] = useState<YoursState>(() =>
    draft?.yours ?? {
      priorities: savedOrder !== null,
      water: field.constraints?.irrigation !== undefined,
      labour: field.constraints?.labour !== undefined,
      market: field.constraints?.marketAccess !== undefined,
    },
  );
  const markYours = (key: YoursKey) => setYours((y) => (y[key] ? y : { ...y, [key]: true }));
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
  const [labour, setLabour] = useState<"low" | "medium" | "high" | "">(draft?.labour ?? field.constraints?.labour ?? suggested.labour);
  const [market, setMarket] = useState<"poor" | "fair" | "good" | "">(draft?.market ?? field.constraints?.marketAccess ?? suggested.market);
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
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  // The pump and paddy figures stay hidden until the farmer says they have a record.
  const [pumpRecord, setPumpRecord] = useState(() => [pumpRate, pumpEff, pumpHours].some((v) => v !== ""));
  const [paddyRecord, setPaddyRecord] = useState(() => [bundMm, seepage].some((v) => v !== ""));
  // The extra sections start open only when the farmer already gave an answer in them.
  const [moreOpen] = useState(
    () =>
      equipment.size > 0 ||
      preferred.length > 0 ||
      excluded.length > 0 ||
      winFrom !== "" ||
      winTo !== "" ||
      depletionMm !== "" ||
      paddyRecord,
  );
  const [waterOpen] = useState(() => irrigationMm !== "" || pumpRecord);
  const [fineOpen] = useState(() => ({ soil: soilSub.size > 0, income: incomeSub.size > 0 }));
  const [limitsOpen, setLimitsOpen] = useState(() => Object.values(asked).some(Boolean));
  // Soil fields stay folded behind one line until the farmer wants to give their own values.
  const [soilOpen, setSoilOpen] = useState(() => soilPh !== "" || soilTexture !== "" || soilSalinity !== "" || soil.length > 0);
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null);
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
    auto, soilDraft, econ, yours,
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

  useEffect(() => {
    // The sticky bar is at the bottom, so bring a save error into view instead of leaving it above the fold.
    if (error) errorRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [error]);

  const touch = () => {
    unsavedRef.current = true;
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
      const pump = (v: string) => (pumpRecord && irrigation !== "none" ? num(v) : undefined);
      const irrigationAmount = irrigation === "none" ? undefined : num(irrigationMm);
      const paddy = (v: string) => (paddyRecord ? num(v) : undefined);
      const orderedIncluded = order.filter((p) => included.has(p));
      const priorities = orderedIncluded.length ? prioritiesSchema.parse({ order: orderedIncluded, weights: {}, soil: included.has("soil") && soilSub.size ? [...soilSub] : undefined, income: included.has("income") && incomeSub.size ? [...incomeSub] : undefined }) : undefined;
      const constraints: FarmConstraints = constraintsSchema.parse({
        irrigation: !field.constraints?.irrigation && !yours.water && irrigation === field.irrigation && irrigationAmount === undefined && pump(pumpRate) === undefined ? undefined : {
          access: irrigation,
          amountMm: irrigationAmount,
          // The capacity limit applies only when all three pump figures are given; a partial set is dropped, never guessed.
          pump: pump(pumpRate) !== undefined && pump(pumpEff) !== undefined && pump(pumpHours) !== undefined ? { rateM3H: pump(pumpRate)!, efficiency: (pump(pumpEff)! > 1 ? pump(pumpEff)! / 100 : pump(pumpEff)!), hoursAvailable: pump(pumpHours)! } : undefined,
        },
        soilDepletionAtPlantingMm: num(depletionMm),
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

  const anySuggested = !(yours.priorities && yours.water && yours.labour && yours.market);

  return (
    <>
      <FieldPageHeader title={t.title} />

      {anySuggested ? (
        <Message tone="info" title={pick("We filled this in for your area.", "သင့်ဒေသအတွက် ဖြည့်ပေးထားပါသည်။")}>
          {pick("Change only what is different.", "ကွာခြားသည့်အရာကိုသာ ပြောင်းပါ။")}
        </Message>
      ) : null}

      <section aria-labelledby="priorities" className="flex flex-col gap-3">
        <QuestionHead id="priorities" icon="priorities" title={t.prioritiesTitle} yours={yours.priorities} place={place} />
        <PriorityTiles
          value={order.filter((x) => included.has(x))}
          onChange={(next) => {
            touch();
            markYours("priorities");
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
                      <TapLabel
                        control={
                          <Checkbox
                            checked={id === "soil" ? soilSub.has(sub as SoilSub) : incomeSub.has(sub as IncomeSub)}
                            onChange={() => {
                              markYours("priorities");
                              if (id === "soil") toggle(soilSub, sub as SoilSub, setSoilSub);
                              else toggle(incomeSub, sub as IncomeSub, setIncomeSub);
                            }}
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
        <Disclosure title={<span className="inline-flex items-center gap-2"><Icon name="info" size={18} />{pick("How this is used", "ဒါကို ဘယ်လိုသုံးသလဲ")}</span>}>
          <PriorityExplainer className="bg-transparent p-0" />
        </Disclosure>
      </section>

      <section aria-labelledby="water" className="flex flex-col gap-3 border-t border-line pt-5">
        <QuestionHead id="water" icon="water" title={t.irrigationLabel} yours={yours.water} place={place} />
        <ChoiceTiles
          labelledBy="water"
          value={irrigation}
          onChange={(v) => {
            touch();
            markYours("water");
            setIrrigation(v);
          }}
          options={[
            { value: "none", label: text.irrigation.none, icons: ["rain"] },
            { value: "supplemental", label: text.irrigation.supplemental, icons: ["water"] },
            { value: "full", label: text.irrigation.full, icons: ["water", "water"] },
          ]}
        />
        {irrigation !== "none" ? (
          <Disclosure title={<span className="inline-flex items-center gap-2"><Icon name="water" size={18} />{pick("Water details (optional)", "ရေအသေးစိတ် (မဖြည့်လည်းရ)")}</span>} defaultOpen={waterOpen}>
            <Field stack label={t.irrigationAmountLabel} value={irrigationMm} onChange={(e) => { touch(); setIrrigationMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, inputMode: "decimal" } }} helperText={f.irrigationAmountHelp} />
            <TapLabel control={<Switch checked={pumpRecord} onChange={() => { touch(); setPumpRecord(!pumpRecord); }} />} label={f.pumpRecord} />
            {pumpRecord ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field stack label={t.pumpRateLabel} value={pumpRate} onChange={(e) => { touch(); setPumpRate(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, inputMode: "decimal" } }} helperText={f.pumpRateHelp} />
                <Field stack label={t.pumpHoursLabel} value={pumpHours} onChange={(e) => { touch(); setPumpHours(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, inputMode: "decimal" } }} helperText={f.pumpHoursHelp} />
                <Field stack label={t.pumpEfficiencyLabel} value={pumpEff} onChange={(e) => { touch(); setPumpEff(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, max: 100, step: "any", inputMode: "decimal" } }} helperText={f.pumpEffHelp} />
              </div>
            ) : null}
          </Disclosure>
        ) : null}
      </section>

      <section aria-labelledby="labour" className="flex flex-col gap-3 border-t border-line pt-5">
        <QuestionHead id="labour" icon="labour" title={t.labourLabel} hint={pick("Can you find workers when work is heaviest?", "အလုပ်အများဆုံးအချိန်တွင် လုပ်သားရှာနိုင်ပါသလား။")} yours={yours.labour} place={place} />
        <ChoiceTiles
          labelledBy="labour"
          value={labour}
          onChange={(v) => {
            touch();
            markYours("labour");
            setLabour(v);
          }}
          options={[
            { value: "low", label: t.levels.low, icons: ["labour"] },
            { value: "medium", label: t.levels.medium, icons: ["labour", "labour"] },
            { value: "high", label: t.levels.high, icons: ["labour", "labour", "labour"] },
          ]}
        />
      </section>

      <section aria-labelledby="market" className="flex flex-col gap-3 border-t border-line pt-5">
        <QuestionHead id="market" icon="market" title={t.marketLabel} hint={pick("How easy is it to sell your crop nearby?", "သင့်သီးနှံကို အနီးအနားတွင် ရောင်းရလွယ်ပါသလား။")} yours={yours.market} place={place} />
        <ChoiceTiles
          labelledBy="market"
          value={market}
          onChange={(v) => {
            touch();
            markYours("market");
            setMarket(v);
          }}
          options={[
            { value: "poor", label: t.levels.poor, icons: ["warning"] },
            { value: "fair", label: t.levels.fair, icons: ["market"] },
            { value: "good", label: t.levels.good, icons: ["success"] },
          ]}
        />
      </section>

      <section aria-labelledby="soil" className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id="soil" className="m-0 inline-flex items-center gap-2 text-headline text-ink"><Icon name="soil" size={22} className="shrink-0 text-field" />{f.soilTitle}</h2>
          {ownSoil ? <AnswerLabel yours place={place} /> : null}
        </div>
        {soilOpen ? <p className="m-0 text-body-sm text-ink-muted">{f.soilDesc}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="m-0 inline-flex min-w-0 flex-1 basis-60 items-start gap-2 text-body text-ink" role="status">
            {!ownSoil ? <Icon name={soilMapStatus === "loading" && !soilPh && !soilTexture ? "satellite" : "estimate"} size={18} className="mt-0.5 shrink-0 text-ink-muted" /> : null}
            <span>{soilLine}</span>
          </p>
          <Button variant="quiet" aria-expanded={soilOpen} onClick={() => setSoilOpen(!soilOpen)}>
            {soilOpen ? f.soilHide : f.soilUseOwn}
          </Button>
        </div>
        <p className="m-0 text-body-sm text-ink-muted">{soilMapStatus === "ready" ? f.soilSourceReady : soilMapStatus === "loading" ? f.soilSourceLoading : f.soilSourceNone}</p>
        {soilOpen ? (
          <>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="ph" />{f.phTitle}</span>
              <SourceBadge loading={soilMapStatus === "loading" && !soilPh} kind={!soilPh ? "none" : auto.ph ? "estimate" : "yours"} />
            </div>
            <Field
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
              slotProps={{ htmlInput: { min: 3, max: 10, step: 0.1, inputMode: "decimal" } }}
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

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="clay" />{f.textureTitle}</span>
              <SourceBadge loading={soilMapStatus === "loading" && !soilTexture} kind={!soilTexture ? "none" : auto.texture ? "estimate" : "yours"} />
            </div>
            <Field
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
            </Field>
            {!auto.texture && soilTexture && soilMap?.texture ? (
              <Button variant="quiet" onClick={() => { touch(); setSoilTexture(soilMap.texture!); setAuto((a) => ({ ...a, texture: true })); }}><Icon name="reset" size={16} />{f.useMap}</Button>
            ) : null}
            <p className="m-0 text-body-sm text-ink-muted">{f.textureWhy}</p>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-label text-ink"><Icon name="salinity" />{f.salTitle}</span>
              <SourceBadge kind={soilSalinity ? "yours" : "none"} />
            </div>
            <Field
              label={f.salLabel}
              value={soilSalinity}
              onChange={(e) => {
                touch();
                setSoilSalinity(e.target.value);
              }}
              size="small"
              type="number"
              placeholder={f.salPlaceholder}
              slotProps={{ htmlInput: { min: 0, max: 50, step: 0.1, inputMode: "decimal" } }}
              helperText={soilSalinity ? f.salHelpYours(soilSalinity) : f.salHelpNone}
            />
            <p className="m-0 text-body-sm text-ink-muted">{f.salWhy}</p>
          </div>
        </div>
        {soilMap ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
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
                  <span className="flex flex-col leading-tight"><span className="text-body-sm text-ink-muted">{label}</span><span className="tabular text-label text-ink">{value}</span></span>
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
          <Field select label={f.measuredWhat} value={soilDraft.property} onChange={(e) => setSoilDraft({ ...soilDraft, property: e.target.value as SoilProperty })} size="small">
            {SOIL_PROPERTIES.map((p) => (
              <MenuItem key={p} value={p}>
                {t.soilProperty[p]}
              </MenuItem>
            ))}
          </Field>
          <Field label={f.valueLabel(SOIL_UNITS[soilDraft.property])} value={soilDraft.value} onChange={(e) => setSoilDraft({ ...soilDraft, value: e.target.value })} size="small" required helperText={f.valueHelp} />
        </div>
        <Disclosure title={f.moreDetails} className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={f.depthFrom} value={soilDraft.depthFrom} onChange={(e) => setSoilDraft({ ...soilDraft, depthFrom: e.target.value })} size="small" type="number" helperText={f.depthFromHelp} />
            <Field label={f.depthTo} value={soilDraft.depthTo} onChange={(e) => setSoilDraft({ ...soilDraft, depthTo: e.target.value })} size="small" type="number" helperText={f.depthToHelp} />
            <Field label={f.dateLabel} value={soilDraft.date} onChange={(e) => setSoilDraft({ ...soilDraft, date: e.target.value })} size="small" type="date" slotProps={{ inputLabel: { shrink: true } }} helperText={f.dateHelp} />
            <Field select label={f.methodLabel} value={soilDraft.method} onChange={(e) => setSoilDraft({ ...soilDraft, method: e.target.value as SoilDraftState["method"] })} size="small">
              <MenuItem value="">{f.methodDefault}</MenuItem>
              {(Object.keys(t.soilMethod) as Array<SoilObservation["method"]>).map((m) => (
                <MenuItem key={m} value={m}>
                  {t.soilMethod[m]}
                </MenuItem>
              ))}
            </Field>
            <Field label={f.sourceLabel} value={soilDraft.source} onChange={(e) => setSoilDraft({ ...soilDraft, source: e.target.value })} size="small" className="sm:col-span-2" helperText={f.sourceHelp} />
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
      </section>

      <Disclosure
        title={<span className="inline-flex items-center gap-2"><Icon name="equipment" size={18} />{f.moreTitle}</span>}
        hint={f.moreHint}
        defaultOpen={moreOpen}
      >
        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="mb-1 inline-flex items-center gap-2 text-body-sm font-medium text-ink"><Icon name="equipment" />{t.equipmentLabel}</legend>
          <div className="flex flex-wrap gap-x-4">
            {EQUIPMENT.map((e) => (
              <TapLabel key={e} control={<Checkbox checked={equipment.has(e)} onChange={() => toggle(equipment, e as string, setEquipment)} />} label={t.equipment[e]} />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field select label={t.preferredLabel} value={preferred} onChange={cropSelect(setPreferred)} size="small" slotProps={{ select: { multiple: true } }}>
            {cropChoices.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.names.common}
              </MenuItem>
            ))}
          </Field>
          <Field select label={t.excludedLabel} value={excluded} onChange={cropSelect(setExcluded)} size="small" slotProps={{ select: { multiple: true } }}>
            {cropChoices.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.names.common}
              </MenuItem>
            ))}
          </Field>
        </div>
        <div role="group" aria-labelledby="planting-window-heading" aria-describedby="planting-window-help" className="flex flex-col gap-2">
          <h3 id="planting-window-heading" className="m-0 inline-flex items-center gap-2 text-body-sm font-medium text-ink"><Icon name="calendar" />{t.windowHeading}</h3>
          <p id="planting-window-help" className="m-0 text-body-sm text-ink-muted">{t.windowExample}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <MonthDayField label={t.windowFrom} value={winFrom} onChange={(v) => { touch(); setWinFrom(v); }} />
            <MonthDayField label={t.windowTo} value={winTo} onChange={(v) => { touch(); setWinTo(v); }} />
          </div>
          <p className="m-0 text-body-sm text-ink-muted">{f.windowOnly}</p>
        </div>
        <Field stack label={t.soilDepletionLabel} value={depletionMm} onChange={(e) => { touch(); setDepletionMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, inputMode: "decimal" } }} helperText={f.dryHelp} />
        <TapLabel control={<Switch checked={paddyRecord} onChange={() => { touch(); setPaddyRecord(!paddyRecord); }} />} label={f.paddyRecord} />
        {paddyRecord ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field stack label={t.paddyBundLabel} value={bundMm} onChange={(e) => { touch(); setBundMm(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, inputMode: "decimal" } }} helperText={f.bundHelp} />
            <Field stack label={t.paddySeepageLabel} value={seepage} onChange={(e) => { touch(); setSeepage(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, inputMode: "decimal" } }} helperText={f.seepHelp} />
          </div>
        ) : null}
      </Disclosure>

      <Disclosure
        title={<span id="limits" className="inline-flex items-center gap-2"><Icon name="stack" size={18} />{f.limitsTitle}</span>}
        defaultOpen={limitsOpen}
      >
        <p className="m-0 text-body-sm text-ink-muted">{f.limitsSub}</p>
        {(
          [
            ["market", "market"],
            ["household", "fields"],
            ["labour", "calendar"],
            ["land", "pin"],
          ] as const
        ).map(([key, icon]) => (
          <fieldset key={key} className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="inline-flex items-center gap-2 text-body-sm font-medium text-ink"><Icon name={icon} />{lim.labels[key]}</legend>
            <TapLabel
              control={<Switch checked={asked[key]} onChange={() => { touch(); setAsked({ ...asked, [key]: !asked[key] }); }} />}
              label={f.limitAdd}
            />
            {!asked[key] ? <p className="m-0 text-body-sm text-ink-muted">{lim.helps[key]}</p> : null}
            {asked[key] && key === "market" ? (
              <Field select label={f.pickCrops} value={canSell} onChange={cropSelect(setCanSell)} size="small" slotProps={{ select: { multiple: true } }}>
                {cropChoices.map((c) => <MenuItem key={c.id} value={c.id}>{c.names.common}</MenuItem>)}
              </Field>
            ) : null}
            {asked[key] && key === "household" ? (
              <Field select label={f.mustGrowLabel} value={mustGrow} onChange={cropSelect(setMustGrow)} size="small" slotProps={{ select: { multiple: true } }}>
                {cropChoices.map((c) => <MenuItem key={c.id} value={c.id}>{c.names.common}</MenuItem>)}
              </Field>
            ) : null}
            {asked[key] && key === "labour" ? (
              <div className="flex flex-wrap gap-x-3">
                {f.months.map((m, i) => (
                  <TapLabel key={m} control={<Checkbox checked={peak.has(i + 1)} onChange={() => toggle(peak, i + 1, setPeak)} />} label={m} />
                ))}
              </div>
            ) : null}
            {asked[key] && key === "land" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Segmented legend={lim.helps.land} value={tenure} onChange={(v) => { touch(); setTenure(v); }} options={[{ value: "owned", label: f.ownIt }, { value: "leased", label: f.rentIt }]} />
                {tenure === "leased" ? <Field label={f.leaseYears} value={leaseYears} onChange={(e) => { touch(); setLeaseYears(e.target.value); }} size="small" type="number" slotProps={{ htmlInput: { min: 0, inputMode: "decimal" } }} /> : null}
              </div>
            ) : null}
          </fieldset>
        ))}
      </Disclosure>

      <Disclosure
        title={<span className="inline-flex items-center gap-2"><Icon name="price" size={18} />{t.economicsTitle}</span>}
        hint={pick("Optional", "မဖြည့်လည်းရ")}
        defaultOpen={econ.length > 0}
      >
        <p className="m-0 inline-flex items-start gap-2 text-body-sm text-ink-muted">
          <Icon name="estimate" size={16} className="mt-0.5 shrink-0" />
          {econ.length === 0
            ? pick(`Suggested for ${place}: we use regional market prices, yields and costs unless you enter your own.`, `${place} အတွက် အကြံပြုထား။ သင့်ကိုယ်ပိုင်ကိန်းဂဏန်း မထည့်လျှင် ဒေသစျေးကွက်စျေး၊ အထွက်နှုန်းနှင့် ကုန်ကျစရိတ်ကို သုံးပါမည်။`)
            : f.econSub}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-body-sm font-medium text-ink">{f.marketBench}</span>
            <span className="text-body-sm text-ink-muted">{f.marketBenchBody}</span>
          </div>
          <Button variant="secondary" size="md" onClick={loadRealWorldPrices} className="w-full justify-center sm:w-auto">
            <Icon name="estimate" size={16} />{f.fillMarket}
          </Button>
        </div>

        <div className="flex flex-col gap-0.5 text-body-sm text-ink-muted">
          <span className="font-medium text-ink">{t.unitsTitle}</span>
          <span>{t.unitsHelp.join(" · ")}</span>
        </div>

        {econ.length === 0 ? <p className="m-0 text-body-sm text-ink-muted">{f.noPrices}</p> : null}

        {econ.map((e) => {
          const crop = getCropById(e.cropId);
          const refEcon = getRealWorldCropEconomics(e.cropId);
          return (
            <div key={e.cropId} className="flex flex-col gap-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0 text-body font-medium text-ink">
                  {crop?.names.common ?? e.cropId} {refEcon?.burmeseName ? `(${refEcon.burmeseName})` : ""}
                </p>
                {refEcon?.traditionalUnitNote ? <span className="text-body-sm text-ink-muted">{refEcon.traditionalUnitNote}</span> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {([["yield", t.yieldLabel, "yieldLo", "yieldHi"], ["price", t.priceLabel, "priceLo", "priceHi"], ["cost", t.costLabel, "costLo", "costHi"]] as const).map(([k, label, lo, hi]) => (
                  <div key={k} className="flex flex-col gap-1">
                    <span className="text-body-sm text-ink-muted">{label}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={t.lowLabel} value={e[lo]} onChange={(ev) => patchEcon(e.cropId, { [lo]: ev.target.value })} placeholder={refEcon?.[ECON_KEY[k]]?.[0]?.toString()} size="small" type="number" slotProps={{ htmlInput: { min: 0, inputMode: "decimal" } }} />
                      <Field label={t.highLabel} value={e[hi]} onChange={(ev) => patchEcon(e.cropId, { [hi]: ev.target.value })} placeholder={refEcon?.[ECON_KEY[k]]?.[1]?.toString()} size="small" type="number" slotProps={{ htmlInput: { min: 0, inputMode: "decimal" } }} />
                    </div>
                  </div>
                ))}
              </div>
              <Field label={t.economicsSource} value={e.source} onChange={(ev) => patchEcon(e.cropId, { source: ev.target.value })} size="small" />
              <div>
                <Button variant="quiet" onClick={() => removeEcon(e.cropId)}>
                  {f.remove}
                </Button>
              </div>
            </div>
          );
        })}
        <Field select label={f.addCrop} value="" onChange={(e) => addEconRow(e.target.value)} size="small" className="sm:max-w-xs">
          {cropChoices.filter((c) => !econ.some((e) => e.cropId === c.id)).map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.names.common}
            </MenuItem>
          ))}
        </Field>
      </Disclosure>

      {error ? (
        <div ref={errorRef}>
          <Message tone="problem" role="alert" title={f.didNotSave}>{error}</Message>
        </div>
      ) : null}
      {undo ? (
        <div className="sticky bottom-[calc(var(--tabbar-h,0px)+5rem)] z-30 lg:bottom-4">
          <Message tone="info" role="status" title={undo.label} className="shadow-sm" action={<Button variant="quiet" onClick={undo.restore}>{f.undo}</Button>} />
        </div>
      ) : null}

      <FlowNav next={{ label: t.seeAnswer, onClick: () => void save(true), disabled: saving }} />
    </>
  );
}
