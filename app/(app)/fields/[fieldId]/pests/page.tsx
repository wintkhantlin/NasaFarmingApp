import { Suspense } from "react";
import { PestsView } from "@/components/field/pests-view";
import { Skeleton } from "@/components/ui/skeleton";

async function PestsPage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <PestsView fieldId={fieldId} />;
}

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-64" />}>
      <PestsPage params={params} />
    </Suspense>
  );
}
