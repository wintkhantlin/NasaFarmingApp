"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { FirstRun } from "@/components/home/first-run";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph, DownloadGlyph, PinGlyph } from "@/components/ui/icons";
import { RiskChip } from "@/components/ui/risk-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { downloadJson } from "@/lib/download";
import { formatPoint } from "@/lib/geo/format";
import { staticMapUrl } from "@/lib/geo/static-map";
import { sequenceText } from "@/lib/rotation-format";
import { deriveStepStates, EMPTY_ROTATIONS, useFieldsStore } from "@/lib/store/fields-store";
import type { Field, Rotation } from "@/lib/types";

function FieldCard({ field, rotations }: { field: Field; rotations: Rotation[] }) {
  const states = deriveStepStates(field, rotations);
  const hasRotation = states.rotation === "done";
  const stepList = Object.values(states);
  const stepsDone = stepList.filter((s) => s === "done").length;
  const next = hasRotation ? "Compare rotation options" : "Record what you grow now";
  const nextHref = hasRotation ? `/plan?fieldId=${encodeURIComponent(field.id)}` : `/fields/${field.id}/rotation`;

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
            <RiskChip hazard={hasRotation ? "field" : "neutral"} className="shrink-0">
              {hasRotation ? "Rotation recorded" : "Needs your input"}
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
              aria-label={`${stepsDone} of ${stepList.length} steps done`}
              className={cn("grid gap-1", stepList.length === 5 ? "grid-cols-5" : "grid-cols-4")}
            >
              {stepList.map((s, i) => (
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
  const exportBackup = useFieldsStore((s) => s.exportBackup);
  const importBackup = useFieldsStore((s) => s.importBackup);

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
    <div className="flex flex-col gap-6">
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <FieldCard key={f.id} field={f} rotations={rotations[f.id] ?? EMPTY_ROTATIONS} />
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-body-sm text-ink-muted">
        <p className="m-0">Your fields and crop data are saved privately in this browser.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const backup = await exportBackup();
              const dateStr = new Date().toISOString().slice(0, 10);
              downloadJson(`farm-fields-backup-${dateStr}.json`, backup);
            }}
            className="min-h-tap text-label"
          >
            <DownloadGlyph />
            Export farm backup (JSON)
          </Button>
          <label className={buttonClass("secondary", "cursor-pointer min-h-tap text-label")}>
            <span>Restore backup</span>
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const json = JSON.parse(text);
                  const res = await importBackup(json);
                  alert(`Restored ${res.fields} fields and ${res.rotations} rotations.`);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Could not import backup.");
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
