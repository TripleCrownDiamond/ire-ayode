import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { createAdmin } from "@/lib/supabase-admin";

/**
 * Soumissions non rattachées à un producteur.
 * Ce sont celles dont le formulaire ne porte pas de code producteur : elles
 * attendent une décision humaine, aucun rapprochement n'est deviné.
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 100, 500);
    const formUid = request.nextUrl.searchParams.get("form");

    const supabase = createAdmin();
    let query = supabase
      .from("submissions")
      .select("id, kobo_id, form_uid, submitted_at, validated, data", { count: "exact" })
      .is("producer_id", null)
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false })
      .limit(limit);

    if (formUid) query = query.eq("form_uid", formUid);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const uids = [...new Set((data || []).map((s: any) => s.form_uid).filter(Boolean))];
    const { data: forms } = uids.length
      ? await supabase.from("forms").select("uid, name").in("uid", uids)
      : { data: [] };
    const formNames = new Map((forms || []).map((f: any) => [f.uid, f.name]));

    return NextResponse.json({
      count: count ?? 0,
      results: (data || []).map((s: any) => ({
        ...s,
        form_name: formNames.get(s.form_uid) || s.form_uid,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
