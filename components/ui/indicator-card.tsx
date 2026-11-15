import { cn } from "@/lib/cn";
import { missingText, type DerivedIndicator } from "@/lib/evidence/indicator";
import {
  EVIDENCE_CLASS_HELP,
  EVIDENCE_CLASS_LABEL,
  EVIDENCE_SCOPE_LABEL,
  explainIndicator,
  periodText,
  TERM_HELP,
  valueWithUnits,
} from "@/lib/evidence/explain";
import { Provenance } from "./provenance";

/** A plain badge. Colour is not used: the words carry the evidence type (DESIGN_SYSTEM: data colours mean data only). */
export function EvidenceBadge({ indicator, className }: { indicator: DerivedIndicator; className?: string }) {
  const { evidenceClass } = explainIndicator(indicator);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-source font-medium",
        evidenceClass === "missing" ? "border-dashed border-line-strong bg-surface-sunken text-ink" : "border-line-strong bg-surface text-ink-muted",
        className,
      )}
    >
      <span aria-hidden="true">{evidenceClass === "farmer" ? "●" : evidenceClass === "satellite" ? "◆" : evidenceClass === "model" ? "▲" : "○"}</span>
      {EVIDENCE_CLASS_LABEL[evidenceClass].short}
    </span>
  );
}

const Line = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <p className="m-0 text-body-sm text-ink-muted">
    <span className="font-medium text-ink">{label}: </span>
    {children}
  </p>
);

/**
 * One scientific indicator for a farmer: the plain name, the original value with its unit and
 * period, what kind of evidence it is, why it matters, and what it cannot tell you. The full
 * provenance record sits under "Where this comes from".
 */
export function IndicatorCard({ indicator, claim, comparedTo, className }: { indicator: DerivedIndicator; claim?: string; comparedTo?: string; className?: string }) {
  const x = explainIndicator(indicator);
  const value = valueWithUnits(indicator);
  const period = periodText(indicator);
  const missing = x.evidenceClass === "missing";
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-label text-ink">{claim ?? x.title}</p>
        <EvidenceBadge indicator={indicator} />
      </div>
      {claim && claim !== x.title ? <p className="m-0 text-body-sm text-ink">{x.title}</p> : null}

      {missing ? (
        <p className="m-0 text-body-sm text-ink">
          <span className="font-medium">Not available. </span>
          {missingText(indicator.missingReason)} This is missing information, not zero.
        </p>
      ) : (
        <p className="tabular m-0 font-mono text-data text-ink">{value}</p>
      )}

      <p className="m-0 flex flex-wrap gap-x-2 text-source text-ink-muted">
        <span>{EVIDENCE_SCOPE_LABEL[x.scope]}</span>
        {x.scale ? <span>· {x.scale}</span> : null}
        <span>· {period ? `${period}. ${x.timeframe}` : x.timeframe}</span>
      </p>
      {comparedTo ? <p className="m-0 text-body-sm text-ink-muted">{comparedTo}</p> : null}

      <details className="text-body-sm">
        <summary className="inline-flex min-h-tap cursor-pointer items-center text-field underline-offset-2 hover:underline">What this means and why it matters</summary>
        <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-line bg-surface p-3">
          <Line label="What it is">{x.meaning}</Line>
          <Line label="Why it matters">{x.why}</Line>
          <Line label="Limits">
            <span className="inline-flex flex-col">
              {x.limits.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </span>
          </Line>
          <Line label={EVIDENCE_CLASS_LABEL[x.evidenceClass].label}>
            {EVIDENCE_CLASS_HELP[x.evidenceClass]}
            {missing ? ` It would have come from a ${EVIDENCE_CLASS_LABEL[x.sourceClass].label.toLowerCase()}.` : ""}
          </Line>
        </div>
      </details>

      <Provenance indicator={indicator} />
    </div>
  );
}

/** A glossary entry for a technical term, with what it is and why it matters. Used where a term has no indicator of its own. */
export function TermNote({ term, kind, where, className }: { term: keyof typeof TERM_HELP; kind: "farmer" | "satellite" | "model"; where: string; className?: string }) {
  const t = TERM_HELP[term];
  return (
    <details className={cn("text-body-sm", className)}>
      <summary className="inline-flex min-h-tap cursor-pointer items-center text-field underline-offset-2 hover:underline">What is {t.name}?</summary>
      <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-line bg-surface p-3">
        <Line label="What it is">{t.plain}</Line>
        <Line label="Why it matters">{t.matters}</Line>
        <Line label={EVIDENCE_CLASS_LABEL[kind].label}>{EVIDENCE_CLASS_HELP[kind]} {where}</Line>
      </div>
    </details>
  );
}
