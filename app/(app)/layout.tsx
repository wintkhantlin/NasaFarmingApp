import Link from "next/link";
import { copy } from "@/lib/copy/en";

/** The normal app chrome: a header, a centred column, and a footer. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-surface-raised">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="min-h-tap content-center text-headline text-ink no-underline">
            {copy.app.name}
          </Link>
          <Link href="/about/data" className="min-h-tap content-center text-label text-field">
            About the data
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t border-line">
        <p className="mx-auto w-full max-w-5xl px-4 py-4 text-body-sm text-ink-muted">{copy.home.storedLocally}</p>
      </footer>
    </>
  );
}
