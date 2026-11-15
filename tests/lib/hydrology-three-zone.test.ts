import { describe, expect, it } from "vitest";
import {
  threeZoneCapacities,
  threeZoneStep,
  redistributeAtRootChangeThreeZone,
  paddyDrainageHandover,
  seedbedMoistureWindow,
  type ThreeZoneColumn,
  type ThreeZoneState,
} from "../../lib/engine/water";

describe("PROMPT 3: Non-overlapping 3-zone hydrology & mass conservation (H-01, H-03, H-04)", () => {
  const defaultCol: ThreeZoneColumn = {
    awcMmPerM: 140, // typical clay-loam AWC
    seedbedDepthM: 0.12, // 12 cm seedbed
    rootDepthM: 0.40, // 40 cm root depth
    maxDepthM: 1.0, // 1.0 m total column
    thetaSat: 0.48,
    thetaFc: 0.34,
    kPanMmDay: 3.0,
  };

  it("calculates non-overlapping layer capacities correctly summing to total column", () => {
    const cap = threeZoneCapacities(defaultCol);
    expect(cap.z1M).toBe(0.12);
    expect(cap.z2M).toBeCloseTo(0.28, 6); // 0.40 - 0.12 = 0.28m
    expect(cap.z3M).toBeCloseTo(0.60, 6); // 1.00 - 0.40 = 0.60m
    expect(cap.z1M + cap.z2M + cap.z3M).toBeCloseTo(1.0, 6);

    expect(cap.c1Mm).toBeCloseTo(140 * 0.12, 4); // 16.8 mm
    expect(cap.c2Mm).toBeCloseTo(140 * 0.28, 4); // 39.2 mm
    expect(cap.c3Mm).toBeCloseTo(140 * 0.60, 4); // 84.0 mm
    expect(cap.c1Mm + cap.c2Mm + cap.c3Mm).toBeCloseTo(cap.totalCapacityMm, 4);
  });

  it("conserves mass strictly (residual <= 1e-9 mm) in rainless drydown", () => {
    const cap = threeZoneCapacities(defaultCol);
    const startState: ThreeZoneState = {
      surfacePondMm: 0,
      seedbedMm: cap.c1Mm,
      rootSubSeedbedMm: cap.c2Mm,
      subRootMm: cap.c3Mm,
    };

    let cur = startState;
    for (let day = 0; day < 10; day++) {
      const res = threeZoneStep(cur, defaultCol, 0, 4.5, 0, {
        kcb: 0.8,
        ke: 0.2,
        p: 0.5,
      });
      expect(Math.abs(res.residualMm)).toBeLessThanOrEqual(1e-9);
      expect(res.state.seedbedMm).toBeGreaterThanOrEqual(0);
      expect(res.state.rootSubSeedbedMm).toBeGreaterThanOrEqual(0);
      expect(res.state.subRootMm).toBeGreaterThanOrEqual(0);
      cur = res.state;
    }
  });

  it("conserves mass strictly during heavy rain, runoff, and bund spill", () => {
    const cap = threeZoneCapacities(defaultCol);
    const startState: ThreeZoneState = {
      surfacePondMm: 0,
      seedbedMm: cap.c1Mm * 0.5,
      rootSubSeedbedMm: cap.c2Mm * 0.5,
      subRootMm: cap.c3Mm * 0.5,
    };

    // Heavy storm of 120mm on bunded paddy (bund = 50mm)
    const bundStep = threeZoneStep(startState, defaultCol, 120, 2.0, 0, {
      bundHeightMm: 50,
      p: 0.5,
    });
    expect(Math.abs(bundStep.residualMm)).toBeLessThanOrEqual(1e-9);
    expect(bundStep.runoffMm).toBeGreaterThan(0);
    expect(bundStep.state.surfacePondMm).toBeLessThanOrEqual(50);

    // Heavy storm of 120mm on upland unbunded field with infiltration partition
    const uplandStep = threeZoneStep(startState, defaultCol, 120, 2.0, 0, {
      bundHeightMm: 0,
      dailyInfiltrationMaxMm: 60,
      p: 0.5,
    });
    expect(Math.abs(uplandStep.residualMm)).toBeLessThanOrEqual(1e-9);
    expect(uplandStep.runoffMm).toBe(60); // 120 - 60 = 60mm runoff
    expect(uplandStep.state.surfacePondMm).toBe(0);
  });

  it("conserves mass strictly with capillary inflow", () => {
    const startState: ThreeZoneState = {
      surfacePondMm: 0,
      seedbedMm: 5,
      rootSubSeedbedMm: 10,
      subRootMm: 15,
    };

    const step = threeZoneStep(startState, defaultCol, 0, 3.0, 0, {
      capillaryInflowMm: 8.0,
      p: 0.5,
    });
    expect(Math.abs(step.residualMm)).toBeLessThanOrEqual(1e-9);
    expect(step.inflowMm).toBe(8.0);
  });

  it("preserves dry topsoil without homogenizing with wet subsoil on root deepening", () => {
    // Seedbed is desiccated (0.5 mm) while subsoil has ample moisture (30 mm)
    const dryTopState: ThreeZoneState = {
      surfacePondMm: 0,
      seedbedMm: 0.5,
      rootSubSeedbedMm: 5.0,
      subRootMm: 50.0,
    };

    // Crop roots deepen from 0.20m to 0.60m
    const deepened = redistributeAtRootChangeThreeZone(
      dryTopState,
      { ...defaultCol, rootDepthM: 0.20 },
      0.60,
    );

    // Topsoil seedbed moisture MUST NOT be homogenized or increased by wet subsoil
    expect(deepened.seedbedMm).toBe(0.5);
    // Sub-seedbed root layer expanded by capturing water from sub-root buffer
    expect(deepened.rootSubSeedbedMm).toBeGreaterThan(5.0);
    // Total column water must be identical (no creation or destruction of water)
    const oldTotal = dryTopState.seedbedMm + dryTopState.rootSubSeedbedMm + dryTopState.subRootMm;
    const newTotal = deepened.seedbedMm + deepened.rootSubSeedbedMm + deepened.subRootMm;
    expect(newTotal).toBeCloseTo(oldTotal, 9);
  });

  it("conserves water when roots shrink or harvest resets root depth", () => {
    const matureState: ThreeZoneState = {
      surfacePondMm: 0,
      seedbedMm: 8.0,
      rootSubSeedbedMm: 25.0,
      subRootMm: 35.0,
    };

    // Harvest / next crop reset from 0.60m back to seedbed depth 0.12m
    const reset = redistributeAtRootChangeThreeZone(
      matureState,
      { ...defaultCol, rootDepthM: 0.60 },
      0.12,
    );

    expect(reset.seedbedMm).toBe(8.0); // Seedbed untouched
    expect(reset.rootSubSeedbedMm).toBe(0); // Roots collapsed back to seedbed
    expect(reset.subRootMm).toBe(60.0); // 25 + 35 = 60 mm in buffer

    const oldTotal = matureState.seedbedMm + matureState.rootSubSeedbedMm + matureState.subRootMm;
    const newTotal = reset.seedbedMm + reset.rootSubSeedbedMm + reset.subRootMm;
    expect(newTotal).toBeCloseTo(oldTotal, 9);
  });

  it("handles paddy drainage handover by discharging surface pond and decaying perched water", () => {
    const handover = paddyDrainageHandover({
      pondAtHarvestMm: 45.0,
      column: defaultCol,
      thetaSat: 0.50,
      thetaFc: 0.36,
      ploughPanDepthM: 0.20,
      kPanMmDay: 3.5,
    });

    expect(handover.surfaceDrainageOutflowMm).toBe(45.0);
    expect(handover.state.surfacePondMm).toBe(0);
    expect(handover.perchedExcessMm).toBeCloseTo((0.50 - 0.36) * 0.20 * 1000, 4); // 28 mm
    expect(handover.kPanMmDay).toBe(3.5);

    // Step with perched water draining down plough pan
    const step = threeZoneStep(handover.state, { ...defaultCol, kPanMmDay: 3.5 }, 0, 3.0, 0, {
      ke: 0.8,
      kcb: 0,
    });
    expect(Math.abs(step.residualMm)).toBeLessThanOrEqual(1e-9);
    expect(step.ploughPanDrainageMm).toBe(3.5);
    expect(step.state.perchedExcessMm).toBeCloseTo(28.0 - 3.5 - step.soilEvaporationMm, 4);
  });

  it("seedbed moisture window returns 'field-check-needed' when soil or drainage date is unconfirmed", () => {
    const unconfirmed = seedbedMoistureWindow({
      hasConfirmedSoil: false,
      hasConfirmedDrainageDate: false,
    });
    expect(unconfirmed.status).toBe("field-check-needed");
    if (unconfirmed.status === "field-check-needed") {
      expect(unconfirmed.advisory).toContain("Check topsoil moisture and drainage by hand");
    }
  });

  it("seedbed moisture window produces physical drydown phases when inputs are confirmed", () => {
    const confirmed = seedbedMoistureWindow({
      hasConfirmedSoil: true,
      hasConfirmedDrainageDate: true,
      awcMmPerM: 140,
      thetaSat: 0.50,
      thetaFc: 0.36,
      pondAtDrainageMm: 30,
      kPanMmDay: 3.0,
      dailyEt0Mm: Array(28).fill(4.0),
      dailyRainMm: Array(28).fill(0.0),
    });

    expect(confirmed.status).toBe("estimate");
    if (confirmed.status === "estimate") {
      expect(confirmed.readyDayAfterDrainage).toBeGreaterThan(0);
      expect(confirmed.windowEndDayAfterDrainage).toBeGreaterThanOrEqual(confirmed.readyDayAfterDrainage);
      expect(confirmed.timeline.length).toBe(28);

      // Early phase should be too_wet while perched water drains
      expect(confirmed.timeline[0].phase).toBe("too_wet");
      // Mid phase should reach optimal
      const optimalDays = confirmed.timeline.filter((t) => t.phase === "optimal");
      expect(optimalDays.length).toBeGreaterThan(0);
      expect(confirmed.caveat).toContain("Field moisture must be verified by hand before planting");
    }
  });
});
