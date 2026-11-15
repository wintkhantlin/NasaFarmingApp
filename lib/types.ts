import type { DerivedIndicator } from "./evidence/indicator";

/**
 * Domain model for the rotation planner. Plain TypeScript types for now;
 * runtime validation (zod) is added when the dependency is installed.
 */

export type LngLat = [lng: number, lat: number];

export type FieldGeometry =
  | { type: "Point"; coordinates: LngLat }
  | { type: "Polygon"; coordinates: LngLat[][] };

export type Irrigation = "none" | "supplemental" | "full";

export type TextureClass =
  | "clay"
  | "silty clay"
  | "sandy clay"
  | "clay loam"
  | "silty clay loam"
  | "sandy clay loam"
  | "loam"
  | "silt loam"
  | "silt"
  | "sandy loam"
  | "loamy sand"
  | "sand";

/** Values the farmer measured or knows; they override modelled values. */
export interface SoilOverride {
  ph?: number;
  texture?: TextureClass;
  ocPct?: number;
  salinityDsM?: number;
  testedOn?: string;
}

export type RegionId = "ayeyarwady" | "magway" | "shan" | "yangon" | "myanmar";
export type PriorityId = "water" | "soil" | "income" | "forage" | "lower-inputs";

export type SoilProperty =
  | "ph"
  | "texture"
  | "sand"
  | "clay"
  | "drainage"
  | "salinity"
  | "organic-carbon"
  | "available-water-capacity"
  | "root-depth"
  | "nitrogen";

/** One soil measurement with where it came from. Remote estimates never become one of these. */
export interface SoilObservation {
  id: string;
  property: SoilProperty;
  value: number | string;
  units: string;
  depthCm: [from: number, to: number];
  /** ISO date the sample was taken or the value was recorded. */
  date: string;
  method: "laboratory" | "field-kit" | "soil-map" | "farmer-estimate";
  source: string;
}

export interface FarmConstraints {
  irrigation?: {
    access: Irrigation;
    amountMm?: number;
    /** Pump and delivery figures for the capacity limit of Section 4.4. All three are needed to apply it. */
    pump?: { rateM3H: number; efficiency: number; hoursAvailable: number };
  };
  /** Root-zone depletion at planting, mm (0 = field capacity), as the farmer measured or judged it. Never defaulted. */
  soilDepletionAtPlantingMm?: number;
  /** Bunded paddy figures for Section 4.3. Both are needed; neither is defaulted. */
  paddy?: { bundMm: number; seepagePercolationMmDay: number };
  equipment?: Array<"hand-tools" | "animal-traction" | "two-wheel-tractor" | "tractor" | "seeder" | "harvester">;
  labour?: "low" | "medium" | "high";
  marketAccess?: "poor" | "fair" | "good";
  preferredCropIds?: string[];
  excludedCropIds?: string[];
  /** Earliest and latest dates (MM-DD) the farmer can plant. */
  plantingWindow?: { from: string; to: string };
  /** Crops the farmer knows a buyer for. Unset means the question was not asked. */
  canSell?: string[];
  /** Crops the household must grow for its own use. */
  mustGrow?: string[];
  /** Calendar months (1 to 12) when labour is stretched. */
  peakMonths?: number[];
  land?: { tenure: "owned" | "leased"; leaseYears?: number };
}

export type SoilSub = "nitrogen" | "erosion" | "organic-matter" | "infiltration";
export type IncomeSub = "margin" | "market-fit" | "extra-income";

export interface FarmerPriorities {
  /** Finer choices under "soil". Empty or unset means every soil measure counts. */
  soil?: SoilSub[];
  /** Finer choices under "income". */
  income?: IncomeSub[];
  /** Most important first. */
  order: PriorityId[];
  /** 0 to 1 per priority. Normalised to sum 1 when ranked. */
  weights: Partial<Record<PriorityId, number>>;
}

export interface CropEconomics {
  cropId: string;
  /** Local ranges, entered by the farmer or from a cited local source. */
  yieldKgHa?: [low: number, high: number];
  priceMmkPerKg?: [low: number, high: number];
  costMmkPerHa?: [low: number, high: number];
  source: string;
}

export interface FieldAnswer {
  questionId: string;
  value: string;
  at: string;
}

export interface Recall {
  year: number;
  answer: "dry" | "normal" | "wet" | "not-sure";
}

export interface Field {
  id: string;
  name: string;
  geometry: FieldGeometry;
  /** null for a single pin: the area is unknown. */
  areaHa: number | null;
  centroid: LngLat;
  /** Up to five points inside the field, sent to point-sampling services. */
  samplePoints: LngLat[];
  irrigation: Irrigation;
  soilOverride?: SoilOverride;
  /** Dated, sourced soil measurements. `soilOverride` stays as the simple summary. */
  soilObservations?: SoilObservation[];
  /** Region the location resolved to, saved so a later boundary change is visible. */
  region?: RegionId | "unsupported";
  /** The farmer confirmed that this point or outline is their field. */
  locationConfirmed?: boolean;
  confirmedAt?: string;
  /** Set when the farmer archives the field: hidden from lists and Compare, history kept. */
  archivedAt?: string;
  constraints?: FarmConstraints;
  priorities?: FarmerPriorities;
  economics?: CropEconomics[];
  localNotes?: string;
  /** Answers to single follow-up questions. Shown as "you told us". */
  answers?: FieldAnswer[];
  /** How the farmer remembers each year. Stored beside, never merged into, satellite values. */
  recall?: Recall[];
  createdAt: string;
  updatedAt: string;
}

export type SlotKind = "crop" | "cover" | "fallow";
export type DateConfidence = "exact" | "approx" | "typical";
export type EstablishmentMode = "tillage" | "zero_till" | "relay_broadcast" | "unknown";
export type ResidueFate = "retain_incorporate" | "retain_mulch" | "remove_fodder" | "burn" | "unknown";

export interface RotationSlot {
  id: string;
  kind: SlotKind;
  cropId?: string;
  variety?: string;
  /** ISO date, YYYY-MM-DD. Year is the cycle year the slot starts in. */
  plantDate: string;
  harvestDate: string;
  dateConfidence: DateConfidence;
  irrigated: boolean;
  tillage?: "none" | "reduced" | "conventional";
  establishmentMode?: EstablishmentMode;
  residue?: "retained" | "removed" | "burned" | "grazed";
  residueFate?: ResidueFate;
  farmerObservedDrainage?: "waterlogged" | "adequate" | "dry" | "unknown";
  farmerObservedSoilCondition?: string;
  /** Nitrogen applied, kg per ha. */
  nApplied?: number;
  yield?: { value: number; unit: string };
  notes?: string;
}

export interface Rotation {
  id: string;
  fieldId: string;
  label: string;
  /** Length of the repeating cycle, 1 to 4 years. */
  cycleYears: 1 | 2 | 3 | 4;
  /** Exact occupied cycle days from first planting to restart, preventing integer rounding artifacts. */
  cycleDays?: number;
  slots: RotationSlot[];
  source: "farmer" | "strategy";
  strategyId?: string;
}

export type FunctionalGroup =
  | "cereal"
  | "legume"
  | "oilseed"
  | "root"
  | "vegetable"
  | "fibre"
  | "cover";

/** Where a threshold or parameter comes from. Every rule in the library carries one. */
export type RuleScope = "ecocrop-reference" | "fao56" | "local-validated" | "analyst-assumption";

export interface Sourced<T> {
  value: T;
  ref: string;
  url?: string;
  scope: RuleScope;
}

export type StageId = "ini" | "dev" | "mid" | "late";

export interface CropStage {
  id: StageId;
  label: string;
  kc: Sourced<number>;
  /** Air temperature above which this stage is stressed, °C. */
  heatC?: Sourced<number>;
  /** Air temperature below which this stage is stressed, °C. */
  coldC?: Sourced<number>;
  /** Daily rainfall above which this stage experiences hazard (e.g. flower drop or pod rot), mm. */
  excessRainMm?: Sourced<number>;
  droughtSensitive: boolean;
  waterloggingSensitive: boolean;
}

export interface RegionalCalendar {
  /** Usual sowing window as MM-DD, inclusive. May cross the new year. */
  sowWindow: [from: string, to: string];
  durationDays: [min: number, max: number];
  ref: string;
  scope: RuleScope;
}

/** Pest and disease relationship used by the rotation check. */
export interface RotationRule {
  /** Another host family or crop id this crop should not directly follow. */
  avoidAfterFamilies: string[];
  reason: string;
  ref: string;
  scope: RuleScope;
}

/** Library entries that carry sourced, stage-level rules for the supported Myanmar regions. */
export interface CropProfile {
  /** False until a local agronomist or grower has checked the entry for a named variety. */
  varietyValidated: boolean;
  /** Species/variety note, e.g. "species-level reference, no variety chosen". */
  note: string;
  stages: CropStage[];
  /** ECOCROP annual rainfall range. Broad ecology only: never compared with one season's rain. */
  ecologyAnnualRainMm: Sourced<[number, number]>;
  /** ECOCROP temperature as sourced values, for the suitability check. */
  tempC: { optMin: Sourced<number>; optMax: Sourced<number>; absMin: Sourced<number>; absMax: Sourced<number> };
  ph: { optMin: Sourced<number>; optMax: Sourced<number>; absMin: Sourced<number>; absMax: Sourced<number> };
  nFixKgHa?: Sourced<[number, number]>;
  /** % nitrogen in dry grain and in dry residue. */
  grainNPct?: Sourced<number>;
  residueNPct?: Sourced<number>;
  rotationRules: RotationRule[];
  depletionFractionBase?: Sourced<number>;
  forage?: { use: "none" | "residue-fodder" | "green-manure" | "forage"; note: string; ref: string; scope: RuleScope };
  regionalCalendars: Partial<Record<RegionId, RegionalCalendar>>;
}

export type CropScope = "myanmar" | "reference-only";

export interface Crop {
  id: string;
  /** `reference-only` crops stay selectable in the rotation editor but are never used in strategies. */
  scope: CropScope;
  profile?: CropProfile;
  names: { common: string; local: string[]; scientific: string };
  family: string;
  group: FunctionalGroup;
  cycleDays: { min: number; typ: number; max: number };
  depletionFractionBase?: number;
  gdd: {
    baseC: number;
    toMaturity: number;
    /** Upper developmental cutoff for McMaster-Wilhelm GDD. 30 C when absent. */
    upperC?: number;
    /**
     * Cumulative GDD from sowing at which Initial, Development and Mid-season end. Absent when the cultivar's
     * thermal requirements are unknown: stages then follow the calendar split by `stageFractions`.
     */
    stageEndGdd?: { ini: number; dev: number; mid: number };
  };
  temp: {
    absMinC: number;
    optMinC: number;
    optMaxC: number;
    absMaxC: number;
    frostKill?: boolean;
    heatFloweringC?: number;
  };
  water: {
    seasonMm: { min: number; opt: number; max: number };
    /** 1 (sensitive) to 5 (tolerant). */
    droughtTolerance: 1 | 2 | 3 | 4 | 5;
    waterloggingTolerance: 1 | 2 | 3 | 4 | 5;
  };
  kc: { ini: number; mid: number; end: number };
  stageFractions: { ini: number; dev: number; mid: number; late: number };
  rootDepthM: number;
  soil: {
    phMin: number;
    phOpt: [number, number];
    phMax: number;
    textures: TextureClass[];
    salinityTolerance: 1 | 2 | 3 | 4 | 5;
    drainage: Array<"poor" | "moderate" | "good" | "excessive">;
  };
  /** Biologically fixed nitrogen, kg per ha per crop. */
  nFixKgHa?: number;
  nDemandKgHa: number;
  residue: { tHa: number; cnRatio: number };
  pestGroups: string[];
  diseaseGroups: string[];
  coverCropRoles?: Array<"nitrogen" | "erosion" | "organic-matter" | "weeds" | "biofumigation">;
  sources: Array<{ field: string; ref: string }>;
}

/** One claim the app makes, with the indicator that backs it. */
export interface Evidence {
  id: string;
  claim: string;
  comparedTo?: string;
  indicator: DerivedIndicator;
}

export interface Risk {
  id: string;
  kind: "missing-data" | "coarse-data" | "model-limit" | "agronomic" | "local-review";
  severity: "info" | "caution" | "important";
  text: string;
  /** What the farmer or adviser should do about it. */
  action: string;
  relatedEvidence: string[];
}

export type { Backup } from "./schemas/field";
