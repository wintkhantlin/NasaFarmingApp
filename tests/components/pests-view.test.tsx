/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within, fireEvent } from "@testing-library/react";
import { PestsContent, PestsView } from "@/components/field/pests-view";
import { pestOutlook } from "@/lib/engine/pest-outlook";
import { toDailyRecords } from "@/lib/engine/climate";
import { rotation, slot, syntheticWeather } from "../helpers/synthetic";
import { useFieldsStore } from "@/lib/store/fields-store";
import { useLocaleStore } from "@/lib/store/locale-store";

afterEach(cleanup);

describe("PestsContent", () => {
  it("leads with what to watch and shows carry-over with its evidence", () => {
    const r = rotation("f", [slot("s", "sesame", "2026-05-15", "2026-08-23"), slot("g", "green-gram", "2026-08-30", "2026-11-13")]);
    const outlook = pestOutlook({ rotation: r, records: [], years: { start: 2016, end: 2025 } });
    const { container } = render(<PestsContent outlook={outlook} fieldId="f" />);
    const view = within(container);
    expect(view.getByRole("heading", { name: /^Main thing to watch:/ })).toBeTruthy();
    expect(view.getByRole("heading", { name: "Carries over between your crops" })).toBeTruthy();
    expect(view.getAllByText(/Macrophomina phaseolina/).length).toBeGreaterThan(0);
    expect(view.getAllByText(/Lives in the soil/).length).toBeGreaterThan(0);
    expect(view.getByText(/^We could not get past weather for this field/)).toBeTruthy();
    expect(view.getAllByText("Based on:").length).toBeGreaterThan(0);
  });

  it("says nothing stands out when no soil disease carries over and weather is missing", () => {
    const r = rotation("f", [slot("r", "rice", "2026-06-15", "2026-10-20"), slot("s", "sunn-hemp", "2027-01-10", "2027-03-20")]);
    const outlook = pestOutlook({ rotation: r, records: [], years: { start: 2016, end: 2025 } });
    const { container } = render(<PestsContent outlook={outlook} fieldId="f" />);
    expect(within(container).getByRole("heading", { name: "Nothing stands out" })).toBeTruthy();
  });

  it("renders retry button and calls onRetry when clicked", () => {
    const onRetry = vi.fn();
    const r = rotation("f", [slot("s", "sesame", "2026-05-15", "2026-08-23")]);
    const outlook = pestOutlook({ rotation: r, records: [], years: { start: 2016, end: 2025 } });
    const { container } = render(<PestsContent outlook={outlook} fieldId="f" onRetry={onRetry} />);
    const button = within(container).getByRole("button", { name: "Try again" });
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders weather by crop when weather records are available", () => {
    const r = rotation("f", [slot("r", "rice", "2026-06-15", "2026-10-20")]);
    const weather = syntheticWeather({ startYear: 2016, endYear: 2025 });
    const outlook = pestOutlook({ rotation: r, records: toDailyRecords(weather), years: { start: 2016, end: 2025 } });
    const { container } = render(<PestsContent outlook={outlook} fieldId="f" />);
    const view = within(container);
    expect(view.getByRole("heading", { name: "Weather risk, crop by crop" })).toBeTruthy();
  });

  it("renders bilingual Myanmar copy when locale is 'my'", () => {
    useLocaleStore.setState({ locale: "my" });
    const r = rotation("f", [slot("s", "sesame", "2026-05-15", "2026-08-23"), slot("g", "green-gram", "2026-08-30", "2026-11-13")]);
    const outlook = pestOutlook({ rotation: r, records: [], years: { start: 2016, end: 2025 } });
    const { container } = render(<PestsContent outlook={outlook} fieldId="f" />);
    const view = within(container);
    expect(view.getByRole("heading", { name: /^အဓိက စောင့်ကြည့်ရန်:/ })).toBeTruthy();
    expect(view.getByRole("heading", { name: "သီးနှံများကြား ကူးစက်နိုင်သည်" })).toBeTruthy();
    useLocaleStore.setState({ locale: "en" });
  });
});

describe("PestsView", () => {
  it("renders empty state when field is not found", () => {
    useFieldsStore.setState({ status: "ready", fields: [], rotations: {}, load: vi.fn(), loadRotations: vi.fn() });
    const { container } = render(<PestsView fieldId="missing-field" />);
    expect(within(container).getByText("Field not found")).toBeTruthy();
    expect(within(container).getByRole("link", { name: "Back to your fields" })).toBeTruthy();
  });

  it("renders empty state when field has no crops", () => {
    const f = {
      id: "f-empty",
      name: "Empty field",
      areaHa: 1,
      centroid: [95.9, 20.1] as [number, number],
      geometry: { type: "Point" as const, coordinates: [95.9, 20.1] as [number, number] },
      samplePoints: [[95.9, 20.1] as [number, number]],
      irrigation: "none" as const,
      region: "magway" as const,
      locationConfirmed: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    useFieldsStore.setState({
      status: "ready",
      fields: [f],
      rotations: { "f-empty": [] },
      load: vi.fn(),
      loadRotations: vi.fn(),
    });
    const { container } = render(<PestsView fieldId="f-empty" />);
    expect(within(container).getByText("Add your crops first")).toBeTruthy();
    expect(within(container).getByRole("link", { name: "Add crops" })).toBeTruthy();
  });
});
