// Garde d'authentification pour les routes API.
//
// Le middleware Next laisse passer tout /api sans vérification : chaque route
// sensible doit donc valider la session elle-même.

import { createServer } from "./supabase-server";
import { createAdmin } from "./supabase-admin";

export interface AuthedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

/** Utilisateur de la session courante, ou null si non connecté. */
export async function requireUser(): Promise<AuthedUser | null> {
  try {
    const supabase = await createServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    let isAdmin = false;
    try {
      const admin = createAdmin();
      const { data } = await admin
        .from("user_permissions")
        .select("is_admin, is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      // Un compte désactivé n'a plus aucun droit
      if (data && data.is_active === false) return null;
      isAdmin = !!data?.is_admin;
    } catch {
      // Table indisponible : on garde l'utilisateur sans droits admin
    }

    return { id: user.id, email: user.email || user.id, isAdmin };
  } catch {
    return null;
  }
}

/** Utilisateur administrateur, ou null. */
export async function requireAdmin(): Promise<AuthedUser | null> {
  const user = await requireUser();
  return user?.isAdmin ? user : null;
}
