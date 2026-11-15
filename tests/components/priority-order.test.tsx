// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PriorityOrder, influenceWords, orderSummary } from "@/components/field/priority-order";
import { priorityWeights } from "@/lib/engine/mcda";
import type { PriorityId } from "@/lib/types";

afterEach(cleanup);

let latest: PriorityId[] = [];
function Harness({ start = [] as PriorityId[] }) {
  const [order, setOrder] = useState<PriorityId[]>(start);
  latest = order;
  return <PriorityOrder value={order} onChange={setOrder} />;
}

describe("PriorityOrder", () => {
  test("adds priorities in the order chosen and reports the summary", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add: Save water" }));
    fireEvent.click(screen.getByRole("button", { name: "Add: Earn more" }));
    expect(latest).toEqual(["water", "income"]);
    expect(screen.getByText("Save water counts most, then earn more.")).toBeTruthy();
  });

  test("keyboard buttons reorder and remove, and announce the change", () => {
    render(<Harness start={["water", "soil", "income"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move up: Earn more" }));
    expect(latest).toEqual(["water", "income", "soil"]);
    expect((screen.getByRole("button", { name: "Move up: Save water" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Earn more is now second");
    fireEvent.click(screen.getByRole("button", { name: "Remove: Improve soil" }));
    expect(latest).toEqual(["water", "income"]);
  });

  test("drag and drop moves a card to the target place", () => {
    render(<Harness start={["water", "soil", "income"]} />);
    const items = screen.getAllByRole("listitem").filter((el) => el.getAttribute("draggable") === "true");
    fireEvent.dragStart(items[2]);
    fireEvent.drop(items[0]);
    expect(latest).toEqual(["income", "water", "soil"]);
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
