import { describe, expect, test } from "vitest";
import { incomeAnchorFor, REGIONAL_INCOME_BENCHMARK } from "../../lib/engine/economics";
import { rankRotations, type McdaInput } from "../../lib/engine/mcda";

const income = { order: ["income" as const], weights: { income: 1 } };
const opt = (id: string, margin: number): McdaInput => ({ rotationId: id, feasible: true, values: { "income-margin": margin } });
const part = (res: ReturnType<typeof rankRotations>, id: string) =>
  res.ranking.find((r) => r.rotationId === id)?.parts.find((p) => p.criterion === "income-margin")?.normalised;

describe("regional income anchor", () => {
  test("each supported region has a positive benchmark from the price table", () => {
    for (const region of Object.keys(REGIONAL_INCOME_BENCHMARK)) {
      const a = incomeAnchorFor(region);
      expect(a, region).not.toBeNull();
      expect(a!.target).toBeGreaterThan(0);
      expect(a!.limit).toBe(0);
      expect(a!.ref).toContain("MMK/ha/yr");
    }
    expect(incomeAnchorFor("myanmar")).toBeNull();
  });

  test("adding an option does not change another option's income score", () => {
    const anchor = incomeAnchorFor("ayeyarwady")!;
    const opts = { anchors: { "income-margin": anchor } };
    const two = rankRotations([opt("a", anchor.target * 0.4), opt("b", anchor.target * 0.8)], income, opts);
    const three = rankRotations([opt("a", anchor.target * 0.4), opt("b", anchor.target * 0.8), opt("c", anchor.target * 3)], income, opts);
    expect(part(two, "a")).toBeCloseTo(0.4);
    expect(part(three, "a")).toBeCloseTo(0.4);
    expect(part(three, "b")).toBeCloseTo(0.8);
  });

  test("without an anchor the score is relative and moves when an option is added", () => {
    const two = rankRotations([opt("a", 1_000_000), opt("b", 2_000_000)], income);
    const three = rankRotations([opt("a", 1_000_000), opt("b", 2_000_000), opt("c", 5_000_000)], income);
    expect(part(two, "b")).toBeCloseTo(1);
    expect(part(three, "b")).toBeCloseTo(0.25);
  });

  test("a loss scores zero against the anchor", () => {
    const anchor = incomeAnchorFor("magway")!;
    const res = rankRotations([opt("a", -500_000), opt("b", anchor.target)], income, { anchors: { "income-margin": anchor } });
    expect(part(res, "a")).toBe(0);
    expect(part(res, "b")).toBeCloseTo(1);
  });
});
