/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Field } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (selector: (state: { fields: Field[]; add: typeof mocks.add; update: typeof mocks.update }) => unknown) =>
    selector({ fields: [], add: mocks.add, update: mocks.update }),
}));

import { LocationPicker } from "@/components/field/location-picker";
import { useLocaleStore } from "@/lib/store/locale-store";

const field: Field = {
  id: "field-1",
  name: "Dagon field",
  geometry: { type: "Polygon", coordinates: [[[96.24, 16.75], [96.25, 16.75], [96.25, 16.76], [96.24, 16.76], [96.24, 16.75]]] },
  areaHa: 1.1,
  centroid: [96.245, 16.755],
  samplePoints: [[96.245, 16.755]],
  irrigation: "none",
  locationConfirmed: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("LocationPicker farmer inputs", () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal("ResizeObserver", class {
      constructor(_callback: ResizeObserverCallback) {}
      observe() {}
      disconnect() {}
    });
    mocks.add.mockReset();
    mocks.update.mockReset().mockResolvedValue(field);
    mocks.push.mockReset();
    useLocaleStore.setState({ locale: "en", areaUnit: "ha" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("requires water and field confirmation instead of treating legacy rain-only as an answer", async () => {
    render(<LocationPicker field={field} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm boundary" }));

    expect(screen.getByRole("button", { name: /Rain only/ })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose the water available");

    fireEvent.click(screen.getByRole("button", { name: /Irrigation available/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm that the marked place");
    expect(mocks.update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("This shape is my field"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith(
      field.id,
      expect.objectContaining({
        irrigation: "full",
        constraints: { irrigation: { access: "full" } },
        locationConfirmed: true,
      }),
    );
  });

  it("shows a visible error instead of silently assigning a field name", () => {
    render(<LocationPicker field={{ ...field, name: " " }} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm boundary" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name for this field");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("shows the area in the chosen unit only, and has no Clear button", () => {
    useLocaleStore.setState({ areaUnit: "acre" });
    render(<LocationPicker field={field} />);
    expect(screen.getByText(/acres/)).toBeInTheDocument();
    expect(screen.queryByText(/\bha\b/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Clear/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Redraw/ })).toBeInTheDocument();
  });

  it("shows Burmese only when the language is Burmese, with no developer or English text", () => {
    useLocaleStore.setState({ locale: "my" });
    render(<LocationPicker field={field} />);
    fireEvent.click(screen.getByRole("button", { name: "နယ်နိမိတ် အတည်ပြုရန်" }));
    expect(screen.getByRole("button", { name: "မိုးရေသာ" })).toBeInTheDocument();
    expect(screen.getByLabelText("ဤနယ်နိမိတ်သည် ကျွန်ုပ်၏လယ်ဖြစ်သည်")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ပြောင်းလဲမှု သိမ်းရန်" }));
    expect(screen.getByRole("alert")).toHaveTextContent("ရေရရှိမှုကို ရွေးပါ");
    expect(document.body.textContent).not.toMatch(/NEXT_PUBLIC|env\.local|Rain only/);
  });

  it("shows a plain retry message instead of developer setup text when the map is unavailable", () => {
    render(<LocationPicker />);
    expect(screen.getByText("The map isn't loading. Check your internet and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NEXT_PUBLIC|env\.local/);
    // Corner entry is the only way in without a map, so it is open here.
    expect(screen.getByLabelText("South latitude")).toBeInTheDocument();
  });

  it("retries township boundary loading after a temporary request failure", async () => {
    const boundaries = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { ST: "Example region", ST_PCODE: "ST1", DT: "Example district", DT_PCODE: "DT1", TS: "Example township", TS_PCODE: "TS1", TS_MMR: "" },
        geometry: { type: "Polygon", coordinates: [[[95, 20], [96, 20], [96, 21], [95, 21], [95, 20]]] },
      }],
    };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ ok: true, json: async () => boundaries });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<LocationPicker field={field} />);

    const townshipPicker = screen.getByText("Browse by township").closest("details");
    expect(townshipPicker).not.toBeNull();
    await within(townshipPicker!).findByText(/Township boundaries are unavailable/);
    fireEvent.click(within(townshipPicker!).getByRole("button", { name: "Retry township boundaries" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText("Region or state")).toBeInTheDocument();
  });
});
