import { redirect } from "next/navigation";

/** Keep saved comparison links on the field-informed crop screen. */
export default async function Page({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  redirect(`/plan/crop-screen?fieldId=${encodeURIComponent(fieldId)}`);
}
