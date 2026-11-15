import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

/**
 * A link to another page, always in one shape: icon · label · chevron, with a 44 px tap area
 * (DESIGN_SYSTEM.md, "Navigation row" and `size.hit`). Use it for every "go to" link inside a panel so
 * they read and tap the same. Keep the label to two or three words that make sense on their own.
 */
export function NavLink({ href, icon, children, className }: { href: string; icon: IconName; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-tap items-center gap-1.5 text-label font-medium text-field no-underline hover:underline focus-visible:outline-field",
        className,
      )}
    >
      <Icon name={icon} size={16} className="shrink-0" />
      <span>{children}</span>
      <Icon name="next" size={14} className="shrink-0" />
    </Link>
  );
}
