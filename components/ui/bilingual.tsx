"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useLocaleStore } from "@/lib/store/locale-store";

/**
 * Renders in the active user language (English or Burmese).
 * Never renders both languages mixed together.
 */
export function Bilingual({
  en,
  my,
  className,
  inherit: _inherit,
  center,
}: {
  en: ReactNode;
  my: string;
  className?: string;
  inherit?: boolean;
  center?: boolean;
}) {
  const locale = useLocaleStore((s) => s.locale);
  if (locale === "my") {
    return (
      <span lang="my" className={cn("inline-block", center && "text-center", className)}>
        {my}
      </span>
    );
  }
  return (
    <span className={cn("inline-block", center && "text-center", className)}>
      {en}
    </span>
  );
}
