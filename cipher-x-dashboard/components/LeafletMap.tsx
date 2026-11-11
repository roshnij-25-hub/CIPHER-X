"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Known OSCD satellite change detection locations for reference markers
const SENTINEL_LOCATIONS = [
  { lat: 48.8566, lng: 2.3522, name: "Paris, France", type: "Urban" },
  { lat: 51.5074, lng: -0.1278, name: "London, UK", type: "Urban" },
  { lat: 40.7128, lng: -74.006, name: "New York, USA", type: "Industrial" },
  { lat: 25.2048, lng: 55.2708, name: "Dubai, UAE", type: "Construction" },
  { lat: 22.3964, lng: 114.1095, name: "Hong Kong", type: "Coastal" },
  { lat: -23.5505, lng: -46.6333, name: "São Paulo, Brazil", type: "Deforestation" },
  { lat: 37.7749, lng: -122.4194, name: "San Francisco, USA", type: "Urban" },
  { lat: 55.7558, lng: 37.6173, name: "Moscow, Russia", type: "Industrial" },
];

export default function LeafletMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    // Fix default marker icons for webpack
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    // Dark satellite tile layer
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "© Esri | Sentinel-2 Visualization Mode",
        maxZoom: 18,
      }
    ).addTo(map);

    // Custom cyan pulse marker for known locations
    const pulseIcon = L.divIcon({
      html: `
        <div style="position:relative;width:20px;height:20px;">
          <div style="
            position:absolute;inset:0;border-radius:50%;
            background:rgba(34,211,238,0.8);
            animation:pulse 2s ease-in-out infinite;
            box-shadow:0 0 10px #22d3ee;
          "></div>
          <div style="
            position:absolute;inset:5px;border-radius:50%;
            background:#22d3ee;
          "></div>
        </div>
        <style>
          @keyframes pulse {
            0%,100%{transform:scale(1);opacity:0.7}
            50%{transform:scale(1.8);opacity:0.2}
          }
        </style>
      `,
      className: "",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    SENTINEL_LOCATIONS.forEach((loc) => {
      const marker = L.marker([loc.lat, loc.lng], { icon: pulseIcon }).addTo(map);
      marker.bindPopup(
        `<div style="background:#0e1626;color:#f1f5f9;border:1px solid rgba(34,211,238,0.3);border-radius:8px;padding:10px 14px;font-family:system-ui,sans-serif;min-width:160px">
          <div style="font-size:12px;font-weight:700;color:#22d3ee;margin-bottom:4px">${loc.name}</div>
          <div style="font-size:10px;color:#64748b">Sentinel-2 Monitoring Zone</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:4px">Type: ${loc.type}</div>
        </div>`,
        { maxWidth: 220 }
      );
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-[280px] rounded-2xl overflow-hidden border border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.07)]"
      style={{ zIndex: 1 }}
    />
  );
}
