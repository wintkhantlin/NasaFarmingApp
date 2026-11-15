import { describe, expect, test } from "vitest";
import { compareRotations } from "../../lib/engine/compare";
import { classifyRotationFeasibility, type FarmerDecisionInput } from "../../lib/engine/farmer-decision";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const base: FarmerDecisionInput = { topPriorities: ["profit"], availableWater: "reliable_irrigation", equipment: "tractor_tiller" };

describe("water gate covers every irrigated crop", () => {
  const irrigatedSesame = rotation("f", [
    slot("a", "rice", "2026-06-01", "2026-10-13"),
    slot("b", "sesame", "2027-01-10", "2027-04-20", { irrigated: true }),
  ]);

  test("an irrigated non-rice crop on a rainfed field is vetoed", () => {
    const f = classifyRotationFeasibility(irrigatedSesame, { ...base, availableWater: "rainfed" });
    expect(f.status).toBe("infeasible");
    expect(f.hardConstraintVetoes).toContain("WATER_UNAVAILABLE:sesame");
  });

  test("occasional irrigation is enough for an irrigated upland crop", () => {
    expect(classifyRotationFeasibility(irrigatedSesame, { ...base, availableWater: "occasional_irrigation" }).status).toBe("feasible");
  });

  test("irrigated paddy on occasional irrigation needs review, not a pass", () => {
    const doubleRice = rotation("f", [slot("a", "rice", "2026-06-15", "2026-10-25"), slot("b", "rice", "2027-01-15", "2027-05-15", { irrigated: true })]);
    const f = classifyRotationFeasibility(doubleRice, { ...base, availableWater: "occasional_irrigation" });
    expect(f.status).toBe("needs_review");
    expect(f.unconfirmedFactors).toContain("WATER_RELIABILITY_UNCONFIRMED:rice");
  });
});

describe("disease-break gate", () => {
  const yearlyChickpea = rotation("f", [slot("a", "rice", "2026-06-01", "2026-10-13"), slot("b", "chickpea", "2026-11-01", "2027-02-20")], 1);

  test("chickpea every year needs review when wilt status is unknown", () => {
    const f = classifyRotationFeasibility(yearlyChickpea, base);
    expect(f.status).toBe("needs_review");
    expect(f.unconfirmedFactors).toContain("DISEASE_BREAK_REVIEW:chickpea");
  });

  test("it becomes a veto where the farmer confirms wilt in the field", () => {
    const f = classifyRotationFeasibility(yearlyChickpea, { ...base, knownWiltInField: true });
    expect(f.status).toBe("infeasible");
    expect(f.hardConstraintVetoes).toContain("DISEASE_BREAK:chickpea");
  });
});

describe("compare pipeline", () => {
  test("an irrigated crop on a field with no irrigation is not confirmed and says why", () => {
    const field = syntheticField({ irrigation: "none" });
    const mine = rotation(field.id, [
      slot("rice", "rice", "2026-06-01", "2026-10-13"),
      slot("gram", "black-gram", "2026-10-20", "2027-01-18", { irrigated: true }),
    ]);
    const res = compareRotations(engineData(field, syntheticWeather()), mine, { baseYear: 2026, now: new Date("2026-11-14T00:00:00Z") });
    expect(res.current.fit).not.toBe("fits");
    expect(res.current.risks.some((r) => r.id === "gram:water-access")).toBe(true);
  });
});
