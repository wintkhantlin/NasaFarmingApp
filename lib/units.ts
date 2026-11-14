/**
 * Unit conversions and formatting helpers for Myanmar and international agricultural contexts.
 *
 * In Myanmar:
 * - Land is commonly measured in acres: 1 hectare = 2.47105 acres.
 * - Paddy (unhusked rice) is measured in baskets: 1 basket ≈ 20.865 kg (46 lbs).
 * - Pulses/beans are often measured in baskets (approx 31.8 kg / 70 lbs for black gram/chickpea).
 */

export type AreaUnit = "ha" | "acre";
export type YieldUnit = "kg" | "basket";

export const HA_TO_ACRES = 2.47105;
export const PADDY_BASKET_KG = 20.865;
export const PULSE_BASKET_KG = 31.75;

export function formatArea(ha: number | null | undefined, unit: AreaUnit = "ha"): string {
  if (ha === null || ha === undefined || !Number.isFinite(ha)) return "Area not set";
  if (unit === "acre") {
    const acres = ha * HA_TO_ACRES;
    return `${acres < 10 ? acres.toFixed(1) : Math.round(acres)} acres`;
  }
  return `${ha < 10 ? ha.toFixed(1) : Math.round(ha)} ha`;
}

export function formatYield(kgHa: number | null | undefined, cropId?: string, unit: YieldUnit = "kg"): string {
  if (kgHa === null || kgHa === undefined || !Number.isFinite(kgHa)) return "Unknown yield";
  if (unit === "basket") {
    const isPulse = cropId && ["black-gram", "green-gram", "chickpea", "pigeon-pea", "cowpea", "soybean"].includes(cropId);
    const basketKg = isPulse ? PULSE_BASKET_KG : PADDY_BASKET_KG;
    const basketsPerHa = Math.round(kgHa / basketKg);
    const basketsPerAcre = Math.round((kgHa / HA_TO_ACRES) / basketKg);
    return `${basketsPerAcre} baskets/acre (${basketsPerHa} baskets/ha)`;
  }
  return `${Math.round(kgHa).toLocaleString()} kg/ha`;
}
