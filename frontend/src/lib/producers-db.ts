// =============================================================
// Accès base au référentiel producteurs
// =============================================================
// Toutes les écritures passent par ici afin que la règle d'unicité du code
// (`code_key`) soit appliquée au même endroit.

import { createAdmin } from "./supabase-admin";
import { normalizeCode, extractProducerCode, extractProfile, type DBProducer } from "./producers";
import { buildProducerCode, codePrefix, parseProducerCode } from "./producer-codes";

export interface ProducerInput {
  code?: string;
  name?: string;
  phone?: string;
  genre?: string;
  commune?: string;
  village?: string;
  cooperative?: string;
  notes?: string;
}

/**
 * Code attribué par la plateforme :
 * 2 lettres de la commune + 2 lettres de la coopérative + numéro d'ordre.
 * Ex. commune « Tchaourou » + coopérative « COOP Nord » → TCCO001.
 */
async function nextPlatformCode(
  supabase: any,
  commune?: string,
  cooperative?: string
): Promise<{ code: string; prefix: string; orderNo: number }> {
  const prefix = codePrefix(commune, cooperative);

  // Numéro d'ordre : fourni par la fonction SQL (verrou anti-collision),
  // avec un repli applicatif si la migration n'est pas encore appliquée.
  const { data, error } = await supabase.rpc("next_producer_order", { p_prefix: prefix });
  let orderNo: number;

  if (!error && typeof data === "number") {
    orderNo = data;
  } else {
    const { data: rows } = await supabase
      .from("producers")
      .select("order_no")
      .eq("code_prefix", prefix)
      .order("order_no", { ascending: false })
      .limit(1);
    orderNo = (rows?.[0]?.order_no ?? 0) + 1;
  }

  // Garde-fou : si le code est déjà pris (reprise de données, code saisi à la
  // main), on avance jusqu'au premier libre.
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = buildProducerCode(commune, cooperative, orderNo + attempt);
    const { data: taken } = await supabase
      .from("producers")
      .select("id")
      .eq("code_key", normalizeCode(candidate.code))
      .maybeSingle();
    if (!taken) return { ...candidate, orderNo: orderNo + attempt };
  }

  throw new Error(`Impossible d'attribuer un code pour le prefixe ${prefix}`);
}

/**
 * Crée un producteur, ou renvoie l'existant si le code est déjà pris.
 * `source` distingue un code venu d'un formulaire d'un code attribué ici.
 */
export async function createProducer(
  input: ProducerInput,
  source: "kobo" | "plateforme",
  createdBy: string
): Promise<{ producer: DBProducer; created: boolean } | null> {
  const supabase = createAdmin();

  // Code fourni (venu d'un formulaire) ou calculé selon la règle commune+coop
  let code = input.code?.trim() || "";
  let prefix: string | null = null;
  let orderNo: number | null = null;

  if (code) {
    // Un code au format généré garde son préfixe et son rang
    const parsed = parseProducerCode(code);
    if (parsed) {
      prefix = parsed.prefix;
      orderNo = parsed.orderNo;
    }
  } else {
    const generated = await nextPlatformCode(supabase, input.commune, input.cooperative);
    code = generated.code;
    prefix = generated.prefix;
    orderNo = generated.orderNo;
  }

  const codeKey = normalizeCode(code);
  if (!codeKey) return null;

  const { data: existing } = await supabase
    .from("producers")
    .select("*")
    .eq("code_key", codeKey)
    .maybeSingle();

  if (existing) {
    // Complète les champs vides sans jamais écraser une saisie existante
    const patch: Record<string, string> = {};
    for (const field of ["name", "phone", "genre", "commune", "village", "cooperative"] as const) {
      const incoming = input[field]?.trim();
      if (incoming && !existing[field]) patch[field] = incoming;
    }
    if (Object.keys(patch).length > 0) {
      const { data: updated } = await supabase
        .from("producers")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("*")
        .single();
      return { producer: updated || existing, created: false };
    }
    return { producer: existing, created: false };
  }

  const { data, error } = await supabase
    .from("producers")
    .insert({
      code,
      code_key: codeKey,
      name: input.name?.trim() || "",
      phone: input.phone?.trim() || "",
      genre: input.genre?.trim() || "",
      commune: input.commune?.trim() || "",
      village: input.village?.trim() || "",
      cooperative: input.cooperative?.trim() || "",
      notes: input.notes?.trim() || "",
      code_prefix: prefix ?? codePrefix(input.commune, input.cooperative),
      order_no: orderNo,
      source,
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (error) {
    // Course entre deux créations simultanées : on relit l'existant
    const { data: raced } = await supabase
      .from("producers")
      .select("*")
      .eq("code_key", codeKey)
      .maybeSingle();
    return raced ? { producer: raced, created: false } : null;
  }

  return { producer: data, created: true };
}

/** Rattache une soumission à un producteur. `producerId` à null détache. */
export async function linkSubmission(
  submissionId: number,
  producerId: number | null,
  source: "kobo" | "manuel",
  linkedBy: string
): Promise<boolean> {
  const supabase = createAdmin();
  const { error } = await supabase
    .from("submissions")
    .update({
      producer_id: producerId,
      producer_source: producerId ? source : null,
      producer_linked_at: producerId ? new Date().toISOString() : null,
      producer_linked_by: producerId ? linkedBy : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  return !error;
}

/** Liste des producteurs avec le nombre de fiches rattachées. */
export async function listProducers(options: { search?: string; limit?: number } = {}) {
  const supabase = createAdmin();

  let query = supabase
    .from("producers")
    .select("*")
    .is("deleted_at", null)
    .order("code", { ascending: true })
    .limit(options.limit ?? 500);

  if (options.search?.trim()) {
    const q = options.search.trim();
    query = query.or(
      `name.ilike.%${q}%,code.ilike.%${q}%,phone.ilike.%${q}%,commune.ilike.%${q}%,cooperative.ilike.%${q}%`
    );
  }

  const { data: producers, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  // Comptage des fiches rattachées, en une requête
  const { data: links } = await supabase
    .from("submissions")
    .select("producer_id, form_uid")
    .not("producer_id", "is", null)
    .is("deleted_at", null);

  const counts = new Map<number, { subs: number; forms: Set<string> }>();
  for (const row of links || []) {
    const entry = counts.get(row.producer_id) || { subs: 0, forms: new Set<string>() };
    entry.subs += 1;
    if (row.form_uid) entry.forms.add(row.form_uid);
    counts.set(row.producer_id, entry);
  }

  return (producers || []).map((p: DBProducer) => ({
    ...p,
    submission_count: counts.get(p.id)?.subs ?? 0,
    form_count: counts.get(p.id)?.forms.size ?? 0,
  }));
}

/** Un producteur et toutes ses fiches, tous formulaires confondus. */
export async function getProducerWithSubmissions(id: number) {
  const supabase = createAdmin();

  const { data: producer } = await supabase
    .from("producers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!producer) return null;

  const { data: submissions } = await supabase
    .from("submissions")
    .select("*")
    .eq("producer_id", id)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false });

  const uids = [...new Set((submissions || []).map((s: any) => s.form_uid).filter(Boolean))];
  const { data: forms } = uids.length
    ? await supabase.from("forms").select("uid, name").in("uid", uids)
    : { data: [] };

  const formNames = new Map((forms || []).map((f: any) => [f.uid, f.name]));

  return {
    ...producer,
    submissions: (submissions || []).map((s: any) => ({
      ...s,
      form_name: formNames.get(s.form_uid) || s.form_uid,
    })),
  };
}

/**
 * Rattache automatiquement les soumissions dont le formulaire porte un code
 * producteur. Les autres restent « à rattacher » : c'est à l'utilisateur de
 * décider, aucun rapprochement n'est deviné.
 */
export async function autoLinkFromCodes(options: { formUid?: string; limit?: number } = {}) {
  const supabase = createAdmin();

  let query = supabase
    .from("submissions")
    .select("id, form_uid, data")
    .is("producer_id", null)
    .is("deleted_at", null)
    .limit(options.limit ?? 500);

  if (options.formUid) query = query.eq("form_uid", options.formUid);

  const { data: pending, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  // Champ code configuré par formulaire, s'il a été détecté
  const { data: forms } = await supabase.from("forms").select("uid, producer_code_field");
  const codeFields = new Map(
    (forms || []).map((f: any) => [f.uid, f.producer_code_field as string | null])
  );

  let linked = 0;
  let created = 0;
  let withoutCode = 0;

  for (const sub of pending || []) {
    const data = (sub.data || {}) as Record<string, any>;
    const found = extractProducerCode(data, codeFields.get(sub.form_uid));

    if (!found) {
      withoutCode += 1;
      continue;
    }

    const profile = extractProfile(data);
    const result = await createProducer(
      { code: found.code, ...profile },
      "kobo",
      "synchronisation"
    );
    if (!result) continue;

    if (result.created) created += 1;
    if (await linkSubmission(sub.id, result.producer.id, "kobo", "synchronisation")) {
      linked += 1;
    }

    // Mémorise le champ détecté pour les prochaines synchronisations
    if (!codeFields.get(sub.form_uid)) {
      codeFields.set(sub.form_uid, found.key);
      await supabase
        .from("forms")
        .update({ producer_code_field: found.key })
        .eq("uid", sub.form_uid);
    }
  }

  return { linked, producers_created: created, without_code: withoutCode };
}
