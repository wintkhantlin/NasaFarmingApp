import { getCropById } from "../data/crops";
import { HOST_ORGANISMS, sharedOrganisms, type Carryover } from "../data/crops/host-organisms";
import type { Rotation, RuleScope } from "../types";

/**
 * Pest and disease rotation check. Uses host-family relationships from the crop library only.
 * NASA data cannot identify a disease or prove a rotation breaks its cycle, so weather is not used.
 */

export interface SequenceCheck {
  fromCropId: string | null;
  toCropId: string | null;
  fromName: string;
  toName: string;
  result: "different-family" | "same-family" | "unknown";
  text: string;
  scope: RuleScope | null;
  ref: string | null;
  /** Named pests and pathogens both crops host that carry over at this gap. Empty when none are listed. */
  shared: SharedHost[];
  /** Days from the first crop's harvest to the next crop's planting. Null when it cannot be worked out. */
  gapDays: number | null;
}

export interface SharedHost {
  organismId: string;
  name: string;
  scientific: string;
  carryover: Carryover;
  /** Soil-borne carry-over is a caution; mobile insects and vectors are information. */
  severity: "caution" | "info";
  advice: string;
  ref: string;
  scope: RuleScope;
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

/**
 * Organisms the two crops share at this gap. Soil-borne ones always carry over to the next crop; mobile insects
 * and vectors only count when the next host is sown within their bridge window (or the gap is unknown).
 */
export function sharedHostsForPair(fromCropId: string, toCropId: string, gapDays: number | null): SharedHost[] {
  return sharedOrganisms(fromCropId, toCropId)
    .filter((o) => o.bridgeDays === undefined || gapDays === null || gapDays <= o.bridgeDays)
    .map((o) => ({
      organismId: o.id,
      name: o.name,
      scientific: o.scientific,
      carryover: o.carryover,
      severity: o.carryover === "soil-borne" || o.carryover === "host-specific-soil" ? "caution" : "info",
      advice: o.advice,
      ref: o.ref,
      scope: o.scope,
    }));
}

export function pestSequence(rotation: Pick<Rotation, "slots"> & Partial<Pick<Rotation, "cycleYears">>): SequenceCheck[] {
  const crops = [...rotation.slots].filter((s) => s.kind !== "fallow").sort((a, b) => a.plantDate.localeCompare(b.plantDate));
  if (crops.length < 2) return [];
  const out: SequenceCheck[] = [];
  for (let i = 0; i < crops.length; i++) {
    const a = crops[i];
    const b = crops[(i + 1) % crops.length]; // the cycle wraps
    const ca = a.cropId ? getCropById(a.cropId) : undefined;
    const cb = b.cropId ? getCropById(b.cropId) : undefined;
    const fromName = ca?.names.common ?? "Unknown crop";
    const toName = cb?.names.common ?? "Unknown crop";
    const wraps = i + 1 >= crops.length;
    const gapDays = wraps && !rotation.cycleYears ? null : Math.round(dayNumber(b.plantDate) + (wraps ? 365.25 * (rotation.cycleYears ?? 0) : 0) - dayNumber(a.harvestDate));
    if (!ca || !cb || !cb.profile) {
      out.push({ fromCropId: a.cropId ?? null, toCropId: b.cropId ?? null, fromName, toName, result: "unknown", text: "No rotation rule in the library for this pair.", scope: null, ref: null, shared: [], gapDays });
      continue;
    }
    const shared = sharedHostsForPair(ca.id, cb.id, gapDays);
    const sharedText = shared.length ? ` Both host ${shared.map((h) => h.name.toLowerCase()).join(", ")}.` : "";
    const rule = cb.profile.rotationRules.find((r) => r.avoidAfterFamilies.includes(ca.family));
    if (rule) {
      out.push({ fromCropId: ca.id, toCropId: cb.id, fromName, toName, result: "same-family", text: `${toName} follows ${fromName}, both ${ca.family}.${sharedText || ` ${rule.reason}`}`, scope: rule.scope, ref: rule.ref, shared, gapDays });
    } else {
      out.push({
        fromCropId: ca.id,
        toCropId: cb.id,
        fromName,
        toName,
        result: "different-family",
        text: shared.length
          ? `${toName} (${cb.family}) follows ${fromName} (${ca.family}). The families differ, but${sharedText.replace(" Both", " both")}`
          : `${toName} (${cb.family}) follows ${fromName} (${ca.family}). Different families share fewer pests and diseases, but this does not prove the cycle is broken.`,
        scope: "analyst-assumption",
        ref: "General host-family rotation guidance; confirm local pest and disease advice.",
        shared,
        gapDays,
      });
    }
  }
  return out;
}

export interface DiseasePressureWarning {
  severity: "info" | "caution" | "warning";
  family: string;
  recurringCropNames: string[];
  seasonalSlotDescription: string;
  yearsOccurred: number[];
  message: string;
  recommendation: string;
}

function getSeasonName(month: number): { key: string; label: string } {
  if (month >= 9 && month <= 12) {
    return { key: "post-monsoon", label: "Post-monsoon dry season (Sep–Dec sowing)" };
  }
  if (month >= 1 && month <= 4) {
    return { key: "summer-pre-monsoon", label: "Pre-monsoon/summer season (Jan–Apr sowing)" };
  }
  return { key: "monsoon", label: "Monsoon season (May–Aug sowing)" };
}

/**
 * Detects recurring host crops in the same seasonal slot across multi-year cycles (Prompt 4, A-02).
 * Detects when the same family (e.g. Fabaceae/legumes) recurs in the same seasonal window across consecutive years.
 * If a multi-year non-host break crop is inserted, the consecutive warning is cleared or mitigated.
 * Does NOT diagnose specific pathogens or compute fictitious half-lives; provides honest agronomic warnings.
 */
export function detectMultiYearDiseasePressure(
  rotation: Pick<Rotation, "slots" | "cycleYears">,
): DiseasePressureWarning[] {
  const warnings: DiseasePressureWarning[] = [];
  const validSlots = rotation.slots
    .filter((s) => s.kind === "crop" && s.cropId)
    .sort((a, b) => a.plantDate.localeCompare(b.plantDate));

  if (validSlots.length < 2) return warnings;

  // Group slots by season
  const bySeason = new Map<string, Array<{ year: number; family: string; cropName: string }>>();

  for (const s of validSlots) {
    const crop = s.cropId ? getCropById(s.cropId) : undefined;
    if (!crop) continue;
    // Lowland flooded monsoon rice is an anaerobic wetland crop that breaks upland pathogens
    if (crop.id === "rice") continue;

    const month = parseInt(s.plantDate.slice(5, 7), 10);
    const year = parseInt(s.plantDate.slice(0, 4), 10);
    const season = getSeasonName(month);

    if (!bySeason.has(season.key)) {
      bySeason.set(season.key, []);
    }
    bySeason.get(season.key)!.push({
      year,
      family: crop.family,
      cropName: crop.names.common,
    });
  }

  for (const [seasonKey, seasonSlots] of bySeason.entries()) {
    if (seasonSlots.length < 2) continue;
    seasonSlots.sort((a, b) => a.year - b.year);

    // Look for consecutive years with the same family
    for (let i = 0; i < seasonSlots.length - 1; i++) {
      const cur = seasonSlots[i];
      const next = seasonSlots[i + 1];

      if (cur.family === next.family && next.year - cur.year <= 1) {
        const seasonInfo = getSeasonName(seasonKey === "post-monsoon" ? 10 : seasonKey === "summer-pre-monsoon" ? 2 : 6);
        warnings.push({
          severity: "caution",
          family: cur.family,
          recurringCropNames: Array.from(new Set([cur.cropName, next.cropName])),
          seasonalSlotDescription: seasonInfo.label,
          yearsOccurred: [cur.year, next.year],
          message: `Repeated cultivation of ${cur.family} (${cur.cropName}) in the ${seasonInfo.label.toLowerCase()} across consecutive years (${cur.year}–${next.year}). Continuous cropping of the same host family in the same seasonal window can elevate soil-borne root rots (Rhizoctonia, Fusarium) and root-knot nematodes over time.`,
          recommendation: "Consider introducing a non-host break crop (e.g., sesame, sunflower, or maize) in alternating years to reduce soil inoculum buildup.",
        });
      }
    }
  }

  return warnings;
}

export interface ReturnIntervalWarning {
  organismId: string;
  name: string;
  cropId: string;
  cropName: string;
  /** Years between crops of the host, from how often it appears in the cycle. */
  returnYears: number;
  minReturnYears: number;
  text: string;
  ref: string;
  scope: RuleScope;
}

/**
 * Host-specific soil pathogens (chickpea and pigeon pea wilts) need years between crops of their host. The cycle
 * repeats, so a host grown k times in an n-year cycle comes back every n / k years.
 */
export function hostReturnIntervals(rotation: Pick<Rotation, "slots" | "cycleYears">): ReturnIntervalWarning[] {
  const counts = new Map<string, number>();
  for (const s of rotation.slots) if (s.kind === "crop" && s.cropId) counts.set(s.cropId, (counts.get(s.cropId) ?? 0) + 1);
  const out: ReturnIntervalWarning[] = [];
  for (const o of HOST_ORGANISMS) {
    if (o.carryover !== "host-specific-soil" || o.minReturnYears === undefined) continue;
    for (const host of o.hosts) {
      const k = counts.get(host);
      if (!k) continue;
      const returnYears = rotation.cycleYears / k;
      if (returnYears >= o.minReturnYears) continue;
      const cropName = getCropById(host)?.names.common ?? host;
      out.push({
        organismId: o.id,
        name: o.name,
        cropId: host,
        cropName,
        returnYears,
        minReturnYears: o.minReturnYears,
        text: `${cropName} comes back every ${returnYears === 1 ? "year" : `${returnYears} years`}. ${o.name} (${o.scientific}) is suggested to need at least ${o.minReturnYears} years between ${cropName.toLowerCase()} crops in a field that has had it. ${o.advice}`,
        ref: o.ref,
        scope: o.scope,
      });
    }
  }
  return out;
}
