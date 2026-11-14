import { describe, expect, test } from "vitest";
import { backupSchema } from "../../lib/schemas/field";
import { createRepository } from "../../lib/store/repository";
import { memoryStorage } from "../../lib/store/storage";
import type { FieldGeometry } from "../../lib/types";

const magwayPoint: FieldGeometry = { type: "Point", coordinates: [94.95, 20.15] };
const kenyaPoint: FieldGeometry = { type: "Point", coordinates: [36.8, -1.3] };

describe("fields with region and confirmation", () => {
  test("a new field gets its region, and is unconfirmed until the farmer says so", async () => {
    const repo = createRepository(memoryStorage());
    const f = await repo.createField({ name: "Plot", geometry: magwayPoint, irrigation: "none" });
    expect(f.region).toBe("magway");
    expect(f.locationConfirmed).toBe(false);
    const confirmed = await repo.updateField(f.id, { locationConfirmed: true });
    expect(confirmed.locationConfirmed).toBe(true);
    expect(confirmed.confirmedAt).toBeTruthy();
  });

  test("moving the pin clears the confirmation and re-resolves the region", async () => {
    const repo = createRepository(memoryStorage());
    const f = await repo.createField({ name: "Plot", geometry: magwayPoint, irrigation: "none", locationConfirmed: true });
    expect(f.locationConfirmed).toBe(true);
    const moved = await repo.updateField(f.id, { geometry: kenyaPoint });
    expect(moved.region).toBe("unsupported");
    expect(moved.locationConfirmed).toBe(false);
    expect(moved.confirmedAt).toBeUndefined();
  });

  test("farm inputs are saved with the field and validated", async () => {
    const repo = createRepository(memoryStorage());
    const f = await repo.createField({
      name: "Plot",
      geometry: magwayPoint,
      irrigation: "none",
      priorities: { order: ["water", "soil"], weights: {} },
      constraints: { labour: "low", excludedCropIds: ["rice"], plantingWindow: { from: "05-01", to: "07-31" } },
      soilObservations: [{ id: "o1", property: "ph", value: 6.2, units: "pH", depthCm: [0, 20], date: "2026-03-01", method: "laboratory", source: "District lab" }],
      economics: [{ cropId: "sesame", yieldKgHa: [400, 600], source: "Local market" }],
    });
    const again = await repo.getField(f.id);
    expect(again?.priorities?.order).toEqual(["water", "soil"]);
    expect(again?.soilObservations?.[0].source).toBe("District lab");
    await expect(
      repo.updateField(f.id, { soilObservations: [{ id: "o2", property: "ph", value: 6.2, units: "pH", depthCm: [0, 20], date: "2026-03-01", method: "laboratory", source: "" }] }),
    ).rejects.toThrow();
  });
});

describe("backup format version 2", () => {
  test("export writes version 2 and round-trips the new fields", async () => {
    const repo = createRepository(memoryStorage());
    await repo.createField({ name: "Plot", geometry: magwayPoint, irrigation: "none", priorities: { order: ["soil"], weights: {} } });
    const backup = await repo.exportAll();
    expect(backup.version).toBe(2);
    expect(backupSchema.safeParse(backup).success).toBe(true);
    const other = createRepository(memoryStorage());
    await other.importAll(JSON.parse(JSON.stringify(backup)));
    expect((await other.listFields())[0].priorities?.order).toEqual(["soil"]);
  });

  test("a version 1 backup still imports and gets a region", async () => {
    const v1 = {
      app: "nasa-farming-app",
      version: 1,
      exportedAt: "2026-01-01T00:00:00Z",
      fields: [
        {
          id: "old",
          name: "Old plot",
          geometry: magwayPoint,
          areaHa: null,
          centroid: [94.95, 20.15],
          samplePoints: [[94.95, 20.15]],
          irrigation: "none",
          soilOverride: { ph: 6.5 },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      rotations: [],
    };
    const repo = createRepository(memoryStorage());
    await repo.importAll(v1);
    const f = await repo.getField("old");
    expect(f?.region).toBe("magway");
    expect(f?.soilOverride?.ph).toBe(6.5);
    expect(f?.locationConfirmed).toBeUndefined(); // never claim a confirmation the farmer did not give
  });
});
