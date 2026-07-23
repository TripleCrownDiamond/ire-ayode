"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ParcelMap } from "@/components/parcel-map-client";
import { ValidationBadge } from "@/components/validation-badge";
import { parseParcellePoints } from "@/lib/geo";
import { fetchProducer, updateProducer, recalculateCodes } from "@/lib/api";
import { PRODUCER_SOURCE_LABELS, LINK_SOURCE_LABELS } from "@/lib/producers";
import { canRecalculate, isIncompleteCode } from "@/lib/producer-codes";
import {
  ArrowLeft,
  User,
  MapPin,
  Layers,
  Loader2,
  Phone,
  Hash,
  Calendar,
  Archive,
  Pencil,
  Save,
  X,
  RefreshCw,
} from "lucide-react";

const FORM_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04",
  "#9333ea", "#ea580c", "#0891b2", "#be185d",
];

const EDITABLE = [
  { key: "name", label: "Nom complet" },
  { key: "phone", label: "Téléphone" },
  { key: "genre", label: "Genre" },
  { key: "commune", label: "Commune" },
  { key: "village", label: "Village" },
  { key: "cooperative", label: "Coopérative" },
] as const;

export default function ProducteurPage() {
  const params = useParams();
  const id = Number(params.id);
  const [producer, setProducer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [codeMessage, setCodeMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProducer(await fetchProducer(id));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const startEditing = () => {
    setDraft(
      Object.fromEntries(EDITABLE.map((f) => [f.key, producer[f.key] || ""]))
    );
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProducer(id, draft);
      await load();
      setEditing(false);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  // Le code porte-t-il encore des « XX », et peut-on le compléter maintenant ?
  const handleRecalculate = async () => {
    setRecalculating(true);
    setCodeMessage(null);
    try {
      const res = await recalculateCodes(id);
      setCodeMessage(
        `${res.old_code} → ${res.new_code}` +
          (res.parcels_updated ? ` · ${res.parcels_updated} parcelle(s) renommée(s)` : "")
      );
      await load();
    } catch (e) {
      setCodeMessage(e instanceof Error ? e.message : "Recalcul impossible");
    }
    setRecalculating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!producer) {
    return (
      <div className="text-center py-20 text-muted-foreground">Producteur introuvable</div>
    );
  }

  // Un code « XX » venu de la plateforme peut être complété plus tard
  const incomplete =
    producer.source === "plateforme" && isIncompleteCode(producer.code);
  const recalc = canRecalculate(producer.code, producer.commune, producer.cooperative);

  const submissions: any[] = producer.submissions || [];
  const formUids = [...new Set(submissions.map((s) => s.form_uid))];
  const forms = formUids.map((uid) => ({
    uid,
    name: submissions.find((s) => s.form_uid === uid)?.form_name || uid,
    count: submissions.filter((s) => s.form_uid === uid).length,
  }));

  // Parcelles de toutes les fiches, colorées par formulaire d'origine
  const parcelles = submissions
    .map((sub) => {
      const data = sub.data || {};
      const parcelleKey = Object.keys(data).find((k) =>
        /parcelle|plan.*parcellaire/i.test(k)
      );
      let points = parcelleKey ? parseParcellePoints(String(data[parcelleKey])) : [];

      if (points.length === 0) {
        const geo = data._geolocation;
        if (Array.isArray(geo) && geo.length >= 2 && geo[0] != null && geo[1] != null) {
          const lat = Number(geo[0]);
          const lng = Number(geo[1]);
          if (!isNaN(lat) && !isNaN(lng)) points = [{ lat, lng }];
        } else if (typeof geo === "string") {
          const parts = geo.trim().split(/\s+/).map(Number);
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            points = [{ lat: parts[0], lng: parts[1] }];
          }
        }
      }

      return {
        id: String(sub.id),
        name: `${sub.form_name} — #${sub.kobo_id}`,
        points,
        submissionId: String(sub.kobo_id),
        href: `/forms/${sub.form_uid}/submissions/${sub.id}`,
        commune: producer.commune,
        submitDate: sub.submitted_at
          ? new Date(sub.submitted_at).toLocaleDateString("fr-FR")
          : undefined,
        color: FORM_COLORS[formUids.indexOf(sub.form_uid) % FORM_COLORS.length],
      };
    })
    .filter((p) => p.points.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/producteurs">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Producteurs
          </Button>
        </Link>
      </div>

      {/* Identité */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pl-5 flex-row items-start justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-blue-500" />
            {producer.name || producer.code}
          </CardTitle>
          {editing ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                <Save className="h-4 w-4" />
                {saving ? "..." : "Enregistrer"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Modifier
            </Button>
          )}
        </CardHeader>
        <CardContent className="pl-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="font-mono gap-1">
              <Hash className="h-3 w-3" />
              {producer.code}
            </Badge>
            <Badge
              variant="outline"
              className={
                producer.source === "kobo"
                  ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                  : "border-slate-300 text-slate-600 bg-slate-50"
              }
            >
              {PRODUCER_SOURCE_LABELS[producer.source]}
            </Badge>
            {(producer.previous_codes || []).length > 0 && (
              <Badge
                variant="outline"
                className="text-xs text-muted-foreground"
                title={`Anciens codes : ${(producer.previous_codes || []).join(", ")}`}
              >
                anciennement {(producer.previous_codes || []).join(", ")}
              </Badge>
            )}
          </div>

          {/* Code incomplet : recalcul propose des que la donnee manquante arrive */}
          {incomplete && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-sm text-amber-900">
                Ce code est incomplet : la{" "}
                {!producer.commune && !producer.cooperative
                  ? "commune et la coopérative sont"
                  : !producer.commune
                    ? "commune est"
                    : "coopérative est"}{" "}
                inconnue au moment de sa création.
                {recalc.possible
                  ? ` L'information est maintenant disponible — le code peut devenir ${recalc.newPrefix}xxx.`
                  : " Renseignez-la ci-dessus pour pouvoir recalculer le code."}
              </p>
              {codeMessage && (
                <p className="text-sm font-medium text-amber-900">{codeMessage}</p>
              )}
              {recalc.possible && (
                <Button
                  size="sm"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="gap-1.5"
                >
                  {recalculating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Recalculer le code
                </Button>
              )}
            </div>
          )}

          {editing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {EDITABLE.map((f) => (
                <label key={f.key} className="text-sm space-y-1">
                  <span className="text-muted-foreground text-xs">{f.label}</span>
                  <input
                    value={draft[f.key] || ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {producer.genre && <Badge variant="outline">{producer.genre}</Badge>}
              {producer.commune && (
                <Badge variant="secondary">
                  <MapPin className="h-3 w-3 mr-1" />
                  {producer.commune}
                  {producer.village ? `, ${producer.village}` : ""}
                </Badge>
              )}
              {producer.cooperative && (
                <Badge variant="secondary">{producer.cooperative}</Badge>
              )}
              {producer.phone && (
                <Badge variant="outline" className="font-mono">
                  <Phone className="h-3 w-3 mr-1" />
                  {producer.phone}
                </Badge>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Formulaires</div>
              <div className="text-xl font-semibold">{forms.length}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Fiches</div>
              <div className="text-xl font-semibold">{submissions.length}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Parcelles</div>
              <div className="text-xl font-semibold">{parcelles.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carte consolidée */}
      {parcelles.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-green-600" />
              Parcelles, tous formulaires confondus
              <Badge variant="secondary" className="ml-auto">{parcelles.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[400px] w-full">
              <ParcelMap parcelles={parcelles} height="100%" focusId={focusId} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fiches par formulaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Fiches rattachées
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune fiche rattachée pour l&apos;instant. Ouvrez une soumission et
              utilisez « Rattacher à un producteur ».
            </p>
          ) : (
            forms.map((form, i) => (
              <div key={form.uid}>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: FORM_COLORS[i % FORM_COLORS.length] }}
                  />
                  <Link
                    href={`/forms/${form.uid}`}
                    className="text-sm font-medium hover:text-primary transition-colors"
                  >
                    {form.name}
                  </Link>
                  <Badge variant="secondary" className="text-xs">{form.count}</Badge>
                </div>
                <div className="space-y-1.5 pl-5">
                  {submissions
                    .filter((s) => s.form_uid === form.uid)
                    .map((sub) => (
                      <div
                        key={sub.id}
                        onMouseEnter={() => setFocusId(String(sub.id))}
                        className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/40 transition-colors flex-wrap"
                      >
                        <Badge variant="outline" className="font-mono text-xs shrink-0">
                          #{sub.kobo_id}
                        </Badge>
                        <ValidationBadge
                          status={sub.validated}
                          className="text-[10px] py-0 px-1.5"
                        />
                        {sub.missing_on_kobo && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 border-amber-300 text-amber-700 bg-amber-50 gap-1"
                          >
                            <Archive className="h-3 w-3" />
                            Archivée
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {sub.submitted_at
                            ? new Date(sub.submitted_at).toLocaleDateString("fr-FR")
                            : "—"}
                        </span>
                        {sub.producer_source && (
                          <span
                            className="text-[10px] text-muted-foreground"
                            title={LINK_SOURCE_LABELS[sub.producer_source]}
                          >
                            {sub.producer_source === "kobo" ? "auto" : "manuel"}
                          </span>
                        )}
                        <Link
                          href={`/forms/${sub.form_uid}/submissions/${sub.id}`}
                          className="ml-auto text-xs text-primary hover:underline shrink-0"
                        >
                          Ouvrir la fiche →
                        </Link>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
