import type { Metadata } from "next";
import { strategyCrops } from "@/lib/data/crops";
import { CropLibraryView } from "@/components/learn/crop-library-view";

export const metadata: Metadata = { title: "Crop library" };

/** The crop rules behind every suitability result, each with where it came from and how far to trust it. */
export default function CropLibraryPage() {
  const crops = strategyCrops();
  return <CropLibraryView crops={crops} />;
}
