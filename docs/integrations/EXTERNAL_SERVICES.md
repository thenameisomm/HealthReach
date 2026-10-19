# External Services — HealthReach AI

## Summary

| Service | Purpose | Auth | Key Required | Fallback |
|---|---|---|---|---|
| Qloo Insights | Cultural affinity signals | `x-api-key` | `QLOO_API_KEY` | Deterministic plan (no cultural signals) |
| Nominatim | Geocoding (search, reverse, suggest) | None (UA) | No | Cached results, honest unavailable |
| Overpass | Community venue queries | None | No | 3-endpoint failover, honest unavailable |
| LLM (OpenAI-compat) | Plan prose generation | Bearer token | `LLM_API_KEY` | Deterministic template planner |
| MongoDB | Persistence | Connection string | `MONGODB_URI` | In-memory fallback |
| OSM Tiles | Map rendering | None | No | CARTO Light fallback |

---

## Qloo Insights API

### Configuration
```python
QLOO_API_KEY: str = ""           # Required for real mode
QLOO_BASE_URL: str = "https://api.qloo.com"
```

### Endpoints Used
| Endpoint | Method | Purpose |
|---|---|---|
| `/v2/insights` | GET | Place affinities, taste tags (3-step chain) |
| `/v2/search` | GET | Entity lookup (not currently used) |
| `/v2/tags` | GET | Tag validation (not currently used) |

### Request Parameters (Verified)
- `filter.type`: `urn:entity:place` | `urn:tag` | `urn:heatmap` | `urn:demographics`
- `filter.location.query`: Fuzzy locality name
- `filter.location.radius`: Meters (5000 default)
- `filter.location`: `lat,lon` | WKT | locality UUID
- `signal.interests.entities`: Comma-separated entity IDs
- `signal.interests.tags`: Comma-separated tag IDs
- `feature.explainability`: `true` for tag explanations

### Rate Limits
- Hackathon: 5 req/s, 10,000 calls/month
- Client: 12s timeout, 3 retries (0.5, 1, 2s + jitter) on 429/5xx
- No retry on 400/401/403

### Response Fields Used
- `results.entities[].entity_id`, `name`, `affinity`, `popularity`, `tags[]`
- `results.tags[].tag_id`, `name`, `affinity`

### What Qloo Does NOT Provide
- Healthcare facilities, clinical data
- Community trust scores
- Footfall/visitation data
- Epidemiology, diagnoses, health needs
- Visitor forecasts, demand predictions

---

## Nominatim (OpenStreetMap Geocoding)

### Configuration
```python
NOMINATIM = "https://nominatim.openstreetmap.org"
UA = "HealthReachAI/0.1 hackathon-demo"
```

### Endpoints Used
| Endpoint | Method | Purpose |
|---|---|---|
| `/search` | GET | Geocode, autocomplete |
| `/reverse` | GET | Reverse geocode (click-map) |

### Parameters
| Parameter | Search | Reverse | Suggest |
|---|---|---|---|
| `q` / `lat,lon` | Required | — | Required |
| `format` | `jsonv2` | `jsonv2` | `jsonv2` |
| `limit` | 1 | — | 5 |
| `countrycodes` | `us` (planned) | — | `us` (planned) |
| `accept-language` | `en-US` (planned) | — | `en-US` (planned) |
| `zoom` | — | 18 | — |
| `addressdetails` | — | 0 | — |

### Compliance
- ≤ 1 req/s (client throttle)
- Identifying User-Agent + Referer
- HTTP/1.1 (avoids WAF blocks)
- 24h cache (geocode), 1h cache (suggest)
- Attribution: `© OpenStreetMap contributors (Nominatim, ODbL)`

---

## Overpass API (OSM Venue Queries)

### Configuration
```python
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
```

### Query Pattern
```overpass
[out:json][timeout:20];
(
  node["amenity"~"clinic|pharmacy|community_centre|library|school"](around:{r},{lat},{lon});
  node["leisure"~"park|playground"](around:{r},{lat},{lon});
  node["shop"~"mall|marketplace"](around:{r},{lat},{lon});
);
out 20;
```

### Failover
- Sequential: tries each endpoint until success
- 10s timeout per endpoint
- All fail → `unavailable` status

### Rate Limits
- No hard limit (public instances)
- Good citizenship: timeout 20s, limit 20 results
- Cache not used (per-campaign snapshot stored)

---

## LLM Provider (OpenAI-Compatible)

### Configuration
```python
LLM_API_KEY: str = ""                    # Empty = template only
LLM_BASE_URL: str = "https://api.openai.com/v1"
LLM_MODEL: str = "gpt-4o-mini"
LLM_TIMEOUT_S: int = 45
LLM_MAX_RETRIES: int = 1                 # Repair retry only
```

### Endpoint
```
POST {LLM_BASE_URL}/chat/completions
```

### Request
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "response_format": {"type": "json_object"},
  "temperature": 0.2
}
```

### Fallback Chain
1. LLM first attempt → validate
2. Validation fail → repair retry (1x)
3. Repair fail / timeout / auth error / rate limit → deterministic template
4. Template always succeeds, budget forced exact

### Security
- Prompt contains no PII (campaign params + evidence IDs only)
- Response not logged
- Key server-side only

---

## MongoDB

### Configuration
```python
MONGODB_URI: str = ""                    # Empty = in-memory fallback
```

### Collections
| Collection | Purpose | TTL Index |
|---|---|---|
| `campaigns` | Campaign briefs + geocode | No |
| `evidence_snapshots` | Qloo signals + OSM venues | No |
| `plans` | Plan versions (versioned) | No |
| `results` | Aggregate results | No |
| `ext_cache` | External API response cache | 24h on `created_at` |

### Fallback
- `db.py` provides `InMemoryDB` when `MONGODB_URI` not set or connection fails
- Same async interface (`motor`-compatible)
- Data lost on restart (acceptable for demo)

---

## OSM Map Tiles

### Tile Layers
| Layer | URL | Attribution |
|---|---|---|
| OSM Standard | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | © OSM contributors |
| CARTO Light | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` | © OSM contributors, © CARTO |

### Leaflet Configuration
```typescript
// Dynamic import in MapView.tsx
const L = await import('leaflet');
const map = L.map('map').setView([lat, lon], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors (ODbL)',
  maxZoom: 19,
}).addTo(map);
```

---

## Service Health Checks

### `/health` Endpoint
```json
{
  "status": "ok",
  "qloo_configured": true,
  "llm_configured": false,
  "mongodb_connected": true,
  "timestamp": "2026-10-20T15:30:00Z"
}
```

### `/api/config` Endpoint
```json
{
  "qloo_configured": true,
  "llm_configured": false,
  "demo_mode_available": true
}
```

---

## Environment Variables Reference

| Variable | Service | Required | Default | Notes |
|---|---|---|---|---|
| `QLOO_API_KEY` | Qloo | For real mode | "" | Empty = unavailable |
| `QLOO_BASE_URL` | Qloo | No | `https://api.qloo.com` | |
| `LLM_API_KEY` | LLM | For AI plans | "" | Empty = template |
| `LLM_BASE_URL` | LLM | No | `https://api.openai.com/v1` | |
| `LLM_MODEL` | LLM | No | `gpt-4o-mini` | |
| `MONGODB_URI` | MongoDB | For persistence | "" | Empty = in-memory |
| `CORS_ORIGINS` | FastAPI | No | `http://localhost:3000` | Comma-separated |
| `NEXT_PUBLIC_API_URL` | Frontend | No | `http://localhost:8000` | Public, not secret |

---

## Failure Mode Summary

| Service Fails | System Behavior |
|---|---|
| Qloo (key missing) | Plan proceeds, `has_cultural_signals: false`, banner shown |
| Qloo (auth fail) | Same as missing, "key rejected" note |
| Qloo (timeout/5xx) | Retry 3x, then unavailable, plan proceeds |
| Nominatim (timeout) | Retry once, then unavailable, field error |
| Nominatim (WAF block) | HTTP/1.1 + clean UA prevents most |
| Overpass (all fail) | `unavailable`, plan proceeds with activities only |
| LLM (timeout/error) | Template planner, `planner: standard-template` |
| MongoDB (connection fail) | In-memory fallback, data lost on restart |

---

## Monitoring & Observability

### Logged (Server-Side)
- Qloo request/response (status, latency, step)
- Nominatim requests (throttle wait, cache hit/miss)
- Overpass endpoint used, result count
- LLM validation result (pass/repair/fallback)
- MongoDB connection status

### NOT Logged
- API keys
- User-typed location text (only in debug)
- LLM prompts/responses
- Patient/health data (none exists)

---

*Related: [Qloo Integration](QLOO_INTEGRATION.md) · [OSM Integration](OSM_INTEGRATION.md) · [Geocoding & Location](GEOCODING_AND_LOCATION.md) · [Security & Privacy](architecture/SECURITY_AND_PRIVACY.md)*