-- =============================================================
-- Migration 001 — schéma initial
-- =============================================================
-- Reprise de supabase/schema.sql, désormais suivie comme migration afin
-- qu'une base neuve puisse être créée entièrement par `npm run migrate`.
-- Toutes les instructions sont idempotentes : rejouer ce fichier sur une
-- base existante ne modifie rien.
-- =============================================================

-- =============================================================
-- Platform-IRede — Schéma Supabase complet
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
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 🔷 Soumissions (données brutes + métadonnées)
CREATE TABLE IF NOT EXISTS submissions (
  id                BIGSERIAL PRIMARY KEY,
  kobo_id           TEXT,
  form_uid          TEXT REFERENCES forms(uid) ON DELETE CASCADE,
  submitted_by      TEXT DEFAULT '',
  submitted_at      TIMESTAMPTZ,
  data              JSONB NOT NULL DEFAULT '{}',
  validated         TEXT DEFAULT 'pending'
    CHECK (validated IN ('pending', 'valid', 'needs_revision', 'rejected')),
  notes             TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 🔷 Attachments (images, signatures, fichiers)
CREATE TABLE IF NOT EXISTS attachments (
  id                BIGSERIAL PRIMARY KEY,
  submission_id     BIGINT REFERENCES submissions(id) ON DELETE CASCADE,
  form_uid          TEXT REFERENCES forms(uid) ON DELETE CASCADE,
  filename          TEXT NOT NULL,
  question          TEXT,
  mimetype          TEXT DEFAULT 'image/jpeg',
  cached_url        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
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

-- =============================================================
-- Index de performance
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_submissions_form_uid ON submissions(form_uid);
CREATE INDEX IF NOT EXISTS idx_submissions_validated ON submissions(validated);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_kobo_id ON submissions(kobo_id);
CREATE INDEX IF NOT EXISTS idx_attachments_form_uid ON attachments(form_uid);
CREATE INDEX IF NOT EXISTS idx_attachments_submission ON attachments(submission_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs(time DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_form_uid ON sync_logs(form_uid);

-- Index GIN pour recherche dans le JSONB
CREATE INDEX IF NOT EXISTS idx_submissions_data ON submissions USING GIN(data jsonb_path_ops);

-- =============================================================
-- Row Level Security (pour auth future)
-- =============================================================
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Policies par défaut (à affiner avec auth)
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
CREATE POLICY "Admins peuvent tout modifier"
  ON submissions FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM user_permissions WHERE is_admin = true));

DROP POLICY IF EXISTS "Admins peuvent inserer" ON submissions;
CREATE POLICY "Admins peuvent inserer"
  ON submissions FOR INSERT
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
CREATE POLICY "Admins lisent toutes les permissions"
  ON user_permissions FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM user_permissions WHERE is_admin = true));

DROP POLICY IF EXISTS "Admins modifient les permissions" ON user_permissions;
CREATE POLICY "Admins modifient les permissions"
  ON user_permissions FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM user_permissions WHERE is_admin = true));
