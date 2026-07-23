import { NextResponse } from "next/server";
import { KoboClient } from "@/lib/kobo";
import { syncSubmissionsToDB } from "@/lib/data";

const kobo = new KoboClient();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;

    const subsData = await kobo.getSubmissions(uid);
    const subs = (subsData.results || []).map((s) => ({
      id: s._id,
      kobo_id: String(s._id || ""),
      form_uid: uid,
      submitted_by: s._submitted_by || "",
      submitted_at: s._submission_time || null,
      data: s as unknown as Record<string, unknown>,
    }));

    const synced = await syncSubmissionsToDB(uid, subs);

    // Copie locale des médias du formulaire — bornée en durée pour tenir
    // dans la limite de 60 s des fonctions Vercel Hobby.
    let media;
    try {
      const { archivePendingMedia } = await import("@/lib/media-archive");
      const { createAdmin } = await import("@/lib/supabase-admin");
      media = await archivePendingMedia(createAdmin(), {
        limit: 30,
        formUid: uid,
        timeBudgetMs: 35_000,
      });
    } catch {
      // Archivage indisponible : la synchronisation des données reste valide
    }

    return NextResponse.json({
      status: "success",
      result: {
        submissions_synced: synced.inserted,
        // Disparues de Kobo : conservées ici, simplement signalées
        submissions_missing_on_kobo: synced.missing,
        submissions_reappeared: synced.reappeared,
        total: subs.length,
        media,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
