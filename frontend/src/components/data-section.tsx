"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Code } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FieldInfo } from "@/lib/field-map";

interface DataSectionProps {
  title?: string;
  fields: FieldInfo[];
  defaultOpen?: boolean;
}

export function DataSection({
  title = "Données brutes",
  fields,
  defaultOpen = false,
}: DataSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const displayable = fields.filter(
    (f) => !f.isImage && !Array.isArray(f.value) && typeof f.value !== "object"
  );

  if (displayable.length === 0) return null;

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full p-3 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Code className="h-4 w-4 text-muted-foreground" />
        <span>{title}</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {displayable.length} champs
        </span>
      </button>
      {open && (
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Champ</TableHead>
                <TableHead>Valeur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayable.map((field) => (
                <TableRow key={field.key}>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {field.label}
                  </TableCell>
                  <TableCell className="text-sm">{String(field.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
