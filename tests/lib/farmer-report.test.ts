import { describe, expect, it } from "vitest";
import { buildFarmerReport } from "@/lib/plan/farmer-report";
import { copy } from "@/lib/copy/en";
import { copyMy } from "@/lib/copy/my";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";
import { compareRotations } from "@/lib/engine/compare";

import type { PriorityId, RegionId } from "@/lib/types";

function setupReport(region: RegionId = "ayeyarwady") {
  const field = syntheticField({
    name: "Field 4",
    region,
    areaHa: 9.2,
    irrigation: "none",
    locationConfirmed: true,
    priorities: { order: ["water", "soil"] as PriorityId[], weights: {} },
    localNotes: "Water check: well is at 16.840, 95.120 near the secondary ditch.",
  });
  const currentRotation = {
    ...rotation(field.id, [
      slot("s1", "rice", "2026-06-15", "2026-10-15"),
      slot("s2", "black-gram", "2026-11-01", "2027-02-15"),
    ]),
    source: "farmer" as const,
  };
  const weather = syntheticWeather();
  const engine = engineData(field, weather);
  const comparison = compareRotations(engine, currentRotation);

  return { field, currentRotation, engine, comparison };
}

describe("FarmerReport Adapter & Truthfulness", () => {
  it("builds a normalized FarmerReport with correct field overview and confirmed states", () => {
    const { field, currentRotation, engine, comparison } = setupReport();
    const report = buildFarmerReport({
      field,
      comparison,
      rotations: [currentRotation],
      engineData: engine,
      hideLocation: false,
      areaUnit: "ha",
      locale: "en",
      t: copy,
    });

    expect(report.fieldName).toBe("Field 4");
    expect(report.area.text).toBe("9.2 ha");
    expect(report.area.state).toBe("confirmed");
    expect(report.waterAccess.label).toBe("Rain only");
    expect(report.waterAccess.state).toBe("confirmed");
    expect(report.locationConfirmed).toBe(true);
    expect(report.hideExactLocation).toBe(false);
    expect(report.coordinatesText.toLowerCase()).toContain("confirmed by you");
  });

  it("redacts coordinates from header and local notes when hideLocation is true", () => {
    const { field, currentRotation, engine, comparison } = setupReport();
    const report = buildFarmerReport({
      field,
      comparison,
      rotations: [currentRotation],
      engineData: engine,
      hideLocation: true,
      areaUnit: "ha",
      locale: "en",
      t: copy,
    });

    expect(report.hideExactLocation).toBe(true);
    expect(report.coordinatesText).toBe("Hidden. Region only");
    expect(report.localNotes[0].text).not.toContain("16.840, 95.120");
    expect(report.localNotes[0].text).toContain("[location hidden]");
  });

  it("excludes Fallow from rainfall shortfall ranking and marks it not_applicable", () => {
    const { field, currentRotation, engine, comparison } = setupReport();
    const report = buildFarmerReport({
      field,
      comparison,
      rotations: [currentRotation],
      engineData: engine,
      hideLocation: false,
      areaUnit: "ha",
      locale: "en",
      t: copy,
    });

    const fallowChoice = report.choices.find((c) =>
      c.cropSequence.includes("Fallow") || c.cropIds.includes("fallow")
    );
    expect(fallowChoice).toBeDefined();
    if (fallowChoice) {
      expect(fallowChoice.shortfall.state).toBe("not_applicable");
      expect(fallowChoice.shortfall.value).toBeNull();
      expect(fallowChoice.shortfall.comparable).toBe(false);
      expect(fallowChoice.shortfall.comparisonGroupId).toBeUndefined();
      expect(fallowChoice.shortfall.explanation).toContain("not applicable");
    }
  });

  it("marks multi-year cycles as non-comparable to single-year cycles", () => {
    const { field, currentRotation, engine, comparison } = setupReport();
    const report = buildFarmerReport({
      field,
      comparison,
      rotations: [currentRotation],
      engineData: engine,
      hideLocation: false,
      areaUnit: "ha",
      locale: "en",
      t: copy,
    });

    const multiYear = report.choices.find((c) => c.cycleYears > 1 && !c.cropIds.includes("fallow"));
    expect(multiYear).toBeDefined();
    if (multiYear) {
      expect(multiYear.shortfall.comparable).toBe(false);
      expect(multiYear.shortfall.comparisonGroupId).toBe("multi-year-cycle");
      expect(multiYear.shortfall.explanation).toContain("Different cycle lengths");
    }
  });

  it("calibrates key finding to warn that water sufficiency on this field is unverified", () => {
    const { field, currentRotation, engine, comparison } = setupReport();
    const report = buildFarmerReport({
      field,
      comparison,
      rotations: [currentRotation],
      engineData: engine,
      hideLocation: false,
      areaUnit: "ha",
      locale: "en",
      t: copy,
    });

    expect(report.keyFindingText).not.toContain("Recommended");
    expect(report.keyFindingText).not.toContain("Best");
    expect(report.keyFindingText).not.toContain("100%");
    expect(report.keyFindingWarning).toContain("could not verify how much water");
  });

  it("truthfully lists unavailable datasets (GPM IMERG, SMAP, SRTM)", () => {
    const { field, currentRotation, engine, comparison } = setupReport();
    const report = buildFarmerReport({
      field,
      comparison,
      rotations: [currentRotation],
      engineData: engine,
      hideLocation: false,
      areaUnit: "ha",
      locale: "en",
      t: copy,
    });

    const smap = report.sources.find((s) => s.label.includes("SMAP"));
    expect(smap).toBeDefined();
    expect(smap?.state).toBe("unavailable");

    const srtm = report.sources.find((s) => s.label.includes("SRTM"));
    expect(srtm).toBeDefined();
    expect(srtm?.state).toBe("unavailable");
  });

  it("generates exactly 3 local check questions for adviser discussion", () => {
    const { field, currentRotation, engine, comparison } = setupReport();
    const report = buildFarmerReport({
      field,
      comparison,
      rotations: [currentRotation],
      engineData: engine,
      hideLocation: false,
      areaUnit: "ha",
      locale: "en",
      t: copy,
    });

    expect(report.checkLocallyQuestions).toHaveLength(3);
    expect(report.checkLocallyQuestions[0]).toContain("moist long enough");
    expect(report.checkLocallyQuestions[1]).toContain("seed and sell");
    expect(report.checkLocallyQuestions[2]).toContain("fit between rice harvest");
  });

  it("supports Myanmar localization with verified Unicode translations", () => {
    const { field, currentRotation, engine, comparison } = setupReport();
    const report = buildFarmerReport({
      field,
      comparison,
      rotations: [currentRotation],
      engineData: engine,
      hideLocation: false,
      areaUnit: "ha",
      locale: "my",
      t: copyMy as unknown as typeof copy,
    });

    expect(report.keyFindingText).toContain("မတ်ပဲ");
    expect(report.keyFindingText).toContain("ပဲတီစိမ်း");
    expect(report.checkLocallyQuestions[0]).toContain("မိုးစပါးရိတ်ပြီးနောက်");
  });
});
