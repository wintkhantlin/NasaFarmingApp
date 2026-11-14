import { WelcomeGate } from "@/components/shell/welcome-gate";

/** Full-screen layout for the map screens: no header or footer, the map fills the viewport. */
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <WelcomeGate>
      <main className="relative h-svh w-full overflow-hidden">{children}</main>
    </WelcomeGate>
  );
}
