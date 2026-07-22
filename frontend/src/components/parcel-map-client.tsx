"use client";

import dynamic from "next/dynamic";

// Dynamic import avec ssr:false — Leaflet a besoin de 'window' qui n'existe pas en SSR
const ParcelMap = dynamic(
  () => import("./parcel-map").then((mod) => mod.ParcelMap),
  { ssr: false }
);

export { ParcelMap };
