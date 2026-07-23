"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { archiveMedia, fetchArchiveStatus, restoreSubmission } from "@/lib/api";
import {
  Archive,
  Trash2,
  RotateCcw,
  Loader2,
  ShieldAlert,
  HardDrive,
  CheckCircle2,
} from "lucide-react";

interface DeletedRow {
  id: number;
  kobo_id: string;
  form_uid: string;
  submitted_at: string | null;
  deleted_at: string;
  deleted_by: string | null;
  delete_reason: string | null;
  data: Record<string, unknown>;
}

interface ArchiveStatus {
  submissions_total: number;
  submissions_pending: number;
  submissions_archived: number;
  files_archived: number;
  done: boolean;
}

function producerName(data: Record<string, unknown>): string {
  const key = Object.keys(data || {}).find(
    (k) => /nom.*producteur|pr.*nom/i.test(k) && !/technicien/i.test(k)
  );
  return key ? String(data[key]) : "";
}

export default function AdminDataPage() {
  const { loading: authLoading, isAdmin } = useAuth();
  const [status, setStatus] = useState<ArchiveStatus | null>(null);
  const [deleted, setDeleted] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [archiveLog, setArchiveLog] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, del] = await Promise.all([
        fetchArchiveStatus(),
        fetch("/api/submissions/deleted").then((r) => r.json()),
      ]);
      setStatus(st);
      setDeleted(del.results || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) load();
  }, [authLoading, isAdmin, load]);

  /**
   * Lance l'archivage par lots jusqu'à épuisement.
   * Chaque appel est borné en durée côté serveur (limite Vercel de 60 s),
   * on enchaîne donc les lots depuis le navigateur.
   */
  const handleArchive = async () => {
    setArchiving(true);
    setArchiveLog(null);
    let totalFiles = 0;
    let totalSubs = 0;
    try {
      for (let batch = 0; batch < 40; batch++) {
        const res = await archiveMedia(25);
        totalFiles += res.archived || 0;
        totalSubs += res.processed || 0;
        setArchiveLog(
          `${totalSubs} soumission(s) traitée(s), ${totalFiles} fichier(s) archivé(s)` +
            (res.remaining ? ` — ${res.remaining} restante(s)…` : "")
        );
        if (res.done || res.processed === 0) break;
      }
      setArchiveLog(
        `Terminé : ${totalSubs} soumission(s) traitée(s), ${totalFiles} fichier(s) archivé(s).`
      );
      await load();
    } catch (e) {
      setArchiveLog(e instanceof Error ? e.message : "Archivage interrompu");
    }
    setArchiving(false);
  };

  const handleRestore = async (id: number) => {
    setRestoringId(id);
    try {
      await restoreSubmission(id);
      setDeleted((rows) => rows.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
    }
    setRestoringId(null);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
        <ShieldAlert className="h-8 w-8" />
        <p>Réservé aux administrateurs</p>
      </div>
    );
  }

  const pct =
    status && status.submissions_total > 0
      ? Math.round((status.submissions_archived / status.submissions_total) * 100)
      : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Données & archivage</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Les soumissions et leurs médias restent dans la plateforme même s&apos;ils
          disparaissent de KoboToolbox. Seule une suppression explicite les retire.
        </p>
      </div>

      {/* Archivage des médias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4 text-primary" />
            Copie locale des médias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Photos, signatures et scans sont copiés dans le stockage de la plateforme.
            Sans cette copie, ils ne sont lisibles que tant que la soumission existe
            sur KoboToolbox.
          </p>

          {status && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Soumissions</div>
                  <div className="text-xl font-semibold">{status.submissions_total}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Archivées</div>
                  <div className="text-xl font-semibold text-emerald-600">
                    {status.submissions_archived}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">En attente</div>
                  <div className="text-xl font-semibold text-amber-600">
                    {status.submissions_pending}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Fichiers stockés</div>
                  <div className="text-xl font-semibold">{status.files_archived}</div>
                </div>
              </div>

              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleArchive} disabled={archiving} className="gap-2">
              {archiving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status?.done ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {archiving ? "Archivage en cours..." : "Archiver les médias manquants"}
            </Button>
            {archiveLog && <span className="text-sm text-muted-foreground">{archiveLog}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Corbeille */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-4 w-4 text-red-500" />
            Corbeille
            <Badge variant="secondary" className="ml-1">{deleted.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deleted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune soumission supprimée
            </p>
          ) : (
            <div className="space-y-2">
              {deleted.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 p-3 rounded-lg border flex-wrap"
                >
                  <Badge variant="outline" className="font-mono text-xs shrink-0">
                    #{row.kobo_id}
                  </Badge>
                  <span className="font-medium text-sm truncate flex-1 min-w-[120px]">
                    {producerName(row.data) || "—"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                    Supprimée le {new Date(row.deleted_at).toLocaleDateString("fr-FR")}
                    {row.deleted_by ? ` par ${row.deleted_by}` : ""}
                    {row.delete_reason ? ` — ${row.delete_reason}` : ""}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.form_uid && (
                      <Link
                        href={`/forms/${row.form_uid}/submissions/${row.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Voir
                      </Link>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={restoringId === row.id}
                      onClick={() => handleRestore(row.id)}
                    >
                      {restoringId === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Restaurer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
