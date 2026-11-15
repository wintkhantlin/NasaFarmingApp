import type { RuleScope } from "../../types";

/**
 * Weather that favours a disease, as simple daily rules on NASA POWER data. A rule says when the weather was
 * right for the disease, not that the disease happened: inoculum, variety and crop care decide that. Each rule
 * needs a run of consecutive favourable days, because a single humid day rarely starts an outbreak.
 *
 * The thresholds are analyst readings of the general literature, set wide on purpose because POWER gives daily
 * means on a ~50 km cell, not leaf wetness or canopy humidity. POWER humidity (RH2M) has not been checked
 * against Myanmar stations (docs/validation/README.md checks temperature and rain only).
 */

export interface WeatherDay {
  tmaxC: number | null;
  tminC: number | null;
  tmeanC: number | null;
  rainMm: number | null;
  rhPct: number | null;
}

export interface WeatherDiseaseRule {
  id: string;
  name: string;
  scientific: string;
  /** Library crop ids the rule applies to. */
  hosts: string[];
  /** Plain words for the weather the rule looks for. */
  weather: string;
  /** True when the day is favourable. Null when the inputs are missing. */
  favourable: (d: WeatherDay) => boolean | null;
  /** Consecutive favourable days that make one spell. */
  minRunDays: number;
  /** Ties the rule to a HOST_ORGANISMS entry when one exists. */
  organismId?: string;
  /** Uses daily rain, so it inherits the Dry Zone POWER rain bias. */
  usesRain: boolean;
  /** Uses POWER relative humidity, which no ground check covers yet. */
  usesHumidity: boolean;
  advice: string;
  ref: string;
  scope: RuleScope;
}

const SCOPE: RuleScope = "analyst-assumption";
const known = (...v: Array<number | null>) => v.every((x) => x !== null && Number.isFinite(x));

export const WEATHER_DISEASE_RULES: WeatherDiseaseRule[] = [
  {
    id: "rice-blast",
    name: "Rice blast",
    scientific: "Pyricularia oryzae",
    hosts: ["rice"],
    weather: "3 or more days in a row with nights of 20–26 °C and humidity of 90% or more",
    favourable: (d) => (known(d.tminC, d.rhPct) ? d.tminC! >= 20 && d.tminC! <= 26 && d.rhPct! >= 90 : null),
    minRunDays: 3,
    usesRain: false,
    usesHumidity: true,
    advice: "Look for grey-centred, diamond-shaped leaf spots and dark neck lesions at heading. Heavy nitrogen and dense stands make it worse.",
    ref: "Calvero, Coakley & Teng (1996), Plant Pathology 45:667–678, weather and blast; IRRI Rice Knowledge Bank",
    scope: SCOPE,
  },
  {
    id: "sheath-blight",
    name: "Sheath blight",
    scientific: "Rhizoctonia solani",
    hosts: ["rice"],
    organismId: "rhizoctonia",
    weather: "5 or more days in a row averaging 25–32 °C with humidity of 85% or more",
    favourable: (d) => (known(d.tmeanC, d.rhPct) ? d.tmeanC! >= 25 && d.tmeanC! <= 32 && d.rhPct! >= 85 : null),
    minRunDays: 5,
    usesRain: false,
    usesHumidity: true,
    advice: "Look for oval, grey-green blotches on the sheath just above the water from late tillering. Dense planting and heavy nitrogen spread it.",
    ref: "IRRI Rice Knowledge Bank, sheath blight; CABI Compendium datasheet: Rhizoctonia solani",
    scope: SCOPE,
  },
  {
    id: "cercospora",
    name: "Cercospora leaf spot",
    scientific: "Cercospora canescens; Passalora arachidicola on groundnut",
    hosts: ["green-gram", "black-gram", "groundnut", "soybean", "lablab"],
    weather: "3 or more days in a row averaging 25–30 °C with humidity of 85% or more",
    favourable: (d) => (known(d.tmeanC, d.rhPct) ? d.tmeanC! >= 25 && d.tmeanC! <= 30 && d.rhPct! >= 85 : null),
    minRunDays: 3,
    usesRain: false,
    usesHumidity: true,
    advice: "Look for small brown spots with a pale halo on older leaves from flowering. Clean seed and removing old crop residue help.",
    ref: "CABI Compendium datasheets: Cercospora canescens; Passalora arachidicola",
    scope: SCOPE,
  },
  {
    id: "powdery-mildew",
    name: "Powdery mildew",
    scientific: "Erysiphe polygoni",
    hosts: ["green-gram", "black-gram", "pigeon-pea", "lablab"],
    weather: "5 or more dry days in a row averaging 20–27 °C with humidity of 50–80%",
    favourable: (d) =>
      known(d.tmeanC, d.rhPct, d.rainMm) ? d.tmeanC! >= 20 && d.tmeanC! <= 27 && d.rhPct! >= 50 && d.rhPct! <= 80 && d.rainMm! < 1 : null,
    minRunDays: 5,
    usesRain: true,
    usesHumidity: true,
    advice: "Look for white powder on the upper leaves, mostly in the cool dry season. Resistant varieties help most.",
    ref: "CABI Compendium datasheet: Erysiphe polygoni",
    scope: SCOPE,
  },
  {
    id: "charcoal-rot-heat",
    name: "Charcoal rot / dry root rot",
    scientific: "Macrophomina phaseolina",
    hosts: ["sesame", "green-gram", "black-gram", "chickpea", "soybean", "groundnut", "sunflower", "pigeon-pea", "maize", "cotton", "butter-bean", "niger"],
    organismId: "macrophomina",
    weather: "7 or more days in a row above 35 °C with no rain",
    favourable: (d) => (known(d.tmaxC, d.rainMm) ? d.tmaxC! >= 35 && d.rainMm! < 1 : null),
    minRunDays: 7,
    usesRain: true,
    usesHumidity: false,
    advice: "Look for plants wilting and drying from the bottom, with grey-black specks inside the lower stem. Keeping soil moisture up late in the season helps.",
    ref: "Kaur et al. (2012), Crit. Rev. Microbiol. 38:136–151, heat and drought favour Macrophomina",
    scope: SCOPE,
  },
  {
    id: "late-blight",
    name: "Late blight",
    scientific: "Phytophthora infestans",
    hosts: ["potato", "tomato"],
    weather: "3 or more days in a row averaging 12–22 °C with humidity of 90% or more",
    favourable: (d) => (known(d.tmeanC, d.rhPct) ? d.tmeanC! >= 12 && d.tmeanC! <= 22 && d.rhPct! >= 90 : null),
    minRunDays: 3,
    usesRain: false,
    usesHumidity: true,
    advice: "Look for water-soaked leaf spots with white downy growth underneath in cool foggy weather. Rapidly destroys Shan highland potato and tomato foliage.",
    ref: "Fry et al. (2015), Phytopathology 105:966–981; CABI Compendium: Phytophthora infestans",
    scope: SCOPE,
  },
  {
    id: "anthracnose-chili",
    name: "Anthracnose / fruit rot",
    scientific: "Colletotrichum capsici",
    hosts: ["chili", "butter-bean"],
    weather: "3 or more days in a row averaging 24–30 °C with humidity of 85% or more and rain",
    favourable: (d) =>
      known(d.tmeanC, d.rhPct, d.rainMm) ? d.tmeanC! >= 24 && d.tmeanC! <= 30 && d.rhPct! >= 85 && d.rainMm! >= 2 : null,
    minRunDays: 3,
    usesRain: true,
    usesHumidity: true,
    advice: "Look for sunken circular lesions on chili fruit with concentric rings of fungal spores. Avoid sprinkler irrigation during warm monsoon flushes.",
    ref: "Than et al. (2008), Fungal Diversity 32:1–21, Chili anthracnose review",
    scope: SCOPE,
  },
  {
    id: "purple-blotch",
    name: "Purple blotch",
    scientific: "Alternaria porri",
    hosts: ["onion", "garlic"],
    weather: "4 or more days in a row averaging 20–28 °C with humidity of 80% or more",
    favourable: (d) => (known(d.tmeanC, d.rhPct) ? d.tmeanC! >= 20 && d.tmeanC! <= 28 && d.rhPct! >= 80 : null),
    minRunDays: 4,
    usesRain: false,
    usesHumidity: true,
    advice: "Look for purplish, sunken elliptical lesions on onion and garlic leaves. Good spacing, raised beds and clean seed cloves reduce damage.",
    ref: "CABI Compendium datasheet: Alternaria porri",
    scope: SCOPE,
  },
];

export function weatherRulesFor(cropId: string): WeatherDiseaseRule[] {
  return WEATHER_DISEASE_RULES.filter((r) => r.hosts.includes(cropId));
}
