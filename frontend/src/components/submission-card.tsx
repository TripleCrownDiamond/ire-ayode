"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, User, MapPin, Calendar } from "lucide-react";
import { parseFields, getMainInfo, isParcelleField } from "@/lib/field-map";
import { buildAttachmentIndex, resolveAttachment } from "@/lib/attachments";
import { KoboImage } from "@/components/kobo-image";
import { ValidationBadge } from "@/components/validation-badge";

interface SubmissionCardProps {
  submission: any;
  formUid: string;
}

export function SubmissionCard({ submission, formUid }: SubmissionCardProps) {
  const data = submission.data || {};
  const fields = parseFields(data);
  const info = getMainInfo(fields);

  // Résolution des pièces jointes Kobo — logique partagée avec la fiche détaillée
  const attachmentIndex = buildAttachmentIndex(data._attachments);
  const photoUrls = info.photo
    ? resolveAttachment(attachmentIndex, info.photo.value, info.photo.key)
    : undefined;

  const hasParcelle = Object.keys(data).some((k) => isParcelleField(k));
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
                <KoboImage
                  formUid={formUid}
                  filename={String(info.photo.value)}
                  downloadUrls={photoUrls}
                  alt={`Photo de ${info.name ? String(info.name.value) : "la soumission"}`}
                  containerClassName="h-12 w-12 shrink-0 rounded-full overflow-hidden border-2 border-white shadow-sm"
                  className="h-12 w-12 object-cover"
                  fallbackLabel=""
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
