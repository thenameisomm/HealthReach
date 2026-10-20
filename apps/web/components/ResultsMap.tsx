"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker, LayerGroup } from "leaflet";
import type { GeoVenue } from "@/lib/api";
import { formatDistance } from "@/lib/format";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function categoryGlyph(category: string): string {
  const c = category.toLowerCase();
  if (/clinic|health|fqhc|pharmacy|hospital/.test(c)) return "+";
  if (/park|recreation/.test(c)) return "▲";
  if (/school|college|university/.test(c)) return "▣";
  if (/worship|church|mosque|temple/.test(c)) return "⌂";
  return "●";
}

type MappedVenue = GeoVenue & { lat: number; lon: number };
type Cluster = { lat: number; lon: number; venues: MappedVenue[] };

function groupVenues(venues: MappedVenue[], zoom: number): Cluster[] {
  if (venues.length <= 10 || zoom >= 17) {
    return venues.map((v) => ({ lat: v.lat, lon: v.lon, venues: [v] }));
  }
  const cell = 0.08 / Math.pow(2, Math.max(0, zoom - 12));
  const buckets = new Map<string, Cluster>();
  for (const v of venues) {
    const key = `${Math.floor(v.lat / cell)}:${Math.floor(v.lon / cell)}`;
    const found = buckets.get(key);
    if (found) {
      found.venues.push(v);
      found.lat = (found.lat * (found.venues.length - 1) + v.lat) / found.venues.length;
      found.lon = (found.lon * (found.venues.length - 1) + v.lon) / found.venues.length;
    } else {
      buckets.set(key, { lat: v.lat, lon: v.lon, venues: [v] });
    }
  }
  return [...buckets.values()];
}

function popupHtml(v: GeoVenue): string {
  return `
    <div class="venue-popup">
      <p class="venue-popup-name">${escapeHtml(v.name)}</p>
      <p>${escapeHtml(v.category)}</p>
      ${v.address ? `<p>${escapeHtml(v.address)}</p>` : ""}
      <p>${formatDistance(v.distance_m)} from the campaign area</p>
      <p class="venue-popup-verify">⚠ Visit and verify before use</p>
    </div>`;
}

export function ResultsMap({
  lat,
  lon,
  venues,
  demonstration = false,
}: {
  lat: number;
  lon: number;
  venues: GeoVenue[];
  demonstration?: boolean;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const selectedRef = useRef<CircleMarker | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showRadius, setShowRadius] = useState(false);
  const mapped = useMemo(
    () =>
      venues.filter(
        (v): v is MappedVenue =>
          typeof v.lat === "number" && typeof v.lon === "number",
      ),
    [venues],
  );
  const sorted = useMemo(
    () =>
      [...mapped].sort(
        (a, b) =>
          (a.distance_m ?? Number.MAX_SAFE_INTEGER) -
          (b.distance_m ?? Number.MAX_SAFE_INTEGER),
      ),
    [mapped],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !divRef.current || mapRef.current) return;
      const map = L.map(divRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([lat, lon], 14);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const campaignIcon = L.divIcon({
        className: "hr-marker-wrap",
        html: '<span class="campaign-pin" aria-hidden="true">★</span>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      L.marker([lat, lon], { icon: campaignIcon, title: "Campaign location" })
        .addTo(map)
        .bindPopup(
          `<strong>Campaign area</strong><br/>${demonstration ? "Illustrative sample location" : "Approximate search centre"}`,
        );

      const group = L.layerGroup().addTo(map);
      layerRef.current = group;

      function draw() {
        group.clearLayers();
        for (const cluster of groupVenues(sorted, map.getZoom())) {
          if (cluster.venues.length > 1) {
            const icon = L.divIcon({
              className: "hr-marker-wrap",
              html: `<span class="venue-cluster">${cluster.venues.length}</span>`,
              iconSize: [38, 38],
              iconAnchor: [19, 19],
            });
            L.marker([cluster.lat, cluster.lon], {
              icon,
              title: `${cluster.venues.length} candidate places`,
            })
              .addTo(group)
              .on("click", () => {
                map.flyTo(
                  [cluster.lat, cluster.lon],
                  Math.min(18, map.getZoom() + 2),
                );
              });
          } else {
            const venue = cluster.venues[0];
            const icon = L.divIcon({
              className: "hr-marker-wrap",
              html: `<span class="venue-marker">${categoryGlyph(venue.category)}</span>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });
            L.marker([venue.lat, venue.lon], {
              icon,
              title: venue.name,
            })
              .addTo(group)
              .bindPopup(popupHtml(venue));
          }
        }
      }
      draw();
      map.on("zoomend", draw);

      if (cancelled) {
        map.remove();
        mapRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      selectedRef.current = null;
    };
  }, [lat, lon, sorted, demonstration]);

  useEffect(() => {
    let stopped = false;
    (async () => {
      const map = mapRef.current;
      if (!map) return;
      const L = await import("leaflet");
      if (stopped || !mapRef.current) return;
      if (selectedRef.current) {
        selectedRef.current.remove();
        selectedRef.current = null;
      }
      if (selected == null) return;
      const venue = sorted[selected];
      if (!venue) return;
      selectedRef.current = L.circleMarker([venue.lat, venue.lon], {
        radius: 17,
        color: "#2563eb",
        weight: 3,
        fill: false,
      }).addTo(map);
      map.flyTo([venue.lat, venue.lon], Math.max(16, map.getZoom()), {
        duration: 0.4,
      });
    })();
    return () => {
      stopped = true;
    };
  }, [selected, sorted]);

  useEffect(() => {
    let added: CircleMarker | null = null;
    let stopped = false;
    (async () => {
      const map = mapRef.current;
      if (!map || !showRadius) return;
      const L = await import("leaflet");
      if (stopped || !mapRef.current) return;
      added = L.circle([lat, lon], {
        radius: 1609.34,
        color: "#2563eb",
        weight: 1,
        dashArray: "5 5",
        fillColor: "#2563eb",
        fillOpacity: 0.05,
      }).addTo(map);
    })();
    return () => {
      stopped = true;
      added?.remove();
    };
  }, [lat, lon, showRadius]);

  return (
    <section className="results-map-container" aria-labelledby="map-title">
      <div className="results-map-wrap">
        <h3 id="map-title" className="font-display text-[18px] font-semibold">
          Map of candidate places
        </h3>
        <p className="mt-1 text-[13px] text-secondary">
          The star is the campaign area. Other pins are candidate places from
          OpenStreetMap — none are approved. When there are more than 10, nearby
          pins group into numbered circles; zoom in or select from the list.
        </p>
        <div
          ref={divRef}
          role="presentation"
          aria-hidden="true"
          className="results-map mt-3 w-full"
        />
        <p className="mt-1 font-mono text-[12px] text-secondary">
          Tiles © OpenStreetMap contributors · Places © OpenStreetMap
          contributors (ODbL)
        </p>
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={showRadius}
            onChange={(e) => setShowRadius(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Show the 1-mile search area
            <span className="block text-[12px] text-secondary">
              This is the area we looked in — not an attendance estimate.
            </span>
          </span>
        </label>
      </div>

      <div className="venue-list" aria-label="Candidate places as a text list">
        <h3 className="font-display text-[18px] font-semibold">
          Places to evaluate ({sorted.length})
        </h3>
        {sorted.length === 0 ? (
          <p className="mt-2 text-[14px] text-secondary">
            No mapped places in this area. You can still use a site you already
            know, after checking access.
          </p>
        ) : (
          <ul className="venue-list-items mt-2">
            {sorted.map((v, i) => (
              <li key={`${v.lat}-${v.lon}-${i}`}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={selected === i}
                  className={`venue-list-button ${selected === i ? "is-selected" : ""}`}
                >
                  <span className="text-[14px] font-medium">{v.name}</span>
                  <span className="mt-0.5 block text-[12px] text-secondary">
                    {v.category}
                    {v.address ? ` · ${v.address}` : ""}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
                    <span>{formatDistance(v.distance_m)} away</span>
                    <span className="prov prov-geo">
                      <span aria-hidden="true">⚑</span> Visit and verify
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
