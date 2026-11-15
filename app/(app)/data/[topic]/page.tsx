import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnTopicView } from "@/components/learn/learn-topic";
import { TOPICS, getTopic } from "@/lib/learn/topics";

type Params = { params: Promise<{ topic: string }> };

export function generateStaticParams() {
  return TOPICS.map((t) => ({ topic: t.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { topic } = await params;
  const t = getTopic(topic);
  return { title: t ? t.question.en : "Data" };
}

async function TopicContent({ params }: Params) {
  const { topic } = await params;
  if (!getTopic(topic)) notFound();
  return <LearnTopicView topicId={topic} />;
}

/** One Data topic, addressed by its farmer question id. URL data streams inside Suspense. */
export default function LearnTopicPage(props: Params) {
  return (
    <Suspense fallback={null}>
      <TopicContent {...props} />
    </Suspense>
  );
}
