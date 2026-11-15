import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ComparePage } from "./compare-page";

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return <Suspense fallback={<Skeleton className="h-10 w-64" />}><ComparePage params={params} /></Suspense>;
}
