import { Redis } from "@upstash/redis";

/**
 * Small server-side cache. Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * are set (so results survive restarts and are shared between instances), otherwise an in-memory LRU.
 * Keys must include the processing version, source version and period (see `cacheKey`).
 */

export interface ServerCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}

export function cacheKey(...parts: Array<string | number>): string {
  return parts.map((p) => String(p).replace(/\s+/g, "_")).join("|");
}

export function memoryCache(maxEntries = 500, now: () => number = Date.now): ServerCache {
  const map = new Map<string, { value: unknown; expires: number | null }>();
  return {
    async get<T>(key: string) {
      const hit = map.get(key);
      if (!hit) return null;
      if (hit.expires !== null && hit.expires < now()) {
        map.delete(key);
        return null;
      }
      // refresh recency
      map.delete(key);
      map.set(key, hit);
      return hit.value as T;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      map.delete(key);
      map.set(key, { value, expires: ttlSeconds ? now() + ttlSeconds * 1000 : null });
      while (map.size > maxEntries) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
  };
}

function upstashCache(redis: Redis): ServerCache {
  return {
    async get<T>(key: string) {
      try {
        return (await redis.get<T>(key)) ?? null;
      } catch {
        return null; // a cache outage is a miss, never an error
      }
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      try {
        await (ttlSeconds ? redis.set(key, value, { ex: ttlSeconds }) : redis.set(key, value));
      } catch {
        // ignore
      }
    },
  };
}

let shared: ServerCache | undefined;
export function serverCache(env: NodeJS.ProcessEnv = process.env): ServerCache {
  if (shared) return shared;
  shared =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? upstashCache(new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }))
      : memoryCache();
  return shared;
}
