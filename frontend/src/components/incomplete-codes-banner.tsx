"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchIncompleteCodes, recalculateCodes } from "@/lib/api";
import type { DBProducer } from "@/lib/producers";
import { Hash, Loader2, RefreshCw, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";

interface IncompleteCodesBannerProps {
  /** Rappelé après un recalcul pour rafraîchir la liste appelante */
  onRecalculated?: () => void;
}

/**
 * Signale les codes producteurs à trous (« XX » en place de la commune ou de
 * la coopérative) et propose leur recalcul dès que l'information manquante
 * est renseignée.
 */
export function IncompleteCodesBanner({ onRecalculated }: IncompleteCodesBannerProps) {
  const [producers, setProducers] = useState<DBProducer[]>([]);
  const [recalculable, setRecalculable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | "all" | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchIncompleteCodes();
      setProducers(data.results || []);
      setRecalculable(data.recalculable || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAll = async () => {
    setBusy("all");
    setMessage(null);
    try {
      const res = await recalculateCodes();
      setMessage(
        res.updated_count > 0
          ? `${res.updated_count} code(s) recalculé(s).` +
              (res.still_incomplete
                ? ` ${res.still_incomplete} attendent encore la commune ou la coopérative.`
                : "")
          : "Aucun code recalculable pour l'instant."
      );
      await load();
      onRecalculated?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Recalcul impossible");
    }
    setBusy(null);
  };

  const runOne = async (id: number) => {
    setBusy(id);
    setMessage(null);
    try {
      const res = await recalculateCodes(id);
      setMessage(`${res.old_code} → ${res.new_code}` +
        (res.parcels_updated ? ` (${res.parcels_updated} parcelle(s) renommée(s))` : ""));
      await load();
      onRecalculated?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Recalcul impossible");
    }
    setBusy(null);
  };

  if (loading || producers.length === 0) return null;

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3 flex-wrap">
          <Hash className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-[220px]">
            <p className="font-medium text-amber-900">
              {producers.length} code(s) producteur incomplet(s)
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              Ces producteurs ont été créés sans commune ni coopérative — leur
              code porte des « XX ».{" "}
              {recalculable > 0
                ? `${recalculable} peuvent être recalculés maintenant que l'information est renseignée.`
                : "Renseignez la commune et la coopérative sur leur fiche pour pouvoir les recalculer."}
            </p>
          </div>
          {recalculable > 0 && (
            <Button
              onClick={runAll}
              disabled={busy !== null}
              size="sm"
              className="shrink-0 gap-1.5"
            >
              {busy === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Recalculer ({recalculable})
            </Button>
          )}
        </div>

        {message && <p className="text-sm text-amber-900 font-medium">{message}</p>}

        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-sm text-amber-800 hover:text-amber-950"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Voir le détail
        </button>

        {open && (
          <div className="space-y-1.5 border-t border-amber-200 pt-3">
            {producers.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-2 rounded-md bg-white/70 border border-amber-200 flex-wrap"
              >
                <Badge variant="outline" className="font-mono text-xs shrink-0">
                  {p.code}
                </Badge>
                <Link
                  href={`/producteurs/${p.id}`}
                  className="text-sm font-medium truncate hover:text-primary transition-colors"
                >
                  {p.name || "—"}
                </Link>
                <span className="text-xs text-muted-foreground truncate">
                  {[p.commune || "commune ?", p.cooperative || "coopérative ?"].join(" · ")}
                </span>

                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {p.can_recalculate ? (
                    <>
                      <span className="text-xs font-mono text-emerald-700 flex items-center gap-1">
                        {p.new_prefix}
                        <ArrowRight className="h-3 w-3" />
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => runOne(p.id)}
                        className="gap-1.5 h-7 text-xs"
                      >
                        {busy === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Recalculer
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      {p.blocked_reason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
