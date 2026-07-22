// =============================================================
// Couche d'accès aux données
// Utilise Supabase si configuré, sinon lit db.json (fallback)
// Migration progressive vers Supabase
// =============================================================

import fs from "fs";
import path from "path";
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

export interface Database {
  forms: Record<string, DBForm>;
  submissions: Record<string, DBSubmission[]>;
  logs: DBSyncLog[];
}

// ---- Utilitaires ----

const DB_PATH = path.resolve(process.cwd(), "..", "backend", "db.json");

function loadDB(): Database {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    }
  } catch {
    // Ignorer
  }
  return { forms: {}, submissions: {}, logs: [] };
}

function saveDB(data: Database): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch {
    // Ignorer en serverless (Vercel)
  }
}

// ---- Cache lazy pour Supabase (évite les imports dynamiques répétés) ----
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
  // Essayer Supabase d'abord
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const supabase = await getSupabase();
      const { data, error, count } = await supabase
        .from("forms")
        .select("*", { count: "exact", head: false })
        .order("date_created", { ascending: false });

      if (!error && data) {
        return { count: count || data.length, results: data };
      }
    } catch {
      // Fallback silencieux
    }
  }

  // Fallback: db.json
  const db = loadDB();
  const forms = Object.values(db.forms).sort((a, b) =>
    (b.date_created || "").localeCompare(a.date_created || "")
  );
  return { count: forms.length, results: forms };
}

export async function getForm(uid: string): Promise<DBForm | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("uid", uid)
        .single();

      if (!error && data) return data;
    } catch {
      // Fallback
    }
  }

  const db = loadDB();
  return db.forms[uid] || null;
}

export async function getSubmissions(
  formUid: string,
  skip = 0,
  limit = 100
): Promise<{ count: number; results: DBSubmission[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const supabase = await getSupabase();
      const { data, error, count } = await supabase
        .from("submissions")
        .select("*", { count: "exact", head: false })
        .eq("form_uid", formUid)
        .order("submitted_at", { ascending: false })
        .range(skip, skip + limit - 1);

      if (!error && data) {
        return { count: count || data.length, results: data };
      }
    } catch {
      // Fallback
    }
  }

  const db = loadDB();
  const all = db.submissions[formUid] || [];
  const paged = all.slice(Number(skip), Number(skip) + Number(limit));
  return { count: all.length, results: paged };
}

export async function getSubmission(id: number): Promise<DBSubmission | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) return data;
    } catch {
      // Fallback
    }
  }

  const db = loadDB();
  for (const subs of Object.values(db.submissions)) {
    const found = subs.find((s) => Number(s.id) === Number(id));
    if (found) return found;
  }
  return null;
}

export async function updateSubmissionStatus(
  id: number,
  validated: string,
  notes?: string
): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from("submissions")
        .update({ validated, notes, updated_at: new Date().toISOString() })
        .eq("id", id);

      return !error;
    } catch {
      return false;
    }
  }

  // Fallback: stocker la validation dans un fichier à part
  try {
    const validationPath = path.resolve(process.cwd(), "..", "backend", "validations.json");
    let validations: Record<string, { validated: string; notes: string }> = {};
    if (fs.existsSync(validationPath)) {
      validations = JSON.parse(fs.readFileSync(validationPath, "utf-8"));
    }
    validations[String(id)] = { validated, notes: notes || "" };
    fs.writeFileSync(validationPath, JSON.stringify(validations, null, 2));
    return true;
  } catch {
    return false;
  }
}

export async function getSubmissionValidation(
  id: number
): Promise<{ validated: string; notes: string } | null> {
  try {
    const validationPath = path.resolve(process.cwd(), "..", "backend", "validations.json");
    if (fs.existsSync(validationPath)) {
      const validations = JSON.parse(fs.readFileSync(validationPath, "utf-8"));
      return validations[String(id)] || null;
    }
  } catch {
    // Ignorer
  }
  return null;
}

export async function syncFormsToDB(forms: DBForm[]): Promise<number> {
  const db = loadDB();
  let synced = 0;

  for (const f of forms) {
    if (!db.forms[f.uid]) synced++;
    db.forms[f.uid] = f;
  }

  db.logs = db.logs || [];
  db.logs.push({
    action: "sync_all",
    count: synced,
    time: new Date().toISOString(),
  });
  saveDB(db);

  // Si Supabase est configuré, upsert aussi là-bas
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from("forms").upsert(
        forms.map((f) => ({ ...f, updated_at: new Date().toISOString() })),
        { onConflict: "uid" }
      );
      if (error) console.error("Supabase sync error:", error);
    } catch (e) {
      console.error("Supabase sync failed:", e);
    }
  }

  return synced;
}

export async function syncSubmissionsToDB(
  formUid: string,
  submissions: DBSubmission[]
): Promise<number> {
  const db = loadDB();
  if (!db.submissions[formUid]) db.submissions[formUid] = [];

  const existingIds = new Set(db.submissions[formUid].map((s) => String(s.kobo_id)));
  let synced = 0;

  for (const s of submissions) {
    if (!existingIds.has(String(s.kobo_id))) {
      db.submissions[formUid].push(s);
      synced++;
    }
  }

  db.logs = db.logs || [];
  db.logs.push({
    form_uid: formUid,
    action: "sync_submissions",
    count: synced,
    time: new Date().toISOString(),
  });
  saveDB(db);

  // Sync vers Supabase si configuré
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from("submissions").upsert(
        submissions.filter((s) => !existingIds.has(String(s.kobo_id))),
        { onConflict: "id" }
      );
      if (error) console.error("Supabase submissions sync error:", error);
    } catch (e) {
      console.error("Supabase submissions sync failed:", e);
    }
  }

  return synced;
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .order("time", { ascending: false })
        .limit(limit);

      if (!error && data) return data;
    } catch {
      // Fallback
    }
  }

  const db = loadDB();
  return (db.logs || []).slice(-limit).reverse();
}
