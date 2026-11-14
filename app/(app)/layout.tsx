import Link from "next/link";
import { Suspense } from "react";
import { WelcomeGate } from "@/components/shell/welcome-gate";
import { HeaderNav, SettingsButton, TabBar } from "@/components/shell/app-nav";
import { BrandMark } from "@/components/shell/brand-mark";
import { copy } from "@/lib/copy/en";

/** The app chrome: a sticky header, one centred column, and a footer that says where data lives. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WelcomeGate>
    <div className="flex min-h-svh flex-col bg-surface">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-field px-4 py-3 text-label text-on-field focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 bg-surface-raised pt-[env(safe-area-inset-top)] shadow-xs print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:h-16 sm:px-6">
          <Link
            href="/"
            aria-label={copy.app.name}
            className="flex min-h-tap min-w-0 items-center gap-2.5 text-headline text-ink no-underline"
          >
            <BrandMark />
            <span className="hidden truncate sm:inline">{copy.app.name}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Suspense fallback={<span className="h-tap w-28" />}>
              <HeaderNav />
            </Suspense>
            <SettingsButton />
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-[calc(var(--tabbar-h)+1.5rem)] pt-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:pt-8 print:max-w-none print:p-0"
      >
        {children}
      </main>

      <Suspense fallback={null}>
        <TabBar />
      </Suspense>
    </div>
    </WelcomeGate>
  );
}
