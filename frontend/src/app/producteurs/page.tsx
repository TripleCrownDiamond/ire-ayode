"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchProducers, createProducer, autoLinkProducers } from "@/lib/api";
import { PRODUCER_SOURCE_LABELS, type DBProducer } from "@/lib/producers";
import { IncompleteCodesBanner } from "@/components/incomplete-codes-banner";
import {
  Users,
  Search,
  Loader2,
  ArrowRight,
  MapPin,
  Layers,
  Info,
  Plus,
  Link2,
  Hash,
  Phone,
  X,
} from "lucide-react";

export default function ProducteursPage() {
  const [producers, setProducers] = useState<DBProducer[]>([]);
  const [unlinked, setUnlinked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  // Création manuelle
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    code: "",
    name: "",
    phone: "",
    commune: "",
    village: "",
    cooperative: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProducers();
      setProducers(data.results || []);
      setUnlinked(data.unlinked_submissions || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAutoLink = async () => {
    setLinking(true);
    setLinkResult(null);
    try {
      const res = await autoLinkProducers();
      setLinkResult(
        `${res.linked} fiche(s) rattachée(s), ${res.producers_created} producteur(s) créé(s). ` +
          `${res.without_code} fiche(s) sans code dans le formulaire — à rattacher manuellement.`
      );
      await load();
    } catch (e) {
      setLinkResult(e instanceof Error ? e.message : "Rattachement impossible");
    }
    setLinking(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      await createProducer(draft);
      setDraft({ code: "", name: "", phone: "", commune: "", village: "", cooperative: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Création impossible");
    }
    setCreating(false);
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? producers.filter((p) =>
        `${p.code} ${p.name} ${p.phone} ${p.commune} ${p.cooperative}`.toLowerCase().includes(q)
      )
    : producers;

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
          <h1 className="text-2xl font-bold tracking-tight">Producteurs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {producers.length} producteur(s) au référentiel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAutoLink} disabled={linking} variant="outline" className="gap-2">
            {linking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Rattacher via les codes
          </Button>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau producteur
          </Button>
        </div>
      </div>

      {/* Fonctionnement du référentiel */}
      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-blue-900">
            <p>
              Chaque producteur possède un identifiant unique.{" "}
              <span className="font-medium">
                Si le formulaire Kobo contient un code producteur
              </span>
              , il est repris tel quel et les fiches sont rattachées automatiquement.
              Sinon, la plateforme calcule le code : 2 lettres de la commune +
              2 lettres de la coopérative + numéro d&apos;ordre (TCNO001,
              TCNO002…), et le rattachement se fait depuis chaque soumission.
            </p>
            <p className="text-blue-800">
              Aucun rapprochement n&apos;est deviné à partir des noms : deux
              homonymes restent deux producteurs distincts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Codes a trous : recalcul propose des que la donnee manquante arrive */}
      <IncompleteCodesBanner onRecalculated={load} />

      {linkResult && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-3 text-sm text-emerald-900">{linkResult}</CardContent>
        </Card>
      )}

      {unlinked > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 text-sm text-amber-900 flex items-center gap-2 flex-wrap">
            <Users className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">{unlinked}</span> fiche(s) ne sont
              rattachées à aucun producteur.
            </span>
            <Link
              href="/producteurs/a-rattacher"
              className="underline font-medium hover:text-amber-950"
            >
              Les rattacher →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Création */}
      {showForm && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Nouveau producteur</CardTitle>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground text-xs">
                  Code — laisser vide pour un calcul depuis commune + coopérative
                </span>
                <input
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  placeholder="TCNO001"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground text-xs">Nom complet</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground text-xs">Téléphone</span>
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground text-xs">Commune</span>
                <input
                  value={draft.commune}
                  onChange={(e) => setDraft({ ...draft, commune: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground text-xs">Village</span>
                <input
                  value={draft.village}
                  onChange={(e) => setDraft({ ...draft, village: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground text-xs">Coopérative</span>
                <input
                  value={draft.cooperative}
                  onChange={(e) => setDraft({ ...draft, cooperative: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={creating || !draft.name.trim()}>
                {creating ? "Création..." : "Créer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recherche */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par code, nom, téléphone, commune…"
          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="p-6 text-muted-foreground">
            {producers.length === 0
              ? "Aucun producteur. Lancez « Rattacher via les codes » ou créez-en un."
              : "Aucun producteur ne correspond à la recherche"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/producteurs/${p.id}`}>
              <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all group">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start gap-2 text-base">
                    <Users className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="flex-1 truncate">{p.name || p.code}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="font-mono text-xs gap-1">
                      <Hash className="h-3 w-3" />
                      {p.code}
                    </Badge>
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Layers className="h-3 w-3" />
                      {p.form_count} formulaire(s)
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {p.submission_count} fiche(s)
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {p.commune && (
                      <div className="truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {p.commune}
                        {p.village ? `, ${p.village}` : ""}
                      </div>
                    )}
                    {p.phone && (
                      <div className="truncate flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {p.phone}
                      </div>
                    )}
                    {p.cooperative && <div className="truncate">🏛 {p.cooperative}</div>}
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      p.source === "kobo"
                        ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                        : "border-slate-300 text-slate-600 bg-slate-50"
                    }`}
                  >
                    {PRODUCER_SOURCE_LABELS[p.source]}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
