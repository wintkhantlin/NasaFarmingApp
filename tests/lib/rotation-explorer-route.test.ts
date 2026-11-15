import { expect, test } from "vitest";
import Page from "../../app/(app)/fields/[fieldId]/compare/page";

test("saved-field comparison bookmarks open the unified Rotation Explorer", async () => {
  await expect(Page({ params: Promise.resolve({ fieldId: "farm one" }) })).rejects.toMatchObject({
    digest: expect.stringContaining("/plan/crop-screen?fieldId=farm%20one"),
  });
});
