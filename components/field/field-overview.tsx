"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightGlyph } from "@/components/ui/icons";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy/en";
import { formatPoint } from "@/lib/geo/format";
import { staticMapUrl } from "@/lib/geo/static-map";
import { formatSpan, plural, slotName } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";

export function FieldOverview({ fieldId }: { fieldId: string }) {
  const router = useRouter();
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const remove = useFieldsStore((s) => s.remove);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (!field) {
    return (
      <EmptyState
        title="This field isn't saved in this browser"
        body="Fields are stored on the device where you added them. You may have opened a link from another device."
      >
        <Link href="/" className={buttonClass("primary")}>
          Back to your fields
        </Link>
      </EmptyState>
    );
  }

  const rotation = rotations[0] && rotations[0].slots.length > 0 ? rotations[0] : null;

  const details: Array<[string, string]> = [
    ["Location", formatPoint(field.centroid)],
    ["Area", field.areaHa === null ? copy.home.pinOnly : copy.home.area(field.areaHa)],
    ["Water", copy.irrigation[field.irrigation]],
    ["Soil", field.soilOverride?.texture ? `${field.soilOverride.texture}, from your soil test` : "From the regional soil map"],
  ];

  const handleRemoveConfirm = async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      await remove(field.id);
      setConfirmOpen(false);
      router.push("/");
    } catch {
      setRemoveError(copy.overview.removeError);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h1 className="min-w-0 text-balance text-title text-ink sm:text-display">{field.name}</h1>
        <Link href={`/fields/${field.id}/location`} className={buttonClass("secondary")}>
          Edit location and soil
        </Link>
      </div>

      {/* The answer first: what to do next. */}
      <Panel as="section" tone="field" radius="lg" aria-labelledby="next-step" className="flex flex-col gap-4 p-5 sm:p-6">
        {rotation ? (
          <>
            <div className="flex flex-col gap-2">
              <h2 id="next-step" className="text-balance text-title text-ink">
                {copy.overview.viewConditionsHeading}
              </h2>
              <p className="max-w-measure text-body text-ink">
                You recorded {plural(rotation.slots.length, "crop")} over {plural(rotation.cycleYears, "year")}. Check
                what the climate and soil around this field allow, then compare other rotations.
              </p>
            </div>
            <ol className="m-0 flex list-none flex-col gap-0 overflow-hidden rounded-md border border-field/30 bg-surface-raised p-0 sm:flex-row">
              {rotation.slots.map((s, i) => (
                <li
                  key={s.id}
                  className="flex min-w-0 flex-1 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:flex-col sm:items-start sm:gap-0.5 sm:border-b-0 sm:border-r sm:last:border-r-0"
                >
                  <span className="tabular font-mono text-source text-ink-muted">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-label text-ink">{slotName(s)}</span>
                    <span className="block text-body-sm text-ink-muted">{formatSpan(s.plantDate, s.harvestDate)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Link href={`/fields/${field.id}/conditions`} className={buttonClass("primary", "max-sm:w-full")}>
                Check conditions
                <ChevronRightGlyph />
              </Link>
              <Link href={`/fields/${field.id}/rotation`} className={buttonClass("secondary", "max-sm:w-full")}>
                Edit rotation
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h2 id="next-step" className="text-balance text-title text-ink">
                {copy.overview.nextStepHeading}
              </h2>
              <p className="max-w-measure text-body text-ink">{copy.overview.nextStepDescription}</p>
            </div>
            <div>
              <Link href={`/fields/${field.id}/rotation`} className={buttonClass("primary", "max-sm:w-full")}>
                Add your rotation
                <ChevronRightGlyph />
              </Link>
            </div>
          </>
        )}
      </Panel>

      {/* The evidence second: where the field is and what is known about it. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {MAPBOX_TOKEN ? (
          <figure className="m-0 overflow-hidden rounded-md border border-line bg-surface-sunken">
            <Image
              src={staticMapUrl(field.geometry, MAPBOX_TOKEN, 800, 400)}
              alt={`Satellite view of ${field.name}`}
              width={1600}
              height={800}
              unoptimized
              priority
              className="h-auto w-full object-cover"
            />
          </figure>
        ) : null}

        <Panel as="section" aria-labelledby="field-details" className="flex flex-col gap-4 p-4 sm:p-5">
          <PanelHeader id="field-details" title={copy.overview.aboutField} />
          <dl className="m-0 flex flex-col divide-y divide-line">
            {details.map(([term, value]) => (
              <div key={term} className="flex min-w-0 flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 xl:flex-col xl:items-start xl:gap-0.5">
                <dt className="text-body-sm text-ink-muted">{term}</dt>
                <dd className="tabular m-0 break-words font-mono text-data text-ink sm:text-right xl:text-left">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <div className="flex justify-start border-t border-line pt-4">
        <Button variant="quiet" onClick={() => setConfirmOpen(true)} className="text-ink-muted hover:text-heat">
          {copy.overview.removeTitle}
        </Button>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => !removing && setConfirmOpen(false)}
        aria-labelledby="remove-dialog-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="remove-dialog-title" sx={{ fontWeight: 600 }}>
          {copy.overview.removeTitle}
        </DialogTitle>
        <DialogContent>
          <p className="text-body text-ink">{copy.overview.removePrompt(field.name)}</p>
          {removeError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {removeError}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={removing}>
            {copy.overview.removeCancel}
          </Button>
          <Button variant="primary" onClick={handleRemoveConfirm} disabled={removing}>
            {copy.overview.removeConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
