import { Suspense } from "react";
import { QuestionForm } from "@/components/field/question-form";
import { Skeleton } from "@/components/ui/skeleton";

async function QuestionPageContent({
  params,
}: {
  params: Promise<{ fieldId: string; questionId: string }>;
}) {
  const { fieldId, questionId } = await params;
  return <QuestionForm fieldId={fieldId} questionId={questionId} />;
}

export default function QuestionPage({
  params,
}: {
  params: Promise<{ fieldId: string; questionId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full max-w-2xl" />}>
      <QuestionPageContent params={params} />
    </Suspense>
  );
}

