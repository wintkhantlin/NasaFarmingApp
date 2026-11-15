import { describe, expect, it } from "vitest";
import { planContextNote, prettifyNoteLine } from "@/lib/plan/handoff-note";

describe("plan handoff note", () => {
  it("writes plain text without revision numbers", () => {
    const note = planContextNote({ place: "Magway", water: "rain-only", goal: "water", residue: "unknown", feasibility: { budget: "unknown", seed: "available" } });
    expect(note).toBe("[Plan context]: Region: Magway · Water: Rain only · Top goal: Save water · Residue: not known · Local check: seed available");
    expect(note).not.toMatch(/revision/);
  });
  it("prettifies the older stored format", () => {
    const old = "[Plan context]: revision 0; area Magway; water rain-only; goal water; residue unknown. Local feasibility: budget unknown, seed unknown. Full observations and timing remain in the backed-up Plan draft.";
    expect(prettifyNoteLine(old)).toEqual({ topic: "Your plan answers", text: "Region: Magway · Water: Rain only · Top goal: Save water · Residue: not known" });
  });
  it("leaves other notes alone", () => {
    expect(prettifyNoteLine("Wet corner")).toEqual({ topic: "Field note", text: "Wet corner" });
  });
});
