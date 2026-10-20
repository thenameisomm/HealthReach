# API Overview — HealthReach AI

## Base URL

| Environment | URL |
|---|---|
| Local Development | `http://localhost:8000` |
| Production | `https://api.healthreach.example.com` |

All API routes prefixed with `/api`.

## Authentication

| Method | Description |
|---|---|
| Server-to-server | API keys in environment (Qloo, LLM, MongoDB) |
| Client-to-API | No authentication (rate-limited by IP) |
| CORS | `CORS_ORIGINS` allowlist (default: `http://localhost:3000`) |

**No user authentication** — HealthReach is a single-organizer tool without accounts.

## Rate Limiting

- **60 requests/minute/IP** on all `/api` routes
- Implemented in `apps/api/app/rate_limit.py`
- Returns `429 Too Many Requests` with `Retry-After` header

## Content Types

| Direction | Content-Type |
|---|---|
| Request | `application/json` |
| Response | `application/json` |
| Error | `application/json` (standardized format) |

## Versioning

- **No URL versioning** — additive changes only
- New fields: optional with defaults
- Breaking changes: new endpoint, old deprecated
- OpenAPI schema at `/openapi.json`
- Client parity check: `pnpm generate:api`

## Standard Response Format

### Success
```json
{
  "data": { ... },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

### Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "budget_inr", "message": "Budget must be at least $500" }
    ]
  },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Request body validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `QLOO_UNAVAILABLE` | 503 | Qloo service unavailable |
| `QLOO_AUTH_FAILED` | 503 | Qloo API key rejected |
| `QLOO_RATE_LIMITED` | 429 | Qloo rate limit exceeded |
| `GEO_UNAVAILABLE` | 503 | Nominatim/Overpass unavailable |
| `LLM_UNAVAILABLE` | 503 | LLM service unavailable |
| `PLAN_BEFORE_EVIDENCE` | 400 | Evidence required before plan |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Health & Config Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/api/config` | Integration status (no secrets) |

### `/health` Response
```json
{
  "status": "ok",
  "qloo_configured": true,
  "llm_configured": false,
  "mongodb_connected": true,
  "timestamp": "2026-10-20T15:30:00Z"
}
```

### `/api/config` Response
```json
{
  "qloo_configured": true,
  "llm_configured": false,
  "demo_mode_available": true,
  "version": "0.1.0"
}
```

## Campaign Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/campaigns` | Create campaign brief |
| GET | `/api/campaigns` | List campaigns (with stage filter) |
| GET | `/api/campaigns/{id}` | Get campaign + plan + evidence + results |
| POST | `/api/campaigns/{id}/evidence` | Gather evidence (Qloo + OSM) |
| GET | `/api/campaigns/{id}/evidence/progress` | Backend-observed Qloo progress |
| POST | `/api/campaigns/{id}/plan` | Generate/regen plan |
| POST | `/api/campaigns/{id}/results` | Save aggregate results |
| GET | `/api/campaigns/{id}/analytics` | Planned vs actual |
| GET | `/api/campaigns/{id}/plans/compare` | Section-level plan diff |
| GET | `/api/campaigns/{id}/export/csv` | Results CSV |
| GET | `/api/campaigns/{id}/export/json` | Evidence JSON (redacted) |
| GET | `/api/campaigns/{id}/export/pdf` | Plan PDF |

## Geo Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/geo/suggest?q=` | Nominatim autocomplete |
| GET | `/api/geo/reverse?lat=&lon=` | Reverse geocode |

## Demo Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/demo/scenario?scenario=us\|kothrud` | Fixed illustrative scenario |

## Request/Response Schemas

See [API Contracts](API_CONTRACTS.md) for detailed schemas.

## Client Usage

### TypeScript Client (`apps/web/lib/api.ts`)

```typescript
import { api } from '@/lib/api';

// Create campaign
const campaign = await api.campaigns.create({
  brief: { topic: "...", location_text: "...", ... },
  mode: "real"
});

// Get evidence
const evidence = await api.campaigns.getEvidence(campaign.id);

// Generate plan
const plan = await api.campaigns.generatePlan(campaign.id);

// Save results
await api.campaigns.saveResults(campaign.id, {
  registrations: 180,
  attendance: 135,
  spend_inr: 4850,
  engagement: 320
});

// Get analytics
const analytics = await api.campaigns.getAnalytics(campaign.id);
```

### Parity Check

```bash
# API must be running
pnpm generate:api
```

This hits live `/openapi.json` and verifies TypeScript client matches.

---

*Related: [API Contracts](API_CONTRACTS.md) · [Error Responses](ERROR_RESPONSES.md) · [API Change Policy](API_CHANGE_POLICY.md)*