import { redirect } from "next/navigation";
import RotationExplorer from "./rotation-explorer";

export type PlanSearchParams = Promise<{ fieldId?: string | string[] }>;

export async function PlanEntry({ searchParams }: { searchParams: PlanSearchParams }) {
  const fieldId = (await searchParams).fieldId;
  if (typeof fieldId === "string" && fieldId) redirect(`/plan/crop-screen?fieldId=${encodeURIComponent(fieldId)}`);
  return <RotationExplorer />;
}
