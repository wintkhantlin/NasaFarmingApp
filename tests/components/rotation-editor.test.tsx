/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RotationEditor } from "@/components/field/rotation-editor";
import { daysBetween, addDaysToIso, segmentYear } from "@/lib/rotation-format";
import type { Field, Rotation } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockField: Field = {
  id: "88d66ad1-2324-4f18-b8d3-2ae4e4d86b18",
  name: "Delta Field",
  areaHa: 3.5,
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

const mockRotation: Rotation = {
  id: "rot-1",
  fieldId: mockField.id,
  label: "Paddy - Black Gram",
  cycleYears: 1,
  source: "farmer",
  slots: [
    {
      id: "slot-rice",
      kind: "crop",
      cropId: "rice",
      plantDate: "2026-06-01",
      harvestDate: "2026-09-30",
      dateConfidence: "exact",
      irrigated: true,
    },
    {
      id: "slot-pulse",
      kind: "crop",
      cropId: "black-gram",
      plantDate: "2026-10-20",
      harvestDate: "2027-01-15",
      dateConfidence: "typical",
      irrigated: false,
    },
  ],
};

let storeState = {
  status: "ready",
  fields: [mockField],
  rotations: { [mockField.id]: [mockRotation] },
  load: vi.fn(),
  loadRotations: vi.fn().mockResolvedValue([mockRotation]),
  saveRotation: vi.fn().mockResolvedValue(mockRotation),
};

vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
  useFieldRotations: () => storeState.rotations[mockField.id] ?? [],
}));

describe("Rotation Calendar Logic Helpers", () => {
  it("calculates exact calendar days between two dates", () => {
    expect(daysBetween("2026-06-01", "2026-09-30")).toBe(121);
    expect(daysBetween("2026-10-20", "2027-01-15")).toBe(87);
    expect(daysBetween("2026-06-01", "2026-06-01")).toBe(0);
  });

  it("adds days accurately across month and year boundaries", () => {
    expect(addDaysToIso("2026-06-01", 120)).toBe("2026-09-29");
    expect(addDaysToIso("2026-10-20", 90)).toBe("2027-01-18");
  });

  it("correctly segments a multi-year crop across calendar year boundaries", () => {
    // Crop runs Oct 20, 2026 to Jan 15, 2027
    const seg2026 = segmentYear(2026, "2026-10-20", "2027-01-15");
    expect(seg2026).not.toBeNull();
    expect(seg2026!.left).toBeGreaterThan(0.75); // late in year
    expect(seg2026!.left + seg2026!.width).toBeCloseTo(1.0, 2); // touches year end

    const seg2027 = segmentYear(2027, "2026-10-20", "2027-01-15");
    expect(seg2027).not.toBeNull();
    expect(seg2027!.left).toBe(0); // starts at Jan 1
    expect(seg2027!.width).toBeLessThan(0.1); // finishes mid-Jan

    const seg2028 = segmentYear(2028, "2026-10-20", "2027-01-15");
    expect(seg2028).toBeNull();
  });
});

describe("RotationEditor Component Calendar UI", () => {
  beforeEach(() => {
    cleanup();
    storeState = {
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [mockRotation] },
      load: vi.fn(),
      loadRotations: vi.fn().mockResolvedValue([mockRotation]),
      saveRotation: vi.fn().mockResolvedValue(mockRotation),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the interactive visual seasonal timeline", async () => {
    render(<RotationEditor fieldId={mockField.id} />);

    expect(screen.getByText("Seasonal Timeline")).toBeInTheDocument();
    expect(screen.getByText(/Monsoon rain \(Jun–Sep\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Active crop/i)).toBeInTheDocument();
    expect(screen.getByText(/Fallow \/ bare soil/i)).toBeInTheDocument();
  });

  it("renders quick seasonal buttons on crop cards", () => {
    render(<RotationEditor fieldId={mockField.id} />);

    expect(screen.getAllByText(/Monsoon/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Winter/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Summer/i).length).toBeGreaterThan(0);
  });

  it("displays duration in days for recorded crops", () => {
    render(<RotationEditor fieldId={mockField.id} />);

    expect(screen.getAllByText(/121 days/).length).toBeGreaterThan(0);
  });
});
