"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useAppCopy } from "@/lib/store/locale-store";

/** DESIGN_SYSTEM.md 9.3 and 9.4. Status is always a word plus a glyph, never colour alone. */

export type Scale = "field" | "village" | "wider" | "region" | "estimated";
const SCALE: Record<Scale, { word: string; glyph: string }> = {
  field: { word: "Your field", glyph: "▢" },
  village: { word: "Village area", glyph: "◌" },
  wider: { word: "Wider area", glyph: "◌" },
  region: { word: "Wider region", glyph: "◌" },
  estimated: { word: "Estimated map", glyph: "▦" },
};

const pill = "inline-flex min-h-7 items-center gap-1 rounded-pill px-2.5 py-0.5 text-body-sm";

export function ScaleBadge({ scale, className }: { scale: Scale; className?: string }) {
  const s = SCALE[scale];
  return (
    <span className={cn(pill, "bg-surface-sunken text-ink-muted", className)}>
      <span aria-hidden>{s.glyph}</span>
      {s.word}
    </span>
  );
}

/**
 * "told", "guessed" and "unanswered" are the three words for where an answer came from.
 * "not-known" and "not-asked" are kept as older names and show the same words as "unanswered".
 */
export type Tag = "best-match" | "yours" | "told" | "guessed" | "unanswered" | "not-known" | "not-asked" | "hypothetical" | "limit-fail";
const TAGS: Record<Tag, { cls: string; glyph: string; word: "best" | "yours" | "told" | "guessed" | "notAnswered" | "hypothetical" | "limitFail" }> = {
  "best-match": { cls: "bg-field-soft text-accent-text", glyph: "✓", word: "best" },
  yours: { cls: "bg-surface-sunken text-ink-muted", glyph: "", word: "yours" },
  told: { cls: "bg-field-soft text-field", glyph: "✓", word: "told" },
  guessed: { cls: "border border-line text-ink-muted", glyph: "≈", word: "guessed" },
  unanswered: { cls: "border border-dashed border-unknown-border text-ink-muted", glyph: "…", word: "notAnswered" },
  "not-known": { cls: "bg-unknown-bg text-unknown-text", glyph: "?", word: "notAnswered" },
  "not-asked": { cls: "border border-dashed border-unknown-border text-ink-muted", glyph: "…", word: "notAnswered" },
  hypothetical: { cls: "bg-surface-sunken text-ink", glyph: "⇅", word: "hypothetical" },
  "limit-fail": { cls: "bg-stress-bg text-stress", glyph: "×", word: "limitFail" },
};

export function StatusTag({ tag, children, className }: { tag: Tag; children?: ReactNode; className?: string }) {
  const words = useAppCopy().status;
  const t = TAGS[tag];
  return (
    <span className={cn(pill, t.cls, className)}>
      {t.glyph ? <span aria-hidden>{t.glyph}</span> : null}
      {children ?? words[t.word]}
    </span>
  );
}
