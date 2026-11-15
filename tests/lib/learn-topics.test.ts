import { describe, expect, test } from "vitest";
import { copy } from "../../lib/copy/en";
import { INDICATOR_LABELS, THEMES, TOPICS, allGlossaryEntries, searchTopics, topicsForIndicator } from "../../lib/learn/topics";

describe("learn information architecture", () => {
  test("keeps every original glossary entry and maps each to exactly one topic", () => {
    const original = [...copy.glossary.items, ...copy.glossary.satelliteVsGround.items];
    expect(allGlossaryEntries()).toHaveLength(original.length);
    for (const entry of original) {
      const owners = TOPICS.filter((t) => t.terms.includes(entry.term));
      expect(owners.length, entry.term).toBe(1);
    }
  });

  test("references only known glossary terms", () => {
    const known = new Set(allGlossaryEntries().map((e) => e.term));
    for (const t of TOPICS) for (const term of t.terms) expect(known.has(term), term).toBe(true);
  });

  test("topic ids are unique and every topic has a theme, Burmese and English text", () => {
    const ids = TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const themes = new Set(THEMES.map((t) => t.id));
    for (const t of TOPICS) {
      expect(themes.has(t.theme), t.id).toBe(true);
      for (const field of [t.question, t.intro]) {
        expect(field.en.trim(), t.id).not.toBe("");
        expect(field.my.trim(), t.id).not.toBe("");
      }
    }
  });

  test("every theme has at least one topic", () => {
    for (const theme of THEMES) expect(TOPICS.some((t) => t.theme === theme.id), theme.id).toBe(true);
  });

  test("comparison indicator ids used by topics have labels", () => {
    for (const t of TOPICS) for (const id of t.indicators) expect(INDICATOR_LABELS[id], `${t.id} ${id}`).toBeTruthy();
  });

  test("farmers can find a topic without knowing dataset names", () => {
    expect(searchTopics("soil moisture").map((t) => t.id)).toContain("what-soil-moisture-means");
    expect(searchTopics("rain").length).toBeGreaterThan(0);
    expect(searchTopics("  ").length).toBe(TOPICS.length);
    expect(searchTopics("zzz-no-match")).toEqual([]);
  });

  test("comparison dimensions link back to their topics", () => {
    expect(topicsForIndicator("water").map((t) => t.id)).toContain("why-crops-need-water");
    expect(topicsForIndicator("erosion").map((t) => t.id)).toContain("why-soil-washes-away");
  });
});
