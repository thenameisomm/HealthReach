# Data Model — HealthReach AI

## Overview

HealthReach uses a **document-oriented model** with MongoDB (or in-memory fallback). All models are defined as Pydantic v2 classes in `apps/api/app/models/__init__.py` and mirrored in TypeScript via `apps/web/lib/api.ts`.

## Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────────┐
│  Campaign   │──────▶│  EvidenceSnapshot    │
│             │  1:1  │                      │
│ - brief     │       │ - qloo_signals[]     │
│ - geocode   │       │ - qloo_steps[]       │
│ - mode      │       │ - geo_venues[]       │
└─────────────┘       │ - qloo_status        │
       │              │ - geo_status         │
       │ 1:N          └──────────────────────┘
       │
       ▼
┌─────────────┐       ┌─────────────┐       ┌──────────┐
│    Plan     │       │  Results    │       │Analytics │
│  (versioned)│       │             │       │ (derived)│
│             │       │ - counts    │       │          │
│ - version   │       │ - notes     │       │ - pvs-a  │
│ - activities│       └─────────────┘       │ - rates  │
│ - venues    │              │              │ - notes  │
│ - budget    │              ▼              └──────────┘
│ - materials │
│ - metrics   │
│ - planner   │
└─────────────┘
```

## Core Models

### Campaign
```python
class Campaign(BaseModel):
    id: str                          # "cam_abc123" (UUID-like)
    brief: CampaignBrief             # Embedded
    geocode: GeocodeResult | None    # Embedded
    mode: Literal["real", "demo"]    # "real" | "demo"
    created_at: datetime
    updated_at: datetime
```

### CampaignBrief
```python
class CampaignBrief(BaseModel):
    topic: str                       # 3-120 chars
    location_text: str               # 2-200 chars
    audience_age_min: int            # 0-120
    audience_age_max: int            # 0-120, min ≤ max
    audience_notes: str              # 0-500 chars
    budget_inr: int                  # 500-10,000,000 (planned: USD)
    duration_days: int               # 1-90
    objective: Objective             # awareness | attendance | screening | vaccination
```

### GeocodeResult
```python
class GeocodeResult(BaseModel):
    display_name: str                # "East Austin, Austin, TX, USA"
    lat: float                       # 30.25
    lon: float                       # -97.72
    provenance: Provenance = GEO
    attribution: str = "© OpenStreetMap contributors (Nominatim, ODbL)"
```

---

## Evidence Models

### QlooSignal
```python
class QlooSignal(BaseModel):
    kind: str                        # "place-affinity" | "tag-affinity" | "demographics"
    label: str                       # Human-readable name
    detail: str                      # Plain-language explanation + provenance note
    affinity: float | None           # -1.0 to 1.0 (clamped)
    popularity: float | None         # 0.0 to 1.0 (clamped)
    entity_id: str | None            # Qloo entity ID
    provenance: Provenance = QLOO
```

### QlooChainStep
```python
class QlooChainStep(BaseModel):
    step: int                        # 1, 2, or 3
    title: str                       # "Looked at culture spots near here"
    asked: str                       # Question asked
    found: str = ""                  # What was found
    next: str = ""                   # What happens next
    top_names: list[str] = []        # Top 3 names for UI
    status: Literal["ok", "skip"] = "ok"
    skip_reason: str = ""            # Plain language if skipped
    provenance: Provenance = QLOO
```

### GeoVenue
```python
class GeoVenue(BaseModel):
    name: str                        # Venue name (max 120 chars)
    category: str                    # OSM category (max 80 chars)
    address: str | None              # Composed from addr:road, suburb, city
    lat: float | None                # Latitude
    lon: float | None                # Longitude
    distance_m: int | None           # Meters from campaign center
    provenance: Provenance = GEO
    needs_verification: bool = True  # ALWAYS TRUE
```

### EvidenceSnapshot
```python
class EvidenceSnapshot(BaseModel):
    campaign_id: str                 # Ref to Campaign
    qloo_signals: list[QlooSignal] = []
    qloo_steps: list[QlooChainStep] = []  # Additive for older snapshots
    geo_venues: list[GeoVenue] = []
    qloo_status: Literal["ok", "thin", "unavailable"] = "ok"
    qloo_note: str = ""
    geo_status: Literal["ok", "thin", "unavailable"] = "ok"
    geo_note: str = ""
    created_at: datetime
```

---

## Plan Models

### PlanActivity
```python
class PlanActivity(BaseModel):
    title: str
    channel: str                     # "in-person", "flyer", "social", "radio", etc.
    why: str                         # Plain-language justification
    evidence_refs: list[str] = []    # Qloo signal IDs or venue IDs
    cost_inr: int                    # ≥ 0 (planned: USD)
    provenance: Provenance = AI
```

### VenueCandidate
```python
class VenueCandidate(BaseModel):
    name: str
    reason: str                      # Why this venue
    evidence_refs: list[str] = []
    status: Literal["worth-evaluating", "verified", "rejected"] = "worth-evaluating"
    needs_verification: bool = True
    provenance: Provenance = AI
```

### BudgetLine
```python
class BudgetLine(BaseModel):
    label: str                       # "Venue rental", "Materials", "Staff", etc.
    amount_inr: int                  # ≥ 0
    provenance: Provenance = AI
```

### DraftMaterial
```python
class DraftMaterial(BaseModel):
    kind: Literal["poster", "message", "script"]
    title: str
    body: str
    review_notice: str = "Draft — requires review by a qualified health professional before use."
    provenance: Provenance = AI
```

### SuccessMetric
```python
class SuccessMetric(BaseModel):
    name: str                        # "Registrations", "Attendance", etc.
    target_range: str                # "150-200", "100-150"
    basis: str                       # "Template estimate" | "Grounded on Qloo affinity + venue capacity"
    provenance: Provenance = AI
```

### Plan
```python
class Plan(BaseModel):
    campaign_id: str
    version: int = 1                 # Increments on section regeneration
    summary: str
    activities: list[PlanActivity]
    venues: list[VenueCandidate]
    budget: list[BudgetLine]
    budget_total_inr: int            # MUST equal brief.budget_inr
    materials: list[DraftMaterial]
    metrics: list[SuccessMetric]
    assumptions: list[str] = []
    limitations: list[str] = []
    has_cultural_signals: bool = True
    planner: Literal["ai-model", "standard-template"] = "standard-template"
    created_at: datetime
```

---

## Results & Analytics Models

### ResultsInput
```python
class ResultsInput(BaseModel):
    registrations: int = Field(ge=0, le=10_000_000)
    attendance: int = Field(ge=0, le=10_000_000)
    spend_inr: int = Field(ge=0, le=100_000_000)
    engagement: int = Field(ge=0, le=10_000_000)
    notes: str = Field(default="", max_length=1000)
```

### Analytics
```python
class Analytics(BaseModel):
    planned_registrations: str       # "150-200" (from plan metric)
    actual_registrations: int
    planned_attendance: str
    actual_attendance: int
    planned_spend_inr: int
    actual_spend_inr: int
    cost_per_registration: float | None
    attendance_rate: float | None
    note: str = "Descriptive comparison only. Differences may reflect many factors and do not prove the plan caused the outcome."
```

**Null Safety**: `cost_per_registration` and `attendance_rate` are `null` when denominators are zero. UI shows "Not calculable — needs at least 1 registration".

---

## Provenance Enum

```python
class Provenance(str, Enum):
    QLOO = "qloo"
    GEO = "geo"
    AI = "ai"
    USER = "user"
    ILLUSTRATIVE = "illustrative"
```

### Provenance Propagation Rules

| Source | Propagates To |
|---|---|
| Nominatim geocode | `Campaign.geocode.provenance = GEO` |
| Qloo Step 1 places | `QlooSignal(provenance=QLOO)`, `QlooChainStep(provenance=QLOO)` |
| Qloo Step 2 tags | `QlooSignal(provenance=QLOO)`, `QlooChainStep(provenance=QLOO)` |
| Qloo Step 3 tags | `QlooSignal(provenance=QLOO)`, `QlooChainStep(provenance=QLOO)` |
| OSM venues | `GeoVenue(provenance=GEO)` |
| LLM plan prose | `PlanActivity.provenance=AI`, `VenueCandidate.provenance=AI`, etc. |
| Template planner | Same as above (labeled `standard-template`) |
| Organizer input | `Campaign.brief` fields = USER, `ResultsInput` = USER |
| Demo data | All fields = ILLUSTRATIVE |

---

## Demo Data Isolation

**File**: `apps/api/app/services/demo_data.py` — **ONLY** module allowed to define illustrative values.

- Demo campaign brief: Kothrud, Pune, diabetes screening, ₹10,000, 7 days, ages 30-60
- Demo geocode: Fixed Kothrud coordinates
- Demo evidence: Fixed Qloo signals + steps + OSM venues
- Demo plan: Fixed activities, venues, budget, materials, metrics
- All demo values carry `provenance: ILLUSTRATIVE`
- Real-mode code paths **never import** `demo_data` (enforced by architecture)

---

## Versioning & Migration

### Plan Versioning
- Initial plan: `version = 1`
- Section regeneration: `version++`, preserves other sections
- All versions stored (append-only)
- UI shows current version + "Get fresh ideas" per section

### Schema Evolution
- Pydantic v2: new fields must be optional or have defaults
- `Extra.allow` not used — strict schemas
- Additive changes only (e.g., `qloo_steps` added as optional with default)
- Old documents validate against new models

---

*Related: [MongoDB Collections](MONGODB_COLLECTIONS.md) · [Provenance Model](PROVENANCE_MODEL.md) · [Estimates & Metrics](ESTIMATES_AND_METRICS.md) · [API Contracts](api/API_CONTRACTS.md)*