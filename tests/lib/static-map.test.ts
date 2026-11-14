import { describe, expect, test } from "vitest";
import { staticMapUrl } from "../../lib/geo/static-map";

describe("static map URL", () => {
  test("a pin is centred at zoom 14 with a marker", () => {
    const url = staticMapUrl({ type: "Point", coordinates: [95.123456789, 20.1] }, "pk.test");
    expect(url).toContain("pin-l+2e5e3a(95.12346,20.1)");
    expect(url).toContain("/95.12346,20.1,14,0/");
    expect(url).toContain("access_token=pk.test");
    // Mapbox answers 422 if padding is sent with an explicit centre.
    expect(url).not.toContain("padding");
  });

  test("an outline is drawn as styled GeoJSON that fits the view", () => {
    const url = staticMapUrl(
      {
        type: "Polygon",
        coordinates: [
          [
            [1, 1],
            [1.01, 1],
            [1.01, 1.01],
            [1, 1],
          ],
        ],
      },
      "pk.test",
    );
    expect(url).toContain("static/geojson(");
    expect(url).toContain("/auto/640x320@2x");
    expect(url).toContain("padding=48");
    expect(decodeURIComponent(url)).toContain('"fill":"#2e5e3a"');
  });
});
