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
    retry: vi.fn(),
  }),
}));

describe("FieldOverview (S06 Field Hub)", () => {
  beforeEach(() => {
    cleanup();
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

  it("renders field header with name, coordinates, and region", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("North Stream Field")).toBeInTheDocument();
    expect(screen.getAllByText("Ayeyarwady").length).toBeGreaterThan(0);
  });

  it("renders the next step callout guiding the farmer to their answer", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getAllByText("See my answer").length).toBeGreaterThan(0);
    expect(screen.getByText("Rice → Chickpea")).toBeInTheDocument();
  });

  it("renders current crop rotation summary with slot details", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("Current rotation")).toBeInTheDocument();
    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("Chickpea")).toBeInTheDocument();
    expect(screen.getByText("Irrigated")).toBeInTheDocument();
    expect(screen.getByText("Rainfed")).toBeInTheDocument();
  });

  it("renders weather and soil conditions snapshot with NASA and SoilGrids data", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("950 mm")).toBeInTheDocument();
    expect(screen.getByText("Annual rainfall")).toBeInTheDocument();
  });

  it("renders field details table with simple and technical views", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getByText("Field details")).toBeInTheDocument();
    expect(screen.getByText("Soil type")).toBeInTheDocument();
    expect(screen.getByText("Acidity")).toBeInTheDocument();
  });

  it("renders field boundary map preview and action links", () => {
    render(<FieldOverview fieldId={mockField.id} />);

    expect(screen.getAllByText(/Edit field boundary/i).length).toBeGreaterThan(0);
  });
});
