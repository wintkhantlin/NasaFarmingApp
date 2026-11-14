import { describe, expect, test, vi } from "vitest";
import { fetchWithRetry } from "../../lib/network/fetch-with-retry";

describe("fetchWithRetry", () => {
  test("returns successful response on first attempt without retrying", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await fetchWithRetry("https://example.com/api", {}, {}, mockFetch as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("retries on 502 Bad Gateway and succeeds", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const onRetry = vi.fn();
    const res = await fetchWithRetry(
      "https://example.com/api",
      {},
      { initialDelayMs: 10, maxDelayMs: 50, onRetry },
      mockFetch as unknown as typeof fetch,
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("stops retrying after maxRetries and returns the error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("Service Unavailable", { status: 503 }));

    const res = await fetchWithRetry(
      "https://example.com/api",
      {},
      { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 30 },
      mockFetch as unknown as typeof fetch,
    );
    expect(res.status).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  test("retries on network TypeError and succeeds", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed: connection reset"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const res = await fetchWithRetry(
      "https://example.com/api",
      {},
      { initialDelayMs: 10, maxDelayMs: 50 },
      mockFetch as unknown as typeof fetch,
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("respects Retry-After header", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429, headers: { "retry-after": "0.02" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const res = await fetchWithRetry(
      "https://example.com/api",
      {},
      { maxRetries: 2, initialDelayMs: 100 },
      mockFetch as unknown as typeof fetch,
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("aborts immediately when signal is cancelled", async () => {
    const controller = new AbortController();
    const mockFetch = vi.fn().mockImplementation(() => {
      controller.abort(new Error("User cancelled"));
      return Promise.reject(new Error("Aborted"));
    });

    await expect(
      fetchWithRetry("https://example.com/api", {}, { signal: controller.signal }, mockFetch as unknown as typeof fetch),
    ).rejects.toThrow("User cancelled");
  });
});
