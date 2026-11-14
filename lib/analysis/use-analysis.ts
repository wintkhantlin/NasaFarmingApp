"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EngineData } from "../engine/data";
import {
  getCachedConditions,
  getCachedRemote,
  isStale,
  setCachedConditions,
  setCachedRemote,
  type ConditionsData,
  type RemoteData,
} from "../store/data-cache";
import type { Field } from "../types";
import { buildEngineData } from "./engine-data";

export type AnalysisPhase = "loading" | "ready" | "failed";

export interface FieldAnalysis {
  phase: AnalysisPhase;
  conditions: ConditionsData | null;
  remote: RemoteData | null;
  engineData: EngineData | null;
  /** The saved copy is shown because the refresh failed. */
  showingCache: boolean;
  /** IMERG or AppEEARS are still being retrieved. */
  retrieving: boolean;
  retry: () => void;
}

const MAX_POLLS = 100;

/**
 * Adaptive polling delay: starts snappy at 3s, backoffs to 5s, 8s, 12s, capped at 15s.
 * Reduces server load while maintaining fast responsiveness when jobs finish.
 */
function adaptivePollInterval(n: number): number {
  if (n <= 1) return 3_000;
  if (n <= 3) return 5_000;
  if (n <= 6) return 8_000;
  if (n <= 10) return 12_000;
  return 15_000;
}

/**
 * Loads and caches everything the analysis needs for one field: conditions (POWER, IMERG progress,
 * SoilGrids) and the AppEEARS jobs. Shared by Conditions, Compare and Report so they agree.
 */
export function useFieldAnalysis(field: Field | undefined): FieldAnalysis {
  const [conditions, setConditions] = useState<ConditionsData | null>(null);
  const [remote, setRemote] = useState<RemoteData | null>(null);
  const [phase, setPhase] = useState<AnalysisPhase>("loading");
  const [showingCache, setShowingCache] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const conditionsRef = useRef<ConditionsData | null>(null);
  useEffect(() => {
    conditionsRef.current = conditions;
  }, [conditions]);

  const remoteRef = useRef<RemoteData | null>(null);
  useEffect(() => {
    remoteRef.current = remote;
  }, [remote]);

  const id = field?.id;
  const lng = field?.centroid[0];
  const lat = field?.centroid[1];
  const geometryKey = field ? JSON.stringify(field.geometry) : "";

  const activeConditionsAbort = useRef<AbortController | null>(null);
  const activeRemoteAbort = useRef<AbortController | null>(null);

  // conditions: cache first, refresh when old, keep asking with adaptive polling while IMERG is being retrieved
  useEffect(() => {
    if (!id || lng === undefined || lat === undefined) return;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pollCount = 0;
    let isFetching = false;

    const controller = new AbortController();
    activeConditionsAbort.current = controller;

    async function load(isBackgroundPoll = false) {
      if (isFetching || !mounted) return;
      isFetching = true;

      const cached = await getCachedConditions(id!);
      if (cached && mounted && !conditionsRef.current) {
        setConditions(cached);
        conditionsRef.current = cached;
        setPhase("ready");
      }

      const fresh = cached && !isStale(cached.fetchedAt, 6) && cached.imerg?.status !== "pending";
      if (fresh && !isBackgroundPoll) {
        isFetching = false;
        return;
      }

      try {
        const res = await fetch(`/api/field/${id}/conditions?lng=${lng}&lat=${lat}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Conditions answered ${res.status}`);
        const json = (await res.json()) as ConditionsData;
        if (!mounted) return;
        if (!json.climateAvailable && !json.soilAvailable) throw new Error("No source answered");

        setConditions(json);
        setShowingCache(false);
        setPhase("ready");
        void setCachedConditions(id!, json);

        // Schedule next poll if still pending
        if (json.imerg?.status === "pending" && pollCount++ < MAX_POLLS) {
          const delay = adaptivePollInterval(pollCount);
          timer = setTimeout(() => void load(true), delay);
        }
      } catch {
        if (!mounted || controller.signal.aborted) return;
        if (cached) {
          // Keep showing cached data smoothly without flashing error
          setShowingCache(true);
          setPhase("ready");
        } else {
          setPhase("failed");
        }
      } finally {
        isFetching = false;
      }
    }

    // Visibility-aware polling: pause when tab hidden, resume immediately on focus
    function handleVisibility() {
      if (document.visibilityState === "visible" && mounted && conditionsRef.current?.imerg?.status === "pending") {
        if (timer) clearTimeout(timer);
        void load(true);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    void load(false);

    return () => {
      mounted = false;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [id, lng, lat, attempt]);

  // AppEEARS: submit, then poll with adaptive backoff while any job is pending
  useEffect(() => {
    if (!id || !field) return;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pollCount = 0;
    let isFetching = false;

    const controller = new AbortController();
    activeRemoteAbort.current = controller;
    const body = JSON.stringify({ geometry: field.geometry, centroid: field.centroid });

    async function tick() {
      if (isFetching || !mounted) return;
      isFetching = true;
      try {
        const res = await fetch(`/api/field/${id}/remote-sensing`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as RemoteData;
        if (!mounted) return;

        setRemote(json);
        void setCachedRemote(id!, json);

        const pending = [json.smap, json.hls, json.srtm].some((s) => s.status === "pending");
        if (pending && pollCount++ < MAX_POLLS) {
          const delay = adaptivePollInterval(pollCount);
          timer = setTimeout(() => void tick(), delay);
        }
      } catch {
        // offline or network hiccup: keep the saved copy
      } finally {
        isFetching = false;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible" && mounted) {
        const pending = [remoteRef.current?.smap, remoteRef.current?.hls, remoteRef.current?.srtm].some((s) => s?.status === "pending");
        if (pending) {
          if (timer) clearTimeout(timer);
          void tick();
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    void getCachedRemote(id).then((c) => {
      if (c && mounted) setRemote(c);
    });
    void tick();

    return () => {
      mounted = false;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // the geometry key stands in for the field object so the effect reruns only when the shape changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, geometryKey, attempt]);

  const engineData = useMemo(() => (field ? buildEngineData(field, conditions, remote) : null), [field, conditions, remote]);
  const retrieving =
    conditions?.imerg?.status === "pending" || [remote?.smap, remote?.hls, remote?.srtm].some((s) => s?.status === "pending");

  return {
    phase,
    conditions,
    remote,
    engineData,
    showingCache,
    retrieving,
    retry: () => {
      setPhase("loading");
      setAttempt((a) => a + 1);
    },
  };
}
