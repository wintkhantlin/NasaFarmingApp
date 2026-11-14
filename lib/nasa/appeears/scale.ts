import { fillValueOf, scaleOf, type ProductId } from "./products";

/**
 * Turns a raw layer value into a physical value, once.
 *
 * Fill values become null first (never zero). The scale factor and offset come from the verified
 * product metadata. AppEEARS point CSVs and area GeoTIFFs are usually delivered already scaled, so
 * callers say whether the file is `raw` or `scaled`; a scaled value is only range-checked.
 */
export type Delivery = "raw" | "scaled";

export function toPhysical(
  product: ProductId,
  layer: string,
  value: number | null | undefined,
  delivery: Delivery,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const fill = fillValueOf(product, layer);
  if (fill !== null && value === fill) return null;
  if (delivery === "scaled") return value;
  const { scale, offset } = scaleOf(product, layer);
  return value * scale + offset;
}

/**
 * Guesses whether a delivered layer was scaled already, from a sample of its values. Raw integer
 * layers with a scale below 1 hold whole numbers, mostly above 1 in size; scaled layers hold
 * fractions or small values. The bundle README is the authority: use this only as a guard when the
 * README was not parsed, and record which answer was used.
 */
export function detectDelivery(product: ProductId, layer: string, sample: number[]): Delivery {
  const { scale } = scaleOf(product, layer);
  if (scale === 1) return "scaled"; // nothing to apply either way
  const fill = fillValueOf(product, layer);
  const values = sample.filter((v) => Number.isFinite(v) && v !== fill);
  if (values.length === 0) return "scaled";
  if (values.some((v) => !Number.isInteger(v))) return "scaled";
  return values.every((v) => Math.abs(v) <= 1) ? "scaled" : "raw";
}
