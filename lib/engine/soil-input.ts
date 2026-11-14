import type { SoilProfile } from "../soil/soilgrids";
import type { Field, SoilObservation, SoilProperty, TextureClass } from "../types";
import type { EffectiveSoil } from "./data";

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

const describe = (o: SoilObservation) => `${o.method.replace("-", " ")}, ${o.date}, ${o.depthCm[0]} to ${o.depthCm[1]} cm`;

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
  const awc = pickNum("available-water-capacity");
  const root = pickNum("root-depth");
  return {
    ph,
    texture,
    organicCarbonGKg,
    drainage: drain ? { value: String(drain.value), note: describe(drain) } : null,
    salinityDsM: sal ? { value: sal.value as number, note: describe(sal) } : null,
    awcMmPerM: awc ? { value: awc.value as number, note: describe(awc) } : null,
    rootDepthM: root ? { value: root.units.includes("cm") ? (root.value as number) / 100 : (root.value as number), note: describe(root) } : null,
    observations: o ?? [],
    soilGridsAvailable: Boolean(profile),
  };
}
