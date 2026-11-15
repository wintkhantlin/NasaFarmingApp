import cropData from "@/rotation-engine/data/crops.json";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { Field, Rotation } from "@/lib/types";
import { buildEngineRequest, type FarmerRequest, type Priority } from "./farmer-request";
import { existingDataEnvironment } from "./existing-data";

const ids = new Set(cropData.crops.map((crop) => crop.id));
const aliases: Record<string, string> = { "green-gram": "green_gram", "black-gram": "black_gram" };
export function engineCropId(id: string): string | null {
  const mapped = aliases[id] ?? id;
  return ids.has(mapped) ? mapped : null;
}

export function lastKnownCrop(rotation: Rotation): { id: string; label: string; residue?: "retained" | "removed" | "burned" | "grazed" } | null {
  const last = [...rotation.slots].filter((slot) => slot.kind !== "fallow" && slot.cropId)
    .sort((a, b) => b.harvestDate.localeCompare(a.harvestDate))[0];
  return last?.cropId ? { id: last.cropId, label: last.cropId.replaceAll("-", " "), residue: last.residue } : null;
}

export function fieldPriority(field: Field): Priority | null {
  const first = field.priorities?.order[0];
  if (first === "soil") return "soil_health";
  if (first === "water") return "water_conservation";
  if (first === "income") return "income";
  return null;
}

export function buildFieldRequest(field: Field, rotation: Rotation, conditions: ConditionsData | null, planning: FarmerRequest["planning"], remote: RemoteData | null = null, choices?: Pick<FarmerRequest, "previousCrop" | "irrigation" | "priority" | "advanced">) {
  const last = lastKnownCrop(rotation);
  if (!last) throw new Error("Add a previous crop to this field before comparing next crops.");
  const previousCrop = choices?.previousCrop ?? engineCropId(last.id);
  if (!previousCrop) throw new Error(`${last.label} is not among the crops this check covers yet. Choose a supported previous crop in your rotation.`);
  const recorded = [...rotation.slots].filter((slot) => slot.kind !== "fallow" && slot.cropId).sort((a, b) => a.harvestDate.localeCompare(b.harvestDate));
  const historyNotApplied = recorded.slice(0, -1).filter((slot) => !engineCropId(slot.cropId!)).map((slot) => slot.cropId!);
  const supportedEarlier = recorded.slice(0, -1).map((slot) => engineCropId(slot.cropId!)).filter((id): id is string => id !== null);
  const excluded = new Set((field.constraints?.excludedCropIds ?? []).map(engineCropId).filter(Boolean));
  const preferencesNotApplied = field.constraints?.preferredCropIds ?? [];
  const availableCrops = (choices?.advanced?.availableCrops ?? cropData.crops.map((crop) => crop.id)).filter((id) => !excluded.has(id));
  if (!availableCrops.length) throw new Error("All supported crops are excluded in this field's profile.");
  const soilPh = field.soilObservations?.filter((item) => item.property === "ph" && typeof item.value === "number" && ["laboratory", "field-kit"].includes(item.method))
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? field.soilOverride?.ph ?? null;
  const drainageObservation = field.soilObservations?.filter((item) => item.property === "drainage" && ["well", "moderate", "poor"].includes(String(item.value)))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const drainage = drainageObservation ? String(drainageObservation.value) as "well" | "moderate" | "poor" : "unknown";
  const irrigation = field.constraints?.irrigation?.access ?? field.irrigation;
  const priority = fieldPriority(field);
  const farmer: FarmerRequest = {
    location: { kind: "farm", label: field.name, lon: field.centroid[0], lat: field.centroid[1] },
    previousCrop,
    irrigation: choices?.irrigation ?? (irrigation === "full" ? "yes" : irrigation === "none" ? "no" : "sometimes"),
    priority: choices?.priority ?? priority ?? "balanced",
    planning,
    advanced: { soilPh: choices?.advanced?.soilPh !== undefined ? choices.advanced.soilPh : typeof soilPh === "number" ? soilPh : null, drainage: choices?.advanced?.drainage ?? drainage, equipment: choices?.advanced?.equipment, availableCrops, previousResidue: last.residue ?? "unknown" },
  };
  const environment = existingDataEnvironment(conditions?.fieldId === field.id ? conditions : null, remote?.fieldId === field.id ? remote : null, planning);
  const request = buildEngineRequest(farmer, environment);
  request.history = [...supportedEarlier, previousCrop];
  if (!priority && !choices) request.farmer.priorities = {};
  return { request, preferencesNotApplied, historyNotApplied, unsupportedPriority: !priority && !choices ? field.priorities?.order[0] : null, priorityMissing: !choices && !field.priorities?.order[0] };
}
