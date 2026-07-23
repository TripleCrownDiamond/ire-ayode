"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteForm } from "@/lib/api";
import { AlertTriangle, Archive, Loader2, Trash2 } from "lucide-react";

interface FormMissingBannerProps {
  uid: string;
  name: string;
  submissionCount: number;
  lastSeenAt?: string | null;
  /** Appelé après une suppression réussie */
  onDeleted?: () => void;
}

/**
 * Bandeau affiché lorsqu'un formulaire a disparu de KoboToolbox.
 * La plateforme ne supprime jamais d'elle-même : elle propose la suppression
 * et attend une confirmation explicite.
 */
export function FormMissingBanner({
  uid,
  name,
  submissionCount,
  lastSeenAt,
  onDeleted,
}: FormMissingBannerProps) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteForm(uid, reason.trim() || undefined);
      setConfirming(false);
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible");
    }
    setDeleting(false);
  };

  return (
    <>
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Archive className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-amber-900">
              Ce formulaire n&apos;existe plus sur KoboToolbox
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              Ses {submissionCount} soumission(s) sont conservées ici
              {lastSeenAt
                ? ` — vu pour la dernière fois le ${new Date(lastSeenAt).toLocaleDateString(
                    "fr-FR"
                  )}`
                : ""}
              . Si ce formulaire n&apos;a plus d&apos;utilité, vous pouvez le
              supprimer avec ses données.
            </p>
          </div>
          <Button
            onClick={() => setConfirming(true)}
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 border-amber-400 text-amber-900 hover:bg-amber-100"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        </CardContent>
      </Card>

      {confirming && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !deleting && setConfirming(false)}
        >
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Supprimer « {name} » ?
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Le formulaire et ses{" "}
                <span className="font-semibold text-foreground">
                  {submissionCount} soumission(s)
                </span>{" "}
                disparaîtront de la plateforme, y compris de la carte et des
                statistiques.
              </p>
              <p className="text-sm text-muted-foreground">
                Rien n&apos;est effacé physiquement : un administrateur peut tout
                restaurer depuis <span className="font-medium">Données &amp; archivage</span>.
              </p>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motif de la suppression (optionnel)"
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {deleting ? "Suppression..." : `Supprimer avec ses données`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
