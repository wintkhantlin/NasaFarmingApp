"use client";

import { ActionBar } from "@/components/ui/action-bar";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { Button, buttonClass } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph, PlusGlyph } from "@/components/ui/icons";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { CROPS, getCropById, getDefaultTypicalDates } from "@/lib/data/crops";
import { REGIONS } from "@/lib/data/regions";
import { formatSpan, plural, shortSlotName, slotName, yearFraction } from "@/lib/rotation-format";
import { rotationSchema, rotationSlotSchema } from "@/lib/schemas/rotation";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import type { DateConfidence, Rotation, RotationSlot } from "@/lib/types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * One lane per year of the cycle, a month axis, and each crop as a bar from
 * planting to harvest. A bar that runs past December stops at the edge of its
 * lane. Gaps stay empty: that is bare soil. The cards below are the editor.
 */
function RotationRibbon({ slots, cycleYears }: { slots: RotationSlot[]; cycleYears: number }) {
  const firstYear = Math.min(...slots.map((s) => Number(s.plantDate.slice(0, 4)) || new Date().getFullYear()));
  const lanes = Array.from({ length: cycleYears }, (_, i) => firstYear + i);

  return (
    <div className="hidden flex-col gap-2 rounded-md border border-line bg-surface-sunken p-4 md:flex" aria-hidden="true">
      <div className="grid grid-cols-[3.5rem_repeat(12,minmax(0,1fr))] text-source text-ink-muted">
        <span />
        {MONTH_NAMES.map((m, i) => (
          <span key={i} className="text-center font-sans">
            {m}
          </span>
        ))}
      </div>
      {lanes.map((year) => (
        <div key={year} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center">
          <span className="tabular font-mono text-source text-ink-muted">{year}</span>
          <div className="relative h-10 rounded-sm bg-surface-raised">
            {/* faint month gridlines without heavy cell borders */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-12">
              {MONTH_NAMES.map((_, i) => (
                <span key={i} className={cn("border-line/40", i > 0 && "border-l")} />
              ))}
            </div>
            {slots
              .filter((s) => Number(s.plantDate.slice(0, 4)) === year)
              .map((s) => {
                const start = yearFraction(s.plantDate);
                const sameYear = s.harvestDate.slice(0, 4) === s.plantDate.slice(0, 4);
                const end = sameYear ? yearFraction(s.harvestDate) : 1;
                const fallow = s.kind === "fallow";
                return (
                  <span
                    key={s.id}
                    className={cn(
                      "absolute inset-y-1 flex min-w-0 items-center overflow-hidden rounded-sm px-2 text-body-sm transition-colors",
                      fallow
                        ? "border-dashed border border-line-strong bg-surface-sunken text-ink-muted"
                        : "border-2 border-field bg-field-soft font-medium text-ink shadow-xs",
                    )}
                    style={{ left: `${start * 100}%`, width: `${Math.max(end - start, 0.06) * 100}%` }}
                  >
                    <span className="truncate">{shortSlotName(s)}</span>
                  </span>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RotationEditor({ fieldId }: { fieldId: string }) {
  const router = useRouter();
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const saveRotation = useFieldsStore((s) => s.saveRotation);

  const [cycleYears, setCycleYears] = useState<1 | 2 | 3 | 4>(1);
  const [slots, setSlots] = useState<RotationSlot[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (!fieldId) return;
    void loadRotations(fieldId).then((loaded) => {
      if (loaded && loaded.length > 0) {
        setCycleYears(loaded[0].cycleYears);
        setSlots(loaded[0].slots);
      }
    });
  }, [fieldId, loadRotations]);

  const summary = useMemo(
    () => `${plural(slots.length, "crop")} over ${plural(cycleYears, "year")}`,
    [slots.length, cycleYears],
  );

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20" />
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

  const markChanged = () => setSaveSuccess(false);

  const handleAddSlot = () => {
    markChanged();
    const nextYear = new Date().getFullYear() + Math.min(slots.length, cycleYears - 1);
    const nextRegion = field.region && field.region !== "unsupported" ? field.region : undefined;
    const nextCropId = nextRegion ? (REGIONS[nextRegion].candidateCropIds[1] ?? REGIONS[nextRegion].candidateCropIds[0]) : "soybean";
    const defaultDates = getDefaultTypicalDates(nextCropId, nextYear, nextRegion);
    setSlots([
      ...slots,
      {
        id: crypto.randomUUID(),
        kind: "crop",
        cropId: nextCropId,
        plantDate: defaultDates.plantDate,
        harvestDate: defaultDates.harvestDate,
        dateConfidence: "typical",
        irrigated: field.irrigation !== "none",
      },
    ]);
  };

  const regionKey = field.region && field.region !== "unsupported" ? field.region : undefined;
  const chipCropIds = regionKey ? REGIONS[regionKey].candidateCropIds : CROPS.slice(0, 8).map((c) => c.id);

  /** Tapping a crop adds it with its usual dates, in the first year where it does not overlap another crop. */
  const toggleCrop = (cropId: string) => {
    markChanged();
    if (slots.some((x) => x.cropId === cropId)) {
      setSlots(slots.filter((x) => x.cropId !== cropId));
      return;
    }
    const base = new Date().getFullYear();
    let chosen = getDefaultTypicalDates(cropId, base, regionKey);
    let offset = 0;
    for (; offset < 3; offset++) {
      chosen = getDefaultTypicalDates(cropId, base + offset, regionKey);
      if (!slots.some((x) => x.plantDate <= chosen.harvestDate && chosen.plantDate <= x.harvestDate)) break;
    }
    setCycleYears((y) => Math.max(y, offset + 1) as 1 | 2 | 3 | 4);
    setSlots([
      ...slots,
      {
        id: crypto.randomUUID(),
        kind: getCropById(cropId)?.group === "cover" ? "cover" : "crop",
        cropId,
        plantDate: chosen.plantDate,
        harvestDate: chosen.harvestDate,
        dateConfidence: "typical",
        irrigated: field.irrigation !== "none",
      },
    ]);
  };

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

  const handleCropChange = (slot: RotationSlot, value: string) => {
    if (value === "fallow") {
      handleUpdateSlot(slot.id, { kind: "fallow", cropId: undefined });
      return;
    }
    // A new crop brings its usual dates, in the year the slot already sits in.
    const year = parseInt(slot.plantDate.slice(0, 4), 10) || new Date().getFullYear();
    const dates = getDefaultTypicalDates(value, year, field?.region && field.region !== "unsupported" ? field.region : undefined);
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
    if (!validate()) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const record: Rotation = {
        id: rotations[0]?.id ?? crypto.randomUUID(),
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

  return (
    <>
      <FieldPageHeader title={copy.rotation.title} summary={copy.rotation.lead} />

      <Panel as="section" aria-labelledby="quick-crops" className="flex flex-col gap-3 p-4 sm:p-5">
        <h2 id="quick-crops" className="m-0 text-headline text-ink">{copy.rotation.quickTitle}</h2>
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
                  "inline-flex min-h-tap cursor-pointer items-center gap-1.5 rounded-pill px-4 py-2 text-label font-medium transition-colors",
                  on ? "bg-field text-on-field" : "border border-line bg-surface text-ink hover:border-line-strong",
                )}
              >
                {on ? <Icon name="done" size={16} /> : null}
                {getCropById(id)?.names.common ?? id}
              </button>
            );
          })}
        </div>
        <p className="m-0 text-body-sm text-ink-muted">{copy.rotation.quickHelp}</p>
      </Panel>

      {slots.length > 0 ? (
      <Disclosure title={copy.rotation.changeDates} hint={summary}>
      <Panel as="div" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
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
        <p className="text-body-sm text-ink-muted" aria-live="polite">
          {summary}
        </p>
      </Panel>

      {slots.length > 0 ? <RotationRibbon slots={slots} cycleYears={cycleYears} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={handleAddSlot} className="w-full sm:w-fit">
          <PlusGlyph />
          {slots.length === 1 ? "Add crop 2" : copy.rotation.addCrop}
        </Button>
        {slots.length === 1 ? <p className="m-0 text-body-sm text-ink-muted">Add the next crop grown in this field. Check its suggested dates before saving.</p> : null}
      </div>

      <div className="flex flex-col gap-4">
        {errors._form ? <Alert severity="error">{errors._form}</Alert> : null}

        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {slots.map((slot, index) => {
            const slotError = errors[slot.id];
            const isFallow = slot.kind === "fallow";
            return (
              <li key={slot.id}>
                <Panel
                  as="div"
                  aria-label={`${copy.rotation.slotBadge(index)}: ${slotName(slot)}`}
                  className={cn("flex flex-col gap-4 p-4 sm:p-5", slotError && "border-heat")}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="tabular grid size-7 shrink-0 place-items-center rounded-pill bg-field font-mono text-source text-on-field"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-headline text-ink">{slotName(slot)}</p>
                        {!isFallow ? (
                          <p className="text-body-sm text-ink-muted">{formatSpan(slot.plantDate, slot.harvestDate)}</p>
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      type="date"
                      label={copy.rotation.plantDateLabel}
                      value={slot.plantDate}
                      onChange={(e) => handleUpdateSlot(slot.id, { plantDate: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      size="small"
                      fullWidth
                    />
                    <TextField
                      type="date"
                      label={copy.rotation.harvestDateLabel}
                      value={slot.harvestDate}
                      onChange={(e) => handleUpdateSlot(slot.id, { harvestDate: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      size="small"
                      fullWidth
                    />
                  </div>

                  {!isFallow ? (
                    <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
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
                    </div>
                  ) : null}

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

      </div>
      </Disclosure>
      ) : null}

      {/* Actions stay in reach: pinned to the bottom of the screen while the list is long. */}
      {saveSuccess ? (
        <p role="status" className="flex items-center gap-1.5 text-body-sm text-healthy">
          <Icon name="done" size={16} />
          {copy.rotation.savedNotice}
        </p>
      ) : null}
      <ActionBar>
        <Button variant="primary" size="lg" iconEnd="next" onClick={() => void handleSave(true)} disabled={saving || slots.length === 0}>
          {copy.rotation.saveAndNext}
        </Button>
      </ActionBar>
    </>
  );
}
