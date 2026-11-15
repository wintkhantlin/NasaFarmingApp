/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FieldRiskContext } from "@/components/field/results/field-risk-context";
import { buildRiskEvidenceMap } from "@/lib/conditions/condition-evidence";
import type { Field } from "@/lib/types";

const field = { id: "f1", name: "F", centroid: [95.1, 16.8], geometry: { type: "Point", coordinates: [95.1, 16.8] }, samplePoints: [], areaHa: null, irrigation: "none", createdAt: "", updatedAt: "" } as unknown as Field;

describe("FieldRiskContext", () => {
  afterEach(cleanup);

  it("lists all four risks, links each to the map, and never reads missing data as safe", () => {
    render(<FieldRiskContext fieldId="f1" evidenceMap={buildRiskEvidenceMap({ field })} />);
    expect(screen.getByRole("heading", { name: "Field history to keep in mind" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/fields/f1/conditions?risk=water_stress",
      "/fields/f1/conditions?risk=flood",
      "/fields/f1/conditions?risk=erosion",
      "/fields/f1/conditions?risk=heat_cold",
    ]);
    expect(screen.getAllByText(/Not a sign that it is safe/).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not change their ranking/)).toBeInTheDocument();
  });
});
