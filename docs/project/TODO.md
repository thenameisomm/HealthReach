# TODO — HealthReach AI

## Phase B: Documentation Foundation (Remaining 15)

### API (3)
- [ ] API_CONTRACTS.md — All endpoints with request/response schemas
- [ ] ERROR_RESPONSES.md — Error codes, messages, HTTP status mapping
- [ ] API_CHANGE_POLICY.md — Additive changes only, versioning strategy

### Frontend (5)
- [ ] FRONTEND_ARCHITECTURE.md — Next.js structure, state management, component hierarchy
- [ ] ROUTES_AND_WORKSPACE.md — Four routes, phase state machine, workspace sections
- [ ] DESIGN_SYSTEM.md — Tokens, components, provenance UI, accessibility
- [ ] ACCESSIBILITY.md — WCAG compliance, keyboard, screen reader, reduced motion
- [ ] VISUALIZATION_GUIDELINES.md — Chart library, map/list pairing, export formats

### Quality (4)
- [ ] ACCEPTANCE_CRITERIA.md — Testable criteria for all requirements (FR/NFR)
- [ ] TEST_STRATEGY.md — Unit, integration, E2E, mock strategy, CI
- [ ] MANUAL_QA.md — Browser QA script, viewports, checklists
- [ ] RELEASE_CHECKLIST.md — Pre-release validation steps

### Operations (5)
- [ ] GETTING_STARTED.md — Prerequisites, install, run, verify
- [ ] CONFIGURATION.md — All env vars, defaults, validation
- [ ] DEVELOPMENT_WORKFLOW.md — Commands, branching, commits, PR process
- [ ] RUNBOOK.md — Common operations, debugging, incidents
- [ ] TROUBLESHOOTING.md — Common issues and resolutions

### Project (3)
- [ ] DECISIONS_LOG.md — ADR index with links
- [ ] RISKS_AND_MITIGATIONS.md — Technical, product, external risks
- [ ] CHANGELOG.md — Version history

---

## Phase C: Visual Design System

- [ ] Update packages/ui/src/tokens.css with TasteBound-inspired tokens
- [ ] Create assets/README/healthreach-hero.svg (pure SVG)
- [ ] Create assets/README/architecture.svg
- [ ] Create assets/README/campaign-workflow.svg
- [ ] Create assets/README/qloo-chain.svg
- [ ] Create assets/README/evidence-to-outcomes.svg
- [ ] Validate SVG assets at 900px and 360px widths

---

## Phase D: README Redesign

- [ ] Follow beautify-github-readme skill (README mode, pure SVG hero, static)
- [ ] Restructure product story with editorial hierarchy
- [ ] Integrate SVG hero and diagrams
- [ ] Add accurate implementation status (implemented/planned/blocked)
- [ ] Link to docs/ index
- [ ] Validate GitHub rendering (links, images, mobile)

---

## Phase E: Feature Specifications

### Location & Map
- [ ] LocationAutocomplete v2 spec (debounce, US bias, 120-char cap, stale cancellation)
- [ ] ClickMap v2 spec (reverse geocode, typed field = truth, US viewport, accessible errors)

### Qloo Progress
- [ ] QlooCallCounter spec (backend-observed calls, 3-step progress, retries, cache)
- [ ] Qloo agent chain spec (detailed step I/O, skip handling, persistence)

### US-Focused
- [ ] US-biased geocoding (countrycodes=us, accept-language=en-US)
- [ ] USD formatting ($1,234)
- [ ] Miles distance (meters → miles, 1 decimal)
- [ ] US venue categories (FQHC, health dept, community center, library, park, school, pharmacy)
- [ ] US demo scenario (East Austin, TX)

### Visualization
- [ ] ResultsMap spec (campaign pin, clustered venues, verification badges, optional reach overlay)
- [ ] InteractiveCharts spec (planned vs actual, cost/reg, attendance rate, reach ranges, accessible tables)
- [ ] AnalysisViews spec (evidence dashboard, venue analysis, plan comparison)
- [ ] Exports spec (CSV results, PDF plan, JSON evidence, privacy)

### API Contracts
- [ ] Location search: GET /api/locations/search?q=
- [ ] Reverse geocode: GET /api/locations/reverse?lat=&lon=
- [ ] Evidence progress: extended campaign/evidence API
- [ ] Results & analytics: documented actual/planned, nullability
- [ ] Exports: CSV, PDF, JSON endpoints

---

## Phase F: Targeted Implementation Fixes

- [ ] Fix any broken links from README redesign
- [ ] Align design tokens with documented system
- [ ] Fix inconsistencies between implementation and documentation
- [ ] Add tests for defects discovered during verification

---

## Phase G: Integration & Merge

- [ ] Create integration/healthreach-redesign branch
- [ ] Merge feature/documentation-system into integration branch
- [ ] Merge feature/readme-redesign into integration branch
- [ ] Merge feature/feature-specifications into integration branch
- [ ] Resolve conflicts carefully
- [ ] Run all tests after integration

---

## Phase H: Final Verification

- [ ] pnpm lint passes
- [ ] pnpm typecheck passes
- [ ] pnpm build passes
- [ ] pytest passes (all 34+ tests)
- [ ] Markdown link validation
- [ ] SVG validation
- [ ] No secrets committed
- [ ] Clean working tree (except documented pre-existing changes)
- [ ] Final report generated

---

## Notes

- Work on feature branches, merge to integration branch after validation
- Update PROGRESS.md after each milestone
- Do not modify TasteBound (read-only reference only)
- All implementation in HealthReach only

*Last updated: 2026-10-20*