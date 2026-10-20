# Changelog — HealthReach AI

## Format

Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — integration/healthreach-redesign

### Added
- **US-first campaign flow**: USD is the default budget/currency, miles are
  shown for venue distances, and US venue categories/geocoding are used.
  INR and the Kothrud demo remain supported for existing campaigns.
- **East Austin, TX demo** (`scenario=us`) alongside the Kothrud demo; both
  remain isolated in `demo_data.py` and tagged `illustrative`.
- **Qloo progress visibility**: backend-observed request/retry/cache counts,
  per-step status, and `GET /api/campaigns/{id}/evidence/progress`.
- **ResultsMap**: campaign pin, browser-side venue clustering, verification
  states, selectable venue list, and an optional labeled 1-mile search area.
- **InteractiveCharts**: planned-vs-actual bars, cost/registration, attendance
  rate gauge, estimate ranges, and accessible data tables (CSS/SVG only).
- **Analysis views**: evidence summary, venue/category mix, and plan-version
  comparison via `GET /api/campaigns/{id}/plans/compare`.
- **Exports**: results CSV, evidence JSON (PII redacted), and plan PDF
  (minimal built-in writer with qualified-professional review notice).
- **Tests**: 45 backend tests, including currency validation, US demo,
  progress semantics, export privacy/stage rules, and plan comparison.

### Changed
- Campaign, plan, results, and analytics schemas now support dual currencies
  (`budget_usd|budget_inr`, `cost_usd|cost_inr`, `amount_usd|amount_inr`,
  `spend_usd|spend_inr`) with `currency` recorded explicitly.
- Frontend currency-aware formatting and labels; results always save in the
  campaign's currency. Mismatched result currency is rejected.
- README, roadmap, API contracts, progress, TODO, and changelog updated.

### Fixed
- Qloo cache could leak mocked responses between tests; tests now clear it.
- ResultsMap could initialize before its DOM ref existed, skipping markers.

### Documentation
- **Added** Comprehensive documentation system under `docs/`:
  - Product: brief, problem/users, scope, user flows, requirements, roadmap
  - Architecture: system overview, decisions, data flow, agent orchestration, error handling, security/privacy
  - Integrations: Qloo integration & agent chain, LLM contract, OSM integration, geocoding, external services
  - Data: data model, MongoDB collections, provenance model, estimates & metrics
  - API: overview, contracts, error responses, change policy
  - Frontend: architecture, routes/workspace, design system, accessibility, visualization guidelines
  - Quality: acceptance criteria, test strategy, manual QA, release checklist
  - Operations: getting started, configuration, development workflow, runbook, troubleshooting
  - Project: decisions log, risks & mitigations, progress, TODO, changelog
- **Added** Project progress tracking (`PROGRESS.md`) and task management (`TODO.md`)

### API Documentation
- **Added** Detailed API contracts for all endpoints with request/response schemas
- **Added** Error response codes and HTTP status mapping
- **Added** API change policy (additive-only, deprecation process)

### Documentation Quality
- **Fixed** Cross-references between all documents
- **Added** Mermaid diagrams for architecture, data flow, agent chain
- **Verified** All internal links resolve

---

## [0.1.0] — 2026-10-18

### Core Features
- **Added** Four-route architecture: `/` landing, `/new` brief, `/campaigns` list, `/campaigns/[id]` workspace
- **Added** Campaign brief form with guided per-field "why" hints
- **Added** Location autocomplete (Nominatim) + click-map location picking
- **Added** Qloo 3-step agent chain: place affinities → taste tags → cross-check
- **Added** OSM venue discovery via Overpass (3-endpoint failover)
- **Added** Deterministic planner with exact budget enforcement
- **Added** LLM-assisted planner with repair retry + template fallback
- **Added** Plan versioning with section regeneration
- **Added** Aggregate results entry + planned-vs-actual analytics
- **Added** Demo mode with isolated illustrative Kothrud scenario

### Provenance & Honesty
- **Added** Provenance-first model: qloo | geo | ai | user | illustrative
- **Added** UI provenance badges (icon + label + border, never color alone)
- **Added** Honest status vocabulary: ok | thin | unavailable
- **Added** Demo mode isolation: illustrative data only in `demo_data.py`
- **Added** Persistent "Illustrative data" banner for demo
- **Added** "Descriptive, not causal" analytics disclaimer

### Technical Foundation
- **Added** Turborepo + pnpm monorepo (web, api, ui, tsconfig)
- **Added** Next.js 14 App Router + React 18 + TypeScript strict
- **Added** FastAPI + Pydantic v2 + Motor (async MongoDB)
- **Added** Typed API client (`lib/api.ts`) with OpenAPI parity check
- **Added** In-memory MongoDB fallback for zero-config demo
- **Added** 34 backend tests (pipeline + API flow)
- **Added** ESLint + Prettier + TypeScript strict configuration

### Design System
- **Added** Design tokens (CSS custom properties) in `packages/ui/src/tokens.css`
- **Added** Provenance metadata component (`packages/ui/src/index.ts`)
- **Added** Accessible components: InfoTip, MapView, States, ProvenanceBadge
- **Added** Dark mode support with full token set

---

## [0.0.1] — 2026-10-15

### Initial Scaffold
- **Added** Monorepo structure with Turborepo
- **Added** Next.js 14 + FastAPI baseline
- **Added** Landing page with hero and demo entry
- **Added** Campaign brief form with validation
- **Added** Basic campaign list and workspace layout

---

## Upgrade Notes

### From 0.0.1 to 0.1.0
- **Breaking**: API routes restructured (evidence, plan, results, analytics as sub-paths)
- **New**: Qloo 3-step chain replaces single Qloo call
- **New**: Plan versioning and section regeneration
- **New**: Provenance model on all values
- **New**: Demo mode isolation

---

## Contributors

- Ombad Gujar — Architecture, backend, frontend, documentation

---

## Links

- **Repository**: https://github.com/thenameisomm/HealthReach
- **Documentation**: `docs/README.md`
- **API Reference**: `docs/api/API_CONTRACTS.md`
- **Architecture**: `docs/architecture/SYSTEM_OVERVIEW.md`
- **Contributing**: `AGENTS.md`

---

*This changelog is updated with each release. See `docs/project/CHANGELOG.md` for the canonical version.*