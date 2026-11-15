"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { SowingPicker } from "@/components/field/rotation/sowing-picker";
import { usePick } from "@/components/shell/use-pick";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Icon } from "@/components/ui/icon";
import { Message } from "@/components/ui/message";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { CROPS, getCropById } from "@/lib/data/crops";
import { evaluateTransition, isRelayPairEligible } from "@/lib/engine/transition";
import type { MonthPart } from "@/lib/plan/auto-dates";
import { usualSowMonths } from "@/lib/plan/auto-dates";
import { daysBetween, addDaysToIso, formatDay, shortSlotName, slotName } from "@/lib/rotation-format";
import { useAppCopy } from "@/lib/store/locale-store";
import type { DateConfidence, EstablishmentMode, RegionId, ResidueFate, RotationSlot } from "@/lib/types";

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

/** Botanical family and plain group, shown as a muted helper line under the crop selector. */
function cropFamilyLine(cropId: string): string | undefined {
  const crop = getCropById(cropId);
  if (!crop) return undefined;
  const group = crop.group.replace(/-/g, " ");
  return `${crop.family} · ${group.charAt(0).toUpperCase()}${group.slice(1)}`;
}

export interface SlotCardProps {
  slot: RotationSlot;
  index: number;
  prevSlot: RotationSlot | null;
  regionKey?: RegionId;
  regionName?: string | null;
  error?: string;
  /** Show "how sure are you" once the farmer has changed a date. */
  showConfidence: boolean;
  /** Set when the harvest date moved on its own after a sowing change. */
  harvestMoved: boolean;
  onUpdate: (patch: Partial<RotationSlot>) => void;
  onSowPick: (month: number, part: MonthPart) => void;
  onPlantDate: (date: string) => void;
  onHarvestDate: (date: string) => void;
  onCropChange: (value: string) => void;
  onRemove: () => void;
  onShiftAfterPrevious: () => void;
}

/**
 * One crop in the rotation. The farmer taps a month for sowing; harvest follows from the crop's usual
 * length. Exact date fields, how sure they are, and agronomy details sit behind named sections.
 */
export function SlotCard({
  slot,
  index,
  prevSlot,
  regionKey,
  regionName,
  error,
  showConfidence,
  harvestMoved,
  onUpdate,
  onSowPick,
  onPlantDate,
  onHarvestDate,
  onCropChange,
  onRemove,
  onShiftAfterPrevious,
}: SlotCardProps) {
  const copy = useAppCopy();
  const pick = usePick();
  const isFallow = slot.kind === "fallow";
  const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
  const duration = daysBetween(slot.plantDate, slot.harvestDate);
  const isSuggested = !isFallow && slot.dateConfidence === "typical";
  const transition = prevSlot ? evaluateTransition(prevSlot, slot) : null;
  const isOverlapping = transition?.status === "collision";
  const regionalCal = regionKey ? crop?.profile?.regionalCalendars[regionKey] : undefined;
  const usualMonths = isFallow ? [] : usualSowMonths(slot.cropId, regionKey);
  const name = slotName(slot);

  return (
    <Panel
      as="div"
      aria-label={`${copy.rotation.slotBadge(index)}: ${name}`}
      className={cn(
        "flex flex-col gap-5 p-4 sm:p-5",
        error ? "border-heat" : isOverlapping ? "border-heat/60" : transition?.status === "relay" ? "border-healthy/50" : "",
      )}
    >
      {/* Who this card is about, and the one destructive action */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="tabular grid size-9 shrink-0 place-items-center rounded-pill bg-field font-mono text-body text-on-field">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-title text-ink [overflow-wrap:anywhere]">{name}</p>
            {crop?.names.local?.[0] ? <p className="m-0 text-body-sm text-ink-muted">{crop.names.local[0]}</p> : null}
          </div>
        </div>
        <Button
          variant="destructive"
          icon="remove"
          onClick={onRemove}
          className="shrink-0"
          aria-label={`${copy.rotation.removeCrop}: ${name}`}
        >
          {pick("Remove", "ဖယ်ရှားမည်")}
        </Button>
      </div>

      {/* The answer first: when, in words */}
      {!isFallow ? (
        <div className="flex flex-col gap-3 rounded-md bg-surface-sunken p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5 text-body-sm text-ink-muted">
                <Icon name="rotation" size={15} aria-hidden />
                {pick("Sow", "စိုက်")}{isSuggested ? <span className="text-ink-muted"> · {pick("about", "ခန့်")}</span> : null}
              </span>
              <span className="text-title text-ink">
                {formatDay(slot.plantDate)}
                <span className="ml-1.5 font-mono text-body-sm font-normal text-ink-muted">{slot.plantDate.slice(0, 4)}</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5 text-body-sm text-ink-muted">
                <Icon name="calendar" size={15} aria-hidden />
                {pick("Harvest", "ရိတ်သိမ်း")}{isSuggested ? <span className="text-ink-muted"> · {pick("about", "ခန့်")}</span> : null}
              </span>
              <span className="text-title text-ink">
                {formatDay(slot.harvestDate)}
                <span className="ml-1.5 font-mono text-body-sm font-normal text-ink-muted">{slot.harvestDate.slice(0, 4)}</span>
              </span>
            </div>
          </div>
          <p className="m-0 flex items-start gap-1.5 text-body-sm text-ink-muted">
            <Icon name={isSuggested ? "estimate" : "done"} size={15} className="mt-0.5 shrink-0" aria-hidden />
            {isSuggested ? (
              <span>
                <span className="font-medium text-ink">{pick("Suggested dates.", "အကြံပြုရက်များ။")}</span> {pick("Tap a month below to match your farm.", "သင့်လယ်နှင့်ကိုက်ညီအောင် အောက်က လကို နှိပ်ပါ။")}
                <span className="font-mono"> · {duration} days</span>
              </span>
            ) : (
              <span>
                <span className="font-medium text-ink">{pick("Your dates", "သင့်ရက်များ")}</span>
                <span className="font-mono"> · {duration} days</span>
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="m-0 text-body text-ink-muted">{pick("Bare soil: nothing grows in this period.", "ဤကာလတွင် မည်သည့်သီးနှံမျှ မစိုက်ပါ။")}</p>
      )}

      {error ? (
        <p role="alert" className="m-0 text-body-sm font-medium text-heat">
          {error}
        </p>
      ) : null}

      {/* Relay broadcast (Ye-pyan) fits */}
      {transition?.status === "relay" && prevSlot ? (
        <Message tone="success" compact title="Relay broadcast (Ye-pyan) fits">
          Sown {transition.overlapDays} days before {shortSlotName(prevSlot)} harvest, inside the valid pre-harvest window.
        </Message>
      ) : null}

      {/* Overlap, with one-tap fixes */}
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
                    const dur = daysBetween(slot.plantDate, slot.harvestDate) || 90;
                    const newPlant = addDaysToIso(prevSlot.harvestDate, -7);
                    onUpdate({ establishmentMode: "relay_broadcast", plantDate: newPlant, harvestDate: addDaysToIso(newPlant, dur) });
                  }}
                >
                  {copy.rotation.relayFix(shortSlotName(prevSlot))}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" icon="go" onClick={onShiftAfterPrevious}>
                {copy.rotation.startAfterFix(shortSlotName(prevSlot))}
              </Button>
            </>
          }
        >
          {transition.message}
        </Message>
      ) : null}

      {/* Two taps instead of a calendar */}
      {!isFallow ? (
        <SowingPicker cropName={crop?.names.common.replace(/\s*\(.*\)\s*$/, "") ?? name} plantDate={slot.plantDate} usualMonths={usualMonths} onPick={onSowPick} />
      ) : null}

      {harvestMoved ? (
        <p role="status" className="m-0 flex items-center gap-1.5 text-body-sm font-medium text-field">
          <Icon name="next" size={15} aria-hidden />
          {copy.rotation.harvestMoved(formatDay(slot.harvestDate))}
        </p>
      ) : null}

      {/* Exact days, for the farmer who knows them */}
      {!isFallow ? (
        <Disclosure title={pick("Change the exact dates", "ရက်အတိအကျ ပြောင်းမည်")} hint={pick("optional", "မဖြစ်မနေမလို")}>
          {showConfidence ? (
            <Segmented
              legend={copy.rotation.dateConfidenceLabel}
              value={slot.dateConfidence}
              onChange={(val) => onUpdate({ dateConfidence: val as DateConfidence })}
              options={[
                { value: "exact", label: copy.rotation.confidenceExact },
                { value: "approx", label: copy.rotation.confidenceApprox },
                { value: "typical", label: copy.rotation.confidenceTypical },
              ]}
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              type="date"
              label={copy.rotation.plantDateLabel}
              value={slot.plantDate}
              onChange={(e) => onPlantDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText={isSuggested ? "Suggested from the usual season. Change it to your real date." : copy.rotation.plantDateHelp}
              fullWidth
            />
            <TextField
              type="date"
              label={copy.rotation.harvestDateLabel}
              value={slot.harvestDate}
              onChange={(e) => onHarvestDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText={`${duration} days total in ground`}
              fullWidth
            />
          </div>
        </Disclosure>
      ) : null}

      {/* Water */}
      {!isFallow ? (
        <FormControlLabel
          className="m-0 items-start"
          control={<Switch checked={slot.irrigated} onChange={(e) => onUpdate({ irrigated: e.target.checked })} color="primary" />}
          label={
            <span className="flex flex-col">
              <span className="text-body text-ink">{copy.rotation.irrigatedLabel}</span>
              <span className="text-body-sm text-ink-muted">{copy.rotation.irrigatedHelp}</span>
            </span>
          }
        />
      ) : null}

      {/* Everything optional, in one place */}
      <Disclosure
        title={copy.rotation.moreDetails}
        defaultOpen={transition?.status === "relay" || Boolean(slot.notes)}
        hint={
          !isFallow
            ? [ESTABLISHMENT_LABEL[slot.establishmentMode ?? "tillage"], slot.residueFate && slot.residueFate !== "unknown" ? RESIDUE_LABEL[slot.residueFate] : null]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      >
        <TextField
          select
          label={copy.rotation.cropLabel}
          value={isFallow ? "fallow" : (slot.cropId ?? "")}
          onChange={(e) => onCropChange(e.target.value)}
          size="small"
          fullWidth
          helperText={!isFallow && slot.cropId ? cropFamilyLine(slot.cropId) : undefined}
        >
          <MenuItem value="" disabled>
            {copy.rotation.selectCropPrompt}
          </MenuItem>
          {CROPS.map((c) => {
            const local = c.names.local?.[0] ? ` · ${c.names.local[0]}` : "";
            const ref = c.scope === "reference-only" ? " (reference only)" : "";
            return (
              <MenuItem key={c.id} value={c.id}>
                {c.names.common}
                {local}
                {ref}
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
            onChange={(e) => onUpdate({ variety: e.target.value })}
            size="small"
            fullWidth
          />
        ) : null}

        {!isFallow ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              select
              label="How it is sown"
              value={slot.establishmentMode ?? "tillage"}
              onChange={(e) => onUpdate({ establishmentMode: e.target.value as EstablishmentMode })}
              size="small"
              fullWidth
            >
              <MenuItem value="tillage">{ESTABLISHMENT_LABEL.tillage}</MenuItem>
              <MenuItem value="zero_till">{ESTABLISHMENT_LABEL.zero_till}</MenuItem>
              {prevSlot || slot.establishmentMode === "relay_broadcast" ? <MenuItem value="relay_broadcast">{ESTABLISHMENT_LABEL.relay_broadcast}</MenuItem> : null}
              <MenuItem value="unknown">Not sure</MenuItem>
            </TextField>

            <TextField
              select
              label="What happens to crop residue"
              value={slot.residueFate ?? (slot.residue === "retained" ? "retain_incorporate" : slot.residue === "burned" ? "burn" : slot.residue === "removed" ? "remove_fodder" : "unknown")}
              onChange={(e) => onUpdate({ residueFate: e.target.value as ResidueFate })}
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
        ) : null}

        {/* Drainage matters when this crop follows flooded paddy */}
        {!isFallow && (prevSlot?.cropId === "rice" || (slot.farmerObservedDrainage && slot.farmerObservedDrainage !== "adequate")) ? (
          <TextField
            select
            label={prevSlot?.cropId === "rice" ? "Drainage after the rice harvest" : "Observed drainage"}
            value={slot.farmerObservedDrainage ?? "adequate"}
            onChange={(e) => onUpdate({ farmerObservedDrainage: e.target.value as "waterlogged" | "adequate" | "dry" | "unknown" })}
            size="small"
            fullWidth
          >
            <MenuItem value="adequate">Drains well</MenuItem>
            <MenuItem value="waterlogged">Stays wet or waterlogged</MenuItem>
            <MenuItem value="dry">Dries out quickly</MenuItem>
            <MenuItem value="unknown">Not sure</MenuItem>
          </TextField>
        ) : null}

        <TextField
          label={copy.rotation.notesLabel}
          placeholder={copy.rotation.notesPlaceholder}
          value={slot.notes ?? ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          multiline
          rows={2}
          size="small"
          fullWidth
        />

        {regionalCal ? (
          <p className="m-0 flex items-start gap-1.5 text-body-sm text-ink-muted">
            <Icon name="estimate" size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Regional calendar for {regionName}: sowing is usually between {formatDay(`2026-${regionalCal.sowWindow[0]}`)} and {formatDay(`2026-${regionalCal.sowWindow[1]}`)} ({regionalCal.durationDays[0]}–{regionalCal.durationDays[1]} days).
            </span>
          </p>
        ) : null}
      </Disclosure>
    </Panel>
  );
}
