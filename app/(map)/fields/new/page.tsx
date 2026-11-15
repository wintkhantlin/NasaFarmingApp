import type { Metadata } from "next";
import { LocationPicker } from "@/components/field/location-picker";

export const metadata: Metadata = { title: "Add a field" };

export default async function NewFieldPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return <LocationPicker fromPlan={from === "plan"} />;
}
