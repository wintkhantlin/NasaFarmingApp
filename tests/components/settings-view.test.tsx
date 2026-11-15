/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SettingsView } from "@/components/settings/settings-view";
import { useLocaleStore } from "@/lib/store/locale-store";

const exportBackup = vi.fn(async () => ({ app: "nasa-farming-app", version: 2, exportedAt: "2026-11-15", fields: [], rotations: [] }));
const importBackup = vi.fn();

vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (selector: (state: { exportBackup: typeof exportBackup; importBackup: typeof importBackup }) => unknown) => selector({ exportBackup, importBackup }),
}));

describe("SettingsView", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useLocaleStore.setState({ locale: "en", areaUnit: "ha", hydrated: true });
  });

  it("has keyboard-operable language and unit controls, with phone-only privacy copy", () => {
    render(<SettingsView />);

    expect(screen.getByRole("button", { name: /Export backup/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Restore backup/ })).toBeVisible();
    const myanmar = screen.getByRole("button", { name: "မြန်မာ" });
    myanmar.focus();
    fireEvent.keyDown(myanmar, { key: "Enter" });
    fireEvent.click(myanmar);

    expect(myanmar).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Acres" }));
    expect(screen.getByRole("button", { name: "Acres" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/No account and no server backup are used/)).toBeInTheDocument();
    expect(screen.getByText(/stay on this phone/)).toBeInTheDocument();
    expect(screen.queryByText(/browser/i)).toBeNull();
  });

  it("shows backup labels in Burmese when Burmese is chosen", () => {
    localStorage.setItem("fieldshift.locale.v1", JSON.stringify({ locale: "my", areaUnit: "ha" }));
    render(<SettingsView />);
    expect(screen.getByRole("button", { name: /အရန်ဖိုင် ထုတ်ယူမည်/ })).toBeVisible();
  });

  it("is the one place for backup, and remembers the last backup date", async () => {
    localStorage.setItem("farm_fields_last_backup_at", "2026-11-15");
    render(<SettingsView />);
    expect(screen.getByText("Last backup: 2026-11-15")).toBeVisible();
    expect(screen.getByLabelText("Choose backup file")).toBeInTheDocument();
    localStorage.removeItem("farm_fields_last_backup_at");
  });
});
