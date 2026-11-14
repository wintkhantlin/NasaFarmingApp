/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsView } from "@/components/settings/settings-view";
import { useLocaleStore } from "@/lib/store/locale-store";

const exportBackup = vi.fn(async () => ({ app: "nasa-farming-app", version: 2, exportedAt: "2026-11-15", fields: [], rotations: [] }));
const importBackup = vi.fn();

vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (selector: (state: { exportBackup: typeof exportBackup; importBackup: typeof importBackup }) => unknown) => selector({ exportBackup, importBackup }),
}));

describe("SettingsView", () => {
  beforeEach(() => {
    localStorage.clear();
    useLocaleStore.setState({ areaUnit: "ha", hydrated: true });
  });

  it("has keyboard-operable unit controls, with browser-only privacy copy", () => {
    render(<SettingsView />);

    fireEvent.click(screen.getByRole("button", { name: "Acres" }));
    expect(screen.getByRole("button", { name: "Acres" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/No account and no server backup are used/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export backup/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Restore backup/ })).toBeVisible();
  });
});
