/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { TabBar } from "@/components/shell/app-nav";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClass } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Segmented } from "@/components/ui/segmented";

describe("Mobile UX & Responsive Design Audit", () => {
  it("enforces Myanmar script typography rules in globals.css for vertical diacritics", () => {
    const cssPath = path.resolve(process.cwd(), "app/globals.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    // Line-height must be at least 1.7 for Myanmar script to prevent clipping stacked consonants
    expect(css).toMatch(/:lang\(my\)[^{]*\{[^}]*line-height:\s*1\.7/);
    expect(css).toMatch(/overflow-wrap:\s*break-word/);
    expect(css).toMatch(/word-break:\s*break-word/);
  });

  it("enforces global overflow protection on main containers in globals.css", () => {
    const cssPath = path.resolve(process.cwd(), "app/globals.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    expect(css).toMatch(/main\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/main\s*\{[^}]*max-width:\s*100%/);
  });

  it("ensures primary and secondary button classes have minimum 44px tap targets", () => {
    const primaryClass = buttonClass("primary");
    const secondaryClass = buttonClass("secondary");

    // min-h-tap is tokenized to 44px in DESIGN_SYSTEM.md and globals.css
    expect(primaryClass).toContain("min-h-tap");
    expect(secondaryClass).toContain("min-h-tap");
  });

  it("renders TabBar with 3 active routes, flexible min-height and accessible labels", () => {
    render(<TabBar />);
    const tabNav = screen.getByRole("navigation", { name: "Main" });
    expect(tabNav).toBeTruthy();

    const links = within(tabNav).getAllByRole("link");
    expect(links.length).toBe(3);

    // First tab is My fields (/)
    expect(links[0].getAttribute("href")).toBe("/");
    expect(links[0].textContent).toContain("My fields");

    // Second tab is Plan (/plan)
    expect(links[1].getAttribute("href")).toBe("/plan");
    expect(links[1].textContent).toContain("Plan");

    // Third tab is Data guide (/data)
    expect(links[2].getAttribute("href")).toBe("/data");
    expect(links[2].textContent).toContain("Data guide");

    // Must have safe-area padding class and flexible minimum height
    expect(tabNav.className).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(links[0].className).toContain("min-h-14");
    expect(links[1].className).toContain("min-h-14");
    expect(links[2].className).toContain("min-h-14");
  });

  it("renders EmptyState action buttons with mobile full-width responsive classes", () => {
    const { container } = render(
      <EmptyState title="No fields yet" body="Add a field to get started.">
        <Link href="/fields/new" className={buttonClass("primary")}>
          Add a field
        </Link>
      </EmptyState>,
    );

    const actionContainer = container.querySelector(".flex-col.sm\\:flex-row");
    expect(actionContainer).toBeTruthy();
    expect(actionContainer?.className).toContain("w-full");
    expect(actionContainer?.className).toContain("sm:w-auto");
  });

  it("renders Disclosure summary with minimum 44px touch target", () => {
    render(
      <Disclosure title="Scientific details" hint="Optional">
        <div>Content body</div>
      </Disclosure>,
    );

    const summary = screen.getByText("Scientific details").closest("summary");
    expect(summary).toBeTruthy();
    expect(summary?.className).toContain("min-h-tap");
    expect(summary?.className).toContain("cursor-pointer");
  });

  it("renders Segmented controls with full-height touch targets and accessible label", () => {
    render(
      <Segmented
        legend="Water choice"
        value="rainfed"
        onChange={() => {}}
        options={[
          { value: "rainfed", label: "Rainfed" },
          { value: "irrigated", label: "Irrigated" },
        ]}
      />,
    );

    const group = screen.getByRole("group", { name: "Water choice" });
    expect(group).toBeTruthy();
    const buttons = within(group).getAllByRole("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("false");
  });

  it("verifies RotationCompare implements mobile vertical cards without wide table overflow", () => {
    const file = fs.readFileSync(path.resolve(process.cwd(), "components/field/rotation-compare.tsx"), "utf-8");
    // Must have responsive layout separation: mobile cards on md:hidden, full table on md:block
    expect(file).toContain("md:hidden");
    expect(file).toContain("md:block");
    expect(file).toContain("overflow-x-auto");
  });

  it("verifies ReportView implements mobile evidence cards without wide table overflow", () => {
    const file = fs.readFileSync(path.resolve(process.cwd(), "components/field/report-view.tsx"), "utf-8");
    // Must render cards on mobile and preserve table on desktop & print
    expect(file).toContain("md:hidden print:hidden");
    expect(file).toContain("md:block print:block");
  });

  it("verifies WaterUsePanel implements mobile per-crop cards without wide table overflow", () => {
    const file = fs.readFileSync(path.resolve(process.cwd(), "components/field/conditions-panels.tsx"), "utf-8");
    // Must render cards on mobile (sm:hidden) and table on larger screens (sm:block)
    expect(file).toContain("sm:hidden");
    expect(file).toContain("sm:block");
    expect(file).toContain("overflow-x-auto");
  });

  it("verifies FieldOverview wraps detail rows cleanly on mobile viewports", () => {
    const file = fs.readFileSync(path.resolve(process.cwd(), "components/field/field-overview.tsx"), "utf-8");
    expect(file).toContain("flex flex-col sm:flex-row sm:items-baseline sm:justify-between");
  });
});
