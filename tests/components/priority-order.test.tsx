// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PRIORITY_INFO, PriorityOrder, influenceWords, orderSummary } from "@/components/field/priority-order";
import { copy } from "@/lib/copy/en";
import { priorityWeights } from "@/lib/engine/mcda";
import type { PriorityId } from "@/lib/types";

afterEach(cleanup);

function Harness({ start = [], onChange = () => {} }: { start?: PriorityId[]; onChange?: (order: PriorityId[]) => void }) {
  const [order, setOrder] = useState<PriorityId[]>(start);
  return <PriorityOrder value={order} onChange={(next) => { setOrder(next); onChange(next); }} />;
}

describe("PriorityOrder", () => {
  test("adds priorities in the order chosen and reports the summary", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add: Save water" }));
    fireEvent.click(screen.getByRole("button", { name: "Add: Earn more" }));
    expect(onChange).toHaveBeenLastCalledWith(["water", "income"]);
    expect(screen.getByText("Save water counts most, then earn more.")).toBeTruthy();
  });

  test("keyboard buttons reorder and remove, and announce the change", () => {
    const onChange = vi.fn();
    render(<Harness start={["water", "soil", "income"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Move up: Earn more" }));
    expect(onChange).toHaveBeenLastCalledWith(["water", "income", "soil"]);
    expect((screen.getByRole("button", { name: "Move up: Save water" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Earn more is now second");
    fireEvent.click(screen.getByRole("button", { name: "Not important: Improve soil" }));
    expect(onChange).toHaveBeenLastCalledWith(["water", "income"]);
    expect(screen.getByRole("status").textContent).toContain("Improve soil is now marked not important");
  });

  test("one priority has one name: the same label the rest of the app uses", () => {
    render(<Harness start={["lower-inputs"]} />);
    expect(screen.getByText(copy.profile.priority["lower-inputs"])).toBeTruthy();
    expect(screen.queryByText("Use less nitrogen fertiliser")).toBeNull();
    expect(PRIORITY_INFO["lower-inputs"].label).toBe(copy.profile.priority["lower-inputs"]);
  });

  test("drag and drop moves a card to the target place", () => {
    const onChange = vi.fn();
    render(<Harness start={["water", "soil", "income"]} onChange={onChange} />);
    const items = screen.getAllByRole("listitem").filter((el) => el.getAttribute("draggable") === "true");
    fireEvent.dragStart(items[2]);
    fireEvent.drop(items[0]);
    expect(onChange).toHaveBeenLastCalledWith(["income", "water", "soil"]);
  });

  test("no order is described as equal weighting, one priority as the only one used", () => {
    expect(orderSummary([])).toMatch(/equally/);
    expect(orderSummary(["soil"])).toMatch(/Only improve soil/);
  });

  test("the words follow the engine's Rank-Sum weights", () => {
    const order: PriorityId[] = ["water", "soil", "income", "forage", "lower-inputs"];
    const w = priorityWeights({ order, weights: {} })!;
    expect(order.map((id) => w[id]!).every((v, i, a) => i === 0 || v < a[i - 1])).toBe(true);
    expect(influenceWords(order).water).toBe("Counts most");
    expect(influenceWords(order)["lower-inputs"]).toBe("Counts a little");
  });
});
