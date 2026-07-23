-- =============================================================
-- Réconciliation des colonnes manquantes
-- =============================================================
-- `CREATE TABLE IF NOT EXISTS` ne touche jamais une table qui existe déjà :
-- si une colonne est ajoutée au schéma après coup, elle n'apparaît jamais sur
-- les bases créées avant. C'est ce qui est arrivé à `user_permissions.is_active`,
-- déclarée dans schema.sql mais absente de la base déployée — créée par un
-- script antérieur qui ne la connaissait pas.
--
-- Conséquence observée : toute lecture de `is_admin, is_active` échouait, le
-- garde d'authentification retombait sur « pas administrateur » pour TOUS les
-- comptes, et la suppression d'un formulaire répondait 403.
--
-- Ce fichier remet à niveau les tables du schéma initial. Les ALTER sont
-- idempotents : rejouer ne coûte rien.
-- =============================================================

ALTER TABLE user_permissions
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Un compte existant n'a jamais été désactivé : il reste actif.
UPDATE user_permissions SET is_active = true WHERE is_active IS NULL;

-- Tables du schéma initial, au cas où une base ancienne en manquerait
ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS validated  TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notes      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS cached_url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE sync_logs
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_user_permissions_active
  ON user_permissions(is_active) WHERE is_active = false;
