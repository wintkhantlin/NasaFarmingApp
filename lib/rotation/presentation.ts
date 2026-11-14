import { en } from "@/app/plan/messages";

export type Scenario = {
  proposed_crops: string[];
  status: "infeasible" | "requires_review" | "screened_plausible";
  hard_constraints: string[];
  cautions: string[];
  missing_information: string[];
  explanations: string[];
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
  ranking: { method: string; status_note: string };
};

export function statusText(status: Scenario["status"]) {
  if (status === "infeasible") return en.outside;
  if (status === "screened_plausible") return en.screened;
  return en.review;
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

export function plainExplanation(explanation: string): string {
  if (/Different plant families/.test(explanation)) return "A different crop family may diversify the rotation. Pest effects still need a local check.";
  if (/Plant-family diversity is not demonstrated/.test(explanation)) return "This option does not show a change in crop family.";
  if (/Legume included/.test(explanation)) return "A bean crop can fix nitrogen, but this does not show a soil nutrient gain for your field.";
  if (/No planted legume/.test(explanation)) return "This option does not add a bean crop.";
  if (/Planted crops provide/.test(explanation)) return "A planted crop can keep living cover on the soil during growth. The actual benefit is unmeasured.";
  if (/Fallow cover depends/.test(explanation)) return "If the field is unplanted, soil cover depends on how you manage plants and residues.";
  return "This is a broad screening result. See Scientific details for the engine’s full explanation.";
}

export function farmerReasons(scenario: Scenario): string[] {
  const reasons = [...scenario.hard_constraints, ...scenario.cautions, ...scenario.missing_information].map(plainReason);
  return [...new Set(reasons)].slice(0, 3);
}
