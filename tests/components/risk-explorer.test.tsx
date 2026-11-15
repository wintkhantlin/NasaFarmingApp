/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RiskExplorer } from "@/components/field/conditions/risk-explorer";
import { buildRiskEvidenceMap } from "@/lib/conditions/condition-evidence";
import type { Field } from "@/lib/types";

const mockField: Field = {
  id: "f4",
  name: "Field 4",
  areaHa: 2.5,
  centroid: [95.2, 16.8],
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [95.19, 16.79],
        [95.21, 16.79],
        [95.21, 16.81],
        [95.19, 16.81],
        [95.19, 16.79],
      ],
    ],
  },
  samplePoints: [[95.2, 16.8]],
  irrigation: "none",
  region: "ayeyarwady",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const mockEvidenceMap = buildRiskEvidenceMap({
  conditions: {
    fieldId: "f4",
    fetchedAt: "2026-11-15T00:00:00Z",
    annualRainMm: 866,
    monthlyRainMm: [10, 20, 30, 60, 180, 240, 210, 190, 110, 50, 15, 5],
    monthlyEt0Mm: [95, 110, 140, 160, 150, 120, 110, 110, 105, 100, 90, 85],
    monthlyTmaxC: [31, 33, 36, 38, 35, 31, 30, 30, 31, 31, 31, 30],
    monthlyTminC: [16, 17, 21, 24, 25, 25, 24, 24, 24, 23, 20, 17],
    sources: [],
  },
  remote: null,
  trends: {
    through: 2025,
    trends: [
      {
        key: "monsoon-rain",
        title: "Monsoon rain",
        unit: "mm",
        source: "NASA POWER",
        scale: "wider",
        years: [
          { year: 2023, value: 850 },
          { year: 2024, value: 920 },
          { year: 2025, value: 810 },
        ],
        test: null,
        sentence: "Monsoon rain",
      },
      {
        key: "hot-days",
        title: "Hot days",
        unit: "days",
        source: "NASA POWER",
        scale: "wider",
        years: [
          { year: 2023, value: 45 },
          { year: 2024, value: 52 },
          { year: 2025, value: 68 },
        ],
        test: null,
        sentence: "Hot days",
      },
    ],
  },
  field: mockField,
  selectedYear: 2025,
});

describe("RiskExplorer (Surface B)", () => {
  afterEach(cleanup);
  it("renders all 4 equal-weight risk tabs", () => {
    render(
      <RiskExplorer
        field={mockField}
        evidenceMap={mockEvidenceMap}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: /Water stress/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Flood/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Erosion/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Heat & cold/ })).toBeInTheDocument();
  });

  it("switches risk and atomically updates findings and map overlay details", () => {
    render(
      <RiskExplorer
        field={mockField}
        evidenceMap={mockEvidenceMap}
        onBack={vi.fn()}
      />,
    );

    // Initial risk is Water stress
    expect(screen.getByRole("tab", { name: /Water stress/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(/2025 monsoon rain \(810 mm\)/)).toBeInTheDocument();

    // Click Flood tab
    fireEvent.click(screen.getByRole("tab", { name: /Flood/ }));

    expect(screen.getByRole("tab", { name: /Flood/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText(/No verified cloud-free surface-water observation/),
    ).toBeInTheDocument();
  });

  it("provides non-drag expand/collapse triggers for the findings sheet", () => {
    render(
      <RiskExplorer
        field={mockField}
        evidenceMap={mockEvidenceMap}
        onBack={vi.fn()}
      />,
    );

    const toggleButton = screen.getByRole("button", { name: /Water stress/ });
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggleButton); // half -> full
    fireEvent.click(toggleButton); // full -> peek
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
  });

  it("calls onBack when Back to Conditions is tapped", () => {
    const onBack = vi.fn();
    render(
      <RiskExplorer
        field={mockField}
        evidenceMap={mockEvidenceMap}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Back to Conditions/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
