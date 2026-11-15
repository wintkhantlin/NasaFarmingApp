/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConditionsView } from "@/components/field/conditions-view";
import { SourceStatusPanel } from "@/components/field/conditions-panels";
import type { Field } from "@/lib/types";

const field: Field = {
  id: "f1",
  name: "Dry plot",
  areaHa: 1,
  centroid: [95.9, 20.1],
  geometry: { type: "Point", coordinates: [95.9, 20.1] },
  samplePoints: [[95.9, 20.1]],
  irrigation: "none",
  region: "magway",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

let currentField: Field = field;
const storeState = () => ({ status: "ready", fields: [currentField], rotations: {}, load: vi.fn(), loadRotations: vi.fn() });

vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (selector: (s: ReturnType<typeof storeState>) => unknown) => selector(storeState()),
  useFieldRotations: () => [],
}));

let analysis: Record<string, unknown> = {};
vi.mock("@/lib/analysis/use-analysis", () => ({ useFieldAnalysis: () => analysis }));
vi.mock("@/components/ui/charts", () => ({
  MONTHS: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  RainWaterChart: () => <div />,
  TemperatureChart: () => <div />,
}));
vi.mock("@/components/ui/risk-chip", () => ({
  RiskChip: ({ hazard = "neutral", children }: { hazard?: string; children: React.ReactNode }) => <span data-hazard={hazard}>{children}</span>,
}));
vi.mock("@/components/field/trends-view", () => ({ TrendsView: () => null }));

const ready = (tmin: number[]) => ({
  phase: "ready",
  showingCache: false,
  engineData: null,
  remote: null,
  retry: vi.fn(),
  conditions: {
    fieldId: "f1",
    fetchedAt: new Date().toISOString(),
    annualRainMm: 822,
    monthlyRainMm: [5, 5, 10, 30, 90, 120, 140, 150, 120, 60, 15, 5],
    monthlyEt0Mm: [90, 100, 140, 170, 160, 130, 120, 120, 110, 110, 90, 80],
    monthlyTmaxC: [30, 33, 37, 39, 36, 32, 31, 31, 32, 32, 31, 29],
    monthlyTminC,
    sources: [],
  },
});
const monthlyTminC = [15, 16, 20, 24, 25, 25, 24, 24, 24, 23, 19, 16];

describe("ConditionsView (S07)", () => {
  afterEach(() => {
    cleanup();
    currentField = field;
  });

  it("shows the Dry Zone rainfall caution directly under the annual rainfall headline, in amber", () => {
    analysis = ready(monthlyTminC);
    render(<ConditionsView fieldId="f1" />);
    const heading = screen.getByRole("heading", { name: /About 822 mm of rain a year/ });
    const note = screen.getByText(/In the Dry Zone, NASA POWER rain was about 51% lower/).closest("p")!;
    expect(heading.nextElementSibling).toBe(note);
    expect(note.className).toContain("bg-unknown-bg");
  });

  it("omits the Dry Zone caution outside the Dry Zone", () => {
    currentField = { ...field, region: "ayeyarwady", centroid: [95.2, 16.8] };
    analysis = ready(monthlyTminC);
    render(<ConditionsView fieldId="f1" />);
    expect(screen.queryByText(/In the Dry Zone/)).toBeNull();
  });

  it("does not repeat the headline in summary chips", () => {
    analysis = ready(monthlyTminC);
    render(<ConditionsView fieldId="f1" />);
    expect(screen.queryByText(/Rain 822 mm a year/)).toBeNull();
    expect(screen.queryByText(/Hottest: highs near/)).toBeNull();
    expect(screen.queryByText(/Coldest nights near/)).toBeNull();
  });

  it("puts the temperature panel under More detail unless a frost or heat limit is hit", () => {
    const mild = ready(monthlyTminC);
    mild.conditions.monthlyTmaxC = [24, 26, 28, 30, 30, 29, 28, 28, 28, 28, 26, 24];
    analysis = mild;
    const { container, unmount } = render(<ConditionsView fieldId="f1" />);
    const heat = () => container.querySelector("#heat");
    expect(heat()?.closest("details")).not.toBeNull();
    unmount();
    const cold = ready(monthlyTminC);
    cold.conditions.monthlyTminC = [-2, 0, 5, 10, 15, 18, 19, 19, 17, 12, 5, 1];
    cold.conditions.monthlyTmaxC = [24, 26, 28, 30, 30, 29, 28, 28, 28, 28, 26, 24];
    analysis = cold;
    const second = render(<ConditionsView fieldId="f1" />);
    expect(second.container.querySelector("#heat")?.closest("details")).toBeNull();
    expect(screen.getByText(/Frost possible: nights near -2/).getAttribute("data-hazard")).toBe("frost");
  });

  it("shows plain scope wording and no degree-based grid or ET0 jargon outside the detail disclosures", () => {
    analysis = ready(monthlyTminC);
    const { container } = render(<ConditionsView fieldId="f1" />);
    const visible = container.cloneNode(true) as HTMLElement;
    visible.querySelectorAll("details > :not(summary)").forEach((n) => n.remove());
    const text = visible.textContent ?? "";
    expect(text).toContain("This number is averaged over a wide area (about 50 km across), not your exact field.");
    expect(text).not.toContain("0.5°");
    expect(text).not.toContain("ET₀");
    expect(text).not.toMatch(/ET0/);
    expect(text).not.toContain("model estimates for a 250 m area");
    expect(text).toContain("Source: NASA weather (about 50 km), 2016–2025");
    // the raw grid stays available inside the details
    expect(container.textContent).toContain("0.5° x 0.625°");
  });

  it("warns that background satellite checks can use data, and the retry button says so", () => {
    analysis = { ...ready(monthlyTminC), retrieving: true };
    render(<ConditionsView fieldId="f1" />);
    expect(screen.getByText("Checking field photos in the background (can use data)")).toBeInTheDocument();
    cleanup();
    analysis = { ...ready(monthlyTminC), phase: "failed", conditions: null };
    render(<ConditionsView fieldId="f1" />);
    expect(screen.getByRole("button", { name: "Try again (uses a little data)" })).toBeInTheDocument();
  });

  it("lists per-source progress while loading, without skeleton-only output", () => {
    analysis = { ...ready(monthlyTminC), phase: "loading", conditions: null };
    render(<ConditionsView fieldId="f1" />);
    expect(screen.getByText(/Weather and rain for your area/)).toBeInTheDocument();
    expect(screen.getByText(/Soil map/)).toBeInTheDocument();
    expect(screen.getByText(/checking in the background/)).toBeInTheDocument();
  });
});

describe("SourceStatusPanel wording", () => {
  afterEach(cleanup);

  const unconfigured = { fieldId: "f1", fetchedAt: "2026-01-01T00:00:00Z", sources: [], imerg: { status: "unconfigured", expected: 0, covered: 0, partialDays: 0, granules: 0, days: [], error: null } };

  it("uses farmer wording instead of server or source-admin errors", () => {
    const { container } = render(<SourceStatusPanel conditions={unconfigured as never} remote={null} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Using regional NASA weather (about 50 km) while detailed satellite rainfall is unavailable.");
    expect(text).not.toMatch(/on the server|did not answer|Earthdata|login|token|credential/i);
  });

  it("shows three plain rows first and keeps acronyms inside the nested technical details", () => {
    const remote = { smap: { status: "unconfigured" }, hls: { status: "pending" }, srtm: { status: "unconfigured" }, modis: { status: "unconfigured" }, ecostressLst: { status: "unconfigured" }, ecostressEt: { status: "unconfigured" } };
    const { container } = render(<SourceStatusPanel conditions={unconfigured as never} remote={remote as never} />);
    const visible = container.cloneNode(true) as HTMLElement;
    visible.querySelectorAll("details > :not(summary)").forEach((n) => n.remove());
    const text = visible.textContent ?? "";
    expect(text).toContain("Rain detail");
    expect(text).toContain("Soil wetness");
    expect(text).toContain("Field photo");
    expect(text).toContain("This detail isn't available for your area yet.");
    expect(text).not.toMatch(/SMAP|HLS|MODIS|ECOSTRESS|IMERG/);
    expect(container.textContent).toMatch(/ECOSTRESS/);
    expect(container.textContent ?? "").not.toMatch(/Earthdata|on the server|login|token/i);
  });

  it("uses separator rows instead of stacked source cards", () => {
    const remote = { smap: { status: "unconfigured" }, hls: { status: "pending" }, srtm: { status: "unconfigured" }, modis: { status: "unconfigured" }, ecostressLst: { status: "unconfigured" }, ecostressEt: { status: "unconfigured" } };
    const { container } = render(<SourceStatusPanel conditions={unconfigured as never} remote={remote as never} />);
    const plainRows = container.querySelectorAll("section > ul:first-of-type > li");
    expect(plainRows).toHaveLength(3);
    expect(plainRows[0].className).toContain("py-3");
    expect(plainRows[0].className).not.toMatch(/rounded|border/);
    expect(container.querySelectorAll("section > details")).toHaveLength(1);
    expect(container.querySelector("section > details details")).toBeNull();
  });
});
