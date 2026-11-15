/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { RotationEditor } from "@/components/field/rotation-editor";
import { daysBetween, addDaysToIso, segmentYear } from "@/lib/rotation-format";
import type { Field, Rotation } from "@/lib/types";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
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
  update: vi.fn(),
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

describe("RotationEditor default view mode", () => {
  beforeEach(() => {
    cleanup();
    storeState = {
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [mockRotation] },
      load: vi.fn(),
      loadRotations: vi.fn().mockResolvedValue([mockRotation]),
      saveRotation: vi.fn().mockResolvedValue(mockRotation),
      update: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("defaults to plan ideas mode", () => {
    render(<RotationEditor fieldId={mockField.id} />);

    expect(screen.getByRole("button", { name: "Get plan ideas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tell us what you grew" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
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
      update: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the interactive visual seasonal timeline", async () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);

    expect(screen.getByText("Seasonal Timeline")).toBeInTheDocument();
    expect(screen.getByText(/Monsoon rain \(Jun–Sep\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Active crop/i)).toBeInTheDocument();
    expect(screen.getByText(/Fallow \/ bare soil/i)).toBeInTheDocument();
  });

  it("asks when you sow with a month and part of month on each crop card", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);

    expect(screen.getAllByText(/When do you sow/i)).toHaveLength(2);
    // rice was sown in June, so June is selected on the first card
    expect(screen.getAllByRole("button", { name: /^Jun/, pressed: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Early Jun" }).length).toBeGreaterThan(0);
  });

  it("displays duration in days for recorded crops", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);

    expect(screen.getAllByText(/121 days/).length).toBeGreaterThan(0);
  });
});

describe("RotationEditor after a plan is saved", () => {
  const plan: Rotation = { ...mockRotation, id: `guided-plan-${mockField.id}`, label: "Delta Field draft plan", source: "strategy" };

  beforeEach(() => {
    cleanup();
    storeState = {
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [plan] },
      load: vi.fn(),
      loadRotations: vi.fn().mockResolvedValue([plan]),
      saveRotation: vi.fn().mockResolvedValue(plan),
      update: vi.fn(),
    };
  });

  afterEach(() => cleanup());

  it("asks for current crops in the detailed list instead of reopening the planner", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    expect(screen.getByRole("button", { name: /Tell us what you grew/ })).toHaveAttribute("aria-pressed", "true");
    // the saved plan's crops are not passed off as what grows here now
    expect(screen.queryAllByText(/121 days/)).toHaveLength(0);
  });
});


describe("RotationEditor saving, removing and dates", () => {
  beforeEach(() => {
    cleanup();
    routerPush.mockReset();
    storeState = {
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [mockRotation] },
      load: vi.fn(),
      loadRotations: vi.fn().mockResolvedValue([mockRotation]),
      saveRotation: vi.fn().mockResolvedValue(mockRotation),
      update: vi.fn(),
    };
  });
  afterEach(() => cleanup());

  it("Save and stay saves, says it is saved, and stays on the page", async () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    fireEvent.change(screen.getAllByLabelText("Harvest date")[0], { target: { value: "2026-10-05" } });
    expect(screen.getByText("You have changes that are not saved yet.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save and stay" }));
    await waitFor(() => expect(storeState.saveRotation).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Saved on this phone.")).toBeInTheDocument();
    expect(screen.queryByText("You have changes that are not saved yet.")).toBeNull();
    await new Promise((r) => setTimeout(r, 1200));
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("See my answer shows Saved first, then goes to the answer", async () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    fireEvent.click(screen.getByRole("button", { name: "See my answer" }));
    expect(await screen.findByText("Saved on this phone.")).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith(`/fields/${mockField.id}/compare`), { timeout: 3000 });
  });

  it("crop chips only add; removing is the Remove button, and Undo brings the crop back", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    const removeButtons = () => screen.queryAllByRole("button", { name: /^Remove crop:/ });
    expect(removeButtons()).toHaveLength(2);

    // tapping a crop that is already chosen changes nothing
    fireEvent.click(screen.getByRole("button", { name: "Rice", pressed: true }));
    expect(removeButtons()).toHaveLength(2);

    fireEvent.click(removeButtons()[0]);
    expect(removeButtons()).toHaveLength(1);
    expect(screen.getByText(/removed\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(removeButtons()).toHaveLength(2);
    expect(screen.queryByText(/removed\./)).toBeNull();
  });

  it("has one Add another crop button and no duplicate add paths", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    expect(screen.getAllByRole("button", { name: "Add another crop" })).toHaveLength(1);
    expect(screen.queryByText("Add crop 2")).toBeNull();
    expect(screen.queryByText("Add your first crop")).toBeNull();
  });

  it("asks how sure the dates are only after a date is edited, and says when harvest moved", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    // rice was saved as exact, black gram is still the app's guess
    expect(screen.getAllByText("I remember:")).toHaveLength(1);
    expect(screen.queryByText("Suggested")).toBeNull();

    fireEvent.change(screen.getAllByLabelText("Planting date")[1], { target: { value: "2026-11-01" } });
    expect(screen.getAllByText("I remember:")).toHaveLength(2);
    expect(screen.getAllByText("About this month").length).toBeGreaterThan(0);
    expect(screen.getByText(/Harvest moved to/)).toBeInTheDocument();
    expect(screen.getAllByText("Harvest moves with it. You can change harvest after.").length).toBeGreaterThan(0);
  });

  it("tapping a month sets the sowing date after the crop before, and harvest follows", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    // black gram is the second crop; rice is harvested on 30 Sep 2026
    fireEvent.click(screen.getAllByRole("button", { name: /^Mar/ })[1]);
    const planting = screen.getAllByLabelText("Planting date")[1] as HTMLInputElement;
    const harvest = screen.getAllByLabelText("Harvest date")[1] as HTMLInputElement;
    expect(planting.value).toMatch(/^2027-03-/);
    expect(harvest.value > planting.value).toBe(true);
    // the farmer chose it, so the app now asks how sure they are
    expect(screen.getAllByText("I remember:")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /^Early Mar|^Middle Mar|^Late Mar/, pressed: true })).toBeInTheDocument();
  });

  it("Fill dates for me keeps the farmer's dates and says what it did", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    fireEvent.click(screen.getByRole("button", { name: "Fill dates for me" }));
    expect(screen.getByRole("status", { name: "" })).toBeTruthy();
    expect((screen.getAllByLabelText("Planting date")[0] as HTMLInputElement).value).toBe("2026-06-01");
    expect(screen.getByText(/Dates you set yourself were kept/)).toBeInTheDocument();
  });

  it("keeps the crop picker, variety and sowing details under More details", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    const more = screen.getAllByText("More details (optional)")[0].closest("details")!;
    expect(more).not.toHaveAttribute("open");
    expect(more.textContent).toContain("Crop");
    expect(more.textContent).toContain("Variety");
  });
});

describe("RotationEditor with no crops yet", () => {
  beforeEach(() => {
    cleanup();
    storeState = {
      status: "ready",
      fields: [mockField],
      rotations: { [mockField.id]: [] },
      load: vi.fn(),
      loadRotations: vi.fn().mockResolvedValue([]),
      saveRotation: vi.fn().mockResolvedValue(mockRotation),
      update: vi.fn(),
    };
  });
  afterEach(() => cleanup());

  it("offers what farmers in the region usually grow, and one tap fills crops and dates", () => {
    render(<RotationEditor fieldId={mockField.id} initialMode="advanced" />);
    const start = screen.getByRole("button", { name: /Rice, then black gram/ });
    // no rest-only or irrigation-only starts for a field with some irrigation are hidden; rest periods never are offered
    expect(screen.queryByRole("button", { name: /Rice, then fallow/ })).toBeNull();

    fireEvent.click(start);
    expect(screen.getAllByText(/When do you sow/i)).toHaveLength(2);
    const planting = screen.getAllByLabelText("Planting date") as HTMLInputElement[];
    expect(planting).toHaveLength(2);
    expect(planting.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.value))).toBe(true);
    expect(planting[1].value > planting[0].value).toBe(true);
    // the starts are gone once there are crops
    expect(screen.queryByRole("button", { name: /Rice, then black gram/ })).toBeNull();
  });
});
