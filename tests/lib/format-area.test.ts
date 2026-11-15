import { describe, expect, it } from "vitest";
import { formatAreaForLocale } from "@/lib/format-area";

describe("formatAreaForLocale", () => {
  it("shows one unit only, in the unit the farmer chose", () => {
    expect(formatAreaForLocale(2.4, "ha")).toBe("2.4 ha");
    expect(formatAreaForLocale(2.4, "acre")).toBe("5.9 acres");
    expect(formatAreaForLocale(12.4, "ha")).toBe("12 ha");
  });

  it("uses Burmese unit names", () => {
    expect(formatAreaForLocale(2.4, "ha", "my")).toBe("2.4 ဟက်တာ");
    expect(formatAreaForLocale(2.4, "acre", "my")).toBe("5.9 ဧက");
  });

  it("returns an empty string when the area is unknown", () => {
    expect(formatAreaForLocale(null, "ha")).toBe("");
    expect(formatAreaForLocale(undefined, "acre", "my")).toBe("");
  });
});
