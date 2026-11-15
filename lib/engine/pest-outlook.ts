import { getCropById } from "../data/crops";
import { HOST_ORGANISMS, organismsHostedBy, type Carryover, type HostOrganism } from "../data/crops/host-organisms";
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
  /** The host-table organism this rule is about, when there is one (links weather to soil carry-over). */
  organismId?: string;
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
    organismId: rule.organismId,
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

/* ------------------------------------------------------------------------------------------------
 * The message at the top of the Pests page: one main thing to watch and up to three actions.
 * Everything here comes from the outlook and from the rule and host tables. Nothing is invented: the
 * action lines are sentences from those tables' own advice text.
 * ---------------------------------------------------------------------------------------------- */

export interface PestCropRef {
  cropId: string;
  cropName: string;
}

/** One organism that carries between crops in the plan, shown once however many crops it touches. */
export interface SoilGroup {
  organismId: string;
  name: string;
  scientific: string;
  carryover: Carryover;
  severity: "caution" | "info";
  /** Every crop in the plan that is on either side of a carry-over pair for this organism. */
  crops: PestCropRef[];
  gapDays: number | null;
  advice: string;
  ref: string;
  scope: RuleScope;
}

export interface PestHeadline {
  kind: "weather" | "soil" | "return";
  name: string;
  /** The crops it affects, the one with the weather result first. */
  crops: PestCropRef[];
  weather: { crop: PestCropRef; seasonsFavoured: number; seasonsChecked: number; level: WeatherLevel } | null;
  soil: SoilGroup | null;
  returnYears: number | null;
  minReturnYears: number | null;
}

export type PestAction =
  | { kind: "look"; text: string }
  | { kind: "when"; crop: PestCropRef; plantDate: string; harvestDate: string; months: string[] }
  | { kind: "gap"; days: number; fromCrop: PestCropRef; toCrop: PestCropRef }
  | { kind: "help"; text: string };

export interface PestSummary {
  headline: PestHeadline | null;
  /** At most three short lines: what to look for, when, and what helps. */
  actions: PestAction[];
  /** Organisms that carry between crops, each once, cautions first. */
  soil: SoilGroup[];
  /** Plain-words limits on the weather results, each once for the whole page. */
  caveats: string[];
}

/** The first name of a "A / B / C" organism name, which is the one a farmer is most likely to know. */
export function plainPestName(name: string): string {
  return name.split(" / ")[0].trim();
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z])/;
const sentences = (text: string) => text.split(SENTENCE_SPLIT).map((t) => t.trim()).filter(Boolean);
const LOOK_FOR = /^(look|check|watch|scout)\b/i;

function soilGroups(outlook: PestOutlook): SoilGroup[] {
  const n = outlook.crops.length;
  const groups = new Map<string, SoilGroup>();
  outlook.crops.forEach((c, k) => {
    if (!c.carriedIn) return;
    const from = outlook.crops[(k - 1 + n) % n];
    for (const h of c.carriedIn.shared) {
      let g = groups.get(h.organismId);
      if (!g) {
        g = { organismId: h.organismId, name: h.name, scientific: h.scientific, carryover: h.carryover, severity: h.severity, crops: [], gapDays: c.carriedIn.gapDays, advice: h.advice, ref: h.ref, scope: h.scope };
        groups.set(h.organismId, g);
      }
      for (const ref of [from, c]) if (!g.crops.some((x) => x.cropId === ref.cropId)) g.crops.push({ cropId: ref.cropId, cropName: ref.cropName });
      if (c.carriedIn.gapDays !== null && (g.gapDays === null || c.carriedIn.gapDays < g.gapDays)) g.gapDays = c.carriedIn.gapDays;
    }
  });
  return [...groups.values()].sort((a, b) => Number(b.severity === "caution") - Number(a.severity === "caution") || b.crops.length - a.crops.length);
}

/** Pulls the single most important thing to watch out of the outlook and turns it into short actions. */
export function buildPestSummary(outlook: PestOutlook): PestSummary {
  const soil = soilGroups(outlook);
  const caveats: string[] = [];
  for (const c of outlook.crops) for (const w of c.weather) for (const t of w.caveats) if (!caveats.includes(t)) caveats.push(t);

  interface Candidate {
    score: number;
    tie: number;
    headline: PestHeadline;
    rule: WeatherRiskResult | null;
    slot: CropPestOutlook | null;
  }
  const candidates: Candidate[] = [];
  const ref = (c: CropPestOutlook): PestCropRef => ({ cropId: c.cropId, cropName: c.cropName });
  const claimed = new Set<string>();

  for (const g of soil.filter((s) => s.severity === "caution")) {
    let best: { crop: CropPestOutlook; w: WeatherRiskResult } | null = null;
    for (const c of outlook.crops) {
      for (const w of c.weather) {
        if (w.organismId !== g.organismId) continue;
        if (!best || LEVEL_RANK[w.level] < LEVEL_RANK[best.w.level] || (w.level === best.w.level && w.seasonsFavoured > best.w.seasonsFavoured)) best = { crop: c, w };
      }
    }
    const hit = best && (best.w.level === "often" || best.w.level === "sometimes") ? best : null;
    if (hit) claimed.add(hit.w.ruleId);
    const crops = hit ? [ref(hit.crop), ...g.crops.filter((x) => x.cropId !== hit.crop.cropId)] : g.crops;
    candidates.push({
      score: hit ? (hit.w.level === "often" ? 0 : 1) : 2,
      tie: hit ? hit.w.seasonsFavoured : 0,
      headline: {
        kind: hit ? "weather" : "soil",
        name: plainPestName(hit ? hit.w.name : g.name),
        crops,
        weather: hit ? { crop: ref(hit.crop), seasonsFavoured: hit.w.seasonsFavoured, seasonsChecked: hit.w.seasonsChecked, level: hit.w.level } : null,
        soil: g,
        returnYears: null,
        minReturnYears: null,
      },
      rule: hit?.w ?? null,
      slot: hit?.crop ?? null,
    });
  }
  for (const c of outlook.crops) {
    for (const w of c.weather) {
      if ((w.level !== "often" && w.level !== "sometimes") || claimed.has(w.ruleId)) continue;
      candidates.push({
        score: w.level === "often" ? 0 : 4,
        tie: w.seasonsFavoured,
        headline: { kind: "weather", name: plainPestName(w.name), crops: [ref(c)], weather: { crop: ref(c), seasonsFavoured: w.seasonsFavoured, seasonsChecked: w.seasonsChecked, level: w.level }, soil: null, returnYears: null, minReturnYears: null },
        rule: w,
        slot: c,
      });
    }
  }
  for (const r of outlook.returnIntervals) {
    candidates.push({
      score: 3,
      tie: 0,
      headline: { kind: "return", name: plainPestName(r.name), crops: [{ cropId: r.cropId, cropName: r.cropName }], weather: null, soil: null, returnYears: r.returnYears, minReturnYears: r.minReturnYears },
      rule: null,
      slot: null,
    });
  }
  candidates.sort((a, b) => a.score - b.score || b.tie - a.tie);
  const top = candidates[0];
  if (!top) return { headline: null, actions: [], soil, caveats };

  const actions: PestAction[] = [];
  const organism = HOST_ORGANISMS.find((o) => o.id === (top.headline.soil?.organismId ?? top.rule?.organismId));
  if (top.rule && top.slot) {
    const parts = sentences(top.rule.advice);
    const look = parts.filter((p) => LOOK_FOR.test(p));
    const help = parts.filter((p) => !LOOK_FOR.test(p));
    if (look.length) actions.push({ kind: "look", text: look.join(" ") });
    actions.push({ kind: "when", crop: ref(top.slot), plantDate: top.slot.plantDate, harvestDate: top.slot.harvestDate, months: top.rule.peakMonths });
    const helpText = help.length ? help.join(" ") : organism ? sentences(organism.advice).slice(-1).join(" ") : "";
    if (helpText) actions.push({ kind: "help", text: helpText });
  } else if (top.headline.soil) {
    const g = top.headline.soil;
    const parts = sentences(g.advice);
    if (parts[0]) actions.push({ kind: "look", text: parts[0] });
    if (g.gapDays !== null && g.crops.length >= 2) actions.push({ kind: "gap", days: g.gapDays, fromCrop: g.crops[0], toCrop: g.crops[1] });
    if (parts.length > 1) actions.push({ kind: "help", text: parts.slice(1).join(" ") });
  } else {
    const r = outlook.returnIntervals.find((x) => x.cropId === top.headline.crops[0].cropId && plainPestName(x.name) === top.headline.name);
    if (r) actions.push({ kind: "help", text: r.text });
  }
  return { headline: top.headline, actions: actions.slice(0, 3), soil, caveats };
}
