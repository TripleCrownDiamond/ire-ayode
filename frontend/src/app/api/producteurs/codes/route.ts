import { NextResponse, type NextRequest } from "next/server";
import {
  listIncompleteProducers,
  recalculateAllCodes,
  recalculateProducerCode,
} from "@/lib/producers-db";
import { requireUser } from "@/lib/auth-guard";

/**
 * Codes producteurs incomplets (« XX » à la place de la commune et/ou de la
 * coopérative) et leur recalcul.
 *
 *   GET  /api/producteurs/codes            → liste, avec l'état de chacun
 *   POST /api/producteurs/codes            → recalcule tous ceux qui le peuvent
 *   POST /api/producteurs/codes?id=<id>    → recalcule un producteur précis
 */
export async function GET() {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const producers = await listIncompleteProducers();

    return NextResponse.json({
      count: producers.length,
      // Ceux dont la commune ou la coopérative est arrivée depuis
      recalculable: producers.filter((p: any) => p.can_recalculate).length,
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

    const id = Number(request.nextUrl.searchParams.get("id")) || null;

    if (id) {
      const { result, reason } = await recalculateProducerCode(id, user.email);
      if (!result) {
        return NextResponse.json(
          { error: reason || "Recalcul impossible" },
          { status: 400 }
        );
      }
      return NextResponse.json({ status: "ok", ...result });
    }

    const { updated, still_incomplete } = await recalculateAllCodes(user.email);
    return NextResponse.json({
      status: "ok",
      updated_count: updated.length,
      still_incomplete,
      updated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
