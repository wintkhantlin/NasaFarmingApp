import { RotationCompare } from "@/components/field/rotation-compare";

export async function ComparePage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  return <>
    <RotationCompare fieldId={fieldId} />
  </>;
}
