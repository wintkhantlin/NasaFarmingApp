import { en } from "@/app/plan/messages";
import type { Scenario } from "@/lib/rotation/presentation";

export function SequenceReasoning({ steps, names }: { steps: Scenario["sequence_reasoning"]; names: Record<string, string> }) {
  return <div className="space-y-4 text-body-sm text-ink-muted">
    {steps.map((step, index) => <section key={`${index}-${step.next_crop}`} className="space-y-2">
      <h4 className="font-semibold text-ink">{step.previous_crop ? names[step.previous_crop] ?? step.previous_crop : en.previousUnknown} → {names[step.next_crop] ?? step.next_crop}</h4>
      {([
        [en.possibleBenefits, step.benefits], [en.possibleRisks, step.risks], [en.unknowns, step.unknowns],
      ] as const).map(([label, items]) => items.length > 0 && <div key={label}><strong>{label}</strong><ul className="mt-1 list-disc space-y-1 pl-5">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}
    </section>)}
  </div>;
}

export function SequenceEvidence({ steps }: { steps: Scenario["sequence_reasoning"] }) {
  const sources = [...new Map(steps.flatMap((step) => step.evidence).map((item) => [`${item.topic}|${item.source}`, item])).values()];
  return <div><strong className="text-ink">{en.sequenceEvidence}</strong><ul className="mt-1 list-disc space-y-1 pl-5">{sources.map((item) => <li key={`${item.topic}|${item.source}`}><a href={item.source} target="_blank" rel="noreferrer" className="text-field underline underline-offset-4">{item.topic}</a></li>)}</ul></div>;
}
