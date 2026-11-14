import { Suspense } from "react";
import { FieldOverview } from "@/components/field/field-overview";
import { Skeleton } from "@/components/ui/skeleton";

// With Cache Components, reading `params` happens at request time, so it sits
// inside a Suspense boundary and the static shell renders around it.
async function FieldPage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <FieldOverview fieldId={fieldId} />;
}

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-64" />}>
      <FieldPage params={params} />
    </Suspense>
  );
}
