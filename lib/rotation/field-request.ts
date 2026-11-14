import cropData from "@/rotation-engine/data/crops.json";
import type { ConditionsData } from "@/lib/store/data-cache";
import type { Field, Rotation } from "@/lib/types";
import { buildEngineRequest, type FarmerRequest, type Priority } from "./farmer-request";
import { powerEnvironment } from "./power-environment";

const ids = new Set(cropData.crops.map((crop) => crop.id));
const aliases: Record<string, string> = { "green-gram": "green_gram", "black-gram": "black_gram" };
export function engineCropId(id: string): string | null {
  const mapped = aliases[id] ?? id;
  return ids.has(mapped) ? mapped : null;
}

export function lastKnownCrop(rotation: Rotation): { id: string; label: string } | null {
  const last = [...rotation.slots].filter((slot) => slot.kind !== "fallow" && slot.cropId)
    .sort((a, b) => b.harvestDate.localeCompare(a.harvestDate))[0];
  return last?.cropId ? { id: last.cropId, label: last.cropId.replaceAll("-", " ") } : null;
}

export function fieldPriority(field: Field): Priority | null {
  const first = field.priorities?.order[0];
  if (first === "soil") return "soil_health";
  if (first === "water") return "water_conservation";
  if (first === "income") return "income";
  return null;
}

export function buildFieldRequest(field: Field, rotation: Rotation, conditions: ConditionsData | null, planning: FarmerRequest["planning"]) {
  const last = lastKnownCrop(rotation);
  if (!last) throw new Error("Add a previous crop to this field before comparing next crops.");
  const previousCrop = engineCropId(last.id);
  if (!previousCrop) throw new Error(`${last.label} is not in this five-crop screening model yet. Choose a supported previous crop in your rotation.`);
  const excluded = new Set((field.constraints?.excludedCropIds ?? []).map(engineCropId).filter(Boolean));
  const preferencesNotApplied = field.constraints?.preferredCropIds ?? [];
  const availableCrops = cropData.crops.map((crop) => crop.id).filter((id) => !excluded.has(id));
  if (!availableCrops.length) throw new Error("All supported crops are excluded in this field's profile.");
  const soilPh = field.soilObservations?.filter((item) => item.property === "ph" && typeof item.value === "number" && item.method !== "soil-map")
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? field.soilOverride?.ph ?? null;
  const drainageObservation = field.soilObservations?.filter((item) => item.property === "drainage" && ["well", "moderate", "poor"].includes(String(item.value)))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const drainage = drainageObservation ? String(drainageObservation.value) as "well" | "moderate" | "poor" : "unknown";
  const irrigation = field.constraints?.irrigation?.access ?? field.irrigation;
  const priority = fieldPriority(field);
  const farmer: FarmerRequest = {
    location: { kind: "farm", label: field.name, lon: field.centroid[0], lat: field.centroid[1] },
    previousCrop,
    irrigation: irrigation === "full" ? "yes" : irrigation === "none" ? "no" : "sometimes",
    priority: priority ?? "balanced",
    planning,
    advanced: { soilPh: typeof soilPh === "number" ? soilPh : null, drainage, availableCrops },
  };
  const environment = conditions?.weather
    ? powerEnvironment(conditions.weather, planning.startDate, planning.endDate, conditions.fetchedAt)
    : { source: "NASA POWER unavailable for this field", monthly: [] };
  const request = buildEngineRequest(farmer, environment);
  if (!priority) request.farmer.priorities = {};
  return { request, preferencesNotApplied, unsupportedPriority: !priority ? field.priorities?.order[0] : null, priorityMissing: !field.priorities?.order[0] };
}
