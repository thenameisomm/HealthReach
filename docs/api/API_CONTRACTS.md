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
    "budget_usd": "integer (500-10000000, USD campaigns)",
    "budget_inr": "integer (500-10000000, INR campaigns)",
    "currency": "USD | INR (defaults from the budget field present)",
    "duration_days": "integer (1-90)",
    "objective": "awareness | attendance | screening | vaccination"
  },
  "mode": "real | demo",
  "scenario": "kothrud | us (demo mode only; default kothrud)"
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
    "demo_scenario": "kothrud | us | null",
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

### GET /api/campaigns/{id}/evidence/progress

Backend-observed Qloo progress for a request in flight, or the stored step
summary after completion. Poll while the evidence phase runs.

**Response (200):**
```json
{
  "campaign_id": "cam_abc123",
  "total_requests": 4,
  "requests_by_step": { "1": 2, "2": 1, "3": 1 },
  "retries": 1,
  "cache_hits": 0,
  "steps": [
    {
      "step": 1,
      "title": "Place affinities",
      "status": "completed",
      "requests_made": 2,
      "retries": 1,
      "cache_hits": 0,
      "started_at": "ISO8601 datetime",
      "completed_at": "ISO8601 datetime",
      "skip_reason": ""
    }
  ],
  "overall_status": "pending | in_progress | completed | failed",
  "current_step": 2,
  "attribution": "Qloo Insights — taste/cultural signals only"
}
```

`status` per step is `pending | in_progress | completed | skipped | failed`.
Retries and cache hits are reported separately; skipped steps always carry a
plain-language `skip_reason`. Older campaigns without live progress fall back
to stored `qloo_steps`.

**Errors:** 404 (campaign not found)

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
    "budget_total_usd": "integer | null",
    "budget_total_inr": "integer | null",
    "currency": "USD | INR",
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
  "spend_usd": "integer (0-100000000, USD campaigns)",
  "spend_inr": "integer (0-100000000, INR campaigns)",
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
    "spend_usd": "integer | null",
    "spend_inr": "integer | null",
    "engagement": "integer",
    "notes": "string",
    "created_at": "ISO8601 datetime"
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

**Errors:** 404 (campaign not found), 422 (validation), 400 (results currency
does not match the campaign currency)

---

### GET /api/campaigns/{id}/analytics

Get planned-vs-actual analytics.

**Response with results (200):**
```json
{
  "hasResults": true,
  "currency": "USD",
  "analytics": {
    "currency": "USD",
    "planned_registrations": "string (range, e.g., '60-150')",
    "actual_registrations": "integer",
    "planned_attendance": "string (range)",
    "actual_attendance": "integer",
    "planned_engagement": "string (range or 'Not stated in plan')",
    "actual_engagement": "integer",
    "planned_spend": "integer",
    "actual_spend": "integer",
    "planned_spend_usd": "integer | null",
    "planned_spend_inr": "integer | null",
    "actual_spend_usd": "integer | null",
    "actual_spend_inr": "integer | null",
    "cost_per_registration": "number | null",
    "cost_per_attendee": "number | null",
    "attendance_rate": "number | null (0-1)",
    "note": "Descriptive comparison only. Differences may reflect many factors and do not prove the plan caused the outcome."
  },
  "results": ResultsInput
}
```

**Response before results (200):**
```json
{
  "hasResults": false,
  "currency": "USD",
  "planned_spend": "integer",
  "planned_range": "string"
}
```

Currency lives at the top level only in the no-results response; when results
exist it is inside `analytics`. Cost fields are `null` when their denominator
is zero. This route is descriptive only, never causal.

**Errors:** 404 (campaign not found)

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

## Analysis & Export Endpoints

### GET /api/campaigns/{id}/plans/compare?from_version=&to_version=

Section-level diff between two stored plan versions.

**Response (200):**
```json
{
  "campaign_id": "cam_abc123",
  "from_version": 1,
  "to_version": 2,
  "changed_sections": ["budget", "summary"],
  "changes": {
    "budget": { "from": BudgetLine[], "to": BudgetLine[] },
    "summary": { "from": "string", "to": "string" }
  }
}
```

Only changed sections are included. Raw provider payloads are never exposed.

**Errors:** 404 (campaign or either version not found)

---

### GET /api/campaigns/{id}/export/csv

Aggregate results export. Available before results (zeros) so organizers can
see the columns; includes planned and actual values plus currency.

**Response (200):** `text/csv; charset=utf-8` attachment.

---

### GET /api/campaigns/{id}/export/json

Evidence snapshot export (Qloo signals/steps, OSM venues, provenance).

**Response (200):** `application/json` attachment with PII redacted and no
secret-like keys.

**Errors:** 404 (campaign not found), 400 (evidence required first)

---

### GET /api/campaigns/{id}/export/pdf

Readable plan export (activities, venues, budget, materials, metrics, review
notice) using a minimal built-in PDF writer.

**Response (200):** `application/pdf` attachment.

**Errors:** 404 (campaign not found), 400 (plan required first)

---

## Demo Endpoints

### GET /api/demo/scenario?scenario=us|kothrud

Get a fixed illustrative demo scenario. Defaults to `kothrud` when omitted;
the landing page requests `us` first.

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

Liveness probe and active storage mode (no secrets).

**Response (200):**
```json
{
  "ok": true,
  "qlooConfigured": "boolean",
  "llmConfigured": "boolean",
  "dbMode": "mongo | memory"
}
```

### GET /api/config

Integration status (no secrets).

**Response (200):**
```json
{
  "qlooConfigured": "boolean",
  "llmConfigured": "boolean",
  "dbConfigured": "boolean",
  "dbMode": "mongo | memory"
}
```

`dbMode: memory` means the in-memory fallback is active and data is lost on
restart.

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
  budget_usd: number | null;  // present for USD campaigns
  budget_inr: number | null;  // present for INR campaigns
  currency: "USD" | "INR";
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
  cost_usd: number | null;
  cost_inr: number | null;
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
  amount_usd: number | null;
  amount_inr: number | null;
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
  spend_usd: number | null;
  spend_inr: number | null;
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
  planned_engagement: string;
  actual_engagement: number;
  planned_spend: number;
  actual_spend: number;
  planned_spend_usd: number | null;
  planned_spend_inr: number | null;
  actual_spend_usd: number | null;
  actual_spend_inr: number | null;
  cost_per_registration: number | null;
  cost_per_attendee: number | null;
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