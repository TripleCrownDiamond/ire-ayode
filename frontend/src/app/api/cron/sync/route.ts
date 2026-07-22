import { NextResponse } from "next/server";
import { syncAllForms } from "@/lib/data";

/**
 * Route CRON pour synchronisation automatique KoboToolbox.
 * Appelée par Vercel Cron toutes les 15 minutes.
 * Protégée par CRON_SECRET (Authorization: Bearer <token>).
 * ⚠️ Attention : le plan Hobby Vercel limite les fonctions à 60s.
 * Si la sync dépasse, elle sera interrompue.
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  // --- Validation du CRON_SECRET ---
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré sur le serveur" },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { error: "Non autorisé — CRON_SECRET invalide ou manquant" },
      { status: 401 }
    );
  }

  // --- Vérification Kobo configuré ---
  if (!process.env.KOBO_API_TOKEN) {
    return NextResponse.json(
      { error: "KOBO_API_TOKEN non configuré" },
      { status: 500 }
    );
  }

  // --- Exécution de la synchronisation ---
  try {
    const result = await syncAllForms();

    return NextResponse.json({
      status: "success",
      cron: true,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json(
      {
        status: "error",
        cron: true,
        timestamp: new Date().toISOString(),
        error: message,
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
