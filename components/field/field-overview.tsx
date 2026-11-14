"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper, type StepId, type StepState } from "@/components/ui/stepper";
import { copy } from "@/lib/copy/en";
import { formatPoint } from "@/lib/geo/format";
import { staticMapUrl } from "@/lib/geo/static-map";
import { useFieldsStore } from "@/lib/store/fields-store";

const STATES: Record<StepId, StepState> = {
  location: "done",
  rotation: "needs-input",
  conditions: "not-started",
  compare: "not-started",
};
// Only the location step has a page so far; the others are built in later phases.
const AVAILABLE: Record<StepId, boolean> = { location: true, rotation: false, conditions: false, compare: false };

export function FieldOverview({ fieldId }: { fieldId: string }) {
  const router = useRouter();
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const load = useFieldsStore((s) => s.load);
  const remove = useFieldsStore((s) => s.remove);
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (!field) {
    return (
      <EmptyState title="This field isn't saved in this browser" body="Fields are stored on the device where you added them. You may have opened a link from another device.">
        <Link href="/" className={buttonClass("primary")}>
          Back to your fields
        </Link>
      </EmptyState>
    );
  }

  const details: Array<[string, string]> = [
    ["Location", formatPoint(field.centroid)],
    ["Area", field.areaHa === null ? copy.home.pinOnly : copy.home.area(field.areaHa)],
    ["Water", copy.irrigation[field.irrigation]],
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-overline text-ink-muted">
            <Link href="/">Your fields</Link>
          </p>
          <h1 className="text-title text-ink">{field.name}</h1>
        </div>
        <Link href={`/fields/${field.id}/location`} className={buttonClass("secondary")}>
          Edit field
        </Link>
      </div>

      <Stepper fieldId={field.id} current="location" states={STATES} available={AVAILABLE} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          {MAPBOX_TOKEN ? (
            <figure className="overflow-hidden rounded-lg border border-line bg-surface-sunken">
              <Image
                src={staticMapUrl(field.geometry, MAPBOX_TOKEN)}
                alt={`Satellite view of ${field.name}`}
                width={1280}
                height={640}
                unoptimized
                className="h-auto w-full"
              />
            </figure>
          ) : null}

          <section aria-labelledby="field-details" className="flex flex-col gap-3 rounded-md border border-line bg-surface-raised p-4">
            <h2 id="field-details" className="text-headline text-ink">
              About this field
            </h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              {details.map(([term, value]) => (
                <div key={term} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-label text-ink-muted">{term}</dt>
                  <dd className="tabular font-mono text-data break-words text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section aria-labelledby="next-step" className="order-first flex h-fit flex-col gap-2 rounded-lg border border-field bg-field-soft p-4 lg:order-none">
          <h2 id="next-step" className="text-headline text-ink">
            Next: what you grow now
          </h2>
          <p className="max-w-measure text-body text-ink">
            Add the crops you have grown on this field, with planting and harvest dates, so we can compare them with other rotations.
          </p>
          <p className="text-body-sm text-ink-muted">This step isn&apos;t available yet. Your field is saved and will be waiting.</p>
        </section>
      </div>

      <section className="flex flex-col gap-2">
        {confirming ? (
          <div role="group" aria-label="Remove this field" className="flex flex-col gap-3 rounded-md border border-line-strong bg-surface-raised p-4">
            <p className="text-body text-ink">Remove {field.name} and its rotations from this browser? This can&apos;t be undone.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    await remove(field.id);
                    router.push("/");
                  } catch {
                    setRemoveError("We couldn't remove this field. Try again.");
                  }
                }}
              >
                Remove field
              </Button>
              <Button onClick={() => setConfirming(false)}>Keep it</Button>
            </div>
            {removeError ? (
              <p role="alert" className="text-body-sm text-heat">
                {removeError}
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <Button variant="quiet" onClick={() => setConfirming(true)}>
              Remove this field
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
