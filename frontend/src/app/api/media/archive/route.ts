import { NextResponse, type NextRequest } from "next/server";
import { createAdmin } from "@/lib/supabase-admin";
import { archivePendingMedia } from "@/lib/media-archive";
import { requireUser } from "@/lib/auth-guard";

/**
 * Archivage des médias Kobo dans Supabase Storage.
 *
 * À appeler par lots : les fonctions Vercel Hobby sont coupées à 60 s.
 * La réponse indique combien de soumissions restent à traiter — relancer
 * jusqu'à `done: true` pour un rattrapage complet de l'historique.
 *
 *   POST /api/media/archive?limit=25[&form=<uid>]
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit")) || 25, 1),
      200
    );
    const formUid = request.nextUrl.searchParams.get("form") || undefined;

    const supabase = createAdmin();
    const result = await archivePendingMedia(supabase, { limit, formUid });

    return NextResponse.json({ status: "success", ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** État de l'archivage : combien de soumissions ont déjà leur copie locale. */
export async function GET() {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const supabase = createAdmin();

    const [{ count: total }, { count: pending }, { count: files }] = await Promise.all([
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .is("media_archived_at", null)
        .is("deleted_at", null),
      supabase
        .from("attachments")
        .select("id", { count: "exact", head: true })
        .not("storage_path", "is", null),
    ]);

    return NextResponse.json({
      submissions_total: total ?? 0,
      submissions_pending: pending ?? 0,
      submissions_archived: (total ?? 0) - (pending ?? 0),
      files_archived: files ?? 0,
      done: (pending ?? 0) === 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
