import Link from "next/link";
import { RotationPreview } from "@/components/preview/rotation-preview";
import { buttonClass } from "@/components/ui/button";
import { copy } from "@/lib/copy/en";

const STEPS = [
  "Mark your field on a map",
  "Record what you grow now",
  "Compare it with two other rotations",
];

/** The first screen a new farmer sees: what this does, three steps, and a look at the result. */
export function FirstRun() {
  return (
    <section
      aria-labelledby="first-run"
      className="grid items-center gap-8 overflow-hidden rounded-lg border border-line bg-surface-raised p-5 sm:p-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3">
          <h2 id="first-run" className="text-balance text-title text-ink sm:text-display">
            {copy.home.emptyTitle}
          </h2>
          <p className="max-w-measure text-body text-ink-muted">{copy.home.emptyBody}</p>
        </div>

        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-body text-ink">
              <span
                aria-hidden="true"
                className="tabular grid size-7 shrink-0 place-items-center rounded-pill border border-line-strong bg-surface font-mono text-source text-ink-muted"
              >
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-3">
          <Link href="/fields/new" className={buttonClass("primary")}>
            {copy.home.addField}
          </Link>
          <Link href="/about/data" className={buttonClass("secondary")}>
            About the data
          </Link>
        </div>
      </div>

      <RotationPreview />
    </section>
  );
}
