import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * DESIGN_SYSTEM.md 10.11. One message component for every notice in the app.
 * The tone says what kind of message it is; icon + title always carry the meaning, never colour alone.
 *
 *   info     context, not a problem ("Past seasons, not a forecast")
 *   success  ready, saved, passes
 *   caution  watch out, check before you rely on this
 *   problem  blocked, does not fit, an error
 *   needs    something is missing; the body says what completes it
 */
export type MessageTone = "info" | "success" | "caution" | "problem" | "needs";

const TONES: Record<MessageTone, { surface: string; circle: string; icon: IconName; word: string }> = {
  info: { surface: "border-line bg-surface-sunken", circle: "bg-surface text-ink-muted", icon: "info", word: "Note" },
  success: { surface: "border-field/30 bg-field-soft", circle: "bg-surface text-field", icon: "done", word: "Good" },
  caution: { surface: "border-drought/30 bg-drought-soft", circle: "bg-surface text-drought", icon: "alert", word: "Watch out" },
  problem: { surface: "border-stress/40 bg-stress-bg", circle: "bg-surface text-stress", icon: "close", word: "Problem" },
  needs: { surface: "border-dashed border-unknown-border bg-unknown-bg", circle: "bg-surface text-unknown-text", icon: "help", word: "Needs your input" },
};

export interface MessageProps {
  tone: MessageTone;
  /** The finding, in six words or fewer. Never "cannot" or "not": say what is true. */
  title: ReactNode;
  /** One or two sentences: what it means, or what to do next. */
  children?: ReactNode;
  /** A text link or a secondary button. Keep it to one. */
  action?: ReactNode;
  /** Where this comes from. Usually an <Evidence /> line. */
  evidence?: ReactNode;
  /** One line with a small icon and no circle, for use inside a card. */
  compact?: boolean;
  /** Announce to assistive tech: "alert" for errors that appear after an action, "status" for results. Static notices need none. */
  role?: "alert" | "status";
  className?: string;
}

export function Message({ tone, title, children, action, evidence, compact, role, className }: MessageProps) {
  const t = TONES[tone];

  if (compact) {
    return (
      <div role={role} className={cn("flex items-start gap-2 text-body-sm", className)}>
        <span className={cn("mt-0.5 shrink-0", t.circle.split(" ").filter((c) => c.startsWith("text-")).join(" "))}>
          <Icon name={t.icon} size={16} strokeWidth={2.4} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="m-0 font-medium text-ink">
            <span className="sr-only">{t.word}: </span>
            {title}
          </p>
          {children ? <div className="text-ink-muted">{children}</div> : null}
          {action ? <div className="mt-1">{action}</div> : null}
          {evidence ? <div className="mt-0.5">{evidence}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div role={role} className={cn("flex min-w-0 items-start gap-3 rounded-md border p-3 sm:p-4", t.surface, className)}>
      <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-pill", t.circle)}>
        <Icon name={t.icon} size={20} strokeWidth={2.4} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="m-0 text-label font-semibold text-ink">
          <span className="sr-only">{t.word}: </span>
          {title}
        </p>
        {children ? <div className="max-w-measure text-body-sm text-ink">{children}</div> : null}
        {action ? <div className="mt-1.5 flex flex-wrap items-center gap-2 [&_a]:min-h-tap [&_button]:min-h-tap">{action}</div> : null}
        {evidence ? <div className="mt-1">{evidence}</div> : null}
      </div>
    </div>
  );
}
