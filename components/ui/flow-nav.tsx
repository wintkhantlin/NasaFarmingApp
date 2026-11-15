import Link from "next/link";
import type { ReactNode } from "react";
import { ActionBar } from "@/components/ui/action-bar";
import { Button, ButtonContent, buttonClass } from "@/components/ui/button";
import type { IconName } from "@/components/ui/icon";

type Step = {
  label: ReactNode;
  /** A link when set, a button otherwise. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Short reason shown under the bar when the step is disabled. */
  disabledReason?: ReactNode;
  icon?: IconName;
};

/**
 * Back and Next for a linear task (setup, form, wizard). Always the same
 * place on every screen: Back on the left (quiet, smaller), Next on the right
 * (primary, widest), pinned above the tab bar on phones. Use this instead of
 * hand-placing Continue/Back buttons in a screen.
 *
 *   <FlowNav back={{ label: "Back", href }} next={{ label: "Next", onClick }} />
 *
 * Omit `back` on the first step; omit `next` only on a screen that is not a
 * step. `next.icon` defaults to the forward chevron; pass `icon: "done"` for
 * the final step.
 */
export function FlowNav({ back, next, hint, className }: { back?: Step; next?: Step; hint?: ReactNode; className?: string }) {
  return (
    // `contents` so the sticky ActionBar sticks against the page scroller, not this wrapper.
    <div className={className ?? "contents"}>
      <ActionBar>
        {back ? <StepControl step={back} variant="secondary" defaultIcon="back" lead /> : null}
        {next ? <StepControl step={next} variant="primary" defaultIcon="next" /> : null}
      </ActionBar>
      {next?.disabled && next.disabledReason ? (
        <p className="mt-2 text-body-sm text-ink-muted max-lg:px-0 lg:text-right" role="status">
          {next.disabledReason}
        </p>
      ) : hint ? (
        <p className="mt-2 text-body-sm text-ink-muted lg:text-right">{hint}</p>
      ) : null}
    </div>
  );
}

function StepControl({
  step,
  variant,
  defaultIcon,
  lead,
}: {
  step: Step;
  variant: "primary" | "secondary";
  defaultIcon: IconName;
  lead?: boolean;
}) {
  const icon = step.icon ?? defaultIcon;
  const size = variant === "primary" ? "lg" : "md";
  if (step.href && !step.disabled) {
    return (
      <Link href={step.href} className={buttonClass(variant, undefined, size)}>
        <ButtonContent icon={lead ? icon : undefined} iconEnd={lead ? undefined : icon}>
          {step.label}
        </ButtonContent>
      </Link>
    );
  }
  return (
    <Button
      variant={variant}
      size={size}
      onClick={step.onClick}
      disabled={step.disabled}
      icon={lead ? icon : undefined}
      iconEnd={lead ? undefined : icon}
    >
      {step.label}
    </Button>
  );
}
