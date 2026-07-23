// =============================================================
// Registre des parcelles
// =============================================================
// Chaque parcelle géoréférencée d'une soumission rattachée à un producteur
// devient une ligne du registre, avec un code dérivé de celui du producteur :
//
//   TCCO001-1, TCCO001-2 …
//
// Le numéro d'ordre est attribué à la première détection puis conservé :
// resynchroniser ne renumérote jamais les parcelles existantes.

import { createAdmin } from "./supabase-admin";
import { buildParcelCode } from "./producer-codes";
import { parseParcellePoints, polygonAreaHa, type Point } from "./geo";

export interface DBParcel {
  id: number;
  code: string;
  producer_id: number;
  order_no: number;
  submission_id: number | null;
  form_uid: string | null;
  source_field: string | null;
  raw_points: string | null;
  points: Point[];
  point_count: number;
  area_ha: number | null;
  culture: string;
  commune: string;
  village: string;
  superficie_declaree: number | null;
  notes: string;
  created_at: string;
}

/** Champs porteurs d'un tracé de parcelle. */
function isParcelField(key: string): boolean {
  return /parcelle|plan.*parcellaire|contour|polygone|trace/i.test(key);
}

function findText(data: Record<string, any>, pattern: RegExp): string {
  const key = Object.keys(data).find(
    (k) => !k.startsWith("_") && pattern.test(k) && String(data[k] ?? "").trim() !== ""
  );
  return key ? String(data[key]).trim() : "";
}

function findNumber(data: Record<string, any>, pattern: RegExp): number | null {
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_") || !pattern.test(key)) continue;
    if (isParcelField(key)) continue;
    const num = parseFloat(String(value).replace(",", "."));
    if (!isNaN(num) && num > 0 && num < 100000) {
      // Un champ en m² est ramené en hectares
      return /m2|m²|metre/i.test(key) ? num / 10000 : num;
    }
  }
  return null;
}

export interface ExtractedParcel {
  sourceField: string;
  rawPoints: string;
  points: Point[];
  areaHa: number | null;
  culture: string;
  commune: string;
  village: string;
  superficieDeclaree: number | null;
}

/**
 * Parcelles géoréférencées contenues dans une soumission.
 * Un champ de type « plan parcellaire » = une parcelle. Les points GPS isolés
 * (`_geolocation`) ne comptent pas : c'est une position, pas un contour.
 */
export function extractParcels(data: Record<string, any>): ExtractedParcel[] {
  const parcels: ExtractedParcel[] = [];

  const culture = findText(data, /culture|speculation|spéculation/i);
  const commune = findText(data, /commune/i);
  const village = findText(data, /village|localite|hameau/i);
  const superficie = findNumber(data, /superficie|surface/i);

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_") || !isParcelField(key)) continue;
    const raw = String(value ?? "").trim();
    if (!raw) continue;

    const points = parseParcellePoints(raw);
    if (points.length === 0) continue;

    parcels.push({
      sourceField: key,
      rawPoints: raw,
      points,
      areaHa: points.length >= 3 ? polygonAreaHa(points) : null,
      culture,
      commune,
      village,
      superficieDeclaree: superficie,
    });
  }

  return parcels;
}

/** Prochain numéro d'ordre de parcelle chez un producteur. */
async function nextParcelOrder(supabase: any, producerId: number): Promise<number> {
  const { data, error } = await supabase.rpc("next_parcel_order", {
    p_producer: producerId,
  });
  if (!error && typeof data === "number") return data;

  const { data: rows } = await supabase
    .from("parcels")
    .select("order_no")
    .eq("producer_id", producerId)
    .order("order_no", { ascending: false })
    .limit(1);
  return (rows?.[0]?.order_no ?? 0) + 1;
}

/**
 * Met le registre des parcelles à jour à partir des soumissions rattachées.
 *
 * Idempotent : une parcelle déjà enregistrée (même soumission, même champ)
 * voit ses informations rafraîchies mais conserve son code et son rang.
 */
export async function syncParcels(
  options: { producerId?: number; limit?: number } = {}
): Promise<{ created: number; updated: number; skipped: number }> {
  const supabase = createAdmin();

  let query = supabase
    .from("submissions")
    .select("id, form_uid, producer_id, data, producer:producers(id, code)")
    .not("producer_id", "is", null)
    .is("deleted_at", null)
    .limit(options.limit ?? 1000);

  if (options.producerId) query = query.eq("producer_id", options.producerId);

  const { data: submissions, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const sub of submissions || []) {
    const producerCode = (sub.producer as any)?.code;
    if (!producerCode) {
      skipped += 1;
      continue;
    }

    for (const parcel of extractParcels((sub.data || {}) as Record<string, any>)) {
      const { data: existing } = await supabase
        .from("parcels")
        .select("id, code, order_no")
        .eq("submission_id", sub.id)
        .eq("source_field", parcel.sourceField)
        .maybeSingle();

      const payload = {
        producer_id: sub.producer_id,
        submission_id: sub.id,
        form_uid: sub.form_uid,
        source_field: parcel.sourceField,
        raw_points: parcel.rawPoints,
        points: parcel.points,
        point_count: parcel.points.length,
        area_ha: parcel.areaHa,
        culture: parcel.culture,
        commune: parcel.commune,
        village: parcel.village,
        superficie_declaree: parcel.superficieDeclaree,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Le code et le rang ne bougent pas : ils identifient la parcelle
        await supabase.from("parcels").update(payload).eq("id", existing.id);
        updated += 1;
        continue;
      }

      const orderNo = await nextParcelOrder(supabase, sub.producer_id);
      const { error: insertError } = await supabase.from("parcels").insert({
        ...payload,
        code: buildParcelCode(producerCode, orderNo),
        order_no: orderNo,
      });

      if (insertError) skipped += 1;
      else created += 1;
    }
  }

  return { created, updated, skipped };
}

/** Registre des parcelles, avec le producteur associé. */
export async function listParcels(options: { producerId?: number; search?: string } = {}) {
  const supabase = createAdmin();

  let query = supabase
    .from("parcels")
    .select("*, producer:producers(id, code, name, commune, cooperative, phone)")
    .is("deleted_at", null)
    .order("code", { ascending: true })
    .limit(2000);

  if (options.producerId) query = query.eq("producer_id", options.producerId);

  const { data, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  const rows = data || [];
  const q = options.search?.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((p: any) =>
    `${p.code} ${p.culture} ${p.commune} ${p.village} ${p.producer?.name ?? ""} ${
      p.producer?.code ?? ""
    }`
      .toLowerCase()
      .includes(q)
  );
}
