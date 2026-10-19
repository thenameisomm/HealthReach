# API Contracts — HealthReach AI

## Overview

This document specifies the request/response schemas for all HealthReach API endpoints. Schemas are defined in `apps/api/app/models/__init__.py` (Pydantic v2) and mirrored in `apps/web/lib/api.ts` (TypeScript).

## Campaign Endpoints

### POST /api/campaigns

Create a new campaign brief.

**Request:**
```json
{
  "brief": {
    "topic": "string (3-120 chars)",
    "location_text": "string (2-200 chars)",
    "audience_age_min": "integer (0-120)",
    "audience_age_max": "integer (0-120)",
    "audience_notes": "string (0-500 chars, optional)",
    "budget_inr": "integer (500-10000000)",
    "duration_days": "integer (1-90)",
    "objective": "awareness | attendance | screening | vaccination"
  },
  "mode": "real | demo"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "cam_abc123",
    "brief": { ... },
    "geocode": {
      "display_name": "string",
      "lat": "number",
      "lon": "number",
      "provenance": "geo",
      "attribution": "string"
    } | null,
    "mode": "real | demo",
    "created_at": "ISO8601 datetime"
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

**Errors:** 422 (validation), 503 (geocode unavailable)

---

### GET /api/campaigns

List campaigns with optional stage filter.

**Query Parameters:**
- `stage`: `brief` | `info` | `plan` | `results` (additive filter)

**Response (200):**
```json
{
  "data": [
    {
      "id": "cam_abc123",
      "brief": { "topic": "string", "location_text": "string" },
      "mode": "real | demo",
      "created_at": "ISO8601 datetime",
      "current_stage": "brief | info | plan | results",
      "next_step": "string"
    }
  ],
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

---

### GET /api/campaigns/{id}

Get full campaign with plan, evidence, and results.

**Response (200):**
```json
{
  "data": {
    "campaign": { ... },
    "evidence": EvidenceSnapshot | null,
    "plans": Plan[],
    "results": ResultsInput | null,
    "analytics": Analytics | null
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

**Errors:** 404 (not found)

---

### POST /api/campaigns/{id}/evidence

Gather Qloo cultural signals and OSM venues for the campaign.

**Request:** Empty body `{}`

**Response (200):**
```json
{
  "data": {
    "campaign_id": "cam_abc123",
    "qloo_signals": QlooSignal[],
    "qloo_steps": QlooChainStep[],
    "geo_venues": GeoVenue[],
    "qloo_status": "ok | thin | unavailable",
    "qloo_note": "string",
    "geo_status": "ok | thin | unavailable",
    "geo_note": "string",
    "created_at": "ISO8601 datetime"
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

**Errors:** 404 (campaign not found), 400 (evidence already exists), 503 (Qloo/OSM unavailable)

---

### POST /api/campaigns/{id}/plan

Generate or regenerate a campaign plan.

**Request:**
```json
{
  "section": "activities | venues | budget | materials | metrics" // optional, for regeneration
}
```

**Response (200):**
```json
{
  "data": {
    "campaign_id": "cam_abc123",
    "version": "integer",
    "summary": "string",
    "activities": PlanActivity[],
    "venues": VenueCandidate[],
    "budget": BudgetLine[],
    "budget_total_inr": "integer",
    "materials": DraftMaterial[],
    "metrics": SuccessMetric[],
    "assumptions": "string[]",
    "limitations": "string[]",
    "has_cultural_signals": "boolean",
    "planner": "ai-model | standard-template",
    "created_at": "ISO8601 datetime"
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

**Errors:** 404 (campaign not found), 400 (evidence required first), 503 (LLM unavailable → falls back)

---

### POST /api/campaigns/{id}/results

Save aggregate campaign results.

**Request:**
```json
{
  "registrations": "integer (0-10000000)",
  "attendance": "integer (0-10000000)",
  "spend_inr": "integer (0-100000000)",
  "engagement": "integer (0-10000000)",
  "notes": "string (0-1000 chars, optional)"
}
```

**Response (200):**
```json
{
  "data": {
    "campaign_id": "cam_abc123",
    "registrations": "integer",
    "attendance": "integer",
    "spend_inr": "integer",
    "engagement": "integer",
    "notes": "string",
    "created_at": "ISO8601 datetime"
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

**Errors:** 404 (campaign not found), 422 (validation)

---

### GET /api/campaigns/{id}/analytics

Get planned-vs-actual analytics.

**Response (200):**
```json
{
  "data": {
    "planned_registrations": "string (range, e.g., '150-200')",
    "actual_registrations": "integer",
    "planned_attendance": "string (range)",
    "actual_attendance": "integer",
    "planned_spend_inr": "integer",
    "actual_spend_inr": "integer",
    "cost_per_registration": "number | null",
    "attendance_rate": "number | null",
    "note": "Descriptive comparison only. Differences may reflect many factors and do not prove the plan caused the outcome."
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

**Errors:** 404 (campaign not found), 400 (results not entered)

---

## Geo Endpoints

### GET /api/geo/suggest?q={query}

Nominatim autocomplete for location search.

**Query Parameters:**
- `q`: string (min 3 chars, max 120)

**Response (200):**
```json
{
  "data": {
    "suggestions": [
      {
        "display_name": "string",
        "lat": "number",
        "lon": "number",
        "type": "string"
      }
    ],
    "status": "ok | unavailable",
    "note": "string"
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

**Errors:** 400 (query too short), 503 (Nominatim unavailable)

---

### GET /api/geo/reverse?lat={lat}&lon={lon}

Reverse geocode a map click.

**Query Parameters:**
- `lat`: number (-90 to 90)
- `lon`: number (-180 to 180)

**Response (200):**
```json
{
  "data": {
    "display_name": "string",
    "lat": "number",
    "lon": "number",
    "provenance": "geo",
    "attribution": "© OpenStreetMap contributors (Nominatim, ODbL)"
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

**Errors:** 400 (invalid coordinates), 503 (Nominatim unavailable)

---

## Demo Endpoints

### GET /api/demo/scenario

Get fixed Kothrud demo scenario.

**Response (200):**
```json
{
  "data": {
    "brief": CampaignBrief,
    "geocode": GeocodeResult,
    "mode": "demo"
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

---

## Health & Config Endpoints

### GET /health

Liveness probe.

**Response (200):**
```json
{
  "status": "ok",
  "qloo_configured": "boolean",
  "llm_configured": "boolean",
  "mongodb_connected": "boolean",
  "timestamp": "ISO8601 datetime"
}
```

### GET /api/config

Integration status (no secrets).

**Response (200):**
```json
{
  "qloo_configured": "boolean",
  "llm_configured": "boolean",
  "demo_mode_available": "boolean",
  "version": "string"
}
```

---

## Shared Schemas

### CampaignBrief
```typescript
interface CampaignBrief {
  topic: string;
  location_text: string;
  audience_age_min: number;
  audience_age_max: number;
  audience_notes: string;
  budget_inr: number;        // planned: budget_usd
  duration_days: number;
  objective: "awareness" | "attendance" | "screening" | "vaccination";
}
```

### GeocodeResult
```typescript
interface GeocodeResult {
  display_name: string;
  lat: number;
  lon: number;
  provenance: "geo";
  attribution: string;
}
```

### QlooSignal
```typescript
interface QlooSignal {
  kind: "place-affinity" | "tag-affinity" | "demographics";
  label: string;
  detail: string;
  affinity: number | null;      // -1 to 1
  popularity: number | null;    // 0 to 1
  entity_id: string | null;
  provenance: "qloo";
}
```

### QlooChainStep
```typescript
interface QlooChainStep {
  step: 1 | 2 | 3;
  title: string;
  asked: string;
  found: string;
  next: string;
  top_names: string[];
  status: "ok" | "skip";
  skip_reason: string;
  provenance: "qloo";
}
```

### GeoVenue
```typescript
interface GeoVenue {
  name: string;
  category: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  distance_m: number | null;
  provenance: "geo";
  needs_verification: boolean;
}
```

### EvidenceSnapshot
```typescript
interface EvidenceSnapshot {
  campaign_id: string;
  qloo_signals: QlooSignal[];
  qloo_steps: QlooChainStep[];
  geo_venues: GeoVenue[];
  qloo_status: "ok" | "thin" | "unavailable";
  qloo_note: string;
  geo_status: "ok" | "thin" | "unavailable";
  geo_note: string;
  created_at: string;
}
```

### PlanActivity
```typescript
interface PlanActivity {
  title: string;
  channel: string;
  why: string;
  evidence_refs: string[];
  cost_inr: number;             // planned: cost_usd
  provenance: "ai";
}
```

### VenueCandidate
```typescript
interface VenueCandidate {
  name: string;
  reason: string;
  evidence_refs: string[];
  status: "worth-evaluating" | "verified" | "rejected";
  needs_verification: boolean;
  provenance: "ai";
}
```

### BudgetLine
```typescript
interface BudgetLine {
  label: string;
  amount_inr: number;           // planned: amount_usd
  provenance: "ai";
}
```

### DraftMaterial
```typescript
interface DraftMaterial {
  kind: "poster" | "message" | "script";
  title: string;
  body: string;
  review_notice: string;
  provenance: "ai";
}
```

### SuccessMetric
```typescript
interface SuccessMetric {
  name: string;
  target_range: string;
  basis: string;
  provenance: "ai";
}
```

### Plan
```typescript
interface Plan {
  campaign_id: string;
  version: number;
  summary: string;
  activities: PlanActivity[];
  venues: VenueCandidate[];
  budget: BudgetLine[];
  budget_total_inr: number;
  materials: DraftMaterial[];
  metrics: SuccessMetric[];
  assumptions: string[];
  limitations: string[];
  has_cultural_signals: boolean;
  planner: "ai-model" | "standard-template";
  created_at: string;
}
```

### ResultsInput
```typescript
interface ResultsInput {
  registrations: number;
  attendance: number;
  spend_inr: number;            // planned: spend_usd
  engagement: number;
  notes: string;
}
```

### Analytics
```typescript
interface Analytics {
  planned_registrations: string;
  actual_registrations: number;
  planned_attendance: string;
  actual_attendance: number;
  planned_spend_inr: number;
  actual_spend_inr: number;
  cost_per_registration: number | null;
  attendance_rate: number | null;
  note: string;
}
```

---

## Provenance Values

All models include `provenance` field with one of:
- `"qloo"` — Qloo cultural affinity signals
- `"geo"` — OpenStreetMap/Nominatim/Overpass
- `"ai"` — LLM or deterministic template planner
- `"user"` — Organizer input
- `"illustrative"` — Demo data only

---

## Versioning & Compatibility

- **Additive only**: New fields are optional with defaults
- **No breaking changes** without new endpoint
- **OpenAPI schema**: `/openapi.json`
- **Client parity**: `pnpm generate:api` verifies TypeScript client matches

---

*Related: [API Overview](API_OVERVIEW.md) · [Error Responses](ERROR_RESPONSES.md) · [API Change Policy](API_CHANGE_POLICY.md)*