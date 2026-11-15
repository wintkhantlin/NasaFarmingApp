import { getCropById } from "../data/crops";
import { organismsHostedBy, type HostOrganism } from "../data/crops/host-organisms";
import { weatherRulesFor, type WeatherDiseaseRule } from "../data/crops/weather-disease-rules";
import type { Rotation, RuleScope } from "../types";
import { dryZoneRainCaution, isDryZone } from "../validation/source-checks";
import type { DailyRecord } from "./climate";
import { hostReturnIntervals, pestSequence, type ReturnIntervalWarning, type SharedHost } from "./pest";

/**
 * The Pests and diseases page: for each crop in the plan, which diseases past weather favoured during its
 * season, what it may pick up from the crop before, and which other pests it hosts. Weather is replayed over
 * the baseline years with the same sowing date each year, so "8 of 10 seasons" means the weather was right in
 * 8 of the last 10 years. It never says a disease happened.
 */

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
const isoOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** A season counts only if this share of its days has the weather the rule needs. */
export const MIN_SEASON_COVERAGE = 0.9;
/** Fewer checked seasons than this and the page says the weather record is too short. */
export const MIN_SEASONS = 5;

export type WeatherLevel = "often" | "sometimes" | "rarely" | "unknown";

export interface WeatherRiskResult {
  ruleId: string;
  name: string;
  scientific: string;
  weather: string;
  level: WeatherLevel;
  seasonsChecked: number;
  seasonsFavoured: number;
  /** Median favourable spells per checked season. */
  medianSpells: number;
  /** Months of the season with the most favourable days, in season order. */
  peakMonths: string[];
  advice: string;
  /** Plain-words limits on this result (unchecked humidity, Dry Zone rain bias). */
  caveats: string[];
  ref: string;
  scope: RuleScope;
}

export interface CropPestOutlook {
  slotId: string;
  cropId: string;
  cropName: string;
  plantDate: string;
  harvestDate: string;
  weather: WeatherRiskResult[];
  /** Soil-borne and bridging organisms shared with the crop before this one. */
  carriedIn: { fromName: string; gapDays: number | null; shared: SharedHost[] } | null;
  /** Every organism in the host table this crop can carry. */
  hosts: HostOrganism[];
}

export interface WatchItem {
  id: string;
  title: string;
  cropName: string;
  reason: string;
  kind: "weather" | "carryover" | "return";
}

export interface PestOutlook {
  crops: CropPestOutlook[];
  returnIntervals: ReturnIntervalWarning[];
  /** The few things most worth watching, most pressing first. */
  watch: WatchItem[];
  weatherYears: { start: number; end: number } | null;
}

export interface PestOutlookInput {
  rotation: Pick<Rotation, "slots" | "cycleYears">;
  records: DailyRecord[];
  years: { start: number; end: number };
  region?: string | null;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function levelOf(favoured: number, checked: number): WeatherLevel {
  if (checked < MIN_SEASONS) return "unknown";
  const share = favoured / checked;
  return share >= 0.6 ? "often" : share >= 0.3 ? "sometimes" : "rarely";
}

/** Replays one rule over the slot's season in each year. */
export function weatherRisk(
  rule: WeatherDiseaseRule,
  plantDate: string,
  seasonDays: number,
  byDate: Map<string, DailyRecord>,
  years: { start: number; end: number },
  region?: string | null,
): WeatherRiskResult {
  const [, mm, dd] = plantDate.split("-").map(Number);
  const spellsPerSeason: number[] = [];
  let favoured = 0;
  const monthDays = new Array<number>(12).fill(0);
  const monthOrder: number[] = [];

  for (let y = years.start; y <= years.end; y++) {
    const start = Date.UTC(y, mm - 1, dd) / DAY_MS;
    let known = 0;
    let run = 0;
    let spells = 0;
    const seasonMonths = new Array<number>(12).fill(0);
    for (let i = 0; i < seasonDays; i++) {
      const iso = isoOf(start + i);
      const month = Number(iso.slice(5, 7)) - 1;
      if (y === years.start && !monthOrder.includes(month)) monthOrder.push(month);
      const r = byDate.get(iso);
      const ok = r ? rule.favourable({ tmaxC: r.tmaxC, tminC: r.tminC, tmeanC: r.tmeanC, rainMm: r.rainMm, rhPct: r.rhPct ?? null }) : null;
      if (ok === null) {
        run = 0;
        continue;
      }
      known++;
      if (ok) {
        run++;
        if (run === rule.minRunDays) spells++;
        if (run >= rule.minRunDays) seasonMonths[month] += run === rule.minRunDays ? rule.minRunDays : 1;
      } else run = 0;
    }
    if (seasonDays <= 0 || known / seasonDays < MIN_SEASON_COVERAGE) continue;
    spellsPerSeason.push(spells);
    if (spells > 0) favoured++;
    seasonMonths.forEach((n, m) => (monthDays[m] += n));
  }

  const peak = Math.max(...monthDays);
  const peakMonths = peak > 0 ? monthOrder.filter((m) => monthDays[m] >= peak / 2).map((m) => MONTHS[m]) : [];
  const caveats: string[] = [];
  if (rule.usesHumidity) caveats.push("NASA POWER humidity has not been checked against Myanmar weather stations yet.");
  if (rule.usesRain && isDryZone(region)) caveats.push(`${dryZoneRainCaution()} Dry spells, and so this count, may be overstated.`);

  return {
    ruleId: rule.id,
    name: rule.name,
    scientific: rule.scientific,
    weather: rule.weather,
    level: levelOf(favoured, spellsPerSeason.length),
    seasonsChecked: spellsPerSeason.length,
    seasonsFavoured: favoured,
    medianSpells: median(spellsPerSeason),
    peakMonths,
    advice: rule.advice,
    caveats,
    ref: rule.ref,
    scope: rule.scope,
  };
}

const LEVEL_RANK: Record<WeatherLevel, number> = { often: 0, sometimes: 1, rarely: 2, unknown: 3 };

export function pestOutlook({ rotation, records, years, region }: PestOutlookInput): PestOutlook {
  const crops = rotation.slots
    .filter((s) => s.kind !== "fallow" && s.cropId)
    .sort((a, b) => a.plantDate.localeCompare(b.plantDate));
  const sequence = pestSequence(rotation);
  const byDate = new Map(records.map((r) => [r.date, r]));
  const hasWeather = records.some((r) => r.year >= years.start && r.year <= years.end);

  const outlook: CropPestOutlook[] = crops.map((slot, k) => {
    const cropId = slot.cropId!;
    const cropName = getCropById(cropId)?.names.common ?? cropId;
    const seasonDays = Math.max(0, Math.round(toDay(slot.harvestDate) - toDay(slot.plantDate)));
    const weather = hasWeather
      ? weatherRulesFor(cropId)
          .map((rule) => weatherRisk(rule, slot.plantDate, seasonDays, byDate, years, region))
          .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || b.seasonsFavoured - a.seasonsFavoured)
      : [];
    // pestSequence check j runs from crop j to crop j+1 (wrapping), so the one into crop k is check k-1.
    const into = sequence.length === crops.length ? sequence[(k - 1 + crops.length) % crops.length] : undefined;
    const carriedIn = into && into.shared.length ? { fromName: into.fromName, gapDays: into.gapDays, shared: into.shared } : null;
    return { slotId: slot.id, cropId, cropName, plantDate: slot.plantDate, harvestDate: slot.harvestDate, weather, carriedIn, hosts: organismsHostedBy(cropId) };
  });

  const returnIntervals = hostReturnIntervals(rotation);
  const watch: WatchItem[] = [];
  for (const w of returnIntervals) {
    watch.push({ id: `return:${w.organismId}:${w.cropId}`, title: w.name, cropName: w.cropName, kind: "return", reason: `${w.cropName} comes back every ${w.returnYears === 1 ? "year" : `${w.returnYears} years`}; at least ${w.minReturnYears} suggested` });
  }
  for (const c of outlook) {
    for (const h of c.carriedIn?.shared ?? []) {
      if (h.severity !== "caution") continue;
      watch.push({ id: `carry:${c.slotId}:${h.organismId}`, title: h.name, cropName: c.cropName, kind: "carryover", reason: `Can carry over in the soil from ${c.carriedIn!.fromName}` });
    }
  }
  for (const c of outlook) {
    for (const w of c.weather) {
      if (w.level !== "often") continue;
      watch.push({ id: `weather:${c.slotId}:${w.ruleId}`, title: w.name, cropName: c.cropName, kind: "weather", reason: `Weather favoured it in ${w.seasonsFavoured} of ${w.seasonsChecked} seasons${w.peakMonths.length ? `, mostly ${w.peakMonths.join(", ")}` : ""}` });
    }
  }

  return { crops: outlook, returnIntervals, watch, weatherYears: hasWeather ? years : null };
}
