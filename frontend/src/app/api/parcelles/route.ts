import { NextResponse, type NextRequest } from "next/server";
import { listParcels, syncParcels } from "@/lib/parcels-db";
import { requireUser } from "@/lib/auth-guard";

/**
 * Registre des parcelles.
 *
 *   GET  /api/parcelles[?producer=<id>][&q=recherche]
 *   POST /api/parcelles?action=sync[&producer=<id>]
 *        → (re)construit le registre à partir des soumissions rattachées
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const producerId = Number(request.nextUrl.searchParams.get("producer")) || undefined;
    const search = request.nextUrl.searchParams.get("q") || undefined;

    const results = await listParcels({ producerId, search });

    const totalArea = results.reduce(
      (sum: number, p: any) => sum + (Number(p.area_ha) || 0),
      0
    );

    return NextResponse.json({
      count: results.length,
      total_area_ha: Number(totalArea.toFixed(4)),
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    if (request.nextUrl.searchParams.get("action") !== "sync") {
      return NextResponse.json(
        { error: "Action inconnue. Utilisez ?action=sync" },
        { status: 400 }
      );
    }

    const producerId = Number(request.nextUrl.searchParams.get("producer")) || undefined;
    const result = await syncParcels({ producerId });

    return NextResponse.json({ status: "ok", ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
