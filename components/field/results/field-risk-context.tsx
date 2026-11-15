"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { RiskEvidenceMap } from "@/lib/conditions/condition-evidence";
import { AVAILABILITY, RISK_META, RISK_ORDER } from "@/lib/conditions/explorer-model";

/**
 * What this field's own history says about water, flood, erosion and heat, shown next to the options.
 * Context only: it never feeds the ranking, and a risk with no data says so instead of reading as low.
 */
export function FieldRiskContext({ fieldId, evidenceMap, className }: { fieldId: string; evidenceMap: RiskEvidenceMap; className?: string }) {
  return (
    <section aria-labelledby="field-risks-heading" className={cn("flex flex-col gap-2", className)}>
      <h2 id="field-risks-heading" className="m-0 text-headline text-ink">
        Field history to keep in mind
      </h2>
      <p className="m-0 max-w-measure text-body-sm text-ink-muted">
        Past evidence for this field. It sits next to your options and does not change their ranking.
      </p>
      <ul className="m-0 list-none divide-y divide-line border-y border-line p-0">
        {RISK_ORDER.map((id) => {
          const ev = evidenceMap[id];
          const a = AVAILABILITY[ev.status];
          return (
            <li key={id}>
              <Link href={`/fields/${fieldId}/conditions?risk=${id}`} className="flex min-h-tap items-start gap-3 py-3 text-ink no-underline transition-colors hover:bg-surface-sunken/50">
                <Icon name={RISK_META[id].icon} size={20} className="mt-0.5 shrink-0 text-field" />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-sm font-medium">{RISK_META[id].label}</span>
                  <span className="block text-body-sm text-ink">{a.tone === "missing" ? "No data for this field yet. Not a sign that it is safe." : ev.summaryTitle}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 pt-0.5 text-body-sm text-ink-muted">
                  See on map
                  <Icon name="next" size={14} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
