-- =============================================================
-- Amorçage — à exécuter UNE SEULE FOIS dans le SQL Editor Supabase
-- =============================================================
-- Après cela, toutes les migrations s'appliquent en une commande :
--
--     npm run migrate
--
-- Ce fichier crée deux choses :
--   1. `schema_migrations` : la trace de ce qui a déjà été appliqué, pour
--      que rejouer la commande ne refasse jamais le travail déjà fait ;
--   2. `exec_sql` : la fonction qui permet au script d'exécuter du SQL.
--      Supabase n'expose aucun moyen d'exécuter du SQL brut par défaut —
--      c'est la raison pour laquelle il fallait jusqu'ici tout coller à la
--      main dans le dashboard à chaque fois.
-- =============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum    TEXT,
  duration_ms INTEGER
);

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture des migrations" ON schema_migrations;
CREATE POLICY "Lecture des migrations"
  ON schema_migrations FOR SELECT USING (true);

/**
 * Exécute du SQL arbitraire.
 *
 * SECURITY DEFINER + réservée au rôle `service_role` : seule la clé serveur
 * peut l'appeler, jamais la clé anonyme exposée au navigateur.
 */
CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query;
END;
$$;

REVOKE ALL ON FUNCTION exec_sql(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
