import { describe, expect, it } from "vitest";
import { checkLimits, unansweredLimits } from "@/lib/engine/limits";
import type { Rotation } from "@/lib/types";

const slot = (cropId: string, plant: string, harvest: string, irrigated = false) =>
  ({ id: cropId, kind: "crop", cropId, plantDate: plant, harvestDate: harvest, dateConfidence: "exact", irrigated }) as Rotation["slots"][number];
const rot = { cycleYears: 1 as const, slots: [slot("rice", "2025-06-15", "2025-10-20"), slot("black-gram", "2025-11-05", "2026-02-10", true)] };
const by = (c: ReturnType<typeof checkLimits>, k: string) => c.find((x) => x.limit === k)!;

describe("checkLimits", () => {
  it("returns not-asked for everything when nothing was answered", () => {
    const c = checkLimits(rot, undefined, "none");
    expect(c.every((x) => x.result === "not-asked")).toBe(true);
    expect(unansweredLimits(undefined)).toHaveLength(5);
  });
  it("fails water when irrigated slots meet no water access", () => {
    expect(by(checkLimits(rot, { irrigation: { access: "none" } }, "none"), "water").result).toBe("fail");
    expect(by(checkLimits(rot, { irrigation: { access: "full" } }, "full"), "water").result).toBe("pass");
  });
  it("fails market for crops the farmer cannot sell, with a reason", () => {
    const m = by(checkLimits(rot, { canSell: ["rice"] }, "full", (id) => id), "market");
    expect(m).toMatchObject({ result: "fail" });
    expect(m.reason).toContain("black-gram");
  });
  it("checks household, labour and land", () => {
    expect(by(checkLimits(rot, { mustGrow: ["rice"] }, "full"), "household").result).toBe("pass");
    expect(by(checkLimits(rot, { mustGrow: ["maize"] }, "full"), "household").result).toBe("fail");
    expect(by(checkLimits(rot, { peakMonths: [6, 10] }, "full"), "labour").result).toBe("fail");
    expect(by(checkLimits(rot, { peakMonths: [3] }, "full"), "labour").result).toBe("pass");
    expect(by(checkLimits({ ...rot, cycleYears: 3 }, { land: { tenure: "leased", leaseYears: 1 } }, "full"), "land").result).toBe("fail");
  });
  it("an empty answer is an answer: no crops to sell fails every crop", () => {
    expect(by(checkLimits(rot, { canSell: [] }, "full"), "market").result).toBe("fail");
  });
});

import { rankRotations, unmeasuredSubs } from "@/lib/engine/mcda";

describe("finer priorities", () => {
  const vals = [
    { "water-shortfall": 10, "soil-legume-share": 1, "soil-cover": 0 },
    { "water-shortfall": 10, "soil-legume-share": 0, "soil-cover": 1 },
    { "water-shortfall": 10, "soil-legume-share": 0.5, "soil-cover": 0.5 },
  ].map((v, i) => ({ rotationId: `r${i}`, feasible: true, values: v }));

  it("narrows soil to the chosen measure", () => {
    const n = rankRotations(vals, { order: ["soil"], weights: {}, soil: ["nitrogen"] });
    expect(n.used).toEqual(["soil-legume-share"]);
    expect(n.ranking[0].rotationId).toBe("r0");
    const e = rankRotations(vals, { order: ["soil"], weights: {}, soil: ["erosion"] });
    expect(e.ranking[0].rotationId).toBe("r1");
  });
  it("counts every soil measure when no finer choice is made, or only unmeasured ones", () => {
    expect(rankRotations(vals, { order: ["soil"], weights: {} }).used).toHaveLength(2);
    expect(rankRotations(vals, { order: ["soil"], weights: {}, soil: ["infiltration"] }).used).toHaveLength(2);
  });
  it("reports choices with no measure", () => {
    expect(unmeasuredSubs({ order: ["soil", "income"], weights: {}, soil: ["nitrogen", "infiltration"], income: ["market-fit"] })).toEqual(["infiltration", "market-fit"]);
  });
});
