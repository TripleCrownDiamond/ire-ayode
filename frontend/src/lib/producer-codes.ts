// =============================================================
// Génération des codes producteurs et parcelles
// =============================================================
// Producteur : 2 lettres de la commune + 2 lettres de la coopérative
//              + numéro d'ordre sur 3 chiffres.   ex. TCCO001
// Parcelle   : code du producteur + numéro d'ordre de la parcelle.
//                                                 ex. TCCO001-1
//
// Les codes sont calculés une seule fois, à la création, puis stockés.
// Un changement de commune ou de coopérative ne réécrit pas un code déjà
// attribué : l'identifiant doit rester stable dans le temps.

/** Lettres significatives d'un libellé : sans accents, sans ponctuation. */
function letters(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/**
 * Mots génériques ignorés dans les noms de coopératives.
 *
 * Sans cela, « COOP Nord » et « COOP Sud » donneraient tous deux « CO » : les
 * codes resteraient uniques grâce au numéro d'ordre, mais deux lettres sur
 * quatre ne diraient plus rien. Avec cette règle, on obtient « NO » et « SU ».
 *
 * Pour appliquer la règle au pied de la lettre (2 premières lettres du libellé
 * complet, quel qu'il soit), passer IGNORE_GENERIC_WORDS à false.
 */
const IGNORE_GENERIC_WORDS = true;

const STOP_WORDS = new Set([
  "COOPERATIVE", "COOP", "GROUPEMENT", "UNION", "ASSOCIATION", "LA", "LE",
  "LES", "DE", "DES", "DU", "D", "ET", "SOCIETE",
]);

export function twoLetters(raw: string, fallback = "XX"): string {
  if (!raw?.trim()) return fallback;

  const words = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

  const meaningful = IGNORE_GENERIC_WORDS
    ? words.filter((w) => !STOP_WORDS.has(w) && /[A-Z]/.test(w))
    : words;
  const source = meaningful.length > 0 ? meaningful : words;

  const joined = letters(source.join(""));
  if (joined.length >= 2) return joined.slice(0, 2);
  if (joined.length === 1) return (joined + fallback).slice(0, 2);
  return fallback;
}

/** Préfixe commune + coopérative, sans le numéro d'ordre. */
export function codePrefix(commune?: string | null, cooperative?: string | null): string {
  return `${twoLetters(commune || "", "XX")}${twoLetters(cooperative || "", "XX")}`;
}

/**
 * Code producteur complet.
 * Le numéro d'ordre est celui de la fiche à l'intérieur du préfixe :
 * TCCO001, TCCO002… Au-delà de 999, la largeur s'étend naturellement.
 */
export function buildProducerCode(
  commune: string | null | undefined,
  cooperative: string | null | undefined,
  orderNo: number
): { code: string; prefix: string } {
  const prefix = codePrefix(commune, cooperative);
  return { code: `${prefix}${String(orderNo).padStart(3, "0")}`, prefix };
}

/** Code parcelle : code producteur suivi du numéro d'ordre de la parcelle. */
export function buildParcelCode(producerCode: string, orderNo: number): string {
  return `${producerCode}-${orderNo}`;
}

/** Marqueur des deux lettres manquantes dans un préfixe. */
export const MISSING_MARK = "XX";

/** Nombre de segments manquants dans un préfixe (0, 1 ou 2). */
export function missingSegments(prefix: string): number {
  const p = (prefix || "").toUpperCase();
  return (p.slice(0, 2) === MISSING_MARK ? 1 : 0) + (p.slice(2, 4) === MISSING_MARK ? 1 : 0);
}

/** Le code porte-t-il une information manquante ? */
export function isIncompleteCode(code: string): boolean {
  const parsed = parseProducerCode(code);
  return parsed ? missingSegments(parsed.prefix) > 0 : false;
}

/**
 * Le code peut-il être amélioré avec les informations disponibles aujourd'hui ?
 * Uniquement dans le sens du gain : on ne remplace jamais un préfixe complet,
 * et on ne dégrade jamais un préfixe partiel.
 */
export function canRecalculate(
  currentCode: string,
  commune?: string | null,
  cooperative?: string | null
): { possible: boolean; currentPrefix: string; newPrefix: string; reason?: string } {
  const parsed = parseProducerCode(currentCode);
  if (!parsed) {
    return {
      possible: false,
      currentPrefix: "",
      newPrefix: "",
      reason: "Code hors format généré — il vient du formulaire Kobo",
    };
  }

  const newPrefix = codePrefix(commune, cooperative);
  const before = missingSegments(parsed.prefix);
  const after = missingSegments(newPrefix);

  if (before === 0) {
    return {
      possible: false,
      currentPrefix: parsed.prefix,
      newPrefix,
      reason: "Le code est déjà complet",
    };
  }
  if (after >= before) {
    return {
      possible: false,
      currentPrefix: parsed.prefix,
      newPrefix,
      reason:
        after === 2
          ? "Commune et coopérative toujours manquantes"
          : "L'information manquante n'est toujours pas renseignée",
    };
  }

  return { possible: true, currentPrefix: parsed.prefix, newPrefix };
}

/** Décompose un code producteur généré, si le format correspond. */
export function parseProducerCode(
  code: string
): { prefix: string; orderNo: number } | null {
  const match = /^([A-Z]{4})(\d+)$/.exec(code.trim().toUpperCase());
  if (!match) return null;
  return { prefix: match[1], orderNo: Number(match[2]) };
}
