"use client";

import { useId } from "react";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
import { cn } from "@/lib/cn";

export interface SegmentedProps<T extends string> {
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  name?: string;
  className?: string;
}

/** A small set of exclusive choices, built with ToggleButtonGroup for keyboard & accessible navigation. */
export function Segmented<T extends string>({
  legend,
  value,
  onChange,
  options,
  name,
  className,
}: SegmentedProps<T>) {
  const auto = useId();
  const labelId = `${name ?? auto}-label`;

  return (
    <div className={cn("min-w-0 flex flex-col gap-1", className)}>
      <label id={labelId} className="text-label font-medium text-ink">
        {legend}
      </label>
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={(_, next) => {
          if (next !== null && next !== undefined) {
            onChange(next as T);
          }
        }}
        aria-labelledby={labelId}
        className="grid min-w-0 grid-flow-col auto-cols-fr rounded-md border border-line-strong bg-surface-raised p-0.5"
        sx={{
          border: "1px solid #8c8676",
          borderRadius: "10px",
          backgroundColor: "#fbfaf6",
          padding: "2px",
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
          "& .MuiToggleButtonGroup-grouped": {
            border: 0,
            borderRadius: "6px !important",
            margin: "0 !important",
            minHeight: "calc(var(--spacing-tap, 44px) - 6px)",
            padding: "6px 12px",
            fontSize: "0.875rem",
            fontWeight: 500,
            textTransform: "none",
            color: "#1f1d17",
            "&.Mui-selected": {
              backgroundColor: "#2e5e3a",
              color: "#fbfaf6",
              "&:hover": {
                backgroundColor: "#2e5e3a",
                filter: "brightness(1.05)",
              },
            },
            "&:hover": {
              backgroundColor: "#e9e6da",
            },
          },
        }}
      >
        {options.map((o) => (
          <ToggleButton key={o.value} value={o.value} aria-label={o.label}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
