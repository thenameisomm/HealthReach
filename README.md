<p align="center">
  <img src="assets/README/healthreach-hero.svg" alt="HealthReach AI — Plan health outreach that actually reaches people" width="100%" max-width="1200">
</p>

<p align="center">
  <strong>Plan community health outreach with cultural intelligence, verified ground truth, and AI-assisted planning — then compare plan with results.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#demo">Demo</a> ·
  <a href="#limitations">Limitations</a>
</p>

---

## The Problem

Community health organizers run screening camps, vaccination drives, and awareness events with limited budgets and little evidence about what messaging, channels, and venues will actually work. Generic templates ignore local cultural context — posters, timing, language, and gathering formats that feel alien fail to attract attendees.

**HealthReach AI** gathers two kinds of local evidence and turns them into an inspectable outreach plan:

| Evidence Type | Source | What It Tells You |
|--------------|--------|-------------------|
| **Cultural affinity signals** | Qloo API (taste/cultural insights) | Which message framings, channels, and tones feel familiar to the local audience — so outreach lands instead of lecturing |
| **Verified community venues** | OpenStreetMap (Nominatim + Overpass) | Candidate locations worth evaluating — clinics, community centers, libraries, parks, schools, pharmacies |

---

## How It Works

<p align="center">
  <img src="assets/README/campaign-workflow.svg" alt="HealthReach four-stage campaign workflow: Brief → Evidence → Plan → Results" width="100%" max-width="1200">
</p>

### 1. Brief — Describe Your Campaign
Guided form with per-field "why" hints. Enter topic, location (autocomplete + map pick), audience age range, budget, duration, and objective.

### 2. Evidence — Local Intelligence
- **Qloo 3-step agent chain**: Place affinities → taste tags from top entity → cross-check with second place
- **OSM venues**: Community venues via Overpass with 3-endpoint failover
- Every value carries explicit provenance (icon + label + border, never color alone)

### 3. Plan — Inspectable Outreach Plan
Deterministic planner (always) + LLM attempt (when configured) with repair fallback. Outputs activities, venue candidates, exact budget, draft materials, and estimate ranges — all grounded on evidence.

### 4. Results — Honest Comparison
Aggregate counts only. Planned-vs-actual analytics with descriptive-only comparisons. Null-safe: "Not calculable — needs at least 1 registration."

---

## Architecture

<p align="center">
  <img src="assets/README/architecture.svg" alt="HealthReach system architecture: Next.js frontend, FastAPI backend, shared packages, external integrations" width="100%" max-width="1200">
</p>

**Monorepo**: Turborepo + pnpm workspaces
- `apps/web` — Next.js 14 App Router, React 18, TypeScript strict, Tailwind CSS
- `apps/api` — FastAPI, Pydantic v2, Motor (async MongoDB) + in-memory fallback
- `packages/ui` — Design tokens + provenance metadata
- `packages/tsconfig` — Shared strict TypeScript base

**External Integrations**: Qloo Insights, Nominatim, Overpass, LLM (OpenAI-compatible), MongoDB

---

## Qloo Agent Chain

<p align="center">
  <img src="assets/README/qloo-chain.svg" alt="Qloo 3-step agent chain: place affinities → taste tags → cross-check" width="100%" max-width="1200">
</p>

Cultural intelligence runs as a **deterministic 3-step backend chain** — not an LLM tool:
1. **Place affinities** near the campaign location
2. **Taste tags** seeded by the top place's entity_id
3. **Cross-check** with a second place's entity_id

Every step persisted with plain-language reasoning. Honest status: `ok` | `thin` | `unavailable`.

---

## Evidence to Outcomes

<p align="center">
  <img src="assets/README/evidence-to-outcomes.svg" alt="Full provenance chain: Qloo signals → Plan activities → Aggregate results → Analytics" width="100%" max-width="1200">
</p>

**Provenance at every step** — icon + label + border, never color alone:
- ◈ **Qloo** — taste affinity, never medical fact
- ◎ **Geo** — OSM venues, needs verification
- ✦ **AI** — estimate/draft, inspect and approve
- ● **User** — organizer input
- ◇ **Illustrative** — demo samples only

---

## Quick Start

**Prerequisites**: Node ≥ 18, `pnpm` ≥ 9, Python ≥ 3.11, MongoDB (optional — in-memory fallback)

```bash
# Clone and configure
git clone https://github.com/thenameisomm/HealthReach.git
cd HealthReach
cp .env.example .env   # fill keys you have; empty keys degrade gracefully

# Install and run
pnpm install
pnpm dev               # web :3000 + api :8000 via Turborepo
```

Open **http://localhost:3000**. No keys? The **Kothrud demo** runs the full flow on labeled illustrative data.

### Individual Commands

| Task | Command |
|------|---------|
| Web only | `pnpm dev:web` |
| API only | `pnpm dev:api` (or `uvicorn app.main:app --reload` in `apps/api`) |
| Build all | `pnpm build` |
| Lint / Typecheck | `pnpm lint`, `pnpm typecheck` |
| Backend tests | `pnpm --filter @healthreach/api test` |
| Refresh API types | `pnpm generate:api` (API must be running) |
| MongoDB (optional) | `docker run -d -p 27017:27017 mongo:7` |

---

## Environment Variables (Server-Side Only)

All secrets live in the API process. Nothing prefixed `NEXT_PUBLIC_` except the API base URL.

| Variable | Where | Required? | Empty Behavior |
|----------|-------|-----------|----------------|
| `QLOO_API_KEY` | API | Real cultural signals | "Unavailable" state; plan flagged; retry offered |
| `LLM_API_KEY` (+ `LLM_BASE_URL`, `LLM_MODEL`) | API | AI-drafted plans | Deterministic fallback planner (same schema, exact budget) |
| `MONGODB_URI` | API | Persistence | In-memory fallback (data lost on restart) |
| `CORS_ORIGINS` | API | — | Defaults to `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Web | — | Defaults to `http://localhost:8000` (public, not secret) |

See `.env.example` (committed). Missing keys produce setup messages, never crashes.

---

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Core workflow (4 routes) | ✅ Implemented | Landing, Brief, Campaign List, Workspace |
| Qloo 3-step chain | ✅ Implemented | Persisted steps, honest statuses |
| OSM venue discovery | ✅ Implemented | Overpass failover, 24h geocode cache |
| Deterministic planner | ✅ Implemented | Budget forced exact |
| LLM planner + fallback | ✅ Implemented | 1 repair retry, `planner` label |
| Plan versioning | ✅ Implemented | Section regeneration increments version |
| Results + analytics | ✅ Implemented | Descriptive, null-safe |
| Demo mode (Kothrud) | ✅ Implemented | Isolated, tagged `illustrative` |
| Provenance UI | ✅ Implemented | Icon + label + border per value |
| **US-focused enhancements** | 🔄 Planned (v0.2) | USD, miles, US venue categories, US demo |
| **LocationAutocomplete v2** | 🔄 Planned | Debounce, US bias, stale cancellation |
| **ClickMap v2** | 🔄 Planned | Reverse geocode, US viewport |
| **QlooCallCounter** | 🔄 Planned | Backend-observed calls, 3-step progress |
| **ResultsMap** | 🔄 Planned | Campaign pin, clustered venues, verification |
| **InteractiveCharts** | 🔄 Planned | Planned vs actual, accessible tables |
| **Exports (CSV/PDF/JSON)** | 🔄 Planned | Privacy-preserving |

---

## Demo

**No keys required** — click "See a working example" on the landing page.

The Kothrud demo (Pune, India) runs the full flow on illustrative data:
- Free diabetes screening camp
- Ages 30–60, ₹10,000 budget, 7 days
- Persistent dashed "Illustrative data" banner
- All values tagged `provenance: illustrative` in API responses

**US demo scenario (planned)**: East Austin, TX diabetes screening camp.

---

## Key Principles

### Honesty by Design
- Cultural relevance ≠ community trust
- Venues are "worth evaluating" — never "trusted"
- Reach figures are labeled estimate ranges with stated basis
- Analytics are descriptive, never causal
- Demo data isolated in `demo_data.py`, tagged `illustrative` in API

### Privacy by Design
- Aggregate counts only (registrations, attendance, spend, engagement)
- No patient, personal, or medical data anywhere
- No PII sent to Qloo, LLM, or geocoder

### Accessibility
- WCAG 2.1 AA target
- Semantic HTML, keyboard-operable popovers
- Map always paired with venue list (text alternative)
- Provenance: icon + label + border (never color alone)
- `prefers-reduced-motion` respected

---

## Documentation

Full technical documentation in [`docs/`](docs/):

| Category | Documents |
|----------|-----------|
| **Product** | Brief, Problem & Users, Scope, User Flows, Requirements, Roadmap |
| **Architecture** | System Overview, Decisions, Data Flow, Agent Orchestration, Error Handling, Security |
| **Integrations** | Qloo, LLM Contract, OSM, Geocoding, External Services |
| **Data** | Data Model, MongoDB Collections, Provenance, Estimates & Metrics |
| **API** | Overview, Contracts, Error Responses, Change Policy |
| **Frontend** | Architecture, Routes, Design System, Accessibility, Visualization |
| **Quality** | Acceptance Criteria, Test Strategy, Manual QA, Release Checklist |
| **Operations** | Getting Started, Configuration, Development Workflow, Runbook, Troubleshooting |

---

## Tests & Verification

- **Backend**: 34 tests passing (`test_pipeline.py` + `test_api_flow.py`)
- **Frontend**: `tsc --noEmit` clean, `next lint` clean, `next build` succeeds
- **API Parity**: `pnpm generate:api` verifies TypeScript client against live OpenAPI
- **Manual QA**: Headless Chrome (1280×900 + 390×844), demo happy path, error states, mobile, keyboard focus

```bash
# Run all checks
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @healthreach/api test
```

---

## Limitations (Honest)

- Qloo coverage uneven outside major metros; thin responses shown as thin
- OSM venue completeness varies; all venues need on-ground verification
- No footfall, health-need, trust, or outcome data used
- LLM plans constrained to cite evidence IDs; malformed output retries once, then falls back
- No Hindi/Marathi localization yet; no offline support beyond honest error states
- US-focused enhancements planned for v0.2

---

## License

MIT — see [`LICENSE`](LICENSE).

---

## Contributing

See [`AGENTS.md`](AGENTS.md) for contributor instructions. This project follows a structured branching strategy with `integration/healthreach-redesign` as the integration branch.

---

<p align="center">
  <sub>Built with cultural intelligence • Verified ground truth • Honest by design</sub>
</p>