import type { RuleScope } from "../../types";

/**
 * Pests and pathogens that more than one crop in the library can host, or that need a long return interval
 * on one crop. This replaces "same botanical family = shared pests" with named organisms: two legumes can
 * share almost nothing, while rice and green gram share Rhizoctonia solani.
 *
 * Host lists name documented hosts among the library crops only. A crop missing from a list is NOT shown to
 * be a non-host; it just has no entry here. Every entry is an analyst reading of the general literature,
 * not checked against Myanmar plant-protection records. Strain and race differences (e.g. Rhizoctonia
 * anastomosis groups, Fusarium formae speciales) are why host-specific wilts list one crop each.
 */

export type Carryover =
  /** Survives in soil or residue for seasons or years; crop sequence matters most. */
  | "soil-borne"
  /** Soil-borne and specific to one crop; the return interval of that crop matters. */
  | "host-specific-soil"
  /** Spread by an insect vector (e.g. whitefly); a host crop sown soon after another acts as a green bridge. */
  | "vector-borne"
  /** A mobile insect; rotation in one field does little, but back-to-back hosts keep a food source going. */
  | "mobile-insect";

export interface HostOrganism {
  id: string;
  name: string;
  scientific: string;
  carryover: Carryover;
  /** Library crop ids documented as hosts. */
  hosts: string[];
  /** Library crops reported to suppress it (poor host, or flooding). Used for advice only. */
  suppressedBy?: string[];
  /** For host-specific-soil: suggested minimum years between crops of the host in an infested field. */
  minReturnYears?: number;
  /** For vector-borne and mobile insects: a following host sown within this many days keeps the bridge. */
  bridgeDays?: number;
  advice: string;
  ref: string;
  scope: RuleScope;
}

const SCOPE: RuleScope = "analyst-assumption";

export const HOST_ORGANISMS: HostOrganism[] = [
  {
    id: "macrophomina",
    name: "Charcoal rot / dry root rot",
    scientific: "Macrophomina phaseolina",
    carryover: "soil-borne",
    hosts: ["sesame", "green-gram", "black-gram", "chickpea", "soybean", "groundnut", "pigeon-pea", "maize"],
    suppressedBy: ["rice"],
    advice: "Survives in soil for years and is worst in hot, dry spells. Putting two hosts back to back keeps it building up. A flooded rice season lowers it.",
    ref: "Kaur et al. (2012), Crit. Rev. Microbiol. 38:136–151, host range review; CABI Compendium datasheet",
    scope: SCOPE,
  },
  {
    id: "rhizoctonia",
    name: "Sheath blight / web blight / root rot",
    scientific: "Rhizoctonia solani",
    carryover: "soil-borne",
    hosts: ["rice", "green-gram", "black-gram", "soybean", "groundnut", "maize"],
    advice: "Sclerotia from rice sheath blight stay in the soil and straw and can cause web blight on pulses sown straight after rice, especially in wet soil.",
    ref: "CABI Compendium datasheet: Rhizoctonia solani (AG1-IA on rice, legumes and maize)",
    scope: SCOPE,
  },
  {
    id: "sclerotium",
    name: "Stem rot / collar rot",
    scientific: "Athelia rolfsii (Sclerotium rolfsii)",
    carryover: "soil-borne",
    hosts: ["groundnut", "soybean", "chickpea"],
    suppressedBy: ["rice"],
    advice: "Sclerotia survive near the soil surface. Burying residue and a flooded season reduce it.",
    ref: "CABI Compendium datasheet: Athelia rolfsii",
    scope: SCOPE,
  },
  {
    id: "root-knot",
    name: "Root-knot nematodes",
    scientific: "Meloidogyne incognita, M. javanica, M. arenaria",
    carryover: "soil-borne",
    hosts: ["black-gram", "green-gram", "chickpea", "pigeon-pea", "soybean", "groundnut", "sesame", "lablab", "maize"],
    suppressedBy: ["sunn-hemp", "rice"],
    advice: "Most pulses and sesame multiply them. Sunn hemp is a poor host that lowers numbers, and flooding lowers these species (rice has its own root-knot species in non-flooded fields).",
    ref: "Wang, Sipes & Schmitt (2002), Nematropica 32:35–57, Crotalaria as a cover crop for nematode management",
    scope: SCOPE,
  },
  {
    id: "fusarium-chickpea",
    name: "Chickpea Fusarium wilt",
    scientific: "Fusarium oxysporum f. sp. ciceris",
    carryover: "host-specific-soil",
    hosts: ["chickpea"],
    minReturnYears: 3,
    advice: "Specific to chickpea and survives in soil for several years. In a field that has had wilt, leave years between chickpea crops and use a wilt-resistant variety.",
    ref: "Jiménez-Díaz et al. (2015), Crop Protection 73:16–27, Fusarium wilt of chickpea review",
    scope: SCOPE,
  },
  {
    id: "fusarium-pigeonpea",
    name: "Pigeon pea Fusarium wilt",
    scientific: "Fusarium udum",
    carryover: "host-specific-soil",
    hosts: ["pigeon-pea"],
    minReturnYears: 3,
    advice: "Specific to pigeon pea and long-lived in soil. Leave years between pigeon pea crops in a field with wilt; resistant varieties help most.",
    ref: "CABI Compendium datasheet: Fusarium udum",
    scope: SCOPE,
  },
  {
    id: "yellow-mosaic",
    name: "Yellow mosaic viruses",
    scientific: "Mungbean / urdbean yellow mosaic begomoviruses, carried by whitefly (Bemisia tabaci)",
    carryover: "vector-borne",
    hosts: ["green-gram", "black-gram", "soybean", "lablab"],
    bridgeDays: 30,
    advice: "Not carried in soil. A host sown soon after another gives whitefly and virus a bridge. A break without hosts and removing volunteer plants help.",
    ref: "CABI Compendium datasheets: Mungbean yellow mosaic virus, Bemisia tabaci",
    scope: SCOPE,
  },
  {
    id: "helicoverpa",
    name: "Pod borer (gram pod borer)",
    scientific: "Helicoverpa armigera",
    carryover: "mobile-insect",
    hosts: ["chickpea", "pigeon-pea", "maize", "soybean", "groundnut"],
    bridgeDays: 30,
    advice: "Moths fly between fields, so rotation alone does not control it. Back-to-back hosts keep it fed; watch flowering and pod stages.",
    ref: "CABI Compendium datasheet: Helicoverpa armigera",
    scope: SCOPE,
  },
  {
    id: "maruca",
    name: "Legume pod borer",
    scientific: "Maruca vitrata",
    carryover: "mobile-insect",
    hosts: ["pigeon-pea", "green-gram", "black-gram", "lablab", "soybean"],
    bridgeDays: 30,
    advice: "Mobile; back-to-back hosts keep it going. Check flowers and young pods.",
    ref: "CABI Compendium datasheet: Maruca vitrata",
    scope: SCOPE,
  },
  {
    id: "fall-armyworm",
    name: "Fall armyworm",
    scientific: "Spodoptera frugiperda",
    carryover: "mobile-insect",
    hosts: ["maize", "rice"],
    bridgeDays: 30,
    advice: "Strongly mobile and feeds mostly on maize; rice can host it. Rotation alone does not control it.",
    ref: "CABI Compendium datasheet: Spodoptera frugiperda",
    scope: SCOPE,
  },
];

export function organismsHostedBy(cropId: string): HostOrganism[] {
  return HOST_ORGANISMS.filter((o) => o.hosts.includes(cropId));
}

/** Organisms both crops host. */
export function sharedOrganisms(fromCropId: string, toCropId: string): HostOrganism[] {
  return HOST_ORGANISMS.filter((o) => o.hosts.includes(fromCropId) && o.hosts.includes(toCropId));
}
