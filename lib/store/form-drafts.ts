/**
 * Unsaved form answers, kept in memory while the app stays open.
 *
 * Going back to a form (for example from the next step to the profile) remounts it. Without this, anything
 * typed but not yet saved would be lost. Drafts are not written to storage: a full reload starts clean, and
 * a saved form clears its draft. Nothing here is a source of truth for the farmer's data.
 */
const drafts = new Map<string, unknown>();

export function readDraft<T>(key: string): T | undefined {
  return drafts.get(key) as T | undefined;
}

export function writeDraft(key: string, value: unknown): void {
  drafts.set(key, value);
}

export function clearDraft(key: string): void {
  drafts.delete(key);
}

/** Test helper: forget every draft so one test cannot leak typed values into the next. */
export function resetFormDrafts(): void {
  drafts.clear();
}
