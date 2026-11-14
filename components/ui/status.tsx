import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** DESIGN_SYSTEM.md 9.3 and 9.4. Status is always a word plus a glyph, never colour alone. */

export type Scale = "field" | "village" | "wider" | "region" | "estimated";
const SCALE: Record<Scale, { word: string; glyph: string }> = {
  field: { word: "Your field", glyph: "▢" },
  village: { word: "Village area", glyph: "◌" },
  wider: { word: "Wider area", glyph: "◌" },
  region: { word: "Wider region", glyph: "◌" },
  estimated: { word: "Estimated map", glyph: "▦" },
};

const pill = "inline-flex min-h-6 items-center gap-1 rounded-pill px-2.5 py-0.5 text-source";

export function ScaleBadge({ scale, className }: { scale: Scale; className?: string }) {
  const s = SCALE[scale];
  return (
    <span className={cn(pill, "bg-surface-sunken text-ink-muted", className)}>
      <span aria-hidden>{s.glyph}</span>
      {s.word}
    </span>
  );
}

export type Tag = "best-match" | "yours" | "not-known" | "not-asked" | "hypothetical" | "limit-fail";
const TAGS: Record<Tag, { cls: string; glyph: string; word: string }> = {
  "best-match": { cls: "bg-field-soft text-accent-text", glyph: "✓", word: "Best match to your priorities" },
  yours: { cls: "bg-surface-sunken text-ink-muted", glyph: "", word: "Yours" },
  "not-known": { cls: "bg-unknown-bg text-unknown-text", glyph: "?", word: "Not known" },
  "not-asked": { cls: "border border-dashed border-unknown-border text-ink-muted", glyph: "…", word: "Not asked" },
  hypothetical: { cls: "bg-surface-sunken text-ink", glyph: "⇅", word: "Hypothetical" },
  "limit-fail": { cls: "bg-stress-bg text-stress", glyph: "×", word: "Doesn't fit your limits" },
};

export function StatusTag({ tag, children, className }: { tag: Tag; children?: ReactNode; className?: string }) {
  const t = TAGS[tag];
  return (
    <span className={cn(pill, t.cls, className)}>
      {t.glyph ? <span aria-hidden>{t.glyph}</span> : null}
      {children ?? t.word}
    </span>
  );
}
