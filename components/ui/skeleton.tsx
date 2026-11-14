import { cn } from "@/lib/cn";

/** A placeholder block at the size of the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none", className)} />;
}
