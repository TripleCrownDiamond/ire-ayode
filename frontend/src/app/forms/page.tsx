"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchForms, triggerSync } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormMissingBanner } from "@/components/form-missing-banner";
import { RefreshCw, ArrowRight, Loader2, Archive, FileText, Clock } from "lucide-react";

interface Form {
  uid: string;
  name: string;
  owner: string;
  submission_count: number;
  last_submission_time: string | null;
  date_created: string;
  status: string;
  deployment_active: boolean;
  missing_on_kobo?: boolean;
  kobo_last_seen_at?: string | null;
}

export default function FormsPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
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
  }, []);

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

  const missingForms = forms.filter((f) => f.missing_on_kobo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Formulaires</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {forms.length} formulaire(s) accessible(s)
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2 shrink-0">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{syncing ? "Synchronisation..." : "Synchroniser"}</span>
          <span className="sm:hidden">{syncing ? "..." : "Sync"}</span>
        </Button>
      </div>

      {missingForms.map((f) => (
        <FormMissingBanner
          key={f.uid}
          uid={f.uid}
          name={f.name}
          submissionCount={f.submission_count}
          lastSeenAt={f.kobo_last_seen_at}
          onDeleted={load}
        />
      ))}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : forms.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="p-6 text-muted-foreground">
            Aucun formulaire. Synchronisez depuis KoboToolbox.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table desktop */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Proprietaire</TableHead>
                  <TableHead className="text-center">Soumissions</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Cree le</TableHead>
                  <TableHead>Derniere soum.</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((f, i) => (
                  <TableRow
                    key={f.uid}
                    className={`cursor-pointer hover:bg-muted/50 ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                  >
                    <TableCell>
                      <Link
                        href={`/forms/${f.uid}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {f.name}
                      </Link>
                      {f.missing_on_kobo && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px] py-0 px-1.5 border-amber-300 text-amber-700 bg-amber-50 gap-1"
                        >
                          <Archive className="h-3 w-3" />
                          Absent
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.owner}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={f.submission_count > 0 ? "default" : "secondary"}>
                        {f.submission_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={f.deployment_active ? "default" : "destructive"}
                        className={f.deployment_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}
                      >
                        {f.deployment_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(f.date_created).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {f.last_submission_time
                        ? new Date(f.last_submission_time).toLocaleDateString("fr-FR")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/forms/${f.uid}`}>
                        <ArrowRight className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Cards mobile */}
          <div className="md:hidden space-y-3">
            {forms.map((f) => (
              <Link key={f.uid} href={`/forms/${f.uid}`}>
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm leading-tight truncate">{f.name}</h3>
                          {f.missing_on_kobo && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-300 text-amber-700 bg-amber-50 gap-1 shrink-0">
                              <Archive className="h-3 w-3" />
                              Absent
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{f.owner}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {f.submission_count} soumission(s)
                      </span>
                      <Badge
                        variant={f.deployment_active ? "default" : "destructive"}
                        className={`text-[10px] ${f.deployment_active ? "bg-emerald-100 text-emerald-700" : ""}`}
                      >
                        {f.deployment_active ? "Actif" : "Inactif"}
                      </Badge>
                      {f.last_submission_time && (
                        <span className="flex items-center gap-1 ml-auto">
                          <Clock className="h-3 w-3" />
                          {new Date(f.last_submission_time).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
