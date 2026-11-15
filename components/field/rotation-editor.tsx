"use client";

import { FlowNav } from "@/components/ui/flow-nav";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusGlyph, ChevronRightGlyph } from "@/components/ui/icons";
import { Message } from "@/components/ui/message";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { CROPS, getCropById, getDefaultTypicalDates } from "@/lib/data/crops";
import { REGIONS } from "@/lib/data/regions";
import {
  addDaysToIso,
  daysBetween,
  formatSpan,
  plural,
  segmentYear,
  shortSlotName,
  slotName,
  currentRotation,
} from "@/lib/rotation-format";
import { rotationSchema, rotationSlotSchema } from "@/lib/schemas/rotation";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import { useAppCopy } from "@/lib/store/locale-store";
import { usePick } from "@/components/shell/use-pick";
import type { DateConfidence, Rotation, RotationSlot } from "@/lib/types";
import { FarmerGuidedFlow } from "./farmer-guided-flow";
import { SlotCard } from "@/components/field/rotation/slot-card";
import { autoFillRotationDates, plantDateFor, type MonthPart } from "@/lib/plan/auto-dates";
import { TEMPLATES } from "@/lib/engine/candidates";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Monsoon rainy season in Myanmar (June, July, August, September)
const MONSOON_MONTHS = [6, 7, 8, 9];

/**
 * Visual Calendar Ribbon showing the multi-year rotation timeline.
 * Fully responsive: scrolls smoothly on mobile, renders multi-year cross-boundary crops,
 * shades the rainy monsoon season, and clearly highlights bare soil fallow periods and overlap conflicts.
 */
function RotationCalendarRibbon({
  slots,
  cycleYears,
}: {
  slots: RotationSlot[];
  cycleYears: number;
}) {
  const firstYear = Math.min(
    ...slots.map((s) => Number(s.plantDate.slice(0, 4)) || new Date().getFullYear()),
    new Date().getFullYear(),
  );
  const lanes = Array.from({ length: cycleYears }, (_, i) => firstYear + i);

  // Compute gaps between chronological slots
  const sortedSlots = [...slots].sort((a, b) => a.plantDate.localeCompare(b.plantDate));
  const gaps: Array<{ from: string; to: string; days: number }> = [];
  const overlaps: Array<{ slotA: RotationSlot; slotB: RotationSlot; days: number }> = [];

  for (let i = 0; i < sortedSlots.length - 1; i++) {
    const cur = sortedSlots[i];
    const nxt = sortedSlots[i + 1];
    if (nxt.plantDate < cur.harvestDate) {
      overlaps.push({
        slotA: cur,
        slotB: nxt,
        days: daysBetween(nxt.plantDate, cur.harvestDate),
      });
    } else if (nxt.plantDate > cur.harvestDate) {
      const diff = daysBetween(cur.harvestDate, nxt.plantDate);
      if (diff > 3) {
        gaps.push({ from: cur.harvestDate, to: nxt.plantDate, days: diff });
      }
    }
  }

  // Summary statistics
  const totalGrowingDays = slots
    .filter((s) => s.kind !== "fallow")
    .reduce((acc, s) => acc + daysBetween(s.plantDate, s.harvestDate), 0);
  const totalCycleDays = cycleYears * 365;
  const coverPct = Math.min(100, Math.round((totalGrowingDays / totalCycleDays) * 100));

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 sm:p-5">
      {/* Calendar Header with Legend & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-ink">
          <span className="font-semibold text-field">Seasonal Timeline</span>
          <span aria-hidden className="text-line-strong">•</span>
          <span className="text-body-sm text-ink-muted">
            {plural(slots.length, "crop")} · {plural(cycleYears, "year")} cycle · {totalGrowingDays} active days ({coverPct}% ground cover)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-source text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-water-soft border border-water/40" />
            Monsoon rain (Jun–Sep)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-field-soft border border-field" />
            Active crop
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-dashed border-line-strong bg-surface-sunken" />
            Fallow / bare soil
          </span>
        </div>
      </div>

      {/* Horizontal Scrollable Calendar Lanes */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[560px] flex flex-col gap-2.5">
          {/* Month Axis Header */}
          <div className="grid grid-cols-[4.5rem_repeat(12,minmax(0,1fr))] text-source text-ink-muted font-medium">
            <span className="text-body-sm text-ink font-semibold">Year</span>
            {MONTH_NAMES.map((m, i) => {
              const isMonsoon = MONSOON_MONTHS.includes(i + 1);
              return (
                <span
                  key={i}
                  className={cn(
                    "text-center py-0.5 rounded-sm",
                    isMonsoon ? "text-water font-semibold bg-water-soft/40" : "",
                  )}
                >
                  {m}
                </span>
              );
            })}
          </div>

          {/* Lane for Each Year */}
          {lanes.map((year) => (
            <div key={year} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-1">
              <span className="tabular font-mono text-body-sm font-medium text-ink-muted">
                {year}
              </span>
              <div className="relative h-12 rounded-sm border border-line bg-surface-raised overflow-hidden">
                {/* Month Grid Lines & Monsoon Shading */}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-12" aria-hidden="true">
                  {MONTH_NAMES.map((_, i) => {
                    const isMonsoon = MONSOON_MONTHS.includes(i + 1);
                    return (
                      <span
                        key={i}
                        className={cn(isMonsoon && "bg-water-soft/25")}
                      />
                    );
                  })}
                </div>

                {/* Fallow Gaps */}
                {gaps.map((g, idx) => {
                  const seg = segmentYear(year, g.from, g.to);
                  if (!seg) return null;
                  return (
                    <div
                      key={`gap-${idx}-${year}`}
                      title={`Fallow: ${g.days} days bare soil`}
                      className="absolute inset-y-1.5 flex items-center justify-center overflow-hidden rounded-xs border border-dashed border-line-strong bg-surface-sunken/80 px-1 text-source text-ink-muted"
                      style={{
                        left: `${seg.left * 100}%`,
                        width: `${Math.max(seg.width, 0.03) * 100}%`,
                      }}
                    >
                      {seg.width > 0.08 ? (
                        <span className="truncate text-source font-mono">{g.days}d fallow</span>
                      ) : null}
                    </div>
                  );
                })}

                {/* Overlap Conflicts */}
                {overlaps.map((ov, idx) => {
                  const seg = segmentYear(year, ov.slotB.plantDate, ov.slotA.harvestDate);
                  if (!seg) return null;
                  return (
                    <div
                      key={`overlap-${idx}-${year}`}
                      title={`Date overlap: ${ov.days} days`}
                      className="absolute inset-y-0.5 z-10 flex items-center justify-center overflow-hidden rounded-xs border border-heat bg-heat-soft px-1 text-source text-heat font-semibold"
                      style={{
                        left: `${seg.left * 100}%`,
                        width: `${Math.max(seg.width, 0.04) * 100}%`,
                      }}
                    >
                      {seg.width > 0.06 ? <span className="truncate">⚠️ {ov.days}d overlap</span> : "⚠️"}
                    </div>
                  );
                })}

                {/* Crop Slots */}
                {slots.map((s, idx) => {
                  const seg = segmentYear(year, s.plantDate, s.harvestDate);
                  if (!seg) return null;
                  const isFallow = s.kind === "fallow";
                  const dur = daysBetween(s.plantDate, s.harvestDate);
                  return (
                    <div
                      key={`${s.id}-${year}`}
                      title={`${slotName(s)} (${formatSpan(s.plantDate, s.harvestDate)}, ${dur} days)`}
                      className={cn(
                        "absolute inset-y-1 flex min-w-0 items-center justify-between overflow-hidden rounded-sm px-2 text-body-sm transition-transform shadow-xs",
                        isFallow
                          ? "border border-dashed border-line-strong bg-surface-sunken text-ink-muted"
                          : "border-2 border-field bg-field-soft font-medium text-ink",
                      )}
                      style={{
                        left: `${seg.left * 100}%`,
                        width: `${Math.max(seg.width, 0.06) * 100}%`,
                      }}
                    >
                      <span className="truncate font-medium flex items-center gap-1">
                        <span className="tabular font-mono text-source text-ink-muted">{idx + 1}.</span>
                        {shortSlotName(s)}
                      </span>
                      {seg.width > 0.15 ? (
                        <span className="shrink-0 text-source font-mono text-ink-muted ml-1">
                          {dur}d
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overlap Conflict Notice if any */}
      {overlaps.length > 0 ? (
        <Message tone="problem" compact title={overlaps.length === 1 ? "1 date overlap" : `${overlaps.length} date overlaps`}>
          {overlaps.length === 1
            ? `${shortSlotName(overlaps[0].slotB)} starts ${overlaps[0].days} days before ${shortSlotName(overlaps[0].slotA)} finishes.`
            : "Check the sowing dates below."}
        </Message>
      ) : null}
    </div>
  );
}

/** How many calendar years the crops cover, from the first sowing to the last harvest (1 to 4). */
function inferCycleYears(slots: RotationSlot[]): 1 | 2 | 3 | 4 {
  const dated = slots.filter((s) => /^\d{4}/.test(s.plantDate) && /^\d{4}/.test(s.harvestDate));
  if (dated.length === 0) return 1;
  const first = Math.min(...dated.map((s) => Number(s.plantDate.slice(0, 4))));
  const last = Math.max(...dated.map((s) => Number(s.harvestDate.slice(0, 4))));
  return Math.min(4, Math.max(1, last - first + 1)) as 1 | 2 | 3 | 4;
}

type EditorToast = { kind: "saved" } | { kind: "removed"; name: string; previous: RotationSlot[] };

/** A short message pinned above the action bar. Announced politely; "Undo" is a real button. */
function Toast({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(var(--tabbar-h,0px)+5.5rem)] z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-md border border-field/40 bg-surface-raised px-4 py-2 text-label text-ink shadow-md lg:bottom-6"
    >
      <span className="flex items-center gap-2">
        <Icon name="done" size={18} className="shrink-0 text-field" aria-hidden />
        {children}
      </span>
      {action}
    </div>
  );
}

export function RotationEditor({
  fieldId,
  initialMode = "guided",
}: {
  fieldId: string;
  initialMode?: "guided" | "advanced";
}) {
  const copy = useAppCopy();
  const pick = usePick();
  const router = useRouter();
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const saveRotation = useFieldsStore((s) => s.saveRotation);

  // Edit the farmer's own crops only; a saved plan is kept separately and never overwritten here.
  const ownRotation = currentRotation(rotations);
  const [cycleYears, setCycleYears] = useState<1 | 2 | 3 | 4>(() => ownRotation?.cycleYears ?? 1);
  // The cycle length follows the dates unless the farmer set it by hand (or a saved rotation chose a different one).
  const [cycleManual, setCycleManual] = useState(() => (ownRotation ? ownRotation.cycleYears !== inferCycleYears(ownRotation.slots) : false));
  const [slots, setSlots] = useState<RotationSlot[]>(() => ownRotation?.slots ?? []);
  // Plan ideas is the default choice; recording what was grown is also available.
  const [viewMode, setViewMode] = useState<"guided" | "advanced">(initialMode);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<EditorToast | null>(null);
  const [dirty, setDirty] = useState(false);
  // How many crops the last "Fill dates for me" tap changed (null until used).
  const [fillNote, setFillNote] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Crops whose dates the farmer has touched: only then do we ask how sure they are.
  const [editedDates, setEditedDates] = useState<Set<string>>(() => new Set());
  // Harvest dates that moved on their own when the sowing date changed, so we can say so.
  const [harvestMoved, setHarvestMoved] = useState<Record<string, string>>({});
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (!fieldId || !field) return;
    // Take the saved rotation once per field, so a later field update never wipes edits in progress.
    if (hydratedFor.current === fieldId) return;
    hydratedFor.current = fieldId;
    void loadRotations(fieldId).then((loaded) => {
      const own = currentRotation(loaded);
      if (own) {
        setCycleYears(own.cycleYears);
        setCycleManual(own.cycleYears !== inferCycleYears(own.slots));
        setSlots(own.slots);
      } else {
        const cropId = field.localNotes?.match(/\[Explore context\]:[^\n]*; crop ([^;]+);/)?.[1];
        if (cropId && getCropById(cropId)) {
          const dates = getDefaultTypicalDates(cropId, new Date().getFullYear(), field.region && field.region !== "unsupported" ? field.region : undefined);
          setSlots([{ id: crypto.randomUUID(), kind: getCropById(cropId)?.group === "cover" ? "cover" : "crop", cropId, ...dates, dateConfidence: "typical", irrigated: field.irrigation !== "none" }]);
        }
      }
    });
  }, [fieldId, field, loadRotations]);

  // Warn before the tab closes or reloads while edits are not saved. (In-app back is not intercepted.)
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The "removed" message fades after a while; the redirect timer never outlives the page.
  useEffect(() => {
    if (toast?.kind !== "removed") return;
    const t = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  const regionKey = field?.region && field.region !== "unsupported" ? field.region : undefined;
  const regionName = regionKey ? REGIONS[regionKey]?.name : null;
  const regionalCropIds = regionKey ? REGIONS[regionKey].candidateCropIds : [];
  const hasRegionalCatalog = regionalCropIds.length > 0;
  // Typical rotations for the region: no rest periods (nothing to date) and none that need irrigation the field lacks.
  const typicalStarts = (regionKey ? TEMPLATES[regionKey] : [])
    .filter((tpl) => !tpl.cropIds.includes("fallow") && (!tpl.requiresIrrigation || field?.irrigation !== "none"))
    .slice(0, 3);
  const chipCropIds = hasRegionalCatalog
    ? regionalCropIds
    : CROPS.filter((crop) => crop.scope === "myanmar").map((crop) => crop.id);
  const effectiveCycle: 1 | 2 | 3 | 4 = cycleManual ? cycleYears : inferCycleYears(slots);

  const markChanged = () => {
    setFillNote(null);
    setDirty(true);
    setToast((t) => (t?.kind === "saved" ? null : t));
  };

  const clearError = (id: string) => {
    if (!errors[id]) return;
    const next = { ...errors };
    delete next[id];
    setErrors(next);
  };

  /** Places the crops the farmer has not dated themselves in their usual season, one after another. */
  const refill = (list: RotationSlot[], baseYear?: number) => autoFillRotationDates(list, { region: regionKey, baseYear }).slots;
  const DATE_KEYS = ["plantDate", "harvestDate", "cropId", "kind"] as const;

  const handleUpdateSlot = (id: string, patch: Partial<RotationSlot>) => {
    markChanged();
    const next = slots.map((s) => (s.id === id ? { ...s, ...patch } : s));
    // A change to dates or crops moves the app's own guesses for the crops after it; the farmer's dates stay.
    setSlots(DATE_KEYS.some((k) => k in patch) ? refill(next) : next);
    clearError(id);
  };

  /** Once the farmer sets a date, "App's guess" is no longer true, so it becomes "About this month" until they say otherwise. */
  const touchedConfidence = (slot: RotationSlot, confidence?: DateConfidence): DateConfidence =>
    confidence ?? (slot.dateConfidence === "typical" ? "approx" : slot.dateConfidence);

  /**
   * When the sowing date changes, keep the crop's duration and move the harvest date with it.
   * The farmer is told it moved and can still change harvest after.
   */
  const handlePlantDateChange = (slot: RotationSlot, newPlantDate: string, confidence?: DateConfidence) => {
    if (!newPlantDate) {
      handleUpdateSlot(slot.id, { plantDate: newPlantDate });
      return;
    }
    const currentDur = daysBetween(slot.plantDate, slot.harvestDate);
    const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
    const dur = currentDur > 20 ? currentDur : (crop?.cycleDays.typ ?? 100);
    const newHarvestDate = addDaysToIso(newPlantDate, dur);

    setEditedDates((prev) => new Set(prev).add(slot.id));
    setHarvestMoved((prev) => {
      const next = { ...prev };
      if (newHarvestDate !== slot.harvestDate) next[slot.id] = newHarvestDate;
      else delete next[slot.id];
      return next;
    });
    handleUpdateSlot(slot.id, {
      plantDate: newPlantDate,
      harvestDate: newHarvestDate,
      dateConfidence: touchedConfidence(slot, confidence),
    });
  };

  const handleHarvestDateChange = (slot: RotationSlot, newHarvestDate: string) => {
    setEditedDates((prev) => new Set(prev).add(slot.id));
    setHarvestMoved((prev) => {
      const next = { ...prev };
      delete next[slot.id];
      return next;
    });
    handleUpdateSlot(slot.id, { harvestDate: newHarvestDate, dateConfidence: touchedConfidence(slot) });
  };

  /** Adds a crop in its usual sowing season, after the last crop has been harvested. */
  const appendSlot = (cropId: string) => {
    markChanged();
    const added: RotationSlot = {
      id: crypto.randomUUID(),
      kind: getCropById(cropId)?.group === "cover" ? "cover" : "crop",
      cropId,
      plantDate: "",
      harvestDate: "",
      dateConfidence: "typical",
      irrigated: field?.irrigation !== "none",
    };
    setSlots(refill([...slots, added]));
  };

  /** "Add another crop": picks the next crop in the regional list. The farmer changes it in the card. */
  const handleAddSlot = () => {
    const availableCropIds = regionKey ? REGIONS[regionKey].candidateCropIds : chipCropIds;
    const nextCropId = availableCropIds[slots.length % availableCropIds.length];
    if (!nextCropId) {
      setErrors({ _form: "Choose a crop from the list above. There is no regional default for this location." });
      return;
    }
    appendSlot(nextCropId);
  };

  /** One tap: start from a rotation farmers in this region usually grow, with dates filled in. */
  const startFromTemplate = (cropIds: string[]) => {
    markChanged();
    const fresh: RotationSlot[] = cropIds.map((cropId) => ({
      id: crypto.randomUUID(),
      kind: getCropById(cropId)?.group === "cover" ? "cover" : "crop",
      cropId,
      plantDate: "",
      harvestDate: "",
      dateConfidence: "typical",
      irrigated: field?.irrigation !== "none",
    }));
    setSlots(refill(fresh));
  };

  /** A crop chip only adds. A crop that is already in the list is taken to its card; removing is the card's own button. */
  const handleChip = (cropId: string) => {
    const existing = slots.find((x) => x.cropId === cropId);
    if (!existing) {
      appendSlot(cropId);
      return;
    }
    const card = document.getElementById(`slot-card-${existing.id}`);
    card?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  /** Resolves an overlap by shifting this slot to start two weeks after the previous harvest */
  const shiftAfterPrevious = (slotId: string, prevHarvestDate: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    const dur = daysBetween(slot.plantDate, slot.harvestDate) || 90;
    const newPlantDate = addDaysToIso(prevHarvestDate, 14);
    const newHarvestDate = addDaysToIso(newPlantDate, dur);

    handleUpdateSlot(slotId, {
      plantDate: newPlantDate,
      harvestDate: newHarvestDate,
    });
  };

  const handleCropChange = (slot: RotationSlot, value: string) => {
    if (value === "fallow") {
      handleUpdateSlot(slot.id, { kind: "fallow", cropId: undefined });
      return;
    }
    const year = parseInt(slot.plantDate.slice(0, 4), 10) || new Date().getFullYear();
    // The dates are replaced by the usual ones for the new crop, so they are the app's guess again.
    setEditedDates((prev) => {
      const next = new Set(prev);
      next.delete(slot.id);
      return next;
    });
    markChanged();
    const next = slots.map((s) =>
      s.id === slot.id
        ? { ...s, kind: (getCropById(value)?.group === "cover" ? "cover" : "crop") as RotationSlot["kind"], cropId: value, plantDate: "", harvestDate: "", dateConfidence: "typical" as const }
        : s,
    );
    setSlots(refill(next, year));
    clearError(slot.id);
  };

  /** A month and part of month for sowing. The first time that month comes round after the crop before. */
  const handleSowPick = (slot: RotationSlot, index: number, month: number, part: MonthPart) => {
    const prev = index > 0 ? slots[index - 1] : null;
    const afterIso = prev && /^\d{4}-\d{2}-\d{2}$/.test(prev.harvestDate) ? prev.harvestDate : undefined;
    const fallbackYear = parseInt(slot.plantDate.slice(0, 4), 10) || new Date().getFullYear();
    handlePlantDateChange(slot, plantDateFor(month, part, { afterIso, fallbackYear }), "approx");
  };

  /** One tap: every crop the farmer has not dated gets its usual season, in order, with no overlap. */
  const handleFillDates = () => {
    const result = autoFillRotationDates(slots, { region: regionKey });
    markChanged();
    setSlots(result.slots);
    setFillNote(result.changed);
    setErrors({});
  };

  /** Removing is explicit, and always offers Undo with the exact list as it was. */
  const handleRemoveSlot = (id: string) => {
    const target = slots.find((s) => s.id === id);
    if (!target) return;
    markChanged();
    setToast({ kind: "removed", name: slotName(target), previous: slots });
    setSlots(slots.filter((s) => s.id !== id));
    clearError(id);
  };

  const handleUndoRemove = () => {
    if (toast?.kind !== "removed") return;
    markChanged();
    setSlots(toast.previous);
    setToast(null);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (slots.length === 0) {
      next._form = copy.rotation.emptyNotice;
      setErrors(next);
      return false;
    }
    slots.forEach((slot, index) => {
      const res = rotationSlotSchema.safeParse(slot);
      if (!res.success) next[slot.id] = res.error.issues[0]?.message ?? `Check crop ${index + 1}`;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Leaves for the answer after a short pause, so "Saved" is on screen first. */
  const goToAnswerSoon = () => {
    setLeaving(true);
    redirectTimer.current = setTimeout(() => router.push(`/fields/${fieldId}/compare`), 900);
  };

  const handleSave = async (thenSeeAnswer: boolean) => {
    if (!validate() || !field) return;
    setSaving(true);
    try {
      const record: Rotation = {
        id: ownRotation?.id ?? crypto.randomUUID(),
        fieldId: field.id,
        label: `${field.name} rotation`,
        cycleYears: effectiveCycle,
        slots,
        source: "farmer",
      };
      await saveRotation(rotationSchema.parse(record));
      setDirty(false);
      setToast({ kind: "saved" });
      if (thenSeeAnswer) goToAnswerSoon();
    } catch (e) {
      setErrors({ _form: e instanceof Error ? e.message : "Couldn't save the rotation. Try again." });
    } finally {
      setSaving(false);
    }
  };

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!field) {
    return (
      <EmptyState title={copy.rotation.fieldMissingTitle} body={copy.rotation.fieldMissingBody}>
        <Link href="/" className={buttonClass("primary")}>
          {copy.rotation.fieldMissingBack}
        </Link>
      </EmptyState>
    );
  }

  const modeButton = (mode: "guided" | "advanced", label: string) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      aria-pressed={viewMode === mode}
      className={cn(
        "min-h-tap cursor-pointer rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors",
        viewMode === mode ? "bg-surface-raised text-field shadow-sm" : "text-ink-muted hover:bg-surface-raised hover:text-ink",
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <FieldPageHeader
        title={copy.rotation.title}
        summary={pick("Tap the crops you grow. We fill in the usual dates for you. Change only what is different on your farm.", "သင်စိုက်သော သီးနှံများကို နှိပ်ပါ။ ပုံမှန်ရက်များကို ကျွန်ုပ်တို့ ဖြည့်ပေးပါမည်။ သင့်လယ်နှင့် မတူသည်များကိုသာ ပြောင်းပါ။")}
      />

      {field.localNotes?.includes("[Explore context]:") && !ownRotation ? (
        <Message tone="info" title={pick("Started from your Explore answers", "သင်၏ စူးစမ်းမှု အဖြေများမှ စတင်သည်")}>
          {pick("Your crop and water choice are carried forward. The dates are the usual ones for your area. Check them before saving.", "သင်ရွေးသော သီးနှံနှင့် ရေအခြေအနေကို ယူလာပါသည်။ ရက်များမှာ သင့်ဒေသ၏ ပုံမှန်ရက်များဖြစ်သည်။ မသိမ်းမီ စစ်ပါ။")}
        </Message>
      ) : null}

      {/* A small switch: plan ideas or recording what was grown. */}
      <div role="group" aria-label={copy.rotation.modeLabel} className="inline-flex w-fit max-w-full flex-wrap rounded-lg border border-line bg-surface-sunken p-0.5">
        {modeButton("guided", copy.rotation.modePlan)}
        {modeButton("advanced", copy.rotation.modeRecord)}
      </div>

      {viewMode === "guided" ? (
        <FarmerGuidedFlow
          field={field}
          currentSlots={slots}
          cycleYears={effectiveCycle}
          onApplyPlan={async (newSlots: RotationSlot[], newCycle: 1 | 2 | 3 | 4) => {
            await saveRotation(rotationSchema.parse({
              id: `guided-plan-${field.id}`, fieldId: field.id,
              label: `${field.name} draft plan`, cycleYears: newCycle, slots: newSlots, source: "strategy",
            }));
            if (ownRotation) {
              goToAnswerSoon();
              return;
            }

            // A suggested plan is not the farmer's crop history. Keep it saved separately,
            // then collect what actually grows here before opening the comparison.
            setDirty(false);
            setErrors({});
            setToast({ kind: "saved" });
            setViewMode("advanced");
          }}
          onSwitchToAdvanced={() => setViewMode("advanced")}
        />
      ) : (
        <>
          {/* Step 1: tap the crops. They only add; removing is the card's own button. */}
          <section aria-labelledby="quick-crops" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="quick-crops" className="m-0 text-title text-ink">{copy.rotation.quickTitle}</h2>
              {regionName ? (
                <p className="m-0 flex items-center gap-1.5 text-body-sm text-ink-muted">
                  <Icon name="pin" size={15} aria-hidden />
                  {hasRegionalCatalog ? `Regional crops for ${regionName}` : `Crop library · no regional comparisons for ${regionName}`}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {chipCropIds.map((id) => {
                const on = slots.some((x) => x.cropId === id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => handleChip(id)}
                    className={cn(
                      "inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-pill border px-4 py-2 text-body-sm font-semibold transition-colors active:scale-[0.97]",
                      on ? "border-field bg-field text-on-field" : "border-line-strong bg-surface-raised text-ink hover:border-ink/40",
                    )}
                  >
                    <Icon name={on ? "done" : "add"} size={16} strokeWidth={2.4} />
                    {getCropById(id)?.names.common ?? id}
                  </button>
                );
              })}
            </div>
            <p className="m-0 text-body-sm text-ink-muted">{copy.rotation.quickHelp}</p>

            {/* Nothing entered yet: offer what farmers here usually grow, so there is nothing to type */}
            {slots.length === 0 && typicalStarts.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <h3 className="m-0 flex items-center gap-2 text-body font-semibold text-ink">
                  <Icon name="estimate" size={18} aria-hidden />
                  {pick(`Or start with what farmers in ${regionName ?? "your area"} usually grow`, `သို့မဟုတ် ${regionName ?? "သင့်ဒေသ"} ရှိ လယ်သမားများ ပုံမှန်စိုက်သည်ကို စတင်ပါ`)}
                </h3>
                <p className="m-0 text-body-sm text-ink-muted">{pick("One tap fills in the crops and their usual dates. Change anything after.", "တစ်ချက်နှိပ်ရုံဖြင့် သီးနှံများနှင့် ပုံမှန်ရက်များ ဖြည့်ပေးပါမည်။ ပြီးနောက် ပြောင်းနိုင်ပါသည်။")}</p>
                <div className="flex flex-col gap-2">
                  {typicalStarts.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => startFromTemplate(tpl.cropIds)}
                      className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-line-strong bg-surface-raised px-4 py-2 text-left text-body font-semibold text-ink transition-colors hover:border-field active:scale-[0.99]"
                    >
                      <span>{tpl.label}</span>
                      <Icon name="add" size={18} aria-hidden className="shrink-0 text-field" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {/* Step 2: the crops in order, with dates filled in */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-title text-ink">{pick("Your crops, in order", "သင့်သီးနှံများ အစဉ်လိုက်")}</h2>
              <p className="m-0 text-body-sm text-ink-muted">
                {pick("Tap a month on each crop to match your farm. Harvest follows on its own.", "သင့်လယ်နှင့်ကိုက်ညီအောင် သီးနှံတစ်ခုချင်းတွင် လတစ်လကို နှိပ်ပါ။ ရိတ်သိမ်းချိန်ကို အလိုလိုတွက်ပေးပါမည်။")}
              </p>
            </div>

            {slots.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Button variant="secondary" icon="estimate" onClick={handleFillDates} className="w-full sm:w-fit">
                  {pick("Fill dates for me", "ရက်များကို ကျွန်ုပ်အတွက် ဖြည့်ပေးပါ")}
                </Button>
                {fillNote !== null ? (
                  <Message tone="success" compact role="status" title={fillNote > 0 ? pick(`Dates filled in for ${plural(fillNote, "crop")}`, `သီးနှံ ${fillNote} ခုအတွက် ရက်များ ဖြည့်ပြီး`) : pick("Dates already fit", "ရက်များ ကိုက်ညီပြီးသား")}>
                    {pick("Dates you set yourself were kept. Check them, then save.", "သင်ကိုယ်တိုင် သတ်မှတ်သော ရက်များကို မပြောင်းပါ။ စစ်ပြီး သိမ်းပါ။")}
                  </Message>
                ) : null}
              </div>
            ) : null}

        {slots.length > 0 ? (
          <>
            <ol aria-label="Crop sequence" className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-2 p-0">
              {slots.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  {i > 0 ? <Icon name="next" size={14} className="text-ink-muted" aria-hidden /> : null}
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1 text-body-sm">
                    <span className="tabular font-mono text-body-sm text-ink-muted">{i + 1}</span>
                    <span className="font-medium text-ink">{shortSlotName(s)}</span>
                    {s.kind !== "fallow" ? (
                      <span className="text-body-sm text-ink-muted">
                        {s.dateConfidence === "typical" ? "suggested " : ""}{formatSpan(s.plantDate, s.harvestDate)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
            <details className="group rounded-md border border-line bg-surface">
              <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 px-4 text-label font-medium text-field [&::-webkit-details-marker]:hidden">
                <ChevronRightGlyph className="transition-transform group-open:rotate-90" />
                {copy.rotation.advancedTimeline}
                <span className="ml-auto text-body-sm font-normal text-ink-muted">{copy.rotation.cycleYearsOption(effectiveCycle)}</span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-line p-4">
          <Panel as="div" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-label font-medium text-ink">Rotation cycle length</span>
              <span className="text-body-sm text-ink-muted">Worked out from your dates. Change it only if your crops repeat over a different number of years.</span>
            </div>
            <Segmented
              legend={copy.rotation.cycleYearsLabel}
              value={effectiveCycle.toString()}
              onChange={(val) => {
                markChanged();
                setCycleManual(true);
                setCycleYears(parseInt(val, 10) as 1 | 2 | 3 | 4);
              }}
              options={[1, 2, 3, 4].map((y) => ({ value: String(y), label: copy.rotation.cycleYearsOption(y) }))}
              className="sm:w-80"
            />
          </Panel>

          <RotationCalendarRibbon slots={slots} cycleYears={effectiveCycle} />

              </div>
            </details>
          </>
        ) : null}

        {errors._form ? <Message tone="problem" role="alert" title="This did not save">{errors._form}</Message> : null}

        {slots.length === 0 ? (
          <Panel as="div" className="flex flex-col items-center justify-center gap-3 p-8 text-center bg-surface-sunken">
            <Icon name="rotation" size={36} className="text-ink-muted" />
            <div className="flex flex-col gap-1">
              <p className="text-headline text-ink">{copy.rotation.emptyTitle}</p>
              <p className="max-w-measure text-body-sm text-ink-muted">{copy.rotation.emptyNotice}</p>
            </div>
          </Panel>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {slots.map((slot, index) => (
              <li key={slot.id} id={`slot-card-${slot.id}`}>
                <SlotCard
                  slot={slot}
                  index={index}
                  prevSlot={index > 0 ? slots[index - 1] : null}
                  regionKey={regionKey}
                  regionName={regionName}
                  error={errors[slot.id]}
                  showConfidence={slot.kind !== "fallow" && (editedDates.has(slot.id) || slot.dateConfidence !== "typical")}
                  harvestMoved={Boolean(harvestMoved[slot.id] && harvestMoved[slot.id] === slot.harvestDate)}
                  onUpdate={(patch) => handleUpdateSlot(slot.id, patch)}
                  onSowPick={(month, part) => handleSowPick(slot, index, month, part)}
                  onPlantDate={(date) => handlePlantDateChange(slot, date)}
                  onHarvestDate={(date) => handleHarvestDateChange(slot, date)}
                  onCropChange={(value) => handleCropChange(slot, value)}
                  onRemove={() => handleRemoveSlot(slot.id)}
                  onShiftAfterPrevious={() => index > 0 && shiftAfterPrevious(slot.id, slots[index - 1].harvestDate)}
                />
              </li>
            ))}
          </ol>
        )}

        {/* The one place to add more crops once there is at least one */}
        {slots.length > 0 ? (
          <Button variant="secondary" onClick={handleAddSlot} className="w-full sm:w-fit">
            <PlusGlyph />
            <span>{copy.rotation.addAnother}</span>
          </Button>
        ) : null}
      </div>

      {/* Saved / removed confirmations. Both are announced; Undo is a real button. */}
      {toast?.kind === "saved" ? <Toast>{copy.rotation.savedNotice}</Toast> : null}
      {toast?.kind === "removed" ? (
        <Toast
          action={
            <button
              type="button"
              onClick={handleUndoRemove}
              className="min-h-tap shrink-0 cursor-pointer rounded-md px-3 text-label font-semibold text-field hover:bg-field-soft"
            >
              {copy.rotation.undo}
            </button>
          }
        >
          {copy.rotation.removedToast(toast.name)}
        </Toast>
      ) : null}
      {dirty && !toast ? <p className="m-0 text-body-sm text-ink-muted">{copy.rotation.unsavedHint}</p> : null}

      {/* Back/Next in the one shared place: [secondary] [primary] */}
      <FlowNav
        back={{ label: copy.rotation.saveAndStay, icon: "done", onClick: () => void handleSave(false), disabled: saving || leaving || slots.length === 0 }}
        next={{ label: copy.rotation.saveAndNext, onClick: () => void handleSave(true), disabled: saving || leaving || slots.length === 0 }}
      />
        </>
      )}
    </>
  );
}
