"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", long: "Your fields", short: "Fields", match: (p: string) => p === "/" || p.startsWith("/fields") },
  { href: "/about/data", long: "About the data", short: "Data", match: (p: string) => p.startsWith("/about") },
];

/** Top-level destinations. The current one is marked with a bar and aria-current. */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-tap items-center rounded-sm px-3 text-label no-underline transition-colors",
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
    </nav>
  );
}
