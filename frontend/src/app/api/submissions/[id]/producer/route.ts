import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { createProducer, linkSubmission } from "@/lib/producers-db";
import { getSubmission } from "@/lib/data";
import { extractProfile } from "@/lib/producers";

/**
 * Rattachement d'une soumission à un producteur.
 *
 *   PATCH { producer_id: 12 }         → rattache à un producteur existant
 *   PATCH { create: true, code?, … }  → crée le producteur puis rattache
 *                                       (code omis → attribué par la plateforme)
 *   PATCH { producer_id: null }       → détache
 *
 * Le rattachement est stocké : il ne dépend d'aucune ressemblance de noms.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const { id } = await params;
    const submissionId = Number(id);
    const body = await request.json().catch(() => ({}));

    // Détachement explicite
    if (body.producer_id === null && !body.create) {
      const ok = await linkSubmission(submissionId, null, "manuel", user.email);
      return NextResponse.json(
        ok ? { status: "ok", producer_id: null } : { error: "Detachement impossible" },
        { status: ok ? 200 : 500 }
      );
    }

    let producerId: number | null = null;
    let producer = null;

    if (body.create) {
      const submission = await getSubmission(submissionId);
      if (!submission) {
        return NextResponse.json({ error: "Soumission introuvable" }, { status: 404 });
      }

      // Les champs de la soumission pré-remplissent la fiche ; toute valeur
      // fournie explicitement par l'utilisateur a la priorité.
      const profile = extractProfile(submission.data as Record<string, any>);
      const result = await createProducer(
        {
          code: body.code,
          name: body.name ?? profile.name,
          phone: body.phone ?? profile.phone,
          genre: body.genre ?? profile.genre,
          commune: body.commune ?? profile.commune,
          village: body.village ?? profile.village,
          cooperative: body.cooperative ?? profile.cooperative,
        },
        body.code?.trim() ? "kobo" : "plateforme",
        user.email
      );

      if (!result) {
        return NextResponse.json({ error: "Creation du producteur impossible" }, { status: 500 });
      }
      producerId = result.producer.id;
      producer = result.producer;
    } else {
      producerId = Number(body.producer_id);
      if (!producerId || isNaN(producerId)) {
        return NextResponse.json(
          { error: "producer_id requis, ou create: true" },
          { status: 400 }
        );
      }
    }

    const ok = await linkSubmission(submissionId, producerId, "manuel", user.email);
    if (!ok) {
      return NextResponse.json({ error: "Rattachement impossible" }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", producer_id: producerId, producer });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
