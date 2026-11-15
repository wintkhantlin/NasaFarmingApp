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
  update: vi.fn().mockResolvedValue(undefined),
};

function choosePriority() {
  fireEvent.click(screen.getByRole("button", { name: /Earn more/ }));
}

function chooseFirstExample() {
  fireEvent.click(screen.getAllByRole("button", { name: "Choose this option" })[0]);
}

function enterFutureDates() {
  const year = new Date().getFullYear() + 1;
  const sowDates = screen.getAllByLabelText(/Sow date/);
  const harvestDates = screen.getAllByLabelText(/Harvest date/);
  fireEvent.change(sowDates[0], { target: { value: `${year}-06-15` } });
  fireEvent.change(harvestDates[0], { target: { value: `${year}-10-25` } });
  fireEvent.change(sowDates[1], { target: { value: `${year}-11-05` } });
  fireEvent.change(harvestDates[1], { target: { value: `${year + 1}-02-15` } });
}

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
      update: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    cleanup();
  });

  describe("Crop entry mode toggle", () => {
    it("renders a small record / plan-ideas switch, recording first", () => {
      render(<RotationEditor fieldId={mockField.id} />);

      expect(screen.getByRole("button", { name: "Get plan ideas" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "Tell us what you grew" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByText("Guided")).toBeNull();
      expect(screen.queryByText("Detailed")).toBeNull();
    });

    it("can toggle freely between guided questions and detailed editing", () => {
      render(<RotationEditor fieldId={mockField.id} />);

      const guidedBtn = screen.getByRole("button", { name: "Get plan ideas" });
      fireEvent.click(guidedBtn);

      // Guided starts on priorities, with saved field details summarised rather than asked again
      expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
      expect(screen.getByText("What matters most?")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Edit field" })).toHaveAttribute("href", `/fields/${mockField.id}/profile`);

      // Can toggle back to detailed editing
      const advancedBtn = screen.getByRole("button", { name: "Tell us what you grew" });
      fireEvent.click(advancedBtn);
      expect(screen.getByText("Seasonal Timeline")).toBeInTheDocument();
    });
  });

  describe("Relay Broadcast Sowing Support in Advanced Editor", () => {
    it("recognizes and renders the emerald Relay Broadcast (Ye-pyan) badge instead of an error", () => {
      render(<RotationEditor fieldId={mockField.id} />);

      // Ensure we are in the detailed editor
      const advancedBtn = screen.getByRole("button", { name: "Tell us what you grew" });
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
      fireEvent.click(screen.getByRole("button", { name: "Get plan ideas" }));
      choosePriority();
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      chooseFirstExample();
      fireEvent.click(screen.getByText(/Continue with/i));
      expect(screen.getAllByLabelText(/Sow date/)).toHaveLength(2);
      enterFutureDates();
      fireEvent.click(screen.getByRole("button", { name: /Save this plan/i }));

      await waitFor(() => expect(storeState.saveRotation).toHaveBeenCalled());
      // the confirmation is on screen first; the move to the answer comes a moment later
      expect(routerPush).not.toHaveBeenCalled();
      await waitFor(() => expect(routerPush).toHaveBeenCalledWith(`/fields/${mockField.id}/compare`), { timeout: 3000 });
    });
    it("shows saving until persistence finishes and reports storage failure", async () => {
      let rejectSave!: (reason: Error) => void;
      const apply = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
      render(<FarmerGuidedFlow field={mockField} currentSlots={mockRotation.slots} cycleYears={1} onApplyPlan={apply} onSwitchToAdvanced={vi.fn()} />);
      choosePriority();
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      expect(screen.queryByText(/benchmark prices and listed costs/)).not.toBeInTheDocument();
      expect(screen.getByText(/Planning examples — not a ranked recommendation/)).toBeInTheDocument();
      chooseFirstExample();
      fireEvent.click(screen.getByText(/Continue with/i));
      enterFutureDates();
      fireEvent.click(screen.getByRole("button", { name: /Save this plan/i }));
      expect(screen.getByRole("button", { name: "Saving plan…" })).toBeDisabled();
      expect(screen.queryByText(/Plan saved on this phone/)).not.toBeInTheDocument();
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
      expect(screen.getByText(/Water not confirmed/)).toBeInTheDocument();
      expect(screen.getByText(/Earn more/i)).toBeInTheDocument();
      expect(screen.getByText(/Save water/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show options" })).toBeDisabled();
      expect(screen.queryByText(/Dry-season water/)).toBeNull();

      // Step 2: options are shown straight away; refinements are optional and collapsed
      choosePriority();
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
      expect(screen.getByText(/These examples are not ranked/)).toBeInTheDocument();
      expect(screen.getAllByText(/Rice → Black Gram/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Rice → Sesame/i)).toBeInTheDocument();
      expect(screen.queryByText(/Needs dry-season irrigation/)).toBeNull();
      expect(screen.queryByText(/Ruled out by your answers/)).toBeNull();
      expect(screen.queryByText(/Dry-season water/)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Add farm details \(optional\)/ }));
      expect(screen.getByText(/Dry-season water/)).toBeInTheDocument();

      // Step 3: plan with suggested dates
      chooseFirstExample();
      fireEvent.click(screen.getByText(/Continue with/i));
      expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
      expect(screen.getAllByLabelText(/Sow date/)).toHaveLength(2);
      expect(screen.getByText(/Before planting/)).toBeInTheDocument();

      enterFutureDates();
      fireEvent.click(screen.getByRole("button", { name: "Save this plan" }));
      expect(applyMock).toHaveBeenCalled();
    });

    it("saves the chosen priority into the field profile, using the profile's own ids", () => {
      render(<FarmerGuidedFlow field={mockField} currentSlots={[]} cycleYears={1} onApplyPlan={vi.fn()} onSwitchToAdvanced={vi.fn()} />);
      choosePriority();
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      expect(storeState.update).toHaveBeenCalledWith(
        mockField.id,
        expect.objectContaining({ priorities: expect.objectContaining({ order: ["income"], weights: {} }) }),
      );
    });

    it("starts from the priorities already saved in the profile and skips a needless save", () => {
      const saved = { ...mockField, priorities: { order: ["water" as const], weights: {} } };
      render(<FarmerGuidedFlow field={saved} currentSlots={[]} cycleYears={1} onApplyPlan={vi.fn()} onSwitchToAdvanced={vi.fn()} />);
      expect(screen.getByRole("button", { name: /Save water/ })).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      expect(storeState.update).not.toHaveBeenCalled();
    });

    it("puts Back in the page-bar position, not next to the main action", () => {
      render(<FarmerGuidedFlow field={mockField} currentSlots={[]} cycleYears={1} onApplyPlan={vi.fn()} onSwitchToAdvanced={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
      choosePriority();
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      const back = screen.getByRole("button", { name: "Back" });
      expect(back.closest("section, article")).toBeNull();
      fireEvent.click(back);
      expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    });

    it("never treats an unanswered budget as unlimited", () => {
      render(<FarmerGuidedFlow field={mockField} currentSlots={[]} cycleYears={1} onApplyPlan={vi.fn()} onSwitchToAdvanced={vi.fn()} />);
      choosePriority();
      fireEvent.click(screen.getByRole("button", { name: "Show options" }));
      expect(screen.getAllByText(/Add to check:.*your budget/).length).toBe(3);

      fireEvent.click(screen.getByRole("button", { name: /Add farm details/ }));
      expect(screen.getByText(/Not answered yet, so upfront costs are not checked against a budget/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /No fixed limit/, pressed: true })).toBeNull();

      // A stated limit is applied in MMK per hectare from the per-acre answer
      fireEvent.click(screen.getByRole("button", { name: /Under 600,000 MMK per acre/ }));
      expect(screen.queryByText(/May cost more than your budget/)).not.toBeInTheDocument();
      expect(screen.getAllByText(/crop costs/).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/Add to check:.*your budget/)).toHaveLength(0);
    });
  });
});
