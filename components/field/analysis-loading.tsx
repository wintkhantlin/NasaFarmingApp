import { Panel } from "@/components/ui/panel";

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
    <Panel as="section" aria-busy="true" role="status" className="flex flex-col gap-3 p-4 sm:p-5">
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
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-body-sm text-ink-muted">
        {steps.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-field" />
            {s}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
