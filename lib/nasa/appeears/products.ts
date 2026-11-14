import registry from "../metadata/verified-products.json";

/**
 * Layer metadata from the AppEEARS public catalogue, checked 14 Nov 2026 (see
 * `lib/nasa/metadata/verified-products.json`). The numbers here decide fill and scaling, so they
 * are read from that file, not retyped.
 */

export type ProductId =
  | "HLSL30.020"
  | "HLSS30.020"
  | "SPL4SMGP.008"
  | "MOD13Q1.061"
  | "SRTMGL1_NC.003"
  | "ECO_L2T_LSTE.002"
  | "ECO_L3T_JET.002";

export interface LayerMeta {
  Description: string;
  Units: string | null;
  DataType: string;
  FillValue: number | string | null;
  ScaleFactor: number | string | null;
  AddOffset: number | string | null;
  ValidMin: number | string | null;
  ValidMax: number | string | null;
  IsQA: boolean;
  QualityLayers: string | null;
}

interface Registry {
  checkedOn: string;
  products: Record<string, { metadataUrl: string; layers: Record<string, LayerMeta> }>;
}

const REGISTRY = registry as unknown as Registry;
export const METADATA_CHECKED_ON = REGISTRY.checkedOn;

export function productMetadataUrl(product: ProductId): string {
  return REGISTRY.products[product].metadataUrl;
}

export function layerMeta(product: ProductId, layer: string): LayerMeta {
  const meta = REGISTRY.products[product]?.layers[layer];
  if (!meta) throw new Error(`Layer ${layer} is not in the verified metadata for ${product}.`);
  return meta;
}

/** The numeric fill value, or null when the layer has none. */
export function fillValueOf(product: ProductId, layer: string): number | null {
  const v = layerMeta(product, layer).FillValue;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Scale factor and offset. A blank means "none": scale 1, offset 0. */
export function scaleOf(product: ProductId, layer: string): { scale: number; offset: number } {
  const m = layerMeta(product, layer);
  const num = (v: number | string | null, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return { scale: num(m.ScaleFactor, 1), offset: num(m.AddOffset, 0) };
}

/** DOI strings. Note HLS: the AppEEARS version is .020 but the product DOI version is .002. */
export const PRODUCT_DOI: Record<ProductId, string | null> = {
  "HLSL30.020": "10.5067/HLS/HLSL30.002",
  "HLSS30.020": "10.5067/HLS/HLSS30.002",
  "SPL4SMGP.008": null,
  "MOD13Q1.061": "10.5067/MODIS/MOD13Q1.061",
  "SRTMGL1_NC.003": "10.5067/MEASURES/SRTM/SRTMGL1_NC.003",
  "ECO_L2T_LSTE.002": "10.5067/ECOSTRESS/ECO_L2T_LSTE.002",
  "ECO_L3T_JET.002": "10.5067/ECOSTRESS/ECO_L3T_JET.002",
};

/** Layers each task asks for. First two SMAP layers are the minimum. */
export const SMAP_LAYERS = [
  "Geophysical_Data_sm_surface",
  "Geophysical_Data_sm_rootzone",
  "Geophysical_Data_sm_rootzone_pctl",
] as const;
export const HLS_LAYERS = ["B02", "B03", "B04", "B05", "B06", "Fmask"] as const;
export const SRTM_LAYER = "SRTMGL1_DEM";
export const MODIS_LAYERS = [
  "_250m_16_days_NDVI",
  "_250m_16_days_EVI",
  "_250m_16_days_VI_Quality",
  "_250m_16_days_pixel_reliability",
  "_250m_16_days_composite_day_of_the_year",
] as const;
export const ECOSTRESS_LST_LAYERS = ["LST", "LST_err", "QC", "cloud", "water"] as const;
export const ECOSTRESS_ET_LAYERS = ["ETdaily", "ETinstUncertainty", "cloud", "water"] as const;
