/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FieldOverview } from "@/components/field/field-overview";
import type { Field, Rotation } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt="" />,
}));

const mockField: Field = {
  id: "88d66ad1-2324-4f18-b8d3-2ae4e4d86b18",
  name: "North Stream Field",
  areaHa: 2.4,
  centroid: [96.1735, 16.8402],
  geometry: {
    type: "Polygon",
    coordinates: [[[96.173, 16.84], [96.174, 16.84], [96.174, 16.841], [96.173, 16.841], [96.173, 16.84]]],
  },
  samplePoints: [[96.1735, 16.8402]],
  irrigation: "supplemental",
  soilOverride: {
    texture: "sandy clay loam",
    ph: 6.5,
    ocPct: 1.2,
    testedOn: "2025-03-15",
  },
  region: "ayeyarwady",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const mockRotation: Rotation = {
  id: "rot-1",
  fieldId: "88d66ad1-2324-4f18-b8d3-2ae4e4d86b18",
  label: "Rice then Chickpea",
  cycleYears: 1,
  source: "farmer",
  slots: [
    {
      id: "slot-1",
      kind: "crop",
      cropId: "rice",
      plantDate: "2026-06-15",
      harvestDate: "2026-10-15",
      dateConfidence: "exact",
      irrigated: true,
    },
    {
      id: "slot-2",
      kind: "crop",
      cropId: "chickpea",
      plantDate: "2026-11-01",
      harvestDate: "2027-02-28",
      dateConfidence: "approx",
      irrigated: false,
    },
  ],
};

let storeState = {
  status: "ready",
  fields: [mockField],
  rotations: { [mockField.id]: [mockRotation] },
  load: vi.fn(),
  loadRotations: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
  useFieldRotations: () => storeState.rotations[mockField.id] ?? [],
}));

let analysisOverride: Record<string, unknown> = {};

vi.mock("@/lib/analysis/use-analysis", () => ({
  useFieldAnalysis: () => ({
    phase: "ready",
    conditions: {
      annualRainMm: 950,
      monthlyRainMm: [10, 15, 20, 50, 120, 220, 250, 180, 80, 30, 15, 10],
      monthlyTmaxC: [30, 32, 35, 38, 36, 32, 31, 31, 32, 32, 31, 29],
      monthlyTminC: [18, 19, 22, 25, 25, 24, 24, 24, 24, 23, 21, 18],
      soil: {
        texture: "sandy clay loam",
        ph: 6.2,
        socGKg: 14,
      },
      sources: [],
    },
    remote: null,
    engineData: null,
    showingCache: false,
    retrieving: false,
    slow: false,
    retry: vi.fn(),
    ...analysisOverride,
  }),
}));

describe("FieldOverview (S06 Field Hub)", () => {
  beforeEach(() => {
    cleanup();
    analysisOverride = {};
    storeState = {
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [mockRotation] },
      load: vi.fn(),
      loadRotations: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders field header with name and region", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("North Stream Field")).toBeInTheDocument();
    expect(screen.getAllByText("Ayeyarwady").length).toBeGreaterThan(0);
  });

  it("leads the header with the region name and keeps raw coordinates out of the default view", () => {
    render(<FieldOverview fieldId={mockField.id} />);
    const heading = screen.getByRole("heading", { level: 1 });
    const summary = heading.parentElement?.querySelector("p");
    expect(summary?.textContent).toBe("Ayeyarwady");
    expect(summary?.querySelector(".font-mono")).toBeNull();
    // Coordinates live inside the collapsed "Field options".
    const options = screen.getByText("Field options").closest("details");
    expect(options?.querySelector(".font-mono")?.textContent).toMatch(/96\.17/);
  });

  it("has no Simple/Technical toggle and no duplicate Draw boundary button", () => {
    render(<FieldOverview fieldId={mockField.id} />);
    expect(screen.queryByRole("group", { name: "Detail level" })).toBeNull();
    expect(screen.queryByRole("button", { name: /technical/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Draw field boundary" })).toBeNull();
  });

  it("does not show the Dry Zone caution outside the Dry Zone", () => {
    render(<FieldOverview fieldId={mockField.id} />);
    expect(screen.queryByText(/In the Dry Zone/)).toBeNull();
  });

  it("renders the next step callout guiding the farmer to their answer", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("Your answer is ready")).toBeInTheDocument();
    expect(screen.getByText("See how Rice then Chickpea compares with other plans for this field.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See my answer" })).toBeInTheDocument();
    // Rotation and soil test are done; the farm profile is the one optional detail left.
    expect(screen.getByText("Answer ready · 1 optional detail")).toBeInTheDocument();
    expect(screen.queryByText(/quick question/)).toBeNull();
  });

  it("says once how many values are typical, with one Review link instead of a Change link per row", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("Balanced across water, soil and income")).toBeInTheDocument();
    expect(screen.getByText("Some irrigation")).toBeInTheDocument();
    // Unset priorities, equipment, labour and water are the four typical values.
    expect(screen.getByText("Using typical values for 4 things")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Change" })).toBeNull();
    const reviews = screen.getAllByRole("link", { name: "Review" });
    expect(reviews.length).toBeGreaterThan(0);
    for (const link of reviews) {
      expect(link.getAttribute("href")).toBe(`/fields/${mockField.id}/profile`);
      expect(link.className).toContain("min-h-tap");
    }
  });

  it("hides rows that have no value", () => {
    render(<FieldOverview fieldId={mockField.id} />);
    // No market access answer and no salt reading: neither row, nor a "Not measured" line.
    expect(screen.queryByText("Market")).toBeNull();
    expect(screen.queryByText("Soil salt")).toBeNull();
    expect(screen.queryByText(/Not measured/)).toBeNull();
  });

  it("says when a reading is a guess, and that the farmer's judgment comes first", () => {
    storeState.fields = [{ ...mockField, region: "magway", soilOverride: undefined }];
    render(<FieldOverview fieldId={mockField.id} />);

    const caution = screen.getByText(/In the Dry Zone, NASA POWER rain was about 51% lower than the Mandalay/);
    // Amber caution styling, not the green healthy leaf.
    expect(caution.closest("p")?.className).toContain("bg-unknown-bg");
    expect(caution.closest("p")?.className).not.toContain("healthy");
    expect(screen.getByText(/Soil is a map estimate/)).toBeInTheDocument();
    expect(screen.getByText("Suggestions to discuss, not instructions.")).toBeInTheDocument();
  });

  it("keeps the separate pest task link reachable with a 44 px target", () => {
    const { container } = render(<FieldOverview fieldId={mockField.id} />);
    for (const name of ["Edit crops", "Pests to watch"]) {
      const link = screen.getByRole("link", { name });
      expect(link.className, name).toContain("min-h-tap");
    }
    expect(container).toBeTruthy();
  });

  it("renders current crop rotation summary with slot details", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("Current rotation")).toBeInTheDocument();
    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("Chickpea")).toBeInTheDocument();
    expect(screen.getByText("Irrigated")).toBeInTheDocument();
    expect(screen.getByText("Rainfed")).toBeInTheDocument();
  });

  it("folds weather and soil to one sentence once crops are recorded", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText(/About 950 mm of rain a year, wettest/)).toBeInTheDocument();
    expect(screen.queryByText("Local conditions")).toBeNull();
    expect(screen.queryByText("Annual rainfall")).toBeNull();
  });

  it("shows the full local conditions panel only before a rotation exists", () => {
    storeState.rotations = {};
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("Local conditions")).toBeInTheDocument();
    expect(screen.getByText("950 mm")).toBeInTheDocument();
    expect(screen.getByText("Annual rainfall")).toBeInTheDocument();
    // Setup progress only appears once there is an answer.
    expect(screen.queryByText(/Answer ready/)).toBeNull();
  });

  it("keeps Pests one tap from the hub without duplicating the Conditions tab", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    const nav = screen.getByRole("navigation", { name: "More about this field" });
    const links = [...nav.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([`/fields/${mockField.id}/pests`]);
    expect(screen.queryByRole("link", { name: "Weather and soil" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Printable report" })).toBeNull();
  });

  it("says honestly whether the weather check is ready", () => {
    const { unmount } = render(<FieldOverview fieldId={mockField.id} />);
    expect(screen.getByText("Weather check: ready")).toBeInTheDocument();
    unmount();

    analysisOverride = { phase: "loading", conditions: null };
    const loading = render(<FieldOverview fieldId={mockField.id} />);
    expect(screen.getByText("Checking weather (about 15 seconds)…")).toBeInTheDocument();
    loading.unmount();

    analysisOverride = { phase: "loading", conditions: null, slow: true };
    render(<FieldOverview fieldId={mockField.id} />);
    expect(screen.getByText(/Still checking… the first time is slow/)).toBeInTheDocument();
  });

  it("renders field details with plain-language rows", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("Field details")).toBeInTheDocument();
    expect(screen.getByText("Soil type")).toBeInTheDocument();
    expect(screen.getByText("Acidity")).toBeInTheDocument();
    expect(screen.getByText("2.4 ha")).toBeInTheDocument();
  });

  it("renders field boundary map preview and action links", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getAllByText(/Edit field boundary/i).length).toBeGreaterThan(0);
  });
});
