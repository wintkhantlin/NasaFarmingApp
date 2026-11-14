import { areaHa, centroid, isSelfIntersecting, samplePoints } from "../geo/shapes";
import { backupSchema, fieldSchema, rotationSchema, type Backup } from "../schemas/field";
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
  localNotes?: string;
}

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

/** Fields larger than this get a warning in the UI; they are still saved. */
export const LARGE_FIELD_HA = 5_000;

export function createRepository(storage: KeyValueStorage) {
  async function listFields(): Promise<Field[]> {
    const ids = await storage.keys(FIELD_PREFIX);
    const rows = await Promise.all(ids.map((k) => storage.get(k)));
    const fields: Field[] = [];
    for (const row of rows) {
      const parsed = fieldSchema.safeParse(row);
      if (parsed.success) fields.push(parsed.data); // a damaged record is skipped, not fatal
    }
    return fields.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function getField(id: string): Promise<Field | undefined> {
    const parsed = fieldSchema.safeParse(await storage.get(FIELD_PREFIX + id));
    return parsed.success ? parsed.data : undefined;
  }

  async function createField(input: NewField): Promise<Field> {
    if (input.geometry.type === "Polygon" && isSelfIntersecting(input.geometry.coordinates[0])) {
      throw new ValidationError("The outline crosses itself. Redraw it so the lines don't cross.");
    }
    const stamp = nowIso();
    const field: Field = {
      id: newId(),
      name: input.name.trim(),
      geometry: input.geometry,
      areaHa: areaHa(input.geometry),
      centroid: centroid(input.geometry),
      samplePoints: samplePoints(input.geometry, 5),
      irrigation: input.irrigation,
      soilOverride: input.soilOverride,
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
    const next: Field = {
      ...current,
      ...patch,
      name: (patch.name ?? current.name).trim(),
      geometry,
      areaHa: areaHa(geometry),
      centroid: centroid(geometry),
      samplePoints: samplePoints(geometry, 5),
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
    return { app: "nasa-farming-app", version: 1, exportedAt: nowIso(), fields, rotations };
  }

  /** Adds everything in a backup. Existing records with the same id are replaced. */
  async function importAll(json: unknown): Promise<{ fields: number; rotations: number }> {
    const parsed = backupSchema.safeParse(json);
    if (!parsed.success) throw new ValidationError("That file isn't a backup from this app.");
    for (const f of parsed.data.fields) await storage.set(FIELD_PREFIX + f.id, f);
    for (const r of parsed.data.rotations) await storage.set(ROTATION_PREFIX + r.id, r);
    return { fields: parsed.data.fields.length, rotations: parsed.data.rotations.length };
  }

  return { listFields, getField, createField, updateField, removeField, listRotations, saveRotation, exportAll, importAll };
}

export type Repository = ReturnType<typeof createRepository>;
