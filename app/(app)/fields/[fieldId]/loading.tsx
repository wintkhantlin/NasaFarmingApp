import { Skeleton } from "@/components/ui/skeleton";

export default function FieldRouteLoading() {
  return (
    <div role="status" aria-label="Opening field page" className="flex flex-col gap-5">
      <span className="sr-only">Opening field page…</span>
      <Skeleton className="h-14 w-full" />
      <div className="flex flex-col gap-3 border-b border-line pb-5">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </div>
  );
}
