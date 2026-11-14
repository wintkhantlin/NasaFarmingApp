import { describe, expect, test } from "vitest";
import { geocodeUrl, parseGeocode } from "../../lib/geo/geocode";

const response = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [94.93, 20.15] },
      properties: {
        mapbox_id: "dXJuOm1ieHBsYzpB",
        name: "Magway",
        place_formatted: "Magway Region, Myanmar",
        bbox: [94.8, 20.0, 95.1, 20.3],
      },
    },
    { type: "Feature", geometry: { type: "Point", coordinates: [10, 20] }, properties: { name: "No bbox" } },
    { type: "Feature", geometry: { type: "Point", coordinates: ["x", 1] }, properties: { name: "Bad" } },
    { type: "Feature", properties: {} },
  ],
};

describe("geocoding", () => {
  test("builds a v6 forward request", () => {
    const url = geocodeUrl("  Magway ", "pk.test");
    expect(url).toContain("/search/geocode/v6/forward");
    expect(url).toContain("q=Magway");
    expect(url).toContain("access_token=pk.test");
  });

  test("parses places, keeping the bbox when there is one", () => {
    const places = parseGeocode(response);
    expect(places).toHaveLength(2);
    expect(places[0]).toMatchObject({ name: "Magway", context: "Magway Region, Myanmar", center: [94.93, 20.15] });
    expect(places[0].bbox).toEqual([94.8, 20, 95.1, 20.3]);
    expect(places[1].bbox).toBeNull();
  });

  test("anything unexpected gives no places instead of throwing", () => {
    expect(parseGeocode(null)).toEqual([]);
    expect(parseGeocode({ features: "nope" })).toEqual([]);
  });
});
