"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Map, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/forms", label: "Formulaires", icon: FileText },
  { href: "/map", label: "Carte", icon: Map },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-60 border-r bg-white flex flex-col">
      <div className="flex h-14 items-center border-b px-5 gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
          <RefreshCw className="h-4 w-4" />
        </div>
        <div>
          <span className="font-bold text-sm">Ire Ayode</span>
          <span className="block text-[10px] text-muted-foreground leading-none mt-0.5">
            Plateforme agricole
          </span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Connecte
        </div>
      </div>
    </aside>
  );
}
