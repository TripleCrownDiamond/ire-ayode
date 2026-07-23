"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ZoomIn, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { getMediaUrl } from "@/lib/api";
import { KoboImage } from "@/components/kobo-image";

export interface GalleryImage {
  key: string;
  value: string;
  /** URL de téléchargement Kobo (attachments) — proxifiées via ?url= */
  downloadUrls?: string[];
}

interface ImageGalleryProps {
  images: GalleryImage[];
  formUid: string;
  /** Id de la soumission — sert la copie archivee localement */
  submissionId?: number;
  /** Taille des vignettes de la grille */
  columns?: 2 | 3 | 4;
}

export function ImageGallery({
  images,
  formUid,
  submissionId,
  columns = 3,
}: ImageGalleryProps) {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(
    () => setIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length]
  );

  // Navigation clavier dans la visionneuse + blocage du scroll de fond
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, close, prev, next]);

  if (images.length === 0) return null;

  const current = index !== null ? images[index] : null;
  const gridCols =
    columns === 2
      ? "grid-cols-2"
      : columns === 4
        ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <>
      <div className={`grid ${gridCols} gap-3`}>
        {images.map((img, i) => (
          <button
            key={img.key}
            onClick={() => setIndex(i)}
            title={img.key}
            aria-label={`Agrandir ${img.key}`}
            className="group relative rounded-lg overflow-hidden border hover:shadow-md hover:border-primary/40 transition-all aspect-square"
          >
            <KoboImage
              formUid={formUid}
              filename={img.value}
              downloadUrls={img.downloadUrls}
              submissionId={submissionId}
              alt={img.key}
              containerClassName="h-full w-full"
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pointer-events-none">
              <span className="text-xs text-white truncate block">{img.key}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Visionneuse */}
      {current && index !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={current.key}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={close}
            aria-label="Fermer"
          >
            <X className="h-7 w-7" />
          </button>

          <a
            href={getMediaUrl(formUid, current.value, current.downloadUrls, submissionId)}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-16 text-white/80 hover:text-white p-2"
            aria-label="Télécharger"
          >
            <Download className="h-6 w-6" />
          </a>

          {images.length > 1 && (
            <>
              <button
                className="absolute left-2 sm:left-6 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Image précédente"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                className="absolute right-2 sm:right-6 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Image suivante"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}

          <div
            className="max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <KoboImage
              key={current.key}
              formUid={formUid}
              filename={current.value}
              downloadUrls={current.downloadUrls}
              submissionId={submissionId}
              alt={current.key}
              containerClassName="flex items-center justify-center"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              fallbackLabel="Fichier introuvable sur KoboToolbox"
            />
            <div className="text-center mt-3 text-white text-sm">
              {current.key}
              {images.length > 1 && (
                <span className="text-white/50 ml-2">
                  {index + 1} / {images.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
