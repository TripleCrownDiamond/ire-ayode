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

/**
 * Droits d'un compte.
 *
 * `is_admin` et `is_active` sont lus séparément : une colonne absente ou
 * fraîchement ajoutée ne doit jamais faire perdre ses droits à un
 * administrateur. Une seule requête groupée sur les deux colonnes échouait
 * entièrement quand `is_active` manquait, et rétrogradait tout le monde en
 * simple utilisateur — la suppression d'un formulaire répondait alors 403.
 */
async function readPermissions(
  userId: string
): Promise<{ isAdmin: boolean; isActive: boolean }> {
  const admin = createAdmin();

  // 1. Le droit administrateur — l'information essentielle
  let isAdmin = false;
  try {
    const { data, error } = await admin
      .from("user_permissions")
      .select("is_admin")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[auth-guard] lecture de is_admin impossible :", error.message);
    } else {
      isAdmin = !!data?.is_admin;
    }
  } catch (e) {
    console.error("[auth-guard] user_permissions inaccessible :", e);
  }

  // 2. La désactivation du compte — facultative : une colonne absente
  //    signifie « aucun compte n'a jamais été désactivé ».
  let isActive = true;
  try {
    const { data, error } = await admin
      .from("user_permissions")
      .select("is_active")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data && data.is_active === false) isActive = false;
  } catch {
    // colonne absente sur une base antérieure — voir migration 007
  }

  return { isAdmin, isActive };
}

/** Utilisateur de la session courante, ou null si non connecté ou désactivé. */
export async function requireUser(): Promise<AuthedUser | null> {
  try {
    const supabase = await createServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { isAdmin, isActive } = await readPermissions(user.id);
    if (!isActive) return null;

    return { id: user.id, email: user.email || user.id, isAdmin };
  } catch (e) {
    console.error("[auth-guard] session illisible :", e);
    return null;
  }
}

/** Utilisateur administrateur, ou null. */
export async function requireAdmin(): Promise<AuthedUser | null> {
  const user = await requireUser();
  return user?.isAdmin ? user : null;
}
