import type { ReactNode } from "react";
import { Button, IconButton } from "./button";
import type { IconName } from "./icon";
import { cn } from "@/lib/cn";

/**
 * The bar above a page title (zone Z1): Back on the left, at most two icon
 * actions on the right. Back is a link to the parent screen, labelled with
 * the parent's name, so it reads the same everywhere.
 */
export function PageBar({
  backHref,
  backLabel,
  actions,
  className,
}: {
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
}) {
  if (!backHref && !actions) return null;
  return (
    <div className={cn("-mt-2 flex min-h-tap items-center justify-between gap-2 print:hidden", className)}>
      {backHref ? (
        <Button href={backHref} variant="quiet" icon="back" className="-ml-2 max-w-[70%] justify-start">
          <span className="truncate">{backLabel ?? "Back"}</span>
        </Button>
      ) : (
        <span />
      )}
      {actions ? <div className="-mr-2 flex items-center gap-1">{actions}</div> : null}
    </div>
  );
}

/** A 44px icon-only button for the page bar. Always labelled. */
export function BarIconButton({
  icon,
  label,
  onClick,
  href,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  return <IconButton icon={icon} label={label} tone="field" href={href} onClick={onClick} />;
}
