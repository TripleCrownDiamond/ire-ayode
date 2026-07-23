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

  // Lire is_admin et is_active séparément pour résister à une colonne manquante
  const { data: perms } = await admin
    .from("user_permissions")
    .select("is_admin, permissions")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: activeRow } = await admin
    .from("user_permissions")
    .select("is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  const isActive = activeRow?.is_active !== false;

  if (!isActive) {
    return NextResponse.json({ error: "Compte suspendu" }, { status: 403 });
  }

  return NextResponse.json({
    is_admin: perms?.is_admin ?? false,
    permissions: perms?.permissions ?? DEFAULT_PERMISSIONS,
  });
}
