import { NextResponse, type NextRequest } from "next/server";
import { getDeletedSubmissions } from "@/lib/data";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * Corbeille : soumissions retirées par un utilisateur.
 * Elles restent en base et peuvent être restaurées via
 * POST /api/submissions/<id>?action=restore
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Reserve aux administrateurs" }, { status: 403 });
    }
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 100, 500);
    const results = await getDeletedSubmissions(limit);
    return NextResponse.json({ count: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
