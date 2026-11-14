import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";
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
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-tap max-w-[70%] items-center gap-0.5 rounded-md pr-3 pl-1 text-label text-field no-underline hover:bg-field-soft active:bg-field-soft"
        >
          <Icon name="back" size={22} />
          <span className="truncate">{backLabel ?? "Back"}</span>
        </Link>
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
  const cls =
    "inline-flex size-tap items-center justify-center rounded-md text-field hover:bg-field-soft active:bg-field-soft";
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={cls}>
        <Icon name={icon} size={20} />
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cls}>
      <Icon name={icon} size={20} />
    </button>
  );
}
