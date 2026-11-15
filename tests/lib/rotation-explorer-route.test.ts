import { expect, test } from "vitest";
import { ComparePage } from "../../app/(app)/fields/[fieldId]/compare/page";
import { PlanEntry } from "../../app/(app)/plan/page";

test("saved-field comparison remains available and links to the unified crop screen", async () => {
  const content = await ComparePage({ params: Promise.resolve({ fieldId: "farm one" }) });
  const children = content.props.children;
  expect(children[0].props.children[1].props.href).toBe("/plan/crop-screen?fieldId=farm%20one");
  expect(children[1].props.fieldId).toBe("farm one");
});

test("old Plan field links open the saved-farm crop screen", async () => {
  await expect(PlanEntry({ searchParams: Promise.resolve({ fieldId: "farm one" }) })).rejects.toMatchObject({
    digest: expect.stringContaining("/plan/crop-screen?fieldId=farm%20one"),
  });
});
