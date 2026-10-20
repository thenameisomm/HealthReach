# Geocoding & Location — HealthReach AI

## Overview

This document details the geocoding and location-picking functionality used in the campaign brief form (`/new`). It combines **text autocomplete** (Nominatim suggest) with **map-based picking** (ClickMap → reverse geocode).

## User Flow

```
Brief Form (/new)
├── Location Field (text input)
│   ├── User types → debounced autocomplete suggestions
│   ├── User selects suggestion → fills field, stores lat/lon
│   └── Field remains source of truth for display text
│
└── ClickMap (interactive map)
    ├── User clicks map → reverse geocode → fills text field
    ├── Selected coordinates stored with resolved address
    └── Map always has text alternative (venue list)
```

## LocationAutocomplete v2 (Current + Planned)

### Current Implementation (`apps/web/components/LocationAutocomplete.tsx`)

- Debounced combobox (300ms)
- Nominatim `/search` endpoint
- 120-character query cap
- Skips re-query for just-chosen label
- Caps queries at 120 chars
- Honest `unavailable` state (200 + status)

### Planned Enhancements (v2)

| Feature | Spec |
|---|---|
| US bias | `countrycodes=us`, `accept-language=en-US` |
| Debounce | 300ms (configurable) |
| Query cap | 120 characters |
| No re-query | After selection, skip autocomplete for that label |
| Stale cancellation | AbortController for in-flight requests |
| Keyboard navigation | Arrow keys, Enter to select, Escape to close |
| Accessible labels | `aria-label`, `aria-expanded`, `aria-controls` |
| Loading state | Spinner during request |
| Error state | Inline "Location service unavailable" |
| Empty state | "No matches found for '{query}'" |

### API Contract

```http
GET /api/geo/suggest?q={query}
```

**Response:**
```json
{
  "suggestions": [
    {"display_name": "East Austin, Austin, TX, USA", "lat": 30.25, "lon": -97.72, "type": "suburb"}
  ],
  "status": "ok" | "unavailable",
  "note": "string"
}
```

### Frontend State

```typescript
interface LocationAutocompleteState {
  query: string;           // User-typed text (source of truth)
  suggestions: Suggestion[];
  selected: Suggestion | null;  // {display_name, lat, lon, type}
  loading: boolean;
  error: string | null;
  status: "idle" | "loading" | "success" | "error" | "unavailable";
}
```

## ClickMap v2 (Current + Planned)

### Current Implementation (`apps/web/components/ClickMap.tsx`)

- Leaflet map (dynamically imported)
- Click → reverse geocode → fills text field
- Text field stays source of truth
- Map always has text path (venue list)

### Planned Enhancements (v2)

| Feature | Spec |
|---|---|
| US initial viewport | Center on US (e.g., 39.8283, -98.5795), zoom 4 |
| Reverse geocode | `/api/geo/reverse?lat={lat}&lon={lon}` |
| Accessible errors | Toast/inline "Could not name that location" |
| Attribution | OSM attribution always visible |
| Text alternative | Venue list below map (required) |
| Keyboard accessible | Map focusable, click via Enter/Space |

### API Contract

```http
GET /api/geo/reverse?lat={lat}&lon={lon}
```

**Response:**
```json
{
  "display_name": "123 Main St, Austin, TX 78701, USA",
  "lat": 30.2672,
  "lon": -97.7431,
  "provenance": "geo",
  "attribution": "© OpenStreetMap contributors (Nominatim, ODbL)"
}
```

**Error (400):** Out of range coordinates
```json
{
  "detail": "That map point is outside the map range."
}
```

## Coordinate Storage

When user selects a location (via autocomplete or map click):

```typescript
interface ResolvedLocation {
  display_name: string;   // What shows in text field
  lat: number;            // Stored for evidence gathering
  lon: number;            // Stored for evidence gathering
  provenance: "geo";      // Always geo
}
```

**Key principle**: The **text field is the source of truth** for what the user sees. Coordinates are metadata attached to that selection.

## US-Focused Behavior (Planned)

### Geocoding Bias

```python
# Nominatim params for US focus
params = {
    "countrycodes": "us",           # Restrict to US
    "accept-language": "en-US",     # English results
    # ... other params
}
```

### Initial Map Viewport

```typescript
// US continental center
const US_CENTER = { lat: 39.8283, lon: -98.5795 };
const US_ZOOM = 4;
```

### Distance Display

```typescript
// Convert meters to miles (1 decimal)
const miles = (meters * 0.000621371).toFixed(1);  // e.g., "0.2 mi"
```

## Caching Strategy

| Cache | Key | TTL | Invalidation |
|---|---|---|---|
| Geocode | `location_text.lower()` | 24h | Manual or TTL |
| Suggest | `query.lower()` | 1h | Manual or TTL |
| Reverse | `rev:{lat:.4f}:{lon:.4f}` | 24h | Manual or TTL |

**Implementation**: In-memory dict in `geo_client.py` (survives API restarts in dev, lost in serverless).

## Error Handling (Frontend)

| Scenario | UI Behavior |
|---|---|
| Network offline | "You're offline. Your input is saved — try again when connected." |
| Timeout | "The request took too long. Your input is safe — try again." |
| Service unavailable | "Location service temporarily unavailable. Try again in a moment." |
| No results | "No matches found for '{query}'. Try a different search." |
| Invalid coords | "That location is outside the supported range." |

**Input preservation**: Text field value **never cleared** by errors. Errors clear on user edit.

## Accessibility

- **LocationAutocomplete**: Combobox pattern (ARIA 1.1), `role="combobox"`, `aria-autocomplete="list"`, `aria-controls="listbox-id"`, `aria-expanded`
- **ClickMap**: Map is decorative (`aria-hidden="true"`), venue list is accessible alternative
- **Focus management**: Autocomplete listbox focusable, Escape closes, Enter selects
- **Screen readers**: Suggestions announced via `aria-live="polite"`
- **Reduced motion**: Map animations disabled via `prefers-reduced-motion`

## Testing

### Unit Tests (Planned)
- Debounce timing (300ms)
- Query cap (120 chars)
- Selection fills field + stores coords
- No re-query after selection
- Stale request cancellation
- Keyboard navigation (arrows, Enter, Escape)
- US bias in suggestions
- Error states render correctly
- Input preserved on error

### Integration Tests
- Autocomplete → selection → brief submit → geocode stored
- Map click → reverse geocode → field filled → coords stored
- Both paths produce same `ResolvedLocation` structure

## Configuration

```python
# Backend (geo_client.py)
NOMINATIM = "https://nominatim.openstreetmap.org"
GEOCODE_TTL_S = 24 * 3600
SUGGEST_TTL_S = 3600
UA = "HealthReachAI/0.1 hackathon-demo"

# Frontend (LocationAutocomplete.tsx)
DEBOUNCE_MS = 300
MAX_QUERY_LENGTH = 120
US_COUNTRY_CODES = "us"  # Planned
```

---

*Related: [OSM Integration](OSM_INTEGRATION.md) · [LocationAutocomplete Component](../frontend/ROUTES_AND_WORKSPACE.md) · [API Contracts](../api/API_CONTRACTS.md)*