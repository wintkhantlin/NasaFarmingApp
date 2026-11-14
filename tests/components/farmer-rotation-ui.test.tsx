/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { RotationEditor } from "@/components/field/rotation-editor";
import { MoistureClockRibbon } from "@/components/field/moisture-clock-ribbon";
import { FarmerGuidedFlow } from "@/components/field/farmer-guided-flow";
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
  irrigation: "none",
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
      establishmentMode: "tillage",
    },
    {
      id: "slot-pulse",
      kind: "crop",
      cropId: "black-gram",
      plantDate: "2026-09-23", // 7 days before rice harvest (relay Ye-pyan)
      harvestDate: "2027-01-15",
      dateConfidence: "typical",
      irrigated: false,
      establishmentMode: "relay_broadcast",
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

describe("PROMPTS 7 & 8: Farmer-Centered UI & Moisture Clock (U-03)", () => {
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
    };
  });

  afterEach(() => {
    cleanup();
  });

  describe("Dual View Experience Toggle", () => {
    it("renders experience mode toggle buttons for Guided Farmer View and Advanced Timeline", () => {
      render(<RotationEditor fieldId={mockField.id} />);

      expect(screen.getByText(/Guided Farmer View/i)).toBeInTheDocument();
      expect(screen.getByText(/Advanced Detail View/i)).toBeInTheDocument();
    });

    it("can toggle freely between Guided Farmer View and Advanced Timeline", () => {
      render(<RotationEditor fieldId={mockField.id} />);

      const guidedBtn = screen.getByText(/Guided Farmer View/i);
      fireEvent.click(guidedBtn);

      // Should now show Guided Farmer Step 1 header
      expect(screen.getByText(/Step 1: Your Field/i)).toBeInTheDocument();
      expect(screen.getByText(/Confirm your field details/i)).toBeInTheDocument();

      // Can toggle back to Advanced Detail View
      const advancedBtn = screen.getByText(/Advanced Detail View/i);
      fireEvent.click(advancedBtn);
      expect(screen.getByText("Seasonal Timeline")).toBeInTheDocument();
    });
  });

  describe("Relay Broadcast Sowing Support in Advanced Editor", () => {
    it("recognizes and renders the emerald Relay Broadcast (Ye-pyan) badge instead of an error", () => {
      render(<RotationEditor fieldId={mockField.id} />);

      // Ensure we are in Advanced View
      const advancedBtn = screen.getByText(/Advanced Detail View/i);
      fireEvent.click(advancedBtn);

      expect(screen.getByText(/Relay Broadcast \(Ye-pyan\)/i)).toBeInTheDocument();
    });
  });

  describe("Honest Moisture Clock Ribbon (U-03)", () => {
    it("never displays a fake calendar countdown when soil data is unconfirmed", () => {
      render(
        <MoistureClockRibbon
          hasConfirmedSoil={false}
          hasConfirmedDrainageDate={false}
        />,
      );

      expect(screen.getByText(/Check topsoil moisture and drainage before sowing/i)).toBeInTheDocument();
      expect(screen.queryByText(/~Day 8 to Day 16/i)).toBeNull();
    });

    it("displays the 3-zone physical drydown window when soil data is confirmed", () => {
      render(
        <MoistureClockRibbon
          hasConfirmedSoil={true}
          hasConfirmedDrainageDate={true}
          awcMmPerM={140}
          thetaSat={0.48}
          thetaFc={0.34}
          pondAtDrainageMm={25}
        />,
      );

      expect(screen.getByText(/Post-Rice Sowing Window Estimate/i)).toBeInTheDocument();
      expect(screen.getByText(/May still be too wet/i)).toBeInTheDocument();
      expect(screen.getByText(/Field may be ready/i)).toBeInTheDocument();
      expect(screen.getByText(/May be drying/i)).toBeInTheDocument();
      expect(screen.getByText(/Field verification notice/i)).toBeInTheDocument();
    });
  });

  describe("Farmer Guided Flow 5-Step Journey", () => {
    it("opens the comparison step only after the chosen plan is saved", async () => {
      render(<RotationEditor fieldId={mockField.id} />);
      fireEvent.click(screen.getByText(/Guided Farmer View/i));
      fireEvent.click(screen.getByText(/Continue to Farm Conditions/i));
      fireEvent.click(screen.getByText(/Continue to Priorities/i));
      fireEvent.click(screen.getByText(/Compare Recommended Rotations/i));
      fireEvent.click(screen.getByText(/Continue with/i));
      fireEvent.click(screen.getByRole("button", { name: /Save this plan/i }));

      await waitFor(() => expect(storeState.saveRotation).toHaveBeenCalled());
      expect(routerPush).toHaveBeenCalledWith(`/fields/${mockField.id}/compare`);
    });
    it("shows saving until persistence finishes and reports storage failure", async () => {
      let rejectSave!: (reason: Error) => void;
      const apply = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
      render(<FarmerGuidedFlow field={mockField} currentSlots={mockRotation.slots} cycleYears={1} onApplyPlan={apply} onSwitchToAdvanced={vi.fn()} />);
      fireEvent.click(screen.getByText(/Continue to Farm Conditions/i));
      fireEvent.click(screen.getByText(/Continue to Priorities/i));
      fireEvent.click(screen.getByText(/Compare Recommended Rotations/i));
      expect(screen.getAllByText(/benchmark prices and assumed costs/)).toHaveLength(3);
      fireEvent.click(screen.getByText(/Continue with/i));
      fireEvent.click(screen.getByRole("button", { name: /Save this plan/i }));
      expect(screen.getByRole("button", { name: "Saving plan…" })).toBeDisabled();
      expect(screen.queryByText(/Plan saved in this browser/)).not.toBeInTheDocument();
      rejectSave(new Error("quota"));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Could not save the plan"));
      expect(screen.getByRole("button", { name: /Save this plan/i })).toBeEnabled();
    });
    it("navigates through the 5 steps and preserves field input", () => {
      const applyMock = vi.fn();
      const switchMock = vi.fn();

      render(
        <FarmerGuidedFlow
          field={mockField}
          currentSlots={mockRotation.slots}
          cycleYears={1}
          onApplyPlan={applyMock}
          onSwitchToAdvanced={switchMock}
        />,
      );

      // Step 1
      expect(screen.getByText(/Step 1: Your Field/i)).toBeInTheDocument();
      expect(screen.getByText("Delta Field")).toBeInTheDocument();

      // Go to Step 2
      fireEvent.click(screen.getByText(/Continue to Farm Conditions/i));
      expect(screen.getByText(/Step 2: Tell Us About Your Farm/i)).toBeInTheDocument();

      // Go to Step 3
      fireEvent.click(screen.getByText(/Continue to Priorities/i));
      expect(screen.getByText(/Step 3: What's Most Important\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Earn more/i)).toBeInTheDocument();
      expect(screen.getByText(/Use less water/i)).toBeInTheDocument();

      // Go to Step 4
      fireEvent.click(screen.getByText(/Compare Recommended Rotations/i));
      expect(screen.getByText(/Step 4: Compare Rotations/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Rice → Black Gram/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Rice → Sesame/i)).toBeInTheDocument();

      // Go to Step 5
      fireEvent.click(screen.getByText(/Continue with/i));
      expect(screen.getByText(/Step 5: My Plan & Field Checklist/i)).toBeInTheDocument();
      expect(screen.getByText(/Pre-Planting Field Checklist/i)).toBeInTheDocument();

      // Save plan calls onApplyPlan
      fireEvent.click(screen.getByText(/Save This Plan/i));
      expect(applyMock).toHaveBeenCalled();
    });
  });
});
