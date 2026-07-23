// =============================================================
// Référentiel des producteurs
// =============================================================
// KoboToolbox ne partage aucun identifiant entre formulaires. Deux stratégies,
// et une seule règle : le rattachement est une donnée stockée, jamais une
// déduction faite à l'affichage.
//
//   • Le formulaire contient un code producteur → il est repris tel quel et la
//     soumission est rattachée automatiquement (source « kobo »).
//   • Le formulaire n'en contient pas → un code est attribué ici (PR-0001…) et
//     l'utilisateur rattache la soumission (source « manuel »).
//
// Aucun rapprochement automatique par nom : deux homonymes ne doivent jamais
// être confondus.

/** Clés de formulaire susceptibles de contenir un code producteur. */
const CODE_FIELD_PATTERNS = [
  /code.*producteur/i,
  /producteur.*code/i,
  /^.*\bid[_\- ]?producteur\b/i,
  /identifiant.*producteur/i,
  /matricule/i,
  /num.*ro.*adherent/i,
  /code.*exploitant/i,
  /code.*agriculteur/i,
];

/** Champs descriptifs repris pour pré-remplir une fiche producteur. */
const NAME_PATTERNS = [/nom.*producteur/i, /pr.*nom/i, /nom.*complet/i];
const PHONE_PATTERNS = [/t.*l.*phone/i, /tel$/i, /num.*ro.*tel/i, /portable/i];

export interface ProducerProfile {
  name: string;
  phone: string;
  genre: string;
  commune: string;
  village: string;
  cooperative: string;
}

export interface DBProducer {
  id: number;
  code: string;
  code_key: string;
  name: string;
  phone: string;
  genre: string;
  commune: string;
  village: string;
  cooperative: string;
  notes: string;
  source: "kobo" | "plateforme";
  created_at: string;
  submission_count?: number;
  form_count?: number;
}

function findValue(
  data: Record<string, any>,
  patterns: RegExp[],
  exclude?: RegExp
): { key: string; value: string } | null {
  for (const pattern of patterns) {
    const key = Object.keys(data).find(
      (k) =>
        !k.startsWith("_") &&
        pattern.test(k) &&
        (!exclude || !exclude.test(k)) &&
        data[k] != null &&
        String(data[k]).trim() !== ""
    );
    if (key) return { key, value: String(data[key]).trim() };
  }
  return null;
}

/**
 * Clé de comparaison d'un code : insensible à la casse, aux espaces et aux
 * séparateurs. « P-0042 », « p 0042 » et « P0042 » désignent le même code.
 */
export function normalizeCode(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Code producteur présent dans les données d'une soumission, s'il y en a un.
 * `fieldKey` force la lecture d'un champ précis (configuré sur le formulaire).
 */
export function extractProducerCode(
  data: Record<string, any>,
  fieldKey?: string | null
): { key: string; code: string } | null {
  if (fieldKey && data[fieldKey] != null && String(data[fieldKey]).trim() !== "") {
    return { key: fieldKey, code: String(data[fieldKey]).trim() };
  }
  const found = findValue(data, CODE_FIELD_PATTERNS);
  return found ? { key: found.key, code: found.value } : null;
}

/** Détecte le champ « code producteur » d'un formulaire à partir d'un échantillon. */
export function detectProducerCodeField(samples: Record<string, any>[]): string | null {
  for (const data of samples) {
    const found = extractProducerCode(data);
    if (found) return found.key;
  }
  return null;
}

/**
 * Informations descriptives d'une soumission — servent uniquement à
 * pré-remplir une nouvelle fiche producteur, jamais à rapprocher des fiches.
 */
export function extractProfile(data: Record<string, any>): ProducerProfile {
  return {
    name: findValue(data, NAME_PATTERNS, /technicien|enqueteur|agent/i)?.value || "",
    phone: findValue(data, PHONE_PATTERNS, /technicien|agent/i)?.value || "",
    genre: findValue(data, [/genre|sexe/i])?.value || "",
    commune: findValue(data, [/commune/i])?.value || "",
    village: findValue(data, [/village|localite|hameau/i])?.value || "",
    cooperative: findValue(data, [/coop.*rative|groupement|union/i])?.value || "",
  };
}

export const PRODUCER_SOURCE_LABELS: Record<string, string> = {
  kobo: "code lu dans le formulaire",
  plateforme: "code attribué par la plateforme",
};

export const LINK_SOURCE_LABELS: Record<string, string> = {
  kobo: "rattaché automatiquement via le code du formulaire",
  manuel: "rattaché manuellement",
};
