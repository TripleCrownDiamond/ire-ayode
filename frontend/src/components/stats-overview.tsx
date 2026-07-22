"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Users,
  MapPin,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface StatsOverviewProps {
  formsCount: number;
  activeForms: number;
  submissionsCount: number;
  totalProducteurs?: number;
  totalParcelles?: number;
  superficieHa?: number;
  enAttenteValidation?: number;
  lastSync?: string;
}

export function StatsOverview({
  formsCount,
  activeForms,
  submissionsCount,
  totalProducteurs = 0,
  totalParcelles = 0,
  superficieHa = 0,
  enAttenteValidation = 0,
  lastSync,
}: StatsOverviewProps) {
  const stats = [
    {
      label: "Formulaires",
      value: formsCount,
      sub: `${activeForms} actifs`,
      icon: FileText,
      color: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      text: "text-blue-600",
    },
    {
      label: "Soumissions",
      value: submissionsCount,
      sub: "données collectées",
      icon: Users,
      color: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
    },
    ...(totalProducteurs > 0
      ? [
          {
            label: "Producteurs",
            value: totalProducteurs,
            sub: "enregistrés",
            icon: TrendingUp,
            color: "from-violet-500 to-violet-600",
            bg: "bg-violet-50",
            text: "text-violet-600",
          } as const,
        ]
      : []),
    ...(totalParcelles > 0
      ? [
          {
            label: "Parcelles",
            value: totalParcelles,
            sub: superficieHa ? `${superficieHa} ha` : "géoréférencées",
            icon: MapPin,
            color: "from-amber-500 to-amber-600",
            bg: "bg-amber-50",
            text: "text-amber-600",
          } as const,
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.label}
            className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow"
          >
            <div
              className={`absolute inset-0 opacity-[0.03] bg-gradient-to-br ${stat.color}`}
            />
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.sub}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function SyncStatusBar({ lastSync, enAttente }: { lastSync?: string; enAttente?: number }) {
  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/10">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">
            Dernière synchronisation :{" "}
            <span className="font-medium text-foreground">
              {lastSync
                ? new Date(lastSync).toLocaleString("fr-FR")
                : "Jamais"}
            </span>
          </span>
        </div>
        {enAttente !== undefined && enAttente > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-amber-700 font-medium">
              {enAttente} soumission(s) à valider
            </span>
          </div>
        )}
        {enAttente !== undefined && enAttente === 0 && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-700 font-medium">Tout est validé</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
