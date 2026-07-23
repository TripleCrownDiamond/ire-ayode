# Migrations de base de données

## Non, le déploiement n'efface rien

Un déploiement Vercel ne fait que reconstruire l'application Next.js. Il ne se
connecte jamais à la base et n'exécute aucun SQL — il n'existe aucun script de
migration dans le pipeline de build, et aucune migration ne contient de `DROP
TABLE` ni de `TRUNCATE`.

Si le schéma semblait « revenir en arrière » après chaque déploiement, c'était
pour l'une de ces trois raisons :

**1. Aucune trace de ce qui était appliqué.** Il n'existait pas de table de
suivi. Impossible de savoir ce qui était déjà en place, donc on rejouait tout
par précaution — d'où l'impression de devoir recommencer.

**2. Le script précédent ne fonctionnait pas.** `apply-migration.js` appelait
une fonction `exec_sql` que personne ne créait. Il échouait donc
systématiquement et affichait « collez le SQL dans le dashboard ». Toute
migration passait forcément par un copier-coller manuel.

**3. Le cache de schéma de PostgREST.** C'est le piège le plus trompeur.
Supabase met en cache la structure des tables. Après un `ALTER TABLE`, l'API
peut continuer à répondre « column does not exist » pendant un moment. On
rejoue alors la migration, le cache se recharge au passage, et tout se remet à
marcher — ce qui donne l'illusion parfaite que la migration avait été perdue.

La commande `npm run migrate` recharge désormais ce cache explicitement à la
fin de chaque exécution.

## Mise en place

### Option recommandée — connexion directe, rien à préparer

Récupérez la chaîne de connexion : **Supabase → Settings → Database →
Connection string → URI**, puis ajoutez-la dans `.env` :

```
DATABASE_URL=postgresql://postgres.<ref>:<mot-de-passe>@<host>:5432/postgres
```

C'est tout — la table de suivi se crée toute seule au premier lancement.
Ce mode a trois avantages :

- **chaque migration s'exécute dans une transaction** : si une instruction
  échoue, rien n'est appliqué, la base ne reste jamais à moitié migrée ;
- aucune fonction `exec_sql` à créer ;
- aucune étape manuelle, jamais.

`.env` est ignoré par git — cette chaîne contient un mot de passe, elle ne
doit jamais être versionnée ni collée dans une conversation.

### Option alternative — via l'API Supabase

Sans `DATABASE_URL`, le script passe par l'API et a besoin d'une fonction
`exec_sql`. Collez alors une fois
[`supabase/bootstrap.sql`](supabase/bootstrap.sql) dans le SQL Editor.
Ce mode n'offre pas de transaction par migration.

## Ensuite

```bash
npm run migrate
```

La commande lit `supabase/migrations/`, compare avec ce qui est enregistré,
et n'applique que le manquant, dans l'ordre. La relancer sur une base à jour
n'a aucun effet — c'est sans risque et c'est le point : **vous n'avez plus à
vous demander ce qui est appliqué.**

Pour regarder sans rien modifier :

```bash
npm run migrate:status
```

```
  connexion Postgres directe
  7 migration(s) sur le disque

  [x] 001_schema_initial            — appliquée le 23/07/2026 11:04:12
  [x] 002_persistance_locale        — appliquée le 23/07/2026 11:04:13
  [ ] 003_suppression_formulaires   — en attente

  1 en attente.
```

Trois états :

| | Signification |
|---|---|
| `[x]` | Appliquée, fichier inchangé depuis |
| `[ ]` | En attente |
| `[~]` | Appliquée, mais le fichier a été modifié depuis — rien n'est rejoué automatiquement |

## Vérifier depuis l'application déployée

`GET /api/health/schema` (authentifié) répond ce qui manque réellement, en
testant chaque colonne dont dépend une fonctionnalité :

```json
{
  "up_to_date": false,
  "checks_passed": 8,
  "checks_total": 11,
  "missing_migrations": ["005", "006"],
  "hint": "Migrations à appliquer : 005, 006. Lancez « npm run migrate »."
}
```

C'est le réflexe à avoir après un déploiement, plutôt que de rejouer les
migrations à l'aveugle.

## Ajouter une migration

Créez un fichier numéroté dans `supabase/migrations/` :

```
supabase/migrations/008_ma_nouvelle_migration.sql
```

L'ordre d'application suit l'ordre alphabétique des noms — d'où la
numérotation sur trois chiffres.

Écrivez-la idempotente, pour qu'un rejeu soit toujours sans effet :

```sql
ALTER TABLE ma_table ADD COLUMN IF NOT EXISTS ma_colonne TEXT;
CREATE INDEX IF NOT EXISTS idx_ma_table_ma_colonne ON ma_table(ma_colonne);

-- Les politiques RLS ne connaissent pas IF NOT EXISTS : on les supprime d'abord
DROP POLICY IF EXISTS "Ma politique" ON ma_table;
CREATE POLICY "Ma politique" ON ma_table FOR SELECT USING (true);
```

Si une migration échoue, elle n'est pas enregistrée : corrigez le fichier et
relancez. Rien n'est marqué comme appliqué tant que le SQL n'est pas passé.

### Le piège de `CREATE TABLE IF NOT EXISTS`

Cette instruction ne touche **jamais** une table qui existe déjà. Ajouter une
colonne à un `CREATE TABLE` existant ne l'ajoutera donc pas aux bases créées
avant — elles resteront silencieusement en retard.

C'est exactement ce qui est arrivé à `user_permissions.is_active` : déclarée
dans le schéma, absente de la base déployée, et une seule requête lisant
`is_admin, is_active` échouait entièrement — tous les comptes se retrouvaient
sans droits d'administration, et la suppression d'un formulaire répondait 403.

Pour ajouter une colonne à une table existante, il faut toujours un `ALTER` :

```sql
ALTER TABLE ma_table ADD COLUMN IF NOT EXISTS ma_colonne TEXT DEFAULT '';
```

## Rejouer une migration précise

```bash
node scripts/migrate.js --force 004_identifiants_producteurs
```

À réserver aux cas où vous savez pourquoi vous le faites.
