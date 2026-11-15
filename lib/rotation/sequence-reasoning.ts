/** Conditional, source-backed observations about each crop-to-crop transition. No scores or nutrient/water credits. */
type CropFact = { id: string; name: string; family: string; legume: boolean };
type Residue = "retained" | "removed" | "burned" | "grazed" | "unknown";
export type SequenceTransition = {
  previous_crop: string | null;
  next_crop: string;
  benefits: string[];
  risks: string[];
  unknowns: string[];
  evidence: { source: string; topic: string }[];
};

const FAMILY = "https://www.nrcs.usda.gov/sites/default/files/2022-09/Conservation_Crop_Rotation_328_CPS.pdf";
const NITROGEN = "https://www.fao.org/4/Y5146E/y5146e0a.htm";
const RESIDUE = "https://www.fao.org/fileadmin/user_upload/emergencies/docs/FAO_REOSA_Technical_Brief_1__July_2010_.pdf";
const WATER = "https://www.fao.org/4/Y5146E/y5146e0a.htm";
const PEST = "https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2024.1451986/full";

export function explainSequence(
  history: string[], proposed: string[], crops: Map<string, CropFact>, previousResidue: Residue,
  fallowManagement: string,
): SequenceTransition[] {
  const result: SequenceTransition[] = [];
  let previousId = history.at(-1) ?? null;
  for (const [index, nextId] of proposed.entries()) {
    const previous = previousId ? crops.get(previousId) : undefined;
    const next = crops.get(nextId);
    const benefits: string[] = [];
    const risks: string[] = [];
    const unknowns: string[] = [];
    const evidence: SequenceTransition["evidence"] = [];
    const cite = (source: string, topic: string) => {
      if (!evidence.some((item) => item.source === source && item.topic === topic)) evidence.push({ source, topic });
    };

    if (!previous) unknowns.push("The previous crop is not recorded, so this crop-family comparison is incomplete.");
    else if (next) {
      if (previous.family !== next.family) benefits.push(`${next.name} follows a different plant family from ${previous.name}. This adds botanical diversity; it does not prove pest control.`);
      else risks.push(`${next.name} follows the same plant family as ${previous.name}. This sequence has no family change at this step.`);
      cite(FAMILY, "Botanical diversity in crop rotations");
    }

    if (next?.legume) {
      benefits.push(`${next.name} is a legume and may fix atmospheric nitrogen if nodulation is effective.`);
      unknowns.push("The nitrogen fixed, nitrogen removed in grain, and net nitrogen left for another crop are unknown.");
      cite(NITROGEN, "Legume nitrogen balance depends on fixation, biomass and harvest removal");
    } else if (previous?.legume && next) {
      unknowns.push(`Any nitrogen carryover from ${previous.name} to ${next.name} is unknown without fixation, harvest and residue information.`);
      cite(NITROGEN, "Legume nitrogen balance depends on fixation, biomass and harvest removal");
    }

    const residue = index === 0 ? previousResidue : "unknown";
    if (previous) {
      if (residue === "retained") benefits.push(`Residue from ${previous.name} was recorded as retained. Surface residue may help cover soil and limit evaporation if enough remains.`);
      else if (residue === "removed" || residue === "burned") risks.push(`Residue from ${previous.name} was recorded as ${residue}, so it cannot be assumed to protect the soil surface.`);
      else unknowns.push(`How much residue from ${previous.name} remains on the soil is unknown.`);
      unknowns.push("Actual surface cover and its effect on erosion or evaporation have not been measured.");
      cite(RESIDUE, "Retained residues and actual soil cover");
    }
    if (nextId === "fallow") {
      if (fallowManagement === "vegetated" || fallowManagement === "mulched") benefits.push("Managed fallow may keep some soil cover, depending on the plants or mulch actually present.");
      else if (fallowManagement === "bare") risks.push("Bare fallow leaves the surface without planned living or mulch cover.");
      else unknowns.push("Fallow vegetation or mulch management is unknown.");
      cite(RESIDUE, "Fallow cover depends on management");
    } else {
      unknowns.push(`The amount and timing of living cover from ${next!.name} are unknown until establishment and management are observed.`);
      cite(RESIDUE, "Living crop cover depends on establishment and management");
    }

    if (previous && next && ["green_gram", "black_gram"].includes(previousId!) && ["green_gram", "black_gram"].includes(nextId)) {
      risks.push("Green gram and black gram are both documented hosts of yellow mosaic viruses in Indian field research. This does not establish infection or carryover on this farm; check local disease and whitefly reports.");
      cite(PEST, "Documented yellow mosaic virus hosts; field evidence from India");
    } else if (previous && next) {
      unknowns.push("No specific shared pest-host relationship is established for this crop pair in the current evidence set; local pest and disease pressure remains unknown.");
    }

    unknowns.push("Stored soil water after the previous crop is unknown. Rainfall totals and irrigation access cannot establish water carryover to the next crop.");
    cite(WATER, "Previous-crop water use and root-zone water carryover");
    result.push({ previous_crop: previousId, next_crop: nextId, benefits, risks, unknowns, evidence });
    previousId = nextId === "fallow" ? null : nextId;
  }
  return result;
}
