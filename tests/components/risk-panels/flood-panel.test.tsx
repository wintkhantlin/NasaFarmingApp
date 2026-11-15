/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FloodPanel } from "@/components/field/conditions/risk-panels/flood-panel";
import { buildFloodEvidence } from "@/lib/conditions/condition-evidence";
import type { RemoteData } from "@/lib/store/data-cache";

describe("FloodPanel", () => {
  afterEach(cleanup);

  it("displays valid scene date and clarity fraction when an observation exists", () => {
    const remoteWithHls: RemoteData = {
      fieldId: "f1",
      checkedAt: "2026-11-15T00:00:00Z",
      smap: { kind: "smap", status: "unconfigured", start: "", end: "" },
      hls: {
        kind: "hls",
        status: "ok",
        start: "2021-01-01",
        end: "2025-12-31",
        data: {
          observations: [
            {
              date: "2024-09-15",
              ndviMedian: 0.65,
              ndmiMedian: 0.42,
              coverage: 0.95,
              validPixels: 95,
              totalPixels: 100,
              waterPixels: 5,
            },
          ],
        },
      },
      srtm: { kind: "srtm", status: "unconfigured", start: "", end: "" },
      modis: { kind: "modis", status: "unconfigured", start: "", end: "" },
      ecostressLst: { kind: "ecostress-lst", status: "unconfigured", start: "", end: "" },
      ecostressEt: { kind: "ecostress-et", status: "unconfigured", start: "", end: "" },
    };

    const evidence = buildFloodEvidence({
      remote: remoteWithHls,
      point: [95.2, 16.8],
      selectedDate: "2024-09-15",
    });

    render(<FloodPanel evidence={evidence} />);

    expect(screen.getByText("Observed surface water")).toBeInTheDocument();
    expect(screen.getByText("15 Sep 2024")).toBeInTheDocument();
    expect(screen.getByText(/95% valid pixels/)).toBeInTheDocument();
    expect(screen.getByText(/5% of field \(5\/100 pixels\)/)).toBeInTheDocument();
  });

  it("displays clear land status when zero water pixels are detected in valid scene", () => {
    const remoteDry: RemoteData = {
      fieldId: "f1",
      checkedAt: "2026-11-15T00:00:00Z",
      smap: { kind: "smap", status: "unconfigured", start: "", end: "" },
      hls: {
        kind: "hls",
        status: "ok",
        start: "2021-01-01",
        end: "2025-12-31",
        data: {
          observations: [
            {
              date: "2024-03-10",
              ndviMedian: 0.25,
              ndmiMedian: 0.1,
              coverage: 0.98,
              validPixels: 98,
              totalPixels: 100,
              waterPixels: 0,
            },
          ],
        },
      },
      srtm: { kind: "srtm", status: "unconfigured", start: "", end: "" },
      modis: { kind: "modis", status: "unconfigured", start: "", end: "" },
      ecostressLst: { kind: "ecostress-lst", status: "unconfigured", start: "", end: "" },
      ecostressEt: { kind: "ecostress-et", status: "unconfigured", start: "", end: "" },
    };

    const evidence = buildFloodEvidence({
      remote: remoteDry,
      point: [95.2, 16.8],
      selectedDate: "2024-03-10",
    });

    render(<FloodPanel evidence={evidence} />);

    expect(screen.getByText("No surface water detected")).toBeInTheDocument();
    expect(screen.getByText("0% (0 of 100 pixels)")).toBeInTheDocument();
  });

  it("distinguishes deliberately impounded paddy water from damaging floods", () => {
    const evidence = buildFloodEvidence({
      remote: null,
      point: [95.2, 16.8],
    });

    render(<FloodPanel evidence={evidence} />);

    expect(screen.getByText(/Paddy water is not always flooding/)).toBeInTheDocument();
    expect(
      screen.getByText(/Deliberately impounded standing water in bunded rice paddies/),
    ).toBeInTheDocument();
    expect(screen.getByText(/No flood depth:/)).toBeInTheDocument();
    expect(screen.getByText(/No recurrence model:/)).toBeInTheDocument();
  });

  it("renders honest empty state when no satellite scenes exist", () => {
    const evidence = buildFloodEvidence({
      remote: null,
      point: [95.2, 16.8],
    });

    render(<FloodPanel evidence={evidence} />);

    expect(screen.getByText("No valid scene")).toBeInTheDocument();
    expect(screen.getByText(/No cloud-free optical observation was captured/)).toBeInTheDocument();
  });
});
