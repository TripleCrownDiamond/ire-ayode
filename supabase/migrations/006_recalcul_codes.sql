-- =============================================================
-- Recalcul des codes producteurs incomplets
-- =============================================================
-- Un producteur créé sans commune ni coopérative reçoit un code à trous :
-- XXXX003, ou TCXX007 si seule la commune était connue.
--
-- Lorsque l'information manquante arrive (saisie manuelle, nouvelle
-- soumission), le code peut être recalculé. L'ancien code est conservé :
-- il a pu être imprimé, communiqué ou noté sur le terrain.
-- =============================================================

ALTER TABLE producers
  -- Codes portés précédemment, du plus ancien au plus récent
  ADD COLUMN IF NOT EXISTS previous_codes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS code_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS code_updated_by TEXT;

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS previous_codes TEXT[] DEFAULT '{}';

-- Retrouver un producteur par un ancien code (étiquette déjà distribuée)
CREATE INDEX IF NOT EXISTS idx_producers_previous_codes
  ON producers USING GIN(previous_codes);
CREATE INDEX IF NOT EXISTS idx_parcels_previous_codes
  ON parcels USING GIN(previous_codes);
