/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FieldsList } from "@/components/field/fields-list";
import { useLocaleStore } from "@/lib/store/locale-store";
import { useFieldsStore } from "@/lib/store/fields-store";
import type { Field, Rotation } from "@/lib/types";

const field: Field = {
  id: "88d66ad1-2324-4f18-b8d3-2ae4e4d86b18",
  name: "Delta Field",
  areaHa: 2.4,
  centroid: [96.1735, 16.8402],
  geometry: {
    type: "Polygon",
    coordinates: [[[96.17, 16.84], [96.18, 16.84], [96.18, 16.85], [96.17, 16.85], [96.17, 16.84]]],
  },
  samplePoints: [[96.1735, 16.8402]],
  irrigation: "supplemental",
  region: "ayeyarwady",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const rotation: Rotation = {
  id: "rot-1",
  fieldId: field.id,
  label: "Rice then Bean",
  cycleYears: 1,
  source: "farmer",
  slots: [
    { id: "s1", kind: "crop", cropId: "rice", plantDate: "2026-06-15", harvestDate: "2026-10-15", dateConfidence: "exact", irrigated: false },
    { id: "s2", kind: "crop", cropId: "black-gram", plantDate: "2026-11-01", harvestDate: "2027-02-28", dateConfidence: "approx", irrigated: false },
  ],
};

function manyFields(n: number): Field[] {
  return Array.from({ length: n }, (_, i) => ({ ...field, id: `00000000-0000-4000-8000-00000000000${i}`, name: `Field ${i + 1}` }));
}

describe("FieldsList", () => {
  beforeEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "en", areaUnit: "ha", hydrated: true });
    useFieldsStore.setState({ status: "ready", fields: [], rotations: {}, error: null });
  });

  it("shows one start with one Add a field button and no backup controls when there are no fields", () => {
    render(<FieldsList />);

    expect(screen.getByRole("heading", { level: 1, name: "Draw your first field" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Add a field" })).toHaveLength(1);
    expect(screen.getByText("Mark your field on the map")).toBeVisible();
    expect(screen.queryByRole("button", { name: /backup/i })).toBeNull();
    expect(screen.queryByText(/Keep a copy/)).toBeNull();
  });

  it("shows the Burmese first-run steps and button", () => {
    useLocaleStore.setState({ locale: "my", areaUnit: "ha", hydrated: true });
    render(<FieldsList />);

    expect(screen.getByRole("link", { name: "စိုက်ခင်း မှတ်မည်" })).toBeVisible();
    expect(screen.getByText("စိုက်ခင်းကို မြေပုံပေါ်တွင် မှတ်ပါ")).toBeVisible();
    expect(screen.getByText("ယခုစိုက်သော သီးနှံ ထည့်ပါ")).toBeVisible();
    expect(screen.getByText("အဖြေ ကြည့်ပါ")).toBeVisible();
  });

  it("keeps backup out of the list; only a small link to settings remains", () => {
    useFieldsStore.setState({ fields: [field] });
    render(<FieldsList />);

    expect(screen.queryByRole("button", { name: /backup/i })).toBeNull();
    expect(screen.queryByText(/Resume a saved field/)).toBeNull();
    expect(screen.getByRole("link", { name: "Backup and settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getAllByRole("link", { name: "Add a field" })).toHaveLength(1);
  });

  it("shows one summary line per card in the chosen unit, without a status chip", () => {
    useFieldsStore.setState({ fields: [field], rotations: { [field.id]: [rotation] } });
    const { rerender } = render(<FieldsList />);

    expect(screen.getByText("2.4 ha · Rice → Black gram")).toBeVisible();
    expect(screen.queryByText("Rotation recorded")).toBeNull();
    expect(screen.queryByText("Needs your input")).toBeNull();
    expect(screen.getByRole("link", { name: /See my answer/ })).toBeVisible();

    useLocaleStore.setState({ areaUnit: "acre" });
    rerender(<FieldsList />);
    expect(screen.getByText("5.9 acres · Rice → Black gram")).toBeVisible();
  });

  it("tells the farmer what to do next when no crops are recorded", () => {
    useFieldsStore.setState({ fields: [field] });
    render(<FieldsList />);

    expect(screen.getByText("2.4 ha")).toBeVisible();
    expect(screen.getByRole("link", { name: /Add crops/ })).toBeVisible();
  });

  it("shows search only from six fields", () => {
    useFieldsStore.setState({ fields: manyFields(5) });
    const { unmount } = render(<FieldsList />);
    expect(screen.queryByRole("searchbox", { name: "Search fields" })).toBeNull();
    unmount();

    useFieldsStore.setState({ fields: manyFields(6) });
    render(<FieldsList />);
    expect(screen.getByRole("searchbox", { name: "Search fields" })).toBeVisible();
  });
});
