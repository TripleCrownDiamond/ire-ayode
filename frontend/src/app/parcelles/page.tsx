"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParcelMap } from "@/components/parcel-map-client";
import { fetchParcels, syncParcels } from "@/lib/api";
import {
  MapPin,
  Search,
  Loader2,
  RefreshCw,
  Info,
  Map as MapIcon,
  List,
} from "lucide-react";

interface ParcelRow {
  id: number;
  code: string;
  order_no: number;
  producer_id: number;
  form_uid: string | null;
  submission_id: number | null;
  points: { lat: number; lng: number }[];
  point_count: number;
  area_ha: number | null;
  superficie_declaree: number | null;
  culture: string;
  commune: string;
  village: string;
  producer?: {
    id: number;
    code: string;
    name: string;
    commune?: string;
    cooperative?: string;
  } | null;
}

export default function ParcellesPage() {
  const [parcels, setParcels] = useState<ParcelRow[]>([]);
  const [totalArea, setTotalArea] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"liste" | "carte">("liste");
  const [focusId, setFocusId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchParcels();
      setParcels(data.results || []);
      setTotalArea(data.total_area_ha || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await syncParcels();
      setMessage(
        `${res.created} parcelle(s) créée(s), ${res.updated} mise(s) à jour.` +
          (res.skipped ? ` ${res.skipped} ignorée(s).` : "")
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Synchronisation impossible");
    }
    setSyncing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parcels;
    return parcels.filter((p) =>
      `${p.code} ${p.culture} ${p.commune} ${p.village} ${p.producer?.name ?? ""} ${
        p.producer?.code ?? ""
      }`
        .toLowerCase()
        .includes(q)
    );
  }, [parcels, search]);

  const mapParcelles = useMemo(
    () =>
      filtered
        .filter((p) => p.points?.length > 0)
        .map((p) => ({
          id: String(p.id),
          name: `${p.code}${p.producer?.name ? ` — ${p.producer.name}` : ""}`,
          points: p.points,
          submissionId: p.code,
          commune: p.commune,
          area: p.area_ha ? `${Number(p.area_ha).toFixed(2)} ha` : undefined,
          href:
            p.form_uid && p.submission_id
              ? `/forms/${p.form_uid}/submissions/${p.submission_id}`
              : undefined,
        })),
    [filtered]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parcelles</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {parcels.length} parcelle(s) · {totalArea.toFixed(2)} ha au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setView("liste")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                view === "liste" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <List className="h-4 w-4" /> Liste
            </button>
            <button
              onClick={() => setView("carte")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                view === "carte" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <MapIcon className="h-4 w-4" /> Carte
            </button>
          </div>
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Analyse..." : "Actualiser le registre"}
          </Button>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="p-4 flex items-start gap-3 text-sm text-blue-900">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <p>
            Le code d&apos;une parcelle dérive de celui de son producteur, suivi
            de son numéro d&apos;ordre :{" "}
            <code className="px-1 py-0.5 rounded bg-blue-100 text-xs">TCCO001-1</code>,{" "}
            <code className="px-1 py-0.5 rounded bg-blue-100 text-xs">TCCO001-2</code>…
            Seules les soumissions rattachées à un producteur alimentent ce registre.
          </p>
        </CardContent>
      </Card>

      {message && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-3 text-sm text-emerald-900">{message}</CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par code, producteur, culture, commune…"
          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="p-6 text-muted-foreground">
            {parcels.length === 0
              ? "Aucune parcelle enregistrée. Rattachez les fiches à des producteurs, puis lancez « Actualiser le registre »."
              : "Aucune parcelle ne correspond à la recherche"}
          </CardContent>
        </Card>
      ) : view === "carte" ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="h-[600px] w-full">
              <ParcelMap parcelles={mapParcelles} height="100%" focusId={focusId} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code parcelle</TableHead>
                  <TableHead>Producteur</TableHead>
                  <TableHead>Culture</TableHead>
                  <TableHead>Localisation</TableHead>
                  <TableHead className="text-right">Superficie</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, i) => (
                  <TableRow
                    key={p.id}
                    onMouseEnter={() => setFocusId(String(p.id))}
                    className={i % 2 === 1 ? "bg-muted/20" : ""}
                  >
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {p.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.producer ? (
                        <Link
                          href={`/producteurs/${p.producer.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          <span className="font-medium text-sm">
                            {p.producer.name || p.producer.code}
                          </span>
                          <span className="block text-xs text-muted-foreground font-mono">
                            {p.producer.code}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{p.culture || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[p.commune, p.village].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {p.area_ha ? (
                        <>
                          <span className="font-medium">
                            {Number(p.area_ha).toFixed(2)} ha
                          </span>
                          {p.superficie_declaree && (
                            <span
                              className="block text-xs text-muted-foreground"
                              title="Superficie déclarée dans le formulaire"
                            >
                              déclarée : {Number(p.superficie_declaree).toFixed(2)} ha
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {p.point_count}
                    </TableCell>
                    <TableCell>
                      {p.form_uid && p.submission_id && (
                        <Link
                          href={`/forms/${p.form_uid}/submissions/${p.submission_id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Fiche →
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
