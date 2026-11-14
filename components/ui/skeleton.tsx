import Skeleton from "@mui/material/Skeleton";
import { cn } from "@/lib/cn";

export function SkeletonLoader({ className }: { className?: string }) {
  return (
    <Skeleton
      variant="rounded"
      className={cn("bg-surface-sunken", className)}
      sx={{
        backgroundColor: "var(--color-surface-sunken, #e9e6da)",
        transform: "none",
      }}
    />
  );
}

export { SkeletonLoader as Skeleton };
