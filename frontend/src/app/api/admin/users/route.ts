import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase-server";
import { createAdmin } from "@/lib/supabase-admin";
import { DEFAULT_PERMISSIONS, MODULES } from "@/lib/permissions";

// GET /api/admin/users → liste des utilisateurs (admin only)
export async function GET() {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdmin();

  // Vérifier si l'utilisateur est admin
  const { data: currentPerms } = await admin
    .from("user_permissions")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();

  if (!currentPerms?.is_admin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Récupérer tous les utilisateurs auth + leurs permissions
  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // `is_active` est lue à part : sur une base antérieure à la migration 007
  // la colonne peut manquer, et une requête groupée échouerait entièrement —
  // la liste des utilisateurs apparaîtrait alors vide de tout droit.
  const { data: allPerms } = await admin
    .from("user_permissions")
    .select("user_id, is_admin, permissions");

  const { data: activeRows } = await admin
    .from("user_permissions")
    .select("user_id, is_active");

  const activeMap = new Map(
    (activeRows ?? []).map((r: { user_id: string; is_active: boolean }) => [
      r.user_id,
      r.is_active,
    ])
  );

  const permsMap = new Map(
    (allPerms ?? []).map((p) => [p.user_id, { ...p, is_active: activeMap.get(p.user_id) }])
  );

  const users = (authUsers?.users ?? []).map((u) => {
    const p = permsMap.get(u.id);
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      is_admin: p?.is_admin ?? false,
      is_active: p?.is_active ?? true,
      permissions: p?.permissions ?? DEFAULT_PERMISSIONS,
    };
  });

  return NextResponse.json({ users });
}

// POST /api/admin/users — créer un utilisateur (admin only)
export async function POST(request: NextRequest) {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdmin();

  // Vérifier admin
  const { data: currentPerms } = await admin
    .from("user_permissions")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();

  if (!currentPerms?.is_admin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, is_admin, permissions } = body;

  // Créer l'utilisateur dans Supabase Auth
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Définir les permissions (le trigger on_auth_user_created a déjà créé une entrée)
  const permsToSet = permissions ?? DEFAULT_PERMISSIONS;
  await admin
    .from("user_permissions")
    .upsert({
      user_id: newUser.user.id,
      is_admin: is_admin ?? false,
      permissions: permsToSet,
      updated_at: new Date().toISOString(),
    });

  return NextResponse.json({ success: true, user: { id: newUser.user.id, email } });
}

// PATCH /api/admin/users?id=xxx — modifier un utilisateur
export async function PATCH(request: NextRequest) {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdmin();

  // Vérifier admin
  const { data: currentPerms } = await admin
    .from("user_permissions")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();

  if (!currentPerms?.is_admin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const url = new URL(request.url);
  const targetId = url.searchParams.get("id");
  if (!targetId) {
    return NextResponse.json({ error: "Paramètre id requis" }, { status: 400 });
  }

  const body = await request.json();

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.is_admin !== undefined) {
    updateData.is_admin = body.is_admin;
    // Si admin, donner toutes les permissions
    if (body.is_admin) {
      updateData.permissions = Object.fromEntries(
        MODULES.map((m) => [m.key, { read: true, edit: true }])
      );
    }
  }

  if (body.is_active !== undefined) {
    updateData.is_active = body.is_active;
    // Si on suspend, on désactive toutes les permissions
    if (!body.is_active) {
      updateData.permissions = Object.fromEntries(
        MODULES.map((m) => [m.key, { read: false, edit: false }])
      );
    }
  }

  if (body.permissions) {
    // Fusionner avec les permissions existantes
    const { data: existing } = await admin
      .from("user_permissions")
      .select("permissions")
      .eq("user_id", targetId)
      .single();

    const merged = { ...(existing?.permissions as Record<string, unknown> ?? {}), ...body.permissions };
    updateData.permissions = merged;
  }

  const { error } = await admin
    .from("user_permissions")
    .update(updateData)
    .eq("user_id", targetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/users?id=xxx — supprimer un utilisateur
export async function DELETE(request: NextRequest) {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdmin();

  // Vérifier admin
  const { data: currentPerms } = await admin
    .from("user_permissions")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();

  if (!currentPerms?.is_admin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const url = new URL(request.url);
  const targetId = url.searchParams.get("id");
  if (!targetId) {
    return NextResponse.json({ error: "Paramètre id requis" }, { status: 400 });
  }

  // Empêcher la suppression de soi-même
  if (targetId === user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 });
  }

  // Supprimer les permissions d'abord
  await admin.from("user_permissions").delete().eq("user_id", targetId);

  // Supprimer l'utilisateur de Supabase Auth
  const { error } = await admin.auth.admin.deleteUser(targetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
