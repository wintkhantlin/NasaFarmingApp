"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSettingsStore } from "@/lib/store/settings-store";

/** S01 is a full-screen cover: nothing else is reachable until the data notice is accepted. */
export function WelcomeGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrated, dataNoticeAcceptedAt, hydrate } = useSettingsStore();
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);
  useEffect(() => {
    if (hydrated && !dataNoticeAcceptedAt) router.replace("/welcome");
  }, [hydrated, dataNoticeAcceptedAt, router]);
  // Keep children in the tree so server prerendering and Next.js instant-navigation
  // validation can traverse child segments (e.g. /fields/[fieldId]/layout.tsx).
  return (
    <>
      {hydrated && !dataNoticeAcceptedAt ? (
        <div className="fixed inset-0 z-50 min-h-svh bg-surface" aria-busy="true" />
      ) : null}
      {children}
    </>
  );
}
