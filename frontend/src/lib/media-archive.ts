// =============================================================
// Archivage local des médias KoboToolbox
// =============================================================
// Les images, signatures et scans étaient jusqu'ici toujours lus en direct
// sur Kobo. Une soumission supprimée là-bas restait visible ici, mais toutes
// ses images renvoyaient 404 : les données textuelles survivaient, pas les
// pièces jointes.
//
// Ce module copie chaque fichier dans Supabase Storage et enregistre son
// chemin dans la table `attachments`. Le proxy /api/media sert ensuite la
// copie locale en priorité — la plateforme devient autonome vis-à-vis de Kobo.

import { buildAttachmentIndex, normalizeName, type KoboAttachment } from "./attachments";

const BUCKET = "kobo-media";

const KOBO_KF_URL = (process.env.KOBO_API_URL || "https://kf.kobotoolbox.org").replace(/\/$/, "");
const KOBO_KC_URL = KOBO_KF_URL.replace("kf.kobotoolbox.org", "kc.kobotoolbox.org");

/** Taille maximale d'un fichier archivé (garde-fou mémoire sur Vercel). */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function authHeaders(): Record<string, string> {
  const token = process.env.KOBO_API_TOKEN || "";
  return token ? { Authorization: `Token ${token}` } : {};
}

function absolutize(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${KOBO_KC_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Chemin de stockage déterministe : rejouer l'archivage écrase la même clé
 * au lieu de dupliquer les fichiers.
 */
export function storagePathFor(formUid: string, submissionId: number, filename: string): string {
  const safe = normalizeName(filename).replace(/[^a-z0-9._-]/g, "_") || "fichier";
  return `${formUid || "sans-formulaire"}/${submissionId}/${safe}`;
}

export interface ArchiveResult {
  submission_id: number;
  archived: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Archive toutes les pièces jointes d'une soumission.
 * Idempotent : un fichier déjà présent dans Storage n'est pas retéléchargé
 * (sauf `force`), ce qui rend l'opération rejouable sans coût.
 */
export async function archiveSubmissionMedia(
  supabase: any,
  submission: { id: number; form_uid: string; data: Record<string, unknown> },
  options: { force?: boolean } = {}
): Promise<ArchiveResult> {
  const result: ArchiveResult = {
    submission_id: submission.id,
    archived: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const attachments = (submission.data?._attachments as KoboAttachment[]) || [];
  if (!Array.isArray(attachments) || attachments.length === 0) {
    await supabase
      .from("submissions")
      .update({ media_archived_at: new Date().toISOString(), media_count: 0 })
      .eq("id", submission.id);
    return result;
  }

  // Réutilise l'ordre de préférence des URL (original avant miniature)
  const index = buildAttachmentIndex(attachments);
  const urlsByPosition = index.all;

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    const filename = att.media_file_basename || att.filename || `fichier_${i}`;
    const path = storagePathFor(submission.form_uid, submission.id, filename);
    const candidates = (urlsByPosition[i] || []).map(absolutize);

    if (candidates.length === 0) {
      result.skipped += 1;
      continue;
    }

    // Déjà archivé ? on ne retélécharge pas.
    if (!options.force) {
      const { data: existing } = await supabase
        .from("attachments")
        .select("id, storage_path, archived_at")
        .eq("submission_id", submission.id)
        .eq("filename", filename)
        .maybeSingle();

      if (existing?.archived_at && existing?.storage_path) {
        result.skipped += 1;
        continue;
      }
    }

    let stored = false;
    let lastError = "aucune URL exploitable";

    for (const url of candidates) {
      try {
        const resp = await fetch(url, { headers: authHeaders(), redirect: "follow" });
        if (!resp.ok) {
          lastError = `HTTP ${resp.status}`;
          continue;
        }
        const contentType = resp.headers.get("content-type") || "";
        // Kobo renvoie parfois sa page de login avec un statut 200
        if (/text\/html/i.test(contentType)) {
          lastError = "reponse HTML (session Kobo invalide)";
          continue;
        }

        const buffer = Buffer.from(await resp.arrayBuffer());
        if (buffer.byteLength === 0) {
          lastError = "fichier vide";
          continue;
        }
        if (buffer.byteLength > MAX_FILE_BYTES) {
          lastError = `fichier trop volumineux (${buffer.byteLength} octets)`;
          break;
        }

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, buffer, {
            contentType: contentType || att.mimetype || "application/octet-stream",
            upsert: true,
          });

        if (uploadError) {
          lastError = `storage: ${uploadError.message}`;
          continue;
        }

        await supabase.from("attachments").upsert(
          {
            submission_id: submission.id,
            form_uid: submission.form_uid,
            filename,
            question: att.question_xpath || null,
            question_xpath: att.question_xpath || null,
            mimetype: contentType || att.mimetype || null,
            storage_path: path,
            size_bytes: buffer.byteLength,
            source_url: candidates[0],
            archived_at: new Date().toISOString(),
            archive_error: null,
          },
          { onConflict: "submission_id,filename" }
        );

        result.archived += 1;
        stored = true;
        break;
      } catch (e: any) {
        lastError = e?.message || "erreur reseau";
      }
    }

    if (!stored) {
      result.failed += 1;
      result.errors.push(`${filename}: ${lastError}`);
      // On garde une trace pour pouvoir réessayer plus tard
      await supabase.from("attachments").upsert(
        {
          submission_id: submission.id,
          form_uid: submission.form_uid,
          filename,
          question: att.question_xpath || null,
          question_xpath: att.question_xpath || null,
          mimetype: att.mimetype || null,
          source_url: candidates[0] || null,
          archive_error: lastError,
        },
        { onConflict: "submission_id,filename" }
      );
    }
  }

  // Marquée comme archivée seulement si tout est passé — sinon un prochain
  // passage réessaiera les fichiers en échec.
  if (result.failed === 0) {
    await supabase
      .from("submissions")
      .update({
        media_archived_at: new Date().toISOString(),
        media_count: result.archived + result.skipped,
      })
      .eq("id", submission.id);
  }

  return result;
}

/**
 * Archive les médias des soumissions qui ne le sont pas encore.
 * `limit` borne le travail par appel : les fonctions Vercel Hobby sont
 * coupées à 60 s, l'archivage se fait donc par lots successifs.
 */
export async function archivePendingMedia(
  supabase: any,
  options: { limit?: number; formUid?: string; timeBudgetMs?: number } = {}
): Promise<{
  processed: number;
  archived: number;
  failed: number;
  remaining: number;
  done: boolean;
  errors: string[];
}> {
  const limit = options.limit ?? 25;
  const timeBudgetMs = options.timeBudgetMs ?? 45_000;
  const startedAt = Date.now();

  let query = supabase
    .from("submissions")
    .select("id, form_uid, data", { count: "exact" })
    .is("media_archived_at", null)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })
    .limit(limit);

  if (options.formUid) query = query.eq("form_uid", options.formUid);

  const { data: pending, error, count } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  let processed = 0;
  let archived = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const sub of pending || []) {
    // On s'arrête avant la coupure de la fonction : le lot suivant reprendra.
    if (Date.now() - startedAt > timeBudgetMs) break;

    const res = await archiveSubmissionMedia(supabase, sub);
    processed += 1;
    archived += res.archived;
    failed += res.failed;
    if (res.errors.length > 0) errors.push(`#${sub.id}: ${res.errors.join(", ")}`);
  }

  const remaining = Math.max((count ?? 0) - processed, 0);

  return {
    processed,
    archived,
    failed,
    remaining,
    done: remaining === 0,
    errors: errors.slice(0, 20),
  };
}

/**
 * Retrouve la copie locale d'un fichier.
 * Renvoie un flux depuis Supabase Storage, ou null si le fichier n'a pas
 * (encore) été archivé.
 */
export async function getArchivedMedia(
  supabase: any,
  formUid: string,
  filename: string,
  submissionId?: number
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const basename = filename.split("/").pop() || filename;
  const target = normalizeName(basename);
  if (!target) return null;

  const select = "filename, storage_path, mimetype";
  let match: any = null;

  // 1. Chemin direct quand l'appelant connaît la soumission — un seul index hit.
  if (submissionId) {
    const { data } = await supabase
      .from("attachments")
      .select(select)
      .eq("submission_id", submissionId)
      .not("storage_path", "is", null);
    match = (data || []).find((r: any) => normalizeName(r.filename) === target) || null;
    // Une seule pièce jointe pour cette soumission : pas d'ambiguïté possible.
    if (!match && (data || []).length === 1) match = data[0];
  }

  // 2. Repli : nom de fichier exact dans le formulaire
  if (!match) {
    const { data } = await supabase
      .from("attachments")
      .select(select)
      .eq("form_uid", formUid)
      .eq("filename", basename)
      .not("storage_path", "is", null)
      .limit(1);
    match = data?.[0] || null;
  }

  // 3. Repli : chemin de stockage normalisé (espaces/accents déjà translittérés)
  if (!match) {
    const safe = target.replace(/[^a-z0-9._-]/g, "_");
    const { data } = await supabase
      .from("attachments")
      .select(select)
      .eq("form_uid", formUid)
      .like("storage_path", `%/${safe}`)
      .limit(1);
    match = data?.[0] || null;
  }

  if (!match?.storage_path) return null;

  const { data: file, error } = await supabase.storage.from(BUCKET).download(match.storage_path);
  if (error || !file) return null;

  return {
    body: await file.arrayBuffer(),
    contentType: match.mimetype || file.type || "application/octet-stream",
  };
}

export { BUCKET as MEDIA_BUCKET };
