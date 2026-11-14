import { getCropById } from "../data/crops";
import type { SlopeStats } from "../nasa/derive/slope";
import { steepnessClass } from "../nasa/derive/slope";
import type { Rotation, RuleScope } from "../types";
import type { MonthlyNormal } from "./climate";
import type { RotationStructure } from "./structure";

/**
 * Soil-health mechanisms with their evidence scope. Nothing here is a soil-carbon, nitrogen-credit or
 * soil-loss prediction: those need local soil data and validated models. Satellite greenness is never
 * a soil-health score.
 */

export interface NitrogenAssessment {
  /** Fixation range summed over legume slots, kg N/ha per cycle. Null when no slot has a sourced range. */
  fixedKgHa: [number, number] | null;
  fixingSlots: number;
  /** N removed in grain, kg N/ha, only from yields the farmer entered. Null otherwise. */
  removedKgHa: number | null;
  removedSlots: number;
  unknownRemovalSlots: number;
  scope: RuleScope | null;
  note: string;
}

export function nitrogenAssessment(rotation: Pick<Rotation, "slots">): NitrogenAssessment {
  let lo = 0;
  let hi = 0;
  let fixing = 0;
  let removed = 0;
  let removedSlots = 0;
  let unknown = 0;
  let scope: RuleScope | null = null;
  for (const s of rotation.slots) {
    const crop = s.cropId ? getCropById(s.cropId) : undefined;
    const fix = crop?.profile?.nFixKgHa;
    if (fix) {
      lo += fix.value[0];
      hi += fix.value[1];
      fixing++;
      scope = fix.scope;
    }
    if (s.kind === "crop" && crop) {
      const grainN = crop.profile?.grainNPct?.value;
      const y = s.yield;
      const kgHa = y ? (y.unit.toLowerCase().startsWith("t") ? y.value * 1000 : y.unit.toLowerCase().startsWith("kg") ? y.value : null) : null;
      if (grainN !== undefined && kgHa !== null) {
        removed += (kgHa * grainN) / 100;
        removedSlots++;
      } else unknown++;
    }
  }
  return {
    fixedKgHa: fixing ? [lo, hi] : null,
    fixingSlots: fixing,
    removedKgHa: removedSlots > 0 && unknown === 0 ? removed : null,
    removedSlots,
    unknownRemovalSlots: unknown,
    scope,
    note:
      "Nitrogen fixed by a legume is not the same as nitrogen left in the soil after harvest. Fixation ranges are wide literature " +
      "starting values (analyst scope). Removal is only shown from yields you entered; otherwise it is unknown.",
  };
}

export const RAINY_MONTH_MM: { value: number; scope: RuleScope; ref: string } = {
  value: 100,
  scope: "analyst-assumption",
  ref: "A month with at least 100 mm of mean rain is treated as rainy for this screen. Analyst choice.",
};
export const LOW_NDVI: { value: number; scope: RuleScope; ref: string } = {
  value: 0.25,
  scope: "analyst-assumption",
  ref: "NDVI below 0.25 is treated as low cover. Greenness is not bare soil; flooded fields and residues behave differently.",
};

export type ErosionExposure = "not-flagged" | "possible" | "elevated" | "needs-slope-data";

export interface ErosionScreen {
  exposure: ErosionExposure;
  slopeClass: ReturnType<typeof steepnessClass>;
  medianSlopeDeg: number | null;
  /** Planned no-crop intervals that fall in rainy months. */
  rainyGaps: Array<{ from: string; to: string; months: number[] }>;
  reasons: string[];
  caveats: string[];
}

/**
 * Qualitative erosion-exposure screen: slope x planned low-cover intervals x rainy months. It does
 * not estimate soil loss. That needs soil erodibility, support practices and a validated model.
 */
export function erosionScreen(structure: RotationStructure, normals: MonthlyNormal[], slope: SlopeStats | null): ErosionScreen {
  const rainyMonths = new Set(normals.filter((n) => Number.isFinite(n.rainMm) && n.rainMm >= RAINY_MONTH_MM.value).map((n) => n.month));
  const rainyGaps = structure.gaps
    .map((g) => ({ from: g.from, to: g.to, months: g.months.filter((m) => rainyMonths.has(m)) }))
    .filter((g) => g.months.length > 0);
  const slopeClass = steepnessClass(slope?.medianDeg ?? null);
  const reasons: string[] = [];
  const caveats = [
    "This screen does not estimate soil loss. That needs soil erodibility, management and a validated model.",
    "Daily rain totals are not a rainfall-erosivity factor.",
  ];
  if (rainyGaps.length === 0) reasons.push("No planned bare interval falls in a rainy month.");
  else reasons.push(`${rainyGaps.length} planned bare interval${rainyGaps.length > 1 ? "s" : ""} overlap rainy months.`);

  let exposure: ErosionExposure;
  if (slopeClass === "unknown") {
    exposure = "needs-slope-data";
    reasons.push("Slope has not been read for this field, so the screen is incomplete.");
  } else if (rainyGaps.length === 0) {
    exposure = "not-flagged";
    reasons.push(`Slope is ${slopeClass}.`);
  } else if (slopeClass === "steep") {
    exposure = "elevated";
    reasons.push("The ground is steep and has a bare, rainy interval.");
  } else if (slopeClass === "moderate") {
    exposure = "possible";
    reasons.push("The ground has a moderate slope and a bare, rainy interval.");
  } else {
    exposure = "not-flagged";
    reasons.push("The ground is gentle, so a bare rainy interval is less likely to matter.");
  }
  return { exposure, slopeClass, medianSlopeDeg: slope?.medianDeg ?? null, rainyGaps, reasons, caveats };
}

export interface Mechanism {
  id: string;
  title: string;
  text: string;
  scope: RuleScope;
  ref: string;
}

/** Qualitative organic-matter and structure mechanisms present in the rotation. */
export function soilMechanisms(rotation: Pick<Rotation, "slots">, structure: RotationStructure): Mechanism[] {
  const out: Mechanism[] = [];
  const crops = rotation.slots.map((s) => (s.cropId ? getCropById(s.cropId) : undefined));
  if (structure.legumeSlots > 0) {
    out.push({
      id: "legume-n",
      title: "Nitrogen-fixing crop in the cycle",
      text: `${structure.legumeSlots} of ${structure.cropSlots} crop slots are legumes, which can supply some of their own nitrogen.`,
      scope: "analyst-assumption",
      ref: "FAO conservation agriculture: species diversification",
    });
  }
  if (structure.coverSlots > 0 || crops.some((c) => c?.coverCropRoles?.includes("organic-matter"))) {
    out.push({
      id: "cover-om",
      title: "Cover crop or residue source",
      text: "A cover crop or high-residue crop returns plant material that can feed soil organic matter, if it is left on or in the soil.",
      scope: "analyst-assumption",
      ref: "FAO conservation agriculture principles",
    });
  }
  const deep = crops.filter((c) => (c?.rootDepthM ?? 0) >= 1.2).length;
  if (deep > 0) {
    out.push({
      id: "deep-roots",
      title: "Deep-rooting crop",
      text: "Deeper roots can open channels and draw on deeper water. The effect depends on the soil and is not measured here.",
      scope: "analyst-assumption",
      ref: "Library rooting depth values",
    });
  }
  if (structure.longestSameFamilyRun > 1) {
    out.push({
      id: "same-family",
      title: "Same crop family in a row",
      text: `The longest run of one crop family is ${structure.longestSameFamilyRun}. Repeating a family gives up some of the diversity benefit.`,
      scope: "analyst-assumption",
      ref: "FAO species diversification",
    });
  }
  const retained = rotation.slots.filter((s) => s.residue === "retained").length;
  const burned = rotation.slots.filter((s) => s.residue === "burned").length;
  if (retained > 0) out.push({ id: "residue-kept", title: "Residue kept on the field", text: `You record keeping residue in ${retained} slot${retained > 1 ? "s" : ""}.`, scope: "local-validated", ref: "Farmer report" });
  if (burned > 0) out.push({ id: "residue-burned", title: "Residue burned", text: `You record burning residue in ${burned} slot${burned > 1 ? "s" : ""}, which removes that organic input.`, scope: "local-validated", ref: "Farmer report" });
  return out;
}
