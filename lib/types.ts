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
  testedOn?: string;
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
  localNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type SlotKind = "crop" | "cover" | "fallow";
export type DateConfidence = "exact" | "approx" | "typical";

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
  residue?: "retained" | "removed" | "burned" | "grazed";
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

export interface Crop {
  id: string;
  names: { common: string; local: string[]; scientific: string };
  family: string;
  group: FunctionalGroup;
  cycleDays: { min: number; typ: number; max: number };
  gdd: { baseC: number; toMaturity: number };
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

export type Confidence = "high" | "medium" | "low";

export interface DataSourceRef {
  dataset: string;
  resolution: string;
  /** Free text, e.g. "1981 to 2024" or "12 Nov pass". */
  dates: string;
}

/** One claim the app makes, with the number and source behind it. */
export interface Evidence {
  id: string;
  claim: string;
  metric: string;
  value: number | string;
  unit?: string;
  comparedTo?: string;
  years?: number;
  source: DataSourceRef;
  confidence: Confidence;
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
