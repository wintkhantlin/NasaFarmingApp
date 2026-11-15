import type { Metadata } from "next";
import { Suspense } from "react";
import { LocationPicker } from "@/components/field/location-picker";

export const metadata: Metadata = { title: "Add a field" };

export default function NewFieldPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  return (
    <Suspense fallback={<p role="status" className="p-6 text-body text-ink-muted">Preparing the field map…</p>}>
      <NewFieldContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewFieldContent({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return <LocationPicker fromPlan={from === "plan"} />;
}
