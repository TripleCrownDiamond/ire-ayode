"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchProducers,
  linkSubmissionToProducer,
  autoLinkProducers,
} from "@/lib/api";
import { extractProfile, type DBProducer } from "@/lib/producers";
import {
  ArrowLeft,
  Loader2,
  Search,
  Plus,
  Check,
  Users,
  Calendar,
  Link2,
  Info,
} from "lucide-react";

interface UnlinkedRow {
  id: number;
  kobo_id: string;
  form_uid: string;
  form_name: string;
  submitted_at: string | null;
  data: Record<string, any>;
}

export default function ARattacherPage() {
  const [rows, setRows] = useState<UnlinkedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [producers, setProducers] = useState<DBProducer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [autoLinking, setAutoLinking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [unlinked, prods] = await Promise.all([
        fetch("/api/submissions/unlinked?limit=200").then((r) => r.json()),
        fetchProducers(),
      ]);
      setRows(unlinked.results || []);
      setTotal(unlinked.count || 0);
      setProducers(prods.results || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAutoLink = async () => {
    setAutoLinking(true);
    setMessage(null);
    try {
      const res = await autoLinkProducers();
      setMessage(
        `${res.linked} fiche(s) rattachée(s) automatiquement via le code du formulaire. ` +
          `${res.without_code} restent à rattacher à la main.`
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Rattachement impossible");
    }
    setAutoLinking(false);
  };

  const link = async (submissionId: number, payload: Record<string, unknown>) => {
    setBusyId(submissionId);
    try {
      await linkSubmissionToProducer(submissionId, payload);
      setRows((rs) => rs.filter((r) => r.id !== submissionId));
      setTotal((t) => Math.max(t - 1, 0));
      setOpenId(null);
      // Rafraîchit la liste des producteurs (compteurs, nouvelle fiche créée)
      fetchProducers().then((p) => setProducers(p.results || [])).catch(() => {});
    } catch (e) {
      console.error(e);
    }
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const candidates = q
    ? producers.filter((p) =>
        `${p.code} ${p.name} ${p.phone} ${p.commune}`.toLowerCase().includes(q)
      )
    : producers;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/producteurs">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Producteurs
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Fiches à rattacher</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {total} fiche(s) sans producteur
          </p>
        </div>
        <Button onClick={handleAutoLink} disabled={autoLinking} variant="outline" className="gap-2">
          {autoLinking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Rattacher via les codes
        </Button>
      </div>

      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="p-4 flex items-start gap-3 text-sm text-blue-900">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <p>
            Ces formulaires ne contiennent pas de code producteur. Choisissez une
            fiche existante, ou créez-en une : la plateforme calculera le code
            à partir de la commune et de la coopérative (TCNO001…). Le lien est
            enregistré une fois pour toutes — il ne sera pas recalculé à partir
            des noms.
          </p>
        </CardContent>
      </Card>

      {message && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-3 text-sm text-emerald-900">{message}</CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="p-6 text-muted-foreground">
            Toutes les fiches sont rattachées à un producteur.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const profile = extractProfile(row.data);
            const isOpen = openId === row.id;

            return (
              <Card key={row.id} className={isOpen ? "border-primary/40" : ""}>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs shrink-0">
                      #{row.kobo_id}
                    </Badge>
                    <span className="font-medium text-sm truncate">
                      {profile.name || "— sans nom —"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {[profile.commune, profile.village, profile.phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {row.submitted_at
                        ? new Date(row.submitted_at).toLocaleDateString("fr-FR")
                        : "—"}
                    </span>
                    <Link
                      href={`/forms/${row.form_uid}/submissions/${row.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      {row.form_name}
                    </Link>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setOpenId(isOpen ? null : row.id)}
                      >
                        <Search className="h-3.5 w-3.5" />
                        Choisir
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={busyId === row.id || !profile.name}
                        title={
                          profile.name
                            ? "Créer une fiche producteur à partir de cette soumission"
                            : "Aucun nom dans cette soumission — utilisez « Choisir »"
                        }
                        onClick={() => link(row.id, { create: true })}
                      >
                        {busyId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Créer
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t pt-3 space-y-2">
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Rechercher un producteur…"
                          autoFocus
                          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {candidates.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-3">
                            Aucun producteur au référentiel — utilisez « Créer »
                          </p>
                        ) : (
                          candidates.slice(0, 50).map((p) => (
                            <button
                              key={p.id}
                              disabled={busyId === row.id}
                              onClick={() => link(row.id, { producer_id: p.id })}
                              className="w-full text-left px-3 py-2 rounded-md border hover:bg-muted/60 hover:border-primary/40 transition-colors disabled:opacity-50"
                            >
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="font-medium text-sm truncate flex-1">
                                  {p.name || p.code}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[10px] shrink-0"
                                >
                                  {p.code}
                                </Badge>
                                <Check className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                              </div>
                              <div className="text-xs text-muted-foreground truncate pl-5">
                                {[p.commune, p.phone, `${p.submission_count} fiche(s)`]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
