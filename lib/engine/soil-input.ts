import type { SoilProfile } from "../soil/soilgrids";
import type { Field, SoilObservation, SoilProperty, TextureClass } from "../types";
import type { EffectiveSoil } from "./data";
import { organicMatterPct, saxtonRawls } from "../soil/pedotransfer";

/**
 * Chooses the soil value to use. The farmer's own value always wins over the soil map, and both are
 * kept visible in the note. A remote estimate never becomes a laboratory result, and a missing value
 * stays missing.
 */

const METHOD_RANK: Record<SoilObservation["method"], number> = { laboratory: 0, "field-kit": 1, "soil-map": 2, "farmer-estimate": 3 };

/** The best observation of a property: better method first, then the most recent date. */
export function bestObservation(obs: SoilObservation[] | undefined, property: SoilProperty): SoilObservation | undefined {
  return (obs ?? [])
    .filter((o) => o.property === property)
    .sort((a, b) => METHOD_RANK[a.method] - METHOD_RANK[b.method] || b.date.localeCompare(a.date))[0];
}

export interface SoilLayerWater {
  thetaFc: number; // field capacity volumetric fraction
  thetaWp: number; // wilting point volumetric fraction
  thicknessM: number; // thickness in metres
}

/**
 * Calculates layered available water capacity (TAW) across depth horizons (Section D).
 * TAW = 1000 * sum_i ((thetaFC,i - thetaWP,i) * thicknessWithinRootZoneInM).
 */
export function layeredWaterCapacity(layers: SoilLayerWater[], maxRootDepthM?: number): number {
  let taw = 0;
  let depthAcc = 0;
  const maxDepth = maxRootDepthM ?? Number.POSITIVE_INFINITY;

  for (const layer of layers) {
    if (layer.thetaFc <= layer.thetaWp || layer.thicknessM <= 0) continue;
    const remainingDepth = Math.max(0, maxDepth - depthAcc);
    const effectiveThickness = Math.min(layer.thicknessM, remainingDepth);
    if (effectiveThickness <= 0) break;

    taw += 1000 * (layer.thetaFc - layer.thetaWp) * effectiveThickness;
    depthAcc += effectiveThickness;
  }

  return taw;
}

const describe = (o: SoilObservation) => `${o.method.replace("-", " ")}, ${o.date}, ${o.depthCm[0]} to ${o.depthCm[1]} cm`;

const asPct = (o: SoilObservation) => (o.units.includes("g/kg") ? (o.value as number) / 10 : (o.value as number));

/**
 * Plant-available water in two tiers, never mixing them (Section 4.1, v3.1):
 *  0. a value the farmer entered for available water capacity;
 *  1. Saxton-Rawls (2006) from the farmer's OWN sand, clay and organic carbon, all three, none borrowed
 *     from a soil map;
 *  2. ISRIC SoilGrids water content at -33 and -1500 kPa for 0 to 30 cm.
 * A tier whose inputs are missing, or whose equations are outside their fitted range, is skipped.
 */
function resolveAwc(args: {
  measured: SoilObservation | undefined;
  sand: SoilObservation | undefined;
  clay: SoilObservation | undefined;
  organicCarbon: EffectiveSoil["organicCarbonGKg"];
  profile: SoilProfile | null | undefined;
}): EffectiveSoil["awcMmPerM"] {
  const { measured, sand, clay, organicCarbon, profile } = args;
  if (measured) return { value: measured.value as number, from: "farmer", note: describe(measured) };

  if (sand && clay && organicCarbon?.from === "farmer") {
    const r = saxtonRawls({ sand: asPct(sand) / 100, clay: asPct(clay) / 100, omPct: organicMatterPct(organicCarbon.value) });
    if (r) {
      return {
        value: r.awcMmPerM,
        from: "farmer-ptf",
        note: `Calculated from your sand (${describe(sand)}), clay (${describe(clay)}) and organic carbon (${organicCarbon.note}) with Saxton and Rawls (2006): ${(r.thetaFc * 100).toFixed(1)}% at field capacity, ${(r.thetaWp * 100).toFixed(1)}% at wilting point`,
      };
    }
  }

  const fc = profile?.fieldCapacityFrac;
  const wp = profile?.wiltingPointFrac;
  if (profile && fc != null && wp != null && fc > wp) {
    return {
      value: 1000 * (fc - wp),
      from: "soilgrids",
      note: `${profile.source.dataset}, ${profile.source.resolution}, water held at -33 and -1500 kPa, ${profile.source.depth}, applied to the whole root zone`,
    };
  }
  return null;
}

export function effectiveSoil(field: Field, profile: SoilProfile | null | undefined): EffectiveSoil {
  const o = field.soilObservations;
  const pickNum = (property: SoilProperty) => {
    const x = bestObservation(o, property);
    return x && typeof x.value === "number" ? x : undefined;
  };

  const phObs = pickNum("ph");
  const ph: EffectiveSoil["ph"] = phObs
    ? { value: phObs.value as number, from: "farmer", note: describe(phObs) }
    : field.soilOverride?.ph !== undefined
      ? { value: field.soilOverride.ph, from: "farmer", note: `your soil test${field.soilOverride.testedOn ? `, ${field.soilOverride.testedOn}` : ""}` }
      : profile?.ph != null
        ? { value: profile.ph, from: "soilgrids", note: `${profile.source.dataset}, ${profile.source.resolution}, ${profile.source.depth}` }
        : null;

  const texObs = bestObservation(o, "texture");
  const texture: EffectiveSoil["texture"] = texObs && typeof texObs.value === "string"
    ? { value: texObs.value as TextureClass, from: "farmer", note: describe(texObs) }
    : field.soilOverride?.texture
      ? { value: field.soilOverride.texture, from: "farmer", note: "your soil test" }
      : profile?.texture
        ? { value: profile.texture, from: "soilgrids", note: `${profile.source.dataset}, ${profile.source.resolution}` }
        : null;

  const ocObs = pickNum("organic-carbon");
  const organicCarbonGKg: EffectiveSoil["organicCarbonGKg"] = ocObs
    ? { value: (ocObs.units.includes("%") ? (ocObs.value as number) * 10 : (ocObs.value as number)), from: "farmer", note: describe(ocObs) }
    : field.soilOverride?.ocPct !== undefined
      ? { value: field.soilOverride.ocPct * 10, from: "farmer", note: "your soil test" }
      : profile?.socGKg != null
        ? { value: profile.socGKg, from: "soilgrids", note: `${profile.source.dataset}, ${profile.source.resolution}` }
        : null;

  const drain = bestObservation(o, "drainage");
  const sal = pickNum("salinity");
  const awc = resolveAwc({
    measured: pickNum("available-water-capacity"),
    sand: pickNum("sand"),
    clay: pickNum("clay"),
    organicCarbon: organicCarbonGKg,
    profile,
  });
  const root = pickNum("root-depth");
  return {
    ph,
    texture,
    organicCarbonGKg,
    drainage: drain ? { value: String(drain.value), note: describe(drain) } : null,
    salinityDsM: sal ? { value: sal.value as number, note: describe(sal) } : null,
    awcMmPerM: awc,
    rootDepthM: root ? { value: root.units.includes("cm") ? (root.value as number) / 100 : (root.value as number), note: describe(root) } : null,
    observations: o ?? [],
    soilGridsAvailable: Boolean(profile),
  };
}
