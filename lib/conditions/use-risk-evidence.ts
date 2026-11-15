"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { TrendSeries } from "@/lib/server/trends";
import type { Field } from "@/lib/types";
import { buildRiskEvidenceMap, type RiskEvidenceMap } from "@/lib/conditions/condition-evidence";

/** The four risk evidence summaries for a field, built from data the screen already loaded plus the yearly trends. */
export function useRiskEvidence(field: Field | undefined, conditions: ConditionsData | null | undefined, remote: RemoteData | null | undefined): RiskEvidenceMap | null {
  const [trends, setTrends] = useState<{ trends: TrendSeries[]; through: number } | null>(null);
  const id = field?.id;
  const lng = field?.centroid[0];
  const lat = field?.centroid[1];

  useEffect(() => {
    if (!id || lng === undefined || lat === undefined) return;
    const ctl = new AbortController();
    fetch(`/api/field/${id}/trends?lng=${lng}&lat=${lat}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) setTrends(d);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [id, lng, lat]);

  return useMemo(() => (field ? buildRiskEvidenceMap({ conditions, remote, trends, field }) : null), [field, conditions, remote, trends]);
}
