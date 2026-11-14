import { describe, expect, test } from "vitest";
import {
  deriveCycleYears,
  describeLength,
  exceedsMaxCycle,
  findOverlaps,
  placeCrop,
  readRotation,
  restGaps,
  ribbonLanes,
  sortByPlanting,
} from "../../lib/rotation-plan";
import { slot } from "../helpers/synthetic";

const rice = slot("rice", "rice", "2026-06-01", "2026-10-14");

describe("deriveCycleYears", () => {
  test("is one year for crops that all finish within twelve months", () => {
    expect(deriveCycleYears([rice, slot("gg", "green-gram", "2026-10-20", "2027-01-03")])).toBe(1);
  });
  test("grows with the span between first planting and last harvest", () => {
    expect(deriveCycleYears([rice, slot("gg", "green-gram", "2027-10-20", "2028-01-03")])).toBe(2);
  });
  test("is one year with no crops, and never more than four", () => {
    expect(deriveCycleYears([])).toBe(1);
    const far = [rice, slot("x", "rice", "2032-06-01", "2032-10-14")];
    expect(deriveCycleYears(far)).toBe(4);
    expect(exceedsMaxCycle(far)).toBe(true);
    expect(exceedsMaxCycle([rice])).toBe(false);
  });
});

describe("findOverlaps", () => {
  test("reports the days two crops share, once per pair", () => {
    const a = slot("a", "black-gram", "2026-10-20", "2027-01-18");
    const b = slot("b", "green-gram", "2026-10-20", "2027-01-03");
    const out = findOverlaps([b, a, rice]);
    expect(out).toHaveLength(1);
    expect(out[0].days).toBe(76);
  });
  test("treats fallow and back-to-back crops as clear", () => {
    const rest = slot("f", "rice", "2026-10-10", "2026-12-01", { kind: "fallow", cropId: undefined });
    expect(findOverlaps([rice, rest, slot("gg", "green-gram", "2026-10-20", "2027-01-03")])).toEqual([]);
  });
  test("counts a shared single day as an overlap", () => {
    expect(findOverlaps([rice, slot("n", "black-gram", "2026-10-14", "2027-01-01")])[0].days).toBe(1);
  });
});

describe("placeCrop", () => {
  test("opens at the start of the usual sowing window when the field is free", () => {
    const p = placeCrop("rice", [], "ayeyarwady", 2026);
    expect(p).toMatchObject({ plantDate: "2026-06-01", harvestDate: "2026-10-14", extendsCycle: false, fits: true });
  });

  test("puts a second crop after the first in the same year when its window allows", () => {
    const p = placeCrop("green-gram", [rice], "ayeyarwady", 2026);
    expect(p.fits).toBe(true);
    expect(p.extendsCycle).toBe(false);
    expect(p.plantDate >= "2026-10-19").toBe(true);
    expect(findOverlaps([rice, slot("n", "green-gram", p.plantDate, p.harvestDate)])).toEqual([]);
  });

  test("moves a crop later inside its own window rather than into the next year", () => {
    const blocker = slot("b", "black-gram", "2026-10-20", "2026-12-25");
    const p = placeCrop("green-gram", [rice, blocker], "ayeyarwady", 2026);
    expect(p.extendsCycle).toBe(false);
    expect(p.plantDate > "2026-12-25").toBe(true);
    expect(p.plantDate <= "2027-01-15").toBe(true);
  });

  test("moves to year 2 when the whole sowing window is taken, and says it fits", () => {
    const blackGram = slot("b", "black-gram", "2026-10-20", "2027-01-18");
    const p = placeCrop("green-gram", [rice, blackGram], "ayeyarwady", 2026);
    expect(p.extendsCycle).toBe(true);
    expect(p.fits).toBe(true);
    expect(p.plantDate.startsWith("2027")).toBe(true);
  });

  test("never lets a placed crop overlap an existing one when it reports a fit", () => {
    const existing = [rice, slot("b", "black-gram", "2026-10-20", "2027-01-18")];
    const p = placeCrop("green-gram", existing, "ayeyarwady", 2026);
    expect(findOverlaps([...existing, slot("n", "green-gram", p.plantDate, p.harvestDate)])).toEqual([]);
  });

  test("falls back to usual dates and reports no fit when the four-year limit blocks every window", () => {
    const fillers = [0, 1, 2, 3].map((i) => slot(`r${i}`, "rice", `${2026 + i}-05-01`, `${2026 + i}-12-31`));
    const p = placeCrop("rice", fillers, "ayeyarwady", 2026);
    expect(p.fits).toBe(false);
    expect(p.extendsCycle).toBe(false);
  });

  test("uses the first crop's year as the base, not today's", () => {
    const old = slot("o", "rice", "2024-06-01", "2024-10-14");
    expect(placeCrop("green-gram", [old], "ayeyarwady", 2026).plantDate.startsWith("2024")).toBe(true);
  });

  test("handles a crop with no sowing calendar by using its default dates", () => {
    const p = placeCrop("wheat", [], undefined, 2026);
    expect(p.fits).toBe(true);
    expect(p.plantDate.startsWith("2026")).toBe(true);
  });
});

describe("restGaps", () => {
  test("names the long rest after a one-year pair and ignores short turnaround", () => {
    const gg = slot("gg", "green-gram", "2026-10-20", "2027-01-03");
    const { gaps, coveredShare } = restGaps([rice, gg], 1);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].span).toBe("4 Jan to 31 May");
    expect(gaps[0].length).toBe("about 5 months");
    expect(coveredShare).toBeGreaterThan(0.5);
  });
});

describe("ribbonLanes", () => {
  test("wraps a crop that runs past December onto the start of the same lane in a one-year cycle", () => {
    const gg = slot("gg", "green-gram", "2026-10-20", "2027-01-03");
    const [lane] = ribbonLanes([rice, gg], 1);
    const bars = lane.rows.flat();
    expect(bars).toHaveLength(3);
    const tail = bars.find((b) => b.cutLeft);
    expect(tail?.left).toBe(0);
    expect(tail?.slot.id).toBe("gg");
    expect(bars.find((b) => b.cutRight)?.slot.id).toBe("gg");
  });

  test("makes one lane per year and stacks crops that share days", () => {
    const a = slot("a", "black-gram", "2026-10-20", "2026-12-20");
    const b = slot("b", "green-gram", "2026-10-25", "2026-12-25");
    const lanes = ribbonLanes([a, b, slot("c", "rice", "2027-06-01", "2027-10-14")], 2);
    expect(lanes.map((l) => l.label)).toEqual(["Year 1", "Year 2"]);
    expect(lanes[0].rows).toHaveLength(2);
    expect(lanes[1].rows).toHaveLength(1);
  });
});

describe("readRotation and helpers", () => {
  test("writes the sequence in planting order, whatever order the crops were tapped", () => {
    const gg = slot("gg", "green-gram", "2026-10-20", "2027-01-03");
    const r = readRotation([gg, rice]);
    expect(r.sequence).toBe("Rice, then Green gram");
    expect(r.cycle).toBe("Repeats every year");
    expect(r.overlaps).toEqual([]);
  });
  test("sorts by planting date", () => {
    expect(sortByPlanting([slot("b", "rice", "2026-09-01", "2026-12-01"), rice]).map((s) => s.id)).toEqual(["rice", "b"]);
  });
  test("describes lengths in the unit a farmer would use", () => {
    expect(describeLength(9)).toBe("9 days");
    expect(describeLength(21)).toBe("about 3 weeks");
    expect(describeLength(153)).toBe("about 5 months");
  });
});
