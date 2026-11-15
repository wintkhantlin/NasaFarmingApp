"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useAppCopy, useLocaleStore, type AreaUnit, type Locale } from "@/lib/store/locale-store";
import { useFieldsStore } from "@/lib/store/fields-store";
import { openQuickQuestions } from "@/lib/engine/questions";

const LINKS: { href: string; label: "fields" | "plan" | "guide"; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "fields", icon: "fields", match: (p) => p === "/" || (Boolean(p) && p.startsWith("/fields")) },
  { href: "/plan", label: "plan", icon: "rotation", match: (p) => Boolean(p) && p.startsWith("/plan") },
  { href: "/data", label: "guide", icon: "learn", match: (p) => Boolean(p) && (p.startsWith("/data") || p.startsWith("/about") || p.startsWith("/learn")) },
];

/** Phone: the primary tab destinations fixed to the bottom, above the safe area. */
export function TabBar() {
  const pathname = usePathname() ?? "";
  const text = useAppCopy().appNav;
  const fields = useFieldsStore((s) => s.fields);
  const openQuestionsCount = useMemo(() => {
    return fields.reduce((acc, f) => {
      if (f.archivedAt) return acc;
      return acc + (openQuickQuestions(f)?.length ?? 0);
    }, 0);
  }, [fields]);

  return (
    <nav
      aria-label={text.main}
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
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1 text-center text-source font-medium no-underline transition-colors active:bg-surface-sunken",
                  active ? "text-field" : "text-ink-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-6 top-0 h-0.5 rounded-b-pill bg-field transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="relative inline-flex items-center justify-center">
                  <Icon name={l.icon} size={22} strokeWidth={active ? 2.3 : 1.8} />
                  {l.href === "/" && openQuestionsCount > 0 ? (
                    <span
                      aria-label={text.openQuestions(openQuestionsCount > 9 ? "9+" : String(openQuestionsCount))}
                      className="absolute -top-1 -right-2.5 grid h-3.5 min-w-3.5 place-items-center rounded-pill bg-unknown-border px-1 font-mono text-[9px] font-bold text-white leading-none shadow-xs"
                    >
                      {openQuestionsCount > 9 ? "9+" : openQuestionsCount}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">
                  {text[l.label]}
                </span>
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
  const text = useAppCopy().appNav;
  return (
    <nav aria-label={text.main} className="hidden items-center gap-1 lg:flex">
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
            {text[l.label]}
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const text = useAppCopy().appNav;
  const locale = useLocaleStore((s) => s.locale);
  const areaUnit = useLocaleStore((s) => s.areaUnit);
  const hydrate = useLocaleStore((s) => s.hydrate);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const setAreaUnit = useLocaleStore((s) => s.setAreaUnit);
  const wasOpen = useRef(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      // Trap Tab/Shift+Tab focus inside the dialog so it never escapes to the page behind it.
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    // Restore focus to the trigger that opened the dialog once it closes (never on first load).
    if (open) wasOpen.current = true;
    else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={text.settings}
        title={text.settings}
        aria-haspopup="dialog"
        className="inline-flex size-tap items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink active:bg-surface-sunken"
      >
        <Icon name="settings" size={22} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center print:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label={text.closeSettings}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-ink/40"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={text.settings}
            className="relative w-full max-w-md rounded-t-lg bg-surface-raised pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-float sm:rounded-lg sm:pb-4"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <h2 className="text-headline text-ink">{text.settings}</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-tap items-center rounded-md px-3 text-label text-field hover:bg-field-soft"
              >
                {text.done}
              </button>
            </div>
            <ul className="m-0 flex list-none flex-col px-4 py-0">
              <ChoiceRow
                icon="stack"
                title={text.areaUnit}
                name="area-unit"
                value={areaUnit}
                options={[
                  { value: "ha" as AreaUnit, label: text.hectares },
                  { value: "acre" as AreaUnit, label: text.acres },
                ]}
                onChange={setAreaUnit}
              />
              <ChoiceRow
                icon="language"
                title={text.language}
                name="language"
                value={locale}
                options={[
                  { value: "en" as Locale, label: "English", lang: "en" },
                  { value: "my" as Locale, label: "မြန်မာ", lang: "my" },
                ]}
                onChange={setLocale}
              />
            </ul>
            <Link href="/settings" onClick={() => setOpen(false)} className="mx-4 mt-2 flex min-h-tap items-center justify-between border-t border-line text-label text-field no-underline hover:underline">
              {text.more}
              <Icon name="next" size={16} />
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** A labelled radio group: the checked option is the current value, and tapping another one changes it. */
function ChoiceRow<T extends string>({
  icon,
  title,
  name,
  value,
  options,
  onChange,
}: {
  icon: IconName;
  title: string;
  name: string;
  value: T;
  options: Array<{ value: T; label: string; lang?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <li className="border-t border-line py-3 first:border-t-0">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="flex items-center gap-3 p-0 text-body text-ink">
          <Icon name={icon} className="text-ink-muted" />
          {title}
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {options.map((o) => (
            <label
              key={o.value}
              lang={o.lang}
              className={cn(
                "flex min-h-tap cursor-pointer items-center gap-2 rounded-md border px-3 text-label text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-field/40",
                value === o.value ? "border-field bg-field-soft" : "border-line-strong bg-surface-raised active:bg-surface-sunken",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="size-5 shrink-0 accent-[var(--color-field)]"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
    </li>
  );
}
