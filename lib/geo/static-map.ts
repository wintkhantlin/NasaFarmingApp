import type { FieldGeometry } from "../types";

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * Mapbox Static Images URL for a field: a satellite picture with the pin or
 * outline on it. Takes a public token. Mapbox only accepts `padding` with the
 * `auto` view, so only the outline uses it.
 */
export function staticMapUrl(geometry: FieldGeometry, token: string, width = 640, height = 320): string {
  const style = "mapbox/satellite-streets-v12";
  const size = `${width}x${height}@2x`;
  const key = `access_token=${encodeURIComponent(token)}`;
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates.map(round5);
    return `https://api.mapbox.com/styles/v1/${style}/static/pin-l+2e5e3a(${lng},${lat})/${lng},${lat},14,0/${size}?${key}`;
  }
  const feature = {
    type: "Feature",
    properties: { stroke: "#fbfaf6", "stroke-width": 3, fill: "#2e5e3a", "fill-opacity": 0.35 },
    geometry: {
      type: "Polygon",
      coordinates: geometry.coordinates.map((ring) => ring.map(([x, y]) => [round5(x), round5(y)])),
    },
  };
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(feature))})`;
  return `https://api.mapbox.com/styles/v1/${style}/static/${overlay}/auto/${size}?${key}&padding=48`;
}
