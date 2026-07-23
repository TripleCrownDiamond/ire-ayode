"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { polygonAreaHa, type Point } from "@/lib/geo";

export interface Parcelle {
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
  /** Lien vers la fiche détaillée (optionnel) */
  href?: string;
  /** Superficie calculée ou saisie (optionnel) */
  area?: string;
}

interface ParcelMapProps {
  parcelles: Parcelle[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  /** Identifiant de la parcelle à cadrer/ouvrir (piloté par la liste latérale) */
  focusId?: string | null;
  /** Affiche le sélecteur de fond de carte (satellite / plan) */
  showLayerControl?: boolean;
}

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04",
  "#9333ea", "#ea580c", "#0891b2", "#be185d",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPopup(parcelle: Parcelle, color: string, points: Point[]): string {
  const name = escapeHtml(parcelle.name);
  const area = parcelle.area || (points.length >= 3 ? `${polygonAreaHa(points)?.toFixed(2)} ha` : null);
  const coords = points
    .slice(0, 8)
    .map((p, i) => `Point ${i + 1} : ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`)
    .join("<br/>");
  const more = points.length > 8 ? `<br/>… +${points.length - 8} point(s)` : "";

  const shape =
    points.length >= 3 ? "polygone" : points.length === 2 ? "ligne" : "point GPS";

  return `<div style="min-width:220px;font-family:system-ui,sans-serif">
    <div style="font-weight:600;color:${color};font-size:14px;margin-bottom:4px">${name}</div>
    ${parcelle.submitDate ? `<div style="font-size:11px;color:#666">📅 ${escapeHtml(parcelle.submitDate)}</div>` : ""}
    ${parcelle.commune ? `<div style="font-size:11px;color:#666">📍 ${escapeHtml(parcelle.commune)}</div>` : ""}
    ${area ? `<div style="font-size:11px;color:#666">📐 ${escapeHtml(String(area))}</div>` : ""}
    <hr style="margin:6px 0;border:none;border-top:1px solid #eee" />
    <div style="font-size:11px;color:#333;font-family:monospace">${coords}${more}</div>
    <div style="font-size:11px;color:#999;margin-top:4px">${points.length} point(s) · ${shape}${
      parcelle.submissionId ? ` · #${escapeHtml(parcelle.submissionId)}` : ""
    }</div>
    ${
      parcelle.href
        ? `<a href="${escapeHtml(parcelle.href)}" style="display:inline-block;margin-top:8px;font-size:12px;color:${color};font-weight:500;text-decoration:none">Ouvrir la fiche →</a>`
        : ""
    }
  </div>`;
}

export function ParcelMap({
  parcelles,
  center = [8.05, 2.5],
  zoom = 13,
  height = "500px",
  focusId = null,
  showLayerControl = true,
}: ParcelMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  /** Couche unique regroupant les dessins : vidée à chaque mise à jour pour
   *  éviter l'empilement des anciennes parcelles lors d'un changement de filtre. */
  const layerGroup = useRef<L.FeatureGroup | null>(null);
  const layersById = useRef<Map<string, L.Layer>>(new Map());
  const hasFitted = useRef(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });

    // Vue satellite : indispensable pour vérifier les limites d'une parcelle
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "&copy; Esri, Maxar, Earthstar Geographics", maxZoom: 19 }
    );

    const labels = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; CARTO", maxZoom: 19 }
    );

    const satelliteLabelled = L.layerGroup([satellite, labels]);

    osm.addTo(map);

    if (showLayerControl) {
      L.control
        .layers(
          { Plan: osm, "Satellite": satelliteLabelled },
          {},
          { position: "topright", collapsed: true }
        )
        .addTo(map);
    }

    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

    layerGroup.current = L.featureGroup().addTo(map);
    mapInstance.current = map;

    // Leaflet calcule mal ses dimensions quand le conteneur est monté caché
    // (onglets, panneaux repliés) : on force un recalcul après le premier rendu.
    const invalidate = () => map.invalidateSize();
    const raf = requestAnimationFrame(invalidate);
    window.addEventListener("resize", invalidate);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(invalidate) : null;
    if (observer && mapRef.current) observer.observe(mapRef.current);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", invalidate);
      observer?.disconnect();
      map.remove();
      mapInstance.current = null;
      layerGroup.current = null;
      layersById.current.clear();
      hasFitted.current = false;
    };
    // Le point de départ ne doit pas recréer la carte à chaque rendu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clé stable : évite de redessiner quand le parent recrée le tableau à l'identique
  const signature = useMemo(
    () =>
      parcelles
        .map((p) => `${p.id}:${p.color || ""}:${p.points.length}`)
        .join("|"),
    [parcelles]
  );

  useEffect(() => {
    const map = mapInstance.current;
    const group = layerGroup.current;
    if (!map || !group) return;

    // Purge des dessins précédents — sans cela, filtrer la carte laissait
    // les anciennes parcelles affichées par-dessus les nouvelles.
    group.clearLayers();
    layersById.current.clear();

    const bounds = L.latLngBounds([]);

    parcelles.forEach((parcelle, i) => {
      const color = parcelle.color || COLORS[i % COLORS.length];
      const validPoints = parcelle.points.filter(
        (p) =>
          p != null &&
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          !isNaN(p.lat) &&
          !isNaN(p.lng) &&
          Math.abs(p.lat) <= 90 &&
          Math.abs(p.lng) <= 180
      );
      if (validPoints.length === 0) return;

      const latlngs = validPoints.map((p) => [p.lat, p.lng] as L.LatLngExpression);
      const popup = buildPopup(parcelle, color, validPoints);
      let layer: L.Path;

      if (validPoints.length >= 3) {
        layer = L.polygon(latlngs, {
          color,
          fillColor: color,
          fillOpacity: 0.25,
          weight: 2,
        });
      } else if (validPoints.length === 2) {
        layer = L.polyline(latlngs, { color, weight: 3, dashArray: "6, 4" });
      } else {
        const p = validPoints[0];
        layer = L.circleMarker([p.lat, p.lng], {
          radius: 8,
          fillColor: color,
          color: "#fff",
          weight: 2,
          fillOpacity: 0.9,
        });
      }

      layer.addTo(group);
      layer.bindPopup(popup, { maxWidth: 320, autoPan: true });
      layer.bindTooltip(
        `<div style="font-family:system-ui,sans-serif;font-size:11px"><strong>${escapeHtml(
          parcelle.name
        )}</strong>${
          parcelle.commune ? `<br/>${escapeHtml(parcelle.commune)}` : ""
        }</div>`,
        { sticky: true, direction: "top" }
      );

      // Retour visuel au survol
      const baseWeight = validPoints.length === 1 ? 2 : validPoints.length === 2 ? 3 : 2;
      layer.on("mouseover", () => layer.setStyle({ weight: baseWeight + 2, fillOpacity: 0.4 }));
      layer.on("mouseout", () =>
        layer.setStyle({ weight: baseWeight, fillOpacity: validPoints.length === 1 ? 0.9 : 0.25 })
      );

      layersById.current.set(parcelle.id, layer);
      latlngs.forEach((ll) => bounds.extend(ll));
    });

    if (bounds.isValid()) {
      // Recadrage animé sur les mises à jour, instantané au premier rendu
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 17,
        animate: hasFitted.current,
      });
      hasFitted.current = true;
    }
    // `signature` résume le contenu de `parcelles`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Recadrage sur la parcelle sélectionnée dans la liste
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !focusId) return;
    const layer = layersById.current.get(focusId);
    if (!layer) return;

    if ("getBounds" in layer && typeof (layer as L.Polygon).getBounds === "function") {
      const b = (layer as L.Polygon).getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [60, 60], maxZoom: 18 });
    } else if ("getLatLng" in layer) {
      map.setView((layer as L.CircleMarker).getLatLng(), 17, { animate: true });
    }
    (layer as L.Path).openPopup();
  }, [focusId]);

  return <div ref={mapRef} style={{ height, width: "100%" }} className="rounded-lg z-0" />;
}
