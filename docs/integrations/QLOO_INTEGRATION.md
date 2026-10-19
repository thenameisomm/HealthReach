# Qloo Integration — HealthReach AI

## Overview

HealthReach uses Qloo's Insights API (`/v2/insights`) to gather **cultural affinity signals** for a campaign location. These signals inform the outreach plan's messaging, channels, and tone — helping organizers use framings that feel familiar to the local community.

**Critical boundary**: Qloo provides **taste/cultural affinity only**. It does NOT provide:
- Healthcare facilities or clinical data
- Community trust scores
- Footfall or venue visitation data
- Epidemiology or disease prevalence
- Diagnoses or health needs
- Visitor forecasts or demand predictions

Every Qloo-derived value in HealthReach carries the provenance label **"Qloo signal — taste affinity, never medical fact"**.

## Verified Qloo Capabilities (Oct 2026)

| Capability | Endpoint | Parameters Used | Status |
|---|---|---|---|
| Place affinities near location | `GET /v2/insights` | `filter.type=urn:entity:place`, `filter.location.query`, `filter.location.radius`, `feature.explainability=true` | ✅ Verified |
| Taste tags from entity | `GET /v2/insights` | `filter.type=urn:tag`, `signal.interests.entities`, `signal.location.query` | ✅ Verified |
| Entity search | `GET /v2/search` | `query`, `type` | ✅ Verified |
| Tag search | `GET /v2/tags` | `query` | ✅ Verified |
| Audiences | `GET /v2/audiences` | `signal.interests.entities` | ✅ Verified |
| Heatmaps | `GET /v2/insights` | `filter.type=urn:heatmap` | ⚠️ Not used (tracks popularity) |
| Demographics | `GET /v2/insights` | `filter.type=urn:demographics` | ⚠️ Not used (no health data) |

## Authentication & Configuration

```python
# Settings (apps/api/app/config.py)
QLOO_API_KEY: str = ""           # Required for real mode
QLOO_BASE_URL: str = "https://api.qloo.com"

# Headers
headers = {
    "x-api-key": settings.QLOO_API_KEY,
    "Accept": "application/json"
}
```

**Rate limits**: 5 req/s (hackathon), 10,000 calls/month. Client enforces conservative usage.

## Request Parameters (Verified)

### Step 1: Place Affinities
```http
GET /v2/insights
  ?filter.type=urn:entity:place
  &filter.location.query={location_text}
  &filter.location.radius=5000
  &feature.explainability=true
  &filter.location={lat},{lon}          # optional, when geocode available
```

### Step 2 & 3: Taste Tags from Entity
```http
GET /v2/insights
  ?filter.type=urn:tag
  &signal.interests.entities={entity_id}
  &signal.location.query={location_text}
```

### Parameter Reference

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `filter.type` | string | Yes | `urn:entity:place` \| `urn:tag` \| `urn:heatmap` \| `urn:demographics` |
| `filter.location.query` | string | For place affinities | Fuzzy locality name (e.g., "East Austin, TX") |
| `filter.location.radius` | integer | For place affinities | Meters (default 5000) |
| `filter.location` | string | Optional | `lat,lon` or WKT or locality UUID |
| `signal.interests.entities` | string | For tag queries | Comma-separated entity IDs |
| `signal.interests.tags` | string | Optional | Comma-separated tag IDs |
| `signal.demographics.*` | string | Optional | Age/gender hints (display only) |
| `feature.explainability` | string | Optional | `true` returns tag explanations |
| `take` | integer | Optional | Result limit (default varies) |

## Response Structure (Verified)

### Place Affinities Response
```json
{
  "results": {
    "entities": [
      {
        "entity_id": "ent_12345",
        "name": "East Austin Community Center",
        "affinity": 0.72,
        "popularity": 0.65,
        "tags": [
          {"tag_id": "tag_111", "name": "community gathering", "affinity": 0.68},
          {"tag_id": "tag_222", "name": "family activities", "affinity": 0.55}
        ]
      }
    ]
  }
}
```

### Tag Affinities Response
```json
{
  "results": {
    "tags": [
      {"tag_id": "tag_111", "name": "community gathering", "affinity": 0.68},
      {"tag_id": "tag_222", "name": "family activities", "affinity": 0.55}
    ]
  }
}
```

### Field Definitions

| Field | Type | Range | Meaning |
|---|---|---|---|
| `affinity` | float | -1.0 to 1.0 | Taste alignment (negative = disaffinity) |
| `popularity` | float | 0.0 to 1.0 | General popularity in the area |
| `entity_id` | string | — | Qloo internal identifier |
| `tag_id` | string | — | Qloo tag identifier |
| `name` | string | — | Human-readable name |

## HealthReach Qloo Client Implementation

### `fetch_cultural_signals()` — 3-Step Chain

```python
async def fetch_cultural_signals(
    location_text: str, lat: float | None, lon: float | None, topic: str
) -> tuple[list[QlooSignal], list[QlooChainStep], str, str]:
    """
    Returns: (signals, steps, status, note)
    Status: "ok" | "thin" | "unavailable"
    """
```

**Step 1**: Place affinities near campaign location
- Queries `urn:entity:place` with location + radius
- Returns up to 8 places with affinity/popularity/tags
- Generates `QlooSignal(kind="place-affinity", ...)` per place
- Records `QlooChainStep(step=1, ...)`

**Step 2**: Taste tags from top place's entity_id
- Uses `signal.interests.entities = top_place.entity_id`
- Queries `urn:tag` with same location
- Generates `QlooSignal(kind="tag-affinity", ...)` per tag
- Records `QlooChainStep(step=2, ...)`

**Step 3**: Cross-check with second place
- Uses `signal.interests.entities = second_place.entity_id`
- Same query as Step 2
- Computes tag overlap between Step 2 and Step 3
- Generates signals for Step 3 tags
- Records `QlooChainStep(step=3, ...)` with overlap analysis

### Error Handling

| Error Type | Handling | Status | Retry |
|---|---|---|---|
| 401/403 (auth) | Log, return "key rejected" reason | `unavailable` | No |
| 429 (rate limit) | Exponential backoff (0.5, 1, 2s + jitter) ×3 | `unavailable` if exhausted | Yes |
| 5xx/timeout | Exponential backoff ×3 | `unavailable` if exhausted | Yes |
| 400 (bad request) | Log, return "invalid request" | `unavailable` | No |
| Empty response | Return `thin` with "little data" note | `thin` | No |
| Key not configured | Raise `RuntimeError` (router catches → 503) | `unavailable` | N/A |

### Skip Handling

If a step cannot run (predecessor empty, auth failure, error):
- Step recorded with `status="skip"` and plain-language `skip_reason`
- Subsequent steps that depend on it also `skip` with appropriate reason
- **Never** invent signals or fake data

## Provenance & UI Communication

### Signal Provenance
```python
QlooSignal(
    kind="place-affinity" | "tag-affinity" | "demographics",
    label="Human-readable name",
    detail="Plain-language explanation ending with: Taste affinity, not a health or trust signal.",
    affinity=float | None,      # clamped -1..1
    popularity=float | None,    # clamped 0..1
    entity_id=str | None,
    provenance=Provenance.QLOO
)
```

### Step Provenance
```python
QlooChainStep(
    step=1|2|3,
    title="Plain language title",
    asked="What question was asked",
    found="What was found (or empty)",
    next="What happens next (or empty)",
    top_names=["name1", "name2"],
    status="ok" | "skip",
    skip_reason="Plain language reason if skipped",
    provenance=Provenance.QLOO
)
```

### UI Rendering Rules

1. **Every signal**: ProvenanceBadge (icon ◈, label "Qloo signal", solid left border)
2. **Every step**: Numbered card with status badge (ok/thin/skip)
3. **Aggregate status**: `qloo_status` banner (ok=green, thin=amber, unavailable=red)
4. **Provenance note**: "Taste affinity, not a health or trust signal" on every Qloo section
5. **Plan flag**: `has_cultural_signals: false` when Qloo unavailable → banner in plan

## Call Budget Estimation

| Phase | Calls | Notes |
|---|---|---|
| Step 1 (places) | 1 | Up to 8 places returned |
| Step 2 (tags from top) | 1 | Up to 6 tags returned |
| Step 3 (tags from second) | 1 | Up to 6 tags returned |
| **Total per campaign** | **3** | Fixed, deterministic |

**Monthly budget**: 10,000 calls → ~3,300 campaigns/month (with caching, much more)

## What Qloo Does NOT Provide (Never Claim)

| Category | Example False Claim | HealthReach Reality |
|---|---|---|
| Healthcare facilities | "Qloo shows nearby clinics" | OSM shows clinics; Qloo shows cultural venues |
| Trust scores | "Qloo trust score: 0.8" | No trust data in Qloo |
| Footfall | "500 people visit daily" | No footfall data in Qloo |
| Epidemiology | "High diabetes prevalence" | No health data in Qloo |
| Visitor forecasts | "10,000 visitors expected" | No forecasting in Qloo |
| Demand prediction | "High demand for screening" | Cultural affinity ≠ demand |

## Testing & Verification

### Mock Fixtures (Pytest)
- `tests/fixtures/qloo_step1_places.json`
- `tests/fixtures/qloo_step2_tags.json`
- `tests/fixtures/qloo_step3_tags.json`
- `tests/fixtures/qloo_empty.json`
- `tests/fixtures/qloo_auth_error.json`

### Test Coverage (`test_pipeline.py`)
- Chain executes all 3 steps with valid responses
- Step 2 skipped when Step 1 returns no places
- Step 3 skipped when Step 1 returns < 2 places
- Auth failure → `unavailable` status, no signals
- Thin response → `thin` status, signals preserved
- Provenance on all signals and steps
- Skip reasons are plain language
- Overlap analysis in Step 3

### Live Verification (Manual)
- Nominatim geocode verified against live service
- Qloo request shapes verified against public docs (no key in CI)
- Overpass endpoints verified (public mirrors return errors → `unavailable` handled)

---

## Configuration for US-Focused Mode (Planned)

```python
# No Qloo parameter changes needed — Qloo works globally
# US focus handled at:
# 1. Geocoding: Nominatim countrycodes=us, accept-language=en-US
# 2. Venue categories: US-relevant OSM tags
# 3. Budget: USD formatting
# 4. Distance: miles
# 5. Demo scenario: US location (East Austin, TX)
```

---

*Related: [Qloo Agent Chain](QLOO_AGENT_CHAIN.md) · [Agent Orchestration](architecture/AGENT_ORCHESTRATION.md) · [LLM Contract](LLM_CONTRACT.md) · [External Services](EXTERNAL_SERVICES.md)*