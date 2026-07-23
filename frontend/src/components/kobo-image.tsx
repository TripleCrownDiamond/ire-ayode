"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { getMediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface KoboImageProps {
  formUid: string;
  /** Valeur brute du champ (nom de fichier Kobo) */
  filename: string;
  /** URL candidates issues des `_attachments`, par ordre de préférence */
  downloadUrls?: string[];
  alt: string;
  className?: string;
  /** Classe appliquée au conteneur (place réservée pendant le chargement) */
  containerClassName?: string;
  /** Message affiché si aucune source ne répond */
  fallbackLabel?: string;
}

/**
 * Image Kobo tolérante aux pannes : essaie le proxy, puis chaque URL de
 * téléchargement directe, et n'affiche un état « indisponible » qu'en dernier
 * recours. Sans cela une signature manquante disparaissait silencieusement.
 */
export function KoboImage({
  formUid,
  filename,
  downloadUrls,
  alt,
  className,
  containerClassName,
  fallbackLabel = "Image indisponible",
}: KoboImageProps) {
  // Chaîne de sources : proxy d'abord (authentifié côté serveur),
  // puis les URL Kobo directes au cas où le proxy serait bloqué.
  const sources = [
    getMediaUrl(formUid, filename, downloadUrls),
    ...(downloadUrls || []),
  ];

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Réinitialise si la soumission affichée change
  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
  }, [filename, formUid]);

  const failed = attempt >= sources.length;

  if (failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md bg-muted text-muted-foreground p-3 min-h-[72px] min-w-[72px]",
          containerClassName,
          className
        )}
        title={filename}
      >
        <ImageOff className="h-5 w-5 opacity-60" />
        <span className="text-[10px] text-center leading-tight">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <div className={cn("relative", containerClassName)}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt}
        src={sources[attempt]}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(className, !loaded && "opacity-0")}
        onLoad={() => setLoaded(true)}
        onError={() => setAttempt((a) => a + 1)}
      />
    </div>
  );
}
