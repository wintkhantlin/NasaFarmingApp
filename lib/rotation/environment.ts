import dryZone from "@/rotation-engine/examples/dryzone_demo.json";
import delta from "@/rotation-engine/examples/ayeyarwady_demo.json";
import type { WeatherResult } from "@/lib/server/weather";
import type { EnvironmentSnapshot, FarmerRequest } from "./farmer-request";
import { powerEnvironment } from "./power-environment";

export type EnvironmentResolution = {
  state: "demo" | "connected" | "unavailable";
  note: string;
  snapshot: EnvironmentSnapshot;
};

const demos = { dryzone: dryZone, delta };
type WeatherLoader = (lat: number, lon: number, options: { signal: AbortSignal }) => Promise<WeatherResult>;

function validateEnvironment(value: unknown): EnvironmentSnapshot {
  if (!value || typeof value !== "object") throw new Error("Environmental data was not returned in the expected format.");
  const item = value as EnvironmentSnapshot;
  if (typeof item.source !== "string" || !item.source.trim() || !["synthetic", "historical_normals", "observed", "forecast"].includes(item.basis || "") || !Array.isArray(item.monthly)) {
    throw new Error("Environmental data is missing its source, basis, or monthly values.");
  }
  for (const row of item.monthly) {
    if (!row || typeof row.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || (row.temp_c !== null && !Number.isFinite(row.temp_c)) || (row.rain_mm !== null && (!Number.isFinite(row.rain_mm) || row.rain_mm < 0))) {
      throw new Error("Environmental data contains an invalid monthly value.");
    }
  }
  if (item.spatial_resolution_km !== undefined && item.spatial_resolution_km !== null && (!Number.isFinite(item.spatial_resolution_km) || item.spatial_resolution_km < 0)) {
    throw new Error("Environmental data contains an invalid grid resolution.");
  }
  if (item.known_biases !== undefined && (!Array.isArray(item.known_biases) || item.known_biases.some((b) => typeof b !== "string"))) {
    throw new Error("Environmental data contains invalid source notes.");
  }
  return item;
}

export async function resolveEnvironment(input: FarmerRequest, fetcher: typeof fetch = fetch, weatherLoader?: WeatherLoader): Promise<EnvironmentResolution> {
  if (input.location.kind === "demo") {
    const demo = demos[input.location.demoId!];
    return {
      state: "demo",
      note: "Demonstration climate only. These values are synthetic and are not observations for your farm.",
      snapshot: validateEnvironment(demo.environment),
    };
  }
  const endpoint = process.env.FIELDSHIFT_ENVIRONMENT_URL;
  if (input.location.lat === undefined || input.location.lon === undefined) {
    return {
      state: "unavailable",
      note: "Choose a location with coordinates to retrieve environmental data. Climate checks remain incomplete for this farm.",
      snapshot: { source: "No coordinates provided for environmental lookup", monthly: [] },
    };
  }
  if (!endpoint) {
    try {
      const loader = weatherLoader ?? (await import("@/lib/server/weather")).loadWeather;
      const result = await loader(input.location.lat, input.location.lon, { signal: AbortSignal.timeout(12_000) });
      if (result.weather) {
        const snapshot = validateEnvironment(powerEnvironment(result.weather, input.planning.startDate, input.planning.endDate, result.retrievedAt));
        if (snapshot.monthly.some((row) => row.temp_c !== null || row.rain_mm !== null)) {
          return {
            state: "connected",
            note: "NASA POWER historical monthly averages are available around this location. They are not a forecast for the coming planting period.",
            snapshot,
          };
        }
      }
    } catch (error) {
      console.warn("Rotation weather lookup failed:", error);
    }
    return {
      state: "unavailable",
      note: "NASA POWER weather data could not be used for this location. Climate checks remain incomplete; no demonstration values were substituted.",
      snapshot: { source: "NASA POWER weather unavailable or incomplete", monthly: [] },
    };
  }
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: { label: input.location.label, lat: input.location.lat, lon: input.location.lon },
      planning: { start_date: input.planning.startDate, end_date: input.planning.endDate },
    }),
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The environmental data service is unavailable. Please try again later.");
  const snapshot = validateEnvironment(await response.json());
  return {
    state: snapshot.basis === "synthetic" ? "demo" : "connected",
    note: snapshot.basis === "synthetic"
      ? "The connected data service supplied synthetic values. These are not real observations for this farm."
      : "Environmental data supplied by the connected data service. Check its source and date in Scientific details.",
    snapshot,
  };
}
