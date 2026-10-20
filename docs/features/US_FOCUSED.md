# Feature Specification: US-Focused Product Enhancements

## Overview

Shift HealthReach defaults from India-centric (Kothrud demo) to US-centric for the target market of US community health organizers. Includes geocoding bias, currency, distance units, venue categories, and a US demo scenario.

**Current State**: Demo uses Kothrud, Pune (₹, km, Indian venue categories). Nominatim has no country bias.

**Target**: US defaults with separate, clearly labeled US demo scenario.

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-US-001 | US-biased Nominatim geocoding (`countrycodes=us`, `accept-language=en-US`) | P0 |
| FR-US-002 | USD currency formatting (`$1,234.56`) | P0 |
| FR-US-003 | Miles distance display (meters → miles, 1 decimal) | P0 |
| FR-US-004 | US venue categories (FQHC, health dept, community center, library, park, school, pharmacy) | P0 |
| FR-US-005 | US demo scenario (East Austin, TX) distinct from Kothrud | P0 |
| FR-US-006 | Clear labeling: US demo vs Kothrud demo | P0 |
| FR-US-007 | All existing functionality preserved for non-US users | P0 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-US-001 | Geocoding bias | US-first, fallback to global |
| NFR-US-002 | Currency | USD with 2 decimal places |
| NFR-US-003 | Distance | Miles (1 decimal): "0.2 mi" |
| NFR-US-004 | Venue coverage | Verify OSM tag coverage for US |
| NFR-US-005 | Demo clarity | Persistent banner distinguishing demos |

---

## Implementation Details

### 1. US-Biased Geocoding

#### Backend (`geo_client.py`)

```python
# In suggest_locations(), geocode(), reverse_geocode():
params = {
    "q": query,
    "format": "jsonv2",
    "limit": limit,
    "countrycodes": "us",           # NEW: Restrict to US
    "accept-language": "en-US",     # NEW: English results
}
```

**Behavior**:
- `countrycodes=us` restricts results to US
- `accept-language=en-US` ensures English display names
- Fallback: If no results, could retry without countrycodes (configurable)

#### Frontend (LocationAutocomplete)

```typescript
// No frontend changes needed — bias handled by backend
// Placeholder text update:
placeholder="Enter US location (city, ZIP, address)..."
```

---

### 2. USD Currency Formatting

#### Backend (`planner.py`, models)

```python
# Budget fields: budget_usd (replace budget_inr)
class CampaignBrief(BaseModel):
    budget_usd: int = Field(ge=500, le=10_000_000)  # $500 - $10M

# In planner: budget_total_usd, BudgetLine.amount_usd
```

#### Frontend (Brief Form, Plan Display)

```typescript
// Brief form input
<input
  type="number"
  step="0.01"
  min="500"
  max="10000000"
  placeholder="$5,000"
/>

// Display formatting
function formatUSD(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);  // If storing as cents
}

// Or if storing as dollars:
function formatUSD(dollars: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(dollars);
}
```

**Display Examples**:
- `$5,000` (brief form)
- `$1,234.56` (plan budget lines)
- `$26.94 per registration` (analytics)

---

### 3. Miles Distance Display

#### Backend (`geo_client.py`, models)

```python
# GeoVenue.distance_m → add computed miles
class GeoVenue(BaseModel):
    distance_m: int | None = None
    
    @property
    def distance_mi(self) -> float | None:
        if self.distance_m is None:
            return None
        return round(self.distance_m * 0.000621371, 1)
```

#### Frontend (Venue List, Map)

```typescript
function formatDistance(meters: number): string {
  const miles = meters * 0.000621371;
  if (miles < 0.1) {
    return `${Math.round(meters * 3.28084)} ft`;  // Feet for very close
  }
  return `${miles.toFixed(1)} mi`;
}

// Display: "0.2 mi" or "528 ft"
```

---

### 4. US Venue Categories

#### Overpass Query Updates (`geo_client.py`)

```python
# Current query includes: clinic, pharmacy, community_centre, library, school, park, marketplace
# US-specific additions:

US_VENUE_CATEGORIES = {
    # Healthcare
    'fqhc': 'amenity=clinic + healthcare:speciality=fqhc',
    'health_department': 'office=government + government=health',
    'community_health_center': 'amenity=clinic + healthcare:speciality=community',
    
    # Community
    'community_centre': 'amenity=community_centre',
    'library': 'amenity=library',
    'park': 'leisure=park',
    'school': 'amenity=school',
    'pharmacy': 'amenity=pharmacy',
    
    # Additional US-relevant
    'recreation_center': 'leisure=recreation_centre',
    'place_of_worship': 'amenity=place_of_worship',
    'social_facility': 'amenity=social_facility',
}
```

#### Overpass Query Template

```overpass
[out:json][timeout:20];
(
  // Healthcare
  node["amenity"="clinic"]["healthcare:speciality"="fqhc"](around:{radius},{lat},{lon});
  node["office"="government"]["government"="health"](around:{radius},{lat},{lon});
  node["amenity"="clinic"]["healthcare:speciality"="community"](around:{radius},{lat},{lon});
  node["amenity"="pharmacy"](around:{radius},{lat},{lon});
  
  // Community
  node["amenity"="community_centre"](around:{radius},{lat},{lon});
  node["amenity"="library"](around:{radius},{lat},{lon});
  node["leisure"="park"](around:{radius},{lat},{lon});
  node["leisure"="recreation_centre"](around:{radius},{lat},{lon});
  node["amenity"="school"](around:{radius},{lat},{lon});
  node["amenity"="place_of_worship"](around:{radius},{lat},{lon});
  node["amenity"="social_facility"](around:{radius},{lat},{lon});
);
out 20;
```

**Verification Needed**: Check OSM tag coverage for FQHC (`healthcare:speciality=fqhc`) and health departments (`office=government + government=health`) in US.

---

### 5. US Demo Scenario

#### New Demo Data (`demo_data.py`)

```python
# New: East Austin, TX diabetes screening camp
US_DEMO_BRIEF = CampaignBrief(
    topic="Free diabetes screening camp",
    location_text="East Austin, Austin, TX",
    audience_age_min=30,
    audience_age_max=65,
    audience_notes="Predominantly Hispanic/Latino community, Spanish-speaking preferred",
    budget_usd=5000,        # $5,000
    duration_days=7,
    objective=Objective.SCREENING
)

US_DEMO_GEOCODE = GeocodeResult(
    display_name="East Austin, Austin, Travis County, Texas, USA",
    lat=30.2500,
    lon=-97.7167,
    provenance=Provenance.GEO
)

# Demo evidence, plan, results similar structure but US values
```

#### Demo Endpoint Updates

```python
# /api/demo/scenario - add mode parameter
@app.get("/api/demo/scenario")
async def get_demo_scenario(mode: str = "kothrud"):
    if mode == "us":
        return US_DEMO_SCENARIO
    return KOTHRUD_DEMO_SCENARIO
```

#### Frontend Demo Selector

```tsx
// Landing page: two demo buttons
<div className="demo-selector">
  <button onClick={() => navigate('/new?mode=demo&kothrud')}>
    Kothrud, Pune (India) — ₹10,000
  </button>
  <button onClick={() => navigate('/new?mode=demo&us')}>
    East Austin, TX (US) — $5,000
  </button>
</div>
```

---

### 6. Clear Demo Labeling

#### Persistent Banners

```tsx
// Kothrud demo
<DemoBanner variant="kothrud">
  Illustrative data — Kothrud, Pune (India) • ₹10,000 • 7 days
</DemoBanner>

// US demo
<DemoBanner variant="us">
  Illustrative data — East Austin, TX (US) • $5,000 • 7 days
</DemoBanner>
```

#### API Response Tagging

All demo responses include `provenance: "illustrative"` on every value.

---

## API Contract Updates

### Campaign Brief

```json
// POST /api/campaigns
{
  "brief": {
    "topic": "string",
    "location_text": "string",
    "audience_age_min": 0,
    "audience_age_max": 120,
    "audience_notes": "string",
    "budget_usd": 5000,        // CHANGED: budget_inr → budget_usd
    "duration_days": 7,
    "objective": "screening"
  },
  "mode": "real"
}
```

### Plan Budget

```json
// Plan response
{
  "budget": [
    { "label": "Venue & setup", "amount_usd": 1500 },
    { "label": "Materials", "amount_usd": 1200 }
  ],
  "budget_total_usd": 5000
}
```

### Venue Distance

```json
// GeoVenue response
{
  "name": "East Austin Community Center",
  "distance_m": 300,
  "distance_mi": 0.2   // NEW
}
```

---

## Migration Strategy

### Database
- Add `budget_usd` field to `CampaignBrief` (optional, default null)
- Add `budget_total_usd` to `Plan`
- Keep `budget_inr` for backward compatibility
- Migration script: convert existing INR budgets at 1 USD = 83 INR (or keep separate)

### API Versioning
- Additive changes only (new fields optional)
- `budget_inr` still accepted, converted to USD
- New clients send `budget_usd`

---

## Verification Checklist

### OSM Tag Coverage (Manual Verification)
- [ ] FQHCs tagged with `healthcare:speciality=fqhc` in target US areas
- [ ] Health departments tagged with `office=government + government=health`
- [ ] Community centers, libraries, parks, schools, pharmacies well-covered
- [ ] Query returns relevant results in test US locations

### Geocoding Tests
- [ ] "East Austin, TX" → returns US result
- [ ] "Austin" without state → returns US Austin (not global)
- [ ] ZIP codes work (e.g., "78702")
- [ ] Fallback to global if no US results (configurable)

### Currency Tests
- [ ] Brief form accepts USD, shows `$` prefix
- [ ] Plan budget displays `$1,234` format
- [ ] Analytics shows `$26.94 per registration`
- [ ] No INR symbols in US mode

### Distance Tests
- [ ] Venue list shows "0.2 mi" not "300 m"
- [ ] Map tooltips show miles
- [ ] Feet for very close venues (< 0.1 mi)

### Demo Tests
- [ ] Kothrud demo still works (mode=demo)
- [ ] US demo works (mode=demo&us)
- [ ] Both show "Illustrative data" banner
- [ ] Both tagged `provenance: illustrative`

---

## Acceptance Criteria

| ID | Criterion | Test Method |
|----|-----------|-------------|
| AC-US-001 | Nominatim returns US results for "East Austin" | Integration test |
| AC-US-002 | Budget displays as `$5,000` | Visual test |
| AC-US-003 | Venue distance shows "0.2 mi" | Visual test |
| AC-US-004 | Overpass query returns FQHCs, health depts | Integration test |
| AC-US-005 | US demo selectable from landing page | E2E test |
| AC-US-006 | Both demos show "Illustrative data" banner | Visual test |
| AC-US-007 | No INR symbols in US mode | Visual test |
| AC-US-008 | Existing INR campaigns still work | Regression test |

---

## Rollout Plan

1. **Branch**: `feat/us-focused`
2. **Backend**: Geo bias, USD fields, US venue query, US demo data
3. **Frontend**: Currency formatting, miles display, demo selector
4. **Test** all acceptance criteria
5. **Merge** to `integration/healthreach-redesign`

---

*Related: [LocationAutocomplete v2](LOCATION_AUTOCOMPLETE_V2.md) · [ClickMap v2](CLICK_MAP_V2.md) · [Demo Data](../../apps/api/app/services/demo_data.py)*