import { describe, expect, test, vi } from "vitest";
import { memoryCache } from "../../lib/server/cache";
import { loadSoil } from "../../lib/server/soil";

describe("loadSoil server-side cache and resilience", () => {
  test("caches soil profile and returns cached data on second call", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          properties: {
            layers: [
              { name: "clay", unit_measure: { d_factor: 10 }, depths: [{ label: "0-5cm", values: { mean: 250 } }] },
              { name: "sand", unit_measure: { d_factor: 10 }, depths: [{ label: "0-5cm", values: { mean: 400 } }] },
              { name: "silt", unit_measure: { d_factor: 10 }, depths: [{ label: "0-5cm", values: { mean: 350 } }] },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const cache = memoryCache();
    const first = await loadSoil(20.15, 94.95, { cache, fetch: mockFetch as unknown as typeof fetch });
    expect(first.cached).toBe(false);
    expect(first.soil).not.toBeNull();
    expect(first.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call with same coordinates hits the cache without re-fetching
    const second = await loadSoil(20.15, 94.95, { cache, fetch: mockFetch as unknown as typeof fetch });
    expect(second.cached).toBe(true);
    expect(second.soil).toEqual(first.soil);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("handles network failure gracefully without throwing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection reset by peer"));
    const cache = memoryCache();

    const res = await loadSoil(20.15, 94.95, { cache, fetch: mockFetch as unknown as typeof fetch });
    expect(res.soil).toBeNull();
    expect(res.error).toContain("Connection reset by peer");
    expect(res.cached).toBe(false);
  });
});
