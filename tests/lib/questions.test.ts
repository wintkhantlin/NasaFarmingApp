import { describe, expect, it } from "vitest";
import { openQuestions, openQuickQuestions, QUESTIONS, UNSURE } from "@/lib/engine/questions";

describe("openQuestions", () => {
  it("lists every question and limit when nothing is answered", () => {
    expect(openQuestions({ id: "f", answers: undefined, constraints: undefined })).toHaveLength(QUESTIONS.length + 5);
  });
  it("drops an answered question, including I don't remember", () => {
    const at = "2026-11-14T00:00:00.000Z";
    const open = openQuestions({ id: "f", constraints: { canSell: [] }, answers: [{ questionId: QUESTIONS[0].id, value: UNSURE, at }] });
    expect(open.some((o) => o.kind === "question" && o.question.id === QUESTIONS[0].id)).toBe(false);
    expect(open.some((o) => o.kind === "limit" && o.limit === "market")).toBe(false);
    expect(open).toHaveLength(QUESTIONS.length - 1 + 4);
  });
});

describe("quick questions", () => {
  const base = { id: "f", answers: undefined, priorities: undefined, constraints: undefined };
  it("asks every quick question for a new field", () => {
    expect(openQuickQuestions(base)).toHaveLength(QUESTIONS.length);
  });
  it("skips a question the farm details already answer", () => {
    const ids = openQuickQuestions({ ...base, priorities: { order: ["soil"], weights: {} }, constraints: { labour: "low" } }).map((q) => q.question.id);
    expect(ids).not.toContain("priority");
    expect(ids).not.toContain("labour");
  });
  it("writes the priority answer to the field's priorities, first in order", () => {
    const q = QUESTIONS.find((x) => x.id === "priority")!;
    expect(q.apply?.(base, "water").priorities?.order[0]).toBe("water");
    expect(q.apply?.(base, UNSURE)).toEqual({});
  });
  it("writes market and labour answers to the constraints", () => {
    expect(QUESTIONS.find((x) => x.id === "market")!.apply?.(base, "good").constraints?.marketAccess).toBe("good");
    expect(QUESTIONS.find((x) => x.id === "labour")!.apply?.(base, "low").constraints?.labour).toBe("low");
  });
});
