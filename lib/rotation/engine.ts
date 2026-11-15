import cropData from "@/rotation-engine/data/crops.json";
import { explainSequence, type SequenceTransition } from "./sequence-reasoning";

// Rotation screening engine. Historical example outputs are not current regression fixtures;
// test/rotation-integration.test.mjs checks this TypeScript implementation.
type Objective = "crop_diversity" | "legume_inclusion" | "living_cover" | "water_conservation" | "income";
const OBJECTIVES: Objective[] = ["crop_diversity", "legume_inclusion", "living_cover", "water_conservation", "income"];
const DAY_MS = 86_400_000;

type Crop = {
  id: string;
  name: string;
  family: string;
  legume: boolean;
  temperature_c: { optimal: [number, number]; absolute: [number, number] };
  soil_ph: { optimal: [number, number]; absolute: [number, number] };
  duration_days: [number, number];
  preferred_drainage: string[];
  sources: string[];
};
type Monthly = { month: string; temp_c?: number | null; rain_mm?: number | null; soil_moisture_anomaly?: number | null };
type Request = {
  planning: { start_date: string; end_date: string; max_future_crops?: 1 | 2; turnaround_days?: number; crop_duration_days?: Record<string, number>; include_fallow?: boolean; max_results?: number };
  history?: string[];
  location?: Record<string, unknown>;
  farm?: { available_crops?: string[]; soil_ph?: number | null; drainage?: string; irrigation?: string; fallow_management?: string; previous_residue?: "retained" | "removed" | "burned" | "grazed" | "unknown" };
  environment?: { source?: string; basis?: string; observation_period?: { start_date: string; end_date: string }; units?: { temp_c: string; rain_mm: string }; spatial_resolution_km?: number | null; known_biases?: string[]; monthly?: Monthly[] };
  farmer?: { priorities?: Partial<Record<Objective, number>>; crop_metrics?: Record<string, { additional_crop_water_use_mm?: number; net_margin_per_ha?: number }>; metrics_source?: string };
};
type Signals = Record<Objective, number | null>;
type Scenario = {
  sequence: string[];
  proposed_crops: string[];
  status: "infeasible" | "requires_review" | "screened_plausible";
  temperature_screen: "outside_range" | "uncertain" | "within_range" | "not_applicable";
  hard_constraints: string[];
  cautions: string[];
  missing_information: string[];
  stages: Record<string, unknown>[];
  observations_used: { crop_id: string; month: string; temp_c: number | null; rain_mm: number | null; soil_moisture_anomaly: number | null }[];
  signals: Signals;
  evidence: { crop_id: string; source: string; type: string }[];
  sequence_reasoning: SequenceTransition[];
  explanations: string[];
  priority_alignment?: number | null;
  priority_coverage?: number;
  unsupported_priorities?: Objective[];
};

const crops = new Map((cropData.crops as unknown as Crop[]).map((crop) => [crop.id, crop]));
if (crops.size !== cropData.crops.length) throw new Error("crop database contains duplicate crop IDs");

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseDate(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date: ${String(value)}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid date: ${value}`);
  return date;
}

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(date: Date, days: number) { return new Date(date.getTime() + days * DAY_MS); }
function rangeText(range: [number, number]) { return `[${range.join(", ")}]`; }
function phRangeText(range: [number, number]) { return `[${range.map((value) => Number.isInteger(value) ? value.toFixed(1) : String(value)).join(", ")}]`; }
function stringListText(values: string[]) { return `[${values.map((value) => `'${value}'`).join(", ")}]`; }
function within(value: number, range: [number, number]) { return value >= range[0] && value <= range[1]; }
function unique(values: string[]) { return [...new Set(values)]; }

function monthsOverlapping(start: Date, endExclusive: Date): string[] {
  if (endExclusive <= start) return [];
  const last = addDays(endExclusive, -1);
  const months: string[] = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= last) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return months;
}

function validateRequest(value: unknown): Request {
  if (!record(value) || !record(value.planning)) throw new Error("planning.start_date and planning.end_date are required");
  const req = value as Request;
  const planning = req.planning;
  const start = parseDate(planning.start_date);
  const end = parseDate(planning.end_date);
  if (start >= end) throw new Error("planning.start_date must precede planning.end_date");
  if ((end.getTime() - start.getTime()) / DAY_MS > 730) throw new Error("prototype supports at most a 730-day planning window");
  if (planning.max_future_crops !== undefined && planning.max_future_crops !== 1 && planning.max_future_crops !== 2) throw new Error("max_future_crops must be 1 or 2");
  const turnaround = planning.turnaround_days ?? 0;
  if (!Number.isInteger(turnaround) || turnaround < 0 || turnaround > 90) throw new Error("turnaround_days must be an integer between 0 and 90");
  if (req.history !== undefined && !Array.isArray(req.history)) throw new Error("history must be a list of crop IDs");
  for (const id of req.history ?? []) if (!crops.has(id)) throw new Error(`Unknown historical crop: ${id}`);
  const available = req.farm?.available_crops ?? [...crops.keys()];
  if (!Array.isArray(available)) throw new Error("available_crops must be a list of crop IDs");
  for (const id of available) if (!crops.has(id)) throw new Error(`Unknown crop ID in available_crops: ${id}`);
  const ph = req.farm?.soil_ph;
  if (ph !== undefined && ph !== null && (typeof ph !== "number" || !Number.isFinite(ph) || ph < 0 || ph > 14)) throw new Error("soil_ph must be in range 0-14");
  if (req.farm?.drainage !== undefined && !["well", "moderate", "poor", "unknown"].includes(req.farm.drainage)) throw new Error("farm.drainage must be well/moderate/poor/unknown");
  if (req.farm?.previous_residue !== undefined && !["retained", "removed", "burned", "grazed", "unknown"].includes(req.farm.previous_residue)) throw new Error("farm.previous_residue must describe recorded residue management or be unknown");
  for (const [id, days] of Object.entries(planning.crop_duration_days ?? {})) {
    if (!crops.has(id) || !Number.isInteger(days) || days <= 0) throw new Error(`Invalid crop duration for ${id}`);
  }
  for (const [name, weight] of Object.entries(req.farmer?.priorities ?? {})) {
    if (!OBJECTIVES.includes(name as Objective) || typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 100) throw new Error(`Invalid priority ${name}: ${weight}`);
  }
  const entries = req.environment?.monthly ?? [];
  if (!Array.isArray(entries)) throw new Error("environment.monthly must be a list");
  if (entries.some((row) => !record(row) || typeof row.month !== "string")) throw new Error("Every environmental row needs a valid month");
  if (new Set(entries.map((row) => row.month)).size !== entries.length) throw new Error("Duplicate environmental months");
  if (entries.length && (!req.environment?.source?.trim() || !["synthetic", "historical_normals", "observed", "forecast"].includes(req.environment.basis ?? ""))) throw new Error("Environmental values require a source and basis");
  if (req.environment?.basis === "synthetic" && !/\b(synthetic|demo|mock|fixture)\b/i.test(req.environment.source ?? "")) throw new Error("Synthetic environmental data must be clearly labeled");
  if (req.environment?.basis !== "synthetic" && /\b(synthetic|demo|mock|fixture)\b/i.test(req.environment?.source ?? "")) throw new Error("Environmental source conflicts with non-synthetic basis");
  if (req.environment?.units && (req.environment.units.temp_c !== "C" || req.environment.units.rain_mm !== "mm")) throw new Error("Environmental units must be C and mm");
  if (req.environment?.spatial_resolution_km != null && (!Number.isFinite(req.environment.spatial_resolution_km) || req.environment.spatial_resolution_km <= 0)) throw new Error("Invalid spatial resolution");
  for (const row of entries) {
    parseDate(`${row.month}-01`);
    if (row.temp_c != null && !Number.isFinite(row.temp_c)) throw new Error("temp_c must be finite");
    if (row.rain_mm !== undefined && row.rain_mm !== null && (!Number.isFinite(row.rain_mm) || row.rain_mm < 0)) throw new Error("rain_mm cannot be negative");
    if (row.soil_moisture_anomaly != null && !Number.isFinite(row.soil_moisture_anomaly)) throw new Error("soil_moisture_anomaly must be finite");
  }
  if (Object.keys(req.farmer?.crop_metrics ?? {}).length > 0 && !req.farmer?.metrics_source) throw new Error("farmer.metrics_source required when crop_metrics are provided");
  return req;
}

function buildCandidates(req: Request): string[][] {
  const allowed = unique(req.farm?.available_crops ?? [...crops.keys()]);
  const sequences = allowed.map((id) => [id]);
  if (req.planning.max_future_crops === 2) {
    const fixed = allowed.filter((id) => Object.hasOwn(req.planning.crop_duration_days ?? {}, id));
    for (const first of fixed) for (const second of fixed) sequences.push([first, second]);
  }
  if (req.planning.include_fallow !== false) sequences.unshift(["fallow"]);
  return sequences;
}

function evaluateOne(sequence: string[], req: Request): Scenario {
  const planning = req.planning;
  const farm = req.farm ?? {};
  const environment = req.environment ?? {};
  const history = req.history ?? [];
  const climate = new Map((environment.monthly ?? []).map((row) => [row.month, row]));
  const deadline = parseDate(planning.end_date);
  let current = parseDate(planning.start_date);
  const hard: string[] = [];
  const cautions: string[] = [];
  const unknowns: string[] = [];
  const evidence: Scenario["evidence"] = [];
  const stages: Scenario["stages"] = [];
  const observations: Scenario["observations_used"] = [];
  let temperatureScreen: Scenario["temperature_screen"] = sequence[0] === "fallow" ? "not_applicable" : "within_range";

  if (sequence.length === 1 && sequence[0] === "fallow") {
    stages.push({ crop_id: "fallow", start: iso(current), end: iso(deadline) });
    if ((farm.fallow_management ?? "unknown") === "unknown") unknowns.push("Fallow vegetation and residue cover are unspecified.");
    cautions.push("Fallow has no additional planted crop, but is not necessarily free from soil-water evaporation or soil erosion.");
  } else {
    for (const [index, id] of sequence.entries()) {
      const crop = crops.get(id)!;
      const [minDays, maxDays] = crop.duration_days;
      const selectedDays = planning.crop_duration_days?.[id];
      if (index > 0) current = addDays(current, planning.turnaround_days ?? 0);
      const stageStart = current;
      const daysAvailable = (deadline.getTime() - stageStart.getTime()) / DAY_MS;
      if (daysAvailable < minDays) hard.push(`${crop.name}: remaining ${daysAvailable} days shorter than documented minimum species-level cycle ${minDays} days.`);
      let plannedDays: number;
      if (selectedDays === undefined) {
        if (daysAvailable < maxDays && daysAvailable >= minDays) unknowns.push(`${crop.name}: duration depends on cultivar; species-wide range is ${minDays}-${maxDays} days and the deadline may be missed.`);
        else if (daysAvailable >= maxDays) cautions.push(`${crop.name}: broad cycle range fits the deadline, but actual cultivar duration is unverified.`);
        plannedDays = minDays;
        unknowns.push(`${crop.name}: no cultivar-specific duration; climate after the minimum cycle is possible but cannot be assigned to this variety with certainty.`);
      } else {
        plannedDays = selectedDays;
        if (selectedDays < minDays || selectedDays > maxDays) cautions.push(`${crop.name}: user-supplied duration ${selectedDays} days is outside broad ECOCROP range ${minDays}-${maxDays}; verify the variety.`);
        if (selectedDays > daysAvailable) hard.push(`${crop.name}: supplied growing duration (${selectedDays} days) exceeds available calendar window (${daysAvailable} days).`);
      }
      current = addDays(stageStart, plannedDays);
      stages.push({ crop_id: id, start: iso(stageStart), estimated_harvest: selectedDays === undefined ? null : iso(current), duration_days_used_for_screening: plannedDays, duration_is_user_supplied: selectedDays !== undefined });
      const ph = farm.soil_ph;
      if (ph === undefined || ph === null) unknowns.push(`${crop.name}: soil pH is unknown.`);
      else if (!within(ph, crop.soil_ph.absolute)) hard.push(`${crop.name}: measured soil pH ${ph} outside ECOCROP absolute envelope ${phRangeText(crop.soil_ph.absolute)}.`);
      else if (!within(ph, crop.soil_ph.optimal)) cautions.push(`${crop.name}: pH ${ph} outside broad ECOCROP optimal range ${phRangeText(crop.soil_ph.optimal)}.`);
      if (farm.drainage === undefined || farm.drainage === "unknown") unknowns.push(`${crop.name}: field drainage is unknown.`);
      else if (!crop.preferred_drainage.includes(farm.drainage)) cautions.push(`${crop.name}: ${farm.drainage} drainage differs from ECOCROP's listed preferred drainage ${stringListText(crop.preferred_drainage)}; field preparation may change suitability.`);
      const definiteEnd = addDays(stageStart, selectedDays ?? minDays);
      const possibleEnd = addDays(stageStart, selectedDays ?? maxDays);
      const months = monthsOverlapping(stageStart, possibleEnd);
      const definiteMonths = new Set(monthsOverlapping(stageStart, definiteEnd));
      if (!months.length) unknowns.push(`${crop.name}: no calendar overlap available for climate screening.`);
      for (const month of months) {
        const row = climate.get(month);
        const possibleOnly = !definiteMonths.has(month);
        if (row?.temp_c === undefined || row.temp_c === null) {
          unknowns.push(`${crop.name}: temperature observation/estimate missing for ${month}${possibleOnly ? " (possible later growing month)" : ""}.`);
          if (temperatureScreen !== "outside_range") temperatureScreen = "uncertain";
        }
        else if (!within(row.temp_c, crop.temperature_c.absolute)) {
          const reason = `${crop.name}: ${month} monthly mean ${row.temp_c}°C outside ECOCROP absolute range ${rangeText(crop.temperature_c.absolute)}°C${possibleOnly ? "; this month is within the possible longer cycle, so cultivar duration determines exposure" : ""}.`;
          if (possibleOnly) {
            unknowns.push(reason);
            if (temperatureScreen !== "outside_range") temperatureScreen = "uncertain";
          } else {
            hard.push(reason);
            temperatureScreen = "outside_range";
          }
        } else if (!within(row.temp_c, crop.temperature_c.optimal)) cautions.push(`${crop.name}: ${month} monthly mean ${row.temp_c}°C outside optimal range ${rangeText(crop.temperature_c.optimal)}°C${possibleOnly ? " during a possible longer cycle" : ""}.`);
        if (row?.rain_mm === undefined || row.rain_mm === null) unknowns.push(`${crop.name}: rainfall missing for ${month}${possibleOnly ? " (possible later growing month)" : ""}.`);
        observations.push({ crop_id: id, month, temp_c: row?.temp_c ?? null, rain_mm: row?.rain_mm ?? null, soil_moisture_anomaly: row?.soil_moisture_anomaly ?? null });
        if (row?.soil_moisture_anomaly !== undefined && row.soil_moisture_anomaly !== null && row.soil_moisture_anomaly < 0) cautions.push(`${crop.name}: supplied soil-moisture anomaly for ${month} is negative (below its chosen reference); this is contextual evidence, not proof of field water deficit.`);
      }
      evidence.push({ crop_id: id, source: crop.sources[0], type: "species-level ecological screening" });
    }
    if (farm.irrigation === undefined || farm.irrigation === "none" || farm.irrigation === "unknown") unknowns.push("Crop water adequacy cannot be determined from rainfall alone without effective rainfall, initial root-zone water, ETc and irrigation information.");
    else unknowns.push("Irrigation access is reported, but capacity and crop water demand are not validated; water adequacy remains unknown.");
    if (["observed", "historical_normals", "synthetic"].includes(environment.basis ?? "")) cautions.push("Climate values are not a validated future-season forecast; seasonal suitability is provisional.");
    if (environment.spatial_resolution_km !== undefined && environment.spatial_resolution_km !== null) cautions.push(`Environmental grid resolution ${environment.spatial_resolution_km} km is not field-scale ground truth.`);
    for (const bias of environment.known_biases ?? []) if (typeof bias === "string" && bias) cautions.push(bias);
  }

  const nonfallow = sequence.filter((id) => id !== "fallow");
  const combined = [...history, ...nonfallow];
  const transitions = combined.slice(1).map((id, i) => crops.get(combined[i])!.family !== crops.get(id)!.family);
  const diverse = transitions.length ? Number(transitions.some(Boolean)) : null;
  const management = farm.fallow_management ?? "unknown";
  const cover = nonfallow.length ? null : management === "bare" ? 0 : management === "vegetated" ? 1 : null;
  const signals: Signals = { crop_diversity: diverse, legume_inclusion: Number(nonfallow.some((id) => crops.get(id)!.legume)), living_cover: cover, water_conservation: null, income: null };
  const sequenceReasoning = explainSequence(history, sequence, crops, farm.previous_residue ?? "unknown", management);
  return {
    sequence: [...history, ...sequence], proposed_crops: sequence,
    status: hard.length ? "infeasible" : unknowns.length || cautions.length ? "requires_review" : "screened_plausible",
    temperature_screen: temperatureScreen,
    hard_constraints: unique(hard), cautions: unique(cautions), missing_information: unique(unknowns),
    stages, observations_used: observations, signals, evidence, sequence_reasoning: sequenceReasoning,
    explanations: sequenceReasoning.flatMap((step) => [...step.benefits, ...step.risks, ...step.unknowns]),
  };
}

function compareCropLists(a: string[], b: string[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

function describeCandidates(scenarios: Scenario[], req: Request) {
  const specified = req.farmer?.priorities ?? {};
  const priorities = Object.fromEntries(Object.entries(specified).filter(([, value]) => typeof value === "number" && value > 0)) as Partial<Record<Objective, number>>;
  for (const scenario of scenarios) {
    scenario.priority_alignment = null;
    scenario.priority_coverage = 0;
    scenario.unsupported_priorities = Object.keys(priorities) as Objective[];
  }
  scenarios.sort((a, b) => Number(a.status === "infeasible") - Number(b.status === "infeasible")
    || compareCropLists(a.proposed_crops, b.proposed_crops));
  return {
    method: "No scientific score or best-crop ranking is calculated. Options are grouped by known hard exclusions, then listed alphabetically. Plant-family change and legume presence are descriptive facts, not quantified soil benefits. Living cover, water savings and income remain unevaluated without field-specific comparative evidence. Supplied per-crop water or margin figures are not used because their provenance and sequence comparability cannot be verified.",
    selected_priorities: Object.keys(priorities),
    score_scale: "No score; priority_alignment is null and priority_coverage is 0 until comparable outcome evidence is available.",
    status_note: "Order within each feasibility group is alphabetical, not a recommendation. 'Requires review' means potentially suitable or uncertain, not certified feasible.",
  };
}

export function recommend(value: unknown) {
  const req = validateRequest(value);
  const scenarios = buildCandidates(req).map((sequence) => evaluateOne(sequence, req));
  const ranking = describeCandidates(scenarios, req);
  const maxResults = req.planning.max_results ?? 30;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 100) throw new Error("max_results must be 1-100");
  const environment = req.environment ?? {};
  const warnings = [
    "Prototype ecological screening, not a field-ready agricultural advisory service.",
    "ECOCROP species-level envelopes may not describe local cultivars or management practices.",
    "No validated prediction of yield, soil organic matter, nitrogen credit, pest suppression, or profitability is made.",
    "Neither rain totals nor coarse satellite soil moisture alone establish crop water adequacy.",
  ];
  if (environment.basis === "synthetic") warnings.unshift("ALL CLIMATE INPUTS ARE SYNTHETIC DEMO DATA; outputs must not be used for real farm decisions.");
  if (environment.monthly?.length && !environment.observation_period) warnings.push("Observation or forecast period was not supplied; climate timing cannot be verified.");
  if (environment.monthly?.length && !environment.units) warnings.push("Climate units were not declared; confirm temperature is °C and rainfall is mm.");
  if (environment.monthly?.length && environment.spatial_resolution_km == null) warnings.push("Environmental spatial resolution is unknown; values may not represent this field.");
  if (!environment.monthly?.length) warnings.push("No monthly environment data supplied. Climatic suitability cannot be evaluated.");
  if (!req.history?.length) warnings.push("No previous crop history given; crop-order diversity comparisons will be incomplete.");
  if (req.planning.max_future_crops === 2) warnings.push("Two-crop proposals require explicit candidate durations; crop-to-crop turnaround defaults to 0 days unless provided.");
  return {
    version: "0.1.0", location: req.location ?? {},
    input_environment_source: environment.source ?? null, input_environment_basis: environment.basis ?? null,
    input_observation_period: environment.observation_period ?? null,
    input_environment_units: environment.units ?? null,
    input_spatial_resolution_km: environment.spatial_resolution_km ?? null,
    ranking, scenarios: scenarios.slice(0, maxResults), scenario_count_total: scenarios.length,
    global_warnings: warnings,
    sources: [
      "https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/",
      "https://www.nrcs.usda.gov/sites/default/files/2022-10/National-Agronomy-Manual.pdf",
      "https://www.fao.org/4/X0490E/x0490e0a.htm",
      "https://www.fao.org/geospatial/data-and-tools/data-portals/ecocrop/en",
    ],
  };
}
