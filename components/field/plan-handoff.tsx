"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { Button } from "@/components/ui/button";
import { adaptPlanToFieldSlot } from "@/lib/plan/refinement-adapter";
import type { PlanDraft } from "@/lib/store/plan-draft";
import { useFieldsStore } from "@/lib/store/fields-store";

export function PlanHandoff({ draft }: { draft: PlanDraft }) {
  const fields = useFieldsStore(s => s.fields);
  const load = useFieldsStore(s => s.load);
  const [fieldId, setFieldId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const inputKey = `${fieldId}:${draft.revision}:${JSON.stringify(draft.refinements)}`;
  useEffect(() => { void load(); }, [load]);
  const adapted = adaptPlanToFieldSlot(draft);
  const sequence = draft.refinements.sequence;
  const extraCrops = Boolean(sequence.previousCropId || sequence.nextCropId || sequence.winterCropId);
  const eligible = fields.filter(f => f.locationConfirmed && !f.archivedAt && f.region === draft.place?.region);
  async function continueToField() {
    if (adapted.state !== "ready" || extraCrops || !eligible.some(f => f.id === fieldId)) return;
    setBusy(true);
    try {
      const store = useFieldsStore.getState();
      const field = eligible.find(f => f.id === fieldId)!;
      const water = draft.refinements.water.value;
      const goal = draft.refinements.goal.value;
      const cycleYears = Math.ceil((Date.parse(adapted.slot.harvestDate) - Date.parse(adapted.slot.plantDate)) / (365.25 * 86400000));
      if (cycleYears > 4) { setMessage("needs-input: this sequence exceeds the supported four-year cycle."); return; }
      if (water === "unknown") { setMessage("needs-input: confirm water access before transferring this sequence."); return; }
      await store.update(fieldId, {
        irrigation: water === "rain-only" ? "none" : water === "occasional" ? "supplemental" : "full",
        constraints: { ...field.constraints, irrigation: { ...field.constraints?.irrigation, access: water === "rain-only" ? "none" : water === "occasional" ? "supplemental" : "full" } },
        ...(goal !== "unknown" && goal !== "risk" ? { priorities: { order: [goal], weights: { [goal]: 1 } } } : {}),
        localNotes: `${field.localNotes ?? ""}\n[Plan context]: revision ${draft.revision}; area ${draft.place?.name}; water ${water}; goal ${goal}; residue ${draft.refinements.residue.value}. Local feasibility: ${Object.entries(draft.refinements.feasibility.values).map(([key, value]) => `${key} ${value}`).join(", ")}. Full observations and timing remain in the backed-up Plan draft.`,
      });
      await store.saveRotation({ id: `plan-${fieldId}`, fieldId, label: "Current sequence from Plan", source: "farmer", cycleYears: Math.max(1, cycleYears) as 1 | 2 | 3 | 4,
        slots: [{ ...adapted.slot, id: "plan-main", kind: "crop", irrigated: water !== "rain-only" }] });
      setMessage("Saved. Open the field comparison to check available historical evidence.");
      setSavedKey(inputKey);
    } catch { setMessage("Could not save the handoff. Your Plan draft remains available; check browser storage and retry."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="handoff-title" className="flex flex-col gap-3 rounded-md border border-line p-4">
    <h3 id="handoff-title" className="text-headline">Compare for a confirmed field</h3>
    <p className="text-body-sm">Select the field where this sequence was grown. Your regional examples and full Plan draft stay available. Saving replaces that field’s Plan sequence and applies your selected goal as its sole priority.</p>
    <TextField
      select
      id="handoff-field"
      label="Confirmed field in this region"
      value={fieldId}
      onChange={(e) => setFieldId(e.target.value)}
      size="small"
      fullWidth
    >
      <MenuItem value="">Choose a field</MenuItem>
      {eligible.map((f) => (
        <MenuItem key={f.id} value={f.id}>
          {f.name}
        </MenuItem>
      ))}
    </TextField>
    <Link href="/fields/new" className="text-field underline">Add or confirm a field; your Plan draft stays saved</Link>
    {adapted.state !== "ready" ? <p role="status">{adapted.state}: {adapted.reasons.join(" ")}</p> : null}
    {extraCrops ? <p role="status">needs-input: previous, following or winter crops need their own dates. Review the full sequence in the field editor; no dates will be inferred.</p> : null}
    {fieldId && extraCrops ? <Link href={`/fields/${fieldId}/rotation`} className="text-field underline">Review complete field sequence</Link> : null}
    <Button disabled={busy || adapted.state !== "ready" || extraCrops || !fieldId} onClick={() => void continueToField()}>{busy ? "Saving…" : "Save sequence and compare this field"}</Button>
    {message ? <p role="status">{message}</p> : null}
    {message.startsWith("Saved.") && savedKey === inputKey ? <Link href={`/fields/${fieldId}/compare`} className="text-field underline">Open field-informed comparison</Link> : null}
    {savedKey && savedKey !== inputKey ? <p role="status">Inputs changed. Save again before comparing these revisions.</p> : null}
  </section>;
}
