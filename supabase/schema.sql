-- =============================================================
-- Platform-IRede — Schéma Supabase complet (à jour des migrations 001–007)
-- Sync KoboToolbox + Dashboard agricole
-- =============================================================

-- 🔷 Formulaires KoboToolbox
CREATE TABLE IF NOT EXISTS forms (
  uid                TEXT PRIMARY KEY,
  name               TEXT NOT NULL DEFAULT '',
  owner              TEXT NOT NULL DEFAULT '',
  has_deployment     BOOLEAN DEFAULT false,
  deployment_active  BOOLEAN DEFAULT false,
  submission_count   INTEGER DEFAULT 0,
  last_submission_time TIMESTAMPTZ,
  date_created       TIMESTAMPTZ,
  date_modified      TIMESTAMPTZ,
  status             TEXT DEFAULT '',
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  -- 002: persistance locale
  missing_on_kobo    BOOLEAN DEFAULT false,
  kobo_last_seen_at  TIMESTAMPTZ,
  -- 003: suppression maîtrisée
  deleted_at         TIMESTAMPTZ,
  deleted_by         TEXT,
  delete_reason      TEXT,
  -- 004: code producteur du formulaire
  producer_code_field TEXT
);

-- 🔷 Soumissions (données brutes + métadonnées)
CREATE TABLE IF NOT EXISTS submissions (
  id                BIGSERIAL PRIMARY KEY,
  kobo_id           TEXT,
  form_uid          TEXT REFERENCES forms(uid) ON DELETE SET NULL,
  submitted_by      TEXT DEFAULT '',
  submitted_at      TIMESTAMPTZ,
  data              JSONB NOT NULL DEFAULT '{}',
  validated         TEXT DEFAULT 'pending'
    CHECK (validated IN ('pending', 'valid', 'needs_revision', 'rejected')),
  notes             TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  -- 002: persistance locale
  deleted_at        TIMESTAMPTZ,
  deleted_by        TEXT,
  delete_reason     TEXT,
  missing_on_kobo   BOOLEAN DEFAULT false,
  kobo_last_seen_at TIMESTAMPTZ,
  media_archived_at TIMESTAMPTZ,
  media_count       INTEGER DEFAULT 0,
  -- 004: rattachement producteur
  producer_id       BIGINT REFERENCES producers(id) ON DELETE SET NULL,
  producer_source   TEXT,
  producer_linked_at TIMESTAMPTZ,
  producer_linked_by TEXT
);

-- 🔷 Producteurs
CREATE TABLE IF NOT EXISTS producers (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  code_key      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  phone         TEXT DEFAULT '',
  genre         TEXT DEFAULT '',
  commune       TEXT DEFAULT '',
  village       TEXT DEFAULT '',
  cooperative   TEXT DEFAULT '',
  notes         TEXT DEFAULT '',
  source        TEXT NOT NULL DEFAULT 'plateforme'
                CHECK (source IN ('kobo', 'plateforme')),
  created_by    TEXT DEFAULT '',
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  -- 005: codes calculés
  order_no      INTEGER,
  code_prefix   TEXT,
  -- 006: recalcul codes
  previous_codes TEXT[] DEFAULT '{}',
  code_updated_at TIMESTAMPTZ,
  code_updated_by TEXT
);

-- 🔷 Parcelles
CREATE TABLE IF NOT EXISTS parcels (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  producer_id   BIGINT REFERENCES producers(id) ON DELETE CASCADE,
  order_no      INTEGER NOT NULL,
  submission_id BIGINT REFERENCES submissions(id) ON DELETE SET NULL,
  form_uid      TEXT,
  source_field  TEXT,
  raw_points    TEXT,
  points        JSONB NOT NULL DEFAULT '[]',
  point_count   INTEGER DEFAULT 0,
  area_ha       NUMERIC(12, 4),
  culture       TEXT DEFAULT '',
  commune       TEXT DEFAULT '',
  village       TEXT DEFAULT '',
  superficie_declaree NUMERIC(12, 4),
  notes         TEXT DEFAULT '',
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  -- 006: recalcul codes
  previous_codes TEXT[] DEFAULT '{}'
);

-- 🔷 Attachments (images, signatures, fichiers)
CREATE TABLE IF NOT EXISTS attachments (
  id                BIGSERIAL PRIMARY KEY,
  submission_id     BIGINT REFERENCES submissions(id) ON DELETE SET NULL,
  form_uid          TEXT REFERENCES forms(uid) ON DELETE SET NULL,
  filename          TEXT NOT NULL,
  question          TEXT,
  mimetype          TEXT DEFAULT 'image/jpeg',
  cached_url        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  -- 002: copie locale
  storage_path      TEXT,
  size_bytes        BIGINT,
  archived_at       TIMESTAMPTZ,
  archive_error     TEXT,
  source_url        TEXT,
  question_xpath    TEXT
);

-- 🔷 Logs de synchronisation
CREATE TABLE IF NOT EXISTS sync_logs (
  id                BIGSERIAL PRIMARY KEY,
  form_uid          TEXT REFERENCES forms(uid) ON DELETE SET NULL,
  action            TEXT,
  count             INTEGER DEFAULT 0,
  details           JSONB DEFAULT '{}',
  time              TIMESTAMPTZ DEFAULT NOW()
);

-- 🔷 Permissions utilisateurs (admin + modules)
CREATE TABLE IF NOT EXISTS user_permissions (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  is_admin          BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  permissions       JSONB NOT NULL DEFAULT '{
    "dashboard": {"read": false, "edit": false},
    "forms": {"read": false, "edit": false},
    "map": {"read": false, "edit": false},
    "sync": {"read": false, "edit": false},
    "admin": {"read": false, "edit": false}
  }'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- Séquences
-- =============================================================
CREATE SEQUENCE IF NOT EXISTS producer_code_seq START 1;

-- =============================================================
-- Fonctions
-- =============================================================

-- Trigger : créer automatiquement les permissions à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id, is_admin)
  VALUES (NEW.id, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Attribue le prochain code plateforme disponible
CREATE OR REPLACE FUNCTION next_producer_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := 'PR-' || LPAD(nextval('producer_code_seq')::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM producers WHERE code_key = lower(candidate));
  END LOOP;
  RETURN candidate;
END;
$$;

-- Prochain numéro d'ordre pour un préfixe commune+coopérative
CREATE OR REPLACE FUNCTION next_producer_order(p_prefix TEXT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  next_no INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('producer_order_' || p_prefix));
  SELECT COALESCE(MAX(order_no), 0) + 1 INTO next_no
  FROM producers WHERE code_prefix = p_prefix;
  RETURN next_no;
END;
$$;

-- Prochain numéro d'ordre de parcelle pour un producteur
CREATE OR REPLACE FUNCTION next_parcel_order(p_producer BIGINT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  next_no INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('parcel_order_' || p_producer::TEXT));
  SELECT COALESCE(MAX(order_no), 0) + 1 INTO next_no
  FROM parcels WHERE producer_id = p_producer;
  RETURN next_no;
END;
$$;

-- =============================================================
-- Index de performance
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_submissions_form_uid ON submissions(form_uid);
CREATE INDEX IF NOT EXISTS idx_submissions_validated ON submissions(validated);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_kobo_id ON submissions(kobo_id);
CREATE INDEX IF NOT EXISTS idx_submissions_producer_id ON submissions(producer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_deleted_at ON submissions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_missing_on_kobo
  ON submissions(missing_on_kobo) WHERE missing_on_kobo = true;
CREATE INDEX IF NOT EXISTS idx_submissions_media_archived
  ON submissions(media_archived_at) WHERE media_archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_form_uid ON attachments(form_uid);
CREATE INDEX IF NOT EXISTS idx_attachments_submission ON attachments(submission_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attachments_unique
  ON attachments(submission_id, filename);
CREATE INDEX IF NOT EXISTS idx_attachments_storage_path ON attachments(storage_path);
CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs(time DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_form_uid ON sync_logs(form_uid);
CREATE INDEX IF NOT EXISTS idx_submissions_data ON submissions USING GIN(data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_producers_code_key ON producers(code_key);
CREATE INDEX IF NOT EXISTS idx_producers_deleted_at ON producers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_producers_name ON producers(lower(name));
CREATE INDEX IF NOT EXISTS idx_producers_prefix ON producers(code_prefix, order_no);
CREATE INDEX IF NOT EXISTS idx_producers_previous_codes
  ON producers USING GIN(previous_codes);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parcels_source
  ON parcels(submission_id, source_field);
CREATE INDEX IF NOT EXISTS idx_parcels_producer ON parcels(producer_id, order_no);
CREATE INDEX IF NOT EXISTS idx_parcels_form ON parcels(form_uid);
CREATE INDEX IF NOT EXISTS idx_parcels_deleted ON parcels(deleted_at);
CREATE INDEX IF NOT EXISTS idx_parcels_previous_codes
  ON parcels USING GIN(previous_codes);
CREATE INDEX IF NOT EXISTS idx_forms_deleted_at ON forms(deleted_at);
CREATE INDEX IF NOT EXISTS idx_forms_missing_on_kobo
  ON forms(missing_on_kobo) WHERE missing_on_kobo = true;
CREATE INDEX IF NOT EXISTS idx_user_permissions_active
  ON user_permissions(is_active) WHERE is_active = false;

-- =============================================================
-- Row Level Security
-- =============================================================
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Tout le monde peut lire les formulaires" ON forms;
CREATE POLICY "Tout le monde peut lire les formulaires"
  ON forms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tout le monde peut lire les soumissions" ON submissions;
CREATE POLICY "Tout le monde peut lire les soumissions"
  ON submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tout le monde peut lire les attachments" ON attachments;
CREATE POLICY "Tout le monde peut lire les attachments"
  ON attachments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins peuvent tout modifier" ON submissions;
CREATE POLICY "Admins peuvent tout modifier" ON submissions
  FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM user_permissions WHERE is_admin = true));

DROP POLICY IF EXISTS "Admins peuvent inserer" ON submissions;
CREATE POLICY "Admins peuvent inserer" ON submissions
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM user_permissions WHERE is_admin = true));

DROP POLICY IF EXISTS "Tout le monde peut lire les logs" ON sync_logs;
CREATE POLICY "Tout le monde peut lire les logs"
  ON sync_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role peut ecrire les logs" ON sync_logs;
CREATE POLICY "Service role peut ecrire les logs"
  ON sync_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Utilisateurs lisent leurs propres permissions" ON user_permissions;
CREATE POLICY "Utilisateurs lisent leurs propres permissions"
  ON user_permissions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins lisent toutes les permissions" ON user_permissions;
CREATE POLICY "Admins lisent toutes les permissions" ON user_permissions
  FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM user_permissions WHERE is_admin = true));

DROP POLICY IF EXISTS "Admins modifient les permissions" ON user_permissions;
CREATE POLICY "Admins modifient les permissions" ON user_permissions
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM user_permissions WHERE is_admin = true));

DROP POLICY IF EXISTS "Tout le monde peut lire les producteurs" ON producers;
CREATE POLICY "Tout le monde peut lire les producteurs"
  ON producers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tout le monde peut lire les parcelles" ON parcels;
CREATE POLICY "Tout le monde peut lire les parcelles"
  ON parcels FOR SELECT USING (true);

-- =============================================================
-- Bucket de stockage des médias archivés
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('kobo-media', 'kobo-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role gere les medias archives" ON storage.objects;
CREATE POLICY "Service role gere les medias archives"
  ON storage.objects FOR ALL
  USING (bucket_id = 'kobo-media' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'kobo-media' AND auth.role() = 'service_role');

-- =============================================================
-- Alignement de la séquence sur les codes existants
-- =============================================================
SELECT setval(
  'producer_code_seq',
  GREATEST(
    (SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '^PR-', ''), '')::BIGINT), 0)
     FROM producers WHERE code ~ '^PR-[0-9]+$'),
    1
  )
);
