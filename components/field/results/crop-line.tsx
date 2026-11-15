import { Icon } from "@/components/ui/icon";

/** The crop sequence as small pills joined by arrows, so an option is readable without parsing a sentence. */
export function CropLine({ crops }: { crops: string[] }) {
  if (crops.length === 0) return <span className="text-body-sm text-ink-muted">No crops recorded</span>;
  return (
    <ol aria-label="Crops in order" className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-1.5 p-0">
      {crops.map((c, i) => (
        <li key={`${c}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <Icon name="next" size={14} className="text-ink-muted" aria-hidden /> : null}
          <span className="rounded-pill border border-field/20 bg-field-soft px-2.5 py-0.5 text-body-sm font-semibold text-ink">{c.replace(/\s*\(.*\)\s*$/, "")}</span>
        </li>
      ))}
    </ol>
  );
}
