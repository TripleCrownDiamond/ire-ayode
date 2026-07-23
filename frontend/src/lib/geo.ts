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
 * Formate une valeur géographique brute pour l'affichage.
 * Kobo stocke « 8.0508043 2.5049482 204.2 3.766 » (lat lng altitude précision)
 * et les parcelles sous forme de points séparés par « ; » — illisible tel quel
 * dans un tableau.
 */
export function formatGeoValue(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return String(raw ?? "");
  const points = parseParcellePoints(raw);
  if (points.length === 0) return raw;
  if (points.length === 1) {
    const p = points[0];
    return `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
  }
  const first = points[0];
  return `${points.length} points — départ ${first.lat.toFixed(5)}, ${first.lng.toFixed(5)}`;
}

/**
 * Aire d'un polygone géographique, en hectares.
 * Projection plane locale : suffisamment précise à l'échelle d'une parcelle.
 */
export function polygonAreaHa(points: Point[]): number | null {
  if (points.length < 3) return null;
  const R = 6378137;
  const latRef = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const xy = points.map((p) => ({
    x: ((p.lng * Math.PI) / 180) * R * Math.cos(latRef),
    y: ((p.lat * Math.PI) / 180) * R,
  }));
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2 / 10000;
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


