# Scope & Non-Goals — HealthReach AI

## In Scope (MVP + Planned Enhancements)

### Core Workflow (Implemented)
- [x] Campaign brief creation (topic, location, audience, budget, duration, objective)
- [x] Geocoding via Nominatim (autocomplete + reverse geocode)
- [x] Qloo 3-step agent chain for cultural signals
- [x] OSM venue discovery via Overpass (community venues)
- [x] Evidence snapshot storage with provenance
- [x] Deterministic plan generation (activities, venues, budget, materials, metrics)
- [x] LLM-assisted plan generation (when `LLM_API_KEY` configured) with repair fallback
- [x] Plan versioning (section regeneration increments version)
- [x] Aggregate results entry (registrations, attendance, spend, engagement)
- [x] Planned-vs-actual analytics (descriptive only)
- [x] Demo mode with illustrative Kothrud scenario
- [x] Provenance-first UI (icon + label + border per value)
- [x] Four routes: `/`, `/new`, `/campaigns`, `/campaigns/[id]`

### US-Focused Enhancements (Implemented)
- [x] US-biased geocoding (Nominatim `countrycodes=us`, `accept-language=en-US`)
- [x] USD-first budget formatting (`$1,234`; INR remains supported)
- [x] Miles distance display (convert from meters)
- [x] US-relevant OSM venue categories:
  - FQHCs (Federally Qualified Health Centers) — `amenity=clinic` + `healthcare:speciality=fqhc`
  - Local health departments — `office=government` + `government=health`
  - Community centers — `amenity=community_centre`
  - Libraries — `amenity=library`
  - Parks — `leisure=park`
  - Schools — `amenity=school`
  - Pharmacies — `amenity=pharmacy`
- [x] US demo scenario (East Austin, TX diabetes screening camp)
- [ ] US phone/address formatting helpers — not needed; the product collects
  no phone numbers (privacy by design) and uses one location field

### Enhanced Location Picking (Implemented)
- [x] LocationAutocomplete v2: debounced (300ms), 120-char cap, US bias, no re-query after selection, stale request cancellation
- [x] ClickMap v2: reverse geocode on click, typed field remains source of truth, US initial viewport, accessible error handling

### Qloo Progress & Analysis (Implemented)
- [x] QlooCallCounter: backend-observed request count + 3-step progress (steps, retries, cached)
- [x] Evidence dashboard: signals, place comparison, provenance, status
- [x] Venue analysis: geographic coverage, category distribution, verification status, distances
- [x] Plan-version comparison: diff activities/budget/materials across versions

### Visualization & Export (Implemented)
- [x] ResultsMap: campaign venue pin, clustered candidates, verification state, optional 1-mile search-area overlay
- [x] InteractiveCharts: planned vs actual (registrations, attendance, spend, engagement), cost/registration, attendance rate, reach estimate ranges
- [x] AnalysisViews: evidence dashboard, venue analysis, plan comparison
- [x] Exports: CSV (results), PDF (plan), JSON (evidence snapshot)

**Not implemented**: reach-estimate overlay (requires venue capacity/attendance
data); the 1-mile circle is labeled as a search area only.

## Out of Scope (Explicit Non-Goals)

| Category | Non-Goal | Rationale |
|---|---|---|
| **Clinical** | Patient records, EHR integration, individual health data | Privacy by design; aggregate only |
| **Clinical** | Medical diagnosis, clinical decision support | Not a clinical tool; organizers are non-clinical |
| **Clinical** | Epidemiology, disease surveillance, outbreak detection | Qloo doesn't provide health data; would be misleading |
| **Analytics** | Footfall analytics, venue trust scores, footfall prediction | OSM doesn't provide footfall; Qloo doesn't provide trust |
| **Analytics** | Causal attribution (plan → outcome) | Descriptive only; correlation ≠ causation |
| **Analytics** | Demand forecasting, visitor prediction | No data supports this; would be fabrication |
| **Platform** | User accounts, authentication, multi-tenancy | Single-organizer workflow; no dashboard needed |
| **Platform** | Settings, notifications, admin panels | Doesn't serve core objective |
| **Platform** | Offline mode, PWA, background sync | Honest error states instead |
| **Localization** | Hindi/Marathi/other language support | Future work; copy written to enable it |
| **Integrations** | Google Maps, Mapbox, proprietary venue data | Open data only (OSM); no billing keys |
| **Integrations** | CRM, email marketing, volunteer management | Separate tools; export covers handoff |
| **AI/LLM** | Autonomous agent that calls Qloo | LLM only writes grounded prose; Qloo chain is deterministic code |
| **AI/LLM** | Chat interface, free-form Q&A | Structured workflow only |

## Scope Boundaries

### Qloo Usage Boundary
- **In scope**: `urn:entity:place` affinities, `urn:tag` taste tags, `signal.interests.entities`, `signal.location`, `feature.explainability`
- **Out of scope**: `urn:heatmap`, `urn:demographics`, `urn:entity:audience` (deprecated), `urn:entity:locality` (partially supported), any health/medical entity types

### OSM Usage Boundary
- **In scope**: Community venues relevant to outreach (amenity, leisure, shop, building tags listed above)
- **Out of scope**: Residential addresses, private businesses not serving community, commercial POIs, routing/navigation

### LLM Usage Boundary
- **In scope**: Grounded prose generation for plan activities, materials, summaries — constrained to evidence refs
- **Out of scope**: Any Qloo API calls, venue selection, budget allocation, clinical recommendations

---

*Related: [Product Brief](PRODUCT_BRIEF.md) · [Product Requirements](PRODUCT_REQUIREMENTS.md) · [Roadmap](ROADMAP.md)*