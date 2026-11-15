import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";
export type ButtonSize = "md" | "lg";

const BASE =
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-md border px-4 text-label no-underline transition-[background-color,border-color,box-shadow,transform,filter] duration-150 ease-out " +
  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const SIZES: Record<ButtonSize, string> = {
  md: "min-h-tap",
  /** The sticky-zone primary: 50px, easy to hit with a thumb. */
  lg: "min-h-[50px] text-headline",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-field bg-field text-on-field shadow-xs hover:brightness-105 hover:shadow-sm active:brightness-95",
  secondary: "border-line-strong bg-surface-raised text-ink hover:border-ink/30 hover:bg-surface-sunken active:bg-surface-sunken",
  quiet: "border-transparent bg-transparent text-field hover:bg-field-soft/70 active:bg-field-soft",
  destructive: "border-transparent bg-transparent text-heat hover:bg-heat-soft/80 active:bg-heat-soft",
};

/** Class names for a link that should look like a button: `<Link className={buttonClass("primary")}>`. */
export function buttonClass(variant: ButtonVariant = "secondary", extra?: string, size: ButtonSize = "md") {
  return cn(BASE, SIZES[size], VARIANTS[variant], extra);
}

/** Icon plus label, in the order every button uses: leading icon, label, trailing icon. */
export function ButtonContent({ icon, iconEnd, children }: { icon?: IconName; iconEnd?: IconName; children?: ReactNode }) {
  return (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} /> : null}
    </>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: at most once per view, for what the screen is for. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Leading icon (an action noun: add, download, print). */
  icon?: IconName;
  /** Trailing icon (direction: `next` on a forward action). */
  iconEnd?: IconName;
}

/**
 * A plain button on the same classes as `buttonClass`. It is not an MUI
 * ButtonBase: MUI's reset (border 0, transparent background, no padding) is
 * unlayered CSS, so it would beat these layered Tailwind utilities.
 */
export function Button({
  variant = "secondary",
  size = "md",
  block,
  icon,
  iconEnd,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, cn(block && "w-full", className), size)} {...rest}>
      <ButtonContent icon={icon} iconEnd={iconEnd}>
        {children}
      </ButtonContent>
    </button>
  );
}
