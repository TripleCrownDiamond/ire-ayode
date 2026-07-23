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

  // Une seule requête simple — pas de is_active pour l'instant
  const { data: perms, error } = await admin
    .from("user_permissions")
    .select("is_admin, permissions")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[/api/admin/users/me]", error.message);
    return NextResponse.json({
      is_admin: false,
      permissions: DEFAULT_PERMISSIONS,
    });
  }

  return NextResponse.json({
    is_admin: !!perms?.is_admin,
    permissions: perms?.permissions ?? DEFAULT_PERMISSIONS,
  });
}
