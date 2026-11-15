import type {
  Crop,
  CropStage,
  FunctionalGroup,
  RegionalCalendar,
  RegionId,
  RotationRule,
  RuleScope,
  Sourced,
  TextureClass,
} from "../../types";
import { ALL_TEXTURES, LOAM_SANDY_TEXTURES } from "./reference";

/**
 * Crop rules for the three supported Myanmar regions.
 *
 * Every threshold is a `Sourced` value with a scope:
 *  - "ecocrop-reference": read from the FAO ECOCROP data sheet (species level; not variety-validated).
 *  - "fao56": FAO Irrigation and Drainage Paper 56, Tables 11 and 12.
 *  - "analyst-assumption": a starting value from general agronomy that nobody has checked for
 *    Myanmar varieties yet. The UI labels these, and a local agronomist should replace them.
 * Nothing here is a validated local recommendation.
 */

export const CROP_LIBRARY_VERSION = "myanmar-2026.11.1";

const ECO = (id: number) => `https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=${id}`;
const FAO56_T12 = "https://www.fao.org/4/x0490e/x0490e0b.htm";

const eco = <T>(value: T, id: number, what: string): Sourced<T> => ({
  value,
  ref: `FAO ECOCROP data sheet ${id}: ${what}`,
  url: ECO(id),
  scope: "ecocrop-reference",
});
const fao = <T>(value: T, what: string): Sourced<T> => ({ value, ref: `FAO-56 ${what}`, url: FAO56_T12, scope: "fao56" });
const assumed = <T>(value: T, what: string): Sourced<T> => ({
  value,
  ref: `Analyst starting value, not checked for Myanmar varieties: ${what}`,
  scope: "analyst-assumption",
});

const ASSUMED_CAL = "Analyst estimate of the usual Myanmar sowing window; confirm with local extension.";
const cal = (sow: [string, string], days: [number, number], scope: RuleScope = "analyst-assumption", ref = ASSUMED_CAL): RegionalCalendar => ({
  sowWindow: sow,
  durationDays: days,
  ref,
  scope,
});

const sameFamily = (family: string, reason: string): RotationRule => ({
  avoidAfterFamilies: [family],
  reason,
  ref: "General rotation guidance (FAO conservation agriculture, species diversification); confirm local pest and disease advice.",
  scope: "analyst-assumption",
});

interface Spec {
  id: string;
  common: string;
  local: string[];
  scientific: string;
  family: string;
  group: FunctionalGroup;
  cycle: [number, number, number];
  gdd: [base: number, toMaturity: number];
  temp: { absMin: number; optMin: number; optMax: number; absMax: number; heatFlowerC?: number; coldC?: number };
  /** Where temperature and pH came from. */
  ecoId?: number;
  ph: { absMin: number; optMin: number; optMax: number; absMax: number };
  ecologyRain: [number, number];
  seasonMm: { min: number; opt: number; max: number };
  droughtTol: 1 | 2 | 3 | 4 | 5;
  waterlogTol: 1 | 2 | 3 | 4 | 5;
  kc: { ini: number; mid: number; end: number; scope: "fao56" | "analyst-assumption"; ref: string };
  stageFr: { ini: number; dev: number; mid: number; late: number };
  rootDepthM: number;
  textures: TextureClass[];
  salinity: 1 | 2 | 3 | 4 | 5;
  drainage: Array<"poor" | "moderate" | "good" | "excessive">;
  nFix?: [number, number];
  nDemand: number;
  residue: { tHa: number; cn: number };
  grainN?: number;
  residueN?: number;
  pests: string[];
  diseases: string[];
  roles?: Crop["coverCropRoles"];
  forage: { use: "none" | "residue-fodder" | "green-manure" | "forage"; note: string };
  calendars: Partial<Record<RegionId, RegionalCalendar>>;
  droughtStages: Array<"ini" | "dev" | "mid" | "late">;
  waterlogStages: Array<"ini" | "dev" | "mid" | "late">;
  varietyNote?: string;
  pBase?: number;
  floweringRainMm?: number;
}

/**
 * Calculates dynamic depletion fraction p(ETc) from base depletion fraction (FAO-56 Table 22 & Eq. 84).
 * p = clamp(p_base + 0.04 * (5 - ETc), 0.1, 0.8)
 */
export function dynamicDepletionFraction(baseP: number, etcMmDay: number): number {
  const adjusted = baseP + 0.04 * (5 - etcMmDay);
  return Math.max(0.1, Math.min(0.8, Math.round(adjusted * 1000) / 1000));
}

function build(s: Spec): Crop {
  const t = (v: number, what: string) => (s.ecoId ? eco(v, s.ecoId, what) : assumed(v, what));
  const kcSrc = <T,>(v: T, what: string): Sourced<T> =>
    s.kc.scope === "fao56" ? fao(v, `${s.kc.ref} (${what})`) : assumed(v, `${s.kc.ref} (${what})`);
  const stageKc = { ini: s.kc.ini, dev: (s.kc.ini + s.kc.mid) / 2, mid: s.kc.mid, late: (s.kc.mid + s.kc.end) / 2 };
  const labels = { ini: "Establishment", dev: "Vegetative growth", mid: "Flowering and pod or grain set", late: "Ripening" } as const;
  const stages: CropStage[] = (["ini", "dev", "mid", "late"] as const).map((id) => ({
    id,
    label: labels[id],
    kc: kcSrc(Number(stageKc[id].toFixed(2)), id === "dev" || id === "late" ? "stage mean interpolated between published Kc points" : "published Kc point"),
    heatC: id === "mid" && s.temp.heatFlowerC !== undefined ? assumed(s.temp.heatFlowerC, "heat stress threshold at flowering") : undefined,
    coldC: id === "mid" && s.temp.coldC !== undefined ? assumed(s.temp.coldC, "cold stress threshold at flowering") : undefined,
    excessRainMm: id === "mid" && s.floweringRainMm !== undefined ? assumed(s.floweringRainMm, "excess rain threshold at flowering causing flower drop or pod rot") : undefined,
    droughtSensitive: s.droughtStages.includes(id),
    waterloggingSensitive: s.waterlogStages.includes(id),
  }));

  const baseP = s.pBase ?? 0.5;

  return {
    id: s.id,
    scope: "myanmar",
    names: { common: s.common, local: s.local, scientific: s.scientific },
    family: s.family,
    group: s.group,
    cycleDays: { min: s.cycle[0], typ: s.cycle[1], max: s.cycle[2] },
    depletionFractionBase: baseP,
    gdd: { baseC: s.gdd[0], toMaturity: s.gdd[1] },
    temp: {
      absMinC: s.temp.absMin,
      optMinC: s.temp.optMin,
      optMaxC: s.temp.optMax,
      absMaxC: s.temp.absMax,
      frostKill: false,
      heatFloweringC: s.temp.heatFlowerC,
    },
    water: { seasonMm: s.seasonMm, droughtTolerance: s.droughtTol, waterloggingTolerance: s.waterlogTol },
    kc: { ini: s.kc.ini, mid: s.kc.mid, end: s.kc.end },
    stageFractions: s.stageFr,
    rootDepthM: s.rootDepthM,
    soil: {
      phMin: s.ph.absMin,
      phOpt: [s.ph.optMin, s.ph.optMax],
      phMax: s.ph.absMax,
      textures: s.textures,
      salinityTolerance: s.salinity,
      drainage: s.drainage,
    },
    nFixKgHa: s.nFix ? (s.nFix[0] + s.nFix[1]) / 2 : undefined,
    nDemandKgHa: s.nDemand,
    residue: { tHa: s.residue.tHa, cnRatio: s.residue.cn },
    pestGroups: s.pests,
    diseaseGroups: s.diseases,
    coverCropRoles: s.roles,
    sources: [
      s.ecoId
        ? { field: "Temperature, pH, rainfall ecology", ref: `FAO ECOCROP data sheet ${s.ecoId}` }
        : { field: "Temperature, pH, rainfall ecology", ref: "Analyst starting values; look up the ECOCROP sheet and local sources" },
      { field: "Crop coefficients", ref: s.kc.ref },
      { field: "Calendars, nitrogen, rotation rules", ref: "Analyst starting values; see each rule's scope" },
    ],
    profile: {
      varietyValidated: false,
      note: s.varietyNote ?? "Species-level reference. No variety has been chosen or validated for Myanmar.",
      stages,
      ecologyAnnualRainMm: s.ecoId
        ? eco(s.ecologyRain, s.ecoId, "annual rainfall, absolute range (broad ecology, not a seasonal need)")
        : assumed(s.ecologyRain, "annual rainfall range (broad ecology, not a seasonal need)"),
      tempC: {
        optMin: t(s.temp.optMin, "optimal minimum temperature"),
        optMax: t(s.temp.optMax, "optimal maximum temperature"),
        absMin: t(s.temp.absMin, "absolute minimum temperature"),
        absMax: t(s.temp.absMax, "absolute maximum temperature"),
      },
      ph: {
        optMin: t(s.ph.optMin, "optimal minimum soil pH"),
        optMax: t(s.ph.optMax, "optimal maximum soil pH"),
        absMin: t(s.ph.absMin, "absolute minimum soil pH"),
        absMax: t(s.ph.absMax, "absolute maximum soil pH"),
      },
      nFixKgHa: s.nFix ? assumed(s.nFix, "biologically fixed N per crop, wide literature range") : undefined,
      grainNPct: s.grainN !== undefined ? assumed(s.grainN, "nitrogen in dry grain") : undefined,
      residueNPct: s.residueN !== undefined ? assumed(s.residueN, "nitrogen in dry residue") : undefined,
      rotationRules: [
        sameFamily(s.family, `Following a ${s.family} crop with another ${s.family} crop can carry over shared pests and diseases.`),
      ],
      depletionFractionBase: fao(baseP, "FAO-56 Table 22 base soil water depletion fraction p"),
      forage: { ...s.forage, ref: "Analyst starting value; confirm local feed use and quality.", scope: "analyst-assumption" },
      regionalCalendars: s.calendars,
    },
  };
}

const CEREAL_FOOD = { use: "residue-fodder" as const, note: "Straw or stover can be used as fodder or retained; quality varies." };
const PULSE_FOOD = { use: "residue-fodder" as const, note: "Pulse haulms are a useful fodder; quality depends on the variety and harvest." };

export const MYANMAR_CROPS: Crop[] = [
  build({
    id: "rice",
    common: "Rice",
    local: ["စပါး", "မိုးစပါး", "Paddy"],
    scientific: "Oryza sativa",
    family: "Poaceae",
    group: "cereal",
    cycle: [100, 135, 160],
    gdd: [10, 2000],
    temp: { absMin: 10, optMin: 20, optMax: 30, absMax: 36, heatFlowerC: 35, coldC: 15 },
    ph: { absMin: 4.5, optMin: 5.5, optMax: 7.0, absMax: 8.0 },
    ecologyRain: [1000, 4000],
    seasonMm: { min: 700, opt: 1100, max: 1800 },
    droughtTol: 1,
    waterlogTol: 5,
    kc: { ini: 1.05, mid: 1.2, end: 0.75, scope: "fao56", ref: "Table 12, rice (end value between 0.9 and 0.6)" },
    stageFr: { ini: 0.2, dev: 0.2, mid: 0.4, late: 0.2 },
    rootDepthM: 0.5,
    textures: ["clay", "silty clay", "clay loam", "silty clay loam", "silt loam", "loam"],
    salinity: 2,
    drainage: ["poor", "moderate"],
    nDemand: 90,
    residue: { tHa: 5.0, cn: 70 },
    grainN: 1.2,
    residueN: 0.6,
    pests: ["stem-borer", "brown-planthopper", "rice-bug"],
    diseases: ["blast", "bacterial-blight", "sheath-blight"],
    forage: CEREAL_FOOD,
    droughtStages: ["dev", "mid"],
    waterlogStages: [],
    pBase: 0.2,
    calendars: {
      ayeyarwady: cal(["06-01", "07-31"], [120, 160]),
      magway: cal(["06-15", "08-15"], [110, 150]),
    },
  }),
  build({
    id: "black-gram",
    common: "Black gram",
    local: ["မတ်ပဲ", "Urd bean"],
    scientific: "Vigna mungo",
    family: "Fabaceae",
    group: "legume",
    cycle: [60, 90, 130],
    gdd: [10, 1200],
    temp: { absMin: 8, optMin: 22, optMax: 35, absMax: 40, heatFlowerC: 38 },
    ecoId: 2149,
    ph: { absMin: 4.5, optMin: 5.5, optMax: 6.5, absMax: 7.5 },
    ecologyRain: [530, 2430],
    seasonMm: { min: 250, opt: 350, max: 600 },
    droughtTol: 3,
    waterlogTol: 2,
    pBase: 0.45,
    floweringRainMm: 10,
    kc: { ini: 0.4, mid: 1.15, end: 0.35, scope: "fao56", ref: "Table 12, pulses (dry beans) used as the nearest published group" },
    stageFr: { ini: 0.2, dev: 0.25, mid: 0.35, late: 0.2 },
    rootDepthM: 0.7,
    textures: ["clay", "clay loam", "silty clay loam", "loam", "silt loam", "sandy clay loam"],
    salinity: 2,
    drainage: ["moderate", "good", "excessive"],
    nFix: [20, 60],
    nDemand: 30,
    residue: { tHa: 2.0, cn: 25 },
    grainN: 3.8,
    residueN: 1.4,
    pests: ["pod-borer", "whitefly", "aphid"],
    diseases: ["yellow-mosaic-virus", "powdery-mildew", "cercospora-leaf-spot"],
    roles: ["nitrogen"],
    forage: PULSE_FOOD,
    droughtStages: ["mid"],
    waterlogStages: ["ini", "dev", "mid"],
    calendars: { ayeyarwady: cal(["10-20", "12-20"], [60, 100]), magway: cal(["08-15", "10-15"], [65, 100]) },
  }),
  build({
    id: "green-gram",
    common: "Green gram (mung bean)",
    local: ["ပဲတီစိမ်း", "Mung bean"],
    scientific: "Vigna radiata",
    family: "Fabaceae",
    group: "legume",
    cycle: [50, 75, 120],
    gdd: [10, 1050],
    temp: { absMin: 8, optMin: 21, optMax: 36, absMax: 40, heatFlowerC: 38 },
    ecoId: 2150,
    ph: { absMin: 4.3, optMin: 5.5, optMax: 6.2, absMax: 8.3 },
    ecologyRain: [500, 1250],
    seasonMm: { min: 250, opt: 350, max: 550 },
    droughtTol: 3,
    waterlogTol: 2,
    pBase: 0.45,
    floweringRainMm: 10,
    kc: { ini: 0.4, mid: 1.15, end: 0.35, scope: "fao56", ref: "Table 12, pulses (dry beans) used as the nearest published group" },
    stageFr: { ini: 0.2, dev: 0.25, mid: 0.35, late: 0.2 },
    rootDepthM: 0.6,
    textures: ALL_TEXTURES.filter((x) => x !== "sand"),
    salinity: 2,
    drainage: ["good", "excessive"],
    nFix: [30, 70],
    nDemand: 30,
    residue: { tHa: 1.8, cn: 24 },
    grainN: 3.8,
    residueN: 1.5,
    pests: ["pod-borer", "whitefly", "aphid"],
    diseases: ["yellow-mosaic-virus", "powdery-mildew", "cercospora-leaf-spot"],
    roles: ["nitrogen"],
    forage: PULSE_FOOD,
    droughtStages: ["mid"],
    waterlogStages: ["ini", "dev", "mid"],
    calendars: {
      ayeyarwady: cal(["10-20", "01-15"], [55, 90]),
      magway: cal(["08-15", "10-31"], [55, 90]),
    },
  }),
  build({
    id: "sesame",
    common: "Sesame",
    local: ["နှမ်း", "Gingelly"],
    scientific: "Sesamum indicum",
    family: "Pedaliaceae",
    group: "oilseed",
    cycle: [80, 100, 130],
    gdd: [10, 1700],
    temp: { absMin: 10, optMin: 24, optMax: 32, absMax: 40, heatFlowerC: 38 },
    ph: { absMin: 5.0, optMin: 5.5, optMax: 7.5, absMax: 8.0 },
    ecologyRain: [400, 1500],
    seasonMm: { min: 300, opt: 450, max: 700 },
    droughtTol: 4,
    waterlogTol: 1,
    pBase: 0.6,
    floweringRainMm: 10,
    kc: { ini: 0.35, mid: 1.1, end: 0.25, scope: "fao56", ref: "Table 12, sesame" },
    stageFr: { ini: 0.18, dev: 0.27, mid: 0.36, late: 0.19 },
    rootDepthM: 1.0,
    textures: LOAM_SANDY_TEXTURES,
    salinity: 2,
    drainage: ["good", "excessive"],
    nDemand: 60,
    residue: { tHa: 2.5, cn: 60 },
    grainN: 3.3,
    residueN: 0.7,
    pests: ["leaf-webber", "gall-midge", "hawk-moth"],
    diseases: ["phytophthora-blight", "powdery-mildew", "leaf-spot"],
    forage: { use: "none", note: "Stalks are generally not used as feed." },
    droughtStages: ["ini", "mid"],
    waterlogStages: ["ini", "dev", "mid", "late"],
    calendars: { magway: cal(["05-01", "08-15"], [80, 120]) },
  }),
  build({
    id: "groundnut",
    common: "Groundnut (Peanut)",
    local: ["မြေပဲ", "Peanut"],
    scientific: "Arachis hypogaea",
    family: "Fabaceae",
    group: "legume",
    cycle: [90, 115, 140],
    gdd: [13, 1350],
    temp: { absMin: 10, optMin: 22, optMax: 32, absMax: 38, heatFlowerC: 36 },
    ph: { absMin: 5.0, optMin: 5.8, optMax: 7.0, absMax: 7.8 },
    ecologyRain: [500, 1500],
    seasonMm: { min: 350, opt: 500, max: 700 },
    droughtTol: 4,
    waterlogTol: 1,
    pBase: 0.5,
    kc: { ini: 0.4, mid: 1.15, end: 0.6, scope: "fao56", ref: "Table 12, groundnut" },
    stageFr: { ini: 0.2, dev: 0.27, mid: 0.35, late: 0.18 },
    rootDepthM: 0.9,
    textures: LOAM_SANDY_TEXTURES,
    salinity: 2,
    drainage: ["good", "excessive"],
    nFix: [40, 120],
    nDemand: 40,
    residue: { tHa: 2.8, cn: 25 },
    grainN: 4.0,
    residueN: 1.8,
    pests: ["thrips", "aphid", "leafminer"],
    diseases: ["leaf-spot", "rosette-virus", "aflatoxin"],
    roles: ["nitrogen"],
    forage: { use: "residue-fodder", note: "Groundnut haulms are a well-known fodder; quality drops if rained on." },
    droughtStages: ["mid"],
    waterlogStages: ["ini", "dev", "mid", "late"],
    calendars: { magway: cal(["05-15", "07-15"], [100, 130]), shan: cal(["05-15", "07-15"], [110, 140]) },
  }),
  build({
    id: "chickpea",
    common: "Chickpea",
    local: ["ကုလားပဲ", "Garbanzo"],
    scientific: "Cicer arietinum",
    family: "Fabaceae",
    group: "legume",
    cycle: [90, 105, 125],
    gdd: [5, 1500],
    temp: { absMin: 5, optMin: 15, optMax: 28, absMax: 35, heatFlowerC: 32, coldC: 8 },
    ph: { absMin: 5.5, optMin: 6.0, optMax: 7.5, absMax: 8.5 },
    ecologyRain: [400, 1000],
    seasonMm: { min: 200, opt: 300, max: 450 },
    droughtTol: 4,
    waterlogTol: 1,
    pBase: 0.45,
    kc: { ini: 0.4, mid: 1.0, end: 0.35, scope: "fao56", ref: "Table 12, chick pea" },
    stageFr: { ini: 0.18, dev: 0.27, mid: 0.37, late: 0.18 },
    rootDepthM: 1.0,
    textures: ["clay loam", "silty clay loam", "loam", "silt loam", "sandy clay loam", "clay"],
    salinity: 2,
    drainage: ["good", "moderate"],
    nFix: [20, 80],
    nDemand: 30,
    residue: { tHa: 2.2, cn: 30 },
    grainN: 3.2,
    residueN: 0.9,
    pests: ["pod-borer", "aphid"],
    diseases: ["fusarium-wilt", "ascochyta-blight", "botrytis-grey-mould"],
    roles: ["nitrogen"],
    forage: PULSE_FOOD,
    droughtStages: ["mid", "late"],
    waterlogStages: ["ini", "dev", "mid", "late"],
    calendars: { magway: cal(["10-15", "11-30"], [90, 120]) },
  }),
  build({
    id: "pigeon-pea",
    common: "Pigeon pea",
    local: ["ပဲစင်းငုံ", "Red gram"],
    scientific: "Cajanus cajan",
    family: "Fabaceae",
    group: "legume",
    cycle: [120, 160, 240],
    gdd: [10, 2400],
    temp: { absMin: 10, optMin: 20, optMax: 32, absMax: 40, heatFlowerC: 38 },
    ph: { absMin: 4.5, optMin: 5.0, optMax: 7.0, absMax: 8.0 },
    ecologyRain: [600, 1500],
    seasonMm: { min: 400, opt: 600, max: 900 },
    droughtTol: 4,
    waterlogTol: 2,
    pBase: 0.5,
    kc: { ini: 0.4, mid: 1.15, end: 0.35, scope: "analyst-assumption", ref: "pulses group Kc; pigeon pea has no own entry in FAO-56 Table 12" },
    stageFr: { ini: 0.12, dev: 0.28, mid: 0.4, late: 0.2 },
    rootDepthM: 1.5,
    textures: ALL_TEXTURES.filter((x) => x !== "sand"),
    salinity: 2,
    drainage: ["good", "moderate"],
    nFix: [40, 100],
    nDemand: 40,
    residue: { tHa: 4.0, cn: 40 },
    grainN: 3.4,
    residueN: 1.0,
    pests: ["pod-borer", "pod-fly"],
    diseases: ["fusarium-wilt", "sterility-mosaic"],
    roles: ["nitrogen", "organic-matter"],
    forage: { use: "residue-fodder", note: "Leaves and stalks are used as fodder or fuel." },
    droughtStages: ["mid"],
    waterlogStages: ["ini", "dev"],
    calendars: { magway: cal(["06-01", "08-15"], [140, 220]) },
  }),
  build({
    id: "maize",
    common: "Maize",
    local: ["ပြောင်းဖူး", "Corn"],
    scientific: "Zea mays",
    family: "Poaceae",
    group: "cereal",
    cycle: [90, 120, 150],
    gdd: [10, 1400],
    temp: { absMin: 8, optMin: 18, optMax: 32, absMax: 38, heatFlowerC: 35 },
    ph: { absMin: 5.0, optMin: 5.8, optMax: 7.2, absMax: 8.0 },
    ecologyRain: [500, 1500],
    seasonMm: { min: 450, opt: 650, max: 900 },
    droughtTol: 2,
    waterlogTol: 2,
    pBase: 0.55,
    kc: { ini: 0.3, mid: 1.2, end: 0.35, scope: "fao56", ref: "Table 12, maize (grain, end value for dry harvest)" },
    stageFr: { ini: 0.15, dev: 0.3, mid: 0.35, late: 0.2 },
    rootDepthM: 1.2,
    textures: ALL_TEXTURES.filter((x) => x !== "sand"),
    salinity: 2,
    drainage: ["moderate", "good"],
    nDemand: 160,
    residue: { tHa: 7.5, cn: 60 },
    grainN: 1.4,
    residueN: 0.6,
    pests: ["stem-borer", "fall-armyworm"],
    diseases: ["foliar-blight", "rust", "ear-rot"],
    forage: CEREAL_FOOD,
    droughtStages: ["mid"],
    waterlogStages: ["ini", "dev", "mid"],
    calendars: { shan: cal(["04-15", "06-30"], [100, 150]) },
  }),
  build({
    id: "soybean",
    common: "Soybean",
    local: ["ပဲပိစပ်", "Soya"],
    scientific: "Glycine max",
    family: "Fabaceae",
    group: "legume",
    cycle: [95, 120, 140],
    gdd: [10, 1250],
    temp: { absMin: 7, optMin: 20, optMax: 30, absMax: 36, heatFlowerC: 34 },
    ph: { absMin: 5.0, optMin: 6.0, optMax: 7.0, absMax: 7.8 },
    ecologyRain: [450, 1500],
    seasonMm: { min: 400, opt: 550, max: 750 },
    droughtTol: 3,
    waterlogTol: 2,
    pBase: 0.5,
    kc: { ini: 0.4, mid: 1.15, end: 0.5, scope: "fao56", ref: "Table 12, soybeans" },
    stageFr: { ini: 0.15, dev: 0.25, mid: 0.4, late: 0.2 },
    rootDepthM: 1.0,
    textures: ALL_TEXTURES.filter((x) => x !== "sand"),
    salinity: 2,
    drainage: ["moderate", "good"],
    nFix: [40, 120],
    nDemand: 60,
    residue: { tHa: 3.5, cn: 30 },
    grainN: 6.0,
    residueN: 0.9,
    pests: ["stink-bug", "aphid", "pod-borer"],
    diseases: ["rust", "root-rot", "mosaic-virus"],
    roles: ["nitrogen"],
    forage: { use: "residue-fodder", note: "Straw is a lower-quality fodder; pods shatter if harvest is late." },
    droughtStages: ["mid"],
    waterlogStages: ["ini", "dev", "mid"],
    calendars: { shan: cal(["05-15", "07-15"], [100, 140]) },
  }),
  build({
    id: "lablab",
    common: "Lablab (hyacinth bean)",
    local: ["ပဲကြီးလှ", "Lablab"],
    scientific: "Lablab purpureus",
    family: "Fabaceae",
    group: "cover",
    cycle: [90, 120, 150],
    gdd: [10, 1600],
    temp: { absMin: 8, optMin: 22, optMax: 30, absMax: 36 },
    ph: { absMin: 4.5, optMin: 5.5, optMax: 7.0, absMax: 8.0 },
    ecologyRain: [650, 3000],
    seasonMm: { min: 300, opt: 500, max: 800 },
    droughtTol: 4,
    waterlogTol: 2,
    kc: { ini: 0.4, mid: 1.1, end: 0.5, scope: "analyst-assumption", ref: "pulses group Kc; lablab has no own entry in FAO-56 Table 12" },
    stageFr: { ini: 0.15, dev: 0.3, mid: 0.35, late: 0.2 },
    rootDepthM: 1.2,
    textures: ALL_TEXTURES.filter((x) => x !== "sand"),
    salinity: 2,
    drainage: ["moderate", "good"],
    nFix: [50, 150],
    nDemand: 20,
    residue: { tHa: 4.0, cn: 20 },
    residueN: 2.2,
    pests: ["pod-borer", "aphid"],
    diseases: ["anthracnose", "root-rot"],
    roles: ["nitrogen", "erosion", "organic-matter", "weeds"],
    forage: { use: "forage", note: "Leaves and green pods are a high-protein forage; also usable as green manure." },
    droughtStages: ["ini"],
    waterlogStages: ["ini", "dev"],
    calendars: { shan: cal(["07-15", "09-15"], [60, 120]) },
    varietyNote: "Cover-crop species chosen by the project team for Shan State. No variety validated.",
  }),
  build({
    id: "sunn-hemp",
    common: "Sunn hemp",
    local: ["ပိုက်ပင်", "Sunhemp"],
    scientific: "Crotalaria juncea",
    family: "Fabaceae",
    group: "cover",
    cycle: [60, 90, 120],
    gdd: [10, 1200],
    temp: { absMin: 10, optMin: 22, optMax: 32, absMax: 38 },
    ph: { absMin: 5.0, optMin: 6.0, optMax: 7.5, absMax: 8.5 },
    ecologyRain: [500, 2500],
    seasonMm: { min: 250, opt: 450, max: 750 },
    droughtTol: 4,
    waterlogTol: 2,
    kc: { ini: 0.4, mid: 1.05, end: 0.5, scope: "analyst-assumption", ref: "green-manure legume; no entry in FAO-56 Table 12" },
    stageFr: { ini: 0.15, dev: 0.35, mid: 0.35, late: 0.15 },
    rootDepthM: 1.0,
    textures: ALL_TEXTURES,
    salinity: 3,
    drainage: ["moderate", "good", "excessive"],
    nFix: [80, 200],
    nDemand: 10,
    residue: { tHa: 6.0, cn: 18 },
    residueN: 2.5,
    pests: ["leaf-feeding-caterpillar"],
    diseases: ["wilt"],
    roles: ["nitrogen", "erosion", "organic-matter", "weeds"],
    forage: { use: "green-manure", note: "Grown to be cut and returned to the soil; not a feed crop." },
    droughtStages: ["ini"],
    waterlogStages: ["ini", "dev"],
    calendars: { shan: cal(["05-15", "07-31"], [45, 100]) },
    varietyNote: "Cover-crop species chosen by the project team for Shan State. No variety validated.",
  }),
];
