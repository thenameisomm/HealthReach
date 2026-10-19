# Security & Privacy — HealthReach AI

## Privacy by Design

### Data Minimization

| Data Category | Collected? | Stored? | Sent to External APIs? |
|---|---|---|---|
| Organizer name/email | No | No | No |
| Campaign brief (topic, location, audience, budget) | Yes | Yes (MongoDB) | Location → Nominatim, Qloo |
| Patient names, phones, IDs | **Never** | **Never** | **Never** |
| Individual health data | **Never** | **Never** | **Never** |
| Aggregate results (counts only) | Yes | Yes | No |
| Qloo signals/steps | Yes | Yes (per-campaign) | Qloo API (no PII) |
| OSM venues | Yes | Yes (per-campaign) | Overpass (no PII) |
| LLM prompts | Yes (transient) | No (only plan output stored) | LLM API (evidence only, no PII) |

### Aggregate Results Only

- Results input accepts: `registrations`, `attendance`, `spend_inr`, `engagement`, `notes`
- **No** individual participant records
- **No** demographic breakdowns of attendees
- **No** contact tracing or follow-up data
- Analytics derived solely from aggregate counts

### No PII in External API Calls

| External API | Data Sent | PII Risk |
|---|---|---|
| Qloo | Location (lat/lon or fuzzy name), topic, optional age demographic hint | None — no identifiers |
| Nominatim | Location query string (user-typed) | Low — user controls input |
| Overpass | Bounding box (lat/lon/radius) | None |
| LLM | Campaign brief + evidence snapshot (Qloo signals, OSM venues) | None — no identifiers in evidence |

---

## Secret Management

### Server-Side Only

All secrets live in the API process environment. **Never** in:
- Frontend bundles (`NEXT_PUBLIC_*` only for API base URL)
- Client-side code
- Logs, traces, or error reports
- Git repository (`.env` is gitignored)
- Docker images
- README or documentation

### Required Secrets

| Variable | Service | Required For | Rotation |
|---|---|---|---|
| `QLOO_API_KEY` | Qloo Insights | Real cultural signals | Per Qloo policy |
| `LLM_API_KEY` | OpenAI-compatible | AI-drafted plans | Per provider policy |
| `LLM_BASE_URL` | OpenAI-compatible | Custom endpoint | As needed |
| `LLM_MODEL` | OpenAI-compatible | Model selection | As needed |
| `MONGODB_URI` | MongoDB | Persistence | Per MongoDB policy |
| `CORS_ORIGINS` | FastAPI | CORS allowlist | As needed |

### Public (Non-Secret) Config

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Frontend → API base URL (default: `http://localhost:8000`) |
| `QLOO_BASE_URL` | Qloo API base (default: `https://api.qloo.com`) |

---

## Transport Security

- **HTTPS in production** (Vercel, Railway/Render provide TLS termination)
- **CORS allowlist**: `CORS_ORIGINS` (default `http://localhost:3000`)
- **Rate limiting**: 60 requests/minute/IP on all `/api` routes
- **No credentials in URLs**: All auth via headers

---

## Input Validation & Sanitization

### Backend (Pydantic v2)

- All request bodies validated by Pydantic models
- Field constraints: `min_length`, `max_length`, `ge`, `le`, `regex`
- Enum validation for `Objective`, `Provenance`, status fields
- Custom validators (e.g., `audience_age_min ≤ audience_age_max`)
- Extra fields rejected (`extra="forbid"` on models)

### Frontend (TypeScript + Zod-ready)

- `lib/api.ts` types mirror Pydantic models
- Client-side validation mirrors server constraints
- `friendlyError()` maps server validation errors to field messages

### External Input Sanitization

- Nominatim queries: user-typed, length-capped (120 chars), no injection possible (GET params)
- Overpass queries: constructed from validated lat/lon/radius (no user strings)
- Qloo queries: constructed from validated location + entity_ids (no user strings)
- LLM prompts: evidence IDs and labels only, no raw user input

---

## Output Safety

### Provenance Enforcement

Every displayed value carries explicit provenance:
- `qloo`: Cultural affinity (never health/trust/footfall)
- `geo`: OSM venue (never vetted/trusted)
- `ai`: LLM/template estimate (never fact)
- `user`: Organizer input
- `illustrative`: Demo data only

**UI renders**: Icon + text label + border — **never color alone**

### Honest Limitations (Enforced in Copy)

| Claim | Enforcement |
|---|---|
| Cultural relevance = community trust | Never stated; provenance says "Taste affinity, not a health or trust signal" |
| Venues are verified | Every venue: `needs_verification: true`, badge "Visit and verify before use" |
| Reach figures are promises | Labeled "AI estimate range", basis stated, never guaranteed |
| Plan caused outcome | Analytics note: "Descriptive comparison only. Differences may reflect many factors and do not prove the plan caused the outcome." |
| Demo data is real | `provenance: illustrative` on every value + persistent banner |

### LLM Output Guardrails

- System prompt: "Admit when evidence is insufficient. Do not invent evidence refs."
- Validation: `evidence_refs` must exist in persisted evidence snapshot
- Repair retry: One attempt to fix schema/refs
- Fallback: Deterministic template (no LLM prose)
- `Plan.planner` truthfully indicates source

---

## Database Security

### MongoDB

- Connection string in `MONGODB_URI` (includes auth)
- Motor async driver (no blocking)
- Collections: `campaigns`, `evidence_snapshots`, `plans`, `results`, `ext_cache`
- **No indexes on PII** (none stored)
- TTL index on `ext_cache.created_at` (24h)
- In-memory fallback: dict-based, no persistence, data lost on restart

### Data Retention

| Collection | Retention | Deletion Trigger |
|---|---|---|
| campaigns | Indefinite | Manual (organizer request) |
| evidence_snapshots | Indefinite | Cascade with campaign |
| plans | Indefinite (versioned) | Cascade with campaign |
| results | Indefinite | Cascade with campaign |
| ext_cache | 24h | TTL index auto-expiry |

---

## Frontend Security

### Content Security Policy (Recommended)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://*.tile.openstreetmap.org https://*.openstreetmap.org;
  connect-src 'self' http://localhost:8000 https://api.qloo.com https://nominatim.openstreetmap.org https://overpass-api.de;
  frame-ancestors 'none';
```

### Map Tiles

- OSM Standard / CARTO Light via Leaflet
- Attribution visible on every map: "© OpenStreetMap contributors (ODbL)"
- No Mapbox/Google tiles (no billing keys)

### Dependency Security

- `pnpm audit` run in CI
- `pnpm update` for security patches
- No `eval()` or `dangerouslySetInnerHTML` with user content
- SVG assets: static, no scripts, no external refs

---

## Compliance Considerations

### HIPAA

**Not applicable** — HealthReach does not:
- Create, receive, maintain, or transmit PHI
- Act as a Business Associate
- Handle individual health information

### GDPR

**Minimal applicability** — HealthReach:
- Does not process personal data (no names, emails, IDs)
- Organizer input is campaign parameters, not personal data
- If organizer is EU-based, brief parameters could be personal data → provide deletion endpoint (planned)

### SOC 2 / ISO 27001

Not currently certified. Relevant controls implemented:
- Access control (secrets in env, no shared credentials)
- Encryption in transit (HTTPS)
- Audit logging (FastAPI request logs, no PII)
- Incident response (error handling, graceful degradation)
- Vendor management (Qloo, LLM, MongoDB — contracts reviewed)

---

## Incident Response

### Security Incident Types

| Type | Detection | Response |
|---|---|---|
| Secret leaked in logs/code | Code review, `git-secrets` scan | Rotate key immediately, audit access |
| Unauthorized API access | Rate limit spikes, 401/403 logs | Block IP, rotate key, review CORS |
| PII accidentally logged | Log review, automated PII scan | Purge logs, fix code, rotate if needed |
| MongoDB exposed | Port scan, config audit | Enable auth, restrict SG, rotate URI |

### Reporting

- No user-facing security reporting (no accounts)
- Internal: GitHub Security Advisories for dependencies
- External: `security@` email (if configured)

---

## Security Checklist (Pre-Release)

- [ ] `QLOO_API_KEY`, `LLM_API_KEY`, `MONGODB_URI` only in server env
- [ ] `.env` gitignored, `.env.example` has empty values
- [ ] `NEXT_PUBLIC_API_URL` only public config
- [ ] CORS allowlist configured for production domain
- [ ] Rate limiting enabled (60/min/IP)
- [ ] HTTPS enforced in production
- [ ] No `console.log` of secrets or PII
- [ ] Pydantic `extra="forbid"` on all request models
- [ ] TTL index on `ext_cache`
- [ ] `pnpm audit` clean (or documented exceptions)
- [ ] SVG assets validated (no scripts, no external refs)
- [ ] README/documents contain no secrets

---

*Related: [System Overview](SYSTEM_OVERVIEW.md) · [Error Handling](ERROR_HANDLING.md) · [API Contracts](api/API_CONTRACTS.md) · [External Services](integrations/EXTERNAL_SERVICES.md)*