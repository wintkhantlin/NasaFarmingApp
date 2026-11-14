"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useLocaleStore } from "@/lib/store/locale-store";

const LINKS = [
  { href: "/", long: "Your fields", short: "Fields", match: (p: string) => p === "/" || p.startsWith("/fields") },
  { href: "/about/data", long: "About the data", short: "Data", match: (p: string) => p.startsWith("/about/data") },
  { href: "/about/crops", long: "Crop library", short: "Crops", match: (p: string) => p.startsWith("/about/crops") },
];

/** Top-level destinations. The current one is marked with a bar and aria-current. */
export function AppNav() {
  const pathname = usePathname();
  const locale = useLocaleStore((s) => s.locale);
  const areaUnit = useLocaleStore((s) => s.areaUnit);
  const toggleLocale = useLocaleStore((s) => s.toggleLocale);
  const toggleAreaUnit = useLocaleStore((s) => s.toggleAreaUnit);

  return (
    <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-tap items-center rounded-sm px-2.5 text-label no-underline transition-colors sm:px-3",
              active ? "text-ink" : "text-ink-muted hover:text-ink",
              active &&
                "after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-pill after:bg-field",
            )}
          >
            <span className="sm:hidden">{l.short}</span>
            <span className="hidden sm:inline">{l.long}</span>
          </Link>
        );
      })}

      <div className="ml-1 flex items-center gap-1 border-l border-line pl-2">
        <button
          type="button"
          onClick={toggleAreaUnit}
          aria-label={`Switch area unit (currently ${areaUnit})`}
          className="rounded-sm px-1.5 py-1 text-source font-mono font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          {areaUnit}
        </button>
        <button
          type="button"
          onClick={toggleLocale}
          aria-label={`Switch language (currently ${locale})`}
          className="rounded-sm px-1.5 py-1 text-source font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          {locale === "en" ? "မြန်မာ" : "EN"}
        </button>
      </div>
    </nav>
  );
}
