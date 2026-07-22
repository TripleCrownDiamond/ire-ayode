import { NextResponse } from "next/server";
import { getSubmission, updateSubmissionStatus, getSubmissionValidation } from "@/lib/data";

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

    // Enrichir avec les infos de validation (fallback fichier JSON si pas Supabase)
    if (!sub.validated) {
      const validation = await getSubmissionValidation(Number(id));
      if (validation) {
        sub.validated = validation.validated;
        sub.notes = validation.notes;
      }
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
