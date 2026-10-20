# Feature Specification: LocationAutocomplete v2

## Overview

Enhanced location autocomplete for the campaign brief form (`/new`) with US-focused geocoding, debounced requests, stale request cancellation, and accessible combobox pattern.

**Current State**: Basic LocationAutocomplete exists (`apps/web/components/LocationAutocomplete.tsx`) with debounce, 120-char cap, and no re-query after selection.

**Target**: Production-ready v2 with US bias, robust stale cancellation, keyboard accessibility, and clear loading/error states.

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-LA-001 | Debounced search (300ms default, configurable) | P0 |
| FR-LA-002 | Maximum query length: 120 characters | P0 |
| FR-LA-003 | US-biased Nominatim search (`countrycodes=us`, `accept-language=en-US`) | P0 |
| FR-LA-004 | No re-query after selection (skip autocomplete for just-chosen label) | P0 |
| FR-LA-005 | Stale request cancellation (AbortController) | P0 |
| FR-LA-006 | Keyboard navigation: Arrow Up/Down, Enter, Escape | P0 |
| FR-LA-007 | Accessible combobox ARIA pattern | P0 |
| FR-LA-008 | Loading, empty, error, and selection states | P0 |
| FR-LA-009 | Input preserved on network errors; errors clear on edit | P0 |
| FR-LA-010 | Sync with ClickMap: selection updates both components | P0 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-LA-001 | Debounce delay | 300ms (configurable via prop) |
| NFR-LA-002 | Max query length | 120 characters |
| NFR-LA-003 | Nominatim rate limit compliance | Client-side throttle (handled by backend) |
| NFR-LA-004 | Accessibility | WCAG 2.1 AA, combobox pattern |
| NFR-LA-005 | Touch targets | ≥ 48×48px |

---

## API Contract

### Endpoint: `GET /api/geo/suggest`

**Query Parameters:**
- `q` (string, required): Search query (min 3 chars, max 120 chars)

**Response (200):**
```json
{
  "data": {
    "suggestions": [
      {
        "display_name": "East Austin, Austin, Travis County, Texas, USA",
        "lat": 30.2500,
        "lon": -97.7167,
        "type": "suburb"
      }
    ],
    "status": "ok",
    "note": ""
  },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

**Error Responses:**
- 400: Query too short (< 3 chars)
- 503: Nominatim unavailable (honest status)

---

## Component Specification

### Props Interface

```typescript
interface LocationAutocompleteProps {
  value: string;                    // Current input value (source of truth)
  onChange: (value: string) => void; // Input change handler
  onSelect: (location: ResolvedLocation) => void; // Selection handler
  disabled?: boolean;
  debounceMs?: number;              // Default: 300
  maxLength?: number;               // Default: 120
  placeholder?: string;             // Default: "Enter location..."
  ariaLabel?: string;               // Default: "Search location"
}

interface ResolvedLocation {
  display_name: string;  // What shows in input
  lat: number;
  lon: number;
  type: string;          // Nominatim type (city, suburb, etc.)
}
```

### State Management

```typescript
interface LocationAutocompleteState {
  query: string;                    // User-typed text
  suggestions: Suggestion[];
  selectedIndex: number;            // Keyboard navigation
  status: 'idle' | 'loading' | 'success' | 'error' | 'unavailable';
  error: string | null;
  lastSelectedLabel: string | null; // For no-re-query optimization
}
```

### Key Behaviors

#### Debounce & Request Cancellation
```typescript
// On query change:
1. Clear existing timeout
2. Set new timeout (debounceMs)
3. If query.length < 3: clear suggestions, return
4. If query === lastSelectedLabel: skip request (no-re-query)
5. Abort previous in-flight request (AbortController)
6. Fire new request with new AbortSignal
7. On response: update suggestions, clear error
8. On abort: ignore
9. On error: set status='error' or 'unavailable'
```

#### Keyboard Navigation
| Key | Action |
|-----|--------|
| Arrow Down | Move selection down (wrap at bottom) |
| Arrow Up | Move selection up (wrap at top) |
| Enter | Select highlighted suggestion |
| Escape | Close dropdown, clear selection index |
| Tab | Close dropdown (if open) |

#### No Re-Query After Selection
- Store `lastSelectedLabel` on selection
- Before firing request: `if (query === lastSelectedLabel) return`
- Clear `lastSelectedLabel` when user types new query (input change)

#### Stale Request Cancellation
- Each request gets unique `AbortController`
- On new query: `controller.abort()`, create new controller
- In fetch: pass `signal: controller.signal`
- Ignore `AbortError` in catch block

---

## Accessibility (Combobox Pattern)

### ARIA Attributes

```tsx
<input
  role="combobox"
  aria-autocomplete="list"
  aria-controls="location-suggestions"
  aria-expanded={suggestions.length > 0}
  aria-activedescendant={highlightedId}
  aria-label="Search location"
  aria-describedby={errorId}
/>

<ul id="location-suggestions" role="listbox">
  {suggestions.map((s, i) => (
    <li
      key={i}
      role="option"
      id={`location-option-${i}`}
      aria-selected={i === selectedIndex}
    >
      {s.display_name}
    </li>
  ))}
</ul>
```

### Screen Reader Announcements
- On suggestions load: `aria-live="polite"` announces count
- On selection: announce selected location
- On error: `aria-live="assertive"` for error message

---

## Error States

| Scenario | UI Behavior |
|----------|-------------|
| Network offline | "You're offline. Your input is saved — try again when connected." |
| Timeout | "The request took too long. Your input is safe — try again." |
| Service unavailable | "Location service temporarily unavailable. Try again in a moment." |
| No results | "No matches found for '{query}'. Try a different search." |
| Query too short | No error (wait for 3 chars) |

**Input Preservation**: Text field value never cleared by errors. Errors clear on user edit.

---

## Testing Requirements

### Unit Tests
- [ ] Debounce timing (300ms default)
- [ ] Query cap (120 chars)
- [ ] Selection fills field + stores coords
- [ ] No re-query after selection
- [ ] Stale request cancellation
- [ ] Keyboard navigation (arrows, Enter, Escape)
- [ ] US bias in suggestions (mocked)
- [ ] Error states render correctly
- [ ] Input preserved on error
- [ ] Accessibility: ARIA attributes, keyboard nav

### Integration Tests
- [ ] Autocomplete → selection → brief submit → geocode stored
- [ ] ClickMap sync: map click → reverse geocode → autocomplete updated

### Accessibility Tests (axe-core)
- [ ] Combobox ARIA pattern
- [ ] Keyboard navigation
- [ ] Screen reader announcements
- [ ] Color contrast
- [ ] Focus management

---

## Implementation Notes

### Files to Modify
- `apps/web/components/LocationAutocomplete.tsx` — Main component
- `apps/web/app/new/page.tsx` — Integration with brief form
- `apps/api/app/services/geo_client.py` — Add US bias params

### Backend Changes (`geo_client.py`)
```python
# In suggest_locations():
params = {
    "q": q,
    "format": "jsonv2",
    "limit": limit,
    "countrycodes": "us",           # NEW: US bias
    "accept-language": "en-US",     # NEW: English results
}
```

### Dependencies
- No new dependencies (uses existing fetch/AbortController)

---

## Acceptance Criteria

| ID | Criterion | Test Method |
|----|-----------|-------------|
| AC-LA-001 | Debounce fires after 300ms of inactivity | Unit test with fake timers |
| AC-LA-002 | Queries > 120 chars truncated | Unit test |
| AC-LA-003 | US locations prioritized in results | Integration test (mocked) |
| AC-LA-004 | Selecting "East Austin" doesn't re-query "East Austin" | Unit test |
| AC-LA-005 | Rapid typing cancels previous requests | Unit test with AbortController |
| AC-LA-006 | Arrow keys navigate, Enter selects, Escape closes | E2E test |
| AC-LA-007 | Screen reader announces suggestion count | axe-core + manual |
| AC-LA-008 | Error message shown, input preserved | E2E test |
| AC-LA-009 | ClickMap selection updates autocomplete | Integration test |

---

## Rollout Plan

1. **Branch**: `feat/location-autocomplete-v2`
2. **Implement** component + backend changes
3. **Test** unit + integration + accessibility
4. **Merge** to `integration/healthreach-redesign`
5. **Verify** no regression in brief form

---

*Related: [ClickMap v2](CLICK_MAP_V2.md) · [US-Focused](US_FOCUSED.md) · [API Contracts](../api/API_CONTRACTS.md)*