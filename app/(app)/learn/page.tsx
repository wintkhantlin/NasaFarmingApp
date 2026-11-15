import type { Metadata } from "next";
import { LearnList } from "@/components/learn/learn-list";
import { copy } from "@/lib/copy/en";

export const metadata: Metadata = { title: "Learn" };

/** Learn tab root (S15): bundled plain-language explanations, searchable, readable offline. */
export default function LearnPage() {
  const g = copy.glossary;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-ink sm:text-display">Learn</h1>
        <p className="max-w-measure text-body text-ink-muted">{g.title}. Tap a topic for a short explanation.</p>
      </div>
      <LearnList
        sections={[
          { title: "Weather, water and soil", items: g.items },
          { title: g.satelliteVsGround.title, items: g.satelliteVsGround.items },
        ]}
      />
    </>
  );
}
