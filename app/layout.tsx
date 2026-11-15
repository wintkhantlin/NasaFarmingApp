import type { Metadata, Viewport } from "next";
import { Noto_Sans_Myanmar } from "next/font/google";
import { copy } from "@/lib/copy/en";
import { Providers } from "./providers";
import "./globals.css";

// Self-hosted at build for offline use. Latin text uses the system font.
const myanmar = Noto_Sans_Myanmar({
  variable: "--font-myanmar",
  subsets: ["myanmar"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: copy.app.name,
  title: { default: copy.app.name, template: `%s | ${copy.app.name}` },
  description: copy.app.tagline,
  keywords: ["crop planning", "crop rotation", "farm decisions", "NASA Earth data"],
  category: "agriculture",
  openGraph: {
    type: "website",
    siteName: copy.app.name,
    title: copy.app.name,
    description: copy.app.tagline,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: copy.app.name,
    description: copy.app.tagline,
  },
};

// Light mode only (DESIGN.md, The Light-Only Rule). viewportFit "cover" lets the
// full-screen map run under the notch; its controls keep clear of the safe areas.
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4f3ee",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${myanmar.variable} h-full antialiased`}
      // Extensions can inject attributes/classes into <html> before hydration.
      // Suppress the root warning; React does not patch this external mutation.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
