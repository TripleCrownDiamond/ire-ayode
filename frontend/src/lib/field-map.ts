import { isImageValue, isFileValue } from "@/lib/attachments";

// Fields to hide from display (technical metadata)
const HIDDEN_PREFIXES = [
  "_", "formhub/", "meta/", "__version__",
  "_xform_id_string", "_uuid", "_attachments",
  "_status", "_validation_status", "_geolocation",
  "_submission_time", "_submitted_by",
];

const HIDDEN_EXACT = ["_id"];

// Patterns that identify media fields by their KEY (not value)
const IMAGE_KEY_PATTERNS = [
  /photo/i, /signature/i, /image/i, /picture/i, /img/i,
  /camera/i, /capture/i, /scan/i, /cliche/i, /visuel/i, /piece.*jointe/i,
];

// Keys that mention a media word but never hold a file (counts, yes/no...)
const NOT_MEDIA_KEY_PATTERNS = [
  /nombre.*(photo|image|scan)/i, /combien/i, /_count$/i, /_note$/i,
];

// Field categories for grouping
export const FIELD_GROUPS = {
  producteur: {
    label: "Producteur",
    icon: "User",
    color: "blue",
    patterns: [
      /nom.*producteur/i, /pr.*nom/i, /genre/i, /commune/i,
      /arrondissement/i, /village/i, /coop.*rative/i, /ann.*e.*dans.*la.*bio/i,
      /technicien/i,
    ],
  },
  parcelle: {
    label: "Parcelle",
    icon: "MapPin",
    color: "green",
    patterns: [
      /parcelle/i, /plan.*parcellaire/i, /superficie/i, /culture/i,
      /coordon/i, /gps/i, /anacard/i, /exploitation/i,
      /betail/i, /disposez/i,
    ],
  },
  calendrier: {
    label: "Calendrier agricole",
    icon: "Calendar",
    color: "amber",
    patterns: [
      /p.*riode/i, /date/i, /desherbage/i, /elagage/i,
      /pare.*feu/i, /recolte/i, /mise en place/i,
    ],
  },
  recolte: {
    label: "Production",
    icon: "TrendingUp",
    color: "emerald",
    patterns: [
      /recolte.*estim/i, /kg/i, /main.*d.*oeuvre/i,
      /rendement/i, /production/i,
    ],
  },
  photo: {
    label: "Photos",
    icon: "Camera",
    color: "purple",
    patterns: [/photo/i, /image/i, /picture/i, /img/i, /camera/i, /capture/i, /scan/i],
  },
  signature: {
    label: "Signatures",
    icon: "PenTool",
    color: "slate",
    patterns: [/signature/i, /paraphe/i, /emargement/i, /émargement/i],
  },
} as const;

export interface FieldInfo {
  key: string;
  value: any;
  group: string;
  /** Affichable dans une balise <img> */
  isImage: boolean;
  /** Fichier joint non-image (PDF, doc…) → lien de téléchargement */
  isFile: boolean;
  isGeo: boolean;
  isHidden: boolean;
  label: string;
}

function isImageByValue(value: any): boolean {
  return isImageValue(value);
}

function isImageByKey(key: string): boolean {
  if (NOT_MEDIA_KEY_PATTERNS.some((p) => p.test(key))) return false;
  return IMAGE_KEY_PATTERNS.some((p) => p.test(key));
}

/**
 * Un champ est une image si sa valeur porte une extension image, ou si sa clé
 * désigne un média ET que la valeur ressemble à un nom de fichier.
 * La 2e règle rattrape les formulaires dont les signatures sont stockées sans
 * extension reconnue ; la condition « ressemble à un fichier » évite de traiter
 * un champ texte (« nombre de photos : 3 ») comme une image.
 */
function detectMedia(key: string, value: any): { isImage: boolean; isFile: boolean } {
  if (typeof value !== "string" || !value.trim()) return { isImage: false, isFile: false };
  if (isImageByValue(value)) return { isImage: true, isFile: false };
  if (isImageByKey(key)) {
    // Clé média : on l'affiche comme image même si l'extension est inconnue,
    // sauf pour les formats clairement non affichables.
    if (/\.(pdf|doc|docx|xls|xlsx|csv|zip|mp3|mp4|3gp|m4a|wav|ogg)(\?|$)/i.test(value))
      return { isImage: false, isFile: true };
    // La valeur doit contenir un point (nom de fichier) — un « oui/non » ou un
    // libellé de choix ne doit jamais devenir une image cassée.
    if (isFileValue(value) || (value.includes(".") && !/\s/.test(value)))
      return { isImage: true, isFile: false };
  }
  if (isFileValue(value)) return { isImage: false, isFile: true };
  return { isImage: false, isFile: false };
}

/** Signature ou paraphe — inclut les variantes « signature du producteur », « emargement ». */
function isSignatureField(key: string): boolean {
  return /signature|paraphe|emargement|émargement/i.test(key);
}

function isGeoField(key: string): boolean {
  return /geopoint|gps|coordon/i.test(key);
}

function isParcelleField(key: string): boolean {
  return /parcelle|plan.*parcellaire/i.test(key);
}

function cleanLabel(key: string): string {
  return key
    .replace(/group_[a-z0-9]+\//g, "")
    .replace(/_/g, " ")
    .replace(/\//g, " — ")
    .replace(/\s+d\s+/g, " d'")
    .replace(/\s+l\s+/g, " l'")
    .replace(/\s+n\s+/g, " n'")
    .replace(/\s+s\s+/g, " s'")
    .replace(/\s+c\s+/g, " c'")
    .replace(/\s+jusqu\s+/g, " jusqu'")
    .replace(/\s+quelqu\s+/g, " quelqu'")
    .replace(/\s+entr\s+/g, " entr'")
    .trim();
}

function classifyField(key: string): string {
  // Les signatures priment : « signature_photo » est une signature, pas une photo.
  if (isSignatureField(key)) return "signature";
  for (const [group, config] of Object.entries(FIELD_GROUPS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(key)) return group;
    }
  }
  return "autre";
}

export function parseFields(data: Record<string, any>): FieldInfo[] {
  return Object.entries(data)
    .map(([key, value]) => {
      const isHidden =
        HIDDEN_EXACT.includes(key) ||
        HIDDEN_PREFIXES.some((p) => key.startsWith(p));

      const { isImage, isFile } = detectMedia(key, value);

      return {
        key,
        value,
        group: classifyField(key),
        isImage,
        isFile,
        isGeo: isGeoField(key),
        isHidden,
        label: cleanLabel(key),
      };
    })
    .filter((f) => !f.isHidden);
}

export function getFieldsByGroup(fields: FieldInfo[]) {
  const groups: Record<string, FieldInfo[]> = {};
  for (const field of fields) {
    if (!groups[field.group]) groups[field.group] = [];
    groups[field.group].push(field);
  }
  return groups;
}

export function getMainInfo(fields: FieldInfo[]) {
  const name = fields.find(
    (f) => /nom.*producteur|pr.*nom/i.test(f.key) && !/technicien/i.test(f.key)
  );
  const genre = fields.find((f) => /genre/i.test(f.key));
  const commune = fields.find((f) => /commune/i.test(f.key));
  const village = fields.find((f) => /village/i.test(f.key));
  const cooperative = fields.find((f) => /coop.*rative/i.test(f.key));
  const technicien = fields.find((f) => /technicien/i.test(f.key));
  const superficie = fields.find((f) => /superficie.*l.*exploitation/i.test(f.key));
  // Photo : champ image qui n'est pas une signature (portrait du producteur en priorité)
  const photo =
    fields.find((f) => f.isImage && !isSignatureField(f.key) && /producteur/i.test(f.key)) ||
    fields.find((f) => f.isImage && !isSignatureField(f.key));
  // Signature : champ image dont la clé mentionne une signature
  const signature = fields.find((f) => f.isImage && isSignatureField(f.key));

  return { name, genre, commune, village, cooperative, technicien, superficie, photo, signature };
}

export {
  isParcelleField,
  isGeoField,
  isSignatureField,
  isImageByValue as isImageField,
  cleanLabel,
};
