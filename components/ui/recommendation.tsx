import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Hazard } from "./icons";
import { Panel } from "./panel";
import { RiskChip } from "./risk-chip";
import { SourceLine, type SourceLineProps } from "./source-line";

export interface RecommendationProps {
  /** Small context above the answer, e.g. "North plot, maize". Sentence case. */
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
export function Recommendation({
  context,
  headline,
  reason,
  risks,
  source,
  children,
  as: Heading = "h2",
  className,
}: RecommendationProps) {
  return (
    <Panel as="section" radius="lg" className={cn("flex flex-col gap-3 p-5 sm:p-6", className)}>
      {context ? <p className="m-0 text-overline text-ink-muted">{context}</p> : null}
      <Heading className="text-balance text-title text-ink sm:text-display">{headline}</Heading>
      {reason ? <p className="m-0 max-w-measure text-body text-ink-muted">{reason}</p> : null}
      {risks?.length ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {risks.map((r) => (
            <RiskChip key={r.label} hazard={r.hazard}>
              {r.label}
            </RiskChip>
          ))}
        </div>
      ) : null}
      {children ? <div className="flex flex-wrap gap-2 pt-2">{children}</div> : null}
      {source ? <SourceLine {...source} className="mt-1 border-t border-line pt-3" /> : null}
    </Panel>
  );
}
