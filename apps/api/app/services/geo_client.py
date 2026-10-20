"""Geographic adapter: OSM Nominatim (geocode) + Overpass (venues).

Choice justification (documented in README):
- Open data (ODbL), no API key for demo, clear attribution + usage policy.
- Nominatim: max ~1 req/s, identify with User-Agent, cache results.
- Overpass: community venues (amenity=clinic|pharmacy|community_centre,
  leisure, shop, place_of_worship, amenity=school) — verified, neutral
  venue data, NOT trust or footfall data.
- Map tiles: OSM standard / CARTO light via Leaflet with attribution.
- Alternatives (Google/Mapbox) need billing keys; rejected for hackathon demo.
"""

from __future__ import annotations

import asyncio
import time

import httpx

from app.models import GeocodeResult, GeoVenue, Provenance

# Short in-memory TTL cache: Nominatim policy asks clients to cache, and
# Qloo/Overpass terms discourage aggressive re-querying.
_GEOCODE_CACHE: dict[str, tuple[float, GeocodeResult]] = {}
GEOCODE_TTL_S = 24 * 3600
_last_nominatim_call = 0.0

NOMINATIM = "https://nominatim.openstreetmap.org"
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = "HealthReachAI/0.1 hackathon-demo"
# Nominatim blocks some HTTP/2 fingerprints; use HTTP/1.1 + full headers per usage policy.
_GEO_HEADERS = {
    "User-Agent": UA,
    "Referer": "http://localhost:3000/",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}


_SUGGEST_CACHE: dict[str, tuple[float, list[dict]]] = {}
SUGGEST_TTL_S = 3600  # shorter than geocode: suggestions follow user typing


async def _throttle_and_open() -> httpx.AsyncClient:
    """Shared Nominatim throttle (1 req/s policy) + the proven header set."""
    global _last_nominatim_call
    wait = 1.1 - (time.time() - _last_nominatim_call)
    if wait > 0:
        await asyncio.sleep(wait)
    _last_nominatim_call = time.time()
    return httpx.AsyncClient(timeout=12.0, headers=_GEO_HEADERS, http1=True)


async def suggest_locations(query: str, limit: int = 5) -> list[dict]:
    """Nominatim autocomplete for the brief form. Cached one hour so typing
    replay doesn't re-hit the open endpoint.

    Returns list of {display_name, lat, lon, type}. Raises on service failure;
    router maps failures to an honest, calm state.

    US-biased: countrycodes=us, accept-language=en-US for US-focused product.
    """
    q = query.strip()
    if len(q) < 3:
        return []
    key = q.lower()
    cached = _SUGGEST_CACHE.get(key)
    if cached and time.time() - cached[0] < SUGGEST_TTL_S:
        return cached[1]
    async with await _throttle_and_open() as client:
        r = await client.get(
            NOMINATIM + "/search",
            params={
                "q": q,
                "format": "jsonv2",
                "limit": limit,
                "countrycodes": "us",
                "accept-language": "en-US",
            },
        )
        r.raise_for_status()
        items = r.json()
    out = [
        {
            "display_name": str(it.get("display_name", "")),
            "lat": float(it["lat"]),
            "lon": float(it["lon"]),
            "type": str(it.get("type", "")),
        }
        for it in items
        if it.get("lat") and it.get("lon")
    ]
    _SUGGEST_CACHE[key] = (time.time(), out)
    return out


async def reverse_geocode(lat: float, lon: float) -> GeocodeResult:
    """Name a picked map point (used by click-to-choose on the brief map).
    Same 24h cache + throttle as geocode."""
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("That map point is outside the map range.")
    key = f"rev:{round(lat, 4)}:{round(lon, 4)}"
    cached = _GEOCODE_CACHE.get(key)
    if cached and time.time() - cached[0] < GEOCODE_TTL_S:
        return cached[1]
    async with await _throttle_and_open() as client:
        r = await client.get(
            NOMINATIM + "/reverse",
            params={
                "lat": f"{lat:.5f}",
                "lon": f"{lon:.5f}",
                "format": "jsonv2",
                "zoom": 18,
                "addressdetails": 0,
            },
        )
        r.raise_for_status()
        data = r.json()
    if not data or data.get("error") or not data.get("display_name"):
        raise ValueError("We couldn't name that map point.")
    result = GeocodeResult(
        display_name=str(data["display_name"]),
        lat=float(data.get("lat", lat)),
        lon=float(data.get("lon", lon)),
        provenance=Provenance.GEO,
    )
    _GEOCODE_CACHE[key] = (time.time(), result)
    return result


async def geocode(location_text: str) -> GeocodeResult:
    key = location_text.strip().lower()
    cached = _GEOCODE_CACHE.get(key)
    if cached and time.time() - cached[0] < GEOCODE_TTL_S:
        return cached[1]
    # Nominatim policy: absolute max 1 req/s — throttle client-side (non-blocking).
    global _last_nominatim_call
    wait = 1.1 - (time.time() - _last_nominatim_call)
    if wait > 0:
        await asyncio.sleep(wait)
    async with httpx.AsyncClient(timeout=12.0, headers=_GEO_HEADERS, http1=True) as client:
        r = await client.get(
            NOMINATIM + "/search",
            params={"q": location_text, "format": "jsonv2", "limit": 1},
        )
        r.raise_for_status()
        items = r.json()
    _last_nominatim_call = time.time()
    if not items:
        raise ValueError(f"No geocode match for '{location_text}'")
    it = items[0]
    result = GeocodeResult(
        display_name=str(it.get("display_name", location_text)),
        lat=float(it["lat"]),
        lon=float(it["lon"]),
        provenance=Provenance.GEO,
    )
    _GEOCODE_CACHE[key] = (time.time(), result)
    return result


async def nearby_venues(
    lat: float, lon: float, radius_m: int = 1500
) -> tuple[list[GeoVenue], str, str]:
    """Returns (venues, status, note). Status in ok|thin|unavailable.

    `unavailable` means the directory itself failed (honest failure state);
    `thin` means it answered but mapped few/no community venues in range.
    """
    query = f"""[out:json][timeout:20];
(
  node["amenity"~"^(clinic|pharmacy|doctors|hospital|community_centre|library|school)$"](around:{radius_m},{lat},{lon});
  node["leisure"~"^(park|playground|community_centre)$"](around:{radius_m},{lat},{lon});
  node["shop"~"^(mall|marketplace)$"](around:{radius_m},{lat},{lon});
  node["building"~"^(school|community|public)$"](around:{radius_m},{lat},{lon});
);
out 20;"""
    last_err: Exception | None = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            # Per-endpoint timeout is deliberately short: failover beats
            # waiting, and the browser client aborts at 45s.
            async with httpx.AsyncClient(timeout=10.0, headers=_GEO_HEADERS, http1=True) as client:
                r = await client.post(endpoint, data={"data": query})
                r.raise_for_status()
                data = r.json()
            break
        except Exception as e:
            last_err = e
            continue
    else:
        import logging

        logging.getLogger("healthreach.geo").warning(
            "Overpass lookup failed on all endpoints: %r", last_err
        )
        return [], "unavailable", (
            "The map directory didn't respond, so no nearby places could be listed. "
            "What you saved is safe — try again in a moment."
        )

    venues: list[GeoVenue] = []
    for el in (data.get("elements") or [])[:20]:
        tags = el.get("tags") or {}
        name = tags.get("name") or tags.get("amenity") or tags.get("leisure") or "Unnamed venue"
        cat = tags.get("amenity") or tags.get("leisure") or tags.get("shop") or "community"
        addr_parts = [tags.get(k) for k in ("addr:road", "addr:suburb", "addr:city") if tags.get(k)]
        venues.append(
            GeoVenue(
                name=str(name)[:120],
                category=str(cat)[:80],
                address=", ".join(addr_parts) or None,
                lat=el.get("lat"),
                lon=el.get("lon"),
                provenance=Provenance.GEO,
                needs_verification=True,
            )
        )
    note = "" if venues else "Few mapped community venues in this radius."
    status = "ok" if venues else "thin"
    return venues, status, note
