import type { Metadata } from "next";
import { Suspense } from "react";
import { EditLocation } from "@/components/field/edit-location";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Edit field" };

async function Body({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <EditLocation fieldId={fieldId} />;
}

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
      <Body params={params} />
    </Suspense>
  );
}
