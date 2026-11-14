import { Suspense } from "react";
import { FieldShell } from "@/components/field/field-shell";
import { Skeleton } from "@/components/ui/skeleton";

// FieldShell reads the route params on the client, so it sits in a Suspense
// boundary and the rest of the page can prerender around it.
export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <FieldShell>{children}</FieldShell>
    </Suspense>
  );
}
