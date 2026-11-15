import Link from "next/link";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { CheckGlyph, ClockGlyph } from "./icons";

export type StepId = "location" | "rotation" | "profile" | "conditions" | "compare";
export type StepState = "done" | "needs-input" | "loading" | "not-started";

const ORDER: StepId[] = ["location", "rotation", "profile", "conditions", "compare"];

const STATE_WORDS: Record<StepState, string> = {
  done: copy.stepState.done,
  "needs-input": copy.stepState.needsInput,
  loading: copy.stepState.loading,
  "not-started": copy.stepState.notStarted,
};

const HREF: Record<StepId, (id: string) => string> = {
  location: (id) => `/fields/${id}`,
  rotation: (id) => `/fields/${id}/rotation`,
  profile: (id) => `/fields/${id}/profile`,
  conditions: (id) => `/fields/${id}/conditions`,
  compare: (id) => `/plan?fieldId=${encodeURIComponent(id)}`,
};

export interface StepperProps {
  fieldId: string;
  current: StepId;
  states: Record<StepId, StepState>;
  /** Steps whose page exists. Others show as non-clickable. */
  available?: Record<StepId, boolean>;
  className?: string;
}

/**
 * The five steps of a field and where each one stands. One list that reads as
 * a progress strip on phones and as a left rail from the lg breakpoint.
 */
export function Stepper({ fieldId, current, states, available, className }: StepperProps) {
  return (
    <nav aria-label="Steps for this field" className={className}>
      <ol className="grid grid-cols-5 gap-1.5 lg:grid-cols-1 lg:gap-1">
        {ORDER.map((id, i) => {
          const isCurrent = id === current;
          const isAvailable = available ? available[id] : true;
          const state = states[id];
          const isDone = state === "done";

          const content = (
            <>
              {/* Phone: a bar that fills when the step is done */}
              <span
                aria-hidden="true"
                className={cn("h-1 rounded-pill lg:hidden", isDone ? "bg-field" : isCurrent ? "bg-line-strong" : "bg-line")}
              />
              {/* Rail: a numbered marker */}
              <span
                aria-hidden="true"
                className={cn(
                  "tabular hidden size-7 shrink-0 place-items-center rounded-pill border font-mono text-source lg:grid",
                  isDone ? "border-field bg-field text-on-field" : "border-line-strong bg-surface text-ink-muted",
                )}
              >
                {isDone ? <CheckGlyph width={14} height={14} /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("text-label text-balance", isCurrent ? "text-ink" : "text-ink")}>{copy.steps[id]}</span>
                <span className="flex items-center gap-1 text-body-sm text-ink-muted">
                  {isDone ? <CheckGlyph width={12} height={12} className="shrink-0 text-healthy lg:hidden" /> : null}
                  {state === "loading" ? <ClockGlyph width={12} height={12} className="shrink-0" /> : null}
                  <span className="text-balance">{STATE_WORDS[state]}</span>
                </span>
              </span>
            </>
          );

          const boxClass = cn(
            "flex min-h-tap flex-col gap-2 rounded-md p-1 no-underline transition-colors",
            "lg:flex-row lg:items-center lg:gap-3 lg:border lg:p-2.5",
            isCurrent
              ? "lg:border-field lg:bg-field-soft"
              : "lg:border-transparent lg:hover:bg-surface-sunken",
          );

          return (
            <li key={id} className="min-w-0">
              {isAvailable ? (
                <Link href={HREF[id](fieldId)} aria-current={isCurrent ? "step" : undefined} className={boxClass}>
                  {content}
                </Link>
              ) : (
                <div className={cn(boxClass, "cursor-not-allowed opacity-60")}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
