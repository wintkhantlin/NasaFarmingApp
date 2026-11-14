"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  name?: string;
}

/** A small set of exclusive choices, as native radios so the keyboard and screen readers work. */
export function Segmented<T extends string>({ legend, value, onChange, options, name }: SegmentedProps<T>) {
  const auto = useId();
  const group = name ?? auto;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-label text-ink">{legend}</legend>
      <div className="grid min-w-0 grid-flow-col auto-cols-fr rounded-md border border-line-strong bg-surface-raised p-0.5">
        {options.map((o) => {
          const id = `${group}-${o.value}`;
          return (
            <div key={o.value} className="relative min-w-0">
              <input
                id={id}
                type="radio"
                name={group}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="peer absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <label
                htmlFor={id}
                className={cn(
                  "flex min-h-[calc(var(--spacing-tap)-6px)] items-center justify-center rounded-sm px-2 text-center text-label text-ink",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-field",
                  value === o.value ? "bg-field text-on-field" : "hover:bg-surface-sunken",
                )}
              >
                {o.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
