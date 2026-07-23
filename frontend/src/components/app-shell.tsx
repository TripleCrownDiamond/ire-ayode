"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AppSidebar } from "./app-sidebar";
import { RefreshCw } from "lucide-react";

const AUTH_PATHS = ["/login", "/register", "/auth/callback"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, user } = useAuth();
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Pages auth : pas de sidebar, pas de wrapper principal
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Loader pendant le chargement de l'auth
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Chargement en cours...</p>
        </div>
      </div>
    );
  }

  // Non connecté (ne devrait pas arriver car le middleware redirige)
  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Redirection...</p>
        </div>
      </div>
    );
  }

  // Pages app : sidebar + main content (toujours affiché)
  return (
    <>
      <AppSidebar />
      <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
        <div className="p-3 sm:p-4 md:p-6 max-w-screen-2xl mx-auto">{children}</div>
      </main>
    </>
  );
}
