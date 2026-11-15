import { en } from "@/lib/rotation/plan-messages";

export type Scenario = {
  proposed_crops: string[];
  status: "infeasible" | "requires_review" | "screened_plausible";
  temperature_screen: "outside_range" | "uncertain" | "within_range" | "not_applicable";
  hard_constraints: string[];
  cautions: string[];
  missing_information: string[];
  explanations: string[];
  sequence_reasoning: {
    previous_crop: string | null;
    next_crop: string;
    benefits: string[];
    risks: string[];
    unknowns: string[];
    evidence: { source: string; topic: string }[];
  }[];
  priority_coverage?: number;
  priority_alignment?: number | null;
  stages: { crop_id: string; start: string; estimated_harvest?: string | null }[];
  observations_used: { crop_id: string; month: string; temp_c: number | null; rain_mm: number | null; soil_moisture_anomaly?: number | null }[];
  evidence: { crop_id: string; source: string; type?: string }[];
  unsupported_priorities?: string[];
};

export type EngineResult = {
  scenarios: Scenario[];
  scenario_count_total: number;
  global_warnings: string[];
  input_environment_source: string | null;
  input_environment_basis: string | null;
  input_observation_period: { start_date: string; end_date: string } | null;
  input_environment_units: { temp_c: string; rain_mm: string } | null;
  input_spatial_resolution_km: number | null;
  ranking: { method: string; status_note: string };
};

export function statusText(status: Scenario["status"]) {
  if (status === "infeasible") return en.outside;
  if (status === "screened_plausible") return en.screened;
  return en.review;
}

export function temperatureScreenText(screen: Scenario["temperature_screen"]) {
  if (screen === "outside_range") return "Outside the crop’s broad temperature range in the supplied climate";
  if (screen === "uncertain") return "Temperature fit uncertain because of missing data or a possible longer growing period";
  if (screen === "within_range") return "No broad temperature-range breach found in the supplied climate";
  return "Temperature screen not applicable";
}

export function plainReason(reason: string): string {
  if (/soil pH is unknown/.test(reason)) return "Soil acidity is unknown. A field soil test would help check this crop.";
  if (/soil pH|measured soil pH|pH \d/.test(reason)) return "The soil test may be outside this crop’s broad range. Check with a local adviser.";
  if (/shorter than documented minimum|exceeds available calendar window|duration .* deadline|remaining .* days/.test(reason)) return "This crop may not have enough time to mature before your chosen end date.";
  if (/monthly mean .* outside|temperature.*outside/.test(reason)) return "The temperature may be outside this crop’s broad growing range.";
  if (/temperature observation\/estimate missing|rainfall missing|environment data/.test(reason)) return "Weather information is missing for part of this period.";
  if (/water adequacy|Irrigation access is reported/.test(reason)) return "We cannot yet tell whether this crop will have enough water.";
  if (/same botanical family/.test(reason)) return "This follows a similar crop family. Ask locally about shared pests and diseases.";
  if (/drainage differs/.test(reason)) return "This field may drain differently from the conditions this crop usually prefers.";
  if (/field drainage is unknown/.test(reason)) return "We do not yet know how well this field drains.";
  if (/Climate values are not a validated/.test(reason)) return "These climate values are not a reliable forecast for the coming season.";
  if (/grid resolution/.test(reason)) return "The climate data covers a wider area than this one field.";
  if (/cultivar|duration depends/.test(reason)) return "Check how long your own crop variety takes to mature.";
  if (/Fallow has no additional planted crop/.test(reason)) return "An unplanted field can still lose water or soil when left bare.";
  if (/Fallow vegetation and residue cover/.test(reason)) return "Tell us whether the unplanted field will keep plant cover.";
  return "More local information is needed before treating this option as suitable.";
}

export function farmerReasons(scenario: Scenario): string[] {
  const reasons = [...scenario.hard_constraints, ...scenario.cautions, ...scenario.missing_information].map(plainReason);
  return [...new Set(reasons)].slice(0, 3);
}
