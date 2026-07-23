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
      const validPoints = parcelle.points.filter(
        (p) => p != null && typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng)
      );
      if (validPoints.length === 0) return;

      if (validPoints.length >= 3) {
        const latlngs = validPoints.map((p) => [p.lat, p.lng] as L.LatLngExpression);
        const polygon = L.polygon(latlngs, {
          color,
          fillColor: color,
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(map);

        const first = validPoints[0];
        const coordsStr = `${first.lat.toFixed(6)}, ${first.lng.toFixed(6)}`;

        const popupContent = parcelle.submissionId
          ? `<div style="min-width:200px;font-family:system-ui,sans-serif">
              <div style="font-weight:600;color:${color};font-size:14px;margin-bottom:4px">${parcelle.name}</div>
              ${parcelle.submitDate ? `<div style="font-size:11px;color:#666">📅 ${parcelle.submitDate}</div>` : ""}
              ${parcelle.commune ? `<div style="font-size:11px;color:#666">📍 ${parcelle.commune}</div>` : ""}
              <hr style="margin:6px 0;border:none;border-top:1px solid #eee" />
              <div style="font-size:11px;color:#333;font-family:monospace">
                ${latlngs.map((ll, idx) => {
                  const lat = Array.isArray(ll) ? ll[0] : (ll as L.LatLng).lat;
                  const lng = Array.isArray(ll) ? ll[1] : (ll as L.LatLng).lng;
                  return `Point ${idx + 1} : ${typeof lat === "number" ? lat.toFixed(6) : lat}, ${typeof lng === "number" ? lng.toFixed(6) : lng}`;
                }).join("<br/>")}
              </div>
              <div style="font-size:11px;color:#999;margin-top:4px">${validPoints.length} points · #${parcelle.submissionId}</div>
            </div>`
          : `<div style="min-width:200px;font-family:system-ui,sans-serif">
              <strong style="color:${color}">${parcelle.name}</strong><br/>
              <span style="font-size:11px;color:#333;font-family:monospace">${coordsStr}</span><br/>
              <span style="font-size:12px;color:#666">${parcelle.points.length} points</span>
            </div>`;

        polygon.bindPopup(popupContent);

        // Tooltip au survol avec le nom et les coordonnées du premier point
        polygon.bindTooltip(
          `<div style="font-family:monospace;font-size:11px">${parcelle.name}<br/>${coordsStr}</div>`,
          { sticky: true, direction: "top" }
        );

        latlngs.forEach((ll) => bounds.extend(ll as L.LatLngExpression));
      } else if (validPoints.length === 2) {
        // 2 points = ligne (ne peut pas être un polygone valide, mais on peut tracer une polyligne)
        const latlngs = validPoints.map((p) => [p.lat, p.lng] as L.LatLngExpression);
        const line = L.polyline(latlngs, {
          color,
          weight: 3,
          dashArray: "6, 4",
        }).addTo(map);

        const coordsHtml = validPoints
          .map((p, idx) => `Point ${idx + 1} : ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`)
          .join("<br/>");

        const popupContent = parcelle.submissionId
          ? `<div style="min-width:200px;font-family:system-ui,sans-serif">
              <div style="font-weight:600;color:${color};font-size:14px;margin-bottom:4px">${parcelle.name}</div>
              ${parcelle.submitDate ? `<div style="font-size:11px;color:#666">📅 ${parcelle.submitDate}</div>` : ""}
              ${parcelle.commune ? `<div style="font-size:11px;color:#666">📍 ${parcelle.commune}</div>` : ""}
              <hr style="margin:6px 0;border:none;border-top:1px solid #eee" />
              <div style="font-size:11px;color:#333;font-family:monospace">${coordsHtml}</div>
              <div style="font-size:11px;color:#999;margin-top:4px">2 points · ligne · #${parcelle.submissionId}</div>
            </div>`
          : `<div style="min-width:200px">
              <strong style="color:${color}">${parcelle.name}</strong><br/>
              <span style="font-size:11px;color:#333;font-family:monospace">${coordsHtml}</span>
            </div>`;

        line.bindPopup(popupContent);
        line.bindTooltip(
          `<div style="font-family:monospace;font-size:11px">${parcelle.name}</div>`,
          { sticky: true }
        );

        latlngs.forEach((ll) => bounds.extend(ll as L.LatLngExpression));
      } else if (validPoints.length === 1) {
        const p = validPoints[0];
        if (p == null || typeof p.lat !== "number") return;
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 8,
          fillColor: color,
          color: "#fff",
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map);

        const coordsStr = `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

        const popupContent = parcelle.submissionId
          ? `<div style="min-width:200px;font-family:system-ui,sans-serif">
              <strong style="color:${color};font-size:14px">${parcelle.name}</strong>
              ${parcelle.submitDate ? `<br/><span style="font-size:11px;color:#666">📅 ${parcelle.submitDate}</span>` : ""}
              ${parcelle.commune ? `<br/><span style="font-size:11px;color:#666">📍 ${parcelle.commune}</span>` : ""}
              <hr style="margin:6px 0;border:none;border-top:1px solid #eee" />
              <div style="font-size:12px;color:#333;font-family:monospace">📍 ${coordsStr}</div>
              <div style="font-size:11px;color:#999;margin-top:4px">#${parcelle.submissionId}</div>
            </div>`
          : `<div style="min-width:150px;font-family:system-ui,sans-serif;text-align:center">
              <strong style="color:${color}">${parcelle.name}</strong><br/>
              <span style="font-size:12px;color:#333;font-family:monospace">📍 ${coordsStr}</span>
            </div>`;

        marker.bindPopup(popupContent);

        // Tooltip au survol
        marker.bindTooltip(
          `<div style="font-family:monospace;font-size:11px">${coordsStr}</div>`,
          { sticky: true, direction: "top", offset: [0, -10] }
        );

        bounds.extend([p.lat, p.lng]);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [parcelles]);

  return <div ref={mapRef} style={{ height, width: "100%" }} className="rounded-lg z-0" />;
}
