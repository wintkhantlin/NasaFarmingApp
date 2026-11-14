import Link from "next/link";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { CheckGlyph } from "./icons";

export type StepId = "location" | "rotation" | "conditions" | "compare";
export type StepState = "done" | "needs-input" | "loading" | "not-started";

const ORDER: StepId[] = ["location", "rotation", "conditions", "compare"];

const STATE_WORDS: Record<StepState, string> = {
  done: copy.stepState.done,
  "needs-input": copy.stepState.needsInput,
  loading: copy.stepState.loading,
  "not-started": copy.stepState.notStarted,
};

const HREF: Record<StepId, (id: string) => string> = {
  location: (id) => `/fields/${id}`,
  rotation: (id) => `/fields/${id}/rotation`,
  conditions: (id) => `/fields/${id}/conditions`,
  compare: (id) => `/fields/${id}/compare`,
};

interface StepperProps {
  fieldId: string;
  current: StepId;
  states: Record<StepId, StepState>;
  /** Steps whose page exists. Others show as plain text, not links. */
  available: Record<StepId, boolean>;
}

/** The four steps of a field, with where each one stands. */
export function Stepper({ fieldId, current, states, available }: StepperProps) {
  return (
    <nav aria-label="Steps for this field">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ORDER.map((id, i) => {
          const isCurrent = id === current;
          const body = (
            <>
              <span className="flex items-center gap-2 text-label text-ink">
                <span
                  className={cn(
                    "tabular grid size-6 shrink-0 place-items-center rounded-pill border text-source",
                    states[id] === "done" ? "border-field bg-field text-on-field" : "border-line-strong text-ink-muted",
                  )}
                >
                  {states[id] === "done" ? <CheckGlyph width={14} height={14} /> : i + 1}
                </span>
                {copy.steps[id]}
              </span>
              <span className="pl-8 text-body-sm text-ink-muted">{STATE_WORDS[states[id]]}</span>
            </>
          );
          const box = cn(
            "flex min-h-tap flex-col gap-0.5 rounded-md border px-3 py-2",
            isCurrent ? "border-field bg-field-soft" : "border-line bg-surface-raised",
          );
          return (
            <li key={id}>
              {available[id] ? (
                <Link href={HREF[id](fieldId)} aria-current={isCurrent ? "step" : undefined} className={cn(box, "no-underline hover:bg-surface-sunken")}>
                  {body}
                </Link>
              ) : (
                <div className={cn(box, "opacity-70")}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
