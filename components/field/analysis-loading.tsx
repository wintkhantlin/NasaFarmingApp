import { Icon } from "@/components/ui/icon";

function StepIndicator({ status }: { status: "loading" | "ready" }) {
  if (status === "ready") {
    return (
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center text-field"
      >
        <Icon name="check" size={14} className="stroke-[2.5]" />
      </span>
    );
  }

  return (
    <svg
      aria-hidden
      className="size-4 shrink-0 animate-spin text-field"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  );
}

/**
 * What a field screen shows while the first weather and soil check runs (10 to 30 seconds the first
 * time, instant after that because the answer is saved on the phone). Grey bars alone read as a frozen
 * page; this says what is happening, how long it takes, and shows the farmer's own crops meanwhile.
 */
export function AnalysisLoading({
  title,
  steps = ["Weather for the last 10 years", "Soil map for your field", "Replaying past seasons on your crops"],
  crops,
  slow = false,
}: {
  title: string;
  steps?: string[];
  /** The crops the farmer entered, so the screen is useful before the data arrives. */
  crops?: string[];
  /** The check has run longer than usual (see `slow` from useFieldAnalysis): say that waiting is normal. */
  slow?: boolean;
}) {
  return (
    <section aria-busy="true" role="status" className="flex flex-col gap-3 py-1">
      <h2 className="m-0 text-headline text-ink">{title}</h2>
      <p className="m-0 text-body-sm text-ink-muted">
        {slow
          ? "Still checking… the first time is slow. Keep this page open. Next time it opens straight away."
          : "This takes up to 30 seconds the first time. After that it opens straight away."}
      </p>
      {crops && crops.length > 0 ? (
        <p className="m-0 text-body-sm text-ink">
          <span className="text-ink-muted">Your crops: </span>
          {crops.join(" → ")}
        </p>
      ) : null}
      <ol className="m-0 flex list-none flex-col gap-2 p-0 text-body-sm text-ink">
        {steps.map((s) => {
          const isReady = /:\s*ready\b/i.test(s) || /\bready\b/i.test(s) && !/checking/i.test(s);
          return (
            <li key={s} className="flex items-center gap-2.5">
              <StepIndicator status={isReady ? "ready" : "loading"} />
              <span className={isReady ? "text-ink" : "text-ink-muted"}>{s}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
