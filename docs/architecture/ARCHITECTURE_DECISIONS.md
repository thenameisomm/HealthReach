# Architecture Decisions — HealthReach AI

## Decision Record Format

Each decision records: **Context**, **Decision**, **Consequences**, **Alternatives Considered**, **Status**.

---

## ADR-001: Monorepo with Turborepo + pnpm

**Context**: Need to share TypeScript types, design tokens, and configuration between frontend and backend-adjacent tooling.

**Decision**: Use Turborepo 2 with pnpm 9 workspaces. Three workspaces: `apps/web`, `apps/api`, `packages/ui`, `packages/tsconfig`.

**Consequences**:
- Single `pnpm install` installs all dependencies
- `pnpm dev` runs web + api concurrently via Turbo persistent tasks
- Shared `packages/ui` tokens used in both web (Tailwind) and potentially backend docs
- TypeScript config shared via `packages/tsconfig/base.json`

**Alternatives**: Nx (heavier), separate repos (type sharing harder), yarn workspaces (pnpm faster).

**Status**: ✅ Implemented

---

## ADR-002: Four Routes Only — No Dashboards, Accounts, Settings

**Context**: Product serves non-technical organizers who need a guided workflow, not a dashboard.

**Decision**: Exactly four routes: `/` (landing), `/new` (brief), `/campaigns` (list), `/campaigns/[id]` (workspace with 4 staged sections).

**Consequences**:
- Simpler mental model: always clear what step is next
- No auth/account complexity
- Workspace phase state machine (`loading|brief|evidence-loading|evidence|plan-loading|ready`) drives UI
- Campaign list shows per-campaign next-step badge

**Alternatives**: Dashboard with sidebar navigation, multi-step wizard with separate URLs per step.

**Status**: ✅ Implemented

---

## ADR-003: Provenance-First UI (Icon + Label + Border, Never Color Alone)

**Context**: Organizers must know where every number comes from. Color-blind accessibility requires non-color cues.

**Decision**: Every displayed value carries `Provenance` (qloo|geo|ai|user|illustrative) rendered as:
- Icon (distinct per category)
- Text label (e.g., "Qloo signal")
- Left border weight/style (solid, dashed for illustrative, hatched for illustrative)
- Never color alone

**Consequences**:
- `packages/ui/src/index.ts` exports `provenanceMeta` with icon, label, border classes
- Components use `ProvenanceBadge` consistently
- Illustrative data gets dashed border + hatch + "Illustrative data" banner
- WCAG 2.1 AA compliant for provenance communication

**Alternatives**: Color-coded badges, tooltips only, single "source" column.

**Status**: ✅ Implemented

---

## ADR-004: Qloo as Deterministic 3-Step Agent Chain (Not LLM Tool)

**Context**: Qloo provides cultural affinity signals. The product must show *how* conclusions were reached, not just the conclusion.

**Decision**: Backend orchestrates a fixed 3-step chain in `qloo_client.fetch_cultural_signals`:
1. Place affinities near campaign location
2. Taste tags seeded by top place's entity_id (`signal.interests.entities`)
3. Cross-check with second place

Each step persisted as `QlooChainStep` with plain-language title, asked, found, next, status (ok/skip), skip_reason.

**Consequences**:
- Full traceability: organizer sees the reasoning path
- LLM never calls Qloo directly — only writes grounded prose from persisted evidence
- Failures at any step recorded honestly (`skip` with reason), never invented
- Chain is deterministic code, not agent non-determinism

**Alternatives**: Single Qloo query, LLM-as-agent with Qloo tool, parallel independent queries.

**Status**: ✅ Implemented

---

## ADR-005: OSM (Nominatim + Overpass) Over Google Maps/Mapbox

**Context**: Need geocoding and venue discovery without billing keys for hackathon demo accessibility.

**Decision**: OpenStreetMap stack:
- Nominatim: geocode, reverse geocode, autocomplete (1 req/s throttle, 24h cache, HTTP/1.1 + identifying UA)
- Overpass: community venues (clinic, pharmacy, community_centre, library, school, park, marketplace) with 3-endpoint failover
- Leaflet: map rendering with OSM/CARTO tiles + attribution

**Consequences**:
- Zero API keys required for core functionality
- Clear usage policies (ODbL), attribution mandatory
- Venues are *mapped candidates* — every venue has `needs_verification: true`
- No footfall, trust scores, or healthcare facility data (OSM doesn't have it reliably)

**Alternatives**: Google Places (billing key, expensive), Mapbox (billing key), Foursquare (billing key).

**Status**: ✅ Implemented

---

## ADR-006: LLM as Grounded Prose Generator Only (Not Autonomous Agent)

**Context**: LLM can help write plan prose but must not hallucinate evidence or make Qloo calls.

**Decision**: `llm_client` generates structured JSON for plan fields only. Constraints:
- Prompt includes only persisted evidence (Qloo signals + steps, OSM venues)
- Output validated by Pydantic models
- One repair retry on validation failure
- Deterministic fallback planner always available (`standard-template`)
- `Plan.planner` truthfully reads `ai-model` or `standard-template`

**Consequences**:
- No Qloo calls from LLM
- No hallucinated evidence refs (validated against persisted signal IDs)
- Budget exactness guaranteed by deterministic planner (LLM output adjusted or discarded)
- Section regeneration uses template planner (version++)

**Alternatives**: LLM with Qloo tool calling, fully autonomous agent, no LLM at all.

**Status**: ✅ Implemented

---

## ADR-007: Demo Mode Isolation (Illustrative Data Only in demo_data.py)

**Context**: Demo must work without API keys but never leak illustrative data into real mode.

**Decision**: 
- All illustrative values defined only in `apps/api/app/services/demo_data.py`
- Demo endpoints (`/api/demo/scenario`, `POST /api/campaigns` with `mode=demo`) return `provenance: illustrative` on every value
- Persistent dashed "Illustrative data" banner in UI
- Real-mode code paths never import `demo_data` (enforced by lint/test)

**Consequences**:
- Zero confusion between demo and real data
- Demo works offline (no Qloo/OSM calls)
- Illustrative data clearly labeled in API responses, not just UI

**Alternatives**: Mock Qloo/OSM in real mode, shared test fixtures, feature flags.

**Status**: ✅ Implemented

---

## ADR-008: MongoDB with In-Memory Fallback

**Context**: Demo should work without MongoDB; production needs persistence.

**Decision**: `db.py` provides Motor async MongoDB with transparent in-memory fallback (dict-based) when `MONGODB_URI` not set or connection fails.

**Consequences**:
- Zero-config demo (no Docker required)
- Data lost on restart in fallback mode (acceptable for demo)
- Same async interface for both backends
- TTL index declared for `ext_cache` (external response caching)

**Alternatives**: SQLite, Redis, required MongoDB.

**Status**: ✅ Implemented

---

## ADR-009: Typed API Client (lib/api.ts) with OpenAPI Parity Check

**Context**: Frontend/Backend type drift causes runtime errors.

**Decision**: Hand-maintained `lib/api.ts` mirrors FastAPI OpenAPI schema. `pnpm generate:api` hits live `/openapi.json` and verifies route parity (fails if API unreachable or drift detected).

**Consequences**:
- Single source of truth for API contracts
- TypeScript strict catches breaking changes at compile time
- `generate:api` script must run against live API (CI runs it)

**Alternatives**: Auto-generated client (orval, openapi-typescript), manual sync without verification.

**Status**: ✅ Implemented

---

## ADR-010: Honest Status Vocabulary (ok | thin | unavailable)

**Context**: External APIs fail, return partial data, or are unconfigured. UI must communicate this clearly.

**Decision**: Three-status vocabulary for all external integrations:
- `ok`: Full expected data returned
- `thin`: Service responded but data is sparse/limited (e.g., 1 venue, 1 Qloo signal)
- `unavailable`: Service failed, key missing, or network error

Applied to: Qloo (`qloo_status`), OSM venues (`geo_status`), LLM (planner label), geocoding.

**Consequences**:
- Organizer knows when plan is based on limited evidence
- Plan shows `has_cultural_signals: false` when Qloo unavailable
- Retry offered only when retry can help (not for missing keys)
- No silent degradation to fake data

**Alternatives**: Boolean success/fail, error codes only, silent fallback.

**Status**: ✅ Implemented

---

## ADR-011: Aggregate Results Only (No Patient Data)

**Context**: Privacy by design; organizers don't collect individual data.

**Decision**: Results input accepts only aggregate counts: registrations, attendance, spend, engagement (+ optional notes). No names, phones, diagnoses, or individual records anywhere.

**Consequences**:
- GDPR/HIPAA not triggered (no personal/health data)
- Analytics derived from aggregates only
- Export formats (CSV/PDF/JSON) contain only aggregates
- Clear privacy statement on landing, brief, and results forms

**Alternatives**: Individual participant tracking, pseudonymized records.

**Status**: ✅ Implemented

---

## ADR-012: US-Focused Product Direction (Planned)

**Context**: Current demo uses Kothrud, Pune (₹, km, Indian venue categories). Target market is US organizers.

**Decision**: Shift defaults to US:
- Nominatim: `countrycodes=us`, `accept-language=en-US`
- Budget: USD formatting (`$1,234`)
- Distance: miles (meters → miles, 1 decimal)
- Venue categories: FQHC, health department, community center, library, park, school, pharmacy
- Demo scenario: US location (e.g., East Austin, TX)

**Consequences**:
- Requires updates to `geo_client.py`, `planner.py`, brief form, demo data
- Overpass query adjusted for US-relevant tags
- Existing Kothrud demo preserved as illustrative example

**Alternatives**: Multi-country with locale detection, keep India demo only.

**Status**: 🔄 Planned (v0.2)

---

## ADR-013: LocationAutocomplete v2 + ClickMap v2 (Planned)

**Context**: Current location picking works but lacks debounce control, US bias, and stale request handling.

**Decision**: Enhance both components:
- LocationAutocomplete: 300ms debounce, 120-char cap, US-biased, no re-query after selection, stale request cancellation
- ClickMap: reverse geocode on click, typed field remains source of truth, US initial viewport, accessible error handling

**Consequences**:
- Better UX for US organizers
- Fewer wasted Nominatim requests
- Clearer mental model: typed field = truth, map = picker

**Status**: 🔄 Planned (v0.2)

---

*Related: [System Overview](SYSTEM_OVERVIEW.md) · [Data Flow](DATA_FLOW.md) · [Agent Orchestration](AGENT_ORCHESTRATION.md)*