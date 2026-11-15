import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * English first, the Burmese translation as a second line beneath it.
 * Both are always in the page, so a reader in either language finds the same words.
 *
 * `inherit` keeps the Burmese line in the surrounding colour (use it inside a
 * primary button, where muted grey on green would be too faint to read).
 * `center` centres both lines (buttons, badges).
 */
export function Bilingual({
  en,
  my,
  className,
  inherit,
  center,
}: {
  en: ReactNode;
  my: string;
  className?: string;
  inherit?: boolean;
  center?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 flex-col", center && "items-center text-center", className)}>
      <span>{en}</span>
      <span lang="my" className={cn("text-body-sm font-normal", inherit ? "text-current opacity-90" : "text-ink-muted")}>
        {my}
      </span>
    </span>
  );
}
