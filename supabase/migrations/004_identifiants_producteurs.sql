-- =============================================================
-- Identifiants producteurs
-- =============================================================
-- KoboToolbox ne fournit aucun identifiant partagé entre formulaires.
-- Plutôt que de deviner l'identité à partir du nom (source d'erreurs et de
-- confusions entre homonymes), la plateforme tient son propre référentiel :
--
--   • le formulaire contient un code producteur  → il est repris tel quel ;
--   • le formulaire n'en contient pas            → un code est attribué ici,
--     puis rattaché explicitement à chaque soumission.
--
-- Le rattachement d'une soumission à un producteur est une donnée stockée,
-- jamais une déduction faite à l'affichage.
-- =============================================================

-- Codes attribués par la plateforme : PR-0001, PR-0002…
CREATE SEQUENCE IF NOT EXISTS producer_code_seq START 1;

CREATE TABLE IF NOT EXISTS producers (
  id            BIGSERIAL PRIMARY KEY,
  -- Code unique. Repris du formulaire, ou généré par la plateforme.
  code          TEXT NOT NULL UNIQUE,
  -- Clé de comparaison insensible à la casse et aux espaces
  code_key      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  phone         TEXT DEFAULT '',
  genre         TEXT DEFAULT '',
  commune       TEXT DEFAULT '',
  village       TEXT DEFAULT '',
  cooperative   TEXT DEFAULT '',
  notes         TEXT DEFAULT '',
  -- 'kobo'      : code lu dans un formulaire
  -- 'plateforme': code attribué ici faute de code dans le formulaire
  source        TEXT NOT NULL DEFAULT 'plateforme'
                CHECK (source IN ('kobo', 'plateforme')),
  created_by    TEXT DEFAULT '',
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Rattachement explicite d'une soumission à un producteur
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS producer_id     BIGINT REFERENCES producers(id) ON DELETE SET NULL,
  -- 'kobo'      : code trouvé dans les données de la soumission
  -- 'manuel'    : rattachement fait par un utilisateur
  ADD COLUMN IF NOT EXISTS producer_source TEXT,
  ADD COLUMN IF NOT EXISTS producer_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS producer_linked_by TEXT;

CREATE INDEX IF NOT EXISTS idx_submissions_producer_id ON submissions(producer_id);
CREATE INDEX IF NOT EXISTS idx_producers_code_key ON producers(code_key);
CREATE INDEX IF NOT EXISTS idx_producers_deleted_at ON producers(deleted_at);
-- Recherche par nom dans le sélecteur de rattachement (jamais pour lier
-- automatiquement : uniquement pour aider l'utilisateur à choisir)
CREATE INDEX IF NOT EXISTS idx_producers_name ON producers(lower(name));

-- Champ du formulaire contenant le code producteur, quand il existe.
-- Renseigné automatiquement à la détection, modifiable par un administrateur.
ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS producer_code_field TEXT;

ALTER TABLE producers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tout le monde peut lire les producteurs" ON producers;
CREATE POLICY "Tout le monde peut lire les producteurs"
  ON producers FOR SELECT USING (true);

/**
 * Attribue le prochain code plateforme disponible.
 * La séquence garantit l'unicité même en cas d'appels concurrents.
 */
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

-- Aligne la séquence sur les codes déjà présents (relance idempotente)
SELECT setval(
  'producer_code_seq',
  GREATEST(
    (SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '^PR-', ''), '')::BIGINT), 0)
     FROM producers WHERE code ~ '^PR-[0-9]+$'),
    1
  )
);
