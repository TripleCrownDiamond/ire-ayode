import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Platform-Ire Ayode",
  description: "Sync KoboToolbox & Dashboard agricole",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-background" suppressHydrationWarning>
        <AppSidebar />
        <main className="ml-64 min-h-screen">
          <div className="p-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
