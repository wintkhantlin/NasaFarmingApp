/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ComparisonResults } from "../../components/field/results/comparison-results";
import { compareRotations } from "../../lib/engine/compare";
import { adaptComparison } from "../../lib/plan/engine-display";
import { buildResultsModel } from "../../lib/plan/results-model";
import { useFieldsStore } from "../../lib/store/fields-store";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

vi.mock("../../components/field/season-strip", () => ({
  SeasonStrip: () => <div>season strip</div>,
  SeasonStripMini: ({ strip }: { strip: unknown[] }) => <div data-testid="mini-strip">{strip.length} seasons</div>,
}));

describe("Farmer Audit Refinements for S10 Compare Screen", () => {
  const field = syntheticField({ priorities: { order: ["water", "soil"], weights: {} } });
  const mine = rotation(field.id, [
    slot("sesame", "sesame", "2026-05-15", "2026-08-23"),
    slot("gram", "green-gram", "2026-08-30", "2026-11-13"),
  ]);
  const data = engineData(field, syntheticWeather());
  const result = compareRotations(data, mine, { baseYear: 2026, now: new Date("2026-11-14T00:00:00Z") });
  const display = adaptComparison({
    mode: "field",
    phase: "ready",
    field,
    rotation: mine,
    data,
    comparison: result,
    inputRevision: "r",
    resultRevision: "r",
  });
  const options = [result.current, ...display.options.filter((o) => o.kind === "alternative").map((o) => o.engine)];
  const model = buildResultsModel({ field, comparison: result, display, options });

  test("renders 1-tap GoalChips for farmers to test goals immediately without leaving the page", () => {
    const update = vi.fn();
    useFieldsStore.setState({ status: "ready", fields: [field], rotations: {}, load: vi.fn(), loadRotations: vi.fn(), update } as never);
    render(<ComparisonResults field={field} model={model} />);

    expect(screen.getByRole("radiogroup", { name: "Choose farming goal" })).toBeTruthy();
    const waterChip = screen.getByRole("radio", { name: /save water/i });
    expect(waterChip).toBeTruthy();

    const incomeChip = screen.getByRole("radio", { name: /earn more/i });
    expect(incomeChip).toBeTruthy();

    // Clicking income chip calls update with priorities
    fireEvent.click(incomeChip);
    expect(update).toHaveBeenCalledWith(field.id, {
      priorities: {
        order: ["income"],
        weights: {},
        soil: undefined,
        income: undefined,
      },
    });
  });

  test("provides decisive constructive headline when alternatives dominate a severe water shortfall baseline", () => {
    // Current crop has severe water deficit (414 mm), alternatives have small shortfall (150 mm)
    const currentHighDeficit = {
      ...result.current,
      metrics: { ...result.current.metrics, "water-shortfall": 414 },
    };
    const alt1 = {
      ...options[1],
      metrics: { ...options[1].metrics, "water-shortfall": 154 },
    };
    const dominatingResult = {
      ...result,
      current: currentHighDeficit,
      alternatives: [alt1],
    };
    const dominatingDisplay = adaptComparison({
      mode: "field",
      phase: "ready",
      field,
      rotation: mine,
      data,
      comparison: dominatingResult,
      inputRevision: "r2",
      resultRevision: "r2",
    });
    const dominatingModel = buildResultsModel({
      field,
      comparison: dominatingResult,
      display: dominatingDisplay,
      options: [currentHighDeficit, alt1],
    });

    render(<ComparisonResults field={field} model={dominatingModel} />);
    // One alternative: the headline names it rather than saying "both", and the reason uses the plans' own rain gaps.
    expect(screen.getByRole("heading", { name: /handles dry weather far better than what you grow now/i })).toBeTruthy();
    expect(screen.queryByText(/Both alternative plans/i)).toBeNull();
    expect(screen.getByText(/It cuts the typical rain gap per crop from 414 mm to 154 mm/i)).toBeTruthy();
    expect(screen.queryByText(/sesame or groundnut/i)).toBeNull();
  });

  test("uses plain-language 'Crop water demand' without academic jargon 'ETc'", () => {
    render(<ComparisonResults field={field} model={model} />);
    expect(screen.getAllByText("Crop water demand").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Crop water demand \(ETc\)/i)).toBeNull();
  });

  test("discloses upfront seed cash requirement in Money section for financial budgeting", () => {
    render(<ComparisonResults field={field} model={model} />);
    expect(screen.getAllByText(/Upfront seed cash:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Groundnut requires substantial upfront cash for seed/i).length).toBeGreaterThan(0);
  });
});
