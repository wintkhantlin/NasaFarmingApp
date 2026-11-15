/** Plain-language wording for the Plan answers copied into a field's local notes. */

export const PLAN_CONTEXT_MARKER = "[Plan context]:";

const WATER: Record<string, string> = { "rain-only": "Rain only", occasional: "Some irrigation", reliable: "Reliable irrigation", unknown: "not known" };
const GOAL: Record<string, string> = { water: "Save water", soil: "Improve soil", income: "Earn more", forage: "Feed for animals", "lower-inputs": "Use fewer inputs", risk: "Lower risk", unknown: "not chosen" };
const RESIDUE: Record<string, string> = { kept: "left on the soil", incorporated: "worked into the soil", mulched: "used as mulch", removed: "removed", burned: "burned", unknown: "not known" };
const FEASIBILITY_KEY: Record<string, string> = { budget: "budget", machinery: "machinery", labor: "labour", seed: "seed", buyers: "buyers" };
const FEASIBILITY_VALUE: Record<string, string> = { available: "available", unavailable: "not available", unknown: "not known" };

export interface PlanContextInput {
  place?: string | null;
  water: string;
  goal: string;
  residue: string;
  feasibility?: Record<string, string>;
}

function feasibilityText(values?: Record<string, string>): string {
  const parts = Object.entries(values ?? {}).filter(([, v]) => v !== "unknown").map(([k, v]) => `${FEASIBILITY_KEY[k] ?? k} ${FEASIBILITY_VALUE[v] ?? v}`);
  return parts.length ? ` · Local check: ${parts.join(", ")}` : "";
}

/** Readable one-line summary, e.g. "Region: Magway · Water: Rain only · Top goal: Save water · Residue: not known". */
export function planContextText(c: PlanContextInput): string {
  const region = c.place ? `Region: ${c.place} · ` : "";
  return `${region}Water: ${WATER[c.water] ?? c.water} · Top goal: ${GOAL[c.goal] ?? c.goal} · Residue: ${RESIDUE[c.residue] ?? c.residue}${feasibilityText(c.feasibility)}`;
}

/** Stored line for local notes: stable marker followed by plain text. */
export function planContextNote(c: PlanContextInput): string {
  return `${PLAN_CONTEXT_MARKER} ${planContextText(c)}`;
}

/** Turns a stored note line into a farmer-readable { topic, text }; understands the older "revision N; area X; ..." format. */
export function prettifyNoteLine(line: string): { topic: string; text: string } {
  const match = line.match(/^\[(.*?)\]:\s*(.*)$/);
  if (!match) return { topic: "Field note", text: line };
  const [, topic, body] = match;
  if (topic !== "Plan context") return { topic, text: body };
  const legacy = body.match(/^revision\s+\d+;\s*area\s+(.*?);\s*water\s+(\S+);\s*goal\s+(\S+);\s*residue\s+(\S+?)\.(?:\s*Local feasibility:\s*(.*?)\.)?(?:\s*Full observations.*)?$/);
  if (!legacy) return { topic: "Your plan answers", text: body.replace(/^revision\s+\d+;\s*/, "").replace(/\s*Full observations and timing remain.*$/, "") };
  const [, area, water, goal, residue, feas] = legacy;
  const feasibility = feas ? Object.fromEntries(feas.split(",").map((p) => p.trim().split(/\s+/)).filter((p) => p.length === 2)) : undefined;
  return { topic: "Your plan answers", text: planContextText({ place: area === "undefined" ? null : area, water, goal, residue, feasibility }) };
}
