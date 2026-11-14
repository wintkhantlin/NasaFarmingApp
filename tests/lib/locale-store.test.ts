/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useLocaleStore } from "@/lib/store/locale-store";

describe("locale store", () => {
  beforeEach(() => {
    localStorage.clear();
    useLocaleStore.setState({ areaUnit: "ha", hydrated: false });
  });

  it("persists area units on this device", () => {
    useLocaleStore.getState().setAreaUnit("acre");

    expect(JSON.parse(localStorage.getItem("fieldshift.locale.v1") ?? "{}")).toEqual({ areaUnit: "acre" });

    useLocaleStore.setState({ areaUnit: "ha", hydrated: false });
    useLocaleStore.getState().hydrate();
    expect(useLocaleStore.getState()).toMatchObject({ areaUnit: "acre", hydrated: true });
  });

  it("ignores an old saved language value", () => {
    localStorage.setItem("fieldshift.locale.v1", JSON.stringify({ locale: "my", areaUnit: "acre" }));
    useLocaleStore.getState().hydrate();
    expect(useLocaleStore.getState()).toMatchObject({ areaUnit: "acre", hydrated: true });
  });

  it("recovers to readable defaults when local preference data is invalid", () => {
    localStorage.setItem("fieldshift.locale.v1", "not json");
    useLocaleStore.getState().hydrate();
    expect(useLocaleStore.getState()).toMatchObject({ areaUnit: "ha", hydrated: true });
  });
});
