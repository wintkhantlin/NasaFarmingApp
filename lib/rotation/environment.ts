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

function validateEnvironment(value: unknown, planning?: FarmerRequest["planning"], requireProvenance = false): EnvironmentSnapshot {
  if (!value || typeof value !== "object") throw new Error("Environmental data was not returned in the expected format.");
  const item = value as EnvironmentSnapshot;
  if (typeof item.source !== "string" || !item.source.trim() || !["synthetic", "historical_normals", "observed", "forecast"].includes(item.basis || "") || !Array.isArray(item.monthly)) {
    throw new Error("Environmental data is missing its source, basis, or monthly values.");
  }
  if (item.basis !== "synthetic" && /\b(synthetic|demo|mock|fixture)\b/i.test(item.source)) throw new Error("Environmental source conflicts with its non-synthetic basis.");
  if (item.basis === "synthetic" && !/\b(synthetic|demo|mock|fixture)\b/i.test(item.source)) throw new Error("Synthetic environmental data must be clearly labeled in its source.");
  if (requireProvenance && (item.units?.temp_c !== "C" || item.units?.rain_mm !== "mm")) throw new Error("Environmental data must declare temperature in C and rainfall in mm.");
  if (requireProvenance && !Object.hasOwn(item, "spatial_resolution_km")) throw new Error("Environmental data must declare spatial resolution, or null when unknown.");
  const period = item.observation_period;
  const validDate = (date: unknown) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (requireProvenance && (!period || !validDate(period.start_date) || !validDate(period.end_date) || period.start_date > period.end_date)) throw new Error("Environmental data needs a valid observation period.");
  if (period && (!validDate(period.start_date) || !validDate(period.end_date) || period.start_date > period.end_date)) throw new Error("Environmental observation period is invalid.");
  const seen = new Set<string>();
  for (const row of item.monthly) {
    if (!row || typeof row.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || seen.has(row.month) || !Object.hasOwn(row, "temp_c") || !Object.hasOwn(row, "rain_mm") || (row.temp_c !== null && !Number.isFinite(row.temp_c)) || (row.rain_mm !== null && (!Number.isFinite(row.rain_mm) || row.rain_mm < 0)) || (row.soil_moisture_anomaly !== undefined && row.soil_moisture_anomaly !== null && !Number.isFinite(row.soil_moisture_anomaly))) {
      throw new Error("Environmental data contains an invalid monthly value.");
    }
    seen.add(row.month);
    if (planning && (row.month < planning.startDate.slice(0, 7) || row.month > planning.endDate.slice(0, 7))) throw new Error("Environmental month lies outside the planning period.");
    if (period && (item.basis === "observed" || item.basis === "forecast") && (row.month < period.start_date.slice(0, 7) || row.month > period.end_date.slice(0, 7))) throw new Error("Environmental month lies outside its observation or forecast period.");
    if (requireProvenance && row.soil_moisture_anomaly != null && item.units?.soil_moisture_anomaly !== "unitless") throw new Error("Soil-moisture anomaly units must be declared as unitless.");
  }
  if (item.spatial_resolution_km !== undefined && item.spatial_resolution_km !== null && (!Number.isFinite(item.spatial_resolution_km) || item.spatial_resolution_km <= 0)) {
    throw new Error("Environmental data contains an invalid grid resolution.");
  }
  return item;
}

export async function resolveEnvironment(input: FarmerRequest, fetcher: typeof fetch = fetch, weatherLoader?: WeatherLoader): Promise<EnvironmentResolution> {
  if (input.location.kind === "demo") {
    const demo = demos[input.location.demoId!];
    return {
      state: "demo",
      note: "Demonstration climate only. These values are synthetic and are not observations for your farm.",
      snapshot: validateEnvironment(demo.environment, input.planning),
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
        const snapshot = validateEnvironment(powerEnvironment(result.weather, input.planning.startDate, input.planning.endDate, result.retrievedAt), input.planning, true);
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
  const snapshot = validateEnvironment(await response.json(), input.planning, true);
  const hasClimate = snapshot.monthly.some((row) => row.temp_c !== null || row.rain_mm !== null);
  return {
    state: !hasClimate ? "unavailable" : snapshot.basis === "synthetic" ? "demo" : "connected",
    note: !hasClimate
      ? "The connected data service supplied no usable temperature or rainfall values. Climate checks remain unknown."
      : snapshot.basis === "synthetic"
      ? "The connected data service supplied synthetic values. These are not real observations for this farm."
      : snapshot.basis === "historical_normals"
        ? "Historical averages from the connected service, not a forecast for the coming planting period. Check source and dates in Scientific details."
        : snapshot.basis === "observed"
          ? "Past observations from the connected service, not a forecast for the coming planting period. Check source and dates in Scientific details."
          : "Forecast from the connected service. Check its period, source and spatial resolution in Scientific details.",
    snapshot,
  };
}
