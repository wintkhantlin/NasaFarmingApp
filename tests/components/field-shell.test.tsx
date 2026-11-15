/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FieldShell } from "@/components/field/field-shell";
import { useFieldsStore } from "@/lib/store/fields-store";
import { useCompareViewedStore } from "@/lib/store/compare-viewed";
import type { Field, Rotation } from "@/lib/types";

let currentPathname = "/fields/field-yangon";

vi.mock("next/navigation", () => ({
  useParams: () => ({ fieldId: "field-yangon" }),
  usePathname: () => currentPathname,
}));

const yangonField: Field = {
  id: "field-yangon",
  name: "Dagon Seikkan Field",
  areaHa: 6.88,
  centroid: [96.28, 16.85],
  geometry: {
    type: "Polygon",
    coordinates: [[[96.27, 16.84], [96.29, 16.84], [96.29, 16.86], [96.27, 16.86], [96.27, 16.84]]],
  },
  samplePoints: [[96.28, 16.85]],
  irrigation: "none",
  locationConfirmed: true,
  region: "yangon",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const ayeyarwadyField: Field = {
  ...yangonField,
  id: "field-yangon",
  region: "ayeyarwady",
};

const sampleRotation: Rotation = {
  id: "rot-1",
  fieldId: "field-yangon",
  label: "Rice - Black Gram",
  cycleYears: 1,
  source: "farmer",
  slots: [
    {
      id: "s1",
      kind: "crop",
      cropId: "rice",
      plantDate: "2026-06-01",
      harvestDate: "2026-10-25",
      dateConfidence: "typical",
      irrigated: false,
    },
  ],
};

describe("FieldShell tab status and navigation", () => {
  beforeEach(() => {
    cleanup();
    currentPathname = "/fields/field-yangon";
    useFieldsStore.setState({
      status: "ready",
      fields: [yangonField],
      rotations: { "field-yangon": [sampleRotation] },
      error: null,
    });
  });

  it("shows one five-destination field tab row, including Conditions", () => {
    render(<FieldShell><div>Content</div></FieldShell>);

    const nav = screen.getByRole("navigation", { name: "Pages for Dagon Seikkan Field" });
    expect([...nav.querySelectorAll("a")].map((link) => link.querySelector("span.inline-flex")?.textContent?.trim())).toEqual([
      "Overview", "Farm", "Crops", "Conditions", "Compare",
    ]);
    expect(screen.queryByRole("link", { name: "All fields" })).toBeNull();
  });

  it("does not mark Compare tab as complete when region has no crop catalog (Yangon)", () => {
    render(
      <FieldShell>
        <div>Content</div>
      </FieldShell>,
    );

    const compareLink = screen.getByRole("link", { name: /Compare/i });
    expect(compareLink).toHaveTextContent("regional comparisons not available");
    expect(compareLink).not.toHaveTextContent("complete");
  });

  it("does not mark Compare complete before a comparison has been shown", () => {
    useCompareViewedStore.setState({ viewed: {}, hydrated: true });
    useFieldsStore.setState({
      status: "ready",
      fields: [ayeyarwadyField],
      rotations: { "field-yangon": [sampleRotation] },
      error: null,
    });

    render(
      <FieldShell>
        <div>Content</div>
      </FieldShell>,
    );

    const compareLink = screen.getByRole("link", { name: /Compare/i });
    expect(compareLink).not.toHaveTextContent("complete");
    expect(compareLink).toHaveTextContent("not opened yet");
  });

  it("marks Compare tab as complete when region has a catalog, rotation is recorded and a comparison was shown", () => {
    useCompareViewedStore.setState({ viewed: { "field-yangon": true }, hydrated: true });
    useFieldsStore.setState({
      status: "ready",
      fields: [ayeyarwadyField],
      rotations: { "field-yangon": [sampleRotation] },
      error: null,
    });

    render(
      <FieldShell>
        <div>Content</div>
      </FieldShell>,
    );

    const compareLink = screen.getByRole("link", { name: /Compare/i });
    expect(compareLink).toHaveTextContent("complete");
  });

  it("links back to Field overview when viewing questions", () => {
    currentPathname = "/fields/field-yangon/questions/water-source";
    render(
      <FieldShell>
        <div>Content</div>
      </FieldShell>,
    );

    const backLink = screen.getByRole("link", { name: /Field overview/i });
    expect(backLink).toBeVisible();
    expect(backLink).toHaveAttribute("href", "/fields/field-yangon");
  });

  it("uses Compare as the report task's only back destination", () => {
    currentPathname = "/fields/field-yangon/report";
    render(
      <FieldShell>
        <div>Content</div>
      </FieldShell>,
    );
    expect(screen.getByRole("link", { name: /^Compare$/ })).toHaveAttribute("href", "/fields/field-yangon/compare");
    expect(screen.queryByRole("navigation", { name: /Pages for/ })).toBeNull();
  });

  it("keeps Conditions in the tab row and gives focused subtasks one contextual back link", () => {
    currentPathname = "/fields/field-yangon/conditions";
    const condition = render(<FieldShell><div>Content</div></FieldShell>);
    screen.getByRole("navigation", { name: "Pages for Dagon Seikkan Field" });
    expect(screen.getByRole("link", { name: /^Conditions$/ })).toHaveAttribute("href", "/fields/field-yangon/conditions");
    expect(screen.queryByRole("link", { name: /Field overview/i })).toBeNull();
    condition.unmount();

    for (const page of ["pests", "questions/water-source"]) {
      currentPathname = `/fields/field-yangon/${page}`;
      const { unmount } = render(
        <FieldShell>
          <div>Content</div>
        </FieldShell>,
      );
      const back = screen.getByRole("link", { name: /^Field overview$/ });
      expect(back, page).toHaveAttribute("href", "/fields/field-yangon");
      expect(screen.queryByRole("navigation", { name: /Pages for/ }), page).toBeNull();
      unmount();
    }
  });
});
