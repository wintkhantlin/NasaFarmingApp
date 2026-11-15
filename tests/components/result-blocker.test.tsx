/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ResultBlocker, resolveBlocker, type BlockerContext } from "@/components/field/result-blocker";
import { compareRotations } from "@/lib/engine/compare";
import { adaptComparison, type DisplayInput } from "@/lib/plan/engine-display";
import { copy } from "@/lib/copy/en";
import { copyMy } from "@/lib/copy/my";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

afterEach(cleanup);

const retry = vi.fn();
const ctx = (over: Partial<BlockerContext> = {}): BlockerContext => ({ copy, online: true, retry, ...over });

const mine = (fieldId: string) => rotation(fieldId, [slot("s", "rice", "2026-06-15", "2026-10-15")]);

function build(fieldOver: Parameters<typeof syntheticField>[0], over: Partial<DisplayInput & { mode: "field" }> = {}) {
  const field = syntheticField({ priorities: { order: ["water"], weights: {} }, ...fieldOver });
  const current = mine(field.id);
  const data = engineData(field, syntheticWeather());
  const comparison = compareRotations(data, current);
  const input = {
    mode: "field" as const, phase: "ready" as const, field, rotation: current, data, comparison,
    inputRevision: "1", resultRevision: "1", ...over,
  };
  const display = adaptComparison(input as DisplayInput);
  return { field, comparison: input.comparison, display };
}

function pressable(container: HTMLElement) {
  return container.querySelectorAll("a, button");
}

describe("resolveBlocker", () => {
  it("an area with no crop list shows the no-catalog blocker, never the limits message", () => {
    for (const [region, centroid] of [["myanmar", [96.12, 19.76]], ["yangon", [96.24, 16.75]]] as const) {
      const { field, comparison, display } = build({ region, centroid: [...centroid] as [number, number] });
      const blocker = resolveBlocker(display, comparison, field, ctx());
      expect(blocker?.kind).toBe("no-local-catalog");
      expect(blocker?.title).toBe("We can't suggest other crops for your area yet");
      expect(blocker?.body).not.toContain("this place");
      expect(blocker?.body).toMatch(/10 years/);
      expect(blocker?.primary.href).toBe(`/fields/${field.id}/location`);
      expect(blocker?.secondary?.href).toBe(`/fields/${field.id}/conditions`);
      expect(JSON.stringify(blocker)).not.toMatch(/limit/i);
    }
  });

  it("names the real region in the body", () => {
    const { field, comparison, display } = build({ region: "yangon", centroid: [96.24, 16.75] });
    expect(resolveBlocker(display, comparison, field, ctx())?.body).toContain("Yangon Region");
  });

  it("no-catalog is also shown in Burmese", () => {
    const { field, comparison, display } = build({ region: "myanmar", centroid: [96.12, 19.76] });
    const blocker = resolveBlocker(display, comparison, field, ctx({ copy: copyMy }));
    expect(blocker?.title).toBe(copyMy.compare.blocker.noCatalogTitle);
    expect(blocker?.body).toContain(copyMy.compare.blocker.regionName.myanmar);
  });

  it("limits-too-strict lists the reasons, offers 'Loosen a limit' and no retry", () => {
    const base = build({ region: "magway", centroid: [94.95, 20.15] });
    const alternatives = base.comparison!.alternatives.map((o) => ({ ...o, fit: "does-not-fit" as const, noFitReason: "Needs more workers than you have." }));
    const { field, comparison, display } = build(
      { region: "magway", centroid: [94.95, 20.15] },
      { comparison: { ...base.comparison!, alternatives } },
    );
    const blocker = resolveBlocker(display, comparison, field, ctx());
    expect(blocker?.kind).toBe("limits-too-strict");
    expect(blocker?.primary).toEqual({ label: "Loosen a limit", href: `/fields/${field.id}/profile` });
    expect(blocker?.reasons?.join(" ")).toContain("Needs more workers than you have.");
    expect(blocker?.primary.onClick).toBeUndefined();
    const { container } = render(<ResultBlocker blocker={blocker!} reasonsTitle="Why" />);
    expect(container.querySelector("details")?.open).toBe(true);
    expect(screen.queryByText(/try again/i)).toBeNull();
  });

  it("limits and no-catalog never come from the same display", () => {
    const { field, comparison, display } = build({ region: "myanmar", centroid: [96.12, 19.76] });
    const blocker = resolveBlocker(display, comparison, field, ctx());
    expect(blocker?.kind).not.toBe("limits-too-strict");
    expect(`${display.headline} ${display.detail}`).not.toMatch(/limits you set|defined rotations/);
  });

  it("refreshing states offer exactly one retry; offline says so", () => {
    const { field, display } = build({ region: "magway", centroid: [94.95, 20.15] }, { phase: "failed", comparison: null });
    expect(display.state).toBe("error");
    const failed = resolveBlocker(display, null, field, ctx());
    expect(failed?.kind).toBe("refreshing");
    expect(failed?.primary.label).toBe("Try again");
    const offline = resolveBlocker(display, null, field, ctx({ online: false }));
    expect(offline?.title).toBe("You're offline");
    const { container } = render(<ResultBlocker blocker={failed!} />);
    expect(pressable(container)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("loading shows a busy, disabled button instead of Try again", () => {
    const { field, display } = build({ region: "magway", centroid: [94.95, 20.15] }, { phase: "loading", comparison: null });
    const blocker = resolveBlocker(display, null, field, ctx());
    expect(blocker?.kind).toBe("refreshing");
    expect(blocker?.primary.disabled).toBe(true);
    expect(blocker?.primary.label).not.toBe("Try again");
  });

  it("stale results offer 'Update my results'", () => {
    const { field, comparison, display } = build({ region: "magway", centroid: [94.95, 20.15] }, { inputRevision: "2" });
    expect(display.state).toBe("stale");
    expect(resolveBlocker(display, comparison, field, ctx())?.primary.label).toBe("Update my results");
  });

  it("setup-incomplete keeps one clear next step", () => {
    const noCrops = build({ region: "magway", centroid: [94.95, 20.15] }, { rotation: undefined, comparison: null });
    const blocker = resolveBlocker(noCrops.display, null, noCrops.field, ctx());
    expect(blocker?.kind).toBe("setup-incomplete");
    expect(blocker?.primary.href).toBe(`/fields/${noCrops.field.id}/rotation?mode=record`);
    const noLocation = build({ region: "magway", centroid: [94.95, 20.15], locationConfirmed: false }, { comparison: null });
    expect(resolveBlocker(noLocation.display, null, noLocation.field, ctx())?.primary.href).toBe(`/fields/${noLocation.field.id}/location`);
  });

  it("opens crop recording after a saved plan instead of restarting plan ideas", () => {
    const base = build({ region: "magway", centroid: [94.95, 20.15] });
    const savedPlan = { ...mine(base.field.id), id: `guided-plan-${base.field.id}`, source: "strategy" as const };
    const display = adaptComparison({
      mode: "field",
      phase: "ready",
      field: base.field,
      rotation: savedPlan,
      data: null,
      comparison: null,
      inputRevision: "1",
      resultRevision: "1",
    });

    expect(display.headline).toBe("Your plan is saved");
    expect(resolveBlocker(display, null, base.field, ctx())?.primary).toEqual({
      label: "Tell us what grows here now",
      href: `/fields/${base.field.id}/rotation?mode=record`,
    });
  });

  it("an unresolved ranking asks what matters most", () => {
    const base = build({ region: "magway", centroid: [94.95, 20.15] });
    const comparison = { ...base.comparison!, mcda: { ...base.comparison!.mcda, status: "unresolved" as const, ranking: [], note: "First-priority evidence missing." } };
    const { field, display } = build({ region: "magway", centroid: [94.95, 20.15] }, { comparison });
    expect(display.state).toBe("unresolved");
    const blocker = resolveBlocker(display, comparison, field, ctx());
    expect(blocker?.kind).toBe("needs-priorities");
    expect(blocker?.title).toBe("We can't pick a best plan yet");
    expect(blocker?.primary).toEqual({ label: "Tell us what matters most", href: `/fields/${field.id}/questions/priority` });
  });

  it("every blocker has exactly one primary button", () => {
    const { field, comparison, display } = build({ region: "myanmar", centroid: [96.12, 19.76] });
    const blocker = resolveBlocker(display, comparison, field, ctx())!;
    const { container } = render(<ResultBlocker blocker={blocker} heading="h1" />);
    expect(container.querySelectorAll("a.border-field, button.border-field")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(blocker.title);
  });
});

describe("engine-display wording", () => {
  it("the shared frame uses real counts in plain words", () => {
    const { display } = build({ region: "myanmar", centroid: [96.12, 19.76] });
    expect(display.detail).toMatch(/last \d+ years of weather \(2016–2025\)\. \d+ of \d+ years had full data\./);
    expect(display.detail).not.toMatch(/stress test|trusted|catalog/i);
  });

  it("sentences can be built in Burmese", () => {
    const { field, comparison } = build({ region: "myanmar", centroid: [96.12, 19.76] });
    const display = adaptComparison({
      mode: "field", phase: "ready", field, rotation: mine(field.id), data: engineData(field, syntheticWeather()), comparison,
      inputRevision: "1", resultRevision: "1", locale: "my",
    });
    expect(display.headline).toBe(copyMy.compare.display.noCatalogTitle);
  });
});
