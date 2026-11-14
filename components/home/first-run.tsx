import { Button, ButtonRow } from "@/components/ui/button";
import { ChevronRightGlyph } from "@/components/ui/icons";
import { Icon } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { RiskChip } from "@/components/ui/risk-chip";
import { copy } from "@/lib/copy/en";

const STEPS = [
  { step: "1", title: "Mark your field on a map" },
  { step: "2", title: "Tap the crops you grow" },
  { step: "3", title: "See your answer" },
];

/** The first screen a new farmer sees: what this does, three steps, and an authentic look at what a decision looks like. */
export function FirstRun() {
  return (
    <section
      aria-labelledby="first-run"
      className="grid items-center gap-8 overflow-hidden rounded-lg border border-line bg-surface-raised p-5 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 id="first-run" className="text-balance text-title text-ink sm:text-display">
            {copy.home.emptyTitle}
          </h2>
          <p className="max-w-measure text-body text-ink-muted">{copy.home.emptyBody}</p>
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

        <ButtonRow className="pt-1">
          <Button href="/fields/new" variant="primary">
            {copy.home.addField}
            <ChevronRightGlyph />
          </Button>
          <Button href="/about/data" variant="secondary">
            About the data
          </Button>
        </ButtonRow>
      </div>

      {/* A clean sample comparison without fake window chrome or card-in-card */}
      <Panel tone="plain" className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Icon name="outline" className="text-field" />
            <span className="text-body-sm font-medium text-ink">Preview: Magway Region</span>
          </div>
          <RiskChip hazard="healthy">Suits sandy loam</RiskChip>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-source text-ink-muted">Option: Sesame, then green gram</span>
          <p className="m-0 text-headline text-ink">Sesame followed by green gram on stored moisture</p>
          <p className="m-0 text-body-sm text-ink-muted">
            Rain shortfall is 85 mm lower than continuous sesame. Green gram adds nitrogen back to the soil and keeps ground covered during early dry months.
          </p>
        </div>

        <dl className="m-0 grid grid-cols-2 gap-2 border-t border-line pt-3 text-body-sm">
          <div>
            <dt className="text-source text-ink-muted">Dry-season reliability</dt>
            <dd className="tabular m-0 font-mono text-ink">7 of 8 years passed</dd>
          </div>
          <div>
            <dt className="text-source text-ink-muted">Nitrogen fixed</dt>
            <dd className="tabular m-0 font-mono text-ink">35 to 60 kg N/ha</dd>
          </div>
        </dl>
      </Panel>
    </section>
  );
}
