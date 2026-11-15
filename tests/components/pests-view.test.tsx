/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { PestsContent } from "@/components/field/pests-view";
import { pestOutlook } from "@/lib/engine/pest-outlook";
import { rotation, slot } from "../helpers/synthetic";

describe("PestsContent", () => {
  it("leads with what to watch and shows carry-over with its evidence", () => {
    const r = rotation("f", [slot("s", "sesame", "2026-05-15", "2026-08-23"), slot("g", "green-gram", "2026-08-30", "2026-11-13")]);
    const outlook = pestOutlook({ rotation: r, records: [], years: { start: 2016, end: 2025 } });
    const { container } = render(<PestsContent outlook={outlook} fieldId="f" />);
    const view = within(container);
    expect(view.getByRole("heading", { name: /^Watch for these/ })).toBeTruthy();
    expect(view.getByRole("heading", { name: "Can carry over from Sesame" })).toBeTruthy();
    expect(view.getAllByText(/Macrophomina phaseolina/).length).toBeGreaterThan(0);
    expect(view.getAllByText("Lives in the soil").length).toBeGreaterThan(0);
    expect(view.getAllByText(/^Weather for this field isn.t available yet/)).toHaveLength(2);
    expect(view.getAllByText("Based on:").length).toBeGreaterThan(0);
  });

  it("says nothing stands out when no soil disease carries over and weather is missing", () => {
    const r = rotation("f", [slot("r", "rice", "2026-06-15", "2026-10-20"), slot("s", "sunn-hemp", "2027-01-10", "2027-03-20")]);
    const outlook = pestOutlook({ rotation: r, records: [], years: { start: 2016, end: 2025 } });
    const { container } = render(<PestsContent outlook={outlook} fieldId="f" />);
    expect(within(container).getByRole("heading", { name: "Nothing stands out" })).toBeTruthy();
  });
});
