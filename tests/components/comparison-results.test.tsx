/**
 * @vitest-environment jsdom
 */
import { afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ComparisonResults } from "../../components/field/results/comparison-results";
import { compareRotations } from "../../lib/engine/compare";
import { adaptComparison } from "../../lib/plan/engine-display";
import { buildResultsModel } from "../../lib/plan/results-model";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

vi.mock("../../components/field/season-strip", () => ({ SeasonStrip: () => <div>season strip</div> }));

const field = syntheticField({ priorities: { order: ["water", "soil"], weights: {} } });
const mine = rotation(field.id, [slot("sesame", "sesame", "2026-05-15", "2026-08-23"), slot("gram", "green-gram", "2026-08-30", "2026-11-13")]);
const data = engineData(field, syntheticWeather());
const result = compareRotations(data, mine, { baseYear: 2026, now: new Date("2026-11-14T00:00:00Z") });
const display = adaptComparison({ mode: "field", phase: "ready", field, rotation: mine, data, comparison: result, inputRevision: "r", resultRevision: "r" });
const options = [result.current, ...display.options.filter((o) => o.kind === "alternative").map((o) => o.engine)];
const model = buildResultsModel({ field, comparison: result, display, options });

describe("ComparisonResults", () => {
  test("shows every section, the status and the research-prototype limits", () => {
    render(<ComparisonResults field={field} model={model} />);
    for (const name of ["Comparison overview", "Rotation comparison", "Water and climate", "Soil and environment", "Money", "Why this rotation?", "What we still do not know"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.getAllByText(model.statusTitle).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not forecast next season/i)).toBeTruthy();
  });

  test("links back to priorities and field details", () => {
    render(<ComparisonResults field={field} model={model} />);
    expect(screen.getByRole("link", { name: "Edit my priorities" }).getAttribute("href")).toBe(`/fields/${field.id}/profile`);
    expect(screen.getByRole("link", { name: "Edit my crops" })).toBeTruthy();
  });

  test("switching rotation changes the focused card", () => {
    render(<ComparisonResults field={field} model={model} />);
    const group = screen.getByRole("group", { name: /choose a rotation/i });
    const buttons = within(group).getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("What you grow now compared")).toBeTruthy();
  });
});
afterEach(cleanup);
