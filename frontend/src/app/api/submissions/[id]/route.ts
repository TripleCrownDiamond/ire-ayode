import { NextResponse } from "next/server";
import {
  getSubmission,
  updateSubmissionStatus,
  deleteSubmission,
  restoreSubmission,
} from "@/lib/data";
import { requireUser } from "@/lib/auth-guard";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sub = await getSubmission(Number(id));
    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json(sub);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { validated, notes } = body;

    if (!["pending", "valid", "needs_revision", "rejected"].includes(validated)) {
      return NextResponse.json(
        { error: "Statut invalide. Utilisez: pending, valid, needs_revision, rejected" },
        { status: 400 }
      );
    }

    const success = await updateSubmissionStatus(Number(id), validated, notes);
    if (!success) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", validated, notes });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Suppression d'une soumission — la seule opération qui retire une donnée
 * de la plateforme. La synchronisation Kobo, elle, n'efface jamais rien.
 * La ligne est conservée en base (suppression logique) et peut être
 * restaurée via POST ?action=restore.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = typeof body?.reason === "string" ? body.reason : undefined;
    } catch {
      // corps vide — la raison est facultative
    }

    const success = await deleteSubmission(Number(id), user.email, reason);
    if (!success) {
      return NextResponse.json(
        { error: "Soumission introuvable ou deja supprimee" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "ok",
      id: Number(id),
      deleted: true,
      deleted_by: user.email,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Restauration d'une soumission supprimée par erreur. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    if (url.searchParams.get("action") !== "restore") {
      return NextResponse.json(
        { error: "Action inconnue. Utilisez ?action=restore" },
        { status: 400 }
      );
    }

    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const success = await restoreSubmission(Number(id), user.email);
    if (!success) {
      return NextResponse.json({ error: "Restauration impossible" }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", id: Number(id), restored: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
