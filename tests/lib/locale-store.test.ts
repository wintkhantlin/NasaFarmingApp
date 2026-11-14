/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
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
});
