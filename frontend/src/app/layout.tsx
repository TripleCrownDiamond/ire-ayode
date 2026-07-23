import type { Metadata } from "next";
import { AuthProvider } from "@/context/auth-context";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ire Ayode — Plateforme agricole",
  description: "Sync KoboToolbox & Dashboard agricole — Ire Ayode",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-background" suppressHydrationWarning>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
