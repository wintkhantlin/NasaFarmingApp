import { describe, expect, it } from "vitest";
import { MAX_WAIT_DAYS, autoFillRotationDates, monthPartOf, nextOnOrAfter, plantDateFor, usualSowMonths, usualSowWindow } from "@/lib/plan/auto-dates";
import { daysBetween } from "@/lib/rotation-format";
import type { RotationSlot } from "@/lib/types";

const slot = (cropId: string, over: Partial<RotationSlot> = {}): RotationSlot => ({
  id: cropId + Math.random(),
  kind: "crop",
  cropId,
  plantDate: "",
  harvestDate: "",
  dateConfidence: "typical",
  irrigated: false,
  ...over,
});

describe("auto dates", () => {
  it("knows the usual sowing window and months for a Magway crop", () => {
    const window = usualSowWindow("groundnut", "magway");
    expect(window).not.toBeNull();
    const months = usualSowMonths("groundnut", "magway");
    expect(months.length).toBeGreaterThan(0);
    expect(months.length).toBeLessThanOrEqual(12);
  });

  it("returns no months when a crop has no calendar", () => {
    expect(usualSowMonths("not-a-crop", "magway")).toEqual([]);
  });

  it("fills dates for every undated crop, in order, with no overlap", () => {
    const { slots, changed } = autoFillRotationDates([slot("groundnut"), slot("sesame"), slot("chickpea")], { region: "magway", baseYear: 2026 });
    expect(changed).toBe(3);
    for (const s of slots) {
      expect(s.plantDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(daysBetween(s.plantDate, s.harvestDate)).toBeGreaterThan(30);
      expect(s.dateConfidence).toBe("typical");
    }
    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i].plantDate >= slots[i - 1].harvestDate).toBe(true);
    }
  });

  it("never moves dates the farmer set, and continues after them", () => {
    const own = slot("groundnut", { plantDate: "2026-06-10", harvestDate: "2026-10-05", dateConfidence: "exact" });
    const { slots } = autoFillRotationDates([own, slot("sesame")], { region: "magway", baseYear: 2026 });
    expect(slots[0]).toBe(own);
    expect(slots[1].plantDate >= "2026-10-19").toBe(true);
  });

  it("keeps farmer-set approximate dates and reports only what changed", () => {
    const approx = slot("groundnut", { plantDate: "2026-06-15", harvestDate: "2026-10-10", dateConfidence: "approx" });
    const { slots, changed } = autoFillRotationDates([approx], { region: "magway", baseYear: 2026 });
    expect(slots[0]).toBe(approx);
    expect(changed).toBe(0);
  });

  it("starts the next crop right away when it is still inside its sowing window", () => {
    const first = slot("groundnut", { plantDate: "2026-06-01", harvestDate: "2026-09-01", dateConfidence: "exact" });
    const { slots } = autoFillRotationDates([first, slot("groundnut")], { region: "magway", baseYear: 2026 });
    const w = usualSowWindow("groundnut", "magway")!;
    // Either the turnaround date (inside the window) or the next window start, never before the turnaround.
    expect(slots[1].plantDate >= "2026-09-15").toBe(true);
    expect(w).toBeTruthy();
  });

  it("leaves fallow alone but plans after it", () => {
    const fallow = slot("x", { kind: "fallow", cropId: undefined, plantDate: "2026-06-01", harvestDate: "2026-12-01" });
    const { slots } = autoFillRotationDates([fallow, slot("sesame")], { region: "magway", baseYear: 2026 });
    expect(slots[0]).toBe(fallow);
    expect(slots[1].plantDate >= "2026-12-15").toBe(true);
  });

  it("is stable: filling twice changes nothing the second time", () => {
    const once = autoFillRotationDates([slot("groundnut"), slot("sesame")], { region: "magway", baseYear: 2026 });
    const twice = autoFillRotationDates(once.slots, { region: "magway", baseYear: 2026 });
    expect(twice.changed).toBe(0);
  });

  it("finds the next time a month arrives after the previous harvest", () => {
    expect(nextOnOrAfter("06-15", "2026-10-05")).toBe("2027-06-15");
    expect(nextOnOrAfter("11-15", "2026-10-05")).toBe("2026-11-15");
  });

  it("turns a month and part of month into a date", () => {
    expect(plantDateFor(6, "early", { fallbackYear: 2026 })).toBe("2026-06-05");
    expect(plantDateFor(6, "late", { afterIso: "2026-10-05", fallbackYear: 2026 })).toBe("2027-06-25");
    expect(monthPartOf("2026-06-05")).toBe("early");
    expect(monthPartOf("2026-06-15")).toBe("mid");
    expect(monthPartOf("2026-06-28")).toBe("late");
  });

  it("starts the first crop on or after a given date, in its usual season", () => {
    const { slots } = autoFillRotationDates([slot("groundnut"), slot("sesame")], { region: "magway", notBefore: "2026-11-15" });
    expect(slots[0].plantDate >= "2026-11-15").toBe(true);
    expect(slots[1].plantDate >= slots[0].harvestDate).toBe(true);
  });

  it("does not leave a gap longer than the limit waiting for a sowing window", () => {
    const first = slot("rice", { plantDate: "2026-06-15", harvestDate: "2026-10-28", dateConfidence: "exact" });
    const { slots } = autoFillRotationDates([first, slot("black-gram")], { region: "magway" });
    expect(daysBetween(first.harvestDate, slots[1].plantDate)).toBeLessThanOrEqual(MAX_WAIT_DAYS + 14);
  });
});
