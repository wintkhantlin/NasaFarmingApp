import Link from "next/link";
import { Suspense } from "react";
import { RotationCompare } from "@/components/field/rotation-compare";
import { Skeleton } from "@/components/ui/skeleton";

export async function ComparePage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <>
    <p className="m-0 text-body-sm text-ink-muted">For a five-crop environmental screen, <Link href={`/plan/crop-screen?fieldId=${encodeURIComponent(fieldId)}`} className="text-field underline underline-offset-4">explore next crops for this field</Link>.</p>
    <RotationCompare fieldId={fieldId} />
  </>;
}

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return <Suspense fallback={<Skeleton className="h-10 w-64" />}><ComparePage params={params} /></Suspense>;
}
