import { NextResponse } from "next/server";
import { createServer } from "@/lib/supabase-server";
import { createAdmin } from "@/lib/supabase-admin";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdmin();

  // Requête 1 : is_admin + permissions (peut échouer si la table est vide)
  const { data: perms } = await admin
    .from("user_permissions")
    .select("is_admin, permissions")
    .eq("user_id", user.id)
    .maybeSingle();

  // Requête 2 : is_active séparément (colonne peut être absente)
  let isActive = true;
  try {
    const { data: activeRow } = await admin
      .from("user_permissions")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (activeRow && activeRow.is_active === false) {
      isActive = false;
    }
  } catch {
    // Colonne is_active absente — on considère le compte actif
  }

  if (!isActive) {
    return NextResponse.json({ error: "Compte suspendu" }, { status: 403 });
  }

  return NextResponse.json({
    is_admin: !!perms?.is_admin,
    permissions: perms?.permissions ?? DEFAULT_PERMISSIONS,
  });
}
