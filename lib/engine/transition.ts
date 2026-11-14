import type { RotationSlot } from "../types";
import { daysBetween, addDaysToIso } from "../rotation-format";

export type TurnaroundMethod = "standard_turnaround" | "zero_till" | "relay_broadcast";

export const DEFAULT_TURNAROUND_DAYS = 14;
export const ZERO_TILL_TURNAROUND_DAYS = 7;
export const DEFAULT_RELAY_OVERLAP_DAYS = 7;
export const MAX_RELAY_OVERLAP_DAYS = 12;

/**
 * Checks whether two crops support pre-harvest relay broadcasting (Ye-pyan).
 * Sourced from ACIAR / World Bank Myanmar rice-pulse agronomy guidelines:
 * Relay broadcasting is documented for black gram (Matpe) and green gram (Pedisein)
 * established in standing lowland monsoon rice 7 to 10 days before drainage/harvest.
 */
export function isRelayPairEligible(previousCropId?: string | null, nextCropId?: string | null): boolean {
  if (!previousCropId || !nextCropId) return false;
  const prev = previousCropId.toLowerCase().replace(/_/g, "-");
  const next = nextCropId.toLowerCase().replace(/_/g, "-");
  return prev === "rice" && (next === "black-gram" || next === "green-gram");
}

export interface TransitionAssessment {
  status: "valid" | "relay" | "collision";
  evaluationStatus?: "not-evaluated";
  gapDays: number; // positive = days bare/idle; negative = days overlapping
  overlapDays: number; // 0 if no overlap; positive if overlapping
  allowedRelayDays: number;
  isRelay: boolean;
  message: string;
}

/**
 * Evaluates the transition between consecutive crop slots.
 * Negative gap (plantB < harvestA) is valid ONLY if:
 * 1. nextSlot explicitly selects relay_broadcast establishment mode;
 * 2. previous and next crops form a documented relay pair (e.g. rice -> pulse);
 * 3. the overlap does not exceed the biological tolerance (max 12 days).
 * Otherwise, negative gap is reported as a collision error.
 */
export function evaluateTransition(
  prevSlot: Pick<RotationSlot, "cropId" | "harvestDate">,
  nextSlot: Pick<RotationSlot, "cropId" | "plantDate" | "establishmentMode">,
): TransitionAssessment {
  // gapDays: days between previous harvest and next planting
  // positive = next planting is after previous harvest
  // negative = next planting is before previous harvest
  const gapDays = daysBetween(prevSlot.harvestDate, nextSlot.plantDate);
  const overlapDays = gapDays < 0 ? Math.abs(gapDays) : 0;
  const isEligiblePair = isRelayPairEligible(prevSlot.cropId, nextSlot.cropId);
  const isRelayMode = nextSlot.establishmentMode === "relay_broadcast";
  const allowedRelayDays = isEligiblePair ? MAX_RELAY_OVERLAP_DAYS : 0;

  if (gapDays >= 0) {
    return {
      status: "valid",
      gapDays,
      overlapDays: 0,
      allowedRelayDays,
      isRelay: false,
      message: gapDays === 0 ? "Immediate succession (0-day gap)" : `${gapDays} days turnaround between crops`,
    };
  }

  // gapDays < 0 (overlap)
  if (isRelayMode && isEligiblePair && overlapDays <= MAX_RELAY_OVERLAP_DAYS) {
    return {
      status: "relay",
      gapDays,
      overlapDays,
      allowedRelayDays,
      isRelay: true,
      evaluationStatus: "not-evaluated",
      message: `Relay recorded ${overlapDays} days before harvest. Overlapping water/ET, disease and planting-window models are unverified; check this practice locally.`,
    };
  }

  let message = `Date overlap: starts ${overlapDays} days before previous harvest finishes.`;
  if (gapDays < -MAX_RELAY_OVERLAP_DAYS && isEligiblePair && isRelayMode) {
    message = `Relay overlap of ${overlapDays} days is outside the legacy calendar screen; local review is needed. No biological safety limit is established here.`;
  } else if (gapDays < 0 && !isEligiblePair && isRelayMode) {
    message = `Relay broadcasting is not documented for this crop pairing. Sowing overlaps by ${overlapDays} days.`;
  } else if (gapDays < 0 && !isRelayMode) {
    message = `Sowing overlaps by ${overlapDays} days with preceding crop. Check dates or select relay broadcasting if applicable.`;
  }

  return {
    status: "collision",
    gapDays,
    overlapDays,
    allowedRelayDays,
    isRelay: false,
    message,
  };
}

/**
 * Repairs a transition by snapping the next crop to pre-harvest relay broadcast (-7d default).
 */
export function snapToRelayBroadcast<T extends Pick<RotationSlot, "plantDate" | "harvestDate">>(
  prevSlot: Pick<RotationSlot, "harvestDate">,
  nextSlot: T,
  relayDays = 7
): T {
  const duration = daysBetween(nextSlot.plantDate, nextSlot.harvestDate);
  const newPlant = addDaysToIso(prevSlot.harvestDate, -relayDays);
  return {
    ...nextSlot,
    plantDate: newPlant,
    harvestDate: addDaysToIso(newPlant, duration),
  };
}

/**
 * Repairs a transition by snapping the next crop to standard post-harvest turnaround (+14d default).
 */
export function snapToStandardTurnaround<T extends Pick<RotationSlot, "plantDate" | "harvestDate">>(
  prevSlot: Pick<RotationSlot, "harvestDate">,
  nextSlot: T,
  turnaroundDays = 14
): T {
  const duration = daysBetween(nextSlot.plantDate, nextSlot.harvestDate);
  const newPlant = addDaysToIso(prevSlot.harvestDate, turnaroundDays);
  return {
    ...nextSlot,
    plantDate: newPlant,
    harvestDate: addDaysToIso(newPlant, duration),
  };
}
