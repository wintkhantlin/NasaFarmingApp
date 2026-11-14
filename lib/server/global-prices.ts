import { fetchWithRetry } from "../network/fetch-with-retry";
import { GLOBAL_COMMODITIES, toGlobalPrice, type GlobalPrice } from "../engine/global-prices";
import { cacheKey, serverCache, type ServerCache } from "./cache";

/**
 * Global market prices: CBOT futures from Yahoo Finance's public chart endpoint (unofficial, no key)
 * and the MMK/USD rate from open.er-api.com. Each commodity fails independently; a failure is a
 * missing entry plus an error message, never an invented price.
 */

export interface GlobalPricesResult {
  prices: GlobalPrice[];
  mmkPerUsd: number | null;
  retrievedAt: string | null;
  errors: string[];
  cached: boolean;
}

const TTL_SECONDS = 60 * 60 * 6;
const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/";
const FX = "https://open.er-api.com/v6/latest/USD";

async function json(f: typeof fetch, url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetchWithRetry(url, { headers: { "user-agent": "Mozilla/5.0" }, signal }, { maxRetries: 2, timeoutMs: 10_000 }, f);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function loadGlobalPrices(opts: { cache?: ServerCache; fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<GlobalPricesResult> {
  const cache = opts.cache ?? serverCache();
  const f = opts.fetch ?? fetch;
  const key = cacheKey("global-prices", "v1");
  const hit = await cache.get<Omit<GlobalPricesResult, "cached">>(key);
  if (hit) return { ...hit, cached: true };

  const errors: string[] = [];
  let mmkPerUsd: number | null = null;
  try {
    const fx = (await json(f, FX, opts.signal)) as { rates?: Record<string, number> };
    mmkPerUsd = fx.rates?.MMK ?? null;
    if (!mmkPerUsd) errors.push("MMK exchange rate missing.");
  } catch (e) {
    errors.push(`MMK exchange rate: ${e instanceof Error ? e.message : "failed"}`);
  }

  const settled = await Promise.all(
    GLOBAL_COMMODITIES.map(async (spec) => {
      try {
        const body = (await json(f, `${YAHOO}${encodeURIComponent(spec.symbol)}?range=5d&interval=1d`, opts.signal)) as {
          chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; regularMarketTime?: number } }> };
        };
        const meta = body.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice;
        if (typeof price !== "number") throw new Error("no price");
        const asOf = meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null;
        const gp = toGlobalPrice(spec, price, asOf, mmkPerUsd);
        if (!gp) throw new Error("bad quote");
        return gp;
      } catch (e) {
        errors.push(`${spec.label}: ${e instanceof Error ? e.message : "failed"}`);
        return null;
      }
    }),
  );
  const prices = settled.filter((p): p is GlobalPrice => p !== null);
  const result = { prices, mmkPerUsd, retrievedAt: prices.length ? new Date().toISOString() : null, errors };
  if (prices.length) await cache.set(key, result, TTL_SECONDS);
  return { ...result, cached: false };
}
