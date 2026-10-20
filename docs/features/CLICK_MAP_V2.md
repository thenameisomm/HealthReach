# Feature Specification: ClickMap v2

## Overview

Enhanced map-based location picking for the campaign brief form (`/new`). Users click the map to select a location, which triggers reverse geocoding to fill the text field. The typed field remains the source of truth.

**Current State**: Basic ClickMap exists (`apps/web/components/ClickMap.tsx`) with Leaflet map, click → reverse geocode → fills text field.

**Target**: Production-ready v2 with US-focused initial viewport, robust reverse geocode error handling, accessible alternatives, and clear sync with LocationAutocomplete.

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CM-001 | Click map → reverse geocode → fills LocationAutocomplete text field | P0 |
| FR-CM-002 | Typed field remains source of truth for display text | P0 |
| FR-CM-003 | Selected coordinates stored with resolved address | P0 |
| FR-CM-004 | US-focused initial viewport (continental US center, zoom 4) | P0 |
| FR-CM-005 | Reverse geocode failure → accessible error toast | P0 |
| FR-CM-006 | OSM attribution always visible | P0 |
| FR-CM-007 | Textual alternative for map interactions (venue list) | P0 |
| FR-CM-008 | Keyboard-accessible map interactions | P0 |
| FR-CM-009 | Sync with LocationAutocomplete: autocomplete selection updates map | P0 |
| FR-CM-010 | Map decorative (`aria-hidden`), venue list is accessible path | P0 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-CM-001 | Initial viewport | Lat: 39.8283, Lon: -98.5795, Zoom: 4 |
| NFR-CM-002 | Reverse geocode timeout | 12s (backend) |
| NFR-CM-003 | Accessibility | Map decorative, venue list accessible |
| NFR-CM-004 | Touch targets | ≥ 48×48px for map interactions |
| NFR-CM-005 | Attribution | "© OpenStreetMap contributors (ODbL)" always visible |

---

## API Contract

### Endpoint: `GET /api/geo/reverse`

**Query Parameters:**
- `lat` (number, required): Latitude (-90 to 90)
- `lon` (number, required): Longitude (-180 to 180)

**Response (200):**
```json
{
  "data": {
    "display_name": "123 Main St, Austin, TX 78701, USA",
    "lat": 30.2672,
    "lon": -97.7431,
    "provenance": "geo",
    "attribution": "© OpenStreetMap contributors (Nominatim, ODbL)"
  },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

**Error Responses:**
- 400: Invalid coordinates (out of range)
- 503: Nominatim unavailable

---

## Component Specification

### Props Interface

```typescript
interface ClickMapProps {
  value: ResolvedLocation | null;        // Current resolved location
  onSelect: (location: ResolvedLocation) => void; // Called on map click + reverse geocode
  disabled?: boolean;
  initialViewport?: Viewport;            // Default: US continental center
  readonly?: boolean;                    // For evidence/plan phases
}

interface Viewport {
  lat: number;
  lon: number;
  zoom: number;
}

interface ResolvedLocation {
  display_name: string;  // What shows in text field
  lat: number;
  lon: number;
  type?: string;
}
```

### Default US Viewport

```typescript
const US_CONTINENTAL_CENTER = {
  lat: 39.8283,    // Geographic center of contiguous US
  lon: -98.5795,
  zoom: 4
};
```

### State Management

```typescript
interface ClickMapState {
  mapRef: React.RefObject<HTMLDivElement>;
  leafletMap: L.Map | null;
  marker: L.Marker | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}
```

### Key Behaviors

#### Map Click → Reverse Geocode
```typescript
// On map click:
1. Get lat/lng from Leaflet event
2. Validate coordinates (-90 to 90, -180 to 180)
3. Set status='loading', clear error
4. Call GET /api/geo/reverse?lat={lat}&lon={lon}
5. On success:
   - Create ResolvedLocation with display_name, lat, lon
   - Call onSelect(resolvedLocation)
   - Update marker position
   - Set status='idle'
6. On error:
   - Set status='error'
   - Show accessible toast: "Could not name that location. Try a different spot."
   - Keep existing marker/value
```

#### Source of Truth Sync
- **LocationAutocomplete text field** = source of truth for display
- **ClickMap** = picker only; updates autocomplete on selection
- If user edits text field after map click: map marker updates (via sync prop)
- Coordinates stored with the resolved address

#### Accessible Alternative (Venue List)
- Map is decorative: `aria-hidden="true"` on map container
- Venue list below map provides text alternative
- Each venue: name, category, address, distance, "Visit and verify" badge
- Keyboard navigable list with proper ARIA

#### Keyboard Accessibility
| Key | Action |
|-----|--------|
| Tab | Focus map container (if not aria-hidden) |
| Enter/Space | Activate "pick location" mode |
| Arrow keys | Pan map (when focused) |
| Escape | Exit pick mode |

---

## Accessibility

### Map as Decorative
```tsx
<div ref={mapRef} aria-hidden="true" role="img" aria-label="Map for picking location">
  {/* Leaflet map */}
</div>

{/* Required text alternative */}
<ul role="list" aria-label="Candidate venues near selected location">
  {venues.map(v => (
    <li key={v.name}>
      <strong>{v.name}</strong> — {v.category}
      {v.address && <span>, {v.address}</span>}
      <span className="verification-badge">Visit and verify before use</span>
    </li>
  ))}
</ul>
```

### Screen Reader Support
- Map container: `aria-hidden="true"` + `role="img"` with descriptive label
- Venue list: Semantic `<ul>` with proper labels
- Error toasts: `aria-live="assertive"` for immediate announcement

### Focus Management
- Map focusable only when in "pick mode"
- Venue list always keyboard navigable
- Error toasts don't steal focus

---

## Error Handling

| Scenario | User-Facing Message | Behavior |
|----------|---------------------|----------|
| Coordinates out of range | "That map point is outside the map range." | 400 error, no marker update |
| Nominatim timeout | "The request took too long. Your input is safe — try again." | Keep existing marker |
| Nominatim unavailable | "Location service temporarily unavailable. Try again in a moment." | Keep existing marker |
| Network offline | "You're offline. Your input is saved — try again when connected." | Keep existing marker |
| Reverse geocode empty | "We couldn't name that map point." | Keep existing marker |

**Input Preservation**: Autocomplete text field value never cleared by map errors.

---

## Testing Requirements

### Unit Tests
- [ ] Map click triggers reverse geocode with correct coords
- [ ] Success: updates autocomplete, places marker
- [ ] Error: shows toast, preserves existing state
- [ ] Invalid coords (out of range) → 400 handled
- [ ] US initial viewport applied
- [ ] OSM attribution visible
- [ ] Marker updates on autocomplete selection

### Integration Tests
- [ ] ClickMap → autocomplete sync
- [ ] Autocomplete → ClickMap sync
- [ ] Both produce same `ResolvedLocation` structure

### Accessibility Tests
- [ ] Map has `aria-hidden="true"`
- [ ] Venue list is semantic `<ul>` with labels
- [ ] Error toasts use `aria-live="assertive"`
- [ ] Keyboard navigation works
- [ ] Focus management correct

---

## Implementation Notes

### Files to Modify
- `apps/web/components/ClickMap.tsx` — Main component
- `apps/web/app/new/page.tsx` — Integration with brief form
- `apps/api/app/services/geo_client.py` — Reverse geocode (already exists)

### Backend (Already Implemented)
```python
# geo_client.py - reverse_geocode()
async def reverse_geocode(lat: float, lon: float) -> GeocodeResult:
    # Validates coords, calls Nominatim, returns GeocodeResult
    # 24h cache, 1 req/s throttle
```

### Map Tiles
```typescript
// Leaflet tile layer with attribution
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors (ODbL)',
  maxZoom: 19,
}).addTo(map);
```

### Dependencies
- `leaflet` (already in package.json, dynamically imported)
- `@types/leaflet` (dev dependency)

---

## Acceptance Criteria

| ID | Criterion | Test Method |
|----|-----------|-------------|
| AC-CM-001 | Click map → reverse geocode → fills autocomplete | E2E test |
| AC-CM-002 | Autocomplete text field = source of truth | E2E test |
| AC-CM-003 | US initial viewport (39.8283, -98.5795, zoom 4) | Visual test |
| AC-CM-004 | Reverse geocode failure → accessible toast | E2E test |
| AC-CM-005 | OSM attribution always visible | Visual test |
| AC-CM-006 | Venue list below map (text alternative) | axe-core |
| AC-CM-007 | Map decorative (`aria-hidden="true"`) | axe-core |
| AC-CM-008 | Autocomplete selection updates map marker | Integration test |
| AC-CM-009 | Keyboard accessible map interactions | Manual test |
| AC-CM-010 | Error toasts use `aria-live="assertive"` | axe-core |

---

## Rollout Plan

1. **Branch**: `feat/click-map-v2`
2. **Implement** component + sync logic
3. **Test** unit + integration + accessibility
4. **Merge** to `integration/healthreach-redesign`
5. **Verify** no regression in brief form

---

*Related: [LocationAutocomplete v2](LOCATION_AUTOCOMPLETE_V2.md) · [US-Focused](US_FOCUSED.md) · [API Contracts](../api/API_CONTRACTS.md)*