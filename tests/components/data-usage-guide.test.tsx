/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DataUsageGuide } from "@/components/learn/data-usage-guide";
import { LearnHeader } from "@/components/learn/learn-header";
import { useLocaleStore } from "@/lib/store/locale-store";

describe("Data Route — What Data is Used & How Data is Used", () => {
  afterEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "en" });
  });

  it("renders LearnHeader with title and bilingual subtitle describing data usage", () => {
    useLocaleStore.setState({ locale: "en" });
    render(<LearnHeader />);
    expect(screen.getByRole("heading", { level: 1, name: "Data" })).toBeTruthy();
    expect(
      screen.getByText(/How satellite observations, soil models, and farm knowledge work together/i),
    ).toBeTruthy();
  });

  it("lists all core datasets used by Green Ally Project", () => {
    render(<DataUsageGuide />);

    expect(screen.getByText(/NASA POWER Weather & Climate/i)).toBeTruthy();
    expect(screen.getByText(/GPM IMERG Satellite Rainfall/i)).toBeTruthy();
    expect(screen.getByText(/ISRIC SoilGrids v2 Soil Properties/i)).toBeTruthy();
    expect(screen.getByText(/USGS Landsat & SRTM Elevation/i)).toBeTruthy();
    expect(screen.getByText(/Myanmar Agronomic Benchmarks & Prices/i)).toBeTruthy();
    expect(screen.getByText(/Your Farm Records \(On-Device Private\)/i)).toBeTruthy();
  });

  it("explains the 6 computational steps of how data is used", () => {
    render(<DataUsageGuide />);

    expect(screen.getByText(/Replaying 10 Years of Historical Weather/i)).toBeTruthy();
    expect(screen.getByText(/Calculating Crop Water Demand & Rainfall Shortfall/i)).toBeTruthy();
    expect(screen.getByText(/Matching Soil Properties & Land Slope Suitability/i)).toBeTruthy();
    expect(screen.getByText(/Screening Pests & Soil-Borne Disease Carryover/i)).toBeTruthy();
    expect(screen.getByText(/Modeling Economic Margins & Cash at Risk/i)).toBeTruthy();
    expect(screen.getByText(/Tailoring Rotation Rankings to Your Stated Priorities/i)).toBeTruthy();
  });

  it("allows switching sections using the segmented controller", () => {
    render(<DataUsageGuide />);
    const group = screen.getByRole("group", { name: "Select section" });
    const buttons = within(group).getAllByRole("button");

    // Click "1. What Data is Used"
    fireEvent.click(buttons[1]);
    expect(screen.getByRole("heading", { level: 3, name: "What Data is Used" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 3, name: "How Data is Used" })).toBeNull();

    // Click "2. How Data is Used"
    fireEvent.click(buttons[2]);
    expect(screen.queryByRole("heading", { level: 3, name: "What Data is Used" })).toBeNull();
    expect(screen.getByRole("heading", { level: 3, name: "How Data is Used" })).toBeTruthy();

    // Click "All Overview"
    fireEvent.click(buttons[0]);
    expect(screen.getByRole("heading", { level: 3, name: "What Data is Used" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "How Data is Used" })).toBeTruthy();
  });

  it("includes link to technical API adapter connection status", () => {
    render(<DataUsageGuide />);
    const link = screen.getByRole("link", { name: /API adapter connection status/i });
    expect(link.getAttribute("href")).toBe("/about/data");
  });

  it("supports Burmese language rendering without errors", () => {
    useLocaleStore.setState({ locale: "my" });
    render(<DataUsageGuide />);

    expect(screen.getByText(/NASA POWER မိုးလေဝသနှင့် ရာသီဥတုဒေတာ/)).toBeTruthy();
    expect(screen.getByText(/GPM IMERG ဂြိုဟ်တုမိုးရေချိန်/)).toBeTruthy();
    expect(screen.getByText(/အတိတ် ၁၀ နှစ် ရာသီဥတုဖြင့် ပြန်လည်စစ်ဆေးခြင်း/)).toBeTruthy();
  });
});
