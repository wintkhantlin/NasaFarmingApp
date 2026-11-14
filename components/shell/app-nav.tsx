"use client";

import { Button, IconButton, Pressable } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useLocaleStore } from "@/lib/store/locale-store";

const LINKS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Fields", icon: "fields", match: (p) => p === "/" || p.startsWith("/fields") },
  { href: "/plan", label: "Plan", icon: "rotation", match: (p) => p.startsWith("/plan") },
  { href: "/learn", label: "Learn", icon: "learn", match: (p) => p.startsWith("/learn") || p.startsWith("/about") },
];

/** Phone: the three destinations as a tab bar fixed to the bottom, above the safe area. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {LINKS.map((l) => {
          const active = l.match(pathname);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-source font-medium no-underline transition-colors active:bg-surface-sunken",
                  active ? "text-field" : "text-ink-muted",
                )}
              >
                <Icon name={l.icon} size={22} strokeWidth={active ? 2.3 : 1.8} />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** From lg: the same destinations as icon links in the header. */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-tap items-center gap-2 rounded-md px-3 text-label no-underline transition-colors",
              active ? "bg-field-soft text-field" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            <Icon name={l.icon} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Units and language: rarely changed, so one icon button opens a sheet instead of two cramped toggles. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const areaUnit = useLocaleStore((s) => s.areaUnit);
  const hydrate = useLocaleStore((s) => s.hydrate);
  const toggleAreaUnit = useLocaleStore((s) => s.toggleAreaUnit);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <IconButton icon="settings" iconSize={22} label="Settings" aria-haspopup="dialog" onClick={() => setOpen(true)} />

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center print:hidden">
          <Pressable
            disableRipple
            tabIndex={-1}
            aria-label="Close settings"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-ink/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            className="relative w-full max-w-md rounded-t-lg bg-surface-raised pb-[max(1rem,env(safe-area-inset-bottom))] shadow-float sm:rounded-lg"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <h2 className="text-headline text-ink">Settings</h2>
              <Button ref={closeRef} variant="quiet" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
            <ul className="m-0 flex list-none flex-col px-4 py-0">
              <SettingRow
                icon="stack"
                title="Area unit"
                value={areaUnit === "ha" ? "Hectares" : "Acres"}
                onClick={toggleAreaUnit}
              />
            </ul>
            <div className="mx-4 mt-2 border-t border-line pt-1">
              <Button href="/settings" variant="quiet" iconEnd="next" block onClick={() => setOpen(false)} className="justify-between">
                More settings, privacy and backup
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SettingRow({
  icon,
  title,
  value,
  onClick,
}: {
  icon: IconName;
  title: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Pressable onClick={onClick} className="flex min-h-14 w-full items-center gap-3 text-left">
        <Icon name={icon} className="text-ink-muted" />
        <span className="flex-1 text-body text-ink">{title}</span>
        <span className="text-label text-field">{value}</span>
        <Icon name="next" size={16} className="text-ink-muted" />
      </Pressable>
    </li>
  );
}
