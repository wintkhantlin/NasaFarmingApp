import Link from "next/link";
import { FieldsList } from "@/components/field/fields-list";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { copy } from "@/lib/copy/en";

export default function Home() {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-ink sm:text-display">Choose how to start</h1>
        <p className="max-w-measure text-body text-ink-muted">Save a field to analyse its rotations with location, soil and environmental data.</p>
      </header>

      <section aria-label="Main journeys" className="grid border-y border-line sm:grid-cols-2 sm:divide-x sm:divide-line">
        <div className="flex flex-col items-start gap-3 py-5 sm:pr-6">
          <div className="flex items-center gap-2"><Icon name="fields" className="text-field" /><h2 className="text-headline text-ink">My fields</h2></div>
          <p className="m-0 max-w-measure text-body-sm text-ink-muted">Manage saved fields and analyse rotations with field location, practices, soil information and environmental data.</p>
          <Link href="/fields/new" className={buttonClass("primary", "mt-auto max-sm:w-full")}>
            <Icon name="add" />
            Add a field
          </Link>
        </div>
      </section>

      <div className="flex flex-col gap-1">
        <h2 className="text-title text-ink">{copy.home.title}</h2>
        <p className="m-0 text-body-sm text-ink-muted">Open a saved field to continue its analysis.</p>
      </div>
      <FieldsList />
    </>
  );
}
