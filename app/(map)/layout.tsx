/** Full-screen layout for the map screens: no header or footer, the map fills the viewport. */
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <main className="relative h-svh w-full overflow-hidden">{children}</main>;
}
