# Error Responses — HealthReach AI

## Error Response Format

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": [
      { "field": "field_name", "message": "Field-specific message" }
    ]
  },
  "meta": { "timestamp": "ISO8601 datetime" }
}
```

- `code`: Machine-readable error code (see table below)
- `message`: User-facing explanation
- `details`: Optional array for validation errors (422)
- `meta.timestamp`: When the error occurred

---

## HTTP Status Codes

| Status | Meaning | When Used |
|---|---|---|
| 200 | OK | Successful GET, POST (non-creation) |
| 201 | Created | Successful POST creating resource |
| 400 | Bad Request | Client error (invalid coords, plan before evidence) |
| 404 | Not Found | Campaign/evidence/plan/results not found |
| 422 | Unprocessable Entity | Validation error (Pydantic) |
| 429 | Too Many Requests | Rate limit exceeded (60/min/IP) |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | External dependency down (Qloo, Nominatim, LLM, MongoDB) |

---

## Error Codes Reference

### Validation Errors (422)

| Code | Context | Example Message |
|---|---|---|
| `VALIDATION_ERROR` | Request body invalid | "Invalid input" |
| `FIELD_REQUIRED` | Missing required field | "topic is required" |
| `FIELD_TOO_SHORT` | String below min length | "topic must be at least 3 characters" |
| `FIELD_TOO_LONG` | String above max length | "topic must be at most 120 characters" |
| `FIELD_OUT_OF_RANGE` | Number outside bounds | "budget_inr must be at least 500" |
| `INVALID_ENUM` | Invalid enum value | "objective must be one of: awareness, attendance, screening, vaccination" |
| `CUSTOM_VALIDATION` | Cross-field validation | "audience_age_min must not exceed audience_age_max" |

**Example 422 Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "budget_inr", "message": "Budget must be at least $500" },
      { "field": "audience_age_max", "message": "audience_age_min must not exceed audience_age_max" }
    ]
  },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

---

### Resource Errors (404)

| Code | Context | Example Message |
|---|---|---|
| `CAMPAIGN_NOT_FOUND` | Campaign ID not found | "Campaign not found" |
| `EVIDENCE_NOT_FOUND` | Evidence snapshot not found | "Evidence not found for this campaign" |
| `PLAN_NOT_FOUND` | Plan not found | "Plan not found for this campaign" |
| `RESULTS_NOT_FOUND` | Results not found | "Results not found for this campaign" |

**Example 404 Response:**
```json
{
  "error": {
    "code": "CAMPAIGN_NOT_FOUND",
    "message": "Campaign not found"
  },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

---

### Business Logic Errors (400)

| Code | Context | Example Message |
|---|---|---|
| `PLAN_BEFORE_EVIDENCE` | Plan requested before evidence | "Evidence needed before plan — please review local information first" |
| `EVIDENCE_ALREADY_EXISTS` | Duplicate evidence request | "Evidence already gathered for this campaign" |
| `INVALID_COORDINATES` | Lat/lon out of range | "That map point is outside the map range" |
| `QUERY_TOO_SHORT` | Autocomplete query < 3 chars | "Query must be at least 3 characters" |

**Example 400 Response:**
```json
{
  "error": {
    "code": "PLAN_BEFORE_EVIDENCE",
    "message": "Evidence needed before plan — please review local information first"
  },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

---

### Rate Limiting (429)

| Code | Context | Example Message |
|---|---|---|
| `RATE_LIMITED` | >60 requests/min/IP | "Too many requests. Please wait a moment." |

**Headers:**
- `Retry-After`: Seconds until next request allowed
- `X-RateLimit-Limit`: 60
- `X-RateLimit-Remaining`: Remaining requests in window

**Example 429 Response:**
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please wait a moment."
  },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

---

### External Service Errors (503)

| Code | Service | Context | Example Message |
|---|---|---|---|
| `QLOO_UNAVAILABLE` | Qloo | Timeout, 5xx, network error | "Cultural signals temporarily unavailable" |
| `QLOO_AUTH_FAILED` | Qloo | 401/403 (key rejected) | "Qloo key rejected — cultural signals unavailable" |
| `QLOO_RATE_LIMITED` | Qloo | 429 from Qloo | "Qloo busy — try again in a moment" |
| `QLOO_BAD_REQUEST` | Qloo | 400 from Qloo | "Invalid Qloo request — please report this" |
| `GEO_UNAVAILABLE` | Nominatim/Overpass | All endpoints failed | "Location service temporarily unavailable" |
| `LLM_UNAVAILABLE` | LLM | Timeout, 5xx, auth fail | "AI drafting unavailable — using standard template" |
| `MONGODB_UNAVAILABLE` | MongoDB | Connection failed | "Database unavailable — using temporary storage" |

**Example 503 Response:**
```json
{
  "error": {
    "code": "QLOO_UNAVAILABLE",
    "message": "Cultural signals temporarily unavailable"
  },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

---

### Internal Errors (500)

| Code | Context | Example Message |
|---|---|---|
| `INTERNAL_ERROR` | Unexpected exception | "Something went wrong. Your data is safe — please try again." |

**Example 500 Response:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Something went wrong. Your data is safe — please try again."
  },
  "meta": { "timestamp": "2026-10-20T15:30:00Z" }
}
```

---

## Frontend Error Mapping (`lib/api.ts`)

The `friendlyError()` function maps all error responses to plain language:

```typescript
function friendlyError(error: ApiError): string {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return error.details?.[0]?.message || 'Please check the highlighted fields.';
    case 'CAMPAIGN_NOT_FOUND':
      return 'Campaign not found. It may have been deleted.';
    case 'PLAN_BEFORE_EVIDENCE':
      return 'Please review local information before creating a plan.';
    case 'QLOO_UNAVAILABLE':
      return 'Cultural signals are temporarily unavailable. Your plan will use place data and your input.';
    case 'QLOO_AUTH_FAILED':
      return 'The Qloo key was rejected. Cultural signals unavailable — plan will use place data + your input.';
    case 'GEO_UNAVAILABLE':
      return 'Location service temporarily unavailable. Your input is safe — try again.';
    case 'LLM_UNAVAILABLE':
      return 'AI drafting unavailable — using standard template.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment.';
    case 'INTERNAL_ERROR':
      return 'Something went wrong on our end. Your data is safe — try again.';
    default:
      return 'An unexpected error occurred. Your input is preserved — please try again.';
  }
}
```

---

## Honest Error Communication Principles

1. **Never fabricate data** — Errors surface as `unavailable`/`thin` statuses, not fake values
2. **Preserve user input** — Form fields never cleared by network errors
3. **Explain what happened** — Plain language, no technical jargon
4. **State data safety** — "Your data is safe" or "What you saved is safe"
5. **Tell what to do next** — "Try again", "Check fields", "Contact support"
6. **Retry only when meaningful** — No retry for 401/403/400 (key rejected, bad request)

---

## Testing Error Paths

### Backend Tests (`test_pipeline.py`, `test_api_flow.py`)
- Qloo key missing → 503 `QLOO_UNAVAILABLE`
- Qloo auth failure → 503 `QLOO_AUTH_FAILED`
- Qloo thin response → 200 with `qloo_status: "thin"`
- OSM unavailable → 503 `GEO_UNAVAILABLE`
- LLM failure → 200 with `planner: "standard-template"`
- Validation errors → 422 with field details
- Plan before evidence → 400 `PLAN_BEFORE_EVIDENCE`
- Campaign not found → 404 `CAMPAIGN_NOT_FOUND`
- Rate limiting → 429 `RATE_LIMITED`

### Frontend Tests (Manual QA)
- Offline state → "You're offline. Changes saved locally."
- Timeout → "Request took too long. Your input is safe."
- Network error → "Something went wrong. Your data is safe."
- Field errors clear on edit
- Input preserved on all errors

---

*Related: [API Contracts](API_CONTRACTS.md) · [API Overview](API_OVERVIEW.md) · [Error Handling](architecture/ERROR_HANDLING.md)*