"use client";

import { useEffect } from "react";
import { LocationPicker } from "@/components/field/location-picker";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useFieldsStore } from "@/lib/store/fields-store";

export function EditLocation({ fieldId }: { fieldId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const load = useFieldsStore((s) => s.load);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  if (status === "idle" || status === "loading") return <Skeleton className="size-full rounded-none" />;
  if (!field) {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col justify-center p-4">
        <EmptyState title="This field isn't saved in this browser" body="Fields are stored on the device where you added them.">
          <Button href="/" variant="primary">
            Back to your fields
          </Button>
        </EmptyState>
      </div>
    );
  }
  return <LocationPicker field={field} />;
}
