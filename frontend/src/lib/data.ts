// =============================================================
// Couche d'accès aux données — Supabase uniquement
// =============================================================

import { KoboClient } from "./kobo";

// ---- Types ----

export interface DBForm {
  uid: string;
  name: string;
  owner: string;
  has_deployment: boolean;
  deployment_active: boolean;
  submission_count: number;
  last_submission_time: string | null;
  date_created: string | null;
  date_modified: string | null;
  status: string;
}

export interface DBSubmission {
  id: number;
  kobo_id: string;
  form_uid: string;
  submitted_by: string;
  submitted_at: string | null;
  data: Record<string, unknown>;
  validated?: string;
  notes?: string;
  /** Supprimée explicitement par un utilisateur (NULL = active) */
  deleted_at?: string | null;
  deleted_by?: string | null;
  /** N'existe plus sur KoboToolbox — conservée localement */
  missing_on_kobo?: boolean;
  kobo_last_seen_at?: string | null;
  media_archived_at?: string | null;
  media_count?: number;
  /** Producteur rattaché (jointure) */
  producer?: {
    id: number;
    code: string;
    name: string;
    commune?: string;
  } | null;
  producer_id?: number | null;
  producer_source?: string | null;
}

export interface DBSyncLog {
  form_uid?: string;
  action: string;
  count: number;
  time: string;
  details?: Record<string, unknown>;
}

// ---- Lazy Supabase admin client ----

let _supabase: any = null;
async function getSupabase() {
  if (!_supabase) {
    const { createAdmin } = await import("./supabase-admin");
    _supabase = createAdmin();
  }
  return _supabase;
}

// ---- API publique ----

export async function getForms(
  options: { includeDeleted?: boolean } = {}
): Promise<{ count: number; results: DBForm[] }> {
  const supabase = await getSupabase();
  let query = supabase.from("forms").select("*", { count: "exact", head: false });
  if (!options.includeDeleted) query = query.is("deleted_at", null);

  const { data, error, count } = await query.order("date_created", { ascending: false });

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return { count: count || (data?.length ?? 0), results: data || [] };
}

/**
 * Supprime un formulaire et toutes ses soumissions (suppression logique).
 * Proposé uniquement lorsque le formulaire a disparu de KoboToolbox — mais
 * jamais exécuté automatiquement : c'est une décision de l'utilisateur.
 */
export async function deleteForm(
  uid: string,
  deletedBy: string,
  reason?: string
): Promise<{ submissions: number } | { error: string }> {
  const supabase = await getSupabase();
  const now = new Date().toISOString();

  // Le formulaire existe-t-il, et est-il encore actif ? Sans cette lecture,
  // un échec technique et un formulaire déjà supprimé donnaient le même
  // résultat, et donc le même message trompeur.
  const { data: form, error: readError } = await supabase
    .from("forms")
    .select("uid, deleted_at")
    .eq("uid", uid)
    .maybeSingle();

  if (readError) return { error: `Lecture du formulaire impossible : ${readError.message}` };
  if (!form) return { error: "Formulaire introuvable" };
  if (form.deleted_at) return { error: "Formulaire déjà supprimé" };

  const { count } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("form_uid", uid)
    .is("deleted_at", null);

  const { error: subError } = await supabase
    .from("submissions")
    .update({
      deleted_at: now,
      deleted_by: deletedBy,
      delete_reason: reason || `Formulaire ${uid} supprimé`,
      updated_at: now,
    })
    .eq("form_uid", uid)
    .is("deleted_at", null);

  if (subError) return { error: `Suppression des soumissions : ${subError.message}` };

  const { error: formError } = await supabase
    .from("forms")
    .update({ deleted_at: now, deleted_by: deletedBy, delete_reason: reason || null })
    .eq("uid", uid)
    .is("deleted_at", null);

  if (formError) return { error: `Suppression du formulaire : ${formError.message}` };

  await supabase.from("sync_logs").insert({
    action: "delete_form",
    count: count ?? 0,
    time: now,
    details: { form_uid: uid, deleted_by: deletedBy, submissions: count ?? 0, reason },
  });

  return { submissions: count ?? 0 };
}

/** Restaure un formulaire et les soumissions supprimées avec lui. */
export async function restoreForm(uid: string, restoredBy: string): Promise<boolean> {
  const supabase = await getSupabase();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("forms")
    .update({ deleted_at: null, deleted_by: null, delete_reason: null })
    .eq("uid", uid);
  if (error) return false;

  // Ne réactive que les soumissions supprimées par la suppression du formulaire,
  // pas celles retirées individuellement auparavant.
  await supabase
    .from("submissions")
    .update({ deleted_at: null, deleted_by: null, delete_reason: null, updated_at: now })
    .eq("form_uid", uid)
    .like("delete_reason", `Formulaire ${uid}%`);

  await supabase.from("sync_logs").insert({
    action: "restore_form",
    count: 1,
    time: now,
    details: { form_uid: uid, restored_by: restoredBy },
  });

  return true;
}

export async function getForm(uid: string): Promise<DBForm | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("uid", uid)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getSubmissions(
  formUid: string,
  skip = 0,
  limit = 100,
  options: { includeDeleted?: boolean } = {}
): Promise<{ count: number; results: DBSubmission[] }> {
  const supabase = await getSupabase();
  let query = supabase
    .from("submissions")
    .select("*, producer:producers(id, code, name, commune)", {
      count: "exact",
      head: false,
    })
    .eq("form_uid", formUid);

  // Les soumissions supprimées par un utilisateur sortent de toutes les vues.
  if (!options.includeDeleted) query = query.is("deleted_at", null);

  const { data, error, count } = await query
    .order("submitted_at", { ascending: false })
    .range(skip, skip + limit - 1);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return { count: count || (data?.length ?? 0), results: data || [] };
}

export async function getSubmission(
  id: number,
  options: { includeDeleted?: boolean } = {}
): Promise<DBSubmission | null> {
  const supabase = await getSupabase();
  // Jointure sur le référentiel : la fiche affiche le producteur rattaché
  let query = supabase
    .from("submissions")
    .select("*, producer:producers(id, code, name, commune, village, phone)")
    .eq("id", id);
  if (!options.includeDeleted) query = query.is("deleted_at", null);

  const { data, error } = await query.maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Suppression logique — la seule façon de retirer une soumission.
 * La ligne est conservée en base : une suppression accidentelle reste
 * réparable via restoreSubmission().
 */
export async function deleteSubmission(
  id: number,
  deletedBy: string,
  reason?: string
): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("submissions")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
      delete_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return false;

  await supabase.from("sync_logs").insert({
    action: "delete_submission",
    count: 1,
    time: new Date().toISOString(),
    details: { submission_id: id, deleted_by: deletedBy, reason: reason || null },
  });

  return true;
}

export async function restoreSubmission(id: number, restoredBy: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("submissions")
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return false;

  await supabase.from("sync_logs").insert({
    action: "restore_submission",
    count: 1,
    time: new Date().toISOString(),
    details: { submission_id: id, restored_by: restoredBy },
  });

  return true;
}

/** Soumissions supprimées — corbeille consultable par un administrateur. */
export async function getDeletedSubmissions(limit = 100): Promise<DBSubmission[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data || [];
}

export async function updateSubmissionStatus(
  id: number,
  validated: string,
  notes?: string
): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("submissions")
    .update({ validated, notes, updated_at: new Date().toISOString() })
    .eq("id", id);

  return !error;
}

export async function syncFormsToDB(forms: DBForm[]): Promise<number> {
  const supabase = await getSupabase();
  const now = new Date().toISOString();

  // Upsert tous les formulaires en une seule requête
  const { error } = await supabase.from("forms").upsert(
    forms.map((f) => ({
      ...f,
      updated_at: now,
      kobo_last_seen_at: now,
      missing_on_kobo: false,
    })),
    { onConflict: "uid" }
  );

  if (error) {
    console.error("Supabase forms sync error:", error);
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Formulaires absents de Kobo : signalés, jamais supprimés — leurs
  // soumissions archivées doivent rester accessibles.
  const uids = forms.map((f) => f.uid);
  if (uids.length > 0) {
    await supabase
      .from("forms")
      .update({ missing_on_kobo: true })
      .not("uid", "in", `(${uids.map((u) => `"${u}"`).join(",")})`);
  }

  // Log la synchronisation
  await supabase.from("sync_logs").insert({
    action: "sync_all",
    count: forms.length,
    time: now,
  });

  return forms.length;
}

/**
 * Synchronise les soumissions d'un formulaire.
 *
 * La synchronisation n'efface JAMAIS de données locales :
 * - les nouvelles soumissions sont insérées ;
 * - les soumissions déjà connues ne sont pas écrasées (les corrections
 *   saisies dans la plateforme priment sur la version Kobo) ;
 * - celles qui ont disparu de Kobo sont marquées `missing_on_kobo` et
 *   restent consultables. Seule une suppression par un utilisateur les retire.
 */
export async function syncSubmissionsToDB(
  formUid: string,
  submissions: DBSubmission[]
): Promise<{ inserted: number; missing: number; reappeared: number }> {
  const supabase = await getSupabase();
  const now = new Date().toISOString();

  // Toutes les soumissions locales de ce formulaire (supprimées incluses :
  // une soumission mise à la corbeille ne doit pas être réinsérée)
  const { data: existing } = await supabase
    .from("submissions")
    .select("id, kobo_id, missing_on_kobo")
    .eq("form_uid", formUid);

  const existingRows = existing || [];
  const existingIds = new Set(
    existingRows.map((s: { kobo_id: string }) => String(s.kobo_id))
  );
  const koboIds = new Set(submissions.map((s) => String(s.kobo_id)));

  const newSubs = submissions.filter((s) => !existingIds.has(String(s.kobo_id)));

  if (newSubs.length > 0) {
    const { error } = await supabase.from("submissions").upsert(
      newSubs.map((s) => ({
        id: s.id,
        kobo_id: s.kobo_id,
        form_uid: s.form_uid,
        submitted_by: s.submitted_by,
        submitted_at: s.submitted_at,
        data: s.data,
        kobo_last_seen_at: now,
        missing_on_kobo: false,
      })),
      { onConflict: "id" }
    );

    if (error) {
      console.error("Supabase submissions sync error:", error);
      throw new Error(`Supabase error: ${error.message}`);
    }
  }

  // Toujours présentes sur Kobo → rafraîchir la date de dernière vue
  const stillPresent = existingRows
    .filter((s: any) => koboIds.has(String(s.kobo_id)))
    .map((s: any) => s.id);

  let reappeared = 0;
  if (stillPresent.length > 0) {
    // Une soumission restaurée sur Kobo perd son marqueur « absente »
    reappeared = existingRows.filter(
      (s: any) => koboIds.has(String(s.kobo_id)) && s.missing_on_kobo
    ).length;

    await supabase
      .from("submissions")
      .update({ kobo_last_seen_at: now, missing_on_kobo: false })
      .in("id", stillPresent);
  }

  // Disparues de Kobo → conservées ici, simplement signalées
  const missingIds = existingRows
    .filter((s: any) => !koboIds.has(String(s.kobo_id)) && !s.missing_on_kobo)
    .map((s: any) => s.id);

  if (missingIds.length > 0) {
    await supabase
      .from("submissions")
      .update({ missing_on_kobo: true })
      .in("id", missingIds);
  }

  if (newSubs.length > 0 || missingIds.length > 0) {
    await supabase.from("sync_logs").insert({
      form_uid: formUid,
      action: "sync_submissions",
      count: newSubs.length,
      time: now,
      details: { inserted: newSubs.length, missing_on_kobo: missingIds.length, reappeared },
    });
  }

  return { inserted: newSubs.length, missing: missingIds.length, reappeared };
}

/**
 * Synchronise tous les formulaires et soumissions depuis KoboToolbox.
 * Utilisé par POST /api/sync et GET /api/cron/sync.
 * ⚠️ Sur le plan Hobby Vercel, les fonctions sont limitées à 60s.
 */
export async function syncAllForms(options: { archiveMedia?: boolean } = {}): Promise<{
  forms_synced: number;
  submissions_synced: number;
  submissions_missing_on_kobo: number;
  total_forms: number;
  media?: { processed: number; archived: number; failed: number; remaining: number };
  producers?: { linked: number; producers_created: number; without_code: number };
  parcels?: { created: number; updated: number; skipped: number };
  errors?: string[];
}> {
  const startedAt = Date.now();
  const kobo = new KoboClient();

  const data = await kobo.getForms();
  const forms = data.results || [];

  let totalSynced = 0;
  let totalMissing = 0;
  const errors: string[] = [];

  // 1. Sync forms metadata
  const formsSynced = await syncFormsToDB(
    forms.map((f: any) => ({
      uid: f.uid,
      name: f.name || "",
      owner: f.owner__username || "",
      has_deployment: !!f.has_deployment,
      deployment_active: !!f.deployment__active,
      submission_count: f.deployment__submission_count || 0,
      last_submission_time: f.deployment__last_submission_time || null,
      date_created: f.date_created || null,
      date_modified: f.date_modified || null,
      status: f.status || "",
    }))
  );

  // 2. Sync submissions pour les formulaires qui ont des données
  for (const form of forms) {
    if ((form.deployment__submission_count || 0) > 0) {
      try {
        const subsData = await kobo.getSubmissions(form.uid);
        const subs: DBSubmission[] = (subsData.results || []).map((s: any) => ({
          id: s._id,
          kobo_id: String(s._id || ""),
          form_uid: form.uid,
          submitted_by: s._submitted_by || "",
          submitted_at: s._submission_time || null,
          data: s as unknown as Record<string, unknown>,
        }));

        const synced = await syncSubmissionsToDB(form.uid, subs);
        totalSynced += synced.inserted;
        totalMissing += synced.missing;
      } catch (e: any) {
        errors.push(`${form.name || form.uid}: ${e.message || "Erreur inconnue"}`);
      }
    }
  }

  // 3. Rattachement des fiches dont le formulaire porte un code producteur.
  // Les fiches sans code restent « à rattacher » : c'est une décision humaine.
  let producers;
  try {
    const { autoLinkFromCodes } = await import("./producers-db");
    producers = await autoLinkFromCodes({ limit: 500 });
  } catch (e: any) {
    errors.push(`Rattachement producteurs: ${e.message || "Erreur inconnue"}`);
  }

  // 4. Registre des parcelles : chaque tracé d'une fiche rattachée reçoit un
  // code dérivé de celui du producteur (TCCO001-1, TCCO001-2…).
  let parcels;
  try {
    const { syncParcels } = await import("./parcels-db");
    parcels = await syncParcels({ limit: 500 });
  } catch (e: any) {
    errors.push(`Registre parcelles: ${e.message || "Erreur inconnue"}`);
  }

  // 5. Archivage des médias avec le temps restant.
  // Les images sont copiées dans Supabase Storage pour rester consultables
  // même après suppression de la soumission sur Kobo.
  let media;
  if (options.archiveMedia !== false) {
    try {
      const { archivePendingMedia } = await import("./media-archive");
      const supabase = await getSupabase();
      const remainingBudget = 45_000 - (Date.now() - startedAt);
      if (remainingBudget > 5_000) {
        const res = await archivePendingMedia(supabase, {
          limit: 30,
          timeBudgetMs: remainingBudget,
        });
        media = {
          processed: res.processed,
          archived: res.archived,
          failed: res.failed,
          remaining: res.remaining,
        };
        if (res.errors.length > 0) errors.push(...res.errors);
      }
    } catch (e: any) {
      errors.push(`Archivage medias: ${e.message || "Erreur inconnue"}`);
    }
  }

  return {
    forms_synced: formsSynced,
    submissions_synced: totalSynced,
    submissions_missing_on_kobo: totalMissing,
    total_forms: forms.length,
    media,
    producers,
    parcels,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function getSyncLogs(limit = 20): Promise<DBSyncLog[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("sync_logs")
    .select("*")
    .order("time", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data || [];
}
