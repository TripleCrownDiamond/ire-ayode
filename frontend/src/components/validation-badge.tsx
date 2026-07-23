"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
} from "lucide-react";

export type ValidationStatus = "pending" | "valid" | "needs_revision" | "rejected";

interface ValidationBadgeProps {
  /** Statut brut : une valeur inconnue retombe sur « en attente ». */
  status: ValidationStatus | string;
  className?: string;
}

const STATUS_CONFIG = {
  pending: {
    label: "En attente",
    icon: Clock,
    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  },
  valid: {
    label: "Validée",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  },
  needs_revision: {
    label: "À corriger",
    icon: AlertTriangle,
    className: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
  },
  rejected: {
    label: "Rejetée",
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
  },
};

export function ValidationBadge({ status, className }: ValidationBadgeProps) {
  // Un statut absent ou inattendu ne doit pas faire planter la page
  const config = STATUS_CONFIG[status as ValidationStatus] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2.5 py-1", config.className, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// Sélecteur de statut pour les admins
interface ValidationSelectorProps {
  current: string;
  onChange: (status: string, notes?: string) => void;
  disabled?: boolean;
}

export function ValidationSelector({
  current,
  onChange,
  disabled = false,
}: ValidationSelectorProps) {
  const statuses = [
    { value: "pending", label: "En attente", icon: Clock, color: "text-amber-600" },
    { value: "valid", label: "Valider", icon: CheckCircle2, color: "text-emerald-600" },
    { value: "needs_revision", label: "À corriger", icon: AlertTriangle, color: "text-orange-600" },
    { value: "rejected", label: "Rejeter", icon: XCircle, color: "text-red-600" },
  ];

  return (
    <div className="flex items-center gap-2">
      {statuses.map((s) => {
        const Icon = s.icon;
        const isActive = current === s.value;
        return (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm font-medium"
                : "bg-white text-muted-foreground border-border hover:border-primary/30 hover:text-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
