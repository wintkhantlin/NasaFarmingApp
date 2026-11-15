/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { FarmProfile } from "@/components/field/farm-profile";
import { useFieldsStore } from "@/lib/store/fields-store";
import { resetFormDrafts } from "@/lib/store/form-drafts";
import type { Field } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const blank: Field = {
  id: "0b3f4a1e-5b8e-4a77-8f0c-2d1b9c7e6a11",
  name: "New plot",
  geometry: { type: "Point", coordinates: [95.2, 20.1] },
  areaHa: 1,
  centroid: [95.2, 20.1],
  samplePoints: [[95.2, 20.1]],
  irrigation: "none",
  region: "magway",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function setStore(field: Field, update = vi.fn().mockResolvedValue(field)) {
  useFieldsStore.setState({ status: "ready", fields: [field], rotations: { [field.id]: [] }, load: vi.fn(), loadRotations: vi.fn(), update });
  return update;
}
const tile = (name: RegExp | string) => screen.getByRole("button", { name });

describe("FarmProfile prefill", () => {
  beforeEach(() => {
    push.mockClear();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    resetFormDrafts();
  });

  it("fills a blank dry-zone field with water then income, Medium labour and Fair market, each marked Suggested", () => {
    setStore(blank);
    render(<FarmProfile fieldId={blank.id} />);
    expect(screen.getByText("We filled this in for your area.")).toBeInTheDocument();
    expect(screen.getByText("Change only what is different.")).toBeInTheDocument();
    expect(screen.getAllByText("Suggested for Magway")).toHaveLength(4);
    expect(screen.queryByText("Your answer")).toBeNull();
    expect(screen.queryByText("How we mark answers")).toBeNull();

    expect(tile(/Save water.*Priority 1/)).toHaveAttribute("aria-pressed", "true");
    expect(tile(/Earn more.*Priority 2/)).toHaveAttribute("aria-pressed", "true");
    expect(tile(/Improve soil/)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("radio", { name: "Rain only" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Fair" })).toHaveAttribute("aria-checked", "true");
  });

  it("suggests earn more then improve soil in the delta", () => {
    setStore({ ...blank, region: "ayeyarwady" });
    render(<FarmProfile fieldId={blank.id} />);
    expect(tile(/Earn more.*Priority 1/)).toHaveAttribute("aria-pressed", "true");
    expect(tile(/Improve soil.*Priority 2/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Suggested for Ayeyarwady")).toHaveLength(4);
  });

  it("saves the suggested values when nothing was touched, so one tap gives a complete profile", async () => {
    const update = setStore(blank);
    render(<FarmProfile fieldId={blank.id} />);
    fireEvent.click(screen.getByRole("button", { name: /See my answer/ }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    const patch = update.mock.calls[0][1];
    expect(patch.priorities.order).toEqual(["water", "income"]);
    expect(patch.constraints.labour).toBe("medium");
    expect(patch.constraints.marketAccess).toBe("fair");
    expect(patch.irrigation).toBe("none");
    // Regional prices are not copied in as the farmer's own numbers.
    expect(patch.economics).toEqual([]);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/fields/${blank.id}/compare`));
  });

  it("ranks tiles in tap order, removes on a second tap, and keeps the saved shape", async () => {
    const update = setStore(blank);
    render(<FarmProfile fieldId={blank.id} />);
    fireEvent.click(tile(/Save water.*Priority 1/));
    fireEvent.click(tile(/Earn more.*Priority 1/)); // after the first removal Earn more moved up to place 1
    expect(screen.queryAllByText(/^Priority [0-9]/)).toHaveLength(0);
    fireEvent.click(tile(/Improve soil/));
    fireEvent.click(tile(/Earn more/));
    expect(tile(/Improve soil.*Priority 1/)).toHaveAttribute("aria-pressed", "true");
    expect(tile(/Earn more.*Priority 2/)).toHaveAttribute("aria-pressed", "true");
    // A screen reader hears the order after each tap.
    expect(screen.getByText(/Improve soil counts most, then earn more\./)).toBeInTheDocument();
    // Changing it makes that one answer the farmer's own.
    expect(screen.getAllByText("Your answer")).toHaveLength(1);
    expect(screen.getAllByText("Suggested for Magway")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: /See my answer/ }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1].priorities).toEqual({ order: ["soil", "income"], weights: {}, soil: undefined, income: undefined });
  });

  it("keeps the long explainer and fine-tune options behind named disclosures", () => {
    setStore(blank);
    render(<FarmProfile fieldId={blank.id} />);
    expect(screen.getByText("How this is used").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Fine-tune").closest("details")).not.toHaveAttribute("open");
    expect(screen.queryByText("Your order")).toBeNull();
  });

  it("shows a saved profile as the farmer's own, with no 'we filled this in' note and no regional overwrite", () => {
    setStore({
      ...blank,
      irrigation: "supplemental",
      priorities: { order: ["soil"], weights: {} },
      constraints: { irrigation: { access: "supplemental" }, labour: "low", marketAccess: "good" },
    });
    render(<FarmProfile fieldId={blank.id} />);
    expect(screen.queryByText("We filled this in for your area.")).toBeNull();
    expect(screen.queryByText(/^Suggested for Magway$/)).toBeNull();
    expect(screen.getAllByText("Your answer")).toHaveLength(4);
    expect(tile(/Improve soil.*Priority 1/)).toHaveAttribute("aria-pressed", "true");
    expect(tile(/Earn more/)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("radio", { name: "Low" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Good" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Some irrigation" })).toHaveAttribute("aria-checked", "true");
  });

  it("does not block on the soil map: a loading line shows and the answer button is ready", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    setStore(blank);
    render(<FarmProfile fieldId={blank.id} />);
    expect(screen.getByText("Soil: reading the map for your field…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /See my answer/ })).toBeEnabled();
  });
});
