import { describe, expect, it } from "vitest";
import { disambiguatePlaces } from "@/lib/plan/place-selection";
import {
  resolveRegionalPreview,
  type RegionalPreviewCatalog,
} from "@/lib/plan/regional-preview";

const catalog = (entries: RegionalPreviewCatalog["entries"]): RegionalPreviewCatalog => ({
  version: "test-catalog-v1",
  cropLibraryVersion: "test-crops-v1",
  entries,
});

describe("regional preview catalog", () => {
  it("returns templates-unavailable when a valid crop has no catalog entries", () => {
    const result = resolveRegionalPreview("ayeyarwady", "rice", catalog({}));

    expect(result.availability).toBe("templates-unavailable");
    expect(result.patterns).toEqual([]);
    expect(result.message).toContain("will not fill the gap");
  });

  it("returns exactly two source templates as a fewer-patterns result", () => {
    const result = resolveRegionalPreview(
      "magway",
      "groundnut",
      catalog({
        magway: {
          groundnut: [
            { templateId: "mg-groundnut-chickpea" },
            { templateId: "mg-groundnut-green-gram" },
          ],
        },
      }),
    );

    expect(result.availability).toBe("fewer-patterns");
    expect(result.patterns.map((pattern) => pattern.id)).toEqual([
      "mg-groundnut-chickpea",
      "mg-groundnut-green-gram",
    ]);
    expect(result.message).toContain("2 supported patterns");
  });

  it("rejects a crop that is unsupported for the selected region", () => {
    const result = resolveRegionalPreview("magway", "rice");

    expect(result.availability).toBe("invalid-crop");
    expect(result.patterns).toHaveLength(0);
  });
});

describe("place disambiguation", () => {
  it("keeps duplicate place names distinct with visible township context", () => {
    const places = disambiguatePlaces([
      { id: "one", name: "Nyaungdon", context: "Nyaungdon Township", lat: 17.04, lon: 95.64 },
      { id: "two", name: "Nyaungdon", context: "Maubin Township", lat: 16.73, lon: 95.66 },
    ]);

    expect(places.map((place) => place.displayLabel)).toEqual([
      "Nyaungdon — Nyaungdon Township",
      "Nyaungdon — Maubin Township",
    ]);
  });
});
