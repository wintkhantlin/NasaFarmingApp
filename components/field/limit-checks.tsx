import Link from "next/link";
import { RiskChip } from "@/components/ui/risk-chip";
import { StatusTag } from "@/components/ui/status";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { LIMIT_KEYS, type LimitCheck, type LimitKey } from "@/lib/engine/limits";

export const LIMIT_LABEL: Record<LimitKey, string> = {
  water: "Water",
  market: "What I can sell",
  household: "Household needs",
  labour: "Busy months",
  land: "Land and lease",
};

function Chip({ c }: { c: LimitCheck }) {
  if (c.result === "pass") return <RiskChip hazard="healthy">Fits</RiskChip>;
  if (c.result === "fail") return <StatusTag tag="limit-fail">Does not fit</StatusTag>;
  return <StatusTag tag="not-asked" />;
}

/** Compact table cell: one line per limit, each with a word and an icon. */
export function LimitSummary({ checks }: { checks: LimitCheck[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {checks.map((c) => (
        <li key={c.limit} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-body-sm text-ink-muted">{LIMIT_LABEL[c.limit]}</span>
          <Chip c={c} />
        </li>
      ))}
    </ul>
  );
}

/** Selected option: each limit with the reason it fails. Failed limits dim an option; they never hide it. */
export function LimitChecks({ checks, fieldId }: { checks: LimitCheck[]; fieldId: string }) {
  const unasked = checks.filter((c) => c.result === "not-asked").length;
  return (
    <Panel as="div" className="flex flex-col gap-3 p-4 sm:p-5">
      <PanelHeader as="h3" title="Against your limits" description="You told us these. A limit you haven't answered is not a pass." />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {LIMIT_KEYS.map((k) => {
          const c = checks.find((x) => x.limit === k);
          if (!c) return null;
          return (
            <li key={k} className="flex min-h-tap flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-36 text-label text-ink">{LIMIT_LABEL[k]}</span>
              <Chip c={c} />
              {c.reason ? <span className="text-body-sm text-ink-muted">{c.reason}</span> : null}
            </li>
          );
        })}
      </ul>
      {unasked > 0 ? (
        <Link href={`/fields/${fieldId}/profile#limits`} className="text-label text-field">
          Answer {unasked} more {unasked === 1 ? "limit" : "limits"}
        </Link>
      ) : null}
    </Panel>
  );
}
