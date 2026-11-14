import type { SVGProps } from "react";

/**
 * Placeholder glyphs: 16px, 1.6px stroke, currentColor. Replace with the chosen
 * icon set when one is picked (see DESIGN.md, Iconography).
 */
export type Hazard = "water" | "heat" | "drought" | "frost" | "healthy";

const PATHS: Record<Hazard, string> = {
  water: "M8 1.8C8 1.8 3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.8 8 1.8Z",
  heat: "M8 4.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8ZM8 .8v1.6M8 13.6v1.6M.8 8h1.6M13.6 8h1.6M2.9 2.9l1.1 1.1M12 12l1.1 1.1M2.9 13.1 4 12M12 4l1.1-1.1",
  drought: "M1.5 12.5h13M3 9.5h10M4.5 12.5l2-3 1.5 1.5L9.5 7M11 12.5 9.5 9.5M8 2.5v2.5M5 3.5l1 1.5M11 3.5l-1 1.5",
  frost: "M8 1v14M2 4.5l12 7M2 11.5l12-7M6.3 1.9 8 3.5l1.7-1.6M6.3 14.1 8 12.5l1.7 1.6",
  healthy: "M13.5 2.5C7 2.5 3 5.5 3 10.5c0 1 .2 2 .6 2.9M13.5 2.5c0 6.5-3.5 10-8.5 10M3.6 13.4C5 10 8 7 10.5 5.5",
};

export function HazardGlyph({ hazard, ...rest }: { hazard: Hazard } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[hazard]} />
    </svg>
  );
}

export function CheckGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function PinGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 14.5s4.5-4.2 4.5-8A4.5 4.5 0 0 0 3.5 6.5c0 3.8 4.5 8 4.5 8Z" />
      <circle cx="8" cy="6.5" r="1.6" />
    </svg>
  );
}

export function ArrowLeftGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M13 8H3M7 4 3 8l4 4" />
    </svg>
  );
}
