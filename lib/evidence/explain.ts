import { isMissing, type DerivedIndicator } from "./indicator";

/**
 * Farmer-facing reading of an evidence-contract indicator. This module only describes: it never
 * changes a value, a unit, a period or a provenance field, and it invents no confidence level.
 */

/** The four kinds of evidence a farmer needs to tell apart. */
export type EvidenceClass = "farmer" | "satellite" | "model" | "missing";

/** How close to the farmer's field the number is. */
export type EvidenceScope = "field" | "regional" | "plan";

export const EVIDENCE_CLASS_LABEL: Record<EvidenceClass, { label: string; short: string }> = {
  farmer: { label: "You measured or told us", short: "Your record" },
  satellite: { label: "Satellite observation", short: "Satellite" },
  model: { label: "Model estimate", short: "Model estimate" },
  missing: { label: "Missing information", short: "Missing" },
};

export const EVIDENCE_CLASS_HELP: Record<EvidenceClass, string> = {
  farmer: "A value you entered, such as a soil test. The app shows it first and treats it as more exact for your field than any map.",
  satellite: "A reading made by an instrument on a satellite, on the days it passed over and the sky was clear. It sees the surface, not what is under it.",
  model: "A computer estimate that fills a gap between measurements, or a calculation from stated assumptions. It is not a measurement made on your field.",
  missing: "Nothing was read for this. It is not zero, and the app does not guess.",
};

export const EVIDENCE_SCOPE_LABEL: Record<EvidenceScope, string> = {
  field: "Field level",
  regional: "Regional, not your field",
  plan: "From your plan",
};

export interface IndicatorExplainer {
  evidenceClass: EvidenceClass;
  /** What kind of source it was, even when the value is missing. */
  sourceClass: Exclude<EvidenceClass, "missing">;
  scope: EvidenceScope;
  /** Plain words for the farmer. The scientific name stays in the details. */
  title: string;
  /** What it is, in a sentence. */
  meaning: string;
  /** Why it matters to farming. */
  why: string;
  /** What it cannot tell you. */
  limits: string[];
  /** "Past seasons" or "Latest clear pass": says whether the number looks back, and never forward. */
  timeframe: string;
  /** Spatial resolution in words, when it helps. */
  scale: string | null;
}

interface Topic {
  match: (i: DerivedIndicator) => boolean;
  title: string;
  meaning: string;
  why: string;
  limits: string[];
  scale?: string;
}

const has = (s: string, ...parts: string[]) => parts.some((p) => s.toLowerCase().includes(p.toLowerCase()));

const TOPICS: Topic[] = [
  {
    match: (i) => has(i.indicatorName, "rain shortfall"),
    title: "Rain compared with estimated crop water demand",
    meaning:
      "Estimated reference water demand (ET₀) is how much water a short, well-watered grass would use in the weather of the day. Multiplying it by a crop factor (Kc) for each growth stage gives the water a healthy crop could use (ETc). The figure shown is that demand minus the rain.",
    why: "It shows whether rain alone usually covers what the crop could use. A large shortfall is a sign to check your water supply, not an amount to apply.",
    limits: ["Ignores water already stored in the soil, runoff and drainage.", "Weather inputs are for a grid cell about 50 km wide."],
  },
  {
    match: (i) => (i.sourceId === "R" || has(i.variableOrLayer, "PRECTOTCORR")) && has(i.indicatorName, "rain"),
    title: "Rain in the crop season",
    meaning: "Total rain estimated for the days between planting and harvest, shown as the middle season of those on record. 1 mm is about 1 litre on each square metre.",
    why: "Rain supplies most of the water for a rain-fed crop, and dry spells or heavy rain at the wrong stage hurt yield.",
    limits: ["A grid-cell estimate, not a rain gauge on your field.", "Short, local showers can be missed."],
  },
  {
    match: (i) => has(i.indicatorName, "heat exposure"),
    title: "Seasons with very hot days",
    meaning: "How many past seasons had at least one day above the heat limit for this crop stage, using air temperature from NASA POWER.",
    why: "Heat at flowering and grain filling can reduce yield, so it helps to time planting away from the hottest weeks.",
    limits: ["A day above the limit in the data is not proof of damage in your field.", "Thresholds are starting values for the species, not for your variety."],
  },
  {
    match: (i) => i.sourceId === "M",
    title: "Regional soil wetness (root zone)",
    meaning: "A modelled estimate of how full the soil is of water down to about 1 m, as a fraction of the soil volume (m³/m³), from NASA SMAP with a land model.",
    why: "It shows whether the area around you is wetter or drier than usual, which helps explain crop stress or flooding risk.",
    limits: ["One value covers about 9 km, so it says little about your own field.", "It is not a measurement of soil water on your parcel."],
    scale: "One value covers about 9 km × 9 km",
  },
  {
    match: (i) => has(i.indicatorName, "satellite observations of the field") || (i.sourceId === "V" && !has(i.product, "MOD13")),
    title: "How many clear satellite looks at your field",
    meaning: "Number of dates on which Landsat or HLS saw your field with a clear sky. Each look can be turned into a vegetation index such as NDVI, an indicator of how green the surface is.",
    why: "More clear looks give a better picture of when crops were growing. Few looks mean the greenness history is thin.",
    limits: ["Greenness does not directly measure crop yield and does not prove a field is bare.", "Cloudy dates are left out. They are missing, not zero."],
    scale: "30 m pixels",
  },
  {
    match: (i) => i.sourceId === "T",
    title: "Slope of the ground",
    meaning: "How steeply the ground tilts, in degrees, taken from satellite height data collected in February 2000.",
    why: "Steeper land loses soil and water faster in heavy rain, so it affects which crops and cover are safer.",
    limits: ["Slope alone does not say how much soil is lost.", "It does not show changes since 2000 or small drains in your field."],
    scale: "About 30 m cells",
  },
  {
    match: (i) => has(i.product, "MOD13") || i.sourceId === "G",
    title: "Regional greenness history",
    meaning: "How many quality-screened 16-day satellite greenness composites were available. Greenness (NDVI) is an indicator of how much green vegetation covers the ground.",
    why: "It shows the long-run rhythm of green and bare periods around your field.",
    limits: ["A 250 m pixel mixes your field with neighbouring land, so it does not identify your crop.", "It does not measure crop yield."],
    scale: "250 m pixels",
  },
  {
    match: (i) => i.sourceId === "E" && has(i.variableOrLayer, "LST"),
    title: "Surface temperature on the last clear pass",
    meaning: "How warm the ground and plant surface felt to the satellite on one clear day, in °C.",
    why: "A hot surface in the afternoon can mean plants are short of water, but it is only a hint.",
    limits: ["Land-surface temperature is not air temperature and is not used for crop heat limits.", "It is one moment, not a season."],
    scale: "About 70 m pixels",
  },
  {
    match: (i) => i.sourceId === "E",
    title: "Modelled energy used for crop water loss (last clear pass)",
    meaning: "Latent heat flux in watts per square metre: the energy used to evaporate water from soil and leaves on one clear day, as modelled from ECOSTRESS.",
    why: "Higher values mean more water was leaving the surface, so the crop or soil was moist enough to evaporate.",
    limits: ["It is a model result, not measured crop water use.", "It is not converted to mm/day and is not used in the water calculation."],
    scale: "About 70 m pixels",
  },
  {
    match: (i) => i.sourceId === "farmer" && has(i.variableOrLayer, "ph"),
    title: "Soil acidity you entered",
    meaning: "The pH of your soil from your own test. Lower than 7 is acid, higher is alkaline.",
    why: "Crops take up nutrients best in a range of pH, so acid or alkaline soil can hold yields back.",
    limits: ["It describes where you sampled, so it may differ across a large field."],
  },
  {
    match: (i) => has(i.indicatorName, "covered share"),
    title: "Share of the cycle with a crop planned",
    meaning: "The part of the rotation cycle between planting and harvest dates you entered, as a percentage.",
    why: "Bare gaps leave soil open to erosion and weeds, and unused time may fit another crop.",
    limits: ["Based only on your planned dates, not on satellite cover."],
  },
  {
    match: (i) => has(i.indicatorName, "dry-season replay"),
    title: "How the plan would have done in dry past seasons",
    meaning: "The plan is replayed on the driest quarter of past years on record, and counted as passing or not.",
    why: "It shows how the plan copes when rain is poor, without pretending to know next year.",
    limits: ["A replay of history. It is not a forecast of this season."],
  },
  {
    match: (i) => has(i.indicatorName, "nitrogen fixation"),
    title: "Nitrogen that legume crops may add",
    meaning: "A published range of kilograms of nitrogen per hectare that the legume crops in the plan can add to the soil.",
    why: "Nitrogen from legumes can cut fertiliser needs for the crop that follows.",
    limits: ["A literature range for the species, not measured on your field.", "Depends on variety, soil and how well the plants nodulate."],
  },
];

const FALLBACK: Record<DerivedIndicator["kind"], Pick<Topic, "meaning" | "why" | "limits">> = {
  observation: { meaning: "A satellite reading of the surface.", why: "It gives a view of conditions on the ground that does not depend on a model.", limits: ["Only clear days are used. Gaps are not zero."] },
  "model-estimate": { meaning: "A computer estimate built from satellite and station data.", why: "It fills in where nobody measured.", limits: ["An estimate for a large area, not a measurement on your field."] },
  "farmer-report": { meaning: "A value you entered.", why: "You know your field better than any map.", limits: ["Only as exact as the way it was measured."] },
  lab: { meaning: "A test result you entered.", why: "A test on your field is more exact than any map.", limits: ["It describes where you sampled."] },
  scenario: { meaning: "A calculation from stated assumptions.", why: "It lets you compare options.", limits: ["Only as good as its assumptions."] },
};

const SOURCE_CLASS: Record<DerivedIndicator["kind"], Exclude<EvidenceClass, "missing">> = {
  observation: "satellite",
  "model-estimate": "model",
  "farmer-report": "farmer",
  lab: "farmer",
  scenario: "model",
};

/** The class of evidence a source belongs to, ignoring whether a value arrived. */
export function sourceClassOf(i: Pick<DerivedIndicator, "kind">): Exclude<EvidenceClass, "missing"> {
  return SOURCE_CLASS[i.kind] ?? "model";
}

/** The class actually shown: "missing" whenever there is no value, never a zero. */
export function evidenceClassOf(i: Pick<DerivedIndicator, "kind" | "value">): EvidenceClass {
  return isMissing(i) ? "missing" : sourceClassOf(i);
}

function scopeOf(i: DerivedIndicator): EvidenceScope {
  if (i.kind === "farmer-report" || i.kind === "lab") return "field";
  if (i.kind === "scenario" || i.sourceId === "app" || i.sourceId === "crop-library") return "plan";
  // 30 m and 70 m pixels read inside the outline are field level; the rest are grid cells or mixed pixels.
  if ((i.sourceId === "V" && !has(i.product, "MOD13")) || i.sourceId === "T" || i.sourceId === "E") return "field";
  return "regional";
}

function timeframeOf(i: DerivedIndicator): string {
  if (i.kind === "farmer-report" || i.kind === "lab") return "As you recorded it";
  if (i.sourceId === "T") return "Ground height from February 2000";
  if (i.kind === "scenario") return i.periodStart && i.periodEnd ? "Past seasons replayed, not a forecast" : "From the dates in your plan";
  if (i.sourceId === "E") return "Latest clear satellite pass, not a forecast";
  return "Past record, not a forecast";
}

export function explainIndicator(i: DerivedIndicator): IndicatorExplainer {
  const topic = TOPICS.find((t) => t.match(i));
  const fb = FALLBACK[i.kind];
  const sourceClass = sourceClassOf(i);
  return {
    evidenceClass: evidenceClassOf(i),
    sourceClass,
    scope: scopeOf(i),
    title: topic?.title ?? i.indicatorName,
    meaning: topic?.meaning ?? fb.meaning,
    why: topic?.why ?? fb.why,
    limits: topic?.limits ?? fb.limits,
    timeframe: timeframeOf(i),
    scale: topic?.scale ?? (i.nativeFootprint || null),
  };
}

/** "5.2 mm" style text. Missing is words, never "0". Original value and units are kept as they are. */
export function valueWithUnits(i: Pick<DerivedIndicator, "value" | "units">): string | null {
  if (i.value === null) return null;
  return i.units ? `${i.value} ${i.units}` : String(i.value);
}

/** "2016-06-01 to 2025-10-31", or null when the indicator has no period (static or planned data). */
export function periodText(i: Pick<DerivedIndicator, "periodStart" | "periodEnd">): string | null {
  if (i.periodStart && i.periodEnd) return i.periodStart === i.periodEnd ? i.periodStart : `${i.periodStart} to ${i.periodEnd}`;
  return null;
}

/** Short plain-language definitions for technical terms, shown wherever the term appears. */
export const TERM_HELP: Record<string, { name: string; plain: string; matters: string }> = {
  ET0: {
    name: "Reference water demand (ET₀)",
    plain: "The water a short, well-watered grass would use in the day's weather, in mm per day.",
    matters: "It is the starting point for estimating how much water a crop could use.",
  },
  NDVI: {
    name: "Satellite vegetation index (NDVI)",
    plain: "An indicator of how green the surface is, from about 0 for bare ground to near 1 for dense green plants. It does not directly measure crop yield.",
    matters: "It shows when plants were growing, but low values can also be dry residue, water or a young crop.",
  },
  LST: {
    name: "Land-surface temperature",
    plain: "How warm the ground and plants felt to the satellite. It is not the air temperature.",
    matters: "A hot surface can hint at water stress.",
  },
  SMAP: {
    name: "Regional soil wetness (SMAP)",
    plain: "Modelled soil water in the root zone over about 9 km.",
    matters: "It gives regional context for dry or wet spells.",
  },
};
