import { z } from "zod";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { pointInPolygon } from "@/lib/geo/shapes";
import type { LngLat } from "@/lib/types";

export const administrativeContextSchema = z.object({
  ST: z.string().min(1), ST_PCODE: z.string().min(1),
  DT: z.string().min(1), DT_PCODE: z.string().min(1),
  TS: z.string().min(1), TS_PCODE: z.string().min(1), TS_MMR: z.string(),
});
export type AdministrativeContext = z.infer<typeof administrativeContextSchema>;
export type Townships = FeatureCollection<Polygon | MultiPolygon, AdministrativeContext>;
const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const ring = z.array(position).min(4).refine((r) => r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1], "Ring must close");
const polygon = z.array(ring).min(1);
const collection = z.object({ type: z.literal("FeatureCollection"), features: z.array(z.object({
  type: z.literal("Feature"), properties: administrativeContextSchema,
  geometry: z.discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: polygon }),
    z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(polygon).min(1) }),
  ]),
})).length(162) });
export function parseTownships(value: unknown): Townships {
  const data = collection.parse(value);
  if (new Set(data.features.map((f) => f.properties.TS_PCODE)).size !== 162) throw new Error("Duplicate township PCode");
  const parents = new Map<string, string>();
  for (const { properties: p } of data.features) {
    const key = `${p.ST_PCODE}/${p.DT}`;
    if (parents.has(p.DT_PCODE) && parents.get(p.DT_PCODE) !== key) throw new Error("Inconsistent district parent");
    parents.set(p.DT_PCODE, key);
  }
  return data as Townships;
}
export function townshipBounds(data: Townships): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const f of data.features) {
    const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const rings of polygons) for (const ring of rings) for (const [x, y] of ring) {
      w = Math.min(w, x); s = Math.min(s, y); e = Math.max(e, x); n = Math.max(n, y);
    }
  }
  return [w, s, e, n];
}
/** Labels the actual field point; never supplies a replacement field coordinate. */
export function contextAtPoint(data: Townships, point: LngLat): AdministrativeContext | undefined {
  const matches = data.features.filter((f) => {
    const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    return polygons.some((rings) => pointInPolygon(point, rings as LngLat[][]));
  });
  return matches.length === 1 ? matches[0].properties : undefined;
}
