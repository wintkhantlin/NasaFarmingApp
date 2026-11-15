"use client";

import type { ChangeEvent, InputHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  wrapperClassName?: string;
}

/**
 * Shared accessible search input with clear button and standard touch targets (min 44px).
 * Follows DESIGN_SYSTEM.md 4px spacing scale and flat token styling.
 */
export function SearchInput({
  value,
  onChange,
  onClear,
  clearLabel = "Clear search",
  placeholder = "Search…",
  className,
  wrapperClassName,
  disabled,
  ...rest
}: SearchInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  return (
    <div
      className={cn(
        "flex min-h-tap w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-1 text-ink transition-colors focus-within:border-field focus-within:ring-2 focus-within:ring-field/30",
        disabled && "cursor-not-allowed opacity-60 bg-surface-sunken",
        wrapperClassName,
      )}
    >
      <Icon name="search" size={20} className="shrink-0 text-ink-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        className={cn(
          "min-h-tap w-full border-0 bg-transparent text-body text-ink placeholder:text-ink-muted focus:outline-hidden",
          className,
        )}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          aria-label={clearLabel}
          className="flex min-h-tap min-w-8 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-field/40"
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}
