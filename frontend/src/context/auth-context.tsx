"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { DEFAULT_PERMISSIONS, type Module, type UserPermissions } from "@/lib/permissions";

export type { Module, UserPermissions, ModulePermissions } from "@/lib/permissions";

interface AuthState {
  user: User | null;
  loading: boolean;
  permissions: UserPermissions;
  isAdmin: boolean;
  canRead: (module: Module) => boolean;
  canEdit: (module: Module) => boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  const supabase = createClient();

  const refreshPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users/me");
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions || DEFAULT_PERMISSIONS);
        setIsAdmin(data.is_admin || false);
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
        setIsAdmin(false);
      }
    } catch {
      setPermissions(DEFAULT_PERMISSIONS);
      setIsAdmin(false);
    }
    setPermissionsLoaded(true);
  }, []);

  // Recharger les permissions à chaque changement de page
  useEffect(() => {
    if (user && permissionsLoaded) {
      refreshPermissions();
    }
  }, [pathname]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await refreshPermissions();
      } else {
        setPermissionsLoaded(true);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await refreshPermissions();
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
        setIsAdmin(false);
        setPermissionsLoaded(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const canRead = useCallback(
    (module: Module) => {
      if (isAdmin) return true;
      return permissions[module]?.read ?? false;
    },
    [isAdmin, permissions]
  );

  const canEdit = useCallback(
    (module: Module) => {
      if (isAdmin) return true;
      return permissions[module]?.edit ?? false;
    },
    [isAdmin, permissions]
  );

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPermissions(DEFAULT_PERMISSIONS);
    setIsAdmin(false);
    setPermissionsLoaded(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: loading || !permissionsLoaded,
        permissions,
        isAdmin,
        canRead,
        canEdit,
        signIn,
        signUp,
        signOut,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
