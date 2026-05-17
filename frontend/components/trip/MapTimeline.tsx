"use client";
import { useEffect, useRef, useState } from "react";
import type { Memory } from "@/lib/api";

interface Props {
  byDay: Record<number, Memory[]>;
  sortedDays: number[];
  places?: string[]; // from scrapbook ai_config
}

interface Pin {
  lat: number;
  lng: number;
  label: string;
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "User-Agent": "Wander-TravelJournal/1.0" } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

export default function MapTimeline({ byDay, sortedDays, places }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "no-data">("loading");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Collect GPS pins from EXIF data
      const gpsPins: Pin[] = [];
      for (const day of sortedDays) {
        const mems = byDay[day] ?? [];
        const geoMems = mems.filter(m => {
          const meta = m.ai_metadata as Record<string, unknown>;
          return typeof meta?.gps_lat === "number" && typeof meta?.gps_lng === "number";
        });
        if (geoMems.length === 0) continue;
        const lat = geoMems.reduce((s, m) => s + (m.ai_metadata as Record<string, number>).gps_lat, 0) / geoMems.length;
        const lng = geoMems.reduce((s, m) => s + (m.ai_metadata as Record<string, number>).gps_lng, 0) / geoMems.length;
        gpsPins.push({ lat, lng, label: `Day ${day}` });
      }

      // 2. If no GPS, geocode AI-extracted places
      let locationPins: Pin[] = gpsPins;
      if (gpsPins.length === 0 && places && places.length > 0) {
        const results: Pin[] = [];
        for (const place of places.slice(0, 8)) { // cap at 8 to avoid rate limits
          if (cancelled) return;
          const coords = await geocode(place);
          if (coords) results.push({ ...coords, label: place });
          await new Promise(r => setTimeout(r, 350)); // Nominatim rate limit: 1 req/sec
        }
        locationPins = results;
      }

      if (cancelled || locationPins.length === 0) {
        setStatus("no-data");
        return;
      }

      // 3. Also try location_hint from photo metadata as last resort
      if (locationPins.length === 0) {
        const hints = new Set<string>();
        for (const day of sortedDays) {
          for (const m of byDay[day] ?? []) {
            const hint = (m.ai_metadata as Record<string, unknown>)?.location_hint as string | null;
            if (hint && hint !== "null") hints.add(hint);
          }
        }
        for (const hint of hints) {
          if (cancelled) return;
          const coords = await geocode(hint);
          if (coords) locationPins.push({ ...coords, label: hint });
          await new Promise(r => setTimeout(r, 350));
        }
      }

      if (cancelled || locationPins.length === 0) {
        setStatus("no-data");
        return;
      }

      if (!containerRef.current) return;
      setStatus("ready");

      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (containerRef.current as any)._leaflet_map;
      if (existing) existing.remove();

      const map = L.map(containerRef.current).fitBounds(
        L.latLngBounds(locationPins.map(p => [p.lat, p.lng])),
        { padding: [40, 40] }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (containerRef.current as any)._leaflet_map = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      if (locationPins.length > 1) {
        L.polyline(locationPins.map(p => [p.lat, p.lng] as [number, number]), {
          color: "#5a7a40", weight: 2.5, dashArray: "6 4", opacity: 0.7,
        }).addTo(map);
      }

      locationPins.forEach((pin, i) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:linear-gradient(135deg,#7aaa60,#4e8040);
            border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-size:11px;font-weight:700;line-height:1;text-align:center;
          ">${i + 1}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -20],
        });
        L.marker([pin.lat, pin.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${pin.label}</b>`);
      });
    }

    init();
    return () => {
      cancelled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (containerRef.current as any)?._leaflet_map?.remove();
    };
  }, [byDay, sortedDays, places]);

  if (status === "no-data") return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-border" style={{ height: 280, position: "relative" }}>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/40 z-10 text-sm text-muted-foreground">
          Locating places on map…
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
