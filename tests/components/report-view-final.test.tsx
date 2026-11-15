/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReportView } from "@/components/field/report-view";
import { useLocaleStore } from "@/lib/store/locale-store";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const state = vi.hoisted(() => ({ field: {} as object, rotations: [] as object[], engine: null as object | null }));

vi.mock("@/lib/analysis/use-analysis", () => ({
  useFieldAnalysis: () => ({
    phase: "ready",
    engineData: state.engine,
    conditions: null,
    retrieving: false,
    showingCache: false,
    retry: vi.fn(),
  }),
}));

vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (select: (s: object) => unknown) =>
    select({ status: "ready", fields: [state.field], load: vi.fn(), loadRotations: vi.fn() }),
  useFieldRotations: () => state.rotations,
}));

function setupField4() {
  const field = syntheticField({
    name: "Field 4",
    region: "ayeyarwady",
    areaHa: 9.2,
    irrigation: "none",
    locationConfirmed: true,
    priorities: { order: ["water"], weights: {} },
    localNotes: "Water check: well is at 16.840, 95.120 near the secondary ditch.",
  });
  state.field = field;
  state.rotations = [
    {
      ...rotation(field.id, [
        slot("s1", "rice", "2026-06-15", "2026-10-15"),
        slot("s2", "black-gram", "2026-11-01", "2027-02-15"),
      ]),
      source: "farmer",
    },
  ];
  state.engine = engineData(field, syntheticWeather());
  return field;
}

afterEach(() => {
  cleanup();
  useLocaleStore.setState({ locale: "en", areaUnit: "ha" });
});

describe("ReportView Farmer-First Hierarchy & Components", () => {
  it("renders the 6 required farmer-first zones in order", () => {
    setupField4();
    render(<ReportView fieldId="f1" />);

    // Zone A: Header
    expect(screen.getAllByRole("heading", { level: 1, name: "Field 4" })).toHaveLength(2);
    expect(screen.getByRole("checkbox", { name: /Hide exact location/ })).toBeInTheDocument();

    // Zone B: Key Finding
    expect(screen.getAllByRole("heading", { level: 2, name: /What we found/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Your priority: Save water/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Why this finding\?/)).toBeInTheDocument();

    // Zone C: Choice Comparison
    expect(screen.getAllByRole("heading", { level: 2, name: "Compare crop sequences" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Current rotation").length).toBeGreaterThanOrEqual(1);

    // Zone D: Check Locally
    expect(screen.getAllByRole("heading", { level: 2, name: /Before you decide/ }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Does the soil stay moist long enough after rice harvest\?/).length).toBeGreaterThanOrEqual(1);

    // Zone E: Evidence Footer
    expect(screen.getAllByRole("heading", { level: 2, name: "How we checked" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Weather comparison: 10 complete historical years/).length).toBeGreaterThanOrEqual(1);

    // Zone F: Actions
    expect(screen.getByRole("button", { name: "Print or save as PDF" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to compare" })).toBeInTheDocument();
  });

  it("toggles expandable details on choice rows with aria-expanded", () => {
    setupField4();
    render(<ReportView fieldId="f1" />);

    const detailsButtons = screen.getAllByRole("button", { name: /View details/ });
    expect(detailsButtons.length).toBeGreaterThanOrEqual(1);

    const firstBtn = detailsButtons[0];
    expect(firstBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(firstBtn);
    expect(firstBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText(/Crop in field/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(firstBtn);
    expect(firstBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("enforces location privacy toggle across screen and print views", () => {
    const field = setupField4();
    const { container } = render(<ReportView fieldId="f1" />);

    const checkbox = screen.getByRole("checkbox", { name: /Hide exact location/ });
    expect(checkbox).not.toBeChecked();

    // Coordinates visible when unchecked
    expect(container.textContent?.toLowerCase()).toContain("confirmed by you");
    expect(container.textContent).toContain("16.840, 95.120");

    // Toggle on
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // Coordinates redacted
    expect(container.textContent).toContain("Hidden. Region only");
    expect(container.textContent).toContain("[location hidden]");
    expect(container.textContent).not.toContain("16.840, 95.120");
  });

  it("renders dedicated A4 print layout in DOM with complete comparison table", () => {
    setupField4();
    const { container } = render(<ReportView fieldId="f1" />);

    const printArticle = container.querySelector("article.hidden.print\\:flex");
    expect(printArticle).toBeInTheDocument();

    // Check table headers in print view
    const printTable = printArticle?.querySelector("table");
    expect(printTable).toBeInTheDocument();
    expect(printArticle?.textContent).toContain("Sequence");
    expect(printArticle?.textContent).toContain("Modelled shortfall");
    expect(printArticle?.textContent).toContain("Screening status");

    // Check print local checks
    expect(printArticle?.textContent).toContain("Before you decide");
    expect(printArticle?.textContent).toContain("Does the soil stay moist long enough after rice harvest?");
  });

  it("switches to Myanmar locale and displays correct Unicode strings without crash", () => {
    setupField4();
    useLocaleStore.setState({ locale: "my" });

    render(<ReportView fieldId="f1" />);

    expect(screen.getAllByRole("heading", { level: 2, name: "စိစစ်တွေ့ရှိချက်" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("heading", { level: 2, name: "သီးလှည့်စိုက်ပျိုးမှုများ နှိုင်းယှဉ်ချက်" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("heading", { level: 2, name: /သင်မဆုံးဖြတ်မီ ဆန်းစစ်ရန်/ }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("heading", { level: 2, name: "စစ်ဆေးတွက်ချက်ပုံ အထောက်အထား" }).length).toBeGreaterThanOrEqual(1);
  });
});
