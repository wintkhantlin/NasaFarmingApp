"use client";

import { BandChip, bandHeat, bandPh, bandRain, type Band } from "@/components/field/conditions/bands";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { Crop } from "@/lib/types";

export interface ConditionsSummaryProps {
  conditions: ConditionsData;
  crop?: Crop | null;
  cropName?: string;
  effectivePh?: number | null;
  remote?: RemoteData | null;
  className?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** One reading: the band word first (Low, OK, High), then the exact number small. */
function Metric({
  icon,
  tone,
  label,
  band,
  value,
  unit,
  caption,
}: {
  icon: IconName;
  tone: string;
  label: string;
  band: Band | null;
  value: string | null;
  unit?: string;
  caption: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-3 py-3 first:pl-0 last:pr-0 sm:px-4">
      <dt className="flex min-h-9 items-start gap-1.5 text-body-sm font-medium text-ink">
        <Icon name={icon} size={18} className={`mt-px shrink-0 ${tone}`} />
        {label}
      </dt>
      <dd className="m-0 flex flex-col items-start gap-1">
        {value !== null && band ? (
          <>
            <BandChip band={band} />
            <span className="text-body-sm tabular-nums text-ink-muted">
              <span>{value}</span>
              {unit ? <span> {unit}</span> : null}
            </span>
          </>
        ) : (
          <span className="text-body-sm text-ink-muted">Not available</span>
        )}
        <span className="text-body-sm text-ink-muted">{caption}</span>
      </dd>
    </div>
  );
}

/**
 * The three readings that describe this place, in one grouped row: usual yearly rain, the hottest usual month,
 * and soil acidity. Each is a banded word (Low, OK, High) with the number small, and says how wide an area it
 * describes. One local check follows.
 */
export function ConditionsSummary({ conditions, crop, cropName = "crops", effectivePh, remote, className = "" }: ConditionsSummaryProps) {
  const annual = conditions.annualRainMm;
  const tmax = conditions.monthlyTmaxC;
  const hasT = Array.isArray(tmax) && tmax.length === 12;
  const hottest = hasT ? tmax.indexOf(Math.max(...tmax)) : -1;
  const fieldTemperature = [...(remote?.ecostressMet?.data?.observations ?? [])]
    .reverse()
    .find((observation) => observation.airTemperatureC !== null && observation.validPixels > 0);
  const isRice = crop?.id === "rice" || crop?.names.common.toLowerCase().includes("rice");
  const hasPh = effectivePh !== null && effectivePh !== undefined;

  const localCheckQuestion = isRice
    ? "Does soil stay moist after rice harvest, and do you have canal or pump water if rain stops early?"
    : `Does soil stay moist after your previous crop, and is irrigation available if the dry season starts early for ${cropName}?`;

  return (
    <div role="region" aria-label="Key field conditions and local checks" className={cn("flex flex-col gap-4", className)}>
      <dl className="m-0 grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Metric
          icon="rain"
          tone="text-water"
          label="Yearly rain"
          band={annual !== undefined ? bandRain(annual) : null}
          value={annual !== undefined ? String(Math.round(annual)) : null}
          unit="mm"
          caption="Regional weather history, ~50 km"
        />
        <Metric
          icon="heat"
          tone="text-heat"
          label={fieldTemperature ? "Field air temperature" : "Regional hottest month"}
          band={fieldTemperature ? bandHeat(fieldTemperature.airTemperatureC!) : hasT ? bandHeat(tmax[hottest]) : null}
          value={fieldTemperature ? String(Math.round(fieldTemperature.airTemperatureC!)) : hasT ? String(Math.round(tmax[hottest])) : null}
          unit="°C"
          caption={fieldTemperature ? `ECOSTRESS snapshot ${fieldTemperature.date}, 70 m` : hasT ? `Air-temperature history, ~50 km area` : "Not read"}
        />
        <Metric
          icon="soil"
          tone="text-soil"
          label="Soil acidity"
          band={hasPh ? bandPh(effectivePh, crop?.soil.phOpt ?? null) : null}
          value={hasPh ? effectivePh.toFixed(1) : null}
          unit="pH"
          caption="SoilGrids map, 250 m · 0–30 cm"
        />
      </dl>

      <div className="flex items-start gap-2.5">
        <Icon name="check" size={18} className="mt-0.5 shrink-0 text-field" />
        <p className="m-0 max-w-measure text-body-sm text-ink">
          <span className="font-semibold">Check on your field: </span>
          {localCheckQuestion}
        </p>
      </div>
    </div>
  );
}
