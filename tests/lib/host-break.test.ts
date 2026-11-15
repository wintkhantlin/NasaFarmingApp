import { describe, expect, test } from "vitest";
import { getCropById } from "../../lib/data/crops";
import { HOST_ORGANISMS, sharedOrganisms } from "../../lib/data/crops/host-organisms";
import { hostReturnIntervals, pestSequence, sharedHostsForPair } from "../../lib/engine/pest";
import { rotation, slot } from "../helpers/synthetic";

describe("host organism table", () => {
  test("every host is a crop in the library and every entry is sourced", () => {
    for (const o of HOST_ORGANISMS) {
      expect(o.ref.length).toBeGreaterThan(10);
      expect(o.scope).toBe("analyst-assumption");
      for (const h of [...o.hosts, ...(o.suppressedBy ?? [])]) expect(getCropById(h), `${o.id} -> ${h}`).toBeDefined();
    }
  });

  test("host-specific wilts name one crop and a return interval", () => {
    for (const o of HOST_ORGANISMS.filter((x) => x.carryover === "host-specific-soil")) {
      expect(o.hosts).toHaveLength(1);
      expect(o.minReturnYears).toBeGreaterThan(1);
    }
  });

  test("shared pathogens do not follow botanical family", () => {
    // Different families, shared soil fungus.
    expect(sharedOrganisms("rice", "green-gram").map((o) => o.id)).toContain("rhizoctonia");
    expect(sharedOrganisms("sesame", "green-gram").map((o) => o.id)).toContain("macrophomina");
    // Chickpea wilt is not a green gram disease, although both are legumes.
    expect(sharedOrganisms("chickpea", "green-gram").map((o) => o.id)).not.toContain("fusarium-chickpea");
  });
});

describe("crop-after-crop check", () => {
  test("a different-family pair that shares a soil fungus is a caution, not a clean break", () => {
    const r = rotation("f", [slot("a", "sesame", "2026-05-15", "2026-08-23"), slot("b", "green-gram", "2026-08-30", "2026-11-13")]);
    const pair = pestSequence(r)[0];
    expect(pair.result).toBe("different-family");
    expect(pair.gapDays).toBe(7);
    expect(pair.shared.some((h) => h.organismId === "macrophomina" && h.severity === "caution")).toBe(true);
    expect(pair.text).toContain("charcoal rot");
  });

  test("mobile insects only count when the next host follows within the bridge window", () => {
    expect(sharedHostsForPair("chickpea", "maize", 10).map((h) => h.organismId)).toContain("helicoverpa");
    expect(sharedHostsForPair("chickpea", "maize", 120).map((h) => h.organismId)).not.toContain("helicoverpa");
    // Soil-borne carry-over does not depend on the gap.
    expect(sharedHostsForPair("sesame", "maize", 120).map((h) => h.organismId)).toContain("macrophomina");
  });

  test("the wrap-around gap uses the cycle length", () => {
    const r = rotation("f", [slot("a", "rice", "2026-06-01", "2026-10-13"), slot("b", "black-gram", "2026-10-20", "2027-01-18")], 1);
    const wrap = pestSequence(r)[1];
    expect(wrap.fromCropId).toBe("black-gram");
    // 18 Jan 2027 harvest to 1 Jun 2027 planting.
    expect(wrap.gapDays).toBeGreaterThan(130);
    expect(wrap.gapDays).toBeLessThan(140);
  });
});

describe("return interval for host-specific wilts", () => {
  test("chickpea every year is flagged; once in a three-year cycle is not", () => {
    const yearly = rotation("f", [slot("a", "rice", "2026-06-01", "2026-10-13"), slot("b", "chickpea", "2026-11-01", "2027-02-20")], 1);
    const w = hostReturnIntervals(yearly);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ organismId: "fusarium-chickpea", returnYears: 1, minReturnYears: 3 });

    const three = rotation(
      "f",
      [
        slot("a", "rice", "2026-06-01", "2026-10-13"),
        slot("b", "chickpea", "2026-11-01", "2027-02-20"),
        slot("c", "rice", "2027-06-01", "2027-10-13"),
        slot("d", "sesame", "2027-11-01", "2028-02-01"),
        slot("e", "rice", "2028-06-01", "2028-10-13"),
      ],
      3,
    );
    expect(hostReturnIntervals(three)).toHaveLength(0);
  });
});
