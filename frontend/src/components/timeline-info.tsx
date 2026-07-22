"use client";

import { Badge } from "@/components/ui/badge";
import {
  Scissors,
  TreePine,
  Flame,
  Apple,
  Users,
  Scale,
} from "lucide-react";
import { FieldInfo } from "@/lib/field-map";

const PERIOD_ICONS: Record<string, any> = {
  desherbage: Scissors,
  elagage: TreePine,
  "pare.*feu": Flame,
  recolte: Apple,
  "main.*d.*oeuvre": Users,
};

function getPeriodIcon(label: string): any {
  for (const [pattern, Icon] of Object.entries(PERIOD_ICONS)) {
    if (new RegExp(pattern, "i").test(label)) return Icon;
  }
  return Scale;
}

interface TimelineInfoProps {
  fields: FieldInfo[];
}

export function TimelineInfo({ fields }: TimelineInfoProps) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-2">
      {fields.map((field) => {
        const Icon = getPeriodIcon(field.label);
        return (
          <div key={field.key} className="flex items-center gap-3 text-sm">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-50 text-amber-600 shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-muted-foreground">{field.label}</span>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {String(field.value)}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
