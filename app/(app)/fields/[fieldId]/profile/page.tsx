import { Suspense } from "react";
import { FarmProfile } from "@/components/field/farm-profile";
import { Skeleton } from "@/components/ui/skeleton";

async function ProfilePage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <FarmProfile fieldId={fieldId} />;
}

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-64" />}>
      <ProfilePage params={params} />
    </Suspense>
  );
}
