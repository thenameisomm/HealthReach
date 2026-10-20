# Data Flow — HealthReach AI

## End-to-End Data Flow

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                              HEALTHREACH DATA FLOW                                   │
└────────────────────────────────────────────────────────────────────────────────────┘

  ORGANIZER                                                        HEALTHREACH AI
  ─────────                                                        ──────────────
      │                                                                │
      │  1. Brief Form                                                │
      │  ───────────                                                  │
      │  topic: "Free diabetes screening"                             │
      │  location: "East Austin, TX"                                  │
      │  audience: ages 30-60                                         │
      │  budget: $5,000                                               │
      │  duration: 7 days                                             │
      │  objective: screening                                         │
      │                                                                │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ POST /api/campaigns                                                │
│ { brief: CampaignBrief, mode: "real" }                             │
└────────────────────────────────────────────────────────────────────┘
      │                                                                │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ 2. Geocode (Nominatim)                                             │
│ ───────────────────────                                            │
│ GET /search?q=East+Austin%2C+TX&countrycodes=us&format=jsonv2     │
│                                                                    │
│ Response:                                                          │
│ { display_name: "East Austin, Austin, Travis County, Texas, USA", │
│   lat: 30.2500, lon: -97.7167, provenance: "geo" }                │
└────────────────────────────────────────────────────────────────────┘
      │                                                                │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ Campaign Created                                                   │
│ ─────────────────                                                  │
│ Campaign { id: "cam_abc123", brief, geocode, mode: "real",        │
│            created_at: "2026-10-20T15:30:00Z" }                   │
│                                                                    │
│ Stored in MongoDB (or in-memory fallback)                         │
└────────────────────────────────────────────────────────────────────┘
      │                                                                │
      │  3. Evidence Request                                          │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ POST /api/campaigns/cam_abc123/evidence                            │
└────────────────────────────────────────────────────────────────────┘
      │                                                                │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ 4a. Qloo 3-Step Agent Chain (Parallel with 4b)                     │
│ ──────────────────────────────────────────                          │
│                                                                    │
│ STEP 1: Place Affinities                                           │
│ GET /v2/insights?filter.type=urn:entity:place                     │
│     &filter.location.query=East+Austin%2C+TX                      │
│     &filter.location.radius=5000                                   │
│     &feature.explainability=true                                   │
│                                                                    │
│ Response → places[0..7] → QlooSignal(kind="place-affinity", ...)  │
│ Step persisted: QlooChainStep(step=1, title="Looked at culture    │
│   spots near here", asked="Which places near East Austin match   │
│   the local crowd's taste?", found="3 places — for example:      │
│   East Austin Community Center, ...", next="Now asking: what     │
│   else do fans of East Austin Community Center also like?")      │
│                                                                    │
│ STEP 2: Taste Tags from Top Place                                  │
│ GET /v2/insights?filter.type=urn:tag                              │
│     &signal.interests.entities=ent_12345                          │
│     &signal.location.query=East+Austin%2C+TX                      │
│                                                                    │
│ Response → tags[0..5] → QlooSignal(kind="tag-affinity", ...)      │
│ Step persisted: QlooChainStep(step=2, title="Checked what fans   │
│   of East Austin Community Center also like", ...)               │
│                                                                    │
│ STEP 3: Cross-Check with Second Place                              │
│ GET /v2/insights?filter.type=urn:tag                              │
│     &signal.interests.entities=ent_67890                          │
│     &signal.location.query=East+Austin%2C+TX                      │
│                                                                    │
│ Response → overlap analysis → QlooSignal(kind="tag-affinity", ...)│
│ Step persisted: QlooChainStep(step=3, title="Double-checked       │
│   with Second Place", found="2 of the same tags appeared...")    │
│                                                                    │
│ Aggregated:                                                        │
│ EvidenceSnapshot {                                                │
│   campaign_id: "cam_abc123",                                      │
│   qloo_signals: [QlooSignal, ...],                                │
│   qloo_steps: [QlooChainStep, ...],                               │
│   qloo_status: "ok" | "thin" | "unavailable",                    │
│   qloo_note: "Taste affinity, not a health or trust signal."     │
│ }                                                                  │
└────────────────────────────────────────────────────────────────────┘
      │                                                                │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ 4b. OSM Venue Discovery (Parallel with 4a)                         │
│ ───────────────────────────────────────────                         │
│                                                                    │
│ Overpass Query (3-endpoint failover):                              │
│ [out:json][timeout:20];                                           │
│ (                                                                  │
│   node["amenity"~"clinic|pharmacy|community_centre|library|      │
│        school"](around:1500,30.2500,-97.7167);                    │
│   node["leisure"~"park|playground"](around:1500,30.2500,-97.7167)│
│ );                                                                 │
│ out 20;                                                            │
│                                                                    │
│ Response → GeoVenue[] with needs_verification: true               │
│                                                                    │
│ EvidenceSnapshot updated with:                                     │
│   geo_venues: [GeoVenue, ...],                                    │
│   geo_status: "ok" | "thin" | "unavailable",                      │
│   geo_note: "Few mapped community venues in this radius."        │
└────────────────────────────────────────────────────────────────────┘
      │                                                                │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ 5. Plan Generation                                                 │
│ ───────────────────                                                │
│ POST /api/campaigns/cam_abc123/plan                                │
│                                                                    │
│ Planner receives:                                                  │
│   - CampaignBrief                                                 │
│   - GeocodeResult                                                 │
│   - EvidenceSnapshot (qloo_signals, qloo_steps, geo_venues)      │
│                                                                    │
│ Deterministic Planner (always runs):                              │
│   - Activities: 3-5 items grounded on evidence refs               │
│   - Venues: 3-5 candidates from geo_venues with reasons          │
│   - Budget: line items summing EXACTLY to brief.budget_inr       │
│   - Materials: poster, message, script with review notice        │
│   - Metrics: 3-4 success metrics with target ranges & basis      │
│   - Assumptions & limitations                                    │
│                                                                    │
│ LLM Attempt (if LLM_API_KEY configured):                          │
│   - Prompt: evidence + brief → structured JSON                    │
│   - Validation: Pydantic Plan model                               │
│   - Repair: 1 retry on validation failure                         │
│   - Fallback: deterministic planner output used                  │
│   - planner field: "ai-model" if LLM succeeded,                  │
│     "standard-template" otherwise                                 │
│                                                                    │
│ Plan persisted with version=1 (or version++ on regen)            │
│ Plan {                                                            │
│   campaign_id: "cam_abc123",                                      │
│   version: 1,                                                     │
│   summary: "...",                                                 │
│   activities: [PlanActivity, ...],                                │
│   venues: [VenueCandidate, ...],                                  │
│   budget: [BudgetLine, ...],                                      │
│   budget_total_inr: 5000,                                         │
│   materials: [DraftMaterial, ...],                                │
│   metrics: [SuccessMetric, ...],                                  │
│   planner: "standard-template",                                   │
│   created_at: "2026-10-20T15:31:00Z"                              │
│ }                                                                  │
└────────────────────────────────────────────────────────────────────┘
      │                                                                │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ 6. Organizer Reviews Plan → Campaign Runs in Real World           │
│ ─────────────────────────────────────────────────────────          │
│                                                                    │
│ [Time passes... organizer executes camp]                          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
      │                                                                │
      │  7. Results Entry                                             │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ POST /api/campaigns/cam_abc123/results                             │
│ { registrations: 180, attendance: 135, spend_inr: 4850,           │
│   engagement: 320, notes: "Rain on day 2 reduced turnout" }       │
│                                                                    │
│ Results stored (aggregate only)                                    │
└────────────────────────────────────────────────────────────────────┘
      │                                                                │
      ▼                                                                │
┌────────────────────────────────────────────────────────────────────┐
│ 8. Analytics (Planned vs Actual)                                   │
│ ────────────────────────────────────                               │
│ GET /api/campaigns/cam_abc123/analytics                            │
│                                                                    │
│ Computed from:                                                     │
│   - Plan.metrics (target_range, basis)                            │
│   - ResultsInput (actual counts)                                  │
│                                                                    │
│ Analytics {                                                        │
│   planned_registrations: "150-200",                               │
│   actual_registrations: 180,                                      │
│   planned_attendance: "100-150",                                  │
│   actual_attendance: 135,                                         │
│   planned_spend_inr: 5000,                                        │
│   actual_spend_inr: 4850,                                         │
│   cost_per_registration: 26.94,                                   │
│   attendance_rate: 0.75,                                          │
│   note: "Descriptive comparison only. Differences may reflect    │
│         many factors and do not prove the plan caused the        │
│         outcome."                                                 │
│ }                                                                  │
└────────────────────────────────────────────────────────────────────┘
```

## Data Persistence Model

```
MongoDB Collections (or in-memory equivalent)
════════════════════════════════════════════

campaigns
├── _id: ObjectId
├── id: "cam_abc123" (string, unique)
├── brief: CampaignBrief (embedded)
├── geocode: GeocodeResult (embedded)
├── mode: "real" | "demo"
├── created_at: datetime
└── updated_at: datetime

evidence_snapshots
├── _id: ObjectId
├── campaign_id: "cam_abc123" (ref)
├── qloo_signals: [QlooSignal] (embedded)
├── qloo_steps: [QlooChainStep] (embedded)
├── geo_venues: [GeoVenue] (embedded)
├── qloo_status: "ok" | "thin" | "unavailable"
├── qloo_note: string
├── geo_status: "ok" | "thin" | "unavailable"
├── geo_note: string
├── created_at: datetime

plans
├── _id: ObjectId
├── campaign_id: "cam_abc123" (ref)
├── version: int (1, 2, 3...)
├── summary: string
├── activities: [PlanActivity] (embedded)
├── venues: [VenueCandidate] (embedded)
├── budget: [BudgetLine] (embedded)
├── budget_total_inr: int
├── materials: [DraftMaterial] (embedded)
├── metrics: [SuccessMetric] (embedded)
├── assumptions: [string]
├── limitations: [string]
├── has_cultural_signals: bool
├── planner: "ai-model" | "standard-template"
├── created_at: datetime

results
├── _id: ObjectId
├── campaign_id: "cam_abc123" (ref)
├── registrations: int
├── attendance: int
├── spend_inr: int
├── engagement: int
├── notes: string
├── created_at: datetime

ext_cache (TTL index for external responses)
├── _id: ObjectId
├── key: string (SHA-256 of request)
├── response: document
├── created_at: datetime (TTL: 24h)
```

## Provenance Propagation

```
Source                    │ Propagates To
──────────────────────────┼─────────────────────────────────────────────
Nominatim geocode         │ Campaign.geocode.provenance = "geo"
                          │ EvidenceSnapshot.geo_venues[].provenance = "geo"
Qloo Step 1 (places)      │ QlooSignal(kind="place-affinity", provenance="qloo")
                          │ QlooChainStep(step=1, provenance="qloo")
Qloo Step 2 (tags)        │ QlooSignal(kind="tag-affinity", provenance="qloo")
                          │ QlooChainStep(step=2, provenance="qloo")
Qloo Step 3 (cross-check) │ QlooSignal(kind="tag-affinity", provenance="qloo")
                          │ QlooChainStep(step=3, provenance="qloo")
LLM Plan Prose            │ PlanActivity.provenance = "ai"
                          │ VenueCandidate.provenance = "ai"
                          │ BudgetLine.provenance = "ai"
                          │ DraftMaterial.provenance = "ai"
                          │ SuccessMetric.provenance = "ai"
Deterministic Planner     │ All above = "ai" (labeled "standard-template")
Organizer Input           │ Campaign.brief fields provenance = "user"
                          │ ResultsInput provenance = "user"
Demo Data                 │ All fields provenance = "illustrative"
```

## Cache Behavior

| Cache | Key | TTL | Invalidation |
|---|---|---|---|
| Nominatim geocode | `location_text.lower()` | 24h | Manual clear or TTL expiry |
| Nominatim suggest | `query.lower()` | 1h | Manual clear or TTL expiry |
| Nominatim reverse | `rev:{lat:.4f}:{lon:.4f}` | 24h | Manual clear or TTL expiry |
| Qloo responses | Not cached (per-campaign snapshot stored) | N/A | N/A |
| Overpass responses | Not cached (per-campaign snapshot stored) | N/A | N/A |
| LLM responses | Not cached | N/A | N/A |

---

*Related: [System Overview](SYSTEM_OVERVIEW.md) · [Agent Orchestration](AGENT_ORCHESTRATION.md) · [API Contracts](../api/API_CONTRACTS.md)*