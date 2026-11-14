import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "raised" | "sunken" | "field" | "plain";

const TONES: Record<Tone, string> = {
  raised: "border border-line bg-surface-raised",
  sunken: "border border-line bg-surface-sunken",
  field: "border border-field bg-field-soft",
  plain: "border border-line bg-surface",
};

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: Tone;
  /** lg for sheets and the one answer block on a screen, md for everything else. */
  radius?: "md" | "lg";
  children?: ReactNode;
}

/** A flat surface from the Field Almanac tokens. Cards never nest inside cards. */
export function Panel({ as: Tag = "section", tone = "raised", radius = "md", className, ...rest }: PanelProps) {
  return (
    <Tag
      className={cn(TONES[tone], radius === "lg" ? "rounded-lg" : "rounded-md", "min-w-0", className)}
      {...rest}
    />
  );
}

/** Heading row for a panel: a title, an optional one-line description, and an aside on the right. */
export function PanelHeader({
  title,
  description,
  aside,
  id,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  id?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <Heading id={id} className="text-headline text-ink">
          {title}
        </Heading>
        {description ? <p className="max-w-measure text-body-sm text-ink-muted">{description}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
