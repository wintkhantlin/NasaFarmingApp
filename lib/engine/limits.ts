import type { FarmConstraints, Irrigation, Rotation } from "../types";

/** pass / fail / not-asked. "not-asked" is never a pass and never dims or ranks an option. */
export type Tri = "pass" | "fail" | "not-asked";
export type LimitKey = "water" | "market" | "household" | "labour" | "land";

export interface LimitCheck {
  limit: LimitKey;
  result: Tri;
  reason?: string;
}

export const LIMIT_KEYS: LimitKey[] = ["water", "market", "household", "labour", "land"];

const monthOf = (iso: string) => Number(iso.slice(5, 7));
const cropsOf = (r: Pick<Rotation, "slots">) =>
  [...new Set(r.slots.filter((s) => s.kind === "crop" && s.cropId).map((s) => s.cropId as string))];

/** Which limits the farmer has answered. Used for the "Not asked" count and the open-question list. */
export function unansweredLimits(c: FarmConstraints | undefined): LimitKey[] {
  return LIMIT_KEYS.filter((k) => !answered(k, c));
}

function answered(k: LimitKey, c: FarmConstraints | undefined): boolean {
  if (!c) return false;
  switch (k) {
    case "water": return c.irrigation !== undefined;
    case "market": return c.canSell !== undefined;
    case "household": return c.mustGrow !== undefined;
    // The quick question stores a level (low, medium, high); the farm form stores busy months. Either is an answer.
    case "labour": return c.peakMonths !== undefined || c.labour !== undefined;
    case "land": return c.land !== undefined;
  }
}

function limitCheck(
  k: LimitKey,
  c: FarmConstraints | undefined,
  r: Pick<Rotation, "slots" | "cycleYears">,
  _fieldIrrigation: Irrigation,
  nameOf: (id: string) => string = (id) => id,
): LimitCheck {
  if (!answered(k, c)) return { limit: k, result: "not-asked" };
  const con = c as FarmConstraints;
  switch (k) {
    case "water": {
      const needs = r.slots.some((s) => s.kind === "crop" && s.irrigated);
      return con.irrigation?.access === "none" && needs
        ? { limit: k, result: "fail", reason: "Needs water you said you don't have." }
        : { limit: k, result: "pass" };
    }
    case "market": {
      const miss = cropsOf(r).filter((id) => !(con.canSell ?? []).includes(id));
      return miss.length
        ? { limit: k, result: "fail", reason: `No market you know of for ${miss.map(nameOf).join(", ")}.` }
        : { limit: k, result: "pass" };
    }
    case "household": {
      const have = new Set(cropsOf(r));
      const miss = (con.mustGrow ?? []).filter((id) => !have.has(id));
      return miss.length
        ? { limit: k, result: "fail", reason: `Does not include ${miss.map(nameOf).join(", ")}, which your household needs.` }
        : { limit: k, result: "pass" };
    }
    case "labour": {
      const crops = r.slots.filter((s) => s.kind === "crop");
      if (con.peakMonths !== undefined) {
        const peak = new Set(con.peakMonths);
        const hits = crops.flatMap((s) => [monthOf(s.plantDate), monthOf(s.harvestDate)]).filter((m) => peak.has(m));
        if (hits.length >= 2) return { limit: k, result: "fail", reason: "Sowing and harvest fall in your busiest months." };
      }
      // Only a level was given. With very little help, two or more sowings a year means two sets of sowing and
      // harvest rushes a year. That is a rule of thumb, stated as one; it is not a measured labour requirement.
      if (con.labour === "low" && con.peakMonths === undefined && crops.length / Math.max(1, r.cycleYears) >= 2) {
        return { limit: k, result: "fail", reason: "Two sowings and harvests a year need more help than you said you have." };
      }
      return { limit: k, result: "pass" };
    }
    case "land": {
      const land = con.land as NonNullable<FarmConstraints["land"]>;
      return land.tenure === "leased" && land.leaseYears !== undefined && land.leaseYears < r.cycleYears
        ? { limit: k, result: "fail", reason: "Your lease ends before this rotation completes, so long-term soil benefits may not reach you." }
        : { limit: k, result: "pass" };
    }
  }
}

/** Every limit gets a result for every option. Limits dim an option; they never remove it. */
export function checkLimits(
  rotation: Pick<Rotation, "slots" | "cycleYears">,
  constraints: FarmConstraints | undefined,
  fieldIrrigation: Irrigation,
  nameOf?: (id: string) => string,
): LimitCheck[] {
  return LIMIT_KEYS.map((k) => limitCheck(k, constraints, rotation, fieldIrrigation, nameOf));
}
