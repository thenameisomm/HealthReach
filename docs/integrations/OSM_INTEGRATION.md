# OSM Integration — HealthReach AI

## Purpose

HealthReach uses OpenStreetMap (OSM) for two purposes:
1. **Nominatim**: Geocoding (search, reverse, autocomplete) — converts location text to coordinates
2. **Overpass**: Community venue discovery — finds candidate venues near campaign location

**Critical boundary**: OSM provides **mapped places only**. It does NOT provide:
- Vetted or verified venues
- Footfall or visitation data
- Healthcare facility accreditation
- Community trust scores
- Venue capacity or suitability for health events

Every OSM-derived venue carries `needs_verification: true` and the badge **"Visit and verify before use"**.

## Why OSM (Not Google Maps / Mapbox)

| Factor | OSM | Google Maps | Mapbox |
|---|---|---|---|
| API Key Required | No | Yes (billing) | Yes (billing) |
| Cost | Free | Pay per request | Pay per request |
| Data License | ODbL (open) | Proprietary | Proprietary |
| Community Venues | Comprehensive | Good | Good |
| Hackathon Demo | Works offline | Needs billing setup | Needs billing setup |
| Attribution | Required (ODbL) | Required | Required |

**Decision**: OSM chosen for zero-cost demo accessibility and open data principles.

## Nominatim (Geocoding)

### Endpoints Used

| Function | Endpoint | Parameters |
|---|---|---|
| Search (geocode) | `GET /search` | `q`, `format=jsonv2`, `limit=1`, `countrycodes=us`, `accept-language=en-US` |
| Reverse geocode | `GET /reverse` | `lat`, `lon`, `format=jsonv2`, `zoom=18` |
| Autocomplete | `GET /search` | `q`, `format=jsonv2`, `limit=5`, `countrycodes=us` |

### Usage Policy Compliance

| Rule | Implementation |
|---|---|
| ≤ 1 req/s | Client-side throttle (`asyncio.sleep`) in `geo_client.py` |
| Identifying User-Agent | `HealthReachAI/0.1 hackathon-demo` + Referer header |
| HTTP/1.1 | `http1=True` in httpx client (avoids WAF blocks) |
| Cache results | 24h TTL in-memory cache (`_GEOCODE_CACHE`) |
| No autocomplete-against-API | Debounced frontend (300ms), 120-char cap |
| End-user-triggered only | No background/batch geocoding |

### Caching

```python
_GEOCODE_CACHE: dict[str, tuple[float, GeocodeResult]] = {}
GEOCODE_TTL_S = 24 * 3600  # 24 hours
_SUGGEST_CACHE: dict[str, tuple[float, list[dict]]] = {}
SUGGEST_TTL_S = 3600  # 1 hour
```

Keys: `location_text.lower()` for geocode, `query.lower()` for suggest, `rev:{lat:.4f}:{lon:.4f}` for reverse.

### Error Handling

| Error | User-Facing Message |
|---|---|
| No results | "No geocode match for '{location_text}'" |
| Service unavailable | "Location service temporarily unavailable" |
| Invalid coordinates | "That map point is outside the map range" |
| Reverse geocode fail | "We couldn't name that map point" |

### US-Focused Configuration (Planned)

```python
# Current: No country bias
# Planned: US bias for US-focused product
params = {
    "countrycodes": "us",
    "accept-language": "en-US",
    # ... other params
}
```

## Overpass (Venue Discovery)

### Endpoint Failover

```python
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
```

Sequential failover: tries each endpoint until one succeeds or all fail.

### Query Template

```overpass
[out:json][timeout:20];
(
  node["amenity"~"^(clinic|pharmacy|doctors|hospital|community_centre|library|school)$"](around:{radius_m},{lat},{lon});
  node["leisure"~"^(park|playground|community_centre)$"](around:{radius_m},{lat},{lon});
  node["shop"~"^(mall|marketplace)$"](around:{radius_m},{lat},{lon});
  node["building"~"^(school|community|public)$"](around:{radius_m},{lat},{lon});
);
out 20;
```

### Current Venue Categories

| OSM Tag | Category | Example |
|---|---|---|
| `amenity=clinic` | clinic | Community health clinic |
| `amenity=pharmacy` | pharmacy | CVS, Walgreens, local pharmacy |
| `amenity=community_centre` | community_centre | Recreation center, community hall |
| `amenity=library` | library | Public library |
| `amenity=school` | school | Elementary, high school |
| `amenity=doctors` | doctors | Doctor's office |
| `amenity=hospital` | hospital | Hospital (included but less ideal) |
| `leisure=park` | park | Public park |
| `leisure=playground` | playground | Playground |
| `leisure=community_centre` | community_centre | (Duplicate tag) |
| `shop=mall` | mall | Shopping mall |
| `shop=marketplace` | marketplace | Farmers market, flea market |
| `building=school` | school | School building |
| `building=community` | community | Community building |
| `building=public` | public | Public building |

**Limit**: 20 venues max per query.

### US-Focused Venue Categories (Planned)

| Category | OSM Tags | Notes |
|---|---|---|
| FQHCs | `amenity=clinic` + `healthcare:speciality=fqhc` | Federally Qualified Health Centers |
| Health Departments | `office=government` + `government=health` | Local/county health departments |
| Community Centers | `amenity=community_centre` | Existing |
| Libraries | `amenity=library` | Existing |
| Parks | `leisure=park` | Existing |
| Schools | `amenity=school` | Existing |
| Pharmacies | `amenity=pharmacy` | Existing |

**Verification needed**: Confirm OSM tagging coverage for FQHCs and health departments in US.

### Response Processing

```python
for el in elements[:20]:
    tags = el.get("tags") or {}
    name = tags.get("name") or tags.get("amenity") or tags.get("leisure") or "Unnamed venue"
    cat = tags.get("amenity") or tags.get("leisure") or tags.get("shop") or "community"
    addr_parts = [tags.get(k) for k in ("addr:road", "addr:suburb", "addr:city") if tags.get(k)]
    
    GeoVenue(
        name=name[:120],
        category=cat[:80],
        address=", ".join(addr_parts) or None,
        lat=el.get("lat"),
        lon=el.get("lon"),
        provenance=Provenance.GEO,
        needs_verification=True,  # ALWAYS TRUE
    )
```

### Status Vocabulary

| Status | Condition | Note |
|---|---|---|
| `ok` | ≥ 1 venue returned | "" |
| `thin` | 0 venues returned | "Few mapped community venues in this radius." |
| `unavailable` | All 3 endpoints failed | "The map directory didn't respond, so no nearby places could be listed. What you saved is safe — try again in a moment." |

### Error Handling

| Error | Handling |
|---|---|
| Single endpoint fail | Try next endpoint |
| All endpoints fail | Return `unavailable` with plain-language note |
| Timeout (10s/endpoint) | Try next endpoint |
| Invalid response | Try next endpoint |

## Attribution Requirements

**Mandatory on every map and venue list:**

```
© OpenStreetMap contributors (ODbL)
```

**Nominatim specific:**
```
© OpenStreetMap contributors (Nominatim, ODbL)
```

**Implementation**: `GeocodeResult.attribution` field, rendered in UI components.

## Data Model

### GeocodeResult
```python
class GeocodeResult(BaseModel):
    display_name: str
    lat: float
    lon: float
    provenance: Provenance = Provenance.GEO
    attribution: str = "© OpenStreetMap contributors (Nominatim, ODbL)"
```

### GeoVenue
```python
class GeoVenue(BaseModel):
    name: str
    category: str
    address: str | None = None
    lat: float | None = None
    lon: float | None = None
    distance_m: int | None = None
    provenance: Provenance = Provenance.GEO
    needs_verification: bool = True  # ALWAYS TRUE
```

## Frontend Components

### LocationAutocomplete
- Debounced (300ms) Nominatim suggest endpoint
- US-biased (planned: `countrycodes=us`)
- 120-char query cap
- No re-query after selection
- Stale request cancellation

### ClickMap
- Leaflet map, click → reverse geocode
- Typed field remains source of truth
- US initial viewport (planned)
- Venue list below map (required text alternative)

### MapView
- Leaflet + OSM/CARTO tiles
- Attribution control always visible
- Marker clustering for venues (planned)

## Testing

### Unit Tests (Mocked)
- Geocode success → `GeocodeResult` with provenance
- Geocode empty → error message
- Reverse geocode success → `GeocodeResult`
- Reverse geocode invalid coords → 400 error
- Suggest success → list of suggestions
- Suggest short query (<3 chars) → empty list
- Overpass success → `GeoVenue[]` with `needs_verification=True`
- Overpass empty → `thin` status
- Overpass all endpoints fail → `unavailable` status
- Cache hit returns cached result
- Throttle enforces 1 req/s

### Integration Tests
- Nominatim live geocode (manual verification)
- Nominatim live suggest (manual verification)
- Overpass live query (manual — public mirrors often fail)

## Configuration

```python
# apps/api/app/services/geo_client.py
NOMINATIM = "https://nominatim.openstreetmap.org"
OVERPASS_ENDPOINTS = [...]  # 3 endpoints
UA = "HealthReachAI/0.1 hackathon-demo"
GEOCODE_TTL_S = 24 * 3600
SUGGEST_TTL_S = 3600
OVERPASS_TIMEOUT = 10.0  # per endpoint
OVERPASS_RADIUS_M = 1500  # default search radius
```

## Future Enhancements

| Enhancement | Effort | Blocker |
|---|---|---|
| US venue category expansion | M | Verify OSM tag coverage |
| Miles distance display | S | Frontend formatting |
| Venue capacity estimates | L | No OSM data source |
| Venue photos (Mapillary) | L | Separate API |
| Routing/directions | L | OSRM or separate service |

---

*Related: [Geocoding & Location](GEOCODING_AND_LOCATION.md) · [Data Model](data/DATA_MODEL.md) · [External Services](EXTERNAL_SERVICES.md)*