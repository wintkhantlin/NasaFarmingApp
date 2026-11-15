/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RotationExplorer from "@/app/(app)/plan/rotation-explorer";
import { PLAN_DRAFT_KEY } from "@/lib/store/plan-draft";

describe("Plan first-run regional preview", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("works without GPS, autosaves, and opens a non-personalized regional preview", async () => {
    render(<RotationExplorer />);

    const input = await screen.findByLabelText("Village or township");
    fireEvent.change(input, { target: { value: "Bogale" } });
    fireEvent.click(screen.getByRole("button", { name: /Ayeyarwady/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this typed place" }));

    expect(await screen.findByRole("heading", { name: "What is your main monsoon crop?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rice/ })).toHaveTextContent("ဆန်");
    fireEvent.click(screen.getByRole("button", { name: /Rice/ }));

    expect(await screen.findByText("Regional preview")).toBeInTheDocument();
    expect(screen.getByText(/We do not know your actual rotation or field conditions/)).toBeInTheDocument();
    expect(screen.queryByText(/Best choice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recommended for your field/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Your rotation$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Catalog example/)).toHaveLength(3);
    expect(screen.getAllByText("Limitation")).toHaveLength(3);
    expect(screen.getAllByText("Evidence status")).toHaveLength(3);
    expect(screen.getAllByText("Check locally")).toHaveLength(3);
    expect(fetch).not.toHaveBeenCalled();

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(PLAN_DRAFT_KEY) ?? "null");
      expect(saved).toMatchObject({
        place: { name: "Bogale", region: "ayeyarwady", source: "typed" },
        mainCropId: "rice",
      });
    });
  });

  it("returns to edit the saved area and crop selections", async () => {
    localStorage.setItem(
      PLAN_DRAFT_KEY,
      JSON.stringify({
        version: 1,
        place: { id: "typed:magway:pakokku", name: "Pakokku", context: "Magway", region: "magway", source: "typed" },
        mainCropId: "groundnut",
        updatedAt: "2026-11-15T00:00:00.000Z",
      }),
    );

    render(<RotationExplorer />);

    expect(await screen.findByText("Regional preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit main crop" }));
    expect(screen.getByRole("heading", { name: "What is your main monsoon crop?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit area" }));
    expect(screen.getByLabelText("Village or township")).toHaveValue("Pakokku");
  });
});
