# Product Brief — HealthReach AI

## One-Liner

**HealthReach AI helps community health organizers plan, execute, and evaluate outreach campaigns using cultural intelligence and verified local venues — then compare plan with results.**

## The Problem

Community health organizers (NGOs, clinics, outreach coordinators) run screening camps, vaccination drives, and awareness events with limited budgets and little data about what messaging and channels actually resonate with their target communities.

Current tools fall short:
- **Demographic data** (census, claims) shows *who lives there* but not *what they respond to*.
- **Footfall/location data** shows *where people go* but not *why* or *how to reach them*.
- **Generic campaign templates** ignore local cultural context — posters, timing, language, and gathering formats that feel alien fail to attract attendees.

Organizers waste money on campaigns that don't land, and communities miss out on preventive care.

## The Solution

HealthReach AI gathers two kinds of local evidence and turns them into an inspectable outreach plan:

| Evidence Type | Source | What It Tells You |
|---|---|---|
| **Cultural affinity signals** | Qloo API (taste/cultural insights) | Which message framings, channels, and tones feel familiar to the local audience — so outreach lands instead of lecturing |
| **Verified community venues** | OpenStreetMap (Nominatim + Overpass) | Candidate locations worth evaluating for the campaign — clinics, community centers, libraries, parks, schools, pharmacies |

The workflow:
1. **Brief** — Organizer describes the campaign (topic, place, audience, budget, duration, objective)
2. **Evidence** — HealthReach fetches Qloo cultural signals (3-step agent chain) + OSM venues
3. **Plan** — Deterministic planner (or LLM-assisted when configured) produces activities, venue candidates, exact budget breakdown, draft materials, and estimate ranges
4. **Results** — After the camp, organizer enters aggregate counts (registrations, attendance, spend, engagement)
5. **Analysis** — Planned-vs-actual comparison (descriptive, never causal)

## Key Differentiators

1. **Qloo runs as a deterministic 3-step agent chain**, not a single query. Each step's output seeds the next — place affinities → taste tags from top entity → cross-check with second place. Every step is persisted and shown.
2. **Provenance-first UI**: Every displayed value carries an explicit source label (qloo | geo | ai | user | illustrative) with icon + text + border — never color alone.
3. **Honest by design**: Cultural relevance ≠ community trust. Venues are "worth evaluating," never "trusted." Reach figures are labeled estimate ranges. Analytics are descriptive, never causal.
4. **Demo mode isolated**: Illustrative data lives only in `demo_data.py`, tagged `illustrative` in API responses, behind a persistent banner. Real-mode paths never import it.
5. **Privacy by design**: Aggregate counts only. No patient, personal, or medical data anywhere.

## Target Users

| User | Role | Decision |
|---|---|---|
| NGO program coordinator | Plans outreach campaigns | Which communities, what messaging, where to hold events |
| Clinic outreach team | Runs screening/vaccination camps | Venue selection, budget allocation, volunteer coordination |
| Public health campaign planner | Regional/state-level campaigns | Market selection, channel mix, resource allocation |

## Success Metrics (Product)

| Metric | Target |
|---|---|
| Time from brief to draft plan | ≤ 90 seconds (warm cache) |
| Provenance coverage | 100% of displayed values |
| Qloo chain completion rate | ≥ 80% of markets with ≥ 2 steps |
| Planned-vs-actual data entry | Organizer completes within 7 days post-campaign |
| Demo mode clarity | Zero confusion between illustrative and real data |

## Non-Goals

- Hospital management or patient records
- Medical diagnosis or clinical decision support
- Individual-level health predictions
- Footfall analytics or venue trust scores
- Epidemiology or disease surveillance
- Multi-user accounts, dashboards, or settings
- Offline-first operation

## Implementation Status

**Implemented**: Core workflow (brief → evidence → plan → results), Qloo 3-step chain, OSM venues, provenance UI, demo mode isolation, MongoDB + in-memory fallback, 34 backend tests passing.

**Partially Implemented**: US-focused venue categories, USD formatting, miles distance, LocationAutocomplete v2 debounce enhancements, ClickMap v2, QlooCallCounter, ResultsMap, InteractiveCharts, AnalysisViews.

**Specified Only**: Export formats (CSV/PDF/JSON), plan-version comparison, advanced venue analysis.

---

*Related: [Problem & Users](PROBLEM_AND_USERS.md) · [Scope & Non-Goals](SCOPE_AND_NON_GOALS.md) · [User Flows](USER_FLOWS.md) · [Product Requirements](PRODUCT_REQUIREMENTS.md) · [Roadmap](ROADMAP.md)*