import { io } from "next/cache";
import { Suspense } from "react";
import { suggestPlanningWindow } from "@/lib/rotation/planning";
import RotationExplorer from "./rotation-explorer";

export default function PlanPage() {
  return (
    <Suspense fallback={<p role="status" className="p-6 text-body text-ink-muted">Preparing your planting period…</p>}>
      <CurrentPlan />
    </Suspense>
  );
}

async function CurrentPlan() {
  await io();
  return <RotationExplorer suggestedWindow={suggestPlanningWindow()} />;
}
