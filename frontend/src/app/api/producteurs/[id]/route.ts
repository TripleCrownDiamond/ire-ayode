import { NextResponse } from "next/server";
import { getProducerWithSubmissions } from "@/lib/producers-db";
import { requireUser } from "@/lib/auth-guard";
import { createAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const { id } = await params;
    const producer = await getProducerWithSubmissions(Number(id));
    if (!producer) {
      return NextResponse.json({ error: "Producteur introuvable" }, { status: 404 });
    }
    return NextResponse.json(producer);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Met à jour la fiche d'identité d'un producteur. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Le code est l'identifiant : il ne se modifie pas par cette route,
    // sous peine de casser les rattachements existants.
    const patch: Record<string, string> = {};
    for (const field of [
      "name", "phone", "genre", "commune", "village", "cooperative", "notes",
    ]) {
      if (typeof body[field] === "string") patch[field] = body[field].trim();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Aucun champ modifiable fourni" }, { status: 400 });
    }

    const supabase = createAdmin();
    const { data, error } = await supabase
      .from("producers")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", producer: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Retire un producteur du référentiel. Ses fiches sont détachées, jamais supprimées. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdmin();

    const { count } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("producer_id", Number(id));

    // Les soumissions redeviennent « à rattacher » — leurs données restent intactes
    await supabase
      .from("submissions")
      .update({
        producer_id: null,
        producer_source: null,
        producer_linked_at: null,
        producer_linked_by: null,
      })
      .eq("producer_id", Number(id));

    const { error } = await supabase
      .from("producers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", Number(id));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", deleted: true, submissions_unlinked: count ?? 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
