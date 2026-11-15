"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import { FirstRun } from "@/components/home/first-run";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ChevronRightGlyph } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAreaForLocale } from "@/lib/format-area";
import { staticMapUrl } from "@/lib/geo/static-map";
import { sequenceText, currentRotation } from "@/lib/rotation-format";
import { deriveStepStates, EMPTY_ROTATIONS, useFieldsStore } from "@/lib/store/fields-store";
import { useAppCopy, useLocaleStore } from "@/lib/store/locale-store";
import type { Field, Rotation } from "@/lib/types";

/** Show the search box only once the list is long enough to need it. */
const SEARCH_MIN_FIELDS = 6;

function FieldCard({ field, rotations }: { field: Field; rotations: Rotation[] }) {
  const t = useAppCopy();
  const locale = useLocaleStore((s) => s.locale);
  const areaUnit = useLocaleStore((s) => s.areaUnit);
  const states = deriveStepStates(field, rotations);
  const hasRotation = states.rotation === "done";
  const rotation = currentRotation(rotations);
  const next = hasRotation ? t.path.seeAnswer : t.path.addCrops;
  const nextHref = hasRotation ? `/fields/${field.id}/compare` : `/fields/${field.id}/rotation`;
  const water = field.constraints?.irrigation?.access;

  // One line: "2.4 ha · Rain only · Rice → Bean". Parts with no value are left out.
  const summary = [
    field.areaHa === null ? t.home.pinOnly : formatAreaForLocale(field.areaHa, areaUnit, locale),
    water ? t.irrigation[water] : "",
    hasRotation && rotation ? sequenceText(rotation, " → ") : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="min-w-0">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-md border border-line bg-surface-raised transition-colors hover:border-line-strong">
        {MAPBOX_TOKEN ? (
          <div className="relative aspect-[2/1] w-full bg-surface-sunken">
            <Image
              src={staticMapUrl(field.geometry, MAPBOX_TOKEN, 480, 240)}
              alt=""
              fill
              unoptimized
              loading="lazy"
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="min-w-0 text-headline text-ink">
            {/* The stretched link makes the whole card one tap target */}
            <Link
              href={`/fields/${field.id}`}
              className="truncate no-underline after:absolute after:inset-0 after:content-['']"
            >
              {field.name}
            </Link>
          </h3>
          <p className="m-0 text-body-sm text-ink-muted">{summary}</p>

          <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
            <Link
              href={nextHref}
              className="relative z-10 flex min-h-tap items-center justify-between gap-2 text-label text-field no-underline hover:underline"
            >
              <span>
                {t.home.nextStepLabel} {next}
              </span>
              <ChevronRightGlyph className="shrink-0" />
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}

export function FieldsList() {
  const t = useAppCopy();
  const status = useFieldsStore((s) => s.status);
  const fields = useFieldsStore((s) => s.fields);
  const rotations = useFieldsStore((s) => s.rotations);
  const load = useFieldsStore((s) => s.load);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={t.home.loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="hidden h-64 sm:block" />
        <Skeleton className="hidden h-64 lg:block" />
      </div>
    );
  }

  const settingsLink = (
    <Link href="/settings" className="inline-flex min-h-tap items-center self-start text-label text-ink-muted underline underline-offset-4 hover:text-ink">
      {t.home.settingsLink}
    </Link>
  );

  if (status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={t.home.loadError} body="Saved work could not be read from this phone. Try again.">
          <Button variant="primary" onClick={() => void load()}>{t.home.retry}</Button>
        </EmptyState>
        {settingsLink}
      </div>
    );
  }

  if (fields.length === 0) return <FirstRun />;

  const needle = query.trim().toLowerCase();
  const matches = (f: Field) => !needle || f.name.toLowerCase().includes(needle);
  const live = fields.filter((f) => !f.archivedAt && matches(f));
  const archived = fields.filter((f) => f.archivedAt && matches(f));
  const showSearch = fields.length >= SEARCH_MIN_FIELDS;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title text-ink sm:text-display">{t.home.title}</h1>
        <Link href="/fields/new" className={buttonClass("primary", "max-sm:w-full")}>
          <Icon name="add" />
          {t.home.addField}
        </Link>
      </header>

      {showSearch ? (
        <TextField
          type="search"
          label={t.home.searchFields}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          size="small"
          fullWidth
          slotProps={{ htmlInput: { "aria-label": t.home.searchFields } }}
        />
      ) : null}

      {live.length === 0 ? (
        <p className="m-0 text-body text-ink-muted">{needle ? `No fields named “${query.trim()}”.` : "All your fields are archived."}</p>
      ) : null}
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((f) => (
          <FieldCard key={f.id} field={f} rotations={rotations[f.id] ?? EMPTY_ROTATIONS} />
        ))}
      </ul>

      {archived.length > 0 ? (
        <details className="border-t border-line pt-2">
          <summary className="flex min-h-tap cursor-pointer items-center text-label text-field">
            Show {archived.length} archived {archived.length === 1 ? "field" : "fields"}
          </summary>
          <ul className="m-0 mt-2 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((f) => (
              <FieldCard key={f.id} field={f} rotations={rotations[f.id] ?? EMPTY_ROTATIONS} />
            ))}
          </ul>
        </details>
      ) : null}

      {settingsLink}
    </div>
  );
}
