import { fetchWithRetry } from "../network/fetch-with-retry";
import { ndvi, ndmi, sceneAdmitted, type ObservationSummary } from "./derive/ndvi";
import { viUsable, viIsInlandWater, MODIS_NDVI_FILL } from "./qa/modis-vi";
import type { FieldGeometry, LngLat } from "../types";
import { pointInPolygon } from "../geo/shapes";
import { toUtm, utmZoneFromEpsg } from "../geo/utm";

/**
 * Microsoft Planetary Computer (MPC) STAC & COG Client.
 * STAC endpoint: https://planetarycomputer.microsoft.com/api/stac/v1
 * SAS signing: https://planetarycomputer.microsoft.com/api/sas/v1
 *
 * Provides cloud-native, on-demand satellite raster access with:
 * - Public STAC search (no credentials required).
 * - Automatic SAS asset signing with token caching and refresh.
 * - Cloud-Optimized GeoTIFF (COG) byte-range windowed retrieval.
 * - USGS Landsat Collection 2 Level-2 QA_PIXEL bitmask decoding.
 * - MODIS 16-day 250m VI extraction.
 * - Comprehensive provenance and quality tracking.
 */

export const MPC_CONFIG = {
  stacUrl: "https://planetarycomputer.microsoft.com/api/stac/v1",
  sasUrl: "https://planetarycomputer.microsoft.com/api/sas/v1",
  landsatCollection: "landsat-c2-l2",
  modisViCollection: "modis-13Q1-061",
  modisLstCollection: "modis-11A2-061",
  userAgent: "FieldShift/1.0 (NASA Farming App; Agronomic Decision Support)",
} as const;

export interface MpcItem {
  id: string;
  type: "Feature";
  collection: string;
  geometry: {
    type: string;
    coordinates: unknown;
  };
  bbox: [number, number, number, number];
  properties: {
    datetime: string | null;
    start_datetime?: string;
    end_datetime?: string;
    "eo:cloud_cover"?: number;
    platform?: string;
    instruments?: string[];
    [key: string]: unknown;
  };
  assets: Record<
    string,
    {
      href: string;
      title?: string;
      description?: string;
      type?: string;
      roles?: string[];
      "raster:bands"?: Array<{
        scale?: number;
        offset?: number;
        nodata?: number;
        data_type?: string;
        spatial_resolution?: number;
      }>;
      [key: string]: unknown;
    }
  >;
}

export interface MpcSearchOptions {
  collections: string[];
  bbox: [number, number, number, number];
  start: string;
  end: string;
  maxCloudCover?: number;
  limit?: number;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  apiKey?: string;
}

export interface SasTokenInfo {
  token: string;
  expiry: number; // Unix epoch ms
}

// In-memory SAS token cache: collection -> SasTokenInfo
const tokenCache = new Map<string, SasTokenInfo>();

/**
 * Retrieves a valid SAS token for a given collection, caching it until 60 seconds before expiration.
 * Public requests require no API key. An optional key can be passed via env or options.
 */
export async function getSasToken(
  collection: string,
  opts: { fetch?: typeof fetch; signal?: AbortSignal; apiKey?: string } = {},
): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(collection);
  if (cached && cached.expiry > now + 60_000) {
    return cached.token;
  }

  const f = opts.fetch ?? fetch;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": MPC_CONFIG.userAgent,
  };
  const key = opts.apiKey ?? (typeof process !== "undefined" ? process.env?.PLANETARY_COMPUTER_API_KEY : undefined);
  if (key) {
    headers["Ocp-Apim-Subscription-Key"] = key;
  }

  const url = `${MPC_CONFIG.sasUrl}/token/${encodeURIComponent(collection)}`;
  const res = await fetchWithRetry(url, { headers, signal: opts.signal }, { maxRetries: 3, initialDelayMs: 500 }, f);
  if (!res.ok) {
    throw new Error(`Failed to acquire Planetary Computer SAS token for ${collection}: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { token: string; "msft:expiry"?: string };
  const expiryMs = data["msft:expiry"] ? Date.parse(data["msft:expiry"]) : now + 40 * 60 * 1000;
  tokenCache.set(collection, { token: data.token, expiry: expiryMs });
  return data.token;
}

/**
 * Signs an asset URL by appending the collection's SAS token.
 */
export async function signAssetUrl(
  href: string,
  collection: string,
  opts: { fetch?: typeof fetch; signal?: AbortSignal; apiKey?: string } = {},
): Promise<string> {
  if (href.includes("?") && (href.includes("sig=") || href.includes("st="))) {
    return href; // already signed
  }
  const token = await getSasToken(collection, opts);
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${token}`;
}

/**
 * Searches the Planetary Computer STAC catalog by bbox and date range.
 * Does not require an API key for public searches.
 */
export async function searchPlanetaryComputer(opts: MpcSearchOptions): Promise<MpcItem[]> {
  const f = opts.fetch ?? fetch;
  const startIso = opts.start.includes("T") ? opts.start : `${opts.start}T00:00:00Z`;
  const endIso = opts.end.includes("T") ? opts.end : `${opts.end}T23:59:59Z`;

  const payload: Record<string, unknown> = {
    collections: opts.collections,
    bbox: opts.bbox,
    datetime: `${startIso}/${endIso}`,
    limit: opts.limit ?? 50,
  };

  if (opts.maxCloudCover !== undefined) {
    payload.query = {
      "eo:cloud_cover": { lt: opts.maxCloudCover },
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/geo+json, application/json",
    "User-Agent": MPC_CONFIG.userAgent,
  };
  const key = opts.apiKey ?? (typeof process !== "undefined" ? process.env?.PLANETARY_COMPUTER_API_KEY : undefined);
  if (key) {
    headers["Ocp-Apim-Subscription-Key"] = key;
  }

  const res = await fetchWithRetry(
    `${MPC_CONFIG.stacUrl}/search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: opts.signal,
    },
    { maxRetries: 3, initialDelayMs: 500 },
    f,
  );

  if (!res.ok) {
    throw new Error(`Planetary Computer STAC search failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { features?: MpcItem[] };
  return data.features ?? [];
}

/**
 * Cache-key tag for Landsat field extractions. Change it when the extraction changes, so stale results
 * are dropped without touching the other sources' caches. "field-clip-1": pixels are read in the
 * tile's own UTM grid and clipped to the field outline (earlier results compared degrees to metres).
 */
export const LANDSAT_EXTRACTION = "landsat-c2-l2:field-clip-1";

/** The QA policy of `decodeLandsatQa` and `processLandsatScene`, in words, for the evidence record. */
export const LANDSAT_QA_POLICY =
  "Pixels whose centre lies inside the field outline only. QA_PIXEL fill, cloud, dilated cloud, cloud shadow, snow and high-confidence cloud or shadow removed; water counted separately, never as bare soil. Reflectance = DN x 0.0000275 - 0.2.";

/**
 * USGS Landsat Collection 2 QA_PIXEL Bitmask Decoder.
 * Bit 0: Fill
 * Bit 1: Dilated Cloud
 * Bit 2: Cirrus (Landsat 8/9)
 * Bit 3: Cloud
 * Bit 4: Cloud Shadow
 * Bit 5: Snow / Ice
 * Bit 6: Clear
 * Bit 7: Water
 * Bits 8-9: Cloud Confidence (00=None, 01=Low, 10=Med, 11=High)
 * Bits 10-11: Cloud Shadow Confidence (00=None, 01=Low, 10=Med, 11=High)
 * Bits 12-13: Snow/Ice Confidence (00=None, 01=Low, 10=Med, 11=High)
 */
export interface LandsatQaDecoded {
  fill: boolean;
  dilatedCloud: boolean;
  cirrus: boolean;
  cloud: boolean;
  shadow: boolean;
  snow: boolean;
  clear: boolean;
  water: boolean;
  cloudConfidence: 0 | 1 | 2 | 3;
  shadowConfidence: 0 | 1 | 2 | 3;
  snowConfidence: 0 | 1 | 2 | 3;
  /** Valid clear land: usable for vegetation analysis. */
  validLand: boolean;
}

export function decodeLandsatQa(value: number): LandsatQaDecoded {
  if (!Number.isFinite(value) || value < 0) {
    return {
      fill: true,
      dilatedCloud: false,
      cirrus: false,
      cloud: false,
      shadow: false,
      snow: false,
      clear: false,
      water: false,
      cloudConfidence: 0,
      shadowConfidence: 0,
      snowConfidence: 0,
      validLand: false,
    };
  }

  const bit = (n: number) => ((value >> n) & 1) === 1;
  const fill = bit(0);
  const dilatedCloud = bit(1);
  const cirrus = bit(2);
  const cloud = bit(3);
  const shadow = bit(4);
  const snow = bit(5);
  const clear = bit(6);
  const water = bit(7);
  const cloudConfidence = ((value >> 8) & 0b11) as 0 | 1 | 2 | 3;
  const shadowConfidence = ((value >> 10) & 0b11) as 0 | 1 | 2 | 3;
  const snowConfidence = ((value >> 12) & 0b11) as 0 | 1 | 2 | 3;

  // Strict conservative quality mask:
  // Reject fill, cloud, dilated cloud, cloud shadow, snow, water, and high-confidence cloud/shadow
  const validLand =
    !fill &&
    !dilatedCloud &&
    !cloud &&
    !shadow &&
    !snow &&
    !water &&
    cloudConfidence < 3 &&
    shadowConfidence < 3;

  return {
    fill,
    dilatedCloud,
    cirrus,
    cloud,
    shadow,
    snow,
    clear,
    water,
    cloudConfidence,
    shadowConfidence,
    snowConfidence,
    validLand,
  };
}

/**
 * Landsat Collection 2 Level-2 Surface Reflectance scaling:
 * DN * 0.0000275 - 0.2
 * Returns null for DN=0 (nodata) or non-finite values.
 */
export function scaleLandsatReflectance(dn: number | null | undefined): number | null {
  if (dn === null || dn === undefined || !Number.isFinite(dn) || dn <= 0) return null;
  const val = dn * 0.0000275 - 0.2;
  // Physically valid surface reflectance is between 0.0 and 1.6
  if (val < 0) return 0;
  if (val > 1.6) return null;
  return Math.round(val * 10000) / 10000;
}

/**
 * Bounding box of a FieldGeometry in WGS84 [minLon, minLat, maxLon, maxLat].
 */
export function geometryBbox(g: FieldGeometry): [number, number, number, number] {
  if (g.type === "Point") {
    const [lon, lat] = g.coordinates;
    const pad = 0.005; // ~500m padding for point sample
    return [lon - pad, lat - pad, lon + pad, lat + pad];
  }
  const pts = g.coordinates[0];
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [x, y] of pts) {
    if (x < minLon) minLon = x;
    if (x > maxLon) maxLon = x;
    if (y < minLat) minLat = y;
    if (y > maxLat) maxLat = y;
  }
  return [minLon, minLat, maxLon, maxLat];
}

export interface RasterWindowData {
  width: number;
  height: number;
  /** Row-major pixel values of the window around the field. */
  values: number[];
  /** Per pixel: true when its centre lies inside the field outline (or the padded box for a point). */
  inside: boolean[];
}

type Ring = Array<[number, number]>;

/** The field's outline as rings: the polygon itself, or the padded `geometryBbox` square for a point. */
export function fieldRings(g: FieldGeometry): Ring[] {
  if (g.type === "Polygon") return g.coordinates.map((ring) => ring.map(([x, y]) => [x, y] as [number, number]));
  const [w, s, e, n] = geometryBbox(g);
  return [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
}

/**
 * Maps a WGS84 point into the raster's coordinate system, read from its GeoKeys. WGS84 rasters pass
 * through; WGS84 UTM rasters (Landsat C2, HLS, Sentinel-2) are projected. Anything else is refused
 * rather than compared as if it were degrees.
 */
export function projectorFor(geoKeys: Record<string, unknown> | null | undefined): (p: LngLat) => [number, number] {
  const projected = Number(geoKeys?.ProjectedCSTypeGeoKey);
  const zone = Number.isFinite(projected) ? utmZoneFromEpsg(projected) : null;
  if (zone) return (p) => toUtm(p, zone);
  const geographic = Number(geoKeys?.GeographicTypeGeoKey);
  if (Number(geoKeys?.GTModelTypeGeoKey) === 2 && (!Number.isFinite(geographic) || geographic === 4326)) return (p) => [p[0], p[1]];
  throw new Error(`Unsupported raster CRS (${String(geoKeys?.GTCitationGeoKey ?? projected)}); only WGS84 and WGS84 UTM are read.`);
}

/**
 * Reads the pixels around a field from a Cloud-Optimized GeoTIFF using HTTP range requests via
 * `geotiff`. The outline is projected into the raster's CRS first, so a UTM tile is never compared
 * with degrees, and each pixel is flagged by whether its centre falls inside the outline.
 */
export async function readCogWindow(
  signedUrl: string,
  geometry: FieldGeometry,
  opts: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<RasterWindowData> {
  if (opts.signal?.aborted) {
    throw new Error("Aborted");
  }
  const { fromUrl } = await import("geotiff");
  const tiff = await fromUrl(signedUrl);
  const image = await tiff.getImage();
  // The pixel-to-map mapping below is the unrotated affine (b = d = 0). A rotated or sheared grid would put the
  // field on the wrong pixels without any error, so it is refused. Landsat, HLS and MODIS COGs are north-up.
  const dir = image.fileDirectory;
  const transform = dir.hasTag("ModelTransformation") ? (dir.getValue("ModelTransformation") as ArrayLike<number> | null) : null;
  if (transform && (Math.abs(transform[1]) > 1e-12 || Math.abs(transform[4]) > 1e-12)) {
    throw new Error("Unsupported raster geometry: rotated or sheared grid. Only north-up rasters are read.");
  }
  const project = projectorFor(image.getGeoKeys() as Record<string, unknown>);
  const rings = fieldRings(geometry).map((ring) => ring.map(project));
  const [imgMinX, imgMinY, imgMaxX, imgMaxY] = image.getBoundingBox();
  const imgW = image.getWidth();
  const imgH = image.getHeight();
  const pixelWidth = (imgMaxX - imgMinX) / imgW;
  const pixelHeight = (imgMaxY - imgMinY) / imgH;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of rings[0]) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const left = Math.max(0, Math.floor((minX - imgMinX) / pixelWidth));
  const right = Math.min(imgW, Math.ceil((maxX - imgMinX) / pixelWidth));
  const top = Math.max(0, Math.floor((imgMaxY - maxY) / pixelHeight));
  const bottom = Math.min(imgH, Math.ceil((imgMaxY - minY) / pixelHeight));
  // The field lies outside this tile: no pixels, rather than a clamped corner of the scene.
  if (right <= left || bottom <= top) return { width: 0, height: 0, values: [], inside: [] };

  const window: [number, number, number, number] = [left, top, right, bottom];
  const rasters = await image.readRasters({ window, interleave: false });
  const band = (Array.isArray(rasters) ? rasters[0] : rasters) as ArrayLike<number>;

  const width = right - left;
  const height = bottom - top;
  const values = new Array<number>(band.length);
  const inside = new Array<boolean>(band.length);
  for (let i = 0; i < band.length; i++) {
    values[i] = Number(band[i]);
    const x = imgMinX + (left + (i % width) + 0.5) * pixelWidth;
    const y = imgMaxY - (top + Math.floor(i / width) + 0.5) * pixelHeight;
    inside[i] = pointInPolygon([x, y], rings);
  }

  return { width, height, values, inside };
}

export interface LandsatObservation {
  itemId: string;
  date: string;
  platform: string;
  cloudCover: number;
  ndviMedian: number | null;
  ndmiMedian: number | null;
  validPixels: number;
  totalPixels: number;
  waterPixels: number;
  coverage: number;
}

export interface PlanetaryComputerResult {
  source: "planetary-computer";
  collection: "landsat-c2-l2";
  observations: ObservationSummary[];
  itemCount: number;
  retrievedAt: string;
}

/**
 * Processes a single Landsat scene for a field:
 * 1. Signs assets for red, nir08, swir16, and qa_pixel.
 * 2. Fetches the window for each asset.
 * 3. Applies Collection 2 QA mask.
 * 4. Computes NDVI and NDMI.
 */
export async function processLandsatScene(
  item: MpcItem,
  geometry: FieldGeometry,
  opts: { fetch?: typeof fetch; signal?: AbortSignal; apiKey?: string } = {},
): Promise<LandsatObservation | null> {
  const redAsset = item.assets.red;
  const nirAsset = item.assets.nir08;
  const swirAsset = item.assets.swir16;
  const qaAsset = item.assets.qa_pixel;

  if (!redAsset || !nirAsset || !qaAsset) {
    return null;
  }

  const date = item.properties.datetime?.slice(0, 10) ?? item.id.split("_")[3]?.slice(0, 8);
  if (!date) return null;

  const [signedRed, signedNir, signedSwir, signedQa] = await Promise.all([
    signAssetUrl(redAsset.href, item.collection, opts),
    signAssetUrl(nirAsset.href, item.collection, opts),
    swirAsset ? signAssetUrl(swirAsset.href, item.collection, opts) : Promise.resolve(null),
    signAssetUrl(qaAsset.href, item.collection, opts),
  ]);

  const [redData, nirData, qaData] = await Promise.all([
    readCogWindow(signedRed, geometry, opts),
    readCogWindow(signedNir, geometry, opts),
    readCogWindow(signedQa, geometry, opts),
  ]);

  const swirData = signedSwir ? await readCogWindow(signedSwir, geometry, opts) : null;

  const count = Math.min(redData.values.length, nirData.values.length, qaData.values.length);
  // Only pixels inside the field outline count; the rest of the window belongs to the neighbours.
  const fieldPixels = redData.inside.slice(0, count).filter(Boolean).length;
  if (fieldPixels === 0) return null;

  const ndviValues: number[] = [];
  const ndmiValues: number[] = [];
  let validPixels = 0;
  let waterPixels = 0;

  for (let i = 0; i < count; i++) {
    if (!redData.inside[i]) continue;
    const qa = decodeLandsatQa(qaData.values[i]);
    if (qa.water) waterPixels++;
    if (!qa.validLand) continue;

    const r = scaleLandsatReflectance(redData.values[i]);
    const n = scaleLandsatReflectance(nirData.values[i]);
    const s = swirData ? scaleLandsatReflectance(swirData.values[i]) : null;

    if (r !== null && n !== null) {
      const v = ndvi(n, r);
      if (v !== null) ndviValues.push(v);
    }
    if (n !== null && s !== null) {
      const m = ndmi(n, s);
      if (m !== null) ndmiValues.push(m);
    }
    validPixels++;
  }

  const median = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const coverage = validPixels / fieldPixels;
  // Minimum clear-area gate (Section 6.2): too little of the parcel clear means no field value for this date.
  const ndviMedian = sceneAdmitted(coverage) ? median(ndviValues) : null;
  const ndmiMedian = sceneAdmitted(coverage) ? median(ndmiValues) : null;

  return {
    itemId: item.id,
    date,
    platform: String(item.properties.platform ?? "landsat"),
    cloudCover: Number(item.properties["eo:cloud_cover"] ?? 0),
    ndviMedian: ndviMedian !== null ? Math.round(ndviMedian * 1000) / 1000 : null,
    ndmiMedian: ndmiMedian !== null ? Math.round(ndmiMedian * 1000) / 1000 : null,
    validPixels,
    totalPixels: fieldPixels,
    waterPixels,
    coverage: Math.round(coverage * 1000) / 1000,
  };
}

/**
 * Ingests Landsat Collection 2 Level-2 surface reflectance from Microsoft Planetary Computer.
 * Returns observation summaries matching Field Shift's standard vegetation timeline.
 */
export async function ingestPlanetaryComputerLandsat(
  field: { id: string; geometry: FieldGeometry; centroid: LngLat },
  period: { start: string; end: string },
  opts: {
    fetch?: typeof fetch;
    signal?: AbortSignal;
    apiKey?: string;
    maxCloudCover?: number;
    limit?: number;
  } = {},
): Promise<PlanetaryComputerResult> {
  const bbox = geometryBbox(field.geometry);
  const items = await searchPlanetaryComputer({
    collections: [MPC_CONFIG.landsatCollection],
    bbox,
    start: period.start,
    end: period.end,
    maxCloudCover: opts.maxCloudCover ?? 40,
    limit: opts.limit ?? 50,
    fetch: opts.fetch,
    signal: opts.signal,
    apiKey: opts.apiKey,
  });

  const observations: ObservationSummary[] = [];

  for (const item of items) {
    try {
      const obs = await processLandsatScene(item, field.geometry, opts);
      if (obs && obs.validPixels > 0) {
        observations.push({
          date: obs.date,
          ndviMedian: obs.ndviMedian,
          ndmiMedian: obs.ndmiMedian,
          validPixels: obs.validPixels,
          totalPixels: obs.totalPixels,
          waterPixels: obs.waterPixels,
          coverage: obs.coverage,
        });
      }
    } catch (e) {
      // Individual scene extraction failure does not abort the whole time series
      console.warn(`MPC Landsat scene ${item.id} skipped:`, e instanceof Error ? e.message : e);
    }
  }

  // Sort chronological
  observations.sort((a, b) => a.date.localeCompare(b.date));

  return {
    source: "planetary-computer",
    collection: "landsat-c2-l2",
    observations,
    itemCount: items.length,
    retrievedAt: new Date().toISOString(),
  };
}

export interface ModisViResult {
  source: "planetary-computer";
  collection: "modis-13Q1-061";
  observations: ObservationSummary[];
  itemCount: number;
  retrievedAt: string;
}

/**
 * Extracts date from a MODIS STAC item ID (e.g. MYD13Q1.A2023089.h27v07.061...) or properties.
 */
export function extractModisDate(item: MpcItem): string | null {
  if (item.properties.datetime) return item.properties.datetime.slice(0, 10);
  if (item.properties.start_datetime) return item.properties.start_datetime.slice(0, 10);
  const match = item.id.match(/\.A(\d{4})(\d{3})\./);
  if (match) {
    const year = Number(match[1]);
    const doy = Number(match[2]);
    return new Date(Date.UTC(year, 0, doy)).toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Ingests MODIS 16-day 250m Vegetation Indices from Microsoft Planetary Computer.
 * Preserves native MODIS spatial (250m) and temporal (16-day) resolutions, applying
 * identical QA criteria (MODLAND good quality, reliability 0, cloud/shadow masking).
 */
export async function ingestPlanetaryComputerModisVi(
  field: { id: string; geometry: FieldGeometry; centroid: LngLat },
  period: { start: string; end: string },
  opts: {
    fetch?: typeof fetch;
    signal?: AbortSignal;
    apiKey?: string;
    limit?: number;
  } = {},
): Promise<ModisViResult> {
  const bbox = geometryBbox(field.geometry);
  const items = await searchPlanetaryComputer({
    collections: [MPC_CONFIG.modisViCollection],
    bbox,
    start: period.start,
    end: period.end,
    limit: opts.limit ?? 50,
    fetch: opts.fetch,
    signal: opts.signal,
    apiKey: opts.apiKey,
  });

  const observations: ObservationSummary[] = [];

  for (const item of items) {
    const ndviAsset = item.assets["250m_16_days_NDVI"];
    const qaAsset = item.assets["250m_16_days_VI_Quality"];
    const relAsset = item.assets["250m_16_days_pixel_reliability"];

    if (!ndviAsset || !qaAsset) continue;
    const date = extractModisDate(item);
    if (!date) continue;

    try {
      const [signedNdvi, signedQa, signedRel] = await Promise.all([
        signAssetUrl(ndviAsset.href, item.collection, opts),
        signAssetUrl(qaAsset.href, item.collection, opts),
        relAsset ? signAssetUrl(relAsset.href, item.collection, opts) : Promise.resolve(null),
      ]);

      const [ndviData, qaData] = await Promise.all([
        readCogWindow(signedNdvi, field.geometry, opts),
        readCogWindow(signedQa, field.geometry, opts),
      ]);
      const relData = signedRel ? await readCogWindow(signedRel, field.geometry, opts) : null;

      const count = Math.min(ndviData.values.length, qaData.values.length);
      const fieldPixels = ndviData.inside.slice(0, count).filter(Boolean).length;
      if (fieldPixels === 0) continue;

      const validNdvi: number[] = [];
      let waterCount = 0;

      for (let i = 0; i < count; i++) {
        if (!ndviData.inside[i]) continue;
        const rawNdvi = ndviData.values[i];
        const qa = qaData.values[i];
        const rel = relData ? relData.values[i] : 0;

        if (viIsInlandWater(qa)) waterCount++;
        if (!viUsable(qa, rel)) continue;
        if (rawNdvi === MODIS_NDVI_FILL || !Number.isFinite(rawNdvi)) continue;

        // Scale factor: 0.0001
        const scaled = rawNdvi * 0.0001;
        if (scaled >= -0.2 && scaled <= 1.0) {
          validNdvi.push(scaled);
        }
      }

      const median = (arr: number[]): number | null => {
        if (arr.length === 0) return null;
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
      };

      const med = sceneAdmitted(validNdvi.length / fieldPixels) ? median(validNdvi) : null;
      if (validNdvi.length > 0) {
        observations.push({
          date,
          ndviMedian: med !== null ? Math.round(med * 1000) / 1000 : null,
          ndmiMedian: null, // MOD13Q1 250m standard composite does not include SWIR NDMI
          validPixels: validNdvi.length,
          totalPixels: fieldPixels,
          waterPixels: waterCount,
          coverage: Math.round((validNdvi.length / fieldPixels) * 1000) / 1000,
        });
      }
    } catch (e) {
      console.warn(`MPC MODIS item ${item.id} skipped:`, e instanceof Error ? e.message : e);
    }
  }

  observations.sort((a, b) => a.date.localeCompare(b.date));

  return {
    source: "planetary-computer",
    collection: "modis-13Q1-061",
    observations,
    itemCount: items.length,
    retrievedAt: new Date().toISOString(),
  };
}
