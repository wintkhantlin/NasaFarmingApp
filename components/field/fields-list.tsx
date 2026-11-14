"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass, Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PinGlyph } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy/en";
import { formatPoint } from "@/lib/geo/format";
import { useFieldsStore } from "@/lib/store/fields-store";

export function FieldsList() {
  const status = useFieldsStore((s) => s.status);
  const fields = useFieldsStore((s) => s.fields);
  const load = useFieldsStore((s) => s.load);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <EmptyState title={copy.home.loadError} body="Check that this browser allows site storage, then try again.">
        <Button variant="primary" onClick={() => void load()}>
          {copy.home.retry}
        </Button>
      </EmptyState>
    );
  }

  if (fields.length === 0) {
    return (
      <EmptyState title={copy.home.emptyTitle} body={copy.home.emptyBody}>
        <Link href="/fields/new" className={buttonClass("primary")}>
          {copy.home.addField}
        </Link>
      </EmptyState>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <li key={f.id}>
          <Link
            href={`/fields/${f.id}`}
            className="flex min-h-tap flex-col gap-2 rounded-md border border-line bg-surface-raised p-4 no-underline hover:bg-surface-sunken"
          >
            <span className="text-headline text-ink">{f.name}</span>
            <span className="flex items-center gap-1.5 text-body-sm text-ink-muted">
              <PinGlyph />
              <span className="tabular font-mono">{formatPoint(f.centroid)}</span>
            </span>
            <span className="flex flex-wrap gap-x-4 text-body-sm text-ink-muted">
              <span>{f.areaHa === null ? copy.home.pinOnly : copy.home.area(f.areaHa)}</span>
              <span>{copy.irrigation[f.irrigation]}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
