/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { FarmProfile } from "@/components/field/farm-profile";
import { useFieldsStore } from "@/lib/store/fields-store";
import { resetFormDrafts } from "@/lib/store/form-drafts";
import type { Field } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const field: Field = {
  id: "5b0a2f0e-0c1d-4c55-9d2a-1f3b7a8c9d10",
  name: "Paddy plot",
  geometry: { type: "Point", coordinates: [94.95, 20.15] },
  areaHa: 1,
  centroid: [94.95, 20.15],
  samplePoints: [[94.95, 20.15]],
  irrigation: "none",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function setStore(update = vi.fn().mockResolvedValue(field)) {
  useFieldsStore.setState({
    status: "ready",
    fields: [field],
    rotations: { [field.id]: [] },
    load: vi.fn(),
    loadRotations: vi.fn(),
    update,
  });
  return update;
}

describe("FarmProfile forms", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    resetFormDrafts();
  });

  it("keeps the pump and paddy settings folded away when nothing is filled in", () => {
    setStore();
    render(<FarmProfile fieldId={field.id} />);
    const summary = screen.getByText("Advanced water and paddy settings").closest("summary");
    expect(summary).not.toBeNull();
    expect(summary!.closest("details")).not.toHaveAttribute("open");
  });

  it("asks for the date, method and source of a soil measurement by name, and keeps the defaults blank", () => {
    const update = setStore();
    render(<FarmProfile fieldId={field.id} />);

    const addButton = screen.getByRole("button", { name: "Add measurement" });
    fireEvent.change(screen.getByLabelText(/Value/, { selector: "input" }), { target: { value: "6.2" } });
    fireEvent.click(addButton);
    expect(screen.getByText("Pick the date the soil was measured.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Date measured/),{ target: { value: "2026-03-01" } });
    fireEvent.click(addButton);
    expect(screen.getByText("Choose how it was measured: lab, field kit, map or your own estimate.")).toBeInTheDocument();

    expect(update).not.toHaveBeenCalled();
  });

  it("explains a day that does not exist in the chosen month", () => {
    setStore();
    render(<FarmProfile fieldId={field.id} />);
    const from = screen.getByText("From (month-day)").parentElement!;
    fireEvent.change(within(from).getByLabelText("Month"), { target: { value: "02" } });
    fireEvent.change(within(from).getByLabelText("Day"), { target: { value: "30" } });
    expect(screen.getByText("Feb has 29 days at most.")).toBeInTheDocument();
  });

  it("keeps typed answers when the form is left and opened again in the same session", () => {
    setStore();
    const first = render(<FarmProfile fieldId={field.id} />);
    fireEvent.change(screen.getByLabelText("Soil salinity (dS/m)"), { target: { value: "3.5" } });
    first.unmount();

    render(<FarmProfile fieldId={field.id} />);
    expect(screen.getByLabelText("Soil salinity (dS/m)")).toHaveValue(3.5);
  });
});
