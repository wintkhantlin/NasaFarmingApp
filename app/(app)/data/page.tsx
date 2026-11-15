import type { Metadata } from "next";
import { LearnHub } from "@/components/learn/learn-hub";
import { LearnHeader } from "@/components/learn/learn-header";
import { DataLegend } from "@/components/ui/data-legend";

export const metadata: Metadata = { title: "Data" };

/** Learn tab root (S15): farmer questions grouped by theme. Dataset names are supporting information inside each topic. */
export default function LearnPage() {
  return (
    <>
      <LearnHeader />
      <DataLegend />
      <LearnHub />
    </>
  );
}
