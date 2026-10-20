"use client";
import { useEffect, useRef } from "react";
import type { GeoVenue } from "@/lib/api";
import { formatDistance } from "@/lib/format";

export function MapView({
  lat,
  lon,
  venues,
}: {
  lat: number;
  lon: number;
  venues: GeoVenue[];
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove?: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !divRef.current || mapRef.current) return;
      const m = L.map(divRef.current, { zoomControl: true }).setView(
        [lat, lon],
        14,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(m);
      const pin = L.divIcon({
        className: "hr-marker-wrap",
        html: '<span class="campaign-pin" aria-hidden="true">★</span>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      L.marker([lat, lon], { icon: pin }).addTo(m).bindPopup("Campaign location");
      for (const v of venues) {
        if (v.lat == null || v.lon == null) continue;
        L.marker([v.lat, v.lon])
          .addTo(m)
          .bindPopup(
            `${v.name}<br/>${v.category}${v.distance_m != null ? `<br/>${formatDistance(v.distance_m)} away` : ""}`,
          );
      }
      if (cancelled) {
        m.remove();
        return;
      }
      mapRef.current = m;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, [lat, lon, venues]);

  return (
    <div>
      <div
        ref={divRef}
        role="application"
        aria-label={`Map of campaign area at ${lat.toFixed(3)}, ${lon.toFixed(3)} with ${venues.length} candidate venues. See the venue list below for a text alternative.`}
        className="h-[320px] w-full"
        tabIndex={0}
      />
      <p className="mt-1 font-mono text-[12px] text-secondary">
        Tiles © OpenStreetMap contributors · Venues © OpenStreetMap contributors
        (ODbL)
      </p>
    </div>
  );
}
