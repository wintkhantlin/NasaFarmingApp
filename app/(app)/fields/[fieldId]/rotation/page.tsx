import { Suspense } from "react";
import { RotationEditor } from "@/components/field/rotation-editor";
import { Skeleton } from "@/components/ui/skeleton";

interface PageProps {
  params: Promise<{ fieldId: string }>;
  searchParams?: Promise<{ mode?: string }>;
}

async function RotationPage({ params, searchParams }: PageProps) {
  const { fieldId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialMode = sp?.mode === "record" || sp?.mode === "advanced" ? "advanced" : "guided";
  return <RotationEditor fieldId={fieldId} initialMode={initialMode} />;
}

export default function Page({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-64" />}>
      <RotationPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}
