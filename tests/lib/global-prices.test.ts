import { describe, expect, it } from "vitest";
import { GLOBAL_COMMODITIES, quoteToUsdPerKg, toGlobalPrice } from "@/lib/engine/global-prices";
import { loadGlobalPrices } from "@/lib/server/global-prices";
import { memoryCache } from "@/lib/server/cache";

const spec = (id: string) => GLOBAL_COMMODITIES.find((s) => s.cropId === id)!;

describe("global prices", () => {
  it("converts futures quotes to USD per kg", () => {
    expect(quoteToUsdPerKg(spec("rice"), 18.39)).toBeCloseTo(0.4054, 3); // $/cwt
    expect(quoteToUsdPerKg(spec("maize"), 445.5)).toBeCloseTo(0.1754, 3); // cents/bu, 56 lb
    expect(quoteToUsdPerKg(spec("soybean"), 1231.5)).toBeCloseTo(0.4525, 3);
    expect(quoteToUsdPerKg(spec("wheat"), -1)).toBeNull();
  });

  it("applies the MMK rate only when known", () => {
    expect(toGlobalPrice(spec("rice"), 18.39, null, 2100)?.mmkPerKgOfficial).toBe(851);
    expect(toGlobalPrice(spec("rice"), 18.39, null, null)?.mmkPerKgOfficial).toBeNull();
  });

  it("loads, tolerates per-commodity failure, and caches", async () => {
    let calls = 0;
    const fake = (async (url: string) => {
      calls++;
      if (url.includes("open.er-api")) return Response.json({ rates: { MMK: 2100 } });
      if (url.includes("ZW%3DF") || url.includes("ZW=F")) return new Response("nope", { status: 404 });
      return Response.json({ chart: { result: [{ meta: { regularMarketPrice: 500, regularMarketTime: 1794597599 } }] } });
    }) as unknown as typeof fetch;
    const cache = memoryCache();
    const r = await loadGlobalPrices({ cache, fetch: fake });
    expect(r.prices.map((p) => p.cropId).sort()).toEqual(["maize", "rice", "soybean"]);
    expect(r.errors.some((e) => e.includes("wheat"))).toBe(true);
    const before = calls;
    const again = await loadGlobalPrices({ cache, fetch: fake });
    expect(again.cached).toBe(true);
    expect(calls).toBe(before);
  });
});
