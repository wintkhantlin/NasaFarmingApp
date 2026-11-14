import type { Metadata } from "next";
import { LocationPicker } from "@/components/field/location-picker";

export const metadata: Metadata = { title: "Add a field" };

export default function NewFieldPage() {
  return <LocationPicker />;
}
