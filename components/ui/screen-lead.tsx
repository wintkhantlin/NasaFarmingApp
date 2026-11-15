import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { Panel } from "./panel";

/**
 * One spoken sentence, a why line, and one next action.
 * Use this to open a screen; charts and forms follow it.
 */
export function ScreenLead({
  context,
  headline,
  reason,
  action,
  assumed,
  footer,
  as: Heading = "h2",
  className,
}: {
  context?: string;
  headline: string;
  reason?: string;
  action?: ReactNode;
  assumed?: ReactNode;
  footer?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <Panel as="section" radius="lg" className={cn("flex flex-col gap-3 p-4 sm:p-5", className)}>
      {context ? <p className="m-0 text-overline text-ink-muted">{context}</p> : null}
      <Heading className="text-balance text-title text-ink sm:text-display">{headline}</Heading>
      {reason ? <p className="m-0 max-w-measure text-body text-ink-muted">{reason}</p> : null}
      {assumed ? <div className="flex flex-wrap gap-2">{assumed}</div> : null}
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      {footer ? <div className="border-t border-line pt-3">{footer}</div> : null}
    </Panel>
  );
}

/**
 * Marks a typical value the farmer has not confirmed: a quiet "Assumed" tag, then a plain
 * "Change" link to Farm. Two small words beside the value, not a second button-sized object.
 */
export function AssumedChip({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-source">
      <span className="rounded-xs bg-unknown-bg px-1.5 py-0.5 font-medium text-unknown-text">{copy.path.assumed}</span>
      <Link
        href={href}
        className="-my-2 inline-flex min-h-tap items-center px-1 font-medium text-field underline underline-offset-4 hover:text-ink"
      >
        {children ?? "Change"}
      </Link>
    </span>
  );
}
