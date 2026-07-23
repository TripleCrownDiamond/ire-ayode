import { NextResponse } from "next/server";
import { getForm, deleteForm, restoreForm } from "@/lib/data";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const form = await getForm(uid);
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }
    return NextResponse.json(form);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Supprime un formulaire et toutes ses soumissions.
 * Proposé quand le formulaire a disparu de KoboToolbox, jamais automatique.
 * Suppression logique : tout reste restaurable depuis la corbeille.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Reserve aux administrateurs" }, { status: 403 });
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = typeof body?.reason === "string" ? body.reason : undefined;
    } catch {
      // corps vide — motif facultatif
    }

    const result = await deleteForm(uid, admin.email, reason);
    if ("error" in result) {
      // La cause réelle est remontée telle quelle : un échec technique ne doit
      // pas se déguiser en « formulaire introuvable ».
      const notFound = /introuvable|déjà supprimé/i.test(result.error);
      return NextResponse.json({ error: result.error }, { status: notFound ? 404 : 500 });
    }

    return NextResponse.json({
      status: "ok",
      uid,
      deleted: true,
      submissions_deleted: result.submissions,
      deleted_by: admin.email,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Restaure un formulaire supprimé, avec ses soumissions. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const url = new URL(request.url);
    if (url.searchParams.get("action") !== "restore") {
      return NextResponse.json(
        { error: "Action inconnue. Utilisez ?action=restore" },
        { status: 400 }
      );
    }

    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Reserve aux administrateurs" }, { status: 403 });
    }

    const ok = await restoreForm(uid, admin.email);
    if (!ok) {
      return NextResponse.json({ error: "Restauration impossible" }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", uid, restored: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
