import type { CropEconomics } from "../../types";

/**
 * Real-world benchmark economics for crops in Myanmar (2024–2026).
 *
 * Sources:
 * - Myanmar Department of Agriculture (DOA), Ministry of Agriculture, Livestock and Irrigation.
 * - Bayintnaung Wholesale Commodity Exchange (Yangon) & War Tan Wholesale Depot.
 * - Myanmar Pulses, Beans & Sesame Seeds Merchants Association (MPBMSMA).
 * - Central Dry Zone (Magway/Mandalay/Monywa) and Southern Shan (Taunggyi) wholesale markets.
 * - IFPRI Myanmar Agriculture Policy Support Activity (MAPSA) market bulletins.
 *
 * Price units: Myanmar Kyats per kilogram (MMK/kg).
 * Conversions:
 *   - 1 viss = 1.63293 kg (~1.633 kg)
 *   - 1 basket of rough paddy = 46 lbs = 20.86 kg (100 baskets = 2,086 kg)
 *   - 1 basket of pulses (black gram, green gram, pigeon pea, chickpea, soybean) = 72 lbs = 31.75 kg (to 32.65 kg)
 *   - 1 basket of sesame / maize = 54 lbs = 24.5 kg
 *   - 1 metric ton = 1,000 kg
 */

export interface RealWorldCropEconomicProfile extends CropEconomics {
  cropName: string;
  burmeseName: string;
  traditionalUnitNote: string;
}

export const REAL_WORLD_CROP_ECONOMICS: Record<string, RealWorldCropEconomicProfile> = {
  rice: {
    cropId: "rice",
    cropName: "Paddy Rice",
    burmeseName: "မိုးစပါး / နွေစပါး",
    priceMmkPerKg: [950, 1300],
    yieldKgHa: [3200, 4800],
    costMmkPerHa: [850000, 1350000],
    source: "Myanmar Department of Agriculture (DOA) & Bayintnaung Wholesale 2024–2026",
    traditionalUnitNote: "Rough paddy: 2.0M–2.7M MMK / 100 baskets (~2,086 kg). Milled rice: 75,000–85,000 MMK / 50 kg bag.",
  },
  "black-gram": {
    cropId: "black-gram",
    cropName: "Black Gram (Matpe)",
    burmeseName: "မတ်ပဲ",
    priceMmkPerKg: [3200, 3850],
    yieldKgHa: [1000, 1600],
    costMmkPerHa: [550000, 850000],
    source: "Bayintnaung Wholesale Market & MPBMSMA Export Indicative 2024–2026",
    traditionalUnitNote: "Wholesale export FAQ/SQ: 3.5M–3.85M MMK / MT. Local assembly: ~105,000–122,000 MMK / basket (31.75 kg).",
  },
  "green-gram": {
    cropId: "green-gram",
    cropName: "Green Gram (Pedisein)",
    burmeseName: "ပဲတီစိမ်း",
    priceMmkPerKg: [3200, 4500],
    yieldKgHa: [950, 1500],
    costMmkPerHa: [520000, 800000],
    source: "MPBMSMA & DOA Pulses Market Report 2024–2026",
    traditionalUnitNote: "Bago/Khayan Shwe Wah grades: ~5,500–7,500 MMK / viss (~1.63 kg).",
  },
  sesame: {
    cropId: "sesame",
    cropName: "Sesame (Hnan)",
    burmeseName: "နှမ်း",
    priceMmkPerKg: [4500, 6800],
    yieldKgHa: [500, 900],
    costMmkPerHa: [450000, 700000],
    source: "Magway & Mandalay Commodity Exchange Wholesale 2024–2026",
    traditionalUnitNote: "Black sesame (Samone) 9,500–11,500 MMK / viss; Brown/white mix 7,500–9,000 MMK / viss (~1.63 kg).",
  },
  groundnut: {
    cropId: "groundnut",
    cropName: "Groundnut (Peanut)",
    burmeseName: "မြေပဲ",
    priceMmkPerKg: [2400, 3600],
    yieldKgHa: [1400, 2200],
    costMmkPerHa: [700000, 1100000],
    source: "Central Dry Zone (Magway/Mandalay) Oilseed Market Assessment 2024–2026",
    traditionalUnitNote: "In-shell pods: 3,800–5,500 MMK / viss (~1.63 kg). Shelled kernel wholesale: 4,500–6,000 MMK / kg.",
  },
  sunflower: {
    cropId: "sunflower",
    cropName: "Sunflower (Naykya)",
    burmeseName: "နေကြာ",
    priceMmkPerKg: [3200, 4500],
    yieldKgHa: [1000, 1600],
    costMmkPerHa: [480000, 720000],
    source: "Magway & Mandalay Oilseed Market Assessment 2024–2026",
    traditionalUnitNote: "Edible oilseed: 5,200–7,200 MMK / viss (~1.63 kg).",
  },
  chickpea: {
    cropId: "chickpea",
    cropName: "Chickpea (Kalape)",
    burmeseName: "ကုလားပဲ",
    priceMmkPerKg: [3400, 4200],
    yieldKgHa: [1100, 1700],
    costMmkPerHa: [550000, 850000],
    source: "Mandalay & Monywa Commodity Exchange 2024–2026",
    traditionalUnitNote: "Wholesale depot: 5,500–6,800 MMK / viss (~1.63 kg).",
  },
  "pigeon-pea": {
    cropId: "pigeon-pea",
    cropName: "Pigeon Pea (Pesingon)",
    burmeseName: "ပဲစင်းငုံ",
    priceMmkPerKg: [3400, 4100],
    yieldKgHa: [900, 1500],
    costMmkPerHa: [500000, 750000],
    source: "Bayintnaung Wholesale & MPBMSMA Export Indicative 2024–2026",
    traditionalUnitNote: "Red pigeon pea export: 3.8M–4.2M MMK / MT. Farm-gate: ~110,000–130,000 MMK / basket (31.75 kg).",
  },
  maize: {
    cropId: "maize",
    cropName: "Maize / Corn (Pyaung)",
    burmeseName: "ပြောင်းဖူး",
    priceMmkPerKg: [1050, 1400],
    yieldKgHa: [4000, 6500],
    costMmkPerHa: [900000, 1500000],
    source: "Southern Shan (Taunggyi) Maize Market & CP Feed Purchase 2024–2026",
    traditionalUnitNote: "Feed grain depot: 1,100–1,450 MMK / kg (approx 17,500–23,000 MMK / bag of 54 lbs).",
  },
  soybean: {
    cropId: "soybean",
    cropName: "Soybean (Pè-pok)",
    burmeseName: "ပဲပုပ်",
    priceMmkPerKg: [3000, 3900],
    yieldKgHa: [1200, 1900],
    costMmkPerHa: [600000, 900000],
    source: "Shan State & Mandalay Agricultural Market Information 2024–2026",
    traditionalUnitNote: "Wholesale: 4,900–6,400 MMK / viss (~1.63 kg).",
  },
  lablab: {
    cropId: "lablab",
    cropName: "Lablab Bean (Pè-gyi)",
    burmeseName: "ပဲကြီး",
    priceMmkPerKg: [2600, 3400],
    yieldKgHa: [800, 1400],
    costMmkPerHa: [400000, 650000],
    source: "Myanmar Local Vegetable and Pulse Market Survey 2024–2026",
    traditionalUnitNote: "Local assembly: 4,200–5,500 MMK / viss (~1.63 kg).",
  },
  "sunn-hemp": {
    cropId: "sunn-hemp",
    cropName: "Sunn Hemp (Pike San Shwe)",
    burmeseName: "ပိုက်ဆံလျှော်",
    priceMmkPerKg: [2500, 3200],
    yieldKgHa: [400, 750],
    costMmkPerHa: [200000, 350000],
    source: "DOA Land Use Division Green Manure Program 2024–2026",
    traditionalUnitNote: "Seed production: 2,500–3,200 MMK / kg. Biomass incorporation as green manure: 0 MMK / kg direct sales.",
  },
  wheat: {
    cropId: "wheat",
    cropName: "Wheat (Gyon)",
    burmeseName: "ဂျုံ",
    priceMmkPerKg: [1100, 1500],
    yieldKgHa: [1500, 2400],
    costMmkPerHa: [650000, 1000000],
    source: "Sagaing & Shan Highlands Winter Wheat Production Survey 2024–2026",
    traditionalUnitNote: "Wholesale grain: 1,100–1,500 MMK / kg (~1,800–2,450 MMK / viss).",
  },
  sorghum: {
    cropId: "sorghum",
    cropName: "Sorghum (Pyaung-hpyu)",
    burmeseName: "ပြောင်းဆန် / နှံစားပြောင်း",
    priceMmkPerKg: [900, 1300],
    yieldKgHa: [1200, 2200],
    costMmkPerHa: [450000, 700000],
    source: "Central Dry Zone Fodder and Coarse Grain Assessment 2024–2026",
    traditionalUnitNote: "Grain depot: 900–1,300 MMK / kg (~1,450–2,100 MMK / viss).",
  },
  cowpea: {
    cropId: "cowpea",
    cropName: "Cowpea (Pelun)",
    burmeseName: "ပဲလွမ်း",
    priceMmkPerKg: [2500, 3400],
    yieldKgHa: [900, 1500],
    costMmkPerHa: [450000, 700000],
    source: "Mandalay & Bago Local Pulse Market Assessment 2024–2026",
    traditionalUnitNote: "Wholesale depot: 4,000–5,500 MMK / viss (~1.63 kg).",
  },
  "crimson-clover": {
    cropId: "crimson-clover",
    cropName: "Crimson Clover",
    burmeseName: "ကလိုဗာ (အဖုံးသီးနှံ)",
    priceMmkPerKg: [2000, 2800],
    yieldKgHa: [300, 600],
    costMmkPerHa: [200000, 350000],
    source: "Reference Cover Crop & Forage Seed Benchmark 2024–2026",
    traditionalUnitNote: "Specialty forage & cover seed valuation: 2,000–2,800 MMK / kg.",
  },
};

export function getRealWorldCropEconomics(cropId: string): RealWorldCropEconomicProfile | undefined {
  return REAL_WORLD_CROP_ECONOMICS[cropId];
}

export function getDefaultEconomicsForCrops(cropIds: string[]): CropEconomics[] {
  return cropIds
    .map((id) => REAL_WORLD_CROP_ECONOMICS[id])
    .filter((e): e is RealWorldCropEconomicProfile => Boolean(e))
    .map(({ cropId, yieldKgHa, priceMmkPerKg, costMmkPerHa, source }) => ({
      cropId,
      yieldKgHa,
      priceMmkPerKg,
      costMmkPerHa,
      source,
    }));
}
