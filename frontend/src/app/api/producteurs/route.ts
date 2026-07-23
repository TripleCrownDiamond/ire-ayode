import { NextResponse, type NextRequest } from "next/server";
import { listProducers, createProducer, autoLinkFromCodes } from "@/lib/producers-db";
import { requireUser } from "@/lib/auth-guard";
import { createAdmin } from "@/lib/supabase-admin";

/**
 * Référentiel des producteurs.
 *
 *   GET  /api/producteurs[?q=recherche]  → liste avec le nombre de fiches
 *   POST /api/producteurs                → crée un producteur
 *        body { code?, name, phone… }    code omis → attribué par la plateforme
 *   POST /api/producteurs?action=autolink → rattache les fiches porteuses d'un code
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get("q") || undefined;
    const producers = await listProducers({ search });

    // Fiches non rattachées : ce sont celles qui attendent une décision
    const supabase = createAdmin();
    const { count: unlinked } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .is("producer_id", null)
      .is("deleted_at", null);

    return NextResponse.json({
      count: producers.length,
      unlinked_submissions: unlinked ?? 0,
      results: producers,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    // Rattachement automatique des fiches dont le formulaire porte un code
    if (request.nextUrl.searchParams.get("action") === "autolink") {
      const formUid = request.nextUrl.searchParams.get("form") || undefined;
      const result = await autoLinkFromCodes({ formUid });
      return NextResponse.json({ status: "ok", ...result });
    }

    const body = await request.json().catch(() => ({}));
    if (!body.name?.trim() && !body.code?.trim()) {
      return NextResponse.json(
        { error: "Un nom ou un code est requis" },
        { status: 400 }
      );
    }

    const result = await createProducer(
      body,
      body.code?.trim() ? "kobo" : "plateforme",
      user.email
    );
    if (!result) {
      return NextResponse.json({ error: "Creation impossible" }, { status: 500 });
    }

    return NextResponse.json(
      { status: "ok", created: result.created, producer: result.producer },
      { status: result.created ? 201 : 200 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
