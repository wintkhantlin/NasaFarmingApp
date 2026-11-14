"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { FirstRun } from "@/components/home/first-run";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph, PinGlyph } from "@/components/ui/icons";
import { RiskChip } from "@/components/ui/risk-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { formatPoint } from "@/lib/geo/format";
import { staticMapUrl } from "@/lib/geo/static-map";
import { sequenceText } from "@/lib/rotation-format";
import { deriveStepStates, EMPTY_ROTATIONS, useFieldsStore } from "@/lib/store/fields-store";
import type { Field, Rotation } from "@/lib/types";

function FieldCard({ field, rotations }: { field: Field; rotations: Rotation[] }) {
  const states = deriveStepStates(field, rotations);
  const hasRotation = states.rotation === "done";
  const stepsDone = Object.values(states).filter((s) => s === "done").length;
  const next = hasRotation ? "Compare rotation options" : "Record what you grow now";
  const nextHref = hasRotation ? `/fields/${field.id}/compare` : `/fields/${field.id}/rotation`;

  return (
    <li className="min-w-0">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-md border border-line bg-surface-raised transition-colors hover:border-line-strong">
        <div className="relative aspect-[2/1] w-full bg-surface-sunken">
          {MAPBOX_TOKEN ? (
            <Image
              src={staticMapUrl(field.geometry, MAPBOX_TOKEN, 480, 240)}
              alt=""
              fill
              unoptimized
              loading="lazy"
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-ink-muted">
              <PinGlyph width={28} height={28} />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-headline text-ink">
              {/* The stretched link makes the whole card one tap target */}
              <Link
                href={`/fields/${field.id}`}
                className="truncate no-underline after:absolute after:inset-0 after:content-['']"
              >
                {field.name}
              </Link>
            </h3>
            <RiskChip hazard={hasRotation ? "healthy" : "drought"} className="shrink-0">
              {hasRotation ? "Rotation recorded" : "Needs rotation"}
            </RiskChip>
          </div>

          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-ink-muted">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Location</dt>
              <dd className="tabular flex items-center gap-1.5 font-mono">
                <PinGlyph className="shrink-0 text-field" />
                {formatPoint(field.centroid)}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Area</dt>
              <dd>{field.areaHa === null ? copy.home.pinOnly : copy.home.area(field.areaHa)}</dd>
            </div>
            <div>
              <dt className="sr-only">Water</dt>
              <dd>{copy.irrigation[field.irrigation]}</dd>
            </div>
          </dl>

          {hasRotation && rotations[0] ? (
            <p className="text-body-sm text-ink">{sequenceText(rotations[0], " → ")}</p>
          ) : null}

          <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
            <div
              role="img"
              aria-label={`${stepsDone} of 4 steps done`}
              className="grid grid-cols-4 gap-1"
            >
              {Object.values(states).map((s, i) => (
                <span key={i} className={cn("h-1 rounded-pill", s === "done" ? "bg-field" : "bg-line")} />
              ))}
            </div>
            <Link
              href={nextHref}
              className="relative z-10 flex min-h-tap items-center justify-between gap-2 text-label text-field no-underline hover:underline"
            >
              <span>
                {copy.home.nextStepLabel} {next}
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
  const status = useFieldsStore((s) => s.status);
  const fields = useFieldsStore((s) => s.fields);
  const rotations = useFieldsStore((s) => s.rotations);
  const load = useFieldsStore((s) => s.load);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="hidden h-64 sm:block" />
        <Skeleton className="hidden h-64 lg:block" />
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

  if (fields.length === 0) return <FirstRun />;

  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <FieldCard key={f.id} field={f} rotations={rotations[f.id] ?? EMPTY_ROTATIONS} />
      ))}
    </ul>
  );
}
