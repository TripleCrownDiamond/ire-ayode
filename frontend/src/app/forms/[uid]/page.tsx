"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchForm, fetchSubmissions, syncForm } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ParcelMap } from "@/components/parcel-map-client";
import { parseParcellePoints } from "@/lib/geo";
import { SubmissionCard } from "@/components/submission-card";
import { FormMissingBanner } from "@/components/form-missing-banner";
import { useRouter } from "next/navigation";
import { exportAllSubmissions, exportToGeoJSON, exportToHTML } from "@/lib/export";
import { ExportAllButton } from "@/components/export-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  RefreshCw,
  MapPin,
  Users,
  Download,
  FileCode,
  Map,
  FileText,
  Loader2,
  Search,
  Crosshair,
} from "lucide-react";

export default function FormPage() {
  const params = useParams();
  const router = useRouter();
  const uid = params.uid as string;
  const [form, setForm] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [focusId, setFocusId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([fetchForm(uid), fetchSubmissions(uid)]);
      setForm(f);
      setSubmissions(s.results || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (uid) load();
  }, [uid]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncForm(uid);
      await load();
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };

  // Extract parcelle data for map — enrichi avec infos soumission
  const parcelles = submissions
    .map((sub) => {
      const data = sub.data || {};
      const parcelleField = Object.keys(data).find((k) =>
        /parcelle|plan.*parcellaire/i.test(k)
      );
      const nameField = Object.keys(data).find(
        (k) => /nom.*producteur|pr.*nom/i.test(k) && !/technicien/i.test(k)
      );
      const communeField = Object.keys(data).find((k) => /commune/i.test(k));

      const points = parcelleField ? parseParcellePoints(String(data[parcelleField])) : [];
      const name = nameField ? String(data[nameField]) : `Soumission #${sub.kobo_id}`;
      const submitDate = sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString("fr-FR") : "";

      // Si pas de polygone mais des coordonnées GPS valides, créer un point
      if (points.length === 0) {
        const geo = data._geolocation;
        // Format array [lat, lng, alt, acc]
        if (Array.isArray(geo) && geo.length >= 2 && geo[0] != null && geo[1] != null) {
          const lat = Number(geo[0]);
          const lng = Number(geo[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            points.push({ lat, lng });
          }
        }
        // Format string "lat lng alt acc"
        if (points.length === 0 && typeof geo === "string") {
          const parts = geo.trim().split(/\s+/).map(Number);
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            points.push({ lat: parts[0], lng: parts[1] });
          }
        }
      }

      return {
        id: String(sub.id),
        name: String(name),
        points,
        submissionId: String(sub.kobo_id),
        // Lien cliquable depuis la bulle de la carte vers la fiche
        href: `/forms/${uid}/submissions/${sub.id}`,
        submitDate,
        commune: communeField ? String(data[communeField]) : "",
      };
    })
    .filter((p) => p.points.length > 0);

  // Recherche plein texte sur les valeurs de la soumission + filtre de statut
  const filteredSubmissions = submissions.filter((sub) => {
    const status = sub.validated || "pending";
    if (statusFilter !== "all" && status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const haystack = Object.entries(sub.data || {})
      .filter(([k]) => !k.startsWith("_"))
      .map(([, v]) => String(v))
      .join(" ")
      .toLowerCase();
    return haystack.includes(q) || String(sub.kobo_id).includes(q);
  });

  const statusCounts = submissions.reduce<Record<string, number>>((acc, sub) => {
    const s = sub.validated || "pending";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!form)
    return <div className="text-center py-20 text-muted-foreground">Formulaire introuvable</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/forms">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
        </Link>
      </div>

      {/* Formulaire disparu de Kobo : on propose la suppression, sans jamais l'imposer */}
      {form.missing_on_kobo && (
        <FormMissingBanner
          uid={uid}
          name={form.name}
          submissionCount={submissions.length}
          lastSeenAt={form.kobo_last_seen_at}
          onDeleted={() => router.push("/forms")}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{form.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {submissions.length} soumission(s)
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Export multi-format */}
          <DropdownMenu>
            <DropdownMenuTrigger className="group/inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-2 sm:px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exporter</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                exportAllSubmissions(submissions, form.name);
              }}>
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const count = exportToGeoJSON(submissions, form.name);
                if (count === 0) alert("Aucune donnée géolocalisée à exporter.");
              }}>
                <Map className="h-4 w-4 mr-2" />
                GeoJSON (carte)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                exportToHTML(submissions, form.name);
              }}>
                <FileCode className="h-4 w-4 mr-2" />
                Rapport HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sync..." : "Sync"}
          </Button>
        </div>
      </div>

      {/* Map */}
      {parcelles.length > 0 && (
        <Card id="carte-parcelles" className="overflow-hidden scroll-mt-20">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-green-600 shrink-0" />
              <span className="truncate">Parcelles géoréférencées</span>
              <Badge variant="secondary" className="ml-auto shrink-0">{parcelles.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[400px] md:h-[500px] w-full">
              <ParcelMap parcelles={parcelles} height="100%" focusId={focusId} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Soumissions
            <Badge variant="secondary" className="ml-2">
              {filteredSubmissions.length}
              {filteredSubmissions.length !== submissions.length && ` / ${submissions.length}`}
            </Badge>
          </CardTitle>

          {/* Recherche + filtre de statut */}
          {submissions.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 pt-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (nom, commune, coopérative, n°…)"
                  className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-56"
              >
                <option value="all">Tous les statuts ({submissions.length})</option>
                <option value="pending">À valider ({statusCounts.pending || 0})</option>
                <option value="valid">Validées ({statusCounts.valid || 0})</option>
                <option value="needs_revision">
                  À corriger ({statusCounts.needs_revision || 0})
                </option>
                <option value="rejected">Rejetées ({statusCounts.rejected || 0})</option>
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune soumission
            </p>
          ) : filteredSubmissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune soumission ne correspond à la recherche
            </p>
          ) : (
            <div className="space-y-4">
              {filteredSubmissions.map((sub) => {
                const mapped = parcelles.some((p) => p.id === String(sub.id));
                return (
                  <div key={sub.id} className="relative">
                    <SubmissionCard submission={sub} formUid={uid} />
                    {mapped && (
                      <button
                        onClick={() => {
                          setFocusId(String(sub.id));
                          document
                            .getElementById("carte-parcelles")
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        title="Localiser sur la carte"
                        aria-label="Localiser sur la carte"
                        className="absolute top-2 right-2 p-1.5 rounded-md border bg-white/90 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
