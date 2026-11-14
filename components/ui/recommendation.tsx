import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Hazard } from "./icons";
import { RiskChip } from "./risk-chip";
import { SourceLine, type SourceLineProps } from "./source-line";

export interface RecommendationProps {
  /** Small context above the answer, e.g. "North plot, maize". */
  context?: string;
  /** The answer, verb first. */
  headline: string;
  /** One or two sentences naming the evidence. */
  reason?: string;
  risks?: Array<{ hazard: Hazard; label: string }>;
  source?: SourceLineProps;
  /** Actions. At most one primary button. */
  children?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}

/** The answer block that opens a screen: one decision, its evidence, one way to act. */
export function Recommendation({ context, headline, reason, risks, source, children, as: Heading = "h2", className }: RecommendationProps) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4 pt-6 sm:p-6", className)}>
      {context ? <p className="text-overline text-ink-muted">{context}</p> : null}
      <Heading className="text-balance text-display text-ink">{headline}</Heading>
      {reason ? <p className="max-w-measure text-body text-ink-muted">{reason}</p> : null}
      {risks?.length ? (
        <div className="flex flex-wrap gap-2">
          {risks.map((r) => (
            <RiskChip key={r.label} hazard={r.hazard}>
              {r.label}
            </RiskChip>
          ))}
        </div>
      ) : null}
      {children ? <div className="flex flex-wrap gap-2 pt-1">{children}</div> : null}
      {source ? <SourceLine {...source} className="border-t border-line pt-3" /> : null}
    </section>
  );
}
