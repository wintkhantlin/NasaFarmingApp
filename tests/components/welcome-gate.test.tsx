/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WelcomeGate } from "@/components/shell/welcome-gate";
import { useSettingsStore } from "@/lib/store/settings-store";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

describe("WelcomeGate", () => {
  beforeEach(() => {
    cleanup();
    mockReplace.mockClear();
    localStorage.clear();
    useSettingsStore.setState({ hydrated: false, dataNoticeAcceptedAt: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children during SSR / initial state so segments are never dropped from rendering", () => {
    render(
      <WelcomeGate>
        <div data-testid="child-content">Protected Content</div>
      </WelcomeGate>,
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("redirects to /welcome when hydrated and dataNoticeAcceptedAt is missing", () => {
    render(
      <WelcomeGate>
        <div data-testid="child-content">Protected Content</div>
      </WelcomeGate>,
    );
    expect(mockReplace).toHaveBeenCalledWith("/welcome");
  });

  it("does not redirect when dataNoticeAcceptedAt is set", () => {
    const timestamp = "2026-11-14T12:00:00.000Z";
    localStorage.setItem(
      "fieldshift.settings.v1",
      JSON.stringify({ dataNoticeAcceptedAt: timestamp }),
    );
    useSettingsStore.setState({
      hydrated: true,
      dataNoticeAcceptedAt: timestamp,
    });
    render(
      <WelcomeGate>
        <div data-testid="child-content">Protected Content</div>
      </WelcomeGate>,
    );
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });
});
