# TODO — HealthReach AI

## Phase B: Documentation Foundation ✅ (Complete)

All 43 documentation files created and cross-referenced.

---

## Phase C: Visual Design System ✅ (Complete)

- [x] Update packages/ui/src/tokens.css with TasteBound-inspired tokens
- [x] Create assets/README/healthreach-hero.svg (pure SVG)
- [x] Create assets/README/architecture.svg
- [x] Create assets/README/campaign-workflow.svg
- [x] Create assets/README/qloo-chain.svg
- [x] Create assets/README/evidence-to-outcomes.svg
- [x] Validate SVG assets at 900px and 360px widths
- [x] Update .gitignore with comprehensive patterns

---

## Phase D: README Redesign ✅ (Complete)

- [x] Follow beautify-github-readme skill (README mode, pure SVG hero, static)
- [x] Restructure product story with editorial hierarchy
- [x] Integrate SVG hero and diagrams
- [x] Add accurate implementation status (implemented/planned/blocked)
- [x] Link to docs/ index
- [x] Validate GitHub rendering (links, images, mobile)

---

## Phase E: Feature Specifications ✅ (Complete)

### Location & Map
- [x] LocationAutocomplete v2 spec (debounce, US bias, 120-char cap, stale cancellation)
- [x] ClickMap v2 spec (reverse geocode, typed field = truth, US viewport, accessible errors)

### Qloo Progress
- [x] QlooCallCounter spec (backend-observed calls, 3-step progress, retries, cache)
- [x] Qloo agent chain spec (detailed step I/O, skip handling, persistence)

### US-Focused
- [x] US-biased geocoding (countrycodes=us, accept-language=en-US)
- [x] USD formatting ($1,234)
- [x] Miles distance (meters → miles, 1 decimal)
- [x] US venue categories (FQHC, health dept, community center, library, park, school, pharmacy)
- [x] US demo scenario (East Austin, TX)

### Visualization
- [x] ResultsMap spec (campaign pin, clustered venues, verification badges, optional reach overlay)
- [x] InteractiveCharts spec (planned vs actual, cost/reg, attendance rate, reach ranges, accessible tables)
- [x] AnalysisViews spec (evidence dashboard, venue analysis, plan comparison)
- [x] Exports spec (CSV results, PDF plan, JSON evidence, privacy)

### API Contracts
- [x] Location search: GET /api/locations/search?q=
- [x] Reverse geocode: GET /api/locations/reverse?lat=&lon=
- [x] Evidence progress: extended campaign/evidence API
- [x] Results & analytics: documented actual/planned, nullability
- [x] Exports: CSV, PDF, JSON endpoints

---

## Phase F: Targeted Implementation Fixes (In Progress)

- [x] LocationAutocomplete v2: US-biased geocoding, 300ms debounce, 120-char cap, stale cancellation
- [x] ClickMap v2: reverse geocode, typed field = truth, US viewport, accessible errors
- [ ] QlooCallCounter: backend-observed calls, 3-step progress, retries, cache
- [ ] US-focused: USD formatting, miles, US venue categories, US demo scenario
- [ ] ResultsMap: campaign pin, clustered venues, verification badges, reach overlay
- [ ] InteractiveCharts: planned vs actual, cost/reg, attendance rate, reach ranges, accessible tables
- [ ] AnalysisViews & Exports: evidence dashboard, venue analysis, plan comparison, CSV/PDF/JSON exports
- [ ] API contract proposals

---

## Phase G: Integration & Merge

- [x] Create integration/healthreach-redesign branch
- [x] Merge feature/documentation-system into integration branch
- [x] Merge feature/api-contracts into integration branch
- [x] Merge feature/frontend-quality-ops into integration branch
- [x] Merge feat/visual-design-system into integration branch
- [x] Merge feat/readme-redesign into integration branch
- [x] Merge feat/location-autocomplete-v2 into integration branch
- [x] Merge feat/click-map-v2 into integration branch
- [ ] Create feature branches for remaining implementation specs
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