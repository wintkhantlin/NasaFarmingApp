import { getCropById } from "../data/crops";
import type { SlopeStats } from "../nasa/derive/slope";
import { steepnessClass } from "../nasa/derive/slope";
import type { ResidueFate, Rotation, RotationSlot, RuleScope } from "../types";
import { daysBetween } from "../rotation-format";
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

/**
 * Calculates dry grain nitrogen removal in kg N/ha (Section D).
 * dry N removal = Ywet * (1 - moistureFraction) * grainNDryMassFraction.
 * Example: 1,000 kg/ha at 15% moisture (0.15) and 3% N (0.03) removes 25.5 kg N/ha.
 */
export function dryGrainNRemoval(
  yieldWetKgHa: number,
  moistureFraction = 0.15,
  grainNDryMassFraction = 0.03,
): number {
  const dryYieldKgHa = yieldWetKgHa * Math.max(0, 1 - moistureFraction);
  return dryYieldKgHa * Math.max(0, grainNDryMassFraction);
}

/**
 * Calculates conservative enclosure bounds for partial nitrogen budget (Section H4).
 * N_partial = F - G - R in [Fmin - Gmax - Rmax, Fmax - Gmin - Rmin].
 * Example: F in [35, 55], G in [25, 35], R in [5, 15] gives [-15, 25] kg N/ha.
 */
export function partialNitrogenBudgetEnclosure(
  fixedRangeKgHa: [number, number],
  grainRemovedRangeKgHa: [number, number],
  residueRemovedRangeKgHa: [number, number],
): [number, number] {
  const [fMin, fMax] = fixedRangeKgHa;
  const [gMin, gMax] = grainRemovedRangeKgHa;
  const [rMin, rMax] = residueRemovedRangeKgHa;
  return [fMin - gMax - rMax, fMax - gMin - rMin];
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

export interface ResidueNitrogenAssessment {
  status: "quantified" | "unquantified";
  residueFate: ResidueFate;
  exportPercentage: number | null;
  estimatedNextCropAvailableN?: {
    minKgHa: number;
    maxKgHa: number;
    note: string;
  };
  unquantifiedReason?: string;
  scope: RuleScope;
  caveat: string;
}

/**
 * Evaluates nitrogen fate and first-season mineral N availability from crop residue (Prompt 4, A-01).
 * Avoids false precision: unconfirmed residue fate, biomass, or composition returns 'unquantified'
 * rather than an invented guaranteed kg N/ha credit.
 */
export function assessResidueNitrogen(
  slot: RotationSlot,
  nextSlot?: RotationSlot,
): ResidueNitrogenAssessment {
  const fate = slot.residueFate ?? (slot.residue === "retained" ? "retain_incorporate" : slot.residue === "burned" ? "burn" : slot.residue === "removed" ? "remove_fodder" : "unknown");

  if (fate === "unknown") {
    return {
      status: "unquantified",
      residueFate: "unknown",
      exportPercentage: null,
      unquantifiedReason: "Residue management fate is not specified.",
      scope: "local-validated",
      caveat: "Residue effect remains unknown. No plant-available N or soil organic credit is awarded without explicit management data.",
    };
  }

  if (fate === "burn") {
    return {
      status: "quantified",
      residueFate: "burn",
      exportPercentage: 95,
      estimatedNextCropAvailableN: {
        minKgHa: 0,
        maxKgHa: 0,
        note: "Residue burning volatilizes 90–98% of biomass nitrogen into the atmosphere.",
      },
      scope: "analyst-assumption",
      caveat: "Burning provides zero nitrogen carryover and accelerates organic matter depletion.",
    };
  }

  if (fate === "remove_fodder") {
    return {
      status: "quantified",
      residueFate: "remove_fodder",
      exportPercentage: 85,
      estimatedNextCropAvailableN: {
        minKgHa: 0,
        maxKgHa: 2,
        note: "Stover is removed for livestock fodder or fuel; only root and stubble fragments remain.",
      },
      scope: "analyst-assumption",
      caveat: "Residue removal leaves minimal organic N in the field.",
    };
  }

  // Retained: incorporate or mulch
  const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
  const isLegume = crop?.group === "legume" || crop?.profile?.nFixKgHa !== undefined;
  const isHighCnCereal = crop?.group === "cereal" && (crop.residue?.cnRatio ?? 50) > 40;

  let turnaroundDays: number | null = null;
  if (nextSlot) {
    turnaroundDays = daysBetween(slot.harvestDate, nextSlot.plantDate);
  }

  const y = slot.yield;
  const yieldKg = y ? (y.unit.toLowerCase().startsWith("t") ? y.value * 1000 : y.unit.toLowerCase().startsWith("kg") ? y.value : null) : null;

  if (yieldKg === null || !crop) {
    return {
      status: "unquantified",
      residueFate: fate,
      exportPercentage: fate === "retain_incorporate" ? 10 : 15,
      unquantifiedReason: "Residue biomass or nitrogen concentration not quantified from harvest yield.",
      scope: "analyst-assumption",
      caveat: "Potential nitrogen and organic matter benefit; unquantified without measured residue biomass or local calibration.",
    };
  }

  // High C:N cereal straw incorporated with short turnaround (< 21 days) causes temporary immobilization
  if (isHighCnCereal && fate === "retain_incorporate" && turnaroundDays !== null && turnaroundDays < 21) {
    return {
      status: "quantified",
      residueFate: fate,
      exportPercentage: 10,
      estimatedNextCropAvailableN: {
        minKgHa: -10,
        maxKgHa: 0,
        note: `Turnaround of ${turnaroundDays}d is short (<21d). Fresh cereal straw with high C:N (>40:1) can induce microbial nitrogen immobilization at seedling establishment.`,
      },
      scope: "analyst-assumption",
      caveat: "Organic residue N is not immediately mineralized. Microbes assimilate available soil mineral N during early straw decomposition.",
    };
  }

  if (isLegume) {
    const stoverKg = yieldKg * 1.2;
    const stoverNFrac = (crop.profile?.residueNPct?.value ?? 1.4) / 100;
    const totalStoverN = stoverKg * stoverNFrac;
    const m1Min = 0.25;
    const m1Max = 0.40;
    const minN = Number((totalStoverN * m1Min).toFixed(1));
    const maxN = Number((totalStoverN * m1Max).toFixed(1));
    return {
      status: "quantified",
      residueFate: fate,
      exportPercentage: 10,
      estimatedNextCropAvailableN: {
        minKgHa: minN,
        maxKgHa: maxN,
        note: `Estimated ${minN}–${maxN} kg N/ha released to the following crop from retained legume stover (first-season mineralization fraction 25–40%). Remainder builds organic soil pools.`,
      },
      scope: "analyst-assumption",
      caveat: "Residue N is organic and releases gradually through microbial decomposition; actual release depends on soil moisture and temperature.",
    };
  }

  return {
    status: "quantified",
    residueFate: fate,
    exportPercentage: 10,
    estimatedNextCropAvailableN: {
      minKgHa: 0,
      maxKgHa: 5,
      note: "Non-legume residue provides organic matter and slow-release nutrients with minimal first-season mineral N.",
    },
    scope: "analyst-assumption",
    caveat: "Residue provides organic matter and soil surface protection rather than immediate mineral N.",
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
