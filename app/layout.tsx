import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { copy } from "@/lib/copy/en";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: copy.app.name, template: `%s | ${copy.app.name}` },
  description: copy.app.tagline,
};

// Light mode only (DESIGN.md, The Light-Only Rule). viewportFit "cover" lets the
// full-screen map run under the notch; its controls keep clear of the safe areas.
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4f2ea",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
