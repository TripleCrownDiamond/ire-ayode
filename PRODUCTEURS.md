# Producteurs et parcelles

KoboToolbox ne partage aucun identifiant entre formulaires. La plateforme tient
donc son propre référentiel : **le rattachement d'une fiche à un producteur est
une donnée stockée, jamais une déduction faite à l'affichage.**

Aucun rapprochement n'est deviné à partir des noms — deux homonymes restent
deux producteurs distincts.

## Identifiants

### Code producteur

`2 lettres de la commune` + `2 lettres de la coopérative` + `numéro d'ordre`

| Commune | Coopérative | N° | Code |
|---|---|---|---|
| Tchaourou | COOP Nord | 1 | `TCNO001` |
| Tchaourou | COOP Nord | 2 | `TCNO002` |
| Nikki | Groupement Alafia | 12 | `NIAL012` |
| *(absente)* | *(absente)* | 3 | `XXXX003` |

Le numéro d'ordre est propre à chaque préfixe : `TCNO001` et `NIAL001`
coexistent sans conflit. Un verrou en base empêche deux créations simultanées
d'obtenir le même numéro.

**Un point d'attention** : les mots génériques des noms de coopératives
(`COOP`, `COOPÉRATIVE`, `GROUPEMENT`, `UNION`…) sont ignorés. Sans cette règle,
« COOP Nord » et « COOP Sud » donneraient tous deux `CO`, et deux lettres sur
quatre ne diraient plus rien. Pour appliquer la règle au pied de la lettre,
passez `IGNORE_GENERIC_WORDS` à `false` dans
[producer-codes.ts](frontend/src/lib/producer-codes.ts).

Un code complet n'est **jamais** recalculé, même si la commune ou la
coopérative du producteur change ensuite : l'identifiant doit rester stable.

### Compléter un code à trous

Un producteur créé sans commune ni coopérative reçoit un code incomplet —
`XXXX003`, ou `TCXX007` si seule la commune était connue. Dès que
l'information manquante est renseignée, le code peut être recalculé.

Le recalcul ne va que dans le sens du gain :

| Code actuel | Information disponible | Résultat |
|---|---|---|
| `XXXX003` | commune + coopérative | `TCNO001` |
| `XXXX003` | commune seule | `TCXX001` |
| `TCXX007` | coopérative arrive | `TCNO001` |
| `TCXX007` | rien de nouveau | inchangé |
| `TCNO001` | — | inchangé, déjà complet |
| `P-0042` | — | inchangé, code du formulaire Kobo |

- Un code venu d'un formulaire Kobo n'est jamais réécrit.
- L'ancien code est conservé dans `previous_codes` : il a pu être imprimé ou
  noté sur le terrain, et reste consultable sur la fiche.
- Les codes des parcelles suivent en gardant leur numéro d'ordre :
  `XXXX003-2` devient `TCNO001-2`.

**Où le faire** : un bandeau sur la page Producteurs recense les codes
incomplets et recalcule en une fois ceux qui le peuvent. Sur une fiche
producteur, le bouton apparaît dès que la commune ou la coopérative est
renseignée.

### Code parcelle

`code du producteur` + `-` + `numéro d'ordre de la parcelle`

```
TCNO001-1    TCNO001-2    TCNO001-3
```

Le numéro est attribué à la première détection puis conservé : réactualiser le
registre ne renumérote jamais les parcelles existantes.

## Deux façons de rattacher une fiche

### 1. Le formulaire contient déjà un code

Si une soumission porte un champ `code_producteur`, `id_producteur`,
`matricule`… ce code est repris tel quel et le rattachement est automatique à
chaque synchronisation. Le champ détecté est mémorisé sur le formulaire
(`forms.producer_code_field`) pour les fois suivantes.

Bouton **« Rattacher via les codes »** sur la page Producteurs pour traiter
l'historique en une fois.

### 2. Le formulaire n'en contient pas

La plateforme attribue le code et l'utilisateur fait le lien :

- depuis une soumission — panneau **« Rattacher à un producteur »** : choisir
  une fiche existante ou en créer une (commune, village, téléphone et
  coopérative sont repris de la soumission) ;
- en série — page **Producteurs → Fiches à rattacher**, qui liste tout ce qui
  attend une décision.

## Registre des parcelles

Chaque champ de tracé (`plan_parcellaire`, `parcelle_*`, `contour`…) d'une
fiche **rattachée à un producteur** devient une ligne du registre, avec :

- son code, son producteur et son numéro d'ordre ;
- la superficie calculée depuis le polygone, à côté de la superficie déclarée
  dans le formulaire — l'écart entre les deux se lit d'un coup d'œil ;
- la culture, la commune, le village et le nombre de points GPS ;
- un lien vers la soumission d'origine.

Un point GPS isolé (`_geolocation`) n'est pas une parcelle : c'est une position,
pas un contour.

La page **Parcelles** propose la vue liste et la vue carte, et le bouton
« Actualiser le registre » relit toutes les fiches rattachées.

## Mise en service

```bash
node scripts/apply-migration.js supabase/migrations/004_identifiants_producteurs.sql
node scripts/apply-migration.js supabase/migrations/005_codes_et_parcelles.sql
node scripts/apply-migration.js supabase/migrations/006_recalcul_codes.sql
```

Puis, dans l'interface :

1. **Producteurs → Rattacher via les codes** — traite les formulaires qui
   portent déjà un code producteur ;
2. **Producteurs → Fiches à rattacher** — traite le reste ;
3. **Parcelles → Actualiser le registre** — construit le registre des parcelles.

Les synchronisations suivantes enchaînent ces trois étapes automatiquement.
