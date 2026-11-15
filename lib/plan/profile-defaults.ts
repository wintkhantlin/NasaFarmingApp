import type { FarmConstraints, PriorityId, RegionId } from "@/lib/types";

/** The region a field resolved to. `unsupported` and unset behave like "elsewhere in Myanmar". */
export type ProfileRegion = RegionId | "unsupported" | undefined | null;

export type LabourLevel = NonNullable<FarmConstraints["labour"]>;
export type MarketLevel = NonNullable<FarmConstraints["marketAccess"]>;

/** Short place names for the "Suggested for ..." label, in both languages. */
export const REGION_SHORT: Record<RegionId, { en: string; my: string }> = {
  ayeyarwady: { en: "Ayeyarwady", my: "ဧရာဝတီ" },
  magway: { en: "Magway", my: "မကွေး" },
  shan: { en: "Shan", my: "ရှမ်း" },
  yangon: { en: "Yangon", my: "ရန်ကုန်" },
  myanmar: { en: "Myanmar", my: "မြန်မာ" },
};

/** The place name used in labels. Anything that is not a supported region reads as "Myanmar". */
export function regionShort(region: ProfileRegion): { en: string; my: string } {
  return region && region !== "unsupported" ? REGION_SHORT[region] : REGION_SHORT.myanmar;
}

/**
 * Two priorities a typical farmer in the region would pick, most important first.
 * The dry zone (Magway) is limited by water, so it starts with saving water.
 * The delta (Ayeyarwady) and Yangon farm rice-based, market-near systems, so they start with income then soil.
 * Shan and anywhere else start with income then water.
 */
export function suggestedPriorities(region: ProfileRegion): PriorityId[] {
  switch (region) {
    case "magway":
      return ["water", "income"];
    case "ayeyarwady":
    case "yangon":
      return ["income", "soil"];
    default:
      return ["income", "water"];
  }
}

/** Middle answers: the least surprising value when the farmer has not said. */
export const SUGGESTED_LABOUR: LabourLevel = "medium";
export const SUGGESTED_MARKET: MarketLevel = "fair";

export interface SuggestedProfile {
  priorities: PriorityId[];
  labour: LabourLevel;
  market: MarketLevel;
}

export function suggestedProfile(region: ProfileRegion): SuggestedProfile {
  return { priorities: suggestedPriorities(region), labour: SUGGESTED_LABOUR, market: SUGGESTED_MARKET };
}
