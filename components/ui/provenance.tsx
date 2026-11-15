import { copy } from "@/lib/copy/en";
import { cn } from "@/lib/cn";
import { missingText, provenanceLine, type DerivedIndicator } from "@/lib/evidence/indicator";
import type { RuleScope } from "@/lib/types";
import { SourceLine } from "./source-line";

/**
 * DESIGN_SYSTEM.md 9.6. The evidence behind a finding: "Based on: <citation>", with a link when one exists.
 * Falls back to the kind of source when a rule carries no citation text.
 */
export function Evidence({
  scope,
  refText,
  url,
  className,
}: {
  scope: RuleScope;
  refText?: string | null;
  url?: string | null;
  className?: string;
}) {
  const source = refText?.trim() || copy.scope[scope];
  return (
    <span className={cn("inline-flex max-w-full flex-wrap items-baseline gap-x-1 text-source text-ink-muted", className)}>
      <span className="font-medium text-ink">Based on:</span>
      <span className="break-words">{source}</span>
      {refText && refText.trim() !== copy.scope[scope] ? <span>({copy.scope[scope]})</span> : null}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-field underline">
          open
        </a>
      ) : null}
    </span>
  );
}

/** Kept so existing imports keep working. */
export const ScopeBadge = Evidence;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
    <dt className="text-body-sm text-ink-muted">{label}</dt>
    <dd className="m-0 break-words text-body-sm text-ink">{children}</dd>
  </div>
);

/**
 * The quiet source line under a number, plus an expandable block with everything the evidence
 * contract records: product and version, the exact variable, dates, scale, valid counts, how it was
 * screened, assumptions and rule sources. A missing value says why it is missing.
 */
export function Provenance({ indicator, className }: { indicator: DerivedIndicator; className?: string }) {
  const i = indicator;
  const missing = i.value === null;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <SourceLine dataset={i.product} resolution={i.sourceResolution || undefined} dates={i.periodStart && i.periodEnd ? `${i.periodStart} to ${i.periodEnd}` : undefined} />
      {missing ? <p className="m-0 text-body-sm text-drought">{copy.provenance.unknown}: {missingText(i.missingReason)}</p> : null}
      <details className="group text-body-sm">
        <summary className="inline-flex min-h-tap cursor-pointer items-center text-ink-muted underline-offset-2 hover:underline">{copy.provenance.open}</summary>
        <dl className="m-0 mt-1 flex flex-col gap-1.5 rounded-md border border-line bg-surface p-3">
          <Row label={copy.provenance.kind[i.kind]}>{provenanceLine(i)}</Row>
          <Row label={copy.provenance.variable}>
            {i.variableOrLayer}
            {i.sourceUrl ? (
              <>
                {" · "}
                <a href={i.sourceUrl} className="text-field underline" target="_blank" rel="noreferrer">
                  source
                </a>
              </>
            ) : null}
            {i.doi ? ` · DOI ${i.doi}` : ""}
          </Row>
          <Row label={copy.provenance.footprint}>{i.nativeFootprint || "—"}</Row>
          <Row label={copy.provenance.valid}>
            {i.validCount !== null && i.expectedCount !== null ? `${i.validCount} of ${i.expectedCount}` : "—"}
            {i.spatialCoverage !== null ? ` · ${(i.spatialCoverage * 100).toFixed(0)}% of the field` : ""}
          </Row>
          <Row label={copy.provenance.timeStandard}>{i.timeStandard}</Row>
          <Row label={copy.provenance.qa}>{i.qaPolicy || "—"}</Row>
          {i.assumptions.length ? (
            <Row label={copy.provenance.assumptions}>
              <ul className="m-0 list-disc pl-4">
                {i.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Row>
          ) : null}
          {i.ruleSources.length ? <Row label={copy.provenance.rules}>{i.ruleSources.join(" · ")}</Row> : null}
          <Row label={copy.provenance.retrieved}>
            {i.retrievedAt ? i.retrievedAt.slice(0, 10) : "—"} · processing {i.processingVersion}
          </Row>
        </dl>
      </details>
    </div>
  );
}
