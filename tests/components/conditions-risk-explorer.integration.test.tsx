/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConditionsView } from "@/components/field/conditions-view";
import type { Field } from "@/lib/types";

const mockField: Field = {
  id: "f4",
  name: "Field 4",
  areaHa: 2.5,
  centroid: [95.2, 16.8],
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [95.19, 16.79],
        [95.21, 16.79],
        [95.21, 16.81],
        [95.19, 16.81],
        [95.19, 16.79],
      ],
    ],
  },
  samplePoints: [[95.2, 16.8]],
  irrigation: "none",
  region: "ayeyarwady",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

let currentField: Field = mockField;
const storeState = () => ({
  status: "ready",
  fields: [currentField],
  rotations: {},
  load: vi.fn(),
  loadRotations: vi.fn(),
});

vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (selector: (s: ReturnType<typeof storeState>) => unknown) => selector(storeState()),
  useFieldRotations: () => [],
}));

let mockAnalysis: Record<string, unknown> = {};
vi.mock("@/lib/analysis/use-analysis", () => ({ useFieldAnalysis: () => mockAnalysis }));

vi.mock("@/components/ui/charts", () => ({
  MONTHS: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  RainWaterChart: () => <div data-testid="rain-chart" />,
  TemperatureChart: () => <div data-testid="temp-chart" />,
}));

vi.mock("@/components/field/trends-view", () => ({ TrendsView: () => null }));

const readyConditions = {
  fieldId: "f4",
  fetchedAt: "2026-11-15T00:00:00Z",
  climateAvailable: true,
  annualRainMm: 866,
  monthlyRainMm: [5, 10, 20, 60, 180, 240, 210, 190, 110, 50, 15, 5],
  monthlyEt0Mm: [95, 110, 140, 160, 150, 120, 110, 110, 105, 100, 90, 85],
  monthlyTmaxC: [31, 33, 36, 38, 35, 31, 30, 30, 31, 31, 31, 30],
  monthlyTminC: [16, 17, 21, 24, 25, 25, 24, 24, 24, 23, 20, 17],
  sources: [],
};

describe("Conditions & Four Geospatial Risks Integration", () => {
  afterEach(() => {
    cleanup();
    currentField = mockField;
  });

  it("Journey 1: Surface A displays main insight, 3 core conditions, and 4-risk entry grid before charts", () => {
    mockAnalysis = {
      phase: "ready",
      showingCache: false,
      engineData: null,
      remote: null,
      retry: vi.fn(),
      conditions: readyConditions,
    };

    const { container } = render(<ConditionsView fieldId="f4" />);

    // 1. Main finding
    expect(screen.getByRole("heading", { name: /(About 866 mm of rain a year|Most rain falls)/ })).toBeInTheDocument();

    // 2. 3 core conditions
    expect(screen.getByRole("region", { name: /Key field conditions/ })).toBeInTheDocument();
    expect(screen.getByText(/(Annual rainfall|Usual yearly rain|Yearly rain)/)).toBeInTheDocument();
    expect(screen.getByText("866")).toBeInTheDocument();
    expect(screen.getByText("Regional hottest month")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("Soil acidity")).toBeInTheDocument();

    // 3. Local check
    expect(screen.getByText(/Check on your field/)).toBeInTheDocument();

    // 4. Explore four field risks grid
    expect(screen.getByRole("heading", { name: /(Explore four field risks|Explore field vulnerabilities)/ })).toBeInTheDocument();
    expect(screen.getByText("Water stress")).toBeInTheDocument();
    expect(screen.getByText("Flood")).toBeInTheDocument();
    expect(screen.getByText("Erosion")).toBeInTheDocument();
    expect(screen.getByText("Heat & cold")).toBeInTheDocument();

    // Verify RiskEntryGrid is rendered before the rainfall chart in DOM
    const risksHeading = screen.getByRole("heading", { name: /(Explore four field risks|Explore field vulnerabilities)/ });
    const rainSection = container.querySelector('section[aria-labelledby="rain"]');
    expect(risksHeading.compareDocumentPosition(rainSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Journey 2: Seamless navigation from Surface A to Surface B (Risk Explorer) and Back", () => {
    mockAnalysis = {
      phase: "ready",
      showingCache: false,
      engineData: null,
      remote: null,
      retry: vi.fn(),
      conditions: readyConditions,
    };

    render(<ConditionsView fieldId="f4" />);

    // Click "Flood" risk tile in Surface A
    const floodButton = screen.getByRole("button", { name: /Flood/i });
    fireEvent.click(floodButton);

    // Now in Surface B (Risk Explorer)
    expect(screen.getByRole("dialog", { name: "Field Risk Explorer" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Flood/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Flood map evidence" })).toBeInTheDocument();

    // Click "Back to Conditions"
    fireEvent.click(screen.getByRole("button", { name: /Back to Conditions/ }));

    // Returned to Surface A
    expect(screen.getByRole("heading", { name: /(Explore four field risks|Explore field vulnerabilities)/ })).toBeInTheDocument();
  });

  it("Journey 3: Rapid switching between all 4 risks without stale overlay bleed", () => {
    mockAnalysis = {
      phase: "ready",
      showingCache: false,
      engineData: null,
      remote: null,
      retry: vi.fn(),
      conditions: readyConditions,
    };

    render(<ConditionsView fieldId="f4" />);

    // Open Explorer via Water Stress
    fireEvent.click(screen.getByRole("button", { name: /Water stress/i }));
    expect(screen.getByRole("region", { name: "Water stress map evidence" })).toBeInTheDocument();
    // The detail panels live under "More detail"; the sheet stays open across risks.
    fireEvent.click(screen.getByRole("button", { name: /More detail/ }));

    // Switch to Erosion
    fireEvent.click(screen.getByRole("tab", { name: /Erosion/ }));
    expect(screen.getByRole("region", { name: "Erosion map evidence" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Erosion and terrain analysis" })).toBeInTheDocument();

    // Switch to Heat & Cold
    fireEvent.click(screen.getByRole("tab", { name: /Heat & cold/ }));
    expect(screen.getByRole("region", { name: "Heat & cold map evidence" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Heat and cold evidence analysis" })).toBeInTheDocument();

    // Switch to Flood
    fireEvent.click(screen.getByRole("tab", { name: /Flood/ }));
    expect(screen.getByRole("region", { name: "Flood map evidence" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Flood and surface water analysis" })).toBeInTheDocument();
  });

  it("Journey 4: Truthful missing data gates and no invented risk scores", () => {
    mockAnalysis = {
      phase: "ready",
      showingCache: false,
      engineData: null,
      remote: null,
      retry: vi.fn(),
      conditions: readyConditions,
    };

    render(<ConditionsView fieldId="f4" />);

    // Open Flood
    fireEvent.click(screen.getByRole("button", { name: /Flood/i }));
    fireEvent.click(screen.getByRole("button", { name: /More detail/ }));

    // Must NOT state "Flood safe" or invent flood depth
    expect(screen.queryByText(/Flood safe/i)).toBeNull();
    expect(screen.queryAllByText(/depth/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No flood depth:/)).toBeInTheDocument();
    expect(screen.getByText(/Paddy water is not always flooding/)).toBeInTheDocument();

    // Switch to Erosion
    fireEvent.click(screen.getByRole("tab", { name: /Erosion/ }));
    expect(screen.getByText(/Slope data is not available, so field erosion exposure cannot be assessed/)).toBeInTheDocument();
    expect(screen.queryAllByText(/tonnes\/ha/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/never actual soil loss in tonnes\/ha/)).toBeInTheDocument();
  });

  it("Journey 5: Footprint scale badge and confirmed parcel outline are distinct", () => {
    mockAnalysis = {
      phase: "ready",
      showingCache: false,
      engineData: null,
      remote: null,
      retry: vi.fn(),
      conditions: readyConditions,
    };

    render(<ConditionsView fieldId="f4" />);
    fireEvent.click(screen.getByRole("button", { name: /Water stress/i }));

    expect(screen.getByText(/confirmed field/i)).toBeInTheDocument();
    expect(screen.queryAllByText(/Regional grid/).length).toBeGreaterThanOrEqual(1);
  });
});
