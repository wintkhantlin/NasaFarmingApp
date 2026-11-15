import { redirect } from "next/navigation";

/** Preserve saved comparison bookmarks while keeping one primary Explorer. */
export default async function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  redirect(`/plan?fieldId=${encodeURIComponent(fieldId)}`);
}
