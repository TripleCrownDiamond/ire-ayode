"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AppSidebar } from "./app-sidebar";
import { RefreshCw } from "lucide-react";

const AUTH_PATHS = ["/login", "/register", "/auth/callback"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, user, canRead } = useAuth();
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Pages auth : pas de sidebar, pas de wrapper principal
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Loader pendant le chargement de l'auth
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10">
            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Non connecté (ne devrait pas arriver car le middleware redirige)
  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Vous devez être connecté.</p>
          <a href="/login" className="text-primary underline text-sm">
            Se connecter
          </a>
        </div>
      </div>
    );
  }

  // Vérifier si l'utilisateur a au moins une permission
  const hasAnyPermission = ["dashboard", "forms", "map", "admin"].some((m) =>
    canRead(m as any)
  );

  // Aucune permission → accès refusé
  if (!hasAnyPermission) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-xl font-semibold">Accès refusé</h1>
          <p className="text-muted-foreground">
            Vous n&apos;avez pas les permissions nécessaires pour accéder à cette plateforme.
            Contactez un administrateur.
          </p>
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = "/login";
            }}
            className="inline-block text-sm text-primary underline"
          >
            Se déconnecter
          </a>
        </div>
      </div>
    );
  }

  // Pages app : sidebar + main content
  return (
    <>
      <AppSidebar />
      <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
        <div className="p-3 sm:p-4 md:p-6 max-w-screen-2xl mx-auto">{children}</div>
      </main>
    </>
  );
}
