# Error Handling — HealthReach AI

## Error Handling Principles

1. **Honest communication**: Every error state explains what happened, whether data is safe, and what to do next.
2. **No silent fabrication**: Failures surface as honest statuses (`thin`, `unavailable`) — never invented data.
3. **Input preservation**: Form input is never cleared by failures; field errors clear on edit.
4. **Retry where meaningful**: Retry offered only when it can help (not for missing keys, invalid input).
5. **Graceful degradation**: Missing Qloo → plan proceeds with geo + organizer input, flagged `has_cultural_signals: false`.

## Backend Error Handling

### Qloo Client (`qloo_client.py`)

```python
# Timeout: 12s per request
# Retries: 3 attempts on 429/5xx/timeout (0.5s, 1s, 2s + jitter)
# No retry: 400, 401, 403 (client errors, auth failures)

# Status mapping:
# 401/403 → "unavailable" + "key rejected" note (no retry)
# 429/5xx → retry, then "unavailable" if exhausted
# timeout → retry, then "unavailable"
# network error → "unavailable"
# empty/thin response → "thin" with note
# key not configured → RuntimeError (caught by router → 503)
```

**Per-step error handling**: Each chain step wrapped independently. Failure in step 1 → steps 2-3 recorded as `skip` with reason "The first check didn't find places, so this had nothing to start from."

### Geo Client (`geo_client.py`)

```python
# Nominatim:
# - Throttle: 1 req/s (client-side, non-blocking asyncio.sleep)
# - Cache: 24h geocode, 1h suggest
# - Headers: HTTP/1.1 + identifying UA (avoids WAF blocks)
# - Errors: raise → router maps to honest state

# Overpass:
# - 3 endpoints, sequential failover
# - 10s timeout per endpoint
# - All fail → "unavailable" with "map directory didn't respond"
# - Response with 0 venues → "thin" with "Few mapped community venues"
```

### LLM Client (`llm_client.py`)

```python
# Timeout: 45s
# Structured output: JSON matching Plan schema
# Repair: 1 retry on validation failure
# Fallback: deterministic planner (always available)
# Errors: timeout, 4xx, 5xx, malformed JSON → fallback
# planner field truthfully reflects outcome
```

### Router-Level Error Mapping (`api.py`)

| Exception | HTTP Status | User-Facing Message |
|---|---|---|
| `QLOO_API_KEY` not set | 503 | "Cultural signals unavailable — plan will use place data + your input" |
| `QlooAuthError` (401/403) | 503 | "Qloo key rejected — cultural signals unavailable" |
| `QlooRateLimited` (429) | 429 | "Qloo busy — try again in a moment" |
| `QlooUnavailable` (5xx, timeout) | 503 | "Cultural signals temporarily unavailable" |
| `QlooBadRequest` (400) | 400 | "Invalid Qloo request — please report this" |
| Nominatim error | 503 | "Location service temporarily unavailable" |
| Overpass all endpoints fail | 503 | "Map directory didn't respond — try again" |
| LLM timeout/error | 503 | "AI drafting unavailable — using standard template" |
| Validation error (Pydantic) | 422 | Field-specific inline messages |
| Campaign not found | 404 | "Campaign not found" |
| Plan before evidence | 400 | "Evidence needed before plan — please review local information first" |

## Frontend Error Handling (`lib/api.ts` + Components)

### `friendlyError()` Mapping

```typescript
// Maps every failure class to plain language:
// - offline → "You're offline. Changes are saved locally — try again when connected."
// - timeout → "The request took too long. Your input is safe — try again."
// - 404 → "Not found. This campaign may have been deleted."
// - 400 → "Invalid input. Please check the highlighted fields."
// - 422 → Field errors from validation (inline)
// - 429 → "Too many requests. Please wait a moment."
// - 5xx → "Something went wrong on our end. Your data is safe — try again."
// - plan-before-evidence → "Please review local information before creating a plan."
```

### UI State Components (`components/States/`)

| Component | When Used | Message Pattern |
|---|---|---|
| `EmptyState` | No data yet | "No [things] yet. [Action to create first one.]" |
| `Skeleton` | Loading | Animated placeholder matching final layout |
| `ProgressStatus` | Evidence/Plan loading | Step progress + live call counter |
| `ErrorState` | Unrecoverable error | "What happened: [plain]. Your data: [safe]. Next: [action]." |

### Form Error Behavior

- **Inline validation**: Field-level messages appear on blur/submit
- **Error clears on edit**: User types → error disappears
- **Input preserved**: Network errors never clear form fields
- **Submit disabled** only during submission, not on error

### Loading States

| Phase | Component | Details |
|---|---|---|
| Brief submit | Button spinner | "Creating campaign..." |
| Evidence loading | `ProgressStatus` | Qloo call counter + step progress (1/3, 2/3, 3/3) |
| Plan loading | `ProgressStatus` | "Building your outreach plan..." |
| Section regen | Inline spinner | "Getting fresh ideas for [section]..." |
| Results submit | Button spinner | "Saving results..." |

---

## Frontend-Backend Error Contract

### Evidence Response Statuses

```typescript
interface EvidenceSnapshot {
  qloo_status: "ok" | "thin" | "unavailable";
  qloo_note: string;           // Plain-language explanation
  geo_status: "ok" | "thin" | "unavailable";
  geo_note: string;            // Plain-language explanation
  qloo_steps: QlooChainStep[]; // Each step has status: "ok" | "skip"
}
```

**UI Rendering**:
- `ok` → Green check, show data
- `thin` → Amber badge "Limited data", show what's there, note explains why
- `unavailable` → Red badge "Unavailable", note explains why, retry button if applicable
- Step `skip` → Gray card with `skip_reason` (never technical)

### Plan Response

```typescript
interface Plan {
  planner: "ai-model" | "standard-template";
  has_cultural_signals: boolean;
  // If has_cultural_signals=false, UI shows banner:
  // "This plan was created without cultural signals (Qloo unavailable)."
}
```

### Analytics Null Safety

```typescript
interface Analytics {
  cost_per_registration: number | null;
  attendance_rate: number | null;
  note: "Descriptive comparison only...";
  // If null: UI shows "Not calculable — needs at least 1 registration"
}
```

---

## Testing Error Paths

### Backend Tests (`test_pipeline.py`)

- Qloo key missing → `thin` status, plan flagged
- Qloo thin response → `thin` status, plan notes limited signals
- Qloo auth failure → `unavailable`, no retry
- OSM unavailable → `unavailable` status, plan proceeds
- LLM validation failure → repair retry → fallback to template
- Section regen → version increment, template planner used

### API Flow Tests (`test_api_flow.py`)

- Demo end-to-end (create → evidence → plan → results → analytics)
- Null-safe analytics (zero registrations → "Not calculable")
- Validation errors (422 on bad input)
- 404 on missing campaign
- Section regen version bump
- Geo suggest/reverse honesty (unavailable states)
- Evidence statuses (`thin`/`unavailable`)

---

*Related: [System Overview](SYSTEM_OVERVIEW.md) · [Agent Orchestration](AGENT_ORCHESTRATION.md) · [API Error Responses](api/ERROR_RESPONSES.md)*