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
          border: "1px solid var(--color-line-strong, #8c8676)",
          borderRadius: "var(--radius-md, 10px)",
          backgroundColor: "var(--color-surface-raised, #fbfaf6)",
          padding: "2px",
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
          "& .MuiToggleButtonGroup-grouped": {
            border: 0,
            borderRadius: "6px !important",
            margin: "0 !important",
            minHeight: "var(--spacing-tap, 44px)",
            padding: { xs: "6px 4px", sm: "6px 12px" },
            fontSize: { xs: "0.8125rem", sm: "0.875rem" },
            lineHeight: 1.25,
            fontWeight: 500,
            textTransform: "none",
            color: "var(--color-ink, #1f1d17)",
            transition: "all 120ms ease",
            "&:active": {
              transform: "scale(0.98)",
            },
            "&.Mui-selected": {
              backgroundColor: "var(--color-field, #2e5e3a)",
              color: "var(--color-on-field, #fbfaf6)",
              "&:hover": {
                backgroundColor: "var(--color-field, #2e5e3a)",
                filter: "brightness(1.05)",
              },
            },
            "&:hover": {
              backgroundColor: "var(--color-surface-sunken, #e9e6da)",
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
