"use client";

import { RotationCompare } from "./rotation-compare";

export function ReportView({ fieldId, initialPlanning }: { fieldId: string; initialPlanning?: { startDate: string; endDate: string } }) {
  return <RotationCompare fieldId={fieldId} report initialPlanning={initialPlanning} />;
}
