import { z } from "zod";
import { parsePlanDraft } from "../store/plan-draft";
import type {
  CropEconomics,
  FarmConstraints,
  FarmerPriorities,
  Field,
  Rotation,
  RotationSlot,
  SoilObservation,
  SoilOverride,
} from "../types";

const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const geometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: lngLat }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(lngLat).min(4)).min(1),
  }),
]);

export const textureSchema = z.enum([
  "clay",
  "silty clay",
  "sandy clay",
  "clay loam",
  "silty clay loam",
  "sandy clay loam",
  "loam",
  "silt loam",
  "silt",
  "sandy loam",
  "loamy sand",
  "sand",
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2025-06-15.");
const isoDateTime = z.string().min(10);

export const soilOverrideSchema: z.ZodType<SoilOverride> = z.object({
  ph: z.number().min(3).max(10).optional(),
  texture: textureSchema.optional(),
  ocPct: z.number().min(0).max(60).optional(),
  salinityDsM: z.number().min(0).max(100).optional(),
  testedOn: isoDate.optional(),
});

const irrigationSchema = z.enum(["none", "supplemental", "full"]);
const priorityIdSchema = z.enum(["water", "soil", "income", "forage", "lower-inputs"]);
const monthDay = z.string().regex(/^\d{2}-\d{2}$/, "Use a date like 06-15.");

export const soilObservationSchema: z.ZodType<SoilObservation> = z.object({
  id: z.string().min(1),
  property: z.enum(["ph", "texture", "sand", "clay", "drainage", "salinity", "organic-carbon", "available-water-capacity", "root-depth", "nitrogen"]),
  value: z.union([z.number(), z.string().min(1)]),
  units: z.string().max(20),
  depthCm: z.tuple([z.number().min(0), z.number().min(0)]),
  date: isoDate,
  method: z.enum(["laboratory", "field-kit", "soil-map", "farmer-estimate"]),
  source: z.string().trim().min(1, "Say where this value came from.").max(120),
});

export const constraintsSchema: z.ZodType<FarmConstraints> = z.object({
  irrigation: z
    .object({
      access: irrigationSchema,
      amountMm: z.number().min(0).max(5000).optional(),
      pump: z.object({ rateM3H: z.number().positive().max(10000), efficiency: z.number().gt(0).max(1), hoursAvailable: z.number().min(0).max(8760) }).optional(),
    })
    .optional(),
  soilDepletionAtPlantingMm: z.number().min(0).max(2000).optional(),
  paddy: z.object({ bundMm: z.number().min(0).max(1000), seepagePercolationMmDay: z.number().min(0).max(100) }).optional(),
  equipment: z
    .array(z.enum(["hand-tools", "animal-traction", "two-wheel-tractor", "tractor", "seeder", "harvester"]))
    .optional(),
  labour: z.enum(["low", "medium", "high"]).optional(),
  marketAccess: z.enum(["poor", "fair", "good"]).optional(),
  preferredCropIds: z.array(z.string()).optional(),
  excludedCropIds: z.array(z.string()).optional(),
  plantingWindow: z.object({ from: monthDay, to: monthDay }).optional(),
  canSell: z.array(z.string()).optional(),
  mustGrow: z.array(z.string()).optional(),
  peakMonths: z.array(z.number().int().min(1).max(12)).optional(),
  land: z.object({ tenure: z.enum(["owned", "leased"]), leaseYears: z.number().min(0).max(99).optional() }).optional(),
});

export const prioritiesSchema: z.ZodType<FarmerPriorities> = z.object({
  soil: z.array(z.enum(["nitrogen", "erosion", "organic-matter", "infiltration"])).optional(),
  income: z.array(z.enum(["margin", "market-fit", "extra-income"])).optional(),
  order: z.array(priorityIdSchema).max(5),
  weights: z.partialRecord(priorityIdSchema, z.number().min(0).max(1)),
});

const range = z.tuple([z.number().min(0), z.number().min(0)]);
export const economicsSchema: z.ZodType<CropEconomics> = z.object({
  cropId: z.string().min(1),
  yieldKgHa: range.optional(),
  priceMmkPerKg: range.optional(),
  costMmkPerHa: range.optional(),
  source: z.string().trim().min(1, "Say where these numbers came from.").max(120),
});

export const fieldSchema: z.ZodType<Field> = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Give the field a name.").max(80),
  geometry: geometrySchema,
  areaHa: z.number().nonnegative().nullable(),
  centroid: lngLat,
  samplePoints: z.array(lngLat).min(1).max(5),
  irrigation: z.enum(["none", "supplemental", "full"]),
  soilOverride: soilOverrideSchema.optional(),
  soilObservations: z.array(soilObservationSchema).max(100).optional(),
  region: z.enum(["ayeyarwady", "magway", "shan", "yangon", "myanmar", "unsupported"]).optional(),
  locationConfirmed: z.boolean().optional(),
  confirmedAt: isoDateTime.optional(),
  archivedAt: isoDateTime.optional(),
  constraints: constraintsSchema.optional(),
  priorities: prioritiesSchema.optional(),
  economics: z.array(economicsSchema).max(40).optional(),
  localNotes: z.string().max(2000).optional(),
  recall: z.array(z.object({ year: z.number().int().min(1980).max(2100), answer: z.enum(["dry", "normal", "wet", "not-sure"]) })).max(60).optional(),
  answers: z.array(z.object({ questionId: z.string().min(1), value: z.string().min(1), at: isoDateTime })).max(100).optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const rotationSlotSchema: z.ZodType<RotationSlot> = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["crop", "cover", "fallow"]),
    cropId: z.string().optional(),
    variety: z.string().max(80).optional(),
    plantDate: isoDate,
    harvestDate: isoDate,
    dateConfidence: z.enum(["exact", "approx", "typical"]),
    irrigated: z.boolean(),
    tillage: z.enum(["none", "reduced", "conventional"]).optional(),
    establishmentMode: z.enum(["tillage", "zero_till", "relay_broadcast", "unknown"]).optional(),
    residue: z.enum(["retained", "removed", "burned", "grazed"]).optional(),
    residueFate: z.enum(["retain_incorporate", "retain_mulch", "remove_fodder", "burn", "unknown"]).optional(),
    farmerObservedDrainage: z.enum(["waterlogged", "adequate", "dry", "unknown"]).optional(),
    farmerObservedSoilCondition: z.string().max(200).optional(),
    nApplied: z.number().min(0).max(1000).optional(),
    yield: z.object({ value: z.number().min(0), unit: z.string().min(1) }).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((s) => s.harvestDate >= s.plantDate, {
    message: "Harvest comes before planting.",
    path: ["harvestDate"],
  })
  .refine((s) => s.kind === "fallow" || Boolean(s.cropId), {
    message: "Choose a crop.",
    path: ["cropId"],
  });

export const rotationSchema: z.ZodType<Rotation> = z.object({
  id: z.string().min(1),
  fieldId: z.string().min(1),
  label: z.string().trim().min(1).max(80),
  cycleYears: z.literal([1, 2, 3, 4]),
  cycleDays: z.number().int().positive().optional(),
  slots: z.array(rotationSlotSchema),
  source: z.enum(["farmer", "strategy"]),
  strategyId: z.string().optional(),
});

/** What export writes and import reads, so a field can go to an adviser. */
export const backupSchema = z.object({
  app: z.literal("nasa-farming-app"),
  /** 1 is the original format. 2 adds region, confirmation, constraints, priorities, soil observations and economics. */
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  planDraft: z.unknown().transform((value, ctx) => {
    if (value === undefined || value === null) return null;
    const draft = parsePlanDraft(value);
    if (!draft) ctx.addIssue({ code: "custom", message: "Invalid Plan draft in backup." });
    return draft;
  }).optional(),
  exportedAt: isoDateTime,
  fields: z.array(fieldSchema),
  rotations: z.array(rotationSchema),
});

export type Backup = z.infer<typeof backupSchema>;
