-- =============================================================
-- Suppression maîtrisée des formulaires
-- Un formulaire retiré de KoboToolbox n'est jamais supprimé
-- automatiquement : la plateforme le signale et propose sa
-- suppression, qui reste une décision de l'utilisateur.
-- =============================================================

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by    TEXT,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_forms_deleted_at ON forms(deleted_at);
CREATE INDEX IF NOT EXISTS idx_forms_missing_on_kobo
  ON forms(missing_on_kobo) WHERE missing_on_kobo = true;
