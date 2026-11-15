type Page = "compare" | "pests" | "conditions" | "report";

/** Kept as a compatibility stub while older pages migrate to the single field tab row. */
export function NextSteps(_props: { fieldId: string; current: Page }) {
  return null;
}
