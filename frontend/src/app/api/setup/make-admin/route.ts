import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase-server";
import { createAdmin } from "@/lib/supabase-admin";
import { DEFAULT_PERMISSIONS, getAllTruePermissions } from "@/lib/permissions";

/**
 * POST /api/setup/make-admin
 * 
 * Promouvoir l'utilisateur connecté en administrateur.
 * Sécurisé par le SECRET_KEY du fichier .env.
 * 
 * Body: { secret: "votre-secret-key" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret } = body;

    // Vérifier le secret (celui du .env racine ou un secret dédié)
    const expectedSecret = process.env.SECRET_KEY || process.env.SETUP_SECRET_KEY;
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: "Secret invalide" }, { status: 403 });
    }

    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Vous devez être connecté pour utiliser cette API." },
        { status: 401 }
      );
    }

    const admin = createAdmin();

    // Vérifier s'il existe déjà un admin
    const { data: existingAdmins } = await admin
      .from("user_permissions")
      .select("user_id")
      .eq("is_admin", true);

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json({
        error: "Un administrateur existe déjà dans la base.",
        message: "Un admin peut ajouter des utilisateurs et gérer les permissions depuis /admin/users",
      }, { status: 409 });
    }

    // Promouvoir l'utilisateur en admin
    const { error: upsertError } = await admin
      .from("user_permissions")
      .upsert({
        user_id: user.id,
        is_admin: true,
        permissions: getAllTruePermissions(),
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${user.email} est maintenant administrateur. Vous pouvez gérer les utilisateurs depuis /admin/users`,
    });
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
