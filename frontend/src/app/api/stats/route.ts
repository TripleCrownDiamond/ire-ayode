import { NextResponse } from "next/server";
import { getForms, getSubmissions } from "@/lib/data";
import { parseFields, isParcelleField } from "@/lib/field-map";
import { parseParcellePoints } from "@/lib/geo";

interface FormEntry {
  uid: string;
  name: string;
  submission_count?: number;
  deployment__submission_count?: number;
  [key: string]: unknown;
}

const FIELD_PATTERNS = {
  producteur: [/nom.*producteur/i, /pr.*nom/i],
  superficie: [/superficie.*exploitation/i, /superficie.*parcelle/i, /surface_m2/i, /superficie/i],
  genre: [/genre/i],
  commune: [/commune/i],
  village: [/village/i],
  cooperative: [/coop.*rative/i],
  technicien: [/technicien/i],
};

function findField(fields: any[], patterns: RegExp[]): any | undefined {
  return fields.find((f) => patterns.some((p) => p.test(f.key)));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const formUid = searchParams.get("form"); // Optionnel: filtrer par formulaire

    const formsData = await getForms();
    const forms = (formsData.results || []) as unknown as FormEntry[];

    // Stats de base
    const stats = {
      total_forms: 0 as number,
      total_submissions: 0 as number,
      total_producteurs: 0 as number,
      total_parcelles: 0 as number,
      superficie_totale_ha: 0 as number,
      communes: 0 as number,
      villages: 0 as number,
      cooperatives: 0 as number,
      genres: {} as Record<string, number>,
      // Stats additionnelles dynamiques
      par_formulaire: [] as Array<{
        uid: string;
        name: string;
        submissions: number;
        producteurs: number;
        parcelles: number;
      }>,
    };

    const nomsProducteurs = new Set<string>();
    const communes = new Set<string>();
    const villages = new Set<string>();
    const cooperatives = new Set<string>();
    const genres: Record<string, number> = {};

    for (const form of forms) {
      // Gère les deux formats de champ submission_count (Kobo API vs DB)
      const submissionCount = form.submission_count ?? form.deployment__submission_count ?? 0;
      if (submissionCount === 0) continue;

      // Si un filtre form est spécifié, ne traiter que celui-ci
      if (formUid && form.uid !== formUid) continue;

      try {
        const subsData = await getSubmissions(form.uid, 0, 500);
        const submissions = subsData.results || [];
        if (submissions.length === 0) continue;

        stats.total_forms++;
        stats.total_submissions += submissions.length;

        let formProducteurs = 0;
        let formParcelles = 0;

        for (const sub of submissions) {
          const rawData = (sub.data || sub || {}) as Record<string, unknown>;
          const fields = parseFields(rawData);

          // --- SUPERFICIE : cherche TOUS les champs qui semblent être une superficie ---
          const allSuperficieFields = fields.filter(
            (f) =>
              (/superficie/i.test(f.key) || /surface/i.test(f.key)) &&
              !isParcelleField(f.key) &&
              !f.isImage &&
              typeof f.value !== "object"
          );
          for (const sf of allSuperficieFields) {
            const val = parseFloat(String(sf.value).replace(",", "."));
            if (!isNaN(val) && val > 0 && val < 10000) {
              // Si c'est en m² (surface_m2), convertir en hectares
              if (/surface_m2/i.test(sf.key) || /m2/i.test(sf.key) || val > 100) {
                stats.superficie_totale_ha += val / 10000;
              } else {
                stats.superficie_totale_ha += val;
              }
            }
          }

          // --- PARCELLES : détection automatique ---
          const parcelleKeys = Object.keys(rawData).filter((k) => isParcelleField(k));
          for (const k of parcelleKeys) {
            const raw = String(rawData[k] || "");
            if (raw.includes(";")) {
              const points = parseParcellePoints(raw);
              if (points.length >= 3) formParcelles++;
            }
          }

          // --- PRODUCTEUR : détection automatique ---
          const nomField = findField(fields, FIELD_PATTERNS.producteur);
          if (nomField && String(nomField.value).trim()) {
            const nom = String(nomField.value).trim();
            if (!nomsProducteurs.has(nom)) {
              nomsProducteurs.add(nom);
              formProducteurs++;
            }
          }

          // --- GENRE ---
          const genreField = findField(fields, FIELD_PATTERNS.genre);
          if (genreField) {
            const g = String(genreField.value).trim().toLowerCase();
            genres[g] = (genres[g] || 0) + 1;
          }

          // --- COMMUNE / VILLAGE ---
          const communeField = findField(fields, FIELD_PATTERNS.commune);
          if (communeField && String(communeField.value).trim()) {
            communes.add(String(communeField.value).trim());
          }
          const villageField = findField(fields, FIELD_PATTERNS.village);
          if (villageField && String(villageField.value).trim()) {
            villages.add(String(villageField.value).trim());
          }

          // --- COOPÉRATIVE ---
          const coopField = findField(fields, FIELD_PATTERNS.cooperative);
          if (coopField && String(coopField.value).trim()) {
            cooperatives.add(String(coopField.value).trim());
          }
        }

        stats.par_formulaire.push({
          uid: form.uid,
          name: form.name || "Sans nom",
          submissions: submissions.length,
          producteurs: formProducteurs,
          parcelles: formParcelles,
        });
      } catch {
        // Ignorer les erreurs par formulaire (forme différente, pas de données geo, etc.)
        continue;
      }
    }

    stats.total_producteurs = nomsProducteurs.size;
    stats.total_parcelles = stats.par_formulaire.reduce((s, f) => s + f.parcelles, 0);
    stats.communes = communes.size;
    stats.villages = villages.size;
    stats.cooperatives = cooperatives.size;
    stats.genres = genres;
    stats.superficie_totale_ha = Math.round(stats.superficie_totale_ha * 10000) / 10000;

    return NextResponse.json({ stats });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
