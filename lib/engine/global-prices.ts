/**
 * Global commodity reference prices (exchange futures) converted to kg-based units, so they can sit
 * next to the local Myanmar benchmarks. Pure functions only; fetching lives in lib/server/global-prices.ts.
 */

export type GlobalQuoteUnit = "usd-per-cwt" | "usc-per-bushel";

export interface GlobalCommoditySpec {
  /** Crop id in the crop catalog. */
  cropId: string;
  /** Yahoo Finance futures symbol. */
  symbol: string;
  label: string;
  unit: GlobalQuoteUnit;
  /** kg in one bushel (or 0 for cwt). */
  kgPerBushel?: number;
}

const LB = 0.45359237;

export const GLOBAL_COMMODITIES: GlobalCommoditySpec[] = [
  { cropId: "rice", symbol: "ZR=F", label: "CBOT rough rice", unit: "usd-per-cwt" },
  { cropId: "maize", symbol: "ZC=F", label: "CBOT corn", unit: "usc-per-bushel", kgPerBushel: 56 * LB },
  { cropId: "wheat", symbol: "ZW=F", label: "CBOT wheat", unit: "usc-per-bushel", kgPerBushel: 60 * LB },
  { cropId: "soybean", symbol: "ZS=F", label: "CBOT soybeans", unit: "usc-per-bushel", kgPerBushel: 60 * LB },
];

export function quoteToUsdPerKg(spec: GlobalCommoditySpec, quote: number): number | null {
  if (!Number.isFinite(quote) || quote <= 0) return null;
  if (spec.unit === "usd-per-cwt") return quote / (100 * LB);
  if (!spec.kgPerBushel) return null;
  return quote / 100 / spec.kgPerBushel;
}

export interface GlobalPrice {
  cropId: string;
  label: string;
  symbol: string;
  usdPerKg: number;
  /** At the official MMK/USD rate. Local market kyat usually trade far weaker, so treat as a floor. */
  mmkPerKgOfficial: number | null;
  asOf: string | null;
}

export function toGlobalPrice(spec: GlobalCommoditySpec, quote: number, asOf: string | null, mmkPerUsd: number | null): GlobalPrice | null {
  const usdPerKg = quoteToUsdPerKg(spec, quote);
  if (usdPerKg === null) return null;
  return {
    cropId: spec.cropId,
    label: spec.label,
    symbol: spec.symbol,
    usdPerKg: Math.round(usdPerKg * 1000) / 1000,
    mmkPerKgOfficial: mmkPerUsd && mmkPerUsd > 0 ? Math.round(usdPerKg * mmkPerUsd) : null,
    asOf,
  };
}
