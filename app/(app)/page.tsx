import Link from "next/link";
import { FieldsList } from "@/components/field/fields-list";
import { buttonClass } from "@/components/ui/button";
import { PlusGlyph } from "@/components/ui/icons";
import { copy } from "@/lib/copy/en";

export default function Home() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title text-ink sm:text-display">{copy.home.title}</h1>
          <p className="max-w-measure text-body text-ink-muted">{copy.app.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-2 max-sm:w-full">
          <Link href="/plan" className={buttonClass("secondary", "max-sm:w-full")}>
            Explore crop rotations
          </Link>
          <Link href="/fields/new" className={buttonClass("secondary", "max-sm:w-full")}>
            <PlusGlyph />
            {copy.home.addField}
          </Link>
        </div>
      </div>
      <FieldsList />
    </>
  );
}
