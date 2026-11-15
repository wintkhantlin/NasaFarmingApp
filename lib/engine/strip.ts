import { getCropById } from "../data/crops";
import type { EvaluatedOption } from "./compare";

export interface StripYear {
  year: number;
  /** true: short of rain or heat at a sensitive stage; false: not; null: not known for this year. */
  stressed: boolean | null;
}

/** One cell per past season for an option, same rule as the dry-year check but over every year. */
export function seasonStrip(option: Pick<EvaluatedOption, "slots">, years: number[]): StripYear[] {
  return years.map((year) => {
    let stressed = false;
    let unknown = false;
    for (const e of option.slots) {
      const crop = e.cropId ? getCropById(e.cropId) : undefined;
      const sw = e.water?.seasons.find((s) => s.year === year);
      if (!crop?.profile || !sw || !sw.evaluable || sw.rainMm === null) {
        if (e.slot.kind === "crop") unknown = true;
        continue;
      }
      if (!e.irrigated && sw.rainMm < crop.water.seasonMm.min) stressed = true;
      const ex = e.exposure?.seasons.find((s) => s.year === year);
      if (ex?.stages.some((st) => (st.heatDays ?? 0) > 0)) stressed = true;
    }
    return { year, stressed: stressed ? true : unknown ? null : false };
  });
}

export const stressedCount = (s: StripYear[]) => s.filter((x) => x.stressed === true).length;
export const knownCount = (s: StripYear[]) => s.filter((x) => x.stressed !== null).length;
