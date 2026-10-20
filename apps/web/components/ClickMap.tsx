"use client";
import { useEffect, useRef, useState } from "react";
import { api, friendlyError } from "@/lib/api";
import { ProvenanceBadge } from "@/components/Provenance";

/** Click-to-choose map for the brief form (v2).
 *
 * Clicking places a pin and reverse-geocodes it (OpenStreetMap) so the
 * location field fills itself. The typed field stays the source of truth;
 * the map is a helper and always has a text alternative around it.
 *
 * v2 enhancements:
 * - US-focused initial viewport (continental US center, zoom 4)
 * - Accessible error handling for reverse geocode failures
 * - Keyboard-accessible map interactions
 * - OSM attribution always visible
 * - Sync with LocationAutocomplete (text field = source of truth)
 */
export function ClickMap({
  lat,
  lon,
  onPick,
}: {
  lat: number | null;
  lon: number | null;
  onPick: (label: string, lat: number, lon: number) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove?: () => void } | null>(null);
  const markerRef = useRef<{ setLatLng?: (p: [number, number]) => void; remove?: () => void } | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // US continental center for initial viewport
  const US_CENTER: [number, number] = [39.8283, -98.5795];
  const US_ZOOM = 4;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !divRef.current || mapRef.current) return;
      const center: [number, number] = lat != null && lon != null ? [lat, lon] : US_CENTER;
      const zoom = lat != null && lon != null ? 13 : US_ZOOM;
      const m = L.map(divRef.current, { zoomControl: true }).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)',
        maxZoom: 19,
      }).addTo(m);
      if (lat != null && lon != null) {
        const mk = L.marker([lat, lon]).addTo(m);
        markerRef.current = mk as unknown as { remove?: () => void };
      }
      m.on("click", async (e: { latlng: { lat: number; lng: number } }) => {
        const { lat: clat, lng: clon } = e.latlng;
        if (!markerRef.current) {
          markerRef.current = L.marker([clat, clon]).addTo(m) as unknown as never;
        } else {
          markerRef.current.setLatLng?.([clat, clon]);
        }
        setBusy(true);
        setMsg("");
        try {
          const r = await api.geoReverse(clat, clon);
          if (r.status === "ok" && r.label) {
            setMsg(`Picked: ${r.label}`);
            pickRef.current(r.label, r.lat, r.lon);
          } else if (r.status === "thin") {
            setMsg(`Picked location, but couldn't name it precisely — type the place instead.`);
          } else {
            setMsg(r.note || "Could not name that map point — type the place instead.");
          }
        } catch (err) {
          setMsg(friendlyError(err));
        } finally {
          setBusy(false);
        }
      });
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
      markerRef.current = null;
    };
    // Init once: re-running would double-init the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div
        ref={divRef}
        role="application"
        aria-label="Map to pick the campaign location by tapping a spot. A text field above is the source of truth — typing the place always works."
        className="h-[220px] w-full"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            // Focus the map for keyboard navigation
            divRef.current?.focus();
          }
        }}
      />
      <p className="mt-1 font-mono text-[12px] text-secondary">
        Click the map to choose a spot · © OpenStreetMap contributors (ODbL)
      </p>
      <p aria-live="polite" className="mt-1 min-h-[20px] text-[13px]">
        {busy ? "Naming that spot…" : msg}
      </p>
      {msg.startsWith("Picked:") && (
        <p className="mt-1 text-[13px]">
          <ProvenanceBadge kind="geo" /> place name from the map point.
        </p>
      )}
    </div>
  );
}
