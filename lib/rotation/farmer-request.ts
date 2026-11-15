import cropData from "@/rotation-engine/data/crops.json";

export const cropIds = cropData.crops.map((crop) => crop.id);
export type Priority = "soil_health" | "water_conservation" | "income" | "balanced";
export type Irrigation = "yes" | "no" | "sometimes";
export type DemoId = "dryzone" | "delta";

export type FarmerRequest = {
  location: {
    kind: "farm" | "demo";
    label: string;
    lat?: number;
    lon?: number;
    demoId?: DemoId;
  };
  previousCrop: string;
  irrigation: Irrigation;
  priority: Priority;
  planning: { startDate: string; endDate: string };
  advanced?: {
    soilPh?: number | null;
    drainage?: "well" | "moderate" | "poor" | "unknown";
    equipment?: string;
    availableCrops?: string[];
  };
};

export type MonthlyCondition = {
  month: string;
  temp_c: number | null;
  rain_mm: number | null;
  soil_moisture_anomaly?: number | null;
};

export type EnvironmentSnapshot = {
  source: string;
  basis?: "synthetic" | "historical_normals" | "observed" | "forecast";
  spatial_resolution_km?: number | null;
  /** Known biases of the source at this location, from the ground-truth checks in docs/validation. */
  known_biases?: string[];
  monthly: MonthlyCondition[];
};

export function parseFarmerRequest(value: unknown): FarmerRequest {
  if (!value || typeof value !== "object") throw new Error("Please complete the farm details.");
  const input = value as FarmerRequest;
  const location = input.location;
  if (!location || !["farm", "demo"].includes(location.kind) || typeof location.label !== "string" || !location.label.trim()) {
    throw new Error("Choose a farm location or a demo farm.");
  }
  if (location.kind === "demo" && !["dryzone", "delta"].includes(location.demoId || "")) {
    throw new Error("Choose one of the available demo farms.");
  }
  if ((location.lat === undefined) !== (location.lon === undefined)) {
    throw new Error("A location needs both latitude and longitude.");
  }
  if (location.lat !== undefined && (!Number.isFinite(location.lat) || Math.abs(location.lat) > 90 || !Number.isFinite(location.lon) || Math.abs(location.lon!) > 180)) {
    throw new Error("The selected location is outside valid coordinates.");
  }
  if (!cropIds.includes(input.previousCrop)) throw new Error("Choose the crop last grown on this field.");
  if (!["yes", "no", "sometimes"].includes(input.irrigation)) throw new Error("Choose your irrigation availability.");
  if (!["soil_health", "water_conservation", "income", "balanced"].includes(input.priority)) throw new Error("Choose your main priority.");
  const start = input.planning?.startDate;
  const end = input.planning?.endDate;
  if (typeof start !== "string" || typeof end !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error("Choose valid start and end dates.");
  }
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime()) || first.toISOString().slice(0, 10) !== start || last.toISOString().slice(0, 10) !== end || first >= last || last.getTime() - first.getTime() > 730 * 86_400_000) {
    throw new Error("Choose a planting window of up to two years, with the end after the start.");
  }
  const advanced = input.advanced || {};
  if (advanced.soilPh !== undefined && advanced.soilPh !== null && (!Number.isFinite(advanced.soilPh) || advanced.soilPh < 0 || advanced.soilPh > 14)) {
    throw new Error("Soil pH must be between 0 and 14, or left unknown.");
  }
  if (advanced.drainage && !["well", "moderate", "poor", "unknown"].includes(advanced.drainage)) {
    throw new Error("Choose a valid drainage option.");
  }
  if (advanced.equipment !== undefined && (typeof advanced.equipment !== "string" || advanced.equipment.length > 200)) {
    throw new Error("Equipment notes must be under 200 characters.");
  }
  if (advanced.availableCrops !== undefined && (!Array.isArray(advanced.availableCrops) || !advanced.availableCrops.length || advanced.availableCrops.some((crop) => !cropIds.includes(crop)))) {
    throw new Error("Choose at least one available crop.");
  }
  return input;
}

export function buildEngineRequest(input: FarmerRequest, environment: EnvironmentSnapshot) {
  const priorities: Record<Priority, Record<string, number>> = {
    soil_health: { crop_diversity: 1, legume_inclusion: 1, living_cover: 1 },
    water_conservation: { water_conservation: 1 },
    income: { income: 1 },
    balanced: { crop_diversity: 1, legume_inclusion: 1, living_cover: 1, water_conservation: 1, income: 1 },
  };
  return {
    location: { label: input.location.label, lat: input.location.lat, lon: input.location.lon },
    planning: { start_date: input.planning.startDate, end_date: input.planning.endDate, max_future_crops: 1, max_results: 100 },
    history: [input.previousCrop],
    farm: {
      soil_ph: input.advanced?.soilPh ?? null,
      drainage: input.advanced?.drainage ?? "unknown",
      irrigation: input.irrigation === "yes" ? "available" : input.irrigation === "no" ? "none" : "unknown",
      available_crops: input.advanced?.availableCrops ?? cropIds,
    },
    environment,
    farmer: { priorities: priorities[input.priority] },
  };
}
