"use client";

import Link from "next/link";
import { useAppCopy } from "@/lib/store/locale-store";

/** A direct path to the location or saved-field comparison from the field list. */
export function HomeRotationLink() {
  const text = useAppCopy().home.exploreRotations;
  return <Link href="/plan/crop-screen" className="inline-flex min-h-tap items-center self-start text-label text-field underline underline-offset-4 hover:text-ink">{text}</Link>;
}
