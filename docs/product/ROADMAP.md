# Roadmap — HealthReach AI

## Current Status (v0.1 — Implemented)

| Area | Status | Notes |
|---|---|---|
| Core workflow (brief→evidence→plan→results) | ✅ Implemented | 4 routes, phase state machine |
| Qloo 3-step agent chain | ✅ Implemented | Persisted steps, honest statuses |
| OSM venues (Nominatim + Overpass) | ✅ Implemented | 3-endpoint failover, 24h cache |
| Deterministic planner | ✅ Implemented | Budget exact, provenance-first |
| LLM planner (with fallback) | ✅ Implemented | Repair retry, schema validation |
| Plan versioning (section regen) | ✅ Implemented | Version increment, refs preserved |
| Aggregate results + analytics | ✅ Implemented | Descriptive, null-safe |
| Demo mode (Kothrud) | ✅ Implemented | Isolated, tagged illustrative |
| Provenance UI (icon+label+border) | ✅ Implemented | 5 categories |
| Backend tests | ✅ 34 passing | Pipeline + API flow |
| TypeScript strict / ESLint clean | ✅ Passing | `tsc --noEmit`, `next lint` |

---

## Phase 1: US-Focused Product & Enhanced Location (v0.2 — Target: 2 weeks)

| ID | Requirement | Effort | Dependencies |
|---|---|---|---|
| US-01 | US-biased geocoding (Nominatim `countrycodes=us`, `accept-language=en-US`) | S | geo_client.py |
| US-02 | USD formatting (`$1,234`) + budget input in USD | S | tokens.css, brief form, planner |
| US-03 | Miles distance display (meters → miles, 1 decimal) | S | geo_client, MapView, venue list |
| US-04 | US venue categories (FQHC, health dept, community center, library, park, school, pharmacy) | M | Overpass query, GeoVenue model |
| US-05 | LocationAutocomplete v2: debounce 300ms, 120-char cap, US bias, no re-query after selection, stale cancellation | M | LocationAutocomplete.tsx, /api/geo/suggest |
| US-06 | ClickMap v2: reverse geocode on click, typed field = source of truth, US viewport, accessible errors | M | ClickMap.tsx, /api/geo/reverse |
| US-07 | US demo scenario (East Austin, TX diabetes screening) | S | demo_data.py, /api/demo/scenario |

**Acceptance**: Organizer can create a US campaign end-to-end with USD, miles, US venues, and see a US demo.

---

## Phase 2: Qloo Progress Visibility & Evidence Depth (v0.3 — Target: 2 weeks)

| ID | Requirement | Effort | Dependencies |
|---|---|---|---|
| QP-01 | QlooCallCounter component: backend-observed request count, 3-step progress, retries, cached | M | qloo_client.py, EvidenceSnapshot, new API endpoint |
| QP-02 | Evidence dashboard: affinity signals, tag overlap, place comparison, provenance, freshness | M | QlooSignal, QlooChainStep, new frontend section |
| QP-03 | Qloo step failure semantics documented and tested (skip reasons, key rejection, thin) | S | test_pipeline.py |

**Acceptance**: Organizer sees live Qloo call count and step-by-step progress; can inspect evidence depth per signal.

---

## Phase 3: Results Map & Interactive Charts (v0.4 — Target: 3 weeks)

| ID | Requirement | Effort | Dependencies |
|---|---|---|---|
| RM-01 | ResultsMap: campaign pin, candidate venues (clustered), verification badges, optional reach overlay | L | MapView, Leaflet.markercluster, GeoVenue |
| RM-02 | Venue list parity (text alternative) with verification status | S | ResultsMap |
| IC-01 | InteractiveCharts: planned vs actual (registrations, attendance, spend, engagement) | M | Analytics data, Recharts or similar |
| IC-02 | Cost per registration, attendance rate, reach estimate ranges | S | Analytics computation |
| IC-03 | Accessible alternatives: data tables, keyboard nav, screen reader labels | M | Chart components |
| IC-04 | Null-safe rendering: "Not calculable" states | S | Analytics model |

**Acceptance**: Organizer sees campaign on map with venues; compares plan vs actual via interactive charts with accessible fallbacks.

---

## Phase 4: Analysis Views & Exports (v0.5 — Target: 2 weeks)

| ID | Requirement | Effort | Dependencies |
|---|---|---|---|
| AV-01 | Venue analysis: geographic coverage, category distribution, verification status, distances | M | GeoVenue, MapView |
| AV-02 | Plan-version comparison: diff activities/budget/materials across versions | M | Plan versioning, new API endpoint |
| EX-01 | CSV export: aggregate results (registrations, attendance, spend, engagement, dates) | S | ResultsInput, new API endpoint |
| EX-02 | PDF export: campaign plan (activities, venues, budget, materials, metrics) | M | Plan model, PDF generation (reportlab or similar) |
| EX-03 | JSON export: evidence snapshot (Qloo signals + steps, OSM venues, provenance) | S | EvidenceSnapshot, new API endpoint |
| EX-04 | Export privacy: no secrets, no raw provider responses, no patient data | S | All exports |

**Acceptance**: Organizer can export results, plan, and evidence in standard formats with privacy guarantees.

---

## Phase 5: Polish, Hardening & Documentation (v1.0 — Target: 2 weeks)

| ID | Requirement | Effort | Dependencies |
|---|---|---|---|
| PL-01 | Design system update: TasteBound-inspired tokens (warm canvas, mint/voltage, editorial typography) | M | tokens.css, globals.css, components |
| PL-02 | README redesign: pure SVG hero, architecture/workflow diagrams, accurate status | M | beautify-github-readme skill, assets/README/ |
| PL-03 | Documentation complete: all docs/ files current, cross-linked, validated | M | This docs/ structure |
| PL-04 | Accessibility audit: WCAG 2.1 AA, keyboard, screen reader, reduced motion | M | All UI components |
| PL-05 | Browser QA: 1280×900 + 390×844, console errors, overflow, demo happy path | M | Puppeteer scripts in /tmp |
| PL-06 | Test coverage: add tests for new features (US geo, Qloo counter, charts, exports) | M | pytest, new test files |

**Acceptance**: Production-ready codebase with professional README, complete docs, passing quality gates.

---

## Future Considerations (Post v1.0)

| Idea | Rationale | Blocker |
|---|---|---|
| Multi-campaign dashboard | Funders want portfolio view | Requires auth/account model |
| Hindi/Spanish localization | US communities need it | i18n infrastructure |
| Qloo heatmap strategy | Cheaper per-run calls | Need to verify heatmap quality |
| LLM tool calling (Qloo as tool) | More flexible evidence gathering | Requires verified tool-calling LLM |
| Venue verification workflow | Photo upload, capacity check, permission tracking | Significant new feature |
| Predictive reach modeling | ML on historical plan vs actual | Need sufficient training data |

---

## Release Criteria Per Version

| Version | Must Pass |
|---|---|
| v0.2 | US campaign end-to-end; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pytest` all green |
| v0.3 | QlooCallCounter accurate vs mocked provider; evidence dashboard loads; tests added |
| v0.4 | ResultsMap renders at 900px + 360px; charts accessible; null-safe; tests added |
| v0.5 | Exports generate valid files; privacy audit passes; plan diff works; tests added |
| v1.0 | All quality gates; README renders on GitHub; docs links valid; no secrets; clean Git history |

---

## Milestone Tracking

| Milestone | Target Date | Actual Date | Status |
|---|---|---|---|
| v0.1 baseline | 2026-10-15 | 2026-10-18 | ✅ Done |
| v0.2 US-focused | 2026-11-01 | — | 🔄 In Progress |
| v0.3 Qloo progress | 2026-11-15 | — | ⏳ Planned |
| v0.4 Map + Charts | 2026-12-06 | — | ⏳ Planned |
| v0.5 Analysis + Export | 2026-12-20 | — | ⏳ Planned |
| v1.0 Release | 2027-01-03 | — | ⏳ Planned |

---

*Related: [Product Requirements](PRODUCT_REQUIREMENTS.md) · [Acceptance Criteria](quality/ACCEPTANCE_CRITERIA.md) · [Project Progress](project/PROGRESS.md)*