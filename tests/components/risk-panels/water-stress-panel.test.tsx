/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WaterStressPanel } from "@/components/field/conditions/risk-panels/water-stress-panel";
import { buildWaterStressEvidence } from "@/lib/conditions/condition-evidence";
import { getCropById } from "@/lib/data/crops";

describe("WaterStressPanel", () => {
  afterEach(cleanup);

  it("explains potential water demand vs actual irrigation", () => {
    const evidence = buildWaterStressEvidence({
      conditions: {
        fieldId: "f1",
        fetchedAt: "2026-11-15T00:00:00Z",
        annualRainMm: 800,
        monthlyRainMm: [5, 10, 20, 40, 100, 150, 180, 160, 100, 40, 10, 5],
        monthlyEt0Mm: [90, 100, 130, 150, 140, 120, 110, 110, 100, 95, 85, 80],
        sources: [],
      },
      remote: null,
      point: [95.2, 16.8],
    });

    render(<WaterStressPanel evidence={evidence} />);

    expect(screen.getByText(/Rain against crop water demand/)).toBeInTheDocument();
    expect(
      screen.getByText(/Crop demand \(ETc\) is well-watered potential demand/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cannot estimate field soil water at planting yet/),
    ).toBeInTheDocument();
  });

  it("truthfully reports when regional SMAP moisture is not available", () => {
    const evidence = buildWaterStressEvidence({
      conditions: null,
      remote: null,
      point: [95.2, 16.8],
    });

    render(<WaterStressPanel evidence={evidence} />);

    expect(
      screen.getByText(/Regional soil moisture: not available/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Missing data is not treated as adequate moisture/),
    ).toBeInTheDocument();
  });

  it("displays crop sensitivity when crop is specified", () => {
    const maize = getCropById("maize");
    const evidence = buildWaterStressEvidence({
      conditions: null,
      remote: null,
      point: [95.2, 16.8],
      crop: maize,
    });

    render(<WaterStressPanel evidence={evidence} crop={maize} />);

    expect(screen.getByText(/Crop sensitivity:/)).toBeInTheDocument();
    expect(screen.getByText(/maize/i)).toBeInTheDocument();
  });
});
