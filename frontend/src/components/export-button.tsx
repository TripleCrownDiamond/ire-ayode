"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileJson, FileText, Table } from "lucide-react";
import { exportToCSV, exportToJSON } from "@/lib/export";

interface ExportButtonProps {
  data: Record<string, any>;
  filename: string;
}

export function ExportButton({ data, filename }: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group/inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
        <Download className="h-4 w-4" />
        Exporter
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToCSV(data, filename)}>
          <FileText className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToJSON(data, filename)}>
          <FileJson className="h-4 w-4 mr-2" />
          JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ExportAllButtonProps {
  submissions: any[];
  formName: string;
}

export function ExportAllButton({ submissions, formName }: ExportAllButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { exportAllSubmissions } = await import("@/lib/export");
      exportAllSubmissions(submissions, formName);
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
      <Download className="h-4 w-4" />
      {exporting ? "Export..." : "Tout exporter (CSV)"}
    </Button>
  );
}
