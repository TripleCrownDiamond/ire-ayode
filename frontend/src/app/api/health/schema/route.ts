import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth-guard";

/**
 * Diagnostic de schéma.
 *
 * Répond à la question « la base déployée est-elle à jour ? » sans avoir à
 * deviner : chaque fonctionnalité indique la colonne ou la table dont elle
 * dépend, et si celle-ci répond.
 *
 * Utile après un déploiement : un déploiement Vercel ne touche pas la base,
 * donc un écart ici vient d'une migration jamais appliquée, pas du déploiement.
 */

/** Ce que chaque migration apporte, et comment le vérifier. */
const CHECKS: {
  migration: string;
  feature: string;
  table: string;
  column?: string;
}[] = [
  { migration: "001", feature: "Formulaires et soumissions", table: "forms", column: "uid" },
  { migration: "001", feature: "Permissions utilisateurs", table: "user_permissions", column: "is_admin" },
  { migration: "002", feature: "Suppression logique des soumissions", table: "submissions", column: "deleted_at" },
  { migration: "002", feature: "Suivi de présence sur Kobo", table: "submissions", column: "missing_on_kobo" },
  { migration: "002", feature: "Archivage local des médias", table: "attachments", column: "storage_path" },
  { migration: "003", feature: "Suppression des formulaires", table: "forms", column: "deleted_at" },
  { migration: "004", feature: "Référentiel producteurs", table: "producers", column: "code" },
  { migration: "004", feature: "Rattachement des soumissions", table: "submissions", column: "producer_id" },
  { migration: "005", feature: "Codes commune + coopérative", table: "producers", column: "code_prefix" },
  { migration: "005", feature: "Registre des parcelles", table: "parcels", column: "code" },
  { migration: "006", feature: "Recalcul des codes incomplets", table: "producers", column: "previous_codes" },
];

export async function GET() {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const supabase = createAdmin();

    // Migrations enregistrées, si la table de suivi existe
    let recorded: string[] = [];
    let trackingAvailable = true;
    const { data: applied, error: trackingError } = await supabase
      .from("schema_migrations")
      .select("version, applied_at")
      .order("version");

    if (trackingError) {
      trackingAvailable = false;
    } else {
      recorded = (applied || []).map((r: any) => r.version);
    }

    // Vérification réelle : la colonne répond-elle ?
    const results = [];
    for (const check of CHECKS) {
      const { error } = await supabase
        .from(check.table)
        .select(check.column || "*")
        .limit(1);

      results.push({
        ...check,
        ok: !error,
        error: error?.message,
      });
    }

    const missing = results.filter((r) => !r.ok);
    const missingMigrations = [...new Set(missing.map((m) => m.migration))].sort();

    return NextResponse.json({
      up_to_date: missing.length === 0,
      checks_passed: results.length - missing.length,
      checks_total: results.length,
      missing_migrations: missingMigrations,
      // La table de suivi permet à `npm run migrate` de n'appliquer que le manquant
      tracking_available: trackingAvailable,
      recorded_migrations: recorded,
      hint: missing.length
        ? `Migrations à appliquer : ${missingMigrations.join(", ")}. Lancez « npm run migrate ».`
        : "Le schéma est à jour.",
      details: results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
