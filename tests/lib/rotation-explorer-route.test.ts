import { expect, test } from "vitest";
import { ComparePage } from "../../app/(app)/fields/[fieldId]/compare/page";
import { PlanEntry } from "../../app/(app)/plan/page";

test("saved-field comparison renders for the requested field (the crop-screen link now lives inside it)", async () => {
  const content = await ComparePage({ params: Promise.resolve({ fieldId: "farm one" }) });
  expect(content.props.children.props.fieldId).toBe("farm one");
});

test("old Plan field links open the saved-farm crop screen", async () => {
  await expect(PlanEntry({ searchParams: Promise.resolve({ fieldId: "farm one" }) })).rejects.toMatchObject({
    digest: expect.stringContaining("/plan/crop-screen?fieldId=farm%20one"),
  });
});
