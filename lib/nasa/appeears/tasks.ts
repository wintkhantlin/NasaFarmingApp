import type { FieldGeometry, LngLat } from "../../types";
import { ECOSTRESS_ET_LAYERS, ECOSTRESS_LST_LAYERS, HLS_LAYERS, MODIS_LAYERS, SMAP_LAYERS, SRTM_LAYER, type ProductId } from "./products";

/**
 * Builders for AppEEARS task bodies. Dates use MM-DD-YYYY. GeoJSON coordinates are longitude, latitude.
 * Product and layer names come from `products.ts` (verified metadata, 14 Nov 2026).
 */

export type PointTaskKind = "smap";
export type AreaTaskKind = "hls" | "srtm" | "modis" | "ecostress-lst" | "ecostress-et";
export type TaskKind = PointTaskKind | AreaTaskKind;

/** "2025-03-07" to "03-07-2025". */
export function appeearsDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) throw new Error(`Not an ISO date: ${iso}`);
  return `${m}-${d}-${y}`;
}

/**
 * SMAP L4 end date used by default. NSIDC flags May to July 2026 geolocation/reprocessing issues, so
 * an initial analysis stops at the end of 2025 until the notice is checked again.
 */
export const SMAP_SAFE_END = "2025-12-31";

const dates = (start: string, end: string) => [{ startDate: appeearsDate(start), endDate: appeearsDate(end) }];

export interface PointTaskInput {
  /** Stable name, e.g. the field id plus the product. */
  name: string;
  /** Not a farm default. Must be a confirmed location or an explicitly labelled analysis point. */
  id: string;
  point: LngLat;
  start: string;
  end: string;
}

export function smapPointTask(i: PointTaskInput) {
  return {
    task_type: "point",
    task_name: i.name,
    params: {
      dates: dates(i.start, i.end),
      layers: SMAP_LAYERS.map((layer) => ({ product: "SPL4SMGP.008", layer })),
      coordinates: [{ id: i.id, longitude: i.point[0], latitude: i.point[1] }],
    },
  };
}

export interface AreaTaskInput {
  name: string;
  geometry: FieldGeometry;
  start: string;
  end: string;
}

/** A polygon, or a small square around a point so an area task still has an extent. */
export function featureCollection(geometry: FieldGeometry, bufferDeg = 0.003) {
  const ring: LngLat[] =
    geometry.type === "Polygon"
      ? geometry.coordinates[0]
      : (() => {
          const [x, y] = geometry.coordinates;
          return [[x - bufferDeg, y - bufferDeg], [x + bufferDeg, y - bufferDeg], [x + bufferDeg, y + bufferDeg], [x - bufferDeg, y + bufferDeg], [x - bufferDeg, y - bufferDeg]] as LngLat[];
        })();
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }],
  };
}

function areaTask(i: AreaTaskInput, layers: Array<{ product: ProductId; layer: string }>) {
  return {
    task_type: "area",
    task_name: i.name,
    params: {
      dates: dates(i.start, i.end),
      layers,
      geo: featureCollection(i.geometry),
      output: { format: { type: "geotiff" }, projection: "native" },
    },
  };
}

export const hlsAreaTask = (i: AreaTaskInput) => areaTask(i, HLS_LAYERS.map((layer) => ({ product: "HLSL30.020", layer })));
export const modisAreaTask = (i: AreaTaskInput) => areaTask(i, MODIS_LAYERS.map((layer) => ({ product: "MOD13Q1.061", layer })));
export const ecostressLstTask = (i: AreaTaskInput) => areaTask(i, ECOSTRESS_LST_LAYERS.map((layer) => ({ product: "ECO_L2T_LSTE.002", layer })));
export const ecostressEtTask = (i: AreaTaskInput) => areaTask(i, ECOSTRESS_ET_LAYERS.map((layer) => ({ product: "ECO_L3T_JET.002", layer })));

/**
 * SRTM is static: one acquisition (February 2000), requested on its own and cached for good.
 * The geometry should be buffered so edge cells have neighbours for slope.
 */
export function srtmAreaTask(i: Omit<AreaTaskInput, "start" | "end">, bufferDeg = 0.01) {
  const buffered = bufferedBox(i.geometry, bufferDeg);
  return areaTask({ ...i, geometry: buffered, start: "2000-02-11", end: "2000-02-21" }, [{ product: "SRTMGL1_NC.003", layer: SRTM_LAYER }]);
}

/** The bounding box of a geometry, grown by `bufferDeg` on every side, as a polygon. */
export function bufferedBox(geometry: FieldGeometry, bufferDeg: number): FieldGeometry {
  const pts = geometry.type === "Polygon" ? geometry.coordinates[0] : [geometry.coordinates];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [w, e] = [Math.min(...xs) - bufferDeg, Math.max(...xs) + bufferDeg];
  const [s, n] = [Math.min(...ys) - bufferDeg, Math.max(...ys) + bufferDeg];
  return { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
}
