import { z } from "zod";
import type { Field, Rotation, RotationSlot, SoilOverride } from "../types";

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
  testedOn: isoDate.optional(),
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
  localNotes: z.string().max(2000).optional(),
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
    residue: z.enum(["retained", "removed", "burned", "grazed"]).optional(),
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
  slots: z.array(rotationSlotSchema),
  source: z.enum(["farmer", "strategy"]),
  strategyId: z.string().optional(),
});

/** What export writes and import reads, so a field can go to an adviser. */
export const backupSchema = z.object({
  app: z.literal("nasa-farming-app"),
  version: z.literal(1),
  exportedAt: isoDateTime,
  fields: z.array(fieldSchema),
  rotations: z.array(rotationSchema),
});

export type Backup = z.infer<typeof backupSchema>;
