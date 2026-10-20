# Risks & Mitigations — HealthReach AI

## Risk Categories

| Category | Count | High | Medium | Low |
|---|---|---|---|---|
| Technical | 8 | 3 | 4 | 1 |
| Product | 6 | 2 | 3 | 1 |
| External Dependency | 5 | 3 | 2 | 0 |
| Privacy & Security | 4 | 2 | 2 | 0 |
| Operational | 4 | 1 | 2 | 1 |

---

## Technical Risks

### RISK-T01: Qloo API Coverage Gaps
**Severity**: High  
**Description**: Qloo cultural signals may be thin or unavailable for many US locations, especially non-metro areas.  
**Impact**: Plans generated without cultural signals (`has_cultural_signals: false`), reduced value proposition.  
**Likelihood**: High (based on Qloo docs noting uneven coverage)  
**Mitigation**:
- Graceful degradation: plan proceeds with OSM venues + organizer input
- Clear UI communication: "This plan was created without cultural signals"
- Document coverage expectations in onboarding
- Monitor `qloo_status` distribution in production
**Owner**: Backend Lead  
**Status**: 🟡 Monitoring

### RISK-T02: OSM Venue Data Incompleteness
**Severity**: High  
**Description**: OpenStreetMap venue coverage varies significantly by region. Rural areas may have few/no mapped community venues.  
**Impact**: Venue list empty or sparse (`geo_status: thin`), map shows no candidates.  
**Likelihood**: High  
**Mitigation**:
- 3-endpoint Overpass failover for resilience
- Honest `thin` status with "Few mapped community venues in this radius"
- "Visit and verify" badge on every venue
- Allow organizers to proceed with activities-only plan
- Document OSM limitations in UI and docs
**Owner**: Backend Lead  
**Status**: 🟡 Monitoring

### RISK-T03: LLM Hallucination / Budget Violation
**Severity**: High  
**Description**: LLM may generate invalid JSON, hallucinate evidence refs, or violate budget exactness.  
**Impact**: Plan validation fails, repair retry consumed, falls back to template (losing AI prose).  
**Likelihood**: Medium  
**Mitigation**:
- Structured output validation via Pydantic (strict)
- One repair retry with explicit "fix JSON" instruction
- Deterministic fallback planner always available
- Budget forced exact in template (LLM output adjusted or discarded)
- `Plan.planner` truthfully reports `standard-template` when fallback used
**Owner**: Backend Lead  
**Status**: ✅ Implemented

### RISK-T04: Nominatim Rate Limiting / WAF Blocks
**Severity**: Medium  
**Description**: Nominatim enforces 1 req/s; some User-Agent strings or HTTP/2 fingerprints trigger WAF blocks.  
**Impact**: Geocoding fails, autocomplete breaks, map click reverse geocode fails.  
**Likelihood**: Medium (observed in testing)  
**Mitigation**:
- Client-side throttle (1.1s between requests)
- HTTP/1.1 + clean User-Agent (`HealthReachAI/0.1 hackathon-demo`)
- 24h cache for geocode/reverse, 1h for suggest
- Fallback to demo mode coordinates
- Honest error: "Location service temporarily unavailable"
**Owner**: Backend Lead  
**Status**: ✅ Implemented

### RISK-T05: Overpass Endpoint Failures
**Severity**: Medium  
**Description**: Public Overpass endpoints occasionally return errors or time out.  
**Impact**: Venue discovery fails (`geo_status: unavailable`).  
**Likelihood**: Medium  
**Mitigation**:
- 3-endpoint sequential failover
- 10s timeout per endpoint
- All fail → `unavailable` with clear message
- Cache not used (per-campaign snapshot)
**Owner**: Backend Lead  
**Status**: ✅ Implemented

### RISK-T06: MongoDB Connection Issues in Serverless
**Severity**: Medium  
**Description**: Serverless environments (Vercel, Railway) may have cold-start connection issues or connection limits.  
**Impact**: API errors, fallback to in-memory (data loss on restart).  
**Likelihood**: Medium  
**Mitigation**:
- Motor connection pooling
- Graceful fallback to in-memory dict
- Health endpoint reports `mongodb_connected`
- Connection retry logic
**Owner**: DevOps  
**Status**: 🟡 Monitoring

### RISK-T07: TypeScript/OpenAPI Drift
**Severity**: Medium  
**Description**: Frontend `lib/api.ts` may drift from backend OpenAPI schema.  
**Impact**: Runtime type errors, failed API calls.  
**Likelihood**: Low (with parity check)  
**Mitigation**:
- `pnpm generate:api` runs in CI against live `/openapi.json`
- Fails build on drift
- Hand-maintained client (not auto-generated) for control
**Owner**: Frontend Lead  
**Status**: ✅ Implemented

### RISK-T08: Bundle Size Growth
**Severity**: Low  
**Description**: Adding chart library, map clustering, PDF generation may increase bundle size.  
**Impact**: Slower FCP/TTI, especially on mobile.  
**Likelihood**: Medium  
**Mitigation**:
- Dynamic imports for heavy components (MapView, ClickMap, charts)
- Evaluate bundle size in CI
- Consider HTML table fallback for charts
**Owner**: Frontend Lead  
**Status**: 🟡 Planned

---

## Product Risks

### RISK-P01: Cultural Relevance Misinterpreted as Trust
**Severity**: High  
**Description**: Organizers may interpret "cultural affinity" as "community trust" or "health endorsement."  
**Impact**: Ethical violation, potential misuse, reputational damage.  
**Likelihood**: Medium  
**Mitigation**:
- Explicit provenance: "Taste affinity, not a health or trust signal" on every Qloo value
- UI never uses "trust" language
- Documentation: "Cultural relevance ≠ community trust"
- Provenance badge: icon + label + border (never color alone)
**Owner**: Product Lead  
**Status**: ✅ Implemented

### RISK-P02: Venues Presented as Verified
**Severity**: High  
**Description**: Organizers may assume listed venues are vetted/approved for health events.  
**Impact**: Safety risk, failed events, liability.  
**Likelihood**: Medium  
**Mitigation**:
- Every venue: `needs_verification: true`
- Badge: "Visit and verify before use"
- Category shown as OSM tag (e.g., "community_centre"), not "verified clinic"
- Documentation: "OSM venues are mapped candidates, not vetted"
**Owner**: Product Lead  
**Status**: ✅ Implemented

### RISK-P03: Reach Estimates Treated as Guarantees
**Severity**: High  
**Description**: Organizers may treat AI estimate ranges as attendance promises.  
**Impact**: Budget misallocation, disappointment, loss of credibility.  
**Likelihood**: Medium  
**Mitigation**:
- All estimates labeled "Estimate" with basis shown
- Ranges (not point values): "150-200 people"
- Disclaimer: "Estimate only. Actual reach depends on many factors not modeled here."
- Analytics: "Descriptive, not causal" on every comparison
**Owner**: Product Lead  
**Status**: ✅ Implemented

### RISK-P04: Demo Data Confused with Real Data
**Severity**: Medium  
**Description**: Kothrud demo may be mistaken for real US deployment evidence.  
**Impact**: False confidence, incorrect assumptions about US coverage.  
**Likelihood**: Medium  
**Mitigation**:
- Persistent dashed "Illustrative data" banner
- All demo values `provenance: illustrative`
- Real-mode paths never import `demo_data.py`
- US demo scenario clearly labeled separate when implemented
**Owner**: Product Lead  
**Status**: ✅ Implemented

### RISK-P05: Causal Language in Analytics
**Severity**: Medium  
**Description**: Planned-vs-actual comparison may be interpreted as plan effectiveness proof.  
**Impact**: Misattribution, false learning, poor future decisions.  
**Likelihood**: Medium  
**Mitigation**:
- Explicit note: "Descriptive comparison only. Differences may reflect many factors and do not prove the plan caused the outcome."
- No "ROI", "effectiveness", "impact" language
- Null states: "Not calculable — needs at least 1 registration"
**Owner**: Product Lead  
**Status**: ✅ Implemented

### RISK-P06: Scope Creep Beyond Core Workflow
**Severity**: Low  
**Description**: Requests for dashboards, accounts, settings, patient tracking.  
**Impact**: Diluted focus, delayed core delivery, complexity.  
**Likelihood**: Medium  
**Mitigation**:
- AGENTS.md: "No settings, users, notifications, or admin sections"
- Explicit non-goals in SCOPE_AND_NON_GOALS.md
- Stretch only after every MVP criterion passes
**Owner**: Product Lead  
**Status**: ✅ Documented

---

## External Dependency Risks

### RISK-E01: Qloo API Changes / Deprecation
**Severity**: High  
**Description**: Qloo may change API parameters, response format, or deprecate endpoints.  
**Impact**: Cultural signals break, evidence gathering fails.  
**Likelihood**: Medium  
**Mitigation**:
- Adapter pattern: `qloo_client.py` isolates API details
- Version pinning in request params where possible
- Fixtures record live responses for regression testing
- Monitor Qloo changelog / developer communications
**Owner**: Backend Lead  
**Status**: 🟡 Monitoring

### RISK-E02: Qloo Rate Limits / Quota Exhaustion
**Severity**: High  
**Description**: Hackathon limits: 5 req/s, 10,000 calls/month. Production may exceed.  
**Impact**: `qloo_status: unavailable`, plans without cultural signals.  
**Likelihood**: High (with scale)  
**Mitigation**:
- Per-run cap: `QLOO_MAX_CALLS_PER_RUN=200`
- Monthly guard at 80% of limit
- Cache Qloo responses per campaign (not shared)
- Demo mode works without Qloo
- Template planner always available
**Owner**: Backend Lead  
**Status**: ✅ Implemented

### RISK-E03: LLM Provider Changes / Cost
**Severity**: Medium  
**Description**: OpenAI-compatible provider may change pricing, deprecate models, or require migration.  
**Impact**: AI-drafted plans unavailable, fallback to template.  
**Likelihood**: Medium  
**Mitigation**:
- Provider isolation: only `llm_client.py` names provider
- Configurable `LLM_BASE_URL`, `LLM_MODEL`
- Template planner always works without LLM
- Cost monitoring via usage logs
**Owner**: Backend Lead  
**Status**: 🟡 Monitoring

### RISK-E04: OSM Policy Changes
**Severity**: Medium  
**Description**: Nominatim/Overpass may change usage policies, rate limits, or attribution requirements.  
**Impact**: Geocoding/venues break, legal compliance risk.  
**Likelihood**: Low  
**Mitigation**:
- Conservative usage: 1 req/s throttle, caching, attribution
- Multiple Overpass endpoints
- Self-hosted Overpass option for production
- Monitor OSM operations announcements
**Owner**: Backend Lead  
**Status**: 🟡 Monitoring

### RISK-E05: Hosting Platform Issues
**Severity**: Medium  
**Description**: Vercel, Railway, Render may have outages, pricing changes, or feature limitations.  
**Impact**: Deployment blocked, downtime, cost spikes.  
**Likelihood**: Low  
**Mitigation**:
- Multi-platform deploy capability (Docker images)
- Infrastructure as code (render.yaml, railway.json)
- Database portable (MongoDB Atlas)
- Cost monitoring alerts
**Owner**: DevOps  
**Status**: 🟡 Planned

---

## Privacy & Security Risks

### RISK-S01: Accidental PII Logging
**Severity**: High  
**Description**: Organizer input or external API responses accidentally logged with PII.  
**Impact**: Privacy violation, compliance risk.  
**Likelihood**: Low  
**Mitigation**:
- Structured logging: no request/response bodies at INFO level
- DEBUG level only in development
- No patient data in system (aggregate only)
- Code review checklist: "No PII in logs"
**Owner**: Backend Lead  
**Status**: ✅ Implemented

### RISK-S02: Secret Leakage in Frontend/Repo
**Severity**: High  
**Description**: API keys committed to repo or bundled in frontend.  
**Impact**: Credential compromise, unauthorized API usage.  
**Likelihood**: Low  
**Mitigation**:
- `.env` in `.gitignore`, only `.env.example` committed
- `NEXT_PUBLIC_*` only for API URL (not secret)
- `git-secrets` / `trufflehog` in CI
- Server-side only: `QLOO_API_KEY`, `LLM_API_KEY`, `MONGODB_URI`
- Platform secret stores for production
**Owner**: DevOps  
**Status**: ✅ Implemented

### RISK-S03: CORS / CSRF Vulnerabilities
**Severity**: Medium  
**Description**: Misconfigured CORS allows unauthorized origins; no CSRF protection on state-changing endpoints.  
**Impact**: Cross-origin attacks, unauthorized campaign creation.  
**Likelihood**: Low  
**Mitigation**:
- `CORS_ORIGINS` explicit allowlist (not `*`)
- No authentication → no session cookies → CSRF not applicable
- Rate limiting: 60/min/IP
- Input validation on all endpoints (Pydantic)
**Owner**: Backend Lead  
**Status**: ✅ Implemented

### RISK-S04: Export Contains Sensitive Data
**Severity**: Medium  
**Description**: CSV/PDF/JSON exports may accidentally include secrets, raw provider responses, or PII.  
**Impact**: Data leakage in shared exports.  
**Likelihood**: Low  
**Mitigation**:
- Export functions explicitly select fields
- No secrets, no raw Qloo/OSM responses, no PII
- Privacy review of export schemas
- Test: verify export content matches spec
**Owner**: Backend Lead  
**Status**: 🟡 Planned

---

## Operational Risks

### RISK-O01: Single Point of Failure (Solo Developer)
**Severity**: High  
**Description**: Project maintained by one person; bus factor = 1.  
**Impact**: Project stalls if maintainer unavailable.  
**Likelihood**: High  
**Mitigation**:
- Comprehensive documentation (`docs/`)
- `AGENTS.md` enables AI-assisted continuation
- Standard stack (Next.js, FastAPI) — hireable skills
- GitHub repo public — community contribution possible
**Owner**: Project Lead  
**Status**: 🟡 Documented

### RISK-O02: Insufficient Test Coverage
**Severity**: Medium  
**Description**: Frontend has no unit tests; backend has 34 tests but gaps in new features.  
**Impact**: Regressions in production, accessibility issues.  
**Likelihood**: Medium  
**Mitigation**:
- Backend: Add test for every honesty-relevant behavior
- Frontend: Plan React Testing Library + Playwright + axe-core
- Manual QA checklist for every release
- CI: typecheck, lint, build, pytest
**Owner**: QA Lead  
**Status**: 🟡 In Progress

### RISK-O03: No Monitoring / Alerting in Production
**Severity**: Medium  
**Description**: No automated alerts for API errors, latency, external service failures.  
**Impact**: Issues detected late, poor user experience.  
**Likelihood**: High  
**Mitigation**:
- Plan: Datadog / Prometheus + Grafana / platform alerts
- Key metrics: error rate, latency, Qloo/OSM success, build status
- Runbook documents manual checks
**Owner**: DevOps  
**Status**: 🟡 Planned

### RISK-O04: Dependency Vulnerabilities
**Severity**: Low  
**Description**: npm/pip dependencies may have CVEs.  
**Impact**: Supply chain attack, compliance failure.  
**Likelihood**: Medium  
**Mitigation**:
- `pnpm audit` / `uv pip audit` in CI
- Dependabot / Renovate for auto-PRs
- Pin versions in lockfiles
- Review before merge
**Owner**: DevOps  
**Status**: 🟡 Planned

---

## Risk Review Schedule

| Review | Frequency | Participants |
|---|---|---|
| Technical risks | Sprint planning | Backend/Frontend leads |
| Product risks | Monthly | Product lead |
| External dependencies | Quarterly | Backend lead |
| Privacy/Security | Per release | All leads |
| Operational | Retrospective | Team |

---

*Related: [Decisions Log](DECISIONS_LOG.md) · [Architecture Decisions](../architecture/ARCHITECTURE_DECISIONS.md) · [Security & Privacy](../architecture/SECURITY_AND_PRIVACY.md)*