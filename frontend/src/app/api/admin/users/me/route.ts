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

  const { data: perms, error } = await admin
    .from("user_permissions")
    .select("is_admin, permissions, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  // Si la ligne n'existe pas encore (trigger pas encore firing), on renvoie les défauts
  if (error || !perms) {
    return NextResponse.json({
      is_admin: false,
      permissions: DEFAULT_PERMISSIONS,
    });
  }

  // Compte suspendu
  if (perms.is_active === false) {
    return NextResponse.json({ error: "Compte suspendu" }, { status: 403 });
  }

  return NextResponse.json({
    is_admin: !!perms.is_admin,
    permissions: perms.permissions ?? DEFAULT_PERMISSIONS,
  });
}
