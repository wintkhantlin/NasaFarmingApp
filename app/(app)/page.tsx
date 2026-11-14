import Link from "next/link";
import { FieldsList } from "@/components/field/fields-list";
import { buttonClass } from "@/components/ui/button";
import { copy } from "@/lib/copy/en";

export default function Home() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-ink">{copy.home.title}</h1>
          <p className="max-w-measure text-body text-ink-muted">{copy.app.tagline}</p>
        </div>
        <Link href="/fields/new" className={buttonClass("secondary")}>
          {copy.home.addField}
        </Link>
      </div>
      <FieldsList />
    </>
  );
}
