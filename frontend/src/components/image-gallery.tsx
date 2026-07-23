"use client";

import { useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { getMediaUrl } from "@/lib/api";

interface GalleryImage {
  key: string;
  value: string;
  /** URL de téléchargement Kobo (attachment) — si fourni, proxy via ?url= */
  downloadUrl?: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  formUid: string;
}

export function ImageGallery({ images, formUid }: ImageGalleryProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (images.length === 0) return null;

  const selectedImage = images.find((img) => img.value === selected);

  const imgUrl = (img: GalleryImage) =>
    getMediaUrl(formUid, img.value, img.downloadUrl);

  // Fallback: try direct Kobo URL if proxy fails
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>, img: GalleryImage) => {
    const target = e.currentTarget;
    // If proxy failed and we have a direct downloadUrl, try it directly
    if (img.downloadUrl && target.src !== img.downloadUrl) {
      target.src = img.downloadUrl;
      return;
    }
    // Otherwise show unavailable
    target.style.display = "none";
    target.parentElement!.classList.add("bg-muted", "flex", "items-center", "justify-center");
    target.parentElement!.innerHTML =
      `<span class="text-muted-foreground text-xs text-center p-2">Image<br/>indisponible</span>`;
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img) => (
          <button
            key={img.key}
            onClick={() => setSelected(img.value)}
            className="group relative rounded-lg overflow-hidden border hover:shadow-md transition-shadow aspect-square"
          >
            <img
              src={imgUrl(img)}
              alt={img.key}
              className="w-full h-full object-cover"
              onError={(e) => handleError(e, img)}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <span className="text-xs text-white truncate block">{img.key}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selected && selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setSelected(null)}
          >
            <X className="h-8 w-8" />
          </button>
          <div className="max-w-4xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={imgUrl(selectedImage)}
              alt={selectedImage.key}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onError={(e) => handleError(e, selectedImage)}
            />
            <div className="text-center mt-3 text-white text-sm">
              {selectedImage.key}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
