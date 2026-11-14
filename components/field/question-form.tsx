"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import { Button, Pressable } from "@/components/ui/button";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { answerOf, openQuickQuestions, QUESTIONS, type Question } from "@/lib/engine/questions";
import { useFieldsStore } from "@/lib/store/fields-store";
import type { Field } from "@/lib/types";

/** Answer an unknown (S14): one question, a few choices, and what it unlocks. */
export function QuestionForm({ fieldId, questionId }: { fieldId: string; questionId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const load = useFieldsStore((s) => s.load);
  const question = QUESTIONS.find((q) => q.id === questionId);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  if (status === "idle" || status === "loading") return <Skeleton className="h-48" />;
  if (!field || !question) {
    return (
      <EmptyState title="Question not found" body="This question or field isn't saved in this browser.">
        <Button href="/" variant="primary">Back to your fields</Button>
      </EmptyState>
    );
  }

  return <QuestionBody key={question.id} field={field} question={question} />;
}

function QuestionBody({ field, question }: { field: Field; question: Question }) {
  const router = useRouter();
  const update = useFieldsStore((s) => s.update);
  const [value, setValue] = useState(answerOf(field, question.id)?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value) {
      setError("Choose an answer first.");
      return;
    }
    setSaving(true);
    try {
      const rest = (field.answers ?? []).filter((a) => a.questionId !== question.id);
      const answers = [...rest, { questionId: question.id, value, at: new Date().toISOString() }];
      await update(field.id, { answers, ...(question.apply?.(field, value) ?? {}) });
      const nextQ = openQuickQuestions({ ...field, answers }).find((q) => q.question.id !== question.id);
      router.push(nextQ ? nextQ.href : `/fields/${field.id}/compare`);
    } catch {
      setError("We couldn't save. Check that this browser allows site storage.");
      setSaving(false);
    }
  };

  const index = QUESTIONS.findIndex((q) => q.id === question.id);
  const backHref = `/fields/${field.id}/compare`;
  const benefitRaw = question.unlocks.split(": ").pop() ?? "";
  const benefit = benefitRaw.charAt(0).toUpperCase() + benefitRaw.slice(1);

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <FieldPageHeader
        title={question.title}
        summary={<span className="tabular">Question {index + 1} of {QUESTIONS.length}</span>}
      />
      <Panel as="section" aria-label={`Answer: ${question.title}`} className="flex flex-col gap-4 p-4 sm:p-6">
        <h2 id="q-prompt" className="text-headline text-ink">{question.prompt}</h2>
        <div role="radiogroup" aria-labelledby="q-prompt" className="flex flex-col gap-2">
          {question.choices.map((c) => {
            const selected = value === c.value;
            return (
              <Pressable
                key={c.value}
                role="radio"
                aria-checked={selected}
                onClick={() => { setError(null); setValue(c.value); }}
                className={`flex min-h-tap items-center gap-3 rounded-md border px-3.5 py-3 text-left text-body transition-colors ${
                  selected ? "border-field bg-field-soft text-ink" : "border-line bg-surface text-ink hover:border-line-strong"
                }`}
              >
                <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full border ${selected ? "border-field bg-field text-white" : "border-line-strong"}`}>
                  {selected ? <Icon name="done" size={12} /> : null}
                </span>
                {c.label}
              </Pressable>
            );
          })}
        </div>
        <p className="m-0 rounded-md bg-surface-sunken p-3 text-body-sm text-ink-muted">
          <span className="font-medium text-ink">Why we ask: </span>{benefit}
        </p>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" iconEnd="done" onClick={save} disabled={saving}>Save answer</Button>
          <Link href={backHref} className="text-label text-ink-muted hover:text-ink">Skip for now</Link>
        </div>
      </Panel>
    </div>
  );
}
