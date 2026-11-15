"use client";

import Link from "next/link";
import { RiskChip } from "@/components/ui/risk-chip";
import { StatusTag } from "@/components/ui/status";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { LIMIT_KEYS, type LimitCheck, type LimitKey } from "@/lib/engine/limits";
import { copy } from "@/lib/copy/en";
import { useAppCopy } from "@/lib/store/locale-store";

/** English names for each limit. Screens that show text to a farmer read `limits.labels` through useAppCopy. */
export const LIMIT_LABEL: Record<LimitKey, string> = copy.limits.labels;

function Chip({ c }: { c: LimitCheck }) {
  const t = useAppCopy().limits;
  if (c.result === "pass") return <RiskChip hazard="healthy">{t.fits}</RiskChip>;
  if (c.result === "fail") return <StatusTag tag="limit-fail">{t.doesNotFit}</StatusTag>;
  return <StatusTag tag="unanswered" />;
}

/**
 * Compact view: answered limits one per line; unanswered limits folded into one quiet line,
 * so five "not asked" tags never repeat under every option. Not asked is still never a pass.
 */
export function LimitSummary({ checks, fieldId }: { checks: LimitCheck[]; fieldId?: string }) {
  const t = useAppCopy().limits;
  const answered = checks.filter((c) => c.result !== "not-asked");
  const unasked = checks.filter((c) => c.result === "not-asked");
  return (
    <div className="flex flex-col gap-1.5">
      {answered.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {answered.map((c) => (
            <li key={c.limit} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-body-sm text-ink-muted">{t.labels[c.limit]}</span>
              <Chip c={c} />
            </li>
          ))}
        </ul>
      ) : null}
      {unasked.length > 0 ? (
        <p className="m-0 text-body-sm text-ink-muted">
          {t.notChecked(unasked.map((c) => t.short[c.limit]).join(", "))}
          {fieldId ? (
            <>
              {" "}
              <Link href={`/fields/${fieldId}/profile#limits`} className="text-field underline">
                {t.addLimits}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Selected option: each limit with the reason it fails. Failed limits dim an option; they never hide it. */
export function LimitChecks({ checks, fieldId }: { checks: LimitCheck[]; fieldId: string }) {
  const t = useAppCopy().limits;
  const unasked = checks.filter((c) => c.result === "not-asked").length;
  return (
    <Panel as="div" className="flex flex-col gap-3 p-4 sm:p-5">
      <PanelHeader as="h3" title={t.against} description={t.againstHelp} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {LIMIT_KEYS.map((k) => {
          const c = checks.find((x) => x.limit === k);
          if (!c) return null;
          return (
            <li key={k} className="flex min-h-tap flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-36 text-label text-ink">{t.labels[k]}</span>
              <Chip c={c} />
              {c.reason ? <span className="text-body-sm text-ink-muted">{c.reason}</span> : null}
            </li>
          );
        })}
      </ul>
      {unasked > 0 ? (
        <Link href={`/fields/${fieldId}/profile#limits`} className="text-label text-field">
          {t.addLimits}
        </Link>
      ) : null}
    </Panel>
  );
}
