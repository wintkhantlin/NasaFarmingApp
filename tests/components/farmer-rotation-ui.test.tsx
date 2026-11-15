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

  describe("Crop entry mode toggle", () => {
    it("renders concise guided and detailed editor choices", () => {
      render(<RotationEditor fieldId={mockField.id} />);

      expect(screen.getByRole("button", { name: "Guided" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Detailed" })).toBeInTheDocument();
    });

    it("can toggle freely between guided questions and detailed editing", () => {
      render(<RotationEditor fieldId={mockField.id} />);

      const guidedBtn = screen.getByRole("button", { name: "Guided" });
      fireEvent.click(guidedBtn);

      // Guided starts on priorities, with saved field details summarised rather than asked again
      expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
      expect(screen.getByText("What matters most?")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Edit field" })).toHaveAttribute("href", `/fields/${mockField.id}/profile`);

      // Can toggle back to detailed editing
      const advancedBtn = screen.getByRole("button", { name: "Detailed" });
      fireEvent.click(advancedBtn);
      expect(screen.getByText("Seasonal Timeline")).toBeInTheDocument();
    });
  });

  describe("Relay Broadcast Sowing Support in Advanced Editor", () => {
    it("recognizes and renders the emerald Relay Broadcast (Ye-pyan) badge instead of an error", () => {
      render(<RotationEditor fieldId={mockField.id} />);

      // Ensure we are in the detailed editor
      const advancedBtn = screen.getByRole("button", { name: "Detailed" });
      fireEvent.click(advancedBtn);

      expect(screen.getByText(/Relay Broadcast \(Ye-pyan\)/i)).toBeInTheDocument();
      // The pulse slot uses usual-season dates, so it is labelled as suggested, not exact
      expect(screen.getByText("Suggested dates")).toBeInTheDocument();
      expect(screen.getByText(/Suggested from the usual season/)).toBeInTheDocument();
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
      expect(screen.getByText(/မြေပြင်အစိုဓာတ်နှင့် ရေနုတ်မြောင်းများကို လက်တွေ့စစ်ဆေးပါ/i)).toBeInTheDocument();
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

  describe("Farmer Guided Flow 3-Step Journey", () => {
    it("opens the comparison step only after the chosen plan is saved", async () => {
      render(<RotationEditor fieldId={mockField.id} />);
      fireEvent.click(screen.getByRole("button", { name: "Guided" }));
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      fireEvent.click(screen.getByText(/Continue with/i));
      fireEvent.click(screen.getByRole("button", { name: /Save this plan/i }));

      await waitFor(() => expect(storeState.saveRotation).toHaveBeenCalled());
      expect(routerPush).toHaveBeenCalledWith(`/fields/${mockField.id}/compare`);
    });
    it("shows saving until persistence finishes and reports storage failure", async () => {
      let rejectSave!: (reason: Error) => void;
      const apply = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
      render(<FarmerGuidedFlow field={mockField} currentSlots={mockRotation.slots} cycleYears={1} onApplyPlan={apply} onSwitchToAdvanced={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      expect(screen.getAllByText(/benchmark prices and listed costs/)).toHaveLength(3);
      fireEvent.click(screen.getByText(/Continue with/i));
      fireEvent.click(screen.getByRole("button", { name: /Save this plan/i }));
      expect(screen.getByRole("button", { name: "Saving plan…" })).toBeDisabled();
      expect(screen.queryByText(/Plan saved in this browser/)).not.toBeInTheDocument();
      rejectSave(new Error("quota"));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Plan save failed"));
      expect(screen.getByRole("button", { name: /Save this plan/i })).toBeEnabled();
    });
    it("goes priorities → compare → plan, with farm details optional", () => {
      const applyMock = vi.fn();
      render(
        <FarmerGuidedFlow
          field={mockField}
          currentSlots={mockRotation.slots}
          cycleYears={1}
          onApplyPlan={applyMock}
          onSwitchToAdvanced={vi.fn()}
        />,
      );

      // Step 1: field summary shown, not re-asked
      expect(screen.getByText("Delta Field")).toBeInTheDocument();
      expect(screen.getByText(/Rain-fed/)).toBeInTheDocument();
      expect(screen.getByText(/Earn more/i)).toBeInTheDocument();
      expect(screen.getByText(/Use less water/i)).toBeInTheDocument();
      expect(screen.queryByText(/Dry-season water/)).toBeNull();

      // Step 2: options are shown straight away; refinements are optional and collapsed
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
      expect(screen.getByText(/Optional: 1 of 3 farm details added/)).toBeInTheDocument();
      expect(screen.getAllByText(/Rice → Black Gram/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Rice → Sesame/i)).toBeInTheDocument();
      expect(screen.queryByText(/Dry-season water/)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Add farm details \(optional\)/ }));
      expect(screen.getByText(/Dry-season water/)).toBeInTheDocument();

      // Step 3: plan with suggested dates
      fireEvent.click(screen.getByText(/Continue with/i));
      expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
      expect(screen.getAllByText("Suggested dates").length).toBe(2);
      expect(screen.getByText(/Before planting/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Save this plan" }));
      expect(applyMock).toHaveBeenCalled();
    });

    it("never treats an unanswered budget as unlimited", () => {
      render(<FarmerGuidedFlow field={mockField} currentSlots={[]} cycleYears={1} onApplyPlan={vi.fn()} onSwitchToAdvanced={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      expect(screen.getAllByText(/Add to check:.*your budget/).length).toBe(3);

      fireEvent.click(screen.getByRole("button", { name: /Add farm details/ }));
      expect(screen.getByText(/Not answered yet, so upfront costs are not checked against a budget/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /No fixed limit/, pressed: true })).toBeNull();

      // A stated limit is applied in MMK per hectare from the per-acre answer
      fireEvent.click(screen.getByRole("button", { name: /Under 600,000 MMK per acre/ }));
      expect(screen.getAllByText(/May cost more than your budget/).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/Add to check:.*your budget/)).toHaveLength(0);
    });
  });
});
