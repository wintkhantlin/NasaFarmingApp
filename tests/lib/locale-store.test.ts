/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocaleStore } from "@/lib/store/locale-store";

describe("locale store", () => {
  beforeEach(() => {
    localStorage.clear();
    useLocaleStore.setState({ locale: "en", areaUnit: "ha", hydrated: false });
  });

  it("persists language and area units on this device", () => {
    useLocaleStore.getState().setLocale("my");
    useLocaleStore.getState().setAreaUnit("acre");

    expect(JSON.parse(localStorage.getItem("fieldshift.locale.v1") ?? "{}")).toEqual({ locale: "my", areaUnit: "acre" });

    useLocaleStore.setState({ locale: "en", areaUnit: "ha", hydrated: false });
    useLocaleStore.getState().hydrate();
    expect(useLocaleStore.getState()).toMatchObject({ locale: "my", areaUnit: "acre", hydrated: true });
  });

  it("recovers to readable defaults when local preference data is invalid", () => {
    localStorage.setItem("fieldshift.locale.v1", "not json");
    useLocaleStore.getState().hydrate();
    expect(useLocaleStore.getState()).toMatchObject({ locale: "en", areaUnit: "ha", hydrated: true });
  });

  describe("first-run language", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("starts in Burmese on a Burmese phone when nothing is saved", () => {
      vi.stubGlobal("navigator", { language: "my-MM" });
      useLocaleStore.getState().hydrate();
      expect(useLocaleStore.getState().locale).toBe("my");
    });

    it("keeps a saved choice over the phone language", () => {
      vi.stubGlobal("navigator", { language: "my-MM" });
      localStorage.setItem("fieldshift.locale.v1", JSON.stringify({ locale: "en", areaUnit: "ha" }));
      useLocaleStore.getState().hydrate();
      expect(useLocaleStore.getState().locale).toBe("en");
    });

    it("stays English for other phone languages", () => {
      vi.stubGlobal("navigator", { language: "en-US" });
      useLocaleStore.getState().hydrate();
      expect(useLocaleStore.getState().locale).toBe("en");
    });
  });
});
