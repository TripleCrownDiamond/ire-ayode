"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchForms, fetchSubmissions } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParcelMap } from "@/components/parcel-map-client";
import { parseParcellePoints } from "@/lib/geo";
import { MapPin, Filter } from "lucide-react";

interface Parcelle {
  id: string;
  name: string;
  points: { lat: number; lng: number }[];
  formName: string;
  formUid: string;
  color?: string;
}

const FORM_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04",
  "#9333ea", "#ea580c", "#0891b2", "#be185d",
];

export default function MapPage() {
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<string>("all");

  useEffect(() => {
    (async () => {
      try {
        const formsData = await fetchForms();
        const forms = formsData.results || [];
        const allParcelles: Parcelle[] = [];

        for (const form of forms) {
          if (form.submission_count === 0) continue;
          try {
            const subsData = await fetchSubmissions(form.uid, 0, 500);
            const subs = subsData.results || [];
            for (const sub of subs) {
              const data = sub.data || {};
              const parcelleField = Object.keys(data).find((k) =>
                /parcelle|plan.*parcellaire/i.test(k)
              );
              if (!parcelleField) continue;
              const points = parseParcellePoints(data[parcelleField]);
              if (points.length === 0) continue;

              const nameField = Object.keys(data).find(
                (k) => /nom.*producteur|pr.*nom/i.test(k) && !/technicien/i.test(k)
              );
              allParcelles.push({
                id: sub.kobo_id,
                name: nameField ? String(data[nameField]) : `Parcelle ${sub.kobo_id}`,
                points,
                formName: form.name,
                formUid: form.uid,
              });
            }
          } catch (e) {
            // skip
          }
        }

        setParcelles(allParcelles);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  // Unique form names
  const formNames = useMemo(
    () => [...new Set(parcelles.map((p) => p.formName))],
    [parcelles]
  );

  // Filtered parcelles
  const filtered = useMemo(
    () =>
      selectedForm === "all"
        ? parcelles
        : parcelles.filter((p) => p.formName === selectedForm),
    [parcelles, selectedForm]
  );

  // Assign colors per form
  const coloredParcelles = useMemo(
    () =>
      filtered.map((p) => ({
        ...p,
        color: FORM_COLORS[formNames.indexOf(p.formName) % FORM_COLORS.length],
      })),
    [filtered, formNames]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carte des parcelles</h1>
          <p className="text-muted-foreground mt-1">
            {loading
              ? "Chargement..."
              : `${filtered.length} parcelle(s) sur ${parcelles.length} totales`}
          </p>
        </div>
        {formNames.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedForm}
              onChange={(e) => setSelectedForm(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Tous les formulaires</option>
              {formNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Legend */}
      {formNames.length > 1 && selectedForm === "all" && (
        <div className="flex flex-wrap gap-3">
          {formNames.map((name, i) => (
            <div key={name} className="flex items-center gap-2 text-sm">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: FORM_COLORS[i % FORM_COLORS.length] }}
              />
              <span className="text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-20 text-muted-foreground">
              Chargement des parcelles...
            </div>
          ) : (
            <ParcelMap
              parcelles={coloredParcelles}
              height="calc(100vh - 220px)"
              zoom={12}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
