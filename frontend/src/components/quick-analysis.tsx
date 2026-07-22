"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sprout,
  MapPin,
  Users,
  Ruler,
  Warehouse,
  Earth,
  Trees,
  type LucideIcon,
} from "lucide-react";

interface QuickAnalysisProps {
  stats: {
    total_producteurs: number;
    total_parcelles: number;
    superficie_totale_ha: number;
    communes: number;
    villages: number;
    cooperatives: number;
    genres?: Record<string, number>;
    total_submissions: number;
    total_forms: number;
  } | null;
  loading?: boolean;
}

interface AnalysisCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bg: string;
  iconColor: string;
}

function AnalysisCard({ icon: Icon, label, value, sub, color, bg, iconColor }: AnalysisCardProps) {
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-all group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg ${bg} shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
            {sub && (
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickAnalysis({ stats, loading }: QuickAnalysisProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-5 bg-muted rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const analysisCards: AnalysisCardProps[] = [
    {
      icon: Users,
      label: "Producteurs",
      value: stats.total_producteurs,
      sub: stats.total_submissions > 0 ? `${(stats.total_submissions / Math.max(stats.total_producteurs, 1)).toFixed(1)} soum./prod.` : undefined,
      color: "from-violet-500",
      bg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      icon: Trees,
      label: "Parcelles",
      value: stats.total_parcelles,
      sub: stats.total_producteurs > 0 ? `${(stats.total_parcelles / Math.max(stats.total_producteurs, 1)).toFixed(1)} parc./prod.` : undefined,
      color: "from-green-500",
      bg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      icon: Ruler,
      label: "Superficie totale",
      value: `${stats.superficie_totale_ha.toLocaleString("fr-FR")} ha`,
      sub: stats.total_parcelles > 0 ? `${(stats.superficie_totale_ha / Math.max(stats.total_parcelles, 1)).toFixed(3)} ha/parcelle` : undefined,
      color: "from-amber-500",
      bg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      icon: Earth,
      label: "Communes",
      value: stats.communes,
      sub: stats.villages > 0 ? `${stats.villages} villages` : undefined,
      color: "from-cyan-500",
      bg: "bg-cyan-50",
      iconColor: "text-cyan-600",
    },
    {
      icon: Warehouse,
      label: "Coopératives",
      value: stats.cooperatives,
      sub: stats.total_producteurs > 0 ? `${(stats.total_producteurs / Math.max(stats.cooperatives, 1)).toFixed(1)} prod./coop.` : undefined,
      color: "from-orange-500",
      bg: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      icon: Sprout,
      label: "Soumissions",
      value: stats.total_submissions,
      sub: `${stats.total_forms} formulaires`,
      color: "from-emerald-500",
      bg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Sprout className="h-4 w-4 text-primary" />
        Analyse rapide
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {analysisCards.map((card) => (
          <AnalysisCard key={card.label} {...card} />
        ))}
      </div>

      {/* Répartition par genre */}
      {stats.genres && Object.keys(stats.genres).length > 0 && (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium">Répartition par genre :</span>
          {Object.entries(stats.genres).map(([genre, count]) => {
            const total = Object.values(stats.genres!).reduce((s, c) => s + c, 0);
            const pct = Math.round((count / total) * 100);
            const isMasculin = genre.toLowerCase().includes("masculin") || genre.toLowerCase() === "m";

            return (
              <Badge
                key={genre}
                variant="outline"
                className={`text-xs ${
                  isMasculin
                    ? "border-blue-200 text-blue-700 bg-blue-50"
                    : "border-pink-200 text-pink-700 bg-pink-50"
                }`}
              >
                {isMasculin ? "👨" : "👩"} {genre} : {count} ({pct}%)
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
