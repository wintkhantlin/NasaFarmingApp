/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { CropCalendar } from "@/components/field/crop-calendar";
import type { EvaluatedOption } from "@/lib/engine/compare";
import type { Rotation } from "@/lib/types";

function option(slots: Rotation["slots"]): EvaluatedOption {
  return {
    rotation: { id: "r", fieldId: "f", label: "r", cycleYears: 1, source: "farmer", slots },
    structure: { gaps: [] },
    lowCover: [],
    overlaps: [],
  } as unknown as EvaluatedOption;
}

const crop = (id: string, cropId: string, plantDate: string, harvestDate: string): Rotation["slots"][number] => ({
  id, kind: "crop", cropId, plantDate, harvestDate, dateConfidence: "exact", irrigated: false,
});

const pct = (el: HTMLElement, prop: "left" | "width") => parseFloat(el.style[prop]);

describe("CropCalendar year wrap", () => {
  afterEach(cleanup);

  it("splits a crop that spans the new year into Oct to Dec and Jan to Feb segments", () => {
    const { container } = render(
      <CropCalendar option={option([crop("a", "maize", "2026-05-15", "2026-09-15"), crop("b", "chickpea", "2026-10-01", "2027-02-10")])} rainyMonths={[]} />,
    );
    const rows = Array.from(container.querySelectorAll<HTMLElement>(".h-12"));
    expect(rows).toHaveLength(2); // 2026 and 2027

    const bars = (row: HTMLElement) => Array.from(row.querySelectorAll<HTMLElement>("span.absolute.top-1"));
    const first = bars(rows[0]);
    const second = bars(rows[1]);
    expect(first).toHaveLength(2); // maize + the start of chickpea
    expect(second).toHaveLength(1); // chickpea carried into the next year

    const chickpeaStart = first[1];
    expect(pct(chickpeaStart, "left")).toBeCloseTo((273 / 365) * 100, 0); // 1 Oct
    expect(pct(chickpeaStart, "left") + pct(chickpeaStart, "width")).toBeCloseTo(100, 0); // runs to 31 Dec

    const chickpeaEnd = second[0];
    expect(pct(chickpeaEnd, "left")).toBeCloseTo(0, 5); // from 1 Jan
    expect(pct(chickpeaEnd, "width")).toBeCloseTo((41 / 365) * 100, 0); // to 10 Feb
    expect(chickpeaEnd.textContent).toContain("Chickpea");
  });

  it("keeps a crop inside one year as a single segment", () => {
    const { container } = render(<CropCalendar option={option([crop("a", "maize", "2026-05-15", "2026-09-15")])} rainyMonths={[]} />);
    expect(container.querySelectorAll(".h-12")).toHaveLength(1);
    expect(container.querySelectorAll("span.absolute.top-1")).toHaveLength(1);
  });
});
