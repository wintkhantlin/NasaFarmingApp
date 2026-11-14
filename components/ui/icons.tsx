import type { SVGProps } from "react";

/**
 * Line glyphs: 16px, 1.6px stroke, currentColor. Hazard glyphs carry data
 * meaning and always sit beside words (The Never-Color-Alone Rule).
 */
export type Hazard = "water" | "heat" | "drought" | "frost" | "healthy";

const PATHS: Record<Hazard, string> = {
  water: "M8 1.8C8 1.8 3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.8 8 1.8Z",
  heat: "M8 4.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8ZM8 .8v1.6M8 13.6v1.6M.8 8h1.6M13.6 8h1.6M2.9 2.9l1.1 1.1M12 12l1.1 1.1M2.9 13.1 4 12M12 4l1.1-1.1",
  drought: "M1.5 12.5h13M3 9.5h10M4.5 12.5l2-3 1.5 1.5L9.5 7M11 12.5 9.5 9.5M8 2.5v2.5M5 3.5l1 1.5M11 3.5l-1 1.5",
  frost: "M8 1v14M2 4.5l12 7M2 11.5l12-7M6.3 1.9 8 3.5l1.7-1.6M6.3 14.1 8 12.5l1.7 1.6",
  healthy: "M13.5 2.5C7 2.5 3 5.5 3 10.5c0 1 .2 2 .6 2.9M13.5 2.5c0 6.5-3.5 10-8.5 10M3.6 13.4C5 10 8 7 10.5 5.5",
};

function Glyph({ d, strokeWidth = 1.6, children, ...rest }: { d?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {d ? <path d={d} /> : null}
      {children}
    </svg>
  );
}

export function HazardGlyph({ hazard, ...rest }: { hazard: Hazard } & SVGProps<SVGSVGElement>) {
  return <Glyph d={PATHS[hazard]} {...rest} />;
}

export function CheckGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M3.5 8.5l3 3 6-7" strokeWidth={2} {...props} />;
}

export function PinGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M8 14.5s4.5-4.2 4.5-8A4.5 4.5 0 0 0 3.5 6.5c0 3.8 4.5 8 4.5 8Z" />
      <circle cx="8" cy="6.5" r="1.6" />
    </Glyph>
  );
}

export function ArrowLeftGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M13 8H3M7 4 3 8l4 4" strokeWidth={1.8} {...props} />;
}

export function ChevronRightGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M6 3.5 10.5 8 6 12.5" strokeWidth={1.8} {...props} />;
}

export function PlusGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M8 3v10M3 8h10" strokeWidth={1.8} {...props} />;
}

export function PrintGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M4.5 6V1.8h7V6M4.5 11.5h-2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-2M4.5 9.5h7v4.7h-7z" {...props} />;
}

export function DocGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M9.5 1.5h-5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4.5l-3-3ZM9.5 1.5v3h3M5.8 8h4.4M5.8 10.8h4.4" {...props} />;
}

export function ClockGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.6V8l2.3 1.6" />
    </Glyph>
  );
}

export function CrossGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M4 4l8 8M12 4l-8 8" strokeWidth={1.8} {...props} />;
}

export function LayersGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M8 1.8 1.5 5.2 8 8.6l6.5-3.4L8 1.8ZM1.5 8.2 8 11.6l6.5-3.4M1.5 11.1 8 14.5l6.5-3.4" {...props} />;
}

export function InfoGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.2v4M8 4.8v.1" />
    </Glyph>
  );
}

export function ThermometerGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M9.5 7.5V3a1.5 1.5 0 0 0-3 0v4.5a3 3 0 1 0 3 0Z" />
      <path d="M8 4.5v3.5" />
    </Glyph>
  );
}

export function UpArrowGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M8 13V3M4 7l4-4 4 4" strokeWidth={1.8} {...props} />;
}

export function DownArrowGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M8 3v10M4 9l4 4 4-4" strokeWidth={1.8} {...props} />;
}

export function DownloadGlyph(props: SVGProps<SVGSVGElement>) {
  return <Glyph d="M8 2.5v8.5M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11" strokeWidth={1.8} {...props} />;
}
