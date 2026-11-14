import { Suspense } from "react";
import { ConditionsView } from "@/components/field/conditions-view";
import { Skeleton } from "@/components/ui/skeleton";

async function ConditionsPage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <ConditionsView fieldId={fieldId} />;
}

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-64" />}>
      <ConditionsPage params={params} />
    </Suspense>
  );
}
