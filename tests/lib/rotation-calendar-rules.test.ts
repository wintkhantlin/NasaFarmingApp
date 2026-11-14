import { describe, expect, it } from "vitest";
import {
  daysInCalendarYear,
  dayOfYear,
  daysBetween,
  addDaysToIso,
  segmentYear,
  calculateGroundCoverPercent,
} from "../../lib/rotation-format";
import { evaluateTransition, isRelayPairEligible } from "../../lib/engine/transition";
import { rotationSchema, rotationSlotSchema } from "../../lib/schemas/rotation";
import type { Rotation, RotationSlot } from "../../lib/types";

describe("PROMPT 1: Safe Calendar & Leap-Year Correctness (U-01)", () => {
  it("determines correct days in calendar year, including leap years and century rules", () => {
    expect(daysInCalendarYear(2026)).toBe(365);
    expect(daysInCalendarYear(2027)).toBe(365);
    expect(daysInCalendarYear(2028)).toBe(366); // 2028 is a leap year
    expect(daysInCalendarYear(2029)).toBe(365);
    expect(daysInCalendarYear(2000)).toBe(366); // century leap year
    expect(daysInCalendarYear(1900)).toBe(365); // century non-leap year
  });

  it("calculates dayOfYear in UTC preventing DST/timezone drift", () => {
    expect(dayOfYear("2028-01-01")).toBe(1);
    expect(dayOfYear("2028-02-28")).toBe(59);
    expect(dayOfYear("2028-02-29")).toBe(60); // Leap Day
    expect(dayOfYear("2028-03-01")).toBe(61);
    expect(dayOfYear("2028-12-31")).toBe(366);

    expect(dayOfYear("2026-12-31")).toBe(365);
  });

  it("ensures Dec 31 2028 never overflows > 100% in segmentYear", () => {
    const seg = segmentYear(2028, "2028-12-31", "2028-12-31");
    expect(seg).not.toBeNull();
    expect(seg!.left + seg!.width).toBeLessThanOrEqual(1.0);
    expect(seg!.left + seg!.width).toBeCloseTo(1.0, 5);

    // Full leap year crop
    const fullYear = segmentYear(2028, "2028-01-01", "2028-12-31");
    expect(fullYear).not.toBeNull();
    expect(fullYear!.left).toBe(0);
    expect(fullYear!.width).toBe(1.0);
    expect(fullYear!.left + fullYear!.width).toBe(1.0);
  });

  it("clips cross-year crop segments correctly across calendar boundaries", () => {
    // Sown in Nov 2026, harvested in Feb 2027
    const seg2026 = segmentYear(2026, "2026-11-01", "2027-02-28");
    const seg2027 = segmentYear(2027, "2026-11-01", "2027-02-28");
    const seg2028 = segmentYear(2028, "2026-11-01", "2027-02-28");

    expect(seg2026).not.toBeNull();
    // In 2026: starts at day 305 (Nov 1), goes to end of year (Dec 31, day 365)
    expect(seg2026!.left).toBeCloseTo((305 - 1) / 365, 4);
    expect(seg2026!.left + seg2026!.width).toBeCloseTo(1.0, 5);

    expect(seg2027).not.toBeNull();
    // In 2027: starts at day 1 (Jan 1), goes to Feb 28 (day 59)
    expect(seg2027!.left).toBe(0);
    expect(seg2027!.width).toBeCloseTo(59 / 365, 4);

    // In 2028: no overlap
    expect(seg2028).toBeNull();
  });

  it("calculates ground cover percentage using the UNION of active cropped days (no double counting)", () => {
    const slots: RotationSlot[] = [
      {
        id: "s1",
        kind: "crop",
        cropId: "rice",
        plantDate: "2026-06-01",
        harvestDate: "2026-10-01", // 122 days
        dateConfidence: "exact",
        irrigated: true,
      },
      {
        id: "s2",
        kind: "crop",
        cropId: "black-gram",
        establishmentMode: "relay_broadcast",
        plantDate: "2026-09-24", // 7-day overlap with rice
        harvestDate: "2027-01-15", // to Jan 15
        dateConfidence: "exact",
        irrigated: false,
      },
      {
        id: "s3",
        kind: "fallow",
        plantDate: "2027-01-16",
        harvestDate: "2027-05-31",
        dateConfidence: "exact",
        irrigated: false,
      },
    ];

    // Total 1-year cycle (2026): 365 days
    const result1Yr = calculateGroundCoverPercent(slots, 1, 2026);
    expect(result1Yr.totalCycleDays).toBe(365);
    // Active union from 2026-06-01 to 2026-12-31: 214 days
    // Overlapping week (Sep 24 to Oct 01) is counted ONCE, not twice!
    expect(result1Yr.coveredDays).toBe(214);
    expect(result1Yr.coverPercent).toBe(Math.round((214 / 365) * 100));

    // Multi-year cycle (2026 + 2027 = 365 + 365 = 730 days)
    const result2Yr = calculateGroundCoverPercent(slots, 2, 2026);
    expect(result2Yr.totalCycleDays).toBe(730);
    // Active union from 2026-06-01 to 2027-01-15: 229 days
    expect(result2Yr.coveredDays).toBe(229);
    expect(result2Yr.coverPercent).toBe(Math.round((229 / 730) * 100));
  });
});

describe("PROMPT 1: Reusable Transition Policies & Relay Broadcasting (U-02)", () => {
  it("identifies eligible relay pairings according to Myanmar agronomic documentation", () => {
    expect(isRelayPairEligible("rice", "black-gram")).toBe(true);
    expect(isRelayPairEligible("rice", "green-gram")).toBe(true);
    expect(isRelayPairEligible("rice", "sesame")).toBe(false); // sesame requires well-tilled seedbed
    expect(isRelayPairEligible("maize", "black-gram")).toBe(false);
  });

  it("accepts negative planting gaps when explicit relay broadcast is selected for an eligible pair", () => {
    const prev = { cropId: "rice", harvestDate: "2026-10-20" };
    const nextRelay = {
      cropId: "black-gram",
      plantDate: "2026-10-13", // 7 days pre-harvest
      establishmentMode: "relay_broadcast" as const,
    };

    const evalRelay = evaluateTransition(prev, nextRelay);
    expect(evalRelay.status).toBe("relay");
    expect(evalRelay.isRelay).toBe(true);
    expect(evalRelay.gapDays).toBe(-7);
    expect(evalRelay.overlapDays).toBe(7);
  });

  it("rejects negative planting gaps as collisions if relay mode is not explicitly selected", () => {
    const prev = { cropId: "rice", harvestDate: "2026-10-20" };
    const nextTillage = {
      cropId: "black-gram",
      plantDate: "2026-10-13",
      establishmentMode: "tillage" as const, // conventional tillage cannot overlap!
    };

    const evalTillage = evaluateTransition(prev, nextTillage);
    expect(evalTillage.status).toBe("collision");
    expect(evalTillage.isRelay).toBe(false);
  });

  it("rejects negative planting gaps if crop pairing does not support relaying", () => {
    const prev = { cropId: "rice", harvestDate: "2026-10-20" };
    const nextSesame = {
      cropId: "sesame",
      plantDate: "2026-10-13",
      establishmentMode: "relay_broadcast" as const,
    };

    const evalSesame = evaluateTransition(prev, nextSesame);
    expect(evalSesame.status).toBe("collision");
  });

  it("rejects excessive negative gaps exceeding biological tolerance (> 12 days)", () => {
    const prev = { cropId: "rice", harvestDate: "2026-10-20" };
    const nextExcessive = {
      cropId: "black-gram",
      plantDate: "2026-10-05", // 15 days pre-harvest
      establishmentMode: "relay_broadcast" as const,
    };

    const evalExcessive = evaluateTransition(prev, nextExcessive);
    expect(evalExcessive.status).toBe("collision");
    expect(evalExcessive.message).toContain("exceeds maximum biological window");
  });

  it("reports valid turnaround for zero-gap and positive turnaround gaps", () => {
    const prev = { cropId: "rice", harvestDate: "2026-10-20" };
    const nextZero = { cropId: "black-gram", plantDate: "2026-10-20" };
    const nextTen = { cropId: "black-gram", plantDate: "2026-10-30" };

    expect(evaluateTransition(prev, nextZero).status).toBe("valid");
    expect(evaluateTransition(prev, nextZero).gapDays).toBe(0);

    expect(evaluateTransition(prev, nextTen).status).toBe("valid");
    expect(evaluateTransition(prev, nextTen).gapDays).toBe(10);
  });
});

describe("PROMPT 1: Backward Compatibility & Saved Rotation Format (Rule 3)", () => {
  it("parses existing saved rotations without new optional fields", () => {
    const legacySlot = {
      id: "legacy-1",
      kind: "crop",
      cropId: "rice",
      plantDate: "2026-06-01",
      harvestDate: "2026-09-30",
      dateConfidence: "exact",
      irrigated: true,
    };
    const parsedSlot = rotationSlotSchema.parse(legacySlot);
    expect(parsedSlot.cropId).toBe("rice");
    expect(parsedSlot.establishmentMode).toBeUndefined();

    const legacyRotation: Rotation = {
      id: "rot-legacy",
      fieldId: "f-1",
      label: "Legacy Plan",
      cycleYears: 1,
      slots: [legacySlot as RotationSlot],
      source: "farmer",
    };
    const parsedRotation = rotationSchema.parse(legacyRotation);
    expect(parsedRotation.label).toBe("Legacy Plan");
    expect(parsedRotation.cycleYears).toBe(1);
    expect(parsedRotation.cycleDays).toBeUndefined();
  });

  it("parses new rotations with establishmentMode and residueFate", () => {
    const upgradedSlot: RotationSlot = {
      id: "upgraded-1",
      kind: "crop",
      cropId: "black-gram",
      plantDate: "2026-10-15",
      harvestDate: "2027-01-31",
      dateConfidence: "typical",
      irrigated: false,
      establishmentMode: "relay_broadcast",
      residueFate: "retain_mulch",
    };
    const parsedSlot = rotationSlotSchema.parse(upgradedSlot);
    expect(parsedSlot.establishmentMode).toBe("relay_broadcast");
    expect(parsedSlot.residueFate).toBe("retain_mulch");
  });
});
