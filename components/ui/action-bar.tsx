import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The one place a screen's main action lives (zone Z5). Sticky above the tab
 * bar on phones, a right-aligned row under the content from lg.
 *
 * Order is always `[secondary] [primary]`: the primary is last, so the thumb
 * finds it in the same spot on every screen. Every button in the bar has the
 * same width and height. Cancel, Done and
 * Back belong in the page bar, never here.
 */
export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "action-bar sticky z-20 -mx-4 grid grid-flow-col auto-cols-fr items-stretch gap-3 border-t border-line bg-surface-raised px-4 py-3",
        "max-lg:bottom-[var(--tabbar-h)] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:ml-auto lg:w-fit lg:border-0 lg:bg-transparent lg:px-0 lg:py-0",
        "print:hidden",
        "[&>*]:min-w-0 [&>*]:w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}
