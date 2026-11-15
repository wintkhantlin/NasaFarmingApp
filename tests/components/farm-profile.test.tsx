/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { FarmProfile } from "@/components/field/farm-profile";
import { useFieldsStore } from "@/lib/store/fields-store";
import { resetFormDrafts } from "@/lib/store/form-drafts";
import type { Field } from "@/lib/types";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const mockField: Field = {
  id: "88d66ad1-2324-4f18-b8d3-2ae4e4d86b18",
  name: "My Test Field",
  geometry: { type: "Point", coordinates: [94.95, 20.15] },
  areaHa: 2.5,
  centroid: [94.95, 20.15],
  samplePoints: [[94.95, 20.15]],
  irrigation: "none",
  soilOverride: { ph: 6.0, texture: "loam", salinityDsM: 1.2 },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("FarmProfile - Soil around your field", () => {
  beforeEach(() => {
    // Stub fetch for soil endpoint
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        soil: {
          ph: 6.8,
          texture: "sandy loam",
          clayPct: 20,
          sandPct: 60,
          siltPct: 20,
          socGKg: 10,
          cecCmolKg: null,
          bulkDensityKgDm3: null,
          nitrogenGKg: null,
          fieldCapacityFrac: 0.25,
          wiltingPointFrac: 0.12,
          source: { dataset: "ISRIC SoilGrids v2", resolution: "250 m", depth: "0-30cm" },
        },
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    resetFormDrafts();
  });

  it("renders editable inputs for Soil acidity, texture, and salinity in Soil around your field", () => {
    useFieldsStore.setState({
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [] },
      load: vi.fn(),
      loadRotations: vi.fn(),
    });

    render(<FarmProfile fieldId={mockField.id} />);

    // Check heading
    expect(screen.getByText("Soil around your field")).toBeInTheDocument();

    // Check pH input
    const phInput = screen.getByLabelText("Soil acidity (pH)");
    expect(phInput).toBeInTheDocument();
    expect(phInput).toHaveValue(6);

    // Check Texture select
    const textureSelect = screen.getByLabelText("Soil texture");
    expect(textureSelect).toBeInTheDocument();
    expect(textureSelect).toHaveTextContent("Loam");

    // Check Salinity input
    const salinityInput = screen.getByLabelText("Soil salinity (dS/m)");
    expect(salinityInput).toBeInTheDocument();
    expect(salinityInput).toHaveValue(1.2);
  });

  it("allows user to edit soil fields and saves the updated soilOverride", async () => {
    const updateSpy = vi.fn().mockResolvedValue(mockField);
    useFieldsStore.setState({
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [] },
      load: vi.fn(),
      loadRotations: vi.fn(),
      update: updateSpy,
    });

    render(<FarmProfile fieldId={mockField.id} />);

    // Edit pH
    const phInput = screen.getByLabelText("Soil acidity (pH)");
    fireEvent.change(phInput, { target: { value: "6.5" } });
    expect(phInput).toHaveValue(6.5);

    // Edit Salinity
    const salinityInput = screen.getByLabelText("Soil salinity (dS/m)");
    fireEvent.change(salinityInput, { target: { value: "2.0" } });
    expect(salinityInput).toHaveValue(2.0);

    // Click Save
    const saveButton = screen.getByRole("button", { name: "Save and see my answer" });
    fireEvent.click(saveButton);

    expect(updateSpy).toHaveBeenCalledWith(
      mockField.id,
      expect.objectContaining({
        soilOverride: expect.objectContaining({
          ph: 6.5,
          texture: "loam",
          salinityDsM: 2.0,
        }),
      }),
    );
  });

  it("validates that pH must be between 3 and 10", async () => {
    const updateSpy = vi.fn().mockResolvedValue(mockField);
    useFieldsStore.setState({
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [] },
      load: vi.fn(),
      loadRotations: vi.fn(),
      update: updateSpy,
    });

    render(<FarmProfile fieldId={mockField.id} />);

    // Enter out-of-range pH
    const phInput = screen.getByLabelText("Soil acidity (pH)");
    fireEvent.change(phInput, { target: { value: "14" } });

    // Click Save
    const saveButton = screen.getByRole("button", { name: "Save and see my answer" });
    fireEvent.click(saveButton);

    expect(updateSpy).not.toHaveBeenCalled();
    expect(screen.getByText("Soil pH must be between 3 and 10.")).toBeInTheDocument();
  });

  it("clearing fields removes them from soilOverride", async () => {
    const updateSpy = vi.fn().mockResolvedValue(mockField);
    useFieldsStore.setState({
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [] },
      load: vi.fn(),
      loadRotations: vi.fn(),
      update: updateSpy,
    });

    render(<FarmProfile fieldId={mockField.id} />);

    // Clear pH and Salinity
    const phInput = screen.getByLabelText("Soil acidity (pH)");
    fireEvent.change(phInput, { target: { value: "" } });

    const salinityInput = screen.getByLabelText("Soil salinity (dS/m)");
    fireEvent.change(salinityInput, { target: { value: "" } });

    // Save
    const saveButton = screen.getByRole("button", { name: "Save and see my answer" });
    fireEvent.click(saveButton);

    expect(updateSpy).toHaveBeenCalledWith(
      mockField.id,
      expect.objectContaining({
        soilOverride: {
          ph: undefined,
          texture: "loam",
          salinityDsM: undefined,
        },
      }),
    );
  });

  it("shows one soil line first and opens the fields on tap; map values are not saved as the farmer's own", async () => {
    const bare: Field = { ...mockField, soilOverride: undefined };
    const updateSpy = vi.fn().mockResolvedValue(bare);
    useFieldsStore.setState({
      status: "ready",
      fields: [bare],
      rotations: { [bare.id]: [] },
      load: vi.fn(),
      loadRotations: vi.fn(),
      update: updateSpy,
    });

    render(<FarmProfile fieldId={bare.id} />);

    // Folded by default: one line, no pH box yet.
    await waitFor(() => expect(screen.getByText("Soil: map estimate (sandy loam, pH 6.8)")).toBeInTheDocument());
    expect(screen.queryByLabelText("Soil acidity (pH)")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Use my own test" }));
    expect(screen.getByLabelText("Soil acidity (pH)")).toHaveValue(6.8);
    expect(screen.getByLabelText("Soil texture")).toHaveTextContent("Sandy loam");
    expect(screen.getAllByText("We guessed")).toHaveLength(2);

    // The save bar is hidden until something changes.
    expect(screen.queryByRole("button", { name: "Save and see my answer" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Soil salinity (dS/m)"), { target: { value: "1.1" } });
    fireEvent.change(screen.getByLabelText("Soil salinity (dS/m)"), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Save and see my answer" }));
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy.mock.calls[0][1].soilOverride).toBeUndefined();
  });

  it("starts with the soil fields open when the farmer already gave their own values", () => {
    useFieldsStore.setState({ status: "ready", fields: [mockField], rotations: { [mockField.id]: [] }, load: vi.fn(), loadRotations: vi.fn() });
    render(<FarmProfile fieldId={mockField.id} />);
    expect(screen.getByText("Soil: your own values (loam, pH 6, 1.2 dS/m)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide my soil test" })).toBeInTheDocument();
  });
});
