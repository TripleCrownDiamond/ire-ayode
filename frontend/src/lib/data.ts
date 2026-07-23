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

export async function getForms(): Promise<{ count: number; results: DBForm[] }> {
  const supabase = await getSupabase();
  const { data, error, count } = await supabase
    .from("forms")
    .select("*", { count: "exact", head: false })
    .order("date_created", { ascending: false });

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return { count: count || (data?.length ?? 0), results: data || [] };
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
  limit = 100
): Promise<{ count: number; results: DBSubmission[] }> {
  const supabase = await getSupabase();
  const { data, error, count } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: false })
    .eq("form_uid", formUid)
    .order("submitted_at", { ascending: false })
    .range(skip, skip + limit - 1);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return { count: count || (data?.length ?? 0), results: data || [] };
}

export async function getSubmission(id: number): Promise<DBSubmission | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
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

  // Upsert tous les formulaires en une seule requête
  const { error } = await supabase.from("forms").upsert(
    forms.map((f) => ({ ...f, updated_at: new Date().toISOString() })),
    { onConflict: "uid" }
  );

  if (error) {
    console.error("Supabase forms sync error:", error);
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Log la synchronisation
  await supabase.from("sync_logs").insert({
    action: "sync_all",
    count: forms.length,
    time: new Date().toISOString(),
  });

  return forms.length;
}

export async function syncSubmissionsToDB(
  formUid: string,
  submissions: DBSubmission[]
): Promise<number> {
  if (submissions.length === 0) return 0;

  const supabase = await getSupabase();

  // Récupérer les kobo_id existants pour ce formulaire
  const { data: existing } = await supabase
    .from("submissions")
    .select("kobo_id")
    .eq("form_uid", formUid);

  const existingIds = new Set((existing || []).map((s: { kobo_id: string }) => s.kobo_id));
  const newSubs = submissions.filter((s) => !existingIds.has(String(s.kobo_id)));

  if (newSubs.length === 0) return 0;

  // Upsert les nouvelles soumissions
  const { error } = await supabase.from("submissions").upsert(
    newSubs.map((s) => ({
      id: s.id,
      kobo_id: s.kobo_id,
      form_uid: s.form_uid,
      submitted_by: s.submitted_by,
      submitted_at: s.submitted_at,
      data: s.data,
    })),
    { onConflict: "id" }
  );

  if (error) {
    console.error("Supabase submissions sync error:", error);
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Log
  await supabase.from("sync_logs").insert({
    form_uid: formUid,
    action: "sync_submissions",
    count: newSubs.length,
    time: new Date().toISOString(),
  });

  return newSubs.length;
}

/**
 * Synchronise tous les formulaires et soumissions depuis KoboToolbox.
 * Utilisé par POST /api/sync et GET /api/cron/sync.
 * ⚠️ Sur le plan Hobby Vercel, les fonctions sont limitées à 60s.
 */
export async function syncAllForms(): Promise<{
  forms_synced: number;
  submissions_synced: number;
  total_forms: number;
  errors?: string[];
}> {
  const kobo = new KoboClient();

  const data = await kobo.getForms();
  const forms = data.results || [];

  let totalSynced = 0;
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
        totalSynced += synced;
      } catch (e: any) {
        errors.push(`${form.name || form.uid}: ${e.message || "Erreur inconnue"}`);
      }
    }
  }

  return {
    forms_synced: formsSynced,
    submissions_synced: totalSynced,
    total_forms: forms.length,
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
