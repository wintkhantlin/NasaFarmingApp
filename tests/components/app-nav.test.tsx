/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SettingsButton, TabBar } from "@/components/shell/app-nav";
import { useLocaleStore } from "@/lib/store/locale-store";

describe("Settings sheet", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useLocaleStore.setState({ locale: "en", areaUnit: "ha", hydrated: false });
  });

  it("offers language and area unit as radio choices, not tap-to-flip rows", () => {
    render(<SettingsButton />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    const unit = screen.getByRole("group", { name: "Area unit" });
    expect(screen.getByRole("radio", { name: "Hectares" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Acres" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Acres" }));
    expect(useLocaleStore.getState().areaUnit).toBe("acre");
    expect(unit).toBeInTheDocument();

    expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "မြန်မာ" }));
    expect(useLocaleStore.getState().locale).toBe("my");
    // The whole sheet is now Burmese, including the gear button's label.
    expect(screen.getByRole("button", { name: "ဆက်တင်" })).toBeInTheDocument();
  });

  it("is fully Burmese when the language is Burmese", () => {
    localStorage.setItem("fieldshift.locale.v1", JSON.stringify({ locale: "my", areaUnit: "acre" }));
    render(
      <>
        <SettingsButton />
        <TabBar />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "ဆက်တင်" }));
    expect(screen.getByRole("radio", { name: "ဧက" })).toBeChecked();
    expect(screen.getByRole("button", { name: "ပြီးပြီ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ဆက်တင်အပြည့်အစုံ/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "အဓိကမီနူး" })).toBeInTheDocument();
    expect(screen.getByText("အချက်အလက် လမ်းညွှန်")).toBeInTheDocument();
    expect(screen.queryByText("Settings")).toBeNull();
    expect(screen.queryByText("Done")).toBeNull();
  });
});
