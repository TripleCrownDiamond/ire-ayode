"use client";

import dynamic from "next/dynamic";

// Dynamic import avec ssr:false — Leaflet a besoin de 'window' qui n'existe pas en SSR
const ParcelMap = dynamic(
  () => import("./parcel-map").then((mod) => mod.ParcelMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full min-h-[200px] rounded-lg bg-muted animate-pulse" />
    ),
  }
);

export { ParcelMap };
export type { Parcelle } from "./parcel-map";
