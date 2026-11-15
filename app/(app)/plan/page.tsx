import { Suspense } from "react";
import { PlanEntry, type PlanSearchParams } from "./plan-entry";

export default function PlanPage({ searchParams }: { searchParams: PlanSearchParams }) {
  return <Suspense fallback={<p role="status">Opening Plan…</p>}><PlanEntry searchParams={searchParams} /></Suspense>;
}
