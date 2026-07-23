import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase-server";
import { createAdmin } from "@/lib/supabase-admin";

// GET /api/profile — récupérer les infos du profil
export async function GET() {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdmin();

  // Récupérer les permissions
  const { data: perms } = await admin
    .from("user_permissions")
    .select("is_admin, permissions")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    is_admin: perms?.is_admin ?? false,
    permissions: perms?.permissions ?? {},
  });
}

// PATCH /api/profile — modifier le profil (email ou mot de passe)
export async function PATCH(request: NextRequest) {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const admin = createAdmin();

  // Changer l'email
  if (body.email && body.email !== user.email) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email: body.email,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  // Changer le mot de passe
  if (body.password) {
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères." },
        { status: 400 }
      );
    }
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: body.password,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/profile — supprimer son propre compte
export async function DELETE() {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdmin();

  // Vérifier si c'est le dernier admin
  const { data: admins } = await admin
    .from("user_permissions")
    .select("user_id")
    .eq("is_admin", true);

  if (admins && admins.length <= 1) {
    return NextResponse.json(
      { error: "Vous êtes le dernier administrateur. Vous ne pouvez pas supprimer votre compte." },
      { status: 400 }
    );
  }

  // Supprimer les permissions
  await admin.from("user_permissions").delete().eq("user_id", user.id);

  // Supprimer l'utilisateur
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
