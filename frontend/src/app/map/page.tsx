"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchForms, fetchSubmissions } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParcelMap } from "@/components/parcel-map-client";
import { parseParcellePoints } from "@/lib/geo";
import {
  MapPin,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  Crosshair,
  X,
} from "lucide-react";

interface Parcelle {
  id: string;
  name: string;
  points: { lat: number; lng: number }[];
  formName: string;
  formUid: string;
  submissionId: string;
  href: string;
  commune?: string;
  submitDate?: string;
  color?: string;
}

interface FormSummary {
  uid: string;
  name: string;
  count: number;
  producteurs: Set<string>;
  communes: Set<string>;
}

const FORM_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04",
  "#9333ea", "#ea580c", "#0891b2", "#be185d",
];

export default function MapPage() {
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [formsSummary, setFormsSummary] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<string>("all");
  const [selectedCommune, setSelectedCommune] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showPanel, setShowPanel] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const formsData = await fetchForms();
        const forms = formsData.results || [];
        const allParcelles: Parcelle[] = [];
        const summaryMap = new Map<string, FormSummary>();

        for (const form of forms) {
          if (form.submission_count === 0) continue;

          const sum: FormSummary = {
            uid: form.uid,
            name: form.name,
            count: 0,
            producteurs: new Set(),
            communes: new Set(),
          };

          try {
            const subsData = await fetchSubmissions(form.uid, 0, 500);
            const subs = subsData.results || [];
            sum.count = subs.length;

            for (const sub of subs) {
              const data = sub.data || {};
              // Nom du producteur
              const nameField = Object.keys(data).find(
                (k) => /nom.*producteur|pr.*nom/i.test(k) && !/technicien/i.test(k)
              );
              if (nameField && data[nameField]) sum.producteurs.add(String(data[nameField]));

              // Commune
              const communeField = Object.keys(data).find((k) => /commune/i.test(k));
              const commune =
                communeField && data[communeField] ? String(data[communeField]) : undefined;
              if (commune) sum.communes.add(commune);

              // Parcelles
              const parcelleField = Object.keys(data).find((k) =>
                /parcelle|plan.*parcellaire/i.test(k)
              );
              let points = parcelleField ? parseParcellePoints(String(data[parcelleField])) : [];

              // GPS fallback — gère chaîne Kobo ("lat lng alt acc") et tableau
              if (points.length === 0) {
                let lat: number | null = null;
                let lng: number | null = null;
                const gps = data._geolocation; // any — valeur réelle de l'API

                if (Array.isArray(gps) && gps.length >= 2 && gps[0] != null && gps[1] != null) {
                  lat = Number(gps[0]);
                  lng = Number(gps[1]);
                } else if (typeof gps === "string") {
                  const parts = gps.trim().split(/\s+/).map(Number);
                  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    lat = parts[0];
                    lng = parts[1];
                  }
                }

                if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
                  points = [{ lat, lng }];
                }
              }

              if (points.length > 0) {
                allParcelles.push({
                  // Identifiant unique par formulaire : deux formulaires peuvent
                  // réutiliser le même kobo_id, ce qui masquait des parcelles.
                  id: `${form.uid}-${sub.id}`,
                  name: nameField ? String(data[nameField]) : `#${sub.kobo_id}`,
                  points,
                  formName: form.name,
                  formUid: form.uid,
                  submissionId: String(sub.kobo_id),
                  href: `/forms/${form.uid}/submissions/${sub.id}`,
                  commune,
                  submitDate: sub.submitted_at
                    ? new Date(sub.submitted_at).toLocaleDateString("fr-FR")
                    : undefined,
                });
              }
            }
          } catch {
            // skip
          }

          if (sum.count > 0) summaryMap.set(form.uid, sum);
        }

        setParcelles(allParcelles);
        // Ne garder que les formulaires qui ont des parcelles sur la carte
        const withParcelles = Array.from(summaryMap.values()).filter(
          (sum) => allParcelles.some((p) => p.formUid === sum.uid)
        );
        setFormsSummary(withParcelles);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  const formUids = useMemo(
    () => [...new Set(parcelles.map((p) => p.formUid))],
    [parcelles]
  );
  const formNameMap = useMemo(
    () => Object.fromEntries(parcelles.map((p) => [p.formUid, p.formName])),
    [parcelles]
  );
  const communes = useMemo(
    () =>
      [...new Set(parcelles.map((p) => p.commune).filter(Boolean))].sort() as string[],
    [parcelles]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parcelles.filter((p) => {
      if (selectedForm !== "all" && p.formUid !== selectedForm) return false;
      if (selectedCommune !== "all" && p.commune !== selectedCommune) return false;
      if (q && !`${p.name} ${p.commune || ""} ${p.submissionId}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [parcelles, selectedForm, selectedCommune, search]);

  const coloredParcelles = useMemo(
    () =>
      filtered.map((p) => ({
        ...p,
        color: FORM_COLORS[formUids.indexOf(p.formUid) % FORM_COLORS.length],
      })),
    [filtered, formUids]
  );

  const resetFilters = () => {
    setSelectedForm("all");
    setSelectedCommune("all");
    setSearch("");
    setFocusId(null);
  };

  const hasFilters = selectedForm !== "all" || selectedCommune !== "all" || search !== "";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Chargement des parcelles…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100dvh-6rem)]">
      {/* Panneau latéral d'infos */}
      <div className={`lg:w-80 shrink-0 flex flex-col min-h-0 ${showPanel ? "" : "lg:flex"}`}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold tracking-tight">🌍 Carte</h1>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="lg:hidden p-1 hover:bg-muted rounded"
            aria-label={showPanel ? "Masquer le panneau" : "Afficher le panneau"}
          >
            {showPanel ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        <div
          className={`space-y-3 overflow-y-auto pr-1 min-h-0 flex-1 ${
            showPanel ? "block" : "hidden lg:block"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span> parcelle(s)
              {filtered.length !== parcelles.length && ` sur ${parcelles.length}`}
            </p>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Réinitialiser
              </button>
            )}
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un producteur…"
              className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Filtres */}
          {formUids.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={selectedForm}
                onChange={(e) => setSelectedForm(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">Tous les formulaires</option>
                {formUids.map((uid) => (
                  <option key={uid} value={uid}>
                    {formNameMap[uid] || uid}
                  </option>
                ))}
              </select>
            </div>
          )}

          {communes.length > 1 && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={selectedCommune}
                onChange={(e) => setSelectedCommune(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">Toutes les communes</option>
                {communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Légende */}
          {formUids.length > 1 && selectedForm === "all" && (
            <div className="flex flex-wrap gap-2">
              {formUids.map((uid, i) => (
                <div key={uid} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: FORM_COLORS[i % FORM_COLORS.length] }}
                  />
                  <span className="text-muted-foreground truncate max-w-[120px]">
                    {formNameMap[uid] || uid}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Résumé par formulaire */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              Formulaires
            </h3>
            {formsSummary.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucun formulaire avec données géographiques
              </p>
            ) : (
              formsSummary.map((sum, i) => {
                const matchingCount = parcelles.filter((p) => p.formUid === sum.uid).length;
                const isActive = selectedForm === sum.uid;

                return (
                  <button
                    key={sum.uid}
                    onClick={() =>
                      setSelectedForm((cur) => (cur === sum.uid ? "all" : sum.uid))
                    }
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isActive ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            FORM_COLORS[formUids.indexOf(sum.uid) % FORM_COLORS.length] ||
                            FORM_COLORS[i % FORM_COLORS.length],
                        }}
                      />
                      <span className="text-sm font-medium truncate flex-1">{sum.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {matchingCount}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>👤 {sum.producteurs.size}</span>
                      <span>📍 {sum.communes.size}</span>
                      <span>📋 {sum.count} soumission(s)</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Liste des parcelles — clic = recentrage sur la carte */}
          {filtered.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Crosshair className="h-4 w-4 text-primary" />
                Parcelles
              </h3>
              {filtered.slice(0, 200).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setFocusId(p.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-md border text-xs transition-colors ${
                    focusId === p.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          FORM_COLORS[formUids.indexOf(p.formUid) % FORM_COLORS.length],
                      }}
                    />
                    <span className="font-medium truncate flex-1">{p.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {p.points.length > 2 ? `${p.points.length} pts` : "GPS"}
                    </span>
                  </div>
                  {(p.commune || p.submitDate) && (
                    <div className="text-muted-foreground mt-0.5 truncate pl-4">
                      {[p.commune, p.submitDate].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </button>
              ))}
              {filtered.length > 200 && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  200 premières affichées — affinez la recherche
                </p>
              )}
            </div>
          )}

          {filtered.length === 0 && (
            <Card className="py-8 text-center">
              <CardContent className="p-6">
                <MapPin className="h-6 w-6 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mt-2">
                  Aucune parcelle ne correspond aux filtres
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Carte */}
      <div className="flex-1 min-h-[400px]">
        <Card className="h-full overflow-hidden">
          <CardContent className="p-0 h-full">
            {filtered.length > 0 ? (
              <ParcelMap
                parcelles={coloredParcelles}
                height="100%"
                zoom={12}
                focusId={focusId}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Aucune donnée géographique
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
