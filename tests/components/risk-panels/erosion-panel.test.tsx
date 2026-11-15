/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ErosionPanel } from "@/components/field/conditions/risk-panels/erosion-panel";
import { buildErosionEvidence } from "@/lib/conditions/condition-evidence";
import type { RemoteData } from "@/lib/store/data-cache";

describe("ErosionPanel", () => {
  afterEach(cleanup);

  it("displays slope degrees and steepness label when SRTM slope is available", () => {
    const remoteWithSrtm: RemoteData = {
      fieldId: "f1",
      checkedAt: "2026-11-15T00:00:00Z",
      smap: { kind: "smap", status: "unconfigured", start: "", end: "" },
      hls: { kind: "hls", status: "unconfigured", start: "", end: "" },
      srtm: {
        kind: "srtm",
        status: "ok",
        start: "2000-02-11",
        end: "2000-02-21",
        data: {
          slope: {
            medianDeg: 2.8,
            meanDeg: 2.9,
            p90Deg: 4.1,
            validCells: 100,
            totalCells: 100,
          },
        },
      },
      modis: { kind: "modis", status: "unconfigured", start: "", end: "" },
      ecostressLst: { kind: "ecostress-lst", status: "unconfigured", start: "", end: "" },
      ecostressEt: { kind: "ecostress-et", status: "unconfigured", start: "", end: "" },
    };

    const evidence = buildErosionEvidence({
      remote: remoteWithSrtm,
      point: [95.2, 16.8],
    });

    render(<ErosionPanel evidence={evidence} />);

    expect(screen.getByText("Topographic screening")).toBeInTheDocument();
    expect(screen.getByText("2.8°")).toBeInTheDocument();
    expect(screen.getByText(/Kinds of erosion this does not cover/)).toBeInTheDocument();
  });

  it("reports missing slope honestly without assigning a false low-erosion grade", () => {
    const evidence = buildErosionEvidence({
      remote: null,
      point: [95.2, 16.8],
    });

    render(<ErosionPanel evidence={evidence} />);

    expect(screen.getByText("Slope missing")).toBeInTheDocument();
    expect(
      screen.getByText(/Slope data is not available, so field erosion exposure cannot be assessed/),
    ).toBeInTheDocument();
    expect(screen.getByText(/never actual soil loss in tonnes\/ha/)).toBeInTheDocument();
    expect(screen.getByText(/No safe rating/)).toBeInTheDocument();
  });
});
