"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchSubmission, getMediaUrl, updateSubmissionStatus, updateSubmissionData } from "@/lib/api";
import { buildAttachmentIndex, resolveAttachment } from "@/lib/attachments";
import { KoboImage } from "@/components/kobo-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ParcelMap } from "@/components/parcel-map-client";
import { parseParcellePoints } from "@/lib/geo";
import { ImageGallery } from "@/components/image-gallery";
import { ExportButton } from "@/components/export-button";
import { DataSection } from "@/components/data-section";
import { TimelineInfo } from "@/components/timeline-info";
import { ValidationBadge, ValidationSelector } from "@/components/validation-badge";
import {
  parseFields,
  getFieldsByGroup,
  getMainInfo,
  isParcelleField,
  isGeoField,
  isSignatureField,
} from "@/lib/field-map";
import {
  ArrowLeft,
  User,
  MapPin,
  Calendar,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  PenTool,
  Paperclip,
  Camera,
  Save,
  Edit3,
  X,
  Loader2,
} from "lucide-react";

const GROUP_COLORS: Record<string, string> = {
  producteur: "border-l-blue-500",
  parcelle: "border-l-green-500",
  calendrier: "border-l-amber-500",
  recolte: "border-l-emerald-500",
};

type ValidationStatus = "pending" | "valid" | "needs_revision" | "rejected";

const VALID_STATUSES: ValidationStatus[] = ["pending", "valid", "needs_revision", "rejected"];

function toValidationStatus(s: string): ValidationStatus {
  return VALID_STATUSES.includes(s as ValidationStatus) ? (s as ValidationStatus) : "pending";
}

export default function SubmissionPage() {
  const params = useParams();
  const uid = params.uid as string;
  const id = Number(params.id);
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>("pending");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid || !id) return;
    (async () => {
      setLoading(true);
      try {
        const s = await fetchSubmission(id);
        setSub(s);
        setValidationStatus(toValidationStatus(s.validated || "pending"));
        setNotes(s.notes || "");
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [uid, id]);

  const handleValidationChange = async (status: string) => {
    const validated = toValidationStatus(status);
    setValidating(true);
    try {
      await updateSubmissionStatus(id, validated, notes);
      setValidationStatus(validated);
    } catch (e) {
      console.error("Failed to update:", e);
    }
    setValidating(false);
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      await updateSubmissionStatus(id, "valid", notes);
      setValidationStatus("valid");
    } catch (e) {
      console.error("Failed to validate:", e);
    }
    setValidating(false);
  };

  // === Mode édition ===
  const startEditing = () => {
    const editable: Record<string, string> = {};
    for (const field of fields) {
      if (
        !field.isImage &&
        !field.isFile &&
        !Array.isArray(field.value) &&
        typeof field.value !== "object"
      ) {
        editable[field.key] = String(field.value ?? "");
      }
    }
    setEditData(editable);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditData({});
  };

  const handleEditFieldChange = (key: string, value: string) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      // Fusionner les données éditées avec les données originales
      const mergedData = { ...data };
      for (const [key, value] of Object.entries(editData)) {
        mergedData[key] = value;
      }
      await updateSubmissionData(id, mergedData as Record<string, unknown>);
      setSub({ ...sub, data: mergedData });
      setEditing(false);
      setEditData({});
    } catch (e) {
      console.error("Failed to save:", e);
    }
    setSaving(false);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!sub)
    return <div className="text-center py-20 text-muted-foreground">Soumission introuvable</div>;

  const data = sub.data || {};
  const fields = parseFields(data);
  const grouped = getFieldsByGroup(fields);
  const info = getMainInfo(fields);

  // Index des pièces jointes Kobo — résolution partagée avec les autres écrans
  const attachmentIndex = buildAttachmentIndex(data._attachments);
  const findAttachmentUrls = (value: unknown, key?: string) =>
    resolveAttachment(attachmentIndex, value, key);

  // Parcelle
  const parcelleField = fields.find((f) => /parcelle|plan.*parcellaire/i.test(f.key));
  const parcellePoints = parcelleField
    ? parseParcellePoints(String(parcelleField.value))
    : [];

  // GPS — fallback multiple : champ geopoint, _geolocation array, _geolocation string
  let gpsPoint: { lat: number; lng: number } | null = null;

  // 1. Champ GPS identifié par isGeoField (geopoint, gps, coordon)
  if (!gpsPoint) {
    const gpsField = fields.find((f) => isGeoField(f.key) && !isParcelleField(f.key));
    if (gpsField) {
      const raw = String(gpsField.value);
      const parts = raw.split(/\s+/).map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        gpsPoint = { lat: parts[0], lng: parts[1] };
      }
    }
  }

  // 2. _geolocation (format array Kobo)
  if (!gpsPoint) {
    const geo = data._geolocation;
    if (Array.isArray(geo) && geo.length >= 2 && geo[0] != null && geo[1] != null) {
      const lat = Number(geo[0]);
      const lng = Number(geo[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        gpsPoint = { lat, lng };
      }
    }
  }

  // 3. _geolocation (format string Kobo "lat lng alt acc")
  if (!gpsPoint) {
    const geo = data._geolocation;
    if (typeof geo === "string") {
      const parts = geo.trim().split(/\s+/).map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        gpsPoint = { lat: parts[0], lng: parts[1] };
      }
    }
  }

  // Images (hors signatures) — enrichies avec les URL des attachments
  const imageFields = fields
    .filter((f) => f.isImage && !isSignatureField(f.key))
    .map((f) => ({
      key: f.label,
      value: String(f.value),
      downloadUrls: findAttachmentUrls(f.value, f.key),
    }));

  // Signatures / paraphes — affichées à part, jamais masquées silencieusement
  const signatureFields = fields
    .filter((f) => f.isImage && isSignatureField(f.key))
    .map((f) => ({
      key: f.label,
      value: String(f.value),
      downloadUrls: findAttachmentUrls(f.value, f.key),
    }));

  // Fichiers joints non affichables (PDF, audio, documents scannés…)
  const fileFields = fields
    .filter((f) => f.isFile)
    .map((f) => ({
      key: f.key,
      label: f.label,
      value: String(f.value),
      downloadUrls: findAttachmentUrls(f.value, f.key),
    }));

  // Map parcelles — popup enrichi avec les infos de la soumission
  const mapMeta = {
    submissionId: String(sub.kobo_id),
    commune: info.commune ? String(info.commune.value) : undefined,
    submitDate: sub.submitted_at
      ? new Date(sub.submitted_at).toLocaleDateString("fr-FR")
      : undefined,
  };
  const mapLabel = info.name ? String(info.name.value) : `#${sub.kobo_id}`;
  const mapParcelles =
    parcellePoints.length > 0
      ? [{ id: String(sub.kobo_id), name: mapLabel, points: parcellePoints, ...mapMeta }]
      : gpsPoint
        ? [
            {
              id: String(sub.kobo_id),
              name: `${mapLabel} — position GPS`,
              points: [gpsPoint],
              ...mapMeta,
            },
          ]
        : [];

  const otherFields = grouped.autre || [];

  // Extraire les infos pour le mode édition (évite les "possibly undefined" TS)
  const genreInfo = info.genre ? { key: info.genre.key, value: info.genre.value } : null;
  const communeInfo = info.commune ? { key: info.commune.key, value: info.commune.value } : null;
  const cooperativeInfo = info.cooperative ? { key: info.cooperative.key, value: info.cooperative.value } : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/forms/${uid}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">#{sub.kobo_id}</h1>
              <Badge variant="outline" className="text-xs">
                {sub.submitted_at
                  ? new Date(sub.submitted_at).toLocaleString("fr-FR")
                  : ""}
              </Badge>
              <ValidationBadge status={validationStatus} />
            </div>
            {sub.submitted_by && (
              <p className="text-muted-foreground text-sm mt-1">
                Soumis par {sub.submitted_by}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <Button onClick={cancelEditing} variant="ghost" size="sm" className="gap-1">
                <X className="h-4 w-4" /> Annuler
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving} size="sm" className="gap-1">
                <Save className="h-4 w-4" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={startEditing} variant="outline" size="sm" className="gap-1.5">
                <Edit3 className="h-4 w-4" /> Modifier
              </Button>
              <Button
                onClick={handleValidate}
                disabled={validating || validationStatus === "valid"}
                variant={validationStatus === "valid" ? "outline" : "default"}
                size="sm"
                className="gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                {validationStatus === "valid" ? "Validée ✓" : "Valider"}
              </Button>
              <ExportButton data={data} filename={`soumission_${sub.kobo_id}`} />
            </>
          )}
        </div>
      </div>

      {/* Validation bar */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3">
          <div className="flex items-center gap-3 text-sm">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <span className="text-muted-foreground">Statut de validation :</span>
            <ValidationSelector
              current={validationStatus}
              onChange={handleValidationChange}
              disabled={validating}
            />
          </div>
          {/* Notes de validation */}
          <div className="mt-2 flex items-center gap-3">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajouter une note interne (optionnel)..."
              className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              onBlur={() => notes && handleValidationChange(toValidationStatus(validationStatus))}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Producteur card */}
          {info.name && (
            <Card className={`border-l-4 ${GROUP_COLORS.producteur} overflow-hidden`}>
              <CardHeader className="pl-5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-blue-500" />
                  Producteur
                </CardTitle>
              </CardHeader>
              <CardContent className="pl-5">
                <div className="flex items-start gap-4">
                  {info.photo && (
                    <KoboImage
                      formUid={uid}
                      filename={String(info.photo.value)}
                      downloadUrls={findAttachmentUrls(info.photo.value, info.photo.key)}
                      alt="Photo du producteur"
                      containerClassName="h-20 w-20 shrink-0 rounded-lg overflow-hidden border shadow-sm"
                      className="h-20 w-20 object-cover"
                      fallbackLabel="Photo"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-lg">{String(info.name.value)}</h3>
                    <div className="flex flex-wrap gap-2">
                      {genreInfo && (
                        editing ? (
                          <input
                            value={editData[genreInfo.key] || ""}
                            onChange={(e) => handleEditFieldChange(genreInfo.key, e.target.value)}
                            className="px-2 py-1 text-xs border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        ) : (
                          <Badge
                            variant="outline"
                            className={`${
                              String(genreInfo.value).toLowerCase() === "masculin"
                                ? "border-blue-300 text-blue-700 bg-blue-50"
                                : "border-pink-300 text-pink-700 bg-pink-50"
                            }`}
                          >
                            {String(genreInfo.value)}
                          </Badge>
                        )
                      )}
                      {communeInfo && (
                        editing ? (
                          <input
                            value={editData[communeInfo.key] || ""}
                            onChange={(e) => handleEditFieldChange(communeInfo.key, e.target.value)}
                            className="px-2 py-1 text-xs border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        ) : (
                          <Badge variant="secondary">
                            <MapPin className="h-3 w-3 mr-1" />
                            {String(communeInfo.value)}
                            {info.village && `, ${String(info.village.value)}`}
                          </Badge>
                        )
                      )}
                      {cooperativeInfo && (
                        editing ? (
                          <input
                            value={editData[cooperativeInfo.key] || ""}
                            onChange={(e) => handleEditFieldChange(cooperativeInfo.key, e.target.value)}
                            className="px-2 py-1 text-xs border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        ) : (
                          <Badge variant="secondary">
                            {String(cooperativeInfo.value)}
                          </Badge>
                        )
                      )}
                    </div>
                    {info.technicien && (
                      <p className="text-sm text-muted-foreground">
                        Technicien : <span className="font-medium">{String(info.technicien.value)}</span>
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parcelle card */}
          {grouped.parcelle && grouped.parcelle.length > 0 && (
            <Card className={`border-l-4 ${GROUP_COLORS.parcelle} overflow-hidden`}>
              <CardHeader className="pl-5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-green-500" />
                  Parcelle
                </CardTitle>
              </CardHeader>
              <CardContent className="pl-5">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {grouped.parcelle
                    .filter((f) => !f.isImage && !f.isFile && !f.isGeo && !/plan.*parcellaire/i.test(f.key))
                    .slice(0, 6)
                    .map((f) => (
                      <div key={f.key}>
                        <span className="text-xs text-muted-foreground block">{f.label}</span>
                        <span className="font-medium text-sm">{String(f.value)}</span>
                      </div>
                    ))}
                </div>
                {/* Mini map */}
                {mapParcelles.length > 0 && (
                  <div className="rounded-lg overflow-hidden border">
                    <ParcelMap parcelles={mapParcelles} height="200px" zoom={16} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Calendrier card */}
          {grouped.calendrier && grouped.calendrier.length > 0 && (
            <Card className={`border-l-4 ${GROUP_COLORS.calendrier} overflow-hidden`}>
              <CardHeader className="pl-5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  Calendrier agricole
                </CardTitle>
              </CardHeader>
              <CardContent className="pl-5">
                <TimelineInfo fields={grouped.calendrier} />
              </CardContent>
            </Card>
          )}

          {/* Production card */}
          {grouped.recolte && grouped.recolte.length > 0 && (
            <Card className={`border-l-4 ${GROUP_COLORS.recolte} overflow-hidden`}>
              <CardHeader className="pl-5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Production
                </CardTitle>
              </CardHeader>
              <CardContent className="pl-5">
                <div className="grid grid-cols-2 gap-4">
                  {grouped.recolte
                    .filter((f) => !f.isImage && !f.isFile)
                    .map((f) => (
                      <div key={f.key}>
                        <span className="text-xs text-muted-foreground block">{f.label}</span>
                        <span className="font-semibold text-lg">{String(f.value)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Other fields */}
          {otherFields.length > 0 && (
            <DataSection
              title="Autres données"
              fields={otherFields}
            />
          )}
        </div>

        {/* Right column (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Photos */}
          {imageFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="h-4 w-4 text-purple-500" />
                  Photos
                  <Badge variant="secondary" className="ml-1">{imageFields.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ImageGallery images={imageFields} formUid={uid} columns={2} />
              </CardContent>
            </Card>
          )}

          {/* Signatures */}
          {signatureFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PenTool className="h-4 w-4 text-slate-500" />
                  Signatures
                  <Badge variant="secondary" className="ml-1">
                    {signatureFields.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {signatureFields.map((f) => (
                    <a
                      key={f.key}
                      href={getMediaUrl(uid, f.value, f.downloadUrls)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all block"
                    >
                      <KoboImage
                        formUid={uid}
                        filename={f.value}
                        downloadUrls={f.downloadUrls}
                        alt={f.key}
                        containerClassName="h-24 w-full bg-white"
                        className="w-full h-24 object-contain p-2"
                        fallbackLabel="Signature indisponible"
                      />
                      <div className="p-2 border-t bg-muted/30">
                        <span className="text-xs text-muted-foreground">{f.key}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fichiers joints non affichables (PDF, audio…) */}
          {fileFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Fichiers joints
                  <Badge variant="secondary" className="ml-1">{fileFields.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {fileFields.map((f) => (
                  <a
                    key={f.key}
                    href={getMediaUrl(uid, f.value, f.downloadUrls)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm p-2 rounded-md border hover:bg-muted/50 transition-colors"
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{f.label}</span>
                    <span className="text-xs text-muted-foreground shrink-0">Ouvrir</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Full map if no parcelle in left column */}
          {mapParcelles.length > 0 && (!grouped.parcelle || grouped.parcelle.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" />
                  Localisation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ParcelMap parcelles={mapParcelles} height="300px" zoom={16} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
