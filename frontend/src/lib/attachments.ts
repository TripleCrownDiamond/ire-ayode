// Résolution des pièces jointes Kobo (images, signatures, scans...)
// Un seul endroit pour la logique de correspondance « valeur du champ » → « URL Kobo ».
//
// Kobo renomme les fichiers à l'upload : espaces → "_", caractères accentués
// translittérés, casse conservée mais non fiable. La valeur stockée dans la
// soumission ne correspond donc pas toujours octet pour octet au `filename`
// de l'attachment : il faut normaliser des deux côtés.

export interface KoboAttachment {
  filename?: string;
  media_file_basename?: string;
  question_xpath?: string;
  download_url?: string;
  download_medium_url?: string;
  download_large_url?: string;
  download_small_url?: string;
  mimetype?: string;
  [k: string]: unknown;
}

/** Extensions considérées comme des médias affichables en <img>. */
const IMAGE_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "svg", "heic", "heif", "avif",
];

const IMAGE_EXT_RE = new RegExp(`\\.(${IMAGE_EXTENSIONS.join("|")})(\\?|$)`, "i");

/**
 * Extensions non-image acceptées comme pièces jointes.
 * La liste est fermée volontairement : une règle générique du type
 * « un point suivi de 2 à 5 caractères » classait « 8.0508043 2.5049482 3.766 »
 * (coordonnées GPS), « 1.25 » (superficie) ou « 97.12.34.56 » (téléphone)
 * comme des fichiers.
 */
const DOCUMENT_EXTENSIONS = [
  "pdf", "doc", "docx", "odt", "rtf", "txt",
  "xls", "xlsx", "ods", "csv",
  "ppt", "pptx",
  "zip", "rar", "7z",
  "mp3", "m4a", "wav", "ogg", "oga", "amr", "aac",
  "mp4", "3gp", "3gpp", "mov", "avi", "mkv", "webm",
];

const ALL_FILE_EXTENSIONS = [...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS];

/** Extension de fichier reconnue, en fin de valeur. */
const ANY_FILE_RE = new RegExp(`\\.(${ALL_FILE_EXTENSIONS.join("|")})(\\?|$)`, "i");

/**
 * Extension plausible mais inconnue : uniquement des lettres.
 * Sert de garde-fou pour les champs média dont le format n'est pas listé —
 * jamais pour du texte libre, et jamais pour une valeur numérique.
 */
const LETTER_EXT_RE = /^[^\s]+\.[a-z]{2,5}$/i;

/**
 * Normalise un nom de fichier pour la comparaison :
 * décodage URL, suppression du chemin, translittération des accents,
 * remplacement des séparateurs par "_", passage en minuscules.
 */
export function normalizeName(raw: string): string {
  if (!raw) return "";
  let s = raw;
  try {
    s = decodeURIComponent(s);
  } catch {
    // valeur déjà décodée ou mal encodée — on garde telle quelle
  }
  s = s.split(/[\\/]/).pop() || s;
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return s.replace(/[\s\-]+/g, "_").toLowerCase().trim();
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/** La valeur du champ ressemble-t-elle à un fichier image ? */
export function isImageValue(value: unknown): boolean {
  return typeof value === "string" && IMAGE_EXT_RE.test(value.trim());
}

/** La valeur du champ porte-t-elle une extension de fichier reconnue ? */
export function isFileValue(value: unknown): boolean {
  return typeof value === "string" && ANY_FILE_RE.test(value.trim());
}

/**
 * Nom de fichier plausible à extension inconnue (« signature.sig »).
 * Exclut les nombres et les listes de coordonnées : l'extension doit être
 * alphabétique et la valeur ne doit pas contenir d'espace ni de séparateur
 * de points GPS.
 */
export function looksLikeFilename(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || v.includes(";") || /\d\s+\d/.test(v)) return false;
  return LETTER_EXT_RE.test(v);
}

/**
 * Index de recherche construit une fois par soumission.
 * Toutes les URL candidates sont conservées par ordre de préférence :
 * l'original d'abord (Kobo ne génère pas toujours les miniatures pour les
 * PNG de signature — d'où des images « manquantes » alors que le fichier existe).
 */
export interface AttachmentIndex {
  /** Toutes les URL candidates de chaque attachment, dans l'ordre de préférence. */
  all: string[][];
  byXpath: Map<string, string[]>;
  byName: Map<string, string[]>;
  count: number;
}

function candidateUrls(att: KoboAttachment): string[] {
  // L'original en premier : c'est le seul systématiquement présent.
  const urls = [
    att.download_url,
    att.download_medium_url,
    att.download_large_url,
    att.download_small_url,
  ].filter((u): u is string => typeof u === "string" && u.length > 0);
  return Array.from(new Set(urls));
}

export function buildAttachmentIndex(attachments: unknown): AttachmentIndex {
  const list: KoboAttachment[] = Array.isArray(attachments) ? attachments : [];
  const index: AttachmentIndex = {
    all: [],
    byXpath: new Map(),
    byName: new Map(),
    count: 0,
  };

  for (const att of list) {
    const urls = candidateUrls(att);
    if (urls.length === 0) continue;

    index.all.push(urls);
    index.count += 1;

    if (att.question_xpath) {
      index.byXpath.set(att.question_xpath, urls);
      // Kobo utilise "-" comme séparateur de groupe dans certains exports
      index.byXpath.set(att.question_xpath.replace(/-/g, "/"), urls);
    }

    const names = [att.media_file_basename, att.filename].filter(
      (n): n is string => typeof n === "string" && n.length > 0
    );
    for (const name of names) {
      const norm = normalizeName(name);
      if (!norm) continue;
      // On n'écrase jamais une entrée existante : le premier attachment gagne,
      // ce qui évite qu'un fichier homonyme ultérieur ne vole la correspondance.
      if (!index.byName.has(norm)) index.byName.set(norm, urls);
      const noExt = stripExtension(norm);
      if (noExt && !index.byName.has(noExt)) index.byName.set(noExt, urls);
    }
  }

  return index;
}

/**
 * Retrouve les URL d'un champ média.
 * Stratégies par ordre de fiabilité décroissante — on s'arrête à la première
 * qui matche pour ne jamais afficher la photo d'un autre champ.
 */
export function resolveAttachment(
  index: AttachmentIndex,
  fieldValue: unknown,
  fieldKey?: string
): string[] | undefined {
  // 1. xpath de la question — la correspondance exacte fournie par Kobo
  if (fieldKey) {
    const byXpath = index.byXpath.get(fieldKey);
    if (byXpath) return byXpath;
  }

  const value = typeof fieldValue === "string" ? fieldValue.trim() : "";
  if (value) {
    const norm = normalizeName(value);

    // 2. nom de fichier normalisé
    const exact = index.byName.get(norm);
    if (exact) return exact;

    // 3. nom sans extension (Kobo peut convertir jpeg → jpg)
    const noExt = stripExtension(norm);
    if (noExt) {
      const byNoExt = index.byName.get(noExt);
      if (byNoExt) return byNoExt;
    }

    // 4. correspondance par préfixe : Kobo suffixe parfois "_1", "-2"…
    if (noExt.length >= 6) {
      for (const [key, urls] of index.byName) {
        const keyNoExt = stripExtension(key);
        if (keyNoExt.startsWith(noExt) || noExt.startsWith(keyNoExt)) return urls;
      }
    }
  }

  // 5. dernier recours : une seule pièce jointe et un champ média sans valeur
  //    exploitable → c'est forcément celle-là.
  if (index.count === 1 && (!value || !isFileValue(value))) return index.all[0];

  return undefined;
}
