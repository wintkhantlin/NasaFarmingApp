"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Message } from "@/components/ui/message";
import { Button, buttonClass } from "@/components/ui/button";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { answerOf, openQuickQuestions, QUESTIONS, UNSURE, type Question } from "@/lib/engine/questions";
import { useFieldsStore } from "@/lib/store/fields-store";
import { useAppCopy } from "@/lib/store/locale-store";
import type { Field } from "@/lib/types";

/** Answer an unknown (S14): one question, a few choices, and what it unlocks. */
export function QuestionForm({ fieldId, questionId }: { fieldId: string; questionId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const load = useFieldsStore((s) => s.load);
  const t = useAppCopy().question;
  const question = QUESTIONS.find((q) => q.id === questionId);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  if (status === "idle" || status === "loading") return <Skeleton className="h-48" />;
  if (!field || !question) {
    return (
      <EmptyState title={t.notFoundTitle} body={t.notFoundBody}>
        <Link href="/" className={buttonClass("primary")}>{t.back}</Link>
      </EmptyState>
    );
  }

  return <QuestionBody key={question.id} field={field} question={question} />;
}

/** How long "Saved" stays on screen before the next question opens. */
const SAVED_PAUSE_MS = 700;

function QuestionBody({ field, question }: { field: Field; question: Question }) {
  const router = useRouter();
  const t = useAppCopy().question;
  const update = useFieldsStore((s) => s.update);
  const [value, setValue] = useState(answerOf(field, question.id)?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedValue, setSavedValue] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const save = async () => {
    if (!value) {
      setError(t.pick);
      return;
    }
    setSaving(true);
    try {
      const rest = (field.answers ?? []).filter((a) => a.questionId !== question.id);
      const answers = [...rest, { questionId: question.id, value, at: new Date().toISOString() }];
      await update(field.id, { answers, ...(question.apply?.(field, value) ?? {}) });
      const nextQ = openQuickQuestions({ ...field, answers }).find((q) => q.question.id !== question.id);
      const href = nextQ ? nextQ.href : `/fields/${field.id}/compare`;
      // Show "Saved" first, so the jump to the next question is not a surprise.
      setSavedValue(value);
      timer.current = setTimeout(() => router.push(href), SAVED_PAUSE_MS);
    } catch {
      setError(t.failed);
      setSaving(false);
    }
  };

  const backHref = `/fields/${field.id}/compare`;
  const benefitRaw = question.unlocks.split(": ").pop() ?? "";
  const benefit = benefitRaw.charAt(0).toUpperCase() + benefitRaw.slice(1);
  // The question's own "not sure" choice becomes the one "I don't know" answer, stored as Not known.
  const choices = question.choices.filter((c) => c.value !== UNSURE);
  const options = [...choices, { value: UNSURE, label: t.dontKnow }];

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <FieldPageHeader title={question.title} />
      <Panel as="section" aria-label={t.answerLabel(question.title)} className="flex flex-col gap-4 p-4 sm:p-6">
        <h2 id="q-prompt" className="text-headline text-ink">{question.prompt}</h2>
        <div role="radiogroup" aria-labelledby="q-prompt" className="flex flex-col gap-2">
          {options.map((c) => {
            const selected = value === c.value;
            const isUnknown = c.value === UNSURE;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving}
                onClick={() => { setError(null); setValue(c.value); }}
                className={`flex min-h-tap items-center gap-3 rounded-md border px-3.5 py-3 text-left text-body transition-colors ${
                  selected ? "border-field bg-field-soft text-ink" : isUnknown ? "border-dashed border-line-strong bg-surface text-ink-muted hover:border-line-strong" : "border-line bg-surface text-ink hover:border-line-strong"
                }`}
              >
                <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full border ${selected ? "border-field bg-field text-white" : "border-line-strong"}`}>
                  {selected ? <Icon name="done" size={12} /> : null}
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
        <p className="m-0 rounded-md bg-surface-sunken p-3 text-body-sm text-ink-muted">
          <span className="font-medium text-ink">{t.helps} </span>{benefit}
        </p>
        {error ? <Message tone="problem" role="alert" title={t.didNotSave}>{error}</Message> : null}
        {savedValue !== null ? <Message tone="success" role="status" title={savedValue === UNSURE ? t.savedUnknown : t.saved} /> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" iconEnd="done" onClick={save} disabled={saving}>{t.save}</Button>
          <Link href={backHref} className="text-label text-ink-muted hover:text-ink">{t.notNow}</Link>
        </div>
      </Panel>
    </div>
  );
}
