import type { ObservationSummary } from "../nasa/derive/ndvi";
import type { RotationGap } from "./structure";
import { LOW_NDVI } from "./soil-health";

/**
 * Bare-field opportunity detection. A planned interval with no crop is a candidate. Past clear
 * satellite observations in the same part of the year can support "possible low cover", but low
 * greenness alone does not prove bare soil: flooded fields, residue and young crops all look low.
 * Missing imagery is not bare soil.
 */

export interface FieldSceneMetrics {
  totalPixels: number;
  clearPixels: number;
  cloudPixels: number;
  waterPixels: number;
  validLandPixels: number;
  waterFractionAmongClear: number;
  validLandFractionTotal: number;
}

/**
 * Computes clear observed area, water fraction among clear observations, and valid vegetated-land area (Section E).
 * Water fraction is calculated among clear pixels before excluding water pixels.
 * (e.g. 10 clear pixels: 6 water, 4 land => 60% water fraction).
 */
export function computeFieldSceneMetrics(
  totalPixels: number,
  cloudPixels: number,
  waterPixels: number,
  validLandPixels: number,
): FieldSceneMetrics {
  const clearPixels = Math.max(0, totalPixels - cloudPixels);
  const waterFraction = clearPixels > 0 ? waterPixels / clearPixels : 0;
  const landFraction = totalPixels > 0 ? validLandPixels / totalPixels : 0;
  return {
    totalPixels,
    clearPixels,
    cloudPixels,
    waterPixels,
    validLandPixels,
    waterFractionAmongClear: waterFraction,
    validLandFractionTotal: landFraction,
  };
}

export type GapLabel = "possible-low-cover" | "planned-gap-no-clear-imagery" | "mostly-water" | "green-in-past-years";

export interface GapAssessment {
  gap: RotationGap;
  label: GapLabel;
  lowObservations: number;
  clearObservations: number;
  waterObservations: number;
  text: string;
}

const MIN_CLEAR_COVERAGE = 0.5;
const MIN_LOW_OBSERVATIONS = 2;

const mmdd = (iso: string) => iso.slice(5);
const inside = (d: string, from: string, to: string) => (from <= to ? d >= from && d <= to : d >= from || d <= to);

export function assessGaps(gaps: RotationGap[], observations: ObservationSummary[]): GapAssessment[] {
  return gaps.map((gap) => {
    const obs = observations.filter((o) => inside(mmdd(o.date), mmdd(gap.from), mmdd(gap.to)));
    const clear = obs.filter((o) => o.ndviMedian !== null && o.coverage >= MIN_CLEAR_COVERAGE);
    const water = obs.filter((o) => o.totalPixels > 0 && o.waterPixels / o.totalPixels > 0.3);
    const low = clear.filter((o) => (o.ndviMedian as number) < LOW_NDVI.value);
    if (water.length > 0 && water.length >= Math.max(clear.length, 1)) {
      return { gap, label: "mostly-water", lowObservations: low.length, clearObservations: clear.length, waterObservations: water.length, text: "Past images show standing water here. Flooded fields are not bare soil." };
    }
    if (clear.length < MIN_LOW_OBSERVATIONS) {
      return { gap, label: "planned-gap-no-clear-imagery", lowObservations: low.length, clearObservations: clear.length, waterObservations: water.length, text: "No crop is planned here. There are too few clear satellite images to say what the field looked like." };
    }
    if (low.length >= MIN_LOW_OBSERVATIONS && low.length / clear.length >= 0.5) {
      return {
        gap,
        label: "possible-low-cover",
        lowObservations: low.length,
        clearObservations: clear.length,
        waterObservations: water.length,
        text: `Possible low cover: ${low.length} of ${clear.length} clear past images were low in greenness. Check the field for residue, water and crop stage.`,
      };
    }
    return { gap, label: "green-in-past-years", lowObservations: low.length, clearObservations: clear.length, waterObservations: water.length, text: "Past images show this period was usually green, so there may be less room for another crop." };
  });
}
