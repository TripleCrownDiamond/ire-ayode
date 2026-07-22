"use client";

import { useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { getMediaUrl } from "@/lib/api";

interface ImageGalleryProps {
  images: { key: string; value: string }[];
  formUid: string;
}

export function ImageGallery({ images, formUid }: ImageGalleryProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (images.length === 0) return null;

  const selectedImage = images.find((img) => img.value === selected);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map(({ key, value }) => (
          <button
            key={key}
            onClick={() => setSelected(value)}
            className="group relative rounded-lg overflow-hidden border hover:shadow-md transition-shadow aspect-square"
          >
            <img
              src={getMediaUrl(formUid, value)}
              alt={key}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <span className="text-xs text-white truncate block">{key}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selected && (
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
              src={getMediaUrl(formUid, selected)}
              alt={selectedImage?.key || ""}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="text-center mt-3 text-white text-sm">
              {selectedImage?.key}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
