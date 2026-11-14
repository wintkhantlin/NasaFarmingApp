import { areaHa, centroid, isSelfIntersecting, samplePoints } from "../geo/shapes";
import { backupSchema, fieldSchema, rotationSchema, type Backup } from "../schemas/field";
import { checkRegion } from "../data/regions";
import type { Field, FieldGeometry, Irrigation, Rotation, SoilOverride } from "../types";
import type { KeyValueStorage } from "./storage";

const FIELD_PREFIX = "field:";
const ROTATION_PREFIX = "rotation:";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface NewField {
  name: string;
  geometry: FieldGeometry;
  irrigation: Irrigation;
  soilOverride?: SoilOverride;
  soilObservations?: Field["soilObservations"];
  locationConfirmed?: boolean;
  archivedAt?: string;
  constraints?: Field["constraints"];
  priorities?: Field["priorities"];
  economics?: Field["economics"];
  localNotes?: string;
  answers?: Field["answers"];
  recall?: Field["recall"];
}

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

/** Fields larger than this get a warning in the UI; they are still saved. */
export const LARGE_FIELD_HA = 5_000;

/** Fields saved before regions existed get one at read time. Nothing is written back until the field is saved. */
function withRegion(field: Field): Field {
  return field.region && field.region !== "unsupported" ? field : { ...field, region: checkRegion(field.geometry, field.centroid).region };
}

export function createRepository(storage: KeyValueStorage) {
  async function listFields(): Promise<Field[]> {
    const ids = await storage.keys(FIELD_PREFIX);
    const rows = await Promise.all(ids.map((k) => storage.get(k)));
    const fields: Field[] = [];
    for (const row of rows) {
      const parsed = fieldSchema.safeParse(row);
      if (parsed.success) fields.push(withRegion(parsed.data)); // a damaged record is skipped, not fatal
    }
    return fields.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function getField(id: string): Promise<Field | undefined> {
    const parsed = fieldSchema.safeParse(await storage.get(FIELD_PREFIX + id));
    return parsed.success ? withRegion(parsed.data) : undefined;
  }

  async function createField(input: NewField): Promise<Field> {
    if (input.geometry.type === "Polygon" && isSelfIntersecting(input.geometry.coordinates[0])) {
      throw new ValidationError("The outline crosses itself. Redraw it so the lines don't cross.");
    }
    const stamp = nowIso();
    const center = centroid(input.geometry);
    const field: Field = {
      id: newId(),
      name: input.name.trim(),
      geometry: input.geometry,
      areaHa: areaHa(input.geometry),
      centroid: center,
      samplePoints: samplePoints(input.geometry, 5),
      irrigation: input.irrigation,
      soilOverride: input.soilOverride,
      soilObservations: input.soilObservations,
      region: checkRegion(input.geometry, center).region,
      locationConfirmed: input.locationConfirmed ?? false,
      confirmedAt: input.locationConfirmed ? stamp : undefined,
      constraints: input.constraints,
      priorities: input.priorities,
      economics: input.economics,
      localNotes: input.localNotes,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const parsed = fieldSchema.safeParse(field);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the field details.");
    await storage.set(FIELD_PREFIX + field.id, parsed.data);
    return parsed.data;
  }

  async function updateField(id: string, patch: Partial<NewField>): Promise<Field> {
    const current = await getField(id);
    if (!current) throw new ValidationError("That field no longer exists.");
    const geometry = patch.geometry ?? current.geometry;
    if (geometry.type === "Polygon" && isSelfIntersecting(geometry.coordinates[0])) {
      throw new ValidationError("The outline crosses itself. Redraw it so the lines don't cross.");
    }
    const center = centroid(geometry);
    const moved = patch.geometry !== undefined;
    const confirmedNow = patch.locationConfirmed === true && !current.locationConfirmed;
    const next: Field = {
      ...current,
      ...patch,
      name: (patch.name ?? current.name).trim(),
      geometry,
      areaHa: areaHa(geometry),
      centroid: center,
      samplePoints: samplePoints(geometry, 5),
      region: checkRegion(geometry, center).region,
      // moving the pin means the farmer has to confirm it again
      locationConfirmed: moved && patch.locationConfirmed === undefined ? false : (patch.locationConfirmed ?? current.locationConfirmed),
      confirmedAt:
        moved && patch.locationConfirmed === undefined ? undefined : confirmedNow ? nowIso() : current.confirmedAt,
      updatedAt: nowIso(),
    };
    const parsed = fieldSchema.safeParse(next);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the field details.");
    await storage.set(FIELD_PREFIX + id, parsed.data);
    return parsed.data;
  }

  async function removeField(id: string): Promise<void> {
    await storage.del(FIELD_PREFIX + id);
    for (const r of await listRotations(id)) await storage.del(ROTATION_PREFIX + r.id);
  }

  async function listRotations(fieldId: string): Promise<Rotation[]> {
    const ids = await storage.keys(ROTATION_PREFIX);
    const rows = await Promise.all(ids.map((k) => storage.get(k)));
    const out: Rotation[] = [];
    for (const row of rows) {
      const parsed = rotationSchema.safeParse(row);
      if (parsed.success && parsed.data.fieldId === fieldId) out.push(parsed.data);
    }
    return out;
  }

  async function saveRotation(rotation: Rotation): Promise<Rotation> {
    const parsed = rotationSchema.safeParse(rotation);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the rotation.");
    await storage.set(ROTATION_PREFIX + parsed.data.id, parsed.data);
    return parsed.data;
  }

  async function exportAll(): Promise<Backup> {
    const fields = await listFields();
    const rotations = (await Promise.all(fields.map((f) => listRotations(f.id)))).flat();
    return { app: "nasa-farming-app", version: 2, exportedAt: nowIso(), fields, rotations };
  }

  /** Adds everything in a backup. Existing records with the same id are replaced. */
  async function importAll(json: unknown): Promise<{ fields: number; rotations: number }> {
    const parsed = backupSchema.safeParse(json);
    if (!parsed.success) throw new ValidationError("That file isn't a backup from this app.");
    for (const f of parsed.data.fields) {
      // v1 backups have no region. Work it out so the field can use the Myanmar rules.
      const migrated: Field = f.region ? f : { ...f, region: checkRegion(f.geometry, f.centroid).region };
      await storage.set(FIELD_PREFIX + f.id, migrated);
    }
    for (const r of parsed.data.rotations) await storage.set(ROTATION_PREFIX + r.id, r);
    return { fields: parsed.data.fields.length, rotations: parsed.data.rotations.length };
  }

  return { listFields, getField, createField, updateField, removeField, listRotations, saveRotation, exportAll, importAll };
}

export type Repository = ReturnType<typeof createRepository>;
