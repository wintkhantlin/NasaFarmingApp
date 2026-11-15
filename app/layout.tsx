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
  title: { default: copy.app.name, template: `%s | ${copy.app.name}` },
  description: copy.app.tagline,
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
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
