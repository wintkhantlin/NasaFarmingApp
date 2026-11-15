/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
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

  it("keeps 'More about my farm' closed until the farmer has answered something in it", () => {
    setStore();
    render(<FarmProfile fieldId={field.id} />);
    const more = screen.getByText("More about my farm").closest("details");
    expect(more).not.toBeNull();
    expect(more).not.toHaveAttribute("open");
    // The two everyday water and work questions stay outside it.
    expect(more!.contains(screen.getByText("Water for crops"))).toBe(false);
    expect(more!.contains(screen.getByText("Labour at busy times"))).toBe(false);
    expect(more!.contains(screen.getByText("Equipment"))).toBe(true);
    expect(more!.contains(screen.getByText("Market access"))).toBe(true);
    // The on-page nav is gone.
    expect(screen.queryByRole("navigation", { name: "On this page" })).toBeNull();
  });

  it("opens 'More about my farm' when a value in it is already set", () => {
    useFieldsStore.setState({
      status: "ready",
      fields: [{ ...field, constraints: { marketAccess: "good" } }],
      rotations: { [field.id]: [] },
      load: vi.fn(),
      loadRotations: vi.fn(),
    });
    render(<FarmProfile fieldId={field.id} />);
    expect(screen.getByText("More about my farm").closest("details")).toHaveAttribute("open");
  });

  it("hides pump, soil dryness and paddy figures until the farmer says they have a record", () => {
    setStore();
    render(<FarmProfile fieldId={field.id} />);
    expect(screen.queryByLabelText(/Pump output/)).toBeNull();
    expect(screen.queryByLabelText(/Soil dryness at planting/)).toBeNull();
    expect(screen.queryByLabelText(/Paddy bund height/)).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "I have a pump record" }));
    expect(screen.getByLabelText(/Soil dryness at planting/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "I know my paddy bund and seepage" }));
    expect(screen.getByLabelText(/Paddy bund height/)).toBeInTheDocument();
  });

  it("only needs the value to add a soil measurement; date, method and source have defaults", () => {
    const update = setStore();
    render(<FarmProfile fieldId={field.id} />);

    fireEvent.click(screen.getByRole("button", { name: "Use my own test" }));
    const addButton = screen.getByRole("button", { name: "Add measurement" });
    fireEvent.click(addButton);
    expect(screen.getByText("Enter the ph you measured.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Value/, { selector: "input" }), { target: { value: "6.2" } });
    fireEvent.click(addButton);
    expect(screen.queryByRole("alert")).toBeNull();
    const row = screen.getByRole("button", { name: "Remove" }).closest("li")!;
    expect(row.textContent).toContain("My own estimate");
    expect(row.textContent).toContain("My own test");
    expect(update).not.toHaveBeenCalled();
  });

  it("offers Undo after removing a soil measurement", () => {
    setStore();
    render(<FarmProfile fieldId={field.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Use my own test" }));
    fireEvent.change(screen.getByLabelText(/Value/, { selector: "input" }), { target: { value: "6.2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add measurement" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Removed pH.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("shows the save bar only after a change, and Save and stay keeps the farmer here with a saved note", async () => {
    const update = setStore();
    render(<FarmProfile fieldId={field.id} />);
    expect(screen.queryByRole("button", { name: "Save and stay" })).toBeNull();
    expect(screen.getByRole("link", { name: /See my answer/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Low" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and stay" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(await screen.findByText("Saved on this phone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save and stay" })).toBeNull();
  });

  it("names the limits toggle 'Add this limit' and shows its fields only when it is on", () => {
    setStore();
    render(<FarmProfile fieldId={field.id} />);
    expect(screen.getByText("Limits (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pick crops")).toBeNull();
    fireEvent.click(screen.getAllByRole("switch", { name: "Add this limit" })[0]);
    expect(screen.getByLabelText("Pick crops")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Use my own test" }));
    fireEvent.change(screen.getByLabelText("Soil salinity (dS/m)"), { target: { value: "3.5" } });
    first.unmount();

    render(<FarmProfile fieldId={field.id} />);
    expect(screen.getByLabelText("Soil salinity (dS/m)")).toHaveValue(3.5);
  });
});
