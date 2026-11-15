import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { ChevronRightGlyph } from "@/components/ui/icons";
import { Icon } from "@/components/ui/icon";
import { copy } from "@/lib/copy/en";

const STEPS = [
  { step: "1", title: "Choose an approximate pin or exact boundary" },
  { step: "2", title: "Record the crops and practices you know" },
  { step: "3", title: "Review and analyse the field" },
];

/** Empty field list: one clear start, with regional exploration kept separate. */
export function FirstRun() {
  return (
    <section
      aria-labelledby="first-run"
      className="flex flex-col items-start gap-6 rounded-lg border border-line bg-surface-raised p-5 sm:p-8"
    >
        <div className="flex flex-col gap-2">
          <h2 id="first-run" className="text-balance text-title text-ink sm:text-display">
            No fields saved yet
          </h2>
          <p className="max-w-measure text-body text-ink-muted">Add an approximate pin or exact boundary, then record only the farming details you know.</p>
        </div>

        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {STEPS.map((s) => (
            <li key={s.step} className="flex items-center gap-3.5 text-body text-ink">
              <span
                aria-hidden="true"
                className="tabular grid size-7 shrink-0 place-items-center rounded-pill border border-line-strong bg-surface font-mono text-source text-ink-muted"
              >
                {s.step}
              </span>
              <span className="text-label text-ink">{s.title}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-3">
          <Link href="/fields/new" className={buttonClass("primary")}>
            {copy.home.addField}
            <ChevronRightGlyph />
          </Link>
        </div>
    </section>
  );
}
