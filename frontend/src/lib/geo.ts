// Utilitaires géospatiaux — sans dépendance Leaflet (pour SSR)

export interface Point {
  lat: number;
  lng: number;
}

/**
 * Parse une chaîne de points GPS Kobo au format "lat lng alt acc; lat lng alt acc"
 * Format Kobo : "8.0508043 2.5049482 204.2 3.766;8.0507089 2.5049251 203.9 2.333"
 * Retourne un tableau de {lat, lng}
 */
export function parseParcellePoints(raw: string): Point[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const [lat, lng] = part.split(/\s+/).map(Number);
      if (isNaN(lat) || isNaN(lng)) return null;
      return { lat, lng };
    })
    .filter(Boolean) as Point[];
}

/**
 * Parse une chaîne GPS simple "lat lng alt acc" → {lat, lng}
 */
export function parseGeoPoint(raw: string): Point | null {
  if (!raw) return null;
  const [lat, lng] = raw.split(/\s+/).map(Number);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}


