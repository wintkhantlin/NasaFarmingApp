/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HeatColdPanel } from "@/components/field/conditions/risk-panels/heat-cold-panel";
import { buildHeatColdEvidence } from "@/lib/conditions/condition-evidence";
import { getCropById } from "@/lib/data/crops";

describe("HeatColdPanel", () => {
  afterEach(cleanup);

  it("switches between high heat and cold night sub-views within the single risk", () => {
    const evidence = buildHeatColdEvidence({
      conditions: {
        fieldId: "f1",
        fetchedAt: "2026-11-15T00:00:00Z",
        annualRainMm: 800,
        monthlyRainMm: [5, 10, 20, 40, 100, 150, 180, 160, 100, 40, 10, 5],
        monthlyEt0Mm: [90, 100, 130, 150, 140, 120, 110, 110, 100, 95, 85, 80],
        monthlyTmaxC: [31, 33, 36, 38, 35, 31, 30, 30, 31, 31, 31, 30],
        monthlyTminC: [16, 17, 21, 24, 25, 25, 24, 24, 24, 23, 20, 17],
        sources: [],
      },
      trends: {
        through: 2025,
        trends: [
          {
            key: "hot-days",
            title: "Hot days",
            unit: "days",
            source: "NASA POWER",
            scale: "wider",
            years: [{ year: 2024, value: 52 }],
            test: null,
            sentence: "Hot days",
          },
        ],
      },
      point: [95.2, 16.8],
      selectedYear: 2024,
    });

    render(<HeatColdPanel evidence={evidence} />);

    // Initial subview: Heat
    expect(screen.getByText(/2024 had 52 days at or above 35 °C/)).toBeInTheDocument();
    expect(screen.getByText(/Air heat is not crop heat/)).toBeInTheDocument();

    // Click Cold subview
    fireEvent.click(screen.getByRole("button", { name: /Cold & frost nights/ }));

    expect(screen.getByText(/Cool winter nights/)).toBeInTheDocument();
    expect(screen.getByText(/Lowest monthly night average near 16 °C/)).toBeInTheDocument();
  });

  it("handles missing crop calendar with honest 'Crop-stage exposure not evaluated'", () => {
    const evidence = buildHeatColdEvidence({
      conditions: null,
      trends: null,
      point: [95.2, 16.8],
    });

    render(<HeatColdPanel evidence={evidence} />);

    expect(screen.getByText(/Crop-stage exposure not evaluated/)).toBeInTheDocument();
    expect(screen.getByText(/Heat exceedance ≠ heatwave/)).toBeInTheDocument();
  });

  it("displays crop sensitivity when crop is specified", () => {
    const maize = getCropById("maize");
    const evidence = buildHeatColdEvidence({
      conditions: null,
      trends: null,
      point: [95.2, 16.8],
      crop: maize,
    });

    render(<HeatColdPanel evidence={evidence} crop={maize} />);

    expect(screen.getByText(/optimal temperature/)).toBeInTheDocument();
  });
});
