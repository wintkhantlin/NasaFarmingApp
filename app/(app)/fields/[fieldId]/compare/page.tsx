import { Suspense } from "react";
import { RotationCompare } from "@/components/field/rotation-compare";
import { Skeleton } from "@/components/ui/skeleton";

export async function ComparePage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <>
    <RotationCompare fieldId={fieldId} />
  </>;
}

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return <Suspense fallback={<Skeleton className="h-10 w-64" />}><ComparePage params={params} /></Suspense>;
}
