import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/auth-context";
import { AppShell } from "@/components/app-shell";
import { PwaInit } from "@/components/pwa-init";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ire Ayode — Plateforme agricole",
  description: "Sync KoboToolbox & Dashboard agricole — Ire Ayode",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ire Ayode",
  },
};

export const viewport: Viewport = {
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-background" suppressHydrationWarning>
        <PwaInit />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
