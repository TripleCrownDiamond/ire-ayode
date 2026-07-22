"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { Point } from "@/lib/geo";

interface Parcelle {
  id: string;
  name: string;
  points: Point[];
  color?: string;
  /** ID de la soumission associée (optionnel) */
  submissionId?: string;
  /** Date de soumission (optionnel) */
  submitDate?: string;
  /** Commune (optionnel) */
  commune?: string;
}

interface ParcelMapProps {
  parcelles: Parcelle[];
  center?: [number, number];
  zoom?: number;
  height?: string;
}

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04",
  "#9333ea", "#ea580c", "#0891b2", "#be185d",
];

export function ParcelMap({
  parcelles,
  center = [8.05, 2.50],
  zoom = 13,
  height = "500px",
}: ParcelMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current).setView(center, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const bounds = L.latLngBounds([]);

    parcelles.forEach((parcelle, i) => {
      const color = parcelle.color || COLORS[i % COLORS.length];

      if (parcelle.points.length >= 3) {
        const latlngs = parcelle.points.map((p) => [p.lat, p.lng] as L.LatLngExpression);
        const polygon = L.polygon(latlngs, {
          color,
          fillColor: color,
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(map);

        const popupContent = parcelle.submissionId
          ? `<div style="min-width:180px;font-family:system-ui,sans-serif">
              <div style="font-weight:600;color:${color};font-size:14px;margin-bottom:4px">${parcelle.name}</div>
              ${parcelle.submitDate ? `<div style="font-size:11px;color:#666">📅 ${parcelle.submitDate}</div>` : ""}
              ${parcelle.commune ? `<div style="font-size:11px;color:#666">📍 ${parcelle.commune}</div>` : ""}
              <div style="font-size:11px;color:#999;margin-top:2px">${parcelle.points.length} points · #${parcelle.submissionId}</div>
            </div>`
          : `<div style="min-width:150px">
              <strong style="color:${color}">${parcelle.name}</strong><br/>
              <span style="font-size:12px;color:#666">${parcelle.points.length} points</span>
            </div>`;

        polygon.bindPopup(popupContent);

        latlngs.forEach((ll) => bounds.extend(ll as L.LatLngExpression));
      } else if (parcelle.points.length === 1) {
        const p = parcelle.points[0];
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 8,
          fillColor: color,
          color: "#fff",
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map);

        const popupContent = parcelle.submissionId
          ? `<div style="min-width:150px;font-family:system-ui,sans-serif">
              <strong style="color:${color}">${parcelle.name}</strong>
              ${parcelle.submitDate ? `<br/><span style="font-size:11px;color:#666">📅 ${parcelle.submitDate}</span>` : ""}
              ${parcelle.commune ? `<br/><span style="font-size:11px;color:#666">📍 ${parcelle.commune}</span>` : ""}
            </div>`
          : `<strong>${parcelle.name}</strong>`;

        marker.bindPopup(popupContent);
        bounds.extend([p.lat, p.lng]);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [parcelles]);

  return <div ref={mapRef} style={{ height, width: "100%" }} className="rounded-lg z-0" />;
}
