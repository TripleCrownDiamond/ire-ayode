"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, User, MapPin, Calendar } from "lucide-react";
import { parseFields, getMainInfo, isParcelleField, isGeoField } from "@/lib/field-map";
import { getMediaUrl } from "@/lib/api";
import { ValidationBadge } from "@/components/validation-badge";

interface SubmissionCardProps {
  submission: any;
  formUid: string;
}

export function SubmissionCard({ submission, formUid }: SubmissionCardProps) {
  const data = submission.data || {};
  const fields = parseFields(data);
  const info = getMainInfo(fields);

  // Carte des attachments Kobo pour résoudre les URLs d'images
  const attachments = (data._attachments as any[]) || [];
  const attachmentMap = new Map<string, string>();
  for (const att of attachments) {
    const url = att.download_medium_url || att.download_large_url || att.download_url || "";
    if (url) {
      attachmentMap.set(att.filename, url);
      if (att.media_file_basename) {
        attachmentMap.set(att.media_file_basename, url);
      }
    }
  }

  const photoUrl = info.photo
    ? attachmentMap.get(String(info.photo.value)) || undefined
    : undefined;

  const hasParcelle = Object.keys(data).some((k) => isParcelleField(k));
  const hasGeo = Object.keys(data).some((k) => isGeoField(k));
  const validated = submission.validated || "pending";

  return (
    <Link href={`/forms/${formUid}/submissions/${submission.id}`}>
      <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Left: main info */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Header row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs shrink-0">
                  #{submission.kobo_id}
                </Badge>
                <ValidationBadge status={validated} className="text-[10px] py-0 px-1.5" />
                {info.name && (
                  <span className="font-semibold truncate">
                    {String(info.name.value)}
                  </span>
                )}
                {info.technicien && (
                  <Badge variant="secondary" className="text-xs truncate max-w-[200px]">
                    {String(info.technicien.value)}
                  </Badge>
                )}
              </div>

              {/* Details row */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                {submission.submitted_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(submission.submitted_at).toLocaleDateString("fr-FR")}
                  </span>
                )}
                {info.commune && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {String(info.commune.value)}
                    {info.village && `, ${String(info.village.value)}`}
                  </span>
                )}
                {info.genre && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      String(info.genre.value).toLowerCase() === "masculin"
                        ? "border-blue-300 text-blue-700"
                        : "border-pink-300 text-pink-700"
                    }`}
                  >
                    {String(info.genre.value)}
                  </Badge>
                )}
              </div>

              {/* Tags row */}
              <div className="flex items-center gap-2 flex-wrap">
                {info.cooperative && (
                  <Badge variant="secondary" className="text-xs">
                    {String(info.cooperative.value)}
                  </Badge>
                )}
                {info.superficie && (
                  <Badge variant="outline" className="text-xs">
                    {String(info.superficie.value)} ha
                  </Badge>
                )}
                {hasParcelle && (
                  <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                    <MapPin className="h-3 w-3 mr-1" />
                    Parcelle
                  </Badge>
                )}
              </div>
            </div>

            {/* Right: photo + arrow */}
            <div className="flex items-center gap-3 shrink-0">
              {info.photo && (
                <img
                  src={getMediaUrl(formUid, String(info.photo.value), photoUrl)}
                  alt="Photo"
                  className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                  }}
                />
              )}
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
