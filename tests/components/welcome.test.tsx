/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import { Welcome } from "@/components/home/welcome";
import { useLocaleStore } from "@/lib/store/locale-store";

describe("Welcome", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useLocaleStore.setState({ locale: "en", areaUnit: "ha", hydrated: false });
  });

  it("uses plain consent wording, hides source names under More, and shows the font hint in English when English", () => {
    render(<Welcome />);
    expect(screen.getByText("Your field's place is sent online to get weather and soil facts.")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK, continue" })).toBeInTheDocument();
    expect(screen.getByText("If the letters look broken, change the font style in your phone settings.")).toBeInTheDocument();
    expect(screen.queryByText("စာလုံးများ ကွဲနေပါက ဖုန်းဆက်တင်တွင် စာလုံးပုံစံ (font) ပြောင်းပါ။")).toBeNull();
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learn about data" })).toHaveAttribute("href", "/about/data");
  });

  it("shows Burmese wording without English mixing when language is Burmese", () => {
    localStorage.setItem("fieldshift.locale.v1", JSON.stringify({ locale: "my", areaUnit: "ha" }));
    useLocaleStore.setState({ locale: "my", areaUnit: "ha", hydrated: true });
    render(<Welcome />);
    expect(screen.getByText("ဘာသာစကား")).toBeInTheDocument();
    expect(screen.getByText("စာလုံးများ ကွဲနေပါက ဖုန်းဆက်တင်တွင် စာလုံးပုံစံ (font) ပြောင်းပါ။")).toBeInTheDocument();
    expect(screen.queryByText("If the letters look broken, change the font style in your phone settings.")).toBeNull();
  });
});
