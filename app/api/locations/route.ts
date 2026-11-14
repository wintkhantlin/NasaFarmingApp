import dryZone from "@/rotation-engine/examples/dryzone_demo.json";
import delta from "@/rotation-engine/examples/ayeyarwady_demo.json";
import { searchPlaces } from "@/lib/geo/geocode";

const demoLocations = [
  { id: "dryzone", kind: "demo", name: "Magway example farm", context: "Magway Region", label: "Magway example farm", lat: dryZone.location.lat, lon: dryZone.location.lon },
  { id: "delta", kind: "demo", name: "Ayeyarwady example farm", context: "Ayeyarwady Region", label: "Ayeyarwady example farm", lat: delta.location.lat, lon: delta.location.lon },
];

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length > 100) return Response.json({ error: "Search text is too long." }, { status: 400 });
  const endpoint = process.env.FIELDSHIFT_LOCATION_SEARCH_URL;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (query.length < 2 || (!endpoint && !mapboxToken)) {
    return Response.json({
      mode: "demo_only",
      locations: demoLocations.filter((place) => !query || place.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
    });
  }
  try {
    if (!endpoint && mapboxToken) {
      const places = await searchPlaces(query, mapboxToken, AbortSignal.timeout(5_000));
      return Response.json({
        mode: "connected",
        locations: places.map((place) => ({
          id: place.id,
          kind: "farm",
          name: place.name,
          context: place.context,
          label: place.context ? `${place.name}, ${place.context}` : place.name,
          lat: place.center[1],
          lon: place.center[0],
        })),
      });
    }
    const url = new URL(endpoint!);
    url.searchParams.set("q", query);
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000), cache: "no-store" });
    if (!response.ok) throw new Error("Location search is unavailable.");
    const body = await response.json();
    if (!Array.isArray(body.locations)) throw new Error("Location search returned an invalid result.");
    const locations = body.locations.slice(0, 8).map((place: { id?: unknown; name?: unknown; context?: unknown; label?: unknown; lat?: unknown; lon?: unknown }) => {
      if (typeof place.label !== "string" || !place.label.trim() || !Number.isFinite(place.lat) || !Number.isFinite(place.lon) || Math.abs(place.lat as number) > 90 || Math.abs(place.lon as number) > 180) {
        throw new Error("Location search returned an invalid place.");
      }
      const label = place.label.trim();
      const name = typeof place.name === "string" && place.name.trim() ? place.name.trim() : label.split(",")[0]?.trim() || label;
      const context = typeof place.context === "string" ? place.context.trim() : label.slice(name.length).replace(/^,\s*/, "");
      return { id: String(place.id || place.label), kind: "farm", name, context, label, lat: place.lat, lon: place.lon };
    });
    return Response.json({ mode: "connected", locations });
  } catch (error) {
    console.error("Location search failed:", error);
    return Response.json({ error: "Location search is unavailable. Use your current position or a demo farm." }, { status: 502 });
  }
}
