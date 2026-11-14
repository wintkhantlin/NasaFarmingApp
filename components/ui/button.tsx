"use client";

import ButtonBase, { type ButtonBaseProps } from "@mui/material/ButtonBase";
import MuiButton, { type ButtonProps as MuiButtonProps } from "@mui/material/Button";
import MuiIconButton, { type IconButtonProps as MuiIconButtonProps } from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

/**
 * Every button in the app is an MUI ButtonBase, so every one gets MUI's default touch ripple, focus
 * handling and keyboard behaviour. Colours come from the Field Shift tokens in globals.css.
 * MUI's styles live in the `mui` cascade layer (see providers.tsx), so Tailwind utilities passed as
 * `className` (width, flex, alignment) still apply.
 */

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive" | "link" | "choice";
export type ButtonSize = "md" | "lg";

const TAP = 44;

const VARIANT_SX: Record<ButtonVariant, SxProps<Theme>> = {
  primary: {
    color: "var(--color-on-field)",
    backgroundColor: "var(--color-field)",
    border: "1px solid var(--color-field)",
    "&:hover": { backgroundColor: "var(--color-field)", filter: "brightness(1.1)" },
  },
  secondary: {
    color: "var(--color-ink)",
    backgroundColor: "var(--color-surface-raised)",
    border: "1px solid var(--color-line-strong)",
    "&:hover": { backgroundColor: "var(--color-surface-sunken)" },
  },
  quiet: {
    color: "var(--color-field)",
    backgroundColor: "transparent",
    border: "1px solid transparent",
    "&:hover": { backgroundColor: "var(--color-field-soft)" },
  },
  destructive: {
    color: "var(--color-heat)",
    backgroundColor: "transparent",
    border: "1px solid transparent",
    "&:hover": { backgroundColor: "var(--color-heat-soft)" },
  },
  link: {
    color: "var(--color-field)",
    backgroundColor: "transparent",
    border: "1px solid transparent",
    textDecoration: "underline",
    paddingInline: "0.5rem",
    "&:hover": { backgroundColor: "var(--color-field-soft)", textDecoration: "underline" },
  },
  choice: {
    color: "var(--color-ink)",
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-line-strong)",
    "&:hover": { backgroundColor: "var(--color-surface-sunken)" },
    "&[aria-pressed='true'], &[aria-checked='true'], &.Mui-selected": {
      borderColor: "var(--color-field)",
      backgroundColor: "var(--color-field-soft)",
    },
  },
};

export interface ButtonProps extends Omit<MuiButtonProps, "variant" | "size" | "color" | "startIcon" | "endIcon" | "fullWidth"> {
  /** primary: at most once per view, for what the screen is for. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width of its container. */
  block?: boolean;
  /** Leading icon (an action noun: add, download, print). */
  icon?: IconName;
  /** Trailing icon (direction: `next` on a forward action). */
  iconEnd?: IconName;
  /** Marks a `choice` button as the chosen one. */
  selected?: boolean;
}

/** An MUI Button in the Field Shift look. With `href` it is a link that looks and ripples like a button. */
export function Button({
  variant = "secondary",
  size = "md",
  block,
  icon,
  iconEnd,
  selected,
  className,
  type,
  sx,
  children,
  ...rest
}: ButtonProps) {
  return (
    <MuiButton
      disableElevation
      type={rest.href ? undefined : (type ?? "button")}
      startIcon={icon ? <Icon name={icon} /> : undefined}
      endIcon={iconEnd ? <Icon name={iconEnd} /> : undefined}
      className={cn("text-label", size === "lg" && "text-headline", selected && "Mui-selected", className)}
      fullWidth={block}
      sx={[
        {
          minHeight: size === "lg" ? 50 : TAP,
          minWidth: TAP,
          paddingInline: "1rem",
          borderRadius: "var(--radius-md, 10px)",
          textTransform: "none",
          fontFamily: "inherit",
          fontWeight: 500,
          lineHeight: 1.25,
          boxShadow: "none",
          gap: "0.5rem",
          "&.Mui-disabled": { opacity: 0.5, color: "inherit", pointerEvents: "none" },
          "& .MuiButton-startIcon, & .MuiButton-endIcon": { margin: 0 },
        },
        VARIANT_SX[variant] as SxProps<Theme>,
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {children}
    </MuiButton>
  );
}

/** A button that navigates. Same look and ripple as `Button`; `href` is required. */
export function LinkButton(props: ButtonProps & { href: string }) {
  return <Button {...props} />;
}

export interface IconButtonProps extends Omit<MuiIconButtonProps, "color" | "size"> {
  icon: IconName;
  /** Required: an icon-only control is always named. */
  label: string;
  tone?: "muted" | "field";
  iconSize?: number;
  /** Makes it a link (rendered through Next's Link) that looks and ripples like the button. */
  href?: string;
}

/** A 44px icon-only MUI IconButton. Always labelled. */
export function IconButton({ icon, label, tone = "muted", iconSize = 20, sx, ...rest }: IconButtonProps) {
  return (
    <MuiIconButton
      aria-label={label}
      title={label}
      sx={[
        {
          width: TAP,
          height: TAP,
          flexShrink: 0,
          borderRadius: "var(--radius-md, 10px)",
          color: tone === "field" ? "var(--color-field)" : "var(--color-ink-muted)",
          "&:hover": { backgroundColor: tone === "field" ? "var(--color-field-soft)" : "var(--color-surface-sunken)" },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </MuiIconButton>
  );
}

/**
 * A free-form pressable surface (an option card, a list row, a search result) with MUI's ripple and
 * none of its look: layout and colour come from `className`. Use `Button` for anything that is a button.
 */
export function Pressable({ className, children, ...rest }: ButtonBaseProps) {
  return (
    <ButtonBase className={cn("text-left", className)} {...rest}>
      {children}
    </ButtonBase>
  );
}

/**
 * Buttons that sit side by side. Every item in the row has the same width and the same height,
 * whatever its label. On a phone the row stacks and each item is full width.
 *
 * - `inline` (default): as wide as the widest item, left aligned.
 * - `fill`: fills the container in equal shares.
 * - `wrap`: equal cells that wrap onto more lines; use for four or more items.
 */
export function ButtonRow({
  layout = "inline",
  min = "9rem",
  className,
  children,
  role,
  ...rest
}: {
  layout?: "inline" | "fill" | "wrap";
  /** Smallest cell width for `wrap`. */
  min?: string;
  className?: string;
  children: ReactNode;
  role?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        "grid items-stretch gap-2 [&>*]:h-full [&>*]:min-w-0 [&>*]:w-full",
        layout === "inline" && "w-fit max-w-full auto-cols-fr grid-flow-col max-sm:w-full max-sm:grid-flow-row max-sm:auto-cols-auto",
        layout === "fill" && "w-full auto-cols-fr grid-flow-col max-sm:grid-flow-row max-sm:auto-cols-auto",
        layout === "wrap" && "w-full",
        className,
      )}
      style={layout === "wrap" ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}), 1fr))` } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}
