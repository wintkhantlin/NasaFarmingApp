"use client";

import { ActionBar } from "@/components/ui/action-bar";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusGlyph, ChevronRightGlyph } from "@/components/ui/icons";
import { Message } from "@/components/ui/message";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { CROPS, getCropById, getDefaultTypicalDates } from "@/lib/data/crops";
import { REGIONS } from "@/lib/data/regions";
import {
  addDaysToIso,
  daysBetween,
  formatDay,
  formatSpan,
  plural,
  segmentYear,
  shortSlotName,
  slotName,
  currentRotation,
} from "@/lib/rotation-format";
import { rotationSchema, rotationSlotSchema } from "@/lib/schemas/rotation";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import type { DateConfidence, EstablishmentMode, ResidueFate, Rotation, RotationSlot } from "@/lib/types";
import { evaluateTransition, isRelayPairEligible } from "@/lib/engine/transition";
import { FarmerGuidedFlow } from "./farmer-guided-flow";

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
                        className={cn(
                          "border-line/40",
                          i > 0 && "border-l",
                          isMonsoon && "bg-water-soft/25",
                        )}
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

const ESTABLISHMENT_LABEL: Record<EstablishmentMode, string> = {
  tillage: "Ploughed",
  zero_till: "No-till",
  relay_broadcast: "Relay broadcast",
  unknown: "Sowing not set",
};

const RESIDUE_LABEL: Record<ResidueFate, string> = {
  retain_incorporate: "Ploughed into soil",
  retain_mulch: "Left on the surface",
  remove_fodder: "Taken for fodder",
  burn: "Burned",
  unknown: "Not sure",
};

export function RotationEditor({ fieldId }: { fieldId: string }) {
  const router = useRouter();
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const saveRotation = useFieldsStore((s) => s.saveRotation);

  // Edit the farmer's own crops only; a saved plan is kept separately and never overwritten here.
  const ownRotation = currentRotation(rotations);
  const hasSavedPlan = rotations.some((r) => r.source === "strategy" && r.slots.length > 0);
  const [cycleYears, setCycleYears] = useState<1 | 2 | 3 | 4>(() => ownRotation?.cycleYears ?? 1);
  const [slots, setSlots] = useState<RotationSlot[]>(() => ownRotation?.slots ?? []);
  // Once a plan is saved, the next step is recording current crops, so open the crop list, not the planner again.
  const [viewMode, setViewMode] = useState<"guided" | "advanced">(() => (ownRotation || hasSavedPlan ? "advanced" : "guided"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (!fieldId || !field) return;
    void loadRotations(fieldId).then((loaded) => {
      const own = currentRotation(loaded);
      if (own) {
        setCycleYears(own.cycleYears);
        setSlots(own.slots);
      } else {
        const cropId = field.localNotes?.match(/\[Explore context\]:[^\n]*; crop ([^;]+);/)?.[1];
        if (cropId && getCropById(cropId)) {
          const dates = getDefaultTypicalDates(cropId, new Date().getFullYear(), field.region && field.region !== "unsupported" ? field.region : undefined);
          setSlots([{ id: crypto.randomUUID(), kind: getCropById(cropId)?.group === "cover" ? "cover" : "crop", cropId, ...dates, dateConfidence: "typical", irrigated: field.irrigation !== "none" }]);
          setViewMode("advanced");
        }
      }
      if (own || loaded?.some((r) => r.source === "strategy" && r.slots.length > 0)) setViewMode("advanced");
    });
  }, [fieldId, field, loadRotations]);

  const regionKey = field?.region && field.region !== "unsupported" ? field.region : undefined;
  const regionName = regionKey ? REGIONS[regionKey]?.name : null;
  const chipCropIds = regionKey ? REGIONS[regionKey].candidateCropIds : CROPS.slice(0, 8).map((c) => c.id);

  const markChanged = () => setSaveSuccess(false);

  const clearError = (id: string) => {
    if (!errors[id]) return;
    const next = { ...errors };
    delete next[id];
    setErrors(next);
  };

  const handleUpdateSlot = (id: string, patch: Partial<RotationSlot>) => {
    markChanged();
    setSlots(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    clearError(id);
  };

  /**
   * Smart Date Synchronization:
   * When planting date is updated, keep the crop's duration constant and shift harvest date in lockstep!
   */
  const handlePlantDateChange = (slot: RotationSlot, newPlantDate: string) => {
    markChanged();
    const currentDur = daysBetween(slot.plantDate, slot.harvestDate);
    const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
    const dur = currentDur > 20 ? currentDur : (crop?.cycleDays.typ ?? 100);
    const newHarvestDate = addDaysToIso(newPlantDate, dur);

    handleUpdateSlot(slot.id, {
      plantDate: newPlantDate,
      harvestDate: newHarvestDate,
    });
  };

  /**
   * Smart Adding of the Next Crop:
   * Automatically starts 2 weeks after the last crop finishes to avoid collisions!
   */
  const handleAddSlot = () => {
    markChanged();
    const nextRegion = regionKey;
    const nextCropId = nextRegion
      ? (REGIONS[nextRegion].candidateCropIds[slots.length % REGIONS[nextRegion].candidateCropIds.length] ?? "chickpea")
      : "chickpea";

    let plantDate = "";
    let harvestDate = "";
    const baseYear = new Date().getFullYear();

    if (slots.length > 0) {
      // Find latest harvest date among existing slots
      const sorted = [...slots].sort((a, b) => a.harvestDate.localeCompare(b.harvestDate));
      const lastSlot = sorted[sorted.length - 1];
      plantDate = addDaysToIso(lastSlot.harvestDate, 14);
      const crop = getCropById(nextCropId);
      const dur = crop ? crop.cycleDays.typ : 90;
      harvestDate = addDaysToIso(plantDate, dur);

      // Check if it spills into a new calendar year
      const firstYear = Math.min(...slots.map((s) => Number(s.plantDate.slice(0, 4)) || baseYear));
      const endYear = Number(harvestDate.slice(0, 4));
      const spanYears = Math.min(4, Math.max(1, endYear - firstYear + 1)) as 1 | 2 | 3 | 4;
      if (spanYears > cycleYears) {
        setCycleYears(spanYears);
      }
    } else {
      const def = getDefaultTypicalDates(nextCropId, baseYear, nextRegion);
      plantDate = def.plantDate;
      harvestDate = def.harvestDate;
    }

    setSlots([
      ...slots,
      {
        id: crypto.randomUUID(),
        kind: "crop",
        cropId: nextCropId,
        plantDate,
        harvestDate,
        dateConfidence: "typical",
        irrigated: field?.irrigation !== "none",
      },
    ]);
  };

  /** Tapping a quick crop chip adds it sequentially without overlap */
  const toggleCrop = (cropId: string) => {
    markChanged();
    if (slots.some((x) => x.cropId === cropId)) {
      setSlots(slots.filter((x) => x.cropId !== cropId));
      return;
    }

    const baseYear = new Date().getFullYear();
    let plantDate = "";
    let harvestDate = "";

    if (slots.length > 0) {
      const sorted = [...slots].sort((a, b) => a.harvestDate.localeCompare(b.harvestDate));
      const last = sorted[sorted.length - 1];
      plantDate = addDaysToIso(last.harvestDate, 14);
      const crop = getCropById(cropId);
      const dur = crop ? crop.cycleDays.typ : 90;
      harvestDate = addDaysToIso(plantDate, dur);

      const firstYear = Math.min(...slots.map((s) => Number(s.plantDate.slice(0, 4)) || baseYear));
      const endYear = Number(harvestDate.slice(0, 4));
      const spanYears = Math.min(4, Math.max(1, endYear - firstYear + 1)) as 1 | 2 | 3 | 4;
      if (spanYears > cycleYears) {
        setCycleYears(spanYears);
      }
    } else {
      const chosen = getDefaultTypicalDates(cropId, baseYear, regionKey);
      plantDate = chosen.plantDate;
      harvestDate = chosen.harvestDate;
    }

    setSlots([
      ...slots,
      {
        id: crypto.randomUUID(),
        kind: getCropById(cropId)?.group === "cover" ? "cover" : "crop",
        cropId,
        plantDate,
        harvestDate,
        dateConfidence: "typical",
        irrigated: field?.irrigation !== "none",
      },
    ]);
  };

  /** Applies a seasonal sowing window preset */
  const applySeasonPreset = (slot: RotationSlot, season: "monsoon" | "winter" | "summer") => {
    markChanged();
    const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
    const dur = crop ? crop.cycleDays.typ : 90;
    const year = parseInt(slot.plantDate.slice(0, 4), 10) || new Date().getFullYear();

    let plantDate = "";
    if (season === "monsoon") {
      plantDate = `${year}-06-01`;
    } else if (season === "winter") {
      plantDate = `${year}-10-25`;
    } else {
      plantDate = `${year}-02-15`;
    }
    const harvestDate = addDaysToIso(plantDate, dur);

    handleUpdateSlot(slot.id, {
      plantDate,
      harvestDate,
      dateConfidence: "typical",
    });
  };

  /** Resolves an overlap by shifting this slot to start right after previous harvest */
  const shiftAfterPrevious = (slotId: string, prevHarvestDate: string) => {
    markChanged();
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    const dur = daysBetween(slot.plantDate, slot.harvestDate) || 90;
    const newPlantDate = addDaysToIso(prevHarvestDate, 7);
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
    const dates = getDefaultTypicalDates(value, year, regionKey);
    handleUpdateSlot(slot.id, {
      kind: getCropById(value)?.group === "cover" ? "cover" : "crop",
      cropId: value,
      plantDate: dates.plantDate,
      harvestDate: dates.harvestDate,
    });
  };

  const handleRemoveSlot = (id: string) => {
    markChanged();
    setSlots(slots.filter((s) => s.id !== id));
    clearError(id);
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

  const handleSave = async (navigateToConditions = false) => {
    if (!validate() || !field) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const record: Rotation = {
        id: ownRotation?.id ?? crypto.randomUUID(),
        fieldId: field.id,
        label: `${field.name} rotation`,
        cycleYears,
        slots,
        source: "farmer",
      };
      await saveRotation(rotationSchema.parse(record));
      setSaveSuccess(true);
      if (navigateToConditions) router.push(`/fields/${field.id}/compare`);
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
      <EmptyState
        title="Field not found"
        body="This field isn't saved in your browser storage. Check your saved fields on the home page."
      >
        <Link href="/" className={buttonClass("primary")}>
          Back to your fields
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <FieldPageHeader
        title={copy.rotation.title}
        summary="Record what you grow on this field across the seasonal cycle. Sowing dates are pre-filled with local agricultural windows."
      />

      {field.localNotes?.includes("[Explore context]:") && !ownRotation ? (
        <Message tone="info" title="Started from your Explore answers">
          Your crop and water choice are carried forward. The dates below are clearly marked as typical regional dates—check them, change them, or remove the crop before saving.
        </Message>
      ) : null}

      <section aria-labelledby="editor-mode" className="flex flex-col gap-2 border-b border-line pb-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="editor-mode" className="text-label font-semibold text-ink">How would you like to add crops?</h2>
          <p className="m-0 text-body-sm text-ink-muted">Start with guided questions, or edit every date and field detail yourself.</p>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-line bg-surface-sunken p-1">
          <button
            type="button"
            onClick={() => setViewMode("guided")}
            aria-pressed={viewMode === "guided"}
            className={cn(
              "flex min-h-tap cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-label font-medium transition-colors",
              viewMode === "guided"
                ? "bg-surface-raised text-field shadow-sm"
                : "text-ink-muted hover:bg-surface-raised hover:text-ink",
            )}
          >
            <Icon name="rotation" size={17} />
            Guided
          </button>
          <button
            type="button"
            onClick={() => setViewMode("advanced")}
            aria-pressed={viewMode === "advanced"}
            className={cn(
              "flex min-h-tap cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-label font-medium transition-colors",
              viewMode === "advanced"
                ? "bg-surface-raised text-field shadow-sm"
                : "text-ink-muted hover:bg-surface-raised hover:text-ink",
            )}
          >
            <Icon name="priorities" size={17} />
            Detailed
          </button>
        </div>
      </section>

      {viewMode === "guided" ? (
        <FarmerGuidedFlow
          field={field}
          currentSlots={slots}
          cycleYears={cycleYears}
          onApplyPlan={async (newSlots: RotationSlot[], newCycle: 1 | 2 | 3 | 4) => {
            await saveRotation(rotationSchema.parse({
              id: `guided-plan-${field.id}`, fieldId: field.id,
              label: `${field.name} draft plan`, cycleYears: newCycle, slots: newSlots, source: "strategy",
            }));
            markChanged();
            setSlots(newSlots);
            setCycleYears(newCycle);
            setSaveSuccess(true);
            router.push(`/fields/${field.id}/compare`);
          }}
          onSwitchToAdvanced={() => setViewMode("advanced")}
        />
      ) : (
        <>
          {/* Quick Crop Selector Chips */}
          <Panel as="section" aria-labelledby="quick-crops" className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="quick-crops" className="m-0 text-headline text-ink">{copy.rotation.quickTitle}</h2>
          {regionName ? (
            <span className="text-source text-ink-muted">Regional crops for {regionName}</span>
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
                onClick={() => toggleCrop(id)}
                className={cn(
                  "inline-flex min-h-tap cursor-pointer items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-label font-medium transition-colors",
                  on ? "bg-field text-on-field" : "border border-line bg-surface text-ink hover:border-line-strong",
                )}
              >
                {on ? <Icon name="done" size={16} /> : null}
                {getCropById(id)?.names.common ?? id}
              </button>
            );
          })}
        </div>
        <p className="m-0 text-body-sm text-ink-muted">
          Tap a crop to add it to your calendar with typical regional dates. Tap again to remove it.
        </p>
      </Panel>

      {/* Crop Slot Cards List */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="text-headline text-ink">Crop sequence & dates</h2>
            <p className="text-body-sm text-ink-muted">
              Adjust sowing and harvest dates to match your real seasonal practice.
            </p>
          </div>
          <Button variant="secondary" onClick={handleAddSlot} className="w-full sm:w-fit">
            <PlusGlyph />
            <span>{slots.length === 1 ? "Add crop 2" : copy.rotation.addCrop}</span>
          </Button>
        </div>

        {slots.length > 0 ? (
          <>
            <ol aria-label="Crop sequence" className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-2 p-0">
              {slots.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  {i > 0 ? <Icon name="next" size={14} className="text-ink-muted" aria-hidden /> : null}
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1 text-body-sm">
                    <span className="tabular font-mono text-source text-ink-muted">{i + 1}</span>
                    <span className="font-medium text-ink">{shortSlotName(s)}</span>
                    {s.kind !== "fallow" ? (
                      <span className="text-source text-ink-muted">
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
                Show seasonal timeline and cycle length
                <span className="ml-auto text-source font-normal text-ink-muted">{copy.rotation.cycleYearsOption(cycleYears)}</span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-line p-4">
          <Panel as="div" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-label font-medium text-ink">Rotation cycle length</span>
              <span className="text-body-sm text-ink-muted">How many years does your full crop cycle take to repeat?</span>
            </div>
            <Segmented
              legend={copy.rotation.cycleYearsLabel}
              value={cycleYears.toString()}
              onChange={(val) => {
                markChanged();
                setCycleYears(parseInt(val, 10) as 1 | 2 | 3 | 4);
              }}
              options={[1, 2, 3, 4].map((y) => ({ value: String(y), label: copy.rotation.cycleYearsOption(y) }))}
              className="sm:w-80"
            />
          </Panel>

          <RotationCalendarRibbon slots={slots} cycleYears={cycleYears} />

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
            <Button variant="primary" onClick={handleAddSlot}>
              <PlusGlyph />
              <span>Add your first crop</span>
            </Button>
          </Panel>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {slots.map((slot, index) => {
              const slotError = errors[slot.id];
              const isFallow = slot.kind === "fallow";
              const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
              const duration = daysBetween(slot.plantDate, slot.harvestDate);
              const isSuggested = !isFallow && slot.dateConfidence === "typical";

              // Evaluate safe transition rules (Prompt 1, Prompt 4)
              const prevSlot = index > 0 ? slots[index - 1] : null;
              const transition = prevSlot ? evaluateTransition(prevSlot, slot) : null;
              const isOverlapping = transition?.status === "collision";

              // Check regional calendar advice
              const regionalCal = regionKey ? crop?.profile?.regionalCalendars[regionKey] : undefined;

              return (
                <li key={slot.id}>
                  <Panel
                    as="div"
                    aria-label={`${copy.rotation.slotBadge(index)}: ${slotName(slot)}`}
                    className={cn(
                      "flex flex-col gap-4 p-4 sm:p-5",
                      slotError ? "border-heat" : isOverlapping ? "border-heat/60" : transition?.status === "relay" ? "border-healthy/50" : "",
                    )}
                  >
                    {/* Slot Header */}
                    <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="tabular grid size-7 shrink-0 place-items-center rounded-pill bg-field font-mono text-source text-on-field"
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-headline text-ink font-semibold">{slotName(slot)}</p>
                          {!isFallow ? (
                            <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-ink-muted">
                              {isSuggested ? (
                                <span className="rounded-pill border border-dashed border-line-strong px-2 text-source font-medium text-ink-muted">
                                  Suggested dates
                                </span>
                              ) : null}
                              <span>
                                {isSuggested ? "around " : ""}{formatSpan(slot.plantDate, slot.harvestDate)} · <span className="font-mono text-ink font-medium">{duration} days</span>
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {slots.length > 1 ? (
                        <Button
                          variant="quiet"
                          onClick={() => handleRemoveSlot(slot.id)}
                          className="shrink-0 text-heat hover:bg-heat-soft"
                          aria-label={`${copy.rotation.removeCrop}: ${slotName(slot)}`}
                        >
                          {copy.rotation.removeCrop}
                        </Button>
                      ) : null}
                    </div>

                    {slotError ? (
                      <p role="alert" className="text-body-sm font-medium text-heat">
                        {slotError}
                      </p>
                    ) : null}

                    {/* Relay Broadcast Valid Badge (Ye-pyan) */}
                    {transition?.status === "relay" && prevSlot ? (
                      <Message tone="success" compact title="Relay broadcast (Ye-pyan) fits">
                        Sown {transition.overlapDays} days before {shortSlotName(prevSlot)} harvest, inside the valid pre-harvest window.
                      </Message>
                    ) : null}

                    {/* Collision Alert with 1-click Quick Fixes */}
                    {transition?.status === "collision" && prevSlot ? (
                      <Message
                        tone="problem"
                        title="These dates overlap"
                        action={
                        <>
                          {isRelayPairEligible(prevSlot.cropId, slot.cropId) ? (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                markChanged();
                                const dur = daysBetween(slot.plantDate, slot.harvestDate) || 90;
                                const newPlant = addDaysToIso(prevSlot.harvestDate, -7);
                                handleUpdateSlot(slot.id, {
                                  establishmentMode: "relay_broadcast",
                                  plantDate: newPlant,
                                  harvestDate: addDaysToIso(newPlant, dur),
                                });
                              }}
                              className="text-label"
                            >
                              Snap to Relay (-7d)
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => shiftAfterPrevious(slot.id, prevSlot.harvestDate)}
                            className="text-label"
                          >
                            Start after {shortSlotName(prevSlot)} (+14d)
                          </Button>
                        </>
                        }
                      >
                        {transition.message}
                      </Message>
                    ) : null}

                    {/* Crop Selection & Variety */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        select
                        label={copy.rotation.cropLabel}
                        value={isFallow ? "fallow" : (slot.cropId ?? "")}
                        onChange={(e) => handleCropChange(slot, e.target.value)}
                        size="small"
                        fullWidth
                      >
                        <MenuItem value="" disabled>
                          {copy.rotation.selectCropPrompt}
                        </MenuItem>
                        {CROPS.map((c) => {
                          const local = c.names.local?.[0] ? ` (${c.names.local[0]})` : "";
                          const ref = c.scope === "reference-only" ? " (reference only)" : "";
                          return (
                            <MenuItem key={c.id} value={c.id}>
                              <span className="flex items-baseline gap-1.5">
                                <span>{c.names.common}{local}{ref}</span>
                                <span className="text-source text-ink-muted">({c.family})</span>
                              </span>
                            </MenuItem>
                          );
                        })}
                        <MenuItem value="fallow">{copy.rotation.fallowOption}</MenuItem>
                      </TextField>

                      {!isFallow ? (
                        <TextField
                          label={copy.rotation.varietyLabel}
                          placeholder={copy.rotation.varietyPlaceholder}
                          value={slot.variety ?? ""}
                          onChange={(e) => handleUpdateSlot(slot.id, { variety: e.target.value })}
                          size="small"
                          fullWidth
                        />
                      ) : null}
                    </div>

                    {/* Quick Seasonal Presets (Monsoon / Winter / Summer) */}
                    {!isFallow ? (
                      <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-sunken p-2.5">
                        <span className="text-source font-medium text-ink-muted">Quick seasonal dates</span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => applySeasonPreset(slot, "monsoon")}
                            className="inline-flex min-h-tap cursor-pointer items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-source font-medium text-ink hover:border-field hover:text-field"
                          >
                            <Icon name="calendar" size={15} />
                            <span>Monsoon · Jun–Oct</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => applySeasonPreset(slot, "winter")}
                            className="inline-flex min-h-tap cursor-pointer items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-source font-medium text-ink hover:border-field hover:text-field"
                          >
                            <Icon name="calendar" size={15} />
                            <span>Winter · Oct–Feb</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => applySeasonPreset(slot, "summer")}
                            className="inline-flex min-h-tap cursor-pointer items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-source font-medium text-ink hover:border-field hover:text-field"
                          >
                            <Icon name="calendar" size={15} />
                            <span>Summer · Feb–May</span>
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Dates Pickers with Synchronized Duration */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        type="date"
                        label={copy.rotation.plantDateLabel}
                        value={slot.plantDate}
                        onChange={(e) => handlePlantDateChange(slot, e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        helperText={isSuggested ? "Suggested from the usual season. Change it to your real date." : "Changing planting date automatically maintains crop duration"}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        type="date"
                        label={copy.rotation.harvestDateLabel}
                        value={slot.harvestDate}
                        onChange={(e) => handleUpdateSlot(slot.id, { harvestDate: e.target.value })}
                        slotProps={{ inputLabel: { shrink: true } }}
                        helperText={`${duration} days total in ground`}
                        size="small"
                        fullWidth
                      />
                    </div>

                    {/* Regional Agronomic Window Tip if available */}
                    {regionalCal ? (
                      <p className="m-0 flex items-start gap-1.5 text-source text-ink-muted">
                        <Icon name="estimate" size={15} className="mt-0.5 shrink-0" />
                        <span>Regional calendar for {regionName}: sowing is usually between {formatDay(`2026-${regionalCal.sowWindow[0]}`)} and {formatDay(`2026-${regionalCal.sowWindow[1]}`)} ({regionalCal.durationDays[0]}–{regionalCal.durationDays[1]} days).</span>
                      </p>
                    ) : null}

                    {/* Date certainty stays with the dates */}
                    {!isFallow ? (
                      <Segmented
                        legend={copy.rotation.dateConfidenceLabel}
                        value={slot.dateConfidence}
                        onChange={(val) => handleUpdateSlot(slot.id, { dateConfidence: val as DateConfidence })}
                        options={[
                          { value: "exact", label: copy.rotation.confidenceExact },
                          { value: "approx", label: copy.rotation.confidenceApprox },
                          { value: "typical", label: copy.rotation.confidenceTypical },
                        ]}
                      />
                    ) : null}

                    {/* Field practices, grouped and shown only where they apply */}
                    {!isFallow ? (
                      <details className="group rounded-md border border-line" open={transition?.status === "relay" || undefined}>
                        <summary className="flex min-h-tap cursor-pointer list-none flex-wrap items-center gap-x-2 px-3 text-label font-medium text-field [&::-webkit-details-marker]:hidden">
                          <ChevronRightGlyph className="transition-transform group-open:rotate-90" />
                          Field practices
                          <span className="text-source font-normal text-ink-muted">
                            {[
                              slot.irrigated ? "Irrigated" : "Rain-fed",
                              ESTABLISHMENT_LABEL[slot.establishmentMode ?? "tillage"],
                              slot.residueFate && slot.residueFate !== "unknown" ? RESIDUE_LABEL[slot.residueFate] : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </summary>
                        <div className="flex flex-col gap-4 border-t border-line p-3">
                          <div className="flex flex-col">
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={slot.irrigated}
                                  onChange={(e) => handleUpdateSlot(slot.id, { irrigated: e.target.checked })}
                                  color="primary"
                                />
                              }
                              label={<span className="text-label text-ink">{copy.rotation.irrigatedLabel}</span>}
                            />
                            <span className="text-body-sm text-ink-muted">{copy.rotation.irrigatedHelp}</span>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <TextField
                              select
                              label="How it is sown"
                              value={slot.establishmentMode ?? "tillage"}
                              onChange={(e) => handleUpdateSlot(slot.id, { establishmentMode: e.target.value as EstablishmentMode })}
                              size="small"
                              fullWidth
                            >
                              <MenuItem value="tillage">{ESTABLISHMENT_LABEL.tillage}</MenuItem>
                              <MenuItem value="zero_till">{ESTABLISHMENT_LABEL.zero_till}</MenuItem>
                              {prevSlot || slot.establishmentMode === "relay_broadcast" ? (
                                <MenuItem value="relay_broadcast">{ESTABLISHMENT_LABEL.relay_broadcast}</MenuItem>
                              ) : null}
                              <MenuItem value="unknown">Not sure</MenuItem>
                            </TextField>

                            <TextField
                              select
                              label="What happens to crop residue"
                              value={slot.residueFate ?? (slot.residue === "retained" ? "retain_incorporate" : slot.residue === "burned" ? "burn" : slot.residue === "removed" ? "remove_fodder" : "unknown")}
                              onChange={(e) => handleUpdateSlot(slot.id, { residueFate: e.target.value as ResidueFate })}
                              size="small"
                              fullWidth
                            >
                              <MenuItem value="retain_incorporate">{RESIDUE_LABEL.retain_incorporate}</MenuItem>
                              <MenuItem value="retain_mulch">{RESIDUE_LABEL.retain_mulch}</MenuItem>
                              <MenuItem value="remove_fodder">{RESIDUE_LABEL.remove_fodder}</MenuItem>
                              <MenuItem value="burn">{RESIDUE_LABEL.burn}</MenuItem>
                              <MenuItem value="unknown">Not sure</MenuItem>
                            </TextField>
                          </div>

                          {/* Drainage matters when this crop follows flooded paddy */}
                          {prevSlot?.cropId === "rice" || (slot.farmerObservedDrainage && slot.farmerObservedDrainage !== "adequate") ? (
                            <TextField
                              select
                              label={prevSlot?.cropId === "rice" ? "Drainage after the rice harvest" : "Observed drainage"}
                              value={slot.farmerObservedDrainage ?? "adequate"}
                              onChange={(e) =>
                                handleUpdateSlot(slot.id, {
                                  farmerObservedDrainage: e.target.value as "waterlogged" | "adequate" | "dry" | "unknown",
                                })
                              }
                              size="small"
                              fullWidth
                            >
                              <MenuItem value="adequate">Drains well</MenuItem>
                              <MenuItem value="waterlogged">Stays wet or waterlogged</MenuItem>
                              <MenuItem value="dry">Dries out quickly</MenuItem>
                              <MenuItem value="unknown">Not sure</MenuItem>
                            </TextField>
                          ) : null}
                        </div>
                      </details>
                    ) : null}

                    {/* Notes disclosure */}
                    <details className="group" open={Boolean(slot.notes) || undefined}>
                      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 text-label text-field [&::-webkit-details-marker]:hidden">
                        <ChevronRightGlyph className="transition-transform group-open:rotate-90" />
                        {copy.rotation.notesLabel}
                      </summary>
                      <TextField
                        placeholder={copy.rotation.notesPlaceholder}
                        value={slot.notes ?? ""}
                        onChange={(e) => handleUpdateSlot(slot.id, { notes: e.target.value })}
                        multiline
                        rows={2}
                        size="small"
                        fullWidth
                        slotProps={{ htmlInput: { "aria-label": copy.rotation.notesLabel } }}
                      />
                    </details>
                  </Panel>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Save Success Notice */}
      {saveSuccess ? (
        <Message tone="success" role="status" title={copy.rotation.savedNotice} />
      ) : null}

      {/* Primary Bottom Action Bar */}
      <ActionBar>
        <Button
          variant="primary"
          size="lg"
          iconEnd="next"
          onClick={() => void handleSave(true)}
          disabled={saving || slots.length === 0}
        >
          {copy.rotation.saveAndNext}
        </Button>
      </ActionBar>
        </>
      )}
    </>
  );
}
