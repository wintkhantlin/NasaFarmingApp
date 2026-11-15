import { describe, expect, test } from "vitest";
import { backupSchema, rotationSlotSchema } from "../../lib/schemas/field";
import { createRepository, ValidationError } from "../../lib/store/repository";
import { memoryStorage } from "../../lib/store/storage";
import type { FieldGeometry, Rotation } from "../../lib/types";

const square: FieldGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-93.75, 42.1],
      [-93.74, 42.1],
      [-93.74, 42.11],
      [-93.75, 42.11],
      [-93.75, 42.1],
    ],
  ],
};

const bowtie: FieldGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
      [0, 0],
    ],
  ],
};

const slot = {
  id: "s1",
  kind: "crop" as const,
  cropId: "maize",
  plantDate: "2025-05-10",
  harvestDate: "2025-10-05",
  dateConfidence: "approx" as const,
  irrigated: false,
};

const rotation = (fieldId: string): Rotation => ({
  id: "r1",
  fieldId,
  label: "What I grow now",
  cycleYears: 2,
  slots: [slot],
  source: "farmer",
});

describe("field repository", () => {
  test("creates a polygon field with derived area, centroid and sample points", async () => {
    const repo = createRepository(memoryStorage());
    const f = await repo.createField({ name: "  North plot ", geometry: square, irrigation: "none" });
    expect(f.name).toBe("North plot");
    expect(f.areaHa!).toBeGreaterThan(80);
    expect(f.areaHa!).toBeLessThan(95);
    expect(f.centroid[0]).toBeCloseTo(-93.745, 4);
    expect(f.samplePoints.length).toBeGreaterThan(1);
    expect(f.samplePoints.length).toBeLessThanOrEqual(5);
    expect(await repo.getField(f.id)).toEqual(f);
  });

  test("a pin has no area and one sample point", async () => {
    const repo = createRepository(memoryStorage());
    const f = await repo.createField({
      name: "Pin",
      geometry: { type: "Point", coordinates: [95, 20.1] },
      irrigation: "supplemental",
    });
    expect(f.areaHa).toBeNull();
    expect(f.samplePoints).toEqual([[95, 20.1]]);
  });

  test("accepts a field located in Yangon region", async () => {
    const repo = createRepository(memoryStorage());
    const f = await repo.createField({
      name: "Yangon Field",
      geometry: { type: "Point", coordinates: [96.1951, 16.8661] },
      irrigation: "none",
    });
    expect(f.region).toBe("yangon");
    const loaded = await repo.getField(f.id);
    expect(loaded?.region).toBe("yangon");
  });

  test("rejects a crossing outline with a plain message", async () => {
    const repo = createRepository(memoryStorage());
    await expect(repo.createField({ name: "Bad", geometry: bowtie, irrigation: "none" })).rejects.toThrow(
      /crosses itself/,
    );
  });

  test("rejects an empty name", async () => {
    const repo = createRepository(memoryStorage());
    await expect(repo.createField({ name: "   ", geometry: square, irrigation: "none" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  test("lists newest first, updates and removes", async () => {
    const repo = createRepository(memoryStorage());
    const a = await repo.createField({ name: "A", geometry: square, irrigation: "none" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await repo.createField({ name: "B", geometry: square, irrigation: "none" });
    expect((await repo.listFields()).map((f) => f.name)).toEqual(["B", "A"]);
    await new Promise((r) => setTimeout(r, 5));
    const renamed = await repo.updateField(a.id, { name: "A renamed", irrigation: "full" });
    expect(renamed.irrigation).toBe("full");
    expect((await repo.listFields())[0].id).toBe(a.id);
    await repo.removeField(b.id);
    expect(await repo.getField(b.id)).toBeUndefined();
  });

  test("removing a field removes its rotations", async () => {
    const repo = createRepository(memoryStorage());
    const f = await repo.createField({ name: "A", geometry: square, irrigation: "none" });
    await repo.saveRotation(rotation(f.id));
    expect(await repo.listRotations(f.id)).toHaveLength(1);
    await repo.removeField(f.id);
    expect(await repo.listRotations(f.id)).toHaveLength(0);
  });

  test("a damaged record is skipped instead of breaking the list", async () => {
    const storage = memoryStorage();
    const repo = createRepository(storage);
    await repo.createField({ name: "Good", geometry: square, irrigation: "none" });
    await storage.set("field:broken", { id: "broken" });
    expect((await repo.listFields()).map((f) => f.name)).toEqual(["Good"]);
  });

  test("export then import into a fresh store round-trips", async () => {
    const a = createRepository(memoryStorage());
    const f = await a.createField({ name: "Share me", geometry: square, irrigation: "none" });
    await a.saveRotation(rotation(f.id));
    const backup = await a.exportAll();
    expect(backupSchema.safeParse(backup).success).toBe(true);

    const b = createRepository(memoryStorage());
    const counts = await b.importAll(JSON.parse(JSON.stringify(backup)));
    expect(counts).toEqual({ fields: 1, rotations: 1 });
    expect((await b.listFields())[0].name).toBe("Share me");
  });

  test("import refuses a file that is not a backup", async () => {
    const repo = createRepository(memoryStorage());
    await expect(repo.importAll({ hello: "world" })).rejects.toThrow(/isn't a backup/);
  });
});

describe("rotation slot schema", () => {
  test("accepts a valid crop slot", () => {
    expect(rotationSlotSchema.safeParse(slot).success).toBe(true);
  });

  test("harvest before planting fails with a message", () => {
    const r = rotationSlotSchema.safeParse({ ...slot, harvestDate: "2025-04-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Harvest comes before planting.");
  });

  test("a crop slot needs a crop, a fallow does not", () => {
    expect(rotationSlotSchema.safeParse({ ...slot, cropId: undefined }).success).toBe(false);
    expect(rotationSlotSchema.safeParse({ ...slot, kind: "fallow", cropId: undefined }).success).toBe(true);
  });

  test("rejects a badly formatted date", () => {
    expect(rotationSlotSchema.safeParse({ ...slot, plantDate: "10/05/2025" }).success).toBe(false);
  });
});

describe("archiving a field", () => {
  test("archive keeps the record and its history, and restoring clears the mark", async () => {
    const repo = createRepository(memoryStorage());
    const f = await repo.createField({ name: "Creek", geometry: square, irrigation: "none" });
    const archived = await repo.updateField(f.id, { archivedAt: "2026-11-14T00:00:00.000Z" });
    expect(archived.archivedAt).toBe("2026-11-14T00:00:00.000Z");
    expect((await repo.listFields()).map((x) => x.id)).toContain(f.id);
    const restored = await repo.updateField(f.id, { archivedAt: undefined });
    expect(restored.archivedAt).toBeUndefined();
  });
});
