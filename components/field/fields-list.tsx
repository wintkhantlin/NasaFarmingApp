"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import { FirstRun } from "@/components/home/first-run";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { Button, ButtonRow } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph } from "@/components/ui/icons";
import { RiskChip } from "@/components/ui/risk-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy/en";
import { downloadJson } from "@/lib/download";
import { staticMapUrl } from "@/lib/geo/static-map";
import { sequenceText } from "@/lib/rotation-format";
import { deriveStepStates, EMPTY_ROTATIONS, useFieldsStore } from "@/lib/store/fields-store";
import type { Field, Rotation } from "@/lib/types";

function FieldCard({ field, rotations }: { field: Field; rotations: Rotation[]; onArchive?: (f: Field) => void }) {
  const states = deriveStepStates(field, rotations);
  const hasRotation = states.rotation === "done";
  const next = hasRotation ? "See my answer" : "Add my crops";
  const nextHref = hasRotation ? `/fields/${field.id}/compare` : `/fields/${field.id}/rotation`;

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
  const update = useFieldsStore((s) => s.update);
  const [query, setQuery] = useState("");
  const [undo, setUndo] = useState<Field | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

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
      <EmptyState title={copy.home.loadError} body="Saved work could not be read. Check browser storage, then try again. Basic regional preview is still available from Plan.">
        <Button variant="primary" onClick={() => void load()}>
          {copy.home.retry}
        </Button>
        <Button href="/plan" variant="secondary">Explore regional preview</Button>
      </EmptyState>
    );
  }

  if (fields.length === 0) return <FirstRun />;

  const needle = query.trim().toLowerCase();
  const matches = (f: Field) => f.name.toLowerCase().includes(needle);
  const live = fields.filter((f) => !f.archivedAt && matches(f));
  const archived = fields.filter((f) => f.archivedAt && matches(f));
  const archive = async (f: Field) => {
    const wasArchived = Boolean(f.archivedAt);
    await update(f.id, { archivedAt: wasArchived ? undefined : new Date().toISOString() });
    if (!wasArchived) {
      setUndo(f);
      window.setTimeout(() => setUndo((u) => (u?.id === f.id ? null : u)), 5000);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <TextField
        type="search"
        label="Search fields"
        placeholder="Search fields"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        size="small"
        fullWidth
        slotProps={{ htmlInput: { "aria-label": "Search fields" } }}
      />
      <p className="m-0 text-body-sm text-ink-muted">Resume a saved field below, or explore a regional example without creating a farm record.</p>
      {live.length === 0 ? (
        <p className="m-0 text-body text-ink-muted">{needle ? `No fields named \u201c${query.trim()}\u201d.` : "All your fields are archived."}</p>
      ) : null}
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((f) => (
          <FieldCard key={f.id} field={f} rotations={rotations[f.id] ?? EMPTY_ROTATIONS} onArchive={archive} />
        ))}
      </ul>

      {archived.length > 0 ? (
        <details className="rounded-md border border-line bg-surface-raised p-3">
          <summary className="min-h-tap cursor-pointer text-label text-ink">Show {archived.length} archived {archived.length === 1 ? "field" : "fields"}</summary>
          <ul className="m-0 mt-3 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((f) => (
              <FieldCard key={f.id} field={f} rotations={rotations[f.id] ?? EMPTY_ROTATIONS} onArchive={archive} />
            ))}
          </ul>
        </details>
      ) : null}

      {undo ? (
        <div role="status" className="fixed inset-x-4 bottom-[calc(var(--tabbar-h)+0.75rem)] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-md bg-ink px-4 py-2 text-body-sm text-surface-raised">
          <span>Archived {undo.name}.</span>
          <Button variant="link" className="!text-surface-raised font-semibold" onClick={() => { void update(undo.id, { archivedAt: undefined }); setUndo(null); }}>
            Undo
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-body-sm text-ink-muted">
        <p className="m-0">Your fields and crop data are saved privately in this browser.</p>
        <ButtonRow>
          <Button
            variant="secondary"
            icon="download"
            onClick={async () => {
              try {
                const backup = await exportBackup();
                const dateStr = new Date().toISOString().slice(0, 10);
                downloadJson(`farm-fields-backup-${dateStr}.json`, backup);
                setBackupMessage("Backup download started. Keep the file somewhere private.");
              } catch {
                setBackupMessage("Could not create a backup. Check browser storage and try again.");
              }
            }}
          >
            Export farm backup (JSON)
          </Button>
          <Button component="label" variant="secondary" icon="restore">
            Restore backup
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
                  setBackupMessage(`Restored ${res.fields} fields and ${res.rotations} rotations.`);
                } catch (err) {
                  setBackupMessage(err instanceof Error ? err.message : "Could not import backup.");
                }
              }}
            />
          </Button>
          <Button href="/settings" variant="secondary" icon="settings">Privacy and settings</Button>
        </ButtonRow>
        {backupMessage ? <p role="status" className="basis-full m-0 text-source">{backupMessage}</p> : null}
      </div>
    </div>
  );
}
