"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchProducers, linkSubmissionToProducer } from "@/lib/api";
import { extractProfile, type DBProducer } from "@/lib/producers";
import {
  User,
  Hash,
  Search,
  Plus,
  Loader2,
  Link2,
  Unlink,
  Check,
  MapPin,
} from "lucide-react";

interface ProducerLinkProps {
  submissionId: number;
  /** Producteur déjà rattaché, s'il y en a un */
  producer?: {
    id: number;
    code: string;
    name: string;
    commune?: string;
  } | null;
  /** Source du rattachement : « kobo » (code du formulaire) ou « manuel » */
  linkSource?: string | null;
  /** Données de la soumission — pré-remplissent une nouvelle fiche producteur */
  data: Record<string, any>;
  onChanged?: () => void;
}

/**
 * Rattachement d'une soumission à un producteur du référentiel.
 *
 * Le lien est enregistré en base : il ne repose sur aucune ressemblance de
 * noms. Si le formulaire Kobo porte déjà un code producteur, le rattachement
 * a lieu automatiquement à la synchronisation et ce panneau ne sert qu'à le
 * consulter ou le corriger.
 */
export function ProducerLink({
  submissionId,
  producer,
  linkSource,
  data,
  onChanged,
}: ProducerLinkProps) {
  const [picking, setPicking] = useState(false);
  const [producers, setProducers] = useState<DBProducer[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const profile = extractProfile(data);
  const [draftCode, setDraftCode] = useState("");
  const [draftName, setDraftName] = useState(profile.name);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetchProducers();
      setProducers(res.results || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    if (picking && producers.length === 0) loadList();
  }, [picking, producers.length, loadList]);

  const link = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await linkSubmissionToProducer(submissionId, payload);
      setPicking(false);
      setCreating(false);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rattachement impossible");
    }
    setBusy(false);
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? producers.filter((p) =>
        `${p.code} ${p.name} ${p.phone} ${p.commune}`.toLowerCase().includes(q)
      )
    : producers;

  // --- Déjà rattaché ---
  if (producer && !picking) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pl-5 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-blue-500" />
            Producteur
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-5 space-y-2">
          <Link href={`/producteurs/${producer.id}`} className="block group">
            <div className="font-semibold group-hover:text-primary transition-colors">
              {producer.name || producer.code}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge variant="outline" className="font-mono text-xs gap-1">
                <Hash className="h-3 w-3" />
                {producer.code}
              </Badge>
              {producer.commune && (
                <Badge variant="secondary" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  {producer.commune}
                </Badge>
              )}
            </div>
          </Link>

          <p className="text-xs text-muted-foreground">
            {linkSource === "kobo"
              ? "Rattaché automatiquement via le code du formulaire."
              : "Rattaché manuellement."}
          </p>

          <div className="flex gap-2 pt-1">
            <Link href={`/producteurs/${producer.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <User className="h-4 w-4" />
                Toutes ses fiches
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPicking(true)}
              title="Changer de producteur"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Non rattaché, ou changement en cours ---
  return (
    <Card className={producer ? "" : "border-amber-300 bg-amber-50/50"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" />
          {producer ? "Changer de producteur" : "Rattacher à un producteur"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!picking && !creating && (
          <>
            <p className="text-sm text-muted-foreground">
              Cette fiche n&apos;est rattachée à aucun producteur. Le formulaire
              ne contient pas de code producteur : choisissez une fiche existante
              ou créez-en une.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => setPicking(true)}
              >
                <Search className="h-4 w-4" />
                Choisir
              </Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                Créer
              </Button>
            </div>
          </>
        )}

        {/* Sélection d'un producteur existant */}
        {picking && (
          <>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Code, nom, téléphone…"
                autoFocus
                className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {loadingList ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    Aucun producteur trouvé
                  </p>
                ) : (
                  filtered.slice(0, 50).map((p) => (
                    <button
                      key={p.id}
                      disabled={busy}
                      onClick={() => link({ producer_id: p.id })}
                      className="w-full text-left px-3 py-2 rounded-md border hover:bg-muted/60 hover:border-primary/40 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate flex-1">
                          {p.name || p.code}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                          {p.code}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[p.commune, p.phone, `${p.submission_count} fiche(s)`]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
                Annuler
              </Button>
              {producer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 gap-1.5"
                  disabled={busy}
                  onClick={() => link({ producer_id: null })}
                >
                  <Unlink className="h-4 w-4" />
                  Détacher
                </Button>
              )}
            </div>
          </>
        )}

        {/* Création d'une fiche producteur depuis la soumission */}
        {creating && (
          <>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground text-xs">Nom complet</span>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground text-xs">
                Code — laisser vide pour un calcul depuis commune + coopérative
              </span>
              <input
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                placeholder="TCNO001"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Commune, village, téléphone et coopérative sont repris de la
              soumission :{" "}
              {[profile.commune, profile.village, profile.phone, profile.cooperative]
                .filter(Boolean)
                .join(" · ") || "aucune information disponible"}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                disabled={busy || !draftName.trim()}
                onClick={() =>
                  link({
                    create: true,
                    code: draftCode.trim() || undefined,
                    name: draftName.trim(),
                  })
                }
                className="gap-1.5"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Créer et rattacher
              </Button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
