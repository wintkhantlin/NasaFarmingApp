import { redirect } from "next/navigation";
import { Suspense } from "react";
import RotationExplorer from "./rotation-explorer";

type PlanSearchParams = Promise<{ fieldId?: string | string[] }>;

export async function PlanEntry({ searchParams }: { searchParams: PlanSearchParams }) {
  const fieldId = (await searchParams).fieldId;
  if (typeof fieldId === "string" && fieldId) redirect(`/plan/crop-screen?fieldId=${encodeURIComponent(fieldId)}`);
  return <RotationExplorer />;
}

export default function PlanPage({ searchParams }: { searchParams: PlanSearchParams }) {
  return <Suspense fallback={<p role="status">Opening Plan…</p>}><PlanEntry searchParams={searchParams} /></Suspense>;
}
