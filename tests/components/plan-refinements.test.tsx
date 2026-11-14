/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RotationExplorer from "@/app/(app)/plan/rotation-explorer";
import { PLAN_DRAFT_KEY } from "@/lib/store/plan-draft";

const saved = { version: 1, place: { id: "typed:ayeyarwady:bogale", name: "Bogale", context: "Ayeyarwady", region: "ayeyarwady", source: "typed" }, mainCropId: "rice", updatedAt: "2026-11-15T00:00:00.000Z" };
describe("Plan drawers", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem(PLAN_DRAFT_KEY, JSON.stringify(saved)); });
  afterEach(() => cleanup());
  it("edits water, persists after reload, and restores focus on cancel", async () => {
    const view = render(<RotationExplorer />);
    const chip = await screen.findByText("Water: Not set");
    fireEvent.click(chip);
    expect(screen.getByText("Occasional irrigation")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Occasional irrigation"));
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(PLAN_DRAFT_KEY)!).refinements.water.value).toBe("occasional"));
    expect(JSON.parse(localStorage.getItem(PLAN_DRAFT_KEY)!).revision).toBe(1);
    view.unmount();
    render(<RotationExplorer />);
    expect(await screen.findByText("Water: saved")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Water: saved"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel and close" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Water: saved" })).toHaveFocus());
  });
  it("records unknown dates and supports crop correction and undo", async () => {
    render(<RotationExplorer />);
    fireEvent.click(await screen.findByText("Crop sequence: Not set"));
    expect(screen.getByLabelText("Sowing precision")).toHaveValue("unknown");
    fireEvent.change(screen.getByLabelText("Following crop"), { target: { value: "black-gram" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(PLAN_DRAFT_KEY)!).refinements.sequence.nextCropId).toBe("black-gram"));
    fireEvent.click(screen.getByRole("button", { name: "Undo last change" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(PLAN_DRAFT_KEY)!).refinements.sequence.nextCropId).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Edit main crop" }));
    expect(screen.getByRole("heading", { name: "What is your main monsoon crop?" })).toBeInTheDocument();
  });
  it("keeps the sheet keyboard reachable at 320px and closes with Escape", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    render(<RotationExplorer />);
    const trigger = await screen.findByRole("button", { name: "Main goal: Not set" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Save details" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByText("Main goal", { selector: "h3" }), { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("P6 practice inputs", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem(PLAN_DRAFT_KEY, JSON.stringify(saved)); });
  afterEach(() => cleanup());
  it("saves a qualitative soil observation without numeric moisture and retains it on water edits", async () => {
    render(<RotationExplorer />);
    fireEvent.click(await screen.findByText("Water: Not set"));
    fireEvent.click(screen.getByRole("button", { name: /Very wet \/ oozing/ }));
    fireEvent.change(screen.getByLabelText("Observation depth in cm (optional)"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Known texture"), { target: { value: "clayey" } });
    fireEvent.click(screen.getByLabelText("Rain only"));
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(PLAN_DRAFT_KEY)!).refinements.water.observation).toMatchObject({ feel: "very-wet", depthCm: 5, texture: "clayey" }));
  });
  it("stores a dekad and an explicit relay without inventing a pulse sowing date", async () => {
    render(<RotationExplorer />);
    fireEvent.click(await screen.findByText("Crop sequence: Not set"));
    fireEvent.change(screen.getByLabelText("Following crop"), { target: { value: "black-gram" } });
    fireEvent.click(screen.getByLabelText("Relay into standing rice"));
    fireEvent.change(screen.getByLabelText("Sowing precision"), { target: { value: "dekad" } });
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2026" } });
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Late (21–end)" }));
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(PLAN_DRAFT_KEY)!).refinements.sequence).toMatchObject({ sowing: { kind: "dekad", year: 2026, month: 12, period: "late" }, transition: { method: "relay-standing-rice", nextSowing: { kind: "unknown" } } }));
  });
});
