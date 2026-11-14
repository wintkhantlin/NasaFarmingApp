import { Suspense } from "react";
import { ReportView } from "@/components/field/report-view";
import { Skeleton } from "@/components/ui/skeleton";

async function ReportPage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <ReportView fieldId={fieldId} />;
}

export default function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-64" />}>
      <ReportPage params={params} />
    </Suspense>
  );
}
