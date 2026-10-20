# Acceptance Criteria — HealthReach AI

## Format

Each criterion has a unique ID, maps to requirements, and defines testable conditions.

**Traceability**: FR = Functional Requirement, NFR = Non-Functional Requirement (from PRODUCT_REQUIREMENTS.md)

---

## Campaign Brief (FR-001)

| ID | Criterion | Test Method |
|---|---|---|
| AC-BR-001 | Topic field accepts 3-120 chars, shows inline error if invalid | Unit + E2E |
| AC-BR-002 | Location field shows debounced autocomplete suggestions (≥3 chars) | Unit + E2E |
| AC-BR-003 | ClickMap reverse geocodes on click, fills text field | E2E |
| AC-BR-004 | Text field remains source of truth after map selection | E2E |
| AC-BR-005 | Audience age min ≤ max enforced with inline message | Unit + E2E |
| AC-BR-006 | Budget accepts USD, $500-$10M, shows inline error if invalid | Unit + E2E |
| AC-BR-007 | Duration accepts 1-90 days | Unit |
| AC-BR-008 | Objective select has 4 options: awareness, attendance, screening, vaccination | Unit |
| AC-BR-009 | Per-field "why" hints visible on focus/hover | E2E |
| AC-BR-010 | Form input preserved on network error, errors clear on edit | E2E |
| AC-BR-011 | Submit creates campaign, redirects to workspace | E2E |
| AC-BR-012 | Demo mode pre-fills Kothrud brief when `?mode=demo` | E2E |
| AC-BR-013 | Copy-from-campaign works via `?from=<id>` | E2E |

---

## Evidence Gathering (FR-002, FR-003)

| ID | Criterion | Test Method |
|---|---|---|
| AC-EV-001 | Qloo Step 1: place affinities queried with location + radius | Unit (mock) |
| AC-EV-002 | Qloo Step 2: taste tags from top place entity_id | Unit (mock) |
| AC-EV-003 | Qloo Step 3: cross-check with second place (if available) | Unit (mock) |
| AC-EV-004 | Each step persisted as QlooChainStep with plain-language fields | Unit |
| AC-EV-005 | Step status: ok | skip (never error) | Unit |
| AC-EV-006 | Skip reasons are plain language, no technical terms | Unit |
| AC-EV-007 | OSM venues fetched via Overpass 3-endpoint failover | Unit (mock) |
| AC-EV-008 | Venue categories: clinic, pharmacy, community_centre, library, school, park, marketplace | Unit |
| AC-EV-009 | Every venue has needs_verification: true | Unit |
| AC-EV-009 | Evidence status vocabulary: ok | thin | unavailable | Unit |
| AC-EV-010 | Qloo thin response → qloo_status: thin, note explains | Unit |
| AC-EV-011 | Qloo auth failure → qloo_status: unavailable, key rejected note | Unit |
| AC-EV-012 | OSM all endpoints fail → geo_status: unavailable | Unit |
| AC-EV-013 | Evidence snapshot stored per campaign | Integration |
| AC-EV-014 | Evidence UI: familiarity hints in plain language | E2E |
| AC-EV-015 | Evidence UI: Qloo chain steps displayed as numbered cards | E2E |
| AC-EV-016 | Evidence UI: MapView + venue list (text alternative) | E2E |
| AC-EV-017 | Evidence UI: provenance badges on all values | E2E |

---

## Plan Generation (FR-004, FR-005)

| ID | Criterion | Test Method |
|---|---|---|
| AC-PL-001 | Deterministic planner always produces valid plan | Unit |
| AC-PL-002 | Budget lines sum EXACTLY to brief budget | Unit |
| AC-PL-003 | Plan includes: activities, venues, budget, materials, metrics, assumptions, limitations | Unit |
| AC-PL-004 | Every plan field has provenance (ai) | Unit |
| AC-PL-005 | LLM attempt when LLM_API_KEY configured | Unit (mock) |
| AC-PL-006 | LLM output validated against Plan schema | Unit |
| AC-PL-007 | LLM repair retry (1x) on validation failure | Unit (mock) |
| AC-PL-008 | LLM failure → fallback to deterministic, planner: standard-template | Unit (mock) |
| AC-PL-009 | LLM success → planner: ai-model | Unit (mock) |
| AC-PL-010 | has_cultural_signals: false when Qloo unavailable | Unit |
| AC-PL-011 | Plan version = 1 on first generation | Unit |
| AC-PL-012 | Section regeneration increments version, preserves other sections | Unit |
| AC-PL-013 | Section regeneration uses template planner (not LLM) | Unit |
| AC-PL-014 | Plan UI: pre-use checklist visible | E2E |
| AC-PL-015 | Plan UI: "How this draft was made" shows planner type | E2E |
| AC-PL-016 | Plan UI: section regen buttons work | E2E |

---

## Results & Analytics (FR-006)

| ID | Criterion | Test Method |
|---|---|---|
| AC-RS-001 | Results accept aggregate counts only (no PII) | Unit + E2E |
| AC-RS-002 | Analytics: planned vs actual table | Unit |
| AC-RS-003 | Analytics: cost_per_registration = actual_spend / actual_registrations | Unit |
| AC-RS-004 | Analytics: attendance_rate = actual_attendance / actual_registrations | Unit |
| AC-RS-005 | Null safety: cost_per_registration = null when registrations = 0 | Unit |
| AC-RS-006 | Null safety: attendance_rate = null when registrations = 0 | Unit |
| AC-RS-007 | Null state UI: "Not calculable — needs at least 1 registration" | E2E |
| AC-RS-008 | Descriptive note included: "Descriptive comparison only..." | Unit + E2E |
| AC-RS-009 | No causal language in analytics | Review |

---

## Demo Mode (FR-007)

| ID | Criterion | Test Method |
|---|---|---|
| AC-DM-001 | Demo data only in demo_data.py | Lint rule |
| AC-DM-002 | All demo values provenance: illustrative | Unit |
| AC-DM-003 | Persistent "Illustrative data" banner in UI | E2E |
| AC-DM-004 | Real-mode paths never import demo_data | Lint rule |
| AC-DM-005 | Demo scenario: Kothrud, Pune, diabetes screening, ₹10,000, 7 days, ages 30-60 | Unit |

---

## US-Focused Enhancements (FR-008)

| ID | Criterion | Test Method |
|---|---|---|
| AC-US-001 | Nominatim: countrycodes=us, accept-language=en-US | Unit |
| AC-US-002 | Budget formatting: USD ($1,234) | Unit + E2E |
| AC-US-003 | Distance display: miles (1 decimal) | Unit + E2E |
| AC-US-004 | US venue categories: FQHC, health dept, community center, library, park, school, pharmacy | Unit |
| AC-US-005 | US demo scenario: East Austin, TX (distinct from Kothrud) | Unit |

---

## LocationAutocomplete v2 (FR-008.1)

| ID | Criterion | Test Method |
|---|---|---|
| AC-LA-001 | Debounce: 300ms (configurable) | Unit |
| AC-LA-002 | Query cap: 120 characters | Unit |
| AC-LA-003 | US bias in suggestions | Unit (mock) |
| AC-LA-004 | No re-query after selection | Unit |
| AC-LA-005 | Stale request cancellation (AbortController) | Unit |
| AC-LA-006 | Keyboard navigation: arrows, Enter, Escape | E2E |
| AC-LA-007 | Loading, empty, error states | E2E |
| AC-LA-008 | Accessible combobox ARIA pattern | Axe |

---

## ClickMap v2 (FR-008.2)

| ID | Criterion | Test Method |
|---|---|---|
| AC-CM-001 | Click → reverse geocode → fills text field | E2E |
| AC-CM-002 | Text field remains source of truth | E2E |
| AC-CM-003 | US initial viewport (39.8283, -98.5795, zoom 4) | E2E |
| AC-CM-004 | Reverse geocode failure → accessible error toast | E2E |
| AC-CM-005 | Map decorative (aria-hidden), venue list accessible alternative | Axe |
| AC-CM-006 | OSM attribution visible | E2E |

---

## QlooCallCounter (FR-008.3)

| ID | Criterion | Test Method |
|---|---|---|
| AC-QC-001 | Shows actual provider requests (not frontend polls) | Unit |
| AC-QC-002 | Shows 3-step progress (1/3, 2/3, 3/3) | E2E |
| AC-QC-003 | Distinguishes retries, cache hits, failed steps | Unit |
| AC-QC-004 | Backend-observed, not frontend-inferred | Code review |

---

## ResultsMap (FR-009.1)

| ID | Criterion | Test Method |
|---|---|---|
| AC-RM-001 | Campaign pin displayed | E2E |
| AC-RM-002 | Candidate venues as markers | E2E |
| AC-RM-003 | Marker clustering for >10 venues | E2E |
| AC-RM-004 | Verification status on markers + list | E2E |
| AC-RM-005 | Venue list below map (text alternative) | Axe |
| AC-RM-006 | OSM attribution visible | E2E |
| AC-RM-007 | Reach overlay: toggleable, off by default, methodology documented | E2E |

---

## InteractiveCharts (FR-009.2)

| ID | Criterion | Test Method |
|---|---|---|
| AC-IC-001 | Planned vs actual: registrations, attendance, spend, engagement | E2E |
| AC-IC-002 | Cost per registration, attendance rate | E2E |
| AC-IC-003 | Reach estimate ranges shown | E2E |
| AC-IC-004 | Null-safe rendering for zero denominators | Unit + E2E |
| AC-IC-005 | Data table alternative for every chart | Axe |
| AC-IC-006 | Keyboard navigable chart elements | Axe |
| AC-IC-007 | Screen reader labels (aria-label) | Axe |
| AC-IC-008 | Color blind safe (patterns + labels) | Coblis |

---

## AnalysisViews (FR-009.3)

| ID | Criterion | Test Method |
|---|---|---|
| AC-AV-001 | Evidence dashboard: affinity signals, tag overlap, place comparison | E2E |
| AC-AV-002 | Venue analysis: coverage, categories, verification status, distances | E2E |
| AC-AV-003 | Plan-version comparison: diff activities/budget/materials | E2E |

---

## Exports (FR-009.4)

| ID | Criterion | Test Method |
|---|---|---|
| AC-EX-001 | CSV export: results (registrations, attendance, spend, engagement) | Unit + E2E |
| AC-EX-002 | PDF export: plan (activities, venues, budget, materials, metrics) | Unit + E2E |
| AC-EX-003 | JSON export: evidence snapshot (Qloo signals, steps, OSM venues) | Unit + E2E |
| AC-EX-004 | Export privacy: no secrets, no raw provider responses, no PII | Security review |

---

## Non-Functional (NFR)

| ID | Criterion | Test Method |
|---|---|---|
| AC-NF-001 | Brief → evidence ≤ 90s (warm cache) | Perf test |
| AC-NF-002 | Evidence → plan ≤ 10s | Perf test |
| AC-NF-003 | API p95 < 500ms for cached reads | Perf test |
| AC-NF-004 | Frontend FCP < 1.5s, TTI < 3s | Lighthouse |
| AC-NF-005 | Qloo: 12s timeout, retry 3x on 429/5xx | Unit |
| AC-NF-006 | OSM: 1 req/s throttle, 24h cache, 3-endpoint failover | Unit |
| AC-NF-007 | LLM: 45s timeout, 1 repair retry, deterministic fallback | Unit |
| AC-NF-008 | Rate limiting: 60 req/min/IP | Integration |
| AC-NF-009 | No PII collected, sent to external APIs, or logged | Security review |
| AC-NF-010 | Secrets server-side only | Security review |
| AC-NF-011 | WCAG 2.1 AA compliance | Axe + manual |
| AC-NF-012 | Provenance: icon + text + border, never color alone | Axe + review |
| AC-NF-013 | Cultural relevance ≠ trust communicated | Review |
| AC-NF-014 | Venues: "worth evaluating" / "visit and verify" | Review |
| AC-NF-015 | Estimates labeled with basis | Review |
| AC-NF-016 | Analytics descriptive, never causal | Review |

---

## Test Coverage Requirements

| Area | Minimum Coverage |
|---|---|
| Qloo client (orchestration, retries, skip handling) | 100% branches |
| Geo client (throttle, cache, failover) | 100% branches |
| Planner (budget exactness, LLM fallback) | 100% branches |
| Analytics (null safety, descriptive only) | 100% branches |
| API contracts (request/response validation) | 100% endpoints |
| Frontend components (accessibility, error states) | Axe zero violations |

---

*Related: [Product Requirements](../product/PRODUCT_REQUIREMENTS.md) · [Test Strategy](TEST_STRATEGY.md) · [Manual QA](MANUAL_QA.md)*