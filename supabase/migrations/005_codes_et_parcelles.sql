-- =============================================================
-- Codes producteurs calculés + registre des parcelles
-- =============================================================
-- Code producteur : 2 lettres de la commune + 2 lettres de la coopérative
--                   + numéro d'ordre.        ex. TCCO001
-- Code parcelle   : code producteur + numéro d'ordre de la parcelle.
--                                            ex. TCCO001-1, TCCO001-2
-- =============================================================

ALTER TABLE producers
  -- Numéro d'ordre à l'intérieur du préfixe commune+coopérative
  ADD COLUMN IF NOT EXISTS order_no    INTEGER,
  -- Préfixe conservé pour retrouver le prochain numéro sans re-parser le code
  ADD COLUMN IF NOT EXISTS code_prefix TEXT;

CREATE INDEX IF NOT EXISTS idx_producers_prefix ON producers(code_prefix, order_no);

-- 🔷 Parcelles rattachées aux producteurs
CREATE TABLE IF NOT EXISTS parcels (
  id            BIGSERIAL PRIMARY KEY,
  -- Code lisible : <code producteur>-<numéro d'ordre>
  code          TEXT NOT NULL UNIQUE,
  producer_id   BIGINT REFERENCES producers(id) ON DELETE CASCADE,
  -- Numéro d'ordre de la parcelle chez ce producteur (1, 2, 3…)
  order_no      INTEGER NOT NULL,

  -- Origine : la soumission et le champ d'où proviennent les coordonnées
  submission_id BIGINT REFERENCES submissions(id) ON DELETE SET NULL,
  form_uid      TEXT,
  source_field  TEXT,

  -- Géométrie brute Kobo « lat lng alt acc;… » + forme exploitable
  raw_points    TEXT,
  points        JSONB NOT NULL DEFAULT '[]',
  point_count   INTEGER DEFAULT 0,
  area_ha       NUMERIC(12, 4),

  -- Informations descriptives reprises de la soumission
  culture       TEXT DEFAULT '',
  commune       TEXT DEFAULT '',
  village       TEXT DEFAULT '',
  superficie_declaree NUMERIC(12, 4),
  notes         TEXT DEFAULT '',

  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Une parcelle par (soumission, champ source) : rend la synchro idempotente
CREATE UNIQUE INDEX IF NOT EXISTS idx_parcels_source
  ON parcels(submission_id, source_field);

CREATE INDEX IF NOT EXISTS idx_parcels_producer ON parcels(producer_id, order_no);
CREATE INDEX IF NOT EXISTS idx_parcels_form ON parcels(form_uid);
CREATE INDEX IF NOT EXISTS idx_parcels_deleted ON parcels(deleted_at);

ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tout le monde peut lire les parcelles" ON parcels;
CREATE POLICY "Tout le monde peut lire les parcelles"
  ON parcels FOR SELECT USING (true);

/**
 * Prochain numéro d'ordre pour un préfixe commune+coopérative.
 * Verrou consultatif : deux créations simultanées ne peuvent pas obtenir
 * le même numéro.
 */
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

/** Prochain numéro d'ordre de parcelle pour un producteur. */
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
