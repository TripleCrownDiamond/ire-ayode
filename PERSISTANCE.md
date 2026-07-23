# Persistance des données

Les données saisies restent dans la plateforme, indépendamment de KoboToolbox.
Une soumission n'est retirée que si un utilisateur la supprime explicitement.

## Ce qui est garanti

| Événement | Effet dans la plateforme |
|---|---|
| Soumission supprimée sur KoboToolbox | Conservée, marquée « Archivée ». Ses images restent visibles si elles ont été archivées. |
| Formulaire supprimé sur KoboToolbox | Conservé, marqué absent. Ses soumissions restent accessibles. |
| Soumission modifiée sur KoboToolbox | La version locale n'est pas écrasée : les corrections saisies ici priment. |
| Utilisateur clique sur « Supprimer » | Retirée de toutes les vues. Restaurable depuis **Données & archivage**. |

La synchronisation n'exécute aucune suppression : elle insère les nouvelles
soumissions et signale celles qui ont disparu de Kobo (`missing_on_kobo`).

## Mise en service

### 1. Appliquer la migration

```bash
node scripts/apply-migration.js supabase/migrations/002_persistance_locale.sql
```

Si l'exécution automatique échoue (la fonction `exec_sql` n'existe pas par
défaut), ouvrez le SQL Editor du projet Supabase et collez le contenu de
`supabase/migrations/002_persistance_locale.sql`.

La migration ajoute :

- `submissions.deleted_at` / `deleted_by` / `delete_reason` — suppression logique ;
- `submissions.missing_on_kobo` / `kobo_last_seen_at` — suivi de présence sur Kobo ;
- `submissions.media_archived_at` / `media_count` — état de l'archivage ;
- `attachments.storage_path` / `size_bytes` / `archived_at` — copie locale des fichiers ;
- le bucket privé `kobo-media` ;
- le remplacement de `ON DELETE CASCADE` par `ON DELETE SET NULL` sur `form_uid` :
  la disparition d'un formulaire ne doit plus effacer ses soumissions.

### 2. Archiver les médias existants

Les photos, signatures et scans étaient jusqu'ici lus en direct sur Kobo. Pour
que l'historique survive à une suppression côté Kobo, il faut les copier une
première fois :

**Depuis l'interface** — page *Données & archivage* (menu administrateur),
bouton « Archiver les médias manquants ». Le traitement s'enchaîne par lots
jusqu'à épuisement.

**Ou en ligne de commande** — relancer jusqu'à `"done": true` :

```bash
curl -X POST "https://<domaine>/api/media/archive?limit=25" -H "Cookie: <session>"
```

Les synchronisations suivantes archivent automatiquement les nouveaux fichiers,
dans le temps restant de la fonction.

## Fonctionnement de l'affichage des images

`/api/media/[uid]/[...filename]` sert, dans l'ordre :

1. la copie archivée dans Supabase Storage (`X-Media-Source: archive`) ;
2. les URL Kobo transmises en `?url=` (original, puis miniatures) ;
3. les chemins Kobo reconstruits.

Une image reste donc affichable même après la suppression de la soumission sur
KoboToolbox, dès lors qu'elle a été archivée au moins une fois.

## Corbeille

`Données & archivage` liste les soumissions supprimées avec leur auteur, leur
date et leur motif, et permet de les restaurer. Rien n'est effacé physiquement
de la base : une suppression accidentelle reste réparable.
