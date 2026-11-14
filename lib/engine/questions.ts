import type { Field, PriorityId } from "../types";
import { LIMIT_KEYS, unansweredLimits, type LimitKey } from "./limits";

export interface Question {
  id: string;
  title: string;
  prompt: string;
  choices: Array<{ value: string; label: string }>;
  /** What answering helps, in the farmer's words. */
  unlocks: string;
  /** Also writes the answer to the field setting it stands for, so there is one place for each fact. */
  apply?: (field: Pick<Field, "priorities" | "constraints">, value: string) => Partial<Pick<Field, "priorities" | "constraints">>;
  /** True when the field already holds this answer from somewhere else, such as the full farm details. */
  has?: (field: Pick<Field, "priorities" | "constraints">) => boolean;
}

const PRIORITY_IDS: PriorityId[] = ["water", "soil", "income", "forage", "lower-inputs"];

/** The value that keeps an item Not known and stops asking. */
export const UNSURE = "unsure";

export const QUESTIONS: Question[] = [
  {
    id: "priority",
    title: "What matters most",
    prompt: "What matters most on this field?",
    choices: [
      { value: "water", label: "Using less water" },
      { value: "soil", label: "Looking after the soil" },
      { value: "income", label: "Earning more" },
      { value: "lower-inputs", label: "Spending less on inputs" },
      { value: UNSURE, label: "All about equal" },
    ],
    unlocks: "Ranking: which option comes first for you.",
    apply: (field, value) => {
      if (!PRIORITY_IDS.includes(value as PriorityId)) return {};
      const first = value as PriorityId;
      return { priorities: { ...field.priorities, order: [first, ...PRIORITY_IDS.filter((p) => p !== first)], weights: {} } };
    },
    has: (field) => (field.priorities?.order.length ?? 0) > 0,
  },
  {
    id: "soil-water-at-sowing",
    title: "Soil water at sowing",
    prompt: "When you sowed last year, was the soil:",
    choices: [
      { value: "wet", label: "Wet, water stood in places" },
      { value: "damp", label: "Damp, held together in a ball" },
      { value: "dry", label: "Dry, crumbled" },
      { value: UNSURE, label: "I don't remember" },
    ],
    unlocks: "Water: how much stored soil water the second crop could count on.",
  },
  {
    id: "water-standing",
    title: "Standing water after rain",
    prompt: "After a few days of heavy rain, does water stand on the field?",
    choices: [
      { value: "stands", label: "Yes, for more than a few days" },
      { value: "drains", label: "No, it drains within a day or two" },
      { value: UNSURE, label: "I don't remember" },
    ],
    unlocks: "Water: whether crops that dislike wet feet are a risk here.",
  },
  {
    id: "market",
    title: "Selling nearby",
    prompt: "How easy is it to sell your crops nearby?",
    choices: [
      { value: "good", label: "Easy, buyers come to me" },
      { value: "fair", label: "Possible, with some travel" },
      { value: "poor", label: "Hard" },
      { value: UNSURE, label: "Not sure" },
    ],
    unlocks: "Income: which crops are realistic to sell.",
    apply: (field, value) => (value === "good" || value === "fair" || value === "poor" ? { constraints: { ...field.constraints, marketAccess: value } } : {}),
    has: (field) => field.constraints?.marketAccess !== undefined,
  },
  {
    id: "labour",
    title: "Labour",
    prompt: "How much help do you have at busy times?",
    choices: [
      { value: "high", label: "Plenty" },
      { value: "medium", label: "Some" },
      { value: "low", label: "Very little" },
      { value: UNSURE, label: "Not sure" },
    ],
    unlocks: "Work: whether a crop's workload fits.",
    apply: (field, value) => (value === "high" || value === "medium" || value === "low" ? { constraints: { ...field.constraints, labour: value } } : {}),
    has: (field) => field.constraints?.labour !== undefined,
  },
];

/** Quick questions still worth asking, in order. Limits that need the full farm form are not in this queue. */
export function openQuickQuestions(field: Pick<Field, "id" | "answers" | "priorities" | "constraints">): Array<Extract<OpenQuestion, { kind: "question" }>> {
  return QUESTIONS.filter((q) => !answerOf(field, q.id) && !q.has?.(field)).map((question) => ({
    kind: "question" as const,
    question,
    href: `/fields/${field.id}/questions/${question.id}`,
  }));
}

export type OpenQuestion =
  | { kind: "question"; question: Question; href: string }
  | { kind: "limit"; limit: LimitKey; href: string };

export const answerOf = (field: Pick<Field, "answers">, id: string) => field.answers?.find((a) => a.questionId === id);

/** Unanswered questions and unanswered limits. "I don't remember" counts as handled: asked once, still Not known. */
export function openQuestions(field: Pick<Field, "id" | "answers" | "constraints">): OpenQuestion[] {
  const qs: OpenQuestion[] = QUESTIONS.filter((q) => !answerOf(field, q.id)).map((question) => ({
    kind: "question",
    question,
    href: `/fields/${field.id}/questions/${question.id}`,
  }));
  const ls: OpenQuestion[] = unansweredLimits(field.constraints).map((limit) => ({
    kind: "limit",
    limit,
    href: `/fields/${field.id}/profile#limits`,
  }));
  return [...qs, ...ls];
}

export { LIMIT_KEYS };
