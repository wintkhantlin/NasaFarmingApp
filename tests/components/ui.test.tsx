/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskChip } from "@/components/ui/risk-chip";
import { Reading } from "@/components/ui/reading";
import { Recommendation } from "@/components/ui/recommendation";
import { Stepper, type StepId, type StepState } from "@/components/ui/stepper";

describe("UI Kit Components (Field Almanac)", () => {
  it("RiskChip enforces never-color-alone rule by always pairing icon and word", () => {
    render(<RiskChip hazard="drought">Dry soil risk</RiskChip>);
    const chip = screen.getByText("Dry soil risk");
    expect(chip).toBeInTheDocument();
    // Icon SVG is rendered within the chip
    const svg = chip.closest(".MuiChip-root")?.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("Reading renders value, unit, comfortable band verdict in words", () => {
    render(
      <Reading
        label="Soil pH"
        value={6.5}
        unit="pH"
        band={[6.0, 7.2]}
        scale={[4, 9]}
      />,
    );
    expect(screen.getByText("Soil pH")).toBeInTheDocument();
    expect(screen.getByText("6.5")).toBeInTheDocument();
    expect(screen.getByText("pH")).toBeInTheDocument();
    expect(screen.getByText("In range")).toBeInTheDocument();
  });

  it("Reading flags out-of-range value with appropriate verdict", () => {
    render(
      <Reading
        label="Soil pH"
        value={5.2}
        unit="pH"
        band={[6.0, 7.2]}
        scale={[4, 9]}
      />,
    );
    expect(screen.getByText("Below range")).toBeInTheDocument();
  });

  it("Recommendation renders answer-then-evidence structure", () => {
    render(
      <Recommendation
        context="Field 1 · Maize"
        headline="Switch to Sorghum next season"
        reason="Rainfall records show 20+ day dry spells in 7 of the last 10 years."
        risks={[{ hazard: "drought", label: "Drought resilience" }]}
      />,
    );
    expect(screen.getByText("Field 1 · Maize")).toBeInTheDocument();
    expect(screen.getByText("Switch to Sorghum next season")).toBeInTheDocument();
    expect(
      screen.getByText("Rainfall records show 20+ day dry spells in 7 of the last 10 years."),
    ).toBeInTheDocument();
    expect(screen.getByText("Drought resilience")).toBeInTheDocument();
  });

  it("Stepper displays 4 steps with their respective states", () => {
    const states: Record<StepId, StepState> = {
      location: "done",
      rotation: "needs-input",
      conditions: "not-started",
      compare: "not-started",
    };
    render(
      <Stepper
        fieldId="f-1"
        current="rotation"
        states={states}
      />,
    );
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Your rotation")).toBeInTheDocument();
    expect(screen.getByText("Conditions")).toBeInTheDocument();
    expect(screen.getByText("Compare")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Needs your input")).toBeInTheDocument();
  });
});
