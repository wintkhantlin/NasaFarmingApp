/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReportView } from "@/components/field/report-view";
import { redactCoordinates } from "@/components/field/report-view";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const state = vi.hoisted(() => ({ field: {} as object, rotations: [] as object[], engine: null as object | null }));
vi.mock("@/lib/analysis/use-analysis", () => ({
  useFieldAnalysis: () => ({ phase: "ready", engineData: state.engine, conditions: null, retrieving: false, showingCache: false, retry: vi.fn() }),
}));
vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (select: (s: object) => unknown) => select({ status: "ready", fields: [state.field], load: vi.fn(), loadRotations: vi.fn() }),
  useFieldRotations: () => state.rotations,
}));

function setup() {
  const field = syntheticField({
    locationConfirmed: true,
    localNotes: "Water: the well is at 20.1523, 94.9511 near the canal",
  });
  state.field = field;
  state.rotations = [{ ...rotation(field.id, [slot("s1", "sesame", "2026-05-15", "2026-08-15")]), source: "farmer" }];
  state.engine = engineData(field, syntheticWeather());
  return field;
}

afterEach(cleanup);

describe("ReportView print and location", () => {
  it("has one print action (the bottom bar) and a Back to compare link in the header", () => {
    setup();
    render(<ReportView fieldId="f1" />);
    expect(screen.getAllByRole("button", { name: /Print/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Print or save as PDF" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to compare" })).toBeInTheDocument();
  });

  it("shows coordinates by default and replaces them with the region when 'Hide exact location' is ticked", () => {
    const field = setup();
    const { container } = render(<ReportView fieldId="f1" />);
    const box = screen.getByRole("checkbox", { name: /Hide exact location/ });
    expect(box).not.toBeChecked();
    expect(container.textContent).toMatch(/° N, \d+\.\d+° E/);
    expect(container.textContent).toContain("20.1523, 94.9511");

    fireEvent.click(box);
    expect(box).toBeChecked();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/° N, \d+\.\d+° E/);
    expect(text).not.toContain("20.1523");
    expect(text).not.toContain(field.centroid[1].toFixed(3));
    expect(text).toContain("Hidden. Region only");
    expect(text).toContain("[location hidden]");
  });
});

describe("redactCoordinates", () => {
  it("replaces decimal coordinate pairs and leaves other numbers alone", () => {
    expect(redactCoordinates("at 21.9162, 95.9560 and pH 6.5")).toBe("at [location hidden] and pH 6.5");
    expect(redactCoordinates("21.916° N, 95.956° E")).toBe("[location hidden]");
  });
});
