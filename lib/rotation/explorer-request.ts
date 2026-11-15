import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { Field } from "@/lib/types";
import { existingDataEnvironment } from "./existing-data";
import { buildEngineRequest, type FarmerRequest } from "./farmer-request";

/** A location can enter the saved-field data pipeline without being stored as a farm. */
export function unsavedLocationField(input: FarmerRequest["location"], irrigation: FarmerRequest["irrigation"]): Field | null {
  if (input.kind !== "farm" || input.lat === undefined || input.lon === undefined) return null;
  const point: [number, number] = [input.lon, input.lat];
  const createdAt = new Date().toISOString();
  return {
    id: `explore-${input.lat.toFixed(5)}-${input.lon.toFixed(5)}`,
    name: input.label,
    geometry: { type: "Point", coordinates: point },
    areaHa: null,
    centroid: point,
    samplePoints: [point],
    irrigation: irrigation === "yes" ? "full" : irrigation === "no" ? "none" : "supplemental",
    locationConfirmed: false,
    createdAt,
    updatedAt: createdAt,
  };
}

export function buildLocationRequest(input: FarmerRequest, conditions: ConditionsData | null, remote: RemoteData | null) {
  const field = unsavedLocationField(input.location, input.irrigation);
  const environment = existingDataEnvironment(
    field && conditions?.fieldId === field.id ? conditions : null,
    field && remote?.fieldId === field.id ? remote : null,
    input.planning,
  );
  return buildEngineRequest(input, environment);
}
