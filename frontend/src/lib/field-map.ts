// Fields to hide from display (technical metadata)
const HIDDEN_PREFIXES = [
  "_", "formhub/", "meta/", "__version__",
  "_xform_id_string", "_uuid", "_attachments",
  "_status", "_validation_status", "_geolocation",
  "_submission_time", "_submitted_by",
];

const HIDDEN_EXACT = ["_id"];

// Patterns that identify image fields by their KEY (not value)
const IMAGE_KEY_PATTERNS = [
  /photo/i, /signature/i, /image/i, /picture/i, /img/i,
  /camera/i, /capture/i, /photo/i,
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
    patterns: [/photo/i, /image/i, /picture/i, /img/i, /camera/i, /capture/i],
  },
  signature: {
    label: "Signatures",
    icon: "PenTool",
    color: "slate",
    patterns: [/signature/i],
  },
} as const;

export interface FieldInfo {
  key: string;
  value: any;
  group: string;
  isImage: boolean;
  isGeo: boolean;
  isHidden: boolean;
  label: string;
}

function isImageByValue(value: any): boolean {
  return typeof value === "string" && /\.(jpg|jpeg|png|gif|webp|bmp|tiff)/i.test(value);
}

function isImageByKey(key: string): boolean {
  return IMAGE_KEY_PATTERNS.some((p) => p.test(key));
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

      // Detect images by value extension OR by field key pattern
      const isImage = isImageByValue(value) || isImageByKey(key);

      return {
        key,
        value,
        group: classifyField(key),
        isImage,
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
  // Photo: image field with "producteur" or "photo" in key
  const photo = fields.find((f) => f.isImage && /producteur|photo/i.test(f.key));
  // Signature: image field with "signature" in key
  const signature = fields.find((f) => f.isImage && /signature/i.test(f.key));

  return { name, genre, commune, village, cooperative, technicien, superficie, photo, signature };
}

export { isParcelleField, isGeoField, isImageByValue as isImageField, cleanLabel };
