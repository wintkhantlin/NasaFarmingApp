import type { ButtonHTMLAttributes } from "react";
import ButtonBase from "@mui/material/ButtonBase";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "quiet";

const BASE =
  "inline-flex min-h-tap items-center justify-center gap-2 rounded-md border px-4 text-label font-medium no-underline transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-field bg-field text-on-field hover:brightness-110 active:brightness-95",
  secondary: "border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken active:bg-surface-sunken",
  quiet: "border-transparent bg-transparent text-field hover:bg-field-soft active:bg-field-soft",
};

/** Class names for a link that should look like a button: `<Link className={buttonClass("primary")}>`. */
export function buttonClass(variant: ButtonVariant = "secondary", extra?: string) {
  return cn(BASE, VARIANTS[variant], extra);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: at most once per view, for what the screen is for. */
  variant?: ButtonVariant;
  block?: boolean;
}

export function Button({ variant = "secondary", block, className, type = "button", disabled, ...rest }: ButtonProps) {
  return (
    <ButtonBase
      component="button"
      type={type}
      disabled={disabled}
      className={buttonClass(variant, cn(block && "w-full", className))}
      {...rest}
    />
  );
}
