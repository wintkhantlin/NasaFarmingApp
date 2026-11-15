/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Field } from "@/lib/types";

vi.mock("@/lib/store/data-cache", () => ({
  getCachedConditions: () => new Promise(() => undefined),
  getCachedRemote: () => new Promise(() => undefined),
  setCachedConditions: vi.fn(),
  setCachedRemote: vi.fn(),
  isStale: () => true,
}));

import { SLOW_AFTER_MS, useFieldAnalysis } from "@/lib/analysis/use-analysis";

const field: Field = {
  id: "f1",
  name: "Test",
  areaHa: 1,
  centroid: [96.2, 16.8],
  geometry: { type: "Point", coordinates: [96.2, 16.8] },
  samplePoints: [[96.2, 16.8]],
  irrigation: "none",
  locationConfirmed: true,
  region: "yangon",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
} as Field;

describe("useFieldAnalysis slow flag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => new Promise(() => undefined));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("turns on after the first check has run for a while, and not before", () => {
    const { result } = renderHook(() => useFieldAnalysis(field));
    expect(result.current.phase).toBe("loading");
    expect(result.current.slow).toBe(false);
    act(() => {
      vi.advanceTimersByTime(SLOW_AFTER_MS - 100);
    });
    expect(result.current.slow).toBe(false);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.slow).toBe(true);
  });
});
