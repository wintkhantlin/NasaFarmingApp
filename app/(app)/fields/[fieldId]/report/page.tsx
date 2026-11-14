import { Suspense } from "react";
import { ReportView } from "@/components/field/report-view";
import { Skeleton } from "@/components/ui/skeleton";

async function ReportPage({ params, searchParams }: { params: Promise<{ fieldId: string }>; searchParams: Promise<{ start?: string; end?: string }> }) {
  const { fieldId } = await params;
  const { start, end } = await searchParams;
  const valid = typeof start === "string" && typeof end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);
  return <ReportView fieldId={fieldId} initialPlanning={valid ? { startDate: start, endDate: end } : undefined} />;
}

export default function Page({ params, searchParams }: { params: Promise<{ fieldId: string }>; searchParams: Promise<{ start?: string; end?: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-64" />}>
      <ReportPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}
