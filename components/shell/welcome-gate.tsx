"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useSettingsStore } from "@/lib/store/settings-store";

/** The plain-language data explanation must be readable before the notice is accepted. */
const OPEN_BEFORE_CONSENT = ["/about/data", "/data"];

function isOpenRoute(pathname: string) {
  return OPEN_BEFORE_CONSENT.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * The redirect and cover live in their own component because reading the pathname must sit inside
 * <Suspense>; the page content stays outside it so server prerendering is not blocked.
 */
function ConsentCover() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { hydrated, dataNoticeAcceptedAt, hydrate } = useSettingsStore();
  const blocked = hydrated && !dataNoticeAcceptedAt && !isOpenRoute(pathname);
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);
  useEffect(() => {
    if (blocked) router.replace("/welcome");
  }, [blocked, router]);
  return blocked ? <div className="fixed inset-0 z-50 min-h-svh bg-surface" aria-busy="true" /> : null;
}

/** S01 is a full-screen cover: nothing else is reachable until the data notice is accepted. */
export function WelcomeGate({ children }: { children: React.ReactNode }) {
  // Keep children in the tree so server prerendering and Next.js instant-navigation
  // validation can traverse child segments (e.g. /fields/[fieldId]/layout.tsx).
  return (
    <>
      <Suspense fallback={null}>
        <ConsentCover />
      </Suspense>
      {children}
    </>
  );
}
