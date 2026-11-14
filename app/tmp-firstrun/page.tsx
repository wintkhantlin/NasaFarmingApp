import { FirstRun } from "@/components/home/first-run";

export default function Page() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-title">Your fields</h1>
      <FirstRun />
    </main>
  );
}
