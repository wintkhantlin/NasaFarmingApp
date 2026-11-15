import { describe, expect, it } from "vitest";
import { prioritiesSchema } from "@/lib/schemas/field";
import { regionShort, suggestedPriorities, suggestedProfile } from "@/lib/plan/profile-defaults";

describe("profile defaults", () => {
  it("suggests saving water first in the dry zone", () => {
    expect(suggestedPriorities("magway")).toEqual(["water", "income"]);
  });

  it("suggests earning more then soil in the delta and Yangon", () => {
    expect(suggestedPriorities("ayeyarwady")).toEqual(["income", "soil"]);
    expect(suggestedPriorities("yangon")).toEqual(["income", "soil"]);
  });

  it("suggests earning more then saving water for Shan and anywhere else", () => {
    for (const r of ["shan", "myanmar", "unsupported", undefined, null] as const) {
      expect(suggestedPriorities(r)).toEqual(["income", "water"]);
    }
  });

  it("always gives two distinct priorities the schema accepts", () => {
    for (const r of ["ayeyarwady", "magway", "shan", "yangon", "myanmar", "unsupported", undefined] as const) {
      const order = suggestedPriorities(r);
      expect(new Set(order).size).toBe(2);
      expect(prioritiesSchema.safeParse({ order, weights: {} }).success).toBe(true);
    }
  });

  it("starts labour at Medium and market access at Fair", () => {
    expect(suggestedProfile("magway")).toMatchObject({ labour: "medium", market: "fair" });
  });

  it("names unsupported places as Myanmar", () => {
    expect(regionShort("unsupported").en).toBe("Myanmar");
    expect(regionShort(undefined).en).toBe("Myanmar");
    expect(regionShort("magway").en).toBe("Magway");
  });
});
