"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DisclosureProps {
  /** The always-visible row. Keep it to a few words. */
  title: ReactNode;
  /** Optional quiet text after the title, such as a count. */
  hint?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Mount the content only after it is first opened, so it can fetch on demand. */
  lazy?: boolean;
  children: ReactNode;
}

/**
 * One way to hide detail behind a tap. A 44px summary row, and open when printed so nothing is lost on paper.
 */
export function Disclosure({ title, hint, defaultOpen, className, lazy, children }: DisclosureProps) {
  const [opened, setOpened] = useState(Boolean(defaultOpen));
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;
    let wasOpen = el.open;
    const before = () => {
      wasOpen = el.open;
      el.open = true;
      setOpened(true);
    };
    const after = () => {
      el.open = wasOpen;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeprint", before);
        window.removeEventListener("afterprint", after);
      }
    };
  }, []);

  return (
    <details ref={ref} open={defaultOpen} onToggle={(e) => e.currentTarget.open && setOpened(true)} className={cn("rounded-md border border-line bg-surface", className)}>
      <summary className="flex min-h-tap cursor-pointer items-center gap-2 px-4 text-label text-ink">
        <span>{title}</span>
        {hint ? <span className="text-body-sm font-normal text-ink-muted">{hint}</span> : null}
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">{lazy && !opened ? null : children}</div>
    </details>
  );
}
