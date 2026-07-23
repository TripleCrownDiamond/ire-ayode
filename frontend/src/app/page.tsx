"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchForms, fetchStats, triggerSync } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatsOverview, SyncStatusBar } from "@/components/stats-overview";
import { SubmissionsChart } from "@/components/submissions-chart";
import { QuickAnalysis } from "@/components/quick-analysis";
import { useAuth } from "@/context/auth-context";
import { RefreshCw, FileText, ArrowRight, Clock, ShieldAlert, Mail } from "lucide-react";

interface Form {
  uid: string;
  name: string;
  owner: string;
  submission_count: number;
  last_submission_time: string | null;
  date_created: string;
  status: string;
  deployment_active: boolean;
}

export default function HomePage() {
  const { user, canRead } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const canViewForms = canRead("forms");

  const load = async () => {
    if (!canViewForms) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchForms();
      setForms(data.results || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (canViewForms) {
      loadStats();
    }
  }, [canViewForms]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await fetchStats();
      setStats(data.stats || null);
    } catch {
      // Stats non disponibles
    }
    setStatsLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await load();
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };

  const totalSubmissions = forms.reduce((s, f) => s + f.submission_count, 0);
  const activeForms = forms.filter((f) => f.deployment_active);
  const lastSync = forms
    .map((f) => f.last_submission_time)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  const enAttente = undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
          Bienvenue, {user?.email?.split("@")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          {canViewForms
            ? "Vue d'ensemble de vos données KoboToolbox"
            : "Votre compte est actif mais n'a pas encore de permissions."}
        </p>
      </div>

      {/* Alerte permissions manquantes */}
      {!canViewForms && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-100 shrink-0">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-amber-900">
                  Aucune permission attribuée
                </h3>
                <p className="text-sm text-amber-700">
                  Vous ne pouvez pas encore accéder aux données de la plateforme.
                  Contactez un administrateur pour qu&apos;il vous accorde les permissions nécessaires.
                </p>
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                  <Mail className="h-3 w-3" />
                  {user?.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contenu avec permissions */}
      {canViewForms && (
        <>
          {/* Sync button */}
          <div className="flex justify-end">
            <Button onClick={handleSync} disabled={syncing} className="gap-2 shadow-sm">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Synchronisation..." : "Synchroniser"}
            </Button>
          </div>

          {/* Sync status bar */}
          <SyncStatusBar lastSync={lastSync || undefined} enAttente={enAttente} />

          {/* KPI Cards */}
          <StatsOverview
            formsCount={forms.length}
            activeForms={activeForms.length}
            submissionsCount={totalSubmissions}
            lastSync={lastSync || undefined}
          />

          {/* Analyse rapide */}
          <QuickAnalysis stats={stats} loading={statsLoading} />

          {/* Charts */}
          {forms.length > 0 && <SubmissionsChart forms={forms} />}

          {/* Recent forms */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                <FileText className="h-4 w-4 inline mr-2 text-primary" />
                Formulaires récents
              </h2>
              <Link href="/forms">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  Voir tout <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-5 space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : forms.length === 0 ? (
              <Card className="py-12 text-center">
                <CardContent className="p-6">
                  <p className="text-muted-foreground">
                    Aucun formulaire. Cliquez sur <strong>Synchroniser</strong> pour charger depuis KoboToolbox.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {forms.slice(0, 6).map((f) => (
                  <Link key={f.uid} href={`/forms/${f.uid}`}>
                    <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group h-full border">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2 flex-1">
                            {f.name}
                          </h3>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 mt-0.5" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Propriétaire</span>
                            <span className="font-medium text-xs">{f.owner}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Soumissions</span>
                            <Badge variant={f.submission_count > 0 ? "default" : "secondary"} className="text-xs">
                              {f.submission_count}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Créé le</span>
                            <span className="text-xs">
                              {new Date(f.date_created).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                          {f.last_submission_time && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Dernière soumission</span>
                              <span className="text-xs flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(f.last_submission_time).toLocaleDateString("fr-FR")}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
