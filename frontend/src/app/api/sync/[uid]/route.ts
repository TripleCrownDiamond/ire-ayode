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

    return NextResponse.json({
      status: "success",
      result: {
        submissions_synced: synced,
        total: subs.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
