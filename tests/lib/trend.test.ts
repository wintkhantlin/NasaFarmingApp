import { describe, expect, it } from "vitest";
import { mannKendall, trendSentence } from "@/lib/engine/trend";

describe("mannKendall", () => {
  it("needs at least ten years", () => {
    expect(mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBeNull();
    expect(trendSentence(null, 1981, "rain", "mm")).toBe("Too few years to judge a trend.");
  });
  it("finds a clear rising series and its Sen slope", () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + 2 * i + (i % 3));
    const t = mannKendall(up)!;
    expect(t.significant).toBe(true);
    expect(t.slope).toBeCloseTo(2, 0);
    expect(trendSentence(t, 2000, "monsoon rain", "mm")).toContain("rose about");
  });
  it("reports no clear change for noise and never invents a direction", () => {
    const flat = [5, 9, 4, 8, 5, 9, 4, 8, 5, 9, 4, 8, 5, 9];
    const t = mannKendall(flat)!;
    expect(t.significant).toBe(false);
    expect(trendSentence(t, 1981, "rain", "mm")).toBe("No clear change in rain since 1981.");
  });
  it("skips missing years instead of treating them as zero", () => {
    const v: Array<number | null> = Array.from({ length: 14 }, (_, i) => (i === 5 ? null : i));
    expect(mannKendall(v)!.n).toBe(13);
  });
});
