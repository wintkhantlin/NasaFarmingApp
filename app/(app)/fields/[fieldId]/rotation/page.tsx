import { Suspense } from "react";
import { RotationEditor } from "@/components/field/rotation-editor";
import { Skeleton } from "@/components/ui/skeleton";

async function RotationPage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <RotationEditor fieldId={fieldId} />;
}

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-64" />}>
      <RotationPage params={params} />
    </Suspense>
  );
}
