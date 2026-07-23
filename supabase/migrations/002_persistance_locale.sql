-- =============================================================
-- Persistance locale des données
-- Les soumissions et leurs médias restent dans la plateforme même
-- lorsqu'ils disparaissent de KoboToolbox. Seule une suppression
-- explicite par un utilisateur les retire.
-- =============================================================

-- 🔷 Soumissions : suppression logique + suivi de présence sur Kobo
ALTER TABLE submissions
  -- Suppression explicite par un utilisateur (NULL = active).
  -- On conserve la ligne : une suppression accidentelle reste réparable.
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by        TEXT,
  ADD COLUMN IF NOT EXISTS delete_reason     TEXT,
  -- La soumission n'existe plus côté Kobo : conservée ici uniquement.
  ADD COLUMN IF NOT EXISTS missing_on_kobo   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS kobo_last_seen_at TIMESTAMPTZ,
  -- Horodatage de l'archivage des médias dans Supabase Storage
  ADD COLUMN IF NOT EXISTS media_archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_count       INTEGER DEFAULT 0;

-- 🔷 Pièces jointes : copie locale du fichier
ALTER TABLE attachments
  -- Chemin dans le bucket Supabase Storage (source de vérité locale)
  ADD COLUMN IF NOT EXISTS storage_path      TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes        BIGINT,
  ADD COLUMN IF NOT EXISTS archived_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_error     TEXT,
  -- URL Kobo d'origine, conservée comme repli
  ADD COLUMN IF NOT EXISTS source_url        TEXT,
  ADD COLUMN IF NOT EXISTS question_xpath    TEXT;

-- Une seule ligne par fichier et par soumission (permet l'upsert idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attachments_unique
  ON attachments(submission_id, filename);

CREATE INDEX IF NOT EXISTS idx_submissions_deleted_at
  ON submissions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_missing_on_kobo
  ON submissions(missing_on_kobo) WHERE missing_on_kobo = true;
CREATE INDEX IF NOT EXISTS idx_submissions_media_archived
  ON submissions(media_archived_at) WHERE media_archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_storage_path
  ON attachments(storage_path);

-- =============================================================
-- Bucket de stockage des médias archivés
-- Privé : les fichiers ne sont servis que par /api/media (authentifié).
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('kobo-media', 'kobo-media', false)
ON CONFLICT (id) DO NOTHING;

-- Seul le service_role (routes API serveur) accède au bucket.
DROP POLICY IF EXISTS "Service role gere les medias archives" ON storage.objects;
CREATE POLICY "Service role gere les medias archives"
  ON storage.objects FOR ALL
  USING (bucket_id = 'kobo-media' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'kobo-media' AND auth.role() = 'service_role');

-- =============================================================
-- La suppression d'un formulaire ne doit plus effacer ses données.
-- ON DELETE CASCADE détruisait toutes les soumissions archivées si le
-- formulaire disparaissait de Kobo.
-- =============================================================
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_form_uid_fkey;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_form_uid_fkey
  FOREIGN KEY (form_uid) REFERENCES forms(uid) ON DELETE SET NULL;

ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_form_uid_fkey;
ALTER TABLE attachments
  ADD CONSTRAINT attachments_form_uid_fkey
  FOREIGN KEY (form_uid) REFERENCES forms(uid) ON DELETE SET NULL;

-- 🔷 Formulaires : eux aussi peuvent disparaître de Kobo
ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS missing_on_kobo   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS kobo_last_seen_at TIMESTAMPTZ;
