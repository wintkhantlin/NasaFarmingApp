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

vi.mock("../../components/field/season-strip", () => ({ SeasonStrip: () => <div>season strip</div>, SeasonStripMini: ({ strip }: { strip: unknown[] }) => <div data-testid="mini-strip">{strip.length} seasons</div> }));

const field = syntheticField({ priorities: { order: ["water", "soil"], weights: {} } });
const mine = rotation(field.id, [slot("sesame", "sesame", "2026-05-15", "2026-08-23"), slot("gram", "green-gram", "2026-08-30", "2026-11-13")]);
const data = engineData(field, syntheticWeather());
const result = compareRotations(data, mine, { baseYear: 2026, now: new Date("2026-11-14T00:00:00Z") });
const display = adaptComparison({ mode: "field", phase: "ready", field, rotation: mine, data, comparison: result, inputRevision: "r", resultRevision: "r" });
const options = [result.current, ...display.options.filter((o) => o.kind === "alternative").map((o) => o.engine)];
const model = buildResultsModel({ field, comparison: result, display, options });

describe("ComparisonResults", () => {
  test("shows the decision and keeps detailed evidence available", () => {
    render(<ComparisonResults field={field} model={model} />);
    expect(screen.getByRole("heading", { name: model.decision?.headline ?? /best match/i })).toBeTruthy();
    for (const name of ["Rotation comparison", "Water and climate", "Soil and environment", "Money", "Why this rotation?", "What we still do not know"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.getByText(/does not forecast next season/i)).toBeTruthy();
  });

  test("the status box appears only when the evidence is not complete, so it never repeats the answer", () => {
    const { unmount } = render(<ComparisonResults field={field} model={{ ...model, status: "complete" }} />);
    expect(screen.queryByRole("status")).toBeNull();
    unmount();
    render(<ComparisonResults field={field} model={{ ...model, status: "partial", statusTitle: "Partial evidence", statusDetail: "Some information is missing." }} />);
    expect(screen.getByText("Partial evidence")).toBeTruthy();
  });

  test("the main comparison table keeps four key measures; the rest live in the adviser table", () => {
    render(<ComparisonResults field={field} model={model} />);
    const table = screen.getByRole("table", { name: /rotation comparison by dimension/i });
    const rowHeaders = [...table.querySelectorAll("tbody th")].map((th) => th.textContent ?? "");
    for (const label of ["Crop suitability", "Water requirements", "Climate exposure", "Economic performance"]) {
      expect(rowHeaders.some((t) => t.includes(label))).toBe(true);
    }
    expect(rowHeaders.some((t) => t.includes("Erosion exposure"))).toBe(false);
  });

  test("keeps one priorities control and one Based on line in the overview", () => {
    render(<ComparisonResults field={field} model={model} />);
    expect(screen.getByRole("button", { name: "Change priorities" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Edit my crops|Edit field location|Edit my priorities/ })).toBeNull();
    expect(screen.getByText("Counting:").parentElement?.textContent).toMatch(/Save water > Improve soil/);
    expect(screen.queryByRole("navigation", { name: "Results sections" })).toBeNull();
  });

  test("only the overview and comparison are open; the rest sits in one closed See why group", () => {
    const { container } = render(<ComparisonResults field={field} model={model} />);
    const group = container.querySelector("details#see-why") as HTMLDetailsElement;
    expect(group).toBeTruthy();
    expect(group.open).toBe(false);
    expect(group.querySelector("summary")?.textContent).toMatch(/Detailed comparison, methods and limits/);
    for (const id of ["water-climate", "soil", "money", "why", "unknowns"]) expect(group.querySelector(`#${id}`)).toBeTruthy();
    for (const id of ["overview", "compare"]) {
      const el = container.querySelector(`#${id}`);
      expect(el).toBeTruthy();
      expect(group.contains(el)).toBe(false);
    }
  });

  test("a link to a section inside See why opens the group", () => {
    const { container } = render(<ComparisonResults field={field} model={model} />);
    const group = container.querySelector("details#see-why") as HTMLDetailsElement;
    window.location.hash = "#money";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(group.open).toBe(true);
    window.location.hash = "";
  });

  test("switching rotation changes the focused card", () => {
    render(<ComparisonResults field={field} model={model} />);
    const group = screen.getByRole("group", { name: /choose a rotation/i });
    const buttons = within(group).getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("What you grow now compared")).toBeTruthy();
  });

  test("shows a season strip on every option card in the overview", () => {
    render(<ComparisonResults field={field} model={model} />);
    expect(screen.getAllByTestId("mini-strip")).toHaveLength(model.options.length);
  });

  test("keeps a short list of decision changing unknowns beside the verdict", () => {
    render(<ComparisonResults field={field} model={model} />);
    expect(screen.getByRole("heading", { name: "Still to check before changing crops" })).toBeTruthy();
    expect(screen.getByLabelText("Important unknowns to check").querySelectorAll("li").length).toBeGreaterThan(0);
  });

  test("a negative nitrogen balance reads as a deficit, not a benefit", () => {
    const deficitModel = {
      ...model,
      dimensions: model.dimensions.map((d) =>
        d.id === "nitrogen"
          ? { ...d, cells: Object.fromEntries(model.options.map((o) => [o.id, { text: "Takes about 80 kg N/ha more than it puts back.", tone: "deficit" as const, basis: "library" as const }])) }
          : d,
      ),
    };
    render(<ComparisonResults field={field} model={deficitModel} />);
    expect(screen.getAllByText("Deficit").length).toBeGreaterThan(0);
  });

  test("shows field-sized money only beside its source and keeps the current rotation as the baseline", () => {
    render(<ComparisonResults field={field} model={model} />);

    expect(screen.getAllByText("Estimated margin for this field, over the whole cycle")).toHaveLength(model.options.length);
    expect(screen.getAllByText(/acres \(/)).toHaveLength(model.options.length);
    expect(screen.getAllByText(/Compared with the crops you grow now/)).toHaveLength(model.options.length - 1);
    expect(screen.getAllByText(/cited crop benchmarks/).length).toBeGreaterThan(0);
  });
});
afterEach(cleanup);
