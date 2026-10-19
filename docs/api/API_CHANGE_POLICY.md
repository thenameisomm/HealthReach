# API Change Policy — HealthReach AI

## Guiding Principle

**Additive changes only.** Existing endpoints, fields, and behaviors must remain compatible. Breaking changes require a new endpoint or versioned path.

## Versioning Strategy

| Approach | When Used |
|---|---|
| No URL versioning | Current — additive changes only |
| New endpoint (`/api/v2/...`) | Breaking changes required |
| Deprecation header | Endpoint scheduled for removal |

**Current version**: Implicit v1 (no version in path)

---

## Allowed Changes (No Version Bump)

### Response Fields
- ✅ Adding new optional fields with defaults
- ✅ Adding new enum values (with default handling)
- ✅ Making required fields optional (with default)
- ✅ Adding new nested objects (optional)
- ✅ Extending string max lengths
- ✅ Increasing numeric max values

### Request Fields
- ✅ Adding new optional fields with defaults
- ✅ Making required fields optional (with default)
- ✅ Relaxing validation (e.g., longer max length)

### Endpoints
- ✅ Adding new endpoints
- ✅ Adding new query parameters (optional)
- ✅ Adding new HTTP methods to existing path (if safe)

### Error Responses
- ✅ Adding new error codes (clients handle unknown gracefully)
- ✅ Adding detail fields to existing errors

### Examples

```python
# ✅ ALLOWED: Adding optional field with default
class CampaignBrief(BaseModel):
    topic: str
    # NEW: optional field with default
    language: str = "en"

# ✅ ALLOWED: New optional nested object
class Plan(BaseModel):
    # ... existing fields
    # NEW: optional metadata
    metadata: PlanMetadata | None = None

# ✅ ALLOWED: New enum value (client default handles unknown)
class Objective(str, Enum):
    AWARENESS = "awareness"
    # NEW:
    ENGAGEMENT = "engagement"
```

---

## Forbidden Changes (Require Version Bump)

### Response Fields
- ❌ Removing fields
- ❌ Changing field types
- ❌ Making optional fields required
- ❌ Changing field names
- ❌ Removing enum values
- ❌ Decreasing string max lengths
- ❌ Decreasing numeric max values
- ❌ Changing field semantics (e.g., `budget_inr` → `budget_usd` without conversion)

### Request Fields
- ❌ Removing fields
- ❌ Making optional fields required
- ❌ Changing field types
- ❌ Tightening validation (e.g., shorter max length)

### Endpoints
- ❌ Removing endpoints
- ❌ Changing HTTP methods
- ❌ Changing path structure
- ❌ Changing response status codes for same scenario

### Error Responses
- ❌ Removing error codes
- ❌ Changing error code meanings
- ❌ Changing HTTP status for existing error

### Examples

```python
# ❌ FORBIDDEN: Removing field
class CampaignBrief(BaseModel):
    topic: str
    # REMOVED: language: str = "en"

# ❌ FORBIDDEN: Changing type
class CampaignBrief(BaseModel):
    budget_inr: int  # WAS: int, NOW: float (breaking)

# ❌ FORBIDDEN: Making optional required
class CampaignBrief(BaseModel):
    audience_notes: str  # WAS: str = "", NOW: required

# ❌ FORBIDDEN: Renaming field
class Plan(BaseModel):
    budget_total_usd: int  # WAS: budget_total_inr
```

---

## Deprecation Process

If a breaking change is absolutely necessary:

1. **Add new endpoint** (e.g., `/api/v2/campaigns`)
2. **Mark old endpoint deprecated** in OpenAPI:
   ```python
   @router.post("/api/campaigns", deprecated=True)
   ```
3. **Add deprecation headers** to old endpoint responses:
   ```
   Deprecation: true
   Sunset: Sat, 01 Jan 2027 00:00:00 GMT
   Link: </api/v2/campaigns>; rel="successor-version"
   ```
4. **Maintain old endpoint** for minimum 90 days
5. **Document migration** in CHANGELOG.md

---

## Client Compatibility

### TypeScript Client (`apps/web/lib/api.ts`)

- Generated/updated via `pnpm generate:api`
- Runs against live `/openapi.json`
- Fails CI if drift detected
- **Never hand-edit** — update models and regenerate

### Handling Unknown Fields

```typescript
// TypeScript: strict but allows unknown via index signature
interface ApiResponse<T> {
  data: T;
  meta: { timestamp: string };
  [key: string]: unknown;  // Allows future fields
}

// Enum handling: default case for unknown values
function getObjectiveLabel(objective: string): string {
  switch (objective) {
    case 'awareness': return 'Awareness';
    case 'attendance': return 'Attendance';
    // ...
    default: return objective;  // Unknown enum value
  }
}
```

---

## Change Documentation

All API changes must be documented in:

1. **CHANGELOG.md** — Version history with change type
2. **API_CONTRACTS.md** — Updated schemas
3. **Git commit** — Conventional commit message

### CHANGELOG Format

```markdown
## [0.2.0] - 2026-11-01

### Added
- POST /api/campaigns/{id}/evidence/progress — Real-time evidence gathering progress
- GET /api/locations/search — US-biased location search
- GET /api/locations/reverse — Reverse geocode for map clicks

### Changed
- CampaignBrief.budget_inr → budget_usd (with conversion, v2 endpoint)
- Plan.budget_total_inr → budget_total_usd

### Deprecated
- GET /api/geo/suggest (use /api/locations/search)
- GET /api/geo/reverse (use /api/locations/reverse)

### Fixed
- Qloo chain step 3 skip reason clarity
```

---

## CI/CD Enforcement

### `pnpm generate:api` (Required Before Merge)

```bash
# Runs in CI against staging API
pnpm generate:api
```

- Fetches live `/openapi.json`
- Compares with `apps/web/lib/api.ts`
- Fails on:
  - Missing endpoints
  - Missing/changed request fields
  - Missing/changed response fields
  - Type mismatches

### Python Type Checking

```bash
cd apps/api && python -m mypy --strict app/
```

- Validates Pydantic models
- Catches breaking changes in request/response models

### Backend Tests

```bash
cd apps/api && pytest -m "not live"
```

- Contract tests for all endpoints
- Validates error responses match specifications

---

## Review Checklist for API Changes

Before merging any API change:

- [ ] Change is additive only (or new v2 endpoint created)
- [ ] Pydantic models updated with optional defaults
- [ ] TypeScript client regenerated (`pnpm generate:api`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes
- [ ] Backend tests pass (`pytest`)
- [ ] CHANGELOG.md updated
- [ ] API_CONTRACTS.md updated
- [ ] No breaking changes to existing endpoints
- [ ] Deprecation headers added if applicable
- [ ] Migration guide documented (if breaking)

---

## Emergency Hotfixes

For critical production bugs requiring immediate non-additive fix:

1. Create hotfix branch from `main`
2. Make minimal change
3. Document as **BREAKING** in commit and CHANGELOG
4. Deploy with version bump (patch)
5. Notify API consumers immediately
6. Plan proper additive replacement for next minor version

---

*Related: [API Contracts](API_CONTRACTS.md) · [Error Responses](ERROR_RESPONSES.md) · [API Overview](API_OVERVIEW.md)*