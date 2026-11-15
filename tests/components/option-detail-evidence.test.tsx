/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OptionDetail } from "@/components/field/option-detail";
import { compareRotations } from "@/lib/engine/compare";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (selector: (s: { fields: unknown[]; update: () => void }) => unknown) => selector({ fields: [], update: vi.fn() }),
}));

const field = syntheticField({ priorities: { order: ["water", "soil"], weights: {} } });

function optionFor(slots: ReturnType<typeof slot>[]) {
  const mine = rotation(field.id, slots);
  return compareRotations(engineData(field, syntheticWeather()), mine, { baseYear: 2026, now: new Date("2026-11-14T00:00:00Z") }).current;
}

describe("Option detail shows evidence, not disclaimers", () => {
  it("explains a single-crop sequence from the crop family, with its source", () => {
    render(<OptionDetail option={optionFor([slot("rice", "rice", "2026-06-01", "2026-10-15")])} rainyMonths={[]} />);
    const pest = screen.getByRole("heading", { name: /pest/i }).closest("section") as HTMLElement;
    expect(within(pest).queryByText(/no sequence to check/i)).toBeNull();
    expect(within(pest).getByText(/is grown every cycle, so pests and diseases of the .* family can carry over/)).toBeInTheDocument();
    expect(within(pest).getAllByText("Based on:").length).toBeGreaterThan(0);
  });

  it("marks a different-family pair that shares a soil disease, and names the organism", () => {
    const { container } = render(
      <OptionDetail
        option={optionFor([slot("sesame", "sesame", "2026-05-15", "2026-08-23"), slot("gram", "green-gram", "2026-08-30", "2026-11-13")])}
        rainyMonths={[]}
      />,
    );
    const pest = within(container).getByRole("heading", { name: "Pests and diseases in the sequence" }).closest("section") as HTMLElement;
    expect(within(pest).getAllByText("Shares a soil disease or pest").length).toBeGreaterThan(0);
    expect(within(pest).getAllByText("Macrophomina phaseolina").length).toBeGreaterThan(0);
  });

  it("cites rules by source and never shows 'Starting value' or 'Unknown' tags", () => {
    const { container } = render(
      <OptionDetail
        option={optionFor([slot("sesame", "sesame", "2026-05-15", "2026-08-23"), slot("gram", "green-gram", "2026-08-30", "2026-11-13")])}
        rainyMonths={[]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Starting value, not yet checked locally/);
    expect(text).not.toMatch(/Weather cannot identify a disease/);
    expect(text).not.toMatch(/\bUnknown\b/);
    expect(screen.getAllByText("Based on:").length).toBeGreaterThan(2);
  });
});
