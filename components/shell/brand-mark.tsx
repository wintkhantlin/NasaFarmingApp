/** The app's own mark: two furrows rising to a sprout, in Field Green. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden="true" className="shrink-0">
      <rect width="28" height="28" rx="8" className="fill-field" />
      <path
        d="M6 21c4.5-1 7-4.4 8-10M14 21c0-5 2.4-8.4 8-10M6 15.5c2.6 0 4.6-1 6-3"
        fill="none"
        className="stroke-on-field"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
