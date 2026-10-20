# Product Requirements — HealthReach AI

## Functional Requirements

### FR-001: Campaign Brief
- **FR-001.1**: Organizer can enter topic (3–120 chars), location (text + map pick), audience age range (0–120, min ≤ max), audience notes (500 chars), budget (USD default or INR, 500–10M), duration (1–90 days), objective (awareness/attendance/screening/vaccination).
- **FR-001.2**: Per-field "why" hints explain purpose and impact.
- **FR-001.3**: LocationAutocomplete v2: debounced (300ms), US-biased, 120-char cap, no re-query after selection, stale request cancellation.
- **FR-001.4**: ClickMap v2: click → reverse geocode → fills typed field; field remains source of truth; US initial viewport.
- **FR-001.5**: Validation inline, input preserved on error, errors clear on edit.

### FR-002: Evidence Gathering
- **FR-002.1**: Qloo 3-step agent chain runs automatically after brief submission:
  - Step 1: Place affinities near location (filter.type=place, location.query + radius, explainability)
  - Step 2: Taste tags seeded by top place entity_id (signal.interests.entities)
  - Step 3: Cross-check with second place (same query, different entity_id)
- **FR-002.2**: Each step persisted with plain-language title, asked, found, next, status (ok/skip), skip_reason.
- **FR-002.3**: QlooCallCounter displays: actual provider requests, step progress, retries, cached results.
- **FR-002.4**: OSM venues fetched in parallel (Overpass 3-endpoint failover, 20-result cap).
- **FR-002.5**: Status vocabulary: `ok` | `thin` | `unavailable` for both Qloo and OSM.
- **FR-002.6**: All signals/venues carry provenance (qloo/geo) with entity_id where applicable.

### FR-003: Evidence Review
- **FR-003.1**: Familiarity hints in plain language (e.g., "moderate match — could mean people here respond well to community-gathering formats").
- **FR-003.2**: Technical details toggle shows raw Qloo signals (affinity, popularity, tags).
- **FR-003.3**: Qloo chain steps displayed as numbered cards with status.
- **FR-003.4**: MapView (Leaflet) + venue list below (required text alternative).
- **FR-003.5**: Each venue: name, category, address, distance, "Visit and verify" badge, provenance=geo.
- **FR-003.6**: Map attribution: "© OpenStreetMap contributors (ODbL)".

### FR-004: Plan Generation
- **FR-004.1**: Deterministic planner always available (standard-template).
- **FR-004.2**: LLM planner attempted when `LLM_API_KEY` configured; structured JSON output validated by Pydantic.
- **FR-004.3**: LLM repair: one retry on validation failure, then deterministic fallback.
- **FR-004.4**: Plan fields: summary, activities (title, channel, why, evidence_refs, cost, provenance), venues (name, reason, evidence_refs, status, needs_verification), budget (line items, exact total = brief budget), materials (poster/message/script + review notice), metrics (name, target_range, basis, provenance), assumptions, limitations, planner label (ai-model/standard-template).
- **FR-004.5**: Budget forced exact — sum of line items equals brief budget.
- **FR-004.6**: `has_cultural_signals` boolean flags when Qloo unavailable.

### FR-005: Plan Review & Regeneration
- **FR-005.1**: Plan displayed with provenance per value.
- **FR-005.2**: Pre-use checklist (venue verification, material review, budget confirmation).
- **FR-005.3**: "How this draft was made" line shows planner type + evidence summary.
- **FR-005.4**: Section regeneration: POST /api/campaigns/{id}/plan {section} → new version, version++.
- **FR-005.5**: Version comparison accessible in the analysis view.

### FR-006: Results & Analytics
- **FR-006.1**: Aggregate counts only: registrations, attendance, spend, engagement (+ optional notes).
- **FR-006.2**: Analytics: planned-vs-actual table, cost/registration, attendance rate.
- **FR-006.3**: Descriptive only — explicit "Descriptive comparison only. Differences may reflect many factors and do not prove the plan caused the outcome."
- **FR-006.4**: Null-safe: "Not calculable — needs at least 1 registration" when denominators zero.

### FR-007: Demo Mode
- **FR-007.1**: Fixed US (East Austin) and Kothrud scenarios from `demo_data.py` only; `GET /api/demo/scenario?scenario=us|kothrud`.
- **FR-007.2**: All API responses tagged `provenance: illustrative`.
- **FR-007.3**: Persistent dashed "Illustrative data" banner in UI.
- **FR-007.4**: Real-mode paths never import `demo_data`.

### FR-008: US-Focused Enhancements
- **FR-008.1**: US-biased geocoding (Nominatim `countrycodes=us`, `accept-language=en-US`).
- **FR-008.2**: USD formatting (`$1,234.56`).
- **FR-008.3**: Miles distance (meters → miles, 1 decimal).
- **FR-008.4**: US venue categories (FQHC, health dept, community center, library, park, school, pharmacy).
- **FR-008.5**: US demo scenario (e.g., East Austin, TX).

### FR-009: Visualization & Export
- **FR-009.1**: ResultsMap: campaign pin, candidate venues (clustered), verification state, optional 1-mile search area (not a reach estimate).
- **FR-009.2**: InteractiveCharts: planned vs actual (bar/line), cost/registration, attendance rate, reach ranges.
- **FR-009.3**: AnalysisViews: evidence dashboard, venue analysis, plan comparison.
- **FR-009.4**: Exports: CSV (results), PDF (plan), JSON (evidence snapshot).
- **FR-009.5**: Accessible chart alternatives (data tables), keyboard navigation.

## Non-Functional Requirements

### NFR-001: Performance
- Brief → evidence ≤ 90s (warm cache)
- Evidence → plan ≤ 10s
- API p95 < 500ms for cached reads
- Frontend FCP < 1.5s, TTI < 3s

### NFR-002: Reliability
- Qloo: 12s timeout, retry on 429/5xx (0.5, 1, 2s + jitter, max 3), no retry on 400/401/403
- OSM: 1 req/s throttle, 24h geocode cache, 3-endpoint Overpass failover
- LLM: 45s timeout, 1 repair retry, deterministic fallback
- Rate limiting: 60 req/min/IP on /api

### NFR-003: Privacy & Security
- No patient/PII data collected, sent to external APIs, or logged
- Secrets server-side only (QLOO_API_KEY, LLM_API_KEY, MONGODB_URI)
- CORS allowlist, no stack traces to users
- Aggregate counts only in results/analytics

### NFR-004: Accessibility
- WCAG 2.1 AA compliance
- Semantic HTML, associated labels/errors
- Keyboard-operable popovers (InfoTip), map + list pairing
- Provenance: icon + text + border, never color alone
- `prefers-reduced-motion` respected
- 24px minimum touch targets

### NFR-005: Honesty & Trust
- Cultural relevance ≠ community trust (explicit in copy + provenance)
- Venues: "worth evaluating" / "visit and verify" — never "trusted"
- Reach figures: labeled estimate ranges with stated basis
- Analytics: descriptive, never causal
- Demo data: isolated, tagged illustrative, persistent banner

## Acceptance Criteria References

See [Acceptance Criteria](../quality/ACCEPTANCE_CRITERIA.md) for testable criteria mapped to each requirement.

---

*Related: [Product Brief](PRODUCT_BRIEF.md) · [User Flows](USER_FLOWS.md) · [Roadmap](ROADMAP.md) · [Acceptance Criteria](../quality/ACCEPTANCE_CRITERIA.md)*