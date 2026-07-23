"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, type Module } from "@/context/auth-context";
import {
  LayoutDashboard,
  FileText,
  Map,
  RefreshCw,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  UserCircle,
  Database,
  Users,
  Trees,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links: { href: string; label: string; icon: React.ElementType; module: Module }[] = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, module: "dashboard" },
  { href: "/forms", label: "Formulaires", icon: FileText, module: "forms" },
  { href: "/producteurs", label: "Producteurs", icon: Users, module: "forms" },
  { href: "/parcelles", label: "Parcelles", icon: Trees, module: "forms" },
  { href: "/map", label: "Carte", icon: Map, module: "map" },
  { href: "/admin/users", label: "Utilisateurs", icon: ShieldCheck, module: "admin" },
  { href: "/admin/data", label: "Données & archivage", icon: Database, module: "admin" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAdmin, canRead, signOut, refreshPermissions } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Fermer le menu quand on change de page
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Bloquer le scroll quand le menu mobile est ouvert
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Si pas encore chargé ou pas connecté, ne pas afficher la sidebar
  if (loading || !user) return null;

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.push("/login");
  };

  // Filtrer les liens selon les permissions — Tableau de bord toujours visible
  const visibleLinks = links.filter((link) => {
    if (link.href === "/") return true; // toujours visible
    if (link.href.startsWith("/admin")) {
      return canRead("admin");
    }
    return canRead(link.module);
  });

  return (
    <>
      {/* Bouton hamburger flottant (mobile uniquement) */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 md:hidden flex items-center justify-center h-9 w-9 rounded-lg bg-white border shadow-md hover:bg-muted transition-colors"
        aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay (mobile uniquement) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 border-r bg-white flex flex-col transition-transform duration-300 ease-in-out",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center border-b px-5 gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground shrink-0">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sm block truncate">Ire Ayode</span>
            <span className="block text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
              Plateforme agricole
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer — user info + logout */}
        <div className="border-t p-3 space-y-2">
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors",
              pathname === "/profile"
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted"
            )}
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary shrink-0">
              <UserCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{user.email}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {isAdmin ? "Administrateur" : "Utilisateur"}
              </p>
            </div>
          </Link>
          <button
            onClick={() => refreshPermissions()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span>Actualiser les permissions</span>
          </button>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{signingOut ? "Déconnexion..." : "Se déconnecter"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
